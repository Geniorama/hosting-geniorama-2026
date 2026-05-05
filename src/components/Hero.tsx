"use client"

import Link from "next/link";

export function Hero() {
  const currentYear = new Date().getFullYear().toString();

  return (
    <section className="hero">
      <div className="container-page hero-grid">
        <div className="hero-text">
          <span className="eyebrow">
            <span className="eyebrow-dot" />
            Hosting profesional · {currentYear}
          </span>
          <h1 className="display-title">
            Tu sitio web,
            <br />
            <span className="accent">siempre online.</span>
          </h1>
          <p className="hero-subtitle">
            Hosting SSD con cPanel, asistencia 24/7 y planes pensados para WordPress, e-commerce y
            campañas publicitarias. Pesos colombianos, sin sorpresas.
          </p>
          <div className="hero-actions">
            <Link href="#planes" className="btn btn-primary btn-lg">
              Elegir mi plan
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
            <Link href="#comparar" className="btn btn-ghost btn-lg">
              Comparar planes
            </Link>
          </div>
        </div>
      </div>

      <div className="container-page">
        <div className="hero-stats">
          <div className="hero-stat">
            <div className="hero-stat-value">99.9%</div>
            <div className="hero-stat-label">Uptime</div>
          </div>
          <div className="hero-stat">
            <div className="hero-stat-value">SSD</div>
            <div className="hero-stat-label">Almacenamiento rápido</div>
          </div>
          <div className="hero-stat">
            <div className="hero-stat-value">24/7</div>
            <div className="hero-stat-label">Soporte</div>
          </div>
        </div>
      </div>

      <div className="neon-grid" aria-hidden="true" />
    </section>
  );
}
