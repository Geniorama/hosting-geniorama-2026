"use client";

import { useState } from "react";

type FaqEntry = { q: string; a: React.ReactNode };

const faqs: FaqEntry[] = [
  {
    q: "¿Puedo cambiar de plan en cualquier momento?",
    a: "Sí. Puedes subir o bajar de plan cuando quieras. El cambio es inmediato y solo se cobra la diferencia proporcional al tiempo restante de tu periodo activo.",
  },
  {
    q: "¿Incluye el dominio (.com / .co)?",
    a: "El dominio se cotiza aparte porque su precio depende de la extensión (.com, .co, .net, etc.). Si ya tienes uno, lo conectamos sin costo adicional.",
  },
  {
    q: "¿Cuál es la diferencia entre Hosting Web y Hosting Ads?",
    a: (
      <>
        <strong className="text-white">Hosting Web</strong> está pensado para sitios institucionales,
        blogs, portales de noticias y e-commerce, priorizando almacenamiento.{" "}
        <strong className="text-white">Hosting Ads</strong> está optimizado para landing pages que
        reciben tráfico publicitario alto y constante: prioriza ancho de banda y velocidad de
        respuesta.
      </>
    ),
  },
  {
    q: "¿Hacen migración desde otro proveedor?",
    a: "Sí, sin costo adicional. Nuestro equipo migra tu sitio, bases de datos y correos con tiempo de inactividad mínimo. Te avisamos antes de cambiar los DNS para que coordinemos el momento.",
  },
  {
    q: "¿Cuál es el método de pago?",
    a: "Aceptamos transferencia bancaria, PSE y tarjeta. Para clientes corporativos también gestionamos órdenes de compra y facturación electrónica DIAN.",
  },
];

export function FAQ() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  return (
    <section id="faq" className="section">
      <div className="container-page">
        <div className="section-head">
          <span className="section-eyebrow">FAQ</span>
          <h2 className="section-title">Preguntas frecuentes</h2>
        </div>

        <div className="faq-list">
          {faqs.map((item, i) => {
            const isOpen = openIdx === i;
            return (
              <div key={i} className={`faq-item${isOpen ? " is-open" : ""}`}>
                <button
                  type="button"
                  className="faq-question"
                  onClick={() => setOpenIdx(isOpen ? null : i)}
                  aria-expanded={isOpen}
                >
                  {item.q}
                  <span className="faq-icon">
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
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </span>
                </button>
                <div
                  className="faq-answer"
                  style={{ maxHeight: isOpen ? "400px" : "0" }}
                >
                  <div className="faq-answer-inner">{item.a}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
