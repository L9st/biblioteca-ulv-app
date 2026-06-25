import Link from "next/link";
import { Download, Smartphone } from "lucide-react";
import { Card } from "@/app/ui/Card";
import { PageContainer } from "@/app/layout/PageContainer";

export default function InstallPage() {
  return (
    <PageContainer>
      <section className="rounded-2xl bg-ulv-blue px-5 py-7 text-white shadow-sm md:px-8">
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-ulv-yellow text-ulv-blue">
            <Download className="h-6 w-6" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-semibold text-ulv-yellow">PWA instalable</p>
            <h1 className="mt-2 text-3xl font-black leading-tight md:text-5xl">Instalar Biblioteca ULV App</h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-white/85">
              Agrega la app a tu pantalla de inicio para entrar más rápido a tus horas, reservas, espacios y notificaciones.
            </p>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <Card>
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-ulv-yellow text-ulv-blue">
              <Smartphone className="h-5 w-5" aria-hidden="true" />
            </span>
            <h2 className="text-xl font-black text-ulv-blue">En Android</h2>
          </div>
          <ol className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
            <li>1. Abre la app en Chrome.</li>
            <li>2. Toca el menú de tres puntos.</li>
            <li>3. Selecciona Agregar a pantalla de inicio o Instalar app.</li>
          </ol>
        </Card>

        <Card>
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-ulv-yellow text-ulv-blue">
              <Smartphone className="h-5 w-5" aria-hidden="true" />
            </span>
            <h2 className="text-xl font-black text-ulv-blue">En iPhone</h2>
          </div>
          <ol className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
            <li>1. Abre la app en Safari.</li>
            <li>2. Toca Compartir.</li>
            <li>3. Selecciona Agregar a pantalla de inicio.</li>
          </ol>
        </Card>
      </section>

      <Link
        href="/"
        className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-ulv-yellow px-4 py-2 text-sm font-semibold text-ulv-blue shadow-sm transition hover:brightness-95 sm:w-auto"
      >
        Volver al inicio
      </Link>
    </PageContainer>
  );
}
