import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { CheckoutForm } from "@/components/CheckoutForm";
import { CheckoutSummary } from "@/components/CheckoutSummary";
import { plans } from "@/lib/plans";

type SearchParams = Promise<{ plan?: string; billing?: string }>;

export const metadata = {
  title: "Checkout — Hosting Geniorama",
  description: "Completa tus datos de contacto y facturación para finalizar tu pedido.",
};

export default async function CheckoutPage({ searchParams }: { searchParams: SearchParams }) {
  const { plan: planId, billing } = await searchParams;

  const allPlans = [...plans.web, ...plans.ads];
  const plan = allPlans.find((p) => p.id === planId);

  if (!plan) notFound();

  const billingMode: "monthly" | "annual" = billing === "monthly" ? "monthly" : "annual";

  return (
    <>
      <Header />
      <main className="checkout-page">
        <div className="container-page">
          <div className="checkout-back">
            <Link href="/#planes" className="btn btn-ghost" style={{ padding: "0.55rem 1.1rem" }}>
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
                <path d="M19 12H5M12 5l-7 7 7 7" />
              </svg>
              Volver a planes
            </Link>
          </div>

          <div className="checkout-head">
            <span className="section-eyebrow">Checkout</span>
            <h1 className="section-title" style={{ fontSize: "clamp(2rem, 5vw, 3rem)" }}>
              Casi listo. Completa tus datos.
            </h1>
            <p className="section-subtitle" style={{ maxWidth: "640px" }}>
              Necesitamos esta información para emitir tu factura electrónica y configurar tu
              cuenta. Solo te tomará 2 minutos.
            </p>
          </div>

          <div className="checkout-grid">
            <CheckoutForm planId={plan.id} billing={billingMode} />
            <CheckoutSummary plan={plan} billing={billingMode} />
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
