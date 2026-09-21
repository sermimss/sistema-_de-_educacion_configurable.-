"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { iniciarSesion, cerrarSesion } from "@/lib/auth";

export type EstadoAcceso = { error?: string };

export async function accionAcceder(
  _previo: EstadoAcceso,
  formData: FormData
): Promise<EstadoAcceso> {
  const identificador = String(formData.get("identificador") ?? "");
  const password = String(formData.get("password") ?? "");
  const destino = String(formData.get("destino") ?? "/panel");

  if (!identificador || !password) {
    return { error: "Escribe tu usuario y contrasena." };
  }

  const cabeceras = await headers();
  const resultado = await iniciarSesion(identificador, password, {
    ip: cabeceras.get("x-forwarded-for") ?? undefined,
    userAgent: cabeceras.get("user-agent") ?? undefined,
  });

  if (!resultado.ok) return { error: resultado.error };
  redirect(destino.startsWith("/") ? destino : "/panel");
}

export async function accionSalir() {
  await cerrarSesion();
  redirect("/acceso");
}
