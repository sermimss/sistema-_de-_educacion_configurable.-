import type { Metadata } from "next";
import "./globals.css";
import { obtenerInstitucion } from "@/lib/institucion";

export async function generateMetadata(): Promise<Metadata> {
  const institucion = await obtenerInstitucion().catch(() => null);
  return {
    title: institucion?.nombre
      ? `${institucion.nombre} · Sistema escolar`
      : "Sistema de gestion escolar",
    description: "Sistema de gestion escolar y financiera configurable",
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const institucion = await obtenerInstitucion().catch(() => null);
  const colorPrimario = institucion?.colorPrimario ?? "#1d4ed8";

  return (
    <html lang={institucion?.idioma ?? "es-MX"}>
      <body style={{ ["--marca-base" as string]: colorPrimario }}>{children}</body>
    </html>
  );
}
