import { NextResponse } from "next/server";
import { syncOrderToTickets } from "@/lib/tickets-integration";
import type { Order } from "@/lib/order-store";

export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Not found", { status: 404 });
  }

  const url = new URL(req.url);
  const email = url.searchParams.get("email") ?? "test@example.com";
  const domain = url.searchParams.get("domain") ?? "ejemplo.com";
  const plan = url.searchParams.get("plan") ?? "basic";
  const billing = (url.searchParams.get("billing") ?? "annual") as "monthly" | "annual";
  const name = url.searchParams.get("name") ?? "Cliente Prueba";
  const taxId = url.searchParams.get("taxId") ?? "1023456789";

  const fakeOrder: Order = {
    id: `DEV-${Date.now().toString(36).toUpperCase()}`,
    status: "success",
    amount: 192000,
    paymentRef: "TX-WOMPI-FAKE",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    payload: {
      planId: plan,
      billing,
      paymentProvider: "wompi",
      contact: { firstName: name.split(" ")[0], lastName: name.split(" ").slice(1).join(" ") || "Test", email, phone: "+573000000000" },
      invoice: {
        personType: "natural",
        docType: "CC",
        docNumber: taxId,
        legalName: name,
        email,
        phone: "+573000000000",
        address: "N/A",
        city: "Bogotá",
        department: "Bogotá D.C.",
        country: "Colombia",
      },
      hosting: { domain },
    },
  };

  const result = await syncOrderToTickets(fakeOrder, {
    ok: true,
    username: "fake01",
    domain,
    password: "FakePass123!",
    package: "genioram_Basic",
    ip: "184.107.91.148",
    raw: null,
  });

  return NextResponse.json({ orderId: fakeOrder.id, result });
}
