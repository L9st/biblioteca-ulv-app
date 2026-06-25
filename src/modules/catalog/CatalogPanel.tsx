"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { BookOpen, ExternalLink, Search } from "lucide-react";
import { Card } from "@/app/ui/Card";
import { supabase } from "@/lib/supabase";
import { registerCatalogSearchEvent } from "@/services/catalog-analytics.service";
import { createCatalogSavedItem, createCatalogSearchHistory } from "@/services/catalog-saved-items.service";
import {
  buildKohaAccountUrl,
  buildKohaAdvancedSearchUrl,
  buildKohaSearchUrl,
  getKohaOpacBaseUrl,
  type CatalogSearchType,
} from "@/services/catalog.service";

const searchTypeLabels: Record<CatalogSearchType, string> = {
  keyword: "Palabra clave",
  title: "Título",
  author: "Autor",
  subject: "Tema",
  isbn: "ISBN",
};

const examples = ["matemáticas", "administración", "educación cristiana", "programación", "historia"];
const fieldClass = "mt-2 min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 outline-none focus:border-ulv-blue focus:ring-4 focus:ring-ulv-blue/10";

function openExternalUrl(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}

function safeExternalUrl(buildUrl: () => string): string | null {
  try {
    return buildUrl();
  } catch {
    return null;
  }
}

export function CatalogPanel() {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<CatalogSearchType>("keyword");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [hasSession, setHasSession] = useState(false);
  const [lastSearch, setLastSearch] = useState<{ query: string; type: CatalogSearchType; url: string } | null>(null);
  const [isSavingSearch, setIsSavingSearch] = useState(false);
  const baseUrl = safeExternalUrl(getKohaOpacBaseUrl);
  const advancedUrl = safeExternalUrl(buildKohaAdvancedSearchUrl);
  const accountUrl = safeExternalUrl(buildKohaAccountUrl);

  useEffect(() => {
    const timeout = window.setTimeout(async () => {
      const { data } = await supabase.auth.getSession();
      setHasSession(Boolean(data.session));
    }, 0);

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasSession(Boolean(session));
    });

    return () => {
      window.clearTimeout(timeout);
      authListener.subscription.unsubscribe();
    };
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    try {
      const url = buildKohaSearchUrl({ query, type });
      const cleanQuery = query.trim();
      setLastSearch({ query: cleanQuery, type, url });
      openExternalUrl(url);
      void registerCatalogSearchEvent({ query: cleanQuery, searchType: type, kohaUrl: url, source: "catalog" });
      if (hasSession) void createCatalogSearchHistory({ query: cleanQuery, search_type: type, koha_url: url });
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "No se pudo abrir el catálogo Koha.");
    }
  }

  async function handleSaveSearch() {
    setFeedback(null);
    if (!hasSession) {
      setFeedback("Debes iniciar sesión para guardar recursos.");
      return;
    }

    let searchToSave = lastSearch;
    if (!searchToSave) {
      try {
        const url = buildKohaSearchUrl({ query, type });
        searchToSave = { query: query.trim(), type, url };
        setLastSearch(searchToSave);
      } catch (error) {
        setFeedback(error instanceof Error ? error.message : "No se pudo preparar la búsqueda.");
        return;
      }
    }

    setIsSavingSearch(true);
    const result = await createCatalogSavedItem({
      title: `Búsqueda: ${searchToSave.query}`,
      author: null,
      isbn: null,
      year: null,
      koha_url: searchToSave.url,
      status: "saved",
      notes: "Búsqueda guardada desde el catálogo",
    });
    setIsSavingSearch(false);
    setFeedback(result.error ?? "Búsqueda guardada correctamente.");
  }

  const quickLinks = [
    { title: "Búsqueda avanzada", description: "Abre el formulario avanzado del OPAC.", url: advancedUrl, external: true },
    { title: "Mi cuenta Koha", description: "Consulta tu cuenta en el OPAC oficial.", url: accountUrl, external: true },
    { title: "Catálogo completo", description: "Abre la página principal del catálogo.", url: baseUrl, external: true },
    { title: "Mis recursos guardados", description: "Consulta favoritos e historial de búsquedas.", url: "/mis-recursos", external: false },
    { title: "Ayuda para buscar", description: "Guía rápida para usar el catálogo.", url: "/ayuda", external: false },
  ];

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 pb-24 sm:px-6 lg:px-8 md:pb-8">
      <section className="rounded-[2rem] bg-ulv-blue p-5 text-white shadow-sm md:p-8">
        <p className="text-sm font-bold text-ulv-yellow">Biblioteca ULV</p>
        <h1 className="mt-2 text-3xl font-black leading-tight md:text-5xl">Catálogo Koha</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-white/85">Busca libros, autores, temas o ISBN en el catálogo bibliográfico de la biblioteca.</p>
      </section>

      {feedback ? <p className="mt-5 rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-800">{feedback}</p> : null}
      {!baseUrl ? <p className="mt-5 rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-800">No se configuró la URL del OPAC de Koha.</p> : null}

      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <Card>
          <div className="mb-5 flex items-start gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-ulv-yellow text-ulv-blue">
              <Search className="h-6 w-6" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-xl font-black text-ulv-blue">Buscador principal</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">La búsqueda se abre en una nueva pestaña del OPAC oficial de Koha.</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
            <label>
              <span className="text-sm font-bold text-ulv-blue">Tipo de búsqueda</span>
              <select value={type} onChange={(event) => setType(event.target.value as CatalogSearchType)} className={fieldClass}>
                {Object.entries(searchTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label>
              <span className="text-sm font-bold text-ulv-blue">Término de búsqueda</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ej. educación cristiana" className={fieldClass} />
            </label>
            <div className="md:col-span-2">
              <div className="grid gap-3 sm:flex sm:flex-wrap">
                <button type="submit" className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-ulv-yellow px-5 py-3 text-sm font-black text-ulv-blue shadow-sm transition hover:bg-[#e8b800] sm:w-auto">
                  Buscar en Koha
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                </button>
                <button type="button" onClick={() => void handleSaveSearch()} disabled={isSavingSearch} className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl border border-ulv-blue px-5 py-3 text-sm font-black text-ulv-blue transition hover:bg-ulv-bg disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto">
                  {isSavingSearch ? "Guardando..." : "Guardar búsqueda"}
                </button>
                <Link href="/mis-recursos" className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-ulv-blue px-5 py-3 text-sm font-black text-white transition hover:bg-ulv-blue/90 sm:w-auto">
                  Ver mis recursos
                </Link>
              </div>
              {!hasSession ? <p className="mt-3 text-sm font-semibold text-slate-600">Puedes buscar como visitante. Para guardar historial o favoritos, inicia sesión.</p> : null}
            </div>
          </form>
        </Card>

        <Card>
          <h2 className="text-xl font-black text-ulv-blue">Ejemplos de búsqueda</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Toca un ejemplo para cargarlo en el formulario.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {examples.map((example) => (
              <button key={example} type="button" onClick={() => setQuery(example)} className="min-h-10 rounded-2xl border border-ulv-blue/20 bg-white px-4 py-2 text-sm font-black text-ulv-blue transition hover:bg-ulv-yellow/20">
                {example}
              </button>
            ))}
          </div>
        </Card>
      </div>

      <section className="mt-6">
        <h2 className="text-xl font-black text-ulv-blue">Accesos rápidos</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {quickLinks.map((link) => {
            const content = <Card className="h-full transition hover:-translate-y-0.5 hover:shadow-md"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-ulv-yellow text-ulv-blue"><BookOpen className="h-5 w-5" aria-hidden="true" /></span><h3 className="mt-4 text-lg font-black text-ulv-blue">{link.title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{link.description}</p><span className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-2xl border border-ulv-blue/20 bg-white px-4 text-sm font-black text-ulv-blue">Abrir {link.external ? <ExternalLink className="h-4 w-4" aria-hidden="true" /> : null}</span></Card>;
            if (!link.url) return <div key={link.title} className="opacity-60">{content}</div>;
            if (link.external) return <a key={link.title} href={link.url} target="_blank" rel="noopener noreferrer">{content}</a>;
            return <Link key={link.title} href={link.url}>{content}</Link>;
          })}
        </div>
      </section>

      <Card className="mt-6">
        <h2 className="text-xl font-black text-ulv-blue">Cómo buscar en el catálogo Koha</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">Puedes buscar por palabra clave, título, autor, tema o ISBN. Al realizar la búsqueda, la app abrirá el OPAC de Koha en una nueva pestaña para mostrar los resultados oficiales del catálogo.</p>
      </Card>
    </div>
  );
}
