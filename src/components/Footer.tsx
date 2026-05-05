import Link from "next/link";
import { Logo } from "./Logo";

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="container-page">
        <div className="footer-grid">
          <div className="footer-brand">
            <Logo width={120} height={20} idSuffix="footer" />
            <p>
              Estudio creativo y de tecnología en Colombia. Diseñamos, desarrollamos y alojamos
              proyectos digitales que hacen crecer marcas.
            </p>
          </div>

          <div className="footer-col">
            <h4>Hosting</h4>
            <ul>
              <li>
                <Link href="#planes">Hosting Web</Link>
              </li>
              <li>
                <Link href="#planes">Hosting Ads</Link>
              </li>
              <li>
                <Link href="#caracteristicas">Características</Link>
              </li>
              <li>
                <Link href="#comparar">Comparar planes</Link>
              </li>
            </ul>
          </div>

          <div className="footer-col">
            <h4>Contacto</h4>
            <ul>
              <li>
                <a href="mailto:hola@geniorama.co">hola@geniorama.co</a>
              </li>
              <li>
                <a href="https://wa.me/573000000000" target="_blank" rel="noopener noreferrer">
                  WhatsApp
                </a>
              </li>
              <li>
                <a href="https://geniorama.co" target="_blank" rel="noopener noreferrer">
                  geniorama.co
                </a>
              </li>
              <li>
                <a href="https://app.geniorama.co" target="_blank" rel="noopener noreferrer">
                  Acceso a clientes
                </a>
              </li>
            </ul>
          </div>

          <div className="footer-col">
            <h4>Legal</h4>
            <ul>
              <li>
                <Link href="/terminos">Términos y condiciones</Link>
              </li>
              <li>
                <Link href="/privacidad">Política de privacidad</Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Geniorama. Todos los derechos reservados.</span>
          <span>
            Hecho con <span className="text-pink">♥</span> en Colombia
          </span>
        </div>
      </div>
    </footer>
  );
}
