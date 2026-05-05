import type { CheckoutPayload } from "./checkout";
import { getSupabaseAdmin } from "./supabase";

export type OrderStatus = "created" | "success" | "pending" | "failed" | "cancelled" | "refunded";

export type ProvisioningInfo = {
  username: string;
  domain: string;
  package: string;
  ip?: string;
  provisionedAt: number;
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
};
