"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Mail, RefreshCw, Search, ShieldAlert } from "lucide-react";
import { Card } from "@/app/ui/Card";
import { getCurrentAppUser, type AdminAppUser, type AppUserRole } from "@/services/admin-users.service";
import { getEmailNotifications, type EmailNotification, type EmailNotificationStatus, type EmailNotificationType } from "@/services/email-notifications.service";

type StatusFilter = "all" | EmailNotificationStatus;
type TypeFilter = "all" | EmailNotificationType;
type Feedback = { type: "error" | "success"; message: string };

const statusLabels: Record<EmailNotificationStatus, string> = {
  queued: "En cola",
  sent: "Enviado",
  failed: "Fallido",
  skipped: "Omitido",
};

const typeLabels: Record<EmailNotificationType, string> = {
  system: "Sistema",
  reservation: "Reserva",
  attendance: "Asistencia",
  announcement: "Aviso",
};

function canAccessEmails(role: AppUserRole) {
  return role === "admin" || role === "superadmin";
}

function formatDateTime(value: string | null) {
  if (!value) return "Sin fecha";
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function getStatusClassName(status: EmailNotificationStatus) {
  if (status === "sent") return "bg-green-50 text-green-800";
  if (status === "failed") return "bg-red-50 text-red-800";
  if (status === "skipped") return "bg-slate-100 text-slate-700";
  return "bg-ulv-yellow text-ulv-blue";
}

export function AdminEmailsPanel() {
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentUser, setCurrentUser] = useState<AdminAppUser | null>(null);
  const [emails, setEmails] = useState<EmailNotification[]>([]);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [type, setType] = useState<TypeFilter>("all");
  const [date, setDate] = useState("");
  const [search, setSearch] = useState("");
  const [selectedEmail, setSelectedEmail] = useState<EmailNotification | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  async function loadData({ showLoading = true } = {}) {
    if (showLoading) setIsLoading(true);
    else setIsRefreshing(true);
    setFeedback(null);

    const userResult = await getCurrentAppUser();
    setCurrentUser(userResult.data);

    if (!userResult.data || !canAccessEmails(userResult.data.role)) {
      if (userResult.error) setFeedback({ type: "error", message: userResult.error });
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    const result = await getEmailNotifications({ status, type, date, search, limit: 200 });
    setEmails(result.data);
    if (result.error) setFeedback({ type: "error", message: result.error });
    setIsLoading(false);
    setIsRefreshing(false);
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadData();
    }, 0);
    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const summary = {
    queued: emails.filter((email) => email.status === "queued").length,
    sent: emails.filter((email) => email.status === "sent").length,
    failed: emails.filter((email) => email.status === "failed").length,
    skipped: emails.filter((email) => email.status === "skipped").length,
  };

  if (isLoading) return <Card><p className="text-sm font-semibold text-slate-600">Cargando correos...</p></Card>;

  if (!currentUser) {
    return (
      <Card className="text-center">
        <ShieldAlert className="mx-auto h-10 w-10 text-ulv-blue" aria-hidden="true" />
        <h2 className="mt-3 text-xl font-black text-ulv-blue">Debes iniciar sesión para acceder al panel administrativo.</h2>
        <Link href="/login?redirect=/admin/correos" className="mt-5 inline-flex min-h-12 items-center justify-center rounded-2xl bg-ulv-yellow px-5 py-3 text-sm font-bold text-ulv-blue shadow-sm transition hover:bg-[#e8b800]">Iniciar sesión</Link>
      </Card>
    );
  }

  if (!canAccessEmails(currentUser.role)) {
    return <Card className="text-center"><ShieldAlert className="mx-auto h-10 w-10 text-red-700" aria-hidden="true" /><h2 className="mt-3 text-xl font-black text-red-700">No tienes permisos para ver los correos del sistema.</h2></Card>;
  }

  return (
    <div className="space-y-5 pb-24 md:pb-0">
      {feedback ? <p className={`rounded-2xl p-4 text-sm font-bold ${feedback.type === "success" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>{feedback.message}</p> : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card><p className="text-sm font-bold text-slate-500">Correos en cola</p><p className="mt-2 text-4xl font-black text-ulv-blue">{summary.queued}</p></Card>
        <Card><p className="text-sm font-bold text-slate-500">Correos enviados</p><p className="mt-2 text-4xl font-black text-ulv-blue">{summary.sent}</p></Card>
        <Card><p className="text-sm font-bold text-slate-500">Correos fallidos</p><p className="mt-2 text-4xl font-black text-ulv-blue">{summary.failed}</p></Card>
        <Card><p className="text-sm font-bold text-slate-500">Correos omitidos</p><p className="mt-2 text-4xl font-black text-ulv-blue">{summary.skipped}</p></Card>
      </div>

      <Card>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-ulv-yellow text-ulv-blue"><Mail className="h-6 w-6" aria-hidden="true" /></span>
            <div><h2 className="text-xl font-black text-ulv-blue">Historial de correos</h2><p className="mt-1 text-sm text-slate-600">Consulta el estado de la cola de correos del sistema.</p></div>
          </div>
          <button type="button" onClick={() => void loadData({ showLoading: false })} disabled={isRefreshing} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-ulv-yellow px-5 py-3 text-sm font-bold text-ulv-blue disabled:opacity-60 md:w-auto"><RefreshCw className={`h-5 w-5 ${isRefreshing ? "animate-spin" : ""}`} aria-hidden="true" />{isRefreshing ? "Actualizando..." : "Refrescar"}</button>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label><span className="text-sm font-bold text-ulv-blue">Estado</span><select value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)} className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-bold"><option value="all">Todos</option><option value="queued">En cola</option><option value="sent">Enviados</option><option value="failed">Fallidos</option><option value="skipped">Omitidos</option></select></label>
          <label><span className="text-sm font-bold text-ulv-blue">Tipo</span><select value={type} onChange={(event) => setType(event.target.value as TypeFilter)} className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-bold"><option value="all">Todos</option><option value="system">Sistema</option><option value="reservation">Reserva</option><option value="attendance">Asistencia</option><option value="announcement">Aviso</option></select></label>
          <label><span className="text-sm font-bold text-ulv-blue">Fecha</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-bold" /></label>
          <label><span className="text-sm font-bold text-ulv-blue">Búsqueda</span><span className="relative mt-2 block"><Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Correo o asunto" className="min-h-12 w-full rounded-2xl border border-slate-200 pl-11 pr-4 text-sm font-semibold" /></span></label>
        </div>
        <button type="button" onClick={() => void loadData({ showLoading: false })} className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-ulv-blue px-5 py-3 text-sm font-bold text-white md:w-auto">Aplicar filtros</button>
      </Card>

      <div className="space-y-3 md:hidden">
        {emails.length === 0 ? <Card><p className="text-center text-sm font-semibold text-slate-500">No hay correos con los filtros seleccionados.</p></Card> : null}
        {emails.map((email) => <Card key={email.id}><p className="text-xs font-bold text-slate-500">{formatDateTime(email.created_at)}</p><h3 className="mt-2 break-words text-base font-black text-ulv-blue">{email.subject}</h3><p className="mt-1 break-words text-sm font-semibold text-slate-600">{email.to_email}</p><div className="mt-3 flex flex-wrap gap-2"><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">{typeLabels[email.type]}</span><span className={`rounded-full px-3 py-1 text-xs font-black ${getStatusClassName(email.status)}`}>{statusLabels[email.status]}</span><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">Intentos: {email.attempts}</span></div>{email.last_error ? <p className="mt-3 rounded-2xl bg-red-50 p-3 text-xs font-bold text-red-800">{email.last_error}</p> : null}<button type="button" onClick={() => setSelectedEmail(email)} className="mt-4 min-h-11 w-full rounded-2xl bg-ulv-yellow px-4 py-2 text-sm font-black text-ulv-blue">Ver detalle</button></Card>)}
      </div>

      <Card className="hidden md:block">
        <table className="w-full table-fixed text-left text-sm"><thead className="bg-ulv-blue text-white"><tr><th className="rounded-l-2xl px-3 py-3">Fecha</th><th className="px-3 py-3">Destinatario</th><th className="px-3 py-3">Asunto</th><th className="px-3 py-3">Tipo</th><th className="px-3 py-3">Estado</th><th className="px-3 py-3">Intentos</th><th className="px-3 py-3">Error</th><th className="rounded-r-2xl px-3 py-3">Detalle</th></tr></thead><tbody className="divide-y divide-slate-200">{emails.length === 0 ? <tr><td colSpan={8} className="px-3 py-8 text-center font-semibold text-slate-500">No hay correos con los filtros seleccionados.</td></tr> : emails.map((email) => <tr key={email.id}><td className="px-3 py-3 align-top">{formatDateTime(email.created_at)}</td><td className="break-words px-3 py-3 align-top font-semibold text-slate-700">{email.to_email}</td><td className="break-words px-3 py-3 align-top font-black text-ulv-blue">{email.subject}</td><td className="px-3 py-3 align-top">{typeLabels[email.type]}</td><td className="px-3 py-3 align-top"><span className={`rounded-full px-3 py-1 text-xs font-black ${getStatusClassName(email.status)}`}>{statusLabels[email.status]}</span></td><td className="px-3 py-3 align-top font-bold">{email.attempts}</td><td className="break-words px-3 py-3 align-top text-xs text-red-700">{email.last_error ?? "Sin error"}</td><td className="px-3 py-3 align-top"><button type="button" onClick={() => setSelectedEmail(email)} className="rounded-xl bg-ulv-yellow px-3 py-2 text-xs font-black text-ulv-blue">Ver detalle</button></td></tr>)}</tbody></table>
      </Card>

      {selectedEmail ? <div className="fixed inset-0 z-50 flex items-end bg-slate-950/50 p-3 md:items-center md:justify-center" role="dialog" aria-modal="true" aria-label="Detalle de correo"><div className="max-h-[92vh] w-full overflow-y-auto rounded-3xl bg-white p-5 shadow-xl md:max-w-3xl"><div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between"><div><p className="text-sm font-bold text-ulv-yellow">Correo</p><h3 className="text-2xl font-black text-ulv-blue">Detalle del correo</h3></div><button type="button" onClick={() => setSelectedEmail(null)} className="min-h-11 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-black text-ulv-blue">Cerrar</button></div><dl className="mt-5 grid grid-cols-1 gap-3 text-sm md:grid-cols-2"><div><dt className="font-black text-ulv-blue">Destinatario</dt><dd className="break-words">{selectedEmail.to_email}</dd></div><div><dt className="font-black text-ulv-blue">Estado</dt><dd>{statusLabels[selectedEmail.status]}</dd></div><div><dt className="font-black text-ulv-blue">Tipo</dt><dd>{typeLabels[selectedEmail.type]}</dd></div><div><dt className="font-black text-ulv-blue">Intentos</dt><dd>{selectedEmail.attempts}</dd></div><div className="md:col-span-2"><dt className="font-black text-ulv-blue">Asunto</dt><dd className="break-words">{selectedEmail.subject}</dd></div><div className="md:col-span-2"><dt className="font-black text-ulv-blue">Error</dt><dd className="break-words">{selectedEmail.last_error ?? "Sin error"}</dd></div></dl><pre className="mt-4 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-2xl bg-slate-950 p-4 text-sm leading-6 text-slate-100">{selectedEmail.body}</pre></div></div> : null}
    </div>
  );
}
