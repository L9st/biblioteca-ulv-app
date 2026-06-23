import Link from "next/link";
import { getActiveLibrarySpaces } from "@/services/spaces.service";
import { LibraryFilterDropdown } from "./LibraryFilterDropdown";

export const dynamic = "force-dynamic";

export const libraryFilters = [
  { label: "Todas las bibliotecas", href: "/espacios", code: null },
  {
    label: "Biblioteca Sara E. Ocampo",
    href: "/espacios?biblioteca=SARA_E_OCAMPO",
    code: "SARA_E_OCAMPO",
  },
  {
    label: "Biblioteca Plantel Tuxtla",
    href: "/espacios?biblioteca=PLANTEL_TUXTLA",
    code: "PLANTEL_TUXTLA",
  },
] as const;

const validLibraryCodes = ["SARA_E_OCAMPO", "PLANTEL_TUXTLA"] as const;

type LibraryCode = (typeof validLibraryCodes)[number];

type EspaciosPageProps = {
  searchParams?: Promise<{
    biblioteca?: string;
  }>;
};

function getSelectedLibraryCode(value: string | undefined): LibraryCode | null {
  return validLibraryCodes.includes(value as LibraryCode) ? (value as LibraryCode) : null;
}

export default async function EspaciosPage({ searchParams }: EspaciosPageProps) {
  const resolvedSearchParams = await searchParams;
  const selectedLibraryCode = getSelectedLibraryCode(resolvedSearchParams?.biblioteca);
  const selectedLibraryLabel =
    libraryFilters.find((filter) => filter.code === selectedLibraryCode)?.label ?? "Todas las bibliotecas";
  const spaces = await getActiveLibrarySpaces();
  const filteredSpaces = selectedLibraryCode
    ? spaces.filter((space) => space.libraries?.code === selectedLibraryCode)
    : spaces;
  const hasAnySpaces = spaces.length > 0;
  const emptyTitle = hasAnySpaces
    ? "No hay espacios registrados para esta biblioteca"
    : "No hay espacios registrados";
  const emptyMessage = hasAnySpaces
    ? "Agrega espacios activos para esta sede desde Supabase."
    : "Verifica que existan espacios activos en Supabase.";

  return (
    <main className="min-h-screen bg-ulv-bg px-4 pb-28 pt-6 md:pb-6">
      <section className="mx-auto max-w-5xl">
        <div className="mb-6 rounded-2xl bg-ulv-blue p-5 text-white shadow-sm">
          <p className="text-sm font-medium text-ulv-yellow">
            Biblioteca ULV
          </p>
          <h1 className="mt-1 text-2xl font-bold">
            Espacios de la biblioteca
          </h1>
          <p className="mt-2 text-sm text-white/90">
            Conoce las áreas disponibles para estudio, consulta, investigación y
            uso académico.
          </p>
        </div>

        <LibraryFilterDropdown selectedLibraryCode={selectedLibraryCode} selectedLibraryLabel={selectedLibraryLabel} />

        {filteredSpaces.length === 0 ? (
          <div className="rounded-2xl bg-white p-6 text-center shadow-sm">
            <h2 className="text-lg font-semibold text-ulv-blue">
              {emptyTitle}
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              {emptyMessage}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredSpaces.map((space) => (
              <article
                key={space.id}
                className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5"
              >
                <div className="flex h-36 items-center justify-center bg-ulv-blue/10">
                  {space.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={space.image_url}
                      alt={space.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-sm font-medium text-ulv-blue">
                      Imagen del espacio
                    </span>
                  )}
                </div>

                <div className="p-4">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <h2 className="text-lg font-bold text-ulv-blue">
                      {space.name}
                    </h2>

                    {space.is_reservable && (
                      <span className="rounded-full bg-ulv-yellow px-2 py-1 text-xs font-semibold text-ulv-blue">
                        Reservable
                      </span>
                    )}
                  </div>

                  <p className="text-sm text-gray-600">
                    {space.description ?? "Sin descripción registrada."}
                  </p>

                  <div className="mt-3 space-y-1 text-sm text-gray-700">
                    <p>
                      <span className="font-semibold text-ulv-blue">
                        Biblioteca:
                      </span>{" "}
                      {space.libraries?.name ?? "No asignada"}
                    </p>

                    {space.capacity !== null && (
                      <p>
                        <span className="font-semibold text-ulv-blue">
                          Capacidad:
                        </span>{" "}
                        {space.capacity} personas
                      </p>
                    )}

                    {space.location_hint && (
                      <p>
                        <span className="font-semibold text-ulv-blue">
                          Ubicación:
                        </span>{" "}
                        {space.location_hint}
                      </p>
                    )}
                  </div>

                  <Link
                    href={`/espacios/${space.slug}`}
                    className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-ulv-yellow px-4 py-2 text-sm font-bold text-ulv-blue transition hover:scale-[1.02]"
                  >
                    Ver espacio
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
