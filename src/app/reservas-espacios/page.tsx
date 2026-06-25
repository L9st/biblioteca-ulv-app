import { PageContainer } from "@/app/layout/PageContainer";
import { ReservationsPanel } from "@/modules/reservations/ReservationsPanel";

export default function ReservasEspaciosPage() {
  return (
    <PageContainer className="max-w-full overflow-x-hidden pb-28 md:pb-10">
      <div className="mb-6 w-full max-w-full overflow-hidden rounded-2xl bg-ulv-blue p-5 text-white shadow-sm md:p-8">
        <p className="text-sm font-bold text-ulv-yellow">Biblioteca ULV</p>
        <h1 className="mt-2 break-words text-3xl font-black leading-tight md:text-5xl">Reservas de espacios</h1>
        <p className="mt-3 max-w-2xl break-words text-sm leading-6 text-white/85">
          Solicita y consulta tus reservas en las bibliotecas disponibles.
        </p>
        <p className="mt-2 max-w-3xl break-words text-sm leading-6 text-white/75">
          Selecciona una biblioteca, un espacio, la fecha y el horario para enviar tu solicitud de reserva.
        </p>
      </div>
      <ReservationsPanel />
    </PageContainer>
  );
}
