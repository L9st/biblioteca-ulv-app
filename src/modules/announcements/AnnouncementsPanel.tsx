"use client";

import { useEffect, useMemo, useState } from "react";
import { Bell, Search } from "lucide-react";
import { Card } from "@/app/ui/Card";
import { DropdownSelect } from "@/app/ui/DropdownSelect";
import { PageContainer } from "@/app/layout/PageContainer";
import {
  announcementTypeLabels,
  getPublishedAnnouncements,
  type AnnouncementType,
  type PublicAnnouncement,
} from "@/services/announcements.service";

type TypeFilter = "all" | AnnouncementType;

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" }).format(new Date(value));
}

function matchesSearch(announcement: PublicAnnouncement, search: string) {
  const term = search.trim().toLowerCase();
  if (!term) return true;
  return [announcement.title, announcement.summary ?? "", announcement.content].some((value) => value.toLowerCase().includes(term));
}

export function AnnouncementsPanel() {
  const [isLoading, setIsLoading] = useState(true);
  const [announcements, setAnnouncements] = useState<PublicAnnouncement[]>([]);
  const [libraryFilter, setLibraryFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(async () => {
      const result = await getPublishedAnnouncements();
      setAnnouncements(result.data);
      setError(result.error);
      setIsLoading(false);
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

  const libraries = useMemo(
    () => Array.from(new Map(announcements.filter((announcement) => announcement.libraries).map((announcement) => [announcement.libraries?.id ?? "", announcement.libraries])).values()).filter((library) => library !== null),
    [announcements],
  );

  const filteredAnnouncements = announcements.filter((announcement) => {
    const libraryMatches = libraryFilter === "all" || announcement.library_id === libraryFilter;
    const typeMatches = typeFilter === "all" || announcement.type === typeFilter;
    return libraryMatches && typeMatches && matchesSearch(announcement, search);
  });

  if (isLoading) {
    return (
      <PageContainer>
        <Card>
          <p className="text-sm font-semibold text-slate-600">Cargando avisos...</p>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      {error ? <p className="mb-5 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</p> : null}

      <section className="rounded-2xl bg-ulv-blue px-5 py-7 text-white shadow-sm md:px-8">
        <p className="text-sm font-semibold text-ulv-yellow">Avisos</p>
        <h1 className="mt-3 text-3xl font-black leading-tight md:text-5xl">Avisos y comunicados</h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-white/85">
          Consulta información oficial sobre horarios, eventos, mantenimiento y comunicados de biblioteca.
        </p>
      </section>

      <Card className="mt-6">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
            <DropdownSelect
              label="Biblioteca"
              options={[{ label: "Todas las bibliotecas", value: "all" }, ...libraries.map((library) => ({ label: library.name, value: library.id }))]}
              value={libraryFilter}
              onChange={setLibraryFilter}
              emptyLabel="Todas las bibliotecas"
            />
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
            <DropdownSelect
              label="Tipo"
              options={[
                { label: "Todos los tipos", value: "all" },
                { label: announcementTypeLabels.info, value: "info" },
                { label: announcementTypeLabels.warning, value: "warning" },
                { label: announcementTypeLabels.event, value: "event" },
                { label: announcementTypeLabels.maintenance, value: "maintenance" },
              ]}
              value={typeFilter}
              onChange={(value) => setTypeFilter(value as TypeFilter)}
              emptyLabel="Todos los tipos"
            />
          </div>
          <label className="block">
            <span className="text-sm font-bold text-ulv-blue">Búsqueda</span>
            <span className="mt-2 flex min-h-12 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 focus-within:border-ulv-blue focus-within:ring-4 focus-within:ring-ulv-blue/10">
              <Search className="h-4 w-4 text-slate-400" aria-hidden="true" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por título o contenido"
                className="w-full bg-transparent font-semibold outline-none"
              />
            </span>
          </label>
        </div>
      </Card>

      <section className="mt-6 space-y-4">
        {filteredAnnouncements.length === 0 ? (
          <Card className="text-center">
            <Bell className="mx-auto h-10 w-10 text-ulv-blue" aria-hidden="true" />
            <h2 className="mt-3 text-xl font-black text-ulv-blue">No hay avisos publicados</h2>
            <p className="mt-2 text-sm text-slate-600">Cuando existan comunicados vigentes aparecerán en esta sección.</p>
          </Card>
        ) : (
          filteredAnnouncements.map((announcement) => (
            <Card key={announcement.id}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-ulv-yellow px-3 py-1 text-xs font-black text-ulv-blue">{announcementTypeLabels[announcement.type]}</span>
                    <span className="rounded-full bg-ulv-blue/10 px-3 py-1 text-xs font-black text-ulv-blue">
                      {announcement.libraries?.name ?? "Todas las bibliotecas"}
                    </span>
                  </div>
                  <h2 className="mt-3 text-2xl font-black text-ulv-blue">{announcement.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{announcement.summary ?? announcement.content}</p>
                  <p className="mt-2 text-xs font-bold text-slate-500">Publicado: {formatDate(announcement.created_at)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpenId((current) => (current === announcement.id ? null : announcement.id))}
                  className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-2xl bg-ulv-yellow px-4 text-sm font-black text-ulv-blue"
                >
                  {openId === announcement.id ? "Ver menos" : "Ver más"}
                </button>
              </div>
              {openId === announcement.id ? <p className="mt-5 whitespace-pre-line rounded-2xl bg-slate-50 p-4 text-sm leading-7 text-slate-700">{announcement.content}</p> : null}
            </Card>
          ))
        )}
      </section>
    </PageContainer>
  );
}
