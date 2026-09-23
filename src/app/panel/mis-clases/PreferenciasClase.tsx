"use client";

import { useActionState, useState } from "react";
import { Alerta, Boton, Campo, Selector } from "@/components/ui";
import { cambiarModoAsistencia, type EstadoAsistenciaForm } from "../asistencia/acciones";

export default function PreferenciasClase({
  claseId,
  modoAsistencia,
  afecta,
  porcentaje,
  puedeElegirModo,
  puedeElegirAfectacion,
}: {
  claseId: number;
  modoAsistencia: string;
  afecta: boolean;
  porcentaje: string;
  puedeElegirModo: boolean;
  puedeElegirAfectacion: boolean;
}) {
  const [estado, accion, pendiente] = useActionState<EstadoAsistenciaForm, FormData>(
    cambiarModoAsistencia,
    {}
  );
  const [afectaCalificacion, setAfecta] = useState(afecta);

  return (
    <form action={accion} className="space-y-3">
      <input type="hidden" name="claseId" value={claseId} />
      {estado.error && <Alerta tipo="error">{estado.error}</Alerta>}
      {estado.ok && estado.mensaje && <Alerta tipo="exito">{estado.mensaje}</Alerta>}

      <div className="grid gap-3 sm:grid-cols-3">
        <Selector
          etiqueta="Como paso lista"
          name="modoAsistencia"
          defaultValue={modoAsistencia}
          disabled={!puedeElegirModo}
          ayuda={puedeElegirModo ? undefined : "La escuela fijo este modo para todos."}
        >
          <option value="POR_CLASE">Por clase</option>
          <option value="POR_DIA">Por dia completo</option>
        </Selector>

        <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3">
          <input
            type="checkbox"
            name="asistenciaAfectaCalificacion"
            checked={afectaCalificacion}
            onChange={(e) => setAfecta(e.target.checked)}
            disabled={!puedeElegirAfectacion}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-marca-600"
          />
          <span>
            <span className="block text-sm font-medium text-slate-800">
              La asistencia afecta la calificacion
            </span>
            <span className="mt-0.5 block text-xs text-slate-500">
              {puedeElegirAfectacion
                ? "Tu decides en esta clase."
                : "La escuela no permite cambiarlo."}
            </span>
          </span>
        </label>

        <Campo
          etiqueta="Peso de la asistencia (%)"
          name="porcentajeAsistencia"
          type="number"
          min={1}
          max={100}
          defaultValue={porcentaje}
          disabled={!afectaCalificacion}
        />
      </div>

      <div className="flex justify-end">
        <Boton type="submit" variante="secundario" disabled={pendiente}>
          {pendiente ? "Guardando..." : "Guardar preferencias"}
        </Boton>
      </div>
    </form>
  );
}
