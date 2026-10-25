import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { sistemaInstalado } from "@/lib/institucion";
import { colegioActual } from "@/lib/colegio";
import { dominioPlataforma, modoPlataforma } from "@/lib/modo";
import AsistenteInstalacion from "./AsistenteInstalacion";

export const dynamic = "force-dynamic";

export default async function PaginaInstalacion() {
  if (modoPlataforma()) {
    // Aqui solo se llega con un codigo de alta canjeado (lo revisa el middleware).
    const colegio = await colegioActual();
    if (!colegio) redirect("/alta");
    if (colegio.estado !== "CONFIGURANDO") {
      redirect(colegio.direccion ? `/${colegio.direccion}` : "/");
    }
    const dominio = dominioPlataforma();
    const cabeceras = await headers();
    const host = cabeceras.get("x-forwarded-host") ?? cabeceras.get("host") ?? "";
    const protocolo =
      cabeceras.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
    return (
      <AsistenteInstalacion
        plataforma={
          dominio
            ? { prefijo: "https://", sufijo: `.${dominio}` }
            : { prefijo: `${protocolo}://${host}/`, sufijo: "" }
        }
      />
    );
  }

  if (await sistemaInstalado()) redirect("/acceso");
  return <AsistenteInstalacion />;
}
