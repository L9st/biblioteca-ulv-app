"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { Archive, Edit3, Eye, FileText, RefreshCw, Search, Send, ShieldAlert } from "lucide-react";
import { Card } from "@/app/ui/Card";
import { DropdownSelect } from "@/app/ui/DropdownSelect";
import { StatCard } from "@/app/cards/StatCard";
import { getCurrentAppUser, type AdminAppUser, type AppUserRole } from "@/services/admin-users.service";
import {
  createAnnouncement,
  getAdminAnnouncementLibraries,
  getAdminAnnouncements,
  toggleAnnouncementStatus,
  updateAnnouncement,
  type AdminAnnouncement,
  type AdminAnnouncementLibrary,
  type AnnouncementInput,
} from "@/services/admin-announcements.service";
import {
  announcementAudienceLabels,
  announcementStatusLabels,
  announcementTypeLabels,
  type AnnouncementAudience,
  type AnnouncementStatus,
  type AnnouncementType,
} from "@/services/announcements.service";
import { getLibraryAccessContext, noAssignedLibrariesMessage, type LibraryAccessContext } from "@/services/library-access.service";

type ActiveTab = "summary" | "announcements" | "form";
type FilterStatus = "all" | AnnouncementStatus;
type FilterType = "all" | AnnouncementType;
type Feedback = { type: "success" | "error"; message: string };
type FormState = {
  library_id: string;
  title: string;
  summary: string;
  content: string;
  type: AnnouncementType;
  audience: AnnouncementAudience;
  status: AnnouncementStatus;
  starts_at: string;
  ends_at: string;
};

const tabs: Array<{ id: ActiveTab; label: string }> = [
  { id: "summary", label: "Resumen" },
  { id: "announcements", label: "Avisos" },
  { id: "form", label: "Nuevo aviso" },
];

const emptyForm: FormState = {
  library_id: "all",
  title: "",
  summary: "",
  content: "",
  type: "info",
  audience: "all",
  status: "draft",
  starts_at: "",
  ends_at: "",
};

function canManageAnnouncements(role: AppUserRole) {
  return role === "librarian" || role === "admin" || role === "superadmin";
}

function cleanText(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toDateTimeLocal(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function toIsoOrNull(value: string) {
  return value ? new Date(value).toISOString() : null;
}

function formatDate(value: string | null) {
  if (!value) return "Sin fecha";
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function formFromAnnouncement(announcement: AdminAnnouncement): FormState {
  return {
    library_id: announcement.library_id ?? "all",
    title: announcement.title,
    summary: announcement.summary ?? "",
    content: announcement.content,
    type: announcement.type,
    audience: announcement.audience,
    status: announcement.status,
    starts_at: toDateTimeLocal(announcement.starts_at),
    ends_at: toDateTimeLocal(announcement.ends_at),
  };
}

function buildInput(form: FormState): AnnouncementInput {
  return {
    library_id: form.library_id === "all" ? null : form.library_id,
    title: form.title.trim(),
    summary: cleanText(form.summary),
    content: form.content.trim(),
    type: form.type,
    audience: form.audience,
    status: form.status,
    starts_at: toIsoOrNull(form.starts_at),
    ends_at: toIsoOrNull(form.ends_at),
  };
}

function matchesSearch(announcement: AdminAnnouncement, search: string) {
  const term = search.trim().toLowerCase();
  if (!term) return true;
  return [announcement.title, announcement.summary ?? "", announcement.content].some((value) => value.toLowerCase().includes(term));
}

export function AdminAnnouncementsPanel() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("summary");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentUser, setCurrentUser] = useState<AdminAppUser | null>(null);
  const [accessContext, setAccessContext] = useState<LibraryAccessContext | null>(null);
  const [announcements, setAnnouncements] = useState<AdminAnnouncement[]>([]);
  const [libraries, setLibraries] = useState<AdminAnnouncementLibrary[]>([]);
  const [libraryFilter, setLibraryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");
  const [typeFilter, setTypeFilter] = useState<FilterType>("all");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  async function loadData({ showLoading = true } = {}) {
    if (showLoading) setIsLoading(true);
    else setIsRefreshing(true);
    setFeedback(null);

    const userResult = await getCurrentAppUser();
    setCurrentUser(userResult.data);

    if (userResult.error || !userResult.data || !canManageAnnouncements(userResult.data.role)) {
      setIsLoading(false);
      setIsRefreshing(false);
      if (userResult.error) setFeedback({ type: "error", message: userResult.error });
      return;
    }

    const [librariesResult, announcementsResult, context] = await Promise.all([getAdminAnnouncementLibraries(), getAdminAnnouncements(), getLibraryAccessContext()]);
    setAccessContext(context);
    setLibraries(librariesResult.data);
    setAnnouncements(announcementsResult.data);
    if (!context.canAccessAll && librariesResult.data.length > 0) {
      setForm((current) => ({ ...current, library_id: current.library_id === "all" ? librariesResult.data[0].id : current.library_id }));
    }

    if (librariesResult.error || announcementsResult.error) {
      setFeedback({ type: "error", message: librariesResult.error ?? announcementsResult.error ?? "No se pudieron cargar los avisos." });
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

  const filteredAnnouncements = announcements.filter((announcement) => {
    const libraryMatches = libraryFilter === "all" || (libraryFilter === "general" ? announcement.library_id === null : announcement.library_id === libraryFilter);
    const statusMatches = statusFilter === "all" || announcement.status === statusFilter;
    const typeMatches = typeFilter === "all" || announcement.type === typeFilter;
    return libraryMatches && statusMatches && typeMatches && matchesSearch(announcement, search);
  });

  const summary = useMemo(
    () => ({
      total: announcements.length,
      published: announcements.filter((announcement) => announcement.status === "published").length,
      draft: announcements.filter((announcement) => announcement.status === "draft").length,
      archived: announcements.filter((announcement) => announcement.status === "archived").length,
      general: announcements.filter((announcement) => announcement.library_id === null).length,
    }),
    [announcements],
  );
  const canUseGeneralAnnouncements = accessContext?.canAccessAll ?? false;
  const libraryFilterOptions = [
    { label: "Todas las bibliotecas", value: "all" },
    ...(canUseGeneralAnnouncements ? [{ label: "Avisos generales", value: "general" }] : []),
    ...libraries.map((library) => ({ label: library.name, value: library.id })),
  ];
  const formLibraryOptions = [
    ...(canUseGeneralAnnouncements ? [{ label: "Todas las bibliotecas", value: "all" }] : []),
    ...libraries.map((library) => ({ label: library.name, value: library.id })),
  ];

  function resetForm() {
    setForm({ ...emptyForm, library_id: canUseGeneralAnnouncements ? "all" : libraries[0]?.id ?? "" });
    setEditingId(null);
    setActiveTab("form");
  }

  function editAnnouncement(announcement: AdminAnnouncement) {
    setForm(formFromAnnouncement(announcement));
    setEditingId(announcement.id);
    setFeedback(null);
    setActiveTab("form");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = buildInput(form);

    if (!input.title) {
      setFeedback({ type: "error", message: "El título es obligatorio." });
      return;
    }

    if (!input.content) {
      setFeedback({ type: "error", message: "El contenido es obligatorio." });
      return;
    }

    setIsSubmitting(true);
    const result = editingId ? await updateAnnouncement(editingId, input) : await createAnnouncement(input);

    if (result.error) {
      setFeedback({ type: "error", message: result.error });
    } else {
      setFeedback({ type: "success", message: editingId ? "Aviso actualizado correctamente" : "Aviso creado correctamente" });
      setForm(emptyForm);
      setEditingId(null);
      setActiveTab("announcements");
      await loadData({ showLoading: false });
    }

    setIsSubmitting(false);
  }

  async function changeStatus(announcementId: string, status: AnnouncementStatus) {
    const result = await toggleAnnouncementStatus(announcementId, status);
    if (result.error) setFeedback({ type: "error", message: result.error });
    else {
      setFeedback({ type: "success", message: "Aviso actualizado correctamente" });
      await loadData({ showLoading: false });
    }
  }

  if (isLoading) {
    return <Card><p className="text-sm font-semibold text-slate-600">Cargando administración de avisos...</p></Card>;
  }

  if (!currentUser) {
    return (
      <Card className="text-center">
        <ShieldAlert className="mx-auto h-10 w-10 text-ulv-blue" aria-hidden="true" />
        <h2 className="mt-3 text-xl font-black text-ulv-blue">Debes iniciar sesión para acceder al panel administrativo.</h2>
        <Link href="/login?redirect=/admin/avisos" className="mt-5 inline-flex min-h-12 items-center justify-center rounded-2xl bg-ulv-yellow px-5 py-3 text-sm font-black text-ulv-blue">
          Iniciar sesión
        </Link>
      </Card>
    );
  }

  if (!canManageAnnouncements(currentUser.role)) {
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
      {accessContext ? noAssignedLibrariesMessage(accessContext) ? <p className="rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-800">{noAssignedLibrariesMessage(accessContext)}</p> : null : null}

      <section className="rounded-3xl border border-ulv-blue bg-ulv-blue p-5 text-white shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-bold text-ulv-yellow">Administración de avisos</p>
            <h1 className="mt-2 text-3xl font-black">Avisos y comunicados</h1>
            <p className="mt-2 text-sm leading-6 text-white/85">Publica horarios, cierres, eventos y comunicados para los usuarios.</p>
          </div>
          <button type="button" onClick={() => void loadData({ showLoading: false })} disabled={isRefreshing} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-white/25 px-4 text-sm font-bold text-white transition hover:bg-white/10 disabled:opacity-60">
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} aria-hidden="true" />
            Refrescar
          </button>
        </div>
      </section>

      <Card className="p-3">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {tabs.map((tab) => (
            <button key={tab.id} type="button" onClick={() => (tab.id === "form" ? resetForm() : setActiveTab(tab.id))} className={`min-h-11 shrink-0 rounded-2xl px-4 py-2 text-sm font-black ${activeTab === tab.id ? "bg-ulv-yellow text-ulv-blue" : "border border-slate-200 bg-white text-ulv-blue"}`}>
              {tab.label}
            </button>
          ))}
        </div>
      </Card>

      {activeTab === "summary" ? (
        <section className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Total de avisos" value={`${summary.total}`} detail="Todos los estados" />
            <StatCard label="Publicados" value={`${summary.published}`} detail="Visibles al público" />
            <StatCard label="Borradores" value={`${summary.draft}`} detail="Pendientes de publicar" />
            <StatCard label="Archivados" value={`${summary.archived}`} detail="Ocultos del público" />
          </div>
          <Card>
            <h2 className="text-lg font-black text-ulv-blue">Avisos por biblioteca</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-2xl bg-slate-50 p-4"><p className="text-sm font-bold text-slate-500">Avisos generales</p><p className="mt-2 text-2xl font-black text-ulv-blue">{summary.general}</p></div>
              {libraries.map((library) => (
                <div key={library.id} className="rounded-2xl bg-slate-50 p-4"><p className="text-sm font-bold text-slate-500">{library.name}</p><p className="mt-2 text-2xl font-black text-ulv-blue">{announcements.filter((announcement) => announcement.library_id === library.id).length}</p></div>
              ))}
            </div>
          </Card>
        </section>
      ) : null}

      {activeTab === "announcements" ? (
        <section className="space-y-5">
          <Card>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5"><DropdownSelect label="Biblioteca" options={libraryFilterOptions} value={libraryFilter} onChange={setLibraryFilter} /></div>
              <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5"><DropdownSelect label="Estado" options={[{ label: "Todos", value: "all" }, { label: announcementStatusLabels.draft, value: "draft" }, { label: announcementStatusLabels.published, value: "published" }, { label: announcementStatusLabels.archived, value: "archived" }]} value={statusFilter} onChange={(value) => setStatusFilter(value as FilterStatus)} /></div>
              <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5"><DropdownSelect label="Tipo" options={[{ label: "Todos", value: "all" }, { label: announcementTypeLabels.info, value: "info" }, { label: announcementTypeLabels.warning, value: "warning" }, { label: announcementTypeLabels.event, value: "event" }, { label: announcementTypeLabels.maintenance, value: "maintenance" }]} value={typeFilter} onChange={(value) => setTypeFilter(value as FilterType)} /></div>
              <label><span className="text-sm font-bold text-ulv-blue">Búsqueda</span><span className="mt-2 flex min-h-12 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4"><Search className="h-4 w-4 text-slate-400" aria-hidden="true" /><input value={search} onChange={(event) => setSearch(event.target.value)} className="w-full bg-transparent text-sm font-semibold outline-none" placeholder="Título o contenido" /></span></label>
            </div>
          </Card>

          <Card>
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="bg-ulv-blue text-white"><tr><th className="px-4 py-3">Título</th><th className="px-4 py-3">Biblioteca</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Audiencia</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3">Fecha</th><th className="px-4 py-3">Acciones</th></tr></thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {filteredAnnouncements.length === 0 ? <tr><td colSpan={7} className="px-4 py-8 text-center font-semibold text-slate-500">No hay avisos con esos filtros.</td></tr> : filteredAnnouncements.map((announcement) => (
                    <tr key={announcement.id}>
                      <td className="px-4 py-3"><p className="font-black text-ulv-blue">{announcement.title}</p><p className="mt-1 line-clamp-2 text-xs text-slate-500">{announcement.summary ?? announcement.content}</p></td>
                      <td className="px-4 py-3">{announcement.libraries?.name ?? "Todas las bibliotecas"}</td>
                      <td className="px-4 py-3">{announcementTypeLabels[announcement.type]}</td>
                      <td className="px-4 py-3">{announcementAudienceLabels[announcement.audience]}</td>
                      <td className="px-4 py-3 font-bold">{announcementStatusLabels[announcement.status]}</td>
                      <td className="px-4 py-3">{formatDate(announcement.created_at)}</td>
                      <td className="px-4 py-3"><div className="flex flex-wrap gap-2"><button type="button" onClick={() => editAnnouncement(announcement)} className="rounded-xl bg-ulv-yellow px-3 py-2 text-xs font-black text-ulv-blue"><Edit3 className="mr-1 inline h-3 w-3" aria-hidden="true" />Editar</button><button type="button" onClick={() => void changeStatus(announcement.id, "published")} className="rounded-xl border border-green-200 px-3 py-2 text-xs font-black text-green-700"><Send className="mr-1 inline h-3 w-3" aria-hidden="true" />Publicar</button><button type="button" onClick={() => void changeStatus(announcement.id, "archived")} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-700"><Archive className="mr-1 inline h-3 w-3" aria-hidden="true" />Archivar</button><button type="button" onClick={() => void changeStatus(announcement.id, "draft")} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-700">Borrador</button>{announcement.status === "published" ? <Link href="/avisos" className="rounded-xl border border-ulv-blue/20 px-3 py-2 text-xs font-black text-ulv-blue"><Eye className="mr-1 inline h-3 w-3" aria-hidden="true" />Ver público</Link> : null}</div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </section>
      ) : null}

      {activeTab === "form" ? (
        <Card>
          <div className="mb-5 flex items-start gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-ulv-yellow text-ulv-blue"><FileText className="h-5 w-5" aria-hidden="true" /></span><div><h2 className="text-xl font-black text-ulv-blue">{editingId ? "Editar aviso" : "Nuevo aviso"}</h2><p className="mt-1 text-sm text-slate-600">Completa el comunicado y define si aplica a una biblioteca o a todas.</p></div></div>
          <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5"><DropdownSelect label="Biblioteca" options={formLibraryOptions} value={form.library_id} onChange={(value) => setForm((current) => ({ ...current, library_id: value }))} /></div>
            <label><span className="text-sm font-bold text-ulv-blue">Título</span><input required value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-semibold outline-none focus:border-ulv-blue focus:ring-4 focus:ring-ulv-blue/10" /></label>
            <label className="md:col-span-2"><span className="text-sm font-bold text-ulv-blue">Resumen</span><input value={form.summary} onChange={(event) => setForm((current) => ({ ...current, summary: event.target.value }))} className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-semibold outline-none focus:border-ulv-blue focus:ring-4 focus:ring-ulv-blue/10" /></label>
            <label className="md:col-span-2"><span className="text-sm font-bold text-ulv-blue">Contenido</span><textarea required value={form.content} onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))} className="mt-2 min-h-36 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-ulv-blue focus:ring-4 focus:ring-ulv-blue/10" /></label>
            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5"><DropdownSelect label="Tipo" options={[{ label: announcementTypeLabels.info, value: "info" }, { label: announcementTypeLabels.warning, value: "warning" }, { label: announcementTypeLabels.event, value: "event" }, { label: announcementTypeLabels.maintenance, value: "maintenance" }]} value={form.type} onChange={(value) => setForm((current) => ({ ...current, type: value as AnnouncementType }))} /></div>
            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5"><DropdownSelect label="Audiencia" options={[{ label: announcementAudienceLabels.all, value: "all" }, { label: announcementAudienceLabels.students, value: "students" }, { label: announcementAudienceLabels.staff, value: "staff" }]} value={form.audience} onChange={(value) => setForm((current) => ({ ...current, audience: value as AnnouncementAudience }))} /></div>
            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5"><DropdownSelect label="Estado" options={[{ label: announcementStatusLabels.draft, value: "draft" }, { label: announcementStatusLabels.published, value: "published" }, { label: announcementStatusLabels.archived, value: "archived" }]} value={form.status} onChange={(value) => setForm((current) => ({ ...current, status: value as AnnouncementStatus }))} /></div>
            <label><span className="text-sm font-bold text-ulv-blue">Fecha de inicio</span><input type="datetime-local" value={form.starts_at} onChange={(event) => setForm((current) => ({ ...current, starts_at: event.target.value }))} className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-semibold outline-none focus:border-ulv-blue focus:ring-4 focus:ring-ulv-blue/10" /></label>
            <label><span className="text-sm font-bold text-ulv-blue">Fecha de finalización</span><input type="datetime-local" value={form.ends_at} onChange={(event) => setForm((current) => ({ ...current, ends_at: event.target.value }))} className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-semibold outline-none focus:border-ulv-blue focus:ring-4 focus:ring-ulv-blue/10" /></label>
            <div className="md:col-span-2"><button disabled={isSubmitting} className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-ulv-yellow px-5 py-3 text-sm font-black text-ulv-blue shadow-sm disabled:opacity-60 sm:w-auto">{isSubmitting ? "Guardando..." : "Guardar aviso"}</button></div>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
