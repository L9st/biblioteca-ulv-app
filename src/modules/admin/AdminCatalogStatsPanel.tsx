"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BarChart3, Download, ExternalLink, ShieldAlert } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/app/ui/Card";
import { buildKohaSearchUrl } from "@/services/catalog.service";
import { catalogSavedItemStatusLabels, type CatalogSearchType } from "@/services/catalog-saved-items.service";
import { getCurrentAppUser, type AdminAppUser, type AppUserRole } from "@/services/admin-users.service";
import {
  getCatalogDailyStats,
  getCatalogSavedItemStats,
  getCatalogSearchTypeStats,
  getCatalogStatsSummary,
  getRecentCatalogSearches,
  getTopCatalogSearches,
  type CatalogDailyStat,
  type CatalogSavedItemStat,
  type CatalogSearchTypeStat,
  type CatalogStatsFilters,
  type CatalogStatsSummary,
  type RecentCatalogSearch,
  type TopCatalogSearch,
} from "@/services/admin-catalog-stats.service";

const colors = ["#06426a", "#fac600", "#64748b", "#0f766e", "#b45309", "#7c3aed"];

const emptySummary: CatalogStatsSummary = {
  totalSearches: 0,
  uniqueQueries: 0,
  authenticatedSearches: 0,
  anonymousSearches: 0,
  savedItems: 0,
  favoriteItems: 0,
};

const defaultFilters: CatalogStatsFilters = { period: "month", searchType: "all" };

const searchTypeLabels: Record<CatalogSearchType, string> = {
  keyword: "Palabra clave",
  title: "Título",
  author: "Autor",
  subject: "Tema",
  isbn: "ISBN",
};

const sourceLabels: Record<string, string> = {
  catalog: "Catálogo",
  dashboard: "Dashboard",
  saved_resource: "Recurso guardado",
  history: "Historial",
};

const fieldClass = "mt-2 min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 outline-none focus:border-ulv-blue focus:ring-4 focus:ring-ulv-blue/10";

function canAccessCatalogStats(role: AppUserRole) {
  return role === "admin" || role === "superadmin";
}

function formatDateTime(value: string | null) {
  if (!value) return "Sin registro";
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "short" }).format(new Date(`${value}T00:00:00`));
}

function escapeCsvValue(value: string | number | null) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadCsv(rows: TopCatalogSearch[]) {
  const today = new Date().toISOString().slice(0, 10);
  const header = ["Término", "Cantidad", "Última búsqueda"];
  const csvRows = rows.map((row) => [row.query, row.total, row.lastSearchedAt ? formatDateTime(row.lastSearchedAt) : "Sin registro"]);
  const csv = [header, ...csvRows].map((row) => row.map(escapeCsvValue).join(",")).join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `estadisticas-catalogo-biblioteca-ulv-${today}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function openKohaSearch(query: string) {
  try {
    const url = buildKohaSearchUrl({ query, type: "keyword" });
    window.open(url, "_blank", "noopener,noreferrer");
  } catch {
    return;
  }
}

export function AdminCatalogStatsPanel() {
  const [currentUser, setCurrentUser] = useState<AdminAppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filters, setFilters] = useState<CatalogStatsFilters>(defaultFilters);
  const [summary, setSummary] = useState<CatalogStatsSummary>(emptySummary);
  const [topSearches, setTopSearches] = useState<TopCatalogSearch[]>([]);
  const [typeStats, setTypeStats] = useState<CatalogSearchTypeStat[]>([]);
  const [dailyStats, setDailyStats] = useState<CatalogDailyStat[]>([]);
  const [savedStats, setSavedStats] = useState<CatalogSavedItemStat[]>([]);
  const [recentSearches, setRecentSearches] = useState<RecentCatalogSearch[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function loadData(nextFilters: CatalogStatsFilters, showLoading = false) {
    if (showLoading) setIsLoading(true);
    else setIsRefreshing(true);
    setFeedback(null);

    const userResult = await getCurrentAppUser();
    setCurrentUser(userResult.data);
    if (userResult.error || !userResult.data || !canAccessCatalogStats(userResult.data.role)) {
      setFeedback(userResult.error);
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    const [summaryResult, topResult, typeResult, dailyResult, savedResult, recentResult] = await Promise.all([
      getCatalogStatsSummary(nextFilters),
      getTopCatalogSearches(nextFilters),
      getCatalogSearchTypeStats(nextFilters),
      getCatalogDailyStats(nextFilters),
      getCatalogSavedItemStats(nextFilters),
      getRecentCatalogSearches(nextFilters),
    ]);

    setSummary(summaryResult.data);
    setTopSearches(topResult.data);
    setTypeStats(typeResult.data);
    setDailyStats(dailyResult.data);
    setSavedStats(savedResult.data);
    setRecentSearches(recentResult.data);
    setFeedback(summaryResult.error ?? topResult.error ?? typeResult.error ?? dailyResult.error ?? savedResult.error ?? recentResult.error);
    if (process.env.NODE_ENV === "development") {
      console.log("Catalog stats summary:", summaryResult.data);
    }
    setIsLoading(false);
    setIsRefreshing(false);
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadData(defaultFilters, true);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  const hasChartData = dailyStats.length > 0 || typeStats.length > 0 || savedStats.length > 0 || topSearches.length > 0;

  if (isLoading) return <Card><p className="text-sm font-semibold text-slate-600">Cargando estadísticas del catálogo...</p></Card>;

  if (!currentUser) {
    return (
      <Card className="text-center">
        <ShieldAlert className="mx-auto h-10 w-10 text-ulv-blue" aria-hidden="true" />
        <h2 className="mt-3 text-xl font-black text-ulv-blue">Debes iniciar sesión para acceder a estadísticas del catálogo.</h2>
        <Link href="/login?redirect=/admin/catalogo-estadisticas" className="mt-5 inline-flex min-h-12 items-center justify-center rounded-2xl bg-ulv-yellow px-5 py-3 text-sm font-bold text-ulv-blue">Iniciar sesión</Link>
      </Card>
    );
  }

  if (!canAccessCatalogStats(currentUser.role)) {
    return <Card className="text-center"><ShieldAlert className="mx-auto h-10 w-10 text-red-700" aria-hidden="true" /><h2 className="mt-3 text-xl font-black text-red-700">No tienes permisos para ver estadísticas globales del catálogo.</h2></Card>;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] bg-ulv-blue p-5 text-white shadow-sm md:p-8">
        <p className="text-sm font-bold text-ulv-yellow">Panel bibliotecario</p>
        <h1 className="mt-2 text-3xl font-black leading-tight md:text-5xl">Estadísticas del catálogo</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-white/85">Consulta qué buscan más los usuarios en el catálogo Koha desde Biblioteca ULV App.</p>
      </section>

      {feedback ? <p className="rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-800">{feedback}</p> : null}

      <Card>
        <div className="grid gap-4 md:grid-cols-4">
          <label>
            <span className="text-sm font-bold text-ulv-blue">Periodo</span>
            <select value={filters.period} onChange={(event) => setFilters({ ...filters, period: event.target.value as CatalogStatsFilters["period"] })} className={fieldClass}>
              <option value="today">Hoy</option>
              <option value="week">Esta semana</option>
              <option value="month">Este mes</option>
              <option value="custom">Personalizado</option>
              <option value="all">Todo</option>
            </select>
          </label>
          <label>
            <span className="text-sm font-bold text-ulv-blue">Tipo de búsqueda</span>
            <select value={filters.searchType ?? "all"} onChange={(event) => setFilters({ ...filters, searchType: event.target.value as CatalogStatsFilters["searchType"] })} className={fieldClass}>
              <option value="all">Todos</option>
              {Object.entries(searchTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label>
            <span className="text-sm font-bold text-ulv-blue">Fecha inicial</span>
            <input type="date" value={filters.dateFrom ?? ""} onChange={(event) => setFilters({ ...filters, dateFrom: event.target.value })} className={fieldClass} />
          </label>
          <label>
            <span className="text-sm font-bold text-ulv-blue">Fecha final</span>
            <input type="date" value={filters.dateTo ?? ""} onChange={(event) => setFilters({ ...filters, dateTo: event.target.value })} className={fieldClass} />
          </label>
        </div>
        <div className="mt-4 grid gap-3 sm:flex sm:flex-wrap">
          <button type="button" onClick={() => void loadData(filters)} className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-ulv-yellow px-5 text-sm font-black text-ulv-blue sm:w-auto">{isRefreshing ? "Actualizando..." : "Aplicar filtros"}</button>
          <button type="button" onClick={() => downloadCsv(topSearches)} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-ulv-blue px-5 text-sm font-black text-ulv-blue sm:w-auto"><Download className="h-4 w-4" aria-hidden="true" /> Exportar CSV</button>
        </div>
      </Card>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[
          ["Total de búsquedas", summary.totalSearches],
          ["Términos únicos", summary.uniqueQueries],
          ["Búsquedas con sesión", summary.authenticatedSearches],
          ["Búsquedas anónimas", summary.anonymousSearches],
          ["Recursos guardados", summary.savedItems],
          ["Favoritos", summary.favoriteItems],
        ].map(([label, value]) => <Card key={label} className="p-4"><p className="text-sm font-bold text-slate-500">{label}</p><p className="mt-2 text-3xl font-black text-ulv-blue">{value}</p></Card>)}
      </section>

      {!hasChartData ? <Card><p className="text-sm font-semibold text-slate-600">Aún no hay búsquedas registradas.</p></Card> : null}

      <section className="grid gap-5 xl:grid-cols-2">
        <Card>
          <h2 className="text-xl font-black text-ulv-blue">Actividad por día</h2>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyStats.map((item) => ({ ...item, label: formatDate(item.date) }))}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="label" /><YAxis allowDecimals={false} /><Tooltip /><Line type="monotone" dataKey="total" stroke="#06426a" strokeWidth={3} /></LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <h2 className="text-xl font-black text-ulv-blue">Tipos de búsqueda</h2>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart><Pie data={typeStats.map((item) => ({ name: searchTypeLabels[item.searchType as CatalogSearchType] ?? item.searchType, value: item.total }))} dataKey="value" nameKey="name" outerRadius={92}>{typeStats.map((item, index) => <Cell key={item.searchType} fill={colors[index % colors.length]} />)}</Pie><Tooltip /></PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <h2 className="text-xl font-black text-ulv-blue">Recursos guardados</h2>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={savedStats.map((item) => ({ name: catalogSavedItemStatusLabels[item.status as keyof typeof catalogSavedItemStatusLabels] ?? item.status, total: item.total }))}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="total" fill="#fac600" /></BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <h2 className="text-xl font-black text-ulv-blue">Top 10 búsquedas</h2>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topSearches.map((item) => ({ name: item.query, total: item.total }))} layout="vertical"><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" allowDecimals={false} /><YAxis dataKey="name" type="category" width={110} /><Tooltip /><Bar dataKey="total" fill="#06426a" /></BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </section>

      <Card>
        <div className="mb-4 flex items-center gap-3"><BarChart3 className="h-6 w-6 text-ulv-blue" aria-hidden="true" /><h2 className="text-xl font-black text-ulv-blue">Búsquedas principales</h2></div>
        <div className="grid gap-3">
          {topSearches.length === 0 ? <p className="text-sm font-semibold text-slate-600">Aún no hay búsquedas registradas.</p> : null}
          {topSearches.map((item) => (
            <div key={item.query} className="grid gap-3 rounded-2xl border border-slate-200 p-4 md:grid-cols-[minmax(0,1fr)_120px_180px_150px] md:items-center">
              <p className="font-black text-ulv-blue">{item.query}</p>
              <p className="text-sm font-bold text-slate-700">{item.total} búsquedas</p>
              <p className="text-sm text-slate-600">{formatDateTime(item.lastSearchedAt)}</p>
              <button type="button" onClick={() => openKohaSearch(item.query)} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-ulv-yellow px-4 text-sm font-black text-ulv-blue">Buscar en Koha <ExternalLink className="h-4 w-4" aria-hidden="true" /></button>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="text-xl font-black text-ulv-blue">Búsquedas recientes</h2>
        <div className="mt-4 grid gap-3">
          {recentSearches.length === 0 ? <p className="text-sm font-semibold text-slate-600">No hay búsquedas recientes.</p> : null}
          {recentSearches.map((item) => (
            <div key={item.id} className="grid gap-2 rounded-2xl border border-slate-200 p-4 md:grid-cols-[160px_minmax(0,1fr)_130px_130px_150px] md:items-center">
              <p className="text-sm text-slate-600">{formatDateTime(item.createdAt)}</p>
              <p className="font-black text-ulv-blue">{item.query}</p>
              <p className="text-sm font-semibold text-slate-700">{searchTypeLabels[item.searchType]}</p>
              <p className="text-sm text-slate-600">{sourceLabels[item.source] ?? item.source}</p>
              <p className="text-sm font-bold text-slate-700">{item.userId ? "Usuario autenticado" : "Visitante"}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
