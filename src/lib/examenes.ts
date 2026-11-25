import type { Examen, IntentoExamen, OpcionPregunta, PreguntaExamen, Prisma } from "@prisma/client";
import { db } from "./db";

/// Examenes en linea. Reglas:
/// - Un solo intento por alumno.
/// - Se puede empezar entre que abre y que cierra; despues del cierre solo si
///   el examen acepta tardios (queda marcado como tarde).
/// - Con tiempo limite, el intento vence a los N minutos de empezar; sin
///   aceptar tardios, nunca despues del cierre. Lo que no se envio a tiempo
///   se envia solo con las respuestas guardadas.
/// - Opcion unica, varias correctas y verdadero/falso se califican solas
///   (varias correctas: todo o nada, hay que marcar exactamente las
///   correctas). Las abiertas las califica el docente.

/// Margen para lo que llega justo al acabarse el tiempo (red lenta).
export const GRACIA_MS = 30_000;

export type OrdenIntento = { preguntas: number[]; opciones: Record<string, number[]> };

function barajar<T>(lista: T[]): T[] {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

export function ordenParaAlumno(
  preguntas: (PreguntaExamen & { opciones: OpcionPregunta[] })[],
  desordenar: boolean
): OrdenIntento {
  const enOrden = [...preguntas].sort((a, b) => a.orden - b.orden);
  const lista = desordenar ? barajar(enOrden) : enOrden;
  const opciones: Record<string, number[]> = {};
  for (const p of lista) {
    const ops = [...p.opciones].sort((a, b) => a.orden - b.orden).map((o) => o.id);
    // Verdadero/falso siempre en su orden.
    opciones[p.id] = desordenar && p.tipo !== "VERDADERO_FALSO" ? barajar(ops) : ops;
  }
  return { preguntas: lista.map((p) => p.id), opciones };
}

/// Hasta cuando puede contestar quien empieza ahora.
export function vencimientoAlEmpezar(examen: Pick<Examen, "cierraEn" | "duracionMinutos" | "aceptaTardios">, inicio: Date): Date | null {
  const porTiempo = examen.duracionMinutos ? new Date(inicio.getTime() + examen.duracionMinutos * 60_000) : null;
  if (examen.aceptaTardios) return porTiempo;
  if (!porTiempo) return examen.cierraEn;
  return porTiempo < examen.cierraEn ? porTiempo : examen.cierraEn;
}

export type EstadoParaAlumno = "borrador" | "proximo" | "disponible" | "tardio" | "en-curso" | "terminado" | "cerrado";

export function estadoParaAlumno(
  examen: Pick<Examen, "publicado" | "abreEn" | "cierraEn" | "aceptaTardios">,
  intento: Pick<IntentoExamen, "enviadoEn" | "venceEn"> | null,
  ahora = new Date()
): EstadoParaAlumno {
  if (!examen.publicado) return "borrador";
  if (intento) {
    if (intento.enviadoEn || (intento.venceEn && ahora.getTime() > intento.venceEn.getTime() + GRACIA_MS)) return "terminado";
    return "en-curso";
  }
  if (ahora < examen.abreEn) return "proximo";
  if (ahora <= examen.cierraEn) return "disponible";
  return examen.aceptaTardios ? "tardio" : "cerrado";
}

export const ETIQUETA_ESTADO_EXAMEN: Record<EstadoParaAlumno, { texto: string; tono: "neutro" | "exito" | "alerta" | "peligro" }> = {
  borrador: { texto: "Borrador", tono: "neutro" },
  proximo: { texto: "Proximo", tono: "neutro" },
  disponible: { texto: "Disponible", tono: "exito" },
  tardio: { texto: "Fuera de tiempo", tono: "alerta" },
  "en-curso": { texto: "En curso", tono: "alerta" },
  terminado: { texto: "Terminado", tono: "exito" },
  cerrado: { texto: "No presentado", tono: "peligro" },
};

export function puedeVerRespuestas(
  examen: Pick<Examen, "mostrarRespuestas" | "cierraEn">,
  intento: Pick<IntentoExamen, "enviadoEn">,
  ahora = new Date()
): boolean {
  if (!intento.enviadoEn) return false;
  if (examen.mostrarRespuestas === "AL_TERMINAR") return true;
  if (examen.mostrarRespuestas === "AL_CERRAR") return ahora > examen.cierraEn;
  return false;
}

/// Puntos de una respuesta cerrada; null si es abierta (la califica el docente).
export function puntosAutomaticos(
  pregunta: PreguntaExamen & { opciones: OpcionPregunta[] },
  elegidas: number[]
): number | null {
  if (pregunta.tipo === "ABIERTA") return null;
  const correctas = pregunta.opciones.filter((o) => o.correcta).map((o) => o.id).sort();
  const marcadas = [...new Set(elegidas)].sort();
  const bien = correctas.length === marcadas.length && correctas.every((id, i) => id === marcadas[i]);
  return bien ? Number(pregunta.puntos) : 0;
}

export function esCorrecta(pregunta: PreguntaExamen & { opciones: OpcionPregunta[] }, elegidas: number[]): boolean {
  const puntos = puntosAutomaticos(pregunta, elegidas);
  return puntos != null && puntos > 0;
}

type Cliente = Prisma.TransactionClient | typeof db;

/// Suma el puntaje del intento y marca si quedan abiertas por calificar.
export async function recalcularIntento(intentoId: number, cliente: Cliente = db) {
  const intento = await cliente.intentoExamen.findUniqueOrThrow({
    where: { id: intentoId },
    include: { respuestas: true, examen: { include: { preguntas: { include: { opciones: true } } } } },
  });
  const respuestas = new Map(intento.respuestas.map((r) => [r.preguntaId, r]));
  let total = 0;
  let porRevisar = false;
  for (const pregunta of intento.examen.preguntas) {
    const r = respuestas.get(pregunta.id);
    if (pregunta.tipo === "ABIERTA") {
      if (r?.texto?.trim() && r.puntos == null) porRevisar = true;
      total += r?.puntos != null ? Number(r.puntos) : 0;
    } else {
      total += r?.puntos != null ? Number(r.puntos) : 0;
    }
  }
  await cliente.intentoExamen.update({ where: { id: intentoId }, data: { puntaje: Math.round(total * 100) / 100, porRevisar } });
}

/// Envia el intento: califica las cerradas y suma.
export async function finalizarIntento(intentoId: number, enviadoEn: Date) {
  await db.$transaction(async (tx) => {
    const intento = await tx.intentoExamen.findUniqueOrThrow({
      where: { id: intentoId },
      include: { respuestas: true, examen: { include: { preguntas: { include: { opciones: true } } } } },
    });
    if (intento.enviadoEn) return;
    const respuestas = new Map(intento.respuestas.map((r) => [r.preguntaId, r]));
    for (const pregunta of intento.examen.preguntas) {
      if (pregunta.tipo === "ABIERTA") continue;
      const r = respuestas.get(pregunta.id);
      const puntos = puntosAutomaticos(pregunta, r?.opciones ?? []) ?? 0;
      await tx.respuestaExamen.upsert({
        where: { intentoId_preguntaId: { intentoId, preguntaId: pregunta.id } },
        create: { intentoId, preguntaId: pregunta.id, opciones: [], puntos },
        update: { puntos },
      });
    }
    // Las abiertas en blanco valen 0 sin que el docente tenga que revisarlas.
    for (const pregunta of intento.examen.preguntas.filter((p) => p.tipo === "ABIERTA")) {
      const r = respuestas.get(pregunta.id);
      if (!r?.texto?.trim()) {
        await tx.respuestaExamen.upsert({
          where: { intentoId_preguntaId: { intentoId, preguntaId: pregunta.id } },
          create: { intentoId, preguntaId: pregunta.id, opciones: [], puntos: 0 },
          update: { puntos: 0 },
        });
      }
    }
    await tx.intentoExamen.update({
      where: { id: intentoId },
      data: { enviadoEn, tarde: enviadoEn > intento.examen.cierraEn },
    });
    await recalcularIntento(intentoId, tx);
  });
}

/// Los intentos cuyo tiempo ya se acabo y nadie envio, se envian solos con
/// lo que tengan guardado (por ejemplo, si el alumno cerro el navegador).
export async function enviarVencidos(filtro: Prisma.IntentoExamenWhereInput) {
  const limite = new Date(Date.now() - GRACIA_MS);
  const vencidos = await db.intentoExamen.findMany({
    where: { ...filtro, enviadoEn: null, venceEn: { lt: limite } },
    select: { id: true, venceEn: true },
  });
  for (const v of vencidos) await finalizarIntento(v.id, v.venceEn!);
}

export function puntosTotales(preguntas: { puntos: Prisma.Decimal | number }[]): number {
  return Math.round(preguntas.reduce((s, p) => s + Number(p.puntos), 0) * 100) / 100;
}
