import { supabase } from "@/lib/supabase";
import { createAuditLog } from "@/services/admin-audit.service";
import type { AppUserRole } from "@/services/admin-users.service";

export type AssignedLibrary = {
  id: string;
  name: string;
  code: string;
};

export type AccessUserProfile = {
  id: string;
  name: string | null;
  email: string | null;
  role: AppUserRole;
  status: string | null;
};

export type LibraryAccessContext = {
  profile: AccessUserProfile | null;
  assignedLibraries: AssignedLibrary[];
  canAccessAll: boolean;
  allowedLibraryIds: Set<string>;
};

type RawAssignedLibrary = {
  libraries: AssignedLibrary | AssignedLibrary[] | null;
};

function normalizeRelation<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function normalizeRole(role: string | null): AppUserRole {
  if (role === "librarian" || role === "admin" || role === "superadmin") return role;
  return "student";
}

export async function getCurrentUserProfileForAccess(): Promise<AccessUserProfile | null> {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) return null;

  const { data, error } = await supabase
    .from("app_users")
    .select("id, name, email, role, status")
    .eq("id", sessionData.session.user.id)
    .maybeSingle();

  if (error || !data) return null;
  return { ...data, role: normalizeRole(data.role) };
}

export async function getCurrentUserAssignedLibraries(): Promise<AssignedLibrary[]> {
  const profile = await getCurrentUserProfileForAccess();
  if (!profile) return [];

  const { data, error } = await supabase
    .from("app_user_libraries")
    .select("libraries (id, name, code)")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false });

  if (error) return [];
  return ((data ?? []) as RawAssignedLibrary[])
    .map((item) => normalizeRelation(item.libraries))
    .filter((library): library is AssignedLibrary => Boolean(library));
}

export async function canCurrentUserAccessAllLibraries(): Promise<boolean> {
  const profile = await getCurrentUserProfileForAccess();
  return profile?.role === "admin" || profile?.role === "superadmin";
}

export async function getLibraryAccessContext(): Promise<LibraryAccessContext> {
  const profile = await getCurrentUserProfileForAccess();
  const canAccessAll = profile?.role === "admin" || profile?.role === "superadmin";
  const assignedLibraries = canAccessAll || !profile ? [] : await getCurrentUserAssignedLibraries();

  return {
    profile,
    assignedLibraries,
    canAccessAll,
    allowedLibraryIds: new Set(assignedLibraries.map((library) => library.id)),
  };
}

export function filterLibrariesForCurrentUser<T extends { id: string }>(libraries: T[], context: LibraryAccessContext): T[] {
  if (context.canAccessAll) return libraries;
  return libraries.filter((library) => context.allowedLibraryIds.has(library.id));
}

export function canAccessLibrary(libraryId: string | null | undefined, context: LibraryAccessContext, allowGeneral = false): boolean {
  if (context.canAccessAll) return true;
  if (!libraryId) return allowGeneral;
  return context.allowedLibraryIds.has(libraryId);
}

export function noAssignedLibrariesMessage(context: LibraryAccessContext): string | null {
  if (context.profile?.role === "librarian" && context.assignedLibraries.length === 0) {
    return "No tienes bibliotecas asignadas. Solicita a un administrador que te asigne una biblioteca.";
  }

  return null;
}

export async function auditLibraryAccessDenied(input: { libraryId: string | null; reason: string; entityLabel?: string | null }) {
  await createAuditLog({
    module: "system",
    action: "access_denied",
    entity_table: "libraries",
    entity_id: input.libraryId,
    entity_label: input.entityLabel ?? input.libraryId,
    description: input.reason,
  });
}
