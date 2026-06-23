import { supabase } from "@/lib/supabase";

export type ReportPeriod = "today" | "week" | "month" | "custom" | "all";

export type ReportLibrary = {
  id: string;
  code: string;
  name: string;
};

export type ReportAttendanceLog = {
  id: string;
  user_id: string;
  library_id: string;
  check_in_at: string;
  check_out_at: string | null;
  total_minutes: number | null;
  status: "open" | "closed";
  source: string | null;
  app_users: {
    name: string;
    email: string;
    role: string;
  } | null;
  libraries: {
    id: string;
    name: string;
    code: string;
  } | null;
};

export type ReportSummary = {
  totalLogs: number;
  uniqueUsers: number;
  openLogs: number;
  closedLogs: number;
  totalMinutes: number;
  totalHoursText: string;
};

export type LibraryReportItem = {
  libraryId: string;
  libraryName: string;
  libraryCode: string;
  totalLogs: number;
  uniqueUsers: number;
  totalMinutes: number;
  totalHoursText: string;
};

export type UserReportItem = {
  userId: string;
  userName: string;
  userEmail: string;
  totalLogs: number;
  totalMinutes: number;
  totalHoursText: string;
};

export type ReportsResult<T> = {
  data: T;
  error: string | null;
};

type RawReportAttendanceLog = Omit<ReportAttendanceLog, "app_users" | "libraries" | "status"> & {
  status: string;
  app_users: ReportAttendanceLog["app_users"] | ReportAttendanceLog["app_users"][];
  libraries: ReportAttendanceLog["libraries"] | ReportAttendanceLog["libraries"][];
};

function normalizeRelation<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function normalizeStatus(status: string): "open" | "closed" {
  return status === "open" ? "open" : "closed";
}

function normalizeLog(log: RawReportAttendanceLog): ReportAttendanceLog {
  return {
    ...log,
    status: normalizeStatus(log.status),
    app_users: normalizeRelation(log.app_users),
    libraries: normalizeRelation(log.libraries),
  };
}

function getReportsErrorMessage(message: string) {
  const lowerMessage = message.toLowerCase();

  if (
    lowerMessage.includes("permission") ||
    lowerMessage.includes("permiso") ||
    lowerMessage.includes("not allowed") ||
    lowerMessage.includes("unauthorized") ||
    lowerMessage.includes("denied") ||
    lowerMessage.includes("rls")
  ) {
    return "No tienes permisos para ver reportes administrativos.";
  }

  return "No se pudieron cargar los reportes administrativos.";
}

export function formatMinutes(minutes: number): string {
  if (minutes <= 0) return "0 min";

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours === 0) return `${remainingMinutes} min`;
  return remainingMinutes === 0 ? `${hours} h` : `${hours} h ${remainingMinutes} min`;
}

export function getClosedMinutes(log: ReportAttendanceLog): number {
  if (log.status !== "closed") return 0;
  return typeof log.total_minutes === "number" ? log.total_minutes : 0;
}

export async function getReportLibraries(): Promise<ReportsResult<ReportLibrary[]>> {
  const { data, error } = await supabase
    .from("libraries")
    .select("id, code, name, status")
    .eq("status", "active")
    .order("name", { ascending: true });

  if (error) {
    console.error("Error al obtener bibliotecas para reportes:", error.message);
    return { data: [], error: getReportsErrorMessage(error.message) };
  }

  return { data: data ?? [], error: null };
}

export async function getReportAttendanceLogs(): Promise<ReportsResult<ReportAttendanceLog[]>> {
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
      app_users (name, email, role),
      libraries (id, name, code)
      `
    )
    .order("check_in_at", { ascending: false })
    .limit(1000);

  if (error) {
    console.error("Error al obtener registros para reportes:", error.message);
    return { data: [], error: getReportsErrorMessage(error.message) };
  }

  return { data: ((data ?? []) as RawReportAttendanceLog[]).map(normalizeLog), error: null };
}

export function buildReportSummary(logs: ReportAttendanceLog[]): ReportSummary {
  const totalMinutes = logs.reduce((total, log) => total + getClosedMinutes(log), 0);

  return {
    totalLogs: logs.length,
    uniqueUsers: new Set(logs.map((log) => log.user_id)).size,
    openLogs: logs.filter((log) => log.status === "open").length,
    closedLogs: logs.filter((log) => log.status === "closed").length,
    totalMinutes,
    totalHoursText: formatMinutes(totalMinutes),
  };
}

export function buildLibraryReport(logs: ReportAttendanceLog[]): LibraryReportItem[] {
  const report = new Map<string, { item: LibraryReportItem; users: Set<string> }>();

  logs.forEach((log) => {
    const libraryId = log.libraries?.id ?? log.library_id;
    const current = report.get(libraryId) ?? {
      item: {
        libraryId,
        libraryName: log.libraries?.name ?? "Biblioteca no asignada",
        libraryCode: log.libraries?.code ?? "SIN_CODIGO",
        totalLogs: 0,
        uniqueUsers: 0,
        totalMinutes: 0,
        totalHoursText: "0 min",
      },
      users: new Set<string>(),
    };

    current.item.totalLogs += 1;
    current.item.totalMinutes += getClosedMinutes(log);
    current.users.add(log.user_id);
    current.item.uniqueUsers = current.users.size;
    current.item.totalHoursText = formatMinutes(current.item.totalMinutes);
    report.set(libraryId, current);
  });

  return Array.from(report.values())
    .map((entry) => entry.item)
    .sort((a, b) => b.totalMinutes - a.totalMinutes);
}

export function buildUserReport(logs: ReportAttendanceLog[]): UserReportItem[] {
  const report = new Map<string, UserReportItem>();

  logs.forEach((log) => {
    const current = report.get(log.user_id) ?? {
      userId: log.user_id,
      userName: log.app_users?.name ?? "Usuario sin nombre",
      userEmail: log.app_users?.email ?? "Sin correo",
      totalLogs: 0,
      totalMinutes: 0,
      totalHoursText: "0 min",
    };

    current.totalLogs += 1;
    current.totalMinutes += getClosedMinutes(log);
    current.totalHoursText = formatMinutes(current.totalMinutes);
    report.set(log.user_id, current);
  });

  return Array.from(report.values()).sort((a, b) => b.totalMinutes - a.totalMinutes);
}
