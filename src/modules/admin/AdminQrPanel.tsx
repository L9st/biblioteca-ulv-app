"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { RefreshCw, ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getCurrentAppUser, type AdminAppUser, type AppUserRole } from "@/services/admin-users.service";
import {
  generateAttendanceQrToken,
  getActiveLibraries,
  type AttendanceQrToken,
  type QrLibrary,
} from "@/services/qr.service";
import { Card } from "@/app/ui/Card";
import { DropdownSelect } from "@/app/ui/DropdownSelect";

const qrExpiresSeconds = 60;

type QrImages = {
  appQr: string;
  webQr: string;
};

type AdminQrPanelProps = {
  publicAppUrl: string;
};

function getSecondsRemaining(expiresAt: string) {
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000));
}

function canManageQr(role: AppUserRole) {
  return role === "librarian" || role === "admin" || role === "superadmin";
}

export function AdminQrPanel({ publicAppUrl }: AdminQrPanelProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<AdminAppUser | null>(null);
  const [libraries, setLibraries] = useState<QrLibrary[]>([]);
  const [selectedLibraryId, setSelectedLibraryId] = useState("");
  const [qrToken, setQrToken] = useState<AttendanceQrToken | null>(null);
  const [qrImages, setQrImages] = useState<QrImages | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadInitialData = useCallback(async () => {
    setIsLoading(true);
    const [{ data }, userResult] = await Promise.all([supabase.auth.getSession(), getCurrentAppUser()]);
    const hasSession = Boolean(data.session);
    setIsAuthenticated(hasSession);
    setCurrentUser(userResult.data);

    if (!hasSession || !userResult.data || !canManageQr(userResult.data.role)) {
      setIsLoading(false);
      return;
    }

    const activeLibraries = await getActiveLibraries();
    setLibraries(activeLibraries);
    setSelectedLibraryId((current) => current || activeLibraries[0]?.id || "");
    setIsLoading(false);
  }, []);

  const buildQrImages = useCallback(async (token: AttendanceQrToken) => {
    const appQrValue = `ULV-ATTENDANCE:${token.token}`;
    const webQrValue = `${publicAppUrl}/horas/qr/${token.token}`;

    const [appQr, webQr] = await Promise.all([
      QRCode.toDataURL(appQrValue, { margin: 2, width: 320 }),
      QRCode.toDataURL(webQrValue, { margin: 2, width: 320 }),
    ]);

    return { appQr, webQr };
  }, [publicAppUrl]);

  const handleGenerate = useCallback(async (libraryId = selectedLibraryId) => {
    if (!libraryId) {
      setError("Selecciona una biblioteca para generar el QR.");
      return;
    }

    setIsGenerating(true);
    setError(null);

    const result = await generateAttendanceQrToken(libraryId, qrExpiresSeconds);

    if (result.error || !result.data) {
      setQrToken(null);
      setQrImages(null);
      setSecondsRemaining(0);
      setError(result.error ?? "No se pudo generar el código QR.");
      setIsGenerating(false);
      return;
    }

    const images = await buildQrImages(result.data);
    setQrToken(result.data);
    setQrImages(images);
    setSecondsRemaining(getSecondsRemaining(result.data.expires_at));
    setIsGenerating(false);
  }, [buildQrImages, selectedLibraryId]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadInitialData();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [loadInitialData]);

  useEffect(() => {
    if (!qrToken) {
      return;
    }

    const interval = window.setInterval(() => {
      setSecondsRemaining(getSecondsRemaining(qrToken.expires_at));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [qrToken]);

  useEffect(() => {
    if (!qrToken || secondsRemaining > 0 || isGenerating) {
      return;
    }

    const timeout = window.setTimeout(() => {
      void handleGenerate(qrToken.library_id);
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [qrToken, secondsRemaining, isGenerating, handleGenerate]);

  if (isLoading) {
    return (
      <Card>
        <p className="text-sm font-semibold text-slate-600">Cargando panel QR...</p>
      </Card>
    );
  }

  if (!isAuthenticated) {
    return (
      <Card className="text-center">
        <h2 className="text-xl font-black text-ulv-blue">Debes iniciar sesión para acceder al panel administrativo.</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Esta pantalla está reservada para personal autorizado de biblioteca.
        </p>
        <Link
          href="/login?redirect=/admin/qr"
          className="mt-5 inline-flex min-h-12 items-center justify-center rounded-2xl bg-ulv-yellow px-5 py-3 text-sm font-bold text-ulv-blue shadow-sm transition hover:bg-[#e8b800]"
        >
          Iniciar sesión
        </Link>
      </Card>
    );
  }

  if (!currentUser || !canManageQr(currentUser.role)) {
    return (
      <Card className="text-center">
        <h2 className="text-xl font-black text-red-700">No tienes permisos para acceder a esta sección.</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">Esta pantalla está reservada para personal autorizado de biblioteca.</p>
      </Card>
    );
  }

  const appQrValue = qrToken ? `ULV-ATTENDANCE:${qrToken.token}` : "";
  const webQrValue = qrToken ? `${publicAppUrl}/horas/qr/${qrToken.token}` : "";
  const libraryOptions = libraries.map((library) => ({ label: library.name, value: library.id }));

  function selectLibrary(libraryId: string) {
    setSelectedLibraryId(libraryId);
    setQrToken(null);
    setQrImages(null);
    setSecondsRemaining(0);
  }

  return (
    <div className="space-y-5">
      <Card>
        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <DropdownSelect
            label="Biblioteca"
            options={libraryOptions}
            value={selectedLibraryId}
            onChange={selectLibrary}
            emptyLabel="No hay bibliotecas activas"
          />

          <button
            type="button"
            onClick={() => void handleGenerate()}
            disabled={isGenerating || !selectedLibraryId}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-ulv-yellow px-5 py-3 text-sm font-bold text-ulv-blue shadow-sm transition hover:bg-[#e8b800] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={`h-5 w-5 ${isGenerating ? "animate-spin" : ""}`} aria-hidden="true" />
            {qrToken ? "Regenerar QR" : "Generar QR"}
          </button>
        </div>

        {error ? <p className="mt-4 rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-800">{error}</p> : null}
      </Card>

      <Card className="bg-ulv-blue text-white">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-ulv-yellow text-ulv-blue">
            <ShieldCheck className="h-6 w-6" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-xl font-black">Estado del QR</h2>
            <p className="mt-2 text-sm text-white/85">QR vigente por: {qrExpiresSeconds} segundos</p>
            <p className="mt-1 text-3xl font-black text-ulv-yellow">
              Vence en: {qrToken ? secondsRemaining : 0} segundos
            </p>
          </div>
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <h2 className="text-xl font-black text-ulv-blue">Opción 1: Usuarios con app</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            El usuario abre la app Biblioteca ULV, entra a Mis horas y selecciona Escanear QR.
          </p>

          <div className="mt-5 flex min-h-80 items-center justify-center rounded-3xl bg-slate-50 p-4">
            {qrImages?.appQr ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrImages.appQr} alt="QR para usuarios con app" className="h-72 w-72 rounded-2xl bg-white p-3" />
            ) : (
              <p className="text-center text-sm font-semibold text-slate-500">Genera un QR para mostrarlo aquí.</p>
            )}
          </div>

          {qrToken ? (
            <div className="mt-4 space-y-3">
              <p className="rounded-2xl bg-ulv-yellow p-4 text-center text-2xl font-black text-ulv-blue">
                Código corto: {qrToken.short_code}
              </p>
              <p className="break-all rounded-2xl bg-slate-50 p-3 text-xs font-semibold text-slate-600">{appQrValue}</p>
            </div>
          ) : null}
        </Card>

        <Card>
          <h2 className="text-xl font-black text-ulv-blue">Opción 2: Usuarios sin app</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            El usuario escanea este QR con la cámara normal del celular. Se abrirá el navegador.
          </p>

          <div className="mt-5 flex min-h-80 items-center justify-center rounded-3xl bg-slate-50 p-4">
            {qrImages?.webQr ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrImages.webQr} alt="QR web para usuarios sin app" className="h-72 w-72 rounded-2xl bg-white p-3" />
            ) : (
              <p className="text-center text-sm font-semibold text-slate-500">Genera un QR para mostrarlo aquí.</p>
            )}
          </div>

          {qrToken ? (
            <div className="mt-4 space-y-3">
              <p className="rounded-2xl bg-ulv-yellow p-4 text-center text-2xl font-black text-ulv-blue">
                Código corto: {qrToken.short_code}
              </p>
              <p className="break-all rounded-2xl bg-slate-50 p-3 text-xs font-semibold text-slate-600">{webQrValue}</p>
            </div>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
