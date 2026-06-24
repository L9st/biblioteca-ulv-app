"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Eye, FileClock, RefreshCw, Search, ShieldAlert } from "lucide-react";
import { Card } from "@/app/ui/Card";
import { getAdminAuditLogs, type AuditLog } from "@/services/admin-audit.service";
import { getAdminUsers, getCurrentAppUser, type AdminAppUser, type AppUserRole } from "@/services/admin-users.service";

type ActiveTab = "summary" | "history";
type Feedback = { type: "success" | "error"; message: string };

const moduleLabels: Record<string, string> = {
  reservations: "Reservas",
  users: "Usuarios",
  qr: "QR",
  spaces: "Espacios",
  announcements: "Avisos",
  services: "Servicios",
  help: "Ayuda",
  reports: "Reportes",
  attendance: "Asistencia",
  system: "Sistema",
};

const actionLabels: Record<string, string> = {
  created: "Creado",
  updated: "Actualizado",
  deleted: "Eliminado",
  published: "Publicado",
  archived: "Archivado",
  approved: "Aprobado",
  rejected: "Rechazado",
  cancelled: "Cancelado",
  completed: "Completado",
  role_changed: "Rol cambiado",
  status_changed: "Estado cambiado",
  qr_generated: "QR generado",
  exported: "Exportado",
  login: "Inicio de sesión",
  email_sent: "Correo enviado",
  email_failed: "Correo fallido",
};

const moduleOptions = ["reservations", "users", "qr", "spaces", "announcements", "services", "help", "reports", "attendance", "system"];
const actionOptions = ["created", "updated", "deleted", "published", "archived", "approved", "rejected", "cancelled", "completed", "role_changed", "status_changed", "qr_generated", "exported", "login", "email_sent", "email_failed"];
const summaryModules = ["reservations", "users", "qr", "spaces", "announcements", "services", "help", "reports"];

function canAccess(role: AppUserRole) {
  return role === "librarian" || role === "admin" || role === "superadmin";
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function startOfWeek() {
  const date = startOfToday();
  const day = date.getDay();
  date.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
  return date;
}

function getModuleLabel(module: string) {
  return moduleLabels[module] ?? module;
}

function getActionLabel(action: string) {
  return actionLabels[action] ?? action;
}

function DetailRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3">
      <dt className="text-xs font-black uppercase tracking-wide text-ulv-blue">{label}</dt>
      <dd className="mt-1 break-words text-sm font-semibold text-slate-700">{value || "Sin dato"}</dd>
    </div>
  );
}

export function AdminAuditPanel() {
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentUser, setCurrentUser] = useState<AdminAppUser | null>(null);
  const [users, setUsers] = useState<AdminAppUser[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [activeTab, setActiveTab] = useState<ActiveTab>("summary");
  const [selectedModule, setSelectedModule] = useState("all");
  const [selectedAction, setSelectedAction] = useState("all");
  const [selectedActor, setSelectedActor] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  async function loadData({ showLoading = true } = {}) {
    if (showLoading) setIsLoading(true);
    else setIsRefreshing(true);
    setFeedback(null);

    const userResult = await getCurrentAppUser();
    setCurrentUser(userResult.data);

    if (userResult.error) {
      setFeedback({ type: "error", message: userResult.error });
    }

    if (!userResult.data || !canAccess(userResult.data.role)) {
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    const [logsResult, usersResult] = await Promise.all([
      getAdminAuditLogs({
        module: selectedModule === "all" ? undefined : selectedModule,
        action: selectedAction === "all" ? undefined : selectedAction,
        actor_user_id: selectedActor === "all" ? undefined : selectedActor,
        date_from: dateFrom ? new Date(`${dateFrom}T00:00:00`).toISOString() : undefined,
        date_to: dateTo ? new Date(`${dateTo}T23:59:59`).toISOString() : undefined,
        search,
      }),
      getAdminUsers(),
    ]);

    setLogs(logsResult.data);
    setUsers(usersResult.data);

    if (logsResult.error || usersResult.error) {
      setFeedback({ type: "error", message: logsResult.error ?? usersResult.error ?? "No se pudo cargar la auditoría." });
    }

    setIsLoading(false);
    setIsRefreshing(false);
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadData();
    }, 0);
    return () => window.clearTimeout(timeout);
    // La carga inicial no debe volver a ejecutarse mientras se editan filtros.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const summary = useMemo(() => {
    const today = startOfToday();
    const week = startOfWeek();
    const activeUsers = new Set(logs.map((log) => log.actor_user_id).filter((value): value is string => Boolean(value)));

    return {
      total: logs.length,
      today: logs.filter((log) => new Date(log.created_at) >= today).length,
      week: logs.filter((log) => new Date(log.created_at) >= week).length,
      activeUsers: activeUsers.size,
    };
  }, [logs]);

  if (isLoading) {
    return (
      <Card>
        <p className="text-sm font-semibold text-slate-600">Cargando auditoría...</p>
      </Card>
    );
  }

  if (!currentUser) {
    return (
      <Card className="text-center">
        <ShieldAlert className="mx-auto h-10 w-10 text-ulv-blue" aria-hidden="true" />
        <h2 className="mt-3 text-xl font-black text-ulv-blue">Debes iniciar sesión para acceder al panel administrativo.</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">Inicia sesión con una cuenta autorizada para continuar.</p>
        <Link href="/login?redirect=/admin/auditoria" className="mt-5 inline-flex min-h-12 items-center justify-center rounded-2xl bg-ulv-yellow px-5 py-3 text-sm font-bold text-ulv-blue shadow-sm transition hover:bg-[#e8b800]">
          Iniciar sesión
        </Link>
      </Card>
    );
  }

  if (!canAccess(currentUser.role)) {
    return (
      <Card className="text-center">
        <ShieldAlert className="mx-auto h-10 w-10 text-red-700" aria-hidden="true" />
        <h2 className="mt-3 text-xl font-black text-red-700">No tienes permisos para ver la auditoría.</h2>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {feedback ? <p className={`rounded-2xl p-4 text-sm font-bold ${feedback.type === "success" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>{feedback.message}</p> : null}

      <Card>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-ulv-yellow text-ulv-blue">
              <FileClock className="h-6 w-6" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-xl font-black text-ulv-blue">Historial de acciones administrativas</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">Revisa eventos importantes registrados por personal autorizado.</p>
            </div>
          </div>
          <button type="button" onClick={() => void loadData({ showLoading: false })} disabled={isRefreshing} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-ulv-yellow px-5 py-3 text-sm font-bold text-ulv-blue shadow-sm transition hover:bg-[#e8b800] disabled:opacity-60">
            <RefreshCw className={`h-5 w-5 ${isRefreshing ? "animate-spin" : ""}`} aria-hidden="true" />
            {isRefreshing ? "Actualizando..." : "Refrescar"}
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2 rounded-3xl bg-slate-100 p-1 md:max-w-md">
          <button type="button" onClick={() => setActiveTab("summary")} className={`min-h-11 rounded-2xl px-4 text-sm font-black ${activeTab === "summary" ? "bg-ulv-blue text-white" : "text-ulv-blue"}`}>Resumen</button>
          <button type="button" onClick={() => setActiveTab("history")} className={`min-h-11 rounded-2xl px-4 text-sm font-black ${activeTab === "history" ? "bg-ulv-blue text-white" : "text-ulv-blue"}`}>Historial</button>
        </div>
      </Card>

      {activeTab === "summary" ? (
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              ["Total de acciones", summary.total],
              ["Acciones de hoy", summary.today],
              ["Acciones de esta semana", summary.week],
              ["Usuarios con actividad", summary.activeUsers],
            ].map(([label, value]) => (
              <Card key={label.toString()}>
                <p className="text-sm font-bold text-slate-500">{label}</p>
                <p className="mt-2 text-4xl font-black text-ulv-blue">{value}</p>
              </Card>
            ))}
          </div>

          <Card>
            <h3 className="text-lg font-black text-ulv-blue">Resumen por módulo</h3>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {summaryModules.map((module) => (
                <div key={module} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-sm font-black text-ulv-blue">{getModuleLabel(module)}</p>
                  <p className="mt-2 text-3xl font-black text-slate-900">{logs.filter((log) => log.module === module).length}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      ) : (
        <div className="space-y-5">
          <Card>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
              <label><span className="text-sm font-bold text-ulv-blue">Módulo</span><select value={selectedModule} onChange={(event) => setSelectedModule(event.target.value)} className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-bold"><option value="all">Todos</option>{moduleOptions.map((module) => <option key={module} value={module}>{getModuleLabel(module)}</option>)}</select></label>
              <label><span className="text-sm font-bold text-ulv-blue">Acción</span><select value={selectedAction} onChange={(event) => setSelectedAction(event.target.value)} className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-bold"><option value="all">Todas</option>{actionOptions.map((action) => <option key={action} value={action}>{getActionLabel(action)}</option>)}</select></label>
              <label><span className="text-sm font-bold text-ulv-blue">Usuario</span><select value={selectedActor} onChange={(event) => setSelectedActor(event.target.value)} className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-bold"><option value="all">Todos</option>{users.map((user) => <option key={user.id} value={user.id}>{user.name || user.email}</option>)}</select></label>
              <label><span className="text-sm font-bold text-ulv-blue">Desde</span><input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-bold" /></label>
              <label><span className="text-sm font-bold text-ulv-blue">Hasta</span><input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-bold" /></label>
              <label><span className="text-sm font-bold text-ulv-blue">Búsqueda</span><span className="relative mt-2 block"><Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Descripción o elemento" className="min-h-12 w-full rounded-2xl border border-slate-200 pl-11 pr-4 text-sm font-semibold" /></span></label>
            </div>
            <button type="button" onClick={() => void loadData({ showLoading: false })} className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-ulv-yellow px-5 py-3 text-sm font-bold text-ulv-blue md:w-auto">Aplicar filtros</button>
          </Card>

          <div className="space-y-3 md:hidden">
            {logs.length === 0 ? <Card><p className="text-center text-sm font-semibold text-slate-500">No hay registros con los filtros seleccionados.</p></Card> : null}
            {logs.map((log) => (
              <Card key={log.id}>
                <p className="text-xs font-bold text-slate-500">{formatDateTime(log.created_at)}</p>
                <h3 className="mt-2 text-lg font-black text-ulv-blue">{log.actor?.name ?? log.actor?.email ?? "Usuario no disponible"}</h3>
                <p className="mt-1 text-sm font-semibold text-slate-600">{getModuleLabel(log.module)} · {getActionLabel(log.action)}</p>
                <p className="mt-2 text-sm text-slate-600">{log.entity_label ?? log.description ?? "Sin descripción"}</p>
                <button type="button" onClick={() => setSelectedLog(log)} className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-ulv-blue px-4 py-2 text-sm font-bold text-white"><Eye className="h-4 w-4" aria-hidden="true" />Ver detalle</button>
              </Card>
            ))}
          </div>

          <Card className="hidden md:block">
            <table className="w-full table-fixed text-left text-sm">
              <thead className="bg-ulv-blue text-white">
                <tr><th className="rounded-l-2xl px-3 py-3">Fecha</th><th className="px-3 py-3">Usuario</th><th className="px-3 py-3">Rol</th><th className="px-3 py-3">Módulo</th><th className="px-3 py-3">Acción</th><th className="px-3 py-3">Elemento</th><th className="px-3 py-3">Descripción</th><th className="rounded-r-2xl px-3 py-3">Detalle</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {logs.length === 0 ? <tr><td colSpan={8} className="px-3 py-8 text-center font-semibold text-slate-500">No hay registros con los filtros seleccionados.</td></tr> : null}
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="px-3 py-3 align-top text-slate-600">{formatDateTime(log.created_at)}</td>
                    <td className="px-3 py-3 align-top font-black text-ulv-blue">{log.actor?.name ?? log.actor?.email ?? "Sin usuario"}</td>
                    <td className="px-3 py-3 align-top text-slate-600">{log.actor?.role ?? "Sin rol"}</td>
                    <td className="px-3 py-3 align-top font-semibold">{getModuleLabel(log.module)}</td>
                    <td className="px-3 py-3 align-top font-semibold">{getActionLabel(log.action)}</td>
                    <td className="px-3 py-3 align-top text-slate-600">{log.entity_label ?? "Sin elemento"}</td>
                    <td className="px-3 py-3 align-top text-slate-600">{log.description ?? "Sin descripción"}</td>
                    <td className="px-3 py-3 align-top"><button type="button" onClick={() => setSelectedLog(log)} className="rounded-xl bg-ulv-yellow px-3 py-2 text-xs font-black text-ulv-blue">Ver detalle</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {selectedLog ? (
        <div className="fixed inset-0 z-50 flex items-end bg-slate-950/50 p-3 md:items-center md:justify-center" role="dialog" aria-modal="true" aria-label="Detalle de auditoría">
          <div className="max-h-[92vh] w-full overflow-y-auto rounded-3xl bg-white p-5 shadow-xl md:max-w-3xl">
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-sm font-bold text-ulv-yellow">Auditoría</p><h3 className="text-2xl font-black text-ulv-blue">Detalle del registro</h3></div>
              <button type="button" onClick={() => setSelectedLog(null)} className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-black text-ulv-blue">Cerrar</button>
            </div>
            <dl className="mt-5 grid gap-3 md:grid-cols-2">
              <DetailRow label="ID" value={selectedLog.id} />
              <DetailRow label="Fecha" value={formatDateTime(selectedLog.created_at)} />
              <DetailRow label="Usuario" value={selectedLog.actor?.name ?? null} />
              <DetailRow label="Correo" value={selectedLog.actor?.email ?? null} />
              <DetailRow label="Rol" value={selectedLog.actor?.role ?? null} />
              <DetailRow label="Módulo" value={getModuleLabel(selectedLog.module)} />
              <DetailRow label="Acción" value={getActionLabel(selectedLog.action)} />
              <DetailRow label="Tabla" value={selectedLog.entity_table} />
              <DetailRow label="ID de entidad" value={selectedLog.entity_id} />
              <DetailRow label="Elemento" value={selectedLog.entity_label} />
              <div className="md:col-span-2"><DetailRow label="Descripción" value={selectedLog.description} /></div>
            </dl>
            <div className="mt-3 rounded-2xl bg-slate-950 p-4 text-slate-100">
              <p className="text-xs font-black uppercase tracking-wide text-ulv-yellow">Metadata</p>
              <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words text-xs leading-5">{JSON.stringify(selectedLog.metadata, null, 2)}</pre>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
