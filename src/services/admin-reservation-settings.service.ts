import { supabase } from "@/lib/supabase";
import { createAuditLog } from "@/services/admin-audit.service";
import { isOffline, OFFLINE_ACTION_MESSAGE } from "@/lib/offline";
import { auditLibraryAccessDenied, filterLibrariesForCurrentUser, getLibraryAccessContext } from "@/services/library-access.service";

export type ReservationSettingsLibrary = {
  id: string;
  name: string;
  code: string;
  status: string;
};

export type ReservationSettingsSpace = {
  id: string;
  name: string;
  library_id: string;
  is_reservable: boolean;
  status: string;
};

export type LibraryOpeningHour = {
  id: string;
  library_id: string;
  day_of_week: number;
  opens_at: string | null;
  closes_at: string | null;
  is_closed: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string | null;
};

export type SpaceReservationRule = {
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
  created_at: string;
  updated_at: string | null;
  library_spaces?: {
    id: string;
    name: string;
    library_id: string;
  } | null;
};

export type LibraryOpeningHourInput = {
  library_id: string;
  day_of_week: number;
  opens_at: string | null;
  closes_at: string | null;
  is_closed: boolean;
  notes: string | null;
};

export type SpaceReservationRuleInput = {
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

export type ReservationSettingsResult<T> = { data: T; error: string | null };

type RawSpaceReservationRule = Omit<SpaceReservationRule, "library_spaces"> & {
  library_spaces: SpaceReservationRule["library_spaces"] | NonNullable<SpaceReservationRule["library_spaces"]>[] | null;
};

function normalizeRelation<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function normalizeRule(rule: RawSpaceReservationRule): SpaceReservationRule {
  return { ...rule, library_spaces: normalizeRelation(rule.library_spaces) };
}

function settingsError(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes("permission") || lower.includes("permiso") || lower.includes("denied") || lower.includes("rls")) return "No tienes permisos para configurar reservas.";
  if (lower.includes("unique") || lower.includes("duplicate")) return "Ya existe una configuración para ese registro.";
  return "No se pudo guardar la configuración de reservas.";
}

function isValidOpenInterval(input: LibraryOpeningHourInput) {
  if (input.is_closed) return true;
  if (!input.opens_at || !input.closes_at) return false;
  return input.closes_at > input.opens_at;
}

function normalizeTimeValue(value: string | null | undefined): string | null {
  if (!value || value.trim() === "") return null;
  return value;
}

async function ensureLibraryAccess(libraryId: string, reason: string): Promise<string | null> {
  const context = await getLibraryAccessContext();
  const role = context.profile?.role;
  if (role !== "librarian" && role !== "admin" && role !== "superadmin") return "No tienes permiso para configurar horarios de esta biblioteca.";
  if (context.canAccessAll || context.allowedLibraryIds.has(libraryId)) return null;

  void auditLibraryAccessDenied({ libraryId, reason }).catch((auditError: unknown) => console.error("No se pudo registrar denegación de acceso:", auditError));
  return "No tienes permiso para configurar horarios de esta biblioteca.";
}

async function getSpaceLibraryId(spaceId: string): Promise<string | null> {
  const { data } = await supabase.from("library_spaces").select("library_id").eq("id", spaceId).maybeSingle();
  return typeof data?.library_id === "string" ? data.library_id : null;
}

export async function getReservationSettingsLibraries(): Promise<ReservationSettingsResult<ReservationSettingsLibrary[]>> {
  const { data, error } = await supabase.from("libraries").select("id, name, code, status").eq("status", "active").order("name", { ascending: true });
  if (error) return { data: [], error: settingsError(error.message) };

  const context = await getLibraryAccessContext();
  return { data: filterLibrariesForCurrentUser((data ?? []) as ReservationSettingsLibrary[], context), error: null };
}

export async function getReservationSettingsSpaces(libraryId: string): Promise<ReservationSettingsResult<ReservationSettingsSpace[]>> {
  const accessError = await ensureLibraryAccess(libraryId, "Intento de consultar espacios para reglas de biblioteca no asignada");
  if (accessError) return { data: [], error: accessError };

  const { data, error } = await supabase
    .from("library_spaces")
    .select("id, name, library_id, is_reservable, status")
    .eq("library_id", libraryId)
    .eq("is_reservable", true)
    .order("name", { ascending: true });

  if (error) return { data: [], error: settingsError(error.message) };
  return { data: (data ?? []) as ReservationSettingsSpace[], error: null };
}

export async function getLibraryOpeningHours(libraryId: string): Promise<ReservationSettingsResult<LibraryOpeningHour[]>> {
  const accessError = await ensureLibraryAccess(libraryId, "Intento de consultar horarios de biblioteca no asignada");
  if (accessError) return { data: [], error: accessError };

  const { data, error } = await supabase.from("library_opening_hours").select("id, library_id, day_of_week, opens_at, closes_at, is_closed, notes, created_at, updated_at").eq("library_id", libraryId).order("day_of_week", { ascending: true });
  if (error) return { data: [], error: settingsError(error.message) };
  return { data: (data ?? []) as LibraryOpeningHour[], error: null };
}

export async function upsertLibraryOpeningHour(input: LibraryOpeningHourInput): Promise<ReservationSettingsResult<LibraryOpeningHour | null>> {
  if (isOffline()) return { data: null, error: OFFLINE_ACTION_MESSAGE };
  const accessError = await ensureLibraryAccess(input.library_id, "Intento de actualizar horario de biblioteca no asignada");
  if (accessError) return { data: null, error: accessError };

  const opensAt = normalizeTimeValue(input.opens_at);
  const closesAt = normalizeTimeValue(input.closes_at);
  const normalizedInput = { ...input, opens_at: opensAt, closes_at: closesAt };

  if (!input.is_closed && !opensAt) return { data: null, error: "Indica la hora de apertura." };
  if (!input.is_closed && !closesAt) return { data: null, error: "Indica la hora de cierre." };
  if (!isValidOpenInterval(normalizedInput)) return { data: null, error: "La hora de cierre debe ser posterior a la hora de apertura." };

  const payload = {
    library_id: input.library_id,
    day_of_week: input.day_of_week,
    is_closed: input.is_closed,
    opens_at: input.is_closed ? null : opensAt,
    closes_at: input.is_closed ? null : closesAt,
    notes: input.notes?.trim() || null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("library_opening_hours")
    .upsert(payload, {
      onConflict: "library_id,day_of_week",
    })
    .select("id, library_id, day_of_week, opens_at, closes_at, is_closed, notes, created_at, updated_at")
    .single();

  if (error) {
    console.error("Error upserting library opening hour:", error);
    return { data: null, error: error.message || "No se pudo guardar el horario" };
  }

  void createAuditLog({
    module: "reservations",
    action: "schedule_updated",
    entity_table: "library_opening_hours",
    entity_id: data.id,
    description: "Horario de biblioteca actualizado",
    metadata: { library_id: input.library_id, day_of_week: input.day_of_week },
  }).catch((auditError: unknown) => console.error("No se pudo registrar auditoría de horario:", auditError));

  return { data: data as LibraryOpeningHour, error: null };
}

export async function getSpaceReservationRules(libraryId: string): Promise<ReservationSettingsResult<SpaceReservationRule[]>> {
  const accessError = await ensureLibraryAccess(libraryId, "Intento de consultar reglas de biblioteca no asignada");
  if (accessError) return { data: [], error: accessError };

  const { data, error } = await supabase
    .from("space_reservation_rules")
    .select("id, space_id, min_duration_minutes, max_duration_minutes, slot_interval_minutes, min_notice_minutes, max_days_ahead, requires_approval, max_reservations_per_user_day, is_active, notes, created_at, updated_at, library_spaces!inner (id, name, library_id)")
    .eq("library_spaces.library_id", libraryId)
    .order("created_at", { ascending: false });

  if (error) return { data: [], error: settingsError(error.message) };
  return { data: ((data ?? []) as RawSpaceReservationRule[]).map(normalizeRule).filter((rule) => rule.library_spaces?.library_id === libraryId), error: null };
}

export async function upsertSpaceReservationRule(input: SpaceReservationRuleInput): Promise<ReservationSettingsResult<SpaceReservationRule | null>> {
  if (isOffline()) return { data: null, error: OFFLINE_ACTION_MESSAGE };
  const libraryId = await getSpaceLibraryId(input.space_id);
  if (!libraryId) return { data: null, error: "Selecciona un espacio válido." };
  const accessError = await ensureLibraryAccess(libraryId, "Intento de actualizar reglas de espacio de biblioteca no asignada");
  if (accessError) return { data: null, error: accessError };

  if (input.min_duration_minutes <= 0) return { data: null, error: "La duración mínima debe ser mayor a cero." };
  if (input.max_duration_minutes < input.min_duration_minutes) return { data: null, error: "La duración máxima debe ser igual o mayor que la mínima." };
  if (input.slot_interval_minutes <= 0) return { data: null, error: "El intervalo de bloques debe ser mayor a cero." };
  if (input.max_reservations_per_user_day <= 0) return { data: null, error: "El máximo por usuario debe ser mayor a cero." };

  const { data, error } = await supabase
    .from("space_reservation_rules")
    .upsert({ ...input, updated_at: new Date().toISOString() }, { onConflict: "space_id" })
    .select("id, space_id, min_duration_minutes, max_duration_minutes, slot_interval_minutes, min_notice_minutes, max_days_ahead, requires_approval, max_reservations_per_user_day, is_active, notes, created_at, updated_at, library_spaces (id, name, library_id)")
    .single();

  if (error) return { data: null, error: settingsError(error.message) };
  const rule = normalizeRule(data as RawSpaceReservationRule);

  void createAuditLog({
    module: "reservations",
    action: "rules_updated",
    entity_table: "space_reservation_rules",
    entity_id: rule.id,
    entity_label: rule.library_spaces?.name ?? input.space_id,
    description: "Reglas de reserva actualizadas",
    metadata: { space_id: input.space_id, library_id: libraryId },
  }).catch((auditError: unknown) => console.error("No se pudo registrar auditoría de reglas:", auditError));

  return { data: rule, error: null };
}
