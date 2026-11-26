"use client";

import { useActionState } from "react";
import { Alerta, Boton, Campo } from "@/components/ui";
import { eliminarGrupo, type EstadoFormulario } from "./acciones";

/// Eliminar el grupo: se confirma escribiendo su nombre. Si ya tiene historial
/// se explica por que no se puede.
export function EliminarGrupo({ id, nombre }: { id: number; nombre: string }) {
  const [estado, accion, pendiente] = useActionState<EstadoFormulario, FormData>(eliminarGrupo, {});
  return (
    <form action={accion} className="space-y-3" data-eliminar-grupo>
      <input type="hidden" name="grupoId" value={id} />
      <p className="text-sm text-slate-600">
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
        <Boton type="submit" variante="peligro" disabled={pendiente}>
          {pendiente ? "Eliminando..." : "Eliminar grupo"}
        </Boton>
      </div>
    </form>
  );
}
