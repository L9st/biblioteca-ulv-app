"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCw, Search, ShieldAlert } from "lucide-react";
import { getCurrentAppUser, type AdminAppUser, type AppUserRole } from "@/services/admin-users.service";
import {
  getActiveLibrariesForFilter,
  getAdminAttendanceLogs,
  getAdminAttendanceSummary,
  type AdminAttendanceLog,
  type AdminLibraryFilter,
} from "@/services/admin-attendance.service";
import { Card } from "@/app/ui/Card";
import { StatCard } from "@/app/cards/StatCard";
import { DropdownSelect } from "@/app/ui/DropdownSelect";

type ActiveTab = "summary" | "active" | "history" | "reports";
type PeriodFilter = "today" | "week" | "month" | "date" | "all";
type StatusFilter = "all" | "open" | "closed";
type SourceFilter = "all" | "qr" | "manual";

type AttendanceFilters = {
  libraryId: string;
  status: StatusFilter;
  source: SourceFilter;
  search: string;
  period?: PeriodFilter;
  selectedDate?: string;
};

function canAccessAttendance(role: AppUserRole) {
  return role === "librarian" || role === "admin" || role === "superadmin";
}

const tabs: Array<{ id: ActiveTab; label: string }> = [
  { id: "summary", label: "Resumen" },
  { id: "active", label: "Activos hoy" },
  { id: "history", label: "Historial" },
  { id: "reports", label: "Reportes / filtros" },
];

function formatDateTime(value: string | null) {
  if (!value) {
    return "Sin salida";
  }

  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatMinutes(minutes: number | null) {
  if (!minutes || minutes <= 0) {
    return "0 min";
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours === 0) {
    return `${remainingMinutes} min`;
  }

  return remainingMinutes === 0 ? `${hours} h` : `${hours} h ${remainingMinutes} min`;
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
  const diff = day === 0 ? 6 : day - 1;
  weekStart.setDate(weekStart.getDate() - diff);

  return new Date(date) >= weekStart;
}

function isThisMonth(date: string): boolean {
  const monthStart = startOfToday();
  monthStart.setDate(1);

  return new Date(date) >= monthStart;
}

function isSameDate(date: string, selectedDate: string): boolean {
  if (!selectedDate) {
    return true;
  }

  const currentDate = new Date(date);
  const selected = new Date(`${selectedDate}T00:00:00`);

  return (
    currentDate.getFullYear() === selected.getFullYear() &&
    currentDate.getMonth() === selected.getMonth() &&
    currentDate.getDate() === selected.getDate()
  );
}

function getCurrentOpenMinutes(checkInAt: string): string {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(checkInAt).getTime()) / 60000));
  return `${formatMinutes(minutes)} en biblioteca`;
}

function getTimeLabel(log: AdminAttendanceLog) {
  if (typeof log.total_minutes === "number") {
    return formatMinutes(log.total_minutes);
  }

  return log.status === "open" ? "En curso" : "0 min";
}

function getStatusLabel(status: string) {
  if (status === "open") {
    return "Entrada abierta";
  }

  if (status === "closed") {
    return "Cerrado";
  }

  if (status === "corrected") {
    return "Corregido";
  }

  if (status === "cancelled") {
    return "Cancelado";
  }

  return status;
}

function getSourceLabel(source: string | null) {
  if (!source) {
    return "Sin fuente";
  }

  return source.toLowerCase() === "qr" ? "QR" : "Manual";
}

function getSourceClassName(source: string | null) {
  return source?.toLowerCase() === "qr" ? "bg-ulv-yellow text-ulv-blue" : "bg-slate-100 text-slate-700";
}

function matchesSearch(log: AdminAttendanceLog, search: string) {
  const cleanSearch = search.trim().toLowerCase();

  if (!cleanSearch) {
    return true;
  }

  return [log.app_users?.name, log.app_users?.email].some((value) => value?.toLowerCase().includes(cleanSearch));
}

function matchesPeriod(log: AdminAttendanceLog, period: PeriodFilter | undefined, selectedDate: string | undefined) {
  if (!period || period === "all") {
    return true;
  }

  if (period === "today") {
    return isToday(log.check_in_at);
  }

  if (period === "week") {
    return isThisWeek(log.check_in_at);
  }

  if (period === "month") {
    return isThisMonth(log.check_in_at);
  }

  return isSameDate(log.check_in_at, selectedDate ?? "");
}

function filterLogs(logs: AdminAttendanceLog[], filters: AttendanceFilters) {
  return logs.filter((log) => {
    const matchesLibrary = filters.libraryId === "all" || log.library_id === filters.libraryId;
    const matchesStatus = filters.status === "all" || log.status === filters.status;
    const matchesSource = filters.source === "all" || log.source?.toLowerCase() === filters.source;

    return (
      matchesLibrary &&
      matchesStatus &&
      matchesSource &&
      matchesSearch(log, filters.search) &&
      matchesPeriod(log, filters.period, filters.selectedDate)
    );
  });
}

function SummaryCards({ logs, detail }: { logs: AdminAttendanceLog[]; detail: string }) {
  const summary = getAdminAttendanceSummary(logs);

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <StatCard label="Total de registros" value={String(summary.total_logs)} detail={detail} />
      <StatCard label="Entradas abiertas" value={String(summary.open_logs)} detail="Usuarios dentro" />
      <StatCard label="Entradas cerradas" value={String(summary.closed_logs)} detail="Registros completos" />
      <StatCard label="Horas acumuladas" value={formatMinutes(summary.total_minutes)} detail={`${summary.total_hours.toFixed(1)} horas`} />
    </div>
  );
}

function FilterControls({
  libraries,
  libraryId,
  status,
  source,
  search,
  onLibraryChange,
  onStatusChange,
  onSourceChange,
  onSearchChange,
  period,
  selectedDate,
  onPeriodChange,
  onDateChange,
}: {
  libraries: AdminLibraryFilter[];
  libraryId: string;
  status: StatusFilter;
  source: SourceFilter;
  search: string;
  onLibraryChange: (value: string) => void;
  onStatusChange: (value: StatusFilter) => void;
  onSourceChange: (value: SourceFilter) => void;
  onSearchChange: (value: string) => void;
  period?: PeriodFilter;
  selectedDate?: string;
  onPeriodChange?: (value: PeriodFilter) => void;
  onDateChange?: (value: string) => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
      {period && onPeriodChange ? (
        <label className="block">
          <span className="text-sm font-bold text-ulv-blue">Periodo</span>
          <select
            value={period}
            onChange={(event) => onPeriodChange(event.target.value as PeriodFilter)}
            className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 outline-none transition focus:border-ulv-blue focus:ring-4 focus:ring-ulv-blue/10"
          >
            <option value="today">Hoy</option>
            <option value="week">Esta semana</option>
            <option value="month">Este mes</option>
            <option value="date">Elegir fecha</option>
            <option value="all">Todos</option>
          </select>
        </label>
      ) : null}

      {period === "date" && onDateChange ? (
        <label className="block">
          <span className="text-sm font-bold text-ulv-blue">Fecha específica</span>
          <input
            type="date"
            value={selectedDate ?? ""}
            onChange={(event) => onDateChange(event.target.value)}
            className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 outline-none transition focus:border-ulv-blue focus:ring-4 focus:ring-ulv-blue/10"
          />
        </label>
      ) : null}

      <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
        <DropdownSelect
          label="Filtrar por biblioteca"
          options={[{ label: "Todas las bibliotecas", value: "all" }, ...libraries.map((library) => ({ label: library.name, value: library.id }))]}
          value={libraryId}
          onChange={onLibraryChange}
          emptyLabel="Todas las bibliotecas"
        />
      </div>

      <label className="block">
        <span className="text-sm font-bold text-ulv-blue">Estado</span>
        <select
          value={status}
          onChange={(event) => onStatusChange(event.target.value as StatusFilter)}
          className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 outline-none transition focus:border-ulv-blue focus:ring-4 focus:ring-ulv-blue/10"
        >
          <option value="all">Todos</option>
          <option value="open">Entrada abierta</option>
          <option value="closed">Cerrado</option>
        </select>
      </label>

      <label className="block">
        <span className="text-sm font-bold text-ulv-blue">Fuente</span>
        <select
          value={source}
          onChange={(event) => onSourceChange(event.target.value as SourceFilter)}
          className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 outline-none transition focus:border-ulv-blue focus:ring-4 focus:ring-ulv-blue/10"
        >
          <option value="all">Todas</option>
          <option value="qr">QR</option>
          <option value="manual">Manual</option>
        </select>
      </label>

      <label className="block">
        <span className="text-sm font-bold text-ulv-blue">Búsqueda</span>
        <span className="relative mt-2 block">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Nombre o correo"
            className="min-h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-ulv-blue focus:ring-4 focus:ring-ulv-blue/10"
          />
        </span>
      </label>
    </div>
  );
}

function AttendanceTable({ logs }: { logs: AdminAttendanceLog[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200">
      <table className="min-w-[920px] w-full border-collapse text-left text-sm">
        <thead className="bg-ulv-blue text-white">
          <tr>
            <th className="px-4 py-3 font-black">Usuario</th>
            <th className="px-4 py-3 font-black">Correo</th>
            <th className="px-4 py-3 font-black">Biblioteca</th>
            <th className="px-4 py-3 font-black">Entrada</th>
            <th className="px-4 py-3 font-black">Salida</th>
            <th className="px-4 py-3 font-black">Tiempo</th>
            <th className="px-4 py-3 font-black">Estado</th>
            <th className="px-4 py-3 font-black">Fuente</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 bg-white">
          {logs.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-4 py-8 text-center font-semibold text-slate-500">
                No hay registros con los filtros seleccionados.
              </td>
            </tr>
          ) : (
            logs.map((log) => (
              <tr key={log.id} className="align-top">
                <td className="px-4 py-3 font-black text-ulv-blue">{log.app_users?.name ?? "Usuario sin nombre"}</td>
                <td className="px-4 py-3 font-semibold text-slate-600">{log.app_users?.email ?? "Sin correo"}</td>
                <td className="px-4 py-3 font-semibold text-slate-700">{log.libraries?.name ?? "Biblioteca"}</td>
                <td className="px-4 py-3 text-slate-700">{formatDateTime(log.check_in_at)}</td>
                <td className="px-4 py-3 text-slate-700">{formatDateTime(log.check_out_at)}</td>
                <td className="px-4 py-3 font-bold text-slate-900">{getTimeLabel(log)}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${
                      log.status === "open" ? "bg-ulv-yellow text-ulv-blue" : "bg-green-50 text-green-800"
                    }`}
                  >
                    {getStatusLabel(log.status)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${getSourceClassName(log.source)}`}>
                    {getSourceLabel(log.source)}
                  </span>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function ActiveTodayTable({ logs }: { logs: AdminAttendanceLog[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200">
      <table className="min-w-[760px] w-full border-collapse text-left text-sm">
        <thead className="bg-ulv-blue text-white">
          <tr>
            <th className="px-4 py-3 font-black">Usuario</th>
            <th className="px-4 py-3 font-black">Correo</th>
            <th className="px-4 py-3 font-black">Biblioteca</th>
            <th className="px-4 py-3 font-black">Hora de entrada</th>
            <th className="px-4 py-3 font-black">Tiempo actual aproximado</th>
            <th className="px-4 py-3 font-black">Fuente</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 bg-white">
          {logs.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center font-semibold text-slate-500">
                No hay usuarios activos hoy.
              </td>
            </tr>
          ) : (
            logs.map((log) => (
              <tr key={log.id} className="align-top">
                <td className="px-4 py-3 font-black text-ulv-blue">{log.app_users?.name ?? "Usuario sin nombre"}</td>
                <td className="px-4 py-3 font-semibold text-slate-600">{log.app_users?.email ?? "Sin correo"}</td>
                <td className="px-4 py-3 font-semibold text-slate-700">{log.libraries?.name ?? "Biblioteca"}</td>
                <td className="px-4 py-3 text-slate-700">{formatTime(log.check_in_at)}</td>
                <td className="px-4 py-3 font-bold text-slate-900">{getCurrentOpenMinutes(log.check_in_at)}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${getSourceClassName(log.source)}`}>
                    {getSourceLabel(log.source)}
                  </span>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export function AdminAttendancePanel() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("summary");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<AdminAppUser | null>(null);
  const [logs, setLogs] = useState<AdminAttendanceLog[]>([]);
  const [libraries, setLibraries] = useState<AdminLibraryFilter[]>([]);
  const [historyLibraryId, setHistoryLibraryId] = useState("all");
  const [historyStatus, setHistoryStatus] = useState<StatusFilter>("all");
  const [historySource, setHistorySource] = useState<SourceFilter>("all");
  const [historySearch, setHistorySearch] = useState("");
  const [reportPeriod, setReportPeriod] = useState<PeriodFilter>("today");
  const [reportDate, setReportDate] = useState("");
  const [reportLibraryId, setReportLibraryId] = useState("all");
  const [reportStatus, setReportStatus] = useState<StatusFilter>("all");
  const [reportSource, setReportSource] = useState<SourceFilter>("all");
  const [reportSearch, setReportSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function loadData({ showLoading = true } = {}) {
    if (showLoading) {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }

    setError(null);

    const userResult = await getCurrentAppUser();
    setCurrentUser(userResult.data);
    setIsAuthenticated(Boolean(userResult.data));

    if (!userResult.data || !canAccessAttendance(userResult.data.role)) {
      if (userResult.error) setError(userResult.error);
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    const [logsResult, librariesResult] = await Promise.all([getAdminAttendanceLogs(), getActiveLibrariesForFilter()]);

    setLogs(logsResult.data);
    setLibraries(librariesResult.data);

    if (logsResult.error || librariesResult.error) {
      setError(logsResult.error ?? librariesResult.error);
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

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (activeTab === "active") {
        setLogs((currentLogs) => [...currentLogs]);
      }
    }, 60000);

    return () => window.clearInterval(interval);
  }, [activeTab]);

  const todayLogs = logs.filter((log) => isToday(log.check_in_at));
  const activeTodayLogs = logs.filter((log) => log.status === "open" && isToday(log.check_in_at));
  const historyLogs = filterLogs(logs, {
    libraryId: historyLibraryId,
    status: historyStatus,
    source: historySource,
    search: historySearch,
  });
  const reportLogs = filterLogs(logs, {
    libraryId: reportLibraryId,
    status: reportStatus,
    source: reportSource,
    search: reportSearch,
    period: reportPeriod,
    selectedDate: reportDate,
  });
  const todaySummary = getAdminAttendanceSummary(todayLogs);

  if (isLoading) {
    return (
      <Card>
        <p className="text-sm font-semibold text-slate-600">Cargando registros de asistencia...</p>
      </Card>
    );
  }

  if (!isAuthenticated) {
    return (
      <Card className="text-center">
        <ShieldAlert className="mx-auto h-10 w-10 text-ulv-blue" aria-hidden="true" />
        <h2 className="mt-3 text-xl font-black text-ulv-blue">Debes iniciar sesión para acceder al panel administrativo.</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Esta sección está reservada para personal autorizado de biblioteca.
        </p>
        <Link
          href="/login?redirect=/admin/asistencia"
          className="mt-5 inline-flex min-h-12 items-center justify-center rounded-2xl bg-ulv-yellow px-5 py-3 text-sm font-bold text-ulv-blue shadow-sm transition hover:bg-[#e8b800]"
        >
          Iniciar sesión
        </Link>
      </Card>
    );
  }

  if (!currentUser || !canAccessAttendance(currentUser.role)) {
    return <Card className="text-center"><ShieldAlert className="mx-auto h-10 w-10 text-red-700" aria-hidden="true" /><h2 className="mt-3 text-xl font-black text-red-700">No tienes permisos para acceder a esta sección.</h2></Card>;
  }

  return (
    <div className="space-y-5">
      {error ? <p className="rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-800">{error}</p> : null}

      <Card className="p-3">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`min-h-11 shrink-0 rounded-2xl px-4 py-2 text-sm font-black transition ${
                  isActive
                    ? "bg-ulv-yellow text-ulv-blue shadow-sm"
                    : "border border-slate-200 bg-white text-ulv-blue hover:bg-ulv-yellow/10"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </Card>

      {activeTab === "summary" ? (
        <div className="space-y-5">
          <SummaryCards logs={logs} detail="Hasta 500 recientes" />
          <div className="grid gap-3 md:grid-cols-3">
            <StatCard label="Registros de hoy" value={String(todaySummary.total_logs)} detail="Entradas del día actual" />
            <StatCard label="Usuarios activos hoy" value={String(activeTodayLogs.length)} detail="Entradas abiertas" />
            <StatCard label="Horas acumuladas hoy" value={formatMinutes(todaySummary.total_minutes)} detail="Registros cerrados hoy" />
          </div>
        </div>
      ) : null}

      {activeTab === "active" ? (
        <Card>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-black text-ulv-blue">Activos hoy</h2>
              <p className="mt-1 text-sm text-slate-600">Usuarios con entrada abierta del día actual.</p>
            </div>
            <button
              type="button"
              onClick={() => void loadData({ showLoading: false })}
              disabled={isRefreshing}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-ulv-yellow px-5 py-3 text-sm font-bold text-ulv-blue shadow-sm transition hover:bg-[#e8b800] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className={`h-5 w-5 ${isRefreshing ? "animate-spin" : ""}`} aria-hidden="true" />
              {isRefreshing ? "Actualizando..." : "Refrescar"}
            </button>
          </div>
          <div className="mt-5">
            <ActiveTodayTable logs={activeTodayLogs} />
          </div>
        </Card>
      ) : null}

      {activeTab === "history" ? (
        <div className="space-y-5">
          <Card>
            <div className="mb-5">
              <h2 className="text-xl font-black text-ulv-blue">Historial</h2>
              <p className="mt-1 text-sm text-slate-600">Filtros básicos para consultar registros recientes.</p>
            </div>
            <FilterControls
              libraries={libraries}
              libraryId={historyLibraryId}
              status={historyStatus}
              source={historySource}
              search={historySearch}
              onLibraryChange={setHistoryLibraryId}
              onStatusChange={setHistoryStatus}
              onSourceChange={setHistorySource}
              onSearchChange={setHistorySearch}
            />
          </Card>
          <Card>
            <div className="mb-5">
              <h2 className="text-xl font-black text-ulv-blue">Historial de asistencia</h2>
              <p className="mt-1 text-sm text-slate-600">{historyLogs.length} registros encontrados.</p>
            </div>
            <AttendanceTable logs={historyLogs} />
          </Card>
        </div>
      ) : null}

      {activeTab === "reports" ? (
        <div className="space-y-5">
          <Card>
            <div className="mb-5">
              <h2 className="text-xl font-black text-ulv-blue">Reportes / filtros</h2>
              <p className="mt-1 text-sm text-slate-600">Combina periodo, biblioteca, estado, fuente y búsqueda.</p>
            </div>
            <FilterControls
              libraries={libraries}
              libraryId={reportLibraryId}
              status={reportStatus}
              source={reportSource}
              search={reportSearch}
              onLibraryChange={setReportLibraryId}
              onStatusChange={setReportStatus}
              onSourceChange={setReportSource}
              onSearchChange={setReportSearch}
              period={reportPeriod}
              selectedDate={reportDate}
              onPeriodChange={setReportPeriod}
              onDateChange={setReportDate}
            />
          </Card>
          <SummaryCards logs={reportLogs} detail="Resultados filtrados" />
          <Card>
            <div className="mb-5">
              <h2 className="text-xl font-black text-ulv-blue">Resultados</h2>
              <p className="mt-1 text-sm text-slate-600">{reportLogs.length} registros encontrados.</p>
            </div>
            <AttendanceTable logs={reportLogs} />
          </Card>
        </div>
      ) : null}
    </div>
  );
}
