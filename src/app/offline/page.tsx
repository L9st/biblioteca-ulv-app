import { OfflineActions } from "@/components/pwa/OfflineActions";

export default function OfflinePage() {
  return (
    <main className="flex min-h-[70vh] items-center justify-center bg-ulv-bg px-4 py-10 pb-24 md:pb-10">
      <section className="w-full max-w-xl rounded-2xl border border-slate-100 bg-white p-6 text-center shadow-sm md:p-8">
        <p className="text-sm font-bold text-ulv-yellow">Biblioteca ULV App</p>
        <h1 className="mt-3 text-3xl font-black text-ulv-blue md:text-4xl">Estás sin conexión</h1>
        <p className="mt-4 text-sm leading-6 text-slate-600">
          No se pudo cargar esta sección porque no hay conexión a internet.
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-600">Puedes volver a intentar cuando tengas conexión.</p>
        <OfflineActions />
      </section>
    </main>
  );
}
