import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { orderStore } from "@/lib/order-store";

type SearchParams = Promise<{ order?: string; status?: string }>;

export const metadata = {
  title: "Pedido confirmado — Hosting Geniorama",
};

const statusMeta = {
  success: {
    eyebrow: "Pago exitoso",
    title: "¡Bienvenido a bordo!",
    desc: "Recibimos tu pago. En las próximas horas activamos tu hosting y te enviamos los accesos a tu correo.",
    accent: "ok" as const,
  },
  pending: {
    eyebrow: "Pago en proceso",
    title: "Tu pago está en revisión",
    desc: "Estamos esperando la confirmación del banco. Te avisaremos por correo cuando se acredite.",
    accent: "warn" as const,
  },
  failed: {
    eyebrow: "Pago no completado",
    title: "Hubo un problema con el pago",
    desc: "No pudimos procesar tu pago. Puedes intentarlo de nuevo o contactarnos si necesitas ayuda.",
    accent: "err" as const,
  },
  cancelled: {
    eyebrow: "Pago cancelado",
    title: "Cancelaste el pago",
    desc: "No realizamos ningún cobro. Cuando estés listo, vuelve a iniciar el proceso.",
    accent: "warn" as const,
  },
  unknown: {
    eyebrow: "Estado del pago",
    title: "Estamos verificando tu pago",
    desc: "Si pagaste correctamente, recibirás un correo de confirmación en pocos minutos.",
    accent: "warn" as const,
  },
};

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { order: orderId } = await searchParams;
  const order = orderId ? await orderStore.get(orderId).catch(() => null) : null;

  const statusKey =
    order?.status && statusMeta[order.status as keyof typeof statusMeta]
      ? (order.status as keyof typeof statusMeta)
      : "unknown";
  const meta = statusMeta[statusKey];

  return (
    <>
      <Header />
      <main className="checkout-page">
        <div className="container-page">
          <div className={`checkout-status checkout-status--${meta.accent}`}>
            <div className="checkout-status-icon">
              {meta.accent === "ok" ? (
                <svg
                  width="40"
                  height="40"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12l5 5L20 7" />
                </svg>
              ) : meta.accent === "err" ? (
                <svg
                  width="40"
                  height="40"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              ) : (
                <svg
                  width="40"
                  height="40"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 2" />
                </svg>
              )}
            </div>

            <span className="section-eyebrow">{meta.eyebrow}</span>
            <h1 className="section-title" style={{ fontSize: "clamp(2rem, 5vw, 3rem)" }}>
              {meta.title}
            </h1>
            <p className="section-subtitle" style={{ maxWidth: "560px", margin: "0 auto 1.75rem" }}>
              {meta.desc}
            </p>

            {orderId && (
              <p className="text-muted" style={{ fontSize: "0.85rem", marginBottom: "1.75rem" }}>
                Pedido <strong className="text-pink">{orderId}</strong>
                {order?.paymentRef && (
                  <>
                    {" · "}Ref. PaymentsWay <strong>{order.paymentRef}</strong>
                  </>
                )}
              </p>
            )}

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "center",
                gap: "0.75rem",
              }}
            >
              {meta.accent === "err" && order ? (
                <Link
                  href={`/checkout?plan=${order.payload.planId}&billing=${order.payload.billing}`}
                  className="btn btn-primary btn-lg"
                >
                  Reintentar pago
                </Link>
              ) : (
                <Link href="/" className="btn btn-primary btn-lg">
                  Volver al inicio
                </Link>
              )}
              <a
                href={`https://wa.me/573000000000?text=${encodeURIComponent(
                  `Hola Geniorama, necesito ayuda con mi pedido ${orderId ?? ""}.`,
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-ghost btn-lg"
              >
                Hablar con soporte
              </a>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
