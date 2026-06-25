import { supabase } from "@/lib/supabase";
import type { CatalogSearchType } from "@/services/catalog-saved-items.service";

export type { CatalogSearchType };

export type CatalogSearchSource = "catalog" | "dashboard" | "saved_resource" | "history";

export function normalizeSearchQuery(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function normalizeSearchType(value: CatalogSearchType): CatalogSearchType {
  if (value === "title" || value === "author" || value === "subject" || value === "isbn") return value;
  return "keyword";
}

export async function registerCatalogSearchEvent(input: {
  query: string;
  searchType: CatalogSearchType;
  kohaUrl: string;
  source?: CatalogSearchSource;
}): Promise<void> {
  const query = normalizeSearchQuery(input.query);
  const kohaUrl = input.kohaUrl.trim();
  if (!query || !kohaUrl) return;

  const { data } = await supabase.auth.getUser();

  const { error } = await supabase.from("catalog_search_events").insert({
    user_id: data.user?.id ?? null,
    query,
    search_type: normalizeSearchType(input.searchType),
    koha_url: kohaUrl,
    source: input.source ?? "catalog",
  });

  if (error) console.error("No se pudo registrar estadística de búsqueda de catálogo:", error.message);
}
