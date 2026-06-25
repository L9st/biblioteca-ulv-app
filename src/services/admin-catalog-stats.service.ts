import { supabase } from "@/lib/supabase";
import { catalogSavedItemStatusLabels, type CatalogSavedItemStatus, type CatalogSearchType } from "@/services/catalog-saved-items.service";

export type CatalogStatsFilters = {
  period: "today" | "week" | "month" | "custom" | "all";
  dateFrom?: string;
  dateTo?: string;
  searchType?: "all" | CatalogSearchType;
};

export type TopCatalogSearch = {
  query: string;
  total: number;
  lastSearchedAt: string | null;
};

export type CatalogSearchTypeStat = {
  searchType: string;
  total: number;
};

export type CatalogDailyStat = {
  date: string;
  total: number;
};

export type CatalogSavedItemStat = {
  status: string;
  total: number;
};

export type CatalogStatsSummary = {
  totalSearches: number;
  uniqueQueries: number;
  authenticatedSearches: number;
  anonymousSearches: number;
  savedItems: number;
  favoriteItems: number;
};

export type RecentCatalogSearch = {
  id: string;
  query: string;
  searchType: CatalogSearchType;
  source: string;
  userId: string | null;
  kohaUrl: string;
  createdAt: string;
};

export type CatalogStatsResult<T> = { data: T; error: string | null };

type RawCatalogSearchEvent = {
  id: string;
  query: string;
  search_type: string;
  source: string | null;
  user_id: string | null;
  koha_url: string;
  created_at: string;
};

type RawSavedItemStat = {
  id: string;
  status: string;
  created_at: string;
};

function getCatalogStatsError(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes("permission") || lower.includes("denied") || lower.includes("rls") || lower.includes("unauthorized")) return "No tienes permisos para ver estadísticas del catálogo.";
  return "No se pudieron cargar las estadísticas del catálogo.";
}

function normalizeSearchType(value: string): CatalogSearchType {
  if (value === "title" || value === "author" || value === "subject" || value === "isbn") return value;
  return "keyword";
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function getDateRange(filters: CatalogStatsFilters): { from: string | null; to: string | null } {
  if (filters.period === "all") return { from: null, to: null };

  if (filters.period === "custom") {
    const from = filters.dateFrom ? new Date(`${filters.dateFrom}T00:00:00`) : null;
    const to = filters.dateTo ? new Date(`${filters.dateTo}T23:59:59.999`) : null;
    return { from: from?.toISOString() ?? null, to: to?.toISOString() ?? null };
  }

  const fromDate = startOfToday();
  if (filters.period === "week") {
    const day = fromDate.getDay();
    fromDate.setDate(fromDate.getDate() - (day === 0 ? 6 : day - 1));
  }
  if (filters.period === "month") fromDate.setDate(1);
  return { from: fromDate.toISOString(), to: null };
}

function applyDateFilters<T>(query: T, filters: CatalogStatsFilters): T {
  const range = getDateRange(filters);
  let nextQuery = query as T & { gte: (column: string, value: string) => T; lte: (column: string, value: string) => T };
  if (range.from) nextQuery = nextQuery.gte("created_at", range.from) as typeof nextQuery;
  if (range.to) nextQuery = nextQuery.lte("created_at", range.to) as typeof nextQuery;
  return nextQuery as T;
}

async function getCatalogSearchEvents(filters: CatalogStatsFilters): Promise<CatalogStatsResult<RawCatalogSearchEvent[]>> {
  let query = supabase
    .from("catalog_search_events")
    .select("id, query, search_type, source, user_id, koha_url, created_at")
    .order("created_at", { ascending: false })
    .limit(5000);

  query = applyDateFilters(query, filters);
  if (filters.searchType && filters.searchType !== "all") query = query.eq("search_type", filters.searchType);

  const { data, error } = await query;
  if (error) return { data: [], error: getCatalogStatsError(error.message) };
  return { data: (data ?? []) as RawCatalogSearchEvent[], error: null };
}

async function getSavedItems(filters: CatalogStatsFilters): Promise<CatalogStatsResult<RawSavedItemStat[]>> {
  let query = supabase.from("catalog_saved_items").select("id, status, created_at").order("created_at", { ascending: false }).limit(5000);
  query = applyDateFilters(query, filters);
  const { data, error } = await query;
  if (error) return { data: [], error: getCatalogStatsError(error.message) };
  return { data: (data ?? []) as RawSavedItemStat[], error: null };
}

export async function getCatalogStatsSummary(filters: CatalogStatsFilters): Promise<CatalogStatsResult<CatalogStatsSummary>> {
  const [eventsResult, savedItemsResult] = await Promise.all([getCatalogSearchEvents(filters), getSavedItems(filters)]);
  const events = eventsResult.data;
  const savedItems = savedItemsResult.data;

  return {
    data: {
      totalSearches: events.length,
      uniqueQueries: new Set(events.map((event) => event.query)).size,
      authenticatedSearches: events.filter((event) => Boolean(event.user_id)).length,
      anonymousSearches: events.filter((event) => !event.user_id).length,
      savedItems: savedItems.length,
      favoriteItems: savedItems.filter((item) => item.status === "favorite").length,
    },
    error: eventsResult.error ?? savedItemsResult.error,
  };
}

export async function getTopCatalogSearches(filters: CatalogStatsFilters): Promise<CatalogStatsResult<TopCatalogSearch[]>> {
  const result = await getCatalogSearchEvents(filters);
  const byQuery = new Map<string, TopCatalogSearch>();

  result.data.forEach((event) => {
    const current = byQuery.get(event.query);
    if (!current) {
      byQuery.set(event.query, { query: event.query, total: 1, lastSearchedAt: event.created_at });
      return;
    }
    current.total += 1;
    if (!current.lastSearchedAt || new Date(event.created_at) > new Date(current.lastSearchedAt)) current.lastSearchedAt = event.created_at;
  });

  return { data: Array.from(byQuery.values()).sort((a, b) => b.total - a.total).slice(0, 10), error: result.error };
}

export async function getCatalogSearchTypeStats(filters: CatalogStatsFilters): Promise<CatalogStatsResult<CatalogSearchTypeStat[]>> {
  const result = await getCatalogSearchEvents(filters);
  const totals = new Map<string, number>();
  result.data.forEach((event) => totals.set(normalizeSearchType(event.search_type), (totals.get(normalizeSearchType(event.search_type)) ?? 0) + 1));
  return { data: Array.from(totals.entries()).map(([searchType, total]) => ({ searchType, total })).sort((a, b) => b.total - a.total), error: result.error };
}

export async function getCatalogDailyStats(filters: CatalogStatsFilters): Promise<CatalogStatsResult<CatalogDailyStat[]>> {
  const result = await getCatalogSearchEvents(filters);
  const totals = new Map<string, number>();
  result.data.forEach((event) => {
    const date = event.created_at.slice(0, 10);
    totals.set(date, (totals.get(date) ?? 0) + 1);
  });
  return { data: Array.from(totals.entries()).map(([date, total]) => ({ date, total })).sort((a, b) => a.date.localeCompare(b.date)), error: result.error };
}

export async function getCatalogSavedItemStats(filters: CatalogStatsFilters): Promise<CatalogStatsResult<CatalogSavedItemStat[]>> {
  const result = await getSavedItems(filters);
  const totals = new Map<string, number>();
  result.data.forEach((item) => {
    const status = catalogSavedItemStatusLabels[item.status as CatalogSavedItemStatus] ? item.status : "saved";
    totals.set(status, (totals.get(status) ?? 0) + 1);
  });
  return { data: Array.from(totals.entries()).map(([status, total]) => ({ status, total })).sort((a, b) => b.total - a.total), error: result.error };
}

export async function getRecentCatalogSearches(filters: CatalogStatsFilters): Promise<CatalogStatsResult<RecentCatalogSearch[]>> {
  const result = await getCatalogSearchEvents(filters);
  return {
    data: result.data.slice(0, 20).map((event) => ({
      id: event.id,
      query: event.query,
      searchType: normalizeSearchType(event.search_type),
      source: event.source ?? "catalog",
      userId: event.user_id,
      kohaUrl: event.koha_url,
      createdAt: event.created_at,
    })),
    error: result.error,
  };
}
