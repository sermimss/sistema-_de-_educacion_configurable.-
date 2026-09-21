import { redirect } from "next/navigation";
import { sistemaInstalado } from "@/lib/institucion";
import AsistenteInstalacion from "./AsistenteInstalacion";

export const dynamic = "force-dynamic";

export default async function PaginaInstalacion() {
  if (await sistemaInstalado()) redirect("/acceso");
  return <AsistenteInstalacion />;
}
