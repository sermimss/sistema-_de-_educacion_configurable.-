import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { sesionActual } from "@/lib/auth";
import { sistemaInstalado } from "@/lib/institucion";
import { COOKIE_COLEGIO, colegioDelHost, direccionValida, modoPlataforma } from "@/lib/modo";
import { colegioPorDireccion } from "@/lib/plataforma";
import { Bienvenida } from "./entrada/Bienvenida";

export const dynamic = "force-dynamic";

export default async function Inicio() {
  if (!modoPlataforma()) {
    if (!(await sistemaInstalado())) redirect("/instalacion");
    const sesion = await sesionActual();
    redirect(sesion ? "/panel" : "/acceso");
  }

  // Plataforma: con sesion abierta se entra directo a su colegio; si no, la
  // pregunta de siempre.
  if (await sesionActual().catch(() => null)) redirect("/panel");
  // En vanguardia.dominio.com la entrada ya dice de que colegio se trata.
  if (colegioDelHost((await headers()).get("host"))) redirect("/acceso");

  const elegido = (await cookies()).get(COOKIE_COLEGIO)?.value ?? "";
  const colegio = direccionValida(elegido) ? await colegioPorDireccion(elegido) : null;
  return (
    <Bienvenida
      recordado={colegio?.direccion ? { direccion: colegio.direccion, nombre: colegio.nombre } : null}
    />
  );
}
