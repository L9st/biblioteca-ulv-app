import { supabase } from "@/lib/supabase";

export type AdminAttendanceUser = {
  name: string | null;
  email: string | null;
  role: string | null;
};

export type AdminAttendanceLibrary = {
  name: string;
  code: string;
};

export type AdminAttendanceLog = {
  id: string;
  user_id: string;
  library_id: string;
  check_in_at: string;
  check_out_at: string | null;
  total_minutes: number | null;
  status: "open" | "closed" | "corrected" | "cancelled" | string;
  source: string | null;
  created_at: string;
  app_users: AdminAttendanceUser | null;
  libraries: AdminAttendanceLibrary | null;
};

export type AdminAttendanceSummary = {
  total_logs: number;
  open_logs: number;
  closed_logs: number;
  total_minutes: number;
  total_hours: number;
};

export type AdminLibraryFilter = {
  id: string;
  name: string;
  code: string;
  status: string;
};

export type AdminServiceResult<T> = {
  data: T;
  error: string | null;
};

type RawAdminAttendanceLog = Omit<AdminAttendanceLog, "app_users" | "libraries"> & {
  app_users: AdminAttendanceUser | AdminAttendanceUser[] | null;
  libraries: AdminAttendanceLibrary | AdminAttendanceLibrary[] | null;
};

function normalizeRelation<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function normalizeAdminAttendanceLog(log: RawAdminAttendanceLog): AdminAttendanceLog {
  return {
    ...log,
    app_users: normalizeRelation(log.app_users),
    libraries: normalizeRelation(log.libraries),
  };
}

function getAdminPermissionErrorMessage(message: string) {
  const lowerMessage = message.toLowerCase();

  if (
    lowerMessage.includes("permission") ||
    lowerMessage.includes("permiso") ||
    lowerMessage.includes("not allowed") ||
    lowerMessage.includes("unauthorized") ||
    lowerMessage.includes("denied") ||
    lowerMessage.includes("rls")
  ) {
    return "No tienes permisos para ver los registros de asistencia.";
  }

  return "No se pudieron cargar los registros de asistencia.";
}

export async function getAdminAttendanceLogs(): Promise<AdminServiceResult<AdminAttendanceLog[]>> {
  const { data, error } = await supabase
    .from("attendance_logs")
    .select(
      `
      id,
      user_id,
      library_id,
      check_in_at,
      check_out_at,
      total_minutes,
      status,
      source,
      created_at,
      app_users (
        name,
        email,
        role
      ),
      libraries (
        name,
        code
      )
      `
    )
    .order("check_in_at", { ascending: false })
    .limit(500);

  if (error) {
    console.error("Error al obtener registros administrativos de asistencia:", error.message);
    return { data: [], error: getAdminPermissionErrorMessage(error.message) };
  }

  return { data: ((data ?? []) as RawAdminAttendanceLog[]).map(normalizeAdminAttendanceLog), error: null };
}

export function getAdminAttendanceSummary(logs: AdminAttendanceLog[]): AdminAttendanceSummary {
  const totalMinutes = logs.reduce((total, log) => total + (typeof log.total_minutes === "number" ? log.total_minutes : 0), 0);

  return {
    total_logs: logs.length,
    open_logs: logs.filter((log) => log.status === "open").length,
    closed_logs: logs.filter((log) => log.status === "closed").length,
    total_minutes: totalMinutes,
    total_hours: totalMinutes / 60,
  };
}

export async function getActiveLibrariesForFilter(): Promise<AdminServiceResult<AdminLibraryFilter[]>> {
  const { data, error } = await supabase
    .from("libraries")
    .select("id, name, code, status")
    .eq("status", "active")
    .order("name", { ascending: true });

  if (error) {
    console.error("Error al obtener bibliotecas para filtros:", error.message);
    return { data: [], error: getAdminPermissionErrorMessage(error.message) };
  }

  return { data: data ?? [], error: null };
}
