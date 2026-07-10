/**
 * Costaplanner landing page.
 *
 * Public-facing. No auth required to see this. The "Empezar" CTA routes
 * to /studio/beam (the Beam Studio that ports from REVARA in Phase 2).
 *
 * Voice: Costa Rican Spanish, technical, direct. No em dashes per
 * project convention.
 */
import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Top nav — gives first-time visitors an obvious path to login */}
      <nav className="border-b border-zinc-800/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-12 flex items-center justify-between">
          <Link href="/" className="text-xs uppercase tracking-widest text-amber-400 hover:text-amber-300">
            Costaplanner
          </Link>
          <div className="flex items-center gap-2 sm:gap-4 text-xs">
            <Link href="/studio" className="text-zinc-400 hover:text-zinc-100 transition-colors">Studio</Link>
            <Link href="/codigo" className="text-zinc-400 hover:text-zinc-100 transition-colors">Código</Link>
            <Link href="/proyectos" className="text-zinc-400 hover:text-zinc-100 transition-colors">Proyectos</Link>
            <Link href="/login" className="px-3 py-1.5 rounded border border-amber-700/40 text-amber-300 hover:bg-amber-500 hover:text-zinc-950 transition-colors">
              Iniciar sesión
            </Link>
            <Link href="/register" className="hidden sm:inline text-zinc-400 hover:text-amber-300 transition-colors">Crear cuenta</Link>
          </div>
        </div>
      </nav>
      <div className="max-w-4xl mx-auto px-6 py-16">
        {/* Hero */}
        <div className="mb-16">
          <div className="text-xs uppercase tracking-widest text-amber-400 mb-3">
            Costaplanner
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 leading-tight">
            Diseño estructural para Costa Rica
            <span className="hidden md:inline">, </span>
            <span className="block md:inline text-amber-300">con cada fórmula a la vista.</span>
          </h1>
          <p className="text-lg text-zinc-400 max-w-2xl">
            Diseña vigas, columnas, zapatas y losas conforme al CSCR-10 Rev. 2014
            y ACI 318-14. Cada paso de cálculo se muestra como una ecuación
            renderizada, con citas al código y verificación en vivo.
          </p>
          <div className="flex gap-3 mt-8 flex-wrap">
            <Link
              href="/studio"
              className="inline-flex items-center px-6 py-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold transition-colors"
            >
              Ver elementos →
            </Link>
            <Link
              href="/studio/beam"
              className="inline-flex items-center px-6 py-3 rounded-lg border border-amber-700/60 hover:border-amber-500 text-amber-200 transition-colors"
            >
              Empezar con viga
            </Link>
            <Link
              href="/mis-disenos"
              className="inline-flex items-center px-6 py-3 rounded-lg border border-zinc-700 hover:border-zinc-500 text-zinc-200 transition-colors"
            >
              Mis diseños
            </Link>
          </div>
        </div>

        {/* Three-pillar value props */}
        <div className="grid md:grid-cols-3 gap-6 mb-16">
          <div className="border border-zinc-800 rounded-lg p-5">
            <div className="text-amber-400 text-xs uppercase tracking-wider mb-2">
              01 · Códigos locales
            </div>
            <h3 className="font-semibold mb-2">CSCR-10 + ACI 318 + INTE C85</h3>
            <p className="text-sm text-zinc-400">
              No es una calculadora genérica. Cita cada artículo del código
              costarricense, con f&apos;c mínimo por zona sísmica y A706
              obligatorio en zonas III-IV.
            </p>
          </div>
          <div className="border border-zinc-800 rounded-lg p-5">
            <div className="text-amber-400 text-xs uppercase tracking-wider mb-2">
              02 · Cada fórmula a la vista
            </div>
            <h3 className="font-semibold mb-2">Mathcad para ingeniería</h3>
            <p className="text-sm text-zinc-400">
              19 pasos para una viga, cada uno con su ecuación LaTeX, sus
              variables coloreadas por origen y su resultado verificado contra
              el código.
            </p>
          </div>
          <div className="border border-zinc-800 rounded-lg p-5">
            <div className="text-amber-400 text-xs uppercase tracking-wider mb-2">
              03 · Memorando listo
            </div>
            <h3 className="font-semibold mb-2">PDF + Excel + sello CFIA</h3>
            <p className="text-sm text-zinc-400">
              Exporta una memoria de cálculo lista para trámite municipal y
              firma profesional. Soporta organización con varios proyectos.
            </p>
          </div>
        </div>

        <div className="border-t border-zinc-800 pt-6 text-xs text-zinc-500">
          Hecho en Costa Rica · 2026 ·{" "}
          <Link
            href="https://revara-ruby.vercel.app"
            className="hover:text-amber-300"
          >
            REVARA
          </Link>{" "}
          (gestión de obra) · Costaplanner (diseño estructural)
        </div>
      </div>
    </main>
  );
}
