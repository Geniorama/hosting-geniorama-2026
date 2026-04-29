"use client";

import { useState, useTransition } from "react";
import {
  type CheckoutPayload,
  type DocType,
  type PersonType,
  departments,
  docTypeOptions,
} from "@/lib/checkout";
import { submitCheckout } from "@/app/checkout/actions";
import type { PaymentsWayFormFields } from "@/lib/paymentsway";

type CheckoutFormProps = {
  planId: string;
  billing: "monthly" | "annual";
};

const initialState = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  personType: "natural" as PersonType,
  docType: "CC" as DocType,
  docNumber: "",
  dv: "",
  legalName: "",
  fiscalResponsibility: "no-responsable" as "responsable" | "no-responsable",
  address: "",
  city: "",
  department: "",
  country: "Colombia",
  notes: "",
};

export function CheckoutForm({ planId, billing }: CheckoutFormProps) {
  const [form, setForm] = useState(initialState);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [redirecting, setRedirecting] = useState<{ orderId: string } | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => {
      if (!e[key as string]) return e;
      const next = { ...e };
      delete next[key as string];
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: CheckoutPayload = {
      planId,
      billing,
      contact: {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone,
      },
      invoice: {
        personType: form.personType,
        docType: form.docType,
        docNumber: form.docNumber,
        dv: form.docType === "NIT" ? form.dv : undefined,
        legalName: form.legalName,
        fiscalResponsibility: form.fiscalResponsibility,
        address: form.address,
        city: form.city,
        department: form.department,
        country: form.country,
      },
      notes: form.notes || undefined,
    };

    startTransition(async () => {
      setSubmitError(null);
      const result = await submitCheckout(payload);
      if (result.ok) {
        setErrors({});
        setRedirecting({ orderId: result.orderId });
        submitToPaymentsWay(result.payment.url, result.payment.fields);
      } else {
        if (result.fieldErrors) {
          setErrors(
            Object.fromEntries(
              Object.entries(result.fieldErrors).map(([k, v]) => [k.split(".").pop()!, v]),
            ),
          );
        }
        if (result.error) setSubmitError(result.error);
      }
    });
  };

  if (redirecting) {
    return (
      <div className="checkout-success">
        <div className="checkout-success-icon">
          <svg
            className="checkout-spinner"
            width="36"
            height="36"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 12a9 9 0 1 1-6.22-8.56" />
          </svg>
        </div>
        <h2 className="section-title" style={{ fontSize: "2rem" }}>
          Te llevamos al pago seguro
        </h2>
        <p className="text-muted" style={{ marginTop: "0.5rem" }}>
          Pedido <strong className="text-pink">{redirecting.orderId}</strong> creado. Si la
          redirección no inicia automáticamente, recarga la página.
        </p>
      </div>
    );
  }

  return (
    <form className="checkout-form" onSubmit={handleSubmit} noValidate>
      {/* ── DATOS DE CONTACTO ── */}
      <section className="form-section">
        <h2 className="form-section-title">
          <span className="form-section-step">1</span>
          Datos de contacto
        </h2>

        <div className="form-grid form-grid--2">
          <Field label="Nombres" error={errors.firstName} required>
            <input
              type="text"
              className={`field-input${errors.firstName ? " is-error" : ""}`}
              value={form.firstName}
              onChange={(e) => set("firstName", e.target.value)}
              placeholder="Juan"
              autoComplete="given-name"
              required
            />
          </Field>

          <Field label="Apellidos" error={errors.lastName} required>
            <input
              type="text"
              className={`field-input${errors.lastName ? " is-error" : ""}`}
              value={form.lastName}
              onChange={(e) => set("lastName", e.target.value)}
              placeholder="Pérez"
              autoComplete="family-name"
              required
            />
          </Field>

          <Field label="Correo electrónico" error={errors.email} required>
            <input
              type="email"
              className={`field-input${errors.email ? " is-error" : ""}`}
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="juan@empresa.com"
              autoComplete="email"
              required
            />
          </Field>

          <Field label="Teléfono / WhatsApp" error={errors.phone} required>
            <input
              type="tel"
              className={`field-input${errors.phone ? " is-error" : ""}`}
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              placeholder="+57 300 000 0000"
              autoComplete="tel"
              required
            />
          </Field>
        </div>
      </section>

      {/* ── DATOS DE FACTURACIÓN ── */}
      <section className="form-section">
        <h2 className="form-section-title">
          <span className="form-section-step">2</span>
          Datos de facturación
        </h2>

        <div className="form-row">
          <span className="field-label">Tipo de persona</span>
          <div className="toggle-group">
            <PillButton
              active={form.personType === "natural"}
              onClick={() => set("personType", "natural")}
            >
              Persona natural
            </PillButton>
            <PillButton
              active={form.personType === "juridica"}
              onClick={() => set("personType", "juridica")}
            >
              Persona jurídica
            </PillButton>
          </div>
        </div>

        <div className={`form-grid ${form.docType === "NIT" ? "form-grid--3" : "form-grid--2"}`}>
          <Field label="Tipo de documento" required>
            <select
              className="field-select w-full"
              value={form.docType}
              onChange={(e) => set("docType", e.target.value as DocType)}
              required
            >
              {docTypeOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label={form.docType === "NIT" ? "Número de NIT" : "Número de documento"}
            error={errors.docNumber}
            required
          >
            <input
              type="text"
              inputMode="numeric"
              className={`field-input${errors.docNumber ? " is-error" : ""}`}
              value={form.docNumber}
              onChange={(e) => set("docNumber", e.target.value)}
              placeholder="900.123.456"
              required
            />
          </Field>

          {form.docType === "NIT" && (
            <Field label="DV" error={errors.dv} required>
              <input
                type="text"
                inputMode="numeric"
                maxLength={1}
                className={`field-input${errors.dv ? " is-error" : ""}`}
                value={form.dv}
                onChange={(e) => set("dv", e.target.value)}
                placeholder="0"
                required
              />
            </Field>
          )}
        </div>

        <Field
          label={form.personType === "juridica" ? "Razón social" : "Nombre completo"}
          error={errors.legalName}
          required
        >
          <input
            type="text"
            className={`field-input${errors.legalName ? " is-error" : ""}`}
            value={form.legalName}
            onChange={(e) => set("legalName", e.target.value)}
            placeholder={form.personType === "juridica" ? "Geniorama SAS" : "Juan Pérez Pérez"}
            required
          />
        </Field>

        {form.personType === "juridica" && (
          <div className="form-row">
            <span className="field-label">Responsabilidad fiscal</span>
            <div className="toggle-group">
              <PillButton
                active={form.fiscalResponsibility === "responsable"}
                onClick={() => set("fiscalResponsibility", "responsable")}
              >
                Responsable de IVA
              </PillButton>
              <PillButton
                active={form.fiscalResponsibility === "no-responsable"}
                onClick={() => set("fiscalResponsibility", "no-responsable")}
              >
                No responsable de IVA
              </PillButton>
            </div>
          </div>
        )}

        <Field label="Dirección" error={errors.address} required>
          <input
            type="text"
            className={`field-input${errors.address ? " is-error" : ""}`}
            value={form.address}
            onChange={(e) => set("address", e.target.value)}
            placeholder="Cra. 7 # 10-20, Of. 301"
            autoComplete="street-address"
            required
          />
        </Field>

        <div className="form-grid form-grid--3">
          <Field label="País">
            <input
              type="text"
              className="field-input text-muted"
              value={form.country}
              onChange={(e) => set("country", e.target.value)}
              autoComplete="country-name"
              readOnly
            />
          </Field>
          <Field label="Departamento" error={errors.department} required>
            <select
              className={`field-select${errors.department ? " is-error" : ""}`}
              value={form.department}
              onChange={(e) => set("department", e.target.value)}
              required
            >
              <option value="">Selecciona…</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Ciudad" error={errors.city} required>
            <input
              type="text"
              className={`field-input${errors.city ? " is-error" : ""}`}
              value={form.city}
              onChange={(e) => set("city", e.target.value)}
              placeholder="Bogotá"
              autoComplete="address-level2"
              required
            />
          </Field>
        </div>
      </section>

      {/* ── NOTAS ── */}
      <section className="form-section">
        <h2 className="form-section-title">
          <span className="form-section-step">3</span>
          Notas (opcional)
        </h2>
        <Field label="¿Algo que debamos saber?">
          <textarea
            className="field-textarea"
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            placeholder="Migración desde otro proveedor, dominio existente, etc."
            rows={3}
          />
        </Field>
      </section>

      {submitError && (
        <div className="checkout-form-error" role="alert">
          {submitError}
        </div>
      )}

      <div className="checkout-form-footer">
        <p className="text-muted" style={{ fontSize: "0.82rem", margin: 0 }}>
          Al continuar aceptas nuestros{" "}
          <a href="#" className="text-pink">
            términos
          </a>{" "}
          y{" "}
          <a href="#" className="text-pink">
            política de privacidad
          </a>
          .
        </p>
        <button
          type="submit"
          className="btn btn-primary btn-lg checkout-submit"
          disabled={pending}
        >
          {pending ? "Enviando…" : "Continuar al pago"}
          {!pending && (
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          )}
        </button>
      </div>
    </form>
  );
}

/* ── helpers ── */

function Field({
  label,
  error,
  required,
  children,
}: {
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="form-group">
      <span className="field-label">
        {label}
        {required && <span className="text-pink"> *</span>}
      </span>
      {children}
      {error && <span className="error-msg">{error}</span>}
    </label>
  );
}

function PillButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={`toggle-pill${active ? " is-selected" : ""}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function submitToPaymentsWay(url: string, fields: PaymentsWayFormFields) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = url;
  form.style.display = "none";

  for (const [name, value] of Object.entries(fields)) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = String(value);
    form.appendChild(input);
  }

  document.body.appendChild(form);
  form.submit();
}
