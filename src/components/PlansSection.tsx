"use client";

import { useState } from "react";
import { plans } from "@/lib/plans";
import { categoryStore, useCategory } from "@/lib/category-store";
import { PlanCard } from "./PlanCard";
import { PlansCarousel } from "./PlansCarousel";

export function PlansSection() {
  const [billing, setBilling] = useState<"monthly" | "annual">("annual");
  const category = useCategory();

  return (
    <section id="planes" className="section">
      <div className="container-page">
        <div className="section-head">
          <span className="section-eyebrow">Planes</span>
          <h2 className="section-title">
            Elige el hosting
            <br />
            perfecto para tu proyecto
          </h2>
          <p className="section-subtitle">
            Dos familias de planes: <strong className="text-white">Hosting Web</strong> para páginas
            y tiendas. <strong className="text-white">Hosting Ads</strong> para landings con pauta. Pagas el mes o el año, y renuevas al mismo precio.
          </p>
        </div>

        <div className="plans-controls">
          <div className="tab-group" role="tablist">
            <button
              type="button"
              className={`tab-btn${category === "web" ? " is-active" : ""}`}
              onClick={() => categoryStore.set("web")}
              role="tab"
              aria-selected={category === "web"}
            >
              Hosting Web
            </button>
            <button
              type="button"
              className={`tab-btn${category === "ads" ? " is-active" : ""}`}
              onClick={() => categoryStore.set("ads")}
              role="tab"
              aria-selected={category === "ads"}
            >
              Hosting Ads
            </button>
          </div>

          <div className="billing-toggle">
            <button
              type="button"
              className={`billing-btn${billing === "monthly" ? " is-active" : ""}`}
              onClick={() => setBilling("monthly")}
            >
              Mensual
            </button>
            <button
              type="button"
              className={`billing-btn${billing === "annual" ? " is-active" : ""}`}
              onClick={() => setBilling("annual")}
            >
              Anual
              <span className="billing-badge">−20%</span>
            </button>
          </div>
        </div>

        {plans[category].length > 3 ? (
          <PlansCarousel plans={plans[category]} billing={billing} />
        ) : (
          <div className={`plans-grid plans-grid--${category}`}>
            {plans[category].map((plan) => (
              <PlanCard key={plan.id} plan={plan} billingMode={billing} />
            ))}
          </div>
        )}

        <div className="guarantee">
          <span className="guarantee-icon" aria-hidden="true">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3 4 6v6c0 4.4 3.1 8.2 8 9 4.9-.8 8-4.6 8-9V6l-8-3Z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          </span>
          <div className="guarantee-body">
            <h3 className="guarantee-title">Garantía de devolución</h3>
            <p className="guarantee-text">
              30 días en planes anuales y 7 días en planes mensuales. Si no es lo que
              esperabas, te devolvemos el dinero.
            </p>
            <p className="guarantee-terms">
              **Aplican{" "}
              <a href="/terminos#garantia-devolucion" target="_blank" rel="noopener noreferrer">
                términos y condiciones
              </a>
              .
            </p>
          </div>
        </div>

        <p className="text-muted text-center mt-8 text-sm">
          Todos los precios en pesos colombianos. Servicio exento de IVA. Renovación al mismo
          precio del primer periodo.
        </p>
      </div>
    </section>
  );
}
