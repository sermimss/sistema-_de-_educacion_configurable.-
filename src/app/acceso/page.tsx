import { redirect } from "next/navigation";
import { sesionActual } from "@/lib/auth";
import { obtenerInstitucion, sistemaInstalado } from "@/lib/institucion";
import { Tarjeta } from "@/components/ui";
import FormularioAcceso from "./FormularioAcceso";

export const dynamic = "force-dynamic";

export default async function PaginaAcceso({
  searchParams,
}: {
  searchParams: Promise<{ destino?: string; instalado?: string }>;
}) {
  if (!(await sistemaInstalado())) redirect("/instalacion");
  if (await sesionActual()) redirect("/panel");

  const params = await searchParams;
  const institucion = await obtenerInstitucion();

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          {institucion?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={institucion.logoUrl}
              alt={institucion.nombre}
              className="mx-auto mb-3 h-16 w-auto"
            />
          ) : (
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-marca-600 text-xl font-bold text-white">
              {(institucion?.nombreCorto ?? institucion?.nombre ?? "?").charAt(0).toUpperCase()}
            </div>
          )}
          <h1 className="text-xl font-semibold text-slate-900">{institucion?.nombre}</h1>
          {institucion?.lema && <p className="mt-1 text-sm text-slate-500">{institucion.lema}</p>}
        </div>
        <Tarjeta>
          <FormularioAcceso
            destino={params.destino ?? "/panel"}
            reciénInstalado={params.instalado === "1"}
          />
        </Tarjeta>
        <p className="mt-6 text-center text-xs text-slate-400">
          Sistema de gestion escolar y financiera
        </p>
      </div>
    </main>
  );
}
