import { supabase } from "@/lib/supabase";

export type EmailNotificationStatus = "queued" | "sent" | "failed" | "skipped";

export type EmailNotificationType = "system" | "reservation" | "attendance" | "announcement";

export type EmailNotification = {
  id: string;
  user_id: string | null;
  to_email: string;
  subject: string;
  body: string;
  type: EmailNotificationType;
  status: EmailNotificationStatus;
  attempts: number;
  last_error: string | null;
  related_table: string | null;
  related_id: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string | null;
};

export type QueueEmailNotificationInput = {
  user_id?: string | null;
  to_email: string;
  subject: string;
  body: string;
  type: EmailNotificationType;
  related_table?: string | null;
  related_id?: string | null;
};

export type EmailNotificationFilters = {
  status?: "all" | EmailNotificationStatus;
  type?: "all" | EmailNotificationType;
  date?: string;
  search?: string;
  limit?: number;
};

export type EmailNotificationsResult<T> = { data: T; error: string | null };

function normalizeStatus(status: string): EmailNotificationStatus {
  if (status === "sent" || status === "failed" || status === "skipped") return status;
  return "queued";
}

function normalizeType(type: string): EmailNotificationType {
  if (type === "reservation" || type === "attendance" || type === "announcement") return type;
  return "system";
}

function normalizeEmailNotification(notification: Omit<EmailNotification, "status" | "type"> & { status: string; type: string }): EmailNotification {
  return { ...notification, status: normalizeStatus(notification.status), type: normalizeType(notification.type) };
}

function matchesSearch(notification: EmailNotification, search?: string) {
  const cleanSearch = search?.trim().toLowerCase() ?? "";
  if (!cleanSearch) return true;
  return [notification.to_email, notification.subject].some((value) => value.toLowerCase().includes(cleanSearch));
}

async function triggerEmailQueueProcessing() {
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  const token = session?.access_token;
  if (!token) return;

  const { data: profile } = await supabase.from("app_users").select("role, status").eq("id", session.user.id).maybeSingle();
  if (!profile || profile.status !== "active" || (profile.role !== "admin" && profile.role !== "superadmin")) return;

  await fetch("/api/admin/email/process", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => null);
}

export async function queueEmailNotification(input: QueueEmailNotificationInput): Promise<EmailNotificationsResult<EmailNotification | null>> {
  if (!input.to_email.trim()) return { data: null, error: null };

  if (input.related_id) {
    const { data: existing } = await supabase
      .from("email_notifications")
      .select("id, user_id, to_email, subject, body, type, status, attempts, last_error, related_table, related_id, sent_at, created_at, updated_at")
      .eq("related_id", input.related_id)
      .eq("related_table", input.related_table ?? "")
      .eq("subject", input.subject)
      .maybeSingle();

    if (existing) return { data: normalizeEmailNotification(existing as Omit<EmailNotification, "status" | "type"> & { status: string; type: string }), error: null };
  }

  const { data, error } = await supabase
    .from("email_notifications")
    .insert({
      user_id: input.user_id ?? null,
      to_email: input.to_email,
      subject: input.subject,
      body: input.body,
      type: input.type,
      status: "queued",
      attempts: 0,
      related_table: input.related_table ?? null,
      related_id: input.related_id ?? null,
    })
    .select("id, user_id, to_email, subject, body, type, status, attempts, last_error, related_table, related_id, sent_at, created_at, updated_at")
    .single();

  if (error) return { data: null, error: "No se pudo crear el correo en cola." };
  void triggerEmailQueueProcessing();
  return { data: normalizeEmailNotification(data as Omit<EmailNotification, "status" | "type"> & { status: string; type: string }), error: null };
}

export async function getEmailNotifications(filters: EmailNotificationFilters = {}): Promise<EmailNotificationsResult<EmailNotification[]>> {
  let query = supabase
    .from("email_notifications")
    .select("id, user_id, to_email, subject, body, type, status, attempts, last_error, related_table, related_id, sent_at, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(filters.limit ?? 100);

  if (filters.status && filters.status !== "all") query = query.eq("status", filters.status);
  if (filters.type && filters.type !== "all") query = query.eq("type", filters.type);
  if (filters.date) {
    query = query.gte("created_at", new Date(`${filters.date}T00:00:00`).toISOString()).lte("created_at", new Date(`${filters.date}T23:59:59`).toISOString());
  }

  const { data, error } = await query;
  if (error) return { data: [], error: "No se pudieron cargar los correos." };

  const notifications = ((data ?? []) as Array<Omit<EmailNotification, "status" | "type"> & { status: string; type: string }>).map(normalizeEmailNotification);
  return { data: notifications.filter((notification) => matchesSearch(notification, filters.search)), error: null };
}

export async function getQueuedEmailNotifications(limit = 10): Promise<EmailNotificationsResult<EmailNotification[]>> {
  return getEmailNotifications({ status: "queued", limit });
}

export async function updateEmailNotificationStatus(
  emailId: string,
  input: { status: EmailNotificationStatus; attempts: number; last_error?: string | null; sent_at?: string | null }
): Promise<EmailNotificationsResult<null>> {
  const { error } = await supabase
    .from("email_notifications")
    .update({ status: input.status, attempts: input.attempts, last_error: input.last_error ?? null, sent_at: input.sent_at ?? null })
    .eq("id", emailId);

  return { data: null, error: error ? "No se pudo actualizar el estado del correo." : null };
}
