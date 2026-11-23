import type { Prisma, TipoCambioHorario } from "@prisma/client";
import { db } from "./db";
import { configBool } from "./configuracion";
import { detectarChoques, esHoraValida, seTraslapan, type Choque } from "./horarios";
import { aFechaDia, diaDeLaSemana, esFechaDia, fechaCorta, semanaDe, textoDeFecha } from "./fechasDia";
import { DIAS_SEMANA } from "./formato";
import type { BloqueHorario } from "@/components/CuadroHorario";

/// Cambios de horario que pide el docente y aprueba la administracion.
///
/// - PERMANENTE: el bloque pasa a otro dia u hora de ahi en adelante.
/// - UNA_FECHA: solo la clase de una fecha se da en otra fecha u hora
///   (reposicion); las demas semanas no cambian.
///
/// El docente no puede enviar un cambio que choque con otra clase suya, del
/// grupo o del aula; al aprobar se vuelve a revisar, porque el horario pudo
/// cambiar mientras la solicitud esperaba.

export type DatosCambio = {
  tipo: TipoCambioHorario;
  nuevoDia: number | null;
  fechaOriginal: string | null;
  nuevaFecha: string | null;
  horaInicio: string;
  horaFin: string;
  aulaId: number | null;
};

export const nombreDia = (dia: number) => DIAS_SEMANA.find((d) => d.valor === dia)?.nombre ?? String(dia);

/// "Lunes 08:00-08:50" o "mie 25 nov 10:00-10:50"
export function describirCambio(c: {
  tipo: TipoCambioHorario;
  nuevoDia: number | null;
  nuevaFecha: Date | string | null;
  horaInicio: string;
  horaFin: string;
}): string {
  const rango = `${c.horaInicio}-${c.horaFin}`;
  if (c.tipo === "PERMANENTE") return `${nombreDia(c.nuevoDia ?? 0)} ${rango}`;
  const fecha = typeof c.nuevaFecha === "string" ? c.nuevaFecha : c.nuevaFecha ? textoDeFecha(c.nuevaFecha) : "";
  return `${fecha ? fechaCorta(fecha) : ""} ${rango}`;
}

/// Lee y valida lo capturado. `hoy` es "YYYY-MM-DD" en la zona del colegio.
export function leerCambio(
  formData: FormData,
  horario: { diaSemana: number; horaInicio: string; horaFin: string; aulaId: number | null },
  ciclo: { fechaInicio: Date; fechaFin: Date },
  hoy: string
): { ok: true; cambio: DatosCambio } | { ok: false; error: string } {
  const tipo = String(formData.get("tipo") ?? "");
  if (tipo !== "PERMANENTE" && tipo !== "UNA_FECHA") return { ok: false, error: "Elige si el cambio es de aqui en adelante o solo una fecha." };
  const horaInicio = String(formData.get("horaInicio") ?? "").trim();
  const horaFin = String(formData.get("horaFin") ?? "").trim();
  if (!esHoraValida(horaInicio) || !esHoraValida(horaFin)) return { ok: false, error: "Las horas deben tener el formato HH:MM." };
  if (horaFin <= horaInicio) return { ok: false, error: "La hora de fin debe ser posterior a la de inicio." };
  const aulaId = Number(formData.get("aulaId")) || null;

  if (tipo === "PERMANENTE") {
    const nuevoDia = Number(formData.get("nuevoDia"));
    if (!(nuevoDia >= 1 && nuevoDia <= 7)) return { ok: false, error: "Elige el dia nuevo." };
    if (nuevoDia === horario.diaSemana && horaInicio === horario.horaInicio && horaFin === horario.horaFin && (aulaId ?? horario.aulaId) === horario.aulaId) {
      return { ok: false, error: "Es el mismo horario que ya tiene la clase." };
    }
    return { ok: true, cambio: { tipo, nuevoDia, fechaOriginal: null, nuevaFecha: null, horaInicio, horaFin, aulaId } };
  }

  const fechaOriginal = String(formData.get("fechaOriginal") ?? "").trim();
  const nuevaFecha = String(formData.get("nuevaFecha") ?? "").trim();
  if (!esFechaDia(fechaOriginal)) return { ok: false, error: "Indica la fecha de la clase que se mueve." };
  if (!esFechaDia(nuevaFecha)) return { ok: false, error: "Indica la fecha a la que se pasa la clase." };
  if (diaDeLaSemana(fechaOriginal) !== horario.diaSemana) {
    return { ok: false, error: `Ese bloque es los ${nombreDia(horario.diaSemana).toLowerCase()}: la fecha de la clase que se mueve debe ser ${nombreDia(horario.diaSemana).toLowerCase()}.` };
  }
  if (fechaOriginal < hoy || nuevaFecha < hoy) return { ok: false, error: "No se puede mover una clase a una fecha que ya paso." };
  const inicio = textoDeFecha(ciclo.fechaInicio);
  const fin = textoDeFecha(ciclo.fechaFin);
  if (fechaOriginal < inicio || fechaOriginal > fin || nuevaFecha < inicio || nuevaFecha > fin) {
    return { ok: false, error: "Las dos fechas deben estar dentro del periodo de clases del grupo." };
  }
  if (fechaOriginal === nuevaFecha && horaInicio === horario.horaInicio && horaFin === horario.horaFin) {
    return { ok: false, error: "Es el mismo horario que ya tiene la clase ese dia." };
  }
  return { ok: true, cambio: { tipo, nuevoDia: null, fechaOriginal, nuevaFecha, horaInicio, horaFin, aulaId } };
}

type Cliente = Prisma.TransactionClient | typeof db;

/// Con que choca el cambio. Para una sola fecha se toman en cuenta los demas
/// cambios de esa fecha: los bloques que ese dia se fueron a otro lado dejan
/// su lugar libre, y los que llegan ese dia lo ocupan.
export async function choquesDelCambio(horarioId: number, c: DatosCambio, cliente: Cliente = db): Promise<string[]> {
  const horario = await cliente.horarioClase.findUniqueOrThrow({
    where: { id: horarioId },
    include: { clase: { include: { grupo: true, docente: true, planMateria: { include: { materia: true } } } } },
  });
  const aulaId = c.aulaId ?? horario.aulaId;
  const dia = c.tipo === "PERMANENTE" ? c.nuevoDia! : diaDeLaSemana(c.nuevaFecha!);
  // Su propio bloque solo deja de contar si se mueve dentro del mismo dia.
  const excluirPropio = c.tipo === "PERMANENTE" || c.fechaOriginal === c.nuevaFecha;

  let choques: Choque[] = await detectarChoques(
    { claseId: horario.claseId, diaSemana: dia, horaInicio: c.horaInicio, horaFin: c.horaFin, aulaId, horarioIdExcluido: excluirPropio ? horario.id : undefined },
    cliente
  );

  // Cambios de una fecha ya aprobados que llegan a ese dia (o, si el cambio
  // es permanente, a ese dia de la semana en adelante).
  const llegan = await cliente.cambioHorarioFecha.findMany({
    where: {
      horarioId: { not: horario.id },
      ...(c.tipo === "UNA_FECHA" ? { fechaNueva: aFechaDia(c.nuevaFecha!) } : { fechaNueva: { gte: aFechaDia(textoDeFecha(new Date())) } }),
    },
    include: { horario: { include: { clase: { include: { grupo: true, planMateria: { include: { materia: true } } } } } } },
  });

  if (c.tipo === "UNA_FECHA") {
    const seVan = new Set(
      (
        await cliente.cambioHorarioFecha.findMany({ where: { fechaOriginal: aFechaDia(c.nuevaFecha!) }, select: { horarioId: true } })
      ).map((x) => x.horarioId)
    );
    choques = choques.filter((ch) => !ch.horarioId || !seVan.has(ch.horarioId));
  }

  const [validaDocente, validaAula, validaGrupo] = await Promise.all([
    configBool("horarios.validar_choque_docente", true),
    configBool("horarios.validar_choque_aula", true),
    configBool("horarios.validar_choque_grupo", true),
  ]);
  const mensajes = choques.map((ch) => ch.mensaje);
  for (const otro of llegan) {
    if (c.tipo === "PERMANENTE" && diaDeLaSemana(textoDeFecha(otro.fechaNueva)) !== dia) continue;
    if (!seTraslapan(c.horaInicio, c.horaFin, otro.horaInicio, otro.horaFin)) continue;
    const quien = `${otro.horario.clase.planMateria.materia.nombre} (${otro.horario.clase.grupo.nombre})`;
    const cuando = `el ${fechaCorta(textoDeFecha(otro.fechaNueva))} ${otro.horaInicio}-${otro.horaFin}`;
    const aulaOtro = otro.aulaId ?? otro.horario.aulaId ?? otro.horario.clase.aulaId;
    if (validaDocente && otro.horario.clase.docenteId === horario.clase.docenteId) mensajes.push(`Ya tienes ${quien} ${cuando} (reposicion).`);
    else if (validaGrupo && otro.horario.clase.grupoId === horario.clase.grupoId) mensajes.push(`El grupo ya tiene ${quien} ${cuando} (reposicion).`);
    else if (validaAula && aulaId && aulaOtro === aulaId) mensajes.push(`El aula ya esta ocupada por ${quien} ${cuando} (reposicion).`);
  }
  return [...new Set(mensajes)];
}

/// Aplica un cambio ya aprobado.
export async function aplicarCambio(tx: Prisma.TransactionClient, horarioId: number, c: DatosCambio, solicitudId: number) {
  if (c.tipo === "PERMANENTE") {
    await tx.horarioClase.update({
      where: { id: horarioId },
      data: { diaSemana: c.nuevoDia!, horaInicio: c.horaInicio, horaFin: c.horaFin, moduloId: null, ...(c.aulaId ? { aulaId: c.aulaId } : {}) },
    });
    return;
  }
  // Si esa clase ya se habia movido, el cambio nuevo la sustituye.
  await tx.cambioHorarioFecha.upsert({
    where: { horarioId_fechaOriginal: { horarioId, fechaOriginal: aFechaDia(c.fechaOriginal!) } },
    create: { horarioId, fechaOriginal: aFechaDia(c.fechaOriginal!), fechaNueva: aFechaDia(c.nuevaFecha!), horaInicio: c.horaInicio, horaFin: c.horaFin, aulaId: c.aulaId, solicitudId },
    update: { fechaNueva: aFechaDia(c.nuevaFecha!), horaInicio: c.horaInicio, horaFin: c.horaFin, aulaId: c.aulaId, solicitudId },
  });
}

/// El horario de esta semana con los cambios de una fecha: el bloque que se
/// movio queda tachado con la nota de a donde se fue, y aparece la clase en
/// su fecha nueva.
export async function aplicarCambiosDeLaSemana(bloques: BloqueHorario[], hoy: string): Promise<BloqueHorario[]> {
  if (bloques.length === 0) return bloques;
  const { lunes, domingo } = semanaDe(hoy);
  const rango = { gte: aFechaDia(lunes), lte: aFechaDia(domingo) };
  const cambios = await db.cambioHorarioFecha.findMany({
    where: { horarioId: { in: bloques.map((b) => b.id) }, OR: [{ fechaOriginal: rango }, { fechaNueva: rango }] },
    orderBy: { fechaNueva: "asc" },
  });
  if (cambios.length === 0) return bloques;
  const resultado = bloques.map((b) => ({ ...b }));
  const aulas = new Map(
    (await db.aula.findMany({ where: { id: { in: cambios.map((c) => c.aulaId ?? 0) } } })).map((a) => [a.id, a.nombre])
  );
  for (const cambio of cambios) {
    const original = textoDeFecha(cambio.fechaOriginal);
    const nueva = textoDeFecha(cambio.fechaNueva);
    const base = bloques.find((b) => b.id === cambio.horarioId)!;
    if (original >= lunes && original <= domingo) {
      const bloque = resultado.find((b) => b.id === cambio.horarioId)!;
      bloque.movida = true;
      bloque.nota =
        original === nueva
          ? `El ${fechaCorta(nueva)} cambia a ${cambio.horaInicio}-${cambio.horaFin}`
          : `Esta semana se pasa al ${fechaCorta(nueva)}, ${cambio.horaInicio}-${cambio.horaFin}`;
    }
    if (nueva >= lunes && nueva <= domingo) {
      const aula = cambio.aulaId ? aulas.get(cambio.aulaId) : null;
      resultado.push({
        ...base,
        id: -cambio.id,
        diaSemana: diaDeLaSemana(nueva),
        horaInicio: cambio.horaInicio,
        horaFin: cambio.horaFin,
        movida: false,
        nota: `Solo el ${fechaCorta(nueva)} (${original === nueva ? `en lugar de las ${base.horaInicio}` : `en lugar del ${fechaCorta(original)}`})${aula ? `, en ${aula}` : ""}`,
      });
    }
  }
  return resultado;
}
