import { supabase } from "@/lib/supabase";

export type LibraryServiceCategory = "general" | "loan" | "digital" | "support" | "space" | "training";
export type LibraryServiceAudience = "all" | "students" | "teachers" | "staff";
export type LibraryServiceStatus = "active" | "inactive";

export type PublicLibraryService = {
  id: string;
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
  created_at: string;
  updated_at: string | null;
  libraries: { id: string; name: string; code: string } | null;
};

export type LibraryServiceResult<T> = { data: T; error: string | null };

type RawLibraryService = Omit<PublicLibraryService, "libraries" | "category" | "audience" | "status"> & {
  category: string;
  audience: string;
  status: string;
  libraries: PublicLibraryService["libraries"] | PublicLibraryService["libraries"][];
};

export const libraryServiceCategoryLabels: Record<LibraryServiceCategory, string> = {
  general: "General",
  loan: "Préstamo",
  digital: "Digital",
  support: "Apoyo / orientación",
  space: "Espacios",
  training: "Capacitación",
};

export const libraryServiceAudienceLabels: Record<LibraryServiceAudience, string> = {
  all: "Todos",
  students: "Estudiantes",
  teachers: "Docentes",
  staff: "Personal",
};

export const libraryServiceStatusLabels: Record<LibraryServiceStatus, string> = {
  active: "Activo",
  inactive: "Inactivo",
};

function normalizeRelation<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function normalizeCategory(category: string): LibraryServiceCategory {
  if (category === "loan" || category === "digital" || category === "support" || category === "space" || category === "training") return category;
  return "general";
}

function normalizeAudience(audience: string): LibraryServiceAudience {
  if (audience === "students" || audience === "teachers" || audience === "staff") return audience;
  return "all";
}

function normalizeStatus(status: string): LibraryServiceStatus {
  return status === "inactive" ? "inactive" : "active";
}

export function normalizeLibraryService(service: RawLibraryService): PublicLibraryService {
  return {
    ...service,
    category: normalizeCategory(service.category),
    audience: normalizeAudience(service.audience),
    status: normalizeStatus(service.status),
    libraries: normalizeRelation(service.libraries),
  };
}

const serviceSelect = "id, library_id, title, slug, summary, description, category, audience, requirements, schedule, contact_info, image_url, status, created_at, updated_at, libraries (id, name, code)";

export async function getActiveLibraryServices(): Promise<LibraryServiceResult<PublicLibraryService[]>> {
  const { data, error } = await supabase.from("library_services").select(serviceSelect).eq("status", "active").order("created_at", { ascending: false });
  if (error) return { data: [], error: "No se pudieron cargar los servicios." };
  return { data: ((data ?? []) as RawLibraryService[]).map(normalizeLibraryService), error: null };
}

export async function getLibraryServiceBySlug(slug: string): Promise<LibraryServiceResult<PublicLibraryService | null>> {
  const { data, error } = await supabase.from("library_services").select(serviceSelect).eq("status", "active").eq("slug", slug).maybeSingle();
  if (error) return { data: null, error: "No se pudo cargar el servicio." };
  return { data: data ? normalizeLibraryService(data as RawLibraryService) : null, error: null };
}

export async function getLatestLibraryServices(limit = 3): Promise<LibraryServiceResult<PublicLibraryService[]>> {
  const { data, error } = await supabase.from("library_services").select(serviceSelect).eq("status", "active").order("created_at", { ascending: false }).limit(limit);
  if (error) return { data: [], error: "No se pudieron cargar los servicios destacados." };
  return { data: ((data ?? []) as RawLibraryService[]).map(normalizeLibraryService), error: null };
}
