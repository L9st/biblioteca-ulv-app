"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Activity, BarChart3, Bell, BookOpen, CalendarCheck, CheckSquare, ChevronDown, CircleHelp, Clock3, ExternalLink, FileClock, Headphones, LogIn, Mail, MapPinned, Megaphone, QrCode, ShieldCheck, UserRound, Users, Wrench } from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  getCurrentDashboardUser,
  getNextReservation,
  getUnreadNotificationsCount,
  getMyCatalogSummary,
  type DashboardCatalogSummary,
  type DashboardReservation,
  type DashboardUser,
} from "@/services/dashboard.service";
import { getMyAttendanceSummary, type AttendanceSummary } from "@/services/attendance.service";
import { Card } from "@/app/ui/Card";
import { PageContainer } from "@/app/layout/PageContainer";
import { InstallAppButton } from "@/components/pwa/InstallAppButton";
import { getLatestLibraryServices, libraryServiceCategoryLabels, type PublicLibraryService } from "@/services/library-services.service";
import { getLatestHelpArticles, helpCategoryLabels, type PublicHelpArticle } from "@/services/help.service";

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

type DashboardSectionId = "services" | "help";
type DashboardRole = "visitor" | "student" | "librarian" | "admin" | "superadmin";

const emptyAttendanceSummary: AttendanceSummary = {
  todayMinutes: 0,
  weekMinutes: 0,
  monthMinutes: 0,
};

const emptyCatalogSummary: DashboardCatalogSummary = { savedItems: 0, recentSearches: [] };

function getDashboardRole(hasSession: boolean, role: DashboardUser["role"] | null | undefined): DashboardRole {
  if (!hasSession) return "visitor";
  if (role === "librarian" || role === "admin" || role === "superadmin") return role;
  return "student";
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
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

function ActionSection({ title, eyebrow, cards }: { title: string; eyebrow: string; cards: QuickCard[] }) {
  if (cards.length === 0) return null;

  return (
    <section className="mt-7 rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-ulv-blue">{eyebrow}</p>
        <h2 className="mt-1 text-2xl font-black text-slate-950">{title}</h2>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => <QuickAccessCard key={card.title} card={card} />)}
      </div>
    </section>
  );
}

export function HomeDashboard() {
  const [isLoading, setIsLoading] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [user, setUser] = useState<DashboardUser | null>(null);
  const [attendanceSummary, setAttendanceSummary] = useState<AttendanceSummary>(emptyAttendanceSummary);
  const [unreadCount, setUnreadCount] = useState(0);
  const [nextReservation, setNextReservation] = useState<DashboardReservation | null>(null);
  const [catalogSummary, setCatalogSummary] = useState<DashboardCatalogSummary>(emptyCatalogSummary);
  const [latestServices, setLatestServices] = useState<PublicLibraryService[]>([]);
  const [latestHelpArticles, setLatestHelpArticles] = useState<PublicHelpArticle[]>([]);
  const [openSection, setOpenSection] = useState<DashboardSectionId | null>("services");
  const [error, setError] = useState<string | null>(null);
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
        setCatalogSummary(emptyCatalogSummary);
        setError(latestServicesResult.error ?? latestHelpResult.error);
        setIsLoading(false);
        return;
      }

      const [userResult, attendanceSummaryResult, notificationResult, reservationResult, catalogSummaryResult] = await Promise.all([
        getCurrentDashboardUser(),
        getMyAttendanceSummary(),
        getUnreadNotificationsCount(),
        getNextReservation(),
        getMyCatalogSummary(),
      ]);

      setUser(userResult.data);
      setAttendanceSummary(attendanceSummaryResult);
      setUnreadCount(notificationResult.data);
      setNextReservation(reservationResult.data);
      setCatalogSummary(catalogSummaryResult.data);
      setError(userResult.error ?? notificationResult.error ?? reservationResult.error ?? catalogSummaryResult.error ?? latestServicesResult.error ?? latestHelpResult.error);
      setIsLoading(false);
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

  const role = getDashboardRole(hasSession, user?.role);
  const catalogCard: QuickCard = { title: "Catálogo Koha", description: "Busca libros, autores, temas o ISBN en el catálogo bibliográfico.", href: "/catalogo", buttonLabel: "Buscar en catálogo", icon: BookOpen, badge: kohaOpacUrl ? undefined : "Configurar OPAC" };
  const visitorCards: QuickCard[] = [
    catalogCard,
    { title: "Espacios disponibles", description: "Conoce salas, cubículos y áreas de biblioteca.", href: "/espacios", buttonLabel: "Ver espacios", icon: MapPinned },
    { title: "Servicios de biblioteca", description: "Consulta préstamos, orientación y apoyos disponibles.", href: "/servicios", buttonLabel: "Ver servicios", icon: Wrench },
    { title: "Ayuda", description: "Preguntas frecuentes y guías rápidas para usuarios.", href: "/ayuda", buttonLabel: "Ver ayuda", icon: CircleHelp },
    { title: "Iniciar sesión", description: "Accede a reservas, recursos guardados y notificaciones.", href: "/login", buttonLabel: "Iniciar sesión", icon: LogIn },
  ];
  const studentPrimaryCards: QuickCard[] = [
    catalogCard,
    { title: "Reservar espacio", description: "Solicita salas o espacios disponibles en biblioteca.", href: "/reservas-espacios", buttonLabel: "Reservar", icon: CalendarCheck },
    { title: "Mis reservas", description: "Consulta tus próximas solicitudes de espacio.", href: "/reservas-espacios", buttonLabel: "Ver reservas", icon: CalendarCheck },
    { title: "Mis recursos", description: "Consulta favoritos, recursos guardados e historial.", href: "/mis-recursos", buttonLabel: "Ver recursos", icon: BookOpen, badge: catalogSummary.savedItems > 0 ? `${catalogSummary.savedItems} guardados` : undefined },
    { title: "Notificaciones", description: "Revisa avisos y actividad de tu cuenta.", href: "/notificaciones", buttonLabel: "Ver notificaciones", icon: Bell, badge: unreadCount > 0 ? `${unreadCount} no leídas` : undefined },
    { title: "Soporte", description: "Reporta problemas o solicita ayuda con la app.", href: "/soporte", buttonLabel: "Solicitar ayuda", icon: Headphones },
  ];
  const studentMoreCards: QuickCard[] = [
    { title: "Ayuda", description: "Guías rápidas y preguntas frecuentes.", href: "/ayuda", buttonLabel: "Ver ayuda", icon: CircleHelp },
    { title: "Servicios", description: "Préstamos, orientación y recursos.", href: "/servicios", buttonLabel: "Ver servicios", icon: Wrench },
    { title: "Mi cuenta", description: "Perfil, reservas y preferencias.", href: "/mi-cuenta", buttonLabel: "Ver cuenta", icon: UserRound },
    { title: "Mis horas", description: "Entradas, salidas y horas acumuladas.", href: "/horas", buttonLabel: "Ver horas", icon: Clock3 },
  ];
  const librarianPrimaryCards: QuickCard[] = [
    { title: "Panel administrativo", description: "Accede a la operación bibliotecaria diaria.", href: "/admin", buttonLabel: "Abrir panel", icon: ShieldCheck },
    { title: "Reservas pendientes", description: "Revisa y gestiona solicitudes de espacios.", href: "/admin/reservas", buttonLabel: "Ver reservas", icon: CalendarCheck },
    { title: "Asistencia", description: "Consulta entradas, salidas y usuarios activos.", href: "/admin/asistencia", buttonLabel: "Ver asistencia", icon: Clock3 },
    { title: "Generar QR", description: "Crea códigos QR para entrada y salida.", href: "/admin/qr", buttonLabel: "Abrir QR", icon: QrCode },
    { title: "Soporte", description: "Atiende solicitudes e incidencias de usuarios.", href: "/admin/soporte", buttonLabel: "Gestionar soporte", icon: Headphones },
    { title: "Avisos", description: "Publica comunicados y horarios relevantes.", href: "/admin/avisos", buttonLabel: "Gestionar avisos", icon: Megaphone },
  ];
  const librarianMoreCards: QuickCard[] = [
    { title: "Reportes", description: "Consulta reportes operativos de biblioteca.", href: "/admin/reportes", buttonLabel: "Ver reportes", icon: BarChart3 },
    catalogCard,
    { title: "Mi cuenta", description: "Acceso rápido a tu perfil y notificaciones.", href: "/mi-cuenta", buttonLabel: "Ver cuenta", icon: UserRound },
    { title: "Notificaciones", description: "Actividad administrativa y personal.", href: "/notificaciones", buttonLabel: "Ver notificaciones", icon: Bell, badge: unreadCount > 0 ? `${unreadCount} no leídas` : undefined },
  ];
  const adminPrimaryCards: QuickCard[] = [
    { title: "Panel administrativo", description: "Gestiona los módulos principales del sistema.", href: "/admin", buttonLabel: "Abrir panel", icon: ShieldCheck },
    { title: "Diagnóstico del sistema", description: "Revisa variables, conexión y estado técnico.", href: "/admin/diagnostico", buttonLabel: "Ver diagnóstico", icon: Activity },
    { title: "Estado de producción", description: "Checklist visual para validar la app.", href: "/admin/estado-produccion", buttonLabel: "Ver checklist", icon: CheckSquare },
    { title: "Usuarios", description: "Gestiona roles, estados y accesos.", href: "/admin/usuarios", buttonLabel: "Administrar usuarios", icon: Users },
    { title: "Reservas", description: "Revisa y administra reservas de espacios.", href: "/admin/reservas", buttonLabel: "Administrar reservas", icon: CalendarCheck },
    { title: "Reportes", description: "Consulta estadísticas y reportes administrativos.", href: "/admin/reportes", buttonLabel: "Ver reportes", icon: BarChart3 },
  ];
  const adminMoreCards: QuickCard[] = [
    { title: "Estadísticas del catálogo", description: "Consulta términos más buscados y actividad diaria.", href: "/admin/catalogo-estadisticas", buttonLabel: "Ver estadísticas", icon: BookOpen },
    { title: "Correos", description: "Revisa cola, enviados y fallidos del sistema.", href: "/admin/correos", buttonLabel: "Ver correos", icon: Mail },
    { title: "Auditoría", description: "Consulta acciones administrativas registradas.", href: "/admin/auditoria", buttonLabel: "Ver auditoría", icon: FileClock },
    catalogCard,
  ];
  const primaryCards = role === "visitor" ? visitorCards : role === "student" ? studentPrimaryCards : role === "librarian" ? librarianPrimaryCards : adminPrimaryCards;
  const moreCards = role === "student" ? studentMoreCards : role === "librarian" ? librarianMoreCards : role === "admin" || role === "superadmin" ? adminMoreCards : [];

  function handleToggleSection(sectionId: DashboardSectionId) {
    setOpenSection((currentSection) => (currentSection === sectionId ? null : sectionId));
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
          {role === "visitor" ? "Consulta el catálogo, espacios, servicios y ayuda de biblioteca." : role === "student" ? "Busca recursos, reserva espacios y consulta tu actividad de biblioteca." : role === "librarian" ? "Gestiona la operación diaria de biblioteca desde un inicio organizado." : "Administra el sistema, revisa diagnósticos y controla la operación principal."}
        </p>
      </section>

      <div className="mt-6">
        <InstallAppButton />
      </div>

      <ActionSection title={role === "visitor" ? "Acciones públicas" : role === "student" ? "Acciones principales" : role === "librarian" ? "Operación diaria" : "Gestión del sistema"} eyebrow={role === "visitor" ? "Inicio" : role === "student" ? "Estudiante" : role === "librarian" ? "Biblioteca" : "Administración"} cards={primaryCards} />

      {role === "student" ? (
        <section className="mt-7 rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-ulv-blue">Resumen personal</p>
              <h2 className="mt-1 text-2xl font-black text-slate-950">Tu biblioteca</h2>
            </div>
            <Link href="/catalogo" className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-ulv-yellow px-5 text-sm font-black text-ulv-blue">Buscar en catálogo</Link>
          </div>

          <Card className="mt-5 bg-ulv-bg p-4">
            <p className="text-sm font-bold text-ulv-blue">¿Qué libro, autor o tema buscas?</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">Abre el buscador del catálogo Koha, guarda búsquedas y consulta tus recursos favoritos.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Link href="/catalogo" className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-ulv-yellow px-4 text-sm font-black text-ulv-blue">Buscar en Koha</Link>
              <Link href="/mis-recursos" className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-ulv-blue px-4 text-sm font-black text-white">Mis recursos</Link>
            </div>
          </Card>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Card className="p-4"><p className="text-xs font-bold text-slate-500">Próxima reserva</p><p className="mt-2 text-sm font-black text-ulv-blue">{nextReservation ? formatDateTime(nextReservation.start_at) : "Sin reservas próximas"}</p></Card>
            <Card className="p-4"><p className="text-xs font-bold text-slate-500">Notificaciones</p><p className="mt-1 text-2xl font-black text-ulv-blue">{unreadCount}</p></Card>
            <Card className="p-4"><p className="text-xs font-bold text-slate-500">Recursos guardados</p><p className="mt-1 text-2xl font-black text-ulv-blue">{catalogSummary.savedItems}</p></Card>
            <Card className="p-4"><p className="text-xs font-bold text-slate-500">Horas este mes</p><p className="mt-1 text-2xl font-black text-ulv-blue">{formatMinutes(attendanceSummary.monthMinutes)}</p></Card>
          </div>

          <Card className="mt-4 p-4">
            <h3 className="text-lg font-black text-ulv-blue">Últimas búsquedas</h3>
            {catalogSummary.recentSearches.length === 0 ? <p className="mt-2 text-sm text-slate-600">Aún no tienes búsquedas recientes.</p> : <div className="mt-3 flex flex-wrap gap-2">{catalogSummary.recentSearches.map((item) => <span key={item.id} className="rounded-full bg-ulv-yellow px-3 py-1 text-xs font-black text-ulv-blue">{item.query}</span>)}</div>}
            <Link href="/soporte" className="mt-4 inline-flex min-h-11 items-center justify-center rounded-2xl border border-ulv-blue px-4 text-sm font-black text-ulv-blue">Solicitar soporte</Link>
          </Card>
        </section>
      ) : null}

      {role === "librarian" || role === "admin" || role === "superadmin" ? (
        <section className="mt-7 rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-ulv-blue">Cuenta</p>
              <h2 className="mt-1 text-2xl font-black text-slate-950">Accesos personales</h2>
            </div>
            <div className="grid gap-3 sm:flex">
              <Link href="/mi-cuenta" className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-ulv-blue px-4 text-sm font-black text-white">Mi cuenta</Link>
              <Link href="/notificaciones" className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-ulv-blue px-4 text-sm font-black text-ulv-blue">Notificaciones</Link>
            </div>
          </div>
        </section>
      ) : null}

      <ActionSection title="Más opciones" eyebrow="Secundario" cards={moreCards} />

      <div className="mt-7 space-y-4">

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
