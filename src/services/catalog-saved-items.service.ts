import { supabase } from "@/lib/supabase";
import { isOffline, OFFLINE_ACTION_MESSAGE } from "@/lib/offline";

export type CatalogSavedItemStatus = "saved" | "want_to_read" | "reading" | "read" | "favorite";

export type CatalogSavedItem = {
  id: string;
  user_id: string;
  title: string;
  author: string | null;
  isbn: string | null;
  year: string | null;
  koha_url: string;
  notes: string | null;
  status: CatalogSavedItemStatus;
  created_at: string;
  updated_at: string | null;
};

export type CatalogSearchType = "keyword" | "title" | "author" | "subject" | "isbn";

export type CatalogSearchHistoryItem = {
  id: string;
  user_id: string | null;
  query: string;
  search_type: CatalogSearchType;
  koha_url: string;
  created_at: string;
};

export type CatalogSavedItemsResult<T> = { data: T; error: string | null };

export type CreateCatalogSavedItemInput = {
  title: string;
  author?: string | null;
  isbn?: string | null;
  year?: string | null;
  koha_url: string;
  notes?: string | null;
  status?: CatalogSavedItemStatus;
};

export type UpdateCatalogSavedItemInput = Partial<Omit<CreateCatalogSavedItemInput, "koha_url">> & {
  koha_url?: string;
};

export type CreateCatalogSearchHistoryInput = {
  query: string;
  search_type: CatalogSearchType;
  koha_url: string;
};

const savedItemFields = "id, user_id, title, author, isbn, year, koha_url, notes, status, created_at, updated_at";
const historyFields = "id, user_id, query, search_type, koha_url, created_at";

export const catalogSavedItemStatusLabels: Record<CatalogSavedItemStatus, string> = {
  saved: "Guardado",
  want_to_read: "Quiero leer",
  reading: "Leyendo",
  read: "Leído",
  favorite: "Favorito",
};

async function getCurrentUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user.id;
}

function normalizeOptionalText(value: string | null | undefined) {
  const cleanValue = value?.trim();
  return cleanValue ? cleanValue : null;
}

function normalizeStatus(status: string | null | undefined): CatalogSavedItemStatus {
  if (status === "want_to_read" || status === "reading" || status === "read" || status === "favorite") return status;
  return "saved";
}

function normalizeSearchType(type: string): CatalogSearchType {
  if (type === "title" || type === "author" || type === "subject" || type === "isbn") return type;
  return "keyword";
}

function normalizeSavedItem(item: CatalogSavedItem): CatalogSavedItem {
  return { ...item, status: normalizeStatus(item.status), updated_at: item.updated_at ?? null };
}

function normalizeHistoryItem(item: CatalogSearchHistoryItem): CatalogSearchHistoryItem {
  return { ...item, search_type: normalizeSearchType(item.search_type) };
}

function isValidHttpUrl(value: string) {
  return value.startsWith("http://") || value.startsWith("https://");
}

function catalogItemsError(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes("permission") || lower.includes("denied") || lower.includes("rls")) return "No tienes permisos para realizar esta acción.";
  return "No se pudo procesar el recurso del catálogo.";
}

export async function getMyCatalogSavedItems(): Promise<CatalogSavedItemsResult<CatalogSavedItem[]>> {
  const userId = await getCurrentUserId();
  if (!userId) return { data: [], error: "Debes iniciar sesión para ver tus recursos guardados." };

  const { data, error } = await supabase.from("catalog_saved_items").select(savedItemFields).eq("user_id", userId).order("created_at", { ascending: false });
  if (error) return { data: [], error: catalogItemsError(error.message) };
  return { data: ((data ?? []) as CatalogSavedItem[]).map(normalizeSavedItem), error: null };
}

export async function createCatalogSavedItem(input: CreateCatalogSavedItemInput): Promise<CatalogSavedItemsResult<CatalogSavedItem | null>> {
  if (isOffline()) return { data: null, error: OFFLINE_ACTION_MESSAGE };
  const userId = await getCurrentUserId();
  if (!userId) return { data: null, error: "Debes iniciar sesión para guardar recursos." };

  const title = input.title.trim();
  const kohaUrl = input.koha_url.trim();
  if (!title) return { data: null, error: "El título es obligatorio." };
  if (!kohaUrl) return { data: null, error: "La URL de Koha es obligatoria." };
  if (!isValidHttpUrl(kohaUrl)) return { data: null, error: "La URL debe iniciar con http:// o https://." };

  const { data: existingItem, error: existingError } = await supabase
    .from("catalog_saved_items")
    .select(savedItemFields)
    .eq("user_id", userId)
    .eq("koha_url", kohaUrl)
    .maybeSingle();

  if (existingError) return { data: null, error: catalogItemsError(existingError.message) };
  if (existingItem) return { data: normalizeSavedItem(existingItem as CatalogSavedItem), error: null };

  const { data, error } = await supabase
    .from("catalog_saved_items")
    .insert({
      user_id: userId,
      title,
      author: normalizeOptionalText(input.author),
      isbn: normalizeOptionalText(input.isbn),
      year: normalizeOptionalText(input.year),
      koha_url: kohaUrl,
      notes: normalizeOptionalText(input.notes),
      status: normalizeStatus(input.status),
    })
    .select(savedItemFields)
    .single();

  if (error) return { data: null, error: catalogItemsError(error.message) };
  return { data: normalizeSavedItem(data as CatalogSavedItem), error: null };
}

export async function updateCatalogSavedItem(id: string, input: UpdateCatalogSavedItemInput): Promise<CatalogSavedItemsResult<CatalogSavedItem | null>> {
  if (isOffline()) return { data: null, error: OFFLINE_ACTION_MESSAGE };
  const userId = await getCurrentUserId();
  if (!userId) return { data: null, error: "Debes iniciar sesión para editar recursos." };

  const update: Record<string, string | null> = {};
  if (input.title !== undefined) {
    const title = input.title.trim();
    if (!title) return { data: null, error: "El título es obligatorio." };
    update.title = title;
  }
  if (input.koha_url !== undefined) {
    const kohaUrl = input.koha_url.trim();
    if (!kohaUrl) return { data: null, error: "La URL de Koha es obligatoria." };
    if (!isValidHttpUrl(kohaUrl)) return { data: null, error: "La URL debe iniciar con http:// o https://." };
    update.koha_url = kohaUrl;
  }
  if (input.author !== undefined) update.author = normalizeOptionalText(input.author);
  if (input.isbn !== undefined) update.isbn = normalizeOptionalText(input.isbn);
  if (input.year !== undefined) update.year = normalizeOptionalText(input.year);
  if (input.notes !== undefined) update.notes = normalizeOptionalText(input.notes);
  if (input.status !== undefined) update.status = normalizeStatus(input.status);

  const { data, error } = await supabase.from("catalog_saved_items").update(update).eq("id", id).eq("user_id", userId).select(savedItemFields).maybeSingle();
  if (error) return { data: null, error: catalogItemsError(error.message) };
  if (!data) return { data: null, error: "No se encontró el recurso." };
  return { data: normalizeSavedItem(data as CatalogSavedItem), error: null };
}

export async function deleteCatalogSavedItem(id: string): Promise<CatalogSavedItemsResult<boolean>> {
  if (isOffline()) return { data: false, error: OFFLINE_ACTION_MESSAGE };
  const userId = await getCurrentUserId();
  if (!userId) return { data: false, error: "Debes iniciar sesión para eliminar recursos." };

  const { error } = await supabase.from("catalog_saved_items").delete().eq("id", id).eq("user_id", userId);
  if (error) return { data: false, error: catalogItemsError(error.message) };
  return { data: true, error: null };
}

export async function getMyCatalogSearchHistory(): Promise<CatalogSavedItemsResult<CatalogSearchHistoryItem[]>> {
  const userId = await getCurrentUserId();
  if (!userId) return { data: [], error: "Debes iniciar sesión para ver tu historial de búsquedas." };

  const { data, error } = await supabase.from("catalog_search_history").select(historyFields).eq("user_id", userId).order("created_at", { ascending: false }).limit(50);
  if (error) return { data: [], error: catalogItemsError(error.message) };
  return { data: ((data ?? []) as CatalogSearchHistoryItem[]).map(normalizeHistoryItem), error: null };
}

export async function createCatalogSearchHistory(input: CreateCatalogSearchHistoryInput): Promise<CatalogSavedItemsResult<CatalogSearchHistoryItem | null>> {
  if (isOffline()) return { data: null, error: OFFLINE_ACTION_MESSAGE };
  const userId = await getCurrentUserId();
  if (!userId) return { data: null, error: null };

  const query = input.query.trim();
  const kohaUrl = input.koha_url.trim();
  if (!query || !kohaUrl) return { data: null, error: null };

  const { data, error } = await supabase
    .from("catalog_search_history")
    .insert({ user_id: userId, query, search_type: normalizeSearchType(input.search_type), koha_url: kohaUrl })
    .select(historyFields)
    .single();

  if (error) return { data: null, error: catalogItemsError(error.message) };
  return { data: normalizeHistoryItem(data as CatalogSearchHistoryItem), error: null };
}

export async function deleteCatalogSearchHistoryItem(id: string): Promise<CatalogSavedItemsResult<boolean>> {
  if (isOffline()) return { data: false, error: OFFLINE_ACTION_MESSAGE };
  const userId = await getCurrentUserId();
  if (!userId) return { data: false, error: "Debes iniciar sesión para eliminar búsquedas." };

  const { error } = await supabase.from("catalog_search_history").delete().eq("id", id).eq("user_id", userId);
  if (error) return { data: false, error: catalogItemsError(error.message) };
  return { data: true, error: null };
}

export async function clearMyCatalogSearchHistory(): Promise<CatalogSavedItemsResult<boolean>> {
  if (isOffline()) return { data: false, error: OFFLINE_ACTION_MESSAGE };
  const userId = await getCurrentUserId();
  if (!userId) return { data: false, error: "Debes iniciar sesión para borrar el historial." };

  const { error } = await supabase.from("catalog_search_history").delete().eq("user_id", userId);
  if (error) return { data: false, error: catalogItemsError(error.message) };
  return { data: true, error: null };
}
