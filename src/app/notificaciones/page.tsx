import { PageContainer } from "@/app/layout/PageContainer";
import { NotificationsPanel } from "@/modules/notifications/NotificationsPanel";

export default function NotificacionesPage() {
  return (
    <PageContainer>
      <div className="mb-6 rounded-2xl bg-ulv-blue p-5 text-white shadow-sm md:p-8">
        <p className="text-sm font-bold text-ulv-yellow">Biblioteca ULV</p>
        <h1 className="mt-2 text-3xl font-black leading-tight md:text-5xl">Notificaciones</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-white/85">Consulta tus avisos y actualizaciones.</p>
      </div>
      <NotificationsPanel />
    </PageContainer>
  );
}
