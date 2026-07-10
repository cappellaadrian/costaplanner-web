"use client";

/**
 * /studio/geotecnica — Catálogo de herramientas geotécnicas.
 *
 * Inspirado en Viktor.ai pero CR-específico: correlaciones SPT/CPT,
 * capacidad portante, asentamientos, estabilidad de taludes y licuefacción
 * con la realidad costarricense (cenizas volcánicas, lateritas, arcillas
 * expansivas, lluvia bimodal, zonas sísmicas IV).
 *
 * Cada herramienta alimenta los inputs marcados "🌱 Suelos" en las
 * calculadoras de cimentación: zapata aislada, zapata corrida, muro de
 * contención y viga de amarre.
 */
import Link from "next/link";

interface Tool {
  slug: string;
  name: string;
  description: string;
  status: "ready" | "soon" | "research";
  feeds?: string[];
  crNote?: string;
  /** Source materials: codes, papers, manuals. Always cited. */
  refs: string[];
}

const TOOLS: { group: string; items: Tool[] }[] = [
  {
    group: "Caracterización del suelo",
    items: [
      {
        slug: "spt",
        name: "Interpretación SPT",
        description:
          "Convierte conteos N de SPT en φ, Dr, cu, qa. Corrige por energía CR-60% y sobrecarga efectiva.",
        status: "ready",
        feeds: ["zapata aislada", "zapata corrida", "muro de contención"],
        crNote: "Martillo donut típico en CR → ER ≈ 45-60% (Skempton 1986)",
        refs: [
          "ASTM D1586 — Standard Test Method for SPT",
          "Terzaghi & Peck (1967) — Soil Mechanics in Engineering Practice",
          "Meyerhof (1956, 1957) — N→φ correlation",
          "Bowles (1996) — Foundation Analysis and Design, 5ed",
          "Skempton (1986) — energy ratio correction",
          "Liao & Whitman (1986) — overburden correction CN",
        ],
      },
      {
        slug: "cpt",
        name: "Interpretación CPT (Robertson)",
        description:
          "Clasificación SBT a partir de qc, fs, u2. Devuelve perfil de suelos + φ + Dr estratificado.",
        status: "ready",
        feeds: ["zapata aislada", "muro de contención"],
        crNote: "CPT poco común en CR — equipos LANAMME-UCR",
        refs: [
          "Robertson (1990, 2009) — SBT classification chart",
          "ASTM D5778 — Standard Test Method for CPT",
          "Lunne, Robertson & Powell (1997) — CPT in Geotechnical Practice",
        ],
      },
      {
        slug: "perfil",
        name: "Perfil estratigráfico",
        description:
          "Sube el reporte del perforador (PDF o foto) y arma el perfil. Incluye nivel freático estacional CR.",
        status: "ready",
        crNote: "IMN promedios mensuales de precipitación por cantón desde 1940",
        refs: [
          "Código de Cimentaciones de Costa Rica (2009) §3 — investigación geotécnica",
          "CFIA — Reglamento de estudios geotécnicos",
          "IMN — Boletín meteorológico mensual",
        ],
      },
    ],
  },
  {
    group: "Capacidad y asentamientos",
    items: [
      {
        slug: "capacidad-portante",
        name: "Capacidad portante (Meyerhof/Hansen/Vesić)",
        description:
          "Comparativa lado a lado. Aplica factores de forma, profundidad, inclinación y sismo.",
        status: "ready",
        feeds: ["zapata aislada", "zapata corrida"],
        crNote: "FS estático ≥ 3 / sísmico ≥ 2 per Código Cimentaciones CR §5",
        refs: [
          "Terzaghi (1943) — Theoretical Soil Mechanics",
          "Meyerhof (1963) — Some Recent Research on Bearing Capacity",
          "Hansen, J. Brinch (1970) — A Revised and Extended Formula",
          "Vesić (1973) — Analysis of Ultimate Loads of Shallow Foundations",
          "Código de Cimentaciones de Costa Rica (2009) §5",
          "CSCR-10 Rev. 2014 §6 — combinaciones para suelo",
        ],
      },
      {
        slug: "asentamientos",
        name: "Asentamientos",
        description:
          "Inmediato (Schmertmann), consolidación primaria (Terzaghi 1D) y secundaria.",
        status: "ready",
        feeds: ["zapata aislada"],
        refs: [
          "Schmertmann (1970) — Static cone to compute static settlement",
          "Schmertmann, Hartman & Brown (1978) — Improved Strain Influence Factor",
          "Terzaghi (1943) — Consolidación 1D",
          "ACI 360R-10 — Slabs on Ground (tolerable settlements)",
        ],
      },
      {
        slug: "rigidez-resorte",
        name: "Módulo de balasto / resorte equivalente",
        description:
          "Convierte qa + asentamiento admisible en k para análisis Winkler en SAP/ETABS.",
        status: "ready",
        refs: [
          "Terzaghi (1955) — Evaluation of coefficients of subgrade reaction",
          "Bowles (1996) §16",
          "ACI 336.2R-88 — Suggested Analysis and Design Procedures for Combined Footings and Mats",
        ],
      },
    ],
  },
  {
    group: "Estabilidad",
    items: [
      {
        slug: "taludes",
        name: "Estabilidad de taludes",
        description:
          "Fellenius + Bishop simplificado. Búsqueda automática del círculo crítico. Sismo pseudo-estático k_h ≈ 0.5·PGA.",
        status: "ready",
        crNote: "Cárceles CR: laderas con cenizas saturadas + discontinuidades",
        refs: [
          "Bishop (1955) — The use of the slip circle in stability analysis",
          "Fellenius (1936) — Calculation of stability of earth dams",
          "Spencer (1967) — A method of analysis of the stability of embankments",
          "Hynes-Griffin & Franklin (1984) — Rationalizing seismic coefficient method",
          "Eurocode 8-5 §7 — slope stability",
        ],
      },
      {
        slug: "muros-tipologia",
        name: "Selección de tipología de muro",
        description:
          "Voladizo vs contrafuertes vs gravedad vs gaviones vs anclado, según H, suelo, espacio, presupuesto.",
        status: "ready",
        feeds: ["muro de contención"],
        refs: [
          "Das (2010) — Principles of Foundation Engineering, 7ed §13",
          "AASHTO LRFD Bridge Design §11 — retaining structures",
          "NCMA TR-127B — Segmental Retaining Wall Design",
        ],
      },
      {
        slug: "licuefaccion",
        name: "Potencial de licuefacción",
        description:
          "Procedimiento simplificado con N60 y a_max del sitio. Resultado: FS_liq por capa.",
        status: "ready",
        crNote: "Zonas IV CR (Nicoya, Limón, Quepos) → arenas saturadas susceptibles",
        refs: [
          "Seed & Idriss (1971) — Simplified Procedure for Evaluating Liquefaction Potential",
          "Youd & Idriss (2001) — NCEER 1996/98 workshop summary",
          "Boulanger & Idriss (2014) — CPT and SPT Based Liquefaction Triggering Procedures",
          "CSCR-10 Rev. 2014 §17.7 — riesgo de licuefacción",
        ],
      },
    ],
  },
  {
    group: "Específicos de Costa Rica",
    items: [
      {
        slug: "arcillas-expansivas",
        name: "Arcillas expansivas (Guanacaste)",
        description:
          "IP → presión de hinchamiento → diseño de plateas flotantes o pilotes mínimos.",
        status: "research",
        crNote: "Vertisoles: Liberia, Cañas, Nicoya seco",
        refs: [
          "Holtz & Gibbs (1956) — Engineering Properties of Expansive Clays",
          "Chen (1988) — Foundations on Expansive Soils",
          "USDA Soil Taxonomy — clasificación Vertisoles CR (MAG)",
          "ICE/MAG — Mapa de suelos de Costa Rica 1:200,000",
        ],
      },
      {
        slug: "cenizas-volcanicas",
        name: "Cenizas volcánicas (Valle Central)",
        description:
          "Correlación γ-N-φ para Andisoles. Comportamiento drenado vs no-drenado de allophane.",
        status: "research",
        crNote: "Heredia, Cartago, Alajuela, San José occidental",
        refs: [
          "Wesley (2010) — Geotechnical Engineering in Residual Soils",
          "Rodríguez Acevedo (2018) — Caracterización geotécnica de suelos volcánicos del Valle Central",
          "LanammeUCR — Informes técnicos de subsuelos urbanos",
          "Maeda et al. (1977) — Allophane and Imogolite",
        ],
      },
      {
        slug: "imn-aguas",
        name: "Nivel freático estacional (IMN)",
        description:
          "Promedios IMN por cantón → corrección sismo + capacidad portante con suelo saturado.",
        status: "research",
        crNote: "Bimodal lluvia/seca CR; recarga acuíferos Valle Central",
        refs: [
          "IMN — Boletín meteorológico mensual y promedios climatológicos 1991-2020",
          "SENARA — Mapa hidrogeológico de CR",
          "AyA — NT-2018 estudios hidrogeológicos para construcción",
        ],
      },
    ],
  },
];

const GLOBAL_REFS: { category: string; items: string[] }[] = [
  {
    category: "Códigos costarricenses",
    items: [
      "CSCR-10 Rev. 2014 — Código Sísmico de Costa Rica (CFIA, ICE, AIE)",
      "Código de Cimentaciones de Costa Rica (2009) — CFIA",
      "INTE C85:2017 — Concreto estructural: resistencia mínima por zona",
      "Ley de Construcciones de Costa Rica (Ley 833 + Reglamento)",
      "AyA NT-2018 — Normas técnicas para diseño y construcción",
    ],
  },
  {
    category: "Códigos internacionales adoptados",
    items: [
      "ACI 318-14 — Building Code Requirements for Structural Concrete",
      "ACI 318-19 — actualización (referenciada para diseño por capacidad)",
      "ASCE 7-16 — Minimum Design Loads",
      "ASTM D1586, D5778, D2487 — ensayos de suelo",
      "ASTM A615/A706 — barras de acero de refuerzo",
      "Eurocode 7 (EN 1997) y Eurocode 8 (EN 1998) — referencias geotécnicas y sísmicas",
    ],
  },
  {
    category: "Datos y mapas Costa Rica",
    items: [
      "RSN (Red Sismológica Nacional) — Universidad de Costa Rica + ICE: catálogo sísmico y zonificación PGA",
      "LanammeUCR — Informes de caracterización de subsuelos urbanos",
      "IMN (Instituto Meteorológico Nacional) — precipitación, IDF, evapotranspiración",
      "SENARA — Mapa hidrogeológico nacional",
      "MAG/SEPSA — Mapa pedológico nacional 1:200,000",
      "Catastro Nacional + Registro de la Propiedad — plano catastrado, folio real",
    ],
  },
  {
    category: "Libros y manuales de referencia",
    items: [
      "Das, B.M. (2016) — Principles of Geotechnical Engineering, 9ed",
      "Bowles, J.E. (1996) — Foundation Analysis and Design, 5ed",
      "Coduto (2001) — Foundation Design: Principles and Practices",
      "Wesley (2010) — Geotechnical Engineering in Residual Soils",
      "Kramer (1996) — Geotechnical Earthquake Engineering",
    ],
  },
];

export default function GeotecnicaIndexPage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="text-xs uppercase tracking-widest text-emerald-400 mb-1">
              <Link href="/studio" className="hover:text-emerald-300">← Studio</Link>
            </div>
            <h1 className="text-3xl font-semibold">🌱 Geotecnia</h1>
            <p className="text-sm text-zinc-400 mt-2 max-w-2xl">
              Herramientas geotécnicas para Costa Rica. Las calculadoras
              alimentan los inputs marcados <span className="px-1 rounded bg-emerald-900/40 text-emerald-300 border border-emerald-800 text-[10px]">🌱 Suelos</span>{" "}
              en zapata aislada, zapata corrida, muro de contención y viga de amarre.
            </p>
          </div>
        </div>

        {TOOLS.map((group) => (
          <div key={group.group} className="space-y-2">
            <h2 className="text-xs uppercase tracking-widest text-zinc-500 mt-2">
              {group.group}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {group.items.map((tool) => {
                const isReady = tool.status === "ready";
                const Wrapper: React.ElementType = isReady ? Link : "div";
                const wrapperProps = isReady
                  ? { href: `/studio/geotecnica/${tool.slug}` }
                  : {};
                return (
                  <Wrapper key={tool.slug} {...wrapperProps}>
                    <div
                      className={`rounded-lg border p-4 h-full transition-colors ${
                        isReady
                          ? "border-zinc-800 bg-zinc-900/40 hover:border-emerald-700 hover:bg-zinc-900 cursor-pointer"
                          : "border-zinc-900 bg-zinc-950 opacity-70"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="text-sm font-semibold text-zinc-100">{tool.name}</h3>
                        <span
                          className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border shrink-0 ${
                            tool.status === "ready"
                              ? "bg-emerald-900/40 text-emerald-300 border-emerald-800"
                              : tool.status === "soon"
                                ? "bg-amber-900/40 text-amber-300 border-amber-800"
                                : "bg-zinc-800 text-zinc-400 border-zinc-700"
                          }`}
                        >
                          {tool.status === "ready" && "Listo"}
                          {tool.status === "soon" && "Próximo"}
                          {tool.status === "research" && "Investigación"}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 leading-relaxed">{tool.description}</p>
                      {tool.feeds && tool.feeds.length > 0 && (
                        <div className="mt-2 text-[10px] text-zinc-600">
                          Alimenta: <span className="text-amber-400/80">{tool.feeds.join(", ")}</span>
                        </div>
                      )}
                      {tool.crNote && (
                        <div className="mt-1 text-[10px] text-emerald-400/80 italic">
                          🇨🇷 {tool.crNote}
                        </div>
                      )}
                      {tool.refs && tool.refs.length > 0 && (
                        <details className="mt-2 group/refs">
                          <summary className="text-[9px] uppercase tracking-wider text-zinc-600 cursor-pointer hover:text-zinc-400">
                            Referencias ({tool.refs.length})
                          </summary>
                          <ul className="mt-1 space-y-0.5 text-[10px] text-zinc-500 leading-tight">
                            {tool.refs.map((r, i) => (
                              <li key={i} className="pl-2 border-l border-zinc-800">{r}</li>
                            ))}
                          </ul>
                        </details>
                      )}
                      {isReady && <div className="mt-3 text-xs text-emerald-400">Abrir →</div>}
                    </div>
                  </Wrapper>
                );
              })}
            </div>
          </div>
        ))}

        <div className="text-xs text-zinc-600 pt-4 border-t border-zinc-900">
          La diferencia con Viktor.ai: cada herramienta tiene correlaciones
          calibradas para suelos costarricenses (andisoles, lateritas,
          vertisoles, cenizas) y aplica las prácticas locales (CFIA,
          LanammeUCR, RSN, CSCR-10 §6).
        </div>

        {/* Global references / bibliography */}
        <section className="mt-8 border border-zinc-800 rounded-lg p-5 bg-zinc-900/40">
          <h2 className="text-lg font-semibold text-zinc-100 mb-1">
            Bibliografía y fuentes de datos
          </h2>
          <p className="text-xs text-zinc-500 mb-4">
            Cada fórmula, factor y default de Costaplanner Geotecnia tiene
            origen en una de estas fuentes. Al imprimir cualquier reporte,
            las referencias aplicables se anexan automáticamente.
          </p>
          <div className="space-y-4">
            {GLOBAL_REFS.map((cat) => (
              <div key={cat.category}>
                <h3 className="text-xs uppercase tracking-wider text-amber-400 mb-2">
                  {cat.category}
                </h3>
                <ul className="space-y-1">
                  {cat.items.map((item, i) => (
                    <li
                      key={i}
                      className="text-xs text-zinc-400 pl-3 border-l border-zinc-800"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-5 pt-4 border-t border-zinc-800 text-[11px] text-zinc-600">
            <strong className="text-zinc-400">Política editorial:</strong>{" "}
            Costaplanner no inventa correlaciones. Si una fórmula no está en
            una referencia publicada, se omite o se marca como{" "}
            <span className="text-amber-400">"investigación"</span>. Cuando
            usamos un valor por defecto (ej. ER = 0.55 para martillo donut
            CR), citamos al autor que lo derivó.
          </div>
        </section>
      </div>
    </main>
  );
}
