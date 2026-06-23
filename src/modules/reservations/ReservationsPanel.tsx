"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { CalendarCheck, ShieldAlert } from "lucide-react";
import { Card } from "@/app/ui/Card";
import { DropdownSelect } from "@/app/ui/DropdownSelect";
import { supabase } from "@/lib/supabase";
import {
  cancelMySpaceReservation,
  buildDaySchedule,
  createSpaceReservation,
  getMySpaceReservations,
  getReservableSpaces,
  getReservationsForDate,
  getReservationStatusLabel,
  type ReservationCalendarItem,
  type ReservableSpace,
  type SpaceReservation,
} from "@/services/reservations.service";

type ActiveTab = "reserve" | "mine" | "calendar";
type Feedback = { type: "success" | "error"; message: string };
type CalendarStatusFilter = "all" | "approved" | "pending";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" }).format(new Date(value));
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("es-MX", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function cleanText(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function canCancel(status: string) {
  return status === "pending" || status === "approved";
}

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function getBlockClassName(isOccupied: boolean, status?: string) {
  if (!isOccupied) return "border-slate-200 bg-white text-slate-700";
  if (status === "approved") return "border-ulv-blue bg-ulv-blue/10 text-ulv-blue";
  return "border-ulv-yellow bg-ulv-yellow/20 text-ulv-blue";
}

const activeButtonClass = "border-ulv-blue bg-ulv-blue text-white shadow-sm";
const inactiveButtonClass = "border-slate-200 bg-white text-ulv-blue hover:border-ulv-yellow";
const selectionButtonBaseClass = "w-full rounded-xl border px-2 py-2 text-center text-xs font-black leading-tight transition sm:w-auto sm:px-4 sm:text-sm";
const fieldClass = "mt-2 min-h-12 w-full min-w-0 max-w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-ulv-blue focus:ring-4 focus:ring-ulv-blue/10";

export function ReservationsPanel() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("reserve");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [spaces, setSpaces] = useState<ReservableSpace[]>([]);
  const [reservations, setReservations] = useState<SpaceReservation[]>([]);
  const [libraryId, setLibraryId] = useState("all");
  const [spaceId, setSpaceId] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [purpose, setPurpose] = useState("");
  const [attendeesCount, setAttendeesCount] = useState("");
  const [notes, setNotes] = useState("");
  const [calendarLibraryId, setCalendarLibraryId] = useState("all");
  const [calendarSpaceId, setCalendarSpaceId] = useState("all");
  const [calendarDate, setCalendarDate] = useState(todayInputValue());
  const [calendarStatus, setCalendarStatus] = useState<CalendarStatusFilter>("all");
  const [calendarReservations, setCalendarReservations] = useState<ReservationCalendarItem[]>([]);
  const [isCalendarLoading, setIsCalendarLoading] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  async function loadData() {
    setIsLoading(true);
    const { data } = await supabase.auth.getSession();
    const hasSession = Boolean(data.session);
    setIsAuthenticated(hasSession);
    setCurrentUserId(data.session?.user.id ?? null);

    if (!hasSession) {
      setIsLoading(false);
      return;
    }

    const [spacesResult, reservationsResult] = await Promise.all([
      getReservableSpaces(),
      getMySpaceReservations(),
    ]);

    setSpaces(spacesResult.data);
    setReservations(reservationsResult.data);
    setSpaceId((current) => current || spacesResult.data[0]?.id || "");

    if (spacesResult.error || reservationsResult.error) {
      setFeedback({
        type: "error",
        message: spacesResult.error ?? reservationsResult.error ?? "No se pudieron cargar las reservas.",
      });
    }

    setIsLoading(false);
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadData();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

  const libraries = Array.from(
    new Map(
      spaces.map((space) => [
        space.libraries?.id ?? space.library_id,
        space.libraries ?? { id: space.library_id, name: "Biblioteca", code: "" },
      ]),
    ).values(),
  );
  const filteredSpaces = libraryId === "all" ? spaces : spaces.filter((space) => space.library_id === libraryId);
  const calendarSpaces = spaces.filter((space) => (calendarLibraryId === "all" || space.library_id === calendarLibraryId) && (calendarSpaceId === "all" || space.id === calendarSpaceId));

  async function loadCalendar() {
    setIsCalendarLoading(true);
    const result = await getReservationsForDate({ date: calendarDate, libraryId: calendarLibraryId, spaceId: calendarSpaceId, status: calendarStatus });
    setCalendarReservations(result.data);
    if (result.error) setFeedback({ type: "error", message: result.error });
    setIsCalendarLoading(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const startDate = new Date(startAt);
    const endDate = new Date(endAt);

    if (!spaceId) {
      setFeedback({ type: "error", message: "Selecciona un espacio." });
      return;
    }

    if (startDate.getTime() < Date.now()) {
      setFeedback({ type: "error", message: "No se permiten reservas en fechas pasadas." });
      return;
    }

    if (endDate <= startDate) {
      setFeedback({ type: "error", message: "La hora de fin debe ser posterior a la hora de inicio." });
      return;
    }

    setIsSubmitting(true);
    const result = await createSpaceReservation({
      spaceId,
      startAt: startDate.toISOString(),
      endAt: endDate.toISOString(),
      purpose: cleanText(purpose),
      attendeesCount: attendeesCount.trim() ? Number(attendeesCount) : null,
      notes: cleanText(notes),
    });

    if (result.error) {
      setFeedback({ type: "error", message: result.error });
    } else {
      setFeedback({ type: "success", message: "Reserva solicitada correctamente" });
      setPurpose("");
      setAttendeesCount("");
      setNotes("");
      await loadData();
      setActiveTab("mine");
    }

    setIsSubmitting(false);
  }

  async function handleCancel(reservationId: string) {
    const result = await cancelMySpaceReservation(reservationId);

    if (result.error) {
      setFeedback({ type: "error", message: result.error });
    } else {
      setFeedback({ type: "success", message: "Reserva cancelada correctamente" });
      await loadData();
    }
  }

  if (isLoading) {
    return (
      <Card>
        <p className="text-sm font-semibold text-slate-600">Cargando reservas...</p>
      </Card>
    );
  }

  if (!isAuthenticated) {
    return (
      <Card className="text-center">
        <ShieldAlert className="mx-auto h-10 w-10 text-ulv-blue" aria-hidden="true" />
        <h2 className="mt-3 text-xl font-black text-ulv-blue">Debes iniciar sesión para acceder a esta sección.</h2>
        <Link
          href="/login?redirect=/reservas-espacios"
          className="mt-5 inline-flex min-h-12 items-center justify-center rounded-2xl bg-ulv-yellow px-5 py-3 text-sm font-bold text-ulv-blue shadow-sm transition hover:bg-[#e8b800]"
        >
          Iniciar sesión
        </Link>
      </Card>
    );
  }

  return (
    <div className="w-full max-w-full space-y-5 overflow-hidden pb-4">
      {feedback ? (
        <p
          className={`rounded-2xl p-4 text-sm font-bold ${
            feedback.type === "success" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"
          }`}
        >
          {feedback.message}
        </p>
      ) : null}

      <Card className="w-full max-w-full overflow-hidden p-3">
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <button
            type="button"
            onClick={() => setActiveTab("reserve")}
            className={`${selectionButtonBaseClass} ${activeTab === "reserve" ? activeButtonClass : inactiveButtonClass}`}
          >
            Reservar espacio
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("mine")}
            className={`${selectionButtonBaseClass} ${activeTab === "mine" ? activeButtonClass : inactiveButtonClass}`}
          >
            Mis reservas
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("calendar");
              void loadCalendar();
            }}
            className={`${selectionButtonBaseClass} ${activeTab === "calendar" ? activeButtonClass : inactiveButtonClass}`}
          >
            Calendario
          </button>
        </div>
      </Card>

      {activeTab === "reserve" ? (
        <Card className="w-full max-w-full overflow-hidden p-4 sm:p-6">
          <div className="mb-5 flex min-w-0 items-start gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-ulv-yellow text-ulv-blue">
              <CalendarCheck className="h-6 w-6" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 className="text-xl font-black text-ulv-blue">Reservas de espacios</h2>
              <p className="mt-1 break-words text-sm leading-snug text-slate-600">Solicita la reserva de un espacio disponible en biblioteca.</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="grid w-full max-w-full grid-cols-1 gap-4 md:grid-cols-2">
            <div className="w-full max-w-full overflow-hidden rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/5 sm:p-4">
              <DropdownSelect
                label="Filtrar por biblioteca"
                options={[
                  { label: "Todas las bibliotecas", value: "all" },
                  ...libraries.map((library) => ({ label: library.name, value: library.id })),
                ]}
                value={libraryId}
                onChange={(value) => {
                  setLibraryId(value);
                  setSpaceId("");
                }}
                emptyLabel="Todas las bibliotecas"
              />
            </div>

            <label>
              <span className="text-sm font-bold text-ulv-blue">Espacio</span>
              <select
                required
                value={spaceId}
                onChange={(event) => setSpaceId(event.target.value)}
                className={fieldClass}
              >
                <option value="">Selecciona un espacio</option>
                {filteredSpaces.map((space) => (
                  <option key={space.id} value={space.id}>
                    {space.name} - {space.libraries?.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="text-sm font-bold text-ulv-blue">Fecha y hora de inicio</span>
              <input
                required
                type="datetime-local"
                value={startAt}
                onChange={(event) => setStartAt(event.target.value)}
                className={fieldClass}
              />
            </label>

            <label>
              <span className="text-sm font-bold text-ulv-blue">Fecha y hora de fin</span>
              <input
                required
                type="datetime-local"
                value={endAt}
                onChange={(event) => setEndAt(event.target.value)}
                className={fieldClass}
              />
            </label>

            <label className="md:col-span-2">
              <span className="text-sm font-bold text-ulv-blue">Motivo</span>
              <input
                value={purpose}
                onChange={(event) => setPurpose(event.target.value)}
                className={fieldClass}
              />
            </label>

            <label>
              <span className="text-sm font-bold text-ulv-blue">Cantidad de asistentes</span>
              <input
                type="number"
                min="1"
                value={attendeesCount}
                onChange={(event) => setAttendeesCount(event.target.value)}
                className={fieldClass}
              />
            </label>

            <label>
              <span className="text-sm font-bold text-ulv-blue">Notas</span>
              <input
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className={fieldClass}
              />
            </label>

            <div className="md:col-span-2">
              <button
                disabled={isSubmitting}
                className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-ulv-yellow px-5 py-3 text-sm font-bold text-ulv-blue disabled:opacity-60"
              >
                {isSubmitting ? "Enviando..." : "Solicitar reserva"}
              </button>
            </div>
          </form>
        </Card>
      ) : null}

      {activeTab === "mine" ? (
        <Card className="w-full max-w-full overflow-hidden p-4 sm:p-6">
          <h2 className="mb-4 text-xl font-black text-ulv-blue">Mis reservas</h2>
          <div className="space-y-3 md:hidden">
            {reservations.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center text-sm font-semibold text-slate-500">
                Aun no tienes reservas.
              </div>
            ) : (
              reservations.map((reservation) => (
                <article key={reservation.id} className="w-full max-w-full overflow-hidden rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="break-words text-base font-black text-ulv-blue">{reservation.library_spaces?.name ?? "Espacio"}</h3>
                      <p className="mt-1 break-words text-sm leading-snug text-slate-600">{reservation.libraries?.name ?? "Biblioteca"}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-ulv-blue px-3 py-1 text-xs font-black text-white">
                      {getReservationStatusLabel(reservation.status)}
                    </span>
                  </div>
                  <dl className="mt-4 grid grid-cols-1 gap-3 text-sm">
                    <div>
                      <dt className="font-bold text-slate-500">Fecha</dt>
                      <dd className="font-black text-slate-900">{formatDate(reservation.start_at)}</dd>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <dt className="font-bold text-slate-500">Inicio</dt>
                        <dd className="font-black text-slate-900">{formatTime(reservation.start_at)}</dd>
                      </div>
                      <div>
                        <dt className="font-bold text-slate-500">Fin</dt>
                        <dd className="font-black text-slate-900">{formatTime(reservation.end_at)}</dd>
                      </div>
                    </div>
                  </dl>
                  {canCancel(reservation.status) ? (
                    <button
                      type="button"
                      onClick={() => void handleCancel(reservation.id)}
                      className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-ulv-yellow px-3 py-2 text-xs font-black text-ulv-blue"
                    >
                      Cancelar reserva
                    </button>
                  ) : null}
                </article>
              ))
            )}
          </div>
          <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 md:block">
            <table className="w-full min-w-[780px] text-left text-sm">
              <thead className="bg-ulv-blue text-white">
                <tr>
                  <th className="px-4 py-3">Espacio</th>
                  <th className="px-4 py-3">Biblioteca</th>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Hora inicio</th>
                  <th className="px-4 py-3">Hora fin</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {reservations.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center font-semibold text-slate-500">
                      Aun no tienes reservas.
                    </td>
                  </tr>
                ) : (
                  reservations.map((reservation) => (
                    <tr key={reservation.id}>
                      <td className="px-4 py-3 font-black text-ulv-blue">
                        {reservation.library_spaces?.name ?? "Espacio"}
                      </td>
                      <td className="px-4 py-3">{reservation.libraries?.name ?? "Biblioteca"}</td>
                      <td className="px-4 py-3">{formatDate(reservation.start_at)}</td>
                      <td className="px-4 py-3">{formatTime(reservation.start_at)}</td>
                      <td className="px-4 py-3">{formatTime(reservation.end_at)}</td>
                      <td className="px-4 py-3 font-bold">{getReservationStatusLabel(reservation.status)}</td>
                      <td className="px-4 py-3">
                        {canCancel(reservation.status) ? (
                          <button
                            type="button"
                            onClick={() => void handleCancel(reservation.id)}
                            className="rounded-xl bg-ulv-yellow px-3 py-2 text-xs font-black text-ulv-blue"
                          >
                            Cancelar reserva
                          </button>
                        ) : (
                          <span className="text-xs font-semibold text-slate-500">Sin acciones</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      {activeTab === "calendar" ? (
        <Card className="w-full max-w-full overflow-hidden p-4 pb-24 sm:p-6 md:pb-6">
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-black text-ulv-blue">Calendario de disponibilidad</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">Consulta horarios ocupados sin ver datos personales de otros usuarios.</p>
            </div>
            <button type="button" onClick={() => void loadCalendar()} disabled={isCalendarLoading} className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-ulv-yellow px-5 py-3 text-sm font-bold text-ulv-blue shadow-sm transition hover:bg-[#e8b800] disabled:opacity-60 md:w-auto">
              {isCalendarLoading ? "Cargando..." : "Actualizar calendario"}
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5"><DropdownSelect label="Biblioteca" options={[{ label: "Todas las bibliotecas", value: "all" }, ...libraries.map((library) => ({ label: library.name, value: library.id }))]} value={calendarLibraryId} onChange={(value) => { setCalendarLibraryId(value); setCalendarSpaceId("all"); }} emptyLabel="Todas las bibliotecas" /></div>
            <label><span className="text-sm font-bold text-ulv-blue">Espacio</span><select value={calendarSpaceId} onChange={(event) => setCalendarSpaceId(event.target.value)} className={fieldClass}><option value="all">Todos los espacios</option>{spaces.filter((space) => calendarLibraryId === "all" || space.library_id === calendarLibraryId).map((space) => <option key={space.id} value={space.id}>{space.name}</option>)}</select></label>
            <label><span className="text-sm font-bold text-ulv-blue">Fecha</span><input type="date" value={calendarDate} onChange={(event) => setCalendarDate(event.target.value)} className={fieldClass} /></label>
            <label><span className="text-sm font-bold text-ulv-blue">Estado</span><select value={calendarStatus} onChange={(event) => setCalendarStatus(event.target.value as CalendarStatusFilter)} className={fieldClass}><option value="all">Todas</option><option value="approved">Aprobadas</option><option value="pending">Pendientes</option></select></label>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-2">
            {calendarSpaces.length === 0 ? <p className="rounded-2xl bg-white p-5 text-center text-sm font-semibold text-slate-500">Selecciona una biblioteca o espacio disponible.</p> : null}
            {calendarSpaces.map((space) => {
              const blocks = buildDaySchedule({ date: calendarDate, reservations: calendarReservations, spaceId: space.id, currentUserId });
              const dayReservations = calendarReservations.filter((reservation) => reservation.space_id === space.id);
              return (
                <section key={space.id} className="rounded-3xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0"><h3 className="break-words text-lg font-black text-ulv-blue">{space.name}</h3><p className="mt-1 text-sm text-slate-600">{space.libraries?.name ?? "Biblioteca"}</p></div>
                    <span className="w-fit rounded-full bg-ulv-blue px-3 py-1 text-xs font-black text-white">{dayReservations.length} reservas</span>
                  </div>
                  <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2">
                    {blocks.map((block) => (
                      <div key={`${space.id}-${block.start}`} className={`rounded-2xl border p-3 ${getBlockClassName(block.isOccupied, block.status)}`}>
                        <p className="text-sm font-black">{block.label}</p>
                        <p className="mt-1 text-sm font-semibold">{block.displayText}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <button type="button" onClick={() => { setSpaceId(space.id); setStartAt(`${calendarDate}T07:00`); setEndAt(`${calendarDate}T08:00`); setActiveTab("reserve"); }} className="inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-ulv-yellow px-4 py-2 text-sm font-black text-ulv-blue">Reservar este espacio</button>
                    <button type="button" onClick={() => setActiveTab("mine")} className="inline-flex min-h-11 w-full items-center justify-center rounded-2xl border border-slate-200 px-4 py-2 text-sm font-black text-ulv-blue">Ver mis reservas</button>
                  </div>
                </section>
              );
            })}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
