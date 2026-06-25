import Link from "next/link";
import { notFound } from "next/navigation";
import { ImageIcon } from "lucide-react";
import { Card } from "@/app/ui/Card";
import { PageContainer } from "@/app/layout/PageContainer";
import { getLibraryServiceBySlug, libraryServiceAudienceLabels, libraryServiceCategoryLabels } from "@/services/library-services.service";

export default async function ServiceDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const result = await getLibraryServiceBySlug(slug);
  if (!result.data) notFound();
  const service = result.data;

  return (
    <PageContainer>
      <section className="rounded-2xl bg-ulv-blue px-5 py-7 text-white shadow-sm md:px-8">
        <p className="text-sm font-semibold text-ulv-yellow">Servicios de biblioteca</p>
        <h1 className="mt-3 text-3xl font-black leading-tight md:text-5xl">{service.title}</h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-white/85">{service.summary ?? "Información del servicio bibliotecario."}</p>
      </section>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_0.7fr]">
        <Card>
          {service.image_url ? <div className="mb-5 h-56 w-full rounded-3xl bg-cover bg-center" style={{ backgroundImage: `url(${service.image_url})` }} role="img" aria-label={service.title} /> : <div className="mb-5 flex h-56 w-full items-center justify-center rounded-3xl bg-slate-100 text-ulv-blue"><ImageIcon className="h-12 w-12" aria-hidden="true" /></div>}
          <div className="flex flex-wrap gap-2"><span className="rounded-full bg-ulv-yellow px-3 py-1 text-xs font-black text-ulv-blue">{libraryServiceCategoryLabels[service.category]}</span><span className="rounded-full bg-ulv-blue/10 px-3 py-1 text-xs font-black text-ulv-blue">{service.libraries?.name ?? "Todas las bibliotecas"}</span></div>
          <h2 className="mt-5 text-xl font-black text-ulv-blue">Descripción</h2>
          <p className="mt-2 whitespace-pre-line text-sm leading-7 text-slate-700">{service.description}</p>
        </Card>

        <div className="space-y-4">
          <Card><h2 className="text-lg font-black text-ulv-blue">Detalles</h2><dl className="mt-4 space-y-3 text-sm"><div><dt className="font-bold text-slate-500">Audiencia</dt><dd className="mt-1 text-slate-900">{libraryServiceAudienceLabels[service.audience]}</dd></div><div><dt className="font-bold text-slate-500">Requisitos</dt><dd className="mt-1 whitespace-pre-line text-slate-900">{service.requirements ?? "Sin requisitos específicos"}</dd></div><div><dt className="font-bold text-slate-500">Horario</dt><dd className="mt-1 whitespace-pre-line text-slate-900">{service.schedule ?? "Consulta disponibilidad en biblioteca"}</dd></div><div><dt className="font-bold text-slate-500">Contacto</dt><dd className="mt-1 whitespace-pre-line text-slate-900">{service.contact_info ?? "Consulta al personal de biblioteca"}</dd></div></dl></Card>
          <Link href="/servicios" className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-ulv-yellow px-5 py-3 text-sm font-black text-ulv-blue">Volver a servicios</Link>
        </div>
      </div>
    </PageContainer>
  );
}
