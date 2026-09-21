import { redirect } from "next/navigation";
import { sesionActual } from "@/lib/auth";
import { sistemaInstalado } from "@/lib/institucion";

export const dynamic = "force-dynamic";

export default async function Inicio() {
  if (!(await sistemaInstalado())) redirect("/instalacion");
  const sesion = await sesionActual();
  redirect(sesion ? "/panel" : "/acceso");
}
