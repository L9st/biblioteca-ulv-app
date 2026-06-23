"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { Building2, Edit3, Eye, ImageIcon, RefreshCw, Search, ShieldAlert } from "lucide-react";
import { getCurrentAppUser, type AdminAppUser, type AppUserRole } from "@/services/admin-users.service";
import {
  createLibrarySpace,
  getAdminLibraries,
  getAdminLibrarySpaces,
  toggleLibrarySpaceStatus,
  updateLibrarySpace,
  type AdminLibrary,
  type AdminLibrarySpace,
  type LibrarySpaceInput,
  type LibrarySpaceStatus,
} from "@/services/admin-spaces.service";
import { Card } from "@/app/ui/Card";
import { StatCard } from "@/app/cards/StatCard";
import { DropdownSelect } from "@/app/ui/DropdownSelect";

type ActiveTab = "summary" | "spaces" | "form";
type StatusFilter = "all" | LibrarySpaceStatus;
type ReservableFilter = "all" | "reservable" | "not_reservable";
type Feedback = { type: "success" | "error"; message: string };
type SpaceFormState = {
  library_id: string;
  name: string;
  slug: string;
  description: string;
  services: string;
  rules: string;
  location_hint: string;
  capacity: string;
  image_url: string;
  is_reservable: boolean;
  status: LibrarySpaceStatus;
};

const emptyForm: SpaceFormState = {
  library_id: "",
  name: "",
  slug: "",
  description: "",
  services: "",
  rules: "",
  location_hint: "",
  capacity: "",
  image_url: "",
  is_reservable: false,
  status: "active",
};

const tabs: Array<{ id: ActiveTab; label: string }> = [
  { id: "summary", label: "Resumen" },
  { id: "spaces", label: "Espacios" },
  { id: "form", label: "Nuevo espacio" },
];

function canAccessSpaces(role: AppUserRole) {
  return role === "librarian" || role === "admin" || role === "superadmin";
}

function generateSlug(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function cleanText(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function buildInput(form: SpaceFormState): LibrarySpaceInput {
  return {
    library_id: form.library_id,
    name: form.name.trim(),
    slug: (form.slug.trim() || generateSlug(form.name)).trim(),
    description: cleanText(form.description),
    services: cleanText(form.services),
    rules: cleanText(form.rules),
    location_hint: cleanText(form.location_hint),
    capacity: form.capacity.trim() ? Number(form.capacity) : null,
    image_url: cleanText(form.image_url),
    is_reservable: form.is_reservable,
    status: form.status,
  };
}

function formFromSpace(space: AdminLibrarySpace): SpaceFormState {
  return {
    library_id: space.library_id,
    name: space.name,
    slug: space.slug,
    description: space.description ?? "",
    services: space.services ?? "",
    rules: space.rules ?? "",
    location_hint: space.location_hint ?? "",
    capacity: space.capacity !== null ? String(space.capacity) : "",
    image_url: space.image_url ?? "",
    is_reservable: space.is_reservable,
    status: space.status,
  };
}

function matchesSearch(space: AdminLibrarySpace, search: string) {
  const cleanSearch = search.trim().toLowerCase();
  if (!cleanSearch) return true;
  return [space.name, space.slug, space.description ?? ""].some((value) => value.toLowerCase().includes(cleanSearch));
}

function getLibrarySpaces(libraryId: string, spaces: AdminLibrarySpace[]) {
  return spaces.filter((space) => space.library_id === libraryId);
}

function getLibraryCoverImage(librarySpaces: AdminLibrarySpace[]) {
  return librarySpaces.find((space) => space.image_url)?.image_url ?? null;
}

export function AdminSpacesPanel() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("summary");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentUser, setCurrentUser] = useState<AdminAppUser | null>(null);
  const [libraries, setLibraries] = useState<AdminLibrary[]>([]);
  const [spaces, setSpaces] = useState<AdminLibrarySpace[]>([]);
  const [libraryFilter, setLibraryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [reservableFilter, setReservableFilter] = useState<ReservableFilter>("all");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<SpaceFormState>(emptyForm);
  const [editingSpaceId, setEditingSpaceId] = useState<string | null>(null);
  const [isSlugTouched, setIsSlugTouched] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  async function loadData({ showLoading = true } = {}) {
    if (showLoading) setIsLoading(true);
    else setIsRefreshing(true);
    setFeedback(null);

    const userResult = await getCurrentAppUser();
    setCurrentUser(userResult.data);

    if (userResult.error) {
      setFeedback({ type: "error", message: userResult.error });
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    if (!userResult.data || !canAccessSpaces(userResult.data.role)) {
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    const [librariesResult, spacesResult] = await Promise.all([getAdminLibraries(), getAdminLibrarySpaces()]);
    setLibraries(librariesResult.data);
    setSpaces(spacesResult.data);
    setForm((current) => ({ ...current, library_id: current.library_id || librariesResult.data[0]?.id || "" }));

    if (librariesResult.error || spacesResult.error) {
      setFeedback({ type: "error", message: librariesResult.error ?? spacesResult.error ?? "No se pudieron cargar los espacios." });
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

  function resetForm() {
    setForm({ ...emptyForm, library_id: libraries[0]?.id || "" });
    setEditingSpaceId(null);
    setIsSlugTouched(false);
  }

  function updateName(name: string) {
    setForm((current) => ({ ...current, name, slug: isSlugTouched ? current.slug : generateSlug(name) }));
  }

  function editSpace(space: AdminLibrarySpace) {
    setForm(formFromSpace(space));
    setEditingSpaceId(space.id);
    setIsSlugTouched(true);
    setActiveTab("form");
    setFeedback(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = buildInput(form);

    if (!input.library_id) {
      setFeedback({ type: "error", message: "Selecciona una biblioteca." });
      return;
    }

    if (!input.name) {
      setFeedback({ type: "error", message: "El nombre del espacio es obligatorio." });
      return;
    }

    if (!input.slug) {
      setFeedback({ type: "error", message: "El slug es obligatorio." });
      return;
    }

    if (form.capacity.trim() && Number.isNaN(input.capacity)) {
      setFeedback({ type: "error", message: "La capacidad debe ser un número válido." });
      return;
    }

    setIsSubmitting(true);
    const result = editingSpaceId ? await updateLibrarySpace(editingSpaceId, input) : await createLibrarySpace(input);

    if (result.error || !result.data) {
      setFeedback({ type: "error", message: result.error ?? "No se pudo guardar el espacio." });
      setIsSubmitting(false);
      return;
    }

    const savedSpace = result.data;
    setSpaces((current) => {
      if (editingSpaceId) {
        return current.map((space) => (space.id === editingSpaceId ? savedSpace : space));
      }
      return [savedSpace, ...current];
    });
    setFeedback({ type: "success", message: editingSpaceId ? "Espacio actualizado correctamente" : "Espacio creado correctamente" });
    resetForm();
    setActiveTab("spaces");
    setIsSubmitting(false);
  }

  async function handleToggleStatus(space: AdminLibrarySpace) {
    const nextStatus: LibrarySpaceStatus = space.status === "active" ? "inactive" : "active";
    const result = await toggleLibrarySpaceStatus(space.id, nextStatus);

    if (result.error || !result.data) {
      setFeedback({ type: "error", message: result.error ?? "No se pudo cambiar el estado del espacio." });
      return;
    }

    const updatedSpace = result.data;
    setSpaces((current) => current.map((item) => (item.id === space.id ? updatedSpace : item)));
    setFeedback({ type: "success", message: "Espacio actualizado correctamente" });
  }

  const filteredSpaces = spaces.filter((space) => {
    const matchesLibrary = libraryFilter === "all" || space.library_id === libraryFilter;
    const matchesStatus = statusFilter === "all" || space.status === statusFilter;
    const matchesReservable =
      reservableFilter === "all" ||
      (reservableFilter === "reservable" && space.is_reservable) ||
      (reservableFilter === "not_reservable" && !space.is_reservable);
    return matchesLibrary && matchesStatus && matchesReservable && matchesSearch(space, search);
  });

  if (isLoading) {
    return (
      <Card>
        <p className="text-sm font-semibold text-slate-600">Cargando espacios...</p>
      </Card>
    );
  }

  if (!currentUser) {
    return (
      <Card className="text-center">
        <ShieldAlert className="mx-auto h-10 w-10 text-ulv-blue" aria-hidden="true" />
        <h2 className="mt-3 text-xl font-black text-ulv-blue">Debes iniciar sesión para acceder al panel administrativo.</h2>
        <Link href="/login?redirect=/admin/espacios" className="mt-5 inline-flex min-h-12 items-center justify-center rounded-2xl bg-ulv-yellow px-5 py-3 text-sm font-bold text-ulv-blue shadow-sm transition hover:bg-[#e8b800]">
          Iniciar sesión
        </Link>
      </Card>
    );
  }

  if (!canAccessSpaces(currentUser.role)) {
    return (
      <Card className="text-center">
        <ShieldAlert className="mx-auto h-10 w-10 text-red-700" aria-hidden="true" />
        <h2 className="mt-3 text-xl font-black text-red-700">No tienes permisos para acceder a esta sección.</h2>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {feedback ? <p className={`rounded-2xl p-4 text-sm font-bold ${feedback.type === "success" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>{feedback.message}</p> : null}

      <Card className="p-3">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {tabs.map((tab) => (
            <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={`min-h-11 shrink-0 rounded-2xl px-4 py-2 text-sm font-black transition ${activeTab === tab.id ? "bg-ulv-yellow text-ulv-blue shadow-sm" : "border border-slate-200 bg-white text-ulv-blue hover:bg-ulv-yellow/10"}`}>
              {tab.label}
            </button>
          ))}
        </div>
      </Card>

      {activeTab === "summary" ? (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Total de espacios" value={String(spaces.length)} detail="Registrados" />
            <StatCard label="Espacios activos" value={String(spaces.filter((space) => space.status === "active").length)} detail="Visibles al público" />
            <StatCard label="Espacios inactivos" value={String(spaces.filter((space) => space.status === "inactive").length)} detail="Ocultos al público" />
            <StatCard label="Espacios reservables" value={String(spaces.filter((space) => space.is_reservable).length)} detail="Disponibles para reserva" />
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            {libraries.map((library) => {
              const librarySpaces = getLibrarySpaces(library.id, spaces);
              const coverImage = getLibraryCoverImage(librarySpaces);
              const activeCount = librarySpaces.filter((space) => space.status === "active").length;
              const reservableCount = librarySpaces.filter((space) => space.is_reservable).length;

              return (
                <article key={library.id} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                  <div className="relative flex min-h-44 items-center justify-center overflow-hidden bg-ulv-blue">
                    {coverImage ? (
                      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${coverImage})` }} aria-hidden="true" />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-ulv-blue via-[#0b5f93] to-[#053757]" aria-hidden="true" />
                    )}
                    <div className="absolute inset-0 bg-ulv-blue/55" aria-hidden="true" />
                    <div className="relative p-5 text-center text-white">
                      <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-ulv-yellow text-ulv-blue shadow-sm">
                        {coverImage ? <ImageIcon className="h-8 w-8" aria-hidden="true" /> : <Building2 className="h-8 w-8" aria-hidden="true" />}
                      </span>
                      <h3 className="mt-4 text-2xl font-black leading-tight">{library.name}</h3>
                      <p className="mt-1 text-xs font-black uppercase tracking-wide text-ulv-yellow">{library.code}</p>
                      <p className="mx-auto mt-4 max-w-xs text-sm font-semibold leading-6 text-white/90">
                        {library.description ?? "Consulta y administra los espacios disponibles para servicios bibliotecarios."}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 p-5 text-center">
                    <Link href="/espacios" className="rounded-2xl bg-slate-50 p-3 transition hover:bg-slate-100">
                      <p className="text-2xl font-black text-ulv-blue">{librarySpaces.length}</p>
                      <p className="mt-1 text-xs font-bold text-slate-500">Espacios</p>
                    </Link>
                    <Link href="/espacios" className="rounded-2xl bg-green-50 p-3 transition hover:bg-green-100">
                      <p className="text-2xl font-black text-green-800">{activeCount}</p>
                      <p className="mt-1 text-xs font-bold text-green-800/75">Activos</p>
                    </Link>
                    <Link href="/espacios" className="rounded-2xl bg-ulv-yellow/25 p-3 transition hover:bg-ulv-yellow/40">
                      <p className="text-2xl font-black text-ulv-blue">{reservableCount}</p>
                      <p className="mt-1 text-xs font-bold text-ulv-blue/75">Reservables</p>
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      ) : null}

      {activeTab === "spaces" ? (
        <div className="space-y-5">
          <Card>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-black text-ulv-blue">Espacios</h2>
                <p className="mt-1 text-sm text-slate-600">Administra espacios activos e inactivos.</p>
              </div>
              <button type="button" onClick={() => void loadData({ showLoading: false })} disabled={isRefreshing} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-ulv-yellow px-5 py-3 text-sm font-bold text-ulv-blue shadow-sm transition hover:bg-[#e8b800] disabled:cursor-not-allowed disabled:opacity-60">
                <RefreshCw className={`h-5 w-5 ${isRefreshing ? "animate-spin" : ""}`} aria-hidden="true" />
                Refrescar
              </button>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5"><DropdownSelect label="Filtrar por biblioteca" options={[{ label: "Todas las bibliotecas", value: "all" }, ...libraries.map((library) => ({ label: library.name, value: library.id }))]} value={libraryFilter} onChange={setLibraryFilter} emptyLabel="Todas las bibliotecas" /></div>
              <label className="block"><span className="text-sm font-bold text-ulv-blue">Estado</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)} className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 outline-none focus:border-ulv-blue focus:ring-4 focus:ring-ulv-blue/10"><option value="all">Todos</option><option value="active">Activo</option><option value="inactive">Inactivo</option></select></label>
              <label className="block"><span className="text-sm font-bold text-ulv-blue">Reservable</span><select value={reservableFilter} onChange={(event) => setReservableFilter(event.target.value as ReservableFilter)} className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 outline-none focus:border-ulv-blue focus:ring-4 focus:ring-ulv-blue/10"><option value="all">Todos</option><option value="reservable">Reservables</option><option value="not_reservable">No reservables</option></select></label>
              <label className="block"><span className="text-sm font-bold text-ulv-blue">Buscar espacio</span><span className="relative mt-2 block"><Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nombre, slug o descripción" className="min-h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-sm font-semibold text-slate-700 outline-none focus:border-ulv-blue focus:ring-4 focus:ring-ulv-blue/10" /></span></label>
            </div>
          </Card>
          <Card>
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="min-w-[920px] w-full border-collapse text-left text-sm">
                <thead className="bg-ulv-blue text-white"><tr><th className="px-4 py-3 font-black">Nombre</th><th className="px-4 py-3 font-black">Biblioteca</th><th className="px-4 py-3 font-black">Slug</th><th className="px-4 py-3 font-black">Capacidad</th><th className="px-4 py-3 font-black">Reservable</th><th className="px-4 py-3 font-black">Estado</th><th className="px-4 py-3 font-black">Acciones</th></tr></thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {filteredSpaces.length === 0 ? <tr><td colSpan={7} className="px-4 py-8 text-center font-semibold text-slate-500">No hay espacios registrados.</td></tr> : filteredSpaces.map((space) => (
                    <tr key={space.id} className="align-top"><td className="px-4 py-3 font-black text-ulv-blue">{space.name}</td><td className="px-4 py-3 font-semibold text-slate-700">{space.libraries?.name ?? "No asignada"}</td><td className="px-4 py-3 font-semibold text-slate-600">{space.slug}</td><td className="px-4 py-3 text-slate-700">{space.capacity ?? "No registrada"}</td><td className="px-4 py-3"><span className={`rounded-full px-3 py-1 text-xs font-black ${space.is_reservable ? "bg-ulv-yellow text-ulv-blue" : "bg-slate-100 text-slate-700"}`}>{space.is_reservable ? "Reservable" : "No reservable"}</span></td><td className="px-4 py-3"><span className={`rounded-full px-3 py-1 text-xs font-black ${space.status === "active" ? "bg-green-50 text-green-800" : "bg-slate-100 text-slate-700"}`}>{space.status === "active" ? "Activo" : "Inactivo"}</span></td><td className="px-4 py-3"><div className="flex flex-wrap gap-2"><button type="button" onClick={() => editSpace(space)} className="inline-flex min-h-10 items-center gap-1 rounded-xl bg-ulv-yellow px-3 text-xs font-black text-ulv-blue"><Edit3 className="h-4 w-4" aria-hidden="true" />Editar</button><button type="button" onClick={() => void handleToggleStatus(space)} className="inline-flex min-h-10 items-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-ulv-blue">{space.status === "active" ? "Desactivar" : "Activar"}</button><Link href={`/espacios/${space.slug}`} className="inline-flex min-h-10 items-center gap-1 rounded-xl bg-ulv-blue px-3 text-xs font-black text-white"><Eye className="h-4 w-4" aria-hidden="true" />Ver público</Link></div></td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      ) : null}

      {activeTab === "form" ? (
        <Card>
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><h2 className="text-xl font-black text-ulv-blue">{editingSpaceId ? "Editar espacio" : "Nuevo espacio"}</h2><p className="mt-1 text-sm text-slate-600">Administración de espacios. Gestiona los espacios de las bibliotecas ULV.</p></div>{editingSpaceId ? <button type="button" onClick={resetForm} className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-ulv-blue">Cancelar edición</button> : null}</div>
          <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5"><DropdownSelect label="Biblioteca" options={libraries.map((library) => ({ label: library.name, value: library.id }))} value={form.library_id} onChange={(value) => setForm((current) => ({ ...current, library_id: value }))} emptyLabel="Selecciona una biblioteca" /></div>
            <label className="block"><span className="text-sm font-bold text-ulv-blue">Nombre del espacio</span><input required value={form.name} onChange={(event) => updateName(event.target.value)} className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none focus:border-ulv-blue focus:ring-4 focus:ring-ulv-blue/10" /></label>
            <label className="block"><span className="text-sm font-bold text-ulv-blue">Slug</span><input required value={form.slug} onChange={(event) => { setIsSlugTouched(true); setForm((current) => ({ ...current, slug: generateSlug(event.target.value) })); }} className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none focus:border-ulv-blue focus:ring-4 focus:ring-ulv-blue/10" /><span className="mt-1 block text-xs font-semibold text-slate-500">Ejemplo recomendado: sala-de-lectura-sara-e-ocampo</span></label>
            <label className="block"><span className="text-sm font-bold text-ulv-blue">Capacidad</span><input type="number" min="0" value={form.capacity} onChange={(event) => setForm((current) => ({ ...current, capacity: event.target.value }))} className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none focus:border-ulv-blue focus:ring-4 focus:ring-ulv-blue/10" /></label>
            <label className="block md:col-span-2"><span className="text-sm font-bold text-ulv-blue">Descripción</span><textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} className="mt-2 min-h-28 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-ulv-blue focus:ring-4 focus:ring-ulv-blue/10" /></label>
            <label className="block"><span className="text-sm font-bold text-ulv-blue">Servicios</span><textarea value={form.services} onChange={(event) => setForm((current) => ({ ...current, services: event.target.value }))} className="mt-2 min-h-28 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-ulv-blue focus:ring-4 focus:ring-ulv-blue/10" /></label>
            <label className="block"><span className="text-sm font-bold text-ulv-blue">Normas</span><textarea value={form.rules} onChange={(event) => setForm((current) => ({ ...current, rules: event.target.value }))} className="mt-2 min-h-28 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-ulv-blue focus:ring-4 focus:ring-ulv-blue/10" /></label>
            <label className="block"><span className="text-sm font-bold text-ulv-blue">Ubicación interna</span><input value={form.location_hint} onChange={(event) => setForm((current) => ({ ...current, location_hint: event.target.value }))} className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none focus:border-ulv-blue focus:ring-4 focus:ring-ulv-blue/10" /></label>
            <label className="block"><span className="text-sm font-bold text-ulv-blue">URL de imagen</span><input value={form.image_url} onChange={(event) => setForm((current) => ({ ...current, image_url: event.target.value }))} className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none focus:border-ulv-blue focus:ring-4 focus:ring-ulv-blue/10" /></label>
            <label className="block"><span className="text-sm font-bold text-ulv-blue">Estado</span><select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as LibrarySpaceStatus }))} className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 outline-none focus:border-ulv-blue focus:ring-4 focus:ring-ulv-blue/10"><option value="active">active</option><option value="inactive">inactive</option></select></label>
            <label className="flex min-h-12 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4"><input type="checkbox" checked={form.is_reservable} onChange={(event) => setForm((current) => ({ ...current, is_reservable: event.target.checked }))} className="h-5 w-5 accent-[#fac600]" /><span className="text-sm font-bold text-ulv-blue">Reservable</span></label>
            <div className="md:col-span-2"><button type="submit" disabled={isSubmitting} className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-ulv-yellow px-5 py-3 text-sm font-bold text-ulv-blue shadow-sm transition hover:bg-[#e8b800] disabled:cursor-not-allowed disabled:opacity-60">{isSubmitting ? "Guardando..." : "Guardar espacio"}</button></div>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
