"use client";

import { useActionState, useState } from "react";
import { Alerta, Boton, Campo, Selector } from "@/components/ui";
import {
  cerrarPeriodoDeClase,
  crearActividad,
  crearRubro,
  eliminarActividad,
  eliminarRubro,
  guardarCalificacionesPeriodo,
  guardarPuntos,
  reabrirPeriodoDeClase,
  registrarExtraordinario,
  type EstadoCalificaciones,
} from "./acciones";

function Avisos({ estado }: { estado: EstadoCalificaciones }) {
  return (
    <>
      {estado.error && (
        <Alerta tipo="error">
          <p className="font-medium">{estado.error}</p>
          {estado.detalles && (
            <ul className="mt-1 list-inside list-disc text-xs">
              {estado.detalles.slice(0, 10).map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          )}
        </Alerta>
      )}
      {estado.ok && estado.mensaje && <Alerta tipo="exito">{estado.mensaje}</Alerta>}
    </>
  );
}

export function FormularioRubro({
  claseId,
  periodoId,
  pesoAsignado,
}: {
  claseId: number;
  periodoId: number;
  pesoAsignado: number;
}) {
  const [estado, accion, pendiente] = useActionState<EstadoCalificaciones, FormData>(crearRubro, {});
  return (
    <form action={accion} className="space-y-3">
      <input type="hidden" name="claseId" value={claseId} />
      <input type="hidden" name="periodoId" value={periodoId} />
      <Avisos estado={estado} />
      <div className="flex flex-wrap items-end gap-3">
        <Campo etiqueta="Nombre del rubro" name="nombre" required placeholder="Examen, tareas..." />
        <Campo
          etiqueta="Peso (%)"
          name="peso"
          type="number"
          min={1}
          max={100}
          required
          className="w-32"
          ayuda={`Asignado: ${pesoAsignado}%`}
        />
        <Boton type="submit" variante="secundario" disabled={pendiente}>
          {pendiente ? "Guardando..." : "Agregar rubro"}
        </Boton>
      </div>
    </form>
  );
}

export function BotonEliminarRubro({ rubroId }: { rubroId: number }) {
  const [estado, accion, pendiente] = useActionState<EstadoCalificaciones, FormData>(
    eliminarRubro,
    {}
  );
  return (
    <form action={accion}>
      <input type="hidden" name="rubroId" value={rubroId} />
      <button
        type="submit"
        disabled={pendiente}
        className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
      >
        {pendiente ? "..." : "Quitar"}
      </button>
      {estado.error && <p className="mt-1 max-w-xs text-xs text-red-600">{estado.error}</p>}
    </form>
  );
}

export function FormularioActividad({
  claseId,
  periodoId,
  rubros,
}: {
  claseId: number;
  periodoId: number;
  rubros: { id: number; nombre: string }[];
}) {
  const [estado, accion, pendiente] = useActionState<EstadoCalificaciones, FormData>(
    crearActividad,
    {}
  );
  return (
    <form action={accion} className="space-y-3">
      <input type="hidden" name="claseId" value={claseId} />
      <input type="hidden" name="periodoId" value={periodoId} />
      <Avisos estado={estado} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Campo etiqueta="Nombre de la actividad" name="nombre" required />
        <Selector etiqueta="Rubro" name="rubroId">
          <option value="">Sin rubro</option>
          {rubros.map((rubro) => (
            <option key={rubro.id} value={rubro.id}>
              {rubro.nombre}
            </option>
          ))}
        </Selector>
        <Campo
          etiqueta="Puntos maximos"
          name="puntosMaximos"
          type="number"
          min={1}
          step="0.01"
          defaultValue="100"
          required
        />
        <Campo etiqueta="Fecha de entrega" name="fechaEntrega" type="date" />
      </div>
      <div className="flex justify-end">
        <Boton type="submit" disabled={pendiente}>
          {pendiente ? "Creando..." : "Crear actividad"}
        </Boton>
      </div>
    </form>
  );
}

export function BotonEliminarActividad({ actividadId }: { actividadId: number }) {
  const [estado, accion, pendiente] = useActionState<EstadoCalificaciones, FormData>(
    eliminarActividad,
    {}
  );
  return (
    <form action={accion} className="inline">
      <input type="hidden" name="actividadId" value={actividadId} />
      <button
        type="submit"
        disabled={pendiente}
        className="text-xs font-medium text-red-600 hover:underline"
      >
        {pendiente ? "..." : "eliminar"}
      </button>
      {estado.error && <span className="ml-2 text-xs text-red-600">{estado.error}</span>}
    </form>
  );
}

export function TablaPuntos({
  actividad,
  alumnos,
}: {
  actividad: { id: number; nombre: string; puntosMaximos: number };
  alumnos: { id: number; matricula: string; nombre: string; puntos: string }[];
}) {
  const [estado, accion, pendiente] = useActionState<EstadoCalificaciones, FormData>(
    guardarPuntos,
    {}
  );
  return (
    <form action={accion} className="space-y-3">
      <input type="hidden" name="actividadId" value={actividad.id} />
      <Avisos estado={estado} />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="pb-2 pr-3 font-medium">Matricula</th>
              <th className="pb-2 pr-3 font-medium">Alumno</th>
              <th className="pb-2 font-medium">Puntos (de {actividad.puntosMaximos})</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {alumnos.map((alumno) => (
              <tr key={alumno.id}>
                <td className="py-1.5 pr-3 font-mono text-xs text-slate-500">{alumno.matricula}</td>
                <td className="py-1.5 pr-3 text-slate-800">{alumno.nombre}</td>
                <td className="py-1.5">
                  <input
                    name={`puntos_${alumno.id}`}
                    type="number"
                    step="0.01"
                    min={0}
                    max={actividad.puntosMaximos}
                    defaultValue={alumno.puntos}
                    className="campo w-28 py-1"
                    aria-label={`Puntos de ${alumno.nombre}`}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">Deja el campo vacio para borrar la captura.</p>
        <Boton type="submit" disabled={pendiente}>
          {pendiente ? "Guardando..." : "Guardar puntos"}
        </Boton>
      </div>
    </form>
  );
}

export function TablaPeriodo({
  claseId,
  periodoId,
  escala,
  alumnos,
  cerrado,
}: {
  claseId: number;
  periodoId: number;
  escala: { minimo: number; maximo: number; minimaAprobatoria: number; decimales: number };
  alumnos: {
    id: number;
    matricula: string;
    nombre: string;
    sugerida: number | null;
    oficial: string;
    observacion: string;
    cerrada: boolean;
  }[];
  cerrado: boolean;
}) {
  const [estado, accion, pendiente] = useActionState<EstadoCalificaciones, FormData>(
    guardarCalificacionesPeriodo,
    {}
  );
  const [valores, setValores] = useState<Record<number, string>>(
    Object.fromEntries(alumnos.map((alumno) => [alumno.id, alumno.oficial]))
  );

  function usarSugeridas() {
    setValores((previo) => {
      const copia = { ...previo };
      for (const alumno of alumnos) {
        if (alumno.sugerida != null && !alumno.cerrada) {
          copia[alumno.id] = String(alumno.sugerida);
        }
      }
      return copia;
    });
  }

  return (
    <form action={accion} className="space-y-3">
      <input type="hidden" name="claseId" value={claseId} />
      <input type="hidden" name="periodoId" value={periodoId} />
      <Avisos estado={estado} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500">
          Escala {escala.minimo} a {escala.maximo} · aprueba con {escala.minimaAprobatoria}. La
          sugerida sale de tus rubros; la oficial es la que tu confirmas.
        </p>
        <button
          type="button"
          onClick={usarSugeridas}
          disabled={cerrado}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:text-slate-300"
        >
          Copiar las sugeridas
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="pb-2 pr-3 font-medium">Matricula</th>
              <th className="pb-2 pr-3 font-medium">Alumno</th>
              <th className="pb-2 pr-3 font-medium">Sugerida</th>
              <th className="pb-2 pr-3 font-medium">Oficial</th>
              <th className="pb-2 font-medium">Observaciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {alumnos.map((alumno) => {
              const valor = valores[alumno.id] ?? "";
              const numero = Number(valor);
              const reprobado = valor !== "" && Number.isFinite(numero) && numero < escala.minimaAprobatoria;
              return (
                <tr key={alumno.id}>
                  <td className="py-1.5 pr-3 font-mono text-xs text-slate-500">{alumno.matricula}</td>
                  <td className="py-1.5 pr-3 text-slate-800">{alumno.nombre}</td>
                  <td className="py-1.5 pr-3 text-slate-500">
                    {alumno.sugerida ?? <span className="text-slate-300">sin capturas</span>}
                  </td>
                  <td className="py-1.5 pr-3">
                    <input
                      name={`calificacion_${alumno.id}`}
                      type="number"
                      step="0.01"
                      min={escala.minimo}
                      max={escala.maximo}
                      value={valor}
                      onChange={(e) =>
                        setValores((previo) => ({ ...previo, [alumno.id]: e.target.value }))
                      }
                      disabled={alumno.cerrada}
                      className={`campo w-28 py-1 ${reprobado ? "border-red-300 text-red-700" : ""}`}
                      aria-label={`Calificacion de ${alumno.nombre}`}
                    />
                  </td>
                  <td className="py-1.5">
                    <input
                      name={`observacion_${alumno.id}`}
                      defaultValue={alumno.observacion}
                      disabled={alumno.cerrada}
                      className="campo py-1 text-xs"
                      aria-label={`Observaciones de ${alumno.nombre}`}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end">
        <Boton type="submit" disabled={pendiente || cerrado}>
          {pendiente ? "Guardando..." : "Guardar calificaciones"}
        </Boton>
      </div>
    </form>
  );
}

export function BotonCerrarPeriodo({
  claseId,
  periodoId,
  cerrado,
  esAdmin,
}: {
  claseId: number;
  periodoId: number;
  cerrado: boolean;
  esAdmin: boolean;
}) {
  const [estado, accion, pendiente] = useActionState<EstadoCalificaciones, FormData>(
    cerrado ? reabrirPeriodoDeClase : cerrarPeriodoDeClase,
    {}
  );
  if (cerrado && !esAdmin) {
    return <p className="text-xs text-slate-500">Periodo cerrado. Solo direccion puede reabrirlo.</p>;
  }
  return (
    <form action={accion} className="space-y-2">
      <input type="hidden" name="claseId" value={claseId} />
      <input type="hidden" name="periodoId" value={periodoId} />
      {estado.error && <Alerta tipo="error">{estado.error}</Alerta>}
      {estado.ok && estado.mensaje && <Alerta tipo="exito">{estado.mensaje}</Alerta>}
      <Boton type="submit" variante={cerrado ? "secundario" : "primario"} disabled={pendiente}>
        {pendiente ? "..." : cerrado ? "Reabrir periodo" : "Cerrar periodo"}
      </Boton>
    </form>
  );
}

export function FormularioExtraordinario({
  claseId,
  alumnos,
  maximo,
}: {
  claseId: number;
  alumnos: { id: number; etiqueta: string }[];
  maximo: number;
}) {
  const [estado, accion, pendiente] = useActionState<EstadoCalificaciones, FormData>(
    registrarExtraordinario,
    {}
  );
  return (
    <form action={accion} className="space-y-3">
      <input type="hidden" name="claseId" value={claseId} />
      <Avisos estado={estado} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Selector etiqueta="Alumno" name="alumnoId" required className="lg:col-span-2">
          <option value="">Selecciona...</option>
          {alumnos.map((alumno) => (
            <option key={alumno.id} value={alumno.id}>
              {alumno.etiqueta}
            </option>
          ))}
        </Selector>
        <Selector etiqueta="Tipo" name="tipo">
          <option value="EXTRAORDINARIO">Extraordinario</option>
          <option value="RECUPERACION">Recuperacion</option>
          <option value="TITULO_SUFICIENCIA">Titulo de suficiencia</option>
        </Selector>
        <Campo
          etiqueta="Calificacion"
          name="calificacion"
          type="number"
          step="0.01"
          required
          ayuda={`Maximo permitido: ${maximo}`}
        />
      </div>
      <div className="flex justify-end">
        <Boton type="submit" variante="secundario" disabled={pendiente || alumnos.length === 0}>
          {pendiente ? "Guardando..." : "Registrar"}
        </Boton>
      </div>
    </form>
  );
}
