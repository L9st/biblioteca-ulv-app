"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { MessageSquare, RefreshCw, ShieldAlert } from "lucide-react";
import { Card } from "@/app/ui/Card";
import { DropdownSelect } from "@/app/ui/DropdownSelect";
import { supabase } from "@/lib/supabase";
import { OFFLINE_ACTION_MESSAGE } from "@/lib/offline";
import {
  addSupportTicketMessage,
  createSupportTicket,
  getMySupportTickets,
  getSupportLibraries,
  getSupportTicketMessages,
  supportCategoryLabels,
  supportPriorityLabels,
  supportStatusLabels,
  type SupportLibrary,
  type SupportTicket,
  type SupportTicketCategory,
  type SupportTicketMessage,
  type SupportTicketPriority,
} from "@/services/support.service";

type ActiveTab = "mine" | "new";
type Feedback = { type: "success" | "error"; message: string };

const fieldClass = "mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-ulv-blue focus:ring-2 focus:ring-ulv-blue/15 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400";

function formatDate(value: string | null) {
  if (!value) return "Sin actualización";
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function getStatusClassName(status: string) {
  if (status === "resolved") return "bg-green-50 text-green-700";
  if (status === "closed") return "bg-slate-100 text-slate-700";
  if (status === "in_progress") return "bg-ulv-blue/10 text-ulv-blue";
  return "bg-ulv-yellow/25 text-ulv-blue";
}

export function SupportPanel() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("mine");
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [libraries, setLibraries] = useState<SupportLibrary[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportTicketMessage[]>([]);
  const [libraryId, setLibraryId] = useState("general");
  const [category, setCategory] = useState<SupportTicketCategory>("other");
  const [priority, setPriority] = useState<SupportTicketPriority>("normal");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [reply, setReply] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  async function loadData() {
    setIsLoading(true);
    const { data } = await supabase.auth.getSession();
    const hasSession = Boolean(data.session);
    setIsAuthenticated(hasSession);
    if (!hasSession) {
      setIsLoading(false);
      return;
    }
    const [ticketsResult, librariesResult] = await Promise.all([getMySupportTickets(), getSupportLibraries()]);
    setTickets(ticketsResult.data);
    setLibraries(librariesResult.data);
    if (ticketsResult.error || librariesResult.error) setFeedback({ type: "error", message: ticketsResult.error ?? librariesResult.error ?? "No se pudo cargar soporte." });
    setIsLoading(false);
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => { void loadData(); }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (feedback?.message !== OFFLINE_ACTION_MESSAGE) return;
    const timeout = window.setTimeout(() => setFeedback(null), 4500);
    return () => window.clearTimeout(timeout);
  }, [feedback]);

  async function openTicket(ticket: SupportTicket) {
    setSelectedTicket(ticket);
    const result = await getSupportTicketMessages(ticket.id);
    setMessages(result.data);
    if (result.error) setFeedback({ type: "error", message: result.error });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    const result = await createSupportTicket({ library_id: libraryId === "general" ? null : libraryId, category, priority, subject, description });
    if (result.error || !result.data) setFeedback({ type: "error", message: result.error ?? "No se pudo enviar la solicitud." });
    else {
      setFeedback({ type: "success", message: "Solicitud enviada correctamente." });
      setSubject("");
      setDescription("");
      setPriority("normal");
      setCategory("other");
      setLibraryId("general");
      setTickets((current) => [result.data as SupportTicket, ...current]);
      setActiveTab("mine");
    }
    setIsSubmitting(false);
  }

  async function handleReply() {
    if (!selectedTicket) return;
    setIsSubmitting(true);
    const result = await addSupportTicketMessage(selectedTicket.id, reply);
    if (result.error || !result.data) setFeedback({ type: "error", message: result.error ?? "No se pudo responder." });
    else {
      setReply("");
      setMessages((current) => [...current, result.data as SupportTicketMessage]);
      setFeedback({ type: "success", message: "Respuesta enviada correctamente." });
    }
    setIsSubmitting(false);
  }

  if (isLoading) return <Card><p className="text-sm text-slate-500">Cargando soporte...</p></Card>;
  if (!isAuthenticated) return <Card className="text-center"><ShieldAlert className="mx-auto h-10 w-10 text-ulv-blue" aria-hidden="true" /><h2 className="mt-3 text-xl font-black text-ulv-blue">Debes iniciar sesión para enviar una solicitud de soporte.</h2><Link href="/login?redirect=/soporte" className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-ulv-yellow px-4 py-2 text-sm font-semibold text-ulv-blue shadow-sm transition hover:brightness-95">Iniciar sesión</Link></Card>;

  return (
    <div className="space-y-5 pb-24 md:pb-0">
      {feedback ? <p className={`rounded-2xl border p-4 text-sm ${feedback.type === "success" ? "border-green-100 bg-green-50 text-green-700" : "border-red-100 bg-red-50 text-red-700"}`}>{feedback.message}</p> : null}
      <Card className="p-3"><div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => setActiveTab("mine")} className={`min-h-11 rounded-2xl px-4 py-2 text-sm font-black ${activeTab === "mine" ? "bg-ulv-yellow text-ulv-blue" : "border border-slate-200 bg-white text-ulv-blue"}`}>Mis solicitudes</button><button type="button" onClick={() => setActiveTab("new")} className={`min-h-11 rounded-2xl px-4 py-2 text-sm font-black ${activeTab === "new" ? "bg-ulv-yellow text-ulv-blue" : "border border-slate-200 bg-white text-ulv-blue"}`}>Nueva solicitud</button></div></Card>

      {activeTab === "mine" ? <Card><div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><h2 className="text-xl font-black text-ulv-blue">Mis solicitudes</h2><p className="mt-1 text-sm text-slate-600">Consulta el estado y responde a tus tickets.</p></div><button type="button" onClick={() => void loadData()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-ulv-yellow px-4 py-2 text-sm font-semibold text-ulv-blue shadow-sm transition hover:brightness-95"><RefreshCw className="h-4 w-4" aria-hidden="true" />Actualizar</button></div>{tickets.length === 0 ? <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">No tienes solicitudes registradas.</p> : null}<div className="space-y-3 md:hidden">{tickets.map((ticket) => <article key={ticket.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><h3 className="text-base font-black text-ulv-blue">{ticket.subject}</h3><span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${getStatusClassName(ticket.status)}`}>{supportStatusLabels[ticket.status]}</span></div><p className="mt-2 text-sm text-slate-600">{ticket.libraries?.name ?? "General"} · {supportCategoryLabels[ticket.category]} · {supportPriorityLabels[ticket.priority]}</p><p className="mt-2 text-xs font-semibold text-slate-500">{formatDate(ticket.created_at)}</p><button type="button" onClick={() => void openTicket(ticket)} className="mt-4 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-ulv-blue shadow-sm transition hover:bg-slate-50">Ver detalle</button></article>)}</div><div className="hidden overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-sm md:block"><table className="min-w-[900px] w-full text-left text-sm"><thead className="bg-ulv-blue text-white"><tr><th className="px-4 py-3">Asunto</th><th className="px-4 py-3">Biblioteca</th><th className="px-4 py-3">Categoría</th><th className="px-4 py-3">Prioridad</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3">Fecha</th><th className="px-4 py-3">Última actualización</th><th className="px-4 py-3">Acciones</th></tr></thead><tbody className="divide-y divide-slate-100 bg-white">{tickets.map((ticket) => <tr key={ticket.id}><td className="px-4 py-3 font-black text-ulv-blue">{ticket.subject}</td><td className="px-4 py-3">{ticket.libraries?.name ?? "General"}</td><td className="px-4 py-3">{supportCategoryLabels[ticket.category]}</td><td className="px-4 py-3">{supportPriorityLabels[ticket.priority]}</td><td className="px-4 py-3"><span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${getStatusClassName(ticket.status)}`}>{supportStatusLabels[ticket.status]}</span></td><td className="px-4 py-3">{formatDate(ticket.created_at)}</td><td className="px-4 py-3">{formatDate(ticket.updated_at)}</td><td className="px-4 py-3"><button type="button" onClick={() => void openTicket(ticket)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-ulv-blue shadow-sm transition hover:bg-slate-50">Ver detalle</button></td></tr>)}</tbody></table></div></Card> : null}

      {activeTab === "new" ? <Card><div className="mb-5 flex items-start gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-ulv-yellow text-ulv-blue"><MessageSquare className="h-5 w-5" aria-hidden="true" /></span><div><h2 className="text-xl font-black text-ulv-blue">Nueva solicitud</h2><p className="mt-1 text-sm text-slate-600">Describe el problema para que el personal pueda ayudarte.</p></div></div><form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2"><div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5"><DropdownSelect label="Biblioteca relacionada" options={[{ label: "Problema general", value: "general" }, ...libraries.map((library) => ({ label: library.name, value: library.id }))]} value={libraryId} onChange={setLibraryId} /></div><label><span className="text-sm font-bold text-ulv-blue">Categoría</span><select value={category} onChange={(event) => setCategory(event.target.value as SupportTicketCategory)} className={fieldClass}>{Object.entries(supportCategoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label><span className="text-sm font-bold text-ulv-blue">Prioridad</span><select value={priority} onChange={(event) => setPriority(event.target.value as SupportTicketPriority)} className={fieldClass}>{Object.entries(supportPriorityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label><span className="text-sm font-bold text-ulv-blue">Asunto</span><input required value={subject} onChange={(event) => setSubject(event.target.value)} className={fieldClass} /></label><label className="md:col-span-2"><span className="text-sm font-bold text-ulv-blue">Descripción</span><textarea required rows={5} value={description} onChange={(event) => setDescription(event.target.value)} className={`${fieldClass} py-3`} /></label><div className="md:col-span-2"><button disabled={isSubmitting} className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-ulv-yellow px-5 py-3 text-sm font-black text-ulv-blue disabled:opacity-60 sm:w-auto">{isSubmitting ? "Enviando..." : "Enviar solicitud"}</button></div></form></Card> : null}

      {selectedTicket ? <div className="fixed inset-0 z-50 flex items-end bg-slate-950/50 p-3 md:items-center md:justify-center" role="dialog" aria-modal="true"><div className="max-h-[92vh] w-full overflow-y-auto rounded-3xl bg-white p-5 shadow-xl md:max-w-3xl"><div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between"><div><p className="text-sm font-bold text-ulv-yellow">Solicitud</p><h3 className="text-2xl font-black text-ulv-blue">{selectedTicket.subject}</h3><p className="mt-1 text-sm text-slate-600">{supportStatusLabels[selectedTicket.status]} · {supportPriorityLabels[selectedTicket.priority]}</p></div><button type="button" onClick={() => setSelectedTicket(null)} className="min-h-11 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-black text-ulv-blue">Cerrar</button></div><p className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">{selectedTicket.description}</p><div className="mt-5 space-y-3">{messages.map((message) => <article key={message.id} className="rounded-2xl border border-slate-200 p-4"><p className="text-xs font-black text-ulv-blue">{message.author?.name ?? message.author?.email ?? "Soporte"} · {formatDate(message.created_at)}</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{message.message}</p></article>)}{messages.length === 0 ? <p className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">Aún no hay mensajes.</p> : null}</div>{selectedTicket.status !== "closed" ? <div className="mt-5"><label><span className="text-sm font-bold text-ulv-blue">Responder</span><textarea value={reply} onChange={(event) => setReply(event.target.value)} rows={4} className={`${fieldClass} py-3`} /></label><button type="button" onClick={() => void handleReply()} disabled={isSubmitting} className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-ulv-yellow px-4 py-2 text-sm font-black text-ulv-blue disabled:opacity-60 sm:w-auto">Responder</button></div> : null}</div></div> : null}
    </div>
  );
}
