import { supabase } from "@/lib/supabase";
import { createAuditLog } from "@/services/admin-audit.service";
import { isOffline, OFFLINE_ACTION_MESSAGE } from "@/lib/offline";

export type LibraryStatus = "active" | "inactive";

export type AdminLibrary = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  opening_hours: string | null;
  status: string;
};

export type LibrarySpaceStatus = "active" | "inactive";

export type AdminLibrarySpace = {
  id: string;
  library_id: string;
  name: string;
  slug: string;
  description: string | null;
  services: string | null;
  rules: string | null;
  location_hint: string | null;
  capacity: number | null;
  image_url: string | null;
  is_reservable: boolean;
  status: LibrarySpaceStatus;
  created_at: string;
  updated_at: string | null;
  libraries: {
    id: string;
    name: string;
    code: string;
  } | null;
};

export type LibrarySpaceInput = {
  library_id: string;
  name: string;
  slug: string;
  description: string | null;
  services: string | null;
  rules: string | null;
  location_hint: string | null;
  capacity: number | null;
  image_url: string | null;
  is_reservable: boolean;
  status: LibrarySpaceStatus;
};

export type AdminSpacesResult<T> = {
  data: T;
  error: string | null;
};

type RawAdminLibrarySpace = Omit<AdminLibrarySpace, "libraries"> & {
  libraries: AdminLibrarySpace["libraries"] | AdminLibrarySpace["libraries"][];
};

function normalizeRelation<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function normalizeStatus(value: string): LibrarySpaceStatus {
  return value === "inactive" ? "inactive" : "active";
}

function normalizeLibrarySpace(space: RawAdminLibrarySpace): AdminLibrarySpace {
  return {
    ...space,
    status: normalizeStatus(space.status),
    libraries: normalizeRelation(space.libraries),
  };
}

function getSpacesErrorMessage(message: string) {
  const lowerMessage = message.toLowerCase();

  if (
    lowerMessage.includes("duplicate") ||
    lowerMessage.includes("unique") ||
    lowerMessage.includes("already exists") ||
    lowerMessage.includes("duplicado")
  ) {
    return "Ya existe un espacio con ese slug. Usa otro nombre o modifica el slug.";
  }

  if (
    lowerMessage.includes("permission") ||
    lowerMessage.includes("permiso") ||
    lowerMessage.includes("not allowed") ||
    lowerMessage.includes("unauthorized") ||
    lowerMessage.includes("denied") ||
    lowerMessage.includes("rls")
  ) {
    return "No tienes permisos para administrar espacios.";
  }

  return "No se pudo completar la operación de espacios.";
}

export async function getAdminLibraries(): Promise<AdminSpacesResult<AdminLibrary[]>> {
  const { data, error } = await supabase
    .from("libraries")
    .select("id, code, name, description, opening_hours, status")
    .order("name", { ascending: true });

  if (error) {
    console.error("Error al obtener bibliotecas:", error.message);
    return { data: [], error: getSpacesErrorMessage(error.message) };
  }

  return { data: data ?? [], error: null };
}

export async function getAdminLibrarySpaces(): Promise<AdminSpacesResult<AdminLibrarySpace[]>> {
  const { data, error } = await supabase
    .from("library_spaces")
    .select(
      `
      id,
      library_id,
      name,
      slug,
      description,
      services,
      rules,
      location_hint,
      capacity,
      image_url,
      is_reservable,
      status,
      created_at,
      updated_at,
      libraries (
        id,
        name,
        code
      )
      `
    )
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error al obtener espacios administrativos:", error.message);
    return { data: [], error: getSpacesErrorMessage(error.message) };
  }

  return { data: ((data ?? []) as RawAdminLibrarySpace[]).map(normalizeLibrarySpace), error: null };
}

export async function createLibrarySpace(input: LibrarySpaceInput): Promise<AdminSpacesResult<AdminLibrarySpace | null>> {
  if (isOffline()) return { data: null, error: OFFLINE_ACTION_MESSAGE };

  const { data, error } = await supabase
    .from("library_spaces")
    .insert(input)
    .select(
      `
      id,
      library_id,
      name,
      slug,
      description,
      services,
      rules,
      location_hint,
      capacity,
      image_url,
      is_reservable,
      status,
      created_at,
      updated_at,
      libraries (id, name, code)
      `
    )
    .single();

  if (error) {
    console.error("Error al crear espacio:", error.message);
    return { data: null, error: getSpacesErrorMessage(error.message) };
  }

  const space = normalizeLibrarySpace(data as RawAdminLibrarySpace);

  void createAuditLog({
    module: "spaces",
    action: "created",
    entity_table: "library_spaces",
    entity_id: space.id,
    entity_label: space.name,
    description: "Espacio creado",
  }).catch((auditError: unknown) => console.error("No se pudo registrar auditoría de espacio:", auditError));

  return { data: space, error: null };
}

export async function updateLibrarySpace(
  spaceId: string,
  input: LibrarySpaceInput
): Promise<AdminSpacesResult<AdminLibrarySpace | null>> {
  if (isOffline()) return { data: null, error: OFFLINE_ACTION_MESSAGE };

  const { data, error } = await supabase
    .from("library_spaces")
    .update(input)
    .eq("id", spaceId)
    .select(
      `
      id,
      library_id,
      name,
      slug,
      description,
      services,
      rules,
      location_hint,
      capacity,
      image_url,
      is_reservable,
      status,
      created_at,
      updated_at,
      libraries (id, name, code)
      `
    )
    .single();

  if (error) {
    console.error("Error al actualizar espacio:", error.message);
    return { data: null, error: getSpacesErrorMessage(error.message) };
  }

  const space = normalizeLibrarySpace(data as RawAdminLibrarySpace);

  void createAuditLog({
    module: "spaces",
    action: "updated",
    entity_table: "library_spaces",
    entity_id: space.id,
    entity_label: space.name,
    description: "Espacio actualizado",
  }).catch((auditError: unknown) => console.error("No se pudo registrar auditoría de espacio:", auditError));

  return { data: space, error: null };
}

export async function toggleLibrarySpaceStatus(
  spaceId: string,
  status: LibrarySpaceStatus
): Promise<AdminSpacesResult<AdminLibrarySpace | null>> {
  if (isOffline()) return { data: null, error: OFFLINE_ACTION_MESSAGE };

  const { data, error } = await supabase
    .from("library_spaces")
    .update({ status })
    .eq("id", spaceId)
    .select(
      `
      id,
      library_id,
      name,
      slug,
      description,
      services,
      rules,
      location_hint,
      capacity,
      image_url,
      is_reservable,
      status,
      created_at,
      updated_at,
      libraries (id, name, code)
      `
    )
    .single();

  if (error) {
    console.error("Error al cambiar estado del espacio:", error.message);
    return { data: null, error: getSpacesErrorMessage(error.message) };
  }

  const space = normalizeLibrarySpace(data as RawAdminLibrarySpace);

  void createAuditLog({
    module: "spaces",
    action: "status_changed",
    entity_table: "library_spaces",
    entity_id: space.id,
    entity_label: space.name,
    description: "Estado de espacio actualizado",
    metadata: { newStatus: space.status },
  }).catch((auditError: unknown) => console.error("No se pudo registrar auditoría de estado de espacio:", auditError));

  return { data: space, error: null };
}
