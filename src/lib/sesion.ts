import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { RolUsuario } from "@prisma/client";

export const COOKIE_SESION = "sesion_escolar";

export type DatosSesion = {
  usuarioId: number;
  usuario: string;
  rol: RolUsuario;
  nombre: string;
  jti: string;
};

function claveSecreta(): Uint8Array {
  const secreto = process.env.AUTH_SECRET;
  if (!secreto || secreto.length < 32) {
    throw new Error(
      "AUTH_SECRET no esta definido o es demasiado corto (minimo 32 caracteres). Revisa tu archivo .env"
    );
  }
  return new TextEncoder().encode(secreto);
}

export function horasSesion(): number {
  const valor = Number(process.env.SESSION_HORAS ?? 12);
  return Number.isFinite(valor) && valor > 0 ? valor : 12;
}

export async function firmarSesion(datos: DatosSesion, expiraEn: Date): Promise<string> {
  return new SignJWT({ ...datos })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiraEn.getTime() / 1000))
    .sign(claveSecreta());
}

export async function verificarSesion(token: string): Promise<DatosSesion | null> {
  try {
    const { payload } = await jwtVerify(token, claveSecreta());
    if (!payload.usuarioId || !payload.rol) return null;
    return {
      usuarioId: Number(payload.usuarioId),
      usuario: String(payload.usuario ?? ""),
      rol: payload.rol as RolUsuario,
      nombre: String(payload.nombre ?? ""),
      jti: String(payload.jti ?? ""),
    };
  } catch {
    return null;
  }
}

export async function leerCookieSesion(): Promise<DatosSesion | null> {
  const almacen = await cookies();
  const token = almacen.get(COOKIE_SESION)?.value;
  if (!token) return null;
  return verificarSesion(token);
}

export async function escribirCookieSesion(token: string, expiraEn: Date) {
  const almacen = await cookies();
  almacen.set(COOKIE_SESION, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiraEn,
  });
}

export async function borrarCookieSesion() {
  const almacen = await cookies();
  almacen.delete(COOKIE_SESION);
}
