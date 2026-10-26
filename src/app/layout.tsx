import type { Metadata } from "next";
import "./globals.css";
import { obtenerInstitucion } from "@/lib/institucion";
import { urlLogo, variablesDeMarca } from "@/lib/marca";

export async function generateMetadata(): Promise<Metadata> {
  const institucion = await obtenerInstitucion().catch(() => null);
  const logo = await urlLogo(institucion).catch(() => null);
  return {
    title: institucion?.nombre
      ? `${institucion.nombre} · Sistema escolar`
      : "Sistema de gestion escolar",
    description: "Sistema de gestion escolar y financiera configurable",
    // El logo del colegio tambien es el icono de la pestana del navegador.
    ...(logo ? { icons: { icon: logo } } : {}),
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const institucion = await obtenerInstitucion().catch(() => null);

  return (
    <html lang={institucion?.idioma ?? "es-MX"}>
      <body style={variablesDeMarca(institucion)}>{children}</body>
    </html>
  );
}
