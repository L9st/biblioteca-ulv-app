import { supabase } from "@/lib/supabase";
import { createAuditLog } from "@/services/admin-audit.service";
import { isOffline, OFFLINE_ACTION_MESSAGE } from "@/lib/offline";
import { auditLibraryAccessDenied, canAccessLibrary, filterLibrariesForCurrentUser, getLibraryAccessContext } from "@/services/library-access.service";
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

async function canManageHelpLibrary(libraryId: string | null, reason: string, entityLabel?: string | null): Promise<HelpResult<null> | null> {
  const accessContext = await getLibraryAccessContext();
  if (canAccessLibrary(libraryId, accessContext, false)) return null;

  void auditLibraryAccessDenied({ libraryId, reason, entityLabel }).catch((auditError: unknown) => console.error("No se pudo registrar denegación de acceso:", auditError));
  return { data: null, error: libraryId ? "No tienes permiso para administrar ayuda de esta biblioteca." : "Solo administradores pueden administrar ayuda general." };
}

export async function getAdminHelpArticles(): Promise<HelpResult<AdminHelpArticle[]>> {
  const { data, error } = await supabase.from("help_articles").select(helpSelect).order("sort_order", { ascending: true }).order("created_at", { ascending: false });
  if (error) return { data: [], error: "No se pudieron cargar los artículos de ayuda." };
  const accessContext = await getLibraryAccessContext();
  const articles = ((data ?? []) as RawAdminHelpArticle[]).map(normalizeHelpArticle);
  return { data: accessContext.canAccessAll ? articles : articles.filter((article) => canAccessLibrary(article.library_id, accessContext, false)), error: null };
}

export async function getAdminLibrariesForHelp(): Promise<HelpResult<AdminHelpLibrary[]>> {
  const { data, error } = await supabase.from("libraries").select("id, name, code").order("name", { ascending: true });
  if (error) return { data: [], error: "No se pudieron cargar las bibliotecas." };
  const accessContext = await getLibraryAccessContext();
  return { data: filterLibrariesForCurrentUser((data ?? []) as AdminHelpLibrary[], accessContext), error: null };
}

export async function createHelpArticle(input: HelpArticleInput): Promise<HelpResult<null>> {
  if (isOffline()) return { data: null, error: OFFLINE_ACTION_MESSAGE };

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return { data: null, error: "Debes iniciar sesión para crear artículos." };
  const denied = await canManageHelpLibrary(input.library_id, "Intento de crear ayuda para biblioteca no asignada", input.title);
  if (denied) return denied;

  const { data, error } = await supabase.from("help_articles").insert({ ...input, created_by: userData.user.id }).select("id, title").single();
  if (error) return { data: null, error: helpError(error.message) };

  void createAuditLog({ module: "help", action: "created", entity_table: "help_articles", entity_id: data.id, entity_label: data.title, description: "Artículo de ayuda creado" }).catch((auditError: unknown) => console.error("No se pudo registrar auditoría de ayuda:", auditError));
  return { data: null, error: null };
}

export async function updateHelpArticle(articleId: string, input: HelpArticleInput): Promise<HelpResult<null>> {
  if (isOffline()) return { data: null, error: OFFLINE_ACTION_MESSAGE };

  const { data: currentArticle } = await supabase.from("help_articles").select("id, library_id, title").eq("id", articleId).maybeSingle();
  const currentLibraryId = typeof currentArticle?.library_id === "string" ? currentArticle.library_id : null;
  const deniedCurrent = await canManageHelpLibrary(currentLibraryId, "Intento de editar ayuda de biblioteca no asignada", currentArticle?.title ?? input.title);
  if (deniedCurrent) return deniedCurrent;
  const deniedTarget = await canManageHelpLibrary(input.library_id, "Intento de mover ayuda a biblioteca no asignada", input.title);
  if (deniedTarget) return deniedTarget;

  const { error } = await supabase.from("help_articles").update(input).eq("id", articleId);
  if (error) return { data: null, error: helpError(error.message) };

  void createAuditLog({ module: "help", action: "updated", entity_table: "help_articles", entity_id: articleId, entity_label: input.title, description: "Artículo de ayuda actualizado" }).catch((auditError: unknown) => console.error("No se pudo registrar auditoría de ayuda:", auditError));
  return { data: null, error: null };
}

export async function toggleHelpArticleStatus(articleId: string, status: HelpStatus): Promise<HelpResult<null>> {
  if (isOffline()) return { data: null, error: OFFLINE_ACTION_MESSAGE };

  const { data: currentArticle } = await supabase.from("help_articles").select("id, library_id, title").eq("id", articleId).maybeSingle();
  const currentLibraryId = typeof currentArticle?.library_id === "string" ? currentArticle.library_id : null;
  const denied = await canManageHelpLibrary(currentLibraryId, "Intento de cambiar estado de ayuda de biblioteca no asignada", currentArticle?.title ?? articleId);
  if (denied) return denied;

  const { data, error } = await supabase.from("help_articles").update({ status }).eq("id", articleId).select("id, title, status").single();
  if (error) return { data: null, error: "No se pudo cambiar el estado del artículo." };

  const action = status === "published" || status === "archived" ? status : "status_changed";
  const description = status === "published" ? "Artículo de ayuda publicado" : status === "archived" ? "Artículo de ayuda archivado" : "Estado de artículo de ayuda actualizado";
  void createAuditLog({ module: "help", action, entity_table: "help_articles", entity_id: data.id, entity_label: data.title, description, metadata: { newStatus: data.status } }).catch((auditError: unknown) => console.error("No se pudo registrar auditoría de ayuda:", auditError));
  return { data: null, error: null };
}
