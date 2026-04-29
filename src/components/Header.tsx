import Link from "next/link";
import { Logo } from "./Logo";

export function Header() {
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
          <Link href="#planes">Planes</Link>
          <Link href="#caracteristicas">Características</Link>
          <Link href="#comparar">Comparar</Link>
          <Link href="#faq">FAQ</Link>
        </nav>

        <Link
          href="#planes"
          className="btn btn-primary"
          style={{ padding: "0.55rem 1.1rem", fontSize: "0.88rem" }}
        >
          Ver planes
        </Link>
      </div>
    </header>
  );
}
