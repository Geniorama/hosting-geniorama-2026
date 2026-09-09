"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";
import { META_PIXEL_ID, trackPixel } from "@/lib/meta-pixel";

/**
 * Pixel de Meta en el navegador. Va en el layout raíz: carga fbevents.js una
 * sola vez y manda el PageView de la primera carga y el de cada navegación.
 *
 * Sin NEXT_PUBLIC_META_PIXEL_ID no pinta nada, así que en local el sitio corre
 * igual sin pixel. Los eventos de conversión (Purchase, Lead) los manda además
 * el servidor por la API de conversiones, deduplicados por eventID.
 */
export function MetaPixel() {
  const pathname = usePathname();
  // El snippet ya manda el PageView de la carga inicial: si no lo saltáramos,
  // la primera vista contaría doble.
  const firstRender = useRef(true);

  useEffect(() => {
    if (!META_PIXEL_ID) return;
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    trackPixel("PageView");
  }, [pathname]);

  if (!META_PIXEL_ID) return null;

  return (
    <>
      <Script id="meta-pixel" strategy="afterInteractive">
        {`!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window,document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init','${META_PIXEL_ID}');
fbq('track','PageView');`}
      </Script>
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          alt=""
          src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
        />
      </noscript>
    </>
  );
}
