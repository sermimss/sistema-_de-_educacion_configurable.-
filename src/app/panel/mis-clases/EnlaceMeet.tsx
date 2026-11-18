"use client";

import { useActionState, useState } from "react";
import { Alerta } from "@/components/ui";
import { accionEnlaceMeet, type EstadoEnlace } from "./acciones";

export function EnlaceMeet({ claseId, actual, materia }: { claseId: number; actual: string | null; materia: string }) {
  const [estado, accion, pendiente] = useActionState<EstadoEnlace, FormData>(accionEnlaceMeet, {});
  const [valor, setValor] = useState(actual ?? "");
  return (
    <form action={accion} className="space-y-2">
      <input type="hidden" name="claseId" value={claseId} />
      <label className="etiqueta-campo" htmlFor={`meet-${claseId}`}>
        Enlace de Google Meet de {materia}
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          id={`meet-${claseId}`}
          name="enlace"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          placeholder="https://meet.google.com/abc-defg-hij"
          className="campo min-w-[16rem] flex-1"
        />
        <button
          type="submit"
          name="todas"
          value="0"
          disabled={pendiente}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          {pendiente ? "Guardando..." : "Guardar"}
        </button>
        <button
          type="submit"
          name="todas"
          value="1"
          disabled={pendiente || !valor.trim()}
          className="text-xs text-marca-600 hover:underline disabled:text-slate-300"
          title="Usa esta misma sala de Meet en todas tus clases"
        >
          Usar en todas mis clases
        </button>
      </div>
      <p className="text-xs text-slate-500">
        Crea la reunion en meet.google.com (o en Google Calendar) y pega aqui su enlace. Deja el campo vacio
        para quitarlo.
      </p>
      {estado.error && <Alerta tipo="error">{estado.error}</Alerta>}
      {estado.ok && estado.mensaje && <Alerta tipo="exito">{estado.mensaje}</Alerta>}
    </form>
  );
}
