import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { isOffline, OFFLINE_ACTION_MESSAGE } from "@/lib/offline";

export type Library = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  opening_hours: string | null;
  status: string;
};

export type UserProfile = {
  id: string;
  name: string | null;
  email: string | null;
  role: string | null;
  library_code: string | null;
  status: string | null;
};

export type AttendanceLog = {
  id: string;
  user_id: string;
  library_id: string;
  check_in_at: string;
  check_out_at: string | null;
  total_minutes: number | null;
  status: "open" | "closed" | "corrected" | "cancelled" | string;
  source: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  libraries: {
    name: string;
    code: string;
  } | null;
};

export type AttendanceSummary = {
  todayMinutes: number;
  weekMinutes: number;
  monthMinutes: number;
};

export type AttendanceActionResult = {
  ok: boolean;
  message: string;
};

type RawAttendanceLog = Omit<AttendanceLog, "libraries"> & {
  libraries: AttendanceLog["libraries"] | AttendanceLog["libraries"][];
};

function normalizeAttendanceLog(log: RawAttendanceLog): AttendanceLog {
  return {
    ...log,
    libraries: Array.isArray(log.libraries) ? log.libraries[0] ?? null : log.libraries,
  };
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function startOfWeek() {
  const date = startOfToday();
  const day = date.getDay();
  const diff = day === 0 ? 6 : day - 1;
  date.setDate(date.getDate() - diff);
  return date;
}

function startOfMonth() {
  const date = startOfToday();
  date.setDate(1);
  return date;
}

function getActionErrorMessage(message: string, fallback: string) {
  if (message.includes("Ya tienes una entrada abierta")) {
    return "Ya tienes una entrada abierta.";
  }

  if (message.includes("No tienes una entrada abierta")) {
    return "No tienes una entrada abierta para registrar salida.";
  }

  return fallback;
}

export async function getCurrentSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    console.error("Error al obtener sesión:", error.message);
    return null;
  }

  return data.session;
}

export async function getCurrentUserProfile(): Promise<UserProfile | null> {
  const session = await getCurrentSession();

  if (!session) {
    return null;
  }

  const { data, error } = await supabase
    .from("app_users")
    .select("id, name, email, role, library_code, status")
    .eq("id", session.user.id)
    .maybeSingle();

  if (error) {
    console.error("Error al obtener perfil:", error.message);
    return null;
  }

  return data;
}

export async function getLibraries(): Promise<Library[]> {
  const { data, error } = await supabase
    .from("libraries")
    .select("id, code, name, description, opening_hours, status")
    .eq("status", "active")
    .order("name", { ascending: true });

  if (error) {
    console.error("Error al obtener bibliotecas:", error.message);
    return [];
  }

  return data ?? [];
}

async function getCurrentUser(): Promise<User | null> {
  const session = await getCurrentSession();
  return session?.user ?? null;
}

export async function getMyOpenAttendance(): Promise<AttendanceLog | null> {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

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
      notes,
      created_at,
      updated_at,
      libraries (
        name,
        code
      )
      `
    )
    .eq("user_id", user.id)
    .eq("status", "open")
    .order("check_in_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Error al obtener entrada abierta:", error.message);
    return null;
  }

  return data ? normalizeAttendanceLog(data) : null;
}

export async function getMyAttendanceLogs(): Promise<AttendanceLog[]> {
  const user = await getCurrentUser();

  if (!user) {
    return [];
  }

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
      notes,
      created_at,
      updated_at,
      libraries (
        name,
        code
      )
      `
    )
    .eq("user_id", user.id)
    .order("check_in_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("Error al obtener historial:", error.message);
    return [];
  }

  return (data ?? []).map(normalizeAttendanceLog);
}

export async function checkInLibrary(libraryId: string): Promise<AttendanceActionResult> {
  if (isOffline()) return { ok: false, message: OFFLINE_ACTION_MESSAGE };

  const session = await getCurrentSession();

  if (!session) {
    return {
      ok: false,
      message: "Debes iniciar sesión para registrar tus horas en biblioteca.",
    };
  }

  const { error } = await supabase.rpc("check_in_library", {
    p_library_id: libraryId,
    p_source: "manual",
  });

  if (error) {
    return {
      ok: false,
      message: getActionErrorMessage(error.message, "No se pudo registrar la entrada."),
    };
  }

  return { ok: true, message: "Entrada registrada correctamente." };
}

export async function checkOutLibrary(): Promise<AttendanceActionResult> {
  if (isOffline()) return { ok: false, message: OFFLINE_ACTION_MESSAGE };

  const session = await getCurrentSession();

  if (!session) {
    return {
      ok: false,
      message: "Debes iniciar sesión para registrar tus horas en biblioteca.",
    };
  }

  const { error } = await supabase.rpc("check_out_library");

  if (error) {
    return {
      ok: false,
      message: getActionErrorMessage(error.message, "No se pudo registrar la salida."),
    };
  }

  return { ok: true, message: "Salida registrada correctamente." };
}

export async function getMyAttendanceSummary(): Promise<AttendanceSummary> {
  const user = await getCurrentUser();
  const emptySummary = { todayMinutes: 0, weekMinutes: 0, monthMinutes: 0 };

  if (!user) {
    return emptySummary;
  }

  const monthStart = startOfMonth();
  const weekStart = startOfWeek();
  const todayStart = startOfToday();

  const { data, error } = await supabase
    .from("attendance_logs")
    .select("check_in_at, total_minutes, status")
    .eq("user_id", user.id)
    .in("status", ["closed", "corrected"])
    .gte("check_in_at", monthStart.toISOString());

  if (error) {
    console.error("Error al obtener resumen de horas:", error.message);
    return emptySummary;
  }

  return (data ?? []).reduce<AttendanceSummary>((summary, log) => {
    const minutes = typeof log.total_minutes === "number" ? log.total_minutes : 0;
    const checkInDate = new Date(log.check_in_at);

    if (checkInDate >= todayStart) {
      summary.todayMinutes += minutes;
    }

    if (checkInDate >= weekStart) {
      summary.weekMinutes += minutes;
    }

    summary.monthMinutes += minutes;

    return summary;
  }, emptySummary);
}
