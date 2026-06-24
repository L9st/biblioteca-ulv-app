import { supabase } from "@/lib/supabase";
import { createAuditLog } from "@/services/admin-audit.service";
import { isOffline, OFFLINE_ACTION_MESSAGE } from "@/lib/offline";
import { auditLibraryAccessDenied, canAccessLibrary, filterLibrariesForCurrentUser, getLibraryAccessContext } from "@/services/library-access.service";
import {
  normalizeLibraryService,
  type LibraryServiceAudience,
  type LibraryServiceCategory,
  type LibraryServiceResult,
  type LibraryServiceStatus,
  type PublicLibraryService,
} from "@/services/library-services.service";

export type AdminLibraryService = PublicLibraryService;
export type AdminLibraryForServices = { id: string; name: string; code: string };
export type LibraryServiceInput = {
  library_id: string | null;
  title: string;
  slug: string;
  summary: string | null;
  description: string;
  category: LibraryServiceCategory;
  audience: LibraryServiceAudience;
  requirements: string | null;
  schedule: string | null;
  contact_info: string | null;
  image_url: string | null;
  status: LibraryServiceStatus;
};

type RawAdminLibraryService = Omit<AdminLibraryService, "libraries" | "category" | "audience" | "status"> & {
  category: string;
  audience: string;
  status: string;
  libraries: AdminLibraryService["libraries"] | AdminLibraryService["libraries"][];
};

const serviceSelect = "id, library_id, title, slug, summary, description, category, audience, requirements, schedule, contact_info, image_url, status, created_at, updated_at, libraries (id, name, code)";

function serviceError(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes("duplicate") || lower.includes("unique") || lower.includes("slug")) return "Ya existe un servicio con ese slug. Modifica el slug o el título.";
  return "No se pudo procesar el servicio.";
}

async function canManageServiceLibrary(libraryId: string | null, reason: string, entityLabel?: string | null): Promise<LibraryServiceResult<null> | null> {
  const accessContext = await getLibraryAccessContext();
  if (canAccessLibrary(libraryId, accessContext, false)) return null;

  void auditLibraryAccessDenied({ libraryId, reason, entityLabel }).catch((auditError: unknown) => console.error("No se pudo registrar denegación de acceso:", auditError));
  return { data: null, error: libraryId ? "No tienes permiso para administrar servicios de esta biblioteca." : "Solo administradores pueden administrar servicios generales." };
}

export async function getAdminLibraryServices(): Promise<LibraryServiceResult<AdminLibraryService[]>> {
  const { data, error } = await supabase.from("library_services").select(serviceSelect).order("created_at", { ascending: false });
  if (error) return { data: [], error: "No se pudieron cargar los servicios." };
  const accessContext = await getLibraryAccessContext();
  const services = ((data ?? []) as RawAdminLibraryService[]).map(normalizeLibraryService);
  return { data: accessContext.canAccessAll ? services : services.filter((service) => canAccessLibrary(service.library_id, accessContext, false)), error: null };
}

export async function getAdminLibrariesForServices(): Promise<LibraryServiceResult<AdminLibraryForServices[]>> {
  const { data, error } = await supabase.from("libraries").select("id, name, code").order("name", { ascending: true });
  if (error) return { data: [], error: "No se pudieron cargar las bibliotecas." };
  const accessContext = await getLibraryAccessContext();
  return { data: filterLibrariesForCurrentUser((data ?? []) as AdminLibraryForServices[], accessContext), error: null };
}

export async function createLibraryService(input: LibraryServiceInput): Promise<LibraryServiceResult<null>> {
  if (isOffline()) return { data: null, error: OFFLINE_ACTION_MESSAGE };

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return { data: null, error: "Debes iniciar sesión para crear servicios." };
  const denied = await canManageServiceLibrary(input.library_id, "Intento de crear servicio para biblioteca no asignada", input.title);
  if (denied) return denied;

  const { data, error } = await supabase.from("library_services").insert({ ...input, created_by: userData.user.id }).select("id, title").single();
  if (error) return { data: null, error: serviceError(error.message) };

  void createAuditLog({ module: "services", action: "created", entity_table: "library_services", entity_id: data.id, entity_label: data.title, description: "Servicio creado" }).catch((auditError: unknown) => console.error("No se pudo registrar auditoría de servicio:", auditError));
  return { data: null, error: null };
}

export async function updateLibraryService(serviceId: string, input: LibraryServiceInput): Promise<LibraryServiceResult<null>> {
  if (isOffline()) return { data: null, error: OFFLINE_ACTION_MESSAGE };

  const { data: currentService } = await supabase.from("library_services").select("id, library_id, title").eq("id", serviceId).maybeSingle();
  const currentLibraryId = typeof currentService?.library_id === "string" ? currentService.library_id : null;
  const deniedCurrent = await canManageServiceLibrary(currentLibraryId, "Intento de editar servicio de biblioteca no asignada", currentService?.title ?? input.title);
  if (deniedCurrent) return deniedCurrent;
  const deniedTarget = await canManageServiceLibrary(input.library_id, "Intento de mover servicio a biblioteca no asignada", input.title);
  if (deniedTarget) return deniedTarget;

  const { error } = await supabase.from("library_services").update(input).eq("id", serviceId);
  if (error) return { data: null, error: serviceError(error.message) };

  void createAuditLog({ module: "services", action: "updated", entity_table: "library_services", entity_id: serviceId, entity_label: input.title, description: "Servicio actualizado" }).catch((auditError: unknown) => console.error("No se pudo registrar auditoría de servicio:", auditError));
  return { data: null, error: null };
}

export async function toggleLibraryServiceStatus(serviceId: string, status: LibraryServiceStatus): Promise<LibraryServiceResult<null>> {
  if (isOffline()) return { data: null, error: OFFLINE_ACTION_MESSAGE };

  const { data: currentService } = await supabase.from("library_services").select("id, library_id, title").eq("id", serviceId).maybeSingle();
  const currentLibraryId = typeof currentService?.library_id === "string" ? currentService.library_id : null;
  const denied = await canManageServiceLibrary(currentLibraryId, "Intento de cambiar estado de servicio de biblioteca no asignada", currentService?.title ?? serviceId);
  if (denied) return denied;

  const { data, error } = await supabase.from("library_services").update({ status }).eq("id", serviceId).select("id, title, status").single();
  if (error) return { data: null, error: "No se pudo cambiar el estado del servicio." };

  void createAuditLog({ module: "services", action: "status_changed", entity_table: "library_services", entity_id: data.id, entity_label: data.title, description: "Estado de servicio actualizado", metadata: { newStatus: data.status } }).catch((auditError: unknown) => console.error("No se pudo registrar auditoría de servicio:", auditError));
  return { data: null, error: null };
}
