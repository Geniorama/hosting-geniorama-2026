import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { TerminosContent } from "@/components/LegalContent";

export const metadata = {
  title: "Términos y condiciones — Hosting Geniorama",
  description:
    "Términos y condiciones de uso de los servicios de Hosting Geniorama: alcance, pagos, garantías, soporte y responsabilidades.",
};

export default function TerminosPage() {
  return (
    <>
      <Header />
      <main className="legal-page">
        <article className="container-page legal-article">
          <header className="legal-header">
            <span className="section-eyebrow">Legal</span>
            <h1 className="legal-title">Términos y condiciones</h1>
          </header>
          <TerminosContent />
        </article>
      </main>
      <Footer />
    </>
  );
}
