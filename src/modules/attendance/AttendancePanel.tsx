"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Clock3, Keyboard, LogIn, LogOut, QrCode } from "lucide-react";
import {
  getCurrentSession,
  getMyAttendanceLogs,
  getMyAttendanceSummary,
  getMyOpenAttendance,
  type AttendanceLog,
  type AttendanceSummary,
} from "@/services/attendance.service";
import { validateAttendanceQrAndToggle } from "@/services/qr.service";
import { Card } from "@/app/ui/Card";
import { StatCard } from "@/app/cards/StatCard";

type Feedback = {
  type: "success" | "error";
  message: string;
};

const emptySummary: AttendanceSummary = {
  todayMinutes: 0,
  weekMinutes: 0,
  monthMinutes: 0,
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatTime(value: string | null) {
  if (!value) {
    return "Pendiente";
  }

  return new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatMinutes(minutes: number | null) {
  if (!minutes || minutes <= 0) {
    return "0 min";
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours === 0) {
    return `${remainingMinutes} min`;
  }

  if (remainingMinutes === 0) {
    return `${hours} h`;
  }

  return `${hours} h ${remainingMinutes} min`;
}

function getCurrentOpenMinutes(openAttendance: AttendanceLog | null) {
  if (!openAttendance) {
    return 0;
  }

  const checkInTime = new Date(openAttendance.check_in_at).getTime();
  return Math.max(0, Math.floor((Date.now() - checkInTime) / 60000));
}

export function AttendancePanel() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [shortCode, setShortCode] = useState("");
  const [openAttendance, setOpenAttendance] = useState<AttendanceLog | null>(null);
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [summary, setSummary] = useState<AttendanceSummary>(emptySummary);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [openMinutes, setOpenMinutes] = useState(0);

  async function loadData() {
    setIsLoading(true);
    const session = await getCurrentSession();
    setIsAuthenticated(Boolean(session));

    if (!session) {
      setIsLoading(false);
      return;
    }

    const [openAttendanceData, logsData, summaryData] = await Promise.all([
      getMyOpenAttendance(),
      getMyAttendanceLogs(),
      getMyAttendanceSummary(),
    ]);

    setOpenAttendance(openAttendanceData);
    setLogs(logsData);
    setSummary(summaryData);
    setOpenMinutes(getCurrentOpenMinutes(openAttendanceData));
    setIsLoading(false);
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadData();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setOpenMinutes(getCurrentOpenMinutes(openAttendance));
    }, 60000);

    return () => window.clearInterval(interval);
  }, [openAttendance]);

  async function handleShortCodeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!shortCode.trim()) {
      setFeedback({ type: "error", message: "Ingresa el código corto mostrado en biblioteca." });
      return;
    }

    setIsSubmitting(true);
    const result = await validateAttendanceQrAndToggle(shortCode);
    const successMessage =
      result.action === "check_in" ? "Entrada registrada correctamente" : "Salida registrada correctamente";

    setFeedback({ type: result.success ? "success" : "error", message: result.success ? successMessage : result.message });
    setShortCode("");
    await loadData();
    setIsSubmitting(false);
  }

  if (isLoading) {
    return (
      <Card>
        <p className="text-sm font-semibold text-slate-600">Cargando tus registros de asistencia...</p>
      </Card>
    );
  }

  if (!isAuthenticated) {
    return (
      <Card className="text-center">
        <h2 className="text-xl font-black text-ulv-blue">Debes iniciar sesión para acceder a esta sección.</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Inicia sesión con tu correo y contraseña para registrar entrada, salida y consultar tus horas.
        </p>
        <Link
          href="/login?redirect=/horas"
          className="mt-5 inline-flex min-h-12 items-center justify-center rounded-2xl bg-ulv-yellow px-5 py-3 text-sm font-bold text-ulv-blue shadow-sm transition hover:bg-[#e8b800]"
        >
          Iniciar sesión
        </Link>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {feedback ? (
        <div
          className={`rounded-2xl p-4 text-sm font-bold ${
            feedback.type === "success" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"
          }`}
        >
          {feedback.message}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Horas de hoy" value={formatMinutes(summary.todayMinutes)} detail="Registros cerrados" />
        <StatCard label="Horas de esta semana" value={formatMinutes(summary.weekMinutes)} detail="Desde lunes" />
        <StatCard label="Horas de este mes" value={formatMinutes(summary.monthMinutes)} detail="Mes actual" />
      </div>

      <Card>
        <div className="flex items-start gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-ulv-yellow text-ulv-blue">
            <Clock3 className="h-6 w-6" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-xl font-black text-ulv-blue">
              {openAttendance ? "Entrada activa" : "No tienes una entrada activa"}
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              {openAttendance
                ? `${openAttendance.libraries?.name ?? "Biblioteca"} - entrada ${formatDateTime(openAttendance.check_in_at)}`
                : "Escanea el QR de biblioteca o ingresa el código corto mostrado en recepción."}
            </p>
          </div>
        </div>

        {openAttendance ? (
          <div className="mt-5 space-y-4">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-500">Tiempo aproximado actual</p>
              <p className="mt-1 text-3xl font-black text-ulv-blue">{formatMinutes(openMinutes)}</p>
            </div>
          </div>
        ) : null}

        <div className="mt-5 md:hidden">
          <Link
            href="/horas/escanear"
            className={`inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl px-5 py-4 text-base font-black shadow-sm transition ${
              openAttendance ? "bg-ulv-blue text-white hover:bg-[#053757]" : "bg-ulv-yellow text-ulv-blue hover:bg-[#e8b800]"
            }`}
          >
            {openAttendance ? <LogOut className="h-5 w-5" aria-hidden="true" /> : <LogIn className="h-5 w-5" aria-hidden="true" />}
            {openAttendance ? "Registrar salida" : "Registrar entrada"}
          </Link>
          <p className="mt-3 text-center text-sm font-semibold text-slate-600">Ingresar código manualmente en versión web.</p>
        </div>

        <form onSubmit={handleShortCodeSubmit} className="mt-5 hidden rounded-3xl bg-slate-50 p-5 md:block">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-ulv-blue shadow-sm">
              <Keyboard className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h3 className="text-lg font-black text-ulv-blue">Ingresa el código corto mostrado en biblioteca</h3>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                El sistema validará el código y decidirá automáticamente si corresponde registrar entrada o salida.
              </p>
            </div>
          </div>
          <label htmlFor="attendance-short-code" className="mt-5 block text-sm font-bold text-slate-700">
            Código corto
          </label>
          <input
            id="attendance-short-code"
            value={shortCode}
            onChange={(event) => setShortCode(event.target.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="482913"
            className="mt-2 min-h-14 w-full rounded-2xl border border-slate-200 bg-white px-4 text-lg font-black tracking-[0.25em] text-ulv-blue outline-none transition focus:border-ulv-blue focus:ring-4 focus:ring-ulv-blue/10"
          />
          <button
            type="submit"
            disabled={isSubmitting || !shortCode.trim()}
            className={`mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60 ${
              openAttendance ? "bg-ulv-blue text-white hover:bg-[#053757]" : "bg-ulv-yellow text-ulv-blue hover:bg-[#e8b800]"
            }`}
          >
            <QrCode className="h-5 w-5" aria-hidden="true" />
            {isSubmitting ? "Validando código..." : openAttendance ? "Registrar salida" : "Registrar entrada"}
          </button>
        </form>
      </Card>

      <Card>
        <h2 className="text-xl font-black text-ulv-blue">Historial reciente</h2>
        {logs.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">Aún no tienes registros de asistencia.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {logs.map((log) => (
              <article key={log.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-ulv-blue">{log.libraries?.name ?? "Biblioteca"}</h3>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" }).format(new Date(log.check_in_at))}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold ${
                      log.status === "open" ? "bg-ulv-yellow text-ulv-blue" : "bg-white text-slate-700"
                    }`}
                  >
                    {log.status === "open" ? "Abierto" : "Cerrado"}
                  </span>
                </div>
                <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <dt className="font-semibold text-slate-500">Entrada</dt>
                    <dd className="mt-1 font-bold text-slate-900">{formatTime(log.check_in_at)}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-slate-500">Salida</dt>
                    <dd className="mt-1 font-bold text-slate-900">{formatTime(log.check_out_at)}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-slate-500">Total</dt>
                    <dd className="mt-1 font-bold text-slate-900">{formatMinutes(log.total_minutes)}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
