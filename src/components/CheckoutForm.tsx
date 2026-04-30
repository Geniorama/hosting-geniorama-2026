"use client";

import { useState, useTransition } from "react";
import {
  type CheckoutPayload,
  type DocType,
  type PaymentProvider,
  type PersonType,
  departments,
  docTypeOptions,
} from "@/lib/checkout";
import { submitCheckout } from "@/app/checkout/actions";

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
  billingEmail: "",
  billingPhone: "",
  fiscalResponsibility: "no-responsable" as "responsable" | "no-responsable",
  address: "",
  city: "",
  department: "",
  country: "Colombia",
  paymentProvider: "wompi" as PaymentProvider,
  domain: "",
  notes: "",
};

export function CheckoutForm({ planId, billing }: CheckoutFormProps) {
  const [form, setForm] = useState(initialState);
  const [sameAsContact, setSameAsContact] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [redirecting, setRedirecting] = useState<{ orderId: string } | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const syncedLegalName = `${form.firstName} ${form.lastName}`.trim();
  const effectiveLegalName =
    sameAsContact && form.personType === "natural" ? syncedLegalName : form.legalName;
  const effectiveBillingEmail = sameAsContact ? form.email : form.billingEmail;
  const effectiveBillingPhone = sameAsContact ? form.phone : form.billingPhone;

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => {
      if (!e[key as string]) return e;
      const next = { ...e };
      delete next[key as string];
      return next;
    });
  };

  const toggleSameAsContact = (next: boolean) => {
    setSameAsContact(next);
    if (next) {
      setErrors((e) => {
        const out = { ...e };
        delete out.billingEmail;
        delete out.billingPhone;
        if (form.personType === "natural") delete out.legalName;
        return out;
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: CheckoutPayload = {
      planId,
      billing,
      paymentProvider: form.paymentProvider,
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
        legalName: effectiveLegalName,
        email: effectiveBillingEmail,
        phone: effectiveBillingPhone,
        fiscalResponsibility: form.fiscalResponsibility,
        address: form.address,
        city: form.city,
        department: form.department,
        country: form.country,
      },
      hosting: {
        domain: form.domain.trim().toLowerCase(),
      },
      notes: form.notes || undefined,
    };

    startTransition(async () => {
      setSubmitError(null);
      const result = await submitCheckout(payload);
      if (result.ok) {
        setErrors({});
        setRedirecting({ orderId: result.orderId });
        submitToProvider(
          result.payment.url,
          result.payment.method,
          result.payment.fields as Record<string, string>,
        );
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

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={sameAsContact}
            onChange={(e) => toggleSameAsContact(e.target.checked)}
          />
          <span>
            Usar correo y teléfono del contacto
            {form.personType === "natural" ? " (también el nombre)" : ""}
          </span>
        </label>

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
            value={effectiveLegalName}
            onChange={(e) => set("legalName", e.target.value)}
            placeholder={form.personType === "juridica" ? "Geniorama SAS" : "Juan Pérez Pérez"}
            disabled={sameAsContact && form.personType === "natural"}
            required
          />
        </Field>

        <div className="form-grid form-grid--2">
          <Field
            label="Correo de facturación"
            error={errors.billingEmail}
            required
          >
            <input
              type="email"
              className={`field-input${errors.billingEmail ? " is-error" : ""}`}
              value={effectiveBillingEmail}
              onChange={(e) => set("billingEmail", e.target.value)}
              placeholder="facturacion@empresa.com"
              autoComplete="email"
              disabled={sameAsContact}
              required
            />
          </Field>

          <Field
            label="Teléfono de facturación"
            error={errors.billingPhone}
            required
          >
            <input
              type="tel"
              className={`field-input${errors.billingPhone ? " is-error" : ""}`}
              value={effectiveBillingPhone}
              onChange={(e) => set("billingPhone", e.target.value)}
              placeholder="+57 300 000 0000"
              autoComplete="tel"
              disabled={sameAsContact}
              required
            />
          </Field>
        </div>

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

      {/* ── DOMINIO ── */}
      <section className="form-section">
        <h2 className="form-section-title">
          <span className="form-section-step">3</span>
          Dominio
        </h2>

        <Field
          label="Dominio principal del sitio"
          error={errors.domain}
          required
        >
          <input
            type="text"
            className={`field-input${errors.domain ? " is-error" : ""}`}
            value={form.domain}
            onChange={(e) => set("domain", e.target.value)}
            placeholder="midominio.com"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            required
          />
        </Field>
        <p className="text-muted" style={{ fontSize: "0.8rem", margin: "-0.4rem 0 0" }}>
          Sin <code>http://</code> ni <code>www.</code>. Crearemos tu cuenta cPanel apuntando a
          este dominio.
        </p>
      </section>

      {/* ── MÉTODO DE PAGO ── */}
      <section className="form-section">
        <h2 className="form-section-title">
          <span className="form-section-step">4</span>
          Método de pago
        </h2>

        <div className="payment-methods">
          <PaymentMethodCard
            selected={form.paymentProvider === "wompi"}
            onClick={() => set("paymentProvider", "wompi")}
            title="Wompi"
            brands={["visa", "mastercard", "pse", "nequi", "bancolombia"]}
            badge="Recomendado"
          />
          <PaymentMethodCard
            selected={form.paymentProvider === "paymentsway"}
            onClick={() => set("paymentProvider", "paymentsway")}
            title="PaymentsWay"
            brands={["visa", "mastercard", "pse", "breb"]}
          />
        </div>
      </section>

      {/* ── NOTAS ── */}
      <section className="form-section">
        <h2 className="form-section-title">
          <span className="form-section-step">5</span>
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

type BrandId = "visa" | "mastercard" | "pse" | "nequi" | "bancolombia" | "breb";

function PaymentMethodCard({
  selected,
  onClick,
  title,
  brands,
  badge,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  brands: BrandId[];
  badge?: string;
}) {
  return (
    <button
      type="button"
      className={`payment-method${selected ? " is-selected" : ""}`}
      onClick={onClick}
      aria-pressed={selected}
    >
      <div className="payment-method-radio" aria-hidden="true">
        <span />
      </div>
      <div className="payment-method-text">
        <div className="payment-method-title">
          {title}
          {badge && <span className="payment-method-badge">{badge}</span>}
        </div>
        <div className="payment-method-brands" aria-label="Métodos disponibles">
          {brands.map((b) => (
            <BrandLogo key={b} id={b} />
          ))}
        </div>
      </div>
    </button>
  );
}

function BrandLogo({ id }: { id: BrandId }) {
  switch (id) {
    case "visa":
      return (
        <svg
          className="payment-method-brand"
          viewBox="0 0 60 20"
          xmlns="http://www.w3.org/2000/svg"
          role="img"
          aria-label="Visa"
        >
          <rect width="60" height="20" rx="3" fill="#1A1F71" />
          <text
            x="30"
            y="14.5"
            textAnchor="middle"
            fontFamily="Arial, Helvetica, sans-serif"
            fontWeight="900"
            fontStyle="italic"
            fontSize="11"
            fill="#fff"
            letterSpacing="0.6"
          >
            VISA
          </text>
        </svg>
      );
    case "mastercard":
      return (
        <svg
          className="payment-method-brand"
          viewBox="0 0 32 20"
          xmlns="http://www.w3.org/2000/svg"
          role="img"
          aria-label="Mastercard"
        >
          <rect width="32" height="20" rx="3" fill="#0F1320" />
          <circle cx="13" cy="10" r="6" fill="#EB001B" />
          <circle cx="19" cy="10" r="6" fill="#F79E1B" />
          <path
            d="M16 5.6a6 6 0 0 1 0 8.8 6 6 0 0 1 0-8.8z"
            fill="#FF5F00"
          />
        </svg>
      );
    case "pse":
      return (
        <svg
          className="payment-method-brand"
          viewBox="0 0 40 20"
          xmlns="http://www.w3.org/2000/svg"
          role="img"
          aria-label="PSE"
        >
          <rect width="40" height="20" rx="3" fill="#fff" />
          <text
            x="20"
            y="14.5"
            textAnchor="middle"
            fontFamily="Arial, Helvetica, sans-serif"
            fontWeight="900"
            fontSize="11"
            fill="#0033A0"
            letterSpacing="0.4"
          >
            PSE
          </text>
        </svg>
      );
    case "nequi":
      return (
        <svg
          className="payment-method-brand"
          viewBox="0 0 50 20"
          xmlns="http://www.w3.org/2000/svg"
          role="img"
          aria-label="Nequi"
        >
          <rect width="50" height="20" rx="3" fill="#DA0081" />
          <text
            x="25"
            y="14"
            textAnchor="middle"
            fontFamily="Arial, Helvetica, sans-serif"
            fontWeight="800"
            fontSize="10"
            fill="#fff"
            letterSpacing="0.3"
          >
            nequi
          </text>
        </svg>
      );
    case "bancolombia":
      return (
        <svg
          className="payment-method-brand"
          viewBox="0 0 76 20"
          xmlns="http://www.w3.org/2000/svg"
          role="img"
          aria-label="Bancolombia"
        >
          <rect width="76" height="20" rx="3" fill="#FDDA24" />
          <text
            x="38"
            y="14"
            textAnchor="middle"
            fontFamily="Arial, Helvetica, sans-serif"
            fontWeight="900"
            fontSize="9.5"
            fill="#1F2868"
            letterSpacing="0.1"
          >
            Bancolombia
          </text>
        </svg>
      );
    case "breb":
      return (
        <svg
          className="payment-method-brand"
          viewBox="0 0 50 20"
          xmlns="http://www.w3.org/2000/svg"
          role="img"
          aria-label="Bre-B"
        >
          <rect width="50" height="20" rx="3" fill="#1F2868" />
          <text
            x="25"
            y="14"
            textAnchor="middle"
            fontFamily="Arial, Helvetica, sans-serif"
            fontWeight="900"
            fontSize="10"
            fill="#FFD400"
            letterSpacing="0.3"
          >
            Bre-B
          </text>
        </svg>
      );
  }
}

function submitToProvider(
  url: string,
  method: "GET" | "POST",
  fields: Record<string, string>,
) {
  const form = document.createElement("form");
  form.method = method;
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
