"use server";

import type { CheckoutPayload, CheckoutResult } from "@/lib/checkout";
import { plans } from "@/lib/plans";
import { buildPaymentForm, type PaymentsWayFormFields } from "@/lib/paymentsway";
import { orderStore } from "@/lib/order-store";

export type CheckoutSuccess = {
  ok: true;
  orderId: string;
  payment: { url: string; fields: PaymentsWayFormFields };
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
  if (!payload.invoice.address.trim()) fieldErrors["invoice.address"] = "Requerido";
  if (!payload.invoice.city.trim()) fieldErrors["invoice.city"] = "Requerido";
  if (!payload.invoice.department.trim()) fieldErrors["invoice.department"] = "Requerido";

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

  orderStore.create({
    id: orderId,
    status: "created",
    amount,
    payload,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  try {
    const payment = buildPaymentForm(orderId, payload);
    return { ok: true, orderId, payment };
  } catch (err) {
    console.error("[checkout] failed to build payment form", err);
    return { ok: false, error: "No pudimos iniciar el pago. Intenta de nuevo." };
  }
}
