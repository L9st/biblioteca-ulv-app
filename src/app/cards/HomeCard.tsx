import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Card } from "../ui/Card";

type HomeCardProps = {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
};

export function HomeCard({ title, description, href, icon: Icon }: HomeCardProps) {
  return (
    <Link href={href} className="group block h-full">
      <Card className="flex h-full min-h-40 flex-col justify-between transition group-hover:-translate-y-0.5 group-hover:border-ulv-yellow group-hover:shadow-md">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-ulv-blue">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
          </div>
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-ulv-yellow text-ulv-blue">
            <Icon className="h-6 w-6" aria-hidden="true" />
          </span>
        </div>
        <span className="mt-5 text-sm font-bold text-ulv-blue">Abrir servicio</span>
      </Card>
    </Link>
  );
}
