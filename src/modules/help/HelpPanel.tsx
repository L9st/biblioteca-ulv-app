"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CircleHelp, Search } from "lucide-react";
import { Card } from "@/app/ui/Card";
import { DropdownSelect } from "@/app/ui/DropdownSelect";
import { PageContainer } from "@/app/layout/PageContainer";
import { getPublishedHelpArticles, helpCategoryLabels, type HelpCategory, type PublicHelpArticle } from "@/services/help.service";

type CategoryFilter = "all" | HelpCategory;

function matchesSearch(article: PublicHelpArticle, search: string) {
  const term = search.trim().toLowerCase();
  if (!term) return true;
  return [article.title, article.question ?? "", article.answer].some((value) => value.toLowerCase().includes(term));
}

export function HelpPanel() {
  const [isLoading, setIsLoading] = useState(true);
  const [articles, setArticles] = useState<PublicHelpArticle[]>([]);
  const [libraryFilter, setLibraryFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(async () => {
      const result = await getPublishedHelpArticles();
      setArticles(result.data);
      setError(result.error);
      setIsLoading(false);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  const libraries = useMemo(() => Array.from(new Map(articles.filter((article) => article.libraries).map((article) => [article.libraries?.id ?? "", article.libraries])).values()).filter((library) => library !== null), [articles]);

  const filteredArticles = articles.filter((article) => {
    const libraryMatches = libraryFilter === "all" || article.library_id === libraryFilter;
    const categoryMatches = categoryFilter === "all" || article.category === categoryFilter;
    return libraryMatches && categoryMatches && matchesSearch(article, search);
  });

  if (isLoading) return <PageContainer><Card><p className="text-sm font-semibold text-slate-600">Cargando ayuda...</p></Card></PageContainer>;

  return (
    <PageContainer>
      {error ? <p className="mb-5 rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-800">{error}</p> : null}
      <section className="rounded-[2rem] bg-ulv-blue px-5 py-7 text-white shadow-sm md:px-8"><p className="text-sm font-semibold text-ulv-yellow">Ayuda</p><h1 className="mt-3 text-3xl font-black leading-tight md:text-5xl">Centro de ayuda</h1><p className="mt-3 max-w-2xl text-base leading-7 text-white/85">Consulta preguntas frecuentes, instrucciones y guías rápidas de uso de la Biblioteca ULV App.</p></section>
      <Card className="mt-6"><div className="grid gap-4 md:grid-cols-3"><div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5"><DropdownSelect label="Biblioteca" options={[{ label: "Todas las bibliotecas", value: "all" }, ...libraries.map((library) => ({ label: library.name, value: library.id }))]} value={libraryFilter} onChange={setLibraryFilter} /></div><div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5"><DropdownSelect label="Categoría" options={[{ label: "Todas las categorías", value: "all" }, ...Object.entries(helpCategoryLabels).map(([value, label]) => ({ value, label }))]} value={categoryFilter} onChange={(value) => setCategoryFilter(value as CategoryFilter)} /></div><label><span className="text-sm font-bold text-ulv-blue">Búsqueda</span><span className="mt-2 flex min-h-12 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4"><Search className="h-4 w-4 text-slate-400" aria-hidden="true" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por título, pregunta o respuesta" className="w-full bg-transparent text-sm font-semibold outline-none" /></span></label></div></Card>
      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filteredArticles.length === 0 ? <Card className="text-center md:col-span-2 xl:col-span-3"><CircleHelp className="mx-auto h-10 w-10 text-ulv-blue" aria-hidden="true" /><h2 className="mt-3 text-xl font-black text-ulv-blue">No hay artículos de ayuda disponibles</h2><p className="mt-2 text-sm text-slate-600">Cuando existan artículos publicados aparecerán aquí.</p></Card> : filteredArticles.map((article) => <Card key={article.id} className="flex h-full flex-col"><div className="flex flex-wrap gap-2"><span className="rounded-full bg-ulv-yellow px-3 py-1 text-xs font-black text-ulv-blue">{helpCategoryLabels[article.category]}</span><span className="rounded-full bg-ulv-blue/10 px-3 py-1 text-xs font-black text-ulv-blue">{article.libraries?.name ?? "Todas las bibliotecas"}</span></div><h2 className="mt-4 text-2xl font-black text-ulv-blue">{article.title}</h2><p className="mt-2 flex-1 text-sm leading-6 text-slate-600">{article.question ?? article.answer}</p><Link href={`/ayuda/${article.slug}`} className="mt-5 inline-flex min-h-12 items-center justify-center rounded-2xl bg-ulv-yellow px-5 py-3 text-sm font-black text-ulv-blue">Ver ayuda</Link></Card>)}
      </section>
    </PageContainer>
  );
}
