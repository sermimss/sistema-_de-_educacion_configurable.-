import Link from "next/link";
import { requerirRol } from "@/lib/auth";
import { configBool } from "@/lib/configuracion";
import FormularioEmpleado from "../FormularioEmpleado";

export const dynamic = "force-dynamic";

export default async function PaginaNuevoEmpleado() {
  await requerirRol("ADMIN");
  const nominaActiva = await configBool("nomina.activa", true);

  return (
    <div className="space-y-6">
      <header>
        <Link href="/panel/personal" className="text-sm text-marca-600 hover:underline">
          ← Personal
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-slate-900">Nuevo registro de personal</h1>
      </header>
      <FormularioEmpleado nominaActiva={nominaActiva} />
    </div>
  );
}
