import { NextResponse } from "next/server";
import { createCpanelAccount } from "@/lib/whm";
import type { Order } from "@/lib/order-store";
import { isValidDomain } from "@/lib/checkout";

export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Not found", { status: 404 });
  }

  const url = new URL(req.url);
  const plan = url.searchParams.get("plan") ?? "starter";
  const domain = url.searchParams.get("domain") ?? "";
  const email = url.searchParams.get("email") ?? "test@example.com";
  const name = url.searchParams.get("name") ?? "Cliente Prueba";
  const phone = url.searchParams.get("phone") ?? "+573000000000";

  if (!isValidDomain(domain)) {
    return NextResponse.json(
      { ok: false, error: "Pasa ?domain=algo.com (formato válido)" },
      { status: 400 },
    );
  }

  const [firstName, ...rest] = name.split(/\s+/);
  const lastName = rest.join(" ") || "Test";

  const fakeOrder: Order = {
    id: `DEV-${Date.now().toString(36).toUpperCase()}`,
    status: "success",
    amount: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    payload: {
      planId: plan,
      billing: "monthly",
      paymentProvider: "wompi",
      contact: { firstName, lastName, email, phone },
      invoice: {
        personType: "natural",
        docType: "CC",
        docNumber: "0000000000",
        legalName: name,
        email,
        phone,
        address: "N/A",
        city: "Bogotá",
        department: "Bogotá D.C.",
        country: "Colombia",
      },
      hosting: { domain: domain.trim().toLowerCase() },
    },
  };

  const result = await createCpanelAccount(fakeOrder);

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, orderId: fakeOrder.id, error: result.error, raw: result.raw },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    orderId: fakeOrder.id,
    plan,
    package: result.package,
    username: result.username,
    domain: result.domain,
    password: result.password,
    ip: result.ip,
    note: "ESTE ENDPOINT ES SOLO PARA DEV. La cuenta cPanel quedó realmente creada en tu WHM.",
  });
}
