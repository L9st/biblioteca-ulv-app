"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Download, FileSpreadsheet, RefreshCw, Search, ShieldAlert } from "lucide-react";
import { createAuditLog } from "@/services/admin-audit.service";
import { getCurrentAppUser, type AdminAppUser, type AppUserRole } from "@/services/admin-users.service";
import {
  buildLibraryReport,
  buildReportSummary,
  buildUserReport,
  formatMinutes,
  getClosedMinutes,
  getReportChartData,
  getReportAttendanceLogs,
  getReportLibraries,
  type ReportChartData,
  type ReportAttendanceLog,
  type ReportLibrary,
  type ReportSpaceReservation,
  type ReportPeriod,
} from "@/services/admin-reports.service";
import { Card } from "@/app/ui/Card";
import { StatCard } from "@/app/cards/StatCard";
import { exportReportToCsv, exportReportToExcel } from "@/utils/export-reports";
import { DropdownSelect } from "@/app/ui/DropdownSelect";
import { AdminReportCharts } from "@/modules/admin/report-charts/AdminReportCharts";

type ActiveTab = "summary" | "charts" | "library" | "user" | "export";
type StatusFilter = "all" | "open" | "closed";
type SourceFilter = "all" | "qr" | "manual";
type Feedback = { type: "error"; message: string };

const tabs: Array<{ id: ActiveTab; label: string }> = [
  { id: "summary", label: "Resumen" },
  { id: "charts", label: "Gráficos" },
  { id: "library", label: "Por biblioteca" },
  { id: "user", label: "Por usuario" },
  { id: "export", label: "Exportar" },
];

function canAccessReports(role: AppUserRole) {
  return role === "librarian" || role === "admin" || role === "superadmin";
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function isToday(date: string): boolean {
  return new Date(date) >= startOfToday();
}

function isThisWeek(date: string): boolean {
  const weekStart = startOfToday();
  const day = weekStart.getDay();
  weekStart.setDate(weekStart.getDate() - (day === 0 ? 6 : day - 1));
  return new Date(date) >= weekStart;
}

function isThisMonth(date: string): boolean {
  const monthStart = startOfToday();
  monthStart.setDate(1);
  return new Date(date) >= monthStart;
}

function isSameDate(date: string, selectedDate: string): boolean {
  if (!selectedDate) return true;
  const current = new Date(date);
  const selected = new Date(`${selectedDate}T00:00:00`);
  return current.getFullYear() === selected.getFullYear() && current.getMonth() === selected.getMonth() && current.getDate() === selected.getDate();
}

function formatDateTime(value: string | null) {
  if (!value) return "Sin salida";
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function matchesPeriod(log: ReportAttendanceLog, period: ReportPeriod, selectedDate: string) {
  if (period === "all") return true;
  if (period === "today") return isToday(log.check_in_at);
  if (period === "week") return isThisWeek(log.check_in_at);
  if (period === "month") return isThisMonth(log.check_in_at);
  return isSameDate(log.check_in_at, selectedDate);
}

function matchesSearch(log: ReportAttendanceLog, search: string) {
  const cleanSearch = search.trim().toLowerCase();
  if (!cleanSearch) return true;
  return [log.app_users?.name, log.app_users?.email, log.libraries?.name].some((value) => value?.toLowerCase().includes(cleanSearch));
}

function matchesReservationSearch(reservation: ReportSpaceReservation, search: string) {
  const cleanSearch = search.trim().toLowerCase();
  if (!cleanSearch) return true;
  return [reservation.app_users?.name, reservation.app_users?.email, reservation.libraries?.name, reservation.library_spaces?.name].some((value) => value?.toLowerCase().includes(cleanSearch));
}

function matchesReservationPeriod(reservation: ReportSpaceReservation, period: ReportPeriod, selectedDate: string) {
  if (period === "all") return true;
  if (period === "today") return isToday(reservation.start_at);
  if (period === "week") return isThisWeek(reservation.start_at);
  if (period === "month") return isThisMonth(reservation.start_at);
  return isSameDate(reservation.start_at, selectedDate);
}

export function AdminReportsPanel() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("summary");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentUser, setCurrentUser] = useState<AdminAppUser | null>(null);
  const [libraries, setLibraries] = useState<ReportLibrary[]>([]);
  const [logs, setLogs] = useState<ReportAttendanceLog[]>([]);
  const [chartData, setChartData] = useState<ReportChartData | null>(null);
  const [chartError, setChartError] = useState<string | null>(null);
  const [period, setPeriod] = useState<ReportPeriod>("today");
  const [selectedDate, setSelectedDate] = useState("");
  const [libraryId, setLibraryId] = useState("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [source, setSource] = useState<SourceFilter>("all");
  const [search, setSearch] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  async function loadData({ showLoading = true } = {}) {
    if (showLoading) setIsLoading(true);
    else setIsRefreshing(true);
    setFeedback(null);

    const userResult = await getCurrentAppUser();
    setCurrentUser(userResult.data);

    if (userResult.error) {
      setFeedback({ type: "error", message: userResult.error });
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    if (!userResult.data || !canAccessReports(userResult.data.role)) {
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    const [librariesResult, logsResult, chartResult] = await Promise.all([getReportLibraries(), getReportAttendanceLogs(), getReportChartData()]);
    setLibraries(librariesResult.data);
    setLogs(logsResult.data);
    setChartData(chartResult.data);
    setChartError(chartResult.error);

    if (librariesResult.error || logsResult.error || chartResult.error) {
      setFeedback({ type: "error", message: librariesResult.error ?? logsResult.error ?? chartResult.error ?? "No se pudieron cargar los reportes." });
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

  const filteredLogs = logs.filter((log) => {
    const matchesLibrary = libraryId === "all" || log.library_id === libraryId;
    const matchesStatus = status === "all" || log.status === status;
    const matchesSource = source === "all" || log.source?.toLowerCase() === source;
    return matchesLibrary && matchesStatus && matchesSource && matchesPeriod(log, period, selectedDate) && matchesSearch(log, search);
  });
  const summary = buildReportSummary(filteredLogs);
  const libraryReport = buildLibraryReport(filteredLogs);
  const userReport = buildUserReport(filteredLogs);
  const recentLogs = filteredLogs.slice(0, 10);
  const filteredChartData: ReportChartData | null = chartData
    ? {
        attendanceLogs: filteredLogs,
        reservations: chartData.reservations.filter((reservation) => {
          const matchesLibrary = libraryId === "all" || reservation.library_id === libraryId;
          return matchesLibrary && matchesReservationPeriod(reservation, period, selectedDate) && matchesReservationSearch(reservation, search);
        }),
      }
    : null;

  function handleExportCsv() {
    if (filteredLogs.length === 0) {
      setFeedback({ type: "error", message: "No hay registros para exportar." });
      return;
    }

    setFeedback(null);
    exportReportToCsv(filteredLogs);
    void createAuditLog({
      module: "reports",
      action: "exported",
      entity_table: "attendance_logs",
      description: "Reporte de asistencia exportado",
      metadata: { format: "csv", filters: { period, selectedDate, libraryId, status, source, search }, records: filteredLogs.length },
    }).catch((auditError: unknown) => console.error("No se pudo registrar auditoría de reporte:", auditError));
  }

  function handleExportExcel() {
    if (filteredLogs.length === 0) {
      setFeedback({ type: "error", message: "No hay registros para exportar." });
      return;
    }

    setFeedback(null);
    exportReportToExcel(filteredLogs);
    void createAuditLog({
      module: "reports",
      action: "exported",
      entity_table: "attendance_logs",
      description: "Reporte de asistencia exportado",
      metadata: { format: "excel", filters: { period, selectedDate, libraryId, status, source, search }, records: filteredLogs.length },
    }).catch((auditError: unknown) => console.error("No se pudo registrar auditoría de reporte:", auditError));
  }

  if (isLoading) {
    return <Card><p className="text-sm font-semibold text-slate-600">Cargando reportes administrativos...</p></Card>;
  }

  if (!currentUser) {
    return (
      <Card className="text-center">
        <ShieldAlert className="mx-auto h-10 w-10 text-ulv-blue" aria-hidden="true" />
        <h2 className="mt-3 text-xl font-black text-ulv-blue">Debes iniciar sesión para acceder al panel administrativo.</h2>
        <Link href="/login?redirect=/admin/reportes" className="mt-5 inline-flex min-h-12 items-center justify-center rounded-2xl bg-ulv-yellow px-5 py-3 text-sm font-bold text-ulv-blue shadow-sm transition hover:bg-[#e8b800]">Iniciar sesión</Link>
      </Card>
    );
  }

  if (!canAccessReports(currentUser.role)) {
    return <Card className="text-center"><ShieldAlert className="mx-auto h-10 w-10 text-red-700" aria-hidden="true" /><h2 className="mt-3 text-xl font-black text-red-700">No tienes permisos para acceder a esta sección.</h2></Card>;
  }

  return (
    <div className="space-y-5">
      {feedback ? <p className="rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-800">{feedback.message}</p> : null}

      <Card>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-black text-ulv-blue">Filtros de reportes</h2>
            <p className="mt-1 text-sm text-slate-600">Consulta estadísticas de asistencia y horas registradas.</p>
          </div>
          <button type="button" onClick={() => void loadData({ showLoading: false })} disabled={isRefreshing} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-ulv-yellow px-5 py-3 text-sm font-bold text-ulv-blue shadow-sm transition hover:bg-[#e8b800] disabled:cursor-not-allowed disabled:opacity-60">
            <RefreshCw className={`h-5 w-5 ${isRefreshing ? "animate-spin" : ""}`} aria-hidden="true" />
            Refrescar
          </button>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <label className="block"><span className="text-sm font-bold text-ulv-blue">Periodo</span><select value={period} onChange={(event) => setPeriod(event.target.value as ReportPeriod)} className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 outline-none focus:border-ulv-blue focus:ring-4 focus:ring-ulv-blue/10"><option value="today">Hoy</option><option value="week">Esta semana</option><option value="month">Este mes</option><option value="custom">Elegir fecha</option><option value="all">Todos</option></select></label>
          {period === "custom" ? <label className="block"><span className="text-sm font-bold text-ulv-blue">Fecha específica</span><input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 outline-none focus:border-ulv-blue focus:ring-4 focus:ring-ulv-blue/10" /></label> : null}
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5"><DropdownSelect label="Filtrar por biblioteca" options={[{ label: "Todas las bibliotecas", value: "all" }, ...libraries.map((library) => ({ label: library.name, value: library.id }))]} value={libraryId} onChange={setLibraryId} emptyLabel="Todas las bibliotecas" /></div>
          <label className="block"><span className="text-sm font-bold text-ulv-blue">Estado</span><select value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)} className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 outline-none focus:border-ulv-blue focus:ring-4 focus:ring-ulv-blue/10"><option value="all">Todos</option><option value="open">Abiertas</option><option value="closed">Cerradas</option></select></label>
          <label className="block"><span className="text-sm font-bold text-ulv-blue">Fuente</span><select value={source} onChange={(event) => setSource(event.target.value as SourceFilter)} className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 outline-none focus:border-ulv-blue focus:ring-4 focus:ring-ulv-blue/10"><option value="all">Todas</option><option value="qr">QR</option><option value="manual">Manual</option></select></label>
          <label className="block"><span className="text-sm font-bold text-ulv-blue">Búsqueda</span><span className="relative mt-2 block"><Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Usuario, correo o biblioteca" className="min-h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-sm font-semibold text-slate-700 outline-none focus:border-ulv-blue focus:ring-4 focus:ring-ulv-blue/10" /></span></label>
        </div>
      </Card>

      <Card className="p-3"><div className="flex gap-2 overflow-x-auto pb-1">{tabs.map((tab) => <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={`min-h-11 shrink-0 rounded-2xl px-4 py-2 text-sm font-black transition ${activeTab === tab.id ? "bg-ulv-yellow text-ulv-blue shadow-sm" : "border border-slate-200 bg-white text-ulv-blue hover:bg-ulv-yellow/10"}`}>{tab.label}</button>)}</div></Card>

      {activeTab === "summary" ? <div className="space-y-5"><div className="grid grid-cols-2 gap-3 md:grid-cols-5"><StatCard label="Total de registros" value={String(summary.totalLogs)} detail="Filtrados" /><StatCard label="Usuarios únicos" value={String(summary.uniqueUsers)} detail="Con asistencia" /><StatCard label="Horas acumuladas" value={summary.totalHoursText} detail="Solo cerradas" /><StatCard label="Entradas abiertas" value={String(summary.openLogs)} detail="En curso" /><StatCard label="Entradas cerradas" value={String(summary.closedLogs)} detail="Finalizadas" /></div><Card><h2 className="mb-4 text-xl font-black text-ulv-blue">Últimos registros filtrados</h2><div className="overflow-x-auto rounded-2xl border border-slate-200"><table className="min-w-[820px] w-full text-left text-sm"><thead className="bg-ulv-blue text-white"><tr><th className="px-4 py-3">Usuario</th><th className="px-4 py-3">Biblioteca</th><th className="px-4 py-3">Entrada</th><th className="px-4 py-3">Salida</th><th className="px-4 py-3">Tiempo</th><th className="px-4 py-3">Estado</th></tr></thead><tbody className="divide-y divide-slate-200 bg-white">{recentLogs.length === 0 ? <tr><td colSpan={6} className="px-4 py-8 text-center font-semibold text-slate-500">No hay registros para los filtros seleccionados.</td></tr> : recentLogs.map((log) => <tr key={log.id}><td className="px-4 py-3 font-black text-ulv-blue">{log.app_users?.name ?? "Usuario sin nombre"}</td><td className="px-4 py-3 font-semibold text-slate-700">{log.libraries?.name ?? "Biblioteca"}</td><td className="px-4 py-3">{formatDateTime(log.check_in_at)}</td><td className="px-4 py-3">{formatDateTime(log.check_out_at)}</td><td className="px-4 py-3 font-bold">{formatMinutes(getClosedMinutes(log))}</td><td className="px-4 py-3">{log.status === "open" ? "Abierta" : "Cerrada"}</td></tr>)}</tbody></table></div></Card></div> : null}

      {activeTab === "charts" ? <AdminReportCharts data={filteredChartData} isLoading={isRefreshing} error={chartError} /> : null}

      {activeTab === "library" ? <Card><h2 className="mb-4 text-xl font-black text-ulv-blue">Por biblioteca</h2><div className="overflow-x-auto rounded-2xl border border-slate-200"><table className="min-w-[680px] w-full text-left text-sm"><thead className="bg-ulv-blue text-white"><tr><th className="px-4 py-3">Biblioteca</th><th className="px-4 py-3">Total de registros</th><th className="px-4 py-3">Usuarios únicos</th><th className="px-4 py-3">Tiempo total</th></tr></thead><tbody className="divide-y divide-slate-200 bg-white">{libraryReport.length === 0 ? <tr><td colSpan={4} className="px-4 py-8 text-center font-semibold text-slate-500">No hay datos por biblioteca.</td></tr> : libraryReport.map((item) => <tr key={item.libraryId}><td className="px-4 py-3"><p className="font-black text-ulv-blue">{item.libraryName}</p><p className="text-xs font-bold text-slate-500">{item.libraryCode}</p></td><td className="px-4 py-3 font-bold">{item.totalLogs}</td><td className="px-4 py-3 font-bold">{item.uniqueUsers}</td><td className="px-4 py-3 font-black text-ulv-blue">{item.totalHoursText}</td></tr>)}</tbody></table></div></Card> : null}

      {activeTab === "user" ? <Card><h2 className="mb-4 text-xl font-black text-ulv-blue">Por usuario</h2><div className="overflow-x-auto rounded-2xl border border-slate-200"><table className="min-w-[680px] w-full text-left text-sm"><thead className="bg-ulv-blue text-white"><tr><th className="px-4 py-3">Usuario</th><th className="px-4 py-3">Correo</th><th className="px-4 py-3">Total de registros</th><th className="px-4 py-3">Tiempo total</th></tr></thead><tbody className="divide-y divide-slate-200 bg-white">{userReport.length === 0 ? <tr><td colSpan={4} className="px-4 py-8 text-center font-semibold text-slate-500">No hay datos por usuario.</td></tr> : userReport.map((item) => <tr key={item.userId}><td className="px-4 py-3 font-black text-ulv-blue">{item.userName}</td><td className="px-4 py-3 font-semibold text-slate-600">{item.userEmail}</td><td className="px-4 py-3 font-bold">{item.totalLogs}</td><td className="px-4 py-3 font-black text-ulv-blue">{item.totalHoursText}</td></tr>)}</tbody></table></div></Card> : null}

      {activeTab === "export" ? <Card className="text-center"><Download className="mx-auto h-12 w-12 text-ulv-blue" aria-hidden="true" /><h2 className="mt-3 text-2xl font-black text-ulv-blue">Exportar reportes</h2><p className="mt-2 text-sm leading-6 text-slate-600">Descarga los registros filtrados de asistencia para análisis administrativo.</p><p className="mx-auto mt-5 max-w-sm rounded-2xl bg-ulv-blue px-4 py-3 text-sm font-black text-white">Registros listos para exportar: {filteredLogs.length}</p><div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center"><button type="button" onClick={handleExportCsv} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-ulv-yellow px-5 py-3 text-sm font-bold text-ulv-blue shadow-sm transition hover:bg-[#e8b800]"><Download className="h-5 w-5" aria-hidden="true" />Exportar CSV</button><button type="button" onClick={handleExportExcel} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-ulv-yellow px-5 py-3 text-sm font-bold text-ulv-blue shadow-sm transition hover:bg-[#e8b800]"><FileSpreadsheet className="h-5 w-5" aria-hidden="true" />Exportar Excel</button></div><p className="mt-4 text-xs font-semibold text-slate-500">La exportación respeta los filtros activos de periodo, biblioteca, estado, fuente y búsqueda.</p></Card> : null}
    </div>
  );
}
