import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpenCheck, CalendarCheck, MapPin, Users } from "lucide-react";
import { getLibrarySpaceBySlug } from "@/services/spaces.service";
import { Button } from "@/app/ui/Button";
import { Card } from "@/app/ui/Card";
import { PageContainer } from "@/app/layout/PageContainer";

type SpaceDetailPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export const dynamic = "force-dynamic";

function formatText(value: string | null, fallback: string) {
  return value && value.trim().length > 0 ? value : fallback;
}

export default async function SpaceDetailPage({ params }: SpaceDetailPageProps) {
  const { slug } = await params;
  const space = await getLibrarySpaceBySlug(slug);

  if (!space) {
    notFound();
  }

  return (
    <PageContainer>
      <div className="mb-5">
        <Link href="/espacios" className="inline-flex items-center gap-2 text-sm font-bold text-ulv-blue">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Volver a espacios
        </Link>
      </div>

      <article className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="flex min-h-64 items-center justify-center bg-ulv-blue/10">
          {space.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={space.image_url} alt={space.name} className="h-64 w-full object-cover md:h-96" />
          ) : (
            <div className="flex h-64 w-full flex-col items-center justify-center bg-gradient-to-br from-ulv-blue to-[#0b5f93] px-6 text-center text-white md:h-96">
              <BookOpenCheck className="h-12 w-12 text-ulv-yellow" aria-hidden="true" />
              <p className="mt-3 text-sm font-bold uppercase tracking-wide text-ulv-yellow">Biblioteca ULV</p>
              <p className="mt-2 text-lg font-black">Imagen del espacio no disponible</p>
            </div>
          )}
        </div>

        <div className="p-5 md:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-bold text-ulv-blue">Espacio de biblioteca</p>
              <h1 className="mt-1 text-3xl font-black leading-tight text-slate-950 md:text-5xl">{space.name}</h1>
              <p className="mt-3 text-base font-semibold text-slate-600">
                {space.libraries?.name ?? "Biblioteca no asignada"}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-ulv-blue px-3 py-1 text-xs font-bold text-white">Activo</span>
              <span className="rounded-full bg-ulv-yellow px-3 py-1 text-xs font-bold text-ulv-blue">
                {space.is_reservable ? "Reservable" : "No reservable"}
              </span>
            </div>
          </div>

          <p className="mt-5 text-base leading-8 text-slate-700">
            {formatText(space.description, "Este espacio aún no tiene descripción registrada.")}
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="p-4">
              <Users className="h-6 w-6 text-ulv-blue" aria-hidden="true" />
              <p className="mt-3 text-sm font-semibold text-slate-500">Capacidad</p>
              <p className="mt-1 text-xl font-black text-ulv-blue">
                {space.capacity !== null ? `${space.capacity} personas` : "No registrada"}
              </p>
            </Card>

            <Card className="p-4">
              <MapPin className="h-6 w-6 text-ulv-blue" aria-hidden="true" />
              <p className="mt-3 text-sm font-semibold text-slate-500">Ubicación interna</p>
              <p className="mt-1 text-base font-bold text-ulv-blue">
                {formatText(space.location_hint, "No registrada")}
              </p>
            </Card>

            <Card className="p-4 sm:col-span-2">
              <CalendarCheck className="h-6 w-6 text-ulv-blue" aria-hidden="true" />
              <p className="mt-3 text-sm font-semibold text-slate-500">Horario de biblioteca</p>
              <p className="mt-1 text-base font-bold text-ulv-blue">
                {formatText(space.libraries?.opening_hours ?? null, "No registrado")}
              </p>
            </Card>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <Card>
              <h2 className="text-xl font-black text-ulv-blue">Servicios disponibles</h2>
              <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-700">
                {formatText(space.services, "No hay servicios registrados para este espacio.")}
              </p>
            </Card>

            <Card>
              <h2 className="text-xl font-black text-ulv-blue">Normas del espacio</h2>
              <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-700">
                {formatText(space.rules, "No hay normas registradas para este espacio.")}
              </p>
            </Card>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button className="w-full sm:w-auto">Registrar uso del espacio</Button>

            {space.is_reservable ? (
              <Button href="/reservas-espacios" variant="secondary" className="w-full sm:w-auto">
                Reservar espacio
              </Button>
            ) : (
              <button
                disabled
                className="inline-flex min-h-12 w-full cursor-not-allowed items-center justify-center rounded-2xl bg-slate-200 px-5 py-3 text-sm font-bold text-slate-500 sm:w-auto"
              >
                Reservar espacio
              </button>
            )}
          </div>
        </div>
      </article>
    </PageContainer>
  );
}
