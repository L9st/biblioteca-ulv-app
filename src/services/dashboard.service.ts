import { supabase } from "@/lib/supabase";
import type { AppUserRole, AppUserStatus } from "@/services/admin-users.service";

export type DashboardUser = {
  id: string;
  name: string | null;
  email: string | null;
  role: AppUserRole;
  status: AppUserStatus;
};

export type DashboardOpenAttendance = {
  id: string;
  check_in_at: string;
  status: string;
  libraries: { name: string; code: string } | null;
};

export type DashboardReservation = {
  id: string;
  start_at: string;
  end_at: string;
  status: "pending" | "approved" | string;
  library_spaces: { name: string; slug: string } | null;
  libraries: { name: string; code: string } | null;
};

export type DashboardCatalogSummary = {
  savedItems: number;
  recentSearches: Array<{ id: string; query: string; created_at: string }>;
};

export type DashboardResult<T> = { data: T; error: string | null };

type RawOpenAttendance = Omit<DashboardOpenAttendance, "libraries"> & {
  libraries: DashboardOpenAttendance["libraries"] | DashboardOpenAttendance["libraries"][];
};
type RawReservation = Omit<DashboardReservation, "library_spaces" | "libraries"> & {
  library_spaces: DashboardReservation["library_spaces"] | DashboardReservation["library_spaces"][];
  libraries: DashboardReservation["libraries"] | DashboardReservation["libraries"][];
};

function normalizeRelation<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

async function getCurrentUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user.id;
}

export async function getCurrentDashboardUser(): Promise<DashboardResult<DashboardUser | null>> {
  const userId = await getCurrentUserId();
  if (!userId) return { data: null, error: null };

  const { data, error } = await supabase.from("app_users").select("id, name, email, role, status").eq("id", userId).maybeSingle();
  if (error) return { data: null, error: "No se pudo cargar tu perfil." };

  return { data: data as DashboardUser | null, error: null };
}

export async function getCurrentOpenAttendance(): Promise<DashboardResult<DashboardOpenAttendance | null>> {
  const userId = await getCurrentUserId();
  if (!userId) return { data: null, error: null };

  const { data, error } = await supabase
    .from("attendance_logs")
    .select("id, check_in_at, status, libraries (name, code)")
    .eq("user_id", userId)
    .eq("status", "open")
    .order("check_in_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return { data: null, error: "No se pudo cargar tu entrada activa." };
  if (!data) return { data: null, error: null };

  const record = data as RawOpenAttendance;
  return { data: { ...record, libraries: normalizeRelation(record.libraries) }, error: null };
}

export async function getUnreadNotificationsCount(): Promise<DashboardResult<number>> {
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

export async function getNextReservation(): Promise<DashboardResult<DashboardReservation | null>> {
  const userId = await getCurrentUserId();
  if (!userId) return { data: null, error: null };

  const { data, error } = await supabase
    .from("space_reservations")
    .select("id, start_at, end_at, status, library_spaces (name, slug), libraries (name, code)")
    .eq("user_id", userId)
    .gte("start_at", new Date().toISOString())
    .in("status", ["pending", "approved"])
    .order("start_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) return { data: null, error: "No se pudo cargar tu próxima reserva." };
  if (!data) return { data: null, error: null };

  const record = data as RawReservation;
  return { data: { ...record, library_spaces: normalizeRelation(record.library_spaces), libraries: normalizeRelation(record.libraries) }, error: null };
}

export async function getMyCatalogSummary(): Promise<DashboardResult<DashboardCatalogSummary>> {
  const userId = await getCurrentUserId();
  if (!userId) return { data: { savedItems: 0, recentSearches: [] }, error: null };

  const [savedItemsResult, historyResult] = await Promise.all([
    supabase.from("catalog_saved_items").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("catalog_search_history").select("id, query, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(3),
  ]);

  return {
    data: {
      savedItems: savedItemsResult.count ?? 0,
      recentSearches: (historyResult.data ?? []) as Array<{ id: string; query: string; created_at: string }>,
    },
    error: savedItemsResult.error || historyResult.error ? "No se pudo cargar tu resumen de catálogo." : null,
  };
}
