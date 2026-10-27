"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export type GrupoMenu = {
  titulo: string;
  items: { etiqueta: string; ruta: string; disponible: boolean; fase: number }[];
};

/// La pantalla actual: la ruta exacta o una pantalla dentro de ella
/// (/panel/documentos/machotes marca "Documentos"). "Panel" solo en /panel.
function esActual(ruta: string, actual: string) {
  return ruta === "/panel" ? actual === "/panel" : actual === ruta || actual.startsWith(`${ruta}/`);
}

export function ListaMenu({ grupos, alElegir }: { grupos: GrupoMenu[]; alElegir?: () => void }) {
  const actual = usePathname() ?? "";
  return (
    <nav className="space-y-4 p-3" aria-label="Menu principal">
      {grupos.map((grupo, i) => (
        <div key={grupo.titulo || i}>
          {grupo.titulo && (
            <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              {grupo.titulo}
            </p>
          )}
          <div className="space-y-0.5">
            {grupo.items.map((item) =>
              item.disponible ? (
                <Link
                  key={item.ruta}
                  href={item.ruta}
                  onClick={alElegir}
                  aria-current={esActual(item.ruta, actual) ? "page" : undefined}
                  className={`block rounded-lg px-3 py-2 text-sm font-medium ${
                    esActual(item.ruta, actual)
                      ? "bg-marca-50 text-marca-700"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
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
  );
}

/// Menu del celular: un boton en el encabezado que abre el mismo menu de la
/// computadora como un panel lateral. Se cierra al elegir una pantalla, al
/// tocar fuera, con la tecla Esc o con la X.
export function MenuMovil({
  grupos,
  encabezado,
  usuario,
}: {
  grupos: GrupoMenu[];
  encabezado: React.ReactNode;
  /// En el celular el nombre no cabe en el encabezado: va al pie del menu.
  usuario: { nombre: string; rutaCambio: string };
}) {
  const [abierto, setAbierto] = useState(false);
  const actual = usePathname();

  // Si se navega por otro lado (atras, un enlace de la pagina), se cierra.
  useEffect(() => setAbierto(false), [actual]);

  useEffect(() => {
    if (!abierto) return;
    const alTeclear = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(false);
    document.addEventListener("keydown", alTeclear);
    // Que la pagina de atras no se desplace mientras el menu esta abierto.
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", alTeclear);
      document.body.style.overflow = anterior;
    };
  }, [abierto]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setAbierto(true)}
        aria-label="Abrir menu"
        aria-expanded={abierto}
        aria-controls="menu-movil"
        className="-ml-2 rounded-lg p-2 text-slate-700 hover:bg-slate-100"
      >
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {abierto && (
        <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true" id="menu-movil">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setAbierto(false)} aria-hidden="true" />
          <div className="relative flex h-full w-72 max-w-[85vw] flex-col overflow-y-auto bg-white shadow-xl">
            <div className="relative">
              {encabezado}
              <button
                type="button"
                onClick={() => setAbierto(false)}
                aria-label="Cerrar menu"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-marca-sec-contraste hover:bg-black/10"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <div className="flex-1">
              <ListaMenu grupos={grupos} alElegir={() => setAbierto(false)} />
            </div>
            <div className="border-t border-slate-200 p-3">
              <Link
                href={usuario.rutaCambio}
                onClick={() => setAbierto(false)}
                className="block rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
              >
                <span className="block font-medium">{usuario.nombre}</span>
                <span className="text-xs text-slate-500">Cambiar mi contrasena</span>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
