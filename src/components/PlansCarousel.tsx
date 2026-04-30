"use client";

import { useEffect, useRef, useState } from "react";
import type { Plan } from "@/lib/plans";
import { PlanCard } from "./PlanCard";

type PlansCarouselProps = {
  plans: Plan[];
  billing: "monthly" | "annual";
};

export function PlansCarousel({ plans, billing }: PlansCarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(true);
  const [activeIdx, setActiveIdx] = useState(0);

  const getStep = () => {
    const el = trackRef.current;
    if (!el) return 0;
    const item = el.querySelector<HTMLElement>("[data-carousel-item]");
    if (!item) return 0;
    const gap = parseFloat(getComputedStyle(el).columnGap || "0") || 16;
    return item.offsetWidth + gap;
  };

  const updateState = () => {
    const el = trackRef.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 4);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    const step = getStep();
    if (step > 0) {
      const idx = Math.min(plans.length - 1, Math.round(el.scrollLeft / step));
      setActiveIdx(idx);
    }
  };

  const scrollByCard = (direction: 1 | -1) => {
    const el = trackRef.current;
    const step = getStep();
    if (!el || step === 0) return;
    el.scrollBy({ left: direction * step, behavior: "smooth" });
  };

  const scrollToIndex = (idx: number) => {
    const el = trackRef.current;
    const step = getStep();
    if (!el || step === 0) return;
    el.scrollTo({ left: idx * step, behavior: "smooth" });
  };

  useEffect(() => {
    updateState();
    const el = trackRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateState, { passive: true });
    window.addEventListener("resize", updateState);
    return () => {
      el.removeEventListener("scroll", updateState);
      window.removeEventListener("resize", updateState);
    };
  }, [plans.length]);

  // Reset scroll when plans (category) change
  useEffect(() => {
    if (trackRef.current) trackRef.current.scrollLeft = 0;
    setActiveIdx(0);
  }, [plans]);

  return (
    <div className="plans-carousel">
      <button
        type="button"
        className="carousel-btn carousel-btn--prev"
        onClick={() => scrollByCard(-1)}
        disabled={!canPrev}
        aria-label="Plan anterior"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>

      <button
        type="button"
        className="carousel-btn carousel-btn--next"
        onClick={() => scrollByCard(1)}
        disabled={!canNext}
        aria-label="Plan siguiente"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9 6l6 6-6 6" />
        </svg>
      </button>

      <div
        ref={trackRef}
        className="plans-carousel-track"
        role="region"
        aria-label="Planes de hosting"
      >
        {plans.map((plan) => (
          <div key={plan.id} className="plans-carousel-item" data-carousel-item>
            <PlanCard plan={plan} billingMode={billing} />
          </div>
        ))}
      </div>

      <div className="carousel-dots" role="tablist" aria-label="Navegación de planes">
        {plans.map((plan, i) => (
          <button
            key={plan.id}
            type="button"
            className={`carousel-dot${i === activeIdx ? " is-active" : ""}`}
            onClick={() => scrollToIndex(i)}
            aria-label={`Ir al plan ${plan.name}`}
            aria-current={i === activeIdx}
            role="tab"
            aria-selected={i === activeIdx}
          />
        ))}
      </div>
    </div>
  );
}
