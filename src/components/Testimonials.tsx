type Testimonial = {
  name: string;
  company: string;
  quote: string;
  topic: "Migración" | "Soporte" | "Velocidad";
};

// Nombres y empresas genéricos de forma intencional: reemplazar por testimonios
// reales cuando haya autorización del cliente para publicar su nombre y empresa.
const testimonials: Testimonial[] = [
  {
    name: "Camila R.",
    company: "Tienda online",
    quote: "Nos migraron un martes y no se cayó nada.",
    topic: "Migración",
  },
  {
    name: "Andrés G.",
    company: "Agencia de marketing",
    quote: "Escribí a las once de la noche y me respondieron en minutos.",
    topic: "Soporte",
  },
  {
    name: "Daniela P.",
    company: "Estudio de diseño",
    quote: "La tienda pasó de cargar en cinco segundos a menos de uno.",
    topic: "Velocidad",
  },
];

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

export function Testimonials() {
  return (
    <section id="testimonios" className="section">
      <div className="container-page">
        <div className="section-head">
          <span className="section-eyebrow">Testimonios</span>
          <h2 className="section-title">
            Lo que dicen
            <br />
            quienes ya se pasaron
          </h2>
        </div>

        <div className="testimonial-grid">
          {testimonials.map((t) => (
            <figure key={t.topic} className="testimonial-card">
              <span className="testimonial-topic">{t.topic}</span>
              <blockquote className="testimonial-quote">
                <span aria-hidden="true">&ldquo;</span>
                {t.quote}
                <span aria-hidden="true">&rdquo;</span>
              </blockquote>
              <figcaption className="testimonial-author">
                <span className="testimonial-avatar" aria-hidden="true">
                  {initials(t.name)}
                </span>
                <span className="testimonial-meta">
                  <span className="testimonial-name">{t.name}</span>
                  <span className="testimonial-company">{t.company}</span>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
