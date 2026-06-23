import { supabase } from "@/lib/supabase";

export type ReservationStatus = "pending" | "approved" | "rejected" | "cancelled" | "completed";

export type ReservableSpace = {
  id: string;
  library_id: string;
  name: string;
  slug: string;
  description: string | null;
  capacity: number | null;
  location_hint: string | null;
  is_reservable: boolean;
  status: string;
  libraries: { id: string; name: string; code: string } | null;
};

export type SpaceReservation = {
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
  created_at: string;
  updated_at: string | null;
  library_spaces: { id: string; name: string; slug: string } | null;
  libraries: { id: string; name: string; code: string } | null;
};

export type CreateSpaceReservationInput = {
  spaceId: string;
  startAt: string;
  endAt: string;
  purpose: string | null;
  attendeesCount: number | null;
  notes: string | null;
};

export type ReservationResult<T> = { data: T; error: string | null };

type RawReservableSpace = Omit<ReservableSpace, "libraries"> & { libraries: ReservableSpace["libraries"] | ReservableSpace["libraries"][] };
type RawSpaceReservation = Omit<SpaceReservation, "library_spaces" | "libraries" | "status"> & {
  status: string;
  library_spaces: SpaceReservation["library_spaces"] | SpaceReservation["library_spaces"][];
  libraries: SpaceReservation["libraries"] | SpaceReservation["libraries"][];
};

function normalizeRelation<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

export function getReservationStatusLabel(status: ReservationStatus) {
  const labels: Record<ReservationStatus, string> = { pending: "Pendiente", approved: "Aprobada", rejected: "Rechazada", cancelled: "Cancelada", completed: "Completada" };
  return labels[status];
}

function normalizeStatus(status: string): ReservationStatus {
  if (status === "approved" || status === "rejected" || status === "cancelled" || status === "completed") return status;
  return "pending";
}

function normalizeSpace(space: RawReservableSpace): ReservableSpace {
  return { ...space, libraries: normalizeRelation(space.libraries) };
}

function normalizeReservation(reservation: RawSpaceReservation): SpaceReservation {
  return { ...reservation, status: normalizeStatus(reservation.status), library_spaces: normalizeRelation(reservation.library_spaces), libraries: normalizeRelation(reservation.libraries) };
}

function getReservationErrorMessage(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes("overlap") || lower.includes("solap") || lower.includes("conflict")) return "Ya existe una reserva pendiente o aprobada en ese horario.";
  if (lower.includes("permission") || lower.includes("permiso") || lower.includes("denied") || lower.includes("rls")) return "No tienes permisos para realizar esta operación.";
  return "No se pudo procesar la reserva.";
}

function getLoadReservationsErrorMessage(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes("permission") || lower.includes("permiso") || lower.includes("denied") || lower.includes("rls")) return "No tienes permisos para ver tus reservas.";
  return "No se pudieron cargar tus reservas.";
}

export async function getReservableSpaces(): Promise<ReservationResult<ReservableSpace[]>> {
  const { data, error } = await supabase.from("library_spaces").select("id, library_id, name, slug, description, capacity, location_hint, is_reservable, status, libraries (id, name, code)").eq("status", "active").eq("is_reservable", true).order("name", { ascending: true });
  if (error) return { data: [], error: getReservationErrorMessage(error.message) };
  return { data: ((data ?? []) as RawReservableSpace[]).map(normalizeSpace), error: null };
}

export async function getMySpaceReservations(): Promise<ReservationResult<SpaceReservation[]>> {
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    return { data: [], error: "Debes iniciar sesión para ver tus reservas." };
  }

  const { data, error } = await supabase
    .from("space_reservations")
    .select("id, user_id, library_id, space_id, start_at, end_at, purpose, attendees_count, notes, status, admin_notes, created_at, updated_at, library_spaces (id, name, slug), libraries (id, name, code)")
    .eq("user_id", userData.user.id)
    .order("start_at", { ascending: false });

  if (error) return { data: [], error: getLoadReservationsErrorMessage(error.message) };
  return { data: ((data ?? []) as RawSpaceReservation[]).map(normalizeReservation), error: null };
}

export async function createSpaceReservation(input: CreateSpaceReservationInput): Promise<ReservationResult<null>> {
  const { error } = await supabase.rpc("create_space_reservation", { p_space_id: input.spaceId, p_start_at: input.startAt, p_end_at: input.endAt, p_purpose: input.purpose, p_attendees_count: input.attendeesCount, p_notes: input.notes });
  return { data: null, error: error ? getReservationErrorMessage(error.message) : null };
}

export async function cancelMySpaceReservation(reservationId: string): Promise<ReservationResult<null>> {
  const { error } = await supabase.rpc("cancel_my_space_reservation", { p_reservation_id: reservationId });
  return { data: null, error: error ? getReservationErrorMessage(error.message) : null };
}
