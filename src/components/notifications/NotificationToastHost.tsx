"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { markNotificationRead, type AppNotification, type NotificationType } from "@/services/notifications.service";

type ToastState = "enter" | "exit";

function normalizeNotificationType(type: unknown): NotificationType {
  return type === "reservation" || type === "attendance" ? type : "system";
}

function isNotificationPayload(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseNotification(value: unknown): AppNotification | null {
  if (!isNotificationPayload(value)) return null;

  if (
    typeof value.id !== "string" ||
    typeof value.user_id !== "string" ||
    typeof value.title !== "string" ||
    typeof value.message !== "string" ||
    typeof value.created_at !== "string"
  ) {
    return null;
  }

  return {
    id: value.id,
    user_id: value.user_id,
    title: value.title,
    message: value.message,
    type: normalizeNotificationType(value.type),
    link_url: typeof value.link_url === "string" ? value.link_url : null,
    read_at: typeof value.read_at === "string" ? value.read_at : null,
    created_at: value.created_at,
  };
}

function getMessageSummary(message: string) {
  return message.length > 120 ? `${message.slice(0, 117)}...` : message;
}

export function NotificationToastHost() {
  const [queue, setQueue] = useState<AppNotification[]>([]);
  const [currentNotification, setCurrentNotification] = useState<AppNotification | null>(null);
  const [toastState, setToastState] = useState<ToastState>("enter");
  const seenIdsRef = useRef<Set<string>>(new Set());
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function subscribeToNotifications() {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user || !isMounted) return;

      // En Supabase, activar Realtime para la tabla notifications si no está activo.
      const channel = supabase
        .channel(`user-notifications-${user.id}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
          (payload) => {
            const notification = parseNotification(payload.new);
            if (!notification || seenIdsRef.current.has(notification.id)) return;

            seenIdsRef.current.add(notification.id);
            setQueue((currentQueue) => [...currentQueue, notification]);
          }
        )
        .subscribe();

      return () => {
        void supabase.removeChannel(channel);
      };
    }

    let cleanup: (() => void) | undefined;
    void subscribeToNotifications().then((unsubscribe) => {
      cleanup = unsubscribe;
    });

    return () => {
      isMounted = false;
      cleanup?.();
    };
  }, []);

  useEffect(() => {
    if (currentNotification || queue.length === 0) return;

    const timeout = window.setTimeout(() => {
      const [nextNotification, ...remainingNotifications] = queue;
      setCurrentNotification(nextNotification);
      setQueue(remainingNotifications);
      setToastState("enter");
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [currentNotification, queue]);

  useEffect(() => {
    if (!currentNotification) return;

    closeTimeoutRef.current = setTimeout(() => {
      setToastState("exit");
      clearTimeoutRef.current = setTimeout(() => setCurrentNotification(null), 500);
    }, 6000);

    return () => {
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
      if (clearTimeoutRef.current) clearTimeout(clearTimeoutRef.current);
    };
  }, [currentNotification]);

  function closeToast() {
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    setToastState("exit");
    clearTimeoutRef.current = setTimeout(() => setCurrentNotification(null), 500);
  }

  async function handleOpen(notification: AppNotification) {
    await markNotificationRead(notification.id);
    closeToast();
  }

  if (!currentNotification) return null;

  return (
    <div
      className={`fixed left-1/2 top-4 z-[100] w-[calc(100%-2rem)] max-w-md rounded-2xl bg-ulv-blue/85 p-4 text-white shadow-xl backdrop-blur-md ${
        toastState === "enter" ? "ulv-toast-enter" : "ulv-toast-exit"
      }`}
      role="status"
      aria-live="polite"
    >
      <div className="flex gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-ulv-yellow text-ulv-blue">
          <Bell className="h-6 w-6" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-black leading-5">{currentNotification.title}</h2>
          <p className="mt-1 text-sm leading-5 text-white/85">{getMessageSummary(currentNotification.message)}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {currentNotification.link_url ? (
              <Link
                href={currentNotification.link_url}
                onClick={() => void handleOpen(currentNotification)}
                className="inline-flex min-h-9 items-center justify-center rounded-xl bg-ulv-yellow px-4 text-xs font-black text-ulv-blue"
              >
                Abrir
              </Link>
            ) : null}
            <button
              type="button"
              onClick={closeToast}
              className="inline-flex min-h-9 items-center justify-center rounded-xl border border-white/25 px-4 text-xs font-black text-white transition hover:bg-white/10"
            >
              Cerrar
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={closeToast}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/80 transition hover:bg-white/10 hover:text-white"
          aria-label="Cerrar notificación"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
