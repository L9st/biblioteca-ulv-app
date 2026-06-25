"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, CalendarCheck, Clock3, LayoutDashboard, LogOut, MapPinned, RefreshCw, ShieldAlert, UserRound } from "lucide-react";
import { Badge, getStatusBadgeTone } from "@/app/ui/Badge";
import { Card } from "@/app/ui/Card";
import { PageContainer } from "@/app/layout/PageContainer";
import { supabase } from "@/lib/supabase";
import {
  buildAccountSummary,
  formatMinutes,
  getAccountAttendanceLogs,
  getAccountReservations,
  getCurrentAccountUser,
  getCurrentOpenAttendance,
  getNextAccountReservations,
  getUnreadNotificationsCount,
  type AccountAttendanceLog,
  type AccountReservation,
  type AccountSummary,
  type AccountUser,
} from "@/services/account.service";

type ActiveTab = "summary" | "hours" | "reservations" | "account";

const tabs: Array<{ id: ActiveTab; label: string }> = [
  { id: "summary", label: "Resumen" },
  { id: "hours", label: "Horas" },
  { id: "reservations", label: "Reservas" },
  { id: "account", label: "Cuenta" },
];

const roleLabels: Record<AccountUser["role"], string> = {
  student: "Usuario",
  librarian: "Bibliotecario",
  admin: "Administrador",
  superadmin: "Superadministrador",
};

const accountStatusLabels: Record<AccountUser["status"], string> = {
  active: "Activa",
  inactive: "Inactiva",
  blocked: "Bloqueada",
};

const reservationStatusLabels: Record<AccountReservation["status"], string> = {
  pending: "Pendiente",
  approved: "Aprobada",
  rejected: "Rechazada",
  cancelled: "Cancelada",
  completed: "Completada",
};

function canAccessAdmin(role: AccountUser["role"]) {
  return role === "librarian" || role === "admin" || role === "superadmin";
}

function formatDateTime(value: string | null) {
  if (!value) return "Pendiente";
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function formatDate(value: string | null) {
  if (!value) return "Sin registro";
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" }).format(new Date(value));
}

function getAttendanceStatusLabel(status: AccountAttendanceLog["status"]) {
  return status === "open" ? "Entrada abierta" : "Cerrado";
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-ulv-blue">{value}</p>
    </Card>
  );
}

function OpenAttendanceCard({ openAttendance }: { openAttendance: AccountAttendanceLog | null }) {
  return (
    <Card>
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-ulv-yellow text-ulv-blue">
          <Clock3 className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-lg font-black text-ulv-blue">Entrada activa</h2>
          {openAttendance ? (
            <>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Estás dentro de {openAttendance.libraries?.name ?? "Biblioteca"}.
              </p>
              <p className="mt-1 text-sm font-bold text-slate-900">Entrada: {formatDateTime(openAttendance.check_in_at)}</p>
            </>
          ) : (
            <p className="mt-2 text-sm leading-6 text-slate-600">No tienes una entrada activa.</p>
          )}
        </div>
      </div>
    </Card>
  );
}

function ReservationCard({ reservation }: { reservation: AccountReservation }) {
  return (
    <article className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-black text-ulv-blue">{reservation.library_spaces?.name ?? "Espacio"}</h3>
          <p className="mt-1 text-sm text-slate-600">{reservation.libraries?.name ?? "Biblioteca"}</p>
        </div>
        <Badge tone={getStatusBadgeTone(reservation.status)}>
          {reservationStatusLabels[reservation.status]}
        </Badge>
      </div>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-bold text-slate-500">Inicio</dt>
          <dd className="mt-1 text-slate-900">{formatDateTime(reservation.start_at)}</dd>
        </div>
        <div>
          <dt className="font-bold text-slate-500">Fin</dt>
          <dd className="mt-1 text-slate-900">{formatDateTime(reservation.end_at)}</dd>
        </div>
        <div>
          <dt className="font-bold text-slate-500">Motivo</dt>
          <dd className="mt-1 text-slate-900">{reservation.purpose ?? "Sin motivo registrado"}</dd>
        </div>
        <div>
          <dt className="font-bold text-slate-500">Notas administrativas</dt>
          <dd className="mt-1 text-slate-900">{reservation.admin_notes ?? "Sin notas"}</dd>
        </div>
      </dl>
    </article>
  );
}

function QuickLinks({ user }: { user: AccountUser }) {
  const links = [
    { href: "/horas", label: "Mis horas", icon: Clock3 },
    { href: "/reservas-espacios", label: "Reservar espacio", icon: CalendarCheck },
    { href: "/notificaciones", label: "Notificaciones", icon: Bell },
    { href: "/espacios", label: "Espacios", icon: MapPinned },
    ...(canAccessAdmin(user.role) ? [{ href: "/admin", label: "Panel administrativo", icon: LayoutDashboard }] : []),
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {links.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className="flex min-h-14 items-center gap-3 rounded-2xl bg-white px-4 py-3 text-sm font-black text-ulv-blue shadow-sm ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-ulv-yellow text-ulv-blue">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}

export function MyAccountPanel() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ActiveTab>("summary");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [user, setUser] = useState<AccountUser | null>(null);
  const [openAttendance, setOpenAttendance] = useState<AccountAttendanceLog | null>(null);
  const [attendanceLogs, setAttendanceLogs] = useState<AccountAttendanceLog[]>([]);
  const [reservations, setReservations] = useState<AccountReservation[]>([]);
  const [nextReservations, setNextReservations] = useState<AccountReservation[]>([]);
  const [summary, setSummary] = useState<AccountSummary>({ todayMinutes: 0, weekMinutes: 0, monthMinutes: 0, totalMinutes: 0, unreadNotifications: 0 });
  const [error, setError] = useState<string | null>(null);

  async function loadAccount() {
    setIsRefreshing(true);
    const { data } = await supabase.auth.getSession();
    const isAuthenticated = Boolean(data.session);
    setHasSession(isAuthenticated);

    if (!isAuthenticated) {
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    const [userResult, openResult, logsResult, reservationsResult, nextReservationsResult, unreadResult] = await Promise.all([
      getCurrentAccountUser(),
      getCurrentOpenAttendance(),
      getAccountAttendanceLogs(),
      getAccountReservations(),
      getNextAccountReservations(),
      getUnreadNotificationsCount(),
    ]);

    setUser(userResult.data);
    setOpenAttendance(openResult.data);
    setAttendanceLogs(logsResult.data);
    setReservations(reservationsResult.data);
    setNextReservations(nextReservationsResult.data);
    setSummary(buildAccountSummary(logsResult.data, unreadResult.data));
    setError(userResult.error ?? openResult.error ?? logsResult.error ?? reservationsResult.error ?? nextReservationsResult.error ?? unreadResult.error);
    setIsLoading(false);
    setIsRefreshing(false);
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadAccount();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

  async function handleSignOut() {
    setIsSigningOut(true);
    await supabase.auth.signOut();
    setIsSigningOut(false);
    router.push("/");
  }

  if (isLoading) {
    return (
      <PageContainer>
        <Card>
          <p className="text-sm font-semibold text-slate-600">Cargando tu cuenta...</p>
        </Card>
      </PageContainer>
    );
  }

  if (!hasSession) {
    return (
      <PageContainer>
        <Card className="text-center">
          <ShieldAlert className="mx-auto h-10 w-10 text-ulv-blue" aria-hidden="true" />
          <h1 className="mt-3 text-2xl font-black text-ulv-blue">Debes iniciar sesión para acceder a esta sección.</h1>
          <Link
            href="/login?redirect=/mi-cuenta"
            className="mt-5 inline-flex min-h-12 items-center justify-center rounded-2xl bg-ulv-yellow px-5 py-3 text-sm font-black text-ulv-blue shadow-sm"
          >
            Iniciar sesión
          </Link>
        </Card>
      </PageContainer>
    );
  }

  if (!user) {
    return (
      <PageContainer>
        <Card>
          <h1 className="text-xl font-black text-ulv-blue">No se pudo cargar tu perfil.</h1>
          <button type="button" onClick={() => void loadAccount()} className="mt-4 min-h-12 rounded-2xl bg-ulv-yellow px-5 text-sm font-black text-ulv-blue">
            Reintentar
          </button>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      {error ? <p className="mb-5 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</p> : null}

      <section className="rounded-2xl bg-ulv-blue px-5 py-7 text-white shadow-sm md:px-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-ulv-yellow">Mi cuenta</p>
            <h1 className="mt-3 text-3xl font-black leading-tight md:text-5xl">Hola, {user.name || user.email}</h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-white/85">
              Consulta tu perfil, horas, reservas y notificaciones personales desde un solo lugar.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black text-white">{roleLabels[user.role]}</span>
              <span className="rounded-full bg-ulv-yellow px-3 py-1 text-xs font-black text-ulv-blue">Cuenta {accountStatusLabels[user.status]}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void loadAccount()}
            disabled={isRefreshing}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-white/25 px-4 text-sm font-bold text-white transition hover:bg-white/10 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} aria-hidden="true" />
            Refrescar
          </button>
        </div>
      </section>

      <Card className="mt-5 p-3">
        <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Secciones de mi cuenta">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`min-h-11 shrink-0 rounded-2xl px-4 py-2 text-sm font-black ${
                activeTab === tab.id ? "bg-ulv-yellow text-ulv-blue" : "border border-slate-200 bg-white text-ulv-blue"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </Card>

      {activeTab === "summary" ? (
        <section className="mt-5 space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="Horas de hoy" value={formatMinutes(summary.todayMinutes)} />
            <StatTile label="Esta semana" value={formatMinutes(summary.weekMinutes)} />
            <StatTile label="Este mes" value={formatMinutes(summary.monthMinutes)} />
            <StatTile label="Notificaciones no leídas" value={`${summary.unreadNotifications}`} />
          </div>

          <OpenAttendanceCard openAttendance={openAttendance} />

          <Card>
            <h2 className="text-lg font-black text-ulv-blue">Próximas reservas</h2>
            <div className="mt-4 space-y-3">
              {nextReservations.length === 0 ? <p className="text-sm text-slate-600">No tienes reservas próximas.</p> : nextReservations.map((reservation) => <ReservationCard key={reservation.id} reservation={reservation} />)}
            </div>
          </Card>

          <div>
            <h2 className="mb-3 text-lg font-black text-ulv-blue">Accesos rápidos</h2>
            <QuickLinks user={user} />
          </div>
        </section>
      ) : null}

      {activeTab === "hours" ? (
        <section className="mt-5 space-y-5">
          <OpenAttendanceCard openAttendance={openAttendance} />
          <div className="grid gap-4 sm:grid-cols-2">
            <StatTile label="Horas totales" value={formatMinutes(summary.totalMinutes)} />
            <StatTile label="Registros recientes" value={`${attendanceLogs.length}`} />
          </div>

          <Card>
            <h2 className="mb-4 text-lg font-black text-ulv-blue">Historial reciente de horas</h2>
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-ulv-blue text-white">
                  <tr>
                    <th className="px-4 py-3">Biblioteca</th>
                    <th className="px-4 py-3">Entrada</th>
                    <th className="px-4 py-3">Salida</th>
                    <th className="px-4 py-3">Tiempo</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3">Fuente</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {attendanceLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center font-semibold text-slate-500">No tienes registros de horas.</td>
                    </tr>
                  ) : (
                    attendanceLogs.map((log) => (
                      <tr key={log.id}>
                        <td className="px-4 py-3 font-bold text-ulv-blue">{log.libraries?.name ?? "Biblioteca"}</td>
                        <td className="px-4 py-3">{formatDateTime(log.check_in_at)}</td>
                        <td className="px-4 py-3">{formatDateTime(log.check_out_at)}</td>
                        <td className="px-4 py-3 font-bold">{formatMinutes(log.total_minutes)}</td>
                        <td className="px-4 py-3">{getAttendanceStatusLabel(log.status)}</td>
                        <td className="px-4 py-3">{log.source ?? "Sin fuente"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </section>
      ) : null}

      {activeTab === "reservations" ? (
        <section className="mt-5 space-y-5">
          <Card>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-black text-ulv-blue">Próximas reservas</h2>
                <p className="mt-1 text-sm text-slate-600">Reservas pendientes o aprobadas que aún no inician.</p>
              </div>
              <Link href="/reservas-espacios" className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-ulv-yellow px-4 text-sm font-black text-ulv-blue">
                Reservar otro espacio
              </Link>
            </div>
            <div className="mt-4 space-y-3">
              {nextReservations.length === 0 ? <p className="text-sm text-slate-600">No tienes reservas próximas.</p> : nextReservations.map((reservation) => <ReservationCard key={reservation.id} reservation={reservation} />)}
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-black text-ulv-blue">Últimas reservas</h2>
            <div className="mt-4 space-y-3">
              {reservations.length === 0 ? <p className="text-sm text-slate-600">No tienes reservas registradas.</p> : reservations.map((reservation) => <ReservationCard key={reservation.id} reservation={reservation} />)}
            </div>
          </Card>
        </section>
      ) : null}

      {activeTab === "account" ? (
        <section className="mt-5 space-y-5">
          <Card>
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-ulv-yellow text-ulv-blue">
                <UserRound className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-lg font-black text-ulv-blue">Datos de cuenta</h2>
                <p className="mt-1 text-sm text-slate-600">Tu rol y estado son informativos y no pueden editarse desde esta pantalla.</p>
              </div>
            </div>

            <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-4"><dt className="font-bold text-slate-500">Nombre</dt><dd className="mt-1 font-black text-slate-950">{user.name}</dd></div>
              <div className="rounded-2xl bg-slate-50 p-4"><dt className="font-bold text-slate-500">Correo</dt><dd className="mt-1 font-black text-slate-950">{user.email}</dd></div>
              <div className="rounded-2xl bg-slate-50 p-4"><dt className="font-bold text-slate-500">Rol</dt><dd className="mt-1 font-black text-ulv-blue">{roleLabels[user.role]}</dd></div>
              <div className="rounded-2xl bg-slate-50 p-4"><dt className="font-bold text-slate-500">Estado</dt><dd className="mt-1 font-black text-ulv-blue">{accountStatusLabels[user.status]}</dd></div>
              <div className="rounded-2xl bg-slate-50 p-4"><dt className="font-bold text-slate-500">Fecha de creación</dt><dd className="mt-1 font-black text-slate-950">{formatDate(user.created_at)}</dd></div>
              <div className="rounded-2xl bg-slate-50 p-4"><dt className="font-bold text-slate-500">Última actualización</dt><dd className="mt-1 font-black text-slate-950">{formatDate(user.updated_at)}</dd></div>
            </dl>
          </Card>

          <button
            type="button"
            onClick={() => void handleSignOut()}
            disabled={isSigningOut}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-ulv-yellow px-5 py-3 text-sm font-black text-ulv-blue shadow-sm disabled:opacity-60 sm:w-auto"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            {isSigningOut ? "Cerrando sesión..." : "Cerrar sesión"}
          </button>
        </section>
      ) : null}
    </PageContainer>
  );
}
