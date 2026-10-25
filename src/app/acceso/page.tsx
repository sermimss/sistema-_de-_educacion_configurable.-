import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { motivoColegioCerrado, sesionActual } from "@/lib/auth";
import { colegioActual } from "@/lib/colegio";
import { COOKIE_COLEGIO, modoPlataforma } from "@/lib/modo";
import { obtenerInstitucion, sistemaInstalado } from "@/lib/institucion";
import { Alerta, Tarjeta } from "@/components/ui";
import FormularioAcceso from "./FormularioAcceso";

export const dynamic = "force-dynamic";

export default async function PaginaAcceso({
  searchParams,
}: {
  searchParams: Promise<{ destino?: string; instalado?: string; aviso?: string }>;
}) {
  const params = await searchParams;

  // En la plataforma se llega aqui por la direccion de un colegio.
  let cerrado: string | null = null;
  if (modoPlataforma()) {
    const colegio = await colegioActual();
    if (!colegio) {
      const elegido = (await cookies()).get(COOKIE_COLEGIO)?.value;
      return <ColegioNoEncontrado direccion={elegido ?? null} />;
    }
    cerrado = motivoColegioCerrado(colegio.estado);
  } else if (!(await sistemaInstalado())) {
    redirect("/instalacion");
  }
  if (!cerrado && (await sesionActual())) redirect("/panel");

  const institucion = await obtenerInstitucion().catch(() => null);

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
          {cerrado ? (
            <Alerta tipo="aviso">{cerrado}</Alerta>
          ) : (
            <FormularioAcceso
              destino={params.destino ?? "/panel"}
              reciénInstalado={params.instalado === "1"}
            />
          )}
        </Tarjeta>
        {modoPlataforma() && (
          <p className="mt-4 text-center text-sm">
            <Link href="/" className="text-marca-600 hover:underline">
              ¿No es tu colegio? Volver al inicio
            </Link>
          </p>
        )}
        <p className="mt-6 text-center text-xs text-slate-400">
          Sistema de gestion escolar y financiera
        </p>
      </div>
    </main>
  );
}

function ColegioNoEncontrado({ direccion }: { direccion: string | null }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <Tarjeta titulo="No encontramos ese colegio">
          <div className="space-y-4 text-sm text-slate-600">
            <p>
              {direccion
                ? `No hay ningun colegio con la direccion "${direccion}". Revisa que este bien escrita.`
                : "Para iniciar sesion primero entra por la direccion de tu colegio."}
            </p>
            <Link href="/" className="font-medium text-marca-600 hover:underline">
              ← Volver al inicio
            </Link>
          </div>
        </Tarjeta>
      </div>
    </main>
  );
}
