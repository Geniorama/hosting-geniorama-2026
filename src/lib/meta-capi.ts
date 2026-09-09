import { createHash } from "node:crypto";

/**
 * Transporte de la API de Conversiones de Meta (server-side).
 *
 * Solo arma y manda el request: normaliza y hashea los datos personales como
 * pide Meta, y devuelve el resultado sin lanzar nunca. Los eventos del negocio
 * (Purchase, Lead, InitiateCheckout) se arman en meta-events.ts.
 *
 * Doc: https://developers.facebook.com/docs/marketing-api/conversions-api/
 */

/** Vence en 2028; súbela con META_GRAPH_API_VERSION cuando Meta saque otra. */
const DEFAULT_GRAPH_VERSION = "v26.0";

const TIMEOUT_MS = 8_000;

/**
 * Datos personales en claro. Este módulo los normaliza y los hashea con SHA-256
 * antes de mandarlos: nunca salen del servidor sin hashear.
 */
export type MetaCustomerInfo = {
  email?: string;
  /** Con o sin indicativo; si no lo trae se asume Colombia. */
  phone?: string;
  firstName?: string;
  lastName?: string;
  city?: string;
  state?: string;
  zip?: string;
  /** Nombre o código ISO-3166 alpha-2 ("Colombia" o "CO"). */
  country?: string;
  /** Id estable del cliente en nuestro lado. También se hashea. */
  externalId?: string;
};

/**
 * Señales del navegador. Estas van SIN hashear: son las que más suben la
 * calidad de emparejamiento, sobre todo _fbc cuando el clic vino de un anuncio.
 */
export type MetaBrowserSignals = {
  fbp?: string;
  fbc?: string;
  clientIpAddress?: string;
  clientUserAgent?: string;
};

export type MetaEvent = {
  /** "Purchase", "Lead", "InitiateCheckout", ... */
  eventName: string;
  /**
   * Clave de deduplicación. Si el pixel del navegador manda el mismo evento con
   * este mismo `eventID`, Meta cuenta uno solo. Debe ser estable y derivarse de
   * algo nuestro (el id del pedido, por ejemplo), no aleatorio por request.
   */
  eventId: string;
  /** Unix en SEGUNDOS. Default: ahora. Meta rechaza más de 7 días atrás. */
  eventTime?: number;
  eventSourceUrl?: string;
  actionSource?: "website" | "app" | "email" | "phone_call" | "chat" | "system_generated" | "other";
  customer?: MetaCustomerInfo;
  browser?: MetaBrowserSignals;
  /** currency, value, content_ids, order_id, ... tal cual los espera Meta. */
  customData?: Record<string, unknown>;
};

/** Lo que responde el endpoint /events, tanto en éxito como en error. */
type MetaApiResponse = {
  events_received?: number;
  fbtrace_id?: string;
  error?: { message?: string; error_user_msg?: string };
};

export type MetaCapiResult =
  | { ok: true; eventsReceived: number; fbTraceId?: string }
  | { ok: false; error: string };

/** Nombres de país que puede escribir el cliente en el checkout → ISO-2. */
const COUNTRY_ALIASES: Record<string, string> = {
  colombia: "co",
  mexico: "mx",
  espana: "es",
  spain: "es",
  peru: "pe",
  chile: "cl",
  argentina: "ar",
  ecuador: "ec",
  venezuela: "ve",
  panama: "pa",
  costarica: "cr",
  guatemala: "gt",
  bolivia: "bo",
  uruguay: "uy",
  paraguay: "py",
  estadosunidos: "us",
  unitedstates: "us",
};

const sha256 = (value: string): string =>
  createHash("sha256").update(value, "utf8").digest("hex");

/** Sin espacios ni puntuación: el formato que Meta espera para ciudad y país. */
function squash(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** Minúsculas, sin puntuación y con un solo espacio entre palabras. */
function normalizeName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Solo dígitos y con indicativo, que es como lo quiere Meta. Los teléfonos del
 * checkout pueden venir sin "+57": si el número tiene largo local colombiano se
 * lo agregamos, porque sin indicativo Meta no empareja nada.
 */
function normalizePhone(raw: string): string {
  const trimmed = raw.trim();
  let digits = trimmed.replace(/\D/g, "").replace(/^0+/, "");
  if (!digits) return "";
  if (!trimmed.startsWith("+") && digits.length <= 10) digits = `57${digits}`;
  return digits;
}

function normalizeCountry(raw: string): string {
  const squashed = squash(raw);
  if (!squashed) return "";
  if (squashed.length === 2) return squashed;
  return COUNTRY_ALIASES[squashed] ?? "";
}

/** Hashea si hay algo que hashear; si no, deja el campo fuera del payload. */
function hashed(value: string | undefined): string | undefined {
  return value ? sha256(value) : undefined;
}

function buildUserData(
  customer: MetaCustomerInfo | undefined,
  browser: MetaBrowserSignals | undefined,
): Record<string, string> {
  const out: Record<string, string | undefined> = {
    em: hashed(customer?.email?.trim().toLowerCase()),
    ph: hashed(customer?.phone ? normalizePhone(customer.phone) : undefined),
    fn: hashed(customer?.firstName ? normalizeName(customer.firstName) : undefined),
    ln: hashed(customer?.lastName ? normalizeName(customer.lastName) : undefined),
    ct: hashed(customer?.city ? squash(customer.city) : undefined),
    st: hashed(customer?.state ? squash(customer.state) : undefined),
    zp: hashed(customer?.zip ? squash(customer.zip).slice(0, 5) : undefined),
    country: hashed(customer?.country ? normalizeCountry(customer.country) : undefined),
    external_id: hashed(customer?.externalId ? squash(customer.externalId) : undefined),
    // Sin hashear a propósito — Meta las quiere en claro.
    fbp: browser?.fbp,
    fbc: browser?.fbc,
    client_ip_address: browser?.clientIpAddress,
    client_user_agent: browser?.clientUserAgent,
  };

  return Object.fromEntries(
    Object.entries(out).filter((entry): entry is [string, string] => Boolean(entry[1])),
  );
}

function pruned(data: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!data) return undefined;
  const entries = Object.entries(data).filter(([, v]) => v !== undefined && v !== null && v !== "");
  return entries.length ? Object.fromEntries(entries) : undefined;
}

/** True si hay pixel y token: sirve para saltarse el envío sin ensuciar el log. */
export function metaCapiConfigured(): boolean {
  return Boolean(process.env.META_PIXEL_ID && process.env.META_CAPI_ACCESS_TOKEN);
}

/**
 * Manda los eventos a Meta. Nunca lanza: el llamador decide si el fallo importa
 * (para nosotros nunca debe tumbar un pedido ni un lead).
 */
export async function sendMetaEvents(events: MetaEvent[]): Promise<MetaCapiResult> {
  const pixelId = process.env.META_PIXEL_ID;
  const token = process.env.META_CAPI_ACCESS_TOKEN;

  if (!pixelId || !token) {
    return { ok: false, error: "META_PIXEL_ID o META_CAPI_ACCESS_TOKEN sin configurar" };
  }
  if (!events.length) return { ok: true, eventsReceived: 0 };

  const version = process.env.META_GRAPH_API_VERSION || DEFAULT_GRAPH_VERSION;
  const now = Math.floor(Date.now() / 1000);

  const body: Record<string, unknown> = {
    data: events.map((event) => ({
      event_name: event.eventName,
      event_id: event.eventId,
      event_time: event.eventTime ?? now,
      event_source_url: event.eventSourceUrl,
      action_source: event.actionSource ?? "website",
      user_data: buildUserData(event.customer, event.browser),
      custom_data: pruned(event.customData),
    })),
  };

  // Con el código de prueba los eventos NO cuentan como conversiones: aparecen
  // en Events Manager → Probar eventos. Déjalo vacío en producción.
  const testCode = process.env.META_TEST_EVENT_CODE;
  if (testCode) body.test_event_code = testCode;

  const url = `https://graph.facebook.com/${version}/${pixelId}/events`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    return { ok: false, error: `Meta inalcanzable: ${(err as Error).message}` };
  }

  const text = await res.text();
  let json: MetaApiResponse | null = null;
  try {
    json = JSON.parse(text) as MetaApiResponse;
  } catch {
    // Respuesta no-JSON: nos quedamos con el texto crudo para el log.
  }

  if (!res.ok || json?.error) {
    const detail =
      json?.error?.error_user_msg ?? json?.error?.message ?? text.slice(0, 200);
    return { ok: false, error: `HTTP ${res.status}: ${detail}` };
  }

  return {
    ok: true,
    eventsReceived: json?.events_received ?? events.length,
    fbTraceId: json?.fbtrace_id,
  };
}
