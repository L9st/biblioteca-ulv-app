import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  href?: string;
  variant?: "primary" | "secondary";
};

const variants = {
  primary: "bg-ulv-yellow text-ulv-blue hover:bg-[#e8b800]",
  secondary: "bg-ulv-blue text-white hover:bg-[#053757]",
};

export function Button({ children, href, variant = "primary", className = "", ...props }: ButtonProps) {
  const classes = `inline-flex min-h-12 items-center justify-center rounded-2xl px-5 py-3 text-sm font-bold shadow-sm transition focus:outline-none focus:ring-2 focus:ring-ulv-yellow focus:ring-offset-2 ${variants[variant]} ${className}`;

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
