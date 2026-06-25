"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ShieldAlert } from "lucide-react";
import { Card } from "@/app/ui/Card";
import {
  buildProductionChecklistSummary,
  getProductionChecklistItems,
  productionPriorityLabels,
  productionStatusLabels,
  updateProductionChecklistItem,
  type ProductionChecklistItem,
  type ProductionChecklistPriority,
  type ProductionChecklistStatus,
} from "@/services/admin-production-checklist.service";

type StatusFilter = "all" | ProductionChecklistStatus;
type PriorityFilter = "all" | ProductionChecklistPriority;

const fieldClass = "mt-2 min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 outline-none focus:border-ulv-blue focus:ring-4 focus:ring-ulv-blue/10";

const quickLinks = [
  ["Ir a diagnóstico", "/admin/diagnostico"],
  ["Ir a reportes", "/admin/reportes"],
  ["Ir a reservas", "/admin/reservas"],
  ["Ir a configuración de reservas", "/admin/configuracion-reservas"],
  ["Ir a usuarios", "/admin/usuarios"],
];

function groupBySection(items: ProductionChecklistItem[]) {
  return items.reduce<Record<string, ProductionChecklistItem[]>>((groups, item) => {
    groups[item.section] = [...(groups[item.section] ?? []), item];
    return groups;
  }, {});
}

export function AdminProductionStatusPanel() {
  const [items, setItems] = useState<ProductionChecklistItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [sectionFilter, setSectionFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [search, setSearch] = useState("");
  const [drafts, setDrafts] = useState<Record<string, { status: ProductionChecklistStatus; notes: string }>>({});
  const [feedback, setFeedback] = useState<string | null>(null);

  async function loadItems() {
    setIsLoading(true);
    const result = await getProductionChecklistItems();
    setItems(result.data);
    setFeedback(result.error);
    setDrafts(Object.fromEntries(result.data.map((item) => [item.id, { status: item.status, notes: item.notes ?? "" }])));
    setIsLoading(false);
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadItems();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  const sections = useMemo(() => Array.from(new Set(items.map((item) => item.section))), [items]);
  const filteredItems = useMemo(() => {
    const cleanSearch = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchesSection = sectionFilter === "all" || item.section === sectionFilter;
      const matchesStatus = statusFilter === "all" || item.status === statusFilter;
      const matchesPriority = priorityFilter === "all" || item.priority === priorityFilter;
      const searchable = [item.title, item.description, item.notes, item.section].filter(Boolean).join(" ").toLowerCase();
      return matchesSection && matchesStatus && matchesPriority && (!cleanSearch || searchable.includes(cleanSearch));
    });
  }, [items, priorityFilter, search, sectionFilter, statusFilter]);
  const summary = buildProductionChecklistSummary(items);
  const groupedItems = groupBySection(filteredItems);

  async function handleSave(item: ProductionChecklistItem) {
    const draft = drafts[item.id];
    if (!draft) return;
    setSavingId(item.id);
    setFeedback(null);
    const result = await updateProductionChecklistItem(item.id, { status: draft.status, notes: draft.notes });
    setSavingId(null);
    if (result.error || !result.data) {
      setFeedback(result.error ?? "No se pudo actualizar el ítem.");
      return;
    }
    const updatedItem = result.data;
    setItems((currentItems) => currentItems.map((currentItem) => (currentItem.id === item.id ? updatedItem : currentItem)));
    setFeedback("Estado actualizado correctamente.");
  }

  if (isLoading) return <Card><p className="text-sm font-semibold text-slate-600">Cargando estado de producción...</p></Card>;

  if (feedback && items.length === 0) {
    return <Card className="text-center"><ShieldAlert className="mx-auto h-10 w-10 text-red-700" aria-hidden="true" /><h2 className="mt-3 text-xl font-black text-red-700">{feedback}</h2></Card>;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] bg-ulv-blue p-5 text-white shadow-sm md:p-8">
        <p className="text-sm font-bold text-ulv-yellow">Producción</p>
        <h1 className="mt-2 text-3xl font-black leading-tight md:text-5xl">Estado de producción</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-white/85">Revisa visualmente si Biblioteca ULV App está lista para publicarse o entregarse.</p>
      </section>

      {feedback ? <p className="rounded-2xl bg-ulv-bg p-4 text-sm font-bold text-ulv-blue">{feedback}</p> : null}

      <Card>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-bold text-slate-500">Porcentaje completado</p>
            <p className="mt-1 text-4xl font-black text-ulv-blue">{summary.completionPercentage}%</p>
          </div>
          <div className="h-4 w-full overflow-hidden rounded-full bg-slate-100 lg:max-w-md">
            <div className="h-full rounded-full bg-ulv-yellow" style={{ width: `${summary.completionPercentage}%` }} />
          </div>
        </div>
      </Card>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        {[
          ["Total", summary.total],
          ["Pendientes", summary.pending],
          ["En revisión", summary.inReview],
          ["Correctos", summary.passed],
          ["Con error", summary.failed],
          ["No aplican", summary.notApplicable],
        ].map(([label, value]) => <Card key={label} className="p-4"><p className="text-sm font-bold text-slate-500">{label}</p><p className="mt-2 text-2xl font-black text-ulv-blue">{value}</p></Card>)}
      </section>

      <Card>
        <div className="grid gap-4 lg:grid-cols-4">
          <label><span className="text-sm font-bold text-ulv-blue">Sección</span><select value={sectionFilter} onChange={(event) => setSectionFilter(event.target.value)} className={fieldClass}><option value="all">Todas</option>{sections.map((section) => <option key={section} value={section}>{section}</option>)}</select></label>
          <label><span className="text-sm font-bold text-ulv-blue">Estado</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)} className={fieldClass}><option value="all">Todos</option>{Object.entries(productionStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label><span className="text-sm font-bold text-ulv-blue">Prioridad</span><select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value as PriorityFilter)} className={fieldClass}><option value="all">Todas</option>{Object.entries(productionPriorityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label><span className="text-sm font-bold text-ulv-blue">Búsqueda</span><input value={search} onChange={(event) => setSearch(event.target.value)} className={fieldClass} placeholder="Título, nota o sección" /></label>
        </div>
      </Card>

      <Card>
        <h2 className="text-xl font-black text-ulv-blue">Acciones rápidas</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {quickLinks.map(([label, href]) => <Link key={href} href={href} className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-ulv-blue/20 px-4 text-sm font-black text-ulv-blue hover:bg-ulv-bg">{label}</Link>)}
        </div>
      </Card>

      {Object.entries(groupedItems).map(([section, sectionItems]) => {
        const sectionSummary = buildProductionChecklistSummary(sectionItems);
        return (
          <section key={section} className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-2xl font-black text-ulv-blue">{section}</h2>
              <p className="text-sm font-black text-slate-600">{sectionSummary.passed} correctos / {sectionSummary.total} total</p>
            </div>
            <div className="mt-5 grid gap-4">
              {sectionItems.map((item) => {
                const draft = drafts[item.id] ?? { status: item.status, notes: item.notes ?? "" };
                return (
                  <Card key={item.id} className="p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <CheckCircle2 className="h-5 w-5 text-ulv-blue" aria-hidden="true" />
                          <h3 className="text-lg font-black text-ulv-blue">{item.title}</h3>
                        </div>
                        {item.description ? <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p> : null}
                        <p className="mt-2 text-xs font-bold text-slate-500">Prioridad: {productionPriorityLabels[item.priority]}</p>
                      </div>
                      <span className="inline-flex rounded-full bg-ulv-yellow px-3 py-1 text-xs font-black text-ulv-blue">{productionStatusLabels[item.status]}</span>
                    </div>
                    <div className="mt-4 grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)_160px] lg:items-end">
                      <label><span className="text-sm font-bold text-ulv-blue">Estado</span><select value={draft.status} onChange={(event) => setDrafts({ ...drafts, [item.id]: { ...draft, status: event.target.value as ProductionChecklistStatus } })} className={fieldClass}>{Object.entries(productionStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                      <label><span className="text-sm font-bold text-ulv-blue">Notas</span><textarea value={draft.notes} onChange={(event) => setDrafts({ ...drafts, [item.id]: { ...draft, notes: event.target.value } })} rows={2} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-ulv-blue focus:ring-4 focus:ring-ulv-blue/10" /></label>
                      <button type="button" onClick={() => void handleSave(item)} disabled={savingId === item.id} className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-ulv-yellow px-5 text-sm font-black text-ulv-blue disabled:opacity-60">{savingId === item.id ? "Guardando..." : "Guardar"}</button>
                    </div>
                  </Card>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
