"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cerrarSesionDueno, crearPrimerDueno, iniciarDueno, recuperarDueno, requerirDueno } from "@/lib/dueno";
import { headers } from "next/headers";
import {
  cambiarEstadoColegio,
  colegioPorId,
  crearEnlaceRecuperacion,
  crearCodigoAlta,
  guardarNotasColegio,
  revocarCodigo,
} from "@/lib/plataforma";

export type EstadoDueno = { error?: string; ok?: boolean; mensaje?: string; codigo?: string; enlace?: string };

export async function accionPrimerDueno(_p: EstadoDueno, formData: FormData): Promise<EstadoDueno> {
  const password = String(formData.get("password") ?? "");
  if (password !== String(formData.get("confirmacion") ?? "")) {
    return { error: "Las contrasenas no coinciden." };
  }
  const resultado = await crearPrimerDueno(
    String(formData.get("usuario") ?? ""),
    password,
    String(formData.get("claveArranque") ?? "")
  );
  if (!resultado.ok) return { error: resultado.error };
  redirect("/plataforma/panel");
}

export async function accionRecuperarDueno(_p: EstadoDueno, formData: FormData): Promise<EstadoDueno> {
  const password = String(formData.get("password") ?? "");
  if (password !== String(formData.get("confirmacion") ?? "")) {
    return { error: "Las contrasenas no coinciden." };
  }
  const resultado = await recuperarDueno(String(formData.get("claveArranque") ?? ""), password);
  if (!resultado.ok) return { error: resultado.error };
  redirect(`/plataforma/panel?recuperado=${encodeURIComponent(resultado.usuario)}`);
}

export async function accionEntrarDueno(_p: EstadoDueno, formData: FormData): Promise<EstadoDueno> {
  const resultado = await iniciarDueno(
    String(formData.get("usuario") ?? ""),
    String(formData.get("password") ?? "")
  );
  if (!resultado.ok) return { error: resultado.error };
  redirect("/plataforma/panel");
}

export async function accionSalirDueno() {
  await cerrarSesionDueno();
  redirect("/plataforma");
}

export async function accionCrearCodigo(_p: EstadoDueno, formData: FormData): Promise<EstadoDueno> {
  await requerirDueno();
  const etiqueta = String(formData.get("etiqueta") ?? "").trim().slice(0, 120);
  const codigo = await crearCodigoAlta(etiqueta);
  revalidatePath("/plataforma/panel");
  return { ok: true, codigo, mensaje: "Codigo creado. Copialo ahora: no se vuelve a mostrar." };
}

export async function accionRevocarCodigo(formData: FormData) {
  await requerirDueno();
  await revocarCodigo(Number(formData.get("codigoId")));
  revalidatePath("/plataforma/panel");
}

/// Pagado: abre el colegio. Suspendido: nadie de ese colegio puede entrar.
export async function accionEstadoColegio(formData: FormData) {
  await requerirDueno();
  const estado = String(formData.get("estado"));
  if (estado !== "ACTIVO" && estado !== "SUSPENDIDO") return;
  await cambiarEstadoColegio(Number(formData.get("colegioId")), estado);
  revalidatePath("/plataforma/panel");
}

export async function accionNotasColegio(formData: FormData) {
  await requerirDueno();
  await guardarNotasColegio(
    Number(formData.get("colegioId")),
    String(formData.get("notas") ?? "").trim().slice(0, 500)
  );
  revalidatePath("/plataforma/panel");
}

/// Enlace de un solo uso (una hora) para que el administrador de un colegio
/// recupere su acceso. Se muestra una sola vez; el dueno se lo envia.
export async function accionEnlaceRecuperacion(_p: EstadoDueno, formData: FormData): Promise<EstadoDueno> {
  await requerirDueno();
  const colegio = await colegioPorId(Number(formData.get("colegioId")) || 0);
  if (!colegio || colegio.estado === "CONFIGURANDO") {
    return { error: "Ese colegio aun no termina su configuracion." };
  }
  const token = await crearEnlaceRecuperacion(colegio.id);
  const cabeceras = await headers();
  const host = cabeceras.get("x-forwarded-host") ?? cabeceras.get("host") ?? "localhost";
  const protocolo = cabeceras.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return { ok: true, enlace: `${protocolo}://${host}/recuperar/${token}` };
}

