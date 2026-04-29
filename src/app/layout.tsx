import type { Metadata } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";
import "./globals.css";

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
    "Planes de hosting SSD optimizados para WordPress, e-commerce y campañas publicitarias. Soporte humano y precios en pesos colombianos.",
  openGraph: {
    title: "Hosting Geniorama",
    description: "Hosting profesional con cPanel, SSD y soporte humano. Desde $15.000/mes.",
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
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
