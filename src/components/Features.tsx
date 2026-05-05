type Feature = {
  title: string;
  desc: string;
  icon: React.ReactNode;
};

const features: Feature[] = [
  {
    title: "Discos SSD",
    desc: "Almacenamiento de estado sólido para tiempos de carga hasta 10× más rápidos que un disco tradicional.",
    icon: (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="2" y="4" width="20" height="6" rx="1.5" />
        <rect x="2" y="14" width="20" height="6" rx="1.5" />
        <circle cx="6" cy="7" r="1" />
        <circle cx="6" cy="17" r="1" />
      </svg>
    ),
  },
  {
    title: "cPanel incluido",
    desc: "Panel de control intuitivo para administrar dominios, correos, bases de datos y archivos sin tecnicismos.",
    icon: (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="4" width="18" height="14" rx="2" />
        <path d="M3 8h18M8 14l2 2 4-4" />
      </svg>
    ),
  },
  {
    title: "SSL gratuito",
    desc: "Certificado HTTPS Let's Encrypt incluido y renovado automáticamente para que tu sitio sea seguro.",
    icon: (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 2 4 6v6c0 5 3.5 9.5 8 10 4.5-.5 8-5 8-10V6z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    ),
  },
  {
    title: "Asistencia 24/7",
    desc: "Sistema de tickets y agentes de IA que responden al instante, con escalamiento al equipo cuando hace falta.",
    icon: (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 4h16v12H5l-1 4z" />
      </svg>
    ),
  },
  {
    title: "Cuentas de email",
    desc: "Crea correos profesionales con tu dominio (tu@empresa.com) y conéctalos a Outlook o Gmail.",
    icon: (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 12a9 9 0 1 0 18 0 9 9 0 1 0-18 0M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
      </svg>
    ),
  },
  {
    title: "Instaladores 1-click",
    desc: "Instala WordPress, Joomla o PrestaShop en segundos, sin conocimientos técnicos.",
    icon: (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 3v18M5 8l7-5 7 5M5 16l7 5 7-5" />
      </svg>
    ),
  },
  {
    title: "Bases MySQL",
    desc: "Bases de datos según tu plan, listas para WordPress, tiendas y aplicaciones a medida.",
    icon: (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <ellipse cx="12" cy="6" rx="8" ry="3" />
        <path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
      </svg>
    ),
  },
  {
    title: "Migración asistida",
    desc: "¿Vienes de otro proveedor? Movemos tu sitio sin que pierdas posicionamiento ni tiempo offline.",
    icon: (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5" />
      </svg>
    ),
  },
];

export function Features() {
  return (
    <section
      id="caracteristicas"
      className="section"
      style={{ background: "linear-gradient(180deg, transparent, rgba(6,18,78,0.13))" }}
    >
      <div className="container-page">
        <div className="section-head">
          <span className="section-eyebrow">Qué incluye</span>
          <h2 className="section-title">
            Todo lo que necesitas,
            <br />
            incluido en cada plan
          </h2>
        </div>

        <div className="feature-grid">
          {features.map((f) => (
            <article key={f.title} className="feature-card">
              <div className="feature-icon">{f.icon}</div>
              <h3 className="feature-title">{f.title}</h3>
              <p className="feature-desc">{f.desc}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
