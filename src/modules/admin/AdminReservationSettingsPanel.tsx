"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { CalendarClock, RefreshCw, ShieldAlert } from "lucide-react";
import { Card } from "@/app/ui/Card";
import { DropdownSelect } from "@/app/ui/DropdownSelect";
import { getCurrentAppUser, type AdminAppUser, type AppUserRole } from "@/services/admin-users.service";
import { getLibraryAccessContext, type LibraryAccessContext } from "@/services/library-access.service";
import {
  getLibraryOpeningHours,
  getReservationSettingsLibraries,
  getReservationSettingsSpaces,
  getSpaceReservationRules,
  upsertLibraryOpeningHour,
  upsertSpaceReservationRule,
  type LibraryOpeningHour,
  type ReservationSettingsLibrary,
  type ReservationSettingsSpace,
  type SpaceReservationRule,
} from "@/services/admin-reservation-settings.service";
import { buildDaySchedule, defaultSpaceReservationRule, getReservationValidationSettings, type ReservationTimeBlock } from "@/services/reservations.service";

type ActiveTab = "hours" | "rules" | "preview";
type Feedback = { type: "success" | "error"; message: string };
type HourForm = { day_of_week: number; is_closed: boolean; opens_at: string; closes_at: string; notes: string };
type RuleForm = {
  min_duration_minutes: string;
  max_duration_minutes: string;
  slot_interval_minutes: string;
  min_notice_minutes: string;
  max_days_ahead: string;
  requires_approval: boolean;
  max_reservations_per_user_day: string;
  is_active: boolean;
  notes: string;
};

const WEEK_DAYS = [
  { value: 1, label: "Lunes" },
  { value: 2, label: "Martes" },
  { value: 3, label: "Miércoles" },
  { value: 4, label: "Jueves" },
  { value: 5, label: "Viernes" },
  { value: 6, label: "Sábado" },
  { value: 0, label: "Domingo" },
] as const;

const fieldClass = "mt-2 min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 outline-none focus:border-ulv-blue focus:ring-4 focus:ring-ulv-blue/10";

function canAccess(role: AppUserRole) {
  return role === "librarian" || role === "admin" || role === "superadmin";
}

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function emptyHours(): HourForm[] {
  return WEEK_DAYS.map((day) => ({ day_of_week: day.value, is_closed: false, opens_at: "07:00", closes_at: "20:00", notes: "" }));
}

function ruleDefaults(): RuleForm {
  return {
    min_duration_minutes: "30",
    max_duration_minutes: "120",
    slot_interval_minutes: "30",
    min_notice_minutes: "30",
    max_days_ahead: "30",
    requires_approval: true,
    max_reservations_per_user_day: "2",
    is_active: true,
    notes: "",
  };
}

function applyHours(rows: LibraryOpeningHour[]): HourForm[] {
  const hoursByDay = new Map(rows.map((hour) => [hour.day_of_week, hour]));
  return emptyHours().map((day) => {
    const row = hoursByDay.get(day.day_of_week);
    if (!row) return day;
    return {
      day_of_week: day.day_of_week,
      is_closed: row.is_closed,
      opens_at: row.opens_at?.slice(0, 5) ?? "",
      closes_at: row.closes_at?.slice(0, 5) ?? "",
      notes: row.notes ?? "",
    };
  });
}

function formFromRule(rule: SpaceReservationRule | null): RuleForm {
  if (!rule) return ruleDefaults();
  return {
    min_duration_minutes: String(rule.min_duration_minutes),
    max_duration_minutes: String(rule.max_duration_minutes),
    slot_interval_minutes: String(rule.slot_interval_minutes),
    min_notice_minutes: String(rule.min_notice_minutes),
    max_days_ahead: String(rule.max_days_ahead),
    requires_approval: rule.requires_approval,
    max_reservations_per_user_day: String(rule.max_reservations_per_user_day),
    is_active: rule.is_active,
    notes: rule.notes ?? "",
  };
}

function cleanText(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getBlockClassName(block: ReservationTimeBlock) {
  if (block.isOccupied) return "border-ulv-yellow bg-ulv-yellow/20 text-ulv-blue";
  return "border-slate-200 bg-white text-slate-700";
}

export function AdminReservationSettingsPanel() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("hours");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [currentUser, setCurrentUser] = useState<AdminAppUser | null>(null);
  const [accessContext, setAccessContext] = useState<LibraryAccessContext | null>(null);
  const [libraries, setLibraries] = useState<ReservationSettingsLibrary[]>([]);
  const [spaces, setSpaces] = useState<ReservationSettingsSpace[]>([]);
  const [rules, setRules] = useState<SpaceReservationRule[]>([]);
  const [libraryId, setLibraryId] = useState("");
  const [spaceId, setSpaceId] = useState("");
  const [hours, setHours] = useState<HourForm[]>(emptyHours());
  const [ruleForm, setRuleForm] = useState<RuleForm>(ruleDefaults());
  const [previewDate, setPreviewDate] = useState(todayInputValue());
  const [previewBlocks, setPreviewBlocks] = useState<ReservationTimeBlock[]>([]);
  const [previewMessage, setPreviewMessage] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const loadData = useCallback(async ({ showLoading = true, selectedLibraryId = libraryId } = {}) => {
    if (showLoading) setIsLoading(true);
    else setIsRefreshing(true);
    setFeedback(null);

    const [userResult, context, librariesResult] = await Promise.all([getCurrentAppUser(), getLibraryAccessContext(), getReservationSettingsLibraries()]);
    setCurrentUser(userResult.data);
    setAccessContext(context);

    if (userResult.error || !userResult.data || !canAccess(userResult.data.role)) {
      if (userResult.error) setFeedback({ type: "error", message: userResult.error });
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    setLibraries(librariesResult.data);
    const selectedLibraryIsAllowed = librariesResult.data.some((library) => library.id === selectedLibraryId);
    const nextLibraryId = selectedLibraryIsAllowed ? selectedLibraryId : librariesResult.data[0]?.id || "";
    setLibraryId(nextLibraryId);

    if (nextLibraryId) {
      const [hoursResult, spacesResult, rulesResult] = await Promise.all([getLibraryOpeningHours(nextLibraryId), getReservationSettingsSpaces(nextLibraryId), getSpaceReservationRules(nextLibraryId)]);
      setHours(applyHours(hoursResult.data));
      setSpaces(spacesResult.data);
      setRules(rulesResult.data);
      const selectedSpaceIsAllowed = spacesResult.data.some((space) => space.id === spaceId);
      const nextSpaceId = selectedSpaceIsAllowed ? spaceId : spacesResult.data[0]?.id || "";
      setSpaceId(nextSpaceId);
      setRuleForm(formFromRule(rulesResult.data.find((rule) => rule.space_id === nextSpaceId) ?? null));
      if (hoursResult.error || spacesResult.error || rulesResult.error) setFeedback({ type: "error", message: hoursResult.error ?? spacesResult.error ?? rulesResult.error ?? "No se pudo cargar la configuración." });
    }

    if (librariesResult.error) setFeedback({ type: "error", message: librariesResult.error });
    setIsLoading(false);
    setIsRefreshing(false);
  }, [libraryId, spaceId]);

  useEffect(() => {
    const timeout = window.setTimeout(() => { void loadData(); }, 0);
    return () => window.clearTimeout(timeout);
  }, [loadData]);

  function updateHour(dayOfWeek: number, patch: Partial<HourForm>) {
    setHours((current) => current.map((hour) => (hour.day_of_week === dayOfWeek ? { ...hour, ...patch } : hour)));
  }

  function handleLibraryChange(value: string) {
    setLibraryId(value);
    setSpaceId("");
    setPreviewBlocks([]);
    void loadData({ showLoading: false, selectedLibraryId: value });
  }

  function handleSpaceChange(value: string) {
    setSpaceId(value);
    setRuleForm(formFromRule(rules.find((rule) => rule.space_id === value) ?? null));
    setPreviewBlocks([]);
  }

  async function saveHours() {
    if (!libraryId) return;

    const missingOpenHour = hours.find((hour) => !hour.is_closed && !hour.opens_at.trim());
    if (missingOpenHour) {
      setFeedback({ type: "error", message: "Indica la hora de apertura." });
      return;
    }

    const missingCloseHour = hours.find((hour) => !hour.is_closed && !hour.closes_at.trim());
    if (missingCloseHour) {
      setFeedback({ type: "error", message: "Indica la hora de cierre." });
      return;
    }

    const invalidDay = hours.find((hour) => !hour.is_closed && hour.closes_at <= hour.opens_at);
    if (invalidDay) {
      setFeedback({ type: "error", message: "La hora de cierre debe ser posterior a la hora de apertura." });
      return;
    }

    setIsSaving(true);
    const results = await Promise.all(hours.map((hour) => upsertLibraryOpeningHour({ library_id: libraryId, day_of_week: hour.day_of_week, is_closed: hour.is_closed, opens_at: hour.is_closed ? null : hour.opens_at, closes_at: hour.is_closed ? null : hour.closes_at, notes: cleanText(hour.notes) })));
    const error = results.find((result) => result.error)?.error;
    setFeedback(error ? { type: "error", message: `No se pudo guardar el horario. Detalle: ${error}` } : { type: "success", message: "Horario actualizado correctamente" });
    setIsSaving(false);
  }

  async function saveRules(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!spaceId) {
      setFeedback({ type: "error", message: "Selecciona un espacio." });
      return;
    }

    setIsSaving(true);
    const result = await upsertSpaceReservationRule({
      space_id: spaceId,
      min_duration_minutes: Number(ruleForm.min_duration_minutes),
      max_duration_minutes: Number(ruleForm.max_duration_minutes),
      slot_interval_minutes: Number(ruleForm.slot_interval_minutes),
      min_notice_minutes: Number(ruleForm.min_notice_minutes),
      max_days_ahead: Number(ruleForm.max_days_ahead),
      requires_approval: ruleForm.requires_approval,
      max_reservations_per_user_day: Number(ruleForm.max_reservations_per_user_day),
      is_active: ruleForm.is_active,
      notes: cleanText(ruleForm.notes),
    });
    setFeedback(result.error ? { type: "error", message: "No se pudieron guardar las reglas" } : { type: "success", message: "Reglas actualizadas correctamente" });
    if (!result.error) await loadData({ showLoading: false, selectedLibraryId: libraryId });
    setIsSaving(false);
  }

  async function loadPreview() {
    const space = spaces.find((item) => item.id === spaceId);
    if (!space || !libraryId) {
      setFeedback({ type: "error", message: "Selecciona biblioteca y espacio." });
      return;
    }

    setIsRefreshing(true);
    setPreviewMessage(null);
    const settingsResult = await getReservationValidationSettings({ spaceId: space.id, libraryId, date: previewDate });
    if (settingsResult.error || !settingsResult.data) {
      setFeedback({ type: "error", message: settingsResult.error ?? "No se pudo cargar la vista previa." });
      setIsRefreshing(false);
      return;
    }

    if (settingsResult.data.openingHour?.is_closed) {
      setPreviewBlocks([]);
      setPreviewMessage("La biblioteca está cerrada en la fecha seleccionada.");
    } else {
      setPreviewBlocks(buildDaySchedule({
        date: previewDate,
        reservations: settingsResult.data.reservationsForDate,
        spaceId: space.id,
        currentUserId: null,
        isAdmin: true,
        opensAt: settingsResult.data.openingHour?.opens_at,
        closesAt: settingsResult.data.openingHour?.closes_at,
        slotIntervalMinutes: settingsResult.data.rule.slot_interval_minutes,
      }));
    }
    setRuleForm(formFromRule(rules.find((rule) => rule.space_id === space.id) ?? null));
    setIsRefreshing(false);
  }

  const selectedRule = rules.find((rule) => rule.space_id === spaceId) ?? null;
  const canUsePanel = currentUser && canAccess(currentUser.role);
  const noLibrariesMessage = accessContext?.profile?.role === "librarian" && libraries.length === 0 ? "No tienes bibliotecas asignadas para configurar reservas." : null;

  if (isLoading) return <Card><p className="text-sm font-semibold text-slate-600">Cargando configuración de reservas...</p></Card>;

  if (!currentUser) return <Card className="text-center"><ShieldAlert className="mx-auto h-10 w-10 text-ulv-blue" aria-hidden="true" /><h2 className="mt-3 text-xl font-black text-ulv-blue">Debes iniciar sesión para acceder al panel administrativo.</h2><Link href="/login?redirect=/admin/configuracion-reservas" className="mt-5 inline-flex min-h-12 items-center justify-center rounded-2xl bg-ulv-yellow px-5 py-3 text-sm font-bold text-ulv-blue">Iniciar sesión</Link></Card>;
  if (!canUsePanel) return <Card className="text-center"><ShieldAlert className="mx-auto h-10 w-10 text-red-700" aria-hidden="true" /><h2 className="mt-3 text-xl font-black text-red-700">No tienes permisos para acceder a esta sección.</h2></Card>;

  return (
    <div className="space-y-5 pb-24 md:pb-4">
      {feedback ? <p className={`rounded-2xl p-4 text-sm font-bold ${feedback.type === "success" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>{feedback.message}</p> : null}
      {noLibrariesMessage ? <p className="rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-800">{noLibrariesMessage}</p> : null}

      <Card>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div><h2 className="text-xl font-black text-ulv-blue">Configuración de reservas</h2><p className="mt-1 text-sm text-slate-600">Define horarios de atención y reglas de reserva por espacio.</p></div>
          <button type="button" onClick={() => void loadData({ showLoading: false })} disabled={isRefreshing} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-ulv-yellow px-5 py-3 text-sm font-bold text-ulv-blue disabled:opacity-60"><RefreshCw className={`h-5 w-5 ${isRefreshing ? "animate-spin" : ""}`} aria-hidden="true" />Refrescar</button>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,240px)]">
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5"><DropdownSelect label="Biblioteca" options={libraries.map((library) => ({ label: library.name, value: library.id }))} value={libraryId} onChange={handleLibraryChange} /></div>
          <div className="flex items-end"><span className="w-full rounded-2xl bg-ulv-blue px-4 py-3 text-center text-sm font-black text-white">{spaces.length} espacios reservables</span></div>
        </div>
      </Card>

      <Card className="p-3"><div className="grid grid-cols-3 gap-2">{[{ id: "hours", label: "Horarios" }, { id: "rules", label: "Reglas por espacio" }, { id: "preview", label: "Vista previa" }].map((tab) => <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id as ActiveTab)} className={`min-h-11 rounded-2xl px-3 py-2 text-xs font-black sm:text-sm ${activeTab === tab.id ? "bg-ulv-yellow text-ulv-blue" : "border border-slate-200 bg-white text-ulv-blue"}`}>{tab.label}</button>)}</div></Card>

      {activeTab === "hours" ? <Card><div className="mb-5 flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-ulv-yellow text-ulv-blue"><CalendarClock className="h-5 w-5" aria-hidden="true" /></span><div><h3 className="text-xl font-black text-ulv-blue">Horarios de atención</h3><p className="text-sm text-slate-600">Configura apertura, cierre y notas por día.</p></div></div><div className="grid gap-4 lg:grid-cols-2">{hours.map((hour) => <section key={hour.day_of_week} className="rounded-3xl border border-slate-200 bg-white p-4"><div className="flex items-center justify-between gap-3"><h4 className="text-lg font-black text-ulv-blue">{WEEK_DAYS.find((day) => day.value === hour.day_of_week)?.label}</h4><label className="flex items-center gap-2 text-sm font-bold text-slate-700"><input type="checkbox" checked={hour.is_closed} onChange={(event) => updateHour(hour.day_of_week, { is_closed: event.target.checked })} /> Cerrado</label></div><div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2"><label><span className="text-sm font-bold text-ulv-blue">Hora de apertura</span><input type="time" disabled={hour.is_closed} value={hour.opens_at} onChange={(event) => updateHour(hour.day_of_week, { opens_at: event.target.value })} className={fieldClass} /></label><label><span className="text-sm font-bold text-ulv-blue">Hora de cierre</span><input type="time" disabled={hour.is_closed} value={hour.closes_at} onChange={(event) => updateHour(hour.day_of_week, { closes_at: event.target.value })} className={fieldClass} /></label></div><label className="mt-3 block"><span className="text-sm font-bold text-ulv-blue">Notas</span><input value={hour.notes} onChange={(event) => updateHour(hour.day_of_week, { notes: event.target.value })} className={fieldClass} /></label></section>)}</div><button type="button" onClick={() => void saveHours()} disabled={isSaving || !libraryId} className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-ulv-yellow px-5 py-3 text-sm font-black text-ulv-blue disabled:opacity-60 sm:w-auto">{isSaving ? "Guardando..." : "Guardar horario"}</button></Card> : null}

      {activeTab === "rules" ? <Card><form onSubmit={saveRules} className="space-y-5"><div className="grid gap-4 md:grid-cols-2"><label><span className="text-sm font-bold text-ulv-blue">Espacio</span><select value={spaceId} onChange={(event) => handleSpaceChange(event.target.value)} className={fieldClass}><option value="">Selecciona un espacio</option>{spaces.map((space) => <option key={space.id} value={space.id}>{space.name}</option>)}</select></label><div className="rounded-2xl bg-ulv-blue p-4 text-white"><p className="text-sm font-bold text-ulv-yellow">Ejemplo</p><p className="mt-1 text-sm">30 a 120 min · intervalo 30 min · máximo 30 días antes · 2 reservas por día.</p></div></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><label><span className="text-sm font-bold text-ulv-blue">Duración mínima</span><input type="number" min="1" value={ruleForm.min_duration_minutes} onChange={(event) => setRuleForm((current) => ({ ...current, min_duration_minutes: event.target.value }))} className={fieldClass} /></label><label><span className="text-sm font-bold text-ulv-blue">Duración máxima</span><input type="number" min="1" value={ruleForm.max_duration_minutes} onChange={(event) => setRuleForm((current) => ({ ...current, max_duration_minutes: event.target.value }))} className={fieldClass} /></label><label><span className="text-sm font-bold text-ulv-blue">Intervalo de bloques</span><input type="number" min="1" value={ruleForm.slot_interval_minutes} onChange={(event) => setRuleForm((current) => ({ ...current, slot_interval_minutes: event.target.value }))} className={fieldClass} /></label><label><span className="text-sm font-bold text-ulv-blue">Anticipación mínima</span><input type="number" min="0" value={ruleForm.min_notice_minutes} onChange={(event) => setRuleForm((current) => ({ ...current, min_notice_minutes: event.target.value }))} className={fieldClass} /></label><label><span className="text-sm font-bold text-ulv-blue">Días máximos de anticipación</span><input type="number" min="0" value={ruleForm.max_days_ahead} onChange={(event) => setRuleForm((current) => ({ ...current, max_days_ahead: event.target.value }))} className={fieldClass} /></label><label><span className="text-sm font-bold text-ulv-blue">Reservas máximas por usuario al día</span><input type="number" min="1" value={ruleForm.max_reservations_per_user_day} onChange={(event) => setRuleForm((current) => ({ ...current, max_reservations_per_user_day: event.target.value }))} className={fieldClass} /></label><label className="flex min-h-20 items-center gap-3 rounded-2xl border border-slate-200 p-4 text-sm font-bold text-ulv-blue"><input type="checkbox" checked={ruleForm.requires_approval} onChange={(event) => setRuleForm((current) => ({ ...current, requires_approval: event.target.checked }))} /> Requiere aprobación</label><label className="flex min-h-20 items-center gap-3 rounded-2xl border border-slate-200 p-4 text-sm font-bold text-ulv-blue"><input type="checkbox" checked={ruleForm.is_active} onChange={(event) => setRuleForm((current) => ({ ...current, is_active: event.target.checked }))} /> Activo</label></div><label className="block"><span className="text-sm font-bold text-ulv-blue">Notas</span><textarea value={ruleForm.notes} onChange={(event) => setRuleForm((current) => ({ ...current, notes: event.target.value }))} className={`${fieldClass} py-3`} rows={3} /></label><button disabled={isSaving || !spaceId} className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-ulv-yellow px-5 py-3 text-sm font-black text-ulv-blue disabled:opacity-60 sm:w-auto">{isSaving ? "Guardando..." : "Guardar reglas"}</button></form></Card> : null}

      {activeTab === "preview" ? <Card><div className="grid gap-4 md:grid-cols-3"><label><span className="text-sm font-bold text-ulv-blue">Espacio</span><select value={spaceId} onChange={(event) => handleSpaceChange(event.target.value)} className={fieldClass}><option value="">Selecciona un espacio</option>{spaces.map((space) => <option key={space.id} value={space.id}>{space.name}</option>)}</select></label><label><span className="text-sm font-bold text-ulv-blue">Fecha</span><input type="date" value={previewDate} onChange={(event) => setPreviewDate(event.target.value)} className={fieldClass} /></label><div className="flex items-end"><button type="button" onClick={() => void loadPreview()} disabled={isRefreshing || !spaceId} className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-ulv-yellow px-5 py-3 text-sm font-black text-ulv-blue disabled:opacity-60">Actualizar vista previa</button></div></div><div className="mt-5 grid gap-4 lg:grid-cols-2"><section className="rounded-3xl bg-slate-50 p-4"><h3 className="font-black text-ulv-blue">Horario de biblioteca</h3>{previewMessage ? <p className="mt-3 rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-800">{previewMessage}</p> : <p className="mt-2 text-sm font-semibold text-slate-600">Usa la fecha seleccionada para ver bloques según el horario configurado.</p>}</section><section className="rounded-3xl bg-slate-50 p-4"><h3 className="font-black text-ulv-blue">Reglas del espacio</h3><p className="mt-2 text-sm font-semibold text-slate-600">Duración {selectedRule?.min_duration_minutes ?? defaultSpaceReservationRule.min_duration_minutes}-{selectedRule?.max_duration_minutes ?? defaultSpaceReservationRule.max_duration_minutes} min · intervalo {selectedRule?.slot_interval_minutes ?? defaultSpaceReservationRule.slot_interval_minutes} min · {selectedRule?.requires_approval ?? true ? "requiere aprobación" : "aprobación automática"}</p></section></div><div className="mt-5"><h3 className="text-lg font-black text-ulv-blue">Bloques disponibles y ocupados</h3><div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">{previewBlocks.length === 0 && !previewMessage ? <p className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-500 sm:col-span-2 xl:col-span-4">Actualiza la vista previa para ver disponibilidad.</p> : null}{previewBlocks.map((block) => <div key={block.start} className={`rounded-2xl border p-3 ${getBlockClassName(block)}`}><p className="text-sm font-black">{block.label}</p><p className="mt-1 text-sm font-semibold">{block.displayText}</p></div>)}</div></div></Card> : null}
    </div>
  );
}
