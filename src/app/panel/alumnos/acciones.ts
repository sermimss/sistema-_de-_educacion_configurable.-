"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requerirRol } from "@/lib/auth";
import { db } from "@/lib/db";
import { registrarBitacora } from "@/lib/bitacora";
import { hashPassword } from "@/lib/password";
import { generarMatricula } from "@/lib/matricula";
import { esquemaAlumno, esquemaTutor } from "@/lib/esquemas";

export type EstadoFormulario = {
  error?: string;
  detalles?: string[];
  ok?: boolean;
  mensaje?: string;
};

function numeroOpcional(valor: FormDataEntryValue | null): number | undefined {
  const texto = String(valor ?? "").trim();
  if (!texto) return undefined;
  const numero = Number(texto);
  return Number.isFinite(numero) && numero > 0 ? numero : undefined;
}

function textoONulo(valor: FormDataEntryValue | null): string | null {
  const texto = String(valor ?? "").trim();
  return texto ? texto : null;
}

function fechaONula(valor: FormDataEntryValue | null): Date | null {
  const texto = String(valor ?? "").trim();
  if (!texto) return null;
  const fecha = new Date(texto);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

function leerAlumno(formData: FormData) {
  return esquemaAlumno.safeParse({
    matricula: formData.get("matricula"),
    nombres: formData.get("nombres"),
    apellidoPaterno: formData.get("apellidoPaterno"),
    apellidoMaterno: formData.get("apellidoMaterno"),
    curp: formData.get("curp"),
    fechaNacimiento: formData.get("fechaNacimiento"),
    sexo: formData.get("sexo"),
    email: formData.get("email"),
    telefono: formData.get("telefono"),
    direccion: formData.get("direccion"),
    ciudad: formData.get("ciudad"),
    codigoPostal: formData.get("codigoPostal"),
    planId: formData.get("planId"),
    plantelId: numeroOpcional(formData.get("plantelId")),
    turnoId: numeroOpcional(formData.get("turnoId")),
    estado: formData.get("estado") || "ACTIVO",
    tipoSangre: formData.get("tipoSangre"),
    alergias: formData.get("alergias"),
    padecimientos: formData.get("padecimientos"),
    rfcFacturacion: formData.get("rfcFacturacion"),
    crearUsuario: formData.get("crearUsuario") === "on",
  });
}

export async function crearAlumno(
  _previo: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const sesion = await requerirRol("ADMIN");
  const validacion = leerAlumno(formData);
  if (!validacion.success) {
    return {
      error: "Revisa los datos del alumno.",
      detalles: validacion.error.issues.map((i) => i.message),
    };
  }
  const d = validacion.data;

  let idCreado: number;
  try {
    const plan = await db.planEstudios.findUnique({
      where: { id: d.planId },
      include: { nivel: true },
    });
    if (!plan) return { error: "El plan de estudios seleccionado no existe." };

    const matricula =
      d.matricula?.trim() || (await generarMatricula({ nivel: plan.nivel.clave, plan: plan.clave }));

    const repetida = await db.alumno.findUnique({ where: { matricula } });
    if (repetida) return { error: `La matricula ${matricula} ya esta en uso.` };

    const alumno = await db.$transaction(async (tx) => {
      const creado = await tx.alumno.create({
        data: {
          matricula,
          nombres: d.nombres,
          apellidoPaterno: d.apellidoPaterno,
          apellidoMaterno: textoONulo(formData.get("apellidoMaterno")),
          curp: textoONulo(formData.get("curp"))?.toUpperCase() ?? null,
          fechaNacimiento: fechaONula(formData.get("fechaNacimiento")),
          sexo: textoONulo(formData.get("sexo")),
          email: textoONulo(formData.get("email")),
          telefono: textoONulo(formData.get("telefono")),
          direccion: textoONulo(formData.get("direccion")),
          ciudad: textoONulo(formData.get("ciudad")),
          codigoPostal: textoONulo(formData.get("codigoPostal")),
          planId: d.planId,
          plantelId: d.plantelId ?? null,
          turnoId: d.turnoId ?? null,
          estado: d.estado,
          tipoSangre: textoONulo(formData.get("tipoSangre")),
          alergias: textoONulo(formData.get("alergias")),
          padecimientos: textoONulo(formData.get("padecimientos")),
          rfcFacturacion: textoONulo(formData.get("rfcFacturacion"))?.toUpperCase() ?? null,
        },
      });

      // La cuenta del alumno nace con la matricula como contrasena temporal
      // y obligado a cambiarla en el primer acceso.
      if (d.crearUsuario) {
        const usuario = await tx.usuario.create({
          data: {
            usuario: matricula.toLowerCase(),
            email: textoONulo(formData.get("email"))?.toLowerCase() ?? null,
            passwordHash: await hashPassword(matricula),
            rol: "ALUMNO",
            debeCambiarPassword: true,
          },
        });
        await tx.alumno.update({ where: { id: creado.id }, data: { usuarioId: usuario.id } });
      }

      return creado;
    });

    await registrarBitacora({
      usuarioId: sesion.usuarioId,
      accion: "CREAR",
      entidad: "Alumno",
      entidadId: alumno.id,
      descripcion: `Alta de ${alumno.nombres} ${alumno.apellidoPaterno} (${alumno.matricula})`,
    });
    idCreado = alumno.id;
  } catch (error) {
    console.error("[alumnos] crear:", error);
    const mensaje = error instanceof Error ? error.message : "Error desconocido.";
    return {
      error: mensaje.includes("Unique constraint")
        ? "Ya existe un alumno o un usuario con esa matricula o correo."
        : `No se pudo crear el alumno: ${mensaje}`,
    };
  }

  revalidatePath("/panel/alumnos");
  redirect(`/panel/alumnos/${idCreado}?creado=1`);
}

export async function actualizarAlumno(
  _previo: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const sesion = await requerirRol("ADMIN");
  const id = Number(formData.get("id"));
  if (!id) return { error: "Alumno no identificado." };

  const validacion = leerAlumno(formData);
  if (!validacion.success) {
    return {
      error: "Revisa los datos del alumno.",
      detalles: validacion.error.issues.map((i) => i.message),
    };
  }
  const d = validacion.data;

  try {
    const antes = await db.alumno.findUnique({ where: { id } });
    if (!antes) return { error: "El alumno no existe." };

    const matricula = d.matricula?.trim() || antes.matricula;
    if (matricula !== antes.matricula) {
      const repetida = await db.alumno.findUnique({ where: { matricula } });
      if (repetida) return { error: `La matricula ${matricula} ya esta en uso.` };
    }

    const despues = await db.alumno.update({
      where: { id },
      data: {
        matricula,
        nombres: d.nombres,
        apellidoPaterno: d.apellidoPaterno,
        apellidoMaterno: textoONulo(formData.get("apellidoMaterno")),
        curp: textoONulo(formData.get("curp"))?.toUpperCase() ?? null,
        fechaNacimiento: fechaONula(formData.get("fechaNacimiento")),
        sexo: textoONulo(formData.get("sexo")),
        email: textoONulo(formData.get("email")),
        telefono: textoONulo(formData.get("telefono")),
        direccion: textoONulo(formData.get("direccion")),
        ciudad: textoONulo(formData.get("ciudad")),
        codigoPostal: textoONulo(formData.get("codigoPostal")),
        planId: d.planId,
        plantelId: d.plantelId ?? null,
        turnoId: d.turnoId ?? null,
        estado: d.estado,
        fechaBaja:
          d.estado === "BAJA_DEFINITIVA" || d.estado === "BAJA_TEMPORAL"
            ? (antes.fechaBaja ?? new Date())
            : null,
        tipoSangre: textoONulo(formData.get("tipoSangre")),
        alergias: textoONulo(formData.get("alergias")),
        padecimientos: textoONulo(formData.get("padecimientos")),
        rfcFacturacion: textoONulo(formData.get("rfcFacturacion"))?.toUpperCase() ?? null,
      },
    });

    await registrarBitacora({
      usuarioId: sesion.usuarioId,
      accion: "ACTUALIZAR",
      entidad: "Alumno",
      entidadId: id,
      datosAntes: { matricula: antes.matricula, estado: antes.estado, planId: antes.planId },
      datosDespues: { matricula: despues.matricula, estado: despues.estado, planId: despues.planId },
    });

    revalidatePath(`/panel/alumnos/${id}`);
    revalidatePath("/panel/alumnos");
    return { ok: true, mensaje: "Alumno actualizado." };
  } catch (error) {
    console.error("[alumnos] actualizar:", error);
    return { error: error instanceof Error ? error.message : "No se pudo actualizar." };
  }
}

export async function agregarTutor(
  _previo: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const sesion = await requerirRol("ADMIN");
  const alumnoId = Number(formData.get("alumnoId"));
  if (!alumnoId) return { error: "Alumno no identificado." };

  const validacion = esquemaTutor.safeParse({
    nombre: formData.get("nombre"),
    parentesco: formData.get("parentesco"),
    telefono: formData.get("telefono"),
    email: formData.get("email"),
    esResponsableFinanciero: formData.get("esResponsableFinanciero") === "on",
    esContactoEmergencia: formData.get("esContactoEmergencia") === "on",
  });
  if (!validacion.success) {
    return { error: validacion.error.issues.map((i) => i.message).join(" ") };
  }
  const d = validacion.data;

  await db.tutor.create({
    data: {
      alumnoId,
      nombre: d.nombre,
      parentesco: textoONulo(formData.get("parentesco")),
      telefono: textoONulo(formData.get("telefono")),
      email: textoONulo(formData.get("email")),
      esResponsableFinanciero: Boolean(d.esResponsableFinanciero),
      esContactoEmergencia: Boolean(d.esContactoEmergencia),
    },
  });

  await registrarBitacora({
    usuarioId: sesion.usuarioId,
    accion: "CREAR",
    entidad: "Tutor",
    entidadId: alumnoId,
    descripcion: `Tutor ${d.nombre} agregado al alumno ${alumnoId}`,
  });

  revalidatePath(`/panel/alumnos/${alumnoId}`);
  return { ok: true, mensaje: "Tutor agregado." };
}

export async function eliminarTutor(formData: FormData) {
  const sesion = await requerirRol("ADMIN");
  const id = Number(formData.get("tutorId"));
  const alumnoId = Number(formData.get("alumnoId"));
  if (!id) return;

  const tutor = await db.tutor.findUnique({ where: { id } });
  await db.tutor.delete({ where: { id } });
  await registrarBitacora({
    usuarioId: sesion.usuarioId,
    accion: "ELIMINAR",
    entidad: "Tutor",
    entidadId: id,
    descripcion: `Tutor ${tutor?.nombre ?? id} eliminado del alumno ${alumnoId}`,
  });
  revalidatePath(`/panel/alumnos/${alumnoId}`);
}

export async function reiniciarPasswordAlumno(formData: FormData) {
  const sesion = await requerirRol("ADMIN");
  const alumnoId = Number(formData.get("alumnoId"));
  const alumno = await db.alumno.findUnique({ where: { id: alumnoId } });
  if (!alumno?.usuarioId) return;

  await db.usuario.update({
    where: { id: alumno.usuarioId },
    data: {
      passwordHash: await hashPassword(alumno.matricula),
      debeCambiarPassword: true,
      intentosFallidos: 0,
      bloqueadoHasta: null,
    },
  });
  await registrarBitacora({
    usuarioId: sesion.usuarioId,
    accion: "ACTUALIZAR",
    entidad: "Usuario",
    entidadId: alumno.usuarioId,
    descripcion: `Contrasena reiniciada para la matricula ${alumno.matricula}`,
  });
  revalidatePath(`/panel/alumnos/${alumnoId}`);
}
