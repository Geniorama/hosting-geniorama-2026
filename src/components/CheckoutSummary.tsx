import type { Plan } from "@/lib/plans";
import { formatCOP } from "@/lib/format";

type CheckoutSummaryProps = {
  plan: Plan;
  billing: "monthly" | "annual";
};

export function CheckoutSummary({ plan, billing }: CheckoutSummaryProps) {
  const isAnnual = billing === "annual";
  const subtotal = isAnnual ? plan.price.annual : plan.price.monthly;
  const total = subtotal;
  const savings = isAnnual ? plan.price.original - plan.price.annual : 0;

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
        <div className="summary-row">
          <span>IVA</span>
          <span>Exento</span>
        </div>
      </div>

      <div className="summary-row summary-row--total">
        <span>Total</span>
        <span>
          {formatCOP(total)} <small>COP</small>
        </span>
      </div>

      <p className="checkout-summary-note">
        Renovación al mismo precio del primer periodo. Puedes cambiar de plan cuando quieras.
      </p>
    </aside>
  );
}
