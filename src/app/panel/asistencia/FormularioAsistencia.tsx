"use client";

import { useActionState, useState } from "react";
import { Alerta, Boton } from "@/components/ui";
import { ESTADOS_ASISTENCIA } from "@/lib/asistencia";
import { guardarAsistencia, type EstadoAsistenciaForm } from "./acciones";

export type AlumnoLista = {
  id: number;
  matricula: string;
  nombre: string;
  estado: string;
  observacion: string;
};

export default function FormularioAsistencia({
  claseId,
  fecha,
  alumnos,
  cerrada,
}: {
  claseId: number;
  fecha: string;
  alumnos: AlumnoLista[];
  cerrada: boolean;
}) {
  const [estado, accion, pendiente] = useActionState<EstadoAsistenciaForm, FormData>(
    guardarAsistencia,
    {}
  );
  const [marcas, setMarcas] = useState<Record<number, string>>(
    Object.fromEntries(alumnos.map((alumno) => [alumno.id, alumno.estado]))
  );

  function marcarTodos(valor: string) {
    setMarcas(Object.fromEntries(alumnos.map((alumno) => [alumno.id, valor])));
  }

  const resumen = ESTADOS_ASISTENCIA.map((opcion) => ({
    etiqueta: opcion.etiqueta,
    total: Object.values(marcas).filter((valor) => valor === opcion.valor).length,
  })).filter((fila) => fila.total > 0);

  return (
    <form action={accion} className="space-y-4">
      <input type="hidden" name="claseId" value={claseId} />
      <input type="hidden" name="fecha" value={fecha} />

      {estado.error && <Alerta tipo="error">{estado.error}</Alerta>}
      {estado.ok && estado.mensaje && (
        <Alerta tipo="exito">
          <p>{estado.mensaje}</p>
          {estado.alertas && (
            <ul className="mt-1 list-inside list-disc text-xs">
              {estado.alertas.map((alerta) => (
                <li key={alerta}>{alerta}</li>
              ))}
            </ul>
          )}
        </Alerta>
      )}
      {cerrada && <Alerta tipo="aviso">Este pase de lista ya fue cerrado.</Alerta>}

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-slate-600">Marcar a todos:</span>
        {ESTADOS_ASISTENCIA.slice(0, 2).map((opcion) => (
          <button
            key={opcion.valor}
            type="button"
            onClick={() => marcarTodos(opcion.valor)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            {opcion.etiqueta}
          </button>
        ))}
        {resumen.length > 0 && (
          <span className="ml-auto text-xs text-slate-500">
            {resumen.map((fila) => `${fila.etiqueta}: ${fila.total}`).join(" · ")}
          </span>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="pb-2 pr-3 font-medium">Matricula</th>
              <th className="pb-2 pr-3 font-medium">Alumno</th>
              <th className="pb-2 pr-3 font-medium">Asistencia</th>
              <th className="pb-2 font-medium">Nota</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {alumnos.map((alumno) => (
              <tr key={alumno.id}>
                <td className="py-2 pr-3 font-mono text-xs text-slate-500">{alumno.matricula}</td>
                <td className="py-2 pr-3 font-medium text-slate-800">{alumno.nombre}</td>
                <td className="py-2 pr-3">
                  <div className="flex flex-wrap gap-1">
                    {ESTADOS_ASISTENCIA.map((opcion) => (
                      <label
                        key={opcion.valor}
                        className={`cursor-pointer rounded-md border px-2 py-1 text-xs font-medium transition ${
                          marcas[alumno.id] === opcion.valor
                            ? "border-marca-600 bg-marca-50 text-marca-700"
                            : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                        }`}
                        title={opcion.etiqueta}
                      >
                        <input
                          type="radio"
                          name={`estado_${alumno.id}`}
                          value={opcion.valor}
                          checked={marcas[alumno.id] === opcion.valor}
                          onChange={() =>
                            setMarcas((previo) => ({ ...previo, [alumno.id]: opcion.valor }))
                          }
                          className="sr-only"
                        />
                        {opcion.corto}
                      </label>
                    ))}
                  </div>
                </td>
                <td className="py-2">
                  <input
                    name={`nota_${alumno.id}`}
                    defaultValue={alumno.observacion}
                    placeholder="Opcional"
                    className="campo py-1 text-xs"
                    aria-label={`Nota de ${alumno.nombre}`}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-slate-100 pt-3">
        <p className="text-xs text-slate-500">
          P presente · A ausente · R retardo · J justificada · S salida anticipada
        </p>
        <Boton type="submit" disabled={pendiente || cerrada}>
          {pendiente ? "Guardando..." : "Guardar asistencia"}
        </Boton>
      </div>
    </form>
  );
}
