"use client";

/**
 * ReferencesFooter — shared "Referencias" footer for every studio page.
 *
 * Each calculator cites the codes, papers, and manuals its math comes
 * from. Following the editorial rule on /studio/geotecnica: every formula
 * traces to a published source — no invented coefficients, no
 * extrapolations beyond the calibrated range.
 *
 * Use one of the canned reference bundles below (by passing `bundle`) OR
 * a custom list (`items`) for one-off pages.
 */

interface Item {
  category: string;
  refs: string[];
}

const BUNDLES: Record<string, Item[]> = {
  beam: [
    {
      category: "Códigos aplicables",
      refs: [
        "ACI 318-14 §9, §22.2 — Diseño por flexión y cortante",
        "ACI 318-14 §18.6 — Vigas dúctiles de marco especial",
        "CSCR-10 Rev. 2014 §8 — Vigas dúctiles + capacity design",
        "INTE C85:2017 — Resistencias mínimas por zona sísmica",
      ],
    },
    {
      category: "Fórmulas y procedimientos",
      refs: [
        "Whitney (1937) — Stress block equivalente a 0.85·f'c",
        "ACI Committee 318 — 15 pasos de flexión rectangular",
        "Capacity Design — Pauley & Priestley (1992)",
        "MacGregor & Wight (2009) — Reinforced Concrete: Mechanics and Design",
      ],
    },
  ],
  column: [
    {
      category: "Códigos aplicables",
      refs: [
        "ACI 318-14 §10 — Columnas",
        "ACI 318-14 §18.7 — Columnas en marcos especiales",
        "ACI 318-14 §21.2.2 — Factores φ por tipo de columna",
        "ACI 318-14 §22.4 — Diseño axial",
        "CSCR-10 Rev. 2014 §18.7 — Confinamiento sísmico",
      ],
    },
    {
      category: "Confinamiento y detallado",
      refs: [
        "ACI 318-14 §18.7.5 — Acero transversal en zona confinada",
        "ACI 318-14 §25.3 — Ganchos sísmicos 135°",
        "Pauley & Priestley (1992) — Seismic Design of RC Structures",
      ],
    },
  ],
  footing: [
    {
      category: "Códigos aplicables",
      refs: [
        "ACI 318-14 §13 — Cimentaciones",
        "ACI 318-14 §22.5 — Cortante en una dirección",
        "ACI 318-14 §22.6.5 — Punzonamiento (3 expresiones, mín. gobierna)",
        "Código de Cimentaciones de Costa Rica (2009) §5 — Capacidad portante",
        "CSCR-10 Rev. 2014 §6 — Combinaciones para suelo",
      ],
    },
    {
      category: "Capacidad portante",
      refs: [
        "Terzaghi (1943) — Theoretical Soil Mechanics",
        "Meyerhof (1963) — Some Recent Research on Bearing Capacity",
        "Brinch Hansen, J. (1970) — A Revised and Extended Formula",
        "Vesić (1973) — Analysis of Ultimate Loads of Shallow Foundations",
        "Bowles (1996) — Foundation Analysis and Design, 5ed",
      ],
    },
  ],
  slab: [
    {
      category: "Códigos aplicables",
      refs: [
        "ACI 318-14 §7 — Losas en una dirección",
        "ACI 318-14 §8 — Losas en dos direcciones",
        "ACI 318-14 §6.5.2 — Coeficientes para análisis aproximado",
        "ACI 318-63 Method 3 — Coeficientes para losas en 2 direcciones",
        "ACI 318-14 §7.6.1 — Acero por temperatura y retracción",
      ],
    },
  ],
  wall: [
    {
      category: "Códigos aplicables",
      refs: [
        "ACI 318-14 §18.10 — Muros estructurales especiales",
        "ACI 318-14 §11 — Muros (general)",
        "ACI 318-14 §18.10.6 — Elementos de borde",
        "CSCR-10 Rev. 2014 §11 — Muros estructurales",
      ],
    },
  ],
  retaining: [
    {
      category: "Códigos aplicables",
      refs: [
        "Código de Cimentaciones de Costa Rica (2009) §6 — Muros de contención",
        "ACI 318-14 §5.3.1 — Factor de carga 1.6 para H (presión lateral)",
        "AASHTO LRFD Bridge Design §11 — Retaining structures",
      ],
    },
    {
      category: "Empuje y capacidad",
      refs: [
        "Rankine (1857) — Earth pressure coefficients",
        "Brinch Hansen, J. (1970) — Bearing capacity formula",
        "Mononobe-Okabe (1929, 1926) — Empuje sísmico",
        "Das (2016) — Principles of Geotechnical Engineering, 9ed §13",
      ],
    },
  ],
  stair: [
    {
      category: "Códigos aplicables",
      refs: [
        "ACI 318-14 §7 — Losa inclinada (analogía con losa 1-dir)",
        "Reglamento de Construcciones de Costa Rica — Ergonomía: 60 ≤ 2C+H ≤ 66 cm",
        "ACI Table 9.5(a) — Espesor mínimo h ≥ L/20",
      ],
    },
  ],
  lintel: [
    {
      category: "Códigos aplicables",
      refs: [
        "ACI 318-14 §9 — Diseño por flexión",
        "ACI 318-14 §9.9 — Vigas profundas (cuando a/d < 2)",
        "ACI 318-14 §23 — Modelo puntal-tensor",
        "ACI 318-14 §22.5 — Cortante (sin estribos cuando φVc ≥ Vu)",
      ],
    },
  ],
};

interface Props {
  bundle?: keyof typeof BUNDLES;
  items?: Item[];
  /** Title for the section. Defaults to "Referencias". */
  title?: string;
}

export function ReferencesFooter({ bundle, items, title = "Referencias" }: Props) {
  const data = items ?? (bundle ? BUNDLES[bundle] : []);
  if (!data || data.length === 0) return null;

  return (
    <section className="mt-6 border border-zinc-800 rounded-lg bg-zinc-900/30 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-zinc-100">{title}</h3>
        <span className="text-[10px] text-zinc-600 uppercase tracking-wider">
          Cada fórmula tiene una fuente
        </span>
      </div>
      <div className="space-y-3">
        {data.map((cat) => (
          <div key={cat.category}>
            <h4 className="text-[10px] uppercase tracking-wider text-amber-400 mb-1.5">
              {cat.category}
            </h4>
            <ul className="space-y-0.5">
              {cat.refs.map((r, i) => (
                <li
                  key={i}
                  className="text-[11px] text-zinc-400 pl-3 border-l border-zinc-800 leading-relaxed"
                >
                  {r}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
