import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requerirSesion } from "@/lib/auth";
import { db } from "@/lib/db";
import { obtenerInstitucion } from "@/lib/institucion";
import {
  ETIQUETA_GRUPO,
  ETIQUETA_ROL,
  estaDisponible,
  navegacionPara,
  type ItemNavegacion,
} from "@/lib/navegacion";
import { accionSalir } from "@/app/acceso/acciones";
import { urlLogo } from "@/lib/marca";
import { ListaMenu, MenuMovil, type GrupoMenu } from "./Navegacion";

function LogoColegio({ logo, nombre, chico }: { logo: string | null; nombre: string; chico?: boolean }) {
  const tamano = chico ? "h-8 w-8" : "h-10 w-10";
  return logo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={logo} alt="" className={`${tamano} shrink-0 rounded-lg bg-white object-contain p-0.5`} />
  ) : (
    <div
      className={`flex ${tamano} shrink-0 items-center justify-center rounded-lg bg-marca-600 text-sm font-bold text-marca-contraste`}
    >
      {nombre.charAt(0).toUpperCase()}
    </div>
  );
}

export const dynamic = "force-dynamic";

const RUTA_CAMBIO = "/panel/cambiar-password";

export default async function LayoutPanel({ children }: { children: React.ReactNode }) {
  const sesion = await requerirSesion();

  // Quien trae contrasena temporal no puede usar el resto del sistema.
  const ruta = (await headers()).get("x-ruta-actual") ?? "";
  const usuario = await db.usuario.findUnique({
    where: { id: sesion.usuarioId },
    select: { debeCambiarPassword: true },
  });
  if (usuario?.debeCambiarPassword && ruta !== RUTA_CAMBIO) {
    redirect(RUTA_CAMBIO);
  }

  const institucion = await obtenerInstitucion();
  const logo = await urlLogo(institucion);
  const items = navegacionPara(sesion.rol);

  const porGrupo = items.reduce<Record<string, ItemNavegacion[]>>((acumulado, item) => {
    (acumulado[item.grupo] ??= []).push(item);
    return acumulado;
  }, {});
  const grupos: GrupoMenu[] = Object.entries(porGrupo).map(([grupo, lista]) => ({
    titulo: ETIQUETA_GRUPO[grupo as ItemNavegacion["grupo"]],
    items: lista.map((item) => ({
      etiqueta: item.etiqueta,
      ruta: item.ruta,
      disponible: estaDisponible(item),
      fase: item.fase,
    })),
  }));

  const nombreColegio = institucion?.nombreCorto || institucion?.nombre || "?";
  const encabezadoMenu = (
    <div className="flex min-h-16 items-center gap-3 bg-marca-sec px-5 py-3 pr-12 text-marca-sec-contraste">
      <LogoColegio logo={logo} nombre={nombreColegio} />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{nombreColegio}</p>
        <p className="text-xs opacity-75">{ETIQUETA_ROL[sesion.rol]}</p>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen">
      <aside className="no-imprimir hidden w-64 shrink-0 border-r border-slate-200 bg-white lg:block">
        {encabezadoMenu}
        <ListaMenu grupos={grupos} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-imprimir sticky top-0 z-40 flex h-16 items-center justify-between gap-3 border-b-4 border-marca-600 bg-white px-4 sm:px-5">
          <div className="flex min-w-0 items-center gap-2 lg:hidden">
            <MenuMovil
              grupos={grupos}
              encabezado={encabezadoMenu}
              usuario={{ nombre: sesion.nombre, rutaCambio: RUTA_CAMBIO }}
            />
            <LogoColegio logo={logo} nombre={nombreColegio} chico />
            <p className="truncate text-sm font-semibold text-slate-900">{nombreColegio}</p>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-3 sm:gap-4">
            <Link
              href={RUTA_CAMBIO}
              className="hidden text-sm text-slate-600 hover:text-marca-600 sm:inline"
              title="Cambiar mi contrasena"
            >
              {sesion.nombre}
            </Link>
            <form action={accionSalir}>
              <button
                type="submit"
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                Salir
              </button>
            </form>
          </div>
        </header>
        <main className="min-w-0 flex-1 p-4 print:p-0 sm:p-5 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
