"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Clock3, XCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { validateAttendanceQrAndToggle, type AttendanceQrValidation } from "@/services/qr.service";
import { Card } from "@/app/ui/Card";

type QrWebRegisterPanelProps = {
  token: string;
};

function formatDateTime(value: string | null) {
  if (!value) {
    return "No registrado";
  }

  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
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

  return remainingMinutes === 0 ? `${hours} h` : `${hours} h ${remainingMinutes} min`;
}

export function QrWebRegisterPanel({ token }: QrWebRegisterPanelProps) {
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [hasProcessed, setHasProcessed] = useState(false);
  const [result, setResult] = useState<AttendanceQrValidation | null>(null);
  const processedRef = useRef(false);

  const redirectPath = `/horas/qr/${encodeURIComponent(token)}`;

  const processToken = useCallback(async () => {
    if (processedRef.current) {
      return;
    }

    processedRef.current = true;
    setHasProcessed(true);
    setIsValidating(true);
    const validationResult = await validateAttendanceQrAndToggle(token);
    setResult(validationResult);
    setIsValidating(false);
  }, [token]);

  useEffect(() => {
    const timeout = window.setTimeout(async () => {
      const { data } = await supabase.auth.getSession();
      const hasSession = Boolean(data.session);
      setIsAuthenticated(hasSession);
      setIsCheckingSession(false);

      if (hasSession) {
        await processToken();
      }
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [processToken]);

  if (isCheckingSession) {
    return (
      <Card className="text-center">
        <Clock3 className="mx-auto h-10 w-10 text-ulv-blue" aria-hidden="true" />
        <p className="mt-3 text-sm font-bold text-slate-600">Revisando sesión...</p>
      </Card>
    );
  }

  if (!isAuthenticated) {
    return (
      <Card className="text-center">
        <h2 className="text-xl font-black text-ulv-blue">Debes iniciar sesión para registrar tus horas en biblioteca.</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Después de iniciar sesión volverás automáticamente a este QR para registrar entrada o salida.
        </p>
        <Link
          href={`/login?redirect=${encodeURIComponent(redirectPath)}`}
          className="mt-5 inline-flex min-h-12 items-center justify-center rounded-2xl bg-ulv-yellow px-5 py-3 text-sm font-bold text-ulv-blue shadow-sm transition hover:bg-[#e8b800]"
        >
          Iniciar sesión
        </Link>
      </Card>
    );
  }

  if (isValidating || !hasProcessed) {
    return (
      <Card className="text-center">
        <Clock3 className="mx-auto h-10 w-10 animate-pulse text-ulv-blue" aria-hidden="true" />
        <h2 className="mt-3 text-xl font-black text-ulv-blue">Validando QR de asistencia...</h2>
        <p className="mt-2 text-sm text-slate-600">Espera un momento mientras registramos tu movimiento.</p>
      </Card>
    );
  }

  if (!result || !result.success) {
    return (
      <Card className="text-center">
        <XCircle className="mx-auto h-12 w-12 text-red-600" aria-hidden="true" />
        <h2 className="mt-3 text-xl font-black text-red-700">No se pudo registrar el movimiento</h2>
        <p className="mt-2 text-sm leading-6 text-slate-700">
          {result?.message ?? "QR no encontrado o código incorrecto"}
        </p>
        <Link
          href="/horas"
          className="mt-5 inline-flex min-h-12 items-center justify-center rounded-2xl bg-ulv-yellow px-5 py-3 text-sm font-bold text-ulv-blue shadow-sm transition hover:bg-[#e8b800]"
        >
          Ver mis horas
        </Link>
      </Card>
    );
  }

  const isCheckIn = result.action === "check_in";

  return (
    <Card>
      <div className="text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-green-700" aria-hidden="true" />
        <h2 className="mt-3 text-2xl font-black text-ulv-blue">
          {isCheckIn ? "Entrada registrada correctamente" : "Salida registrada correctamente"}
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">{result.message}</p>
      </div>

      <dl className="mt-6 space-y-3 rounded-3xl bg-slate-50 p-4 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="font-bold text-slate-500">Biblioteca</dt>
          <dd className="text-right font-black text-ulv-blue">{result.library_name ?? "Biblioteca"}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="font-bold text-slate-500">Hora de entrada</dt>
          <dd className="text-right font-bold text-slate-900">{formatDateTime(result.check_in_at)}</dd>
        </div>
        {!isCheckIn ? (
          <>
            <div className="flex justify-between gap-4">
              <dt className="font-bold text-slate-500">Hora de salida</dt>
              <dd className="text-right font-bold text-slate-900">{formatDateTime(result.check_out_at)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="font-bold text-slate-500">Tiempo total</dt>
              <dd className="text-right font-black text-ulv-blue">{formatMinutes(result.total_minutes)}</dd>
            </div>
          </>
        ) : null}
      </dl>

      <Link
        href="/horas"
        className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-ulv-yellow px-5 py-3 text-sm font-bold text-ulv-blue shadow-sm transition hover:bg-[#e8b800]"
      >
        Ver mis horas
      </Link>
    </Card>
  );
}
