"use server";

import { redirect } from "next/navigation";
import { requerirSesion } from "@/lib/auth";
import { db } from "@/lib/db";
import { registrarBitacora } from "@/lib/bitacora";
import { configNumero } from "@/lib/configuracion";
import { hashPassword, validarFortaleza, verificarPassword } from "@/lib/password";

export type EstadoCambio = { error?: string };

export async function cambiarPassword(
  _previo: EstadoCambio,
  formData: FormData
): Promise<EstadoCambio> {
  const sesion = await requerirSesion();
  const actual = String(formData.get("actual") ?? "");
  const nueva = String(formData.get("nueva") ?? "");
  const confirmacion = String(formData.get("confirmacion") ?? "");

  if (nueva !== confirmacion) return { error: "La nueva contrasena y su confirmacion no coinciden." };

  const minimo = await configNumero("seguridad.longitud_minima_password", 8);
  const problema = validarFortaleza(nueva, minimo);
  if (problema) return { error: problema };

  const usuario = await db.usuario.findUnique({ where: { id: sesion.usuarioId } });
  if (!usuario) return { error: "No se encontro tu cuenta." };

  if (!(await verificarPassword(actual, usuario.passwordHash))) {
    return { error: "La contrasena actual no es correcta." };
  }
  if (await verificarPassword(nueva, usuario.passwordHash)) {
    return { error: "La nueva contrasena debe ser distinta de la actual." };
  }

  await db.usuario.update({
    where: { id: usuario.id },
    data: { passwordHash: await hashPassword(nueva), debeCambiarPassword: false },
  });

  await registrarBitacora({
    usuarioId: usuario.id,
    accion: "ACTUALIZAR",
    entidad: "Usuario",
    entidadId: usuario.id,
    descripcion: "Cambio de contrasena por el propio usuario",
  });

  redirect("/panel");
}
