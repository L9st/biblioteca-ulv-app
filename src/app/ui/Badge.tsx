import type { ReactNode } from "react";

type BadgeTone = "blue" | "yellow" | "green" | "red" | "slate";

type BadgeProps = {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
};

const toneClasses: Record<BadgeTone, string> = {
  blue: "bg-ulv-blue/10 text-ulv-blue",
  yellow: "bg-ulv-yellow/25 text-ulv-blue",
  green: "bg-green-50 text-green-700",
  red: "bg-red-50 text-red-700",
  slate: "bg-slate-100 text-slate-700",
};

export function Badge({ children, tone = "slate", className = "" }: BadgeProps) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${toneClasses[tone]} ${className}`}>{children}</span>;
}

export function getStatusBadgeTone(status: string): BadgeTone {
  if (["approved", "sent", "resolved", "active", "completed"].includes(status)) return "green";
  if (["rejected", "failed", "blocked"].includes(status)) return "red";
  if (["pending", "queued", "open"].includes(status)) return "yellow";
  if (["in_progress", "corrected"].includes(status)) return "blue";
  return "slate";
}
