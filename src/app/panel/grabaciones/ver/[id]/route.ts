import { sesionActual } from "@/lib/auth";
import { db } from "@/lib/db";
import { claseAccesible } from "@/lib/docencia";
import { obtenerInstitucion } from "@/lib/institucion";
import { grabacionVigente, hoyEnZona } from "@/lib/grabaciones";

export const dynamic = "force-dynamic";

// Ruta relativa: el navegador la resuelve contra la direccion que esta usando.
const ir = (destino: string) => new Response(null, { status: 302, headers: { Location: destino, "Cache-Control": "no-store" } });

/// Abre una grabacion. El alumno solo entra si cursa la clase y la grabacion
/// sigue vigente; cada apertura queda registrada. El docente de la clase y la
/// administracion entran siempre, tambien a las vencidas.
export async function GET(_peticion: Request, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await sesionActual();
  if (!sesion) return ir("/acceso");
  const usuario = await db.usuario.findUnique({ where: { id: sesion.usuarioId }, select: { debeCambiarPassword: true } });
  if (usuario?.debeCambiarPassword) return ir("/panel/cambiar-password");

  const grabacion = await db.grabacion.findUnique({ where: { id: Number((await params).id) || 0 } });
  if (!grabacion) return ir("/panel/grabaciones?aviso=no-existe");

  if (sesion.rol === "ALUMNO") {
    const alumno = await db.alumno.findUnique({ where: { usuarioId: sesion.usuarioId }, select: { id: true } });
    const cursa = alumno
      ? await db.alumnoClase.findFirst({
          where: { alumnoId: alumno.id, claseId: grabacion.claseId, estado: { not: "BAJA" } },
          select: { id: true },
        })
      : null;
    if (!alumno || !cursa) return ir("/panel/grabaciones?aviso=no-existe");
    const institucion = await obtenerInstitucion();
    if (!grabacionVigente(grabacion.disponibleHasta, hoyEnZona(institucion?.zonaHoraria ?? "America/Mexico_City"))) {
      return ir("/panel/grabaciones?aviso=vencida");
    }
    await db.vistaGrabacion.upsert({
      where: { grabacionId_alumnoId: { grabacionId: grabacion.id, alumnoId: alumno.id } },
      create: { grabacionId: grabacion.id, alumnoId: alumno.id },
      update: { veces: { increment: 1 }, ultimaVez: new Date() },
    });
    return ir(grabacion.enlace);
  }

  if (!(await claseAccesible(sesion, grabacion.claseId))) return ir("/panel/grabaciones?aviso=no-existe");
  return ir(grabacion.enlace);
}
