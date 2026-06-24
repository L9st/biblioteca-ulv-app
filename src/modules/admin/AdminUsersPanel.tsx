"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCw, Search, ShieldAlert, Users } from "lucide-react";
import {
  assignLibraryToUser,
  getAllLibrariesForAssignment,
  getAdminUsers,
  getCurrentAppUser,
  getUserLibraryAssignments,
  removeLibraryFromUser,
  updateUserRole,
  updateUserStatus,
  type AssignmentLibrary,
  type AdminAppUser,
  type AppUserRole,
  type AppUserStatus,
  type UserLibraryAssignment,
} from "@/services/admin-users.service";
import { Card } from "@/app/ui/Card";

type RoleFilter = "all" | AppUserRole;
type StatusFilter = "all" | AppUserStatus;
type Feedback = {
  type: "success" | "error";
  message: string;
};

const roleOptions: AppUserRole[] = ["student", "librarian", "admin", "superadmin"];
const statusOptions: AppUserStatus[] = ["active", "inactive", "blocked"];

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function canAccessPanel(role: AppUserRole) {
  return role === "librarian" || role === "admin" || role === "superadmin";
}

function canEditUsers(role: AppUserRole) {
  return role === "admin" || role === "superadmin";
}

function matchesSearch(user: AdminAppUser, search: string) {
  const cleanSearch = search.trim().toLowerCase();

  if (!cleanSearch) {
    return true;
  }

  return [user.name, user.email].some((value) => value.toLowerCase().includes(cleanSearch));
}

function getRoleBadgeClassName(role: AppUserRole) {
  if (role === "admin" || role === "superadmin") {
    return "bg-ulv-yellow text-ulv-blue";
  }

  if (role === "librarian") {
    return "bg-ulv-blue text-white";
  }

  return "bg-slate-100 text-slate-700";
}

function getStatusBadgeClassName(status: AppUserStatus) {
  if (status === "active") {
    return "bg-green-50 text-green-800";
  }

  if (status === "blocked") {
    return "bg-red-50 text-red-800";
  }

  return "bg-slate-100 text-slate-700";
}

export function AdminUsersPanel() {
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<AdminAppUser | null>(null);
  const [users, setUsers] = useState<AdminAppUser[]>([]);
  const [libraries, setLibraries] = useState<AssignmentLibrary[]>([]);
  const [assignmentsByUserId, setAssignmentsByUserId] = useState<Record<string, UserLibraryAssignment[]>>({});
  const [search, setSearch] = useState("");
  const [selectedRole, setSelectedRole] = useState<RoleFilter>("all");
  const [selectedStatus, setSelectedStatus] = useState<StatusFilter>("all");
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  async function loadData({ showLoading = true } = {}) {
    if (showLoading) {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }

    setFeedback(null);
    const currentUserResult = await getCurrentAppUser();
    setCurrentUser(currentUserResult.data);

    if (currentUserResult.error) {
      setFeedback({ type: "error", message: currentUserResult.error });
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    if (!currentUserResult.data || !canAccessPanel(currentUserResult.data.role)) {
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    const [usersResult, librariesResult] = await Promise.all([getAdminUsers(), getAllLibrariesForAssignment()]);
    setUsers(usersResult.data);
    setLibraries(librariesResult.data);

    const assignmentEntries = await Promise.all(
      usersResult.data.map(async (user) => {
        const result = await getUserLibraryAssignments(user.id);
        return [user.id, result.data] as const;
      })
    );
    setAssignmentsByUserId(Object.fromEntries(assignmentEntries));

    if (usersResult.error || librariesResult.error) {
      setFeedback({ type: "error", message: usersResult.error ?? librariesResult.error ?? "No se pudieron cargar los usuarios." });
    }

    setIsLoading(false);
    setIsRefreshing(false);
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadData();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

  async function handleRoleChange(userId: string, role: AppUserRole) {
    if (!currentUser || !canEditUsers(currentUser.role)) {
      setFeedback({ type: "error", message: "No tienes permisos para administrar usuarios." });
      return;
    }

    setUpdatingUserId(userId);
    const result = await updateUserRole(userId, role);

    if (result.error || !result.data) {
      setFeedback({ type: "error", message: result.error ?? "No se pudo actualizar el usuario." });
    } else {
      setUsers((currentUsers) => currentUsers.map((user) => (user.id === userId ? result.data ?? user : user)));
      setFeedback({ type: "success", message: "Rol actualizado correctamente" });
    }

    setUpdatingUserId(null);
  }

  async function handleStatusChange(userId: string, status: AppUserStatus) {
    if (!currentUser || !canEditUsers(currentUser.role)) {
      setFeedback({ type: "error", message: "No tienes permisos para administrar usuarios." });
      return;
    }

    setUpdatingUserId(userId);
    const result = await updateUserStatus(userId, status);

    if (result.error || !result.data) {
      setFeedback({ type: "error", message: result.error ?? "No se pudo actualizar el usuario." });
    } else {
      setUsers((currentUsers) => currentUsers.map((user) => (user.id === userId ? result.data ?? user : user)));
      setFeedback({ type: "success", message: "Estado actualizado correctamente" });
    }

    setUpdatingUserId(null);
  }

  function getUserAssignments(userId: string) {
    return assignmentsByUserId[userId] ?? [];
  }

  function getUserLibrariesText(user: AdminAppUser) {
    if (user.role === "superadmin") return "Acceso global";
    if (user.role === "student") return "No requiere";

    const assignedLibraries = getUserAssignments(user.id).map((assignment) => assignment.libraries?.name).filter((name): name is string => Boolean(name));
    return assignedLibraries.length > 0 ? assignedLibraries.join(", ") : "Sin asignar";
  }

  function isLibraryAssigned(userId: string, libraryId: string) {
    return getUserAssignments(userId).some((assignment) => assignment.library_id === libraryId);
  }

  async function handleLibraryToggle(user: AdminAppUser, library: AssignmentLibrary, checked: boolean) {
    if (!currentUser || !canEditUsers(currentUser.role)) {
      setFeedback({ type: "error", message: "No tienes permisos para modificar bibliotecas asignadas." });
      return;
    }

    setUpdatingUserId(user.id);
    const result = checked ? await assignLibraryToUser(user.id, library.id) : await removeLibraryFromUser(user.id, library.id);

    if (result.error) {
      setFeedback({ type: "error", message: result.error });
    } else {
      const assignmentsResult = await getUserLibraryAssignments(user.id);
      setAssignmentsByUserId((current) => ({ ...current, [user.id]: assignmentsResult.data }));
      setFeedback({ type: "success", message: checked ? "Biblioteca asignada correctamente." : "Asignación eliminada correctamente." });
    }

    setUpdatingUserId(null);
  }

  const filteredUsers = users.filter((user) => {
    const matchesRole = selectedRole === "all" || user.role === selectedRole;
    const matchesStatus = selectedStatus === "all" || user.status === selectedStatus;

    return matchesRole && matchesStatus && matchesSearch(user, search);
  });
  const canEdit = currentUser ? canEditUsers(currentUser.role) : false;

  if (isLoading) {
    return (
      <Card>
        <p className="text-sm font-semibold text-slate-600">Cargando usuarios...</p>
      </Card>
    );
  }

  if (!currentUser) {
    return (
      <Card className="text-center">
        <ShieldAlert className="mx-auto h-10 w-10 text-ulv-blue" aria-hidden="true" />
        <h2 className="mt-3 text-xl font-black text-ulv-blue">Debes iniciar sesión para acceder al panel administrativo.</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">Inicia sesión con una cuenta autorizada para continuar.</p>
        <Link
          href="/login?redirect=/admin/usuarios"
          className="mt-5 inline-flex min-h-12 items-center justify-center rounded-2xl bg-ulv-yellow px-5 py-3 text-sm font-bold text-ulv-blue shadow-sm transition hover:bg-[#e8b800]"
        >
          Iniciar sesión
        </Link>
      </Card>
    );
  }

  if (!canAccessPanel(currentUser.role)) {
    return (
      <Card className="text-center">
        <ShieldAlert className="mx-auto h-10 w-10 text-red-700" aria-hidden="true" />
        <h2 className="mt-3 text-xl font-black text-red-700">No tienes permisos para acceder a esta sección.</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">Esta sección está reservada para personal autorizado de biblioteca.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {feedback ? (
        <p
          className={`rounded-2xl p-4 text-sm font-bold ${
            feedback.type === "success" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"
          }`}
        >
          {feedback.message}
        </p>
      ) : null}

      <Card>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-ulv-yellow text-ulv-blue">
              <Users className="h-6 w-6" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-xl font-black text-ulv-blue">Administración de usuarios</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">Gestiona usuarios, roles y estados de acceso a la app.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void loadData({ showLoading: false })}
            disabled={isRefreshing}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-ulv-yellow px-5 py-3 text-sm font-bold text-ulv-blue shadow-sm transition hover:bg-[#e8b800] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={`h-5 w-5 ${isRefreshing ? "animate-spin" : ""}`} aria-hidden="true" />
            {isRefreshing ? "Actualizando..." : "Refrescar"}
          </button>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <label className="block">
            <span className="text-sm font-bold text-ulv-blue">Buscar usuario</span>
            <span className="relative mt-2 block">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Nombre o correo"
                className="min-h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-ulv-blue focus:ring-4 focus:ring-ulv-blue/10"
              />
            </span>
          </label>

          <label className="block">
            <span className="text-sm font-bold text-ulv-blue">Filtrar por rol</span>
            <select
              value={selectedRole}
              onChange={(event) => setSelectedRole(event.target.value as RoleFilter)}
              className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 outline-none transition focus:border-ulv-blue focus:ring-4 focus:ring-ulv-blue/10"
            >
              <option value="all">Todos</option>
              {roleOptions.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-bold text-ulv-blue">Filtrar por estado</span>
            <select
              value={selectedStatus}
              onChange={(event) => setSelectedStatus(event.target.value as StatusFilter)}
              className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 outline-none transition focus:border-ulv-blue focus:ring-4 focus:ring-ulv-blue/10"
            >
              <option value="all">Todos</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
        </div>
      </Card>

      <Card>
        <div className="mb-5 flex flex-col gap-1">
          <h2 className="text-xl font-black text-ulv-blue">Usuarios registrados</h2>
          <p className="text-sm text-slate-600">{filteredUsers.length} usuarios encontrados.</p>
        </div>

        <div className="space-y-3 md:hidden">
          {filteredUsers.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center text-sm font-semibold text-slate-500">No hay usuarios registrados</div>
          ) : null}
          {filteredUsers.map((user) => {
            const isUpdating = updatingUserId === user.id;
            const canAssignLibraries = canEdit && user.role !== "student" && user.role !== "superadmin";

            return (
              <article key={user.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="break-words text-base font-black text-ulv-blue">{user.name}</h3>
                    <p className="mt-1 break-words text-sm font-semibold text-slate-600">{user.email || "Sin correo"}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${getRoleBadgeClassName(user.role)}`}>{user.role}</span>
                </div>
                <dl className="mt-4 grid grid-cols-1 gap-3 text-sm">
                  <div><dt className="font-bold text-slate-500">Estado</dt><dd><span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${getStatusBadgeClassName(user.status)}`}>{user.status}</span></dd></div>
                  <div><dt className="font-bold text-slate-500">Bibliotecas</dt><dd className="break-words font-black text-slate-900">{getUserLibrariesText(user)}</dd></div>
                </dl>
                <div className="mt-4 rounded-2xl bg-slate-50 p-3">
                  <p className="text-sm font-black text-ulv-blue">Bibliotecas asignadas</p>
                  <div className="mt-3 grid grid-cols-1 gap-2">
                    {libraries.map((library) => (
                      <label key={library.id} className={`flex min-h-11 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold ${!canAssignLibraries ? "opacity-70" : ""}`}>
                        <input type="checkbox" checked={isLibraryAssigned(user.id, library.id)} disabled={!canAssignLibraries || isUpdating} onChange={(event) => void handleLibraryToggle(user, library, event.target.checked)} className="h-4 w-4 accent-ulv-blue" />
                        <span className="min-w-0 break-words">{library.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
                {canEdit ? (
                  <div className="mt-4 grid gap-2">
                    <select value={user.role} onChange={(event) => void handleRoleChange(user.id, event.target.value as AppUserRole)} disabled={isUpdating} className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700">
                      {roleOptions.map((role) => <option key={role} value={role}>{role}</option>)}
                    </select>
                    <select value={user.status} onChange={(event) => void handleStatusChange(user.id, event.target.value as AppUserStatus)} disabled={isUpdating} className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700">
                      {statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}
                    </select>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>

        <div className="hidden rounded-2xl border border-slate-200 md:block">
          <table className="w-full table-fixed border-collapse text-left text-sm">
            <thead className="bg-ulv-blue text-white">
              <tr>
                <th className="px-4 py-3 font-black">Nombre</th>
                <th className="px-4 py-3 font-black">Correo</th>
                <th className="px-4 py-3 font-black">Rol</th>
                <th className="px-4 py-3 font-black">Estado</th>
                <th className="px-4 py-3 font-black">Bibliotecas</th>
                <th className="px-4 py-3 font-black">Creado</th>
                <th className="px-4 py-3 font-black">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center font-semibold text-slate-500">
                    No hay usuarios registrados
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const isUpdating = updatingUserId === user.id;
                  const canAssignLibraries = canEdit && user.role !== "student" && user.role !== "superadmin";

                  return (
                    <tr key={user.id} className="align-top">
                      <td className="break-words px-4 py-3 font-black text-ulv-blue">{user.name}</td>
                      <td className="break-words px-4 py-3 font-semibold text-slate-600">{user.email || "Sin correo"}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${getRoleBadgeClassName(user.role)}`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${getStatusBadgeClassName(user.status)}`}>
                          {user.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="break-words text-sm font-bold text-slate-700">{getUserLibrariesText(user)}</p>
                        {user.role !== "student" && user.role !== "superadmin" ? (
                          <div className="mt-3 grid grid-cols-1 gap-2">
                            {libraries.map((library) => (
                              <label key={library.id} className="flex items-start gap-2 text-xs font-bold text-slate-700">
                                <input type="checkbox" checked={isLibraryAssigned(user.id, library.id)} disabled={!canAssignLibraries || isUpdating} onChange={(event) => void handleLibraryToggle(user, library, event.target.checked)} className="mt-0.5 h-4 w-4 accent-ulv-blue" />
                                <span className="break-words">{library.name}</span>
                              </label>
                            ))}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{formatDate(user.created_at)}</td>
                      <td className="px-4 py-3">
                        {canEdit ? (
                          <div className="grid gap-2 md:grid-cols-2">
                            <label className="block">
                              <span className="sr-only">Cambiar rol</span>
                              <select
                                value={user.role}
                                onChange={(event) => void handleRoleChange(user.id, event.target.value as AppUserRole)}
                                disabled={isUpdating}
                                className="min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none transition focus:border-ulv-blue focus:ring-4 focus:ring-ulv-blue/10 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {roleOptions.map((role) => (
                                  <option key={role} value={role}>
                                    {role}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="block">
                              <span className="sr-only">Cambiar estado</span>
                              <select
                                value={user.status}
                                onChange={(event) => void handleStatusChange(user.id, event.target.value as AppUserStatus)}
                                disabled={isUpdating}
                                className="min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none transition focus:border-ulv-blue focus:ring-4 focus:ring-ulv-blue/10 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {statusOptions.map((status) => (
                                  <option key={status} value={status}>
                                    {status}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>
                        ) : (
                          <p className="text-sm font-semibold text-slate-600">Solo lectura</p>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
