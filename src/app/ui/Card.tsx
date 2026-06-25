import type { ReactNode } from "react";

type CardProps = {
  children: ReactNode;
  className?: string;
};

export function Card({ children, className = "" }: CardProps) {
  return <section className={`rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-6 ${className}`}>{children}</section>;
}
