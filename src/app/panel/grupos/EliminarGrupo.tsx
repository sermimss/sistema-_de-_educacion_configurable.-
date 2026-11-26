"use client";

import { useActionState } from "react";
import { Alerta, Boton, Campo } from "@/components/ui";
import { MasOpciones } from "@/components/MasOpciones";
import { eliminarGrupo, type EstadoFormulario } from "./acciones";

type Grupo = { id: number; nombre: string };

/// Menu discreto (⋯) del grupo con la opcion de eliminarlo.
export function EliminarGrupo(grupo: Grupo) {
  return (
    <MasOpciones
      opciones={[{ etiqueta: "Eliminar grupo", ventana: (cerrar) => <VentanaEliminarGrupo {...grupo} cerrar={cerrar} /> }]}
    />
  );
}

/// Eliminar el grupo: se confirma escribiendo su nombre. Si ya tiene historial
/// se explica por que no se puede.
function VentanaEliminarGrupo({ id, nombre, cerrar }: Grupo & { cerrar: () => void }) {
  const [estado, accion, pendiente] = useActionState<EstadoFormulario, FormData>(eliminarGrupo, {});
  return (
    <form action={accion} className="space-y-3 text-sm" data-eliminar-grupo>
      <h2 className="text-base font-semibold text-slate-900">Eliminar el grupo {nombre}</h2>
      <input type="hidden" name="grupoId" value={id} />
      <p className="text-xs text-slate-600">
        Se borra el grupo con sus clases y horarios. Solo se puede si no tiene alumnos inscritos, calificaciones,
        asistencias, tareas, examenes ni grabaciones.
      </p>
      {estado.error && (
        <Alerta tipo="error">
          <p className="font-medium">{estado.error}</p>
          {estado.detalles && (
            <ul className="mt-1 list-inside list-disc text-xs">
              {estado.detalles.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          )}
        </Alerta>
      )}
      <div className="flex flex-wrap items-end gap-2">
        <Campo etiqueta={`Escribe "${nombre}" para confirmar`} name="confirmacion" autoComplete="off" className="min-w-[14rem] flex-1" />
        <Boton type="button" variante="secundario" onClick={cerrar}>
          Cancelar
        </Boton>
        <Boton type="submit" variante="peligro" disabled={pendiente}>
          {pendiente ? "Eliminando..." : "Eliminar grupo"}
        </Boton>
      </div>
    </form>
  );
}
