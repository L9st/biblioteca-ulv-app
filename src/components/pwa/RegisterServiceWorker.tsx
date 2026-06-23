"use client";

import { useEffect } from "react";

function canRegisterServiceWorker() {
  if (!("serviceWorker" in navigator)) return false;
  return window.location.protocol === "https:" || window.location.hostname === "localhost";
}

export function RegisterServiceWorker() {
  useEffect(() => {
    if (!canRegisterServiceWorker()) return;

    navigator.serviceWorker.register("/sw.js").catch((error: unknown) => {
      console.warn("No se pudo registrar el service worker:", error);
    });
  }, []);

  return null;
}
