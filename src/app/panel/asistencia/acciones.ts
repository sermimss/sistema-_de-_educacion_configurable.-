"use server";

import { revalidatePath } from "next/cache";
import type { EstadoAsistencia, ModoAsistencia } from "@prisma/client";
import { requerirSesion } from "@/lib/auth";
import { db } from "@/lib/db";
import { registrarBitacora } from "@/lib/bitacora";
import { claseAccesible, empleadoDeSesion } from "@/lib/docencia";
import { revisarFaltasConsecutivas } from "@/lib/asistencia";

export type EstadoAsistenciaForm = {
  error?: string;
  ok?: boolean;
  mensaje?: string;
  alertas?: string[];
};

const ESTADOS_VALIDOS: EstadoAsistencia[] = [
  "PRESENTE",
  "AUSENTE",
  "RETARDO",
  "JUSTIFICADA",
  "SALIDA_ANTICIPADA",
];

/// Guarda el pase de lista. Segun el modo de la clase, la sesion se registra
/// para esa clase o para el dia completo del grupo.
export async function guardarAsistencia(
  _previo: EstadoAsistenciaForm,
  formData: FormData
): Promise<EstadoAsistenciaForm> {
  const sesion = await requerirSesion();
  const claseId = Number(formData.get("claseId"));
  const fechaTexto = String(formData.get("fecha") ?? "");

  if (!claseId) return { error: "Clase no identificada." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaTexto)) return { error: "Fecha invalida." };
  if (!(await claseAccesible(sesion, claseId))) {
    return { error: "Esta clase no es tuya." };
  }

  const clase = await db.clase.findUnique({
    where: { id: claseId },
    include: { ciclo: true, grupo: true, planMateria: { include: { materia: true } } },
  });
  if (!clase) return { error: "La clase no existe." };
  if (clase.cerrada) return { error: "La clase esta cerrada." };

  // Se guarda como fecha sin hora para que la sesion sea una por dia.
  const fecha = new Date(`${fechaTexto}T00:00:00.000Z`);
  if (fecha < clase.ciclo.fechaInicio || fecha > clase.ciclo.fechaFin) {
    return { error: "La fecha queda fuera del ciclo escolar." };
  }

  const porDia = clase.modoAsistencia === "POR_DIA";
  const empleado = await empleadoDeSesion(sesion.usuarioId);

  const capturas: { alumnoId: number; estado: EstadoAsistencia; observacion: string | null }[] = [];
  for (const [clave, valor] of formData.entries()) {
    if (!clave.startsWith("estado_")) continue;
    const alumnoId = Number(clave.slice("estado_".length));
    const estado = String(valor) as EstadoAsistencia;
    if (!alumnoId || !ESTADOS_VALIDOS.includes(estado)) continue;
    const observacion = String(formData.get(`nota_${alumnoId}`) ?? "").trim();
    capturas.push({ alumnoId, estado, observacion: observacion || null });
  }

  if (capturas.length === 0) return { error: "No hay alumnos que registrar." };

  const sesionAsistencia = await db.$transaction(async (tx) => {
    // En modo por dia la sesion es del grupo (claseId nulo). Como Postgres
    // considera distintos a los nulos, el indice unico no aplica y se busca
    // la sesion del dia a mano antes de crearla.
    let registro = porDia
      ? await tx.sesionAsistencia.findFirst({
          where: { grupoId: clase.grupoId, claseId: null, fecha },
        })
      : await tx.sesionAsistencia.findUnique({
          where: { claseId_fecha: { claseId, fecha } },
        });

    if (!registro) {
      registro = await tx.sesionAsistencia.create({
        data: {
          claseId: porDia ? null : claseId,
          grupoId: clase.grupoId,
          docenteId: empleado?.id ?? null,
          fecha,
          modo: clase.modoAsistencia as ModoAsistencia,
        },
      });
    } else if (registro.cerrada) {
      throw new Error("El pase de lista de ese dia ya fue cerrado.");
    }

    for (const captura of capturas) {
      await tx.registroAsistencia.upsert({
        where: { sesionId_alumnoId: { sesionId: registro.id, alumnoId: captura.alumnoId } },
        update: { estado: captura.estado, observacion: captura.observacion },
        create: {
          sesionId: registro.id,
          alumnoId: captura.alumnoId,
          estado: captura.estado,
          observacion: captura.observacion,
        },
      });
    }

    return registro;
  });

  // Alertas por faltas consecutivas, solo para quienes se marcaron ausentes.
  const alertas: string[] = [];
  for (const captura of capturas.filter((c) => c.estado === "AUSENTE")) {
    const disparo = await revisarFaltasConsecutivas(
      captura.alumnoId,
      porDia ? { grupoId: clase.grupoId } : { claseId }
    );
    if (disparo) {
      const alumno = await db.alumno.findUnique({ where: { id: captura.alumnoId } });
      if (alumno) alertas.push(`${alumno.nombres} ${alumno.apellidoPaterno} (${alumno.matricula})`);
    }
  }

  await registrarBitacora({
    usuarioId: sesion.usuarioId,
    accion: "ACTUALIZAR",
    entidad: "SesionAsistencia",
    entidadId: sesionAsistencia.id,
    descripcion: `Pase de lista de ${clase.planMateria.materia.nombre} (${clase.grupo.nombre}) del ${fechaTexto}: ${capturas.length} alumno(s)`,
  });

  revalidatePath("/panel/asistencia");
  return {
    ok: true,
    mensaje: `Asistencia guardada para ${capturas.length} alumno(s).`,
    alertas: alertas.length
      ? alertas.map(
          (nombre) => `${nombre} alcanzo el limite de faltas consecutivas; se aviso a direccion.`
        )
      : undefined,
  };
}

/// Cada docente decide como pasa lista y si la asistencia pesa en la
/// calificacion, siempre que la escuela se lo permita en Configuracion.
export async function cambiarModoAsistencia(
  _previo: EstadoAsistenciaForm,
  formData: FormData
): Promise<EstadoAsistenciaForm> {
  const sesion = await requerirSesion();
  const claseId = Number(formData.get("claseId"));
  if (!(await claseAccesible(sesion, claseId))) return { error: "Esta clase no es tuya." };

  const modo = String(formData.get("modoAsistencia")) as ModoAsistencia;
  if (modo !== "POR_DIA" && modo !== "POR_CLASE") return { error: "Modo no reconocido." };

  const afecta = formData.get("asistenciaAfectaCalificacion") === "on";
  const porcentajeTexto = String(formData.get("porcentajeAsistencia") ?? "").trim();
  const porcentaje = porcentajeTexto ? Number(porcentajeTexto) : null;
  if (afecta && (porcentaje === null || !Number.isFinite(porcentaje) || porcentaje <= 0 || porcentaje > 100)) {
    return { error: "Si la asistencia afecta la calificacion, indica un porcentaje entre 1 y 100." };
  }

  await db.clase.update({
    where: { id: claseId },
    data: {
      modoAsistencia: modo,
      asistenciaAfectaCalificacion: afecta,
      porcentajeAsistencia: afecta ? porcentaje : null,
    },
  });

  await registrarBitacora({
    usuarioId: sesion.usuarioId,
    accion: "CONFIGURAR",
    entidad: "Clase",
    entidadId: claseId,
    descripcion: `Modo de asistencia ${modo}${afecta ? ` con ${porcentaje}% sobre la calificacion` : ""}`,
  });

  revalidatePath("/panel/mis-clases");
  revalidatePath("/panel/asistencia");
  return { ok: true, mensaje: "Preferencias de la clase actualizadas." };
}

export async function atenderAlerta(formData: FormData) {
  const sesion = await requerirSesion();
  if (sesion.rol !== "ADMIN") return;
  const id = Number(formData.get("alertaId"));
  await db.alertaAsistencia.update({
    where: { id },
    data: { atendida: true, atendidaPor: sesion.usuarioId, notas: String(formData.get("notas") ?? "") || null },
  });
  await registrarBitacora({
    usuarioId: sesion.usuarioId,
    accion: "ACTUALIZAR",
    entidad: "AlertaAsistencia",
    entidadId: id,
    descripcion: "Alerta de asistencia marcada como atendida",
  });
  revalidatePath("/panel/asistencia/alertas");
}
