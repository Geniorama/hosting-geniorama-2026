import { sendMail } from "./mail";
import type { Order } from "./order-store";
import type { WhmCreateAcctResult } from "./whm";

const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export async function sendCpanelCredentials(
  order: Order,
  acct: Extract<WhmCreateAcctResult, { ok: true }>,
) {
  const recipientEmail = order.payload.invoice.email || order.payload.contact.email;
  const recipientName =
    order.payload.invoice.legalName ||
    `${order.payload.contact.firstName} ${order.payload.contact.lastName}`.trim();

  const cpanelUrl = `https://${acct.domain}:2083`;
  const webmailUrl = `https://${acct.domain}:2096`;
  const ns1 = process.env.HOSTING_NS1 ?? "ns11.bienvenidohosting.com";
  const ns2 = process.env.HOSTING_NS2 ?? "ns12.bienvenidohosting.com";

  const subject = `Tu hosting Geniorama está listo — credenciales para ${acct.domain}`;

  const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><title>${escape(subject)}</title></head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:Arial,Helvetica,sans-serif;color:#1f2333;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 6px 24px rgba(15,19,32,0.08);">
        <tr><td style="background:#0b1a6a;padding:28px 32px;color:#fff;">
          <div style="font-size:13px;letter-spacing:1.5px;text-transform:uppercase;opacity:0.75;">Geniorama Hosting</div>
          <div style="font-size:24px;font-weight:800;margin-top:6px;">¡Tu cuenta está activa!</div>
        </td></tr>
        <tr><td style="padding:28px 32px;">
          <p style="margin:0 0 16px;font-size:15px;line-height:1.55;">Hola <strong>${escape(recipientName)}</strong>,</p>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.55;">Confirmamos tu pago y ya creamos tu cuenta cPanel para <strong>${escape(acct.domain)}</strong>. Estos son tus accesos:</p>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;background:#f7f8fc;border:1px solid #e3e6f1;border-radius:10px;">
            <tr><td style="padding:14px 18px;border-bottom:1px solid #e3e6f1;">
              <div style="font-size:12px;color:#6b7088;text-transform:uppercase;letter-spacing:0.6px;">Usuario</div>
              <div style="font-family:Consolas,Monaco,monospace;font-size:16px;font-weight:700;margin-top:4px;">${escape(acct.username)}</div>
            </td></tr>
            <tr><td style="padding:14px 18px;border-bottom:1px solid #e3e6f1;">
              <div style="font-size:12px;color:#6b7088;text-transform:uppercase;letter-spacing:0.6px;">Contraseña</div>
              <div style="font-family:Consolas,Monaco,monospace;font-size:16px;font-weight:700;margin-top:4px;">${escape(acct.password)}</div>
            </td></tr>
            <tr><td style="padding:14px 18px;border-bottom:1px solid #e3e6f1;">
              <div style="font-size:12px;color:#6b7088;text-transform:uppercase;letter-spacing:0.6px;">Acceso cPanel</div>
              <a href="${cpanelUrl}" style="font-family:Consolas,Monaco,monospace;font-size:14px;font-weight:600;margin-top:4px;color:#0b1a6a;text-decoration:none;display:block;">${cpanelUrl}</a>
            </td></tr>
            <tr><td style="padding:14px 18px;border-bottom:1px solid #e3e6f1;">
              <div style="font-size:12px;color:#6b7088;text-transform:uppercase;letter-spacing:0.6px;">Webmail</div>
              <a href="${webmailUrl}" style="font-family:Consolas,Monaco,monospace;font-size:14px;font-weight:600;margin-top:4px;color:#0b1a6a;text-decoration:none;display:block;">${webmailUrl}</a>
            </td></tr>
            ${
              acct.ip
                ? `<tr><td style="padding:14px 18px;">
              <div style="font-size:12px;color:#6b7088;text-transform:uppercase;letter-spacing:0.6px;">IP del servidor</div>
              <div style="font-family:Consolas,Monaco,monospace;font-size:14px;margin-top:4px;">${escape(acct.ip)}</div>
            </td></tr>`
                : ""
            }
          </table>

          <h3 style="font-size:15px;margin:24px 0 8px;color:#0b1a6a;">Apunta tu dominio al servidor</h3>
          <p style="margin:0 0 12px;font-size:14px;line-height:1.55;color:#3a3f59;">Si compraste tu dominio aparte, ingresa al panel de tu registrador y configura estos <strong>nameservers</strong>:</p>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 16px;background:#f7f8fc;border:1px solid #e3e6f1;border-radius:10px;">
            <tr><td style="padding:12px 18px;border-bottom:1px solid #e3e6f1;">
              <div style="font-size:12px;color:#6b7088;text-transform:uppercase;letter-spacing:0.6px;">Nameserver 1</div>
              <div style="font-family:Consolas,Monaco,monospace;font-size:15px;font-weight:700;margin-top:4px;">${escape(ns1)}</div>
            </td></tr>
            <tr><td style="padding:12px 18px;">
              <div style="font-size:12px;color:#6b7088;text-transform:uppercase;letter-spacing:0.6px;">Nameserver 2</div>
              <div style="font-family:Consolas,Monaco,monospace;font-size:15px;font-weight:700;margin-top:4px;">${escape(ns2)}</div>
            </td></tr>
          </table>

          <p style="margin:0 0 16px;font-size:13px;line-height:1.55;color:#6b7088;">Alternativamente puedes crear un registro A apuntando a la IP de arriba. La propagación DNS toma entre 15 minutos y 24 horas. ¿Necesitas ayuda? Escríbenos a <a href="mailto:soporte@geniorama.co" style="color:#0b1a6a;font-weight:600;">soporte@geniorama.co</a> y te guiamos.</p>

          <h3 style="font-size:15px;margin:24px 0 8px;color:#0b1a6a;">Próximos pasos</h3>
          <ol style="margin:0 0 16px;padding-left:18px;font-size:14px;line-height:1.7;color:#3a3f59;">
            <li>Ingresa a cPanel con las credenciales de arriba.</li>
            <li>Cambia tu contraseña en <em>Preferences → Password & Security</em>.</li>
            <li>Crea cuentas de email en <em>Email → Email Accounts</em>.</li>
            <li>Instala WordPress (u otro CMS) desde <em>Softaculous Apps Installer</em>.</li>
          </ol>

          <p style="margin:28px 0 0;font-size:13px;line-height:1.55;color:#6b7088;">Pedido <strong>${escape(order.id)}</strong> · ${new Date().toLocaleDateString("es-CO")}</p>
        </td></tr>
        <tr><td style="background:#f7f8fc;padding:18px 32px;font-size:12px;color:#6b7088;text-align:center;">
          ¿Dudas? Escríbenos a <a href="mailto:soporte@geniorama.co" style="color:#0b1a6a;font-weight:600;text-decoration:none;">soporte@geniorama.co</a>. Geniorama Hosting.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  const text = [
    `Hola ${recipientName},`,
    ``,
    `Tu cuenta cPanel para ${acct.domain} está activa.`,
    ``,
    `Usuario: ${acct.username}`,
    `Contraseña: ${acct.password}`,
    `cPanel: ${cpanelUrl}`,
    `Webmail: ${webmailUrl}`,
    acct.ip ? `IP del servidor: ${acct.ip}` : "",
    ``,
    `Nameservers para apuntar tu dominio:`,
    `  ${ns1}`,
    `  ${ns2}`,
    ``,
    `Pedido: ${order.id}`,
    ``,
    `Cambia tu contraseña la primera vez que ingreses.`,
    `¿Dudas? Escríbenos a soporte@geniorama.co`,
    `Geniorama Hosting`,
  ]
    .filter(Boolean)
    .join("\n");

  const bcc = (process.env.MAIL_BCC ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((email) => ({ email }));

  const result = await sendMail({
    to: { email: recipientEmail, name: recipientName },
    subject,
    html,
    text,
    bcc: bcc.length ? bcc : undefined,
  });

  if (!result.ok) {
    console.error("[mail] credentials send failed", { order: order.id, error: result.error });
  } else {
    console.log("[mail] credentials sent", { order: order.id, to: recipientEmail, id: result.id });
  }
  return result;
}

function getOpsRecipients(): string[] {
  const raw =
    process.env.MAIL_OPS_ALERT ??
    process.env.MAIL_BCC ??
    "soporte@geniorama.co";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function sendProvisioningFailureAlert(order: Order, errorMessage: string) {
  const ops = getOpsRecipients();
  if (!ops.length) {
    console.warn("[mail] no ops recipients configured for provisioning alert");
    return { ok: false as const, error: "no ops recipients" };
  }

  const customerEmail = order.payload.invoice.email || order.payload.contact.email;
  const customerPhone = order.payload.invoice.phone || order.payload.contact.phone;
  const customerName =
    order.payload.invoice.legalName ||
    `${order.payload.contact.firstName} ${order.payload.contact.lastName}`.trim();
  const domain = order.payload.hosting.domain;

  const subject = `[ALERTA] Pedido ${order.id} pagado pero NO aprovisionado`;

  const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><title>${escape(subject)}</title></head>
<body style="margin:0;padding:0;background:#fff;font-family:Consolas,Menlo,monospace;color:#1f2333;font-size:13px;line-height:1.6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px;">
    <tr><td>
      <div style="background:#b91c1c;color:#fff;padding:14px 18px;border-radius:8px 8px 0 0;font-family:Arial,Helvetica,sans-serif;font-weight:800;font-size:16px;">
        ⚠ Aprovisionamiento fallido — acción requerida
      </div>
      <div style="background:#fff7ed;border:1px solid #fed7aa;border-top:none;padding:18px;border-radius:0 0 8px 8px;">
        <p style="margin:0 0 12px;font-family:Arial,Helvetica,sans-serif;font-size:14px;">
          El cliente ya pagó pero <strong>WHM rechazó la creación de la cuenta cPanel</strong>. Hay que crearla a mano o contactar al cliente para reembolso.
        </p>

        <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin-top:8px;">
          <tr><td style="padding:6px 0;width:140px;color:#6b7088;">Pedido</td><td style="padding:6px 0;font-weight:700;">${escape(order.id)}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7088;">Plan</td><td style="padding:6px 0;">${escape(order.payload.planId)} (${order.payload.billing})</td></tr>
          <tr><td style="padding:6px 0;color:#6b7088;">Monto</td><td style="padding:6px 0;">$${order.amount.toLocaleString("es-CO")} COP</td></tr>
          <tr><td style="padding:6px 0;color:#6b7088;">Dominio solicitado</td><td style="padding:6px 0;font-weight:700;">${escape(domain)}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7088;">Cliente</td><td style="padding:6px 0;">${escape(customerName)}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7088;">Email</td><td style="padding:6px 0;"><a href="mailto:${escape(customerEmail)}">${escape(customerEmail)}</a></td></tr>
          <tr><td style="padding:6px 0;color:#6b7088;">Teléfono</td><td style="padding:6px 0;">${escape(customerPhone)}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7088;">Doc.</td><td style="padding:6px 0;">${escape(order.payload.invoice.docType)} ${escape(order.payload.invoice.docNumber)}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7088;">Pago Wompi</td><td style="padding:6px 0;">${escape(order.paymentRef ?? "—")}</td></tr>
        </table>

        <div style="margin-top:18px;padding:12px 14px;background:#1f2333;color:#fca5a5;border-radius:6px;font-family:Consolas,Menlo,monospace;">
          <div style="color:#fbbf24;font-weight:700;margin-bottom:6px;">Error WHM:</div>
          ${escape(errorMessage)}
        </div>

        <p style="margin:18px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#3a3f59;">
          <strong>Próximos pasos:</strong><br>
          1. Identifica la causa (espacio en servidor, dominio duplicado, etc.).<br>
          2. Crea la cuenta manualmente en WHM con el plan y dominio de arriba.<br>
          3. Una vez creada, registra <code>provisioning</code> en la tabla <code>orders</code> de Supabase y envía credenciales al cliente, o invoca el endpoint <code>/api/dev/send-credentials</code>.<br>
          4. El cliente ya recibió un correo de "tu hosting está en activación" automático.
        </p>
      </div>
    </td></tr>
  </table>
</body></html>`;

  const text = [
    `ALERTA: Pedido ${order.id} pagado pero NO aprovisionado.`,
    ``,
    `Plan: ${order.payload.planId} (${order.payload.billing})`,
    `Dominio: ${domain}`,
    `Cliente: ${customerName} <${customerEmail}> · ${customerPhone}`,
    `Doc: ${order.payload.invoice.docType} ${order.payload.invoice.docNumber}`,
    `Pago Wompi: ${order.paymentRef ?? "—"}`,
    `Monto: $${order.amount.toLocaleString("es-CO")} COP`,
    ``,
    `Error WHM:`,
    `  ${errorMessage}`,
    ``,
    `Crear cuenta manualmente y enviar credenciales, o reembolsar.`,
  ].join("\n");

  const result = await sendMail({
    to: ops.map((email) => ({ email })),
    subject,
    html,
    text,
  });

  if (!result.ok) {
    console.error("[mail] ops alert failed", { order: order.id, error: result.error });
  } else {
    console.log("[mail] ops alert sent", { order: order.id, to: ops, id: result.id });
  }
  return result;
}

export async function sendProvisioningDelayedNotice(order: Order) {
  const recipientEmail = order.payload.invoice.email || order.payload.contact.email;
  const recipientName =
    order.payload.invoice.legalName ||
    `${order.payload.contact.firstName} ${order.payload.contact.lastName}`.trim();

  const subject = `Recibimos tu pago — tu hosting Geniorama estará listo en breve`;

  const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><title>${escape(subject)}</title></head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:Arial,Helvetica,sans-serif;color:#1f2333;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 6px 24px rgba(15,19,32,0.08);">
        <tr><td style="background:#0b1a6a;padding:28px 32px;color:#fff;">
          <div style="font-size:13px;letter-spacing:1.5px;text-transform:uppercase;opacity:0.75;">Geniorama Hosting</div>
          <div style="font-size:22px;font-weight:800;margin-top:6px;">Pago confirmado · activación en curso</div>
        </td></tr>
        <tr><td style="padding:28px 32px;">
          <p style="margin:0 0 14px;font-size:15px;line-height:1.55;">Hola <strong>${escape(recipientName)}</strong>,</p>
          <p style="margin:0 0 14px;font-size:15px;line-height:1.55;">¡Gracias por tu compra! Recibimos tu pago para el dominio <strong>${escape(order.payload.hosting.domain)}</strong>.</p>
          <p style="margin:0 0 14px;font-size:15px;line-height:1.55;">Estamos terminando de configurar tu cuenta cPanel manualmente. En las <strong>próximas 24 horas hábiles</strong> recibirás un segundo correo con tus credenciales de acceso y los datos para apuntar tu dominio.</p>
          <p style="margin:0 0 14px;font-size:15px;line-height:1.55;">Si tienes urgencia o alguna duda, escríbenos a <a href="mailto:soporte@geniorama.co" style="color:#0b1a6a;font-weight:600;">soporte@geniorama.co</a> mencionando tu pedido <strong>${escape(order.id)}</strong> y te respondemos enseguida.</p>
          <p style="margin:24px 0 0;font-size:13px;line-height:1.55;color:#6b7088;">Pedido <strong>${escape(order.id)}</strong> · ${new Date().toLocaleDateString("es-CO")}</p>
        </td></tr>
        <tr><td style="background:#f7f8fc;padding:18px 32px;font-size:12px;color:#6b7088;text-align:center;">
          Geniorama Hosting · <a href="mailto:soporte@geniorama.co" style="color:#0b1a6a;text-decoration:none;font-weight:600;">soporte@geniorama.co</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  const text = [
    `Hola ${recipientName},`,
    ``,
    `Recibimos tu pago para ${order.payload.hosting.domain}. ¡Gracias!`,
    ``,
    `Estamos terminando de configurar tu cuenta cPanel manualmente.`,
    `En las próximas 24 horas hábiles recibirás un segundo correo con tus credenciales y la información para apuntar tu dominio.`,
    ``,
    `Si tienes urgencia, escríbenos a soporte@geniorama.co mencionando tu pedido ${order.id}.`,
    ``,
    `Pedido: ${order.id}`,
    `Geniorama Hosting`,
  ].join("\n");

  const result = await sendMail({
    to: { email: recipientEmail, name: recipientName },
    subject,
    html,
    text,
  });

  if (!result.ok) {
    console.error("[mail] delayed notice failed", { order: order.id, error: result.error });
  } else {
    console.log("[mail] delayed notice sent", { order: order.id, to: recipientEmail, id: result.id });
  }
  return result;
}
