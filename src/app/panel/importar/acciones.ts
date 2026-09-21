"use server";

import { revalidatePath } from "next/cache";
import { requerirRol } from "@/lib/auth";
import { db } from "@/lib/db";
import { registrarBitacora } from "@/lib/bitacora";
import { hashPassword } from "@/lib/password";
import { generarMatricula } from "@/lib/matricula";
import { leerCsv, type FilaCsv } from "@/lib/csv";
import { COLUMNAS } from "@/lib/importacion";

export type ErrorFila = { fila: number; mensaje: string };

export type ResultadoImportacion = {
  error?: string;
  ok?: boolean;
  tipo?: string;
  total?: number;
  exitosos?: number;
  fallidos?: number;
  errores?: ErrorFila[];
};

function esVerdadero(valor: string | undefined): boolean {
  const texto = (valor ?? "").trim().toLowerCase();
  return ["1", "si", "sí", "true", "x", "yes"].includes(texto);
}

function vacioANulo(valor: string | undefined): string | null {
  const texto = (valor ?? "").trim();
  return texto ? texto : null;
}

function fechaOpcional(valor: string | undefined): Date | null {
  const texto = (valor ?? "").trim();
  if (!texto) return null;
  const fecha = new Date(texto);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

export async function importarCsv(
  _previo: ResultadoImportacion,
  formData: FormData
): Promise<ResultadoImportacion> {
  const sesion = await requerirRol("ADMIN");
  const tipo = String(formData.get("tipo") ?? "");
  const archivo = formData.get("archivo");
  const pegado = String(formData.get("contenido") ?? "").trim();

  if (!COLUMNAS[tipo]) return { error: "Tipo de importacion no reconocido." };

  let texto = pegado;
  let nombreArchivo = "texto-pegado.csv";
  if (archivo instanceof File && archivo.size > 0) {
    if (archivo.size > 5_000_000) return { error: "El archivo supera los 5 MB." };
    texto = await archivo.text();
    nombreArchivo = archivo.name;
  }
  if (!texto.trim()) return { error: "No hay datos que importar." };

  const { encabezados, filas } = leerCsv(texto);
  if (filas.length === 0) return { error: "El archivo no tiene filas de datos." };

  const faltantes = COLUMNAS[tipo].obligatorias.filter((c) => !encabezados.includes(c));
  if (faltantes.length > 0) {
    return {
      error: `Faltan columnas obligatorias: ${faltantes.join(", ")}. Descarga la plantilla para ver el formato.`,
    };
  }

  const errores: ErrorFila[] = [];
  let exitosos = 0;

  for (const [indice, fila] of filas.entries()) {
    const numeroFila = indice + 2; // +1 por el encabezado, +1 porque las hojas empiezan en 1
    try {
      if (tipo === "alumnos") await importarAlumno(fila);
      else if (tipo === "personal") await importarEmpleado(fila);
      else await importarMateria(fila);
      exitosos++;
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : "Error desconocido.";
      errores.push({
        fila: numeroFila,
        mensaje: mensaje.includes("Unique constraint")
          ? "Ya existe un registro con esa clave, matricula o correo."
          : mensaje,
      });
    }
  }

  await db.importacionCsv.create({
    data: {
      tipo,
      nombreArchivo,
      totalRegistros: filas.length,
      exitosos,
      fallidos: errores.length,
      errores: errores.length ? errores : undefined,
      usuarioId: sesion.usuarioId,
    },
  });

  await registrarBitacora({
    usuarioId: sesion.usuarioId,
    accion: "IMPORTAR",
    entidad: tipo,
    descripcion: `Importacion de ${tipo}: ${exitosos} exitosos, ${errores.length} con error`,
  });

  revalidatePath("/panel/importar");
  revalidatePath(`/panel/${tipo === "personal" ? "personal" : tipo}`);

  return {
    ok: true,
    tipo,
    total: filas.length,
    exitosos,
    fallidos: errores.length,
    errores: errores.slice(0, 50),
  };
}

async function importarAlumno(fila: FilaCsv) {
  const plan = await db.planEstudios.findUnique({ where: { clave: fila.plan_clave.toUpperCase() } });
  if (!plan) throw new Error(`No existe el plan con clave ${fila.plan_clave}.`);
  if (!fila.nombres?.trim()) throw new Error("Falta el nombre.");
  if (!fila.apellido_paterno?.trim()) throw new Error("Falta el apellido paterno.");

  const plantel = fila.plantel_clave
    ? await db.plantel.findUnique({ where: { clave: fila.plantel_clave.toUpperCase() } })
    : null;
  const turno = fila.turno ? await db.turno.findUnique({ where: { nombre: fila.turno } }) : null;

  const matricula = fila.matricula?.trim() || (await generarMatricula({ plan: plan.clave }));

  await db.$transaction(async (tx) => {
    const alumno = await tx.alumno.create({
      data: {
        matricula,
        nombres: fila.nombres.trim(),
        apellidoPaterno: fila.apellido_paterno.trim(),
        apellidoMaterno: vacioANulo(fila.apellido_materno),
        curp: vacioANulo(fila.curp)?.toUpperCase() ?? null,
        fechaNacimiento: fechaOpcional(fila.fecha_nacimiento),
        sexo: vacioANulo(fila.sexo),
        email: vacioANulo(fila.email)?.toLowerCase() ?? null,
        telefono: vacioANulo(fila.telefono),
        direccion: vacioANulo(fila.direccion),
        ciudad: vacioANulo(fila.ciudad),
        codigoPostal: vacioANulo(fila.codigo_postal),
        planId: plan.id,
        plantelId: plantel?.id ?? null,
        turnoId: turno?.id ?? null,
      },
    });

    if (fila.tutor_nombre?.trim()) {
      await tx.tutor.create({
        data: {
          alumnoId: alumno.id,
          nombre: fila.tutor_nombre.trim(),
          telefono: vacioANulo(fila.tutor_telefono),
          email: vacioANulo(fila.tutor_email),
          esResponsableFinanciero: true,
          esContactoEmergencia: true,
        },
      });
    }

    if (esVerdadero(fila.crear_usuario)) {
      const usuario = await tx.usuario.create({
        data: {
          usuario: matricula.toLowerCase(),
          email: vacioANulo(fila.email)?.toLowerCase() ?? null,
          passwordHash: await hashPassword(matricula),
          rol: "ALUMNO",
          debeCambiarPassword: true,
        },
      });
      await tx.alumno.update({ where: { id: alumno.id }, data: { usuarioId: usuario.id } });
    }
  });
}

async function importarEmpleado(fila: FilaCsv) {
  if (!fila.nombres?.trim()) throw new Error("Falta el nombre.");
  if (!fila.apellido_paterno?.trim()) throw new Error("Falta el apellido paterno.");

  const esDocente = fila.es_docente === undefined ? true : esVerdadero(fila.es_docente);
  const prefijo = esDocente ? "DOC" : "ADM";
  const existentes = await db.empleado.count({ where: { numeroEmpleado: { startsWith: prefijo } } });
  const numeroEmpleado =
    fila.numero_empleado?.trim() || `${prefijo}-${String(existentes + 1).padStart(3, "0")}`;

  const salario = Number(fila.salario_base);
  const tipoContrato = (fila.tipo_contrato ?? "").trim().toUpperCase();
  const contratosValidos = ["TIEMPO_COMPLETO", "MEDIO_TIEMPO", "POR_HORAS", "HONORARIOS", "TEMPORAL"];

  await db.$transaction(async (tx) => {
    const empleado = await tx.empleado.create({
      data: {
        numeroEmpleado,
        nombres: fila.nombres.trim(),
        apellidoPaterno: fila.apellido_paterno.trim(),
        apellidoMaterno: vacioANulo(fila.apellido_materno),
        esDocente,
        puesto: vacioANulo(fila.puesto),
        gradoAcademico: vacioANulo(fila.grado_academico),
        email: vacioANulo(fila.email)?.toLowerCase() ?? null,
        telefono: vacioANulo(fila.telefono),
        rfc: vacioANulo(fila.rfc)?.toUpperCase() ?? null,
        curp: vacioANulo(fila.curp)?.toUpperCase() ?? null,
        nss: vacioANulo(fila.nss),
        tipoContrato: contratosValidos.includes(tipoContrato)
          ? (tipoContrato as "TIEMPO_COMPLETO")
          : null,
        salarioBase: Number.isFinite(salario) && salario > 0 ? salario : null,
      },
    });

    if (esVerdadero(fila.crear_usuario)) {
      const correo = vacioANulo(fila.email)?.toLowerCase();
      if (!correo) throw new Error("Para crear la cuenta hace falta el correo.");
      const usuario = await tx.usuario.create({
        data: {
          usuario: numeroEmpleado.toLowerCase(),
          email: correo,
          passwordHash: await hashPassword(numeroEmpleado),
          rol: esDocente ? "DOCENTE" : "ADMIN",
          debeCambiarPassword: true,
        },
      });
      await tx.empleado.update({ where: { id: empleado.id }, data: { usuarioId: usuario.id } });
    }
  });
}

async function importarMateria(fila: FilaCsv) {
  if (!fila.clave?.trim()) throw new Error("Falta la clave.");
  if (!fila.nombre?.trim()) throw new Error("Falta el nombre.");

  let areaId: number | null = null;
  if (fila.area?.trim()) {
    const area = await db.area.upsert({
      where: { nombre: fila.area.trim() },
      update: {},
      create: { nombre: fila.area.trim() },
    });
    areaId = area.id;
  }

  await db.materia.create({
    data: {
      clave: fila.clave.trim().toUpperCase(),
      nombre: fila.nombre.trim(),
      descripcion: vacioANulo(fila.descripcion),
      areaId,
    },
  });
}
