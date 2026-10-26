import { NextResponse } from "next/server";
import { db, hayColegio } from "@/lib/db";

export const dynamic = "force-dynamic";

/// El logo del colegio. Es publico (sale en su pantalla de acceso). La
/// direccion lleva la version del logo, asi que el navegador lo puede guardar
/// sin miedo a mostrar uno viejo.
export async function GET(peticion: Request) {
  if (!(await hayColegio())) return new NextResponse(null, { status: 404 });
  const institucion = await db.institucion.findUnique({
    where: { id: 1 },
    select: { logoArchivoId: true },
  });
  if (!institucion?.logoArchivoId) return new NextResponse(null, { status: 404 });
  const archivo = await db.archivoInstitucional.findUnique({ where: { id: institucion.logoArchivoId } });
  if (!archivo || archivo.tipo !== "LOGO") return new NextResponse(null, { status: 404 });

  const pedida = new URL(peticion.url).searchParams.get("v");
  const cache = pedida === String(archivo.id) ? "public, max-age=31536000, immutable" : "no-cache";
  return new NextResponse(Buffer.from(archivo.datos), {
    headers: {
      "Content-Type": archivo.mime,
      "Content-Length": String(archivo.tamano),
      "Cache-Control": cache,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'",
    },
  });
}
