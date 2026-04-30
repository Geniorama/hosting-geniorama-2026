import { NextResponse } from "next/server";
import { sendCpanelCredentials } from "@/lib/mail-templates";
import type { Order } from "@/lib/order-store";

export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Not found", { status: 404 });
  }

  const url = new URL(req.url);
  const to = url.searchParams.get("to");
  if (!to) {
    return NextResponse.json({ ok: false, error: "Pasa ?to=email@ejemplo.com" }, { status: 400 });
  }

  const fakeOrder: Order = {
    id: `DEV-${Date.now().toString(36).toUpperCase()}`,
    status: "success",
    amount: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    payload: {
      planId: "basic",
      billing: "monthly",
      paymentProvider: "wompi",
      contact: { firstName: "Cliente", lastName: "Prueba", email: to, phone: "+573000000000" },
      invoice: {
        personType: "natural",
        docType: "CC",
        docNumber: "0000000000",
        legalName: "Cliente Prueba",
        email: to,
        phone: "+573000000000",
        address: "N/A",
        city: "Bogotá",
        department: "Bogotá D.C.",
        country: "Colombia",
      },
      hosting: { domain: "ejemplo.com" },
    },
  };

  const result = await sendCpanelCredentials(fakeOrder, {
    ok: true,
    username: "ejempl1",
    domain: "ejemplo.com",
    password: "ContraseñaDePrueba123!",
    package: "genioram_Basic",
    ip: "184.107.91.148",
    raw: null,
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
  }

  return NextResponse.json({ ok: true, id: result.id, sentTo: to });
}
