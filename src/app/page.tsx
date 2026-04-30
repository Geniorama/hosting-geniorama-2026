import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { BrandShowcase } from "@/components/BrandShowcase";
import { PlansSection } from "@/components/PlansSection";
import { Features } from "@/components/Features";
import { CompareSection } from "@/components/CompareSection";
import { FAQ } from "@/components/FAQ";
import { CTA } from "@/components/CTA";
import { Footer } from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <BrandShowcase />
        <PlansSection />
        <Features />
        <CompareSection />
        <FAQ />
        <CTA />
      </main>
      <Footer />
    </>
  );
}
