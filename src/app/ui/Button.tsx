import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  href?: string;
  variant?: "primary" | "secondary" | "danger";
};

const variants = {
  primary: "bg-ulv-yellow text-ulv-blue hover:brightness-95",
  secondary: "border border-slate-200 bg-white text-ulv-blue hover:bg-slate-50",
  danger: "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100",
};

export function Button({ children, href, variant = "primary", className = "", ...props }: ButtonProps) {
  const classes = `inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition focus:outline-none focus:ring-2 focus:ring-ulv-blue/20 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]} ${className}`;

  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button className={classes} {...props}>
      {children}
    </button>
  );
}
