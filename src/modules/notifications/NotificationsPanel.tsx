"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, CheckCircle2, RefreshCw, ShieldAlert } from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  getMyNotifications,
  getUnreadNotificationsCount,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from "@/services/notifications.service";
import { Card } from "@/app/ui/Card";

type Feedback = { type: "success" | "error"; message: string };

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function getTypeLabel(type: AppNotification["type"]) {
  if (type === "reservation") return "Reserva";
  if (type === "attendance") return "Asistencia";
  return "Sistema";
}

export function NotificationsPanel() {
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  async function loadData({ showLoading = true } = {}) {
    if (showLoading) setIsLoading(true);
    else setIsRefreshing(true);
    setFeedback(null);

    const { data } = await supabase.auth.getSession();
    const hasSession = Boolean(data.session);
    setIsAuthenticated(hasSession);
    if (!hasSession) {
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    const [notificationsResult, countResult] = await Promise.all([getMyNotifications(), getUnreadNotificationsCount()]);
    setNotifications(notificationsResult.data);
    setUnreadCount(countResult.data);
    if (notificationsResult.error || countResult.error) {
      setFeedback({ type: "error", message: notificationsResult.error ?? countResult.error ?? "No se pudieron cargar tus notificaciones." });
    }
    setIsLoading(false);
    setIsRefreshing(false);
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadData();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  async function handleMarkRead(notificationId: string) {
    const result = await markNotificationRead(notificationId);
    if (result.error) {
      setFeedback({ type: "error", message: result.error });
      return;
    }
    await loadData({ showLoading: false });
  }

  async function handleMarkAllRead() {
    const result = await markAllNotificationsRead();
    if (result.error) {
      setFeedback({ type: "error", message: result.error });
      return;
    }
    setFeedback({ type: "success", message: "Notificaciones marcadas como leídas." });
    await loadData({ showLoading: false });
  }

  if (isLoading) return <Card><p className="text-sm font-semibold text-slate-600">Cargando notificaciones...</p></Card>;

  if (!isAuthenticated) {
    return (
      <Card className="text-center">
        <ShieldAlert className="mx-auto h-10 w-10 text-ulv-blue" aria-hidden="true" />
        <h2 className="mt-3 text-xl font-black text-ulv-blue">Debes iniciar sesión para acceder a esta sección.</h2>
        <Link href="/login?redirect=/notificaciones" className="mt-5 inline-flex min-h-12 items-center justify-center rounded-2xl bg-ulv-yellow px-5 py-3 text-sm font-bold text-ulv-blue shadow-sm transition hover:bg-[#e8b800]">
          Iniciar sesión
        </Link>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {feedback ? <p className={`rounded-2xl p-4 text-sm font-bold ${feedback.type === "success" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>{feedback.message}</p> : null}
      <Card>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-ulv-yellow text-ulv-blue">
              <Bell className="h-6 w-6" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-xl font-black text-ulv-blue">Notificaciones</h2>
              <p className="mt-1 text-sm text-slate-600">Consulta tus avisos y actualizaciones.</p>
              <p className="mt-2 inline-flex rounded-full bg-ulv-blue px-3 py-1 text-xs font-black text-white">No leídas: {unreadCount}</p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="button" onClick={() => void loadData({ showLoading: false })} disabled={isRefreshing} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-ulv-blue disabled:opacity-60">
              <RefreshCw className={`h-5 w-5 ${isRefreshing ? "animate-spin" : ""}`} aria-hidden="true" />
              Refrescar
            </button>
            <button type="button" onClick={() => void handleMarkAllRead()} className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-ulv-yellow px-5 py-3 text-sm font-bold text-ulv-blue shadow-sm transition hover:bg-[#e8b800]">
              Marcar todas como leídas
            </button>
          </div>
        </div>
      </Card>

      {notifications.length === 0 ? (
        <Card className="text-center"><CheckCircle2 className="mx-auto h-10 w-10 text-ulv-blue" aria-hidden="true" /><p className="mt-3 text-sm font-bold text-slate-600">No tienes notificaciones.</p></Card>
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => {
            const isUnread = !notification.read_at;
            return (
              <Card key={notification.id} className={isUnread ? "border-ulv-yellow bg-ulv-yellow/10" : "bg-white opacity-85"}>
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-ulv-blue px-3 py-1 text-xs font-black text-white">{getTypeLabel(notification.type)}</span>
                      <span className={`rounded-full px-3 py-1 text-xs font-black ${isUnread ? "bg-ulv-yellow text-ulv-blue" : "bg-slate-100 text-slate-600"}`}>{isUnread ? "No leída" : "Leída"}</span>
                    </div>
                    <h3 className="mt-3 text-lg font-black text-ulv-blue">{notification.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-700">{notification.message}</p>
                    <p className="mt-2 text-xs font-semibold text-slate-500">{formatDateTime(notification.created_at)}</p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-2 sm:flex-row md:flex-col">
                    {notification.link_url ? <Link href={notification.link_url} className="inline-flex min-h-10 items-center justify-center rounded-xl bg-ulv-yellow px-4 text-xs font-black text-ulv-blue">Abrir</Link> : null}
                    {isUnread ? <button type="button" onClick={() => void handleMarkRead(notification.id)} className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-ulv-blue">Marcar como leída</button> : null}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
