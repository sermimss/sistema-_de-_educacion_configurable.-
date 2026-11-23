"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requerirRol } from "@/lib/auth";
import { db } from "@/lib/db";
import { registrarBitacora } from "@/lib/bitacora";
import { obtenerInstitucion } from "@/lib/institucion";
import { nombreCompleto } from "@/lib/catalogos";
import { aFechaDia, fechaCorta, hoyEnZona, sumarDias, textoDeFecha } from "@/lib/fechasDia";
import { aplicarCambio, choquesDelCambio, describirCambio, leerCambio, nombreDia, type DatosCambio } from "@/lib/cambiosHorario";

export type EstadoRevision = { error?: string; detalles?: string[]; ok?: boolean; mensaje?: string };

async function cargar(id: number) {
  return db.solicitudHorario.findUnique({
    where: { id },
    include: {
      horario: {
        include: { aula: true, clase: { include: { ciclo: true, grupo: true, docente: true, aula: true, planMateria: { include: { materia: true } } } } },
      },
    },
  });
}

/// Aprueba la solicitud tal cual o con los ajustes que haga la
/// administracion (dia, fecha, horas o aula). Vuelve a revisar choques.
export async function accionAprobarCambio(_p: EstadoRevision, formData: FormData): Promise<EstadoRevision> {
  const sesion = await requerirRol("ADMIN");
  const solicitud = await cargar(Number(formData.get("solicitudId")) || 0);
  if (!solicitud) return { error: "Esa solicitud ya no existe." };
  if (solicitud.estado !== "PENDIENTE") return { error: "Esa solicitud ya fue atendida." };
  const { horario } = solicitud;

  // El tipo y la clase que se mueve los decide el docente; lo demas se ajusta.
  formData.set("tipo", solicitud.tipo);
  if (solicitud.fechaOriginal) formData.set("fechaOriginal", textoDeFecha(solicitud.fechaOriginal));
  const institucion = await obtenerInstitucion();
  const hoy = hoyEnZona(institucion?.zonaHoraria ?? "America/Mexico_City");
  const leido = leerCambio(formData, horario, horario.clase.ciclo, hoy);
  if (!leido.ok) return { error: leido.error };
  const c = leido.cambio;

  const choques = await choquesDelCambio(horario.id, c);
  if (choques.length > 0) return { error: "Con esos datos el horario choca. Ajustalo o rechaza la solicitud.", detalles: choques };

  const pedido: DatosCambio = {
    tipo: solicitud.tipo,
    nuevoDia: solicitud.nuevoDia,
    fechaOriginal: solicitud.fechaOriginal ? textoDeFecha(solicitud.fechaOriginal) : null,
    nuevaFecha: solicitud.nuevaFecha ? textoDeFecha(solicitud.nuevaFecha) : null,
    horaInicio: solicitud.horaInicio,
    horaFin: solicitud.horaFin,
    aulaId: null,
  };
  const ajustada =
    c.nuevoDia !== pedido.nuevoDia || c.nuevaFecha !== pedido.nuevaFecha || c.horaInicio !== pedido.horaInicio || c.horaFin !== pedido.horaFin || Boolean(c.aulaId && c.aulaId !== (horario.aulaId ?? horario.clase.aulaId));
  const nota = String(formData.get("nota") ?? "").trim().slice(0, 500);
  const aula = c.aulaId ? await db.aula.findUnique({ where: { id: c.aulaId } }) : null;
  const avisar = formData.get("avisar") === "1";
  const materia = horario.clase.planMateria.materia.nombre;

  await db.$transaction(async (tx) => {
    await aplicarCambio(tx, horario.id, c, solicitud.id);
    await tx.solicitudHorario.update({
      where: { id: solicitud.id },
      data: {
        estado: "APROBADA",
        ajustada,
        nuevoDia: c.nuevoDia,
        nuevaFecha: c.nuevaFecha ? aFechaDia(c.nuevaFecha) : null,
        horaInicio: c.horaInicio,
        horaFin: c.horaFin,
        aulaId: c.aulaId,
        respuesta: [ajustada ? `Se aprobo con ajustes; habias pedido ${describirCambio(pedido)}.` : null, nota || null].filter(Boolean).join(" ") || null,
        resueltaPor: sesion.usuarioId,
        resueltaEn: new Date(),
      },
    });
    if (avisar) {
      const enAula = aula ? ` en ${aula.nombre}` : "";
      const contenido =
        c.tipo === "PERMANENTE"
          ? `A partir de ahora, ${materia} con ${nombreCompleto(horario.clase.docente)} se da los ${nombreDia(c.nuevoDia!).toLowerCase()} de ${c.horaInicio} a ${c.horaFin}${enAula} (antes: ${nombreDia(horario.diaSemana).toLowerCase()} de ${horario.horaInicio} a ${horario.horaFin}).`
          : `La clase de ${materia} del ${fechaCorta(c.fechaOriginal!)} se pasa al ${fechaCorta(c.nuevaFecha!)} de ${c.horaInicio} a ${c.horaFin}${enAula}. Las demas semanas no cambian.`;
      await tx.aviso.create({
        data: {
          titulo: `Cambio de horario: ${materia}`,
          contenido,
          ambito: "GRUPO",
          referenciaId: horario.clase.grupoId,
          claseId: horario.claseId,
          dirigidoA: ["ALUMNO"],
          publicadoPor: sesion.usuarioId,
          autorNombre: sesion.nombre,
          vigenciaHasta: aFechaDia(c.tipo === "PERMANENTE" ? sumarDias(hoy, 14) : [c.nuevaFecha!, c.fechaOriginal!].sort()[1]),
        },
      });
    }
  });
  await registrarBitacora({
    usuarioId: sesion.usuarioId,
    accion: "ACTUALIZAR",
    entidad: "SolicitudHorario",
    entidadId: solicitud.id,
    descripcion: `Aprobo${ajustada ? " con ajustes" : ""} mover ${materia} · ${horario.clase.grupo.nombre} a ${describirCambio(c)}${avisar ? " y aviso a los alumnos" : ""}`,
  });
  revalidatePath("/panel", "layout");
  // La solicitud sale de la bandeja: el resultado se muestra arriba.
  redirect(`/panel/cambios-horario?aprobada=${solicitud.id}`);
}

export async function accionRechazarCambio(_p: EstadoRevision, formData: FormData): Promise<EstadoRevision> {
  const sesion = await requerirRol("ADMIN");
  const solicitud = await cargar(Number(formData.get("solicitudId")) || 0);
  if (!solicitud) return { error: "Esa solicitud ya no existe." };
  if (solicitud.estado !== "PENDIENTE") return { error: "Esa solicitud ya fue atendida." };
  const motivo = String(formData.get("respuesta") ?? "").trim();
  if (motivo.length < 3) return { error: "Escribe el motivo del rechazo; el docente lo vera." };
  await db.solicitudHorario.update({
    where: { id: solicitud.id },
    data: { estado: "RECHAZADA", respuesta: motivo.slice(0, 1000), resueltaPor: sesion.usuarioId, resueltaEn: new Date() },
  });
  await registrarBitacora({
    usuarioId: sesion.usuarioId,
    accion: "ACTUALIZAR",
    entidad: "SolicitudHorario",
    entidadId: solicitud.id,
    descripcion: `Rechazo el cambio de ${solicitud.horario.clase.planMateria.materia.nombre}: ${motivo}`,
  });
  revalidatePath("/panel", "layout");
  redirect(`/panel/cambios-horario?rechazada=${solicitud.id}`);
}
