export type CatalogSearchType = "keyword" | "title" | "author" | "subject" | "isbn";

export type CatalogSearchInput = {
  query: string;
  type: CatalogSearchType;
};

function normalizeBaseUrl(value: string | undefined): string {
  return (value ?? "").trim().replace(/\/+$/, "");
}

export function getKohaOpacBaseUrl(): string {
  const baseUrl = normalizeBaseUrl(process.env.NEXT_PUBLIC_KOHA_OPAC_URL);
  if (!baseUrl) throw new Error("No se configuró la URL del OPAC de Koha.");
  return baseUrl;
}

function buildQuery(input: CatalogSearchInput): string {
  const query = input.query.trim();
  if (!query) throw new Error("Escribe un término de búsqueda.");

  if (input.type === "title") return `ti:${query}`;
  if (input.type === "author") return `au:${query}`;
  if (input.type === "subject") return `su:${query}`;
  if (input.type === "isbn") return `isbn:${query}`;
  return query;
}

export function buildKohaSearchUrl(input: CatalogSearchInput): string {
  const baseUrl = getKohaOpacBaseUrl();
  const searchParams = new URLSearchParams();
  searchParams.set("q", buildQuery(input));
  return `${baseUrl}/cgi-bin/koha/opac-search.pl?${searchParams.toString()}`;
}

export function buildKohaAccountUrl(): string {
  return `${getKohaOpacBaseUrl()}/cgi-bin/koha/opac-user.pl`;
}

export function buildKohaAdvancedSearchUrl(): string {
  return `${getKohaOpacBaseUrl()}/cgi-bin/koha/opac-search.pl`;
}
