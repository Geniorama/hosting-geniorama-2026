import Link from "next/link";

export function Hero() {
  return (
    <section className="hero">
      <div className="container-page hero-grid">
        <div className="hero-text">
          <span className="eyebrow">
            <span className="eyebrow-dot" />
            Elige tu plan de hosting en un minuto
          </span>
          <h1 className="display-title">
            El hosting que se ajusta a tu proyecto,
            <br />
            <span className="accent">no al revés.</span>
          </h1>
          <p className="hero-subtitle">
            Una landing por tres meses, una tienda por años o una página que
            apenas empieza: describe tu proyecto y te decimos qué plan necesitas.
          </p>
          <div className="hero-actions">
            <Link href="#planes" className="btn btn-primary btn-lg">
              Describir mi proyecto
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
            <div className="hero-stat-value">Mes o año</div>
            <div className="hero-stat-label">Sin permanencia</div>
          </div>
          <div className="hero-stat">
            <div className="hero-stat-value">Mismo precio</div>
            <div className="hero-stat-label">Al renovar</div>
          </div>
          <div className="hero-stat">
            <div className="hero-stat-value">24/7</div>
            <div className="hero-stat-label">Soporte en Colombia</div>
          </div>
        </div>
      </div>

      <div className="neon-grid" aria-hidden="true" />
    </section>
  );
}
