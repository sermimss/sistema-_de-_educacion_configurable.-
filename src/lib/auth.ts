import { randomUUID } from "crypto";
import { redirect } from "next/navigation";
import type { RolUsuario } from "@prisma/client";
import { db } from "./db";
import { verificarPassword } from "./password";
import {
  borrarCookieSesion,
  escribirCookieSesion,
  firmarSesion,
  horasSesion,
  leerCookieSesion,
  type DatosSesion,
} from "./sesion";
import { registrarBitacora } from "./bitacora";

const MAX_INTENTOS = 5;
const MINUTOS_BLOQUEO = 15;

export type ResultadoAcceso =
  | { ok: true; rol: RolUsuario; debeCambiarPassword: boolean }
  | { ok: false; error: string };

export async function iniciarSesion(
  identificador: string,
  password: string,
  contexto: { ip?: string; userAgent?: string } = {}
): Promise<ResultadoAcceso> {
  const clave = identificador.trim().toLowerCase();
  const usuario = await db.usuario.findFirst({
    where: { OR: [{ usuario: clave }, { email: clave }] },
    include: { alumno: true, empleado: true },
  });

  if (!usuario) {
    await registrarBitacora({
      accion: "INTENTO_FALLIDO",
      entidad: "Usuario",
      descripcion: `Intento de acceso con identificador inexistente: ${clave}`,
      ...contexto,
    });
    return { ok: false, error: "Usuario o contrasena incorrectos." };
  }

  if (!usuario.activo) return { ok: false, error: "Esta cuenta esta desactivada." };

  if (usuario.bloqueadoHasta && usuario.bloqueadoHasta > new Date()) {
    return {
      ok: false,
      error: `Cuenta bloqueada temporalmente. Intenta de nuevo despues de ${usuario.bloqueadoHasta.toLocaleTimeString("es-MX")}.`,
    };
  }

  const valida = await verificarPassword(password, usuario.passwordHash);
  if (!valida) {
    const intentos = usuario.intentosFallidos + 1;
    await db.usuario.update({
      where: { id: usuario.id },
      data: {
        intentosFallidos: intentos,
        bloqueadoHasta:
          intentos >= MAX_INTENTOS ? new Date(Date.now() + MINUTOS_BLOQUEO * 60_000) : null,
      },
    });
    await registrarBitacora({
      usuarioId: usuario.id,
      accion: "INTENTO_FALLIDO",
      entidad: "Usuario",
      entidadId: String(usuario.id),
      descripcion: `Contrasena incorrecta (intento ${intentos} de ${MAX_INTENTOS})`,
      ...contexto,
    });
    return { ok: false, error: "Usuario o contrasena incorrectos." };
  }

  const nombre = usuario.alumno
    ? `${usuario.alumno.nombres} ${usuario.alumno.apellidoPaterno}`
    : usuario.empleado
      ? `${usuario.empleado.nombres} ${usuario.empleado.apellidoPaterno}`
      : usuario.usuario;

  const jti = randomUUID();
  const expiraEn = new Date(Date.now() + horasSesion() * 3_600_000);

  await db.$transaction([
    db.usuario.update({
      where: { id: usuario.id },
      data: { intentosFallidos: 0, bloqueadoHasta: null, ultimoAcceso: new Date() },
    }),
    db.sesion.create({
      data: {
        usuarioId: usuario.id,
        token: jti,
        expiraEn,
        ip: contexto.ip,
        userAgent: contexto.userAgent,
      },
    }),
  ]);

  const token = await firmarSesion(
    { usuarioId: usuario.id, usuario: usuario.usuario, rol: usuario.rol, nombre, jti },
    expiraEn
  );
  await escribirCookieSesion(token, expiraEn);

  await registrarBitacora({
    usuarioId: usuario.id,
    accion: "INICIAR_SESION",
    entidad: "Usuario",
    entidadId: String(usuario.id),
    ...contexto,
  });

  return { ok: true, rol: usuario.rol, debeCambiarPassword: usuario.debeCambiarPassword };
}

export async function cerrarSesion() {
  const sesion = await leerCookieSesion();
  if (sesion) {
    await db.sesion.updateMany({ where: { token: sesion.jti }, data: { revocada: true } });
    await registrarBitacora({
      usuarioId: sesion.usuarioId,
      accion: "CERRAR_SESION",
      entidad: "Usuario",
      entidadId: String(sesion.usuarioId),
    });
  }
  await borrarCookieSesion();
}

/// Devuelve la sesion validada contra la base (respeta revocaciones).
export async function sesionActual(): Promise<DatosSesion | null> {
  const sesion = await leerCookieSesion();
  if (!sesion) return null;
  const registro = await db.sesion.findUnique({ where: { token: sesion.jti } });
  if (!registro || registro.revocada || registro.expiraEn < new Date()) return null;
  return sesion;
}

export async function requerirSesion(): Promise<DatosSesion> {
  const sesion = await sesionActual();
  if (!sesion) redirect("/acceso");
  return sesion;
}

export async function requerirRol(...roles: RolUsuario[]): Promise<DatosSesion> {
  const sesion = await requerirSesion();
  if (!roles.includes(sesion.rol)) redirect("/panel?error=sin-permiso");
  return sesion;
}
