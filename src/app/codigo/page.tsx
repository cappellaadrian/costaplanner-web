"use client";

/**
 * /codigo — Referencia visual completa CSCR-10 + ACI 318.
 *
 * 8 secciones organizadas como tabs verticales:
 *   1. Diseño Simplificado (CSCR §17) — para casas de 1-2 pisos
 *   2. Vigas (CSCR §8 + ACI §9, §18.6)
 *   3. Columnas (CSCR §18.7 + ACI §10)
 *   4. Cimentaciones (ACI §13)
 *   5. Losas (ACI §7-8)
 *   6. Muros y muros de contención (ACI §18.10 + Rankine + Brinch Hansen)
 *   7. Detallado (ACI §25 + CSCR §8.6)
 *   8. Materiales y zonificación CR (CSCR §6 + INTE C85)
 */

import { useState } from "react";
import Link from "next/link";

type TabKey =
  | "simplificado" | "vigas" | "columnas" | "cimentaciones"
  | "losas" | "muros" | "detallado" | "materiales";

// IMPORTANT: keyed by `cite`, NOT `ref` — `ref` is a reserved React prop name
// that crashes function components with React error #290 in production.
const TABS: { key: TabKey; title: string; cite: string }[] = [
  { key: "simplificado", title: "Diseño Simplificado", cite: "CSCR §17" },
  { key: "vigas", title: "Vigas", cite: "CSCR §8 + ACI §9, §18.6" },
  { key: "columnas", title: "Columnas", cite: "CSCR §18.7 + ACI §10" },
  { key: "cimentaciones", title: "Cimentaciones", cite: "ACI §13 + CSCR §17.5" },
  { key: "losas", title: "Losas", cite: "ACI §7–8" },
  { key: "muros", title: "Muros estructurales y de contención", cite: "ACI §18.10 + Rankine" },
  { key: "detallado", title: "Detallado: ganchos, traslapes, recubrimiento", cite: "ACI §25 + CSCR §8.6" },
  { key: "materiales", title: "Materiales y zonificación CR", cite: "CSCR §6 + INTE C85" },
];

export default function CodigoPage() {
  const [active, setActive] = useState<TabKey>("simplificado");

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="max-w-7xl mx-auto p-4 lg:p-6">
        <div className="mb-6">
          <div className="text-xs uppercase tracking-widest text-amber-400 mb-1">
            <Link href="/studio" className="hover:text-amber-300">← Studio</Link>
          </div>
          <h1 className="text-2xl font-semibold">
            Referencia CSCR-10 + ACI 318
          </h1>
          <p className="text-sm text-zinc-400 mt-1 max-w-2xl">
            Manual visual interactivo. Cada sección tiene diagramas, tablas y
            enlaces a las calculadoras correspondientes en Studio.
          </p>
          <div className="text-[10px] text-zinc-600 mt-2 font-mono">
            Build {(process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? "local").slice(0, 7)} · {process.env.NEXT_PUBLIC_BUILD_DATE ?? new Date().toISOString().slice(0, 10)} · CSCR-10 Rev. 2014 + ACI 318-14
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
          <nav className="lg:sticky lg:top-6 lg:self-start">
            <ul className="space-y-1">
              {TABS.map((t) => (
                <li key={t.key}>
                  <button
                    onClick={() => setActive(t.key)}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                      active === t.key
                        ? "bg-amber-500/15 text-amber-200 border border-amber-700/40"
                        : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
                    }`}
                  >
                    <div>{t.title}</div>
                    <div className="text-[10px] text-zinc-600 mt-0.5">{t.cite}</div>
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          <article className="max-w-3xl space-y-4">
            {active === "simplificado" && <SimplificadoTab />}
            {active === "vigas" && <VigasTab />}
            {active === "columnas" && <ColumnasTab />}
            {active === "cimentaciones" && <CimentacionesTab />}
            {active === "losas" && <LosasTab />}
            {active === "muros" && <MurosTab />}
            {active === "detallado" && <DetalladoTab />}
            {active === "materiales" && <MaterialesTab />}
          </article>
        </div>
      </div>
    </main>
  );
}

// `cite` instead of `ref` — see TABS comment above.
function Block({ title, cite, children }: { title: string; cite?: string; children: React.ReactNode }) {
  return (
    <section className="border border-zinc-800 rounded-lg p-5 bg-zinc-900/40 space-y-3">
      <div className="flex items-baseline justify-between gap-3 flex-wrap pb-2 border-b border-zinc-800">
        <h2 className="text-lg font-semibold text-zinc-100">{title}</h2>
        {cite && <span className="text-[11px] text-amber-400 italic">{cite}</span>}
      </div>
      <div className="text-sm text-zinc-300 leading-relaxed space-y-3">{children}</div>
    </section>
  );
}

/**
 * Render plain-text math by converting `X_y` patterns into <X><sub>y</sub></X>,
 * so `V_b` shows as V with subscript b instead of literal `V_b`. The regex
 * matches a run of unicode letters (Latin or Greek) followed by `_` and a
 * run of letters/digits/commas — this handles `V_b`, `d_w`, `L_muro`,
 * `A_st,req`, `α_c`, `M_pr,izq`, `dim_menor`, etc. The original spaces
 * and unicode operators (·, ², √, ≥, etc.) pass through untouched.
 */
function renderSubscripts(math: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  // Latin (a-z, A-Z) + Greek letters commonly used in CR engineering notation.
  // No `u` flag because tsconfig target is below ES2018 (which is where
  // \p{...} unicode property escapes became available).
  const LETTERS = "a-zA-Z\\u03B1-\\u03C9\\u0391-\\u03A9";
  const regex = new RegExp(`([${LETTERS}]+)_([${LETTERS}0-9,]+)`, "g");
  let lastIdx = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = regex.exec(math)) !== null) {
    if (m.index > lastIdx) out.push(math.slice(lastIdx, m.index));
    out.push(
      <span key={`s${key++}`}>
        {m[1]}
        <sub className="text-[0.78em] text-amber-200/90">{m[2]}</sub>
      </span>,
    );
    lastIdx = m.index + m[0].length;
  }
  if (lastIdx < math.length) out.push(math.slice(lastIdx));
  return out;
}

function Eq({ math }: { math: string }) {
  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded p-3 my-2 overflow-x-auto">
      <span className="text-amber-300 text-sm font-mono whitespace-pre">
        {renderSubscripts(math)}
      </span>
    </div>
  );
}

function Inline({ math }: { math: string }) {
  return (
    <span className="text-amber-300 text-[0.9em] font-mono">
      {renderSubscripts(math)}
    </span>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return <li className="ml-5 list-disc marker:text-amber-500 text-sm">{children}</li>;
}

function TryLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-amber-300 hover:text-amber-200 underline-offset-2 hover:underline">
      {children} →
    </Link>
  );
}

// ===========================================================================
// Tabs
// ===========================================================================

function SimplificadoTab() {
  return (
    <>
      <Block title="¿Cuándo aplica el Método Simplificado?" cite="CSCR §17.1">
        <p>
          Es un atajo del código sísmico costarricense, válido SOLO para edificaciones
          que cumplan TODOS los siguientes límites:
        </p>
        <ul>
          <Bullet>Hasta <strong>2 pisos</strong> (planta baja + un nivel).</Bullet>
          <Bullet>Altura total ≤ <strong>8 m</strong>.</Bullet>
          <Bullet>Vivienda, oficina, comercio menor, aula (NO hospitales, NO industrias pesadas).</Bullet>
          <Bullet>Sistema sismorresistente predominantemente de <strong>muros</strong> (mampostería integral o concreto reforzado).</Bullet>
          <Bullet>Planta regular y altura regular.</Bullet>
        </ul>
        <p className="text-zinc-400 text-xs italic">
          Si NO cumple uno solo, NO uses el simplificado. Usa análisis modal espectral (CSCR §7).
        </p>
      </Block>
      <Block title="Densidad mínima de muros" cite="CSCR §17.3">
        <p>La densidad de muros en cada dirección principal:</p>
        <Eq math="d_w  =  Σ L_muro  /  A_piso" />
        <table className="w-full text-xs my-3">
          <thead><tr className="text-zinc-500 border-b border-zinc-800">
            <th className="text-left py-1 px-2 font-normal">Zona</th>
            <th className="text-right py-1 px-2 font-normal">1 piso</th>
            <th className="text-right py-1 px-2 font-normal">2 pisos (PB)</th>
          </tr></thead>
          <tbody className="font-mono">
            <tr className="border-b border-zinc-800/60"><td className="py-1 px-2">II</td><td className="py-1 px-2 text-right text-emerald-300">0.025</td><td className="py-1 px-2 text-right text-emerald-300">0.035</td></tr>
            <tr className="border-b border-zinc-800/60"><td className="py-1 px-2">III</td><td className="py-1 px-2 text-right text-emerald-300">0.030</td><td className="py-1 px-2 text-right text-emerald-300">0.045</td></tr>
            <tr><td className="py-1 px-2">IV</td><td className="py-1 px-2 text-right text-emerald-300">0.040</td><td className="py-1 px-2 text-right text-emerald-300">0.055</td></tr>
          </tbody>
        </table>
      </Block>
      <Block title="Cortante basal simplificado" cite="CSCR §17.4">
        <Eq math="V_b  =  C_s · W" />
        <p>Distribución en 2 pisos: <Inline math="V_1 = V_2 = 0.5 V_b" />.</p>
      </Block>
    </>
  );
}

function VigasTab() {
  return (
    <>
      <Block title="Predimensionado de viga" cite="ACI 318-14 §9.3">
        <p>Reglas de pulgar para fijar dimensiones antes de calcular:</p>
        <Eq math="h  =  L/10  a  L/12" />
        <Eq math="b  =  h/2  a  h/3" />
        <p>Viga típica de 5 m de luz: h = 45 cm, b = 25 cm.</p>
        <div className="text-xs text-zinc-500 italic">
          <TryLink href="/studio/beam">Calculadora de viga</TryLink>
        </div>
      </Block>
      <Block title="Procedimiento de flexión (15 pasos)" cite="ACI §22.2">
        <p>Para cada sección crítica (apoyo y centro):</p>
        <ol className="list-decimal ml-5 text-sm space-y-1">
          <li>Calcular Mu con la combinación gobernante</li>
          <li>Determinar φ = 0.90 (controlada por tracción)</li>
          <li>Calcular Rn = Mu/(φ·b·d²)</li>
          <li>Calcular m = fy/(0.85·f'c)</li>
          <li>arg = 2m·Rn/fy</li>
          <li>Si 1−arg ≥ 0: viga simplemente reforzada</li>
          <li>ρ_req = (1/m)·(1−√(1−arg))</li>
          <li>As_req = ρ_req·b·d</li>
          <li>As_min_flex = (14/fy)·b·d ó 0.79√f'c/fy·b·d (mayor)</li>
          <li>As_min_temp = 0.0018·b·h</li>
          <li>As_diseño = max de los anteriores</li>
        </ol>
      </Block>
      <Block title="Vigas dúctiles — 6 verificaciones geométricas" cite="CSCR §8.2.1">
        <ul>
          <Bullet>Parte de sistema sismorresistente</Bullet>
          <Bullet>Pu ≤ 0.10 · f'c · Ag / 1000 ton</Bullet>
          <Bullet>L_libre &gt; 4d</Bullet>
          <Bullet>b/h ≥ 0.30</Bullet>
          <Bullet>b ≥ 25 cm</Bullet>
          <Bullet>b ≤ b_columna + 3h</Bullet>
        </ul>
      </Block>
      <Block title="Capacidad por diseño Ve (capacity design)" cite="CSCR §8.3.4">
        <p>En lugar del Vu elástico, se calcula el cortante asociado a la formación de rótulas plásticas:</p>
        <Eq math="V_e  =  ( M_pr,izq + M_pr,der )  /  L_libre  +  V_g" />
        <p>donde Mpr usa fy_pr = 1.25·fy (sobreesfuerzo).</p>
        <p className="text-zinc-400 text-xs italic">
          Esto garantiza que la falla por cortante NUNCA precede a la flexión: el acero a flexión fluye primero, dando aviso.
        </p>
      </Block>
    </>
  );
}

function ColumnasTab() {
  return (
    <>
      <Block title="Diseño axial simplificado" cite="ACI §22.4.2">
        <p>Para columnas con momento bajo (Mu/(Pu·h/100) ≤ 0.10):</p>
        <Eq math="A_st,req  =  ( P_u/φ  −  0.85 · f'c · A_g )  /  ( f_y  −  0.85 · f'c )" />
        <p>Si la excentricidad supera 0.10, requiere diagrama de interacción P-M completo.</p>
        <div className="text-xs text-zinc-500 italic">
          <TryLink href="/studio/rectangular-column">Calculadora columna rectangular</TryLink> ·{" "}
          <TryLink href="/studio/circular-column">Columna circular</TryLink>
        </div>
      </Block>
      <Block title="Confinamiento sísmico" cite="ACI §18.7.5">
        <Eq math="l_o  =  max( h,  L/6,  45 cm )" />
        <Eq math="s_conf  =  min( 0.25 · dim_menor,  6·d_b,  s_o,  10 cm )" />
        <p>En zona III-IV, este confinamiento es CRÍTICO — la falla sísmica de columnas es lo que ha colapsado edificios completos en CR históricamente.</p>
      </Block>
      <Block title="Cuantía longitudinal" cite="ACI §10.6.1">
        <ul>
          <Bullet>ρ_min = 1% de Ag</Bullet>
          <Bullet>ρ_max = 8% (estático), 6% (zona III-IV)</Bullet>
          <Bullet>Mínimo 4 barras (rectangulares), 6 barras (circulares)</Bullet>
        </ul>
      </Block>
    </>
  );
}

function CimentacionesTab() {
  return (
    <>
      <Block title="Zapata aislada — 6 verificaciones" cite="ACI §13">
        <ol className="list-decimal ml-5 text-sm space-y-1">
          <li>Presión del suelo q_max ≤ q_adm</li>
          <li>Cortante en una dirección a d de la cara</li>
          <li>Cortante por punzonamiento a d/2 (perímetro b_o)</li>
          <li>Flexión en dirección B (lado corto)</li>
          <li>Flexión en dirección L (lado largo)</li>
          <li>Conexión columna-zapata (aplastamiento + anclaje)</li>
        </ol>
        <div className="text-xs text-zinc-500 italic">
          <TryLink href="/studio/isolated-footing">Calculadora zapata aislada</TryLink>
        </div>
      </Block>
      <Block title="Viga de amarre obligatoria" cite="CSCR §18.12">
        <p>En zonas sísmicas III-IV, TODA zapata debe conectarse a las demás con vigas de amarre que resistan tracción/compresión sísmica entre cimientos.</p>
        <ul>
          <Bullet>b ≥ 20 cm</Bullet>
          <Bullet>h ≥ 40 cm</Bullet>
          <Bullet>4 #5 mínimo (2 sup + 2 inf)</Bullet>
          <Bullet>Estribos #3 @ 20 cm en toda la longitud</Bullet>
        </ul>
        <div className="text-xs text-zinc-500 italic">
          <TryLink href="/studio/tie-beam">Calculadora viga de amarre</TryLink>
        </div>
      </Block>
    </>
  );
}

function LosasTab() {
  return (
    <>
      <Block title="Losa en una dirección" cite="ACI §7-8 + §6.5.2">
        <p>Cuando L_largo/L_corto ≥ 2, la losa actúa principalmente en la dirección corta. Se diseña por franja de 1 m.</p>
        <Eq math="M_u  =  C_m · w_u · L_n²" />
        <table className="w-full text-xs my-3">
          <thead><tr className="text-zinc-500 border-b border-zinc-800">
            <th className="text-left py-1 px-2 font-normal">Posición</th>
            <th className="text-right py-1 px-2 font-normal">C_m</th>
          </tr></thead>
          <tbody className="font-mono">
            <tr><td className="py-1 px-2">Apoyo exterior empotrado</td><td className="py-1 px-2 text-right text-emerald-300">−1/16</td></tr>
            <tr><td className="py-1 px-2">Primer interior (3+ luces)</td><td className="py-1 px-2 text-right text-emerald-300">−1/10</td></tr>
            <tr><td className="py-1 px-2">Primer claro positivo</td><td className="py-1 px-2 text-right text-emerald-300">+1/14</td></tr>
            <tr><td className="py-1 px-2">Claro interior positivo</td><td className="py-1 px-2 text-right text-emerald-300">+1/16</td></tr>
          </tbody>
        </table>
        <div className="text-xs text-zinc-500 italic">
          <TryLink href="/studio/one-way-slab">Calculadora losa 1-dir</TryLink>
        </div>
      </Block>
      <Block title="Losa en dos direcciones — Método 3" cite="ACI 318-63 Method 3">
        <p>Cuando L_largo/L_corto &lt; 2. Coeficientes tabulados según condición de borde (9 casos). Costaplanner implementa Caso 2 (un borde corto discontinuo) por ahora.</p>
        <div className="text-xs text-zinc-500 italic">
          <TryLink href="/studio/two-way-slab">Calculadora losa 2-dir</TryLink>
        </div>
      </Block>
    </>
  );
}

function MurosTab() {
  return (
    <>
      <Block title="Muro de corte (shear wall)" cite="ACI §18.10">
        <Eq math="φ·V_n  =  φ · A_cv · ( α_c · √f'c  +  ρ_t · f_y )" />
        <p>α_c depende de hw/lw: 0.80 si hw/lw ≤ 1.5, 0.53 si ≥ 2.0, interpolación entre.</p>
        <p>Una cortina hasta t = 20 cm; doble cortina obligatoria si t ≥ 20 cm o zona III-IV.</p>
        <div className="text-xs text-zinc-500 italic">
          <TryLink href="/studio/shear-wall">Calculadora muro de corte</TryLink>
        </div>
      </Block>
      <Block title="Muro de contención en voladizo" cite="Rankine + Brinch Hansen">
        <p>Verificaciones de estabilidad:</p>
        <ul>
          <Bullet>FS al volcamiento ≥ 1.5 (estático)</Bullet>
          <Bullet>FS al deslizamiento ≥ 1.5 con μ = 0.55 ó tan(2/3·φ)</Bullet>
          <Bullet>e ≤ B/6 para distribución trapezoidal</Bullet>
          <Bullet>q_max ≤ q_adm del suelo</Bullet>
          <Bullet>FS_scc ≥ 3.0 contra capacidad de carga última</Bullet>
        </ul>
        <Eq math="K_a  =  tan²( 45° − φ/2 )" />
        <Eq math="E_1  =  ½ · γ · H² · K_a" />
        <div className="text-xs text-zinc-500 italic">
          <TryLink href="/studio/retaining-wall">Calculadora muro de contención con 11 diagramas reactivos</TryLink>
        </div>
      </Block>
    </>
  );
}

function DetalladoTab() {
  return (
    <>
      <Block title="Recubrimiento mínimo" cite="ACI §20.6.1">
        <ul>
          <Bullet><strong>7.5 cm</strong> — concreto en contacto con suelo (zapatas)</Bullet>
          <Bullet><strong>5.0 cm</strong> — muros expuestos a intemperie</Bullet>
          <Bullet><strong>4.0 cm</strong> — vigas y columnas expuestas</Bullet>
          <Bullet><strong>2.0 cm</strong> — losas y muros interiores</Bullet>
        </ul>
      </Block>
      <Block title="Ganchos sísmicos 135°" cite="ACI §25.3 + CSCR §8.6">
        <svg viewBox="0 0 360 160" className="w-full max-w-md">
          <g transform="translate(30, 30)">
            <text x="0" y="0" fill="#10b981" fontSize="11" fontWeight="700">✓ 135° (sísmico)</text>
            <line x1="0" y1="30" x2="60" y2="30" stroke="#10b981" strokeWidth="2.5" />
            <line x1="60" y1="30" x2="76" y2="14" stroke="#10b981" strokeWidth="2.5" />
            <text x="0" y="62" fill="#a1a1aa" fontSize="9" fontFamily="ui-monospace, monospace">
              Ext = max(6db, 7.5 cm)
            </text>
          </g>
          <g transform="translate(200, 30)">
            <text x="0" y="0" fill="#ef4444" fontSize="11" fontWeight="700">✗ 90° (no permitido en III-IV)</text>
            <line x1="0" y1="30" x2="60" y2="30" stroke="#ef4444" strokeWidth="2.5" />
            <line x1="60" y1="30" x2="60" y2="0" stroke="#ef4444" strokeWidth="2.5" />
            <line x1="-5" y1="0" x2="70" y2="60" stroke="#ef4444" strokeWidth="2" />
            <line x1="-5" y1="60" x2="70" y2="0" stroke="#ef4444" strokeWidth="2" />
            <text x="0" y="92" fill="#a1a1aa" fontSize="9" fontFamily="ui-monospace, monospace">
              Se abre bajo carga cíclica
            </text>
          </g>
        </svg>
      </Block>
      <Block title="Longitud de traslape (lap splice)" cite="ACI §25.5">
        <Eq math="l_st  =  1.3 · l_d  ≥  30 cm" />
        <p>Nunca se permite empalmar en zona confinada de columnas o vigas dúctiles. Se ubican en el tercio central.</p>
      </Block>
    </>
  );
}

function MaterialesTab() {
  return (
    <>
      <Block title="f'c mínimo por zona sísmica" cite="CSCR §6 + INTE C85:2017">
        <table className="w-full text-xs my-3">
          <thead><tr className="text-zinc-500 border-b border-zinc-800">
            <th className="text-left py-1 px-2 font-normal">Zona</th>
            <th className="text-right py-1 px-2 font-normal">f'c mín (kg/cm²)</th>
            <th className="text-left py-1 px-2 font-normal">Acero</th>
          </tr></thead>
          <tbody className="font-mono">
            <tr className="border-b border-zinc-800/60"><td className="py-1 px-2">I-II</td><td className="py-1 px-2 text-right text-emerald-300">210</td><td className="py-1 px-2 text-amber-300">ASTM A615 G60</td></tr>
            <tr className="border-b border-zinc-800/60"><td className="py-1 px-2">III</td><td className="py-1 px-2 text-right text-emerald-300">245</td><td className="py-1 px-2 text-amber-300">ASTM A706 G60</td></tr>
            <tr><td className="py-1 px-2">IV</td><td className="py-1 px-2 text-right text-emerald-300">280</td><td className="py-1 px-2 text-amber-300">ASTM A706 G60</td></tr>
          </tbody>
        </table>
        <p className="text-xs text-zinc-500 italic">A706 garantiza fy ≤ 5600 kg/cm² y soldabilidad — ambos requisitos para diseño dúctil.</p>
      </Block>
      <Block title="Mapa de zonificación sísmica de Costa Rica" cite="CSCR §2.1 + Mapa Anexo A">
        <ul>
          <Bullet><strong>Zona II</strong> — Caribe norte, Guanacaste interior. PGA ≈ 0.20 g</Bullet>
          <Bullet><strong>Zona III</strong> — Valle Central, Caribe sur, Pacífico norte interior. PGA ≈ 0.30 g</Bullet>
          <Bullet><strong>Zona IV</strong> — Costa pacífica completa (Nicoya, Quepos, Osa), Limón. PGA ≈ 0.40 g</Bullet>
        </ul>
        <p className="text-xs text-zinc-500 italic">Costa Rica está completamente en zonificación moderada-alta. Verifica el mapa oficial del CSCR antes de proyectar.</p>
      </Block>
    </>
  );
}
