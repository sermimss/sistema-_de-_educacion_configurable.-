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
  const items = navegacionPara(sesion.rol);

  const grupos = items.reduce<Record<string, ItemNavegacion[]>>((acumulado, item) => {
    (acumulado[item.grupo] ??= []).push(item);
    return acumulado;
  }, {});

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white lg:block">
        <div className="flex h-16 items-center gap-3 border-b border-slate-200 px-5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-marca-600 text-sm font-bold text-white">
            {(institucion?.nombreCorto ?? institucion?.nombre ?? "?").charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">
              {institucion?.nombreCorto || institucion?.nombre}
            </p>
            <p className="text-xs text-slate-500">{ETIQUETA_ROL[sesion.rol]}</p>
          </div>
        </div>
        <nav className="space-y-4 p-3">
          {Object.entries(grupos).map(([grupo, lista]) => (
            <div key={grupo}>
              {ETIQUETA_GRUPO[grupo as ItemNavegacion["grupo"]] && (
                <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  {ETIQUETA_GRUPO[grupo as ItemNavegacion["grupo"]]}
                </p>
              )}
              <div className="space-y-0.5">
                {lista.map((item) =>
                  estaDisponible(item) ? (
                    <Link
                      key={item.ruta}
                      href={item.ruta}
                      className="block rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                    >
                      {item.etiqueta}
                    </Link>
                  ) : (
                    <span
                      key={item.ruta}
                      className="flex cursor-not-allowed items-center justify-between rounded-lg px-3 py-2 text-sm text-slate-400"
                      title="Modulo programado para una fase posterior"
                    >
                      {item.etiqueta}
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                        Fase {item.fase}
                      </span>
                    </span>
                  )
                )}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-5">
          <div className="lg:hidden">
            <p className="text-sm font-semibold text-slate-900">
              {institucion?.nombreCorto || institucion?.nombre}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-4">
            <Link
              href={RUTA_CAMBIO}
              className="text-sm text-slate-600 hover:text-marca-600"
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
        <main className="flex-1 p-5 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
