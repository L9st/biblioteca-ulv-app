"use client";

import { useEffect, useState } from "react";
import { RefreshCw, ShieldAlert } from "lucide-react";
import { Card } from "@/app/ui/Card";
import { getAdminDiagnostics, type DiagnosticCheck, type DiagnosticResponse, type DiagnosticStatus } from "@/services/admin-diagnostics.service";

const statusLabels: Record<DiagnosticStatus, string> = { ok: "Correcto", warning: "Advertencia", error: "Error" };
const statusIcons: Record<DiagnosticStatus, string> = { ok: "✅", warning: "⚠️", error: "❌" };
const statusClass: Record<DiagnosticStatus, string> = {
  ok: "border-green-100 bg-green-50 text-green-800",
  warning: "border-amber-100 bg-amber-50 text-amber-800",
  error: "border-red-100 bg-red-50 text-red-800",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function CheckCard({ item }: { item: DiagnosticCheck }) {
  return (
    <div className={`rounded-2xl border p-4 ${statusClass[item.status]}`}>
      <div className="flex items-start gap-3">
        <span className="text-lg" aria-hidden="true">{statusIcons[item.status]}</span>
        <div className="min-w-0">
          <p className="font-black">{item.label}</p>
          <p className="mt-1 text-sm font-semibold opacity-90">{item.message}</p>
          {item.detail ? <p className="mt-2 break-words text-xs opacity-80">{item.detail}</p> : null}
        </div>
      </div>
    </div>
  );
}

export function AdminDiagnosticPanel() {
  const [diagnostic, setDiagnostic] = useState<DiagnosticResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadDiagnostic() {
    setIsLoading(true);
    setError(null);
    const result = await getAdminDiagnostics();
    setDiagnostic(result.data);
    setError(result.error);
    setIsLoading(false);
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadDiagnostic();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  if (isLoading) return <Card><p className="text-sm font-semibold text-slate-600">Cargando diagnóstico del sistema...</p></Card>;

  if (error && !diagnostic) {
    return (
      <Card className="text-center">
        <ShieldAlert className="mx-auto h-10 w-10 text-red-700" aria-hidden="true" />
        <h2 className="mt-3 text-xl font-black text-red-700">{error}</h2>
      </Card>
    );
  }

  if (!diagnostic) return null;

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] bg-ulv-blue p-5 text-white shadow-sm md:p-8">
        <p className="text-sm font-bold text-ulv-yellow">Panel técnico</p>
        <h1 className="mt-2 text-3xl font-black leading-tight md:text-5xl">Diagnóstico del sistema</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-white/85">Revisa variables, conexión, datos iniciales y estado técnico de Biblioteca ULV App.</p>
      </section>

      {error ? <p className="rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-800">{error}</p> : null}

      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-slate-500">Estado general</p>
            <p className={`mt-2 inline-flex rounded-full border px-4 py-2 text-sm font-black ${statusClass[diagnostic.overallStatus]}`}>{statusIcons[diagnostic.overallStatus]} {statusLabels[diagnostic.overallStatus]}</p>
            <p className="mt-3 text-sm text-slate-600">Generado: {formatDate(diagnostic.generatedAt)}</p>
          </div>
          <button type="button" onClick={() => void loadDiagnostic()} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-ulv-yellow px-5 text-sm font-black text-ulv-blue sm:w-auto">
            <RefreshCw className="h-4 w-4" aria-hidden="true" /> Actualizar diagnóstico
          </button>
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        {diagnostic.sections.map((section) => (
          <Card key={section.key} className="h-full">
            <h2 className="text-xl font-black text-ulv-blue">{section.title}</h2>
            <div className="mt-4 grid gap-3">
              {section.checks.map((item) => <CheckCard key={item.key} item={item} />)}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
