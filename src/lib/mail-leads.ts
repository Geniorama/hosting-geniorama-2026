import type { AdvisorPlanPick } from "./advisor";
import { sendMail } from "./mail";
import { ctaButton, customerShell, escape, getOpsRecipients } from "./mail-templates";

export type AdvisorLead = {
  id?: string;
  name: string;
  email: string;
  /** Celular en formato E.164 (+573001234567) para escribirle por WhatsApp. */
  phone: string;
  /** Plan recomendado en el momento de dejar los datos. Null si aún no había. */
  pick: AdvisorPlanPick | null;
  source: string;
  conversation?: { role: "user" | "assistant"; content: string }[];
  utm?: Record<string, string>;
};

function baseUrl(): string {
  return (process.env.NEXT_PUBLIC_BASE_URL ?? "https://hosting.geniorama.co").replace(/\/$/, "");
}

/** "Tu recomendación" — al visitante que dejó sus datos en la landing. */
export async function sendLeadRecommendation(lead: AdvisorLead) {
  const { pick } = lead;
  if (!pick) return { ok: false as const, error: "lead sin plan recomendado" };

  const firstName = lead.name.split(/\s+/)[0] || lead.name;
  const monthly = pick.billing === "annual" ? pick.annualMonthly : pick.monthly;
  const checkoutUrl = `${baseUrl()}${pick.checkoutUrl}`;
  const subject = `Tu recomendación: plan ${pick.name}`;
  const annualNote =
    pick.billing === "annual"
      ? ` <span style="font-weight:400;color:#6b7088;font-size:13px;">(pago anual de $${pick.annual.toLocaleString("es-CO")})</span>`
      : "";

  const body = `
    <p style="margin:0 0 14px;font-size:15px;">Hola ${escape(firstName)},</p>
    <p style="margin:0 0 18px;font-size:15px;line-height:1.6;">
      Por lo que nos contaste de tu proyecto, el plan que mejor te sirve es
      <strong>${escape(pick.name)}</strong> (${escape(pick.categoryLabel)}).
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 4px;background:#f7f8fc;border:1px solid #e3e6f1;border-radius:10px;">
      <tr><td style="padding:14px 18px;border-bottom:1px solid #e3e6f1;">
        <div style="font-size:12px;color:#6b7088;text-transform:uppercase;letter-spacing:0.6px;">Plan</div>
        <div style="font-weight:700;margin-top:3px;font-size:16px;">${escape(pick.name)}</div>
      </td></tr>
      <tr><td style="padding:14px 18px;border-bottom:1px solid #e3e6f1;">
        <div style="font-size:12px;color:#6b7088;text-transform:uppercase;letter-spacing:0.6px;">Precio</div>
        <div style="font-weight:700;margin-top:3px;font-size:16px;">$${monthly.toLocaleString("es-CO")} / mes${annualNote}</div>
      </td></tr>
      <tr><td style="padding:14px 18px;">
        <div style="font-size:12px;color:#6b7088;text-transform:uppercase;letter-spacing:0.6px;">Incluye</div>
        <div style="margin-top:6px;font-size:14px;line-height:1.7;">${pick.highlights
          .slice(0, 4)
          .map((h) => `• ${escape(h)}`)
          .join("<br>")}</div>
      </td></tr>
    </table>

    ${ctaButton(checkoutUrl, `Contratar ${escape(pick.name)}`)}

    <p style="margin:6px 0 0;font-size:13px;color:#6b7088;line-height:1.6;">
      Precios en pesos colombianos, servicio exento de IVA. Migramos tu sitio desde otro
      proveedor sin costo y puedes cambiar de plan cuando quieras. ¿Dudas antes de decidir?
      Responde este correo y te ayudamos.
    </p>`;

  const text = [
    `Hola ${firstName},`,
    ``,
    `Por lo que nos contaste, el plan que mejor te sirve es ${pick.name} (${pick.categoryLabel}).`,
    ``,
    `Precio: $${monthly.toLocaleString("es-CO")} / mes${
      pick.billing === "annual" ? ` (pago anual de $${pick.annual.toLocaleString("es-CO")})` : ""
    }`,
    `Incluye: ${pick.highlights.slice(0, 4).join(" · ")}`,
    ``,
    `Contrátalo aquí: ${checkoutUrl}`,
    ``,
    `Precios en COP, exento de IVA. Migración gratis y cambio de plan cuando quieras.`,
    `Geniorama Hosting`,
  ].join("\n");

  const result = await sendMail({
    to: { email: lead.email, name: lead.name },
    subject,
    html: customerShell({
      subject,
      heading: `Tu recomendación: plan ${escape(pick.name)}`,
      headingColor: "#0b1a6a",
      body,
    }),
    text,
  });

  if (!result.ok) {
    console.error("[mail] lead recommendation failed", { email: lead.email, error: result.error });
  } else {
    console.log("[mail] lead recommendation sent", { email: lead.email, id: result.id });
  }
  return result;
}

/** Aviso interno con la conversación completa, para que comercial haga seguimiento. */
export async function sendLeadAlert(lead: AdvisorLead) {
  const ops = getOpsRecipients();
  if (!ops.length) {
    console.warn("[mail] no ops recipients configured for lead alert");
    return { ok: false as const, error: "no ops recipients" };
  }

  const planLine = lead.pick
    ? `${lead.pick.name} (${lead.pick.categoryLabel}) · ${
        lead.pick.billing === "annual" ? "anual" : "mensual"
      }`
    : "sin recomendación cerrada";

  const subject = `[LEAD] ${lead.name} — ${lead.pick ? lead.pick.name : "asesor IA"}`;

  const utmRows = Object.entries(lead.utm ?? {})
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 0;color:#6b7088;">${escape(k)}</td><td style="padding:6px 0;">${escape(v)}</td></tr>`,
    )
    .join("");

  const chat = (lead.conversation ?? [])
    .map(
      (turn) =>
        `<div style="margin-bottom:8px;"><span style="font-weight:700;color:${
          turn.role === "user" ? "#0b1a6a" : "#b45309"
        };">${turn.role === "user" ? "Visitante" : "Asesor"}:</span> ${escape(turn.content)}</div>`,
    )
    .join("");

  const waLink = lead.phone
    ? `<a href="https://wa.me/${escape(lead.phone.replace(/[^0-9]/g, ""))}">${escape(lead.phone)}</a>`
    : "—";

  const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><title>${escape(subject)}</title></head>
<body style="margin:0;padding:0;background:#fff;font-family:Arial,Helvetica,sans-serif;color:#1f2333;font-size:14px;line-height:1.6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px;">
    <tr><td>
      <div style="background:#0b1a6a;color:#fff;padding:14px 18px;border-radius:8px 8px 0 0;font-weight:800;font-size:16px;">
        Lead nuevo desde el asesor de IA
      </div>
      <div style="background:#f7f8fc;border:1px solid #e3e6f1;border-top:none;padding:18px;border-radius:0 0 8px 8px;">
        <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:6px 0;width:150px;color:#6b7088;">Nombre</td><td style="padding:6px 0;font-weight:700;">${escape(lead.name)}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7088;">Email</td><td style="padding:6px 0;"><a href="mailto:${escape(lead.email)}">${escape(lead.email)}</a></td></tr>
          <tr><td style="padding:6px 0;color:#6b7088;">Teléfono</td><td style="padding:6px 0;">${waLink}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7088;">Plan sugerido</td><td style="padding:6px 0;font-weight:700;">${escape(planLine)}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7088;">Origen</td><td style="padding:6px 0;">${escape(lead.source)}</td></tr>
          ${lead.id ? `<tr><td style="padding:6px 0;color:#6b7088;">Id</td><td style="padding:6px 0;">${escape(lead.id)}</td></tr>` : ""}
          ${utmRows}
        </table>
        ${
          chat
            ? `<div style="margin-top:18px;padding:14px 16px;background:#fff;border:1px solid #e3e6f1;border-radius:8px;">
                 <div style="font-size:12px;color:#6b7088;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:10px;">Conversación</div>
                 ${chat}
               </div>`
            : ""
        }
      </div>
    </td></tr>
  </table>
</body></html>`;

  const text = [
    `Lead nuevo desde el asesor de IA`,
    ``,
    `Nombre: ${lead.name}`,
    `Email: ${lead.email}`,
    `Teléfono: ${lead.phone}`,
    `Plan sugerido: ${planLine}`,
    `Origen: ${lead.source}`,
    lead.id ? `Id: ${lead.id}` : "",
    ...Object.entries(lead.utm ?? {}).map(([k, v]) => `${k}: ${v}`),
    ``,
    ...(lead.conversation ?? []).map(
      (t) => `${t.role === "user" ? "Visitante" : "Asesor"}: ${t.content}`,
    ),
  ]
    .filter(Boolean)
    .join("\n");

  const result = await sendMail({
    to: ops.map((email) => ({ email })),
    subject,
    html,
    text,
    // Responder el aviso escribe directo al lead.
    replyTo: { email: lead.email, name: lead.name },
  });

  if (!result.ok) {
    console.error("[mail] lead alert failed", { email: lead.email, error: result.error });
  }
  return result;
}
