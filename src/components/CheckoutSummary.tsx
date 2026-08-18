"use client";

import { useState, useTransition } from "react";
import type { Plan } from "@/lib/plans";
import type { AppliedCoupon } from "@/lib/coupons";
import { formatCOP } from "@/lib/format";
import { validateCouponAction } from "@/app/checkout/actions";

type CheckoutSummaryProps = {
  plan: Plan;
  billing: "monthly" | "annual";
  coupon: AppliedCoupon | null;
  onApplyCoupon: (coupon: AppliedCoupon | null) => void;
};

export function CheckoutSummary({ plan, billing, coupon, onApplyCoupon }: CheckoutSummaryProps) {
  const isAnnual = billing === "annual";
  const subtotal = isAnnual ? plan.price.annual : plan.price.monthly;
  const couponDiscount = coupon?.discount ?? 0;
  const total = Math.max(0, subtotal - couponDiscount);
  const savings = isAnnual ? plan.price.original - plan.price.annual : 0;

  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const onApply = () => {
    if (!code.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await validateCouponAction(code.trim(), plan.id, billing);
      if (result.ok) {
        onApplyCoupon(result.coupon);
        setCode("");
      } else {
        onApplyCoupon(null);
        setError(result.error);
      }
    });
  };

  const onRemove = () => {
    onApplyCoupon(null);
    setCode("");
    setError(null);
  };

  return (
    <aside className="checkout-summary">
      <div className="checkout-summary-head">
        <span className="section-eyebrow" style={{ marginBottom: 0 }}>
          Tu pedido
        </span>
        <h3 className="checkout-summary-title">{plan.name}</h3>
        <p className="checkout-summary-tagline">{plan.tagline}</p>
      </div>

      <ul className="checkout-summary-features">
        {plan.features.map((f, i) => (
          <li key={i}>
            {f.strong ? <strong>{f.strong}</strong> : null}
            {f.strong && f.text ? " " : null}
            {f.text}
          </li>
        ))}
      </ul>

      <div className="checkout-summary-rows">
        <div className="summary-row">
          <span>Plan {plan.name}</span>
          <span>{formatCOP(subtotal)}</span>
        </div>
        <div className="summary-row">
          <span>Periodo</span>
          <span>{isAnnual ? "Anual (12 meses)" : "Mensual"}</span>
        </div>
        {isAnnual && savings > 0 && (
          <div className="summary-row summary-row--ok">
            <span>Descuento anual</span>
            <span>−{formatCOP(savings)}</span>
          </div>
        )}
        {coupon && (
          <div className="summary-row summary-row--ok">
            <span>
              Cupón <strong>{coupon.code}</strong>
            </span>
            <span>−{formatCOP(coupon.discount)}</span>
          </div>
        )}
        <div className="summary-row">
          <span>IVA</span>
          <span>Exento</span>
        </div>
      </div>

      <div className="checkout-coupon">
        {coupon ? (
          <div className="checkout-coupon-applied">
            <div>
              <strong>{coupon.code}</strong>
              <span>{coupon.label}</span>
            </div>
            <button type="button" className="checkout-coupon-remove" onClick={onRemove}>
              Quitar
            </button>
          </div>
        ) : (
          <>
            <label htmlFor="coupon-input" className="checkout-coupon-label">
              ¿Tienes un cupón?
            </label>
            <div className="checkout-coupon-row">
              <input
                id="coupon-input"
                type="text"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase());
                  if (error) setError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    onApply();
                  }
                }}
                placeholder="CÓDIGO"
                className="checkout-coupon-input"
                autoComplete="off"
                disabled={pending}
              />
              <button
                type="button"
                className="btn btn-ghost checkout-coupon-apply"
                onClick={onApply}
                disabled={pending || !code.trim()}
              >
                {pending ? "Validando…" : "Aplicar"}
              </button>
            </div>
            {error && <p className="checkout-coupon-error">{error}</p>}
          </>
        )}
      </div>

      <div className="summary-row summary-row--total">
        <span>Total</span>
        <span>
          {formatCOP(total)} <small>COP</small>
        </span>
      </div>

      <p className="checkout-summary-note">
        Pago único por este periodo: no guardamos tu tarjeta ni cobramos automáticamente. Te
        avisamos antes del vencimiento y renuevas al mismo precio. Puedes cambiar de plan cuando
        quieras.
      </p>
    </aside>
  );
}
