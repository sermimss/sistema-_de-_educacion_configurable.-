import { sesionActual } from "@/lib/auth";
import { db } from "@/lib/db";
import { claseAccesible } from "@/lib/docencia";

export const dynamic = "force-dynamic";

/// Descarga un archivo entregado: lo ve el alumno que lo subio y el docente
/// de la clase. Siempre como descarga, nunca se abre dentro de la pagina.
export async function GET(_peticion: Request, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await sesionActual();
  if (!sesion) return new Response("Inicia sesion", { status: 401 });
  const usuario = await db.usuario.findUnique({ where: { id: sesion.usuarioId }, select: { debeCambiarPassword: true } });
  if (usuario?.debeCambiarPassword) return new Response("Cambia tu contrasena primero", { status: 403 });

  const archivo = await db.archivoEntrega.findUnique({
    where: { id: Number((await params).id) || 0 },
    include: { entrega: { include: { tarea: true, alumno: { select: { usuarioId: true } } } } },
  });
  if (!archivo) return new Response("No existe", { status: 404 });
  const permitido =
    sesion.rol === "ALUMNO" ? archivo.entrega.alumno.usuarioId === sesion.usuarioId : await claseAccesible(sesion, archivo.entrega.tarea.claseId);
  if (!permitido) return new Response("No existe", { status: 404 });

  const ascii = archivo.nombre.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "");
  return new Response(new Uint8Array(archivo.datos), {
    headers: {
      "Content-Type": archivo.mime,
      "Content-Length": String(archivo.tamano),
      "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(archivo.nombre)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
