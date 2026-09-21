"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requerirRol } from "@/lib/auth";
import { db } from "@/lib/db";
import { registrarBitacora } from "@/lib/bitacora";
import { configBool, configTexto } from "@/lib/configuracion";
import { esquemaClase, esquemaGrupo } from "@/lib/esquemas";

export type EstadoFormulario = {
  error?: string;
  detalles?: string[];
  ok?: boolean;
  mensaje?: string;
};

function enteroONulo(valor: FormDataEntryValue | null): number | null {
  const texto = String(valor ?? "").trim();
  if (!texto) return null;
  const numero = Number(texto);
  return Number.isInteger(numero) && numero > 0 ? numero : null;
}

export async function crearGrupo(
  _previo: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const sesion = await requerirRol("ADMIN");
  const validacion = esquemaGrupo.safeParse({
    nombre: formData.get("nombre"),
    cicloId: formData.get("cicloId"),
    planId: formData.get("planId"),
    gradoId: formData.get("gradoId"),
    plantelId: formData.get("plantelId") || undefined,
    turnoId: formData.get("turnoId") || undefined,
    aulaId: formData.get("aulaId") || undefined,
    cupoMaximo: formData.get("cupoMaximo") || undefined,
    activo: true,
  });
  if (!validacion.success) {
    return {
      error: "Revisa los datos del grupo.",
      detalles: validacion.error.issues.map((i) => i.message),
    };
  }
  const d = validacion.data;

  const grado = await db.grado.findUnique({ where: { id: d.gradoId } });
  if (!grado || grado.planId !== d.planId) {
    return { error: "El grado seleccionado no pertenece al plan de estudios elegido." };
  }

  let idCreado: number;
  try {
    const grupo = await db.grupo.create({
      data: {
        nombre: d.nombre,
        cicloId: d.cicloId,
        planId: d.planId,
        gradoId: d.gradoId,
        plantelId: enteroONulo(formData.get("plantelId")),
        turnoId: enteroONulo(formData.get("turnoId")),
        aulaId: enteroONulo(formData.get("aulaId")),
        cupoMaximo: enteroONulo(formData.get("cupoMaximo")),
      },
    });
    await registrarBitacora({
      usuarioId: sesion.usuarioId,
      accion: "CREAR",
      entidad: "Grupo",
      entidadId: grupo.id,
      descripcion: `Grupo ${grupo.nombre} creado`,
    });
    idCreado = grupo.id;
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : "Error desconocido.";
    return {
      error: mensaje.includes("Unique constraint")
        ? `Ya existe un grupo llamado ${d.nombre} en ese ciclo escolar.`
        : `No se pudo crear el grupo: ${mensaje}`,
    };
  }

  revalidatePath("/panel/grupos");
  redirect(`/panel/grupos/${idCreado}`);
}

export async function actualizarGrupo(
  _previo: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const sesion = await requerirRol("ADMIN");
  const id = Number(formData.get("id"));
  if (!id) return { error: "Grupo no identificado." };

  const nombre = String(formData.get("nombre") ?? "").trim();
  if (!nombre) return { error: "El nombre del grupo es obligatorio." };

  const inscritos = await db.inscripcion.count({ where: { grupoId: id, estado: "INSCRITO" } });
  const cupo = enteroONulo(formData.get("cupoMaximo"));
  if (cupo !== null && cupo < inscritos) {
    return { error: `El cupo no puede ser menor a los ${inscritos} alumnos ya inscritos.` };
  }

  const antes = await db.grupo.findUnique({ where: { id } });
  const despues = await db.grupo.update({
    where: { id },
    data: {
      nombre,
      plantelId: enteroONulo(formData.get("plantelId")),
      turnoId: enteroONulo(formData.get("turnoId")),
      aulaId: enteroONulo(formData.get("aulaId")),
      cupoMaximo: cupo,
      activo: formData.get("activo") === "on",
    },
  });

  await registrarBitacora({
    usuarioId: sesion.usuarioId,
    accion: "ACTUALIZAR",
    entidad: "Grupo",
    entidadId: id,
    datosAntes: { nombre: antes?.nombre, cupoMaximo: antes?.cupoMaximo, activo: antes?.activo },
    datosDespues: { nombre: despues.nombre, cupoMaximo: despues.cupoMaximo, activo: despues.activo },
  });

  revalidatePath(`/panel/grupos/${id}`);
  return { ok: true, mensaje: "Grupo actualizado." };
}

/// Abre una clase: una materia del plan impartida a este grupo por un docente.
export async function crearClase(
  _previo: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const sesion = await requerirRol("ADMIN");
  const validacion = esquemaClase.safeParse({
    grupoId: formData.get("grupoId"),
    planMateriaId: formData.get("planMateriaId"),
    docenteId: formData.get("docenteId"),
    aulaId: formData.get("aulaId") || undefined,
  });
  if (!validacion.success) {
    return { error: validacion.error.issues.map((i) => i.message).join(" ") };
  }
  const d = validacion.data;

  const [grupo, docente, planMateria] = await Promise.all([
    db.grupo.findUnique({ where: { id: d.grupoId }, include: { inscripciones: true } }),
    db.empleado.findUnique({ where: { id: d.docenteId } }),
    db.planMateria.findUnique({ where: { id: d.planMateriaId }, include: { materia: true } }),
  ]);
  if (!grupo) return { error: "El grupo no existe." };
  if (!planMateria) return { error: "La materia no existe en el plan." };
  if (planMateria.planId !== grupo.planId) {
    return { error: "Esa materia no pertenece al plan de estudios del grupo." };
  }
  if (!docente?.esDocente) {
    return { error: "El personal seleccionado no esta marcado como docente." };
  }
  if (docente.estado !== "ACTIVO") {
    return { error: `${docente.nombres} ${docente.apellidoPaterno} no esta activo.` };
  }

  const escala = await db.escalaCalificacion.findFirst({ where: { predeterminada: true } });
  const modoPredeterminado = await configTexto("asistencia.modo_predeterminado", "POR_CLASE");

  try {
    const clase = await db.$transaction(async (tx) => {
      const creada = await tx.clase.create({
        data: {
          cicloId: grupo.cicloId,
          grupoId: grupo.id,
          planMateriaId: d.planMateriaId,
          docenteId: d.docenteId,
          aulaId: enteroONulo(formData.get("aulaId")) ?? grupo.aulaId,
          escalaId: escala?.id ?? null,
          modoAsistencia: modoPredeterminado === "POR_DIA" ? "POR_DIA" : "POR_CLASE",
        },
      });

      // Los alumnos ya inscritos en el grupo quedan inscritos en la clase nueva.
      const inscritos = grupo.inscripciones.filter((i) => i.estado === "INSCRITO");
      if (inscritos.length > 0) {
        await tx.alumnoClase.createMany({
          data: inscritos.map((inscripcion) => ({
            claseId: creada.id,
            alumnoId: inscripcion.alumnoId,
            tipo: planMateria.obligatoria ? "REGULAR" : "OPTATIVA",
          })),
          skipDuplicates: true,
        });
      }

      return creada;
    });

    await registrarBitacora({
      usuarioId: sesion.usuarioId,
      accion: "CREAR",
      entidad: "Clase",
      entidadId: clase.id,
      descripcion: `${planMateria.materia.nombre} asignada a ${grupo.nombre} con ${docente.nombres} ${docente.apellidoPaterno}`,
    });

    revalidatePath(`/panel/grupos/${d.grupoId}`);
    return { ok: true, mensaje: `${planMateria.materia.nombre} asignada al grupo.` };
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : "Error desconocido.";
    return {
      error: mensaje.includes("Unique constraint")
        ? "Esa materia ya esta asignada a este grupo en este ciclo."
        : `No se pudo asignar: ${mensaje}`,
    };
  }
}

export async function cambiarDocenteClase(
  _previo: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const sesion = await requerirRol("ADMIN");
  const claseId = Number(formData.get("claseId"));
  const docenteId = Number(formData.get("docenteId"));
  const grupoId = Number(formData.get("grupoId"));
  if (!claseId || !docenteId) return { error: "Selecciona un docente." };

  const docente = await db.empleado.findUnique({ where: { id: docenteId } });
  if (!docente?.esDocente) return { error: "Ese registro no es docente." };

  const antes = await db.clase.findUnique({ where: { id: claseId }, include: { docente: true } });
  await db.clase.update({ where: { id: claseId }, data: { docenteId } });

  await registrarBitacora({
    usuarioId: sesion.usuarioId,
    accion: "ACTUALIZAR",
    entidad: "Clase",
    entidadId: claseId,
    datosAntes: { docente: antes?.docente.numeroEmpleado },
    datosDespues: { docente: docente.numeroEmpleado },
    descripcion: "Cambio de docente de la clase",
  });

  revalidatePath(`/panel/grupos/${grupoId}`);
  return { ok: true, mensaje: "Docente actualizado." };
}

export async function eliminarClase(
  _previo: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const sesion = await requerirRol("ADMIN");
  const claseId = Number(formData.get("claseId"));
  const grupoId = Number(formData.get("grupoId"));

  const clase = await db.clase.findUnique({
    where: { id: claseId },
    include: {
      planMateria: { include: { materia: true } },
      _count: { select: { calificaciones: true, sesiones: true, actividades: true } },
    },
  });
  if (!clase) return { error: "La clase ya no existe." };

  // Borrarla arrastraria calificaciones y asistencia: se impide.
  const conDatos =
    clase._count.calificaciones + clase._count.sesiones + clase._count.actividades;
  if (conDatos > 0) {
    return {
      error: `No se puede eliminar ${clase.planMateria.materia.nombre}: ya tiene calificaciones, actividades o asistencia registradas.`,
    };
  }

  await db.clase.delete({ where: { id: claseId } });
  await registrarBitacora({
    usuarioId: sesion.usuarioId,
    accion: "ELIMINAR",
    entidad: "Clase",
    entidadId: claseId,
    descripcion: `${clase.planMateria.materia.nombre} retirada del grupo ${grupoId}`,
  });

  revalidatePath(`/panel/grupos/${grupoId}`);
  return { ok: true, mensaje: "Clase eliminada." };
}

/// Inscribe un alumno al grupo y a todas las clases abiertas del grupo.
/// Si la escuela exige prerrequisitos, las materias cuyo requisito no este
/// aprobado se omiten y se reportan.
export async function inscribirAlumno(
  _previo: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const sesion = await requerirRol("ADMIN");
  const grupoId = Number(formData.get("grupoId"));
  const alumnoId = Number(formData.get("alumnoId"));
  if (!grupoId || !alumnoId) return { error: "Selecciona un alumno." };

  const [grupo, alumno, exigePrerrequisitos] = await Promise.all([
    db.grupo.findUnique({
      where: { id: grupoId },
      include: {
        clases: { include: { planMateria: { include: { materia: true, prerrequisitos: true } } } },
        _count: { select: { inscripciones: true } },
      },
    }),
    db.alumno.findUnique({
      where: { id: alumnoId },
      include: { clases: { include: { clase: true } } },
    }),
    configBool("academico.exige_prerrequisitos", true),
  ]);

  if (!grupo) return { error: "El grupo no existe." };
  if (!alumno) return { error: "El alumno no existe." };
  if (alumno.estado !== "ACTIVO") {
    return { error: `${alumno.nombres} ${alumno.apellidoPaterno} no esta activo.` };
  }
  if (alumno.planId !== grupo.planId) {
    return { error: "El alumno pertenece a otro plan de estudios." };
  }

  const inscritos = await db.inscripcion.count({ where: { grupoId, estado: "INSCRITO" } });
  if (grupo.cupoMaximo && inscritos >= grupo.cupoMaximo) {
    return { error: `El grupo esta lleno (cupo ${grupo.cupoMaximo}).` };
  }

  const yaInscrito = await db.inscripcion.findUnique({
    where: { alumnoId_cicloId: { alumnoId, cicloId: grupo.cicloId } },
  });
  if (yaInscrito && yaInscrito.estado === "INSCRITO") {
    return { error: "El alumno ya esta inscrito en un grupo de este ciclo escolar." };
  }

  // Materias que el alumno ya aprobo, para revisar prerrequisitos.
  const aprobadas = new Set(
    alumno.clases
      .filter((inscripcion) => inscripcion.estado === "APROBADA")
      .map((inscripcion) => inscripcion.clase.planMateriaId)
  );

  const omitidas: string[] = [];
  const clasesAInscribir = grupo.clases.filter((clase) => {
    if (!exigePrerrequisitos) return true;
    const faltantes = clase.planMateria.prerrequisitos.filter(
      (p) => p.obligatorio && !aprobadas.has(p.requierePlanMateriaId)
    );
    if (faltantes.length > 0) {
      omitidas.push(clase.planMateria.materia.nombre);
      return false;
    }
    return true;
  });

  await db.$transaction(async (tx) => {
    if (yaInscrito) {
      await tx.inscripcion.update({
        where: { id: yaInscrito.id },
        data: { grupoId, gradoId: grupo.gradoId, estado: "INSCRITO", fecha: new Date() },
      });
    } else {
      await tx.inscripcion.create({
        data: { alumnoId, cicloId: grupo.cicloId, grupoId, gradoId: grupo.gradoId },
      });
    }

    if (clasesAInscribir.length > 0) {
      await tx.alumnoClase.createMany({
        data: clasesAInscribir.map((clase) => ({
          claseId: clase.id,
          alumnoId,
          tipo: clase.planMateria.obligatoria ? ("REGULAR" as const) : ("OPTATIVA" as const),
        })),
        skipDuplicates: true,
      });
    }
  });

  await registrarBitacora({
    usuarioId: sesion.usuarioId,
    accion: "CREAR",
    entidad: "Inscripcion",
    entidadId: alumnoId,
    descripcion: `${alumno.matricula} inscrito en ${grupo.nombre} (${clasesAInscribir.length} materias)`,
  });

  revalidatePath(`/panel/grupos/${grupoId}`);
  revalidatePath(`/panel/alumnos/${alumnoId}`);

  return {
    ok: true,
    mensaje: `${alumno.nombres} ${alumno.apellidoPaterno} inscrito en ${clasesAInscribir.length} materia(s).`,
    detalles: omitidas.length
      ? [`Materias omitidas por prerrequisito no aprobado: ${omitidas.join(", ")}`]
      : undefined,
  };
}

export async function darDeBajaInscripcion(
  _previo: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const sesion = await requerirRol("ADMIN");
  const inscripcionId = Number(formData.get("inscripcionId"));
  const grupoId = Number(formData.get("grupoId"));

  const inscripcion = await db.inscripcion.findUnique({
    where: { id: inscripcionId },
    include: { alumno: true, grupo: { include: { clases: true } } },
  });
  if (!inscripcion) return { error: "La inscripcion ya no existe." };

  await db.$transaction(async (tx) => {
    await tx.inscripcion.update({ where: { id: inscripcionId }, data: { estado: "BAJA" } });
    await tx.alumnoClase.updateMany({
      where: {
        alumnoId: inscripcion.alumnoId,
        claseId: { in: inscripcion.grupo.clases.map((c) => c.id) },
        estado: "EN_CURSO",
      },
      data: { estado: "BAJA" },
    });
  });

  await registrarBitacora({
    usuarioId: sesion.usuarioId,
    accion: "ACTUALIZAR",
    entidad: "Inscripcion",
    entidadId: inscripcionId,
    descripcion: `Baja de ${inscripcion.alumno.matricula} del grupo ${inscripcion.grupo.nombre}`,
  });

  revalidatePath(`/panel/grupos/${grupoId}`);
  return { ok: true, mensaje: "Alumno dado de baja del grupo." };
}
