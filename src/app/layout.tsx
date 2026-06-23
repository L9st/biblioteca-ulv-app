import type { Metadata, Viewport } from "next";
import { AppNavigation } from "@/components/layout/AppNavigation";
import { NotificationToastHost } from "@/components/notifications/NotificationToastHost";
import { OfflineStatusBanner } from "@/components/pwa/OfflineStatusBanner";
import { RegisterServiceWorker } from "@/components/pwa/RegisterServiceWorker";
import "./globals.css";

export const metadata: Metadata = {
  title: "Biblioteca ULV App",
  description: "Aplicación de servicios, asistencia, reservas y espacios de la Biblioteca ULV.",
  applicationName: "Biblioteca ULV App",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Biblioteca ULV",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#06426a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className="h-full antialiased"
    >
      <body className="flex min-h-full flex-col bg-ulv-bg text-slate-950">
        <AppNavigation />
        <NotificationToastHost />
        <OfflineStatusBanner />
        <RegisterServiceWorker />
        {children}
      </body>
    </html>
  );
}
