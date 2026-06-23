"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { getUnreadNotificationsCount } from "@/services/notifications.service";
import { supabase } from "@/lib/supabase";

export function NotificationHeaderLink() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [hasSession, setHasSession] = useState(false);

  async function refreshCount() {
    const { data } = await supabase.auth.getSession();
    const isAuthenticated = Boolean(data.session);
    setHasSession(isAuthenticated);
    if (!isAuthenticated) return;

    const result = await getUnreadNotificationsCount();
    setUnreadCount(result.data);
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void refreshCount();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

  if (!hasSession) return null;

  return (
    <Link
      href="/notificaciones"
      className="relative inline-flex items-center gap-1 rounded-full border border-white/25 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/10"
    >
      <Bell className="h-4 w-4 text-ulv-yellow" aria-hidden="true" />
      <span>Notificaciones</span>
      {unreadCount > 0 ? (
        <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-ulv-yellow px-1 text-[0.65rem] font-black text-ulv-blue">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      ) : null}
    </Link>
  );
}
