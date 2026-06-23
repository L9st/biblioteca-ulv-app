"use client";

import Link from "next/link";

export function OfflineActions() {
  return (
    <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-ulv-yellow px-5 py-3 text-sm font-black text-ulv-blue shadow-sm transition hover:bg-[#e8b800]"
      >
        Reintentar
      </button>
      <Link
        href="/"
        className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-ulv-blue shadow-sm"
      >
        Volver al inicio
      </Link>
    </div>
  );
}
