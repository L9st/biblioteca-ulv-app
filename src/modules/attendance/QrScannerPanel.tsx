"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { Camera, CheckCircle2, Clock3, Keyboard, XCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { extractQrToken, validateAttendanceQrAndToggle, type AttendanceQrValidation } from "@/services/qr.service";
import { Card } from "@/app/ui/Card";

const scannerElementId = "attendance-qr-scanner";

type ScannerStatus = "checking-session" | "ready" | "scanning" | "validating" | "success" | "error";

type ScannerDiagnostics = {
  currentUrl: string;
  isSecure: boolean;
  hasMediaDevices: boolean;
  cameraCount: number;
  userAgent: string;
  lastError: string;
  technicalDetail: string;
};

function getSuccessMessage(result: AttendanceQrValidation) {
  return result.action === "check_in" ? "Entrada registrada correctamente" : "Salida registrada correctamente";
}

function getScannerDiagnostics(): ScannerDiagnostics {
  const currentUrl = typeof window !== "undefined" ? window.location.href : "No disponible";
  const hostname = typeof window !== "undefined" ? window.location.hostname : "";
  const isSecure = typeof window !== "undefined" && (window.isSecureContext || hostname === "localhost");
  const hasMediaDevices = typeof navigator !== "undefined" && Boolean(navigator.mediaDevices) && typeof navigator.mediaDevices.getUserMedia === "function";
  const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "No disponible";

  return {
    currentUrl,
    isSecure,
    hasMediaDevices,
    cameraCount: 0,
    userAgent,
    lastError: "Sin errores recientes",
    technicalDetail: "Sin detalle técnico",
  };
}

function mergeDiagnostics(update: Partial<ScannerDiagnostics>) {
  return (current: ScannerDiagnostics): ScannerDiagnostics => ({ ...current, ...update });
}

function getCameraErrorMessage(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError") {
      return "Permiso de cámara denegado. Revisa los permisos del navegador y permite el acceso a la cámara.";
    }

    if (error.name === "NotFoundError") {
      return "No se encontró una cámara disponible en este dispositivo.";
    }

    if (error.name === "NotReadableError") {
      return "La cámara está siendo usada por otra aplicación o no se pudo iniciar.";
    }

    if (error.name === "OverconstrainedError") {
      return "No se pudo usar la cámara trasera con esta configuración. Intenta seleccionar otra cámara.";
    }

    if (error.name === "SecurityError") {
      return "La cámara fue bloqueada por seguridad del navegador.";
    }

    return `No se pudo abrir la cámara: ${error.name}`;
  }

  if (error instanceof Error) {
    return error.message || "No se pudo abrir la cámara.";
  }

  return "No se pudo abrir la cámara. Intenta permitir la cámara o usa el ingreso manual.";
}

function getTechnicalErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message || error.name;
  }

  return String(error);
}

async function loadVideoDevices(): Promise<MediaDeviceInfo[]> {
  if (!navigator.mediaDevices?.enumerateDevices) {
    return [];
  }

  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter((device) => device.kind === "videoinput");
}

async function stopScanner(scanner: import("html5-qrcode").Html5Qrcode | null) {
  if (!scanner) {
    return;
  }

  try {
    if (scanner.isScanning) {
      await scanner.stop();
    }
    scanner.clear();
  } catch {
    try {
      scanner.clear();
    } catch {
      // Ignorar errores de limpieza para evitar dejar la pantalla bloqueada.
    }
  }
}

export function QrScannerPanel() {
  const [status, setStatus] = useState<ScannerStatus>("checking-session");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [message, setMessage] = useState("");
  const [manualCode, setManualCode] = useState("");
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [result, setResult] = useState<AttendanceQrValidation | null>(null);
  const [diagnostics, setDiagnostics] = useState<ScannerDiagnostics>({
    currentUrl: "No disponible",
    isSecure: false,
    hasMediaDevices: false,
    cameraCount: 0,
    userAgent: "No disponible",
    lastError: "Sin errores recientes",
    technicalDetail: "Sin detalle técnico",
  });
  const scannerRef = useRef<import("html5-qrcode").Html5Qrcode | null>(null);
  const hasProcessedScanRef = useRef(false);

  const processQrValue = useCallback(async (value: string, source: "camera" | "manual") => {
    if (source === "camera" && hasProcessedScanRef.current) {
      return;
    }

    const tokenOrCode = value.trim();

    if (!tokenOrCode) {
      setStatus("error");
      setMessage("Ingresa un código QR o código corto para registrar asistencia.");
      return;
    }

    if (source === "camera") {
      hasProcessedScanRef.current = true;
    }

    setStatus("validating");
    setMessage("Validando QR...");
    await stopScanner(scannerRef.current);
    scannerRef.current = null;

    const token = extractQrToken(tokenOrCode);
    const validationResult = await validateAttendanceQrAndToggle(token);

    setResult(validationResult);
    setMessage(validationResult.success ? getSuccessMessage(validationResult) : validationResult.message);
    setStatus(validationResult.success ? "success" : "error");
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(async () => {
      setDiagnostics(getScannerDiagnostics());
      const { data } = await supabase.auth.getSession();
      const hasSession = Boolean(data.session);
      setIsAuthenticated(hasSession);
      setStatus(hasSession ? "ready" : "error");
      setMessage(hasSession ? "" : "Debes iniciar sesión para registrar tus horas en biblioteca.");
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    return () => {
      void stopScanner(scannerRef.current);
    };
  }, []);

  async function handleOpenCamera() {
    const currentDiagnostics = getScannerDiagnostics();
    setDiagnostics(mergeDiagnostics(currentDiagnostics));
    setResult(null);
    setMessage("");
    hasProcessedScanRef.current = false;

    if (!currentDiagnostics.isSecure) {
      setStatus("error");
      setMessage(`No se puede abrir la cámara porque la app no está cargada en una conexión segura HTTPS. Abre la app desde la URL oficial que comienza con https://. URL actual: ${currentDiagnostics.currentUrl}`);
      return;
    }

    if (!currentDiagnostics.hasMediaDevices) {
      setStatus("error");
      setMessage("Este navegador no permite abrir la cámara desde esta página. Abre la app en Chrome o Safari usando la URL oficial HTTPS.");
      return;
    }

    const readerElement = document.getElementById(scannerElementId);

    if (!readerElement) {
      const errorMessage = "No se encontró el contenedor del escáner. Intenta recargar la página.";
      setStatus("error");
      setMessage(errorMessage);
      setDiagnostics(mergeDiagnostics({ lastError: errorMessage, technicalDetail: `Elemento no encontrado: ${scannerElementId}` }));
      return;
    }

    try {
      setStatus("scanning");
      await stopScanner(scannerRef.current);
      scannerRef.current = null;

      const permissionStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      permissionStream.getTracks().forEach((track) => track.stop());

      const devices = await loadVideoDevices();
      setVideoDevices(devices);
      setDiagnostics(mergeDiagnostics({ cameraCount: devices.length, lastError: "Sin errores recientes", technicalDetail: "Permiso de cámara concedido" }));

      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode(scannerElementId);
      scannerRef.current = scanner;

      const scanConfig = { fps: 10, qrbox: { width: 250, height: 250 } };
      const selectedDevice = selectedDeviceId || devices[0]?.deviceId || "";

      try {
        await scanner.start(
          selectedDeviceId ? selectedDeviceId : { facingMode: "environment" },
          scanConfig,
          (decodedText) => {
            void processQrValue(decodedText, "camera");
          },
          () => undefined
        );
      } catch (environmentError) {
        if (!selectedDevice) {
          throw environmentError;
        }

        await stopScanner(scannerRef.current);
        const fallbackScanner = new Html5Qrcode(scannerElementId);
        scannerRef.current = fallbackScanner;
        setSelectedDeviceId(selectedDevice);

        await fallbackScanner.start(
          selectedDevice,
          scanConfig,
          (decodedText) => {
            void processQrValue(decodedText, "camera");
          },
          () => undefined
        );
      }
    } catch (error) {
      await stopScanner(scannerRef.current);
      scannerRef.current = null;
      const errorMessage = getCameraErrorMessage(error);
      setStatus("error");
      setMessage(errorMessage);
      setDiagnostics(mergeDiagnostics({
        lastError: errorMessage,
        technicalDetail: getTechnicalErrorMessage(error),
      }));
    }
  }

  async function handleCloseCamera() {
    await stopScanner(scannerRef.current);
    scannerRef.current = null;
    hasProcessedScanRef.current = false;
    setStatus("ready");
    setMessage("");
  }

  async function handleSelectDevice(deviceId: string) {
    setSelectedDeviceId(deviceId);

    if (status === "scanning") {
      await stopScanner(scannerRef.current);
      scannerRef.current = null;
      setStatus("ready");
      setMessage("Cámara seleccionada. Presiona Abrir cámara para iniciar nuevamente.");
    }
  }

  function handleManualSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void processQrValue(manualCode, "manual");
  }

  if (status === "checking-session") {
    return (
      <Card className="text-center">
        <Clock3 className="mx-auto h-10 w-10 animate-pulse text-ulv-blue" aria-hidden="true" />
        <p className="mt-3 text-sm font-bold text-slate-600">Revisando sesión...</p>
      </Card>
    );
  }

  if (!isAuthenticated) {
    return (
      <Card className="text-center">
        <h2 className="text-xl font-black text-ulv-blue">Debes iniciar sesión para registrar tus horas en biblioteca.</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Después de iniciar sesión volverás al escáner para registrar entrada o salida.
        </p>
        <Link
          href="/login?redirect=/horas/escanear"
          className="mt-5 inline-flex min-h-12 items-center justify-center rounded-2xl bg-ulv-yellow px-5 py-3 text-sm font-bold text-ulv-blue shadow-sm transition hover:bg-[#e8b800]"
        >
          Iniciar sesión
        </Link>
      </Card>
    );
  }

  if (status === "success") {
    return (
      <Card className="text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-green-700" aria-hidden="true" />
        <h2 className="mt-3 text-2xl font-black text-ulv-blue">{message}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {result?.library_name ? `Biblioteca: ${result.library_name}` : "Tu movimiento fue validado correctamente."}
        </p>
        <Link
          href="/horas"
          className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-ulv-yellow px-5 py-3 text-sm font-bold text-ulv-blue shadow-sm transition hover:bg-[#e8b800]"
        >
          Volver a mis horas
        </Link>
      </Card>
    );
  }

  return (
    <div className="w-full max-w-full space-y-5 overflow-hidden pb-4">
      <Card>
        <div className="text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-ulv-yellow text-ulv-blue">
            <Camera className="h-7 w-7" aria-hidden="true" />
          </span>
          <h2 className="mt-4 text-2xl font-black text-ulv-blue">Escanear QR de biblioteca</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Presiona Abrir cámara y apunta al QR mostrado en biblioteca.</p>
        </div>

        {message ? (
          <div className={`mt-5 rounded-2xl p-4 text-sm font-bold ${status === "error" ? "bg-red-50 text-red-800" : "bg-ulv-blue text-white"}`}>
            <div className="flex items-start gap-2">
              {status === "error" ? <XCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" /> : null}
              <p className="break-words leading-6">{message}</p>
            </div>
          </div>
        ) : null}

        <div className="mt-5 overflow-hidden rounded-3xl border border-slate-200 bg-slate-950 p-2">
          <div id={scannerElementId} className="min-h-[280px] w-full max-w-full overflow-hidden rounded-2xl bg-black text-white" />
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => void handleOpenCamera()}
            disabled={status === "scanning" || status === "validating"}
            className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-ulv-yellow px-5 py-3 text-sm font-black text-ulv-blue shadow-sm transition hover:bg-[#e8b800] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {status === "scanning" ? "Cámara abierta" : "Abrir cámara"}
          </button>
          <button
            type="button"
            onClick={() => void handleCloseCamera()}
            disabled={status !== "scanning"}
            className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-ulv-blue shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cerrar cámara
          </button>
        </div>

        {status === "validating" ? (
          <p className="mt-4 rounded-2xl bg-ulv-blue px-4 py-3 text-center text-sm font-bold text-white">Validando QR...</p>
        ) : null}
      </Card>

      <Card>
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-ulv-yellow text-ulv-blue">
            <Keyboard className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="text-xl font-black text-ulv-blue">Ingresar código QR manualmente</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">Usa esta opción si la cámara no abre. Puedes ingresar el código corto o el token del QR.</p>
          </div>
        </div>

        <form onSubmit={handleManualSubmit} className="mt-5 space-y-4">
          <label className="block">
            <span className="text-sm font-bold text-ulv-blue">Código</span>
            <input
              value={manualCode}
              onChange={(event) => setManualCode(event.target.value)}
              autoComplete="one-time-code"
              className="mt-2 min-h-12 w-full min-w-0 max-w-full rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-ulv-blue outline-none transition focus:border-ulv-blue focus:ring-4 focus:ring-ulv-blue/10"
              placeholder="Código corto o token"
            />
          </label>
          <button
            type="submit"
            disabled={status === "validating" || !manualCode.trim()}
            className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-ulv-yellow px-5 py-3 text-sm font-black text-ulv-blue shadow-sm transition hover:bg-[#e8b800] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Registrar asistencia
          </button>
        </form>
      </Card>

      <Card>
        <h2 className="text-lg font-black text-ulv-blue">Diagnóstico de conexión</h2>
        <dl className="mt-4 space-y-3 text-sm">
          <div>
            <dt className="font-bold text-slate-500">URL actual</dt>
            <dd className="mt-1 break-all font-semibold text-slate-900">{diagnostics.currentUrl}</dd>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="font-bold text-slate-500">Contexto seguro</dt>
              <dd className="mt-1 font-black text-ulv-blue">{diagnostics.isSecure ? "Sí" : "No"}</dd>
            </div>
            <div>
              <dt className="font-bold text-slate-500">Cámara disponible</dt>
              <dd className="mt-1 font-black text-ulv-blue">{diagnostics.hasMediaDevices ? "Sí" : "No"}</dd>
            </div>
          </div>
          <div>
            <dt className="font-bold text-slate-500">Navegador</dt>
            <dd className="mt-1 break-words font-semibold text-slate-900">{diagnostics.userAgent}</dd>
          </div>
        </dl>
      </Card>

      <Link
        href="/horas"
        className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-ulv-blue shadow-sm transition hover:bg-slate-50"
      >
        Volver a mis horas
      </Link>
    </div>
  );
}
