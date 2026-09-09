import { NextResponse } from "next/server";
import type { Order } from "@/lib/order-store";
import { metaCapiConfigured } from "@/lib/meta-capi";
import {
  trackAddPaymentInfo,
  trackContact,
  trackInitiateCheckout,
  trackPurchase,
  trackingFromHeaders,
} from "@/lib/meta-events";

/**
 * Prueba la API de conversiones sin tener que pagar nada: manda los cuatro
 * eventos del embudo (Iniciar pago, Agregar información de pago, Comprar y
 * Contactar) con datos falsos.
 *
 * 1. Pon META_TEST_EVENT_CODE con el TEST##### de Events Manager → Probar
 *    eventos. Así los eventos NO cuentan como conversiones reales.
 * 2. Abre http://localhost:3000/api/dev/meta-test
 * 3. Los cuatro deben aparecer en esa pestaña en segundos.
 *
 * El resultado sale en el log ("[meta] Purchase enviado" / "... falló"), que es
 * el mismo rastro que vas a ver en producción.
 */
export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Not found", { status: 404 });
  }

  if (!metaCapiConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Falta META_PIXEL_ID o META_CAPI_ACCESS_TOKEN en .env.local" },
      { status: 400 },
    );
  }

  const url = new URL(req.url);
  const email = url.searchParams.get("email") ?? "test@example.com";
  const plan = url.searchParams.get("plan") ?? "basic";
  const tracking = trackingFromHeaders(req.headers, url.origin);

  const fakeOrder: Order = {
    id: `DEV-${Date.now().toString(36).toUpperCase()}`,
    status: "success",
    amount: 192000,
    paymentRef: "TX-FAKE",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    payload: {
      planId: plan,
      billing: "annual",
      paymentProvider: "wompi",
      contact: {
        firstName: "Cliente",
        lastName: "Prueba",
        email,
        phone: "+573001234567",
      },
      invoice: {
        personType: "natural",
        docType: "CC",
        docNumber: "1023456789",
        legalName: "Cliente Prueba",
        email,
        phone: "+573001234567",
        address: "N/A",
        city: "Bogotá",
        department: "Bogotá D.C.",
        country: "Colombia",
      },
      hosting: { domain: "ejemplo.com", domainOwnership: "owned" },
      tracking,
    },
  };

  // Los cuatro eventos del embudo, en orden.
  await trackInitiateCheckout({
    eventId: `dev-ic-${fakeOrder.id}`,
    planId: plan,
    billing: "annual",
    tracking,
  });
  await trackAddPaymentInfo(fakeOrder);
  await trackPurchase(fakeOrder);
  await trackContact({
    eventId: `dev-contact-${fakeOrder.id}`,
    name: "Cliente Prueba",
    email,
    phone: "+573001234567",
    planId: plan,
    value: 192000,
    source: "dev",
    tracking,
  });

  return NextResponse.json({
    ok: true,
    orderId: fakeOrder.id,
    testEventCode: process.env.META_TEST_EVENT_CODE ?? null,
    hint: process.env.META_TEST_EVENT_CODE
      ? "Revisa Events Manager → Probar eventos."
      : "Sin META_TEST_EVENT_CODE estos eventos cuentan como conversiones reales.",
    // El detalle del envío (ok / error de Meta) queda en el log del servidor.
    tracking,
  });
}
