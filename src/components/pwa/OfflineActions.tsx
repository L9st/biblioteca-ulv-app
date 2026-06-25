"use client";

import Link from "next/link";

export function OfflineActions() {
  return (
    <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-ulv-yellow px-4 py-2 text-sm font-semibold text-ulv-blue shadow-sm transition hover:brightness-95"
      >
        Reintentar
      </button>
      <Link
        href="/"
        className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-ulv-blue shadow-sm transition hover:bg-slate-50"
      >
        Volver al inicio
      </Link>
    </div>
  );
}
