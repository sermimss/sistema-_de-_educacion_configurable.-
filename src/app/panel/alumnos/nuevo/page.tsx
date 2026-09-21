import Link from "next/link";
import { requerirRol } from "@/lib/auth";
import { catalogosEscolares } from "@/lib/catalogos";
import { configBool } from "@/lib/configuracion";
import { Alerta } from "@/components/ui";
import FormularioAlumno from "../FormularioAlumno";

export const dynamic = "force-dynamic";

export default async function PaginaNuevoAlumno() {
  await requerirRol("ADMIN");
  const catalogos = await catalogosEscolares();
  const exigeCurp = await configBool("expediente.exige_curp", false);
  const muestraMedicos = await configBool("expediente.campos_medicos_visibles", true);

  if (catalogos.planes.length === 0) {
    return (
      <Alerta tipo="aviso">
        Antes de dar de alta alumnos necesitas al menos un plan de estudios activo.
      </Alerta>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <Link href="/panel/alumnos" className="text-sm text-marca-600 hover:underline">
          ← Alumnos
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-slate-900">Nuevo alumno</h1>
      </header>
      <FormularioAlumno
        catalogos={catalogos}
        exigeCurp={exigeCurp}
        muestraMedicos={muestraMedicos}
      />
    </div>
  );
}
