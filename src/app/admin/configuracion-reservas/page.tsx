import { PageContainer } from "@/app/layout/PageContainer";
import { AdminReservationSettingsPanel } from "@/modules/admin/AdminReservationSettingsPanel";

export default function AdminConfiguracionReservasPage() {
  return (
    <PageContainer>
      <div className="mb-6 rounded-[2rem] bg-ulv-blue p-5 text-white shadow-sm md:p-8">
        <p className="text-sm font-bold text-ulv-yellow">Panel bibliotecario</p>
        <h1 className="mt-2 text-3xl font-black leading-tight md:text-5xl">Configuración de reservas</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-white/85">Define horarios de atención y reglas de reserva por espacio.</p>
      </div>
      <AdminReservationSettingsPanel />
    </PageContainer>
  );
}
