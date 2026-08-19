import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  allowedDevOrigins: ["dev.geniorama.co"],
  experimental: {
    // Desde Next 16.1 Turbopack cachea en disco durante `next dev`. En Windows ese
    // caché se queda con versiones viejas de globals.css cuando el editor guarda
    // por rename (temp + move): el navegador recibe CSS obsoleta y ni reiniciar el
    // servidor la refresca, sólo borrar .next. Apagarlo cuesta unos ms de arranque.
    turbopackFileSystemCacheForDev: false,
  },
};

export default nextConfig;
