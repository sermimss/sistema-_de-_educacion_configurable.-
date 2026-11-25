"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { MostrarRespuestas, TipoPregunta } from "@prisma/client";
import { requerirRol } from "@/lib/auth";
import { db } from "@/lib/db";
import { registrarBitacora } from "@/lib/bitacora";
import { claseAccesible } from "@/lib/docencia";
import { alumnoDeSesion } from "@/lib/alumnoSesion";
import { fechaHoraAInstante } from "@/lib/fechasDia";
import { alumnoCursa, zonaDelColegio } from "@/lib/tareas";
import { leerExamenTexto, type ErrorLectura, type PreguntaLeida } from "@/lib/importarExamen";
import { textoDeArchivo } from "@/lib/textoDeArchivo";
import { estadoParaAlumno, finalizarIntento, GRACIA_MS, ordenParaAlumno, recalcularIntento, vencimientoAlEmpezar } from "@/lib/examenes";

export type EstadoExamen = { error?: string; ok?: boolean; mensaje?: string };

const MOSTRAR: MostrarRespuestas[] = ["NUNCA", "AL_TERMINAR", "AL_CERRAR"];
const TIPOS: TipoPregunta[] = ["OPCION_UNICA", "OPCION_MULTIPLE", "VERDADERO_FALSO", "ABIERTA"];
const MAX_OPCIONES = 6;

async function examenDelDocente(examenId: number) {
  const sesion = await requerirRol("DOCENTE");
  const examen = await db.examen.findUnique({ where: { id: examenId || 0 }, include: { _count: { select: { intentos: true, preguntas: true } } } });
  if (!examen || !(await claseAccesible(sesion, examen.claseId))) return { sesion, examen: null };
  return { sesion, examen };
}

async function leerConfiguracion(formData: FormData) {
  const zona = await zonaDelColegio();
  const titulo = String(formData.get("titulo") ?? "").trim();
  const instrucciones = String(formData.get("instrucciones") ?? "").trim();
  const abreEn = fechaHoraAInstante(String(formData.get("abreEn") ?? ""), zona);
  const cierraEn = fechaHoraAInstante(String(formData.get("cierraEn") ?? ""), zona);
  const textoDuracion = String(formData.get("duracionMinutos") ?? "").trim();
  const duracionMinutos = textoDuracion ? Number(textoDuracion) : null;
  const mostrarRespuestas = String(formData.get("mostrarRespuestas") ?? "NUNCA") as MostrarRespuestas;
  if (titulo.length < 3 || titulo.length > 150) return { error: "Escribe el titulo del examen (3 a 150 caracteres)." } as const;
  if (instrucciones.length > 3000) return { error: "Las instrucciones son demasiado largas." } as const;
  if (!abreEn || !cierraEn) return { error: "Indica cuando abre y cuando cierra el examen." } as const;
  if (cierraEn <= abreEn) return { error: "El cierre debe ser despues de la apertura." } as const;
  if (duracionMinutos != null && (!Number.isInteger(duracionMinutos) || duracionMinutos < 1 || duracionMinutos > 600)) {
    return { error: "El tiempo limite debe ser de 1 a 600 minutos, o dejalo vacio." } as const;
  }
  if (!MOSTRAR.includes(mostrarRespuestas)) return { error: "Elige cuando ve el alumno sus respuestas." } as const;
  return {
    datos: {
      titulo,
      instrucciones: instrucciones || null,
      abreEn,
      cierraEn,
      duracionMinutos,
      aceptaTardios: formData.get("aceptaTardios") === "on",
      desordenar: formData.get("desordenar") === "on",
      mostrarRespuestas,
    },
  } as const;
}

export async function accionCrearExamen(_p: EstadoExamen, formData: FormData): Promise<EstadoExamen> {
  const sesion = await requerirRol("DOCENTE");
  const claseId = Number(formData.get("claseId")) || 0;
  if (!(await claseAccesible(sesion, claseId))) return { error: "Elige una de tus clases." };
  const leido = await leerConfiguracion(formData);
  if ("error" in leido) return { error: leido.error };
  if (leido.datos.cierraEn <= new Date()) return { error: "El cierre debe ser posterior a este momento." };
  const examen = await db.examen.create({ data: { ...leido.datos, claseId, creadoPor: sesion.usuarioId } });
  await registrarBitacora({ usuarioId: sesion.usuarioId, accion: "CREAR", entidad: "Examen", entidadId: examen.id, descripcion: `Examen "${examen.titulo}" (borrador)` });
  redirect(`/panel/examenes/${examen.id}?creado=1`);
}

export async function accionEditarExamen(_p: EstadoExamen, formData: FormData): Promise<EstadoExamen> {
  const { sesion, examen } = await examenDelDocente(Number(formData.get("examenId")));
  if (!examen) return { error: "Ese examen no es tuyo." };
  const leido = await leerConfiguracion(formData);
  if ("error" in leido) return { error: leido.error };
  await db.examen.update({ where: { id: examen.id }, data: leido.datos });
  await registrarBitacora({ usuarioId: sesion.usuarioId, accion: "ACTUALIZAR", entidad: "Examen", entidadId: examen.id, descripcion: `Examen "${leido.datos.titulo}" editado` });
  revalidatePath(`/panel/examenes/${examen.id}`);
  return { ok: true, mensaje: "Datos del examen guardados." };
}

export async function accionAgregarPregunta(_p: EstadoExamen, formData: FormData): Promise<EstadoExamen> {
  const { examen } = await examenDelDocente(Number(formData.get("examenId")));
  if (!examen) return { error: "Ese examen no es tuyo." };
  if (examen._count.intentos > 0) return { error: "Ya hay alumnos que empezaron el examen: las preguntas no se pueden cambiar." };
  const tipo = String(formData.get("tipo")) as TipoPregunta;
  if (!TIPOS.includes(tipo)) return { error: "Elige el tipo de pregunta." };
  const enunciado = String(formData.get("enunciado") ?? "").trim();
  if (enunciado.length < 2 || enunciado.length > 3000) return { error: "Escribe la pregunta." };
  const puntos = Number(formData.get("puntos"));
  if (!Number.isFinite(puntos) || puntos <= 0 || puntos > 1000) return { error: "Los puntos deben ser mayores a 0." };

  let opciones: { texto: string; correcta: boolean }[] = [];
  if (tipo === "VERDADERO_FALSO") {
    const correcta = String(formData.get("respuestaVF") ?? "");
    if (correcta !== "V" && correcta !== "F") return { error: "Indica si la respuesta correcta es verdadero o falso." };
    opciones = [
      { texto: "Verdadero", correcta: correcta === "V" },
      { texto: "Falso", correcta: correcta === "F" },
    ];
  } else if (tipo !== "ABIERTA") {
    const correctas = new Set(formData.getAll("correcta").map(String));
    for (let i = 0; i < MAX_OPCIONES; i++) {
      const texto = String(formData.get(`opcion${i}`) ?? "").trim().slice(0, 500);
      if (texto) opciones.push({ texto, correcta: correctas.has(String(i)) });
      else if (correctas.has(String(i))) return { error: "Marcaste como correcta una opcion vacia." };
    }
    if (opciones.length < 2) return { error: "Escribe al menos dos opciones." };
    const n = opciones.filter((o) => o.correcta).length;
    if (tipo === "OPCION_UNICA" && n !== 1) return { error: "Marca exactamente una opcion correcta." };
    if (tipo === "OPCION_MULTIPLE" && n < 1) return { error: "Marca al menos una opcion correcta." };
  }

  const ultima = await db.preguntaExamen.aggregate({ where: { examenId: examen.id }, _max: { orden: true } });
  await db.preguntaExamen.create({
    data: {
      examenId: examen.id,
      orden: (ultima._max.orden ?? 0) + 1,
      tipo,
      enunciado,
      puntos: Math.round(puntos * 100) / 100,
      opciones: { create: opciones.map((o, i) => ({ ...o, orden: i + 1 })) },
    },
  });
  revalidatePath(`/panel/examenes/${examen.id}`);
  return { ok: true, mensaje: "Pregunta agregada." };
}

export async function accionQuitarPregunta(formData: FormData) {
  const { examen } = await examenDelDocente(Number(formData.get("examenId")));
  if (!examen || examen._count.intentos > 0) return;
  await db.preguntaExamen.deleteMany({ where: { id: Number(formData.get("preguntaId")) || 0, examenId: examen.id } });
  revalidatePath(`/panel/examenes/${examen.id}`);
}

export async function accionPublicarExamen(formData: FormData) {
  const { sesion, examen } = await examenDelDocente(Number(formData.get("examenId")));
  if (!examen) return;
  const publicar = formData.get("accion") === "publicar";
  if (publicar && examen._count.preguntas === 0) redirect(`/panel/examenes/${examen.id}?aviso=sin-preguntas`);
  if (!publicar && examen._count.intentos > 0) redirect(`/panel/examenes/${examen.id}?aviso=con-intentos`);
  await db.examen.update({ where: { id: examen.id }, data: { publicado: publicar } });
  await registrarBitacora({
    usuarioId: sesion.usuarioId,
    accion: "ACTUALIZAR",
    entidad: "Examen",
    entidadId: examen.id,
    descripcion: `Examen "${examen.titulo}" ${publicar ? "publicado" : "regresado a borrador"}`,
  });
  revalidatePath("/panel/examenes");
  redirect(`/panel/examenes/${examen.id}?${publicar ? "publicado=1" : "borrador=1"}`);
}

export async function accionEliminarExamen(formData: FormData) {
  const { sesion, examen } = await examenDelDocente(Number(formData.get("examenId")));
  if (!examen || examen._count.intentos > 0) return;
  await db.examen.delete({ where: { id: examen.id } });
  await registrarBitacora({ usuarioId: sesion.usuarioId, accion: "ELIMINAR", entidad: "Examen", entidadId: examen.id, descripcion: `Examen "${examen.titulo}" eliminado (sin intentos)` });
  revalidatePath("/panel/examenes");
  redirect("/panel/examenes?eliminado=1");
}

/// El docente califica una respuesta abierta.
export async function accionCalificarRespuesta(_p: EstadoExamen, formData: FormData): Promise<EstadoExamen> {
  const sesion = await requerirRol("DOCENTE");
  const respuesta = await db.respuestaExamen.findUnique({
    where: { id: Number(formData.get("respuestaId")) || 0 },
    include: { pregunta: true, intento: { include: { examen: true } } },
  });
  if (!respuesta || !(await claseAccesible(sesion, respuesta.intento.examen.claseId))) return { error: "Esa respuesta no es de tus clases." };
  if (respuesta.pregunta.tipo !== "ABIERTA") return { error: "Esa pregunta se califica sola." };
  if (!respuesta.intento.enviadoEn) return { error: "El alumno aun no envia su examen." };
  const maximo = Number(respuesta.pregunta.puntos);
  const texto = String(formData.get("puntos") ?? "").trim();
  const puntos = Number(texto);
  if (!texto || !Number.isFinite(puntos) || puntos < 0 || puntos > maximo) return { error: `Los puntos deben ser de 0 a ${maximo}.` };
  const comentario = String(formData.get("comentario") ?? "").trim().slice(0, 1000) || null;
  await db.$transaction(async (tx) => {
    await tx.respuestaExamen.update({ where: { id: respuesta.id }, data: { puntos: Math.round(puntos * 100) / 100, comentario } });
    await recalcularIntento(respuesta.intentoId, tx);
  });
  await registrarBitacora({
    usuarioId: sesion.usuarioId,
    accion: "ACTUALIZAR",
    entidad: "RespuestaExamen",
    entidadId: respuesta.id,
    descripcion: `Califico respuesta abierta de "${respuesta.intento.examen.titulo}": ${puntos}/${maximo}`,
  });
  revalidatePath(`/panel/examenes/${respuesta.intento.examenId}`, "layout");
  return { ok: true, mensaje: `Guardado: ${puntos} de ${maximo}.` };
}

// ---------------- Alumno ----------------

async function intentoPropio(intentoId: number) {
  const sesion = await requerirRol("ALUMNO");
  const alumno = await alumnoDeSesion(sesion.usuarioId);
  const intento = await db.intentoExamen.findUnique({ where: { id: intentoId || 0 }, include: { examen: { include: { preguntas: { include: { opciones: true } } } } } });
  if (!alumno || !intento || intento.alumnoId !== alumno.id) return null;
  return intento;
}

export async function accionComenzarExamen(formData: FormData) {
  const sesion = await requerirRol("ALUMNO");
  const alumno = await alumnoDeSesion(sesion.usuarioId);
  const examen = await db.examen.findUnique({ where: { id: Number(formData.get("examenId")) || 0 }, include: { preguntas: { include: { opciones: true } } } });
  if (!alumno || !examen || !(await alumnoCursa(alumno.id, examen.claseId))) redirect("/panel/examenes");
  const existente = await db.intentoExamen.findUnique({ where: { examenId_alumnoId: { examenId: examen.id, alumnoId: alumno.id } } });
  if (!existente) {
    const estado = estadoParaAlumno(examen, null);
    if (estado !== "disponible" && estado !== "tardio") redirect(`/panel/examenes/${examen.id}`);
    const inicio = new Date();
    await db.intentoExamen.create({
      data: {
        examenId: examen.id,
        alumnoId: alumno.id,
        iniciadoEn: inicio,
        venceEn: vencimientoAlEmpezar(examen, inicio),
        orden: ordenParaAlumno(examen.preguntas, examen.desordenar),
      },
    });
    await registrarBitacora({ usuarioId: sesion.usuarioId, accion: "CREAR", entidad: "IntentoExamen", entidadId: examen.id, descripcion: `Empezo el examen "${examen.titulo}"` });
  }
  redirect(`/panel/examenes/${examen.id}/contestar`);
}

/// Guarda una respuesta mientras contesta (autoguardado).
export async function guardarRespuesta(intentoId: number, preguntaId: number, opciones: number[], texto: string): Promise<{ ok: boolean; error?: string }> {
  const intento = await intentoPropio(intentoId);
  if (!intento) return { ok: false, error: "Ese examen no es tuyo." };
  if (intento.enviadoEn) return { ok: false, error: "Tu examen ya fue enviado." };
  if (intento.venceEn && Date.now() > intento.venceEn.getTime() + GRACIA_MS) return { ok: false, error: "Se acabo el tiempo." };
  const pregunta = intento.examen.preguntas.find((p) => p.id === preguntaId);
  if (!pregunta) return { ok: false, error: "Esa pregunta no es de este examen." };
  const validas = new Set(pregunta.opciones.map((o) => o.id));
  const elegidas = [...new Set(opciones.filter((o) => validas.has(o)))];
  const unica = pregunta.tipo === "OPCION_UNICA" || pregunta.tipo === "VERDADERO_FALSO";
  await db.respuestaExamen.upsert({
    where: { intentoId_preguntaId: { intentoId: intento.id, preguntaId } },
    create: { intentoId: intento.id, preguntaId, opciones: unica ? elegidas.slice(0, 1) : elegidas, texto: pregunta.tipo === "ABIERTA" ? texto.slice(0, 5000) : null },
    update: { opciones: unica ? elegidas.slice(0, 1) : elegidas, texto: pregunta.tipo === "ABIERTA" ? texto.slice(0, 5000) : null },
  });
  return { ok: true };
}

/// Envia el examen. Si el tiempo ya vencio, se envia con lo guardado hasta
/// ese momento.
export async function accionEnviarExamen(formData: FormData) {
  const intento = await intentoPropio(Number(formData.get("intentoId")));
  if (!intento) redirect("/panel/examenes");
  if (!intento.enviadoEn) {
    const ahora = new Date();
    const vencido = intento.venceEn && ahora.getTime() > intento.venceEn.getTime() + GRACIA_MS;
    await finalizarIntento(intento.id, vencido ? intento.venceEn! : ahora);
  }
  revalidatePath("/panel/examenes");
  redirect(`/panel/examenes/${intento.examenId}?enviado=1`);
}

// ---------------- Cargar un examen ya escrito ----------------

export type VistaImportacion = {
  error?: string;
  texto?: string;
  preguntas?: PreguntaLeida[];
  errores?: ErrorLectura[];
  agregadas?: number;
};

async function textoParaImportar(formData: FormData): Promise<{ texto: string } | { error: string }> {
  const archivo = formData.get("archivo");
  if (archivo instanceof File && archivo.size > 0) {
    const leido = await textoDeArchivo(archivo);
    return leido.ok ? { texto: leido.texto } : { error: leido.error };
  }
  const texto = String(formData.get("texto") ?? "");
  if (!texto.trim()) return { error: "Pega el texto del examen o sube un archivo .txt o .docx." };
  if (texto.length > 200_000) return { error: "El texto es demasiado largo." };
  return { texto };
}

/// Paso 1: leer el texto o archivo y mostrar como se entendio cada pregunta.
export async function accionVistaImportacion(_p: VistaImportacion, formData: FormData): Promise<VistaImportacion> {
  const { examen } = await examenDelDocente(Number(formData.get("examenId")));
  if (!examen) return { error: "Ese examen no es tuyo." };
  if (examen._count.intentos > 0) return { error: "Ya hay alumnos que empezaron el examen: las preguntas no se pueden cambiar." };
  const fuente = await textoParaImportar(formData);
  if ("error" in fuente) return { error: fuente.error };
  const { preguntas, errores } = leerExamenTexto(fuente.texto);
  return { texto: fuente.texto, preguntas, errores };
}

/// Paso 2: el docente confirma. Se vuelve a leer el texto (no se confia en
/// lo que mande el navegador) y se agregan todas o ninguna.
export async function accionConfirmarImportacion(_p: VistaImportacion, formData: FormData): Promise<VistaImportacion> {
  const { sesion, examen } = await examenDelDocente(Number(formData.get("examenId")));
  if (!examen) return { error: "Ese examen no es tuyo." };
  if (examen._count.intentos > 0) return { error: "Ya hay alumnos que empezaron el examen: las preguntas no se pueden cambiar." };
  const texto = String(formData.get("texto") ?? "");
  const { preguntas, errores } = leerExamenTexto(texto);
  if (errores.length > 0 || preguntas.length === 0) return { error: "El texto tiene errores; corrigelo y vuelve a ver la vista previa.", texto, preguntas, errores };
  await db.$transaction(async (tx) => {
    const ultima = await tx.preguntaExamen.aggregate({ where: { examenId: examen.id }, _max: { orden: true } });
    let orden = ultima._max.orden ?? 0;
    for (const p of preguntas) {
      orden += 1;
      await tx.preguntaExamen.create({
        data: {
          examenId: examen.id,
          orden,
          tipo: p.tipo,
          enunciado: p.enunciado,
          puntos: p.puntos,
          opciones: { create: p.opciones.map((o, i) => ({ texto: o.texto, correcta: o.correcta, orden: i + 1 })) },
        },
      });
    }
  });
  await registrarBitacora({
    usuarioId: sesion.usuarioId,
    accion: "IMPORTAR",
    entidad: "Examen",
    entidadId: examen.id,
    descripcion: `Cargo ${preguntas.length} pregunta(s) a "${examen.titulo}" desde un texto`,
  });
  revalidatePath(`/panel/examenes/${examen.id}`);
  return { agregadas: preguntas.length };
}
