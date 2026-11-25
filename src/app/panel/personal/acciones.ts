"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requerirRol } from "@/lib/auth";
import { db } from "@/lib/db";
import { registrarBitacora } from "@/lib/bitacora";
import { hashPassword } from "@/lib/password";
import { esquemaEmpleado } from "@/lib/esquemas";

export type EstadoFormulario = {
  error?: string;
  detalles?: string[];
  ok?: boolean;
  mensaje?: string;
};

function textoONulo(valor: FormDataEntryValue | null): string | null {
  const texto = String(valor ?? "").trim();
  return texto ? texto : null;
}

function decimalONulo(valor: FormDataEntryValue | null): number | null {
  const texto = String(valor ?? "").trim();
  if (!texto) return null;
  const numero = Number(texto);
  return Number.isFinite(numero) && numero >= 0 ? numero : null;
}

/// Numero de empleado consecutivo: DOC-001 para docentes, ADM-001 para el resto.
async function generarNumeroEmpleado(esDocente: boolean): Promise<string> {
  const prefijo = esDocente ? "DOC" : "ADM";
  const existentes = await db.empleado.count({ where: { numeroEmpleado: { startsWith: prefijo } } });
  for (let intento = 1; intento <= 500; intento++) {
    const candidato = `${prefijo}-${String(existentes + intento).padStart(3, "0")}`;
    const repetido = await db.empleado.findUnique({ where: { numeroEmpleado: candidato } });
    if (!repetido) return candidato;
  }
  return `${prefijo}-${Date.now().toString().slice(-6)}`;
}

function leerEmpleado(formData: FormData) {
  return esquemaEmpleado.safeParse({
    numeroEmpleado: formData.get("numeroEmpleado"),
    nombres: formData.get("nombres"),
    apellidoPaterno: formData.get("apellidoPaterno"),
    apellidoMaterno: formData.get("apellidoMaterno"),
    esDocente: formData.get("esDocente") === "on",
    puesto: formData.get("puesto"),
    gradoAcademico: formData.get("gradoAcademico"),
    email: formData.get("email"),
    telefono: formData.get("telefono"),
    rfc: formData.get("rfc"),
    curp: formData.get("curp"),
    nss: formData.get("nss"),
    tipoContrato: formData.get("tipoContrato") || undefined,
    salarioBase: formData.get("salarioBase") || undefined,
    pagoPorHora: formData.get("pagoPorHora") || undefined,
    banco: formData.get("banco"),
    clabe: formData.get("clabe"),
    estado: formData.get("estado") || "ACTIVO",
    crearUsuario: formData.get("crearUsuario") === "on",
  });
}

type Acceso = "DOCENTE" | "ADMIN" | "CAJERO";
const NOMBRE_ACCESO: Record<Acceso, string> = { DOCENTE: "Docente", ADMIN: "Administracion", CAJERO: "Caja" };

/// Acceso al sistema elegido en el formulario. Sin eleccion: Docente si imparte clases, si no Administracion.
function leerAcceso(formData: FormData, esDocente: boolean): { acceso?: Acceso; error?: string } {
  const valor = String(formData.get("acceso") ?? "").trim();
  if (!valor) return { acceso: esDocente ? "DOCENTE" : "ADMIN" };
  if (valor !== "DOCENTE" && valor !== "ADMIN" && valor !== "CAJERO") return { error: "Acceso al sistema no valido." };
  if (valor === "DOCENTE" && !esDocente) {
    return { error: "Para darle acceso de Docente marca \"Imparte clases\"." };
  }
  return { acceso: valor };
}

function datosComunes(formData: FormData, esDocente: boolean) {
  const tipoContrato = String(formData.get("tipoContrato") ?? "").trim();
  return {
    nombres: String(formData.get("nombres") ?? "").trim(),
    apellidoPaterno: String(formData.get("apellidoPaterno") ?? "").trim(),
    apellidoMaterno: textoONulo(formData.get("apellidoMaterno")),
    esDocente,
    puesto: textoONulo(formData.get("puesto")),
    gradoAcademico: textoONulo(formData.get("gradoAcademico")),
    email: textoONulo(formData.get("email"))?.toLowerCase() ?? null,
    telefono: textoONulo(formData.get("telefono")),
    rfc: textoONulo(formData.get("rfc"))?.toUpperCase() ?? null,
    curp: textoONulo(formData.get("curp"))?.toUpperCase() ?? null,
    nss: textoONulo(formData.get("nss")),
    tipoContrato: (tipoContrato || null) as
      | "TIEMPO_COMPLETO"
      | "MEDIO_TIEMPO"
      | "POR_HORAS"
      | "HONORARIOS"
      | "TEMPORAL"
      | null,
    salarioBase: decimalONulo(formData.get("salarioBase")),
    pagoPorHora: decimalONulo(formData.get("pagoPorHora")),
    banco: textoONulo(formData.get("banco")),
    clabe: textoONulo(formData.get("clabe")),
    estado: String(formData.get("estado") ?? "ACTIVO") as
      | "ACTIVO"
      | "LICENCIA"
      | "SUSPENDIDO"
      | "BAJA",
  };
}

export async function crearEmpleado(
  _previo: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const sesion = await requerirRol("ADMIN");
  const validacion = leerEmpleado(formData);
  if (!validacion.success) {
    return {
      error: "Revisa los datos del personal.",
      detalles: validacion.error.issues.map((i) => i.message),
    };
  }
  const d = validacion.data;
  const esDocente = Boolean(d.esDocente);
  const crearUsuario = Boolean(d.crearUsuario);
  const { acceso, error: errorAcceso } = leerAcceso(formData, esDocente);
  if (errorAcceso || !acceso) return { error: errorAcceso ?? "Acceso al sistema no valido." };
  const correo = String(formData.get("email") ?? "").trim().toLowerCase();

  if (crearUsuario && !correo) {
    return { error: "Para crear la cuenta de acceso hace falta un correo electronico." };
  }

  let idCreado: number;
  try {
    const numeroEmpleado =
      String(formData.get("numeroEmpleado") ?? "").trim() || (await generarNumeroEmpleado(esDocente));

    const repetido = await db.empleado.findUnique({ where: { numeroEmpleado } });
    if (repetido) return { error: `El numero de empleado ${numeroEmpleado} ya esta en uso.` };

    const empleado = await db.$transaction(async (tx) => {
      const creado = await tx.empleado.create({
        data: { numeroEmpleado, ...datosComunes(formData, esDocente) },
      });

      if (crearUsuario) {
        const usuario = await tx.usuario.create({
          data: {
            usuario: numeroEmpleado.toLowerCase(),
            email: correo,
            // Contrasena temporal = numero de empleado, con cambio obligatorio.
            passwordHash: await hashPassword(numeroEmpleado),
            rol: acceso,
            debeCambiarPassword: true,
          },
        });
        await tx.empleado.update({ where: { id: creado.id }, data: { usuarioId: usuario.id } });
      }

      return creado;
    });

    await registrarBitacora({
      usuarioId: sesion.usuarioId,
      accion: "CREAR",
      entidad: "Empleado",
      entidadId: empleado.id,
      descripcion: `Alta de ${empleado.nombres} ${empleado.apellidoPaterno} (${empleado.numeroEmpleado})`,
    });
    idCreado = empleado.id;
  } catch (error) {
    console.error("[personal] crear:", error);
    const mensaje = error instanceof Error ? error.message : "Error desconocido.";
    return {
      error: mensaje.includes("Unique constraint")
        ? "Ya existe personal o un usuario con ese numero de empleado o correo."
        : `No se pudo crear el registro: ${mensaje}`,
    };
  }

  revalidatePath("/panel/personal");
  redirect(`/panel/personal/${idCreado}?creado=1`);
}

export async function actualizarEmpleado(
  _previo: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const sesion = await requerirRol("ADMIN");
  const id = Number(formData.get("id"));
  if (!id) return { error: "Registro no identificado." };

  const validacion = leerEmpleado(formData);
  if (!validacion.success) {
    return {
      error: "Revisa los datos del personal.",
      detalles: validacion.error.issues.map((i) => i.message),
    };
  }

  try {
    const antes = await db.empleado.findUnique({ where: { id }, include: { clases: true } });
    if (!antes) return { error: "El registro no existe." };

    const esDocente = formData.get("esDocente") === "on";
    if (!esDocente && antes.esDocente && antes.clases.length > 0) {
      return {
        error: `No se puede quitar el perfil docente: tiene ${antes.clases.length} clase(s) asignada(s).`,
      };
    }

    // Cambio de acceso al sistema (Docente, Administracion o Caja) de su cuenta.
    let cambioAcceso: { de: string; a: Acceso } | null = null;
    if (antes.usuarioId && formData.get("acceso")) {
      const { acceso, error: errorAcceso } = leerAcceso(formData, esDocente);
      if (errorAcceso || !acceso) return { error: errorAcceso ?? "Acceso al sistema no valido." };
      const usuario = await db.usuario.findUnique({ where: { id: antes.usuarioId }, select: { rol: true } });
      if (usuario && usuario.rol !== acceso) {
        if (antes.usuarioId === sesion.usuarioId) {
          return { error: "No puedes cambiar tu propio acceso al sistema; pidelo a otro administrador." };
        }
        if (usuario.rol !== "DOCENTE" && usuario.rol !== "ADMIN" && usuario.rol !== "CAJERO") {
          return { error: "Esa cuenta no es de personal." };
        }
        cambioAcceso = { de: usuario.rol, a: acceso };
      }
    }

    const despues = await db.$transaction(async (tx) => {
      const actualizado = await tx.empleado.update({
        where: { id },
        data: {
          ...datosComunes(formData, esDocente),
          fechaBaja: formData.get("estado") === "BAJA" ? (antes.fechaBaja ?? new Date()) : null,
        },
      });
      if (cambioAcceso && antes.usuarioId) {
        await tx.usuario.update({ where: { id: antes.usuarioId }, data: { rol: cambioAcceso.a } });
        // Con el acceso nuevo debe volver a entrar.
        await tx.sesion.updateMany({ where: { usuarioId: antes.usuarioId, revocada: false }, data: { revocada: true } });
      }
      return actualizado;
    });

    if (cambioAcceso && antes.usuarioId) {
      await registrarBitacora({
        usuarioId: sesion.usuarioId,
        accion: "ACTUALIZAR",
        entidad: "Usuario",
        entidadId: antes.usuarioId,
        descripcion: `Acceso de ${antes.numeroEmpleado} cambiado a ${NOMBRE_ACCESO[cambioAcceso.a]}`,
        datosAntes: { rol: cambioAcceso.de },
        datosDespues: { rol: cambioAcceso.a },
      });
    }

    await registrarBitacora({
      usuarioId: sesion.usuarioId,
      accion: "ACTUALIZAR",
      entidad: "Empleado",
      entidadId: id,
      datosAntes: { estado: antes.estado, esDocente: antes.esDocente, puesto: antes.puesto },
      datosDespues: { estado: despues.estado, esDocente: despues.esDocente, puesto: despues.puesto },
    });

    revalidatePath(`/panel/personal/${id}`);
    revalidatePath("/panel/personal");
    return {
      ok: true,
      mensaje: cambioAcceso
        ? `Registro actualizado. Su acceso ahora es ${NOMBRE_ACCESO[cambioAcceso.a]}; tendra que volver a iniciar sesion.`
        : "Registro actualizado.",
    };
  } catch (error) {
    console.error("[personal] actualizar:", error);
    return { error: error instanceof Error ? error.message : "No se pudo actualizar." };
  }
}

export async function reiniciarPasswordEmpleado(formData: FormData) {
  const sesion = await requerirRol("ADMIN");
  const empleadoId = Number(formData.get("empleadoId"));
  const empleado = await db.empleado.findUnique({ where: { id: empleadoId } });
  if (!empleado?.usuarioId) return;

  await db.usuario.update({
    where: { id: empleado.usuarioId },
    data: {
      passwordHash: await hashPassword(empleado.numeroEmpleado),
      debeCambiarPassword: true,
      intentosFallidos: 0,
      bloqueadoHasta: null,
    },
  });
  await registrarBitacora({
    usuarioId: sesion.usuarioId,
    accion: "ACTUALIZAR",
    entidad: "Usuario",
    entidadId: empleado.usuarioId,
    descripcion: `Contrasena reiniciada para ${empleado.numeroEmpleado}`,
  });
  revalidatePath(`/panel/personal/${empleadoId}`);
}
