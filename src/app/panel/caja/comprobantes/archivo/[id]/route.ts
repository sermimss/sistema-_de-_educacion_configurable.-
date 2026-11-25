import { sesionActual } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/// El archivo del comprobante: lo ven la administracion, caja y el alumno que
/// lo subio. Solo PDF o imagen (validados al subir), mostrados en el navegador.
export async function GET(_peticion: Request, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await sesionActual();
  if (!sesion) return new Response("Inicia sesion", { status: 401 });
  const comprobante = await db.comprobantePago.findUnique({
    where: { id: Number((await params).id) || 0 },
    select: { archivoDatos: true, archivoMime: true, archivoNombre: true, archivoTamano: true, alumno: { select: { usuarioId: true } } },
  });
  if (!comprobante) return new Response("No existe", { status: 404 });
  const permitido = sesion.rol === "ADMIN" || sesion.rol === "CAJERO" || (sesion.rol === "ALUMNO" && comprobante.alumno.usuarioId === sesion.usuarioId);
  if (!permitido) return new Response("No existe", { status: 404 });
  const ascii = comprobante.archivoNombre.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "");
  return new Response(new Uint8Array(comprobante.archivoDatos), {
    headers: {
      "Content-Type": comprobante.archivoMime,
      "Content-Length": String(comprobante.archivoTamano),
      "Content-Disposition": `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(comprobante.archivoNombre)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
