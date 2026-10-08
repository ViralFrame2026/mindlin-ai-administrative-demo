import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/app-shell";
import { AppStoreProvider } from "@/lib/store";

export const metadata: Metadata = {
  title: "Mindlin AI | Automatización administrativa",
  description: "Prototipo funcional para gestión y validación inteligente de facturas.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>
        <AppStoreProvider>
          <AppShell>{children}</AppShell>
        </AppStoreProvider>
      </body>
    </html>
  );
}
