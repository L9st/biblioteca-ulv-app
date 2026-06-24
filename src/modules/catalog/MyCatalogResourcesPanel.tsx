"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { BookOpen, ExternalLink, Plus, Search, Trash2 } from "lucide-react";
import { Card } from "@/app/ui/Card";
import { supabase } from "@/lib/supabase";
import {
  catalogSavedItemStatusLabels,
  clearMyCatalogSearchHistory,
  createCatalogSavedItem,
  deleteCatalogSavedItem,
  deleteCatalogSearchHistoryItem,
  getMyCatalogSavedItems,
  getMyCatalogSearchHistory,
  updateCatalogSavedItem,
  type CatalogSavedItem,
  type CatalogSavedItemStatus,
  type CatalogSearchHistoryItem,
  type CatalogSearchType,
} from "@/services/catalog-saved-items.service";

type TabId = "resources" | "add" | "history";

type ResourceFormState = {
  title: string;
  author: string;
  isbn: string;
  year: string;
  koha_url: string;
  status: CatalogSavedItemStatus;
  notes: string;
};

const emptyForm: ResourceFormState = { title: "", author: "", isbn: "", year: "", koha_url: "", status: "saved", notes: "" };

const searchTypeLabels: Record<CatalogSearchType, string> = {
  keyword: "Palabra clave",
  title: "Título",
  author: "Autor",
  subject: "Tema",
  isbn: "ISBN",
};

const fieldClass = "mt-2 min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 outline-none focus:border-ulv-blue focus:ring-4 focus:ring-ulv-blue/10";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function openExternalUrl(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}

function buildFormFromItem(item: CatalogSavedItem): ResourceFormState {
  return {
    title: item.title,
    author: item.author ?? "",
    isbn: item.isbn ?? "",
    year: item.year ?? "",
    koha_url: item.koha_url,
    status: item.status,
    notes: item.notes ?? "",
  };
}

export function MyCatalogResourcesPanel() {
  const [hasSession, setHasSession] = useState(false);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("resources");
  const [resources, setResources] = useState<CatalogSavedItem[]>([]);
  const [history, setHistory] = useState<CatalogSearchHistoryItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<CatalogSavedItemStatus | "all">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [form, setForm] = useState<ResourceFormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function loadData() {
    setIsLoadingData(true);
    const [resourcesResult, historyResult] = await Promise.all([getMyCatalogSavedItems(), getMyCatalogSearchHistory()]);
    setResources(resourcesResult.data);
    setHistory(historyResult.data);
    setFeedback(resourcesResult.error ?? historyResult.error);
    setIsLoadingData(false);
  }

  useEffect(() => {
    const timeout = window.setTimeout(async () => {
      const { data } = await supabase.auth.getSession();
      const isAuthenticated = Boolean(data.session);
      setHasSession(isAuthenticated);
      setIsLoadingSession(false);
      if (isAuthenticated) void loadData();
    }, 0);

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      const isAuthenticated = Boolean(session);
      setHasSession(isAuthenticated);
      if (isAuthenticated) void loadData();
      if (!isAuthenticated) {
        setResources([]);
        setHistory([]);
      }
    });

    return () => {
      window.clearTimeout(timeout);
      authListener.subscription.unsubscribe();
    };
  }, []);

  const filteredResources = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return resources.filter((resource) => {
      const matchesStatus = statusFilter === "all" || resource.status === statusFilter;
      const searchableText = [resource.title, resource.author, resource.isbn, resource.notes].filter(Boolean).join(" ").toLowerCase();
      return matchesStatus && (!normalizedSearch || searchableText.includes(normalizedSearch));
    });
  }, [resources, searchTerm, statusFilter]);

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
  }

  function startEditing(item: CatalogSavedItem) {
    setForm(buildFormFromItem(item));
    setEditingId(item.id);
    setActiveTab("add");
    setFeedback(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    const result = editingId ? await updateCatalogSavedItem(editingId, form) : await createCatalogSavedItem(form);
    if (result.error) {
      setFeedback(editingId ? result.error : "No se pudo guardar el recurso.");
      return;
    }

    setFeedback(editingId ? "Recurso actualizado correctamente." : "Recurso guardado correctamente.");
    resetForm();
    setActiveTab("resources");
    await loadData();
  }

  async function handleDeleteResource(id: string) {
    setFeedback(null);
    const result = await deleteCatalogSavedItem(id);
    if (result.error) {
      setFeedback(result.error);
      return;
    }
    setResources((currentResources) => currentResources.filter((resource) => resource.id !== id));
  }

  async function handleStatusChange(item: CatalogSavedItem, status: CatalogSavedItemStatus) {
    setFeedback(null);
    const result = await updateCatalogSavedItem(item.id, { status });
    if (result.error || !result.data) {
      setFeedback(result.error ?? "No se pudo actualizar el estado.");
      return;
    }
    const updatedResource = result.data;
    setResources((currentResources) => currentResources.map((resource) => (resource.id === item.id ? updatedResource : resource)));
  }

  async function handleSaveHistoryItem(item: CatalogSearchHistoryItem) {
    setFeedback(null);
    const result = await createCatalogSavedItem({
      title: `Búsqueda: ${item.query}`,
      koha_url: item.koha_url,
      status: "saved",
      notes: "Búsqueda guardada desde el historial del catálogo",
    });
    setFeedback(result.error ?? "Recurso guardado correctamente.");
    if (!result.error) await loadData();
  }

  async function handleDeleteHistoryItem(id: string) {
    setFeedback(null);
    const result = await deleteCatalogSearchHistoryItem(id);
    if (result.error) {
      setFeedback(result.error);
      return;
    }
    setHistory((currentHistory) => currentHistory.filter((item) => item.id !== id));
  }

  async function handleClearHistory() {
    setFeedback(null);
    const result = await clearMyCatalogSearchHistory();
    if (result.error) {
      setFeedback(result.error);
      return;
    }
    setHistory([]);
    setFeedback("Historial borrado correctamente.");
  }

  if (isLoadingSession) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 py-6 pb-24 sm:px-6 lg:px-8 md:pb-8">
        <Card><p className="text-sm font-semibold text-slate-600">Cargando recursos...</p></Card>
      </div>
    );
  }

  if (!hasSession) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-6 pb-24 sm:px-6 lg:px-8 md:pb-8">
        <Card>
          <h1 className="text-2xl font-black text-ulv-blue">Mis recursos</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">Debes iniciar sesión para ver tus recursos guardados.</p>
          <Link href="/login?redirect=/mis-recursos" className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-ulv-yellow px-5 text-sm font-black text-ulv-blue sm:w-auto">
            Iniciar sesión
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 pb-24 sm:px-6 lg:px-8 md:pb-8">
      <section className="rounded-[2rem] bg-ulv-blue p-5 text-white shadow-sm md:p-8">
        <p className="text-sm font-bold text-ulv-yellow">Catálogo personal</p>
        <h1 className="mt-2 text-3xl font-black leading-tight md:text-5xl">Mis recursos</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-white/85">Consulta tus recursos guardados, favoritos e historial de búsquedas del catálogo.</p>
      </section>

      {feedback ? <p className="mt-5 rounded-2xl bg-ulv-bg p-4 text-sm font-bold text-ulv-blue">{feedback}</p> : null}

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {[
          { id: "resources" as const, label: "Mis recursos" },
          { id: "add" as const, label: editingId ? "Editar recurso" : "Agregar recurso" },
          { id: "history" as const, label: "Historial de búsquedas" },
        ].map((tab) => (
          <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={`min-h-12 rounded-2xl px-4 text-sm font-black transition ${activeTab === tab.id ? "bg-ulv-yellow text-ulv-blue" : "border border-ulv-blue/20 bg-white text-ulv-blue hover:bg-ulv-bg"}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "resources" ? (
        <section className="mt-6">
          <Card>
            <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
              <label>
                <span className="text-sm font-bold text-ulv-blue">Estado</span>
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as CatalogSavedItemStatus | "all")} className={fieldClass}>
                  <option value="all">Todos</option>
                  {Object.entries(catalogSavedItemStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label>
                <span className="text-sm font-bold text-ulv-blue">Buscar</span>
                <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Título, autor, ISBN o notas" className={fieldClass} />
              </label>
            </div>
          </Card>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {isLoadingData ? <Card><p className="text-sm font-semibold text-slate-600">Cargando recursos...</p></Card> : null}
            {!isLoadingData && filteredResources.length === 0 ? <Card><p className="text-sm font-semibold text-slate-600">No hay recursos guardados con estos filtros.</p></Card> : null}
            {filteredResources.map((resource) => (
              <Card key={resource.id} className="h-full">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h2 className="text-xl font-black text-ulv-blue">{resource.title}</h2>
                    <p className="mt-1 text-sm text-slate-600">{resource.author || "Autor no registrado"}</p>
                    <p className="mt-2 text-sm font-semibold text-slate-700">ISBN: {resource.isbn || "No registrado"}</p>
                    <p className="mt-2 text-sm text-slate-600">{resource.notes || "Sin notas"}</p>
                    <p className="mt-3 text-xs font-bold text-slate-500">Guardado: {formatDate(resource.created_at)}</p>
                  </div>
                  <span className="inline-flex rounded-full bg-ulv-yellow px-3 py-1 text-xs font-black text-ulv-blue">{catalogSavedItemStatusLabels[resource.status]}</span>
                </div>
                <label className="mt-4 block">
                  <span className="text-sm font-bold text-ulv-blue">Cambiar estado</span>
                  <select value={resource.status} onChange={(event) => void handleStatusChange(resource, event.target.value as CatalogSavedItemStatus)} className={fieldClass}>
                    {Object.entries(catalogSavedItemStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <button type="button" onClick={() => openExternalUrl(resource.koha_url)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-ulv-yellow px-4 text-sm font-black text-ulv-blue">
                    Abrir en Koha <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button type="button" onClick={() => startEditing(resource)} className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-ulv-blue px-4 text-sm font-black text-ulv-blue">
                    Editar
                  </button>
                  <button type="button" onClick={() => void handleDeleteResource(resource.id)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-red-200 px-4 text-sm font-black text-red-700">
                    Eliminar <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      {activeTab === "add" ? (
        <Card className="mt-6">
          <div className="mb-5 flex items-start gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-ulv-yellow text-ulv-blue"><Plus className="h-6 w-6" aria-hidden="true" /></span>
            <div>
              <h2 className="text-xl font-black text-ulv-blue">{editingId ? "Editar recurso" : "Agregar recurso"}</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">Guarda enlaces del OPAC de Koha o recursos para consultar después.</p>
            </div>
          </div>
          <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
            <label><span className="text-sm font-bold text-ulv-blue">Título</span><input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} className={fieldClass} required /></label>
            <label><span className="text-sm font-bold text-ulv-blue">Autor</span><input value={form.author} onChange={(event) => setForm({ ...form, author: event.target.value })} className={fieldClass} /></label>
            <label><span className="text-sm font-bold text-ulv-blue">ISBN</span><input value={form.isbn} onChange={(event) => setForm({ ...form, isbn: event.target.value })} className={fieldClass} /></label>
            <label><span className="text-sm font-bold text-ulv-blue">Año</span><input value={form.year} onChange={(event) => setForm({ ...form, year: event.target.value })} className={fieldClass} /></label>
            <label className="md:col-span-2"><span className="text-sm font-bold text-ulv-blue">URL de Koha</span><input value={form.koha_url} onChange={(event) => setForm({ ...form, koha_url: event.target.value })} placeholder="https://..." className={fieldClass} required /></label>
            <label><span className="text-sm font-bold text-ulv-blue">Estado</span><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as CatalogSavedItemStatus })} className={fieldClass}>{Object.entries(catalogSavedItemStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="md:col-span-2"><span className="text-sm font-bold text-ulv-blue">Notas</span><textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} rows={4} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-ulv-blue focus:ring-4 focus:ring-ulv-blue/10" /></label>
            <div className="grid gap-3 md:col-span-2 sm:flex">
              <button type="submit" className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-ulv-yellow px-5 text-sm font-black text-ulv-blue sm:w-auto">{editingId ? "Guardar cambios" : "Guardar recurso"}</button>
              {editingId ? <button type="button" onClick={resetForm} className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl border border-ulv-blue px-5 text-sm font-black text-ulv-blue sm:w-auto">Cancelar edición</button> : null}
            </div>
          </form>
        </Card>
      ) : null}

      {activeTab === "history" ? (
        <section className="mt-6">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-black text-ulv-blue">Historial de búsquedas</h2>
            <button type="button" onClick={() => void handleClearHistory()} className="inline-flex min-h-11 w-full items-center justify-center rounded-2xl border border-red-200 px-4 text-sm font-black text-red-700 sm:w-auto">Borrar historial</button>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {history.length === 0 ? <Card><p className="text-sm font-semibold text-slate-600">No hay búsquedas recientes.</p></Card> : null}
            {history.map((item) => (
              <Card key={item.id}>
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-ulv-yellow text-ulv-blue"><Search className="h-5 w-5" aria-hidden="true" /></span>
                  <div className="min-w-0">
                    <h3 className="text-lg font-black text-ulv-blue">{item.query}</h3>
                    <p className="mt-1 text-sm text-slate-600">Tipo: {searchTypeLabels[item.search_type]}</p>
                    <p className="mt-1 text-xs font-bold text-slate-500">Fecha: {formatDate(item.created_at)}</p>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <button type="button" onClick={() => openExternalUrl(item.koha_url)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-ulv-yellow px-4 text-sm font-black text-ulv-blue">Buscar nuevamente <ExternalLink className="h-4 w-4" aria-hidden="true" /></button>
                  <button type="button" onClick={() => void handleSaveHistoryItem(item)} className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-ulv-blue px-4 text-sm font-black text-ulv-blue">Guardar como recurso</button>
                  <button type="button" onClick={() => void handleDeleteHistoryItem(item.id)} className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-red-200 px-4 text-sm font-black text-red-700">Eliminar</button>
                </div>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      <div className="mt-6">
        <Link href="/catalogo" className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-ulv-blue px-5 text-sm font-black text-white sm:w-auto">
          <BookOpen className="h-4 w-4" aria-hidden="true" /> Volver al catálogo
        </Link>
      </div>
    </div>
  );
}
