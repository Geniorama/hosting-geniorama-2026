import type { Order } from "./order-store";
import type { WhmCreateAcctResult } from "./whm";
import { plans } from "./plans";

export type TicketsSyncResult =
  | {
      ok: true;
      userId: string;
      companyId: string;
      serviceId: string;
      planId: string;
      userInvitationSent: boolean;
      expiresAt: string;
    }
  | { ok: false; error: string };

function tryEnv(name: string): string | undefined {
  return process.env[name];
}

function planName(planId: string): string {
  const all = [...plans.web, ...plans.ads];
  return all.find((p) => p.id === planId)?.name ?? planId;
}

function fullName(order: Order): string {
  return (
    order.payload.invoice.legalName ||
    `${order.payload.contact.firstName} ${order.payload.contact.lastName}`.trim() ||
    "Cliente Geniorama"
  );
}

function companyName(order: Order): string {
  return order.payload.invoice.personType === "juridica"
    ? order.payload.invoice.legalName
    : fullName(order);
}

function taxId(order: Order): string | undefined {
  const doc = order.payload.invoice.docNumber?.replace(/\D/g, "");
  if (!doc) return undefined;
  const dv = order.payload.invoice.dv?.replace(/\D/g, "");
  return dv ? `${doc}-${dv}` : doc;
}

export async function syncOrderToTickets(
  order: Order,
  acct: Extract<WhmCreateAcctResult, { ok: true }> | null,
): Promise<TicketsSyncResult> {
  const apiUrl = tryEnv("TICKETS_API_URL");
  const token = tryEnv("TICKETS_INTEGRATION_TOKEN");

  if (!apiUrl || !token) {
    return { ok: false, error: "TICKETS_API_URL or TICKETS_INTEGRATION_TOKEN not configured" };
  }

  const url = `${apiUrl.replace(/\/$/, "")}/api/integrations/hosting-provisioned`;

  const body = {
    orderId: order.id,
    customer: {
      name: fullName(order),
      email: order.payload.invoice.email || order.payload.contact.email,
      phone: order.payload.invoice.phone || order.payload.contact.phone,
    },
    company: {
      name: companyName(order),
      taxId: taxId(order),
    },
    hosting: {
      domain: order.payload.hosting.domain,
      planId: order.payload.planId,
      planName: planName(order.payload.planId),
      billing: order.payload.billing,
      amount: order.amount,
      cpanelUsername: acct?.username,
      cpanelIp: acct?.ip,
    },
    startedAt: new Date(order.updatedAt).toISOString(),
  };

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch (err) {
    return { ok: false, error: `Tickets app unreachable: ${(err as Error).message}` };
  }

  const text = await res.text();
  let json:
    | { ok: boolean; userId?: string; companyId?: string; serviceId?: string; planId?: string; userInvitationSent?: boolean; expiresAt?: string; error?: string }
    | null = null;
  try {
    json = JSON.parse(text);
  } catch {
    // not JSON
  }

  if (!res.ok || !json?.ok) {
    if (!json) {
      return {
        ok: false,
        error: `Tickets responded HTTP ${res.status} with non-JSON body. Likely middleware redirect. Snippet: ${text.slice(0, 120)}`,
      };
    }
    return { ok: false, error: json.error ?? `HTTP ${res.status}` };
  }

  return {
    ok: true,
    userId: json.userId!,
    companyId: json.companyId!,
    serviceId: json.serviceId!,
    planId: json.planId!,
    userInvitationSent: !!json.userInvitationSent,
    expiresAt: json.expiresAt!,
  };
}
