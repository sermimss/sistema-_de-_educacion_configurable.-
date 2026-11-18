"use server";

import { requerirRol } from "@/lib/auth";
import { db } from "@/lib/db";
import { registrarBitacora } from "@/lib/bitacora";
import { contrasenaTemporal, restablecerCuenta } from "@/lib/recuperacion";

export type EstadoAcceso = { error?: string; temporal?: string; usuario?: string; descartada?: boolean };

/// Le da a quien lo pidio una contrasena temporal. Se muestra una sola vez,
/// para que la administracion se la entregue en persona o por telefono.
export async function accionAsignarTemporal(_p: EstadoAcceso, formData: FormData): Promise<EstadoAcceso> {
  const sesion = await requerirRol("ADMIN");
  const id = Number(formData.get("solicitudId"));
  const solicitud = await db.solicitudAcceso.findUnique({ where: { id: id || 0 }, include: { usuario: true } });
  if (!solicitud || solicitud.estado !== "PENDIENTE") return { error: "Esa solicitud ya fue atendida." };

  const temporal = contrasenaTemporal();
  await db.$transaction(async (tx) => {
    await restablecerCuenta(tx, solicitud.usuarioId, temporal, { temporal: true });
    await tx.solicitudAcceso.update({
      where: { id: solicitud.id },
      data: { estado: "ATENDIDA", atendidaEn: new Date(), atendidaPorId: sesion.usuarioId },
    });
  });
  await registrarBitacora({
    usuarioId: sesion.usuarioId,
    accion: "ACTUALIZAR",
    entidad: "Usuario",
    entidadId: solicitud.usuarioId,
    descripcion: `Contrasena temporal asignada a ${solicitud.usuario.usuario} por solicitud de acceso`,
  });
  // Sin revalidar la pantalla a proposito: la solicitud dejaria de estar
  // pendiente, su renglon desapareceria y con el la contrasena temporal, que
  // solo se muestra esta vez. La bandeja se actualiza al volver a entrar.
  return { temporal, usuario: solicitud.usuario.usuario };
}

export async function accionDescartarSolicitud(_p: EstadoAcceso, formData: FormData): Promise<EstadoAcceso> {
  const sesion = await requerirRol("ADMIN");
  const id = Number(formData.get("solicitudId"));
  const { count } = await db.solicitudAcceso.updateMany({
    where: { id: id || 0, estado: "PENDIENTE" },
    data: { estado: "DESCARTADA", atendidaEn: new Date(), atendidaPorId: sesion.usuarioId },
  });
  if (count === 0) return { error: "Esa solicitud ya fue atendida." };
  return { descartada: true };
}
