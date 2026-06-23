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

export type ReportReservationStatus = "pending" | "approved" | "rejected" | "cancelled" | "completed";

export type ReportSpaceReservation = {
  id: string;
  user_id: string;
  library_id: string;
  space_id: string;
  start_at: string;
  end_at: string;
  status: ReportReservationStatus;
  library_spaces: {
    id: string;
    name: string;
  } | null;
  libraries: {
    id: string;
    name: string;
    code: string;
  } | null;
  app_users: {
    name: string | null;
    email: string | null;
  } | null;
};

export type ReportChartFilters = {
  libraryId?: string | null;
  status?: string | null;
  source?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  search?: string | null;
};

export type ChartPoint = {
  name: string;
  value: number;
};

export type LibraryChartPoint = ChartPoint & {
  minutes: number;
  hours: number;
};

export type TopReservedSpacePoint = ChartPoint & {
  library: string;
};

export type DailyActivityPoint = {
  date: string;
  attendance: number;
  reservations: number;
};

export type ReportChartData = {
  attendanceLogs: ReportAttendanceLog[];
  reservations: ReportSpaceReservation[];
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

type RawReportSpaceReservation = Omit<ReportSpaceReservation, "library_spaces" | "libraries" | "app_users" | "status"> & {
  status: string;
  library_spaces: ReportSpaceReservation["library_spaces"] | ReportSpaceReservation["library_spaces"][];
  libraries: ReportSpaceReservation["libraries"] | ReportSpaceReservation["libraries"][];
  app_users: ReportSpaceReservation["app_users"] | ReportSpaceReservation["app_users"][];
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

function normalizeReservationStatus(status: string): ReportReservationStatus {
  if (status === "approved" || status === "rejected" || status === "cancelled" || status === "completed") return status;
  return "pending";
}

function normalizeReservation(reservation: RawReportSpaceReservation): ReportSpaceReservation {
  return {
    ...reservation,
    status: normalizeReservationStatus(reservation.status),
    library_spaces: normalizeRelation(reservation.library_spaces),
    libraries: normalizeRelation(reservation.libraries),
    app_users: normalizeRelation(reservation.app_users),
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

function matchesChartSearch(values: Array<string | null | undefined>, search?: string | null) {
  const cleanSearch = search?.trim().toLowerCase() ?? "";
  if (!cleanSearch) return true;
  return values.some((value) => value?.toLowerCase().includes(cleanSearch));
}

export async function getReportChartData(filters: ReportChartFilters = {}): Promise<ReportsResult<ReportChartData>> {
  let attendanceQuery = supabase
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

  let reservationsQuery = supabase
    .from("space_reservations")
    .select(
      `
      id,
      user_id,
      library_id,
      space_id,
      start_at,
      end_at,
      status,
      library_spaces (id, name),
      libraries (id, name, code),
      app_users!space_reservations_user_id_fkey (name, email)
      `
    )
    .order("start_at", { ascending: false })
    .limit(1000);

  if (filters.libraryId && filters.libraryId !== "all") {
    attendanceQuery = attendanceQuery.eq("library_id", filters.libraryId);
    reservationsQuery = reservationsQuery.eq("library_id", filters.libraryId);
  }

  if (filters.status && filters.status !== "all") attendanceQuery = attendanceQuery.eq("status", filters.status);
  if (filters.source && filters.source !== "all") attendanceQuery = attendanceQuery.eq("source", filters.source);
  if (filters.dateFrom) {
    attendanceQuery = attendanceQuery.gte("check_in_at", filters.dateFrom);
    reservationsQuery = reservationsQuery.gte("start_at", filters.dateFrom);
  }
  if (filters.dateTo) {
    attendanceQuery = attendanceQuery.lte("check_in_at", filters.dateTo);
    reservationsQuery = reservationsQuery.lte("start_at", filters.dateTo);
  }

  const [attendanceResult, reservationsResult] = await Promise.all([attendanceQuery, reservationsQuery]);

  if (attendanceResult.error || reservationsResult.error) {
    const message = attendanceResult.error?.message ?? reservationsResult.error?.message ?? "";
    return { data: { attendanceLogs: [], reservations: [] }, error: getReportsErrorMessage(message) };
  }

  const attendanceLogs = ((attendanceResult.data ?? []) as RawReportAttendanceLog[])
    .map(normalizeLog)
    .filter((log) => matchesChartSearch([log.app_users?.name, log.app_users?.email, log.libraries?.name], filters.search));
  const reservations = ((reservationsResult.data ?? []) as RawReportSpaceReservation[])
    .map(normalizeReservation)
    .filter((reservation) => matchesChartSearch([reservation.app_users?.name, reservation.app_users?.email, reservation.libraries?.name, reservation.library_spaces?.name], filters.search));

  return { data: { attendanceLogs, reservations }, error: null };
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

export function buildAttendanceByLibraryChart(data: ReportAttendanceLog[]): LibraryChartPoint[] {
  return buildLibraryReport(data).map((item) => ({ name: item.libraryName, value: item.totalLogs, minutes: item.totalMinutes, hours: Number((item.totalMinutes / 60).toFixed(1)) }));
}

export function buildHoursByLibraryChart(data: ReportAttendanceLog[]): LibraryChartPoint[] {
  return buildLibraryReport(data).map((item) => ({ name: item.libraryName, value: Number((item.totalMinutes / 60).toFixed(1)), minutes: item.totalMinutes, hours: Number((item.totalMinutes / 60).toFixed(1)) }));
}

export function buildReservationsByStatusChart(data: ReportSpaceReservation[]): ChartPoint[] {
  const labels: Record<ReportReservationStatus, string> = {
    pending: "Pendientes",
    approved: "Aprobadas",
    rejected: "Rechazadas",
    cancelled: "Canceladas",
    completed: "Completadas",
  };
  const report = new Map<ReportReservationStatus, number>();
  data.forEach((reservation) => report.set(reservation.status, (report.get(reservation.status) ?? 0) + 1));
  return (["pending", "approved", "rejected", "cancelled", "completed"] as ReportReservationStatus[]).map((status) => ({ name: labels[status], value: report.get(status) ?? 0 }));
}

export function buildTopReservedSpacesChart(data: ReportSpaceReservation[], limit = 5): TopReservedSpacePoint[] {
  const report = new Map<string, TopReservedSpacePoint>();
  data.forEach((reservation) => {
    const spaceId = reservation.library_spaces?.id ?? reservation.space_id;
    const current = report.get(spaceId) ?? { name: reservation.library_spaces?.name ?? "Espacio no asignado", library: reservation.libraries?.name ?? "Biblioteca", value: 0 };
    current.value += 1;
    report.set(spaceId, current);
  });
  return Array.from(report.values()).sort((a, b) => b.value - a.value).slice(0, limit);
}

export function buildDailyActivityChart(data: ReportChartData): DailyActivityPoint[] {
  const report = new Map<string, DailyActivityPoint>();

  data.attendanceLogs.forEach((log) => {
    const date = log.check_in_at.slice(0, 10);
    const current = report.get(date) ?? { date, attendance: 0, reservations: 0 };
    current.attendance += 1;
    report.set(date, current);
  });

  data.reservations.forEach((reservation) => {
    const date = reservation.start_at.slice(0, 10);
    const current = report.get(date) ?? { date, attendance: 0, reservations: 0 };
    current.reservations += 1;
    report.set(date, current);
  });

  return Array.from(report.values()).sort((a, b) => a.date.localeCompare(b.date));
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
