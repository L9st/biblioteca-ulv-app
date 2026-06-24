import { supabase } from "@/lib/supabase";
import { isOffline, OFFLINE_ACTION_MESSAGE } from "@/lib/offline";

export type SupportTicketStatus = "open" | "in_progress" | "resolved" | "closed";
export type SupportTicketCategory = "attendance" | "reservation" | "account" | "qr" | "pwa" | "koha" | "other";
export type SupportTicketPriority = "low" | "normal" | "high" | "urgent";

export type SupportTicket = {
  id: string;
  user_id: string | null;
  library_id: string | null;
  category: SupportTicketCategory;
  priority: SupportTicketPriority;
  status: SupportTicketStatus;
  subject: string;
  description: string;
  assigned_to: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string | null;
  libraries: { id: string; name: string; code: string } | null;
};

export type SupportTicketMessage = {
  id: string;
  ticket_id: string;
  author_user_id: string | null;
  message: string;
  is_internal: boolean;
  created_at: string;
  author?: { id: string; name: string | null; email: string | null; role: string } | null;
};

export type SupportLibrary = { id: string; name: string; code: string };
export type SupportResult<T> = { data: T; error: string | null };

export type CreateSupportTicketInput = {
  library_id: string | null;
  category: SupportTicketCategory;
  priority: SupportTicketPriority;
  subject: string;
  description: string;
};

type RawSupportTicket = Omit<SupportTicket, "category" | "priority" | "status" | "libraries"> & {
  category: string;
  priority: string;
  status: string;
  libraries: SupportTicket["libraries"] | SupportTicket["libraries"][] | null;
};

type RawSupportTicketMessage = Omit<SupportTicketMessage, "author"> & {
  author?: SupportTicketMessage["author"] | NonNullable<SupportTicketMessage["author"]>[] | null;
};

export const supportCategoryLabels: Record<SupportTicketCategory, string> = {
  attendance: "Asistencia / horas",
  reservation: "Reservas",
  account: "Cuenta / acceso",
  qr: "Código QR",
  pwa: "App móvil / PWA",
  koha: "Catálogo Koha",
  other: "Otro",
};

export const supportPriorityLabels: Record<SupportTicketPriority, string> = { low: "Baja", normal: "Normal", high: "Alta", urgent: "Urgente" };
export const supportStatusLabels: Record<SupportTicketStatus, string> = { open: "Abierto", in_progress: "En proceso", resolved: "Resuelto", closed: "Cerrado" };

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

function normalizeTicket(ticket: RawSupportTicket): SupportTicket {
  return { ...ticket, category: normalizeCategory(ticket.category), priority: normalizePriority(ticket.priority), status: normalizeStatus(ticket.status), libraries: normalizeRelation(ticket.libraries) };
}

function normalizeMessage(message: RawSupportTicketMessage): SupportTicketMessage {
  return { ...message, author: normalizeRelation(message.author) };
}

async function getCurrentUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user.id;
}

function supportError(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes("permission") || lower.includes("denied") || lower.includes("rls")) return "No tienes permisos para realizar esta acción.";
  return "No se pudo procesar la solicitud de soporte.";
}

export async function getSupportLibraries(): Promise<SupportResult<SupportLibrary[]>> {
  const { data, error } = await supabase.from("libraries").select("id, name, code").eq("status", "active").order("name", { ascending: true });
  if (error) return { data: [], error: "No se pudieron cargar las bibliotecas." };
  return { data: (data ?? []) as SupportLibrary[], error: null };
}

export async function getMySupportTickets(): Promise<SupportResult<SupportTicket[]>> {
  const userId = await getCurrentUserId();
  if (!userId) return { data: [], error: "Debes iniciar sesión para ver tus solicitudes de soporte." };

  const { data, error } = await supabase
    .from("support_tickets")
    .select("id, user_id, library_id, category, priority, status, subject, description, assigned_to, resolved_at, closed_at, created_at, updated_at, libraries (id, name, code)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) return { data: [], error: supportError(error.message) };
  return { data: ((data ?? []) as RawSupportTicket[]).map(normalizeTicket), error: null };
}

export async function createSupportTicket(input: CreateSupportTicketInput): Promise<SupportResult<SupportTicket | null>> {
  if (isOffline()) return { data: null, error: OFFLINE_ACTION_MESSAGE };
  const userId = await getCurrentUserId();
  if (!userId) return { data: null, error: "Debes iniciar sesión para enviar una solicitud de soporte." };

  const subject = input.subject.trim();
  const description = input.description.trim();
  if (!subject) return { data: null, error: "El asunto es obligatorio." };
  if (!description) return { data: null, error: "La descripción es obligatoria." };

  const { data, error } = await supabase
    .from("support_tickets")
    .insert({ user_id: userId, library_id: input.library_id, category: input.category, priority: input.priority, subject, description, status: "open" })
    .select("id, user_id, library_id, category, priority, status, subject, description, assigned_to, resolved_at, closed_at, created_at, updated_at, libraries (id, name, code)")
    .single();

  if (error) return { data: null, error: supportError(error.message) };
  return { data: normalizeTicket(data as RawSupportTicket), error: null };
}

export async function getSupportTicketMessages(ticketId: string): Promise<SupportResult<SupportTicketMessage[]>> {
  const userId = await getCurrentUserId();
  if (!userId) return { data: [], error: "Debes iniciar sesión para ver mensajes." };

  const { data: ticket } = await supabase.from("support_tickets").select("id, user_id").eq("id", ticketId).eq("user_id", userId).maybeSingle();
  if (!ticket) return { data: [], error: "No tienes permisos para ver esta solicitud." };

  const { data, error } = await supabase
    .from("support_ticket_messages")
    .select("id, ticket_id, author_user_id, message, is_internal, created_at, author:app_users!support_ticket_messages_author_user_id_fkey (id, name, email, role)")
    .eq("ticket_id", ticketId)
    .eq("is_internal", false)
    .order("created_at", { ascending: true });

  if (error) return { data: [], error: supportError(error.message) };
  return { data: ((data ?? []) as RawSupportTicketMessage[]).map(normalizeMessage), error: null };
}

export async function addSupportTicketMessage(ticketId: string, message: string): Promise<SupportResult<SupportTicketMessage | null>> {
  if (isOffline()) return { data: null, error: OFFLINE_ACTION_MESSAGE };
  const userId = await getCurrentUserId();
  if (!userId) return { data: null, error: "Debes iniciar sesión para responder." };
  const cleanMessage = message.trim();
  if (!cleanMessage) return { data: null, error: "Escribe un mensaje." };

  const { data: ticket } = await supabase.from("support_tickets").select("id, user_id, status").eq("id", ticketId).eq("user_id", userId).maybeSingle();
  if (!ticket) return { data: null, error: "No tienes permisos para responder esta solicitud." };
  if (ticket.status === "closed") return { data: null, error: "No puedes responder una solicitud cerrada." };

  const { data, error } = await supabase
    .from("support_ticket_messages")
    .insert({ ticket_id: ticketId, author_user_id: userId, message: cleanMessage, is_internal: false })
    .select("id, ticket_id, author_user_id, message, is_internal, created_at, author:app_users!support_ticket_messages_author_user_id_fkey (id, name, email, role)")
    .single();

  if (error) return { data: null, error: supportError(error.message) };
  await supabase.from("support_tickets").update({ updated_at: new Date().toISOString() }).eq("id", ticketId);
  return { data: normalizeMessage(data as RawSupportTicketMessage), error: null };
}
