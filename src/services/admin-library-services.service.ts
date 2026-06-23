import { supabase } from "@/lib/supabase";
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

export async function getAdminLibraryServices(): Promise<LibraryServiceResult<AdminLibraryService[]>> {
  const { data, error } = await supabase.from("library_services").select(serviceSelect).order("created_at", { ascending: false });
  if (error) return { data: [], error: "No se pudieron cargar los servicios." };
  return { data: ((data ?? []) as RawAdminLibraryService[]).map(normalizeLibraryService), error: null };
}

export async function getAdminLibrariesForServices(): Promise<LibraryServiceResult<AdminLibraryForServices[]>> {
  const { data, error } = await supabase.from("libraries").select("id, name, code").order("name", { ascending: true });
  if (error) return { data: [], error: "No se pudieron cargar las bibliotecas." };
  return { data: (data ?? []) as AdminLibraryForServices[], error: null };
}

export async function createLibraryService(input: LibraryServiceInput): Promise<LibraryServiceResult<null>> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return { data: null, error: "Debes iniciar sesión para crear servicios." };
  const { error } = await supabase.from("library_services").insert({ ...input, created_by: userData.user.id });
  return { data: null, error: error ? serviceError(error.message) : null };
}

export async function updateLibraryService(serviceId: string, input: LibraryServiceInput): Promise<LibraryServiceResult<null>> {
  const { error } = await supabase.from("library_services").update(input).eq("id", serviceId);
  return { data: null, error: error ? serviceError(error.message) : null };
}

export async function toggleLibraryServiceStatus(serviceId: string, status: LibraryServiceStatus): Promise<LibraryServiceResult<null>> {
  const { error } = await supabase.from("library_services").update({ status }).eq("id", serviceId);
  return { data: null, error: error ? "No se pudo cambiar el estado del servicio." : null };
}
