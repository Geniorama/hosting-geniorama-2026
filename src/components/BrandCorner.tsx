type BrandCornerProps = {
  position: "tl" | "tr" | "bl" | "br";
  size?: number;
  variant?: "pink" | "outline";
};

/**
 * Recreación del distintivo angular rosa/blanco que aparece en las esquinas
 * de las piezas gráficas cyberpunk de Geniorama (ver Hosting Web Geniorama.pdf).
 * Forma de "L" escalonada hecha con dos cuadrados ofset.
 */
export function BrandCorner({ position, size = 64, variant = "pink" }: BrandCornerProps) {
  const styles: React.CSSProperties = {
    position: "absolute",
    width: size,
    height: size,
    pointerEvents: "none",
    zIndex: 2,
  };

  if (position === "tl") {
    styles.top = -2;
    styles.left = -2;
  } else if (position === "tr") {
    styles.top = -2;
    styles.right = -2;
    styles.transform = "scaleX(-1)";
  } else if (position === "bl") {
    styles.bottom = -2;
    styles.left = -2;
    styles.transform = "scaleY(-1)";
  } else {
    styles.bottom = -2;
    styles.right = -2;
    styles.transform = "scale(-1, -1)";
  }

  const fill = variant === "pink" ? "#e41279" : "transparent";
  const stroke = variant === "pink" ? "#fff" : "#e41279";

  return (
    <svg
      viewBox="0 0 64 64"
      style={styles}
      aria-hidden="true"
      className="brand-corner-svg"
    >
      <polygon
        points="0,0 36,0 36,12 12,12 12,36 0,36"
        fill={fill}
        stroke={stroke}
        strokeWidth="2"
      />
      <polygon
        points="22,22 50,22 50,30 30,30 30,50 22,50"
        fill="#fff"
      />
    </svg>
  );
}
