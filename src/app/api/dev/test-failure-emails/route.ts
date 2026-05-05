import { NextResponse } from "next/server";
import {
  sendProvisioningDelayedNotice,
  sendProvisioningFailureAlert,
} from "@/lib/mail-templates";
import type { Order } from "@/lib/order-store";

export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Not found", { status: 404 });
  }

  const url = new URL(req.url);
  const customer = url.searchParams.get("to") ?? "test@example.com";
  const reason = url.searchParams.get("reason") ?? "Sorry, the disk is full";

  const fakeOrder: Order = {
    id: `DEV-${Date.now().toString(36).toUpperCase()}`,
    status: "success",
    amount: 80000,
    paymentRef: "TX-WOMPI-FAKE-12345",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    payload: {
      planId: "news",
      billing: "annual",
      paymentProvider: "wompi",
      contact: {
        firstName: "Cliente",
        lastName: "Prueba",
        email: customer,
        phone: "+573000000000",
      },
      invoice: {
        personType: "natural",
        docType: "CC",
        docNumber: "1023456789",
        legalName: "Cliente Prueba",
        email: customer,
        phone: "+573000000000",
        address: "Cra. 7 # 10-20",
        city: "Bogotá",
        department: "Bogotá D.C.",
        country: "Colombia",
      },
      hosting: { domain: "fallido.com", domainOwnership: "owned" },
    },
  };

  const [alert, notice] = await Promise.all([
    sendProvisioningFailureAlert(fakeOrder, reason),
    sendProvisioningDelayedNotice(fakeOrder),
  ]);

  return NextResponse.json({
    orderId: fakeOrder.id,
    alert,
    notice,
  });
}
