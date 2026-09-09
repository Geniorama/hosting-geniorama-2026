"use client";

import { useEffect } from "react";
import { markOnce, trackPixel } from "@/lib/meta-pixel";

type PurchaseTrackerProps = {
  /** El mismo que usa el webhook al mandar el Purchase por la API. */
  eventId: string;
  orderId: string;
  value: number;
  currency: string;
  planId: string;
  planName: string;
};

/**
 * Manda el Purchase desde el navegador en la página de gracias.
 *
 * El evento que de verdad cuenta es el del webhook (ese llega aunque el cliente
 * cierre la pestaña al volver de la pasarela); este es el refuerzo que trae las
 * cookies del navegador. Comparten `eventId`, así que Meta los une en uno.
 */
export function PurchaseTracker({
  eventId,
  orderId,
  value,
  currency,
  planId,
  planName,
}: PurchaseTrackerProps) {
  useEffect(() => {
    if (!markOnce(`meta:${eventId}`)) return;
    trackPixel(
      "Purchase",
      {
        currency,
        value,
        content_type: "product",
        content_ids: [planId],
        content_name: planName,
        contents: [{ id: planId, quantity: 1, item_price: value }],
        num_items: 1,
        order_id: orderId,
      },
      eventId,
    );
  }, [eventId, orderId, value, currency, planId, planName]);

  return null;
}
