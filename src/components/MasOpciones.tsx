"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/// Boton discreto de tres puntos con un menu. Cada opcion abre una ventana
/// (por ejemplo, la confirmacion para eliminar) que se cierra con Cancelar,
/// con Escape o tocando fuera.
export function MasOpciones({
  opciones,
}: {
  opciones: { etiqueta: string; ventana: (cerrar: () => void) => ReactNode }[];
}) {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [activa, setActiva] = useState<number | null>(null);
  const contenedor = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuAbierto && activa === null) return;
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuAbierto(false);
        setActiva(null);
      }
    };
    const alTocar = (e: MouseEvent) => {
      if (menuAbierto && !contenedor.current?.contains(e.target as Node)) setMenuAbierto(false);
    };
    document.addEventListener("keydown", alTeclear);
    document.addEventListener("mousedown", alTocar);
    return () => {
      document.removeEventListener("keydown", alTeclear);
      document.removeEventListener("mousedown", alTocar);
    };
  }, [menuAbierto, activa]);

  return (
    <div ref={contenedor} className="relative inline-block">
      <button
        type="button"
        aria-label="Mas opciones"
        aria-haspopup="menu"
        aria-expanded={menuAbierto}
        onClick={() => setMenuAbierto((v) => !v)}
        className="rounded-md px-1.5 leading-none text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-marca-500"
      >
        <span aria-hidden className="text-lg">⋯</span>
      </button>
      {menuAbierto && (
        <div role="menu" className="absolute right-0 z-20 mt-1 min-w-[10rem] rounded-lg border border-slate-200 bg-white py-1 text-left shadow-lg">
          {opciones.map((opcion, indice) => (
            <button
              key={opcion.etiqueta}
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuAbierto(false);
                setActiva(indice);
              }}
              className="block w-full px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50"
            >
              {opcion.etiqueta}
            </button>
          ))}
        </div>
      )}
      {activa !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setActiva(null);
          }}
        >
          <div role="dialog" aria-modal="true" aria-label={opciones[activa].etiqueta} className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-4 text-left shadow-xl">
            {opciones[activa].ventana(() => setActiva(null))}
          </div>
        </div>
      )}
    </div>
  );
}
