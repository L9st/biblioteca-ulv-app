import type { ReactNode } from "react";

type PageContainerProps = {
  children: ReactNode;
  className?: string;
};

export function PageContainer({ children, className = "" }: PageContainerProps) {
  return <main className={`mx-auto w-full max-w-7xl flex-1 px-4 py-6 pb-24 sm:px-6 lg:px-8 md:pb-8 ${className}`}>{children}</main>;
}
