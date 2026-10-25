import { cache } from "react";
import { headers } from "next/headers";
import { CABECERA_COLEGIO, modoPlataforma } from "./modo";
import { colegioPorDireccion, colegioPorId, type ColegioPlataforma } from "./plataforma";

/// El colegio de esta solicitud. Lo decide el middleware y llega en una
/// cabecera que el middleware siempre reescribe (el navegador no puede
/// inventarla):
///
///   - en el panel, el colegio de la sesion firmada;
///   - en el asistente, el colegio del codigo de alta canjeado;
///   - en el inicio de sesion, el colegio por cuya direccion se entro.
///
/// En modo un colegio siempre es null: hay una sola base y un solo colegio.
export const colegioActual = cache(async (): Promise<ColegioPlataforma | null> => {
  if (!modoPlataforma()) return null;
  const valor = (await headers()).get(CABECERA_COLEGIO) ?? "";
  if (valor.startsWith("id:")) {
    const id = Number(valor.slice(3));
    return Number.isInteger(id) && id > 0 ? colegioPorId(id) : null;
  }
  if (valor.startsWith("direccion:")) return colegioPorDireccion(valor.slice(10));
  return null;
});

/// La direccion con la que se llega a un colegio, para mostrarla y compartirla.
export async function direccionPublica(direccion: string): Promise<string> {
  const { dominioPlataforma } = await import("./modo");
  const dominio = dominioPlataforma();
  if (dominio) return `https://${direccion}.${dominio}`;
  const cabeceras = await headers();
  const host = cabeceras.get("x-forwarded-host") ?? cabeceras.get("host") ?? "localhost";
  const protocolo = cabeceras.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${protocolo}://${host}/${direccion}`;
}
