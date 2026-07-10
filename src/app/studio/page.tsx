"use client";

/**
 * /studio — catálogo de calculadoras estructurales y geotécnicas Costaplanner.
 * Cada tile tiene su /studio/<slug> con cálculo en vivo + diagrama + tabla de refuerzo.
 * Incluye: 12 elementos base + 4 sísmico ACI §18 + 5 cimentaciones especiales +
 * 5 verificaciones de servicio + 9 geotech + 1 Diseño Rápido CSCR §17 + Casa Demo.
 */
import Link from "next/link";

interface ElementTile {
  slug: string;
  name: string;
  description: string;
  badge?: "Listo" | "NUEVO";
}

interface ElementGroup {
  name: string;
  items: ElementTile[];
}

const GROUPS: ElementGroup[] = [
  {
    name: "Cimentaciones",
    items: [
      { slug: "isolated-footing", name: "Zapata aislada", description: "Presión, 1-dir, punzonamiento y flexión. ACI §13." },
      { slug: "strip-footing", name: "Zapata corrida", description: "Cimiento continuo bajo muros por metro lineal." },
      { slug: "retaining-wall", name: "Muro de contención", description: "Voladizo. Empuje activo, vuelco, deslizamiento, Brinch Hansen. 11 diagramas." },
      { slug: "tie-beam", name: "Viga de amarre", description: "Viga sísmica conectando cimientos. CSCR §18.12." },
    ],
  },
  {
    name: "Columnas",
    items: [
      { slug: "rectangular-column", name: "Columna rectangular", description: "Compresión axial + confinamiento sísmico ACI §10/§18.7." },
      { slug: "circular-column", name: "Columna circular", description: "Compresión axial con espiral. ACI §10 + §25.7.3." },
    ],
  },
  {
    name: "Vigas",
    items: [
      { slug: "beam", name: "Viga", description: "Flexión rectangular ACI §9. 19 pasos en vivo + KaTeX." },
      { slug: "lintel", name: "Dintel", description: "Viga sobre vano. Detección automática de viga profunda." },
    ],
  },
  {
    name: "Losas",
    items: [
      { slug: "one-way-slab", name: "Losa en una dirección", description: "Coeficientes ACI §6.5.2. Diseño por franja de 1 m." },
      { slug: "two-way-slab", name: "Losa en dos direcciones", description: "Método 3 (ACI 318-63). Caso 2 tabulado." },
      { slug: "stair-slab", name: "Losa de escalera", description: "Losa inclinada + ergonomía 2C+H." },
    ],
  },
  {
    name: "Muros",
    items: [
      { slug: "shear-wall", name: "Muro de corte", description: "Flexión + corte + cuantías mínimas. ACI §18.10." },
    ],
  },
  {
    name: "Cumplimiento sísmico ACI §18 / CSCR §8",
    items: [
      { slug: "beam-column-joint", name: "Conexión viga-columna", description: "Strong-column-weak-beam, cortante de nudo γ·√f'c·Aj. ACI §18.7.3 + §18.8.", badge: "NUEVO" },
      { slug: "diafragma", name: "Diafragma", description: "Cordones + colectores + cortante. ACI §18.12 · ASCE 7 §12.10.", badge: "NUEVO" },
      { slug: "esbeltez-columna", name: "Esbeltez de columna", description: "Clasificación + magnificación δns·M2. ACI §6.2.5 + §6.6.4.", badge: "NUEVO" },
      { slug: "punzonamiento-momento", name: "Punzonamiento con momento", description: "Transferencia Vu + Mu, γv·Mu·c/Jc. ACI §8.4.4 + §22.6.5.", badge: "NUEVO" },
    ],
  },
  {
    name: "Cimentaciones especiales · mampostería · detallado",
    items: [
      { slug: "combined-footing", name: "Zapata combinada", description: "Dos columnas, análisis viga-sobre-suelo. ACI §13.3 · Bowles §10.", badge: "NUEVO" },
      { slug: "mat-foundation", name: "Losa de fundación (mat)", description: "Método rígido, presión esquinas, Winkler. ACI 336.2R-88 · Bowles §16.", badge: "NUEVO" },
      { slug: "pile-cap", name: "Pilote + cabezal", description: "Capacidad de pilote, strut-and-tie. ACI §13.4 + §23 · AASHTO §10.7.", badge: "NUEVO" },
      { slug: "confined-masonry", name: "Mampostería confinada", description: "Bloques, columnas y vigas de confinamiento. CSCR-10 §10 · INTE C5.", badge: "NUEVO" },
      { slug: "desarrollo-empalmes", name: "Desarrollo y empalmes", description: "ℓd, ℓdh, ℓdc, ℓst. ACI §25.4 + §25.5 · CSCR §8.2.1.", badge: "NUEVO" },
    ],
  },
  {
    name: "Verificaciones de servicio y refinamientos",
    items: [
      { slug: "flexion-biaxial", name: "Flexión biaxial (columna)", description: "Bresler recíproco + load contour. ACI §22.4 · PCA Notes §12.7.", badge: "NUEVO" },
      { slug: "torsion-viga", name: "Torsión en viga", description: "V + T + M combinados, Al longitudinal. ACI §22.7 + §9.5.4.", badge: "NUEVO" },
      { slug: "deflexion-largo-plazo", name: "Deflexión a largo plazo", description: "Branson Ie + λΔ, límites L/240..L/480. ACI §24.2 + Table 24.2.2.", badge: "NUEVO" },
      { slug: "fisuracion", name: "Control de fisuración", description: "s_max ACI §24.3 + Frosch + Gergely-Lutz. Ancho de fisura.", badge: "NUEVO" },
      { slug: "strut-tie", name: "Strut-and-tie completo", description: "Ménsula + viga profunda + cabezal. ACI §23 · Schlaich et al. (1987).", badge: "NUEVO" },
    ],
  },
];

export default function StudioIndexPage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="text-xs uppercase tracking-widest text-amber-400 mb-1">
              Costaplanner Studio
            </div>
            <h1 className="text-3xl font-semibold">Elementos estructurales</h1>
            <p className="text-sm text-zinc-400 mt-2 max-w-2xl">
              Diseño en vivo estilo Mathcad — cada fórmula, cada referencia al
              código, y propagación inmediata cuando editas un dato. Aplicable a
              CSCR-10 Rev. 2014 + ACI 318-14.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <a
              href="/studio/proyecto"
              className="inline-flex items-center px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-sm font-bold transition-colors"
            >
              🏠 Proyecto completo →
            </a>
            <a
              href="/studio/geotecnica"
              className="inline-flex items-center px-4 py-2 rounded-lg border border-emerald-700/60 hover:border-emerald-500 text-emerald-200 text-sm transition-colors"
            >
              🌱 Geotecnia →
            </a>
            <a
              href="/codigo"
              className="inline-flex items-center px-4 py-2 rounded-lg border border-amber-700/60 hover:border-amber-500 text-amber-200 text-sm transition-colors"
            >
              Referencia CSCR-10 + ACI 318 →
            </a>
          </div>
        </div>

        {/* Headline: Diseño Rápido CSCR §17 */}
        <div className="space-y-2">
          <h2 className="text-xs uppercase tracking-widest text-emerald-400 mt-2">
            🏠 Diseño Rápido — vivienda CR
          </h2>
          <Link href="/studio/diseno-rapido">
            <div className="rounded-xl border-2 border-emerald-700/60 bg-gradient-to-br from-emerald-900/40 via-emerald-950/60 to-zinc-900 hover:from-emerald-800/50 hover:border-emerald-500 p-6 transition-colors">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-[260px]">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-xl font-semibold text-emerald-100">
                      Diseña tu casa CR en 7 pantallas
                    </h3>
                    <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border bg-amber-900/40 text-amber-300 border-amber-700">
                      NUEVO
                    </span>
                  </div>
                  <p className="text-sm text-emerald-200/80 leading-relaxed max-w-2xl">
                    Especifica área + zona sísmica + sistema, y obtén
                    predimensionado completo de vigas, columnas, losas, zapatas
                    y muros — más cantidades preliminares y memoria CFIA-ready.
                    Usa CSCR-10 §17 (Diseño Simplificado) intencionalmente conservador.
                  </p>
                  <div className="mt-3 text-xs text-emerald-300">
                    Vigas · Columnas · Losas · Zapatas · Mampostería confinada · Cantidades · PDF →
                  </div>
                </div>
                <div className="text-5xl shrink-0">🏗️</div>
              </div>
            </div>
          </Link>
        </div>

        {GROUPS.map((group) => (
          <div key={group.name} className="space-y-2">
            <h2 className="text-xs uppercase tracking-widest text-zinc-500 mt-2">
              {group.name}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {group.items.map((el) => {
                const badge = el.badge ?? "Listo";
                const badgeCls = badge === "NUEVO"
                  ? "bg-amber-900/40 text-amber-300 border-amber-700"
                  : "bg-emerald-900/40 text-emerald-300 border-emerald-800";
                return (
                  <Link key={el.slug} href={`/studio/${el.slug}`}>
                    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 hover:border-amber-700 hover:bg-zinc-900 p-4 h-full transition-colors">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="text-sm font-semibold text-zinc-100">{el.name}</h3>
                        <span className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 border ${badgeCls}`}>
                          {badge}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 leading-relaxed">{el.description}</p>
                      <div className="mt-3 text-xs text-amber-400">Abrir →</div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}

        <div className="text-xs text-zinc-600 pt-4 border-t border-zinc-900">
          ¿Necesitas un elemento que no aparece? Escribe a soporte@costaplanner.com.
        </div>
      </div>
    </main>
  );
}
