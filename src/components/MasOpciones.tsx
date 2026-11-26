"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/// Una opcion del menu: abre una ventana (por ejemplo, la confirmacion para
/// eliminar) o envia directo un formulario (por ejemplo, Desactivar).
export type OpcionMenu =
  | { etiqueta: string; ventana: (cerrar: () => void) => ReactNode }
  | { etiqueta: string; accion: (datos: FormData) => void | Promise<void>; campos: Record<string, string | number> };

type Posicion = { top?: number; bottom?: number; right: number };

/// Debajo del boton; si no cabe en la pantalla, arriba de el.
function posicionar(r: DOMRect, opciones: number): Posicion {
  const alto = opciones * 34 + 12;
  const right = Math.max(8, window.innerWidth - r.right);
  if (r.bottom + 4 + alto > window.innerHeight && r.top - 4 - alto > 0) {
    return { bottom: window.innerHeight - r.top + 4, right };
  }
  return { top: r.bottom + 4, right };
}

/// Boton discreto de tres puntos con un menu. El menu se dibuja sobre la
/// pagina (no lo recorta una tabla con desplazamiento), sigue al boton al
/// desplazarse y se cierra con Escape o tocando fuera.
export function MasOpciones({ opciones, etiqueta = "Mas opciones" }: { opciones: OpcionMenu[]; etiqueta?: string }) {
  const [menu, setMenu] = useState<Posicion | null>(null);
  const [activa, setActiva] = useState<number | null>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const lista = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu && activa === null) return;
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenu(null);
        setActiva(null);
      }
    };
    const alTocar = (e: MouseEvent) => {
      const dentro = boton.current?.contains(e.target as Node) || lista.current?.contains(e.target as Node);
      if (menu && !dentro) setMenu(null);
    };
    // Al desplazarse o cambiar el tamano, el menu sigue al boton.
    const alMover = () => {
      const r = boton.current?.getBoundingClientRect();
      setMenu((actual) => (actual && r ? posicionar(r, opciones.length) : actual));
    };
    document.addEventListener("keydown", alTeclear);
    document.addEventListener("mousedown", alTocar);
    window.addEventListener("scroll", alMover, true);
    window.addEventListener("resize", alMover);
    return () => {
      document.removeEventListener("keydown", alTeclear);
      document.removeEventListener("mousedown", alTocar);
      window.removeEventListener("scroll", alMover, true);
      window.removeEventListener("resize", alMover);
    };
  }, [menu, activa, opciones.length]);

  function alternar() {
    if (menu) return setMenu(null);
    const r = boton.current?.getBoundingClientRect();
    if (r) setMenu(posicionar(r, opciones.length));
  }

  const claseOpcion = "block w-full px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50";
  const opcionActiva = activa !== null ? opciones[activa] : null;

  return (
    <span className="inline-block">
      <button
        ref={boton}
        type="button"
        aria-label={etiqueta}
        aria-haspopup="menu"
        aria-expanded={Boolean(menu)}
        onClick={alternar}
        className="rounded-md px-1.5 leading-none text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-marca-500"
      >
        <span aria-hidden className="text-lg">⋯</span>
      </button>
      {menu && (
        <div
          ref={lista}
          role="menu"
          style={{ position: "fixed", top: menu.top, bottom: menu.bottom, right: menu.right }}
          className="z-40 min-w-[11rem] rounded-lg border border-slate-200 bg-white py-1 text-left shadow-lg"
        >
          {opciones.map((opcion, indice) =>
            "ventana" in opcion ? (
              <button
                key={opcion.etiqueta}
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenu(null);
                  setActiva(indice);
                }}
                className={claseOpcion}
              >
                {opcion.etiqueta}
              </button>
            ) : (
              <form key={opcion.etiqueta} action={opcion.accion} onSubmit={() => setTimeout(() => setMenu(null), 0)}>
                {Object.entries(opcion.campos).map(([nombre, valor]) => (
                  <input key={nombre} type="hidden" name={nombre} value={valor} />
                ))}
                <button type="submit" role="menuitem" className={claseOpcion}>
                  {opcion.etiqueta}
                </button>
              </form>
            )
          )}
        </div>
      )}
      {opcionActiva && "ventana" in opcionActiva && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setActiva(null);
          }}
        >
          <div role="dialog" aria-modal="true" aria-label={opcionActiva.etiqueta} className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-4 text-left shadow-xl">
            {opcionActiva.ventana(() => setActiva(null))}
          </div>
        </div>
      )}
    </span>
  );
}
