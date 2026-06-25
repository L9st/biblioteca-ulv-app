import { PageContainer } from "@/app/layout/PageContainer";
import { getPublicAppUrl } from "@/lib/app-url";
import { AdminQrPanel } from "@/modules/admin/AdminQrPanel";

export default function AdminQrPage() {
  const publicAppUrl = getPublicAppUrl();

  return (
    <PageContainer>
      <div className="mb-6 rounded-2xl bg-ulv-blue p-5 text-white shadow-sm md:p-8">
        <p className="text-sm font-bold text-ulv-yellow">Panel bibliotecario</p>
        <h1 className="mt-2 text-3xl font-black leading-tight md:text-5xl">Panel QR de asistencia</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-white/85">
          Genera códigos temporales para registrar entrada o salida de usuarios en biblioteca.
        </p>
      </div>
      <AdminQrPanel publicAppUrl={publicAppUrl} />
    </PageContainer>
  );
}
