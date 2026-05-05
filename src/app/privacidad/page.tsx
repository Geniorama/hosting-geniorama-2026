import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { PrivacidadContent } from "@/components/LegalContent";

export const metadata = {
  title: "Política de privacidad — Hosting Geniorama",
  description:
    "Política de tratamiento de datos personales de Hosting Geniorama, conforme a la Ley 1581 de 2012 de Colombia.",
};

export default function PrivacidadPage() {
  return (
    <>
      <Header />
      <main className="legal-page">
        <article className="container-page legal-article">
          <header className="legal-header">
            <span className="section-eyebrow">Legal</span>
            <h1 className="legal-title">Política de privacidad</h1>
          </header>
          <PrivacidadContent />
        </article>
      </main>
      <Footer />
    </>
  );
}
