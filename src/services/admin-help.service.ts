import { supabase } from "@/lib/supabase";
import { createAuditLog } from "@/services/admin-audit.service";
import { normalizeHelpArticle, type HelpAudience, type HelpCategory, type HelpResult, type HelpStatus, type PublicHelpArticle } from "@/services/help.service";

export type AdminHelpArticle = PublicHelpArticle;
export type AdminHelpLibrary = { id: string; name: string; code: string };
export type HelpArticleInput = {
  library_id: string | null;
  title: string;
  slug: string;
  question: string | null;
  answer: string;
  category: HelpCategory;
  audience: HelpAudience;
  status: HelpStatus;
  sort_order: number;
};

type RawAdminHelpArticle = Omit<AdminHelpArticle, "libraries" | "category" | "audience" | "status"> & {
  category: string;
  audience: string;
  status: string;
  libraries: AdminHelpArticle["libraries"] | AdminHelpArticle["libraries"][];
};

const helpSelect = "id, library_id, title, slug, question, answer, category, audience, status, sort_order, created_at, updated_at, libraries (id, name, code)";

function helpError(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes("duplicate") || lower.includes("unique") || lower.includes("slug")) return "Ya existe un artículo con ese slug. Modifica el slug o el título.";
  return "No se pudo procesar el artículo de ayuda.";
}

export async function getAdminHelpArticles(): Promise<HelpResult<AdminHelpArticle[]>> {
  const { data, error } = await supabase.from("help_articles").select(helpSelect).order("sort_order", { ascending: true }).order("created_at", { ascending: false });
  if (error) return { data: [], error: "No se pudieron cargar los artículos de ayuda." };
  return { data: ((data ?? []) as RawAdminHelpArticle[]).map(normalizeHelpArticle), error: null };
}

export async function getAdminLibrariesForHelp(): Promise<HelpResult<AdminHelpLibrary[]>> {
  const { data, error } = await supabase.from("libraries").select("id, name, code").order("name", { ascending: true });
  if (error) return { data: [], error: "No se pudieron cargar las bibliotecas." };
  return { data: (data ?? []) as AdminHelpLibrary[], error: null };
}

export async function createHelpArticle(input: HelpArticleInput): Promise<HelpResult<null>> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return { data: null, error: "Debes iniciar sesión para crear artículos." };
  const { data, error } = await supabase.from("help_articles").insert({ ...input, created_by: userData.user.id }).select("id, title").single();
  if (error) return { data: null, error: helpError(error.message) };

  void createAuditLog({ module: "help", action: "created", entity_table: "help_articles", entity_id: data.id, entity_label: data.title, description: "Artículo de ayuda creado" }).catch((auditError: unknown) => console.error("No se pudo registrar auditoría de ayuda:", auditError));
  return { data: null, error: null };
}

export async function updateHelpArticle(articleId: string, input: HelpArticleInput): Promise<HelpResult<null>> {
  const { error } = await supabase.from("help_articles").update(input).eq("id", articleId);
  if (error) return { data: null, error: helpError(error.message) };

  void createAuditLog({ module: "help", action: "updated", entity_table: "help_articles", entity_id: articleId, entity_label: input.title, description: "Artículo de ayuda actualizado" }).catch((auditError: unknown) => console.error("No se pudo registrar auditoría de ayuda:", auditError));
  return { data: null, error: null };
}

export async function toggleHelpArticleStatus(articleId: string, status: HelpStatus): Promise<HelpResult<null>> {
  const { data, error } = await supabase.from("help_articles").update({ status }).eq("id", articleId).select("id, title, status").single();
  if (error) return { data: null, error: "No se pudo cambiar el estado del artículo." };

  const action = status === "published" || status === "archived" ? status : "status_changed";
  const description = status === "published" ? "Artículo de ayuda publicado" : status === "archived" ? "Artículo de ayuda archivado" : "Estado de artículo de ayuda actualizado";
  void createAuditLog({ module: "help", action, entity_table: "help_articles", entity_id: data.id, entity_label: data.title, description, metadata: { newStatus: data.status } }).catch((auditError: unknown) => console.error("No se pudo registrar auditoría de ayuda:", auditError));
  return { data: null, error: null };
}
