import { plans, type Plan, type PlanCategory } from "./plans";
import { formatCOP } from "./format";

export type Billing = "monthly" | "annual";

export type AdvisorMessage = { role: "user" | "assistant"; content: string };

/**
 * Lo que el cliente pinta en pantalla. Los precios y las características SIEMPRE
 * salen de `plans.ts`, nunca del modelo: la IA solo elige un `id` del catálogo.
 */
export type AdvisorPlanPick = {
  planId: string;
  name: string;
  category: PlanCategory;
  categoryLabel: string;
  tagline: string;
  billing: Billing;
  monthly: number;
  annual: number;
  annualMonthly: number;
  highlights: string[];
  checkoutUrl: string;
  reason?: string;
};

export type AdvisorReply = {
  reply: string;
  quickReplies: string[];
  recommendation: AdvisorPlanPick | null;
  alternative: AdvisorPlanPick | null;
};

export class AdvisorError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.name = "AdvisorError";
    this.status = status;
  }
}

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-4.1-mini";
const REQUEST_TIMEOUT_MS = 25_000;

const CATALOG: { plan: Plan; category: PlanCategory }[] = (
  Object.keys(plans) as PlanCategory[]
).flatMap((category) => plans[category].map((plan) => ({ plan, category })));

const CATEGORY_LABEL: Record<PlanCategory, string> = {
  web: "Hosting Web",
  ads: "Hosting Ads",
};

export function isAdvisorConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

function featureLines(plan: Plan): string[] {
  return plan.features.map((f) => [f.strong, f.text].filter(Boolean).join(" ").trim());
}

function findPlan(id: unknown) {
  if (typeof id !== "string") return undefined;
  const needle = id.trim().toLowerCase();
  return CATALOG.find((entry) => entry.plan.id === needle);
}

function toPick(
  entry: { plan: Plan; category: PlanCategory },
  billing: Billing,
  reason?: string,
): AdvisorPlanPick {
  const { plan, category } = entry;
  return {
    planId: plan.id,
    name: plan.name,
    category,
    categoryLabel: CATEGORY_LABEL[category],
    tagline: plan.tagline,
    billing,
    monthly: plan.price.monthly,
    annual: plan.price.annual,
    annualMonthly: Math.round(plan.price.annual / 12),
    highlights: featureLines(plan),
    checkoutUrl: `/checkout?plan=${plan.id}&billing=${billing}`,
    reason: reason?.trim() || undefined,
  };
}

/**
 * Resuelve un id del catálogo a los datos que se pintan en pantalla o en el
 * correo. Devuelve null si el id no existe, así el llamador nunca confía en un
 * plan inventado.
 */
export function planPick(planId: unknown, billing: Billing = "annual"): AdvisorPlanPick | null {
  const entry = findPlan(planId);
  return entry ? toPick(entry, billing) : null;
}

/** El catálogo se serializa desde `plans.ts` para que nunca se desactualice. */
function catalogPrompt(): string {
  return CATALOG.map(({ plan, category }) => {
    const anual = formatCOP(plan.price.annual);
    const equivalente = formatCOP(Math.round(plan.price.annual / 12));
    return [
      `- id: ${plan.id}`,
      `familia: ${CATEGORY_LABEL[category]}`,
      `nombre: ${plan.name}`,
      `mensual: ${formatCOP(plan.price.monthly)}/mes`,
      `anual: ${anual}/año (equivale a ${equivalente}/mes, 20% menos)`,
      `pensado para: ${plan.tagline}`,
      `incluye: ${featureLines(plan).join("; ")}`,
    ].join(" | ");
  }).join("\n");
}

function systemPrompt(): string {
  return `Eres "Genio", el asesor de hosting de Geniorama (Colombia). Tu único trabajo es
entender el proyecto de quien escribe y recomendarle UNO de los planes del catálogo.

CATÁLOGO (única fuente de verdad; los ids son literales):
${catalogPrompt()}

CÓMO HABLAS
- Español de Colombia, cercano y directo, frases cortas. Máximo 70 palabras por respuesta.
- SIEMPRE le hablas de tú a UNA sola persona: la que escribe. Sin excepciones, ni por
  formalidad ni por cortesía.
- Da igual que se presente en plural ("somos una agencia", "tenemos un portal", "manejamos
  varias landings") o que te trate de usted: TODO verbo dirigido a quien escribe va en
  segunda persona del SINGULAR —tienes, esperas, manejas, necesitas, vendes, puedes— y
  nunca en plural —tienen, esperan, manejan, necesitan, venden, pueden—.
- Los posesivos igual: "tu sitio", "tu portal", "tus clientes". Nunca "su sitio", "su
  empresa" ni "sus landings". Y "te recomiendo", nunca "les recomiendo".
- Ejemplos:
  "somos una constructora y necesitamos hosting" → "¿cuánto tráfico esperas en tu sitio?"
  (nunca "¿cuánto tráfico esperan en su sitio?").
  "manejamos varias landings de pauta" → "¿qué tráfico manejas en esas landings?"
  (nunca "¿qué tráfico manejan en esas landings?").
- Esto aplica igual a reply, a reason y a las opciones de quickReplies.

QUÉ NECESITAS AVERIGUAR, en este orden
1. Tipo de proyecto: sitio institucional, blog, portal de noticias, tienda o landing de pauta.
2. Tráfico esperado. Es lo que más pesa al elegir el plan y casi nadie lo menciona solo, así
   que pregúntalo. Sirve cualquier referencia: visitas al mes, "apenas arranco", "pauto todos
   los días", "hoy recibo poco pero voy a invertir en publicidad".
3. Volumen del contenido: cuántos productos, artículos, fotos o video.
4. Cuántas cuentas de correo con el dominio necesita.

CÓMO PREGUNTAS
- Una sola pregunta por turno, y máximo dos turnos de preguntas antes de recomendar.
- Si todavía no sabes el tráfico, esa es la pregunta que haces. No recomiendes en silencio
  algo que depende de un dato que nunca pediste.
- Si la persona no sabe el tráfico, dice que no importa o cambia de tema, NO lo dejes colgado:
  recomienda igual, di en una frase el supuesto con el que trabajaste (por ejemplo "asumo un
  arranque tranquilo" o "asumo pauta constante") e invítala a corregirte si va por otro lado.
- Nunca repitas una pregunta que ya te respondieron ni preguntes dos datos a la vez.

CÓMO RECOMIENDAS
- Al recomendar, llena planId y explica en reason por qué ese plan le sirve, aterrizado a lo
  que contó (almacenamiento, ancho de banda, correos, bases de datos).
- Deja explícito en reason el supuesto que usaste cuando falte un dato, y menciona que puede
  subir de plan en cualquier momento si el proyecto crece más rápido de lo previsto.
- alternativePlanId solo si de verdad hay una segunda opción sensata (normalmente el plan
  inmediatamente superior o el de la otra familia). Si no, déjalo en null.
- Hosting Web = sitios, blogs, portales y tiendas (prioriza almacenamiento).
  Hosting Ads = landings que reciben tráfico pagado alto y constante (prioriza ancho de banda).
- Sugiere el plan anual salvo que la persona diga que quiere probar sin compromiso.

REGLAS DURAS
- Nunca inventes planes, precios, límites ni descuentos: solo lo que está en el catálogo.
  No repitas cifras de precio en reply; la tarjeta del plan ya las muestra.
- Nunca des por hecho con qué tecnología está hecho el proyecto. No nombres WordPress, Joomla,
  PrestaShop, Shopify ni ningún CMS, framework o lenguaje a menos que la persona lo haya
  mencionado antes; si te cambia la recomendación, pregúntale con qué lo va a montar. La lista
  de instaladores del catálogo dice lo que el plan SOPORTA, no lo que esa persona usa.
- Tampoco supongas que ya tiene un sitio hecho, un dominio comprado o que viene migrando de
  otro proveedor: pregúntalo si importa.
- Nunca prometas condiciones distintas a estos datos de apoyo: el dominio se cotiza aparte,
  la migración desde otro proveedor es gratis, el servicio está exento de IVA, hay soporte
  24/7 con tickets, el panel es cPanel, y se puede cambiar de plan en cualquier
  momento pagando la diferencia proporcional.
- Si preguntan algo fuera de hosting, dilo en una frase y regresa a la asesoría.
- Si piden algo que ningún plan cubre (por ejemplo VPS, servidor dedicado o requisitos que
  superan al plan Mega), sé honesto, deja planId en null e invítalos a escribir a soporte.

FORMATO
Devuelves JSON con: reply (tu mensaje), planId, alternativePlanId, billing ("monthly" o
"annual"), reason (por qué ese plan; null si aún no recomiendas) y quickReplies: hasta 3
frases que diría EL VISITANTE, siempre en primera persona ("necesito…", "prefiero…", "¿me
sirve…?"), nunca preguntas tuyas hacia él. Deben contestar LA pregunta que acabas de hacer, no otra
(si preguntaste por tráfico: "Apenas estoy arrancando", "Unas 5.000 visitas al mes", "No lo sé
todavía"). Cuando preguntes algo que la persona podría no saber, una de las opciones tiene que
ser justamente esa salida ("No lo sé todavía"), para que nadie se quede atascado. Si ya
recomendaste, quickReplies puede traer dudas de cierre; si no aplica, devuelve lista vacía.`;
}

const RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    reply: { type: "string" },
    planId: { type: ["string", "null"] },
    alternativePlanId: { type: ["string", "null"] },
    billing: { type: ["string", "null"], enum: ["monthly", "annual", null] },
    reason: { type: ["string", "null"] },
    quickReplies: { type: "array", items: { type: "string" } },
  },
  required: ["reply", "planId", "alternativePlanId", "billing", "reason", "quickReplies"],
} as const;

type RawAdvice = {
  reply?: unknown;
  planId?: unknown;
  alternativePlanId?: unknown;
  billing?: unknown;
  reason?: unknown;
  quickReplies?: unknown;
};

// Los modelos de razonamiento (gpt-5*, o1/o3/o4) rechazan `temperature`.
function supportsTemperature(model: string): boolean {
  return !/^(gpt-5|o\d)/i.test(model);
}

export async function askAdvisor(messages: AdvisorMessage[]): Promise<AdvisorReply> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new AdvisorError("El asesor de IA no está configurado (falta OPENAI_API_KEY).", 503);
  }

  const model = process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL;

  const body: Record<string, unknown> = {
    model,
    max_completion_tokens: 600,
    messages: [{ role: "system", content: systemPrompt() }, ...messages],
    response_format: {
      type: "json_schema",
      json_schema: { name: "asesoria_hosting", strict: true, schema: RESPONSE_SCHEMA },
    },
  };
  if (supportsTemperature(model)) body.temperature = 0.4;

  let res: Response;
  try {
    res = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new AdvisorError(`No se pudo contactar a OpenAI: ${reason}`, 504);
  }

  if (!res.ok) {
    const detail = (await res.text()).slice(0, 400);
    throw new AdvisorError(
      `OpenAI respondió ${res.status}: ${detail}`,
      res.status === 429 ? 429 : 502,
    );
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string | null; refusal?: string | null } }[];
  };
  const message = data.choices?.[0]?.message;

  if (message?.refusal) {
    return {
      reply: "Prefiero no responder eso. Cuéntame de tu proyecto y te ayudo a elegir el plan.",
      quickReplies: [],
      recommendation: null,
      alternative: null,
    };
  }

  const content = message?.content;
  if (!content) throw new AdvisorError("OpenAI devolvió una respuesta vacía.");

  let parsed: RawAdvice;
  try {
    parsed = JSON.parse(content) as RawAdvice;
  } catch {
    throw new AdvisorError("OpenAI devolvió un JSON inválido.");
  }

  const reply = typeof parsed.reply === "string" ? parsed.reply.trim() : "";
  if (!reply) throw new AdvisorError("OpenAI devolvió una respuesta sin texto.");

  const billing: Billing = parsed.billing === "monthly" ? "monthly" : "annual";
  const reason = typeof parsed.reason === "string" ? parsed.reason : undefined;

  const picked = findPlan(parsed.planId);
  const recommendation = picked ? toPick(picked, billing, reason) : null;

  const alt = findPlan(parsed.alternativePlanId);
  const alternative =
    alt && recommendation && alt.plan.id !== recommendation.planId ? toPick(alt, billing) : null;

  const quickReplies = Array.isArray(parsed.quickReplies)
    ? parsed.quickReplies
        .filter((q): q is string => typeof q === "string")
        .map((q) => q.trim())
        .filter((q) => q.length > 0 && q.length <= 60)
        .slice(0, 3)
    : [];

  return { reply, quickReplies, recommendation, alternative };
}
