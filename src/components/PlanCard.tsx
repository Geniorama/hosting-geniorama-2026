import Link from "next/link";
import type { Plan } from "@/lib/plans";
import { formatCOP } from "@/lib/format";

type PlanCardProps = {
  plan: Plan;
  billingMode: "monthly" | "annual";
};

export function PlanCard({ plan, billingMode }: PlanCardProps) {
  const isAnnual = billingMode === "annual";
  const annualMonthly = Math.round(plan.price.annual / 12);
  const displayValue = isAnnual ? annualMonthly : plan.price.monthly;
  const savingsPct = isAnnual
    ? Math.round(((plan.price.original - plan.price.annual) / plan.price.original) * 100)
    : 0;

  const ctaUrl = `/checkout?plan=${plan.id}&billing=${billingMode}`;

  return (
    <article className={`plan-card${plan.featured ? " is-featured" : ""}`}>
      {plan.badge && <span className="plan-badge">{plan.badge}</span>}

      <div className="plan-head">
        <span className="plan-eyebrow">{plan.eyebrow}</span>
        <h3 className="plan-name">{plan.name}</h3>
        <p className="plan-tagline">{plan.tagline}</p>
      </div>

      <div className="plan-price">
        <div className="plan-price-amount">
          <span className="plan-price-currency">$</span>
          <span className="plan-price-value">{displayValue.toLocaleString("es-CO")}</span>
          <span className="plan-price-period">/ mes</span>
        </div>
        {isAnnual ? (
          <div className="plan-price-meta">
            <span>Total {formatCOP(plan.price.annual)} / año</span>
            <span className="plan-price-strike">{formatCOP(plan.price.original)}</span>
            <span className="plan-price-save">−{savingsPct}%</span>
          </div>
        ) : (
          <div className="plan-price-meta">
            <span>Sin permanencia</span>
          </div>
        )}
      </div>

      <ul className="plan-features">
        {plan.features.map((f, i) => (
          <li key={i} className="plan-feature">
            <span className="plan-feature-check">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12l5 5L20 7" />
              </svg>
            </span>
            <span>
              {f.strong ? <strong>{f.strong}</strong> : null}
              {f.strong && f.text ? " " : null}
              {f.text}
            </span>
          </li>
        ))}
      </ul>

      <Link
        href={ctaUrl}
        className={`btn ${plan.featured ? "btn-primary" : "btn-ghost"} plan-cta`}
      >
        Contratar {plan.name}
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
      </Link>
    </article>
  );
}
