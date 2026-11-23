"use client";

import { useActionState, useState } from "react";
import { Alerta, Boton, Campo, Selector } from "@/components/ui";
import { DIAS_SEMANA } from "@/lib/formato";
import { accionSolicitarCambio, type EstadoSolicitudHorario } from "./acciones";

export type BloquePropio = { id: number; etiqueta: string; diaSemana: number; horaInicio: string; horaFin: string };

/// El docente elige uno de sus bloques y propone el nuevo dia u hora: de ahi
/// en adelante, o solo para una fecha (reposicion).
export function FormularioCambio({ bloques, hoy }: { bloques: BloquePropio[]; hoy: string }) {
  const [estado, accion, pendiente] = useActionState<EstadoSolicitudHorario, FormData>(accionSolicitarCambio, {});
  const [bloqueId, setBloqueId] = useState(bloques[0]?.id ?? 0);
  const [tipo, setTipo] = useState<"PERMANENTE" | "UNA_FECHA">("PERMANENTE");
  const bloque = bloques.find((b) => b.id === bloqueId) ?? bloques[0];

  return (
    <form action={accion} className="space-y-3">
      {estado.error && (
        <Alerta tipo="error">
          {estado.error}
          {estado.detalles && (
            <ul className="mt-1 list-disc pl-5" data-choques>
              {estado.detalles.map((d) => <li key={d}>{d}</li>)}
            </ul>
          )}
        </Alerta>
      )}
      {estado.ok && estado.mensaje && <Alerta tipo="exito">{estado.mensaje}</Alerta>}

      <Selector etiqueta="Bloque que quieres mover" name="horarioId" value={bloqueId} onChange={(e) => setBloqueId(Number(e.target.value))}>
        {bloques.map((b) => (
          <option key={b.id} value={b.id}>{b.etiqueta}</option>
        ))}
      </Selector>

      <fieldset className="flex flex-wrap gap-4 text-sm text-slate-700">
        <legend className="etiqueta-campo">El cambio es</legend>
        <label className="flex items-center gap-2">
          <input type="radio" name="tipo" value="PERMANENTE" checked={tipo === "PERMANENTE"} onChange={() => setTipo("PERMANENTE")} />
          De aqui en adelante
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="tipo" value="UNA_FECHA" checked={tipo === "UNA_FECHA"} onChange={() => setTipo("UNA_FECHA")} />
          Solo una fecha (reposicion)
        </label>
      </fieldset>

      {/* key: al cambiar de bloque se proponen sus horas actuales */}
      <div key={`${bloqueId}-${tipo}`} className="grid gap-3 sm:grid-cols-4">
        {tipo === "PERMANENTE" ? (
          <Selector etiqueta="Nuevo dia" name="nuevoDia" defaultValue={bloque?.diaSemana} className="sm:col-span-2">
            {DIAS_SEMANA.map((d) => (
              <option key={d.valor} value={d.valor}>{d.nombre}</option>
            ))}
          </Selector>
        ) : (
          <>
            <Campo etiqueta="Fecha de la clase que se mueve" name="fechaOriginal" type="date" min={hoy} required />
            <Campo etiqueta="Nueva fecha" name="nuevaFecha" type="date" min={hoy} required />
          </>
        )}
        <Campo etiqueta="Hora de inicio" name="horaInicio" type="time" required defaultValue={bloque?.horaInicio} />
        <Campo etiqueta="Hora de fin" name="horaFin" type="time" required defaultValue={bloque?.horaFin} />
      </div>

      <div>
        <label className="etiqueta-campo" htmlFor="motivo-cambio">Motivo</label>
        <textarea id="motivo-cambio" name="motivo" required maxLength={1000} rows={2} className="campo" placeholder="Por ejemplo: tengo junta de academia los lunes a esa hora" />
      </div>
      <div className="flex justify-end">
        <Boton type="submit" disabled={pendiente}>{pendiente ? "Enviando..." : "Enviar solicitud"}</Boton>
      </div>
    </form>
  );
}
