"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BarChart3, Bell, Building2, CalendarCheck, CircleHelp, ClipboardList, Megaphone, QrCode, ShieldAlert, Users, Wrench } from "lucide-react";
import { getCurrentAppUser, type AdminAppUser, type AppUserRole } from "@/services/admin-users.service";
import { Card } from "@/app/ui/Card";

type AdminCard = {
  title: string;
  description: string;
  href: string;
  buttonLabel: string;
  status: "Disponible" | "En construcción";
  icon: typeof QrCode;
};

const adminCards: AdminCard[] = [
  {
    title: "QR de asistencia",
    description: "Genera códigos QR dinámicos para registrar entrada y salida de usuarios.",
    href: "/admin/qr",
    buttonLabel: "Abrir QR",
    status: "Disponible",
    icon: QrCode,
  },
  {
    title: "Control de asistencia",
    description: "Consulta entradas, salidas, usuarios activos y horas registradas.",
    href: "/admin/asistencia",
    buttonLabel: "Ver asistencia",
    status: "Disponible",
    icon: ClipboardList,
  },
  {
    title: "Usuarios",
    description: "Gestiona usuarios, roles y estados de acceso a la app.",
    href: "/admin/usuarios",
    buttonLabel: "Administrar usuarios",
    status: "Disponible",
    icon: Users,
  },
  {
    title: "Espacios de biblioteca",
    description: "Administra salas, áreas, cubículos y espacios disponibles.",
    href: "/admin/espacios",
    buttonLabel: "Administrar espacios",
    status: "En construcción",
    icon: Building2,
  },
  {
    title: "Reservas de espacios",
    description: "Revisa, aprueba o rechaza solicitudes de reserva de espacios.",
    href: "/admin/reservas",
    buttonLabel: "Administrar reservas",
    status: "Disponible",
    icon: CalendarCheck,
  },
  {
    title: "Avisos y comunicados",
    description: "Publica horarios, cierres, eventos y comunicados para los usuarios.",
    href: "/admin/avisos",
    buttonLabel: "Administrar avisos",
    status: "Disponible",
    icon: Megaphone,
  },
  {
    title: "Servicios de biblioteca",
    description: "Administra servicios como préstamos, orientación, capacitación y apoyo al usuario.",
    href: "/admin/servicios",
    buttonLabel: "Administrar servicios",
    status: "Disponible",
    icon: Wrench,
  },
  {
    title: "Ayuda y preguntas frecuentes",
    description: "Administra guías rápidas, preguntas frecuentes e instrucciones de uso.",
    href: "/admin/ayuda",
    buttonLabel: "Administrar ayuda",
    status: "Disponible",
    icon: CircleHelp,
  },
  {
    title: "Notificaciones",
    description: "Consulta avisos sobre tus reservas y actividad en la biblioteca.",
    href: "/notificaciones",
    buttonLabel: "Ver notificaciones",
    status: "Disponible",
    icon: Bell,
  },
  {
    title: "Reportes",
    description: "Consulta estadísticas, asistencia por periodo y reportes administrativos.",
    href: "/admin/reportes",
    buttonLabel: "Ver reportes",
    status: "En construcción",
    icon: BarChart3,
  },
];

function canAccessAdmin(role: AppUserRole) {
  return role === "librarian" || role === "admin" || role === "superadmin";
}

export function AdminDashboardPanel() {
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<AdminAppUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(async () => {
      const result = await getCurrentAppUser();
      setCurrentUser(result.data);
      setError(result.error);
      setIsLoading(false);
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

  if (isLoading) {
    return (
      <Card>
        <p className="text-sm font-semibold text-slate-600">Cargando panel administrativo...</p>
      </Card>
    );
  }

  if (!currentUser) {
    return (
      <Card className="text-center">
        <ShieldAlert className="mx-auto h-10 w-10 text-ulv-blue" aria-hidden="true" />
        <h2 className="mt-3 text-xl font-black text-ulv-blue">Debes iniciar sesión para acceder al panel administrativo.</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">Inicia sesión con una cuenta autorizada para continuar.</p>
        {error ? <p className="mt-3 text-sm font-bold text-red-700">{error}</p> : null}
        <Link
          href="/login?redirect=/admin"
          className="mt-5 inline-flex min-h-12 items-center justify-center rounded-2xl bg-ulv-yellow px-5 py-3 text-sm font-bold text-ulv-blue shadow-sm transition hover:bg-[#e8b800]"
        >
          Iniciar sesión
        </Link>
      </Card>
    );
  }

  if (!canAccessAdmin(currentUser.role)) {
    return (
      <Card className="text-center">
        <ShieldAlert className="mx-auto h-10 w-10 text-red-700" aria-hidden="true" />
        <h2 className="mt-3 text-xl font-black text-red-700">No tienes permisos para acceder a esta sección.</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">Esta sección está reservada para personal autorizado de biblioteca.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-ulv-blue bg-ulv-blue p-5 text-white shadow-sm">
        <p className="text-sm font-bold text-ulv-yellow">Sesión iniciada como:</p>
        <h2 className="mt-2 text-2xl font-black">{currentUser.name || currentUser.email}</h2>
        <p className="mt-1 text-sm text-white/85">{currentUser.email}</p>
        <p className="mt-3 inline-flex rounded-full bg-ulv-yellow px-3 py-1 text-xs font-black text-ulv-blue">
          Rol: {currentUser.role}
        </p>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {adminCards.map((card) => {
          const Icon = card.icon;

          return (
            <Card key={card.href} className="transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex items-start justify-between gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-ulv-yellow text-ulv-blue">
                  <Icon className="h-6 w-6" aria-hidden="true" />
                </span>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-black ${
                    card.status === "Disponible" ? "bg-green-50 text-green-800" : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {card.status}
                </span>
              </div>

              <h3 className="mt-4 text-xl font-black text-ulv-blue">{card.title}</h3>
              <p className="mt-2 min-h-12 text-sm leading-6 text-slate-600">{card.description}</p>

              <Link
                href={card.href}
                className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-ulv-yellow px-5 py-3 text-sm font-bold text-ulv-blue shadow-sm transition hover:bg-[#e8b800]"
              >
                {card.buttonLabel}
              </Link>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
