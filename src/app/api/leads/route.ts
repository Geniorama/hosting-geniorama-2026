import { NextResponse } from "next/server";
import { planPick, type Billing } from "@/lib/advisor";
import { saveLead, type LeadConversationTurn } from "@/lib/lead-store";
import { sendLeadAlert, sendLeadRecommendation } from "@/lib/mail-leads";
import { clientKey, rateLimited } from "@/lib/rate-limit";

const RATE_WINDOW_MS = 10 * 60_000;
const RATE_LIMIT = 5;

const MAX_NAME = 80;
const MAX_EMAIL = 160;
const MAX_PHONE = 32;
const MAX_TURNS = 20;
const MAX_TURN_CHARS = 600;
const MAX_UTM_KEYS = 12;

// Suficiente para descartar erratas evidentes sin rechazar direcciones válidas.
const EMAIL_RE = /^[^\s@]+@[^\s@.]+\.[^\s@]{2,}$/;

// E.164: "+" seguido de indicativo y número, sin separadores. Es el formato que
// consume wa.me para escribirle al lead por WhatsApp.
const E164_RE = /^\+[1-9]\d{7,14}$/;

/** Deja el número en E.164 aunque llegue con espacios, guiones o paréntesis. */
function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "").replace(/^0+/, "");
  return digits ? `+${digits}` : "";
}

const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "fbclid",
  "referrer",
];

function str(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function parseConversation(input: unknown): LeadConversationTurn[] | undefined {
  if (!Array.isArray(input)) return undefined;
  const turns: LeadConversationTurn[] = [];
  for (const raw of input.slice(-MAX_TURNS)) {
    if (!raw || typeof raw !== "object") continue;
    const { role, content } = raw as { role?: unknown; content?: unknown };
    if (role !== "user" && role !== "assistant") continue;
    const text = str(content, MAX_TURN_CHARS);
    if (text) turns.push({ role, content: text });
  }
  return turns.length ? turns : undefined;
}

function parseUtm(input: unknown): Record<string, string> | undefined {
  if (!input || typeof input !== "object") return undefined;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (!UTM_KEYS.includes(key)) continue;
    const text = str(value, 200);
    if (text) out[key] = text;
    if (Object.keys(out).length >= MAX_UTM_KEYS) break;
  }
  return Object.keys(out).length ? out : undefined;
}

export async function POST(req: Request) {
  if (rateLimited("leads", clientKey(req), RATE_LIMIT, RATE_WINDOW_MS)) {
    return NextResponse.json(
      { ok: false, error: "Ya registramos tus datos. Te contactamos muy pronto." },
      { status: 429 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Cuerpo inválido." }, { status: 400 });
  }

  const name = str(body.name, MAX_NAME);
  const email = str(body.email, MAX_EMAIL).toLowerCase();
  const phone = normalizePhone(str(body.phone, MAX_PHONE));

  if (name.length < 2) {
    return NextResponse.json({ ok: false, error: "Escribe tu nombre." }, { status: 400 });
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ ok: false, error: "Revisa tu correo." }, { status: 400 });
  }
  if (!E164_RE.test(phone)) {
    return NextResponse.json(
      { ok: false, error: "Revisa tu celular: indicativo del país más el número." },
      { status: 400 },
    );
  }
  if (body.consent !== true) {
    return NextResponse.json(
      { ok: false, error: "Necesitamos tu autorización para tratar tus datos." },
      { status: 400 },
    );
  }

  const billing: Billing = body.billing === "monthly" ? "monthly" : "annual";
  // El plan se resuelve contra el catálogo: si el cliente manda un id inventado,
  // el lead se guarda igual pero sin plan.
  const pick = planPick(body.planId, billing);
  const source = str(body.source, 40) || "asesor-landing";
  const conversation = parseConversation(body.conversation);
  const utm = parseUtm(body.utm);

  const saved = await saveLead({
    name,
    email,
    phone,
    planId: pick?.planId,
    billing: pick ? billing : undefined,
    source,
    conversation,
    utm,
  });

  if (!saved.ok) {
    // La tabla puede no existir todavía (falta correr 0011_leads.sql). No perdemos
    // el lead: sigue saliendo el aviso por correo.
    console.error("[leads] no se pudo guardar en Supabase:", saved.error);
  }

  const lead = {
    id: saved.ok ? saved.id : undefined,
    name,
    email,
    phone,
    pick,
    source,
    conversation,
    utm,
  };

  const [alert, recommendation] = await Promise.allSettled([
    sendLeadAlert(lead),
    pick ? sendLeadRecommendation(lead) : Promise.resolve({ ok: false as const, error: "sin plan" }),
  ]);

  const alertSent = alert.status === "fulfilled" && alert.value.ok;
  const mailSent = recommendation.status === "fulfilled" && recommendation.value.ok;

  if (!saved.ok && !alertSent) {
    return NextResponse.json(
      {
        ok: false,
        error: "No pudimos registrar tus datos. Escríbenos a soporte@geniorama.co y te ayudamos.",
      },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, emailed: mailSent });
}
