import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/app/ui/Card";
import { PageContainer } from "@/app/layout/PageContainer";
import { getHelpArticleBySlug, helpAudienceLabels, helpCategoryLabels } from "@/services/help.service";

export default async function HelpDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const result = await getHelpArticleBySlug(slug);
  if (!result.data) notFound();
  const article = result.data;

  return (
    <PageContainer>
      <section className="rounded-[2rem] bg-ulv-blue px-5 py-7 text-white shadow-sm md:px-8"><p className="text-sm font-semibold text-ulv-yellow">Preguntas frecuentes</p><h1 className="mt-3 text-3xl font-black leading-tight md:text-5xl">{article.title}</h1><p className="mt-3 max-w-2xl text-base leading-7 text-white/85">{article.question ?? "Guía rápida de ayuda para usuarios de biblioteca."}</p></section>
      <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_0.55fr]"><Card><div className="flex flex-wrap gap-2"><span className="rounded-full bg-ulv-yellow px-3 py-1 text-xs font-black text-ulv-blue">{helpCategoryLabels[article.category]}</span><span className="rounded-full bg-ulv-blue/10 px-3 py-1 text-xs font-black text-ulv-blue">{article.libraries?.name ?? "Todas las bibliotecas"}</span></div>{article.question ? <><h2 className="mt-5 text-lg font-black text-ulv-blue">Pregunta</h2><p className="mt-2 text-sm leading-7 text-slate-700">{article.question}</p></> : null}<h2 className="mt-5 text-lg font-black text-ulv-blue">Respuesta</h2><p className="mt-2 whitespace-pre-line text-sm leading-7 text-slate-700">{article.answer}</p></Card><div className="space-y-4"><Card><h2 className="text-lg font-black text-ulv-blue">Detalles</h2><dl className="mt-4 space-y-3 text-sm"><div><dt className="font-bold text-slate-500">Biblioteca</dt><dd className="mt-1 text-slate-900">{article.libraries?.name ?? "Todas las bibliotecas"}</dd></div><div><dt className="font-bold text-slate-500">Categoría</dt><dd className="mt-1 text-slate-900">{helpCategoryLabels[article.category]}</dd></div><div><dt className="font-bold text-slate-500">Audiencia</dt><dd className="mt-1 text-slate-900">{helpAudienceLabels[article.audience]}</dd></div></dl></Card><Link href="/ayuda" className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-ulv-yellow px-5 py-3 text-sm font-black text-ulv-blue">Volver a ayuda</Link></div></div>
    </PageContainer>
  );
}
