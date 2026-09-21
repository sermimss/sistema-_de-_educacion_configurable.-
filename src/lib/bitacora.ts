import type { AccionBitacora, Prisma } from "@prisma/client";
import { db } from "./db";

type EntradaBitacora = {
  usuarioId?: number | null;
  accion: AccionBitacora;
  entidad: string;
  entidadId?: string | number | null;
  descripcion?: string;
  datosAntes?: Prisma.InputJsonValue;
  datosDespues?: Prisma.InputJsonValue;
  ip?: string;
  userAgent?: string;
};

/// La auditoria nunca debe tumbar la operacion principal: si falla, se
/// reporta en consola pero no se propaga el error.
export async function registrarBitacora(entrada: EntradaBitacora): Promise<void> {
  try {
    await db.bitacora.create({
      data: {
        usuarioId: entrada.usuarioId ?? null,
        accion: entrada.accion,
        entidad: entrada.entidad,
        entidadId: entrada.entidadId != null ? String(entrada.entidadId) : null,
        descripcion: entrada.descripcion,
        datosAntes: entrada.datosAntes,
        datosDespues: entrada.datosDespues,
        ip: entrada.ip,
        userAgent: entrada.userAgent,
      },
    });
  } catch (error) {
    console.error("[bitacora] no se pudo registrar la entrada:", error);
  }
}
