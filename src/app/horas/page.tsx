import { PageContainer } from "../layout/PageContainer";
import { AttendancePanel } from "@/modules/attendance/AttendancePanel";

export default function HorasPage() {
  return (
    <PageContainer>
      <div className="mb-6 rounded-2xl bg-ulv-blue p-5 text-white shadow-sm md:p-8">
        <p className="text-sm font-bold text-ulv-yellow">Control de horas</p>
        <h1 className="mt-2 text-3xl font-black leading-tight md:text-5xl">Mis horas en biblioteca</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-white/85">
          Registra tu entrada y salida para llevar el conteo de permanencia en biblioteca.
        </p>
      </div>
      <AttendancePanel />
    </PageContainer>
  );
}
