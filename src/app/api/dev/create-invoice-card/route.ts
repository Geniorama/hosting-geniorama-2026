import { NextResponse } from "next/server";
import { createInvoiceCard } from "@/lib/trello";
import type { Order } from "@/lib/order-store";

export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Not found", { status: 404 });
  }

  const url = new URL(req.url);
  const plan = url.searchParams.get("plan") ?? "basic";
  const billing = (url.searchParams.get("billing") ?? "annual") as "monthly" | "annual";
  const domain = url.searchParams.get("domain") ?? "facturarprueba.com";
  const email = url.searchParams.get("email") ?? "cliente@test.com";
  const name = url.searchParams.get("name") ?? "Cliente Prueba S.A.S.";
  const taxId = url.searchParams.get("taxId") ?? "900123456";

  const fakeOrder: Order = {
    id: `DEV-${Date.now().toString(36).toUpperCase()}`,
    status: "success",
    amount: billing === "annual" ? 192000 : 20000,
    paymentRef: "TX-WOMPI-FAKE-12345",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    provisioning: {
      username: "fake01",
      domain,
      package: "genioram_Basic",
      ip: "184.107.91.148",
      provisionedAt: Date.now(),
    },
    ticketsSync: {
      userId: "fake_user_id",
      companyId: "fake_company_id",
      serviceId: "fake_service_id",
      planId: "fake_plan_id",
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      syncedAt: Date.now(),
    },
    payload: {
      planId: plan,
      billing,
      paymentProvider: "wompi",
      contact: {
        firstName: name.split(" ")[0],
        lastName: name.split(" ").slice(1).join(" ") || "Test",
        email,
        phone: "+573000000000",
      },
      invoice: {
        personType: "juridica",
        docType: "NIT",
        docNumber: taxId,
        dv: "1",
        legalName: name,
        email,
        phone: "+573000000000",
        fiscalResponsibility: "responsable",
        address: "Cra. 7 # 10-20, Of. 301",
        city: "Bogotá",
        department: "Bogotá D.C.",
        country: "Colombia",
      },
      hosting: { domain, domainOwnership: "owned" },
      notes: "Cliente de prueba — orden generada por endpoint dev.",
    },
  };

  const result = await createInvoiceCard(fakeOrder);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    orderId: fakeOrder.id,
    card: { id: result.id, url: result.shortUrl },
  });
}
