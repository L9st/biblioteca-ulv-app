import { supabase } from "@/lib/supabase";

export type AccountUser = {
  id: string;
  email: string;
  name: string;
  role: "student" | "librarian" | "admin" | "superadmin";
  status: "active" | "inactive" | "blocked";
  created_at: string;
  updated_at: string | null;
};

export type AccountAttendanceLog = {
  id: string;
  check_in_at: string;
  check_out_at: string | null;
  total_minutes: number | null;
  status: "open" | "closed";
  source: string | null;
  libraries: {
    name: string;
    code: string;
  } | null;
};

export type AccountReservation = {
  id: string;
  start_at: string;
  end_at: string;
  status: "pending" | "approved" | "rejected" | "cancelled" | "completed";
  purpose: string | null;
  attendees_count: number | null;
  admin_notes: string | null;
  library_spaces: {
    id: string;
    name: string;
    slug: string;
  } | null;
  libraries: {
    id: string;
    name: string;
    code: string;
  } | null;
};

export type AccountSummary = {
  todayMinutes: number;
  weekMinutes: number;
  monthMinutes: number;
  totalMinutes: number;
  unreadNotifications: number;
};

export type AccountResult<T> = { data: T; error: string | null };

type RawAccountAttendanceLog = Omit<AccountAttendanceLog, "libraries" | "status"> & {
  status: string;
  libraries: AccountAttendanceLog["libraries"] | AccountAttendanceLog["libraries"][];
};

type RawAccountReservation = Omit<AccountReservation, "library_spaces" | "libraries" | "status"> & {
  status: string;
  library_spaces: AccountReservation["library_spaces"] | AccountReservation["library_spaces"][];
  libraries: AccountReservation["libraries"] | AccountReservation["libraries"][];
};

function normalizeRelation<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function normalizeAttendanceStatus(status: string): AccountAttendanceLog["status"] {
  return status === "open" ? "open" : "closed";
}

function normalizeReservationStatus(status: string): AccountReservation["status"] {
  if (status === "approved" || status === "rejected" || status === "cancelled" || status === "completed") return status;
  return "pending";
}

function normalizeAttendanceLog(log: RawAccountAttendanceLog): AccountAttendanceLog {
  return {
    ...log,
    status: normalizeAttendanceStatus(log.status),
    libraries: normalizeRelation(log.libraries),
  };
}

function normalizeReservation(reservation: RawAccountReservation): AccountReservation {
  return {
    ...reservation,
    status: normalizeReservationStatus(reservation.status),
    library_spaces: normalizeRelation(reservation.library_spaces),
    libraries: normalizeRelation(reservation.libraries),
  };
}

async function getCurrentUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user.id;
}

function getStartOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function getStartOfWeek() {
  const date = getStartOfToday();
  const day = date.getDay();
  const diff = day === 0 ? 6 : day - 1;
  date.setDate(date.getDate() - diff);
  return date;
}

function getStartOfMonth() {
  const date = getStartOfToday();
  date.setDate(1);
  return date;
}

export async function getCurrentAccountUser(): Promise<AccountResult<AccountUser | null>> {
  const userId = await getCurrentUserId();
  if (!userId) return { data: null, error: null };

  const { data, error } = await supabase
    .from("app_users")
    .select("id, email, name, role, status, created_at, updated_at")
    .eq("id", userId)
    .maybeSingle();

  if (error) return { data: null, error: "No se pudo cargar tu perfil." };
  return { data: data as AccountUser | null, error: null };
}

export async function getCurrentOpenAttendance(): Promise<AccountResult<AccountAttendanceLog | null>> {
  const userId = await getCurrentUserId();
  if (!userId) return { data: null, error: null };

  const { data, error } = await supabase
    .from("attendance_logs")
    .select("id, check_in_at, check_out_at, total_minutes, status, source, libraries (name, code)")
    .eq("user_id", userId)
    .eq("status", "open")
    .order("check_in_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return { data: null, error: "No se pudo cargar tu entrada activa." };
  if (!data) return { data: null, error: null };

  return { data: normalizeAttendanceLog(data as RawAccountAttendanceLog), error: null };
}

export async function getAccountAttendanceLogs(): Promise<AccountResult<AccountAttendanceLog[]>> {
  const userId = await getCurrentUserId();
  if (!userId) return { data: [], error: null };

  const { data, error } = await supabase
    .from("attendance_logs")
    .select("id, check_in_at, check_out_at, total_minutes, status, source, libraries (name, code)")
    .eq("user_id", userId)
    .order("check_in_at", { ascending: false })
    .limit(20);

  if (error) return { data: [], error: "No se pudo cargar tu historial de horas." };
  return { data: ((data ?? []) as RawAccountAttendanceLog[]).map(normalizeAttendanceLog), error: null };
}

export async function getAccountReservations(): Promise<AccountResult<AccountReservation[]>> {
  const userId = await getCurrentUserId();
  if (!userId) return { data: [], error: null };

  const { data, error } = await supabase
    .from("space_reservations")
    .select("id, start_at, end_at, status, purpose, attendees_count, admin_notes, library_spaces (id, name, slug), libraries (id, name, code)")
    .eq("user_id", userId)
    .order("start_at", { ascending: false })
    .limit(20);

  if (error) return { data: [], error: "No se pudieron cargar tus reservas." };
  return { data: ((data ?? []) as RawAccountReservation[]).map(normalizeReservation), error: null };
}

export async function getNextAccountReservations(): Promise<AccountResult<AccountReservation[]>> {
  const userId = await getCurrentUserId();
  if (!userId) return { data: [], error: null };

  const { data, error } = await supabase
    .from("space_reservations")
    .select("id, start_at, end_at, status, purpose, attendees_count, admin_notes, library_spaces (id, name, slug), libraries (id, name, code)")
    .eq("user_id", userId)
    .gte("start_at", new Date().toISOString())
    .in("status", ["pending", "approved"])
    .order("start_at", { ascending: true })
    .limit(3);

  if (error) return { data: [], error: "No se pudieron cargar tus próximas reservas." };
  return { data: ((data ?? []) as RawAccountReservation[]).map(normalizeReservation), error: null };
}

export async function getUnreadNotificationsCount(): Promise<AccountResult<number>> {
  const userId = await getCurrentUserId();
  if (!userId) return { data: 0, error: null };

  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null);

  if (error) return { data: 0, error: "No se pudo cargar el conteo de notificaciones." };
  return { data: count ?? 0, error: null };
}

export function buildAccountSummary(logs: AccountAttendanceLog[], unreadNotifications: number): AccountSummary {
  const today = getStartOfToday();
  const week = getStartOfWeek();
  const month = getStartOfMonth();

  return logs.reduce<AccountSummary>(
    (summary, log) => {
      if (log.status !== "closed" || log.total_minutes === null) return summary;

      const checkIn = new Date(log.check_in_at);
      const minutes = log.total_minutes;

      return {
        todayMinutes: summary.todayMinutes + (checkIn >= today ? minutes : 0),
        weekMinutes: summary.weekMinutes + (checkIn >= week ? minutes : 0),
        monthMinutes: summary.monthMinutes + (checkIn >= month ? minutes : 0),
        totalMinutes: summary.totalMinutes + minutes,
        unreadNotifications: summary.unreadNotifications,
      };
    },
    { todayMinutes: 0, weekMinutes: 0, monthMinutes: 0, totalMinutes: 0, unreadNotifications },
  );
}

export function formatMinutes(minutes: number | null) {
  if (!minutes) return "0 min";

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours === 0) return `${remainingMinutes} min`;
  if (remainingMinutes === 0) return `${hours} h`;
  return `${hours} h ${remainingMinutes} min`;
}
