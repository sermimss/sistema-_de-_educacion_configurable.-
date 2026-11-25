"use server";

import { revalidatePath } from "next/cache";
import { requerirRol } from "@/lib/auth";
import { db } from "@/lib/db";
import { registrarBitacora } from "@/lib/bitacora";
import { textoDeFecha } from "@/lib/fechasDia";
import { procesarPago, type EstadoPago } from "@/lib/registroPago";

export type EstadoRevisionComprobante = EstadoPago & { confirmado?: boolean };

/// Confirmar un comprobante registra el pago con sus datos (el monto y la
/// referencia se pueden corregir) en la caja de quien confirma. La clave de
/// captura es la del comprobante: confirmarlo dos veces no duplica el pago.
export async function accionConfirmarComprobante(_p: EstadoRevisionComprobante, formData: FormData): Promise<EstadoRevisionComprobante> {
  const sesion = await requerirRol("ADMIN", "CAJERO");
  const comprobante = await db.comprobantePago.findUnique({ where: { id: Number(formData.get("comprobanteId")) || 0 } });
  if (!comprobante) return { error: "Ese comprobante ya no existe." };
  if (comprobante.estado !== "POR_VERIFICAR") return { error: "Ese comprobante ya fue revisado." };

  const clave = `comprobante-${comprobante.id}`;
  const datos = new FormData();
  datos.set("alumnoId", String(comprobante.alumnoId));
  datos.set("monto", String(formData.get("monto") ?? comprobante.monto));
  datos.set("metodoPago", comprobante.metodoPago);
  datos.set("referencia", String(formData.get("referencia") ?? comprobante.referencia).trim());
  datos.set("banco", comprobante.banco ?? "");
  datos.set("fechaRecibido", textoDeFecha(comprobante.fechaPago));
  datos.set("notas", `Comprobante #${comprobante.id} enviado por el alumno${comprobante.nota ? `: ${comprobante.nota}` : ""}`);
  datos.set("claveCaptura", clave);
  if (formData.get("confirmarDuplicado") === "1") datos.set("confirmarDuplicado", "1");

  const resultado = await procesarPago(sesion, datos);
  if (!resultado.ok) return resultado;
  const pago = await db.pago.findUnique({ where: { claveCaptura: clave } });
  if (!pago) return { error: "No se pudo registrar el pago." };
  await db.comprobantePago.update({
    where: { id: comprobante.id },
    data: { estado: "CONFIRMADO", pagoId: pago.id, revisadoPor: sesion.usuarioId, revisadoEn: new Date() },
  });
  await registrarBitacora({ usuarioId: sesion.usuarioId, accion: "ACTUALIZAR", entidad: "ComprobantePago", entidadId: comprobante.id, descripcion: `Comprobante confirmado: pago ${pago.folio}` });
  revalidatePath("/panel/caja/comprobantes");
  return { ok: true, confirmado: true, pagoId: pago.id, mensaje: resultado.mensaje };
}

export async function accionRechazarComprobante(_p: EstadoRevisionComprobante, formData: FormData): Promise<EstadoRevisionComprobante> {
  const sesion = await requerirRol("ADMIN", "CAJERO");
  const comprobante = await db.comprobantePago.findUnique({ where: { id: Number(formData.get("comprobanteId")) || 0 } });
  if (!comprobante) return { error: "Ese comprobante ya no existe." };
  if (comprobante.estado !== "POR_VERIFICAR") return { error: "Ese comprobante ya fue revisado." };
  const motivo = String(formData.get("motivo") ?? "").trim();
  if (motivo.length < 3) return { error: "Escribe el motivo del rechazo; el alumno lo vera." };
  await db.comprobantePago.update({
    where: { id: comprobante.id },
    data: { estado: "RECHAZADO", motivoRechazo: motivo.slice(0, 500), revisadoPor: sesion.usuarioId, revisadoEn: new Date() },
  });
  await registrarBitacora({ usuarioId: sesion.usuarioId, accion: "ACTUALIZAR", entidad: "ComprobantePago", entidadId: comprobante.id, descripcion: `Comprobante rechazado: ${motivo}` });
  revalidatePath("/panel/caja/comprobantes");
  return { ok: true, mensaje: "Comprobante rechazado. El alumno vera el motivo." };
}
