import { Mail, MapPin, Phone } from "lucide-react";
import { PageContainer } from "../layout/PageContainer";
import { Card } from "../ui/Card";

export default function ContactoPage() {
  return (
    <PageContainer>
      <div className="mb-6">
        <p className="text-sm font-bold text-ulv-blue">Contacto</p>
        <h1 className="text-3xl font-black text-slate-950">Biblioteca Universidad Linda Vista</h1>
        <p className="mt-2 max-w-2xl text-slate-600">Información de ejemplo para la primera versión visual.</p>
      </div>

      <Card>
        <div className="space-y-5">
          <div className="flex gap-3">
            <MapPin className="mt-1 h-5 w-5 text-ulv-blue" aria-hidden="true" />
            <div>
              <h2 className="font-bold text-slate-950">Ubicación</h2>
              <p className="text-sm text-slate-600">Campus Universidad Linda Vista, Chiapas</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Phone className="mt-1 h-5 w-5 text-ulv-blue" aria-hidden="true" />
            <div>
              <h2 className="font-bold text-slate-950">Teléfono</h2>
              <p className="text-sm text-slate-600">+52 000 000 0000</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Mail className="mt-1 h-5 w-5 text-ulv-blue" aria-hidden="true" />
            <div>
              <h2 className="font-bold text-slate-950">Correo</h2>
              <p className="text-sm text-slate-600">biblioteca@ulv.edu.mx</p>
            </div>
          </div>
        </div>
      </Card>
    </PageContainer>
  );
}
