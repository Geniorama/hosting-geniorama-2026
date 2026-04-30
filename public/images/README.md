# Imágenes cyberpunk

Suelta aquí los renders cyberpunk de Geniorama con estos nombres exactos (la
landing los lee automáticamente). Si falta alguna, el componente cae al
placeholder cyberpunk SVG y todo sigue luciendo bien.

## Slots usados

| Archivo            | Dónde se muestra                | Aspecto   | Notas                                  |
|--------------------|---------------------------------|-----------|----------------------------------------|
| `hero-genio.jpg`   | Hero (col. derecha)             | 4:5 / 1:1 | Personaje "genio" del PDF, el principal |
| `showcase.jpg`     | Banner "Para genios como tú"    | 16:9      | Ancho, sirve para fondo a sangre        |
| `plan-starter.jpg` | Card del plan Starter (opcional)| 1:1       | Pequeño, ~480×480                       |
| `plan-basic.jpg`   | Card del plan Basic (opcional)  | 1:1       |                                         |
| `plan-standar.jpg` | Card del plan Standard          | 1:1       | Hacker con capucha del PDF              |
| `plan-news.jpg`    | Card News / Shop                | 1:1       | Mujer cyberpunk con visor               |
| `plan-mega.jpg`    | Card Mega Shop / News           | 1:1       | Mismo estilo que News, más saturado     |
| `plan-ads-basic.jpg`    | Card Ads Basic           | 1:1       |                                         |
| `plan-ads-landing.jpg`  | Card Ads Landing         | 1:1       |                                         |
| `plan-ads-advanced.jpg` | Card Ads Advanced        | 1:1       |                                         |

## Recomendaciones de exportación

- **Formato:** `.jpg` con calidad 80–85, o `.webp` (mejor compresión).
- **Tamaño:** las cards no necesitan más de 800px en el lado mayor; el hero
  hasta 1400px. Next/Image se encarga del resizing responsive.
- **Paleta:** mantén el morado/magenta dominante (#5d2bb8, #e41279) y los
  acentos azul eléctrico para que combinen con el fondo `#000a3d`.
- **Encuadre:** deja respiración alrededor del sujeto — los bordes de la card
  recortan ~12px y aplican esquinas en diamante rosa.

Si cambias los nombres, actualiza los `image` en `src/lib/plans.ts` y el
`heroImage` en `src/components/Hero.tsx`.
