import type { Metadata } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";
import "lenis/dist/lenis.css";
import "./globals.css";
import { SmoothScroll } from "@/components/SmoothScroll";

const barlow = Barlow({
  variable: "--font-barlow",
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
});

const barlowCondensed = Barlow_Condensed({
  variable: "--font-barlow-condensed",
  weight: ["700", "800", "900"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Hosting Geniorama — Hosting profesional para tu sitio web",
  description:
    "Planes de hosting SSD optimizados para WordPress, e-commerce y campañas publicitarias. Asistencia 24/7 con tickets y agentes de IA, precios en pesos colombianos.",
  openGraph: {
    title: "Hosting Geniorama",
    description: "Hosting profesional con cPanel o Plesk, SSD y asistencia 24/7. Desde $15.000/mes.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${barlow.variable} ${barlowCondensed.variable}`}>
      <body suppressHydrationWarning>
        <SmoothScroll />
        {children}
      </body>
    </html>
  );
}
