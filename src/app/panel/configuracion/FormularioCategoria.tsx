"use client";

import { useActionState } from "react";
import { Alerta, Boton } from "@/components/ui";
import { guardarCategoria, type EstadoGuardado } from "./acciones";

type Parametro = {
  clave: string;
  valor: string;
  tipo: string;
  etiqueta: string;
  descripcion: string | null;
  opciones: unknown;
  editable: boolean;
};

export default function FormularioCategoria({
  categoria,
  parametros,
}: {
  categoria: string;
  parametros: Parametro[];
}) {
  const [estado, accion, pendiente] = useActionState<EstadoGuardado, FormData>(
    guardarCategoria,
    {}
  );

  return (
    <form action={accion} className="space-y-4">
      <input type="hidden" name="__categoria" value={categoria} />
      {estado.error && <Alerta tipo="error">{estado.error}</Alerta>}
      {estado.ok && estado.mensaje && <Alerta tipo="exito">{estado.mensaje}</Alerta>}

      <div className="divide-y divide-slate-100">
        {parametros.map((parametro) => (
          <div key={parametro.clave} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center">
            <div className="sm:w-1/2">
              <label htmlFor={parametro.clave} className="text-sm font-medium text-slate-800">
                {parametro.etiqueta}
              </label>
              {parametro.descripcion && (
                <p className="mt-0.5 text-xs text-slate-500">{parametro.descripcion}</p>
              )}
              <p className="mt-0.5 font-mono text-[10px] text-slate-400">{parametro.clave}</p>
            </div>
            <div className="sm:w-1/2">
              {parametro.tipo === "BOOLEANO" ? (
                <select
                  id={parametro.clave}
                  name={parametro.clave}
                  defaultValue={parametro.valor}
                  disabled={!parametro.editable}
                  className="campo"
                >
                  <option value="true">Si</option>
                  <option value="false">No</option>
                </select>
              ) : parametro.tipo === "OPCION" && Array.isArray(parametro.opciones) ? (
                <select
                  id={parametro.clave}
                  name={parametro.clave}
                  defaultValue={parametro.valor}
                  disabled={!parametro.editable}
                  className="campo"
                >
                  {(parametro.opciones as string[]).map((opcion) => (
                    <option key={opcion} value={opcion}>
                      {opcion}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id={parametro.clave}
                  name={parametro.clave}
                  defaultValue={parametro.valor}
                  disabled={!parametro.editable}
                  type={parametro.tipo === "NUMERO" ? "number" : "text"}
                  step="any"
                  className="campo"
                />
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <Boton type="submit" disabled={pendiente}>
          {pendiente ? "Guardando..." : "Guardar cambios"}
        </Boton>
      </div>
    </form>
  );
}
