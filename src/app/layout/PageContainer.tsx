import type { ReactNode } from "react";

type PageContainerProps = {
  children: ReactNode;
  className?: string;
};

export function PageContainer({ children, className = "" }: PageContainerProps) {
  return <main className={`mx-auto w-full max-w-5xl flex-1 px-4 pb-28 pt-6 md:pb-10 ${className}`}>{children}</main>;
}
