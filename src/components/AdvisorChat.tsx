"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { categoryStore } from "@/lib/category-store";
import { formatCOP } from "@/lib/format";
import type { AdvisorPlanPick } from "@/lib/advisor";
import { LeadForm } from "./LeadForm";

export type ChatTurn = { role: "user" | "assistant"; content: string };

type ChatEntry = ChatTurn & {
  id: number;
  recommendation?: AdvisorPlanPick | null;
  alternative?: AdvisorPlanPick | null;
};

type AdvisorApiResponse = {
  ok: boolean;
  reply?: string;
  quickReplies?: string[];
  recommendation?: AdvisorPlanPick | null;
  alternative?: AdvisorPlanPick | null;
  error?: string;
};

type AdvisorChatProps = {
  /** Queda registrado en el lead: "asesor-home" | "asesor-landing". */
  source: string;
  /** Muestra el formulario de captura cuando ya hay un plan recomendado. */
  leadCapture?: boolean;
  /** A dónde apunta "Ver la comparativa" (la landing no tiene sección de planes). */
  comparePath?: string;
  /**
   * Pasos que se muestran dentro del panel mientras nadie ha escrito. Llenan el
   * espacio vacío del hilo con algo útil; se van al primer mensaje. El home no
   * los pasa porque ya los tiene en la columna de al lado.
   */
  hints?: string[];
};

const GREETING = "Cuéntame qué vas a montar y te digo con cuál plan arrancar.";

const STARTERS = ["Una tienda online", "La página de mi empresa", "Una landing para pauta"];

let entryId = 0;
const nextId = () => ++entryId;

/** Evento para GTM/Analytics. No hace nada si no hay dataLayer en la página. */
function track(event: string, payload: Record<string, unknown> = {}) {
  const w = window as unknown as { dataLayer?: Record<string, unknown>[] };
  w.dataLayer?.push({ event, ...payload });
}

export function AdvisorChat({
  source,
  leadCapture = false,
  comparePath = "#planes",
  hints,
}: AdvisorChatProps) {
  const [entries, setEntries] = useState<ChatEntry[]>([
    { id: nextId(), role: "assistant", content: GREETING },
  ]);
  const [chips, setChips] = useState<string[]>(STARTERS);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const logRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const startedRef = useRef(false);
  const utmRef = useRef<Record<string, string>>({});

  useEffect(() => {
    // Origen de la visita, para medir qué campaña trae compradores.
    const params = new URLSearchParams(window.location.search);
    const utm: Record<string, string> = {};
    for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid"]) {
      const value = params.get(key);
      if (value) utm[key] = value;
    }
    if (document.referrer) utm.referrer = document.referrer;
    utmRef.current = utm;
  }, []);

  useEffect(() => {
    const log = logRef.current;
    if (!log || !startedRef.current) return;
    // Solo autoscroll dentro del panel: nunca movemos la página del visitante.
    log.scrollTo({ top: log.scrollHeight, behavior: "smooth" });
  }, [entries, loading]);

  const lastPick = useMemo(() => {
    for (let i = entries.length - 1; i >= 0; i--) {
      if (entries[i].recommendation) return entries[i].recommendation ?? null;
    }
    return null;
  }, [entries]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || loading) return;

    startedRef.current = true;
    setError(null);
    setChips([]);
    setDraft("");

    const history: ChatTurn[] = [
      ...entries.map((e) => ({ role: e.role, content: e.content })),
      { role: "user", content: message },
    ];

    setEntries((prev) => [...prev, { id: nextId(), role: "user", content: message }]);
    setLoading(true);

    try {
      const res = await fetch("/api/advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // El saludo inicial es local; el modelo no necesita verlo.
        body: JSON.stringify({ messages: history.slice(1) }),
      });
      const data = (await res.json()) as AdvisorApiResponse;

      if (!res.ok || !data.ok || !data.reply) {
        setError(data.error ?? "El asesor no pudo responder. Intenta de nuevo.");
        return;
      }

      setEntries((prev) => [
        ...prev,
        {
          id: nextId(),
          role: "assistant",
          content: data.reply as string,
          recommendation: data.recommendation ?? null,
          alternative: data.alternative ?? null,
        },
      ]);
      setChips(data.quickReplies ?? []);

      if (data.recommendation) {
        track("advisor_recommendation", {
          plan_id: data.recommendation.planId,
          billing: data.recommendation.billing,
          source,
        });
      }
    } catch {
      setError("No pudimos conectar con el asesor. Revisa tu conexión e intenta de nuevo.");
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  return (
    <div className="advisor-panel">
      <div className="advisor-panel-head">
        <span className="advisor-avatar" aria-hidden="true">
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3.5" y="8" width="17" height="12.5" rx="3.5" />
            <path d="M12 3v5M8.5 13v1.5M15.5 13v1.5M1.5 12.5v3M22.5 12.5v3" />
          </svg>
        </span>
        <div className="advisor-panel-id">
          <strong>Asesor de hosting</strong>
          <span>Respuestas generadas con IA</span>
        </div>
      </div>

      <div className="advisor-log" ref={logRef} aria-live="polite">
        {/* El envoltorio con margin-top:auto pega el hilo al fondo del panel: con
            pocos mensajes el vacío queda arriba y no entre el saludo y el campo. */}
        {hints && hints.length > 0 && entries.length === 1 && (
          <ol className="advisor-hints">
            {hints.map((hint, i) => (
              <li key={i}>
                <span className="advisor-hint-num">{i + 1}</span>
                {hint}
              </li>
            ))}
          </ol>
        )}

        <div className="advisor-log-inner">
          {entries.map((entry) => (
            <Fragment key={entry.id}>
              <div className={`advisor-msg advisor-msg--${entry.role}`}>{entry.content}</div>
              {entry.recommendation && (
                <RecommendationCard pick={entry.recommendation} comparePath={comparePath} />
              )}
              {entry.alternative && <AlternativeRow pick={entry.alternative} />}
            </Fragment>
          ))}

          {loading && (
            <div
              className="advisor-msg advisor-msg--assistant advisor-typing"
              aria-label="Escribiendo"
            >
              <span />
              <span />
              <span />
            </div>
          )}
        </div>
      </div>

      <div className="advisor-foot">
        {error && <p className="advisor-error">{error}</p>}

        {leadCapture && lastPick && (
          <LeadForm
            pick={lastPick}
            source={source}
            getConversation={() => entries.map(({ role, content }) => ({ role, content }))}
            getUtm={() => utmRef.current}
            onSent={() => track("advisor_lead", { plan_id: lastPick.planId, source })}
          />
        )}

        {chips.length > 0 && !loading && (
          <div className="advisor-chips">
            {chips.map((chip) => (
              <button key={chip} type="button" className="advisor-chip" onClick={() => send(chip)}>
                {chip}
              </button>
            ))}
          </div>
        )}

        <form
          className="advisor-form"
          onSubmit={(e) => {
            e.preventDefault();
            send(draft);
          }}
        >
          <input
            ref={inputRef}
            type="text"
            className="advisor-input"
            placeholder="Ej: tienda con 500 productos y pauta en Meta"
            value={draft}
            maxLength={600}
            onChange={(e) => setDraft(e.target.value)}
            disabled={loading}
            aria-label="Cuéntanos sobre tu proyecto"
          />
          <button
            type="submit"
            className="advisor-send"
            disabled={loading || draft.trim().length === 0}
            aria-label="Enviar"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}

function RecommendationCard({
  pick,
  comparePath,
}: {
  pick: AdvisorPlanPick;
  comparePath: string;
}) {
  const isAnnual = pick.billing === "annual";
  const price = isAnnual ? pick.annualMonthly : pick.monthly;

  return (
    <article className="advisor-rec">
      <span className="advisor-rec-tag">Plan recomendado</span>

      <div className="advisor-rec-top">
        <div>
          <h3 className="advisor-rec-name">{pick.name}</h3>
          <span className="advisor-rec-family">{pick.categoryLabel}</span>
        </div>
        <div className="advisor-rec-price">
          <strong>{formatCOP(price)}</strong>
          <span>/ mes</span>
          <em>{isAnnual ? `pago anual ${formatCOP(pick.annual)}` : "sin permanencia"}</em>
        </div>
      </div>

      {pick.reason && <p className="advisor-rec-reason">{pick.reason}</p>}

      <ul className="advisor-rec-features">
        {pick.highlights.slice(0, 3).map((h, i) => (
          <li key={i}>{h}</li>
        ))}
      </ul>

      <div className="advisor-rec-actions">
        <Link href={pick.checkoutUrl} className="btn btn-primary">
          Contratar {pick.name}
        </Link>
        <Link
          href={comparePath}
          className="advisor-rec-link"
          onClick={() => categoryStore.set(pick.category)}
        >
          Ver la comparativa
        </Link>
      </div>
    </article>
  );
}

function AlternativeRow({ pick }: { pick: AdvisorPlanPick }) {
  const price = pick.billing === "annual" ? pick.annualMonthly : pick.monthly;

  return (
    <Link href={pick.checkoutUrl} className="advisor-alt">
      <span className="advisor-alt-label">Si prefieres más margen</span>
      <span className="advisor-alt-name">{pick.name}</span>
      <span className="advisor-alt-price">{formatCOP(price)} / mes</span>
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M5 12h14M12 5l7 7-7 7" />
      </svg>
    </Link>
  );
}
