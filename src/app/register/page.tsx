"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    company: "",
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const r = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const body = await r.json();
    if (!r.ok) {
      setError(body.error ?? "No se pudo crear la cuenta.");
      setLoading(false);
      return;
    }

    // Auto-login after successful registration
    const signed = await signIn("credentials", {
      email: form.email,
      password: form.password,
      redirect: false,
    });
    if (signed?.error) {
      // Account was created but auto-login failed; send them to login page
      router.push("/login");
    } else {
      router.push("/studio/beam");
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
          <h1 className="text-2xl font-bold text-zinc-100">Crear cuenta</h1>
          <p className="text-xs text-zinc-500 mt-2">
            La misma cuenta sirve para REVARA. Una sola identidad.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 border border-zinc-800 rounded-xl bg-zinc-900/40 p-6"
        >
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-wider text-zinc-500">
              Nombre
            </label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full bg-zinc-950 text-zinc-100 border border-zinc-800 rounded px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
              placeholder="Tu nombre"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-wider text-zinc-500">
              Empresa (opcional)
            </label>
            <input
              type="text"
              value={form.company}
              onChange={(e) => setForm({ ...form, company: e.target.value })}
              className="w-full bg-zinc-950 text-zinc-100 border border-zinc-800 rounded px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
              placeholder="Consultora XYZ"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-wider text-zinc-500">
              Correo electrónico
            </label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
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
              minLength={8}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full bg-zinc-950 text-zinc-100 border border-zinc-800 rounded px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
              placeholder="Mínimo 8 caracteres"
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
            {loading ? "Creando..." : "Crear cuenta"}
          </button>
        </form>

        <p className="text-center text-xs text-zinc-500 mt-6">
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="text-amber-300 hover:text-amber-200">
            Iniciar sesión
          </Link>
        </p>
      </div>
    </main>
  );
}
