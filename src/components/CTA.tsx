export function CTA() {
  return (
    <section className="section-tight">
      <div className="container-page">
        <div className="cta-block">
          <span className="section-eyebrow">¿Aún tienes dudas?</span>
          <h2 className="section-title" style={{ marginBottom: "0.75rem" }}>
            Hablemos de tu proyecto
          </h2>
          <p
            className="section-subtitle"
            style={{ maxWidth: "560px", margin: "0 auto 1.75rem" }}
          >
            Cuéntanos qué necesitas y te recomendamos el plan ideal. Respondemos en menos de 4 horas
            hábiles.
          </p>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: "0.75rem",
            }}
          >
            <a
              href="https://wa.me/573000000000?text=Hola%20Geniorama%2C%20quiero%20asesor%C3%ADa%20sobre%20hosting."
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary btn-lg"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.5 14.4c-.3-.1-1.7-.8-2-.9-.3-.1-.4-.1-.6.1-.2.3-.7.9-.9 1.1-.2.2-.3.2-.6.1-.3-.1-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6.1-.1.3-.3.4-.5.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5 0-.1-.6-1.5-.9-2.1-.2-.5-.5-.5-.6-.5h-.6c-.2 0-.5.1-.7.4-.3.3-.9.9-.9 2.2 0 1.3 1 2.6 1.1 2.7.1.2 1.9 2.9 4.6 4 .6.3 1.1.4 1.5.6.6.2 1.2.2 1.7.1.5-.1 1.7-.7 1.9-1.4.2-.7.2-1.3.2-1.4-.1-.2-.3-.2-.6-.4M12 2C6.5 2 2 6.5 2 12c0 1.8.5 3.5 1.3 5L2 22l5.2-1.3c1.5.8 3.1 1.2 4.8 1.2 5.5 0 10-4.5 10-10S17.5 2 12 2" />
              </svg>
              Asesoría por WhatsApp
            </a>
            <a href="mailto:hola@geniorama.co" className="btn btn-ghost btn-lg">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="m22 7-10 6L2 7" />
              </svg>
              hola@geniorama.co
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
