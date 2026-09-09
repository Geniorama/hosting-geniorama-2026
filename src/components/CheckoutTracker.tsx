"use client";

import { useEffect, useRef } from "react";
import { trackPixel } from "@/lib/meta-pixel";

type CheckoutTrackerProps = {
  planId: string;
  planName: string;
  category: string;
  billing: "monthly" | "annual";
  value: number;
};

/**
 * InitiateCheckout ("Iniciar pago") al entrar al checkout.
 *
 * Va aquí y no en el render del servidor porque los `<Link>` de las tarjetas de
 * plan llevan prefetch: en el servidor se dispararía una vez por cada tarjeta
 * que se asome en el home, sin que nadie haya entrado a pagar.
 *
 * Sale por los dos caminos con el mismo eventId — el pixel y, de rebote, la API
 * de conversiones vía /api/meta/track, que es la que sobrevive a los
 * bloqueadores. Meta los deduplica.
 */
export function CheckoutTracker({
  planId,
  planName,
  category,
  billing,
  value,
}: CheckoutTrackerProps) {
  // Sin esto, el doble montaje de StrictMode en desarrollo cuenta dos veces.
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;

    const eventId = crypto.randomUUID();

    trackPixel(
      "InitiateCheckout",
      {
        currency: "COP",
        value,
        content_type: "product",
        content_ids: [planId],
        content_name: planName,
        content_category: category,
        contents: [{ id: planId, quantity: 1, item_price: value }],
        num_items: 1,
        billing,
      },
      eventId,
    );

    // Si falla, el evento del pixel ya salió: no hay nada que reintentar ni
    // nada que mostrarle al cliente.
    void fetch("/api/meta/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId, planId, billing }),
      keepalive: true,
    }).catch(() => {});
  }, [planId, planName, category, billing, value]);

  return null;
}
