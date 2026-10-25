"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { firmarDato } from "@/lib/sesion";
import {
  COOKIE_ALTA,
  COOKIE_COLEGIO,
  colegioDelHost,
  direccionValida,
  dominioPlataforma,
  modoPlataforma,
} from "@/lib/modo";
import { canjearCodigo, colegioPorDireccion, prepararEsquema } from "@/lib/plataforma";

export type EstadoEntrada = { error?: string };

/// Acepta lo que la persona tenga a la mano: "vanguardia", la direccion
/// completa que le compartieron, o vanguardia.dominio.com.
function extraerDireccion(texto: string): string {
  const limpio = texto.trim().toLowerCase();
  try {
    const url = new URL(limpio.includes("://") ? limpio : `https://${limpio}`);
    const delHost = colegioDelHost(url.host);
    if (delHost) return delHost;
    const segmento = url.pathname.split("/").filter(Boolean).at(-1);
    if (segmento) return segmento;
  } catch {
    // No es una direccion: se toma tal cual.
  }
  return limpio.replace(/^\/+|\/+$/g, "");
}

export async function irAMiColegio(
  _previo: EstadoEntrada,
  formData: FormData
): Promise<EstadoEntrada> {
  if (!modoPlataforma()) redirect("/acceso");
  const direccion = extraerDireccion(String(formData.get("direccion") ?? ""));
  if (!direccionValida(direccion)) return { error: "Escribe la direccion de tu colegio." };
  const colegio = await colegioPorDireccion(direccion);
  if (!colegio) return { error: `No encontramos ningun colegio con la direccion "${direccion}".` };
  // Lo mismo que hace la puerta /<direccion>, sin pasar por ella: una accion
  // no sigue la redireccion del middleware.
  const dominio = dominioPlataforma();
  if (dominio) redirect(`https://${direccion}.${dominio}/acceso`);
  (await cookies()).set(COOKIE_COLEGIO, direccion, {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 365 * 24 * 3600,
  });
  redirect("/acceso");
}

export async function canjearCodigoAlta(
  _previo: EstadoEntrada,
  formData: FormData
): Promise<EstadoEntrada> {
  if (!modoPlataforma()) redirect("/");
  const resultado = await canjearCodigo(String(formData.get("codigo") ?? ""));
  if (!resultado.ok) return { error: resultado.error };

  // El espacio del colegio se prepara mientras se llena el asistente.
  void prepararEsquema(resultado.esquema).catch((error) =>
    console.error("[alta] no se pudo preparar el espacio:", error)
  );

  const almacen = await cookies();
  almacen.set(COOKIE_ALTA, await firmarDato({ colegioId: resultado.colegioId }, 48), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 48 * 3600,
  });
  redirect("/instalacion");
}
