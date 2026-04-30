import crypto from "node:crypto";
import type { CheckoutPayload } from "./checkout";
import { plans } from "./plans";

export const WOMPI_REDIRECT_URL = "https://checkout.wompi.co/p/";

export type WompiFormFields = {
  "public-key": string;
  currency: "COP";
  "amount-in-cents": string;
  reference: string;
  "signature:integrity": string;
  "redirect-url": string;
  "customer-data:email": string;
  "customer-data:full-name": string;
  "customer-data:phone-number": string;
  "customer-data:legal-id": string;
  "customer-data:legal-id-type": string;
};

export type WompiTransactionStatus = "APPROVED" | "DECLINED" | "VOIDED" | "ERROR" | "PENDING";

export type WompiEventPayload = {
  event: string;
  data: {
    transaction?: {
      id: string;
      reference: string;
      status: WompiTransactionStatus;
      amount_in_cents: number;
      currency: string;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  environment: "test" | "prod";
  signature: {
    properties: string[];
    checksum: string;
  };
  timestamp: number;
  sent_at: string;
};

function getEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

const docTypeMap: Record<string, string> = {
  CC: "CC",
  CE: "CE",
  NIT: "NIT",
  PASAPORTE: "PP",
};

export function buildWompiForm(
  orderId: string,
  payload: CheckoutPayload,
): { url: string; method: "GET"; fields: WompiFormFields } {
  const allPlans = [...plans.web, ...plans.ads];
  const plan = allPlans.find((p) => p.id === payload.planId);
  if (!plan) throw new Error("Plan not found");

  const amount = payload.billing === "annual" ? plan.price.annual : plan.price.monthly;
  const amountInCents = String(amount * 100);
  const currency = "COP";
  const reference = orderId;

  const integritySecret = getEnv("WOMPI_INTEGRITY_SECRET");
  const baseUrl = getEnv("NEXT_PUBLIC_BASE_URL").replace(/\/$/, "");

  const concat = `${reference}${amountInCents}${currency}${integritySecret}`;
  const signature = crypto.createHash("sha256").update(concat).digest("hex");

  const fields: WompiFormFields = {
    "public-key": getEnv("NEXT_PUBLIC_WOMPI_PUBLIC_KEY"),
    currency,
    "amount-in-cents": amountInCents,
    reference,
    "signature:integrity": signature,
    "redirect-url": `${baseUrl}/checkout/success?order=${encodeURIComponent(reference)}`,
    "customer-data:email": payload.contact.email,
    "customer-data:full-name": `${payload.contact.firstName} ${payload.contact.lastName}`.trim(),
    "customer-data:phone-number": payload.contact.phone.replace(/[^\d+]/g, ""),
    "customer-data:legal-id": payload.invoice.docNumber.replace(/\D/g, ""),
    "customer-data:legal-id-type": docTypeMap[payload.invoice.docType] ?? "CC",
  };

  return { url: WOMPI_REDIRECT_URL, method: "GET", fields };
}

function getNestedValue(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[key];
    return undefined;
  }, obj);
}

export function verifyWompiSignature(
  payload: WompiEventPayload,
  eventsSecret: string,
): boolean {
  const props = payload.signature?.properties ?? [];
  const concatProps = props
    .map((p) => String(getNestedValue(payload.data, p) ?? ""))
    .join("");
  const concat = `${concatProps}${payload.timestamp}${eventsSecret}`;
  const hash = crypto.createHash("sha256").update(concat).digest("hex");
  return hash === payload.signature.checksum;
}

export function mapWompiStatus(
  status: WompiTransactionStatus,
): "success" | "failed" | "pending" | "cancelled" {
  switch (status) {
    case "APPROVED":
      return "success";
    case "PENDING":
      return "pending";
    case "VOIDED":
      return "cancelled";
    case "DECLINED":
    case "ERROR":
    default:
      return "failed";
  }
}
