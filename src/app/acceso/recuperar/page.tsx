import Link from "next/link";
import { colegioActual } from "@/lib/colegio";
import { modoPlataforma } from "@/lib/modo";
import { obtenerInstitucion } from "@/lib/institucion";
import { Alerta, Tarjeta } from "@/components/ui";
import { FormularioRecuperar } from "./Formulario";

export const dynamic = "force-dynamic";

export default async function PaginaRecuperarAcceso() {
  const sinColegio = modoPlataforma() && !(await colegioActual());
  const institucion = sinColegio ? null : await obtenerInstitucion().catch(() => null);

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <Tarjeta
          titulo="¿Olvidaste tu contrasena?"
          descripcion={institucion ? `${institucion.nombre}` : undefined}
        >
          {sinColegio ? (
            <Alerta tipo="aviso">Primero entra por la direccion de tu colegio.</Alerta>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                Escribe tu usuario y la administracion de tu colegio te asignara una contrasena temporal.
              </p>
              <FormularioRecuperar />
            </div>
          )}
        </Tarjeta>
        <p className="mt-4 text-center text-sm">
          <Link href="/acceso" className="text-marca-600 hover:underline">← Volver a iniciar sesion</Link>
        </p>
      </div>
    </main>
  );
}
