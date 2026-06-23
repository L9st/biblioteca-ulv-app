import { supabase } from "@/lib/supabase";
import { isOffline, OFFLINE_ACTION_MESSAGE } from "@/lib/offline";

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

export type AttendanceCorrection = {
  id: string;
  attendance_log_id: string;
  corrected_by: string | null;
  previous_check_in_at: string | null;
  previous_check_out_at: string | null;
  previous_total_minutes: number | null;
  previous_status: string | null;
  new_check_in_at: string;
  new_check_out_at: string | null;
  new_total_minutes: number | null;
  new_status: string;
  reason: string;
  note: string | null;
  created_at: string;
  corrected_by_user?: {
    id: string;
    name: string | null;
    email: string | null;
    role: string;
  } | null;
};

export type CorrectAttendanceLogInput = {
  attendanceLogId: string;
  newCheckInAt: string;
  newCheckOutAt: string | null;
  reason: string;
  note?: string | null;
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

type RawAttendanceCorrection = Omit<AttendanceCorrection, "corrected_by_user"> & {
  corrected_by_user?: AttendanceCorrection["corrected_by_user"] | NonNullable<AttendanceCorrection["corrected_by_user"]>[] | null;
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

function normalizeAttendanceCorrection(correction: RawAttendanceCorrection): AttendanceCorrection {
  return {
    ...correction,
    corrected_by_user: normalizeRelation(correction.corrected_by_user ?? null),
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

async function getAdminAttendanceLogById(attendanceLogId: string): Promise<AdminServiceResult<AdminAttendanceLog | null>> {
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
    .eq("id", attendanceLogId)
    .maybeSingle();

  if (error) {
    console.error("Error al obtener registro corregido:", error.message);
    return { data: null, error: getAdminPermissionErrorMessage(error.message) };
  }

  return { data: data ? normalizeAdminAttendanceLog(data as RawAdminAttendanceLog) : null, error: null };
}

export async function correctAttendanceLog(input: CorrectAttendanceLogInput): Promise<AdminServiceResult<AdminAttendanceLog | null>> {
  if (isOffline()) return { data: null, error: OFFLINE_ACTION_MESSAGE };

  const { error } = await supabase.rpc("correct_attendance_log", {
    p_attendance_log_id: input.attendanceLogId,
    p_new_check_in_at: input.newCheckInAt,
    p_new_check_out_at: input.newCheckOutAt,
    p_reason: input.reason,
    p_note: input.note ?? null,
  });

  if (error) {
    console.error("Error al corregir registro de asistencia:", error.message);
    return { data: null, error: `No se pudo corregir el registro de asistencia. ${error.message}` };
  }

  return getAdminAttendanceLogById(input.attendanceLogId);
}

export async function getAttendanceCorrections(attendanceLogId: string): Promise<AdminServiceResult<AttendanceCorrection[]>> {
  const { data, error } = await supabase
    .from("attendance_corrections")
    .select(
      `
      id,
      attendance_log_id,
      corrected_by,
      previous_check_in_at,
      previous_check_out_at,
      previous_total_minutes,
      previous_status,
      new_check_in_at,
      new_check_out_at,
      new_total_minutes,
      new_status,
      reason,
      note,
      created_at,
      corrected_by_user:app_users!attendance_corrections_corrected_by_fkey (
        id,
        name,
        email,
        role
      )
      `
    )
    .eq("attendance_log_id", attendanceLogId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error al obtener correcciones de asistencia:", error.message);
    return { data: [], error: getAdminPermissionErrorMessage(error.message) };
  }

  return { data: ((data ?? []) as RawAttendanceCorrection[]).map(normalizeAttendanceCorrection), error: null };
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
