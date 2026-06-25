"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card } from "@/app/ui/Card";

type Feedback = {
  type: "success" | "error";
  message: string;
};

type LoginFormProps = {
  redirectPath?: string;
};

function getSafeRedirectPath(redirectPath: string | undefined) {
  if (!redirectPath || !redirectPath.startsWith("/") || redirectPath.startsWith("//")) {
    return "/horas";
  }

  return redirectPath;
}

export function LoginForm({ redirectPath }: LoginFormProps) {
  const router = useRouter();
  const safeRedirectPath = getSafeRedirectPath(redirectPath);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  useEffect(() => {
    async function loadSession() {
      const { data } = await supabase.auth.getSession();
      setIsAuthenticated(Boolean(data.session));
    }

    void loadSession();
  }, []);

  async function handleSignIn() {
    setIsSubmitting(true);
    setFeedback(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setFeedback({ type: "error", message: "No se pudo iniciar sesión. Revisa tu correo y contraseña." });
      setIsSubmitting(false);
      return;
    }

    router.push(safeRedirectPath);
    router.refresh();
  }

  async function handleSignUp() {
    setIsSubmitting(true);
    setFeedback(null);

    const { error } = await supabase.auth.signUp({ email, password });

    if (error) {
      setFeedback({ type: "error", message: "No se pudo registrar el usuario de prueba." });
      setIsSubmitting(false);
      return;
    }

    setFeedback({ type: "success", message: "Usuario registrado. Si tu proyecto requiere confirmación, revisa tu correo." });
    setIsSubmitting(false);
  }

  async function handleSignOut() {
    setIsSubmitting(true);
    await supabase.auth.signOut();
    setIsAuthenticated(false);
    setFeedback({ type: "success", message: "Sesión cerrada correctamente." });
    setIsSubmitting(false);
  }

  return (
    <Card>
      {feedback ? (
        <div
          className={`mb-4 rounded-2xl border p-4 text-sm ${
            feedback.type === "success" ? "border-green-100 bg-green-50 text-green-700" : "border-red-100 bg-red-50 text-red-700"
          }`}
        >
          {feedback.message}
        </div>
      ) : null}

      {isAuthenticated ? (
        <div>
          <h2 className="text-xl font-black text-ulv-blue">Ya tienes una sesión activa</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Puedes volver a tus horas o cerrar sesión.</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => router.push(safeRedirectPath)}
              className="min-h-11 rounded-xl bg-ulv-yellow px-4 py-2 text-sm font-semibold text-ulv-blue shadow-sm transition hover:brightness-95"
            >
              {safeRedirectPath === "/horas" ? "Ir a mis horas" : "Continuar"}
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              disabled={isSubmitting}
              className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-ulv-blue shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      ) : (
        <div>
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">
                Correo electrónico
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-ulv-blue focus:ring-2 focus:ring-ulv-blue/15 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                placeholder="usuario@ulv.edu.mx"
              />
            </div>
            <div>
              <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-700">
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-ulv-blue focus:ring-2 focus:ring-ulv-blue/15 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                placeholder="Tu contraseña"
              />
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={handleSignIn}
              disabled={isSubmitting || !email || !password}
              className="min-h-11 rounded-xl bg-ulv-yellow px-4 py-2 text-sm font-semibold text-ulv-blue shadow-sm transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Iniciando sesión..." : "Iniciar sesión"}
            </button>
            <button
              type="button"
              onClick={handleSignUp}
              disabled={isSubmitting || !email || !password}
              className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-ulv-blue shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Registrar usuario de prueba
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}
