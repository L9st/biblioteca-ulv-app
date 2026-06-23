import { Card } from "../ui/Card";
import { Button } from "../ui/Button";

type SpaceCardProps = {
  name: string;
  description: string;
  capacity: string;
  services: string;
  reservable?: boolean;
};

export function SpaceCard({ name, description, capacity, services, reservable = false }: SpaceCardProps) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="h-32 bg-gradient-to-br from-ulv-blue to-[#0b5f93]" aria-hidden="true" />
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-ulv-blue">{name}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
          </div>
          {reservable ? (
            <span className="rounded-full bg-ulv-yellow px-3 py-1 text-xs font-bold text-ulv-blue">Reservable</span>
          ) : null}
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-2xl bg-slate-50 p-3">
            <dt className="font-semibold text-slate-500">Capacidad</dt>
            <dd className="mt-1 font-bold text-slate-900">{capacity}</dd>
          </div>
          <div className="rounded-2xl bg-slate-50 p-3">
            <dt className="font-semibold text-slate-500">Servicios</dt>
            <dd className="mt-1 font-bold text-slate-900">{services}</dd>
          </div>
        </dl>
        <Button href="/espacios" className="mt-5 w-full" variant="secondary">
          Ver detalles
        </Button>
      </div>
    </Card>
  );
}
