/**
 * Ayudas del pixel de Meta en el navegador.
 *
 * El pixel es la mitad visible de la integración: la otra es la API de
 * conversiones (meta-capi.ts, en el servidor). Los eventos importantes salen
 * por los dos lados con el mismo `eventID` para que Meta los deduplique y
 * cuente uno solo — el del servidor sobrevive a bloqueadores y a Safari, el del
 * navegador llega antes y trae las cookies frescas.
 */

type Fbq = {
  (command: "init", pixelId: string): void;
  (command: "track", event: string, params?: Record<string, unknown>, options?: { eventID: string }): void;
  (command: "trackCustom", event: string, params?: Record<string, unknown>, options?: { eventID: string }): void;
  queue?: unknown[];
};

declare global {
  interface Window {
    fbq?: Fbq;
  }
}

export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;

/**
 * Dispara un evento estándar. No hace nada si el pixel no cargó (sin configurar,
 * bloqueado por una extensión, sin consentimiento): el evento igual sale por la
 * API de conversiones desde el servidor.
 */
export function trackPixel(
  event: string,
  params?: Record<string, unknown>,
  eventId?: string,
): void {
  if (typeof window === "undefined" || typeof window.fbq !== "function") return;
  window.fbq("track", event, params ?? {}, eventId ? { eventID: eventId } : undefined);
}

/**
 * Marca un evento como ya disparado en esta pestaña. Lo usamos donde el cliente
 * puede recargar (la página de gracias): la deduplicación de Meta cubre la
 * ventana corta, pero un F5 al otro día contaría otra compra.
 */
export function markOnce(key: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.sessionStorage.getItem(key)) return false;
    window.sessionStorage.setItem(key, "1");
    return true;
  } catch {
    // Modo privado o cookies bloqueadas: preferimos disparar de más que perderlo.
    return true;
  }
}
