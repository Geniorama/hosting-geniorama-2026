"use server";

import { isValidDomain, type CheckoutPayload, type CheckoutResult } from "@/lib/checkout";
import { plans } from "@/lib/plans";
import { buildPaymentForm, type PaymentsWayFormFields } from "@/lib/paymentsway";
import { buildWompiForm, type WompiFormFields } from "@/lib/wompi";
import { orderStore } from "@/lib/order-store";

export type PaymentBundle =
  | { provider: "paymentsway"; url: string; method: "POST"; fields: PaymentsWayFormFields }
  | { provider: "wompi"; url: string; method: "GET"; fields: WompiFormFields };

export type CheckoutSuccess = {
  ok: true;
  orderId: string;
  payment: PaymentBundle;
};

export type CheckoutActionResult = CheckoutSuccess | (CheckoutResult & { ok: false });

export async function submitCheckout(payload: CheckoutPayload): Promise<CheckoutActionResult> {
  const fieldErrors: Record<string, string> = {};

  if (!payload.contact.firstName.trim()) fieldErrors["contact.firstName"] = "Requerido";
  if (!payload.contact.lastName.trim()) fieldErrors["contact.lastName"] = "Requerido";
  if (!/^\S+@\S+\.\S+$/.test(payload.contact.email)) fieldErrors["contact.email"] = "Email inválido";
  if (!/^\+?\d{7,15}$/.test(payload.contact.phone.replace(/[\s-]/g, "")))
    fieldErrors["contact.phone"] = "Teléfono inválido";

  if (!payload.invoice.docNumber.trim()) fieldErrors["invoice.docNumber"] = "Requerido";
  if (payload.invoice.docType === "NIT" && !payload.invoice.dv?.trim())
    fieldErrors["invoice.dv"] = "Requerido";
  if (!payload.invoice.legalName.trim()) fieldErrors["invoice.legalName"] = "Requerido";
  if (!/^\S+@\S+\.\S+$/.test(payload.invoice.email))
    fieldErrors["invoice.billingEmail"] = "Email inválido";
  if (!/^\+?\d{7,15}$/.test(payload.invoice.phone.replace(/[\s-]/g, "")))
    fieldErrors["invoice.billingPhone"] = "Teléfono inválido";
  if (!payload.invoice.address.trim()) fieldErrors["invoice.address"] = "Requerido";
  if (!payload.invoice.city.trim()) fieldErrors["invoice.city"] = "Requerido";
  if (!payload.invoice.department.trim()) fieldErrors["invoice.department"] = "Requerido";

  if (!isValidDomain(payload.hosting.domain))
    fieldErrors["hosting.domain"] = "Dominio inválido";

  if (payload.paymentProvider !== "paymentsway" && payload.paymentProvider !== "wompi") {
    return { ok: false, error: "Método de pago inválido" };
  }

  const allPlans = [...plans.web, ...plans.ads];
  const plan = allPlans.find((p) => p.id === payload.planId);
  if (!plan) {
    return { ok: false, error: "Plan inválido" };
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, error: "Revisa los campos marcados", fieldErrors };
  }

  const orderId = `GR-${Date.now().toString(36).toUpperCase()}`;
  const amount = payload.billing === "annual" ? plan.price.annual : plan.price.monthly;

  try {
    await orderStore.create({
      id: orderId,
      status: "created",
      amount,
      payload,
    });
  } catch (err) {
    console.error("[checkout] failed to persist order", err);
    return { ok: false, error: "No pudimos crear el pedido. Intenta de nuevo." };
  }

  try {
    let payment: PaymentBundle;
    if (payload.paymentProvider === "wompi") {
      const built = buildWompiForm(orderId, payload);
      payment = { provider: "wompi", ...built };
    } else {
      const built = buildPaymentForm(orderId, payload);
      payment = { provider: "paymentsway", method: "POST", ...built };
    }
    return { ok: true, orderId, payment };
  } catch (err) {
    console.error("[checkout] failed to build payment form", err);
    return { ok: false, error: "No pudimos iniciar el pago. Intenta de nuevo." };
  }
}
