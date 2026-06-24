"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, BookOpen, CalendarCheck, CircleHelp, Home, LogIn, LogOut, MapPinned, ShieldCheck, UserRound, Wrench } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getCurrentAppUser, type AdminAppUser, type AppUserRole } from "@/services/admin-users.service";
import { getUnreadNotificationsCount } from "@/services/dashboard.service";

type NavItem = {
  href: string;
  label: string;
  shortLabel: string;
  icon: typeof Home;
  requiresSession?: boolean;
  adminOnly?: boolean;
  showBadge?: boolean;
};

const desktopNavItems: NavItem[] = [
  { href: "/", label: "Inicio", shortLabel: "Inicio", icon: Home },
  { href: "/catalogo", label: "Catálogo", shortLabel: "Catálogo", icon: BookOpen },
  { href: "/espacios", label: "Espacios", shortLabel: "Espacios", icon: MapPinned },
  { href: "/servicios", label: "Servicios", shortLabel: "Servicios", icon: Wrench },
  { href: "/ayuda", label: "Ayuda", shortLabel: "Ayuda", icon: CircleHelp },
  { href: "/notificaciones", label: "Notificaciones", shortLabel: "Notif.", icon: Bell, requiresSession: true, showBadge: true },
  { href: "/mi-cuenta", label: "Mi cuenta", shortLabel: "Cuenta", icon: UserRound, requiresSession: true },
  { href: "/admin", label: "Admin", shortLabel: "Admin", icon: ShieldCheck, requiresSession: true, adminOnly: true },
];

const studentMobileNavItems: NavItem[] = [
  { href: "/", label: "Inicio", shortLabel: "Inicio", icon: Home },
  { href: "/espacios", label: "Espacios", shortLabel: "Espacios", icon: MapPinned },
  { href: "/reservas-espacios", label: "Reservas", shortLabel: "Reservar", icon: CalendarCheck, requiresSession: true },
  { href: "/notificaciones", label: "Notificaciones", shortLabel: "Notif.", icon: Bell, requiresSession: true, showBadge: true },
  { href: "/mi-cuenta", label: "Mi cuenta", shortLabel: "Cuenta", icon: UserRound, requiresSession: true },
];

const staffMobileNavItems: NavItem[] = [
  { href: "/", label: "Inicio", shortLabel: "Inicio", icon: Home },
  { href: "/admin", label: "Admin", shortLabel: "Admin", icon: ShieldCheck, requiresSession: true, adminOnly: true },
  { href: "/admin/reservas", label: "Reservas", shortLabel: "Reservas", icon: CalendarCheck, requiresSession: true, adminOnly: true },
  { href: "/notificaciones", label: "Notificaciones", shortLabel: "Notif.", icon: Bell, requiresSession: true, showBadge: true },
  { href: "/mi-cuenta", label: "Mi cuenta", shortLabel: "Cuenta", icon: UserRound, requiresSession: true },
];

function canAccessAdmin(role: AppUserRole | null) {
  return role === "librarian" || role === "admin" || role === "superadmin";
}

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [profile, setProfile] = useState<AdminAppUser | null>(null);
  const [hasSession, setHasSession] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const desktopItems = useMemo(() => {
    return desktopNavItems.filter((item) => (!item.requiresSession || hasSession) && (!item.adminOnly || canAccessAdmin(profile?.role ?? null)));
  }, [hasSession, profile?.role]);

  const mobileItems = useMemo(() => {
    const baseItems = canAccessAdmin(profile?.role ?? null) ? staffMobileNavItems : studentMobileNavItems;
    return baseItems.filter((item) => (!item.requiresSession || hasSession) && (!item.adminOnly || canAccessAdmin(profile?.role ?? null)));
  }, [hasSession, profile?.role]);

  async function refreshProfile() {
    const { data } = await supabase.auth.getSession();
    const isAuthenticated = Boolean(data.session);
    setHasSession(isAuthenticated);

    if (!isAuthenticated) {
      setProfile(null);
      setUnreadCount(0);
      return;
    }

    const [profileResult, notificationResult] = await Promise.all([getCurrentAppUser(), getUnreadNotificationsCount()]);
    setProfile(profileResult.data);
    setUnreadCount(notificationResult.data);
  }

  async function refreshUnreadCount() {
    const result = await getUnreadNotificationsCount();
    setUnreadCount(result.data);
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void refreshProfile();
    }, 0);

    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      void refreshProfile();
    });

    return () => {
      window.clearTimeout(timeout);
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!hasSession || !profile?.id) return;

    const channel = supabase
      .channel(`navigation-notifications-${profile.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${profile.id}` }, () => {
        void refreshUnreadCount();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "notifications", filter: `user_id=eq.${profile.id}` }, () => {
        void refreshUnreadCount();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [hasSession, profile?.id]);

  async function handleSignOut() {
    setIsSigningOut(true);
    await supabase.auth.signOut();
    setProfile(null);
    setHasSession(false);
    setUnreadCount(0);
    setIsSigningOut(false);
    router.push("/");
  }

  return (
    <>
      <header className="sticky top-0 z-40 bg-ulv-blue text-white shadow-sm">
        <div className="mx-auto flex min-h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/" className="flex items-center gap-3" aria-label="Ir al inicio">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-ulv-yellow text-lg font-black text-ulv-blue">
              ULV
            </span>
            <span className="hidden sm:block">
              <span className="block text-base font-bold leading-tight">Biblioteca ULV App</span>
              <span className="block text-xs text-white/80">Servicios bibliotecarios</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex" aria-label="Navegación principal">
            {desktopItems.map((item) => {
              const Icon = item.icon;
              const isActive = isActivePath(pathname, item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`inline-flex min-h-10 items-center gap-2 rounded-2xl px-3 text-sm font-bold transition ${
                    isActive ? "bg-ulv-yellow text-ulv-blue" : "text-white hover:bg-white/10"
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {item.label}
                  {item.showBadge && unreadCount > 0 ? (
                    <span className={`ml-1 rounded-full px-2 py-0.5 text-xs font-black ${isActive ? "bg-ulv-blue text-white" : "bg-ulv-yellow text-ulv-blue"}`}>
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            {hasSession ? (
              <button
                type="button"
                onClick={() => void handleSignOut()}
                disabled={isSigningOut}
                className="inline-flex min-h-10 items-center gap-2 rounded-2xl border border-white/25 px-3 text-xs font-bold text-white transition hover:bg-white/10 disabled:opacity-60"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                Cerrar sesión
              </button>
            ) : (
              <Link href="/login" className="inline-flex min-h-10 items-center gap-2 rounded-2xl bg-ulv-yellow px-3 text-xs font-black text-ulv-blue">
                <LogIn className="h-4 w-4" aria-hidden="true" />
                Iniciar sesión
              </Link>
            )}
          </div>

          <div className="flex items-center gap-2 md:hidden">
            {hasSession ? (
              <button
                type="button"
                onClick={() => void handleSignOut()}
                disabled={isSigningOut}
                className="rounded-full border border-white/25 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/10 disabled:opacity-60"
              >
                Salir
              </button>
            ) : (
              <Link href="/login" className="rounded-full bg-ulv-yellow px-3 py-2 text-xs font-black text-ulv-blue">
                Iniciar sesión
              </Link>
            )}
          </div>
        </div>
      </header>

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur md:hidden" aria-label="Navegación móvil">
        <div className="mx-auto grid max-w-md grid-cols-5 px-1 pb-[max(env(safe-area-inset-bottom),0.25rem)] pt-2">
          {mobileItems.map((item) => {
            const Icon = item.icon;
            const isActive = isActivePath(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[0.66rem] font-semibold transition ${
                  isActive ? "bg-ulv-yellow text-ulv-blue" : "text-slate-500 hover:bg-slate-100 hover:text-ulv-blue"
                }`}
              >
                <span className="relative">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                  {item.showBadge && unreadCount > 0 ? (
                    <span className="absolute -right-3 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-ulv-yellow px-1 text-[0.62rem] font-black text-ulv-blue ring-2 ring-white">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  ) : null}
                </span>
                <span>{item.shortLabel}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
