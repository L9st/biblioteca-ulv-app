import { supabase } from "@/lib/supabase";
import { isOffline, OFFLINE_ACTION_MESSAGE } from "@/lib/offline";

export type NotificationType = "system" | "reservation" | "attendance";

export type AppNotification = {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: NotificationType;
  link_url: string | null;
  read_at: string | null;
  created_at: string;
};

export type NotificationsResult<T> = { data: T; error: string | null };

function normalizeNotificationType(type: string): NotificationType {
  if (type === "reservation" || type === "attendance") return type;
  return "system";
}

function normalizeNotification(notification: Omit<AppNotification, "type"> & { type: string }): AppNotification {
  return { ...notification, type: normalizeNotificationType(notification.type) };
}

async function getCurrentUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user.id;
}

export async function getMyNotifications(): Promise<NotificationsResult<AppNotification[]>> {
  const userId = await getCurrentUserId();
  if (!userId) return { data: [], error: "Debes iniciar sesión para ver tus notificaciones." };

  const { data, error } = await supabase
    .from("notifications")
    .select("id, user_id, title, message, type, link_url, read_at, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return { data: [], error: "No se pudieron cargar tus notificaciones." };
  return { data: ((data ?? []) as Array<Omit<AppNotification, "type"> & { type: string }>).map(normalizeNotification), error: null };
}

export async function getUnreadNotificationsCount(): Promise<NotificationsResult<number>> {
  const userId = await getCurrentUserId();
  if (!userId) return { data: 0, error: "Debes iniciar sesión para ver tus notificaciones." };

  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null);

  if (error) return { data: 0, error: "No se pudo cargar el conteo de notificaciones." };
  return { data: count ?? 0, error: null };
}

export async function markNotificationRead(notificationId: string): Promise<NotificationsResult<null>> {
  if (isOffline()) return { data: null, error: OFFLINE_ACTION_MESSAGE };

  const { error } = await supabase.rpc("mark_notification_read", { p_notification_id: notificationId });
  return { data: null, error: error ? "No se pudo marcar la notificación como leída." : null };
}

export async function markAllNotificationsRead(): Promise<NotificationsResult<null>> {
  if (isOffline()) return { data: null, error: OFFLINE_ACTION_MESSAGE };

  const { error } = await supabase.rpc("mark_all_notifications_read");
  return { data: null, error: error ? "No se pudieron marcar las notificaciones como leídas." : null };
}
