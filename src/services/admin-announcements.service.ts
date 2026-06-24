import { supabase } from "@/lib/supabase";
import { createAuditLog } from "@/services/admin-audit.service";
import { isOffline, OFFLINE_ACTION_MESSAGE } from "@/lib/offline";
import { auditLibraryAccessDenied, canAccessLibrary, filterLibrariesForCurrentUser, getLibraryAccessContext } from "@/services/library-access.service";
import {
  normalizeAnnouncement,
  type AnnouncementAudience,
  type AnnouncementResult,
  type AnnouncementStatus,
  type AnnouncementType,
  type PublicAnnouncement,
} from "@/services/announcements.service";

export type AdminAnnouncement = PublicAnnouncement;

export type AdminAnnouncementLibrary = {
  id: string;
  name: string;
  code: string;
};

export type AnnouncementInput = {
  library_id: string | null;
  title: string;
  summary: string | null;
  content: string;
  type: AnnouncementType;
  audience: AnnouncementAudience;
  status: AnnouncementStatus;
  starts_at: string | null;
  ends_at: string | null;
};

type RawAdminAnnouncement = Omit<AdminAnnouncement, "libraries" | "type" | "audience" | "status"> & {
  type: string;
  audience: string;
  status: string;
  libraries: AdminAnnouncement["libraries"] | AdminAnnouncement["libraries"][];
};

async function canManageAnnouncementLibrary(libraryId: string | null, reason: string, entityLabel?: string | null): Promise<AnnouncementResult<null> | null> {
  const accessContext = await getLibraryAccessContext();
  if (canAccessLibrary(libraryId, accessContext, false)) return null;

  void auditLibraryAccessDenied({ libraryId, reason, entityLabel }).catch((auditError: unknown) => console.error("No se pudo registrar denegación de acceso:", auditError));
  return { data: null, error: libraryId ? "No tienes permiso para administrar avisos de esta biblioteca." : "Solo administradores pueden administrar avisos generales." };
}

export async function getAdminAnnouncements(): Promise<AnnouncementResult<AdminAnnouncement[]>> {
  const { data, error } = await supabase
    .from("announcements")
    .select("id, library_id, title, summary, content, type, audience, status, starts_at, ends_at, created_at, updated_at, libraries (id, name, code)")
    .order("created_at", { ascending: false });

  if (error) return { data: [], error: "No se pudieron cargar los avisos." };
  const accessContext = await getLibraryAccessContext();
  const announcements = ((data ?? []) as RawAdminAnnouncement[]).map(normalizeAnnouncement);
  return { data: accessContext.canAccessAll ? announcements : announcements.filter((announcement) => canAccessLibrary(announcement.library_id, accessContext, false)), error: null };
}

export async function getAdminAnnouncementLibraries(): Promise<AnnouncementResult<AdminAnnouncementLibrary[]>> {
  const { data, error } = await supabase.from("libraries").select("id, name, code").order("name", { ascending: true });
  if (error) return { data: [], error: "No se pudieron cargar las bibliotecas." };
  const accessContext = await getLibraryAccessContext();
  return { data: filterLibrariesForCurrentUser((data ?? []) as AdminAnnouncementLibrary[], accessContext), error: null };
}

export async function createAnnouncement(input: AnnouncementInput): Promise<AnnouncementResult<null>> {
  if (isOffline()) return { data: null, error: OFFLINE_ACTION_MESSAGE };

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return { data: null, error: "Debes iniciar sesión para crear avisos." };

  const denied = await canManageAnnouncementLibrary(input.library_id, "Intento de crear aviso para biblioteca no asignada", input.title);
  if (denied) return denied;

  const { data, error } = await supabase.from("announcements").insert({ ...input, created_by: userData.user.id }).select("id, title").single();
  if (error) return { data: null, error: "No se pudo crear el aviso." };

  void createAuditLog({ module: "announcements", action: "created", entity_table: "announcements", entity_id: data.id, entity_label: data.title, description: "Aviso creado" }).catch((auditError: unknown) => console.error("No se pudo registrar auditoría de aviso:", auditError));
  return { data: null, error: null };
}

export async function updateAnnouncement(announcementId: string, input: AnnouncementInput): Promise<AnnouncementResult<null>> {
  if (isOffline()) return { data: null, error: OFFLINE_ACTION_MESSAGE };

  const { data: currentAnnouncement } = await supabase.from("announcements").select("id, library_id, title").eq("id", announcementId).maybeSingle();
  const currentLibraryId = typeof currentAnnouncement?.library_id === "string" ? currentAnnouncement.library_id : null;
  const deniedCurrent = await canManageAnnouncementLibrary(currentLibraryId, "Intento de editar aviso de biblioteca no asignada", currentAnnouncement?.title ?? input.title);
  if (deniedCurrent) return deniedCurrent;

  const deniedTarget = await canManageAnnouncementLibrary(input.library_id, "Intento de mover aviso a biblioteca no asignada", input.title);
  if (deniedTarget) return deniedTarget;

  const { error } = await supabase.from("announcements").update(input).eq("id", announcementId);
  if (error) return { data: null, error: "No se pudo actualizar el aviso." };

  void createAuditLog({ module: "announcements", action: "updated", entity_table: "announcements", entity_id: announcementId, entity_label: input.title, description: "Aviso actualizado" }).catch((auditError: unknown) => console.error("No se pudo registrar auditoría de aviso:", auditError));
  return { data: null, error: null };
}

export async function toggleAnnouncementStatus(announcementId: string, status: AnnouncementStatus): Promise<AnnouncementResult<null>> {
  if (isOffline()) return { data: null, error: OFFLINE_ACTION_MESSAGE };

  const { data: currentAnnouncement } = await supabase.from("announcements").select("id, library_id, title").eq("id", announcementId).maybeSingle();
  const currentLibraryId = typeof currentAnnouncement?.library_id === "string" ? currentAnnouncement.library_id : null;
  const denied = await canManageAnnouncementLibrary(currentLibraryId, "Intento de cambiar estado de aviso de biblioteca no asignada", currentAnnouncement?.title ?? announcementId);
  if (denied) return denied;

  const { data, error } = await supabase.from("announcements").update({ status }).eq("id", announcementId).select("id, title, status").single();
  if (error) return { data: null, error: "No se pudo cambiar el estado del aviso." };

  const action = status === "published" || status === "archived" ? status : "status_changed";
  const description = status === "published" ? "Aviso publicado" : status === "archived" ? "Aviso archivado" : "Estado de aviso actualizado";
  void createAuditLog({ module: "announcements", action, entity_table: "announcements", entity_id: data.id, entity_label: data.title, description, metadata: { newStatus: data.status } }).catch((auditError: unknown) => console.error("No se pudo registrar auditoría de aviso:", auditError));
  return { data: null, error: null };
}
