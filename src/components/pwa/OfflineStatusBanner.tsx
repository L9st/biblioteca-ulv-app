"use client";

import { useEffect, useState } from "react";

type ConnectionState = "online" | "offline" | "restored";

export function OfflineStatusBanner() {
  const [state, setState] = useState<ConnectionState>(() => (typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "online"));

  useEffect(() => {
    let timeoutId: number | null = null;

    function handleOffline() {
      if (timeoutId) window.clearTimeout(timeoutId);
      setState("offline");
    }

    function handleOnline() {
      setState("restored");
      timeoutId = window.setTimeout(() => setState("online"), 3500);
    }

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, []);

  if (state === "online") return null;

  return (
    <div className="fixed inset-x-3 bottom-20 z-50 mx-auto max-w-3xl rounded-2xl bg-ulv-blue px-4 py-3 text-center text-sm font-black text-white shadow-lg ring-1 ring-white/20 md:bottom-4">
      {state === "offline" ? "Sin conexión a internet. Algunas funciones no estarán disponibles." : "Conexión restablecida."}
    </div>
  );
}
