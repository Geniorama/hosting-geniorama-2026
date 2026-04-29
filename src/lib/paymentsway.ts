import crypto from "node:crypto";
import type { CheckoutPayload } from "./checkout";
import { plans } from "./plans";

export const PAYMENTSWAY_REDIRECT_URL =
  "https://merchant.paymentsway.co/cartaspago/redirect";

export type PaymentsWayFormFields = {
  merchant_id: string;
  form_id: string;
  terminal_id: string;
  order_number: string;
  amount: string;
  currency: "COP";
  order_description: string;
  client_email: string;
  client_phone: string;
  client_firstname: string;
  client_lastname: string;
  client_doctype: string;
  client_numdoc: string;
  response_url: string;
};

export type PaymentsWayWebhookPayload = {
  id: string | number;
  ammount: number;
  externalorder: string;
  ip?: string;
  idstatus: { id: number; nombre: string };
  idperson?: {
    id?: string;
    firstname?: string;
    lastname?: string;
    identification?: string;
    email?: string;
    phone?: string;
  };
  paymentmethod?: { id: number; nombre: string };
  idmerchant?: string;
  checksum?: string;
};

export const PaymentsWayStatus = {
  CREATED: 1,
  SUCCESS: 34,
  PENDING: 35,
  FAILED: 36,
  CANCELLED: 38,
  REFUNDED: 39,
  PENDING_CASH: 40,
} as const;

function getEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

const docTypeMap: Record<string, string> = {
  CC: "CC",
  CE: "CE",
  NIT: "NIT",
  PASAPORTE: "PA",
};

export function buildPaymentForm(
  orderId: string,
  payload: CheckoutPayload,
): { url: string; fields: PaymentsWayFormFields } {
  const allPlans = [...plans.web, ...plans.ads];
  const plan = allPlans.find((p) => p.id === payload.planId);
  if (!plan) throw new Error("Plan not found");

  const amount = payload.billing === "annual" ? plan.price.annual : plan.price.monthly;
  const description = `Hosting Geniorama — ${plan.name} (${
    payload.billing === "annual" ? "anual" : "mensual"
  })`;

  const baseUrl = getEnv("NEXT_PUBLIC_BASE_URL").replace(/\/$/, "");

  const fields: PaymentsWayFormFields = {
    merchant_id: getEnv("PAYMENTSWAY_MERCHANT_ID"),
    form_id: getEnv("PAYMENTSWAY_FORM_ID"),
    terminal_id: getEnv("PAYMENTSWAY_TERMINAL_ID"),
    order_number: orderId,
    amount: String(amount),
    currency: "COP",
    order_description: description,
    client_email: payload.contact.email,
    client_phone: payload.contact.phone,
    client_firstname: payload.contact.firstName,
    client_lastname: payload.contact.lastName,
    client_doctype: docTypeMap[payload.invoice.docType] ?? "CC",
    client_numdoc: payload.invoice.docNumber.replace(/\D/g, ""),
    response_url: `${baseUrl}/checkout/success?order=${encodeURIComponent(orderId)}`,
  };

  return { url: PAYMENTSWAY_REDIRECT_URL, fields };
}

export function verifyWebhookChecksum(
  payload: PaymentsWayWebhookPayload,
  apiKey: string,
): boolean {
  if (!payload.checksum) return true;
  const formId = getEnv("PAYMENTSWAY_FORM_ID");
  const merchantId = getEnv("PAYMENTSWAY_MERCHANT_ID");
  const raw = `${formId};${apiKey};${merchantId};${payload.ammount};${payload.externalorder}`;
  const expected = crypto.createHash("sha256").update(raw).digest("hex");
  return expected === payload.checksum;
}
