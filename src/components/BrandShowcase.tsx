import { CyberpunkVisual } from "./CyberpunkVisual";
import { BrandCorner } from "./BrandCorner";

export function BrandShowcase() {
  return (
    <section className="brand-showcase">
      <div className="brand-showcase-bg">
        <CyberpunkVisual
          src="/images/showcase.jpg"
          alt="Para genios como tú"
          aspect="wide"
          brandCorners={false}
          glow={false}
          scanlines={false}
        />
      </div>

      <div className="container-page brand-showcase-inner">
        <BrandCorner position="tl" size={88} />
        <BrandCorner position="br" size={88} />

        <span className="section-eyebrow">Made in Colombia</span>
        <h2 className="brand-showcase-title">
          Hosting Web<br />
          <span className="text-pink">para genios como tú</span>
        </h2>
        <p className="brand-showcase-sub">
          Servidores rápidos, infraestructura cyberpunk-grade y un equipo humano detrás. Tu
          proyecto digital merece un lugar que esté a la altura.
        </p>
      </div>
    </section>
  );
}
