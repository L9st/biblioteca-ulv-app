import { PageContainer } from "@/app/layout/PageContainer";
import { QrWebRegisterPanel } from "@/modules/attendance/QrWebRegisterPanel";

type QrWebPageProps = {
  params: Promise<{
    token: string;
  }>;
};

export default async function QrWebPage({ params }: QrWebPageProps) {
  const { token } = await params;

  return (
    <PageContainer>
      <div className="mb-6 rounded-2xl bg-ulv-blue p-5 text-white shadow-sm md:p-8">
        <p className="text-sm font-bold text-ulv-yellow">Asistencia por QR</p>
        <h1 className="mt-2 text-3xl font-black leading-tight md:text-5xl">Registro de entrada o salida</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-white/85">
          Validaremos el código escaneado para registrar tu movimiento en biblioteca.
        </p>
      </div>
      <QrWebRegisterPanel token={token} />
    </PageContainer>
  );
}
