"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { Edit3, Eye, FileText, RefreshCw, Search, ShieldAlert, ToggleLeft, ToggleRight } from "lucide-react";
import { Card } from "@/app/ui/Card";
import { DropdownSelect } from "@/app/ui/DropdownSelect";
import { StatCard } from "@/app/cards/StatCard";
import { getCurrentAppUser, type AdminAppUser, type AppUserRole } from "@/services/admin-users.service";
import {
  createLibraryService,
  getAdminLibrariesForServices,
  getAdminLibraryServices,
  toggleLibraryServiceStatus,
  updateLibraryService,
  type AdminLibraryForServices,
  type AdminLibraryService,
  type LibraryServiceInput,
} from "@/services/admin-library-services.service";
import {
  libraryServiceAudienceLabels,
  libraryServiceCategoryLabels,
  libraryServiceStatusLabels,
  type LibraryServiceAudience,
  type LibraryServiceCategory,
  type LibraryServiceStatus,
} from "@/services/library-services.service";
import { getLibraryAccessContext, noAssignedLibrariesMessage, type LibraryAccessContext } from "@/services/library-access.service";

type ActiveTab = "summary" | "services" | "form";
type CategoryFilter = "all" | LibraryServiceCategory;
type StatusFilter = "all" | LibraryServiceStatus;
type Feedback = { type: "success" | "error"; message: string };
type FormState = {
  library_id: string;
  title: string;
  slug: string;
  summary: string;
  description: string;
  category: LibraryServiceCategory;
  audience: LibraryServiceAudience;
  requirements: string;
  schedule: string;
  contact_info: string;
  image_url: string;
  status: LibraryServiceStatus;
};

const tabs: Array<{ id: ActiveTab; label: string }> = [
  { id: "summary", label: "Resumen" },
  { id: "services", label: "Servicios" },
  { id: "form", label: "Nuevo servicio" },
];

const emptyForm: FormState = {
  library_id: "all",
  title: "",
  slug: "",
  summary: "",
  description: "",
  category: "general",
  audience: "all",
  requirements: "",
  schedule: "",
  contact_info: "",
  image_url: "",
  status: "active",
};

function canManageServices(role: AppUserRole) {
  return role === "librarian" || role === "admin" || role === "superadmin";
}

function cleanText(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function generateSlug(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" }).format(new Date(value));
}

function buildInput(form: FormState): LibraryServiceInput {
  return {
    library_id: form.library_id === "all" ? null : form.library_id,
    title: form.title.trim(),
    slug: form.slug.trim(),
    summary: cleanText(form.summary),
    description: form.description.trim(),
    category: form.category,
    audience: form.audience,
    requirements: cleanText(form.requirements),
    schedule: cleanText(form.schedule),
    contact_info: cleanText(form.contact_info),
    image_url: cleanText(form.image_url),
    status: form.status,
  };
}

function formFromService(service: AdminLibraryService): FormState {
  return {
    library_id: service.library_id ?? "all",
    title: service.title,
    slug: service.slug,
    summary: service.summary ?? "",
    description: service.description,
    category: service.category,
    audience: service.audience,
    requirements: service.requirements ?? "",
    schedule: service.schedule ?? "",
    contact_info: service.contact_info ?? "",
    image_url: service.image_url ?? "",
    status: service.status,
  };
}

function matchesSearch(service: AdminLibraryService, search: string) {
  const term = search.trim().toLowerCase();
  if (!term) return true;
  return [service.title, service.summary ?? "", service.description].some((value) => value.toLowerCase().includes(term));
}

export function AdminLibraryServicesPanel() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("summary");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentUser, setCurrentUser] = useState<AdminAppUser | null>(null);
  const [accessContext, setAccessContext] = useState<LibraryAccessContext | null>(null);
  const [libraries, setLibraries] = useState<AdminLibraryForServices[]>([]);
  const [services, setServices] = useState<AdminLibraryService[]>([]);
  const [libraryFilter, setLibraryFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSlugTouched, setIsSlugTouched] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  async function loadData({ showLoading = true } = {}) {
    if (showLoading) setIsLoading(true);
    else setIsRefreshing(true);
    setFeedback(null);

    const userResult = await getCurrentAppUser();
    setCurrentUser(userResult.data);
    if (userResult.error || !userResult.data || !canManageServices(userResult.data.role)) {
      if (userResult.error) setFeedback({ type: "error", message: userResult.error });
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    const [librariesResult, servicesResult, context] = await Promise.all([getAdminLibrariesForServices(), getAdminLibraryServices(), getLibraryAccessContext()]);
    setAccessContext(context);
    setLibraries(librariesResult.data);
    setServices(servicesResult.data);
    if (!context.canAccessAll && librariesResult.data.length > 0) setForm((current) => ({ ...current, library_id: current.library_id === "all" ? librariesResult.data[0].id : current.library_id }));
    if (librariesResult.error || servicesResult.error) setFeedback({ type: "error", message: librariesResult.error ?? servicesResult.error ?? "No se pudieron cargar los servicios." });
    setIsLoading(false);
    setIsRefreshing(false);
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => { void loadData(); }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  const filteredServices = services.filter((service) => {
    const libraryMatches = libraryFilter === "all" || (libraryFilter === "general" ? service.library_id === null : service.library_id === libraryFilter);
    const categoryMatches = categoryFilter === "all" || service.category === categoryFilter;
    const statusMatches = statusFilter === "all" || service.status === statusFilter;
    return libraryMatches && categoryMatches && statusMatches && matchesSearch(service, search);
  });

  const summary = useMemo(() => ({
    total: services.length,
    active: services.filter((service) => service.status === "active").length,
    inactive: services.filter((service) => service.status === "inactive").length,
    general: services.filter((service) => service.library_id === null).length,
  }), [services]);
  const canUseGeneralServices = accessContext?.canAccessAll ?? false;

  function resetForm() {
    setForm({ ...emptyForm, library_id: canUseGeneralServices ? "all" : libraries[0]?.id ?? "" });
    setEditingId(null);
    setIsSlugTouched(false);
    setActiveTab("form");
  }

  function updateTitle(title: string) {
    setForm((current) => ({ ...current, title, slug: isSlugTouched ? current.slug : generateSlug(title) }));
  }

  function editService(service: AdminLibraryService) {
    setForm(formFromService(service));
    setEditingId(service.id);
    setIsSlugTouched(true);
    setFeedback(null);
    setActiveTab("form");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = buildInput(form);
    if (!input.title) { setFeedback({ type: "error", message: "El título es obligatorio." }); return; }
    if (!input.slug) { setFeedback({ type: "error", message: "El slug es obligatorio." }); return; }
    if (!input.description) { setFeedback({ type: "error", message: "La descripción es obligatoria." }); return; }
    setIsSubmitting(true);
    const result = editingId ? await updateLibraryService(editingId, input) : await createLibraryService(input);
    if (result.error) setFeedback({ type: "error", message: result.error });
    else {
      setFeedback({ type: "success", message: editingId ? "Servicio actualizado correctamente" : "Servicio creado correctamente" });
      setForm(emptyForm);
      setEditingId(null);
      setIsSlugTouched(false);
      setActiveTab("services");
      await loadData({ showLoading: false });
    }
    setIsSubmitting(false);
  }

  async function changeStatus(serviceId: string, status: LibraryServiceStatus) {
    const result = await toggleLibraryServiceStatus(serviceId, status);
    if (result.error) setFeedback({ type: "error", message: result.error });
    else { setFeedback({ type: "success", message: "Servicio actualizado correctamente" }); await loadData({ showLoading: false }); }
  }

  if (isLoading) return <Card><p className="text-sm font-semibold text-slate-600">Cargando administración de servicios...</p></Card>;
  if (!currentUser) return <Card className="text-center"><ShieldAlert className="mx-auto h-10 w-10 text-ulv-blue" aria-hidden="true" /><h2 className="mt-3 text-xl font-black text-ulv-blue">Debes iniciar sesión para acceder al panel administrativo.</h2><Link href="/login?redirect=/admin/servicios" className="mt-5 inline-flex min-h-12 items-center justify-center rounded-2xl bg-ulv-yellow px-5 py-3 text-sm font-black text-ulv-blue">Iniciar sesión</Link></Card>;
  if (!canManageServices(currentUser.role)) return <Card className="text-center"><ShieldAlert className="mx-auto h-10 w-10 text-red-700" aria-hidden="true" /><h2 className="mt-3 text-xl font-black text-red-700">No tienes permisos para acceder a esta sección.</h2></Card>;

  return (
    <div className="space-y-5">
      {feedback ? <p className={`rounded-2xl p-4 text-sm font-bold ${feedback.type === "success" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>{feedback.message}</p> : null}
      {accessContext ? noAssignedLibrariesMessage(accessContext) ? <p className="rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-800">{noAssignedLibrariesMessage(accessContext)}</p> : null : null}
      <section className="rounded-3xl border border-ulv-blue bg-ulv-blue p-5 text-white shadow-sm"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-sm font-bold text-ulv-yellow">Administración de servicios</p><h1 className="mt-2 text-3xl font-black">Servicios de biblioteca</h1><p className="mt-2 text-sm leading-6 text-white/85">Administra servicios como préstamos, orientación, capacitación y apoyo al usuario.</p></div><button type="button" onClick={() => void loadData({ showLoading: false })} disabled={isRefreshing} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-white/25 px-4 text-sm font-bold text-white transition hover:bg-white/10 disabled:opacity-60"><RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} aria-hidden="true" />Refrescar</button></div></section>
      <Card className="p-3"><div className="flex gap-2 overflow-x-auto pb-1">{tabs.map((tab) => <button key={tab.id} type="button" onClick={() => (tab.id === "form" ? resetForm() : setActiveTab(tab.id))} className={`min-h-11 shrink-0 rounded-2xl px-4 py-2 text-sm font-black ${activeTab === tab.id ? "bg-ulv-yellow text-ulv-blue" : "border border-slate-200 bg-white text-ulv-blue"}`}>{tab.label}</button>)}</div></Card>

      {activeTab === "summary" ? <section className="space-y-5"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Total de servicios" value={`${summary.total}`} detail="Activos e inactivos" /><StatCard label="Servicios activos" value={`${summary.active}`} detail="Visibles al público" /><StatCard label="Servicios inactivos" value={`${summary.inactive}`} detail="Ocultos del público" /><StatCard label="Servicios generales" value={`${summary.general}`} detail="Aplican a todas las bibliotecas" /></div><Card><h2 className="text-lg font-black text-ulv-blue">Servicios por biblioteca</h2><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><div className="rounded-2xl bg-slate-50 p-4"><p className="text-sm font-bold text-slate-500">Todas las bibliotecas</p><p className="mt-2 text-2xl font-black text-ulv-blue">{summary.general}</p></div>{libraries.map((library) => <div key={library.id} className="rounded-2xl bg-slate-50 p-4"><p className="text-sm font-bold text-slate-500">{library.name}</p><p className="mt-2 text-2xl font-black text-ulv-blue">{services.filter((service) => service.library_id === library.id).length}</p></div>)}</div></Card><Card><h2 className="text-lg font-black text-ulv-blue">Servicios por categoría</h2><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Object.entries(libraryServiceCategoryLabels).map(([category, label]) => <div key={category} className="rounded-2xl bg-slate-50 p-4"><p className="text-sm font-bold text-slate-500">{label}</p><p className="mt-2 text-2xl font-black text-ulv-blue">{services.filter((service) => service.category === category).length}</p></div>)}</div></Card></section> : null}

      {activeTab === "services" ? <section className="space-y-5"><Card><div className="grid gap-4 md:grid-cols-4"><div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5"><DropdownSelect label="Biblioteca" options={[{ label: "Todas las bibliotecas", value: "all" }, { label: "Servicios generales", value: "general" }, ...libraries.map((library) => ({ label: library.name, value: library.id }))]} value={libraryFilter} onChange={setLibraryFilter} /></div><div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5"><DropdownSelect label="Categoría" options={[{ label: "Todas", value: "all" }, ...Object.entries(libraryServiceCategoryLabels).map(([value, label]) => ({ value, label }))]} value={categoryFilter} onChange={(value) => setCategoryFilter(value as CategoryFilter)} /></div><div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5"><DropdownSelect label="Estado" options={[{ label: "Todos", value: "all" }, { label: libraryServiceStatusLabels.active, value: "active" }, { label: libraryServiceStatusLabels.inactive, value: "inactive" }]} value={statusFilter} onChange={(value) => setStatusFilter(value as StatusFilter)} /></div><label><span className="text-sm font-bold text-ulv-blue">Búsqueda</span><span className="mt-2 flex min-h-12 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4"><Search className="h-4 w-4 text-slate-400" aria-hidden="true" /><input value={search} onChange={(event) => setSearch(event.target.value)} className="w-full bg-transparent text-sm font-semibold outline-none" placeholder="Título o descripción" /></span></label></div></Card><Card><div className="overflow-x-auto rounded-2xl border border-slate-200"><table className="w-full min-w-[980px] text-left text-sm"><thead className="bg-ulv-blue text-white"><tr><th className="px-4 py-3">Título</th><th className="px-4 py-3">Biblioteca</th><th className="px-4 py-3">Categoría</th><th className="px-4 py-3">Audiencia</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3">Fecha</th><th className="px-4 py-3">Acciones</th></tr></thead><tbody className="divide-y divide-slate-200 bg-white">{filteredServices.length === 0 ? <tr><td colSpan={7} className="px-4 py-8 text-center font-semibold text-slate-500">No hay servicios con esos filtros.</td></tr> : filteredServices.map((service) => <tr key={service.id}><td className="px-4 py-3"><p className="font-black text-ulv-blue">{service.title}</p><p className="mt-1 line-clamp-2 text-xs text-slate-500">{service.summary ?? service.description}</p></td><td className="px-4 py-3">{service.libraries?.name ?? "Todas las bibliotecas"}</td><td className="px-4 py-3">{libraryServiceCategoryLabels[service.category]}</td><td className="px-4 py-3">{libraryServiceAudienceLabels[service.audience]}</td><td className="px-4 py-3 font-bold">{libraryServiceStatusLabels[service.status]}</td><td className="px-4 py-3">{formatDate(service.created_at)}</td><td className="px-4 py-3"><div className="flex flex-wrap gap-2"><button type="button" onClick={() => editService(service)} className="rounded-xl bg-ulv-yellow px-3 py-2 text-xs font-black text-ulv-blue"><Edit3 className="mr-1 inline h-3 w-3" aria-hidden="true" />Editar</button><button type="button" onClick={() => void changeStatus(service.id, "active")} className="rounded-xl border border-green-200 px-3 py-2 text-xs font-black text-green-700"><ToggleRight className="mr-1 inline h-3 w-3" aria-hidden="true" />Activar</button><button type="button" onClick={() => void changeStatus(service.id, "inactive")} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-700"><ToggleLeft className="mr-1 inline h-3 w-3" aria-hidden="true" />Desactivar</button>{service.status === "active" ? <Link href={`/servicios/${service.slug}`} className="rounded-xl border border-ulv-blue/20 px-3 py-2 text-xs font-black text-ulv-blue"><Eye className="mr-1 inline h-3 w-3" aria-hidden="true" />Ver público</Link> : null}</div></td></tr>)}</tbody></table></div></Card></section> : null}

      {activeTab === "form" ? <Card><div className="mb-5 flex items-start gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-ulv-yellow text-ulv-blue"><FileText className="h-5 w-5" aria-hidden="true" /></span><div><h2 className="text-xl font-black text-ulv-blue">{editingId ? "Editar servicio" : "Nuevo servicio"}</h2><p className="mt-1 text-sm text-slate-600">El servicio puede aplicar a todas las bibliotecas o a una biblioteca específica.</p></div></div><form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2"><div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5"><DropdownSelect label="Biblioteca" options={[{ label: "Todas las bibliotecas", value: "all" }, ...libraries.map((library) => ({ label: library.name, value: library.id }))]} value={form.library_id} onChange={(value) => setForm((current) => ({ ...current, library_id: value }))} /></div><label><span className="text-sm font-bold text-ulv-blue">Título</span><input required value={form.title} onChange={(event) => updateTitle(event.target.value)} className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-semibold outline-none focus:border-ulv-blue focus:ring-4 focus:ring-ulv-blue/10" /></label><label><span className="text-sm font-bold text-ulv-blue">Slug</span><input required value={form.slug} onChange={(event) => { setIsSlugTouched(true); setForm((current) => ({ ...current, slug: generateSlug(event.target.value) })); }} className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-semibold outline-none focus:border-ulv-blue focus:ring-4 focus:ring-ulv-blue/10" /></label><label><span className="text-sm font-bold text-ulv-blue">Resumen</span><input value={form.summary} onChange={(event) => setForm((current) => ({ ...current, summary: event.target.value }))} className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-semibold outline-none focus:border-ulv-blue focus:ring-4 focus:ring-ulv-blue/10" /></label><label className="md:col-span-2"><span className="text-sm font-bold text-ulv-blue">Descripción</span><textarea required value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} className="mt-2 min-h-32 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-ulv-blue focus:ring-4 focus:ring-ulv-blue/10" /></label><div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5"><DropdownSelect label="Categoría" options={Object.entries(libraryServiceCategoryLabels).map(([value, label]) => ({ value, label }))} value={form.category} onChange={(value) => setForm((current) => ({ ...current, category: value as LibraryServiceCategory }))} /></div><div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5"><DropdownSelect label="Audiencia" options={Object.entries(libraryServiceAudienceLabels).map(([value, label]) => ({ value, label }))} value={form.audience} onChange={(value) => setForm((current) => ({ ...current, audience: value as LibraryServiceAudience }))} /></div><label><span className="text-sm font-bold text-ulv-blue">Requisitos</span><textarea value={form.requirements} onChange={(event) => setForm((current) => ({ ...current, requirements: event.target.value }))} className="mt-2 min-h-24 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-ulv-blue focus:ring-4 focus:ring-ulv-blue/10" /></label><label><span className="text-sm font-bold text-ulv-blue">Horario</span><textarea value={form.schedule} onChange={(event) => setForm((current) => ({ ...current, schedule: event.target.value }))} className="mt-2 min-h-24 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-ulv-blue focus:ring-4 focus:ring-ulv-blue/10" /></label><label><span className="text-sm font-bold text-ulv-blue">Contacto</span><input value={form.contact_info} onChange={(event) => setForm((current) => ({ ...current, contact_info: event.target.value }))} className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-semibold outline-none focus:border-ulv-blue focus:ring-4 focus:ring-ulv-blue/10" /></label><label><span className="text-sm font-bold text-ulv-blue">URL de imagen</span><input value={form.image_url} onChange={(event) => setForm((current) => ({ ...current, image_url: event.target.value }))} className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-semibold outline-none focus:border-ulv-blue focus:ring-4 focus:ring-ulv-blue/10" /></label><div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5"><DropdownSelect label="Estado" options={[{ label: libraryServiceStatusLabels.active, value: "active" }, { label: libraryServiceStatusLabels.inactive, value: "inactive" }]} value={form.status} onChange={(value) => setForm((current) => ({ ...current, status: value as LibraryServiceStatus }))} /></div><div className="md:col-span-2"><button disabled={isSubmitting} className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-ulv-yellow px-5 py-3 text-sm font-black text-ulv-blue shadow-sm disabled:opacity-60 sm:w-auto">{isSubmitting ? "Guardando..." : "Guardar servicio"}</button></div></form></Card> : null}
    </div>
  );
}
