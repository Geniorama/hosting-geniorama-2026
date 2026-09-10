/**
 * Datos de contacto públicos de Geniorama: cambiarlos aquí se refleja en todos
 * los enlaces del sitio.
 */

/** Celular de asesoría en formato E.164 sin el "+", que es el que espera wa.me. */
export const WHATSAPP_NUMBER = "573125346167";

/** Enlace a WhatsApp, con el mensaje inicial ya escrito si se pasa `text`. */
export function whatsappLink(text?: string) {
  const base = `https://wa.me/${WHATSAPP_NUMBER}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}
