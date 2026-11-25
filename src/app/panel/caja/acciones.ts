"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requerirRol } from "@/lib/auth";
import { registrarBitacora } from "@/lib/bitacora";
import { conCandado } from "@/lib/cobranza";
import { abrirTurno, resumenTurno, turnoAbierto } from "@/lib/caja";
import { centavos } from "@/lib/finanzas";

export type EstadoCaja = { error?: string };

function dinero(formData: FormData, campo: string): number | null {
  const texto = String(formData.get(campo) ?? "").trim();
  if (!texto) return null;
  const n = Number(texto);
  return Number.isFinite(n) && n >= 0 ? centavos(n) : null;
}

export async function accionAbrirCaja(_p: EstadoCaja, formData: FormData): Promise<EstadoCaja> {
  const sesion = await requerirRol("ADMIN");
  const fondo = dinero(formData, "fondoInicial") ?? (String(formData.get("fondoInicial") ?? "").trim() ? null : 0);
  if (fondo == null) return { error: "El fondo inicial debe ser 0 o mas." };
  if (fondo > 1_000_000) return { error: "El fondo inicial es demasiado alto." };
  const { turno, yaEstaba } = await conCandado((tx) => abrirTurno(tx, { id: sesion.usuarioId, nombre: sesion.nombre }, fondo));
  if (!yaEstaba) {
    await registrarBitacora({ usuarioId: sesion.usuarioId, accion: "CREAR", entidad: "TurnoCaja", entidadId: turno.id, descripcion: `Abrio caja con fondo de ${fondo}` });
  }
  revalidatePath("/panel/caja");
  redirect("/panel/caja");
}

/// Cierra el turno: se cuenta el efectivo y se compara con lo esperado.
export async function accionCerrarCaja(_p: EstadoCaja, formData: FormData): Promise<EstadoCaja> {
  const sesion = await requerirRol("ADMIN");
  const contado = dinero(formData, "efectivoContado");
  if (contado == null) return { error: "Escribe cuanto efectivo contaste en la caja (0 si no hay)." };
  const notas = String(formData.get("notasCierre") ?? "").trim().slice(0, 1000) || null;
  const cerrado = await conCandado(async (tx) => {
    const turno = await turnoAbierto(sesion.usuarioId, tx);
    if (!turno) return null;
    const resumen = await resumenTurno(turno.id, tx);
    const diferencia = centavos(contado - resumen.efectivoEsperado);
    await tx.turnoCaja.update({
      where: { id: turno.id },
      data: { estado: "CERRADO", cerradoEn: new Date(), efectivoEsperado: resumen.efectivoEsperado, efectivoContado: contado, diferencia, notasCierre: notas },
    });
    return { id: turno.id, diferencia, resumen };
  });
  if (!cerrado) return { error: "No tienes una caja abierta." };
  await registrarBitacora({
    usuarioId: sesion.usuarioId,
    accion: "ACTUALIZAR",
    entidad: "TurnoCaja",
    entidadId: cerrado.id,
    descripcion: `Corte de caja #${cerrado.id}: cobrado ${cerrado.resumen.totalCobrado}, efectivo esperado ${cerrado.resumen.efectivoEsperado}, contado ${contado}, diferencia ${cerrado.diferencia}`,
  });
  revalidatePath("/panel/caja");
  redirect(`/panel/caja/corte/${cerrado.id}?cerrado=1`);
}
