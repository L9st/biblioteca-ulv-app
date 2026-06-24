"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCw, Search, ShieldAlert } from "lucide-react";
import { Card } from "@/app/ui/Card";
import { StatCard } from "@/app/cards/StatCard";
import { DropdownSelect } from "@/app/ui/DropdownSelect";
import { getCurrentAppUser, type AdminAppUser, type AppUserRole } from "@/services/admin-users.service";
import { getReservationSettingsLibraries, type ReservationSettingsLibrary } from "@/services/admin-reservation-settings.service";
import {
  addInternalSupportNote,
  assignSupportTicket,
  getAdminSupportStaffUsers,
  getAdminSupportTicketMessages,
  getAdminSupportTickets,
  replyToSupportTicket,
  updateSupportTicketStatus,
  type AdminSupportStaffUser,
  type AdminSupportTicket,
} from "@/services/admin-support.service";
import { supportCategoryLabels, supportPriorityLabels, supportStatusLabels, type SupportTicketCategory, type SupportTicketMessage, type SupportTicketPriority, type SupportTicketStatus } from "@/services/support.service";

type ActiveTab = "summary" | "tickets";
type Feedback = { type: "success" | "error"; message: string };
type StatusFilter = "all" | SupportTicketStatus;
type CategoryFilter = "all" | SupportTicketCategory;
type PriorityFilter = "all" | SupportTicketPriority;

const fieldClass = "mt-2 min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 outline-none focus:border-ulv-blue focus:ring-4 focus:ring-ulv-blue/10";

function canAccess(role: AppUserRole) {
  return role === "librarian" || role === "admin" || role === "superadmin";
}

function formatDate(value: string | null) {
  if (!value) return "Sin fecha";
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function AdminSupportPanel() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("summary");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentUser, setCurrentUser] = useState<AdminAppUser | null>(null);
  const [tickets, setTickets] = useState<AdminSupportTicket[]>([]);
  const [libraries, setLibraries] = useState<ReservationSettingsLibrary[]>([]);
  const [staffUsers, setStaffUsers] = useState<AdminSupportStaffUser[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<AdminSupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportTicketMessage[]>([]);
  const [libraryId, setLibraryId] = useState("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [priority, setPriority] = useState<PriorityFilter>("all");
  const [search, setSearch] = useState("");
  const [reply, setReply] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const loadData = useCallback(async ({ showLoading = true } = {}) => {
    if (showLoading) setIsLoading(true);
    else setIsRefreshing(true);
    setFeedback(null);
    const userResult = await getCurrentAppUser();
    setCurrentUser(userResult.data);
    if (userResult.error || !userResult.data || !canAccess(userResult.data.role)) {
      if (userResult.error) setFeedback({ type: "error", message: userResult.error });
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }
    const [ticketsResult, librariesResult, staffResult] = await Promise.all([getAdminSupportTickets({ libraryId, status, category, priority, search }), getReservationSettingsLibraries(), getAdminSupportStaffUsers()]);
    setTickets(ticketsResult.data);
    setLibraries(librariesResult.data);
    setStaffUsers(staffResult.data);
    if (ticketsResult.error || librariesResult.error || staffResult.error) setFeedback({ type: "error", message: ticketsResult.error ?? librariesResult.error ?? staffResult.error ?? "No se pudo cargar soporte." });
    setIsLoading(false);
    setIsRefreshing(false);
  }, [category, libraryId, priority, search, status]);

  useEffect(() => {
    const timeout = window.setTimeout(() => { void loadData(); }, 0);
    return () => window.clearTimeout(timeout);
  }, [loadData]);

  async function openTicket(ticket: AdminSupportTicket) {
    setSelectedTicket(ticket);
    const result = await getAdminSupportTicketMessages(ticket.id);
    setMessages(result.data);
    if (result.error) setFeedback({ type: "error", message: result.error });
  }

  async function sendReply() {
    if (!selectedTicket) return;
    setIsSubmitting(true);
    const result = await replyToSupportTicket(selectedTicket.id, reply);
    if (result.error || !result.data) setFeedback({ type: "error", message: result.error ?? "No se pudo responder." });
    else {
      setReply("");
      setMessages((current) => [...current, result.data as SupportTicketMessage]);
      setFeedback({ type: "success", message: "Respuesta enviada correctamente." });
      await loadData({ showLoading: false });
    }
    setIsSubmitting(false);
  }

  async function sendInternalNote() {
    if (!selectedTicket) return;
    setIsSubmitting(true);
    const result = await addInternalSupportNote(selectedTicket.id, internalNote);
    if (result.error || !result.data) setFeedback({ type: "error", message: result.error ?? "No se pudo agregar la nota interna." });
    else {
      setInternalNote("");
      setMessages((current) => [...current, result.data as SupportTicketMessage]);
      setFeedback({ type: "success", message: "Nota interna agregada." });
    }
    setIsSubmitting(false);
  }

  async function changeStatus(nextStatus: SupportTicketStatus) {
    if (!selectedTicket) return;
    const result = await updateSupportTicketStatus(selectedTicket.id, nextStatus);
    if (result.error) setFeedback({ type: "error", message: result.error });
    else {
      const updatedTicket = { ...selectedTicket, status: nextStatus };
      setSelectedTicket(updatedTicket);
      setTickets((current) => current.map((ticket) => (ticket.id === selectedTicket.id ? updatedTicket : ticket)));
      setFeedback({ type: "success", message: "Estado actualizado correctamente." });
    }
  }

  async function assignTicket(userId: string) {
    if (!selectedTicket) return;
    const assignedTo = userId === "unassigned" ? null : userId;
    const result = await assignSupportTicket(selectedTicket.id, assignedTo);
    if (result.error) setFeedback({ type: "error", message: result.error });
    else {
      setSelectedTicket({ ...selectedTicket, assigned_to: assignedTo });
      setFeedback({ type: "success", message: "Responsable actualizado." });
    }
  }

  const summary = {
    total: tickets.length,
    open: tickets.filter((ticket) => ticket.status === "open").length,
    inProgress: tickets.filter((ticket) => ticket.status === "in_progress").length,
    resolved: tickets.filter((ticket) => ticket.status === "resolved").length,
    urgent: tickets.filter((ticket) => ticket.priority === "urgent").length,
  };

  if (isLoading) return <Card><p className="text-sm font-semibold text-slate-600">Cargando soporte administrativo...</p></Card>;
  if (!currentUser) return <Card className="text-center"><ShieldAlert className="mx-auto h-10 w-10 text-ulv-blue" aria-hidden="true" /><h2 className="mt-3 text-xl font-black text-ulv-blue">Debes iniciar sesión para acceder al panel administrativo.</h2><Link href="/login?redirect=/admin/soporte" className="mt-5 inline-flex min-h-12 items-center justify-center rounded-2xl bg-ulv-yellow px-5 py-3 text-sm font-bold text-ulv-blue">Iniciar sesión</Link></Card>;
  if (!canAccess(currentUser.role)) return <Card className="text-center"><ShieldAlert className="mx-auto h-10 w-10 text-red-700" aria-hidden="true" /><h2 className="mt-3 text-xl font-black text-red-700">No tienes permisos para acceder a esta sección.</h2></Card>;

  return <div className="space-y-5 pb-24 md:pb-0">{feedback ? <p className={`rounded-2xl p-4 text-sm font-bold ${feedback.type === "success" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>{feedback.message}</p> : null}<Card><div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><h2 className="text-xl font-black text-ulv-blue">Soporte</h2><p className="mt-1 text-sm text-slate-600">Gestiona solicitudes e incidencias reportadas por usuarios.</p></div><button type="button" onClick={() => void loadData({ showLoading: false })} disabled={isRefreshing} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-ulv-yellow px-5 py-3 text-sm font-bold text-ulv-blue disabled:opacity-60"><RefreshCw className={`h-5 w-5 ${isRefreshing ? "animate-spin" : ""}`} aria-hidden="true" />Refrescar</button></div></Card><Card className="p-3"><div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => setActiveTab("summary")} className={`min-h-11 rounded-2xl px-4 py-2 text-sm font-black ${activeTab === "summary" ? "bg-ulv-yellow text-ulv-blue" : "border border-slate-200 bg-white text-ulv-blue"}`}>Resumen</button><button type="button" onClick={() => setActiveTab("tickets")} className={`min-h-11 rounded-2xl px-4 py-2 text-sm font-black ${activeTab === "tickets" ? "bg-ulv-yellow text-ulv-blue" : "border border-slate-200 bg-white text-ulv-blue"}`}>Tickets</button></div></Card>{activeTab === "summary" ? <div className="grid grid-cols-2 gap-3 md:grid-cols-5"><StatCard label="Total de tickets" value={String(summary.total)} detail="Filtrados" /><StatCard label="Abiertos" value={String(summary.open)} detail="Sin atender" /><StatCard label="En proceso" value={String(summary.inProgress)} detail="En seguimiento" /><StatCard label="Resueltos" value={String(summary.resolved)} detail="Marcados" /><StatCard label="Urgentes" value={String(summary.urgent)} detail="Prioridad alta" /></div> : null}{activeTab === "tickets" ? <Card><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5"><div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5"><DropdownSelect label="Biblioteca" options={[{ label: "Todas", value: "all" }, ...libraries.map((library) => ({ label: library.name, value: library.id }))]} value={libraryId} onChange={setLibraryId} /></div><label><span className="text-sm font-bold text-ulv-blue">Estado</span><select value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)} className={fieldClass}><option value="all">Todos</option>{Object.entries(supportStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label><span className="text-sm font-bold text-ulv-blue">Categoría</span><select value={category} onChange={(event) => setCategory(event.target.value as CategoryFilter)} className={fieldClass}><option value="all">Todas</option>{Object.entries(supportCategoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label><span className="text-sm font-bold text-ulv-blue">Prioridad</span><select value={priority} onChange={(event) => setPriority(event.target.value as PriorityFilter)} className={fieldClass}><option value="all">Todas</option>{Object.entries(supportPriorityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label><span className="text-sm font-bold text-ulv-blue">Búsqueda</span><span className="relative mt-2 block"><Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" /><input value={search} onChange={(event) => setSearch(event.target.value)} className="min-h-12 w-full rounded-2xl border border-slate-200 pl-11 pr-4 text-sm font-semibold" /></span></label></div><button type="button" onClick={() => void loadData({ showLoading: false })} className="mt-4 min-h-11 rounded-2xl bg-ulv-yellow px-4 py-2 text-sm font-black text-ulv-blue">Aplicar filtros</button><div className="mt-5 space-y-3 md:hidden">{tickets.map((ticket) => <article key={ticket.id} className="rounded-2xl border border-slate-200 p-4"><h3 className="font-black text-ulv-blue">{ticket.subject}</h3><p className="mt-1 text-sm text-slate-600">{ticket.requester?.email ?? "Sin correo"}</p><p className="mt-2 text-sm text-slate-600">{ticket.libraries?.name ?? "General"} · {supportStatusLabels[ticket.status]} · {supportPriorityLabels[ticket.priority]}</p><button type="button" onClick={() => void openTicket(ticket)} className="mt-4 min-h-11 w-full rounded-xl bg-ulv-yellow px-3 py-2 text-sm font-black text-ulv-blue">Gestionar</button></article>)}</div><div className="mt-5 hidden overflow-x-auto rounded-2xl border border-slate-200 md:block"><table className="min-w-[1100px] w-full text-left text-sm"><thead className="bg-ulv-blue text-white"><tr><th className="px-4 py-3">Fecha</th><th className="px-4 py-3">Usuario</th><th className="px-4 py-3">Correo</th><th className="px-4 py-3">Biblioteca</th><th className="px-4 py-3">Asunto</th><th className="px-4 py-3">Categoría</th><th className="px-4 py-3">Prioridad</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3">Acciones</th></tr></thead><tbody className="divide-y divide-slate-200 bg-white">{tickets.length === 0 ? <tr><td colSpan={9} className="px-4 py-8 text-center font-semibold text-slate-500">No hay tickets con los filtros seleccionados.</td></tr> : tickets.map((ticket) => <tr key={ticket.id}><td className="px-4 py-3">{formatDate(ticket.created_at)}</td><td className="px-4 py-3 font-bold text-ulv-blue">{ticket.requester?.name ?? "Sin nombre"}</td><td className="px-4 py-3">{ticket.requester?.email ?? "Sin correo"}</td><td className="px-4 py-3">{ticket.libraries?.name ?? "General"}</td><td className="px-4 py-3 font-black text-ulv-blue">{ticket.subject}</td><td className="px-4 py-3">{supportCategoryLabels[ticket.category]}</td><td className="px-4 py-3">{supportPriorityLabels[ticket.priority]}</td><td className="px-4 py-3 font-bold">{supportStatusLabels[ticket.status]}</td><td className="px-4 py-3"><button type="button" onClick={() => void openTicket(ticket)} className="rounded-xl bg-ulv-yellow px-3 py-2 text-xs font-black text-ulv-blue">Gestionar</button></td></tr>)}</tbody></table></div></Card> : null}{selectedTicket ? <div className="fixed inset-0 z-50 flex items-end bg-slate-950/50 p-3 md:items-center md:justify-center" role="dialog" aria-modal="true"><div className="max-h-[92vh] w-full overflow-y-auto rounded-3xl bg-white p-5 shadow-xl md:max-w-4xl"><div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between"><div><p className="text-sm font-bold text-ulv-yellow">Ticket de soporte</p><h3 className="text-2xl font-black text-ulv-blue">{selectedTicket.subject}</h3><p className="mt-1 text-sm text-slate-600">{selectedTicket.requester?.email ?? "Sin correo"} · {supportStatusLabels[selectedTicket.status]}</p></div><button type="button" onClick={() => setSelectedTicket(null)} className="min-h-11 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-black text-ulv-blue">Cerrar</button></div><p className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">{selectedTicket.description}</p><div className="mt-5 grid gap-3 md:grid-cols-2"><label><span className="text-sm font-bold text-ulv-blue">Estado</span><select value={selectedTicket.status} onChange={(event) => void changeStatus(event.target.value as SupportTicketStatus)} className={fieldClass}>{Object.entries(supportStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5"><DropdownSelect label="Responsable" options={[{ label: "Sin asignar", value: "unassigned" }, ...staffUsers.map((user) => ({ label: user.name ?? user.email ?? user.id, value: user.id }))]} value={selectedTicket.assigned_to ?? "unassigned"} onChange={(value) => void assignTicket(value)} /></div></div><div className="mt-5 space-y-3">{messages.map((message) => <article key={message.id} className={`rounded-2xl border p-4 ${message.is_internal ? "border-ulv-yellow bg-ulv-yellow/10" : "border-slate-200 bg-white"}`}><p className="text-xs font-black text-ulv-blue">{message.is_internal ? "Nota interna" : "Respuesta"} · {message.author?.name ?? message.author?.email ?? "Soporte"} · {formatDate(message.created_at)}</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{message.message}</p></article>)}</div><div className="mt-5 grid gap-4 md:grid-cols-2"><label><span className="text-sm font-bold text-ulv-blue">Responder al usuario</span><textarea value={reply} onChange={(event) => setReply(event.target.value)} rows={4} className={`${fieldClass} py-3`} /></label><label><span className="text-sm font-bold text-ulv-blue">Nota interna</span><textarea value={internalNote} onChange={(event) => setInternalNote(event.target.value)} rows={4} className={`${fieldClass} py-3`} /></label></div><div className="mt-4 flex flex-col gap-3 sm:flex-row"><button type="button" onClick={() => void sendReply()} disabled={isSubmitting} className="min-h-11 rounded-2xl bg-ulv-yellow px-4 py-2 text-sm font-black text-ulv-blue disabled:opacity-60">Enviar respuesta</button><button type="button" onClick={() => void sendInternalNote()} disabled={isSubmitting} className="min-h-11 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-black text-ulv-blue disabled:opacity-60">Agregar nota interna</button></div></div></div> : null}</div>;
}
