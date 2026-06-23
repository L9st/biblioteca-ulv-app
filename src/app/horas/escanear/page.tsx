import { PageContainer } from "../../layout/PageContainer";
import { QrScannerPanel } from "@/modules/attendance/QrScannerPanel";

export default function EscanearHorasPage() {
  return (
    <PageContainer className="max-w-full overflow-x-hidden pb-28 md:pb-10">
      <div className="mb-6 w-full max-w-full overflow-hidden rounded-[2rem] bg-ulv-blue p-5 text-white shadow-sm md:p-8">
        <p className="text-sm font-bold text-ulv-yellow">Control de horas</p>
        <h1 className="mt-2 break-words text-3xl font-black leading-tight md:text-5xl">Escanear QR de biblioteca</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-white/85">
          Apunta la cámara al QR mostrado en la biblioteca para registrar entrada o salida.
        </p>
      </div>
      <QrScannerPanel />
    </PageContainer>
  );
}
