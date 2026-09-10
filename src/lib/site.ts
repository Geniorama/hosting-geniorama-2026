/**
 * Dominio canónico del sitio. Va fijo a propósito: metadataBase alimenta el
 * canonical y las URL absolutas de og:image, y esas deben apuntar siempre al
 * dominio propio, no al de Netlify ni al de un deploy de preview.
 *
 * Para las URL que sí cambian por entorno (retornos de pago, enlaces de los
 * correos) se sigue usando NEXT_PUBLIC_BASE_URL.
 */
export const SITE_URL = "https://hosting.geniorama.co";
