import { sesionActual } from "@/lib/auth";
import { db } from "@/lib/db";
import { alumnoDeSesion } from "@/lib/alumnoSesion";
import { alumnoVeAviso } from "@/lib/avisos";
import { configBool } from "@/lib/configuracion";
import { respuestaArchivo } from "@/lib/servirArchivo";

export const dynamic = "force-dynamic";

/// Archivo adjunto a un aviso: lo ve la administracion, quien lo publico y los
/// alumnos a quienes va dirigido el aviso mientras siga publicado.
export async function GET(_peticion: Request, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await sesionActual();
  if (!sesion) return new Response("Inicia sesion", { status: 401 });
  const usuario = await db.usuario.findUnique({ where: { id: sesion.usuarioId }, select: { debeCambiarPassword: true } });
  if (usuario?.debeCambiarPassword) return new Response("Cambia tu contrasena primero", { status: 403 });

  const archivo = await db.archivoAviso.findUnique({ where: { id: Number((await params).id) || 0 }, include: { aviso: true } });
  if (!archivo) return new Response("No existe", { status: 404 });
  let permitido = false;
  if (sesion.rol === "ADMIN") permitido = true;
  else if (sesion.rol === "DOCENTE") permitido = archivo.aviso.publicadoPor === sesion.usuarioId;
  else if (sesion.rol === "ALUMNO" && (await configBool("portales.alumno_ve_avisos", true))) {
    const alumno = await alumnoDeSesion(sesion.usuarioId);
    permitido = Boolean(alumno) && (await alumnoVeAviso(alumno!.id, archivo.avisoId));
  }
  if (!permitido) return new Response("No existe", { status: 404 });
  return respuestaArchivo(archivo);
}
