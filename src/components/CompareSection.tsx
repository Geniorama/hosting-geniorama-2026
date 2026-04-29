"use client";

import { compareData } from "@/lib/plans";
import { useCategory } from "@/lib/category-store";

export function CompareSection() {
  const category = useCategory();
  const data = compareData[category];

  return (
    <section id="comparar" className="section">
      <div className="container-page">
        <div className="section-head">
          <span className="section-eyebrow">Comparativa</span>
          <h2 className="section-title">
            Compara las características
            <br />
            de cada plan
          </h2>
          <p className="section-subtitle">
            Cambia entre <strong className="text-white">Hosting Web</strong> y{" "}
            <strong className="text-white">Hosting Ads</strong> arriba para ver la tabla
            correspondiente.
          </p>
        </div>

        <div className="compare-wrap">
          <div className="compare-scroll">
            <table className="compare-table" aria-label="Comparativa de planes">
              <thead>
                <tr>
                  {data.headers.map((h, i) => (
                    <th key={i} className={i === data.featuredCol ? "featured-col" : undefined}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row, ri) => (
                  <tr key={ri}>
                    {row.map((cell, ci) =>
                      ci === 0 ? (
                        <th key={ci}>{cell}</th>
                      ) : (
                        <td
                          key={ci}
                          className={ci === data.featuredCol ? "featured-col" : undefined}
                        >
                          {cell}
                        </td>
                      ),
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
