"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cerrarSesionDueno, crearPrimerDueno, iniciarDueno, requerirDueno } from "@/lib/dueno";
import {
  cambiarEstadoColegio,
  crearCodigoAlta,
  guardarNotasColegio,
  revocarCodigo,
} from "@/lib/plataforma";

export type EstadoDueno = { error?: string; ok?: boolean; mensaje?: string; codigo?: string };

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
