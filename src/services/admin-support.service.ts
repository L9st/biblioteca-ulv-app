import { supabase } from "@/lib/supabase";
import { isOffline, OFFLINE_ACTION_MESSAGE } from "@/lib/offline";
import { createAuditLog } from "@/services/admin-audit.service";
import { canAccessLibrary, getLibraryAccessContext } from "@/services/library-access.service";
import { type SupportTicket, type SupportTicketCategory, type SupportTicketMessage, type SupportTicketPriority, type SupportTicketStatus } from "@/services/support.service";

export type AdminSupportTicket = SupportTicket & {
  requester: { id: string; name: string | null; email: string | null; role: string | null } | null;
  assignee: { id: string; name: string | null; email: string | null; role: string | null } | null;
};

export type AdminSupportFilters = {
  libraryId?: string;
  status?: "all" | SupportTicketStatus;
  category?: "all" | SupportTicketCategory;
  priority?: "all" | SupportTicketPriority;
  search?: string;
};

export type AdminSupportStaffUser = { id: string; name: string | null; email: string | null; role: string };
export type AdminSupportResult<T> = { data: T; error: string | null };

type RawAdminSupportTicket = Omit<AdminSupportTicket, "category" | "priority" | "status" | "libraries" | "requester" | "assignee"> & {
  category: string;
  priority: string;
  status: string;
  libraries: AdminSupportTicket["libraries"] | AdminSupportTicket["libraries"][] | null;
  requester: AdminSupportTicket["requester"] | AdminSupportTicket["requester"][] | null;
  assignee: AdminSupportTicket["assignee"] | AdminSupportTicket["assignee"][] | null;
};

type RawAdminSupportTicketMessage = Omit<SupportTicketMessage, "author"> & {
  author?: SupportTicketMessage["author"] | NonNullable<SupportTicketMessage["author"]>[] | null;
};

function normalizeRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function normalizeStatus(status: string): SupportTicketStatus {
  if (status === "in_progress" || status === "resolved" || status === "closed") return status;
  return "open";
}

function normalizeCategory(category: string): SupportTicketCategory {
  if (category === "attendance" || category === "reservation" || category === "account" || category === "qr" || category === "pwa" || category === "koha") return category;
  return "other";
}

function normalizePriority(priority: string): SupportTicketPriority {
  if (priority === "low" || priority === "high" || priority === "urgent") return priority;
  return "normal";
}

function normalizeTicket(ticket: RawAdminSupportTicket): AdminSupportTicket {
  return { ...ticket, category: normalizeCategory(ticket.category), priority: normalizePriority(ticket.priority), status: normalizeStatus(ticket.status), libraries: normalizeRelation(ticket.libraries), requester: normalizeRelation(ticket.requester), assignee: normalizeRelation(ticket.assignee) };
}

function normalizeMessage(message: RawAdminSupportTicketMessage): SupportTicketMessage {
  return { ...message, author: normalizeRelation(message.author) };
}

function canManageSupportRole(role: string | null | undefined) {
  return role === "librarian" || role === "admin" || role === "superadmin";
}

function supportAdminError(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes("permission") || lower.includes("denied") || lower.includes("rls")) return "No tienes permisos para gestionar soporte.";
  return "No se pudo procesar soporte.";
}

function matchesSearch(ticket: AdminSupportTicket, search?: string) {
  const term = search?.trim().toLowerCase() ?? "";
  if (!term) return true;
  return [ticket.subject, ticket.description, ticket.requester?.email, ticket.requester?.name].some((value) => value?.toLowerCase().includes(term));
}

async function getSupportAccessContext() {
  const context = await getLibraryAccessContext();
  if (!context.profile || !canManageSupportRole(context.profile.role) || context.profile.status !== "active") return { context, error: "No tienes permisos para gestionar soporte." };
  return { context, error: null };
}

async function getTicketForAccess(ticketId: string): Promise<AdminSupportResult<AdminSupportTicket | null>> {
  const { data, error } = await supabase
    .from("support_tickets")
    .select("id, user_id, library_id, category, priority, status, subject, description, assigned_to, resolved_at, closed_at, created_at, updated_at, libraries (id, name, code), requester:app_users!support_tickets_user_id_fkey (id, name, email, role), assignee:app_users!support_tickets_assigned_to_fkey (id, name, email, role)")
    .eq("id", ticketId)
    .maybeSingle();
  if (error) return { data: null, error: supportAdminError(error.message) };
  if (!data) return { data: null, error: "No se encontró el ticket." };

  const ticket = normalizeTicket(data as RawAdminSupportTicket);
  const { context, error: accessError } = await getSupportAccessContext();
  if (accessError) return { data: null, error: accessError };
  if (!canAccessLibrary(ticket.library_id, context, false)) return { data: null, error: "No tienes permiso para gestionar este ticket." };
  return { data: ticket, error: null };
}

export async function getAdminSupportTickets(filters: AdminSupportFilters = {}): Promise<AdminSupportResult<AdminSupportTicket[]>> {
  const { context, error: accessError } = await getSupportAccessContext();
  if (accessError) return { data: [], error: accessError };

  let query = supabase
    .from("support_tickets")
    .select("id, user_id, library_id, category, priority, status, subject, description, assigned_to, resolved_at, closed_at, created_at, updated_at, libraries (id, name, code), requester:app_users!support_tickets_user_id_fkey (id, name, email, role), assignee:app_users!support_tickets_assigned_to_fkey (id, name, email, role)")
    .order("created_at", { ascending: false })
    .limit(300);

  if (filters.libraryId && filters.libraryId !== "all") query = query.eq("library_id", filters.libraryId);
  if (filters.status && filters.status !== "all") query = query.eq("status", filters.status);
  if (filters.category && filters.category !== "all") query = query.eq("category", filters.category);
  if (filters.priority && filters.priority !== "all") query = query.eq("priority", filters.priority);

  const { data, error } = await query;
  if (error) return { data: [], error: supportAdminError(error.message) };
  const tickets = ((data ?? []) as RawAdminSupportTicket[])
    .map(normalizeTicket)
    .filter((ticket) => canAccessLibrary(ticket.library_id, context, false))
    .filter((ticket) => matchesSearch(ticket, filters.search));
  return { data: tickets, error: null };
}

export async function getAdminSupportTicketMessages(ticketId: string): Promise<AdminSupportResult<SupportTicketMessage[]>> {
  const ticketResult = await getTicketForAccess(ticketId);
  if (ticketResult.error || !ticketResult.data) return { data: [], error: ticketResult.error ?? "No se encontró el ticket." };

  const { data, error } = await supabase
    .from("support_ticket_messages")
    .select("id, ticket_id, author_user_id, message, is_internal, created_at, author:app_users!support_ticket_messages_author_user_id_fkey (id, name, email, role)")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true });
  if (error) return { data: [], error: supportAdminError(error.message) };
  return { data: ((data ?? []) as RawAdminSupportTicketMessage[]).map(normalizeMessage), error: null };
}

async function insertSupportNotification(input: { userId: string | null; title: string; message: string }) {
  if (!input.userId) return;
  const { error } = await supabase.from("notifications").insert({ user_id: input.userId, title: input.title, message: input.message, type: "system", link_url: "/soporte" });
  if (error) console.error("No se pudo crear notificación de soporte:", error.message);
}

async function addStaffMessage(ticketId: string, message: string, isInternal: boolean): Promise<AdminSupportResult<SupportTicketMessage | null>> {
  if (isOffline()) return { data: null, error: OFFLINE_ACTION_MESSAGE };
  const ticketResult = await getTicketForAccess(ticketId);
  if (ticketResult.error || !ticketResult.data) return { data: null, error: ticketResult.error ?? "No se encontró el ticket." };
  const cleanMessage = message.trim();
  if (!cleanMessage) return { data: null, error: "Escribe un mensaje." };

  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("support_ticket_messages")
    .insert({ ticket_id: ticketId, author_user_id: userData.user?.id ?? null, message: cleanMessage, is_internal: isInternal })
    .select("id, ticket_id, author_user_id, message, is_internal, created_at, author:app_users!support_ticket_messages_author_user_id_fkey (id, name, email, role)")
    .single();
  if (error) return { data: null, error: supportAdminError(error.message) };

  await supabase.from("support_tickets").update({ updated_at: new Date().toISOString(), status: ticketResult.data.status === "open" && !isInternal ? "in_progress" : ticketResult.data.status }).eq("id", ticketId);

  void createAuditLog({
    module: "support",
    action: isInternal ? "internal_note_added" : "replied",
    entity_table: "support_tickets",
    entity_id: ticketResult.data.id,
    entity_label: ticketResult.data.subject,
    description: isInternal ? "Nota interna agregada al ticket" : "Respuesta enviada a ticket de soporte",
  }).catch((auditError: unknown) => console.error("No se pudo registrar auditoría de soporte:", auditError));

  if (!isInternal) await insertSupportNotification({ userId: ticketResult.data.user_id, title: "Nueva respuesta de soporte", message: "Tu solicitud de soporte recibió una respuesta." });
  return { data: normalizeMessage(data as RawAdminSupportTicketMessage), error: null };
}

export async function replyToSupportTicket(ticketId: string, message: string) {
  return addStaffMessage(ticketId, message, false);
}

export async function addInternalSupportNote(ticketId: string, message: string) {
  return addStaffMessage(ticketId, message, true);
}

export async function updateSupportTicketStatus(ticketId: string, status: SupportTicketStatus): Promise<AdminSupportResult<null>> {
  if (isOffline()) return { data: null, error: OFFLINE_ACTION_MESSAGE };
  const ticketResult = await getTicketForAccess(ticketId);
  if (ticketResult.error || !ticketResult.data) return { data: null, error: ticketResult.error ?? "No se encontró el ticket." };
  const now = new Date().toISOString();
  const { error } = await supabase.from("support_tickets").update({ status, updated_at: now, resolved_at: status === "resolved" ? now : ticketResult.data.resolved_at, closed_at: status === "closed" ? now : ticketResult.data.closed_at }).eq("id", ticketId);
  if (error) return { data: null, error: supportAdminError(error.message) };

  void createAuditLog({ module: "support", action: "status_changed", entity_table: "support_tickets", entity_id: ticketResult.data.id, entity_label: ticketResult.data.subject, description: "Estado de ticket actualizado", metadata: { previousStatus: ticketResult.data.status, newStatus: status } }).catch((auditError: unknown) => console.error("No se pudo registrar auditoría de soporte:", auditError));
  if (status === "resolved") await insertSupportNotification({ userId: ticketResult.data.user_id, title: "Solicitud de soporte resuelta", message: "Tu solicitud fue marcada como resuelta." });
  return { data: null, error: null };
}

export async function assignSupportTicket(ticketId: string, userId: string | null): Promise<AdminSupportResult<null>> {
  if (isOffline()) return { data: null, error: OFFLINE_ACTION_MESSAGE };
  const ticketResult = await getTicketForAccess(ticketId);
  if (ticketResult.error || !ticketResult.data) return { data: null, error: ticketResult.error ?? "No se encontró el ticket." };
  const { error } = await supabase.from("support_tickets").update({ assigned_to: userId, updated_at: new Date().toISOString() }).eq("id", ticketId);
  return { data: null, error: error ? supportAdminError(error.message) : null };
}

export async function getAdminSupportStaffUsers(): Promise<AdminSupportResult<AdminSupportStaffUser[]>> {
  const { context, error: accessError } = await getSupportAccessContext();
  if (accessError) return { data: [], error: accessError };
  const { data, error } = await supabase.from("app_users").select("id, name, email, role").in("role", ["librarian", "admin", "superadmin"]).eq("status", "active").order("name", { ascending: true });
  if (error) return { data: [], error: supportAdminError(error.message) };
  const users = (data ?? []) as AdminSupportStaffUser[];
  return { data: context.canAccessAll ? users : users.filter((user) => user.id === context.profile?.id), error: null };
}
