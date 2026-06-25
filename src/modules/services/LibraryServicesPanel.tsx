"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, Wrench } from "lucide-react";
import { Card } from "@/app/ui/Card";
import { DropdownSelect } from "@/app/ui/DropdownSelect";
import { PageContainer } from "@/app/layout/PageContainer";
import {
  getActiveLibraryServices,
  libraryServiceAudienceLabels,
  libraryServiceCategoryLabels,
  type LibraryServiceCategory,
  type PublicLibraryService,
} from "@/services/library-services.service";

type CategoryFilter = "all" | LibraryServiceCategory;

function matchesSearch(service: PublicLibraryService, search: string) {
  const term = search.trim().toLowerCase();
  if (!term) return true;
  return [service.title, service.summary ?? "", service.description].some((value) => value.toLowerCase().includes(term));
}

export function LibraryServicesPanel() {
  const [isLoading, setIsLoading] = useState(true);
  const [services, setServices] = useState<PublicLibraryService[]>([]);
  const [libraryFilter, setLibraryFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(async () => {
      const result = await getActiveLibraryServices();
      setServices(result.data);
      setError(result.error);
      setIsLoading(false);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  const libraries = useMemo(
    () => Array.from(new Map(services.filter((service) => service.libraries).map((service) => [service.libraries?.id ?? "", service.libraries])).values()).filter((library) => library !== null),
    [services],
  );

  const filteredServices = services.filter((service) => {
    const libraryMatches = libraryFilter === "all" || service.library_id === libraryFilter;
    const categoryMatches = categoryFilter === "all" || service.category === categoryFilter;
    return libraryMatches && categoryMatches && matchesSearch(service, search);
  });

  if (isLoading) {
    return <PageContainer><Card><p className="text-sm font-semibold text-slate-600">Cargando servicios...</p></Card></PageContainer>;
  }

  return (
    <PageContainer>
      {error ? <p className="mb-5 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</p> : null}

      <section className="rounded-2xl bg-ulv-blue px-5 py-7 text-white shadow-sm md:px-8">
        <p className="text-sm font-semibold text-ulv-yellow">Servicios</p>
        <h1 className="mt-3 text-3xl font-black leading-tight md:text-5xl">Servicios de biblioteca</h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-white/85">Consulta servicios disponibles para préstamo, apoyo, capacitación, espacios y recursos digitales.</p>
      </section>

      <Card className="mt-6">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
            <DropdownSelect label="Biblioteca" options={[{ label: "Todas las bibliotecas", value: "all" }, ...libraries.map((library) => ({ label: library.name, value: library.id }))]} value={libraryFilter} onChange={setLibraryFilter} />
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
            <DropdownSelect
              label="Categoría"
              options={[{ label: "Todas las categorías", value: "all" }, ...Object.entries(libraryServiceCategoryLabels).map(([value, label]) => ({ value, label }))]}
              value={categoryFilter}
              onChange={(value) => setCategoryFilter(value as CategoryFilter)}
            />
          </div>
          <label><span className="text-sm font-bold text-ulv-blue">Búsqueda</span><span className="mt-2 flex min-h-12 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4"><Search className="h-4 w-4 text-slate-400" aria-hidden="true" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por título o descripción" className="w-full bg-transparent text-sm font-semibold outline-none" /></span></label>
        </div>
      </Card>

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filteredServices.length === 0 ? (
          <Card className="text-center md:col-span-2 xl:col-span-3"><Wrench className="mx-auto h-10 w-10 text-ulv-blue" aria-hidden="true" /><h2 className="mt-3 text-xl font-black text-ulv-blue">No hay servicios disponibles</h2><p className="mt-2 text-sm text-slate-600">Cuando existan servicios activos aparecerán aquí.</p></Card>
        ) : filteredServices.map((service) => (
          <Card key={service.id} className="flex h-full flex-col">
            <div className="flex flex-wrap gap-2"><span className="rounded-full bg-ulv-yellow px-3 py-1 text-xs font-black text-ulv-blue">{libraryServiceCategoryLabels[service.category]}</span><span className="rounded-full bg-ulv-blue/10 px-3 py-1 text-xs font-black text-ulv-blue">{service.libraries?.name ?? "Todas las bibliotecas"}</span></div>
            <h2 className="mt-4 text-2xl font-black text-ulv-blue">{service.title}</h2>
            <p className="mt-2 flex-1 text-sm leading-6 text-slate-600">{service.summary ?? service.description}</p>
            <p className="mt-3 text-xs font-bold text-slate-500">Audiencia: {libraryServiceAudienceLabels[service.audience]}</p>
            <Link href={`/servicios/${service.slug}`} className="mt-5 inline-flex min-h-12 items-center justify-center rounded-2xl bg-ulv-yellow px-5 py-3 text-sm font-black text-ulv-blue">Ver servicio</Link>
          </Card>
        ))}
      </section>
    </PageContainer>
  );
}
