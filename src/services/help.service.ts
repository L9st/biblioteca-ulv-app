import { supabase } from "@/lib/supabase";

export type HelpCategory = "general" | "attendance" | "reservations" | "spaces" | "koha" | "account" | "notifications";
export type HelpAudience = "all" | "students" | "staff";
export type HelpStatus = "draft" | "published" | "archived";

export type PublicHelpArticle = {
  id: string;
  library_id: string | null;
  title: string;
  slug: string;
  question: string | null;
  answer: string;
  category: HelpCategory;
  audience: HelpAudience;
  status: HelpStatus;
  sort_order: number;
  created_at: string;
  updated_at: string | null;
  libraries: { id: string; name: string; code: string } | null;
};

export type HelpResult<T> = { data: T; error: string | null };

type RawHelpArticle = Omit<PublicHelpArticle, "libraries" | "category" | "audience" | "status"> & {
  category: string;
  audience: string;
  status: string;
  libraries: PublicHelpArticle["libraries"] | PublicHelpArticle["libraries"][];
};

export const helpCategoryLabels: Record<HelpCategory, string> = {
  general: "General",
  attendance: "Registro de horas",
  reservations: "Reservas",
  spaces: "Espacios",
  koha: "Catálogo Koha",
  account: "Mi cuenta",
  notifications: "Notificaciones",
};

export const helpAudienceLabels: Record<HelpAudience, string> = {
  all: "Todos",
  students: "Usuarios / estudiantes",
  staff: "Personal de biblioteca",
};

export const helpStatusLabels: Record<HelpStatus, string> = {
  draft: "Borrador",
  published: "Publicado",
  archived: "Archivado",
};

function normalizeRelation<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function normalizeCategory(category: string): HelpCategory {
  if (category === "attendance" || category === "reservations" || category === "spaces" || category === "koha" || category === "account" || category === "notifications") return category;
  return "general";
}

function normalizeAudience(audience: string): HelpAudience {
  if (audience === "students" || audience === "staff") return audience;
  return "all";
}

function normalizeStatus(status: string): HelpStatus {
  if (status === "draft" || status === "archived") return status;
  return "published";
}

export function normalizeHelpArticle(article: RawHelpArticle): PublicHelpArticle {
  return { ...article, category: normalizeCategory(article.category), audience: normalizeAudience(article.audience), status: normalizeStatus(article.status), libraries: normalizeRelation(article.libraries) };
}

const helpSelect = "id, library_id, title, slug, question, answer, category, audience, status, sort_order, created_at, updated_at, libraries (id, name, code)";

export async function getPublishedHelpArticles(): Promise<HelpResult<PublicHelpArticle[]>> {
  const { data, error } = await supabase.from("help_articles").select(helpSelect).eq("status", "published").order("sort_order", { ascending: true }).order("created_at", { ascending: false });
  if (error) return { data: [], error: "No se pudieron cargar los artículos de ayuda." };
  return { data: ((data ?? []) as RawHelpArticle[]).map(normalizeHelpArticle), error: null };
}

export async function getHelpArticleBySlug(slug: string): Promise<HelpResult<PublicHelpArticle | null>> {
  const { data, error } = await supabase.from("help_articles").select(helpSelect).eq("status", "published").eq("slug", slug).maybeSingle();
  if (error) return { data: null, error: "No se pudo cargar el artículo de ayuda." };
  return { data: data ? normalizeHelpArticle(data as RawHelpArticle) : null, error: null };
}

export async function getLatestHelpArticles(limit = 3): Promise<HelpResult<PublicHelpArticle[]>> {
  const { data, error } = await supabase.from("help_articles").select(helpSelect).eq("status", "published").order("created_at", { ascending: false }).limit(limit);
  if (error) return { data: [], error: "No se pudo cargar la ayuda rápida." };
  return { data: ((data ?? []) as RawHelpArticle[]).map(normalizeHelpArticle), error: null };
}
