"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { Bell, BookOpen, CalendarCheck, ChevronDown, CircleHelp, Clock3, ExternalLink, Headphones, LogIn, MapPinned, Megaphone, ShieldCheck, UserRound, Wrench } from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  getCurrentDashboardUser,
  getCurrentOpenAttendance,
  getNextReservation,
  getUnreadNotificationsCount,
  type DashboardOpenAttendance,
  type DashboardReservation,
  type DashboardUser,
} from "@/services/dashboard.service";
import { getMyAttendanceSummary, type AttendanceSummary } from "@/services/attendance.service";
import { Card } from "@/app/ui/Card";
import { PageContainer } from "@/app/layout/PageContainer";
import { InstallAppButton } from "@/components/pwa/InstallAppButton";
import { getLatestLibraryServices, libraryServiceCategoryLabels, type PublicLibraryService } from "@/services/library-services.service";
import { getLatestHelpArticles, helpCategoryLabels, type PublicHelpArticle } from "@/services/help.service";
import { buildKohaSearchUrl } from "@/services/catalog.service";
import { registerCatalogSearchEvent } from "@/services/catalog-analytics.service";

type QuickCard = {
  title: string;
  description: string;
  href?: string;
  externalHref?: string;
  buttonLabel: string;
  icon: typeof Clock3;
  badge?: string;
  disabled?: boolean;
};

type DashboardSectionId = "quick" | "reservations" | "services" | "help";
type DashboardRole = "visitor" | "student" | "librarian" | "admin" | "superadmin";

const emptyAttendanceSummary: AttendanceSummary = {
  todayMinutes: 0,
  weekMinutes: 0,
  monthMinutes: 0,
};

function getDashboardRole(hasSession: boolean, role: DashboardUser["role"] | null | undefined): DashboardRole {
  if (!hasSession) return "visitor";
  if (role === "librarian" || role === "admin" || role === "superadmin") return role;
  return "student";
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("es-MX", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function getReservationStatusLabel(status: string) {
  return status === "approved" ? "Aprobada" : "Pendiente";
}

function formatServiceLibraryName(service: PublicLibraryService) {
  return service.libraries?.name ?? "Todas las bibliotecas";
}

function formatHelpLibraryName(article: PublicHelpArticle) {
  return article.libraries?.name ?? "Todas las bibliotecas";
}

function truncateText(value: string | null | undefined, maxLength = 140) {
  if (!value) return "";
  const normalizedValue = value.replace(/\s+/g, " ").trim();
  if (normalizedValue.length <= maxLength) return normalizedValue;
  return `${normalizedValue.slice(0, maxLength).trimEnd()}...`;
}

function formatMinutes(minutes: number | null) {
  if (!minutes || minutes <= 0) return "0 min";

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours === 0) return `${remainingMinutes} min`;
  if (remainingMinutes === 0) return `${hours} h`;

  return `${hours} h ${remainingMinutes} min`;
}

function DashboardAccordionSection({ id, title, eyebrow, openSection, onToggle, children }: { id: DashboardSectionId; title: string; eyebrow: string; openSection: DashboardSectionId | null; onToggle: (id: DashboardSectionId) => void; children: React.ReactNode }) {
  const isOpen = openSection === id;

  return (
    <section className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm">
      <button type="button" onClick={() => onToggle(id)} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left">
        <span>
          <span className="block text-xs font-black uppercase tracking-[0.16em] text-ulv-blue">{eyebrow}</span>
          <span className="mt-1 block text-xl font-black text-slate-950">{title}</span>
        </span>
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-ulv-bg text-ulv-blue transition ${isOpen ? "rotate-180" : ""}`}>
          <ChevronDown className="h-5 w-5" aria-hidden="true" />
        </span>
      </button>
      {isOpen ? <div className="border-t border-slate-100 px-5 py-5">{children}</div> : null}
    </section>
  );
}

function QuickAccessCard({ card }: { card: QuickCard }) {
  const Icon = card.icon;
  const content = (
    <Card className={`h-full p-4 transition ${card.disabled ? "opacity-70" : "hover:-translate-y-0.5 hover:shadow-md"}`}>
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-ulv-yellow text-ulv-blue">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-black text-ulv-blue">{card.title}</span>
          <span className="mt-1 block text-sm leading-5 text-slate-600">{card.description}</span>
          {card.badge ? <span className="mt-2 inline-flex rounded-full bg-ulv-blue px-3 py-1 text-xs font-black text-white">{card.badge}</span> : null}
        </span>
      </div>
      <span className={`mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-2xl px-4 text-sm font-bold ${card.disabled ? "bg-slate-200 text-slate-500" : "bg-ulv-yellow text-ulv-blue"}`}>
        {card.buttonLabel}
        {card.externalHref ? <ExternalLink className="h-4 w-4" aria-hidden="true" /> : null}
      </span>
    </Card>
  );

  if (card.disabled) return content;
  if (card.externalHref) {
    return (
      <a href={card.externalHref} target="_blank" rel="noreferrer">
        {content}
      </a>
    );
  }

  return <Link href={card.href ?? "/"}>{content}</Link>;
}

export function HomeDashboard() {
  const [isLoading, setIsLoading] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [user, setUser] = useState<DashboardUser | null>(null);
  const [openAttendance, setOpenAttendance] = useState<DashboardOpenAttendance | null>(null);
  const [attendanceSummary, setAttendanceSummary] = useState<AttendanceSummary>(emptyAttendanceSummary);
  const [unreadCount, setUnreadCount] = useState(0);
  const [nextReservation, setNextReservation] = useState<DashboardReservation | null>(null);
  const [latestServices, setLatestServices] = useState<PublicLibraryService[]>([]);
  const [latestHelpArticles, setLatestHelpArticles] = useState<PublicHelpArticle[]>([]);
  const [openSection, setOpenSection] = useState<DashboardSectionId | null>("quick");
  const [error, setError] = useState<string | null>(null);
  const [catalogQuery, setCatalogQuery] = useState("");
  const [catalogFeedback, setCatalogFeedback] = useState<string | null>(null);
  const kohaOpacUrl = process.env.NEXT_PUBLIC_KOHA_OPAC_URL;

  useEffect(() => {
    const timeout = window.setTimeout(async () => {
      const { data } = await supabase.auth.getSession();
      const [latestServicesResult, latestHelpResult] = await Promise.all([getLatestLibraryServices(3), getLatestHelpArticles(3)]);
      const isAuthenticated = Boolean(data.session);
      setHasSession(isAuthenticated);
      setLatestServices(latestServicesResult.data);
      setLatestHelpArticles(latestHelpResult.data);

      if (!isAuthenticated) {
        setAttendanceSummary(emptyAttendanceSummary);
        setError(latestServicesResult.error ?? latestHelpResult.error);
        setIsLoading(false);
        return;
      }

      const [userResult, attendanceResult, attendanceSummaryResult, notificationResult, reservationResult] = await Promise.all([
        getCurrentDashboardUser(),
        getCurrentOpenAttendance(),
        getMyAttendanceSummary(),
        getUnreadNotificationsCount(),
        getNextReservation(),
      ]);

      setUser(userResult.data);
      setOpenAttendance(attendanceResult.data);
      setAttendanceSummary(attendanceSummaryResult);
      setUnreadCount(notificationResult.data);
      setNextReservation(reservationResult.data);
      setError(userResult.error ?? attendanceResult.error ?? notificationResult.error ?? reservationResult.error ?? latestServicesResult.error ?? latestHelpResult.error);
      setIsLoading(false);
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

  const role = getDashboardRole(hasSession, user?.role);
  const catalogCard: QuickCard = { title: "Catálogo Koha", description: "Busca libros, autores, temas o ISBN en el catálogo bibliográfico.", href: "/catalogo", buttonLabel: "Buscar catálogo", icon: BookOpen, badge: kohaOpacUrl ? undefined : "Configurar OPAC" };
  const quickCards: QuickCard[] =
    role === "visitor"
      ? [
          catalogCard,
          { title: "Espacios", description: "Salas y áreas disponibles.", href: "/espacios", buttonLabel: "Ver espacios", icon: MapPinned },
          { title: "Servicios", description: "Préstamos, orientación y recursos.", href: "/servicios", buttonLabel: "Ver servicios", icon: Wrench },
          { title: "Ayuda", description: "Preguntas frecuentes y guías.", href: "/ayuda", buttonLabel: "Ver ayuda", icon: CircleHelp },
          { title: "Iniciar sesión", description: "Accede a horas y reservas.", href: "/login", buttonLabel: "Iniciar sesión", icon: LogIn },
        ]
      : role === "student"
        ? [
            { title: "Reservar espacio", description: "Solicita espacios disponibles.", href: "/reservas-espacios", buttonLabel: "Reservar", icon: CalendarCheck },
            { title: "Mis reservas", description: "Consulta tu próxima reserva y solicitudes.", href: "/reservas-espacios", buttonLabel: "Ver reservas", icon: CalendarCheck },
            catalogCard,
            { title: "Mis recursos", description: "Consulta recursos guardados, favoritos e historial.", href: "/mis-recursos", buttonLabel: "Ver recursos", icon: BookOpen },
            { title: "Notificaciones", description: "Actividad de tu cuenta.", href: "/notificaciones", buttonLabel: "Ver notificaciones", icon: Bell, badge: unreadCount > 0 ? `${unreadCount} no leídas` : undefined },
            { title: "Soporte", description: "Reporta problemas o solicita ayuda sobre el uso de la app.", href: "/soporte", buttonLabel: "Solicitar ayuda", icon: Headphones },
            { title: "Ayuda", description: "Preguntas frecuentes y guías.", href: "/ayuda", buttonLabel: "Ver ayuda", icon: CircleHelp },
            { title: "Espacios", description: "Salas y áreas disponibles.", href: "/espacios", buttonLabel: "Ver espacios", icon: MapPinned },
            { title: "Servicios", description: "Préstamos, orientación y recursos.", href: "/servicios", buttonLabel: "Ver servicios", icon: Wrench },
          ]
        : role === "librarian"
          ? [
              { title: "Panel administrativo", description: "Gestión bibliotecaria diaria.", href: "/admin", buttonLabel: "Abrir panel", icon: ShieldCheck },
              { title: "Reservas pendientes", description: "Revisa solicitudes de espacios.", href: "/admin/reservas", buttonLabel: "Ver reservas", icon: CalendarCheck },
              { title: "Generar QR", description: "Crea códigos QR de asistencia.", href: "/admin/qr", buttonLabel: "Abrir QR", icon: ShieldCheck },
              { title: "Asistencia", description: "Control de entrada, salida y usuarios activos.", href: "/admin/asistencia", buttonLabel: "Ver asistencia", icon: Clock3 },
              { title: "Soporte", description: "Atiende solicitudes de usuarios.", href: "/admin/soporte", buttonLabel: "Gestionar soporte", icon: Headphones },
              { title: "Avisos", description: "Publica comunicados de biblioteca.", href: "/admin/avisos", buttonLabel: "Gestionar avisos", icon: Megaphone },
              { title: "Espacios", description: "Administra espacios de biblioteca.", href: "/admin/espacios", buttonLabel: "Ver espacios", icon: MapPinned },
              { title: "Reportes", description: "Consulta reportes administrativos.", href: "/admin/reportes", buttonLabel: "Ver reportes", icon: ShieldCheck },
              catalogCard,
              { title: "Mi cuenta", description: "Perfil y accesos personales.", href: "/mi-cuenta", buttonLabel: "Ver cuenta", icon: UserRound },
            ]
          : [
              { title: "Diagnóstico", description: "Revisa variables, conexión y datos iniciales.", href: "/admin/diagnostico", buttonLabel: "Ver diagnóstico", icon: ShieldCheck },
              { title: "Estado de producción", description: "Checklist visual para validar la app.", href: "/admin/estado-produccion", buttonLabel: "Ver checklist", icon: ShieldCheck },
              { title: "Usuarios", description: "Gestiona roles y accesos.", href: "/admin/usuarios", buttonLabel: "Administrar usuarios", icon: UserRound },
              { title: "Reservas", description: "Administra reservas de espacios.", href: "/admin/reservas", buttonLabel: "Ver reservas", icon: CalendarCheck },
              { title: "Reportes", description: "Consulta reportes administrativos.", href: "/admin/reportes", buttonLabel: "Ver reportes", icon: ShieldCheck },
              { title: "Estadísticas del catálogo", description: "Consulta búsquedas y uso del catálogo.", href: "/admin/catalogo-estadisticas", buttonLabel: "Ver estadísticas", icon: BookOpen },
              { title: "Correos", description: "Revisa cola, enviados y fallidos.", href: "/admin/correos", buttonLabel: "Ver correos", icon: Bell },
              { title: "Auditoría", description: "Consulta acciones administrativas.", href: "/admin/auditoria", buttonLabel: "Ver auditoría", icon: ShieldCheck },
              { title: "Soporte", description: "Gestiona solicitudes de usuarios.", href: "/admin/soporte", buttonLabel: "Gestionar soporte", icon: Headphones },
              { title: "Configuración de reservas", description: "Define horarios y reglas de espacios.", href: "/admin/configuracion-reservas", buttonLabel: "Configurar", icon: CalendarCheck },
              catalogCard,
            ];

  function handleToggleSection(sectionId: DashboardSectionId) {
    setOpenSection((currentSection) => (currentSection === sectionId ? null : sectionId));
  }

  function handleCatalogSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCatalogFeedback(null);
    const query = catalogQuery.trim();
    if (!query) {
      setCatalogFeedback("Escribe un término de búsqueda.");
      return;
    }

    try {
      const url = buildKohaSearchUrl({ query, type: "keyword" });
      void registerCatalogSearchEvent({ query, searchType: "keyword", kohaUrl: url, source: "dashboard" });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (searchError) {
      setCatalogFeedback(searchError instanceof Error ? searchError.message : "No se pudo abrir el catálogo Koha.");
    }
  }

  if (isLoading) {
    return (
      <PageContainer>
        <Card>
          <p className="text-sm font-semibold text-slate-600">Cargando inicio...</p>
        </Card>
      </PageContainer>
    );
  }

  const displayName = user?.name || user?.email || "usuario";

  return (
    <PageContainer>
      {error ? <p className="mb-5 rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-800">{error}</p> : null}

      <section className="rounded-[2rem] bg-ulv-blue px-5 py-7 text-white shadow-sm md:px-8">
        <p className="text-sm font-semibold text-ulv-yellow">Biblioteca ULV App</p>
        <h1 className="mt-3 max-w-2xl text-3xl font-black leading-tight md:text-5xl">
          {hasSession ? `Hola, ${displayName}` : "Bienvenido a Biblioteca ULV App"}
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-white/85">
          {hasSession ? "Gestiona tus horas, reservas y servicios de biblioteca." : "Consulta espacios, servicios y accede al catálogo de biblioteca."}
        </p>
      </section>

      <div className="mt-6">
        <InstallAppButton />
      </div>

      {role === "student" ? <section className="mt-7 rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-ulv-blue">Horas y cuenta</p>
            <h2 className="mt-1 text-2xl font-black text-slate-950">Mi actividad</h2>
          </div>
          {hasSession ? <p className="text-sm font-bold text-slate-500">Resumen personal</p> : null}
        </div>

        {hasSession ? (
          <div className="mt-5 space-y-4">
            <Card className="p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-ulv-yellow text-ulv-blue">
                  <Clock3 className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <h3 className="text-lg font-black text-ulv-blue">{openAttendance ? "Entrada activa" : "Sin entrada activa"}</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    {openAttendance ? `${openAttendance.libraries?.name ?? "Biblioteca"} desde las ${formatTime(openAttendance.check_in_at)}.` : "No tienes una entrada abierta en este momento."}
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <h3 className="text-lg font-black text-ulv-blue">Buscar en catálogo Koha</h3>
              <form onSubmit={handleCatalogSearch} className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_120px_150px]">
                <input
                  value={catalogQuery}
                  onChange={(event) => setCatalogQuery(event.target.value)}
                  placeholder="¿Qué libro, autor o tema buscas?"
                  className="min-h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none focus:border-ulv-blue focus:ring-4 focus:ring-ulv-blue/10"
                />
                <button type="submit" className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-ulv-yellow px-4 text-sm font-black text-ulv-blue">Buscar</button>
                <Link href="/mis-recursos" className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-ulv-blue px-4 text-sm font-black text-ulv-blue">Mis recursos</Link>
              </form>
              {catalogFeedback ? <p className="mt-3 rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-800">{catalogFeedback}</p> : null}
            </Card>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Card className="p-4">
                <p className="text-xs font-bold text-slate-500">Horas de hoy</p>
                <p className="mt-1 text-2xl font-black text-ulv-blue">{formatMinutes(attendanceSummary.todayMinutes)}</p>
              </Card>
              <Card className="p-4">
                <p className="text-xs font-bold text-slate-500">Esta semana</p>
                <p className="mt-1 text-2xl font-black text-ulv-blue">{formatMinutes(attendanceSummary.weekMinutes)}</p>
              </Card>
              <Card className="p-4">
                <p className="text-xs font-bold text-slate-500">Este mes</p>
                <p className="mt-1 text-2xl font-black text-ulv-blue">{formatMinutes(attendanceSummary.monthMinutes)}</p>
              </Card>
              <Card className="p-4">
                <p className="text-xs font-bold text-slate-500">Notificaciones</p>
                <p className="mt-1 text-2xl font-black text-ulv-blue">{unreadCount}</p>
              </Card>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <Link href="/horas" className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-ulv-yellow px-4 text-sm font-black text-ulv-blue">Ver mis horas</Link>
              <Link href="/mi-cuenta" className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-ulv-blue px-4 text-sm font-black text-white">Ver mi cuenta</Link>
              <Link href="/notificaciones" className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-ulv-blue px-4 text-sm font-black text-ulv-blue">Ver notificaciones</Link>
            </div>
          </div>
        ) : (
          <Card className="mt-5 p-4">
            <p className="text-sm font-semibold text-slate-600">Inicia sesión para consultar tu entrada activa, horas acumuladas y notificaciones.</p>
            <Link href="/login" className="mt-4 inline-flex min-h-11 items-center justify-center rounded-2xl bg-ulv-yellow px-5 text-sm font-black text-ulv-blue">Iniciar sesión</Link>
          </Card>
        )}
      </section> : null}

      <div className="mt-7 space-y-4">
        <DashboardAccordionSection id="quick" title="Accesos rápidos" eyebrow="Inicio" openSection={openSection} onToggle={handleToggleSection}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {quickCards.map((card) => <QuickAccessCard key={card.title} card={card} />)}
          </div>
        </DashboardAccordionSection>

        {role === "student" ? <DashboardAccordionSection id="reservations" title="Reservas" eyebrow="Espacios" openSection={openSection} onToggle={handleToggleSection}>
          {hasSession ? (
            <Card>
              <h3 className="text-lg font-black text-ulv-blue">Próxima reserva</h3>
              {nextReservation ? (
                <>
                  <p className="mt-2 font-black text-slate-900">{nextReservation.library_spaces?.name ?? "Espacio"}</p>
                  <p className="mt-1 text-sm text-slate-600">{nextReservation.libraries?.name ?? "Biblioteca"}</p>
                  <p className="mt-2 text-sm font-bold text-slate-900">{formatDateTime(nextReservation.start_at)}</p>
                  <p className="mt-1 text-sm text-slate-600">Estado: {getReservationStatusLabel(nextReservation.status)}</p>
                </>
              ) : (
                <p className="mt-2 text-sm leading-6 text-slate-600">No tienes reservas próximas.</p>
              )}
              <Link href="/reservas-espacios" className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-ulv-yellow px-4 text-sm font-bold text-ulv-blue">Reservar espacio</Link>
            </Card>
          ) : (
            <Card>
              <p className="text-sm font-semibold text-slate-600">Inicia sesión para reservar espacios de biblioteca.</p>
              <Link href="/login" className="mt-4 inline-flex min-h-11 items-center justify-center rounded-2xl bg-ulv-yellow px-5 text-sm font-black text-ulv-blue">Iniciar sesión</Link>
            </Card>
          )}
        </DashboardAccordionSection> : null}

        <DashboardAccordionSection id="services" title="Servicios destacados" eyebrow="Biblioteca" openSection={openSection} onToggle={handleToggleSection}>
          {latestServices.length === 0 ? (
            <Card><p className="text-sm font-semibold text-slate-600">No hay servicios disponibles por el momento.</p></Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              {latestServices.map((service) => (
                <Card key={service.id} className="h-full">
                  <span className="inline-flex rounded-full bg-ulv-yellow px-3 py-1 text-xs font-black text-ulv-blue">{libraryServiceCategoryLabels[service.category]}</span>
                  <h3 className="mt-3 text-lg font-black text-ulv-blue">{service.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{truncateText(service.summary ?? service.description)}</p>
                  <p className="mt-3 text-xs font-bold text-slate-500">{formatServiceLibraryName(service)}</p>
                </Card>
              ))}
            </div>
          )}
          <Link href="/servicios" className="mt-4 inline-flex min-h-11 items-center justify-center rounded-2xl bg-ulv-yellow px-5 text-sm font-black text-ulv-blue">Ver todos los servicios</Link>
        </DashboardAccordionSection>

        <DashboardAccordionSection id="help" title="Preguntas frecuentes" eyebrow="Ayuda rápida" openSection={openSection} onToggle={handleToggleSection}>
          {latestHelpArticles.length === 0 ? (
            <Card><p className="text-sm font-semibold text-slate-600">No hay artículos de ayuda disponibles por el momento.</p></Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              {latestHelpArticles.map((article) => (
                <Link key={article.id} href={`/ayuda/${article.slug}`}>
                  <Card className="h-full transition hover:-translate-y-0.5 hover:shadow-md">
                    <span className="inline-flex rounded-full bg-ulv-yellow px-3 py-1 text-xs font-black text-ulv-blue">{helpCategoryLabels[article.category]}</span>
                    <h3 className="mt-3 text-lg font-black text-ulv-blue">{article.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{truncateText(article.question ?? article.answer)}</p>
                    <p className="mt-3 text-xs font-bold text-slate-500">{formatHelpLibraryName(article)}</p>
                  </Card>
                </Link>
              ))}
            </div>
          )}
          <Link href="/ayuda" className="mt-4 inline-flex min-h-11 items-center justify-center rounded-2xl bg-ulv-yellow px-5 text-sm font-black text-ulv-blue">Ver centro de ayuda</Link>
        </DashboardAccordionSection>
      </div>
    </PageContainer>
  );
}
