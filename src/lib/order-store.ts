import type { CheckoutPayload } from "./checkout";
import type { PanelType } from "./hosting-account";
import { getSupabaseAdmin } from "./supabase";

export type OrderStatus = "created" | "success" | "pending" | "failed" | "cancelled" | "refunded";

export type ProvisioningInfo = {
  username: string;
  domain: string;
  package: string;
  ip?: string;
  provisionedAt: number;
  /**
   * Control panel the account lives on. Optional because records written before
   * the Plesk reseller existed have no value — treat a missing panel as cPanel.
   */
  panel?: PanelType;
  /** Which reseller created it: "whm", "plesk", or "manual". */
  provider?: string;
};

export type TicketsSyncInfo = {
  userId: string;
  companyId: string;
  serviceId: string;
  planId: string;
  expiresAt: string;
  syncedAt: number;
};

export type InvoiceTaskInfo = {
  provider: "trello";
  cardId: string;
  url: string;
  createdAt: number;
};

export type Order = {
  id: string;
  status: OrderStatus;
  amount: number;
  subtotal?: number;
  couponCode?: string;
  couponDiscount?: number;
  domainOwnership?: "owned" | "not-yet";
  legalFirstName?: string;
  legalLastName?: string;
  payload: CheckoutPayload;
  createdAt: number;
  updatedAt: number;
  paymentRef?: string;
  provisioning?: ProvisioningInfo;
  ticketsSync?: TicketsSyncInfo;
  invoiceTask?: InvoiceTaskInfo;
  /** Paid period. Set when the payment webhook marks the order successful. */
  periodStart?: number;
  periodEnd?: number;
  /** Id of the order this one renews; absent on a first signup. */
  renewalOf?: string;
  /** Renewal notices already sent, keyed (`d30`, `expired`, `suspend`). */
  renewalNotices?: Record<string, string>;
  /** When the grace period ran out and suspension was requested. */
  suspendedAt?: number;
};

type OrderRow = {
  id: string;
  status: OrderStatus;
  amount: number;
  subtotal: number | null;
  coupon_code: string | null;
  coupon_discount: number;
  domain_ownership: "owned" | "not-yet" | null;
  legal_first_name: string | null;
  legal_last_name: string | null;
  payload: CheckoutPayload;
  payment_ref: string | null;
  provisioning: ProvisioningInfo | null;
  tickets_sync: TicketsSyncInfo | null;
  invoice_task: InvoiceTaskInfo | null;
  period_start: string | null;
  period_end: string | null;
  renewal_of: string | null;
  renewal_notices: Record<string, string> | null;
  suspended_at: string | null;
  created_at: string;
  updated_at: string;
};

const fromRow = (row: OrderRow): Order => ({
  id: row.id,
  status: row.status,
  amount: row.amount,
  subtotal: row.subtotal ?? undefined,
  couponCode: row.coupon_code ?? undefined,
  couponDiscount: row.coupon_discount ?? 0,
  domainOwnership: row.domain_ownership ?? undefined,
  legalFirstName: row.legal_first_name ?? undefined,
  legalLastName: row.legal_last_name ?? undefined,
  payload: row.payload,
  paymentRef: row.payment_ref ?? undefined,
  provisioning: row.provisioning ?? undefined,
  ticketsSync: row.tickets_sync ?? undefined,
  invoiceTask: row.invoice_task ?? undefined,
  periodStart: row.period_start ? new Date(row.period_start).getTime() : undefined,
  periodEnd: row.period_end ? new Date(row.period_end).getTime() : undefined,
  renewalOf: row.renewal_of ?? undefined,
  renewalNotices: row.renewal_notices ?? undefined,
  suspendedAt: row.suspended_at ? new Date(row.suspended_at).getTime() : undefined,
  createdAt: new Date(row.created_at).getTime(),
  updatedAt: new Date(row.updated_at).getTime(),
});

export const orderStore = {
  async create(order: Omit<Order, "createdAt" | "updatedAt">): Promise<Order> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("orders")
      .insert({
        id: order.id,
        status: order.status,
        amount: order.amount,
        subtotal: order.subtotal ?? null,
        coupon_code: order.couponCode ?? null,
        coupon_discount: order.couponDiscount ?? 0,
        domain_ownership: order.domainOwnership ?? null,
        legal_first_name: order.legalFirstName ?? null,
        legal_last_name: order.legalLastName ?? null,
        payload: order.payload,
        payment_ref: order.paymentRef ?? null,
      })
      .select("*")
      .single<OrderRow>();

    if (error) throw new Error(`orders.create failed: ${error.message}`);
    return fromRow(data);
  },

  async get(id: string): Promise<Order | null> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("id", id)
      .maybeSingle<OrderRow>();

    if (error) throw new Error(`orders.get failed: ${error.message}`);
    return data ? fromRow(data) : null;
  },

  async updateStatus(
    id: string,
    status: OrderStatus,
    paymentRef?: string,
  ): Promise<Order | null> {
    const supabase = getSupabaseAdmin();
    const patch: Partial<OrderRow> = { status };
    if (paymentRef) patch.payment_ref = paymentRef;

    const { data, error } = await supabase
      .from("orders")
      .update(patch)
      .eq("id", id)
      .select("*")
      .maybeSingle<OrderRow>();

    if (error) throw new Error(`orders.updateStatus failed: ${error.message}`);
    return data ? fromRow(data) : null;
  },

  async setProvisioning(id: string, info: ProvisioningInfo): Promise<void> {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("orders")
      .update({ provisioning: info })
      .eq("id", id);
    if (error) throw new Error(`orders.setProvisioning failed: ${error.message}`);
  },

  async setTicketsSync(id: string, info: TicketsSyncInfo): Promise<void> {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("orders")
      .update({ tickets_sync: info })
      .eq("id", id);
    if (error) throw new Error(`orders.setTicketsSync failed: ${error.message}`);
  },

  async setInvoiceTask(id: string, info: InvoiceTaskInfo): Promise<void> {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("orders")
      .update({ invoice_task: info })
      .eq("id", id);
    if (error) throw new Error(`orders.setInvoiceTask failed: ${error.message}`);
  },

  async setBillingPeriod(id: string, startMs: number, endMs: number): Promise<void> {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("orders")
      .update({
        period_start: new Date(startMs).toISOString(),
        period_end: new Date(endMs).toISOString(),
      })
      .eq("id", id);
    if (error) throw new Error(`orders.setBillingPeriod failed: ${error.message}`);
  },

  async setRenewalOf(id: string, previousOrderId: string): Promise<void> {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("orders")
      .update({ renewal_of: previousOrderId })
      .eq("id", id);
    if (error) throw new Error(`orders.setRenewalOf failed: ${error.message}`);
  },

  /**
   * Records that a renewal notice went out. Read-modify-write on the jsonb: the
   * cron is the only writer and runs sequentially, so a merge is enough and
   * avoids needing a Postgres function for jsonb_set.
   */
  async markRenewalNotice(id: string, key: string): Promise<void> {
    const supabase = getSupabaseAdmin();
    const { data, error: readError } = await supabase
      .from("orders")
      .select("renewal_notices")
      .eq("id", id)
      .maybeSingle<{ renewal_notices: Record<string, string> | null }>();
    if (readError) throw new Error(`orders.markRenewalNotice read failed: ${readError.message}`);

    const notices = { ...(data?.renewal_notices ?? {}), [key]: new Date().toISOString() };
    const { error } = await supabase
      .from("orders")
      .update({ renewal_notices: notices })
      .eq("id", id);
    if (error) throw new Error(`orders.markRenewalNotice failed: ${error.message}`);
  },

  async setSuspendedAt(id: string, whenMs: number): Promise<void> {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("orders")
      .update({ suspended_at: new Date(whenMs).toISOString() })
      .eq("id", id);
    if (error) throw new Error(`orders.setSuspendedAt failed: ${error.message}`);
  },

  /**
   * Paid orders whose period ends before `beforeMs` — the renewal cron's work
   * list. Renewed orders are excluded by the caller (a period superseded by a
   * newer order for the same domain no longer needs chasing).
   */
  async listExpiringBefore(beforeMs: number): Promise<Order[]> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("status", "success")
      .not("period_end", "is", null)
      // Once suspension was requested the order leaves the work list for good,
      // which also stops the sweep from re-scanning years of old orders.
      .is("suspended_at", null)
      .lte("period_end", new Date(beforeMs).toISOString())
      .order("period_end", { ascending: true })
      .returns<OrderRow[]>();

    if (error) throw new Error(`orders.listExpiringBefore failed: ${error.message}`);
    return (data ?? []).map(fromRow);
  },

  /** The paid order that renews `orderId`, if the customer already renewed. */
  async findRenewalOf(orderId: string): Promise<Order | null> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("status", "success")
      .eq("renewal_of", orderId)
      .order("created_at", { ascending: false })
      .limit(1)
      .returns<OrderRow[]>();

    if (error) throw new Error(`orders.findRenewalOf failed: ${error.message}`);
    return data?.[0] ? fromRow(data[0]) : null;
  },

  /**
   * The live paid order for a domain, most recent first. Used to tell a renewal
   * apart from a new signup: if the domain already has a provisioned order, the
   * new payment extends that service instead of creating another account.
   */
  async findLatestProvisionedByDomain(
    domain: string,
    excludeOrderId?: string,
  ): Promise<Order | null> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("status", "success")
      .eq("payload->hosting->>domain", domain)
      .not("provisioning", "is", null)
      .order("created_at", { ascending: false })
      .limit(5)
      .returns<OrderRow[]>();

    if (error) throw new Error(`orders.findLatestProvisionedByDomain failed: ${error.message}`);
    const match = (data ?? []).map(fromRow).find((o) => o.id !== excludeOrderId);
    return match ?? null;
  },
};
