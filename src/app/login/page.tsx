"use client";

import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const from = params.get("from"); // "revara" indicates cross-app SSO hint
  const next = params.get("next") || "/studio/beam";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const r = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    if (r?.error) {
      setError("Credenciales incorrectas. Verifica tu correo y contraseña.");
      setLoading(false);
    } else {
      router.push(next);
      router.refresh();
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="text-xs uppercase tracking-widest text-amber-400 mb-2">
            Costaplanner
          </div>
          <h1 className="text-2xl font-bold text-zinc-100">Iniciar sesión</h1>
          {from === "revara" && (
            <p className="text-xs text-zinc-500 mt-2">
              Usa la misma cuenta de REVARA. Las credenciales son compartidas.
            </p>
          )}
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 border border-zinc-800 rounded-xl bg-zinc-900/40 p-6"
        >
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-wider text-zinc-500">
              Correo electrónico
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-zinc-950 text-zinc-100 border border-zinc-800 rounded px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
              placeholder="tu@correo.com"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-wider text-zinc-500">
              Contraseña
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-zinc-950 text-zinc-100 border border-zinc-800 rounded px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="text-xs text-red-400 border border-red-900/40 bg-red-950/20 rounded px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 font-semibold py-2 rounded transition-colors text-sm"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <p className="text-center text-xs text-zinc-500 mt-6">
          ¿Sin cuenta?{" "}
          <Link href="/register" className="text-amber-300 hover:text-amber-200">
            Crear cuenta
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <>
      <noscript>
        <div style={{
          minHeight: "100vh",
          background: "#09090b",
          color: "#f4f4f5",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
          fontFamily: "system-ui, sans-serif",
        }}>
          <div style={{ maxWidth: "28rem", textAlign: "center" }}>
            <div style={{
              fontSize: "0.75rem",
              textTransform: "uppercase",
              letterSpacing: "0.15em",
              color: "#fbbf24",
              marginBottom: "0.75rem",
            }}>Costaplanner</div>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 600, marginBottom: "1rem" }}>
              Necesitas activar JavaScript
            </h1>
            <p style={{ fontSize: "0.875rem", color: "#a1a1aa", lineHeight: 1.6 }}>
              El formulario de inicio de sesión usa NextAuth en el cliente.
              Por favor habilita JavaScript en tu navegador y recarga la página.
            </p>
            <p style={{ fontSize: "0.75rem", color: "#71717a", marginTop: "1rem" }}>
              ¿Sin JavaScript en tu organización? Escríbenos a
              {" "}<a href="mailto:cappellaadrian@gmail.com" style={{ color: "#fbbf24" }}>
                cappellaadrian@gmail.com
              </a> y habilitamos un acceso alterno.
            </p>
          </div>
        </div>
      </noscript>
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </>
  );
}
