"use server";

import { revalidatePath } from "next/cache";
import { requerirRol } from "@/lib/auth";
import { db } from "@/lib/db";
import { registrarBitacora } from "@/lib/bitacora";
import { alumnoDeSesion } from "@/lib/alumnoSesion";
import { configBool } from "@/lib/configuracion";
import { obtenerInstitucion } from "@/lib/institucion";
import { esFechaDia, aFechaDia, hoyEnZona } from "@/lib/fechasDia";
import { validarComprobante } from "@/lib/comprobantes";

export type EstadoComprobante = { error?: string; ok?: boolean; mensaje?: string };

/// El alumno reporta su transferencia o deposito con el comprobante. Queda
/// por verificar hasta que la administracion o caja lo confirme.
export async function accionSubirComprobante(_p: EstadoComprobante, formData: FormData): Promise<EstadoComprobante> {
  const sesion = await requerirRol("ALUMNO");
  if (!(await configBool("portales.alumno_ve_estado_cuenta", true))) return { error: "El colegio tiene desactivada esta seccion." };
  const alumno = await alumnoDeSesion(sesion.usuarioId);
  if (!alumno) return { error: "Tu usuario no esta ligado a un expediente." };

  const monto = Math.round(Number(formData.get("monto")) * 100) / 100;
  if (!Number.isFinite(monto) || monto <= 0 || monto > 10_000_000) return { error: "Escribe el monto que pagaste." };
  const metodo = String(formData.get("metodoPago") ?? "");
  if (metodo !== "TRANSFERENCIA" && metodo !== "DEPOSITO") return { error: "Elige si fue transferencia o deposito." };
  const referencia = String(formData.get("referencia") ?? "").trim().slice(0, 80);
  if (!referencia) return { error: "Escribe el numero de operacion, folio o clave de rastreo de tu comprobante." };
  const hoy = hoyEnZona((await obtenerInstitucion())?.zonaHoraria ?? "America/Mexico_City");
  const fecha = String(formData.get("fechaPago") ?? "").trim();
  if (!esFechaDia(fecha) || fecha > hoy) return { error: "Indica la fecha en que pagaste (no puede ser futura)." };
  const archivo = await validarComprobante(formData.get("archivo"));
  if (!archivo.ok) return { error: archivo.error };

  const repetido = await db.comprobantePago.findFirst({
    where: { alumnoId: alumno.id, referencia: { equals: referencia, mode: "insensitive" }, estado: { not: "RECHAZADO" } },
  });
  if (repetido) return { error: "Ya enviaste un comprobante con esa misma referencia." };

  const comprobante = await db.comprobantePago.create({
    data: {
      alumnoId: alumno.id,
      monto,
      fechaPago: aFechaDia(fecha),
      metodoPago: metodo,
      referencia,
      banco: String(formData.get("banco") ?? "").trim().slice(0, 80) || null,
      nota: String(formData.get("nota") ?? "").trim().slice(0, 500) || null,
      archivoNombre: archivo.archivo.nombre,
      archivoMime: archivo.archivo.mime,
      archivoTamano: archivo.archivo.tamano,
      archivoDatos: archivo.archivo.datos,
    },
  });
  await registrarBitacora({ usuarioId: sesion.usuarioId, accion: "CREAR", entidad: "ComprobantePago", entidadId: comprobante.id, descripcion: `Comprobante por ${monto} (${metodo.toLowerCase()}, ref ${referencia})` });
  revalidatePath("/panel/estado-de-cuenta");
  return { ok: true, mensaje: "Comprobante enviado. Cuando el colegio lo verifique, veras tu pago y tu recibo aqui." };
}
