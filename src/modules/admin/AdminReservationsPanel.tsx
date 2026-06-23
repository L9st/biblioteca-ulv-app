"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCw, Search, ShieldAlert } from "lucide-react";
import { getCurrentAppUser, type AdminAppUser, type AppUserRole } from "@/services/admin-users.service";
import { getReservationStatusLabel, type ReservationStatus } from "@/services/reservations.service";
import {
  getAdminReservableSpaces,
  getAdminSpaceReservations,
  updateSpaceReservationStatus,
  type AdminSpaceReservation,
} from "@/services/admin-reservations.service";
import { Card } from "@/app/ui/Card";
import { DropdownSelect } from "@/app/ui/DropdownSelect";

type PeriodFilter = "today" | "week" | "month" | "all";
type StatusFilter = "all" | ReservationStatus;
type Feedback = { type: "success" | "error"; message: string };
type SpaceFilterOption = { id: string; name: string; library_id: string; libraries: { id: string; name: string; code: string } | null };

function canAccess(role: AppUserRole) {
  return role === "librarian" || role === "admin" || role === "superadmin";
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function isToday(date: string) {
  return new Date(date) >= startOfToday();
}

function isThisWeek(date: string) {
  const weekStart = startOfToday();
  const day = weekStart.getDay();
  weekStart.setDate(weekStart.getDate() - (day === 0 ? 6 : day - 1));
  return new Date(date) >= weekStart;
}

function isThisMonth(date: string) {
  const monthStart = startOfToday();
  monthStart.setDate(1);
  return new Date(date) >= monthStart;
}

function matchesPeriod(date: string, period: PeriodFilter) {
  if (period === "all") return true;
  if (period === "today") return isToday(date);
  if (period === "week") return isThisWeek(date);
  return isThisMonth(date);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function AdminReservationsPanel() {
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentUser, setCurrentUser] = useState<AdminAppUser | null>(null);
  const [reservations, setReservations] = useState<AdminSpaceReservation[]>([]);
  const [spaces, setSpaces] = useState<SpaceFilterOption[]>([]);
  const [libraryId, setLibraryId] = useState("all");
  const [spaceId, setSpaceId] = useState("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [period, setPeriod] = useState<PeriodFilter>("all");
  const [search, setSearch] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  async function loadData({ showLoading = true } = {}) {
    if (showLoading) setIsLoading(true);
    else setIsRefreshing(true);
    setFeedback(null);

    const userResult = await getCurrentAppUser();
    setCurrentUser(userResult.data);

    if (userResult.error) {
      setFeedback({ type: "error", message: userResult.error });
    }

    if (!userResult.data || !canAccess(userResult.data.role)) {
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    const [reservationsResult, spacesResult] = await Promise.all([getAdminSpaceReservations(), getAdminReservableSpaces()]);
    setReservations(reservationsResult.data);
    setSpaces(spacesResult.data.map((space) => ({ id: space.id, name: space.name, library_id: space.library_id, libraries: space.libraries })));

    if (reservationsResult.error || spacesResult.error) {
      setFeedback({ type: "error", message: reservationsResult.error ?? spacesResult.error ?? "No se pudieron cargar las reservas administrativas." });
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

  const libraries = Array.from(
    new Map(spaces.map((space) => [space.libraries?.id ?? space.library_id, space.libraries ?? { id: space.library_id, name: "Biblioteca", code: "" }])).values()
  );
  const filteredReservations = reservations.filter((reservation) => {
    const cleanSearch = search.trim().toLowerCase();
    const searchValues = [reservation.requester?.name, reservation.requester?.email, reservation.requester?.role, reservation.library_spaces?.name, reservation.libraries?.name];
    const matchesSearch = !cleanSearch || searchValues.some((value) => value?.toLowerCase().includes(cleanSearch));
    return (
      (libraryId === "all" || reservation.library_id === libraryId) &&
      (spaceId === "all" || reservation.space_id === spaceId) &&
      (status === "all" || reservation.status === status) &&
      matchesPeriod(reservation.start_at, period) &&
      matchesSearch
    );
  });

  async function updateStatus(reservationId: string, nextStatus: ReservationStatus) {
    const result = await updateSpaceReservationStatus(reservationId, nextStatus, adminNotes.trim() || undefined);
    if (result.error) {
      setFeedback({ type: "error", message: result.error ?? "No se pudo actualizar el estado de la reserva." });
      return;
    }

    setFeedback({ type: "success", message: "Reserva actualizada y notificación enviada." });
    await loadData({ showLoading: false });
  }

  if (isLoading) return <Card><p className="text-sm font-semibold text-slate-600">Cargando reservas...</p></Card>;

  if (!currentUser) {
    return (
      <Card className="text-center">
        <ShieldAlert className="mx-auto h-10 w-10 text-ulv-blue" aria-hidden="true" />
        <h2 className="mt-3 text-xl font-black text-ulv-blue">Debes iniciar sesión para acceder al panel administrativo.</h2>
        <Link href="/login?redirect=/admin/reservas" className="mt-5 inline-flex min-h-12 items-center justify-center rounded-2xl bg-ulv-yellow px-5 py-3 text-sm font-bold text-ulv-blue">
          Iniciar sesión
        </Link>
      </Card>
    );
  }

  if (!canAccess(currentUser.role)) {
    return <Card className="text-center"><ShieldAlert className="mx-auto h-10 w-10 text-red-700" aria-hidden="true" /><h2 className="mt-3 text-xl font-black text-red-700">No tienes permisos para acceder a esta sección.</h2></Card>;
  }

  return (
    <div className="space-y-5">
      {feedback ? <p className={`rounded-2xl p-4 text-sm font-bold ${feedback.type === "success" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>{feedback.message}</p> : null}

      <Card>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-black text-ulv-blue">Administración de reservas</h2>
            <p className="mt-1 text-sm text-slate-600">Revisa, aprueba o rechaza solicitudes de reserva de espacios.</p>
          </div>
          <button type="button" onClick={() => void loadData({ showLoading: false })} disabled={isRefreshing} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-ulv-yellow px-5 py-3 text-sm font-bold text-ulv-blue disabled:opacity-60">
            <RefreshCw className={`h-5 w-5 ${isRefreshing ? "animate-spin" : ""}`} aria-hidden="true" />
            Refrescar
          </button>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5"><DropdownSelect label="Filtrar por biblioteca" options={[{ label: "Todas las bibliotecas", value: "all" }, ...libraries.map((library) => ({ label: library.name, value: library.id }))]} value={libraryId} onChange={setLibraryId} emptyLabel="Todas las bibliotecas" /></div>
          <label><span className="text-sm font-bold text-ulv-blue">Espacio</span><select value={spaceId} onChange={(event) => setSpaceId(event.target.value)} className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 px-4 font-bold"><option value="all">Todos</option>{spaces.map((space) => <option key={space.id} value={space.id}>{space.name}</option>)}</select></label>
          <label><span className="text-sm font-bold text-ulv-blue">Estado</span><select value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)} className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 px-4 font-bold"><option value="all">Todos</option><option value="pending">Pendiente</option><option value="approved">Aprobada</option><option value="rejected">Rechazada</option><option value="cancelled">Cancelada</option><option value="completed">Completada</option></select></label>
          <label><span className="text-sm font-bold text-ulv-blue">Periodo</span><select value={period} onChange={(event) => setPeriod(event.target.value as PeriodFilter)} className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 px-4 font-bold"><option value="today">Hoy</option><option value="week">Esta semana</option><option value="month">Este mes</option><option value="all">Todos</option></select></label>
          <label><span className="text-sm font-bold text-ulv-blue">Buscar</span><span className="relative mt-2 block"><Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" /><input value={search} onChange={(event) => setSearch(event.target.value)} className="min-h-12 w-full rounded-2xl border border-slate-200 pl-11 pr-4 font-semibold" /></span></label>
        </div>

        <label className="mt-4 block"><span className="text-sm font-bold text-ulv-blue">Nota administrativa</span><input value={adminNotes} onChange={(event) => setAdminNotes(event.target.value)} className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 px-4 font-semibold" /></label>
      </Card>

      <Card>
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="min-w-[1180px] w-full text-left text-sm">
            <thead className="bg-ulv-blue text-white">
              <tr>
                <th className="px-4 py-3">Solicitante</th>
                <th className="px-4 py-3">Correo</th>
                <th className="px-4 py-3">Rol</th>
                <th className="px-4 py-3">Biblioteca</th>
                <th className="px-4 py-3">Espacio</th>
                <th className="px-4 py-3">Inicio</th>
                <th className="px-4 py-3">Fin</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {filteredReservations.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center font-semibold text-slate-500">No hay reservas con los filtros seleccionados.</td></tr>
              ) : (
                filteredReservations.map((reservation) => (
                  <tr key={reservation.id}>
                    <td className="px-4 py-3 font-black text-ulv-blue">{reservation.requester?.name ?? "Sin nombre"}</td>
                    <td className="px-4 py-3 font-semibold text-slate-600">{reservation.requester?.email ?? "Sin correo"}</td>
                    <td className="px-4 py-3 text-slate-700">{reservation.requester?.role ?? "Sin rol"}</td>
                    <td className="px-4 py-3">{reservation.libraries?.name ?? "Biblioteca"}</td>
                    <td className="px-4 py-3 font-semibold">{reservation.library_spaces?.name ?? "Espacio"}</td>
                    <td className="px-4 py-3">{formatDateTime(reservation.start_at)}</td>
                    <td className="px-4 py-3">{formatDateTime(reservation.end_at)}</td>
                    <td className="px-4 py-3 font-bold">{getReservationStatusLabel(reservation.status)}</td>
                    <td className="px-4 py-3"><div className="flex flex-wrap gap-2"><button onClick={() => void updateStatus(reservation.id, "approved")} className="rounded-xl bg-ulv-yellow px-3 py-2 text-xs font-black text-ulv-blue">Aprobar</button><button onClick={() => void updateStatus(reservation.id, "rejected")} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-ulv-blue">Rechazar</button><button onClick={() => void updateStatus(reservation.id, "cancelled")} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-ulv-blue">Cancelar</button><button onClick={() => void updateStatus(reservation.id, "completed")} className="rounded-xl bg-ulv-blue px-3 py-2 text-xs font-black text-white">Completar</button></div></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
