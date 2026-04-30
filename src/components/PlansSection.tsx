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
            Dos familias de planes: <strong className="text-white">Hosting Web</strong> para sitios
            y tiendas, y <strong className="text-white">Hosting Ads</strong> optimizado para tráfico
            publicitario.
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

        <p className="text-muted text-center mt-8 text-sm">
          Todos los precios en pesos colombianos. Servicio exento de IVA. Renovación al mismo
          precio del primer periodo.
        </p>
      </div>
    </section>
  );
}
