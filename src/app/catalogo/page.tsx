import { Search } from "lucide-react";
import { PageContainer } from "../layout/PageContainer";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";

export default function CatalogoPage() {
  return (
    <PageContainer>
      <div className="mb-6">
        <p className="text-sm font-bold text-ulv-blue">Catálogo</p>
        <h1 className="text-3xl font-black text-slate-950">Buscar en Koha</h1>
        <p className="mt-2 max-w-2xl text-slate-600">Primera versión visual: búsqueda de ejemplo sin conexión al OPAC.</p>
      </div>

      <Card>
        <label htmlFor="search" className="text-sm font-bold text-ulv-blue">
          ¿Qué recurso buscas?
        </label>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <div className="flex min-h-12 flex-1 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4">
            <Search className="h-5 w-5 text-slate-400" aria-hidden="true" />
            <input
              id="search"
              placeholder="Título, autor o tema"
              className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
            />
          </div>
          <Button>Buscar</Button>
        </div>
      </Card>

      <Card className="mt-5">
        <h2 className="text-xl font-black text-ulv-blue">Acceso al OPAC</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          En la siguiente etapa este formulario abrirá resultados del OPAC de Koha usando variables de entorno.
        </p>
      </Card>
    </PageContainer>
  );
}
