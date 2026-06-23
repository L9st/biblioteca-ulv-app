import { supabase } from "@/lib/supabase";

export type AppUserRole = "student" | "librarian" | "admin" | "superadmin";

export type AppUserStatus = "active" | "inactive" | "blocked";

export type AdminAppUser = {
  id: string;
  email: string;
  name: string;
  role: AppUserRole;
  status: AppUserStatus;
  created_at: string;
  updated_at: string | null;
};

export type AdminUsersResult<T> = {
  data: T;
  error: string | null;
};

const appUserRoles: AppUserRole[] = ["student", "librarian", "admin", "superadmin"];
const appUserStatuses: AppUserStatus[] = ["active", "inactive", "blocked"];

type RawAdminAppUser = {
  id: string;
  email: string | null;
  name: string | null;
  role: string | null;
  status: string | null;
  created_at: string;
  updated_at: string | null;
};

function isAppUserRole(value: string | null): value is AppUserRole {
  return appUserRoles.includes(value as AppUserRole);
}

function isAppUserStatus(value: string | null): value is AppUserStatus {
  return appUserStatuses.includes(value as AppUserStatus);
}

function normalizeAdminAppUser(user: RawAdminAppUser): AdminAppUser {
  return {
    id: user.id,
    email: user.email ?? "",
    name: user.name ?? "Sin nombre",
    role: isAppUserRole(user.role) ? user.role : "student",
    status: isAppUserStatus(user.status) ? user.status : "inactive",
    created_at: user.created_at,
    updated_at: user.updated_at,
  };
}

function getAdminUsersErrorMessage(message: string) {
  const lowerMessage = message.toLowerCase();

  if (
    lowerMessage.includes("permission") ||
    lowerMessage.includes("permiso") ||
    lowerMessage.includes("not allowed") ||
    lowerMessage.includes("unauthorized") ||
    lowerMessage.includes("denied") ||
    lowerMessage.includes("rls")
  ) {
    return "No tienes permisos para administrar usuarios.";
  }

  return "No se pudieron cargar los usuarios.";
}

function getUpdateErrorMessage(message: string) {
  const lowerMessage = message.toLowerCase();

  if (
    lowerMessage.includes("permission") ||
    lowerMessage.includes("permiso") ||
    lowerMessage.includes("not allowed") ||
    lowerMessage.includes("unauthorized") ||
    lowerMessage.includes("denied") ||
    lowerMessage.includes("rls")
  ) {
    return "No tienes permisos para administrar usuarios.";
  }

  return "No se pudo actualizar el usuario.";
}

export async function getCurrentAppUser(): Promise<AdminUsersResult<AdminAppUser | null>> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

  if (sessionError) {
    console.error("Error al obtener sesión:", sessionError.message);
    return { data: null, error: "Debes iniciar sesión para acceder al panel administrativo." };
  }

  if (!sessionData.session) {
    return { data: null, error: null };
  }

  const { data, error } = await supabase
    .from("app_users")
    .select("id, email, name, role, status, created_at, updated_at")
    .eq("id", sessionData.session.user.id)
    .maybeSingle();

  if (error) {
    console.error("Error al obtener usuario actual:", error.message);
    return { data: null, error: getAdminUsersErrorMessage(error.message) };
  }

  return { data: data ? normalizeAdminAppUser(data as RawAdminAppUser) : null, error: null };
}

export async function getAdminUsers(): Promise<AdminUsersResult<AdminAppUser[]>> {
  const { data, error } = await supabase
    .from("app_users")
    .select("id, email, name, role, status, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error al obtener usuarios:", error.message);
    return { data: [], error: getAdminUsersErrorMessage(error.message) };
  }

  return { data: ((data ?? []) as RawAdminAppUser[]).map(normalizeAdminAppUser), error: null };
}

export async function updateUserRole(userId: string, role: AppUserRole): Promise<AdminUsersResult<AdminAppUser | null>> {
  const { data, error } = await supabase
    .from("app_users")
    .update({ role })
    .eq("id", userId)
    .select("id, email, name, role, status, created_at, updated_at")
    .single();

  if (error) {
    console.error("Error al actualizar rol de usuario:", error.message);
    return { data: null, error: getUpdateErrorMessage(error.message) };
  }

  return { data: normalizeAdminAppUser(data as RawAdminAppUser), error: null };
}

export async function updateUserStatus(userId: string, status: AppUserStatus): Promise<AdminUsersResult<AdminAppUser | null>> {
  const { data, error } = await supabase
    .from("app_users")
    .update({ status })
    .eq("id", userId)
    .select("id, email, name, role, status, created_at, updated_at")
    .single();

  if (error) {
    console.error("Error al actualizar estado de usuario:", error.message);
    return { data: null, error: getUpdateErrorMessage(error.message) };
  }

  return { data: normalizeAdminAppUser(data as RawAdminAppUser), error: null };
}
