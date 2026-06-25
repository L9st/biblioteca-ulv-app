import { existsSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import type { DiagnosticCheck, DiagnosticResponse, DiagnosticSection, DiagnosticStatus } from "@/services/admin-diagnostics.service";

export const runtime = "nodejs";

type AppRole = "student" | "librarian" | "admin" | "superadmin";

function check(key: string, label: string, status: DiagnosticStatus, message: string, detail?: string): DiagnosticCheck {
  return { key, label, status, message, detail };
}

function isConfigured(value: string | undefined) {
  return Boolean(value?.trim());
}

function publicUrlDetail(value: string | undefined) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.host}`;
  } catch {
    return "URL no valida";
  }
}

function envCheck(name: string, label: string, required: boolean): DiagnosticCheck {
  const value = process.env[name];
  if (!isConfigured(value)) return check(`env-${name}`, label, required ? "error" : "warning", required ? "No configurado." : "No configurado, revisar si aplica.");
  return check(`env-${name}`, label, "ok", "Configurado.");
}

function appUrlCheck(): DiagnosticCheck {
  const value = process.env.NEXT_PUBLIC_APP_URL;
  if (!isConfigured(value)) return check("env-app-url", "NEXT_PUBLIC_APP_URL", "error", "No configurado.");
  if (value?.includes("localhost")) return check("env-app-url", "NEXT_PUBLIC_APP_URL", "warning", "Apunta a localhost.", publicUrlDetail(value));
  if (!value?.startsWith("https://")) return check("env-app-url", "NEXT_PUBLIC_APP_URL", "warning", "Debe usar HTTPS en producción.", publicUrlDetail(value));
  return check("env-app-url", "NEXT_PUBLIC_APP_URL", "ok", "Configurado con HTTPS.", publicUrlDetail(value));
}

function kohaOpacCheck(): DiagnosticCheck {
  const value = process.env.NEXT_PUBLIC_KOHA_OPAC_URL;
  if (!isConfigured(value)) return check("env-koha-opac", "NEXT_PUBLIC_KOHA_OPAC_URL", "warning", "No configurado.");
  if (!value?.startsWith("http://") && !value?.startsWith("https://")) return check("env-koha-opac", "NEXT_PUBLIC_KOHA_OPAC_URL", "warning", "La URL debe iniciar con http:// o https://.");
  return check("env-koha-opac", "NEXT_PUBLIC_KOHA_OPAC_URL", "ok", "Configurado.", publicUrlDetail(value));
}

function emailEnvChecks(): DiagnosticCheck[] {
  const provider = process.env.EMAIL_PROVIDER;
  const checks = [envCheck("EMAIL_PROVIDER", "EMAIL_PROVIDER", false), envCheck("EMAIL_FROM", "EMAIL_FROM", false), envCheck("EMAIL_PROCESS_SECRET", "EMAIL_PROCESS_SECRET", false)];
  if (provider === "smtp") {
    checks.push(envCheck("SMTP_HOST", "SMTP_HOST", true), envCheck("SMTP_PORT", "SMTP_PORT", true), envCheck("SMTP_USER", "SMTP_USER", true), envCheck("SMTP_PASSWORD", "SMTP_PASSWORD", true));
  }
  return checks;
}

function buildEnvSection(): DiagnosticSection {
  return {
    key: "environment",
    title: "Variables de entorno",
    checks: [
      envCheck("NEXT_PUBLIC_APP_NAME", "NEXT_PUBLIC_APP_NAME", false),
      appUrlCheck(),
      envCheck("NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL", true),
      envCheck("NEXT_PUBLIC_SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY", true),
      kohaOpacCheck(),
      envCheck("AUTH_SECRET", "AUTH_SECRET", true),
      envCheck("QR_TOKEN_SECRET", "QR_TOKEN_SECRET", false),
      ...emailEnvChecks(),
    ],
  };
}

async function countRows(supabase: SupabaseClient, table: string, key: string, label: string, okMessage: string, emptyMessage: string, statusFilter?: string): Promise<DiagnosticCheck> {
  const baseQuery = supabase.from(table).select("id", { count: "exact", head: true });
  const query = statusFilter ? baseQuery.eq("status", statusFilter) : baseQuery;
  const { count, error } = await query;
  if (error) return check(key, label, "warning", "No se pudo consultar.", error.message);
  if ((count ?? 0) <= 0) return check(key, label, "warning", emptyMessage, "0 registros");
  return check(key, label, "ok", okMessage, `${count ?? 0} registros`);
}

async function countWhere(supabase: SupabaseClient, table: string, column: string, value: string, key: string, label: string, warningWhenPositive: boolean): Promise<DiagnosticCheck> {
  const { count, error } = await supabase.from(table).select("id", { count: "exact", head: true }).eq(column, value);
  if (error) return check(key, label, "warning", "No se pudo consultar.", error.message);
  const total = count ?? 0;
  if (warningWhenPositive && total > 0) return check(key, label, "warning", "Hay registros que requieren revisión.", `${total} registros`);
  if (!warningWhenPositive && total <= 0) return check(key, label, "warning", "No hay registros todavía.", "0 registros");
  return check(key, label, "ok", "Consulta correcta.", `${total} registros`);
}

async function buildDataSections(supabase: SupabaseClient): Promise<DiagnosticSection[]> {
  const dataChecks = await Promise.all([
    countRows(supabase, "libraries", "libraries-active", "Bibliotecas activas", "Existen bibliotecas activas.", "No hay bibliotecas activas.", "active"),
    countRows(supabase, "library_spaces", "spaces-active", "Espacios activos", "Existen espacios activos.", "No hay espacios activos.", "active"),
    countRows(supabase, "app_users", "users", "Usuarios registrados", "Existen usuarios registrados.", "No hay usuarios registrados."),
    countRows(supabase, "library_services", "services-active", "Servicios activos", "Existen servicios activos.", "No hay servicios activos.", "active"),
    countRows(supabase, "help_articles", "help-published", "Ayuda publicada", "Existen artículos de ayuda publicados.", "No hay artículos publicados.", "published"),
    countRows(supabase, "announcements", "announcements", "Avisos", "Existen avisos registrados.", "No hay avisos registrados."),
    countRows(supabase, "notifications", "notifications", "Notificaciones", "Tabla accesible.", "No hay notificaciones registradas."),
    countRows(supabase, "production_checklist_items", "production-checklist", "Checklist de producción", "Checklist cargado.", "No hay ítems de checklist."),
  ]);

  const reservationsChecks = await Promise.all([
    countRows(supabase, "space_reservations", "space-reservations", "Reservas", "Existen reservas registradas.", "No hay reservas registradas."),
    countRows(supabase, "library_opening_hours", "opening-hours", "Horarios configurados", "Existen horarios configurados.", "No hay horarios configurados."),
    countRows(supabase, "space_reservation_rules", "reservation-rules", "Reglas de reserva", "Existen reglas configuradas.", "No hay reglas configuradas."),
    await reservableSpacesWithoutRulesCheck(supabase),
  ]);

  const qrChecks = await Promise.all([
    countRows(supabase, "attendance_qr_tokens", "qr-tokens", "Tokens QR", "Tabla de tokens QR accesible.", "No hay tokens QR creados."),
    countRows(supabase, "attendance_qr_attempts", "qr-attempts", "Intentos QR", "Existen intentos QR registrados.", "No hay intentos QR registrados."),
  ]);
  qrChecks.push(process.env.NEXT_PUBLIC_APP_URL?.includes("localhost") ? check("qr-app-url", "URL para QR", "warning", "NEXT_PUBLIC_APP_URL apunta a localhost.") : check("qr-app-url", "URL para QR", "ok", "La URL pública no apunta a localhost."));

  const emailChecks = await Promise.all([
    countRows(supabase, "email_notifications", "email-queue", "Cola de correos", "Cola de correos accesible.", "No hay correos en cola."),
    countWhere(supabase, "email_notifications", "status", "failed", "email-failed", "Correos fallidos", true),
    oldQueuedEmailsCheck(supabase),
  ]);
  emailChecks.push(process.env.EMAIL_PROVIDER === "smtp" && isConfigured(process.env.SMTP_HOST) ? check("email-smtp", "SMTP", "ok", "SMTP configurado.") : check("email-smtp", "SMTP", "warning", "Proveedor de correo pendiente o incompleto."));

  const catalogChecks = await Promise.all([
    countRows(supabase, "catalog_search_events", "catalog-events", "Eventos de búsqueda", "Existen eventos de búsqueda.", "No hay eventos de búsqueda."),
    countRows(supabase, "catalog_saved_items", "catalog-saved", "Recursos guardados", "Existen recursos guardados.", "No hay recursos guardados."),
  ]);
  catalogChecks.push(kohaOpacCheck());

  const supportChecks = await Promise.all([
    countRows(supabase, "support_tickets", "support-tickets", "Tickets de soporte", "Existen tickets registrados.", "No hay tickets registrados."),
  ]);

  return [
    { key: "supabase", title: "Supabase", checks: [check("supabase-auth", "Autenticación", "ok", "Sesión administrativa validada."), check("supabase-counts", "Consultas de conteo", "ok", "Las consultas usan conteos y RLS.")] },
    { key: "initial-data", title: "Datos iniciales", checks: dataChecks },
    { key: "reservations", title: "Reservas", checks: reservationsChecks },
    { key: "qr", title: "QR y asistencia", checks: qrChecks },
    { key: "email", title: "Correo", checks: emailChecks },
    { key: "catalog", title: "Catálogo", checks: catalogChecks },
    { key: "pwa", title: "PWA", checks: buildPwaChecks() },
    { key: "support", title: "Soporte", checks: supportChecks },
  ];
}

async function reservableSpacesWithoutRulesCheck(supabase: SupabaseClient): Promise<DiagnosticCheck> {
  const { data: spaces, error: spacesError } = await supabase.from("library_spaces").select("id").eq("is_reservable", true).eq("status", "active").limit(1000);
  if (spacesError) return check("reservable-spaces-rules", "Espacios reservables sin reglas", "warning", "No se pudieron consultar espacios reservables.", spacesError.message);
  const { data: rules, error: rulesError } = await supabase.from("space_reservation_rules").select("space_id").limit(1000);
  if (rulesError) return check("reservable-spaces-rules", "Espacios reservables sin reglas", "warning", "No se pudieron consultar reglas.", rulesError.message);
  const ruleSpaceIds = new Set((rules ?? []).map((rule) => rule.space_id as string));
  const missing = (spaces ?? []).filter((space) => !ruleSpaceIds.has(space.id as string)).length;
  if (missing > 0) return check("reservable-spaces-rules", "Espacios reservables sin reglas", "warning", "Hay espacios reservables sin reglas.", `${missing} espacios`);
  return check("reservable-spaces-rules", "Espacios reservables sin reglas", "ok", "Todos los espacios reservables tienen reglas.");
}

async function oldQueuedEmailsCheck(supabase: SupabaseClient): Promise<DiagnosticCheck> {
  const olderThan = new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString();
  const { count, error } = await supabase.from("email_notifications").select("id", { count: "exact", head: true }).eq("status", "queued").lt("created_at", olderThan);
  if (error) return check("email-old-queued", "Correos pendientes antiguos", "warning", "No se pudo consultar.", error.message);
  if ((count ?? 0) > 0) return check("email-old-queued", "Correos pendientes antiguos", "warning", "Hay correos queued antiguos.", `${count ?? 0} registros`);
  return check("email-old-queued", "Correos pendientes antiguos", "ok", "Sin correos queued antiguos.");
}

function buildPwaChecks(): DiagnosticCheck[] {
  const paths = [
    ["pwa-sw", "Service worker", "public/sw.js"],
    ["pwa-manifest-json", "Manifest JSON", "public/manifest.json"],
    ["pwa-manifest-webmanifest", "Manifest Webmanifest", "src/app/manifest.ts"],
    ["pwa-offline", "Página offline", "src/app/offline/page.tsx"],
  ] as const;
  return paths.map(([key, label, relativePath]) => {
    const exists = existsSync(relativePath);
    return check(key, label, exists ? "ok" : "warning", exists ? "Archivo encontrado." : "No se encontró el archivo.", relativePath);
  });
}

function getOverallStatus(sections: DiagnosticSection[]): DiagnosticStatus {
  const statuses = sections.flatMap((section) => section.checks.map((item) => item.status));
  if (statuses.includes("error")) return "error";
  if (statuses.includes("warning")) return "warning";
  return "ok";
}

export async function GET(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return NextResponse.json({ error: "Supabase no está configurado." }, { status: 500 });

  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return NextResponse.json({ error: "Debes iniciar sesión para ver el diagnóstico." }, { status: 401 });

  const supabase = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) return NextResponse.json({ error: "Sesión no válida." }, { status: 401 });

  const { data: profile, error: profileError } = await supabase.from("app_users").select("role, status").eq("id", userData.user.id).maybeSingle();
  if (profileError) return NextResponse.json({ error: "No se pudo validar tu perfil." }, { status: 403 });
  const role = profile?.role as AppRole | undefined;
  if (!profile || profile.status !== "active" || (role !== "admin" && role !== "superadmin")) return NextResponse.json({ error: "No tienes permisos para ver el diagnóstico del sistema." }, { status: 403 });

  const sections = [buildEnvSection(), ...(await buildDataSections(supabase))];
  const response: DiagnosticResponse = { generatedAt: new Date().toISOString(), overallStatus: getOverallStatus(sections), sections };
  return NextResponse.json(response);
}
