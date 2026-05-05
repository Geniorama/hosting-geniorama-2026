"use client";

import Image from "next/image";
import { useState } from "react";
import { BrandCorner } from "./BrandCorner";

type AspectRatio = "square" | "portrait" | "wide";

type CyberpunkVisualProps = {
  src?: string;
  alt: string;
  aspect?: AspectRatio;
  brandCorners?: boolean;
  glow?: boolean;
  scanlines?: boolean;
  priority?: boolean;
  className?: string;
  objectPosition?: string;
};

const aspectClass: Record<AspectRatio, string> = {
  square: "cyber-visual--square",
  portrait: "cyber-visual--portrait",
  wide: "cyber-visual--wide",
};

export function CyberpunkVisual({
  src,
  alt,
  aspect = "square",
  brandCorners = true,
  glow = true,
  scanlines = true,
  priority = false,
  className,
  objectPosition,
}: CyberpunkVisualProps) {
  const [imgError, setImgError] = useState(false);
  const showImage = src && !imgError;

  return (
    <div className={`cyber-visual ${aspectClass[aspect]} ${className ?? ""}`.trim()}>
      <div className="cyber-visual-inner">
        {showImage ? (
          <Image
            src={src!}
            alt={alt}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 600px"
            className="cyber-visual-img"
            style={objectPosition ? { objectPosition } : undefined}
            priority={priority}
            onError={() => setImgError(true)}
          />
        ) : (
          <CyberpunkPlaceholder />
        )}

        {glow && <div className="cyber-visual-glow" aria-hidden="true" />}
        {scanlines && <div className="cyber-visual-scanlines" aria-hidden="true" />}
      </div>

      {brandCorners && (
        <>
          <BrandCorner position="tl" size={56} />
          <BrandCorner position="br" size={56} />
        </>
      )}
    </div>
  );
}

function CyberpunkPlaceholder() {
  return (
    <svg
      className="cyber-visual-placeholder"
      viewBox="0 0 600 600"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="cv-bg" cx="50%" cy="40%" r="70%">
          <stop offset="0%" stopColor="#5d2bb8" />
          <stop offset="55%" stopColor="#1a0a4a" />
          <stop offset="100%" stopColor="#000a3d" />
        </radialGradient>
        <radialGradient id="cv-pink" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(228,18,121,0.55)" />
          <stop offset="100%" stopColor="rgba(228,18,121,0)" />
        </radialGradient>
        <linearGradient id="cv-grid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(228,18,121,0)" />
          <stop offset="100%" stopColor="rgba(228,18,121,0.55)" />
        </linearGradient>
        <pattern id="cv-grid-pattern" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M40 0H0V40" fill="none" stroke="url(#cv-grid)" strokeWidth="0.6" />
        </pattern>
      </defs>

      {/* Base */}
      <rect width="600" height="600" fill="url(#cv-bg)" />

      {/* Holographic figure silhouette */}
      <g opacity="0.5">
        <ellipse cx="300" cy="245" rx="68" ry="74" fill="rgba(120,180,255,0.18)" />
        <path
          d="M232 320 Q300 280 368 320 L380 480 Q300 460 220 480 Z"
          fill="rgba(120,180,255,0.14)"
        />
      </g>

      {/* Neon rim around figure */}
      <g
        fill="none"
        stroke="#e41279"
        strokeWidth="1.5"
        opacity="0.85"
        style={{ filter: "drop-shadow(0 0 6px #e41279)" }}
      >
        <ellipse cx="300" cy="245" rx="72" ry="78" />
        <path d="M226 322 Q300 282 374 322 L388 488 Q300 466 212 488 Z" />
      </g>

      {/* Pink halo */}
      <rect width="600" height="600" fill="url(#cv-pink)" />

      {/* Perspective neon grid floor */}
      <g style={{ filter: "drop-shadow(0 0 4px #e41279)" }}>
        {[0, 1, 2, 3, 4, 5, 6].map((i) => {
          const y = 480 + i * 18;
          const opacity = 1 - i * 0.13;
          return (
            <line
              key={`h-${i}`}
              x1="0"
              x2="600"
              y1={y}
              y2={y}
              stroke="#e41279"
              strokeWidth="1.2"
              opacity={opacity}
            />
          );
        })}
        {[-4, -3, -2, -1, 0, 1, 2, 3, 4].map((i) => {
          const x = 300 + i * 110;
          return (
            <line
              key={`v-${i}`}
              x1="300"
              y1="480"
              x2={x}
              y2="600"
              stroke="#e41279"
              strokeWidth="1"
              opacity="0.8"
            />
          );
        })}
      </g>

      {/* Top circuit pattern hint */}
      <rect
        x="0"
        y="0"
        width="600"
        height="200"
        fill="url(#cv-grid-pattern)"
        opacity="0.35"
      />

      {/* Scattered glow dots */}
      <g fill="#7dd3fc">
        {[
          [120, 180],
          [480, 140],
          [80, 380],
          [510, 360],
          [200, 100],
          [400, 80],
        ].map(([x, y], i) => (
          <circle
            key={i}
            cx={x}
            cy={y}
            r="2"
            opacity="0.9"
            style={{ filter: "drop-shadow(0 0 4px #7dd3fc)" }}
          />
        ))}
      </g>
    </svg>
  );
}
