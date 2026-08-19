"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo } from "./Logo";

const NAV_ITEMS = [
  { href: "#planes", label: "Planes" },
  { href: "#asesor", label: "Asesor IA" },
  { href: "#caracteristicas", label: "Características" },
  { href: "#comparar", label: "Comparar" },
  { href: "#faq", label: "FAQ" },
];

export function Header() {
  const [activeId, setActiveId] = useState<string>("");

  useEffect(() => {
    const sections = NAV_ITEMS
      .map((item) => document.getElementById(item.href.slice(1)))
      .filter((el): el is HTMLElement => Boolean(el));
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      { rootMargin: "-40% 0px -55% 0px", threshold: [0, 0.25, 0.5, 0.75, 1] },
    );

    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, []);

  return (
    <header className="site-header">
      <div className="container-page header-inner">
        <Link href="/" aria-label="Geniorama" className="inline-flex items-center">
          <Logo width={140} height={22} idSuffix="header" />
          <span
            className="ml-2.5 font-extrabold text-base uppercase"
            style={{
              fontFamily: "var(--font-display)",
              color: "var(--color-pink)",
              letterSpacing: "0.06em",
            }}
          >
            Hosting
          </span>
        </Link>

        <nav className="header-nav" aria-label="Principal">
          {NAV_ITEMS.map((item) => {
            const isActive = activeId === item.href.slice(1);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={isActive ? "is-active" : undefined}
                aria-current={isActive ? "true" : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="header-cta">
          <a
            href="https://app.geniorama.co"
            target="_blank"
            rel="noopener noreferrer"
            className="header-login"
          >
            Iniciar sesión
          </a>
          <Link
            href="#planes"
            className="btn btn-primary"
            style={{ padding: "0.55rem 1.1rem", fontSize: "0.88rem" }}
          >
            Ver planes
          </Link>
        </div>
      </div>
    </header>
  );
}
