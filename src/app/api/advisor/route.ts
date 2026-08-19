import { NextResponse } from "next/server";
import { AdvisorError, askAdvisor, type AdvisorMessage } from "@/lib/advisor";
import { clientKey, rateLimited } from "@/lib/rate-limit";

// El historial lo manda el cliente en cada turno: la conversación es anónima y no
// se persiste. Estos topes acotan el costo por request y el abuso del endpoint.
const MAX_MESSAGES = 16;
const MAX_CHARS = 600;

const RATE_WINDOW_MS = 10 * 60_000;
const RATE_LIMIT = 20;

function parseMessages(input: unknown): AdvisorMessage[] | null {
  if (!Array.isArray(input) || input.length === 0) return null;

  const messages: AdvisorMessage[] = [];
  for (const raw of input.slice(-MAX_MESSAGES)) {
    if (!raw || typeof raw !== "object") return null;
    const { role, content } = raw as { role?: unknown; content?: unknown };
    if (role !== "user" && role !== "assistant") return null;
    if (typeof content !== "string") return null;
    const text = content.trim().slice(0, MAX_CHARS);
    if (text) messages.push({ role, content: text });
  }

  if (messages.length === 0 || messages[messages.length - 1].role !== "user") return null;
  return messages;
}

export async function POST(req: Request) {
  if (rateLimited("advisor", clientKey(req), RATE_LIMIT, RATE_WINDOW_MS)) {
    return NextResponse.json(
      {
        ok: false,
        error: "Hiciste muchas consultas seguidas. Espera unos minutos o escríbenos a soporte.",
      },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Cuerpo inválido." }, { status: 400 });
  }

  const messages = parseMessages((body as { messages?: unknown })?.messages);
  if (!messages) {
    return NextResponse.json(
      { ok: false, error: "Envía un historial válido que termine en un mensaje del usuario." },
      { status: 400 },
    );
  }

  try {
    const advice = await askAdvisor(messages);
    return NextResponse.json({ ok: true, ...advice });
  } catch (err) {
    const status = err instanceof AdvisorError ? err.status : 502;
    console.error("[advisor]", err instanceof Error ? err.message : err);

    const error =
      status === 503
        ? "El asesor de IA todavía no está habilitado. Mientras tanto puedes revisar los planes o escribirnos."
        : "El asesor no pudo responder en este momento. Intenta de nuevo en un minuto.";

    return NextResponse.json({ ok: false, error }, { status });
  }
}
