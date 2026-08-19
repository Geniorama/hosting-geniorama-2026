import { AdvisorChat } from "./AdvisorChat";

const STEPS = [
  "Describe tu proyecto en una frase.",
  "Responde un par de preguntas cortas.",
  "Recibes el plan que te sirve y por qué.",
];

/** Bloque del asesor dentro del home. La versión de campaña vive en /asesor. */
export function Advisor() {
  return (
    <section id="asesor" className="section advisor-section">
      <div className="container-page advisor-layout">
        <div className="advisor-intro">
          <span className="section-eyebrow">Asesor IA</span>
          <h2 className="advisor-title">
            ¿Cuál plan
            <br />
            necesito?
          </h2>
          <p className="advisor-lead">
            Descríbele tu proyecto a nuestro asesor de IA y te dice con cuál plan arrancar, por
            qué ese y no otro, y qué te queda si creces.
          </p>

          <ol className="advisor-steps">
            {STEPS.map((step, i) => (
              <li key={i}>
                <span className="advisor-step-num">{i + 1}</span>
                {step}
              </li>
            ))}
          </ol>

          <p className="advisor-note">
            Sugerencia automática sobre nuestro catálogo real, sin registro. Si tu caso es
            especial,{" "}
            <a href="https://app.geniorama.co" target="_blank" rel="noopener noreferrer">
              lo revisamos contigo
            </a>
            .
          </p>
        </div>

        <AdvisorChat source="asesor-home" />
      </div>
    </section>
  );
}
