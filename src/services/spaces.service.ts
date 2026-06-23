import { supabase } from "@/lib/supabase";

export type LibrarySpace = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  services: string | null;
  rules: string | null;
  location_hint: string | null;
  capacity: number | null;
  image_url: string | null;
  is_reservable: boolean;
  status: string;
  qr_token: string | null;
  libraries: {
    name: string;
    code: string;
    description: string | null;
    opening_hours: string | null;
  } | null;
};

type LibraryInfo = LibrarySpace["libraries"];

type RawLibrarySpace = Omit<LibrarySpace, "libraries"> & {
  libraries: LibraryInfo | LibraryInfo[];
};

function normalizeLibrarySpace(space: RawLibrarySpace): LibrarySpace {
  return {
    ...space,
    libraries: Array.isArray(space.libraries) ? space.libraries[0] ?? null : space.libraries,
  };
}

export async function getActiveLibrarySpaces(): Promise<LibrarySpace[]> {
  const { data, error } = await supabase
    .from("library_spaces")
    .select(
      `
      id,
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
      qr_token,
      libraries (
        name,
        code,
        description,
        opening_hours
      )
      `
    )
    .eq("status", "active")
    .order("name", { ascending: true });

  if (error) {
    console.error("Error al obtener espacios:", error.message);
    return [];
  }

  return (data ?? []).map(normalizeLibrarySpace);
}

export async function getLibrarySpaceBySlug(
  slug: string
): Promise<LibrarySpace | null> {
  const { data, error } = await supabase
    .from("library_spaces")
    .select(
      `
      id,
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
      qr_token,
      libraries (
        name,
        code,
        description,
        opening_hours
      )
      `
    )
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    console.error("Error al obtener el espacio:", error.message);
    return null;
  }

  return data ? normalizeLibrarySpace(data) : null;
}
