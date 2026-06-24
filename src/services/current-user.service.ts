import { supabase } from "@/lib/supabase";
import type { AssignmentLibrary, UserLibraryAssignment } from "@/services/admin-users.service";

export type CurrentUserLibrariesResult = {
  data: AssignmentLibrary[];
  error: string | null;
};

type RawCurrentUserLibraryAssignment = Omit<UserLibraryAssignment, "libraries"> & {
  libraries: AssignmentLibrary | AssignmentLibrary[] | null;
};

function normalizeRelation<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

export async function getCurrentUserAssignedLibraries(): Promise<CurrentUserLibrariesResult> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return { data: [], error: "Debes iniciar sesión para ver tus bibliotecas asignadas." };

  const { data, error } = await supabase
    .from("app_user_libraries")
    .select("id, user_id, library_id, created_at, libraries (id, name, code)")
    .eq("user_id", userData.user.id)
    .order("created_at", { ascending: false });

  if (error) return { data: [], error: "No se pudieron cargar tus bibliotecas asignadas." };

  return {
    data: ((data ?? []) as RawCurrentUserLibraryAssignment[])
      .map((assignment) => normalizeRelation(assignment.libraries))
      .filter((library): library is AssignmentLibrary => Boolean(library)),
    error: null,
  };
}
