"use client";

import { useActionState, useState } from "react";
import { Alerta, Boton, Campo, Selector } from "@/components/ui";
import { agregarHorario, quitarHorario, type EstadoHorario } from "./acciones";

type Opcion = { id: number; etiqueta: string };
type Modulo = { id: number; etiqueta: string; horaInicio: string; horaFin: string };

export function FormularioHorario({
  grupoId,
  clases,
  modulos,
  aulas,
  dias,
}: {
  grupoId: number;
  clases: Opcion[];
  modulos: Modulo[];
  aulas: Opcion[];
  dias: { valor: number; nombre: string }[];
}) {
  const [estado, accion, pendiente] = useActionState<EstadoHorario, FormData>(agregarHorario, {});
  const [moduloId, setModuloId] = useState<string>(modulos[0] ? String(modulos[0].id) : "");
  const modulo = modulos.find((m) => String(m.id) === moduloId);

  return (
    <form action={accion} className="space-y-3">
      <input type="hidden" name="grupoId" value={grupoId} />
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
      {estado.ok && estado.mensaje && <Alerta tipo="exito">{estado.mensaje}</Alerta>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Selector etiqueta="Materia" name="claseId" required className="lg:col-span-2">
          <option value="">Selecciona...</option>
          {clases.map((clase) => (
            <option key={clase.id} value={clase.id}>
              {clase.etiqueta}
            </option>
          ))}
        </Selector>
        <Selector etiqueta="Dia" name="diaSemana" required>
          {dias.map((dia) => (
            <option key={dia.valor} value={dia.valor}>
              {dia.nombre}
            </option>
          ))}
        </Selector>
        <Selector
          etiqueta="Modulo"
          name="moduloId"
          value={moduloId}
          onChange={(e) => setModuloId(e.target.value)}
        >
          <option value="">Horario manual</option>
          {modulos.map((m) => (
            <option key={m.id} value={m.id}>
              {m.etiqueta}
            </option>
          ))}
        </Selector>
        <Selector etiqueta="Aula" name="aulaId">
          <option value="">La de la clase</option>
          {aulas.map((aula) => (
            <option key={aula.id} value={aula.id}>
              {aula.etiqueta}
            </option>
          ))}
        </Selector>
      </div>

      {!moduloId && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Campo etiqueta="Hora de inicio" name="horaInicio" type="time" required />
          <Campo etiqueta="Hora de fin" name="horaFin" type="time" required />
        </div>
      )}
      {modulo && (
        <p className="text-xs text-slate-500">
          El modulo {modulo.etiqueta} va de {modulo.horaInicio} a {modulo.horaFin}.
        </p>
      )}

      <div className="flex justify-end">
        <Boton type="submit" disabled={pendiente || clases.length === 0}>
          {pendiente ? "Guardando..." : "Agregar al horario"}
        </Boton>
      </div>
    </form>
  );
}

export function BotonQuitarHorario({ horarioId }: { horarioId: number }) {
  const [estado, accion, pendiente] = useActionState<EstadoHorario, FormData>(quitarHorario, {});
  return (
    <form action={accion} className="inline">
      <input type="hidden" name="horarioId" value={horarioId} />
      <button
        type="submit"
        disabled={pendiente}
        className="text-[10px] font-medium text-red-600 hover:underline"
        title="Quitar del horario"
      >
        {pendiente ? "..." : "quitar"}
      </button>
      {estado.error && <span className="ml-1 text-[10px] text-red-600">{estado.error}</span>}
    </form>
  );
}
