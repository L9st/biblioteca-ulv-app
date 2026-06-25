import { supabase } from "@/lib/supabase";

export type DiagnosticStatus = "ok" | "warning" | "error";

export type DiagnosticCheck = {
  key: string;
  label: string;
  status: DiagnosticStatus;
  message: string;
  detail?: string;
};

export type DiagnosticSection = {
  key: string;
  title: string;
  checks: DiagnosticCheck[];
};

export type DiagnosticResponse = {
  generatedAt: string;
  overallStatus: DiagnosticStatus;
  sections: DiagnosticSection[];
};

export type DiagnosticResult = { data: DiagnosticResponse | null; error: string | null };

export async function getAdminDiagnostics(): Promise<DiagnosticResult> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session) return { data: null, error: "Debes iniciar sesión para ver el diagnóstico." };

  const response = await fetch("/api/admin/diagnostico", {
    headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    return { data: null, error: payload?.error ?? "No se pudo cargar el diagnóstico." };
  }

  const data = (await response.json()) as DiagnosticResponse;
  return { data, error: null };
}
