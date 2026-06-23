import Link from "next/link";
import { NotificationHeaderLink } from "@/components/notifications/NotificationHeaderLink";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-40 bg-ulv-blue text-white shadow-sm">
      <div className="mx-auto flex min-h-16 w-full max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-3" aria-label="Ir al inicio">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-ulv-yellow text-lg font-black text-ulv-blue">
            ULV
          </span>
          <span>
            <span className="block text-base font-bold leading-tight">Biblioteca ULV</span>
            <span className="block text-xs text-white/80">Servicios bibliotecarios</span>
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <NotificationHeaderLink />
          <Link
            href="/admin"
            className="rounded-full border border-white/25 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/10"
          >
            Admin
          </Link>
        </div>
      </div>
    </header>
  );
}
