import { PageContainer } from "@/app/layout/PageContainer";
import { AdminAttendancePanel } from "@/modules/admin/AdminAttendancePanel";

export default function AdminAsistenciaPage() {
  return (
    <PageContainer>
      <div className="mb-6 rounded-[2rem] bg-ulv-blue p-5 text-white shadow-sm md:p-8">
        <p className="text-sm font-bold text-ulv-yellow">Panel bibliotecario</p>
        <h1 className="mt-2 text-3xl font-black leading-tight md:text-5xl">Panel de asistencia</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-white/85">
          Consulta registros de entrada y salida, usuarios dentro de biblioteca y horas acumuladas.
        </p>
      </div>
      <AdminAttendancePanel />
    </PageContainer>
  );
}
