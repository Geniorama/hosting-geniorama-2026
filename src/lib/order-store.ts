import type { CheckoutPayload } from "./checkout";

export type OrderStatus = "created" | "success" | "pending" | "failed" | "cancelled" | "refunded";

export type Order = {
  id: string;
  status: OrderStatus;
  amount: number;
  payload: CheckoutPayload;
  createdAt: number;
  updatedAt: number;
  paymentRef?: string;
};

declare global {
  // eslint-disable-next-line no-var
  var __ordersStore: Map<string, Order> | undefined;
}

const orders: Map<string, Order> = globalThis.__ordersStore ?? new Map();
if (process.env.NODE_ENV !== "production") {
  globalThis.__ordersStore = orders;
}

export const orderStore = {
  create(order: Order) {
    orders.set(order.id, order);
  },
  get(id: string) {
    return orders.get(id);
  },
  updateStatus(id: string, status: OrderStatus, paymentRef?: string) {
    const o = orders.get(id);
    if (!o) return null;
    o.status = status;
    o.updatedAt = Date.now();
    if (paymentRef) o.paymentRef = paymentRef;
    return o;
  },
};
