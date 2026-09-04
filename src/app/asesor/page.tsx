import Link from "next/link";
import type { Metadata } from "next";
import { AdvisorChat } from "@/components/AdvisorChat";
import { Logo } from "@/components/Logo";

export const metadata: Metadata = {
  title: "Asesor de hosting con IA — elige tu plan en 1 minuto | Geniorama",
  description:
    "Cuéntale tu proyecto a nuestro asesor de IA y te dice qué plan de hosting necesitas, por qué ese y cuánto cuesta. Sin registro, precios en pesos colombianos.",
  alternates: { canonical: "/asesor" },
  openGraph: {
    title: "¿Cuál hosting necesitas? Pregúntale a nuestro asesor de IA",
    description:
      "Describe tu proyecto y recibe el plan que te sirve, con el motivo y el precio en pesos. Migración gratis y soporte 24/7.",
    type: "website",
  },
};

const TRUST = [
  { title: "Migración gratis", detail: "Traemos tu sitio, correos y bases de datos sin costo." },
  { title: "Soporte 24/7", detail: "Sistema de tickets con seguimiento, atendido por personas." },
  { title: "Precios en pesos", detail: "Sin cobros en dólares y servicio exento de IVA." },
  { title: "cPanel incluido", detail: "El panel más usado del mercado, con SSL y respaldos incluidos." },
];

const FAQ = [
  {
    q: "¿La recomendación tiene costo?",
    a: "No. El asesor es gratuito y no necesitas registrarte para usarlo: describes tu proyecto y te dice qué plan te sirve.",
  },
  {
    q: "¿Y si me equivoco de plan?",
    a: "Cambias cuando quieras. El cambio es inmediato y solo pagas la diferencia proporcional al tiempo que te quede del periodo.",
  },
  {
    q: "¿El dominio está incluido?",
    a: "El dominio se cotiza aparte porque el precio depende de la extensión. Si ya tienes uno, lo conectamos sin costo.",
  },
];

export default function AsesorLandingPage() {
  return (
    <div className="lp">
      <header className="lp-bar">
        <div className="container-page lp-bar-inner">
          <Link href="/" aria-label="Geniorama" className="inline-flex items-center">
            <Logo width={132} height={21} idSuffix="lp" />
            <span className="lp-bar-tag">Hosting</span>
          </Link>
          <span className="lp-bar-note">Asesoría gratuita · sin registro</span>
        </div>
      </header>

      <main>
        <section className="lp-hero">
          <div className="container-page lp-hero-inner">
            <span className="eyebrow">
              <span className="eyebrow-dot" />
              Asesor con inteligencia artificial
            </span>
            <h1 className="lp-title">
              ¿Cuál hosting
              <br />
              <span className="text-pink">necesita tu proyecto?</span>
            </h1>
            <p className="lp-subtitle">
              Descríbelo en una frase. En menos de un minuto te decimos qué plan te sirve, por qué
              ese y cuánto cuesta —con precios en pesos y sin letra menuda.
            </p>

            <div className="lp-chat">
              <AdvisorChat
                source="asesor-landing"
                leadCapture
                comparePath="/#planes"
                hints={[
                  "Describe tu proyecto en una frase.",
                  "Responde un par de preguntas cortas.",
                  "Recibes el plan que te sirve y por qué.",
                ]}
              />
            </div>

            <p className="lp-hero-note">
              Recomendación automática sobre nuestro catálogo real. Si tu caso no encaja en ningún
              plan, te lo decimos.
            </p>
          </div>
        </section>

        <section className="lp-trust">
          <div className="container-page">
            <ul className="lp-trust-grid">
              {TRUST.map((item) => (
                <li key={item.title} className="lp-trust-item">
                  <span className="lp-trust-check" aria-hidden="true">
                    {/* Con width/height explícitos: sin ellos el SVG se estira a
                        todo el contenedor si la hoja de estilos llega tarde. */}
                    <svg
                      width="12"
                      height="12"
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
                  <strong>{item.title}</strong>
                  <span>{item.detail}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="lp-faq">
          <div className="container-page lp-faq-inner">
            <h2 className="lp-faq-title">Antes de decidir</h2>
            <dl className="lp-faq-list">
              {FAQ.map((item) => (
                <div key={item.q} className="lp-faq-item">
                  <dt>{item.q}</dt>
                  <dd>{item.a}</dd>
                </div>
              ))}
            </dl>

            <div className="lp-faq-cta">
              <p>¿Ya sabes lo que necesitas?</p>
              <Link href="/#planes" className="btn btn-primary btn-lg">
                Ver todos los planes
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="lp-foot">
        <div className="container-page lp-foot-inner">
          {/* Sin `new Date()`: mantiene la landing prerenderizada como estática. */}
          <span>© Geniorama · Hosting en Colombia</span>
          <nav className="lp-foot-links" aria-label="Legal">
            <Link href="/privacidad">Privacidad</Link>
            <Link href="/terminos">Términos</Link>
            <a href="mailto:soporte@geniorama.co">soporte@geniorama.co</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
