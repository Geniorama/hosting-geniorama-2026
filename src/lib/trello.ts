import type { Order } from "./order-store";
import { plans } from "./plans";

export type TrelloCardResult =
  | { ok: true; id: string; url: string; shortUrl: string }
  | { ok: false; error: string };

function tryEnv(name: string): string | undefined {
  return process.env[name];
}

function planName(planId: string): string {
  const all = [...plans.web, ...plans.ads];
  return all.find((p) => p.id === planId)?.name ?? planId;
}

function planFamily(planId: string): "web" | "ads" {
  return plans.web.some((p) => p.id === planId) ? "web" : "ads";
}

function billingPeriodLabel(b: "monthly" | "annual"): string {
  return b === "annual" ? "1 año" : "1 mes";
}

function formatLongDate(d: Date): string {
  return d.toLocaleDateString("es-CO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatValue(n: number): string {
  return `$${n.toLocaleString("es-CO")}`;
}

function buildConceptLine(order: Order): string {
  const family = planFamily(order.payload.planId);
  const familyLabel = family === "web" ? "Hosting Plan" : "Plan Ads";
  const period = billingPeriodLabel(order.payload.billing);
  const until = formatLongDate(computeDueDate(order));
  return `${familyLabel} ${planName(order.payload.planId)} * ${period}, hasta ${until}. Ref: ${order.id}`;
}

function fullName(order: Order): string {
  return (
    order.payload.invoice.legalName ||
    `${order.payload.contact.firstName} ${order.payload.contact.lastName}`.trim() ||
    "Cliente Geniorama"
  );
}

function formatCOP(n: number): string {
  return `$${n.toLocaleString("es-CO")} COP`;
}

function billingLabel(b: "monthly" | "annual"): string {
  return b === "annual" ? "Anual" : "Mensual";
}

function buildCardName(order: Order): string {
  const name = fullName(order);
  const plan = planName(order.payload.planId);
  return `[${order.id}] ${name} — ${plan} ${billingLabel(order.payload.billing)}`;
}

function buildCardDescription(order: Order): string {
  const inv = order.payload.invoice;
  const dueDate = computeDueDate(order);

  const docNumber = inv.dv ? `${inv.docNumber}-${inv.dv}` : inv.docNumber;
  const fiscalLabel =
    inv.personType === "juridica"
      ? inv.fiscalResponsibility === "responsable"
        ? "Responsable de IVA"
        : "No responsable de IVA"
      : "Persona natural";

  return [
    `**Concepto:** ${buildConceptLine(order)}`,
    `**Valor:** ${formatValue(order.amount)}`,
    ``,
    `## 🧾 Datos de facturación`,
    ``,
    `**Razón social:** ${inv.legalName}`,
    `**Tipo de persona:** ${inv.personType === "juridica" ? "Jurídica" : "Natural"}`,
    `**Documento:** ${inv.docType} ${docNumber}`,
    `**Régimen fiscal:** ${fiscalLabel}`,
    `**Correo facturación:** ${inv.email}`,
    `**Teléfono facturación:** ${inv.phone}`,
    `**Dirección:** ${inv.address}`,
    `**Ciudad / Departamento:** ${inv.city}, ${inv.department}`,
    `**País:** ${inv.country}`,
    ``,
    `## 💼 Servicio`,
    ``,
    `**Plan:** ${planName(order.payload.planId)} (\`${order.payload.planId}\`)`,
    `**Modalidad:** ${billingLabel(order.payload.billing)}`,
    `**Dominio:** \`${order.payload.hosting.domain}\``,
    `**Monto pagado:** ${formatCOP(order.amount)}`,
    `**Periodo cubierto:** ${formatDate(new Date(order.updatedAt))} → ${formatDate(dueDate)}`,
    ``,
    `## 💳 Pago`,
    ``,
    `**Pasarela:** ${order.payload.paymentProvider === "wompi" ? "Wompi" : "PaymentsWay"}`,
    `**Referencia transacción:** ${order.paymentRef ?? "—"}`,
    `**Fecha de pago:** ${formatDate(new Date(order.updatedAt))}`,
    ``,
    `## 🧰 Aprovisionamiento`,
    ``,
    order.provisioning
      ? [
          `**Usuario cPanel:** \`${order.provisioning.username}\``,
          `**Paquete WHM:** ${order.provisioning.package}`,
          order.provisioning.ip ? `**IP servidor:** ${order.provisioning.ip}` : "",
        ]
          .filter(Boolean)
          .join("\n")
      : `_Aprovisionamiento manual pendiente_`,
    ``,
    order.ticketsSync
      ? [
          `## 🎫 App de tickets`,
          ``,
          `**User ID:** \`${order.ticketsSync.userId}\``,
          `**Company ID:** \`${order.ticketsSync.companyId}\``,
          `**Service ID:** \`${order.ticketsSync.serviceId}\``,
          `**Plan soporte ID:** \`${order.ticketsSync.planId}\``,
        ].join("\n")
      : "",
    ``,
    `## 📞 Contacto del cliente`,
    ``,
    `**Nombre:** ${order.payload.contact.firstName} ${order.payload.contact.lastName}`,
    `**Email:** ${order.payload.contact.email}`,
    `**Teléfono:** ${order.payload.contact.phone}`,
    order.payload.notes ? `\n**Notas:** ${order.payload.notes}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function computeDueDate(order: Order): Date {
  const days = order.payload.billing === "annual" ? 365 : 30;
  const d = new Date(order.updatedAt);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("es-CO", { year: "numeric", month: "2-digit", day: "2-digit" });
}

export async function createInvoiceCard(order: Order): Promise<TrelloCardResult> {
  const apiKey = tryEnv("TRELLO_API_KEY");
  const token = tryEnv("TRELLO_API_TOKEN");
  const listId = tryEnv("TRELLO_LIST_ID");

  if (!apiKey || !token || !listId) {
    return {
      ok: false,
      error: "Missing Trello env vars (TRELLO_API_KEY, TRELLO_API_TOKEN, TRELLO_LIST_ID)",
    };
  }

  const params = new URLSearchParams({
    key: apiKey,
    token,
    idList: listId,
    name: buildCardName(order),
    desc: buildCardDescription(order),
    pos: "top",
  });

  const envLabelIds = (tryEnv("TRELLO_LABEL_IDS") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const labelIds = Array.from(
    new Set([...envLabelIds, "620fafcc607b1e146abad211"]),
  );
  if (labelIds.length) params.set("idLabels", labelIds.join(","));

  const memberIds = (tryEnv("TRELLO_MEMBER_IDS") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (memberIds.length) params.set("idMembers", memberIds.join(","));

  // Set Trello due date = invoice deadline (3 business days from now is a reasonable default,
  // overrideable via env var if your accounting team has a different SLA).
  const dueDays = Number(tryEnv("TRELLO_INVOICE_DUE_DAYS") ?? "3");
  if (Number.isFinite(dueDays) && dueDays > 0) {
    const due = new Date();
    due.setUTCDate(due.getUTCDate() + dueDays);
    params.set("due", due.toISOString());
  }

  let res: Response;
  try {
    res = await fetch(`https://api.trello.com/1/cards?${params.toString()}`, {
      method: "POST",
      cache: "no-store",
    });
  } catch (err) {
    return { ok: false, error: `Trello unreachable: ${(err as Error).message}` };
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return { ok: false, error: `Trello HTTP ${res.status}: ${body.slice(0, 200)}` };
  }

  const json = (await res.json().catch(() => null)) as
    | { id: string; url: string; shortUrl: string }
    | null;

  if (!json) return { ok: false, error: "Trello returned non-JSON" };

  return { ok: true, id: json.id, url: json.url, shortUrl: json.shortUrl };
}
