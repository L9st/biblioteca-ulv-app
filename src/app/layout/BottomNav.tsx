"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Clock3, Home, MapPinned, Phone, Users } from "lucide-react";

const navItems = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/catalogo", label: "Catálogo", icon: BookOpen },
  { href: "/horas", label: "Horas", icon: Clock3 },
  { href: "/espacios", label: "Espacios", icon: MapPinned },
  { href: "/servicios", label: "Servicios", icon: Users },
  { href: "/contacto", label: "Contacto", icon: Phone },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur md:hidden">
      <div className="mx-auto grid max-w-md grid-cols-6 px-1 pb-[max(env(safe-area-inset-bottom),0.25rem)] pt-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[0.68rem] font-semibold transition ${
                isActive ? "bg-ulv-yellow text-ulv-blue" : "text-slate-500 hover:bg-slate-100 hover:text-ulv-blue"
              }`}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
