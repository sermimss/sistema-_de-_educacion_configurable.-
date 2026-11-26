"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Alerta, Boton, Campo } from "@/components/ui";
import { MasOpciones } from "@/components/MasOpciones";
import { accionEliminarNivel, accionOfertaNivel, type EstadoEliminarNivel } from "./programas";

type Nivel = { id: number; nombre: string; clave: string };

/// Menu discreto (⋯) del nivel con la opcion de eliminarlo.
export function EliminarNivel(nivel: Nivel) {
  return (
    <MasOpciones
      opciones={[{ etiqueta: "Eliminar nivel", ventana: (cerrar) => <VentanaEliminarNivel {...nivel} cerrar={cerrar} /> }]}
    />
  );
}

/// Eliminar un nivel: se confirma escribiendo su nombre o clave. Si tiene
/// grupos o alumnos explica por que no se puede y ofrece darlo de baja.
function VentanaEliminarNivel({ id, nombre, clave, cerrar }: Nivel & { cerrar: () => void }) {
  const [estado, accion, pendiente] = useActionState<EstadoEliminarNivel, FormData>(accionEliminarNivel, {});
  return (
    <div className="text-sm" data-eliminar-nivel={clave}>
      <h2 className="text-base font-semibold text-slate-900">Eliminar el nivel {nombre}</h2>
      <div className="mt-3 space-y-3">
        <form action={accion} className="space-y-3">
          <input type="hidden" name="nivelId" value={id} />
          <p className="text-xs text-slate-600">
            Se borra el nivel con sus carreras y certificaciones. Solo se puede si no tiene grupos ni alumnos; si
            los tiene, se puede dar de baja (se oculta y se conserva el historial).
          </p>
          {estado.error && (
            <Alerta tipo="error">
              <p className="font-medium">{estado.error}</p>
              {estado.motivos && (
                <ul className="mt-1 list-inside list-disc text-xs">
                  {estado.motivos.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              )}
              {estado.grupos && estado.grupos.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-2 text-xs" data-grupos-del-nivel>
                  {estado.grupos.map((g) => (
                    <li key={g.id}>
                      <Link href={`/panel/grupos/${g.id}`} className="font-medium underline">
                        {g.nombre} · {g.ciclo}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Alerta>
          )}
          <div className="flex flex-wrap items-end gap-2">
            <Campo
              etiqueta={`Escribe "${nombre}" o "${clave}" para confirmar`}
              name="confirmacion"
              autoComplete="off"
              className="min-w-[14rem] flex-1"
            />
            <Boton type="button" variante="secundario" onClick={cerrar}>
              Cancelar
            </Boton>
            <Boton type="submit" variante="peligro" disabled={pendiente}>
              {pendiente ? "Eliminando..." : "Eliminar nivel"}
            </Boton>
          </div>
        </form>
        {estado.ofrecerBaja && (
          <form action={accionOfertaNivel} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3" data-baja-nivel>
            <input type="hidden" name="nivelId" value={id} />
            <input type="hidden" name="accion" value="baja" />
            <p className="text-xs text-amber-900">
              En su lugar puedes darlo de baja: deja de ofrecerse y se oculta; quienes ya estudian ahi terminan y sus
              boletas, pagos y certificados se conservan.
            </p>
            <Boton type="submit" variante="secundario">Dar de baja el nivel</Boton>
          </form>
        )}
      </div>
    </div>
  );
}
