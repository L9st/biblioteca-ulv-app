"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptChoice = {
  outcome: "accepted" | "dismissed";
  platform: string;
};

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<BeforeInstallPromptChoice>;
}

function isStandaloneMode() {
  const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean };

  return window.matchMedia("(display-mode: standalone)").matches || navigatorWithStandalone.standalone === true;
}

export function InstallAppButton() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(() => (typeof window === "undefined" ? false : isStandaloneMode()));

  useEffect(() => {
    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    }

    function handleAppInstalled() {
      setIsInstalled(true);
      setInstallPrompt(null);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  async function handleInstall() {
    if (!installPrompt) return;

    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  }

  if (isInstalled || !installPrompt) return null;

  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <p className="text-sm font-bold text-ulv-blue">Instalar app</p>
      <h2 className="mt-2 text-xl font-black text-slate-950">Instalar Biblioteca ULV</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Instala la app para acceder más rápido desde tu celular. Algunas secciones pueden estar disponibles sin conexión.
      </p>
      <button
        type="button"
        onClick={() => void handleInstall()}
        className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-ulv-yellow px-4 py-2 text-sm font-semibold text-ulv-blue shadow-sm transition hover:brightness-95 sm:w-auto"
      >
        Instalar app
      </button>
    </section>
  );
}
