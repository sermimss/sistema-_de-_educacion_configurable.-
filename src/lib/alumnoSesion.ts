import { cache } from "react";
import { db } from "./db";
import { configBool, configJson, configNumero } from "./configuracion";

/// Alumno ligado a la sesion, memoizado por peticion.
export const alumnoDeSesion = cache(async (usuarioId: number) => {
  return db.alumno.findUnique({
    where: { usuarioId },
    include: { plan: { include: { nivel: true } }, turno: true, plantel: true },
  });
});

export type AccionBloqueable = "BOLETA" | "REINSCRIPCION" | "PORTAL" | "CONSTANCIAS";

/// Devuelve el aviso de bloqueo si la escuela activo el bloqueo por adeudo y
/// la accion consultada esta en la lista. Devuelve null si no aplica.
export async function bloqueoPorAdeudo(
  alumnoId: number,
  accion: AccionBloqueable
): Promise<string | null> {
  const activo = await configBool("finanzas.bloquear_por_adeudo", false);
  if (!activo) return null;

  const acciones = await configJson<string[]>("finanzas.acciones_bloqueadas_por_adeudo", [
    "BOLETA",
    "REINSCRIPCION",
  ]);
  if (!acciones.includes(accion)) return null;

  const diasParaBloqueo = await configNumero("finanzas.dias_adeudo_para_bloqueo", 30);
  const limite = new Date();
  limite.setDate(limite.getDate() - diasParaBloqueo);

  const vencido = await db.cargo.findFirst({
    where: {
      alumnoId,
      estado: { in: ["PENDIENTE", "PARCIAL", "VENCIDO"] },
      saldo: { gt: 0 },
      fechaVencimiento: { lt: limite },
    },
    orderBy: { fechaVencimiento: "asc" },
  });
  if (!vencido) return null;

  return `Esta seccion esta bloqueada por un adeudo vencido desde el ${vencido.fechaVencimiento.toLocaleDateString(
    "es-MX"
  )}. Acude a la administracion del colegio.`;
}
