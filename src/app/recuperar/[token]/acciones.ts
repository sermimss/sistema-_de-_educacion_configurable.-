"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { clienteDeEsquema } from "@/lib/clientes";
import { COOKIE_COLEGIO, dominioPlataforma, modoPlataforma } from "@/lib/modo";
import { validarFortaleza } from "@/lib/password";
import { buscarEnlaceRecuperacion, gastarEnlaceRecuperacion } from "@/lib/plataforma";
import { restablecerCuenta } from "@/lib/recuperacion";

export type EstadoRecuperacion = { error?: string };

/// El administrador de un colegio pone su contrasena nueva con el enlace que
/// le dio el dueno de la plataforma.
export async function accionRecuperarAdministrador(
  _p: EstadoRecuperacion,
  formData: FormData
): Promise<EstadoRecuperacion> {
  if (!modoPlataforma()) return { error: "Esta opcion no existe en esta instalacion." };
  const enlace = await buscarEnlaceRecuperacion(String(formData.get("token") ?? ""));
  if (!enlace) return { error: "El enlace ya se uso o vencio. Pide uno nuevo." };

  const password = String(formData.get("password") ?? "");
  if (password !== String(formData.get("confirmacion") ?? "")) return { error: "Las contrasenas no coinciden." };
  const debil = validarFortaleza(password);
  if (debil) return { error: debil };

  const cliente = clienteDeEsquema(enlace.colegio.esquema);
  const usuario = await cliente.usuario.findFirst({
    where: { id: Number(formData.get("usuarioId")) || 0, rol: "ADMIN", activo: true },
  });
  if (!usuario) return { error: "Elige una cuenta de administrador del colegio." };

  // Primero se gasta el enlace: si dos personas lo usan a la vez, solo una pasa.
  if (!(await gastarEnlaceRecuperacion(enlace.id))) return { error: "El enlace ya se uso o vencio. Pide uno nuevo." };
  await restablecerCuenta(cliente, usuario.id, password, { temporal: false });
  await cliente.bitacora.create({
    data: {
      usuarioId: usuario.id,
      accion: "ACTUALIZAR",
      entidad: "Usuario",
      entidadId: String(usuario.id),
      descripcion: "Contrasena restablecida con un enlace de recuperacion de la plataforma",
    },
  });

  // Directo al acceso del colegio (lo mismo que hace su puerta /<direccion>,
  // que una accion no puede recorrer).
  const direccion = enlace.colegio.direccion;
  if (!direccion) redirect("/");
  const aviso = `recuperado=${encodeURIComponent(usuario.usuario)}`;
  const dominio = dominioPlataforma();
  if (dominio) redirect(`https://${direccion}.${dominio}/acceso?${aviso}`);
  (await cookies()).set(COOKIE_COLEGIO, direccion, {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 365 * 24 * 3600,
  });
  redirect(`/acceso?${aviso}`);
}
