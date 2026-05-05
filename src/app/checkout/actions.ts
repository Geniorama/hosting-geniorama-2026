"use server";

import { isValidDomain, type CheckoutPayload, type CheckoutResult } from "@/lib/checkout";
import { plans } from "@/lib/plans";
import { buildPaymentForm, type PaymentsWayFormFields } from "@/lib/paymentsway";
import { buildWompiForm, type WompiFormFields } from "@/lib/wompi";
import { orderStore } from "@/lib/order-store";
import { applyCoupon, redeemCoupon, type AppliedCoupon } from "@/lib/coupons";

export type ValidateCouponResult =
  | { ok: true; coupon: AppliedCoupon }
  | { ok: false; error: string };

export async function validateCouponAction(
  code: string,
  planId: string,
  billing: "monthly" | "annual",
): Promise<ValidateCouponResult> {
  const allPlans = [...plans.web, ...plans.ads];
  const plan = allPlans.find((p) => p.id === planId);
  if (!plan) return { ok: false, error: "Plan no encontrado" };
  return await applyCoupon(code, plan, billing);
}

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
  if (payload.invoice.personType === "natural") {
    if (!payload.invoice.legalFirstName?.trim())
      fieldErrors["invoice.legalFirstName"] = "Requerido";
    if (!payload.invoice.legalLastName?.trim())
      fieldErrors["invoice.legalLastName"] = "Requerido";
  } else if (!payload.invoice.legalName.trim()) {
    fieldErrors["invoice.legalName"] = "Requerido";
  }
  if (!/^\S+@\S+\.\S+$/.test(payload.invoice.email))
    fieldErrors["invoice.billingEmail"] = "Email inválido";
  if (!/^\+?\d{7,15}$/.test(payload.invoice.phone.replace(/[\s-]/g, "")))
    fieldErrors["invoice.billingPhone"] = "Teléfono inválido";
  if (!payload.invoice.address.trim()) fieldErrors["invoice.address"] = "Requerido";
  if (!payload.invoice.city.trim()) fieldErrors["invoice.city"] = "Requerido";
  if (!payload.invoice.department.trim()) fieldErrors["invoice.department"] = "Requerido";

  const ownership = payload.hosting.domainOwnership;
  if (ownership !== "owned" && ownership !== "not-yet") {
    fieldErrors["hosting.domainOwnership"] = "Selecciona una opción";
  }
  const domainStr = payload.hosting.domain.trim();
  if (ownership === "owned") {
    if (!isValidDomain(domainStr)) fieldErrors["hosting.domain"] = "Dominio inválido";
  } else if (domainStr && !isValidDomain(domainStr)) {
    fieldErrors["hosting.domain"] = "Dominio inválido";
  }

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
  const subtotal = payload.billing === "annual" ? plan.price.annual : plan.price.monthly;
  let amount = subtotal;
  let appliedCoupon: AppliedCoupon | null = null;
  if (payload.couponCode) {
    try {
      appliedCoupon = await redeemCoupon(payload.couponCode, plan, payload.billing);
    } catch (err) {
      console.error("[checkout] coupon redemption failed", err);
      return { ok: false, error: "No pudimos validar el cupón. Intenta de nuevo." };
    }
    if (!appliedCoupon) {
      return {
        ok: false,
        error: "El cupón ya no está disponible. Quítalo o intenta con otro.",
      };
    }
    amount = subtotal - appliedCoupon.discount;
  }

  try {
    await orderStore.create({
      id: orderId,
      status: "created",
      amount,
      subtotal,
      couponCode: appliedCoupon?.code,
      couponDiscount: appliedCoupon?.discount ?? 0,
      domainOwnership: payload.hosting.domainOwnership,
      legalFirstName: payload.invoice.legalFirstName,
      legalLastName: payload.invoice.legalLastName,
      payload,
    });
  } catch (err) {
    console.error("[checkout] failed to persist order", err);
    return { ok: false, error: "No pudimos crear el pedido. Intenta de nuevo." };
  }

  try {
    let payment: PaymentBundle;
    if (payload.paymentProvider === "wompi") {
      const built = buildWompiForm(orderId, payload, amount);
      payment = { provider: "wompi", ...built };
    } else {
      const built = buildPaymentForm(orderId, payload, amount);
      payment = { provider: "paymentsway", method: "POST", ...built };
    }
    return { ok: true, orderId, payment };
  } catch (err) {
    console.error("[checkout] failed to build payment form", err);
    return { ok: false, error: "No pudimos iniciar el pago. Intenta de nuevo." };
  }
}
