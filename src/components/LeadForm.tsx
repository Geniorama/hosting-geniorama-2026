"use client";

import Link from "next/link";
import { useState } from "react";
import type { AdvisorPlanPick } from "@/lib/advisor";
import type { ChatTurn } from "./AdvisorChat";

type LeadFormProps = {
  pick: AdvisorPlanPick;
  source: string;
  getConversation: () => ChatTurn[];
  getUtm: () => Record<string, string>;
  onSent?: () => void;
};

/**
 * Indicativos para armar el número en formato E.164 (+57300...), que es el que
 * necesita wa.me para escribirle después por WhatsApp.
 */
// Sin banderas emoji a propósito: Windows no las dibuja y muestra las dos letras
// del país en su lugar, así que el texto explícito se ve igual en todos lados.
const DIAL_CODES = [
  { code: "+57", label: "CO +57" },
  { code: "+1", label: "US +1" },
  { code: "+52", label: "MX +52" },
  { code: "+34", label: "ES +34" },
  { code: "+51", label: "PE +51" },
  { code: "+56", label: "CL +56" },
  { code: "+54", label: "AR +54" },
  { code: "+593", label: "EC +593" },
  { code: "+58", label: "VE +58" },
  { code: "+507", label: "PA +507" },
  { code: "+506", label: "CR +506" },
  { code: "+502", label: "GT +502" },
  { code: "+591", label: "BO +591" },
  { code: "+598", label: "UY +598" },
  { code: "+595", label: "PY +595" },
  { code: "+55", label: "BR +55" },
];

export function LeadForm({ pick, source, getConversation, getUtm, onSent }: LeadFormProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [dial, setDial] = useState("+57");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (sent) {
    return (
      <div className="lead-done" role="status">
        <strong>Listo, te lo enviamos a {email}.</strong>
        <span>
          Si prefieres avanzar ya, el botón de contratar sigue arriba. Cualquier duda, respóndenos
          ese correo.
        </span>
      </div>
    );
  }

  if (!open) {
    return (
      <button type="button" className="lead-teaser" onClick={() => setOpen(true)}>
        <span className="lead-teaser-icon" aria-hidden="true">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="5" width="18" height="14" rx="2.5" />
            <path d="m3.5 7 8.5 6 8.5-6" />
          </svg>
        </span>
        <span>
          <strong>¿Prefieres pensarlo?</strong> Te enviamos esta recomendación a tu correo.
        </span>
      </button>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (sending) return;

    // El número viaja en E.164: indicativo + dígitos, sin ceros ni separadores.
    const digits = phone.replace(/\D/g, "").replace(/^0+/, "");
    if (digits.length < 7 || digits.length > 14) {
      setError("Revisa tu número de celular: solo los dígitos, sin el indicativo.");
      return;
    }
    const e164 = `${dial}${digits}`;

    setError(null);
    setSending(true);

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          phone: e164,
          consent,
          planId: pick.planId,
          billing: pick.billing,
          source,
          conversation: getConversation(),
          utm: getUtm(),
        }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };

      if (!res.ok || !data.ok) {
        setError(data.error ?? "No pudimos guardar tus datos. Intenta de nuevo.");
        return;
      }

      setSent(true);
      onSent?.();
    } catch {
      setError("No pudimos conectar. Revisa tu conexión e intenta de nuevo.");
    } finally {
      setSending(false);
    }
  }

  return (
    <form className="lead-form" onSubmit={submit}>
      <p className="lead-form-title">
        Te enviamos el plan <strong>{pick.name}</strong> a tu correo
      </p>

      <div className="lead-fields">
        <input
          type="text"
          className="lead-input"
          placeholder="Tu nombre"
          value={name}
          maxLength={80}
          required
          onChange={(e) => setName(e.target.value)}
          aria-label="Tu nombre"
        />
        <input
          type="email"
          className="lead-input"
          placeholder="Tu correo"
          value={email}
          maxLength={160}
          required
          onChange={(e) => setEmail(e.target.value)}
          aria-label="Tu correo"
        />
        <div className="lead-phone">
          <select
            className="lead-dial"
            value={dial}
            onChange={(e) => setDial(e.target.value)}
            aria-label="Indicativo del país"
          >
            {DIAL_CODES.map((c) => (
              <option key={c.code + c.label} value={c.code}>
                {c.label}
              </option>
            ))}
          </select>
          <input
            type="tel"
            inputMode="numeric"
            className="lead-input"
            placeholder="Celular para WhatsApp"
            value={phone}
            maxLength={18}
            required
            onChange={(e) => setPhone(e.target.value)}
            aria-label="Número de celular para WhatsApp"
          />
        </div>
      </div>

      <label className="lead-consent">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          required
        />
        <span>
          Autorizo el tratamiento de mis datos para recibir esta recomendación y que me contacten
          por correo o WhatsApp.{" "}
          <Link href="/privacidad" target="_blank">
            Política de privacidad
          </Link>
          .
        </span>
      </label>

      {error && <p className="lead-error">{error}</p>}

      <div className="lead-actions">
        <button type="submit" className="btn btn-primary" disabled={sending || !consent}>
          {sending ? "Enviando…" : "Enviármelo"}
        </button>
        <button type="button" className="lead-cancel" onClick={() => setOpen(false)}>
          Ahora no
        </button>
      </div>
    </form>
  );
}
