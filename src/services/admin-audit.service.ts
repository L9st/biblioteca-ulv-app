import { supabase } from "@/lib/supabase";

export type AuditUserRole = "student" | "librarian" | "admin" | "superadmin";

export type AuditLog = {
  id: string;
  actor_user_id: string | null;
  module: string;
  action: string;
  entity_table: string | null;
  entity_id: string | null;
  entity_label: string | null;
  description: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  actor: {
    id: string;
    name: string | null;
    email: string | null;
    role: AuditUserRole;
  } | null;
};

export type AuditLogFilters = {
  module?: string;
  action?: string;
  actor_user_id?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
  limit?: number;
};

export type CreateAuditLogInput = {
  module: string;
  action: string;
  entity_table?: string | null;
  entity_id?: string | null;
  entity_label?: string | null;
  description?: string | null;
  metadata?: Record<string, unknown>;
};

export type AuditResult<T> = { data: T; error: string | null };

type RawAuditActor = {
  id: string;
  name: string | null;
  email: string | null;
  role: string | null;
};

type RawAuditLog = Omit<AuditLog, "actor" | "metadata"> & {
  metadata: unknown;
  actor: RawAuditActor | RawAuditActor[] | null;
};

const staffRoles: AuditUserRole[] = ["student", "librarian", "admin", "superadmin"];

function normalizeRelation<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function normalizeRole(role: string | null): AuditUserRole {
  return staffRoles.includes(role as AuditUserRole) ? (role as AuditUserRole) : "student";
}

function normalizeMetadata(value: unknown): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function normalizeAuditLog(log: RawAuditLog): AuditLog {
  const actor = normalizeRelation(log.actor);

  return {
    ...log,
    metadata: normalizeMetadata(log.metadata),
    actor: actor
      ? {
          id: actor.id,
          name: actor.name,
          email: actor.email,
          role: normalizeRole(actor.role),
        }
      : null,
  };
}

function matchesSearch(log: AuditLog, search: string) {
  const cleanSearch = search.trim().toLowerCase();

  if (!cleanSearch) {
    return true;
  }

  return [log.description, log.entity_label, log.module, log.action].some((value) => value?.toLowerCase().includes(cleanSearch));
}

function getAuditErrorMessage(message: string) {
  const lowerMessage = message.toLowerCase();

  if (
    lowerMessage.includes("permission") ||
    lowerMessage.includes("permiso") ||
    lowerMessage.includes("not allowed") ||
    lowerMessage.includes("unauthorized") ||
    lowerMessage.includes("denied") ||
    lowerMessage.includes("rls")
  ) {
    return "No tienes permisos para ver la auditoría.";
  }

  return "No se pudo cargar la auditoría administrativa.";
}

export async function getAdminAuditLogs(filters: AuditLogFilters = {}): Promise<AuditResult<AuditLog[]>> {
  let query = supabase
    .from("audit_logs")
    .select(
      `
      id,
      actor_user_id,
      module,
      action,
      entity_table,
      entity_id,
      entity_label,
      description,
      metadata,
      created_at,
      actor:app_users!audit_logs_actor_user_id_fkey (
        id,
        name,
        email,
        role
      )
      `
    )
    .order("created_at", { ascending: false })
    .limit(filters.limit ?? 100);

  if (filters.module) query = query.eq("module", filters.module);
  if (filters.action) query = query.eq("action", filters.action);
  if (filters.actor_user_id) query = query.eq("actor_user_id", filters.actor_user_id);
  if (filters.date_from) query = query.gte("created_at", filters.date_from);
  if (filters.date_to) query = query.lte("created_at", filters.date_to);

  const { data, error } = await query;

  if (error) {
    console.error("Error al obtener auditoría administrativa:", error.message);
    return { data: [], error: getAuditErrorMessage(error.message) };
  }

  const logs = ((data ?? []) as RawAuditLog[]).map(normalizeAuditLog);
  return { data: filters.search ? logs.filter((log) => matchesSearch(log, filters.search ?? "")) : logs, error: null };
}

export async function createAuditLog(input: CreateAuditLogInput): Promise<AuditResult<null>> {
  const { error } = await supabase.rpc("create_audit_log", {
    p_module: input.module,
    p_action: input.action,
    p_entity_table: input.entity_table ?? null,
    p_entity_id: input.entity_id ?? null,
    p_entity_label: input.entity_label ?? null,
    p_description: input.description ?? null,
    p_metadata: input.metadata ?? {},
  });

  if (error) {
    console.error("No se pudo registrar auditoría:", error.message);
    return { data: null, error: "No se pudo registrar auditoría." };
  }

  return { data: null, error: null };
}
