"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";

export function BrandShowcase() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const image = imageRef.current;
    if (!section || !image) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      const rect = section.getBoundingClientRect();
      const viewportH = window.innerHeight;
      const start = viewportH;
      const end = viewportH * 0.35;
      const raw = (start - rect.top) / (start - end);
      const progress = Math.min(1, Math.max(0, raw));
      const eased = progress * progress * (3 - 2 * progress);
      const translateY = (1 - eased) * 80;
      const scale = 0.92 + eased * 0.08;
      const maxOpacity = 0.75;
      image.style.opacity = String(eased * maxOpacity);
      image.style.transform = `translate3d(0, ${translateY}px, 0) scale(${scale})`;
    };

    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <section ref={sectionRef} className="brand-showcase">
      <Image
        ref={imageRef}
        src="/images/cover-genio.webp"
        alt="Para genios como tú"
        width={2752}
        height={1536}
        sizes="100vw"
        className="brand-showcase-image"
      />
    </section>
  );
}
