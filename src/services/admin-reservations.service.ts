import { supabase } from "@/lib/supabase";
import { createAuditLog } from "@/services/admin-audit.service";
import { isOffline, OFFLINE_ACTION_MESSAGE } from "@/lib/offline";
import { type ReservableSpace, type ReservationStatus } from "@/services/reservations.service";

export type AdminSpaceReservation = {
  id: string;
  user_id: string;
  library_id: string;
  space_id: string;
  start_at: string;
  end_at: string;
  purpose: string | null;
  attendees_count: number | null;
  notes: string | null;
  status: ReservationStatus;
  admin_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string | null;
  requester: { id: string; name: string | null; email: string | null; role: string | null } | null;
  reviewer: { id: string; name: string | null; email: string | null; role: string | null } | null;
  library_spaces: { id: string; name: string; slug: string } | null;
  libraries: { id: string; name: string; code: string } | null;
};

export type AdminReservationsResult<T> = { data: T; error: string | null };
export type AdminReservationsForDateInput = {
  date: string;
  libraryId?: string;
  spaceId?: string;
  status?: "all" | ReservationStatus;
  search?: string;
};

type RawAdminReservation = Omit<AdminSpaceReservation, "requester" | "reviewer" | "library_spaces" | "libraries" | "status"> & {
  status: string;
  requester: AdminSpaceReservation["requester"] | AdminSpaceReservation["requester"][];
  reviewer: AdminSpaceReservation["reviewer"] | AdminSpaceReservation["reviewer"][];
  library_spaces: AdminSpaceReservation["library_spaces"] | AdminSpaceReservation["library_spaces"][];
  libraries: AdminSpaceReservation["libraries"] | AdminSpaceReservation["libraries"][];
};
type RawAdminSpace = Omit<ReservableSpace, "libraries"> & { libraries: ReservableSpace["libraries"] | ReservableSpace["libraries"][] };

function normalizeRelation<T>(value: T | T[] | null): T | null { return Array.isArray(value) ? value[0] ?? null : value; }
function normalizeStatus(status: string): ReservationStatus { if (status === "approved" || status === "rejected" || status === "cancelled" || status === "completed") return status; return "pending"; }
function normalizeReservation(item: RawAdminReservation): AdminSpaceReservation { return { ...item, status: normalizeStatus(item.status), requester: normalizeRelation(item.requester), reviewer: normalizeRelation(item.reviewer), library_spaces: normalizeRelation(item.library_spaces), libraries: normalizeRelation(item.libraries) }; }
function normalizeSpace(space: RawAdminSpace): ReservableSpace { return { ...space, libraries: normalizeRelation(space.libraries) }; }
function getAdminReservationLoadError(message: string) { const lower = message.toLowerCase(); if (lower.includes("permission") || lower.includes("permiso") || lower.includes("denied") || lower.includes("rls")) return "No tienes permisos para administrar reservas."; return "No se pudieron cargar las reservas administrativas."; }
function getAdminReservationUpdateError(message: string) { const lower = message.toLowerCase(); if (lower.includes("permission") || lower.includes("permiso") || lower.includes("denied") || lower.includes("rls")) return "No tienes permisos para administrar reservas."; return "No se pudo actualizar el estado de la reserva."; }

function getDayRange(date: string) {
  const start = new Date(`${date}T00:00:00`);
  const end = new Date(`${date}T23:59:59.999`);
  return { start: start.toISOString(), end: end.toISOString() };
}

export async function getAdminSpaceReservations(): Promise<AdminReservationsResult<AdminSpaceReservation[]>> {
  const { data, error } = await supabase
    .from("space_reservations")
    .select(
      `
      id,
      user_id,
      library_id,
      space_id,
      start_at,
      end_at,
      purpose,
      attendees_count,
      notes,
      status,
      admin_notes,
      reviewed_by,
      reviewed_at,
      created_at,
      updated_at,
      requester:app_users!space_reservations_user_id_fkey (id, name, email, role),
      reviewer:app_users!space_reservations_reviewed_by_fkey (id, name, email, role),
      library_spaces (id, name, slug),
      libraries (id, name, code)
      `
    )
    .order("start_at", { ascending: false })
    .limit(500);
  if (error) return { data: [], error: getAdminReservationLoadError(error.message) };
  return { data: ((data ?? []) as RawAdminReservation[]).map(normalizeReservation), error: null };
}

export async function updateSpaceReservationStatus(reservationId: string, status: ReservationStatus, adminNotes?: string): Promise<AdminReservationsResult<null>> {
  if (isOffline()) return { data: null, error: OFFLINE_ACTION_MESSAGE };

  const { data: reservation } = await supabase
    .from("space_reservations")
    .select("id, space_id, library_spaces (name)")
    .eq("id", reservationId)
    .maybeSingle();

  const { error } = await supabase.rpc("review_space_reservation", {
    p_reservation_id: reservationId,
    p_status: status,
    p_admin_notes: adminNotes ?? null,
  });
  if (error) return { data: null, error: getAdminReservationUpdateError(error.message) };

  const action = status === "approved" || status === "rejected" || status === "cancelled" || status === "completed" ? status : "updated";
  const descriptions: Record<string, string> = {
    approved: "Reserva aprobada",
    rejected: "Reserva rechazada",
    cancelled: "Reserva cancelada por personal",
    completed: "Reserva marcada como completada",
    updated: "Reserva actualizada",
  };
  const space = Array.isArray(reservation?.library_spaces) ? reservation?.library_spaces[0] : reservation?.library_spaces;

  void createAuditLog({
    module: "reservations",
    action,
    entity_table: "space_reservations",
    entity_id: reservationId,
    entity_label: space?.name ?? `Reserva ${reservationId}`,
    description: descriptions[action],
  }).catch((auditError: unknown) => console.error("No se pudo registrar auditoría de reserva:", auditError));

  return { data: null, error: null };
}

export async function getAdminReservableSpaces(): Promise<AdminReservationsResult<ReservableSpace[]>> {
  const { data, error } = await supabase.from("library_spaces").select("id, library_id, name, slug, description, capacity, location_hint, is_reservable, status, libraries (id, name, code)").eq("is_reservable", true).order("name", { ascending: true });
  if (error) return { data: [], error: getAdminReservationLoadError(error.message) };
  return { data: ((data ?? []) as RawAdminSpace[]).map(normalizeSpace), error: null };
}

export async function getAdminReservationsForDate(input: AdminReservationsForDateInput): Promise<AdminReservationsResult<AdminSpaceReservation[]>> {
  const range = getDayRange(input.date);
  let query = supabase
    .from("space_reservations")
    .select(
      `
      id,
      user_id,
      library_id,
      space_id,
      start_at,
      end_at,
      purpose,
      attendees_count,
      notes,
      status,
      admin_notes,
      reviewed_by,
      reviewed_at,
      created_at,
      updated_at,
      requester:app_users!space_reservations_user_id_fkey (id, name, email, role),
      reviewer:app_users!space_reservations_reviewed_by_fkey (id, name, email, role),
      library_spaces (id, name, slug),
      libraries (id, name, code)
      `
    )
    .lt("start_at", range.end)
    .gt("end_at", range.start)
    .order("start_at", { ascending: true });

  if (input.libraryId && input.libraryId !== "all") query = query.eq("library_id", input.libraryId);
  if (input.spaceId && input.spaceId !== "all") query = query.eq("space_id", input.spaceId);
  if (input.status && input.status !== "all") query = query.eq("status", input.status);

  const { data, error } = await query;
  if (error) return { data: [], error: getAdminReservationLoadError(error.message) };

  const reservations = ((data ?? []) as RawAdminReservation[]).map(normalizeReservation);
  const cleanSearch = input.search?.trim().toLowerCase() ?? "";

  return {
    data: cleanSearch
      ? reservations.filter((reservation) => [reservation.requester?.name, reservation.requester?.email, reservation.library_spaces?.name, reservation.libraries?.name].some((value) => value?.toLowerCase().includes(cleanSearch)))
      : reservations,
    error: null,
  };
}
