import type { PanelType } from "./hosting-account";
import { sendMail } from "./mail";
import type { Order } from "./order-store";
import { plans } from "./plans";
import type { WhmCreateAcctResult } from "./whm";

export const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export type CredentialsPresentation = {
  /** Control panel the account lives on. Defaults to "cpanel". */
  panel?: PanelType;
  /**
   * Override the panel login URL. Worth setting for a Plesk reseller: the
   * provider's server hostname has a valid certificate and works before the
   * domain resolves, unlike the default https://<domain>:8443.
   */
  panelUrl?: string;
  /** Override nameservers (defaults to HOSTING_NS1/NS2 env or cPanel defaults). */
  ns1?: string;
  ns2?: string;
  /** Override the webmail URL (defaults per panel type). */
  webmailUrl?: string;
  /** Whether to include the "point your domain" nameserver section. Defaults to true for cPanel, false for Plesk. */
  showNameservers?: boolean;
};

export async function sendCpanelCredentials(
  order: Order,
  acct: Extract<WhmCreateAcctResult, { ok: true }>,
  opts?: CredentialsPresentation,
) {
  const recipientEmail = order.payload.invoice.email || order.payload.contact.email;
  const recipientName =
    order.payload.invoice.legalName ||
    `${order.payload.contact.firstName} ${order.payload.contact.lastName}`.trim();

  const isPlesk = (opts?.panel ?? "cpanel") === "plesk";
  const panelName = isPlesk ? "Plesk" : "cPanel";
  const panelPort = isPlesk ? "8443" : "2083";
  const panelUrl = opts?.panelUrl ?? `https://${acct.domain}:${panelPort}`;
  const ipPanelUrl = acct.ip ? `https://${acct.ip}:${panelPort}` : "";
  const webmailUrl =
    opts?.webmailUrl ??
    (isPlesk ? `https://webmail.${acct.domain}` : `https://${acct.domain}:2096`);
  const ns1 = opts?.ns1 ?? process.env.HOSTING_NS1 ?? "ns11.bienvenidohosting.com";
  const ns2 = opts?.ns2 ?? process.env.HOSTING_NS2 ?? "ns12.bienvenidohosting.com";
  // cPanel shows nameservers by default; Plesk only when explicitly enabled.
  const showNs = opts?.showNameservers ?? !isPlesk;
  // A domain-based panel URL only resolves once DNS points here; an explicit
  // panelUrl (the reseller's own hostname) works from the first minute.
  const panelNeedsDns = !opts?.panelUrl;

  const dnsNotice = panelNeedsDns
    ? `<div style="margin:8px 0 20px;padding:14px 16px;background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;">
            <div style="font-size:13px;font-weight:700;color:#9a3412;margin-bottom:6px;">⚠ ¿Tu dominio ya apunta a nuestros servidores?</div>
            <p style="margin:0 0 8px;font-size:13px;line-height:1.55;color:#7c2d12;">El acceso por <strong>${escape(panelUrl)}</strong> sólo funciona cuando tu dominio resuelve a nuestro servidor.${showNs ? " Si aún no configuraste los <em>nameservers</em> (siguiente sección) o la propagación DNS no ha terminado, no podrás iniciar sesión por esa URL todavía." : " Si la propagación DNS aún no ha terminado, usa el acceso por IP de abajo mientras tanto."}</p>
            ${
              acct.ip
                ? `<p style="margin:0;font-size:13px;line-height:1.55;color:#7c2d12;">Mientras tanto puedes ingresar por la IP del servidor: <a href="${ipPanelUrl}" style="font-family:Consolas,Monaco,monospace;color:#0b1a6a;font-weight:700;">${ipPanelUrl}</a>. Tu navegador mostrará una advertencia de certificado — es normal, continúa con la opción "Avanzado → Continuar de todos modos".</p>`
                : `<p style="margin:0;font-size:13px;line-height:1.55;color:#7c2d12;">Espera a que la propagación DNS termine (entre 15 minutos y 24 horas) antes de intentar ingresar.</p>`
            }
          </div>`
    : `<div style="margin:8px 0 20px;padding:14px 16px;background:#eef7ff;border:1px solid #bfdcf5;border-radius:10px;">
            <p style="margin:0;font-size:13px;line-height:1.55;color:#0b3a6a;">Puedes entrar a <strong>${escape(panelUrl)}</strong> de inmediato, sin esperar la propagación DNS.${showNs ? " Tu sitio web, en cambio, sólo responderá cuando el dominio apunte a nuestros servidores (siguiente sección)." : ""}</p>
          </div>`;

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
          <p style="margin:0 0 16px;font-size:15px;line-height:1.55;">Confirmamos tu pago y ya creamos tu cuenta ${panelName} para <strong>${escape(acct.domain)}</strong>. Estos son tus accesos:</p>

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
              <div style="font-size:12px;color:#6b7088;text-transform:uppercase;letter-spacing:0.6px;">Acceso ${panelName}</div>
              <a href="${panelUrl}" style="font-family:Consolas,Monaco,monospace;font-size:14px;font-weight:600;margin-top:4px;color:#0b1a6a;text-decoration:none;display:block;">${panelUrl}</a>
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

          ${dnsNotice}

          ${
            showNs
              ? `<h3 style="font-size:15px;margin:24px 0 8px;color:#0b1a6a;">Apunta tu dominio al servidor</h3>
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

          <p style="margin:0 0 16px;font-size:13px;line-height:1.55;color:#6b7088;">Alternativamente puedes crear un registro A apuntando a la IP de arriba. La propagación DNS toma entre 15 minutos y 24 horas. ¿Necesitas ayuda? Escríbenos a <a href="mailto:soporte@geniorama.co" style="color:#0b1a6a;font-weight:600;">soporte@geniorama.co</a> y te guiamos.</p>`
              : `<p style="margin:0 0 16px;font-size:13px;line-height:1.55;color:#6b7088;">Si tu dominio todavía no apunta a nuestro servidor, crea un registro A hacia la IP de arriba o escríbenos a <a href="mailto:soporte@geniorama.co" style="color:#0b1a6a;font-weight:600;">soporte@geniorama.co</a> y lo configuramos contigo.</p>`
          }

          <h3 style="font-size:15px;margin:24px 0 8px;color:#0b1a6a;">Próximos pasos</h3>
          <ol style="margin:0 0 16px;padding-left:18px;font-size:14px;line-height:1.7;color:#3a3f59;">
            <li>Ingresa a ${panelName} con las credenciales de arriba.</li>
            ${
              isPlesk
                ? `<li>Cambia tu contraseña en <em>Mi perfil → Cambiar mi contraseña</em>.</li>
            <li>Crea cuentas de email en <em>Correo → Crear dirección de correo</em>.</li>
            <li>Instala WordPress desde <em>WordPress Toolkit</em>.</li>`
                : `<li>Cambia tu contraseña en <em>Preferences → Password & Security</em>.</li>
            <li>Crea cuentas de email en <em>Email → Email Accounts</em>.</li>
            <li>Instala WordPress (u otro CMS) desde <em>Softaculous Apps Installer</em>.</li>`
            }
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
    `Tu cuenta ${panelName} para ${acct.domain} está activa.`,
    ``,
    `Usuario: ${acct.username}`,
    `Contraseña: ${acct.password}`,
    `${panelName}: ${panelUrl}`,
    `Webmail: ${webmailUrl}`,
    acct.ip ? `IP del servidor: ${acct.ip}` : "",
    ``,
    panelNeedsDns
      ? `IMPORTANTE: el acceso por ${panelUrl} sólo funciona cuando tu dominio`
      : `Puedes entrar a ${panelUrl} de inmediato, sin esperar la propagación DNS.`,
    panelNeedsDns ? `apunta a nuestros servidores.` : "",
    panelNeedsDns && acct.ip
      ? `Mientras tanto puedes entrar por IP: ${ipPanelUrl} (el navegador`
      : "",
    panelNeedsDns && acct.ip
      ? `mostrará una advertencia de certificado — es normal, continúa de todos modos).`
      : "",
    ``,
    showNs ? `Nameservers para apuntar tu dominio:` : "",
    showNs ? `  ${ns1}` : "",
    showNs ? `  ${ns2}` : "",
    showNs ? `` : "",
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

export function getOpsRecipients(): string[] {
  const raw =
    process.env.MAIL_OPS_ALERT ??
    process.env.MAIL_BCC ??
    "soporte@geniorama.site";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function sendProvisioningFailureAlert(
  order: Order,
  errorMessage: string,
  opts?: {
    /**
     * Set to "plesk" when the primary reseller is full and the account has to
     * be created by hand in the Plesk reseller. Turns the alert into a work
     * order — steps plus the ready-to-run /api/admin/complete-order call —
     * instead of a generic failure.
     */
    manualPanel?: PanelType;
  },
) {
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

  const manualPlesk = opts?.manualPanel === "plesk";
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://hosting.geniorama.co";

  const completeOrderCall = [
    `curl -X POST ${baseUrl}/api/admin/complete-order \\`,
    `  -H "Authorization: Bearer $RESCUE_SECRET" \\`,
    `  -H "Content-Type: application/json" \\`,
    `  -d '{"orderId":"${order.id}","username":"USUARIO","password":"CLAVE",`,
    `       "panel":"plesk","ip":"IP_DEL_SERVIDOR",`,
    `       "ns1":"NS1_DEL_PROVEEDOR","ns2":"NS2_DEL_PROVEEDOR"}'`,
  ].join("\n");

  const subject = manualPlesk
    ? `[ACCIÓN] Pedido ${order.id} — crear cuenta manual en Plesk`
    : `[ALERTA] Pedido ${order.id} pagado pero NO aprovisionado`;

  const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><title>${escape(subject)}</title></head>
<body style="margin:0;padding:0;background:#fff;font-family:Consolas,Menlo,monospace;color:#1f2333;font-size:13px;line-height:1.6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px;">
    <tr><td>
      <div style="background:${manualPlesk ? "#b45309" : "#b91c1c"};color:#fff;padding:14px 18px;border-radius:8px 8px 0 0;font-family:Arial,Helvetica,sans-serif;font-weight:800;font-size:16px;">
        ${manualPlesk ? "⚠ Reseller cPanel lleno — crear la cuenta en Plesk" : "⚠ Aprovisionamiento fallido — acción requerida"}
      </div>
      <div style="background:#fff7ed;border:1px solid #fed7aa;border-top:none;padding:18px;border-radius:0 0 8px 8px;">
        <p style="margin:0 0 12px;font-family:Arial,Helvetica,sans-serif;font-size:14px;">
          ${
            manualPlesk
              ? `El cliente ya pagó y el <strong>reseller de cPanel no aceptó la cuenta</strong>. Créala a mano en el <strong>reseller de Plesk</strong> y luego corre el comando de abajo: el sistema se encarga del resto (credenciales al cliente, tickets y tarjeta de Trello).`
              : `El cliente ya pagó pero <strong>WHM rechazó la creación de la cuenta cPanel</strong>. Hay que crearla a mano o contactar al cliente para reembolso.`
          }
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
          <div style="color:#fbbf24;font-weight:700;margin-bottom:6px;">${manualPlesk ? "Motivo del rechazo en WHM:" : "Error WHM:"}</div>
          ${escape(errorMessage)}
        </div>

        ${
          manualPlesk
            ? `<p style="margin:18px 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#3a3f59;">
          <strong>Próximos pasos:</strong><br>
          1. Entra al reseller de <strong>Plesk</strong> y crea la suscripción para <strong>${escape(domain)}</strong> con el service plan equivalente al plan de arriba.<br>
          2. Anota el usuario, la contraseña y la IP del servidor.<br>
          3. Corre este comando — envía credenciales al cliente, sincroniza con tickets y crea la tarjeta de Trello:
        </p>
        <pre style="margin:0;padding:12px 14px;background:#1f2333;color:#a7f3d0;border-radius:6px;font-family:Consolas,Menlo,monospace;font-size:12px;line-height:1.5;overflow-x:auto;white-space:pre-wrap;">${escape(completeOrderCall)}</pre>
        <p style="margin:10px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#3a3f59;">
          4. El cliente ya recibió el correo automático de "tu hosting está en activación".
        </p>`
            : `<p style="margin:18px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#3a3f59;">
          <strong>Próximos pasos:</strong><br>
          1. Identifica la causa (espacio en servidor, dominio duplicado, etc.).<br>
          2. Crea la cuenta manualmente en WHM con el plan y dominio de arriba.<br>
          3. Una vez creada, registra <code>provisioning</code> en la tabla <code>orders</code> de Supabase y envía credenciales al cliente, o invoca el endpoint <code>/api/dev/send-credentials</code>.<br>
          4. El cliente ya recibió un correo de "tu hosting está en activación" automático.
        </p>`
        }
      </div>
    </td></tr>
  </table>
</body></html>`;

  const text = [
    manualPlesk
      ? `ACCIÓN: Pedido ${order.id} — el reseller de cPanel está lleno, crear la cuenta en Plesk.`
      : `ALERTA: Pedido ${order.id} pagado pero NO aprovisionado.`,
    ``,
    `Plan: ${order.payload.planId} (${order.payload.billing})`,
    `Dominio: ${domain}`,
    `Cliente: ${customerName} <${customerEmail}> · ${customerPhone}`,
    `Doc: ${order.payload.invoice.docType} ${order.payload.invoice.docNumber}`,
    `Pago Wompi: ${order.paymentRef ?? "—"}`,
    `Monto: $${order.amount.toLocaleString("es-CO")} COP`,
    ``,
    manualPlesk ? `Motivo del rechazo en WHM:` : `Error WHM:`,
    `  ${errorMessage}`,
    ``,
    ...(manualPlesk
      ? [
          `1. Crea la suscripción en el reseller de Plesk para ${domain}.`,
          `2. Anota usuario, contraseña e IP.`,
          `3. Corre:`,
          ``,
          completeOrderCall,
          ``,
          `El cliente ya recibió el aviso de "hosting en activación".`,
        ]
      : [`Crear cuenta manualmente y enviar credenciales, o reembolsar.`]),
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
          <p style="margin:0 0 14px;font-size:15px;line-height:1.55;">Estamos terminando de configurar tu cuenta de hosting manualmente. En las <strong>próximas 24 horas hábiles</strong> recibirás un segundo correo con tus credenciales de acceso y los datos para apuntar tu dominio.</p>
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
    `Estamos terminando de configurar tu cuenta de hosting manualmente.`,
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

// ── Renovaciones ─────────────────────────────────────────────────────────────

function planLabel(order: Order): string {
  const all = [...plans.web, ...plans.ads];
  return all.find((p) => p.id === order.payload.planId)?.name ?? order.payload.planId;
}

function billingLabel(order: Order): string {
  return order.payload.billing === "annual" ? "anual" : "mensual";
}

function customerRecipient(order: Order): { email: string; name: string } {
  return {
    email: order.payload.invoice.email || order.payload.contact.email,
    name:
      order.payload.invoice.legalName ||
      `${order.payload.contact.firstName} ${order.payload.contact.lastName}`.trim(),
  };
}

function longDate(ms: number): string {
  return new Date(ms).toLocaleDateString("es-CO", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** Shared shell so the renewal emails look like the rest without duplicating markup. */
export function customerShell(args: {
  subject: string;
  heading: string;
  headingColor: string;
  body: string;
}): string {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><title>${escape(args.subject)}</title></head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:Arial,Helvetica,sans-serif;color:#1f2333;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 2px 12px rgba(15,23,42,0.07);">
        <tr><td style="background:${args.headingColor};padding:22px 32px;color:#fff;font-size:18px;font-weight:800;">
          ${args.heading}
        </td></tr>
        <tr><td style="padding:28px 32px;">
          ${args.body}
        </td></tr>
        <tr><td style="background:#f7f8fc;padding:18px 32px;font-size:12px;color:#6b7088;text-align:center;">
          ¿Dudas? Escríbenos a <a href="mailto:soporte@geniorama.co" style="color:#0b1a6a;font-weight:600;text-decoration:none;">soporte@geniorama.co</a>. Geniorama Hosting.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export function ctaButton(url: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0;"><tr><td style="background:#0b1a6a;border-radius:8px;">
    <a href="${url}" style="display:inline-block;padding:13px 26px;color:#fff;font-weight:700;font-size:15px;text-decoration:none;">${label}</a>
  </td></tr></table>`;
}

function serviceFacts(order: Order): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 4px;background:#f7f8fc;border:1px solid #e3e6f1;border-radius:10px;">
    <tr><td style="padding:12px 18px;border-bottom:1px solid #e3e6f1;">
      <div style="font-size:12px;color:#6b7088;text-transform:uppercase;letter-spacing:0.6px;">Dominio</div>
      <div style="font-weight:700;margin-top:3px;">${escape(order.payload.hosting.domain)}</div>
    </td></tr>
    <tr><td style="padding:12px 18px;">
      <div style="font-size:12px;color:#6b7088;text-transform:uppercase;letter-spacing:0.6px;">Plan</div>
      <div style="font-weight:700;margin-top:3px;">${escape(planLabel(order))} · ${billingLabel(order)}</div>
    </td></tr>
  </table>`;
}

/** "Tu plan vence en N días" — sent once per reminder window. */
export async function sendRenewalReminder(order: Order, daysLeft: number, renewUrl: string) {
  const to = customerRecipient(order);
  const endLabel = order.periodEnd ? longDate(order.periodEnd) : "próximamente";
  const dayWord = daysLeft === 1 ? "día" : "días";
  const subject = `Tu hosting para ${order.payload.hosting.domain} vence en ${daysLeft} ${dayWord}`;

  const html = customerShell({
    subject,
    heading: `Tu plan vence en ${daysLeft} ${dayWord}`,
    headingColor: "#0b1a6a",
    body: `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;">Hola <strong>${escape(to.name)}</strong>,</p>
          <p style="margin:0 0 14px;font-size:15px;line-height:1.55;">Tu servicio de hosting llega al final de su periodo el <strong>${escape(endLabel)}</strong>. Para que tu sitio y tus correos sigan funcionando sin interrupción, renueva antes de esa fecha.</p>
          ${serviceFacts(order)}
          ${ctaButton(renewUrl, "Renovar mi plan")}
          <p style="margin:0;font-size:13px;line-height:1.55;color:#6b7088;">Renuevas al mismo precio del periodo anterior. Si prefieres no continuar, no tienes que hacer nada: el servicio se suspende al terminar el periodo. Si quieres cambiar de plan, escríbenos y te ayudamos.</p>`,
  });

  const text = [
    `Hola ${to.name},`,
    ``,
    `Tu hosting para ${order.payload.hosting.domain} vence el ${endLabel} (en ${daysLeft} ${dayWord}).`,
    `Plan: ${planLabel(order)} · ${billingLabel(order)}`,
    ``,
    `Renueva aquí: ${renewUrl}`,
    ``,
    `Renuevas al mismo precio del periodo anterior. Si prefieres no continuar,`,
    `no tienes que hacer nada: el servicio se suspende al terminar el periodo.`,
    ``,
    `Pedido: ${order.id}`,
    `Geniorama Hosting`,
  ].join("\n");

  const result = await sendMail({ to, subject, html, text });
  if (!result.ok) {
    console.error("[mail] renewal reminder failed", { order: order.id, error: result.error });
  } else {
    console.log("[mail] renewal reminder sent", { order: order.id, daysLeft, id: result.id });
  }
  return result;
}

/** "Tu plan venció" — sent once, with the grace period spelled out. */
export async function sendServiceExpiredNotice(order: Order, grace: number, renewUrl: string) {
  const to = customerRecipient(order);
  const endLabel = order.periodEnd ? longDate(order.periodEnd) : "recientemente";
  const subject = `Tu hosting para ${order.payload.hosting.domain} venció`;

  const graceLine =
    grace > 0
      ? `Mantendremos tu cuenta activa <strong>${grace} ${grace === 1 ? "día" : "días"}</strong> más. Pasado ese plazo suspendemos el servicio y tu sitio dejará de responder.`
      : `Tu cuenta queda suspendida y tu sitio dejará de responder.`;

  const html = customerShell({
    subject,
    heading: "Tu plan venció",
    headingColor: "#b45309",
    body: `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;">Hola <strong>${escape(to.name)}</strong>,</p>
          <p style="margin:0 0 14px;font-size:15px;line-height:1.55;">El periodo de tu servicio terminó el <strong>${escape(endLabel)}</strong> y aún no hemos recibido la renovación.</p>
          ${serviceFacts(order)}
          <p style="margin:14px 0;font-size:15px;line-height:1.55;">${graceLine}</p>
          ${ctaButton(renewUrl, "Renovar ahora")}
          <p style="margin:0;font-size:13px;line-height:1.55;color:#6b7088;">Tus archivos y correos siguen intactos durante este plazo. Si ya pagaste, escríbenos y lo verificamos de inmediato.</p>`,
  });

  const text = [
    `Hola ${to.name},`,
    ``,
    `Tu hosting para ${order.payload.hosting.domain} venció el ${endLabel}.`,
    grace > 0
      ? `Mantenemos tu cuenta activa ${grace} ${grace === 1 ? "día" : "días"} más antes de suspenderla.`
      : `Tu cuenta queda suspendida.`,
    ``,
    `Renueva aquí: ${renewUrl}`,
    ``,
    `Tus archivos y correos siguen intactos durante este plazo.`,
    `Si ya pagaste, escríbenos a soporte@geniorama.co y lo verificamos.`,
    ``,
    `Pedido: ${order.id}`,
    `Geniorama Hosting`,
  ].join("\n");

  const result = await sendMail({ to, subject, html, text });
  if (!result.ok) {
    console.error("[mail] expiry notice failed", { order: order.id, error: result.error });
  } else {
    console.log("[mail] expiry notice sent", { order: order.id, id: result.id });
  }
  return result;
}

/** Ops work order: the grace period ran out, someone has to suspend the account. */
export async function sendSuspensionWorkOrder(order: Order) {
  const ops = getOpsRecipients();
  if (!ops.length) {
    console.warn("[mail] no ops recipients configured for suspension work order");
    return { ok: false as const, error: "no ops recipients" };
  }

  const customer = customerRecipient(order);
  const panel = order.provisioning?.panel === "plesk" ? "Plesk" : "cPanel";
  const endLabel = order.periodEnd ? longDate(order.periodEnd) : "—";
  const subject = `[ACCIÓN] Suspender ${order.payload.hosting.domain} — periodo vencido`;

  const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><title>${escape(subject)}</title></head>
<body style="margin:0;padding:0;background:#fff;font-family:Consolas,Menlo,monospace;color:#1f2333;font-size:13px;line-height:1.6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px;">
    <tr><td>
      <div style="background:#b45309;color:#fff;padding:14px 18px;border-radius:8px 8px 0 0;font-family:Arial,Helvetica,sans-serif;font-weight:800;font-size:16px;">
        ⏳ Periodo vencido y sin renovar — suspender cuenta
      </div>
      <div style="background:#fff7ed;border:1px solid #fed7aa;border-top:none;padding:18px;border-radius:0 0 8px 8px;">
        <p style="margin:0 0 12px;font-family:Arial,Helvetica,sans-serif;font-size:14px;">
          Venció el plazo de gracia y el cliente no renovó. Suspende la cuenta en <strong>${panel}</strong>.
        </p>
        <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin-top:8px;">
          <tr><td style="padding:6px 0;width:150px;color:#6b7088;">Pedido</td><td style="padding:6px 0;font-weight:700;">${escape(order.id)}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7088;">Dominio</td><td style="padding:6px 0;font-weight:700;">${escape(order.payload.hosting.domain)}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7088;">Plan</td><td style="padding:6px 0;">${escape(planLabel(order))} (${billingLabel(order)})</td></tr>
          <tr><td style="padding:6px 0;color:#6b7088;">Venció</td><td style="padding:6px 0;">${escape(endLabel)}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7088;">Panel</td><td style="padding:6px 0;">${panel}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7088;">Usuario</td><td style="padding:6px 0;">${escape(order.provisioning?.username ?? "—")}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7088;">Cliente</td><td style="padding:6px 0;">${escape(customer.name)}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7088;">Email</td><td style="padding:6px 0;"><a href="mailto:${escape(customer.email)}">${escape(customer.email)}</a></td></tr>
        </table>
        <p style="margin:16px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#3a3f59;">
          El cliente ya recibió el aviso de vencimiento y el de plazo de gracia. Antes de borrar nada, confirma que no haya pagado por otro medio.
        </p>
      </div>
    </td></tr>
  </table>
</body></html>`;

  const text = [
    `ACCIÓN: suspender ${order.payload.hosting.domain} — periodo vencido sin renovar.`,
    ``,
    `Pedido: ${order.id}`,
    `Plan: ${planLabel(order)} (${billingLabel(order)})`,
    `Venció: ${endLabel}`,
    `Panel: ${panel} · Usuario: ${order.provisioning?.username ?? "—"}`,
    `Cliente: ${customer.name} <${customer.email}>`,
    ``,
    `El cliente ya recibió los avisos. Confirma que no haya pagado por otro medio`,
    `antes de borrar nada.`,
  ].join("\n");

  const result = await sendMail({ to: ops.map((email) => ({ email })), subject, html, text });
  if (!result.ok) {
    console.error("[mail] suspension work order failed", { order: order.id, error: result.error });
  } else {
    console.log("[mail] suspension work order sent", { order: order.id, to: ops, id: result.id });
  }
  return result;
}

/** Receipt for a renewal payment — no credentials, the account already exists. */
export async function sendRenewalConfirmed(order: Order) {
  const to = customerRecipient(order);
  const endLabel = order.periodEnd ? longDate(order.periodEnd) : "—";
  const subject = `Renovación confirmada — ${order.payload.hosting.domain}`;

  const html = customerShell({
    subject,
    heading: "Renovación confirmada",
    headingColor: "#047857",
    body: `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;">Hola <strong>${escape(to.name)}</strong>,</p>
          <p style="margin:0 0 14px;font-size:15px;line-height:1.55;">Recibimos tu pago y tu servicio queda cubierto hasta el <strong>${escape(endLabel)}</strong>. No tienes que hacer nada más: tus credenciales, tu sitio y tus correos siguen igual.</p>
          ${serviceFacts(order)}
          <p style="margin:14px 0 0;font-size:13px;line-height:1.55;color:#6b7088;">Tu factura electrónica llegará por separado. Pedido <strong>${escape(order.id)}</strong>.</p>`,
  });

  const text = [
    `Hola ${to.name},`,
    ``,
    `Recibimos tu pago. Tu servicio para ${order.payload.hosting.domain} queda cubierto`,
    `hasta el ${endLabel}.`,
    ``,
    `Plan: ${planLabel(order)} · ${billingLabel(order)}`,
    `Tus credenciales no cambian.`,
    ``,
    `Tu factura electrónica llegará por separado.`,
    `Pedido: ${order.id}`,
    `Geniorama Hosting`,
  ].join("\n");

  const result = await sendMail({ to, subject, html, text });
  if (!result.ok) {
    console.error("[mail] renewal confirmation failed", { order: order.id, error: result.error });
  } else {
    console.log("[mail] renewal confirmation sent", { order: order.id, id: result.id });
  }
  return result;
}
