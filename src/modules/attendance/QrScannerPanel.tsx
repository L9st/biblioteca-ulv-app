"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Camera, CheckCircle2, Clock3, XCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { extractQrToken, validateAttendanceQrAndToggle, type AttendanceQrValidation } from "@/services/qr.service";
import { Card } from "@/app/ui/Card";

const scannerElementId = "attendance-qr-scanner";

type ScannerStatus = "checking-session" | "ready" | "scanning" | "validating" | "success" | "error";

function getSuccessMessage(result: AttendanceQrValidation) {
  return result.action === "check_in" ? "Entrada registrada correctamente" : "Salida registrada correctamente";
}

async function stopScanner(scanner: import("html5-qrcode").Html5Qrcode | null) {
  if (!scanner) {
    return;
  }

  try {
    await scanner.stop();
    scanner.clear();
  } catch {
    scanner.clear();
  }
}

export function QrScannerPanel() {
  const [status, setStatus] = useState<ScannerStatus>("checking-session");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<AttendanceQrValidation | null>(null);
  const scannerRef = useRef<import("html5-qrcode").Html5Qrcode | null>(null);
  const hasProcessedRef = useRef(false);

  const processScannedText = useCallback(async (scannedText: string) => {
    if (hasProcessedRef.current) {
      return;
    }

    hasProcessedRef.current = true;
    setStatus("validating");
    setMessage("Validando QR...");
    await stopScanner(scannerRef.current);

    const token = extractQrToken(scannedText);
    const validationResult = await validateAttendanceQrAndToggle(token);

    setResult(validationResult);
    setMessage(validationResult.success ? getSuccessMessage(validationResult) : validationResult.message);
    setStatus(validationResult.success ? "success" : "error");
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(async () => {
      const { data } = await supabase.auth.getSession();
      const hasSession = Boolean(data.session);
      setIsAuthenticated(hasSession);
      setStatus(hasSession ? "ready" : "error");
      setMessage(hasSession ? "" : "Debes iniciar sesión para registrar tus horas en biblioteca.");
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    let isMounted = true;
    let isStarted = false;

    async function startScanner() {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        const scanner = new Html5Qrcode(scannerElementId);
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: { ideal: "environment" } },
          { fps: 10, qrbox: { width: 260, height: 260 } },
          (decodedText) => {
            void processScannedText(decodedText);
          },
          () => undefined
        );

        isStarted = true;

        if (isMounted) {
          setStatus("scanning");
        }
      } catch {
        if (isMounted) {
          setStatus("error");
          setMessage("No se pudo abrir la cámara. Revisa permisos del navegador o usa HTTPS.");
        }
      }
    }

    void startScanner();

    return () => {
      isMounted = false;
      if (isStarted) {
        void stopScanner(scannerRef.current);
      }
    };
  }, [isAuthenticated, processScannedText]);

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

  if (status === "error" && message) {
    return (
      <Card className="text-center">
        <XCircle className="mx-auto h-12 w-12 text-red-600" aria-hidden="true" />
        <h2 className="mt-3 text-xl font-black text-red-700">No se pudo registrar el movimiento</h2>
        <p className="mt-2 text-sm leading-6 text-slate-700">{message}</p>
        <Link
          href="/horas"
          className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-ulv-yellow px-5 py-3 text-sm font-bold text-ulv-blue shadow-sm transition hover:bg-[#e8b800]"
        >
          Volver a mis horas
        </Link>
      </Card>
    );
  }

  return (
    <Card>
      <div className="text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-ulv-yellow text-ulv-blue">
          <Camera className="h-7 w-7" aria-hidden="true" />
        </span>
        <h2 className="mt-4 text-2xl font-black text-ulv-blue">Escanear QR de biblioteca</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">Apunta la cámara al QR mostrado en la biblioteca.</p>
      </div>

      <div className="mt-5 overflow-hidden rounded-3xl border border-slate-200 bg-slate-950 p-2">
        <div id={scannerElementId} className="min-h-[280px] overflow-hidden rounded-2xl bg-black text-white" />
      </div>

      {status === "validating" ? (
        <p className="mt-4 rounded-2xl bg-ulv-blue px-4 py-3 text-center text-sm font-bold text-white">Validando QR...</p>
      ) : (
        <p className="mt-4 text-center text-xs font-semibold text-slate-500">
          La cámara funciona en HTTPS o localhost. Si no abre, revisa los permisos del navegador.
        </p>
      )}

      <Link
        href="/horas"
        className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-ulv-blue shadow-sm transition hover:bg-slate-50"
      >
        Volver a mis horas
      </Link>
    </Card>
  );
}
