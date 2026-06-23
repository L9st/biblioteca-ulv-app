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
          className={`mb-4 rounded-2xl p-4 text-sm font-bold ${
            feedback.type === "success" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"
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
              className="min-h-12 rounded-2xl bg-ulv-yellow px-5 py-3 text-sm font-bold text-ulv-blue shadow-sm transition hover:bg-[#e8b800]"
            >
              {safeRedirectPath === "/horas" ? "Ir a mis horas" : "Continuar"}
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              disabled={isSubmitting}
              className="min-h-12 rounded-2xl bg-ulv-blue px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#053757] disabled:opacity-60"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      ) : (
        <div>
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="text-sm font-bold text-ulv-blue">
                Correo electrónico
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-ulv-blue focus:ring-2 focus:ring-ulv-yellow"
                placeholder="usuario@ulv.edu.mx"
              />
            </div>
            <div>
              <label htmlFor="password" className="text-sm font-bold text-ulv-blue">
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-ulv-blue focus:ring-2 focus:ring-ulv-yellow"
                placeholder="Tu contraseña"
              />
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={handleSignIn}
              disabled={isSubmitting || !email || !password}
              className="min-h-12 rounded-2xl bg-ulv-yellow px-5 py-3 text-sm font-bold text-ulv-blue shadow-sm transition hover:bg-[#e8b800] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Iniciando sesión..." : "Iniciar sesión"}
            </button>
            <button
              type="button"
              onClick={handleSignUp}
              disabled={isSubmitting || !email || !password}
              className="min-h-12 rounded-2xl bg-ulv-blue px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#053757] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Registrar usuario de prueba
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}
