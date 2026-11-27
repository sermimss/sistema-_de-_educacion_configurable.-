import { sesionActual } from "@/lib/auth";
import { db } from "@/lib/db";
import { claseAccesible } from "@/lib/docencia";
import { alumnoDeSesion } from "@/lib/alumnoSesion";
import { alumnoCursa } from "@/lib/tareas";
import { respuestaArchivo } from "@/lib/servirArchivo";

export const dynamic = "force-dynamic";

/// Material de apoyo de una tarea: lo ven el docente de la clase y los
/// alumnos que la cursan.
export async function GET(_peticion: Request, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await sesionActual();
  if (!sesion) return new Response("Inicia sesion", { status: 401 });
  const usuario = await db.usuario.findUnique({ where: { id: sesion.usuarioId }, select: { debeCambiarPassword: true } });
  if (usuario?.debeCambiarPassword) return new Response("Cambia tu contrasena primero", { status: 403 });

  const archivo = await db.archivoTarea.findUnique({ where: { id: Number((await params).id) || 0 }, include: { tarea: { select: { claseId: true } } } });
  if (!archivo) return new Response("No existe", { status: 404 });
  let permitido = false;
  if (sesion.rol === "ALUMNO") {
    const alumno = await alumnoDeSesion(sesion.usuarioId);
    permitido = Boolean(alumno) && (await alumnoCursa(alumno!.id, archivo.tarea.claseId));
  } else if (sesion.rol === "DOCENTE") {
    permitido = await claseAccesible(sesion, archivo.tarea.claseId);
  }
  if (!permitido) return new Response("No existe", { status: 404 });
  return respuestaArchivo(archivo);
}
