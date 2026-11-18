"use server";

import { headers } from "next/headers";
import { db, hayColegio } from "@/lib/db";

export type EstadoRecuperar = { error?: string; enviado?: boolean };

/// Alguien olvido su contrasena: deja la solicitud para la administracion
/// del colegio. La respuesta es la misma exista o no el usuario, para que
/// esta pantalla no sirva para averiguar que cuentas hay.
export async function accionSolicitarAcceso(_p: EstadoRecuperar, formData: FormData): Promise<EstadoRecuperar> {
  if (!(await hayColegio())) return { error: "Primero entra por la direccion de tu colegio." };
  const identificador = String(formData.get("identificador") ?? "").trim().toLowerCase();
  if (identificador.length < 3) return { error: "Escribe tu usuario, matricula o correo." };
  const mensaje = String(formData.get("mensaje") ?? "").trim().slice(0, 300) || null;

  const usuario = await db.usuario.findFirst({
    where: { OR: [{ usuario: identificador }, { email: identificador }] },
    select: { id: true, activo: true },
  });
  if (usuario?.activo) {
    const haceUnaHora = new Date(Date.now() - 3_600_000);
    const [pendiente, recientes] = await Promise.all([
      db.solicitudAcceso.findFirst({ where: { usuarioId: usuario.id, estado: "PENDIENTE" } }),
      db.solicitudAcceso.count({ where: { creadaEn: { gt: haceUnaHora } } }),
    ]);
    // Una solicitud en espera por persona basta; y un tope por hora frena a
    // quien quiera llenar la bandeja de la administracion.
    if (!pendiente && recientes < 50) {
      const cabeceras = await headers();
      await db.solicitudAcceso.create({
        data: {
          usuarioId: usuario.id,
          mensaje,
          ip: cabeceras.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
        },
      });
    }
  }
  return { enviado: true };
}
