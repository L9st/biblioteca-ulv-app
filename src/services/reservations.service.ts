import { supabase } from "@/lib/supabase";
import { isOffline, OFFLINE_ACTION_MESSAGE } from "@/lib/offline";

export type ReservationStatus = "pending" | "approved" | "rejected" | "cancelled" | "completed";
export type ReservationCalendarStatus = ReservationStatus;

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

export type ReservationLibrary = {
  id: string;
  name: string;
  code: string;
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

export type ReservationCalendarItem = {
  id: string;
  user_id: string;
  library_id: string;
  space_id: string;
  start_at: string;
  end_at: string;
  status: ReservationCalendarStatus;
  library_spaces: { id: string; name: string; slug: string } | null;
  libraries: { id: string; name: string; code: string } | null;
};

export type ReservationTimeBlock = {
  start: string;
  end: string;
  label: string;
  isOccupied: boolean;
  reservationId?: string;
  status?: ReservationCalendarStatus;
  isMine?: boolean;
  displayText: string;
};

export type PublicLibraryOpeningHour = {
  id: string;
  library_id: string;
  day_of_week: number;
  opens_at: string | null;
  closes_at: string | null;
  is_closed: boolean;
  notes: string | null;
};

export type PublicSpaceReservationRule = {
  id: string;
  space_id: string;
  min_duration_minutes: number;
  max_duration_minutes: number;
  slot_interval_minutes: number;
  min_notice_minutes: number;
  max_days_ahead: number;
  requires_approval: boolean;
  max_reservations_per_user_day: number;
  is_active: boolean;
  notes: string | null;
};

export type ReservationsForDateInput = {
  date: string;
  libraryId?: string;
  spaceId?: string;
  status?: "all" | "pending" | "approved";
};

export type BuildDayScheduleInput = {
  date: string;
  reservations: ReservationCalendarItem[];
  spaceId: string;
  currentUserId?: string | null;
  isAdmin?: boolean;
  startHour?: number;
  endHour?: number;
  opensAt?: string | null;
  closesAt?: string | null;
  slotIntervalMinutes?: number;
};

export type ReservationValidationSettings = {
  openingHour: PublicLibraryOpeningHour | null;
  rule: PublicSpaceReservationRule;
  reservationsForDate: ReservationCalendarItem[];
  userReservationsForDate: SpaceReservation[];
};

export type ReservationResult<T> = { data: T; error: string | null };

type RawReservableSpace = Omit<ReservableSpace, "libraries"> & { libraries: ReservableSpace["libraries"] | ReservableSpace["libraries"][] };
type RawSpaceReservation = Omit<SpaceReservation, "library_spaces" | "libraries" | "status"> & {
  status: string;
  library_spaces: SpaceReservation["library_spaces"] | SpaceReservation["library_spaces"][];
  libraries: SpaceReservation["libraries"] | SpaceReservation["libraries"][];
};
type RawReservationCalendarItem = Omit<ReservationCalendarItem, "library_spaces" | "libraries" | "status"> & {
  status: string;
  library_spaces: ReservationCalendarItem["library_spaces"] | ReservationCalendarItem["library_spaces"][];
  libraries: ReservationCalendarItem["libraries"] | ReservationCalendarItem["libraries"][];
};

export const defaultSpaceReservationRule: PublicSpaceReservationRule = {
  id: "default",
  space_id: "default",
  min_duration_minutes: 30,
  max_duration_minutes: 120,
  slot_interval_minutes: 30,
  min_notice_minutes: 30,
  max_days_ahead: 30,
  requires_approval: true,
  max_reservations_per_user_day: 2,
  is_active: true,
  notes: null,
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

function normalizeCalendarReservation(reservation: RawReservationCalendarItem): ReservationCalendarItem {
  return { ...reservation, status: normalizeStatus(reservation.status), library_spaces: normalizeRelation(reservation.library_spaces), libraries: normalizeRelation(reservation.libraries) };
}

function getDayRange(date: string) {
  const start = new Date(`${date}T00:00:00`);
  const end = new Date(`${date}T23:59:59.999`);
  return { start: start.toISOString(), end: end.toISOString() };
}

function formatBlockTime(value: string) {
  return new Intl.DateTimeFormat("es-MX", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function overlaps(startA: Date, endA: Date, startB: Date, endB: Date) {
  return startA < endB && endA > startB;
}

function getReservationErrorMessage(message: string) {
  const lower = message.toLowerCase();
  const knownMessages = [
    "La biblioteca está cerrada en la fecha seleccionada.",
    "La reserva está fuera del horario de atención.",
    "Ya alcanzaste el máximo de reservas permitidas para ese día.",
    "El espacio ya está reservado en ese horario.",
    "Debes iniciar sesión para reservar espacios.",
    "El espacio no está disponible para reservas.",
  ];
  const directMessage = knownMessages.find((knownMessage) => message.includes(knownMessage));
  if (directMessage) return directMessage;
  if (message.includes("La duración mínima es de")) return message;
  if (message.includes("La duración máxima es de")) return message;
  if (message.includes("Debes reservar con al menos")) return message;
  if (message.includes("No puedes reservar con más de")) return message;
  if (lower.includes("overlap") || lower.includes("solap") || lower.includes("conflict")) return "Ya existe una reserva pendiente o aprobada en ese horario.";
  if (lower.includes("permission") || lower.includes("permiso") || lower.includes("denied") || lower.includes("rls")) return "No tienes permisos para realizar esta operación.";
  return "No se pudo procesar la reserva.";
}

function getIsoDayOfWeek(value: string) {
  return new Date(`${value}T00:00:00`).getDay();
}

function parseTimeParts(value: string | null | undefined, fallbackHour: number) {
  if (!value) return { hour: fallbackHour, minute: 0 };
  const [hourValue, minuteValue] = value.split(":");
  return { hour: Number(hourValue) || 0, minute: Number(minuteValue) || 0 };
}

function combineDateAndTime(date: string, time: string | null | undefined, fallbackHour: number) {
  const parts = parseTimeParts(time, fallbackHour);
  return new Date(`${date}T${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}:00`);
}

function getMinutesBetween(start: Date, end: Date) {
  return Math.floor((end.getTime() - start.getTime()) / 60000);
}

export function validateReservationRequest(input: {
  startAt: Date;
  endAt: Date;
  settings: ReservationValidationSettings;
  currentUserId: string | null;
}) {
  const { startAt, endAt, settings, currentUserId } = input;
  const duration = getMinutesBetween(startAt, endAt);
  const rule = settings.rule;
  const date = startAt.toISOString().slice(0, 10);

  if (settings.openingHour?.is_closed) return "La biblioteca está cerrada en la fecha seleccionada.";
  const openingStart = combineDateAndTime(date, settings.openingHour?.opens_at, 7);
  const openingEnd = combineDateAndTime(date, settings.openingHour?.closes_at, 20);
  if (startAt < openingStart || endAt > openingEnd) return "La reserva está fuera del horario de atención.";

  if (duration < rule.min_duration_minutes) return `La duración mínima es de ${rule.min_duration_minutes} minutos.`;
  if (duration > rule.max_duration_minutes) return `La duración máxima es de ${rule.max_duration_minutes} minutos.`;
  if (startAt.getTime() < Date.now() + rule.min_notice_minutes * 60000) return `Debes reservar con al menos ${rule.min_notice_minutes} minutos de anticipación.`;
  if (startAt.getTime() > Date.now() + rule.max_days_ahead * 24 * 60 * 60000) return `No puedes reservar con más de ${rule.max_days_ahead} días de anticipación.`;

  const userReservations = settings.userReservationsForDate.filter((reservation) => {
    if (reservation.status !== "pending" && reservation.status !== "approved") return false;
    if (reservation.user_id !== currentUserId) return false;
    return reservation.start_at.slice(0, 10) === date;
  });
  if (userReservations.length >= rule.max_reservations_per_user_day) return "Ya alcanzaste el máximo de reservas permitidas para ese día.";

  const hasOverlap = settings.reservationsForDate.some((reservation) => {
    if (reservation.status !== "pending" && reservation.status !== "approved") return false;
    return overlaps(startAt, endAt, new Date(reservation.start_at), new Date(reservation.end_at));
  });
  if (hasOverlap) return "El espacio ya está reservado en ese horario.";

  return null;
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

export async function getReservationLibraries(): Promise<ReservationResult<ReservationLibrary[]>> {
  const { data, error } = await supabase
    .from("libraries")
    .select("id, name, code")
    .eq("status", "active")
    .order("name", { ascending: true });

  if (error) return { data: [], error: "No se pudieron cargar las bibliotecas disponibles." };
  return { data: (data ?? []) as ReservationLibrary[], error: null };
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
  if (isOffline()) return { data: null, error: OFFLINE_ACTION_MESSAGE };

  const { error } = await supabase.rpc("create_space_reservation", { p_space_id: input.spaceId, p_start_at: input.startAt, p_end_at: input.endAt, p_purpose: input.purpose, p_attendees_count: input.attendeesCount, p_notes: input.notes });
  return { data: null, error: error ? getReservationErrorMessage(error.message) : null };
}

export async function cancelMySpaceReservation(reservationId: string): Promise<ReservationResult<null>> {
  if (isOffline()) return { data: null, error: OFFLINE_ACTION_MESSAGE };

  const { error } = await supabase.rpc("cancel_my_space_reservation", { p_reservation_id: reservationId });
  return { data: null, error: error ? getReservationErrorMessage(error.message) : null };
}

export async function getReservationsForDate(input: ReservationsForDateInput): Promise<ReservationResult<ReservationCalendarItem[]>> {
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    return { data: [], error: "Debes iniciar sesión para ver disponibilidad." };
  }

  const range = getDayRange(input.date);
  let query = supabase
    .from("space_reservations")
    .select("id, user_id, library_id, space_id, start_at, end_at, status, library_spaces (id, name, slug), libraries (id, name, code)")
    .lt("start_at", range.end)
    .gt("end_at", range.start)
    .order("start_at", { ascending: true });

  if (input.libraryId && input.libraryId !== "all") query = query.eq("library_id", input.libraryId);
  if (input.spaceId && input.spaceId !== "all") query = query.eq("space_id", input.spaceId);
  if (input.status && input.status !== "all") query = query.eq("status", input.status);
  else query = query.in("status", ["pending", "approved"]);

  const { data, error } = await query;
  if (error) return { data: [], error: getLoadReservationsErrorMessage(error.message) };
  return { data: ((data ?? []) as RawReservationCalendarItem[]).map(normalizeCalendarReservation), error: null };
}

export async function getReservationValidationSettings(input: { spaceId: string; libraryId: string; date: string }): Promise<ReservationResult<ReservationValidationSettings | null>> {
  const dayOfWeek = getIsoDayOfWeek(input.date);
  const [openingResult, ruleResult, reservationsResult, myReservationsResult] = await Promise.all([
    supabase
      .from("library_opening_hours")
      .select("id, library_id, day_of_week, opens_at, closes_at, is_closed, notes")
      .eq("library_id", input.libraryId)
      .eq("day_of_week", dayOfWeek)
      .maybeSingle(),
    supabase
      .from("space_reservation_rules")
      .select("id, space_id, min_duration_minutes, max_duration_minutes, slot_interval_minutes, min_notice_minutes, max_days_ahead, requires_approval, max_reservations_per_user_day, is_active, notes")
      .eq("space_id", input.spaceId)
      .eq("is_active", true)
      .maybeSingle(),
    getReservationsForDate({ date: input.date, libraryId: input.libraryId, spaceId: input.spaceId, status: "all" }),
    getMySpaceReservations(),
  ]);

  if (openingResult.error) return { data: null, error: getLoadReservationsErrorMessage(openingResult.error.message) };
  if (ruleResult.error) return { data: null, error: getLoadReservationsErrorMessage(ruleResult.error.message) };
  if (reservationsResult.error) return { data: null, error: reservationsResult.error };
  if (myReservationsResult.error) return { data: null, error: myReservationsResult.error };

  return {
    data: {
      openingHour: (openingResult.data as PublicLibraryOpeningHour | null) ?? null,
      rule: ruleResult.data ? (ruleResult.data as PublicSpaceReservationRule) : { ...defaultSpaceReservationRule, space_id: input.spaceId },
      reservationsForDate: reservationsResult.data,
      userReservationsForDate: myReservationsResult.data.filter((reservation) => reservation.start_at.slice(0, 10) === input.date),
    },
    error: null,
  };
}

export function buildDaySchedule(input: BuildDayScheduleInput): ReservationTimeBlock[] {
  const startHour = input.startHour ?? 7;
  const endHour = input.endHour ?? 20;
  const intervalMinutes = input.slotIntervalMinutes ?? 60;
  const blocks: ReservationTimeBlock[] = [];
  const reservations = input.reservations.filter((reservation) => reservation.space_id === input.spaceId);
  const dayStart = combineDateAndTime(input.date, input.opensAt, startHour);
  const dayEnd = combineDateAndTime(input.date, input.closesAt, endHour);

  for (let blockStart = new Date(dayStart); blockStart < dayEnd; blockStart = new Date(blockStart.getTime() + intervalMinutes * 60000)) {
    const blockEnd = new Date(blockStart.getTime() + intervalMinutes * 60000);
    if (blockEnd > dayEnd) break;
    const occupiedReservation = reservations.find((reservation) => {
      if (reservation.status !== "pending" && reservation.status !== "approved") return false;
      return overlaps(blockStart, blockEnd, new Date(reservation.start_at), new Date(reservation.end_at));
    });
    const isMine = occupiedReservation ? occupiedReservation.user_id === input.currentUserId : false;

    blocks.push({
      start: blockStart.toISOString(),
      end: blockEnd.toISOString(),
      label: `${formatBlockTime(blockStart.toISOString())} - ${formatBlockTime(blockEnd.toISOString())}`,
      isOccupied: Boolean(occupiedReservation),
      reservationId: occupiedReservation?.id,
      status: occupiedReservation?.status,
      isMine,
      displayText: occupiedReservation ? (input.isAdmin ? getReservationStatusLabel(occupiedReservation.status) : isMine ? "Tu reserva" : "Ocupado") : "Disponible",
    });
  }

  return blocks;
}
