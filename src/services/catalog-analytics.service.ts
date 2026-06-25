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

  const { error } = await supabase.rpc("register_catalog_search_event", {
    p_query: query,
    p_search_type: normalizeSearchType(input.searchType),
    p_koha_url: kohaUrl,
    p_source: input.source ?? "catalog",
  });

  if (error) console.warn("No se pudo registrar estadística de catálogo:", error.message);
}
