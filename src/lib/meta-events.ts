import type { CheckoutTracking } from "./checkout";
import type { Order } from "./order-store";
import { plans, type Plan, type PlanCategory } from "./plans";
import {
  metaCapiConfigured,
  sendMetaEvents,
  type MetaBrowserSignals,
  type MetaCustomerInfo,
  type MetaEvent,
} from "./meta-capi";

/**
 * Los eventos del negocio que mandamos a Meta. Cada función arma el evento
 * desde nuestros datos y lo entrega a meta-capi.ts.
 *
 * El embudo, con el nombre que Meta les pone en español:
 *   InitiateCheckout ("Iniciar pago")            → entra al checkout
 *   AddPaymentInfo   ("Agregar info. de pago")   → pulsa "Continuar al pago"
 *   Purchase         ("Comprar")                 → la pasarela confirma el pago
 *   Contact          ("Contactar")               → deja su correo en el asesor
 *
 * Ninguna lanza: si Meta falla, el pedido o el lead siguen su curso y en el log
 * queda la razón. Perder un evento de marketing no puede tumbar una venta.
 */

const CURRENCY = "COP";

/**
 * Los `event_id` de los eventos que nacen en el servidor son deterministas a
 * propósito. Sirven para dos cosas: deduplicar contra el mismo evento disparado
 * por el pixel del navegador, y absorber los reintentos del webhook (Wompi
 * reintenta a 30min, 3h y 24h) sin inflar las conversiones. Meta deduplica por
 * event_name + event_id.
 *
 * InitiateCheckout no tiene helper porque nace en el navegador, antes de que
 * exista un pedido: ese id lo genera el cliente y nos lo manda.
 */
export const purchaseEventId = (orderId: string) => `purchase-${orderId}`;
export const addPaymentInfoEventId = (orderId: string) => `api-${orderId}`;

type PlanEntry = { plan: Plan; category: PlanCategory };

function findPlan(planId: string): PlanEntry | null {
  for (const category of ["web", "ads"] as const) {
    const plan = plans[category].find((p) => p.id === planId);
    if (plan) return { plan, category };
  }
  return null;
}

const categoryLabel = (category: PlanCategory | undefined) =>
  category === "ads" ? "Hosting Ads" : "Hosting Web";

/**
 * Saca las señales de Meta de una petición: las cookies que dejó el pixel más
 * la IP y el user agent reales. Sirve tanto con `req.headers` de un Route
 * Handler como con `await headers()` de un Server Action.
 */
export function trackingFromHeaders(headers: Headers, sourceUrl?: string): CheckoutTracking {
  const cookie = headers.get("cookie") ?? "";
  const read = (name: string): string | undefined => {
    const match = cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
    return match ? decodeURIComponent(match[1]) : undefined;
  };

  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();

  return {
    fbp: read("_fbp"),
    fbc: read("_fbc"),
    clientIp: forwarded || headers.get("x-nf-client-connection-ip") || undefined,
    userAgent: headers.get("user-agent") ?? undefined,
    sourceUrl,
  };
}

function browserSignals(tracking: CheckoutTracking | undefined): MetaBrowserSignals {
  return {
    fbp: tracking?.fbp,
    fbc: tracking?.fbc,
    clientIpAddress: tracking?.clientIp,
    clientUserAgent: tracking?.userAgent,
  };
}

/** Todo lo que sabemos del comprador. meta-capi.ts se encarga de hashearlo. */
function customerFromOrder(order: Order): MetaCustomerInfo {
  const { contact, invoice } = order.payload;
  return {
    email: contact.email || invoice.email,
    phone: contact.phone || invoice.phone,
    firstName: contact.firstName,
    lastName: contact.lastName,
    city: invoice.city,
    state: invoice.department,
    country: invoice.country,
    // El documento es el id más estable que tenemos del cliente: sobrevive a
    // que cambie de correo o de celular entre una compra y una renovación.
    externalId: invoice.docNumber,
  };
}

function contentsFromOrder(order: Order): Record<string, unknown> {
  const planId = order.payload.planId;
  const entry = findPlan(planId);
  return {
    currency: CURRENCY,
    value: order.amount,
    content_type: "product",
    content_ids: [planId],
    content_name: entry?.plan.name ?? planId,
    content_category: categoryLabel(entry?.category),
    contents: [{ id: planId, quantity: 1, item_price: order.amount }],
    num_items: 1,
    order_id: order.id,
    // Datos nuestros que se ven en Events Manager y sirven para depurar.
    billing: order.payload.billing,
    coupon: order.payload.couponCode,
  };
}

async function dispatch(label: string, event: MetaEvent): Promise<void> {
  if (!metaCapiConfigured()) return;

  try {
    const result = await sendMetaEvents([event]);
    if (result.ok) {
      console.log(`[meta] ${label} enviado`, { eventId: event.eventId });
    } else {
      console.error(`[meta] ${label} falló`, { eventId: event.eventId, error: result.error });
    }
  } catch (err) {
    // sendMetaEvents no debería lanzar, pero si lo hace no se lleva el pedido.
    console.error(`[meta] ${label} lanzó`, err);
  }
}

export type InitiateCheckoutInput = {
  /** Lo genera el navegador al montar el checkout, para deduplicar. */
  eventId: string;
  planId: string;
  billing: "monthly" | "annual";
  tracking: CheckoutTracking;
};

/**
 * InitiateCheckout ("Iniciar pago"): el cliente abrió el checkout. Todavía no
 * ha escrito nada, así que lo único que lo identifica son las cookies del
 * pixel, la IP y el user agent.
 *
 * Nace en el navegador a propósito: los `<Link>` a /checkout llevan prefetch,
 * y dispararlo desde el render del servidor contaría un evento por cada tarjeta
 * de plan que se asome en el home.
 */
export async function trackInitiateCheckout(input: InitiateCheckoutInput): Promise<void> {
  const entry = findPlan(input.planId);
  // El precio sale del catálogo, nunca de lo que mande el navegador.
  const value = entry
    ? input.billing === "annual"
      ? entry.plan.price.annual
      : entry.plan.price.monthly
    : undefined;

  await dispatch("InitiateCheckout", {
    eventName: "InitiateCheckout",
    eventId: input.eventId,
    eventSourceUrl: input.tracking.sourceUrl,
    actionSource: "website",
    browser: browserSignals(input.tracking),
    customData: {
      currency: CURRENCY,
      value,
      content_type: "product",
      content_ids: [input.planId],
      content_name: entry?.plan.name,
      content_category: categoryLabel(entry?.category),
      contents: value ? [{ id: input.planId, quantity: 1, item_price: value }] : undefined,
      num_items: 1,
      billing: input.billing,
    },
  });
}

/**
 * AddPaymentInfo ("Agregar información de pago"): pulsó "Continuar al pago" y
 * lo mandamos a la pasarela. Es el evento con mejor emparejamiento de todo el
 * embudo — aquí ya tenemos correo, celular, nombre, ciudad y documento.
 */
export async function trackAddPaymentInfo(order: Order): Promise<void> {
  await dispatch("AddPaymentInfo", {
    eventName: "AddPaymentInfo",
    eventId: addPaymentInfoEventId(order.id),
    eventSourceUrl: order.payload.tracking?.sourceUrl,
    actionSource: "website",
    customer: customerFromOrder(order),
    browser: browserSignals(order.payload.tracking),
    customData: contentsFromOrder(order),
  });
}

/**
 * Purchase ("Comprar"). Sale desde el webhook de la pasarela, cuando el pago
 * quedó aprobado, con el valor en pesos. Las cookies del pixel vienen del
 * payload porque en ese momento quien nos llama es la pasarela, no el navegador
 * del cliente.
 */
export async function trackPurchase(order: Order): Promise<void> {
  await dispatch("Purchase", {
    eventName: "Purchase",
    eventId: purchaseEventId(order.id),
    // Cuándo se aprobó el pago, no cuándo se creó el pedido.
    eventTime: Math.floor(order.updatedAt / 1000),
    eventSourceUrl: order.payload.tracking?.sourceUrl,
    actionSource: "website",
    customer: customerFromOrder(order),
    browser: browserSignals(order.payload.tracking),
    customData: contentsFromOrder(order),
  });
}

export type ContactEventInput = {
  /** Lo genera el navegador y lo manda junto con el lead, para deduplicar. */
  eventId: string;
  name: string;
  email: string;
  /** E.164. */
  phone: string;
  planId?: string;
  /** Valor del plan recomendado, si el asesor alcanzó a recomendar uno. */
  value?: number;
  source: string;
  tracking: CheckoutTracking;
};

/** Contact ("Contactar"): dejó su correo en el asesor. */
export async function trackContact(input: ContactEventInput): Promise<void> {
  const [firstName, ...rest] = input.name.trim().split(/\s+/);
  const entry = input.planId ? findPlan(input.planId) : null;

  await dispatch("Contact", {
    eventName: "Contact",
    eventId: input.eventId,
    eventSourceUrl: input.tracking.sourceUrl,
    actionSource: "website",
    customer: {
      email: input.email,
      phone: input.phone,
      firstName,
      lastName: rest.join(" ") || undefined,
      country: "co",
    },
    browser: browserSignals(input.tracking),
    customData: {
      currency: CURRENCY,
      // No es plata cobrada: es el precio del plan que el asesor recomendó, y
      // sirve para ver en Events Manager qué interés trae cada campaña.
      value: input.value,
      content_name: entry?.plan.name,
      content_ids: input.planId ? [input.planId] : undefined,
      content_category: categoryLabel(entry?.category),
      lead_source: input.source,
    },
  });
}
