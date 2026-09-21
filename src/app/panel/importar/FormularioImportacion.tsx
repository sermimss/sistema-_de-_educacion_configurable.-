"use client";

import { useActionState, useState } from "react";
import { Alerta, Boton, Tarjeta } from "@/components/ui";
import { importarCsv, type ResultadoImportacion } from "./acciones";

const TIPOS = [
  { valor: "alumnos", etiqueta: "Alumnos" },
  { valor: "personal", etiqueta: "Personal y docentes" },
  { valor: "materias", etiqueta: "Materias" },
];

export default function FormularioImportacion({
  tipoInicial,
  columnas,
}: {
  tipoInicial: string;
  columnas: Record<string, { obligatorias: string[]; opcionales: string[] }>;
}) {
  const [tipo, setTipo] = useState(tipoInicial);
  const [estado, accion, pendiente] = useActionState<ResultadoImportacion, FormData>(
    importarCsv,
    {}
  );

  const definicion = columnas[tipo];

  return (
    <div className="space-y-4">
      <Tarjeta titulo="Que vas a importar">
        <div className="flex flex-wrap gap-2">
          {TIPOS.map((opcion) => (
            <button
              key={opcion.valor}
              type="button"
              onClick={() => setTipo(opcion.valor)}
              className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
                tipo === opcion.valor
                  ? "border-marca-600 bg-marca-50 text-marca-700"
                  : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {opcion.etiqueta}
            </button>
          ))}
        </div>

        <div className="mt-4 space-y-2 text-sm">
          <p className="text-slate-700">
            <span className="font-medium">Columnas obligatorias:</span>{" "}
            <code className="text-xs">{definicion.obligatorias.join(", ")}</code>
          </p>
          <p className="text-slate-600">
            <span className="font-medium">Opcionales:</span>{" "}
            <code className="text-xs">{definicion.opcionales.join(", ")}</code>
          </p>
          <a
            href={`/panel/importar/plantilla?tipo=${tipo}`}
            className="inline-block font-medium text-marca-600 hover:underline"
          >
            Descargar plantilla de {tipo} →
          </a>
        </div>
      </Tarjeta>

      <form action={accion}>
        <Tarjeta titulo="Archivo">
          <input type="hidden" name="tipo" value={tipo} />
          <div className="space-y-4">
            <div>
              <label className="etiqueta-campo" htmlFor="archivo">
                Archivo CSV
              </label>
              <input
                id="archivo"
                type="file"
                name="archivo"
                accept=".csv,text/csv"
                className="campo file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:text-sm"
              />
              <p className="mt-1 text-xs text-slate-500">
                Separador coma o punto y coma. Maximo 5 MB.
              </p>
            </div>
            <div>
              <label className="etiqueta-campo" htmlFor="contenido">
                O pega el contenido aqui
              </label>
              <textarea
                id="contenido"
                name="contenido"
                rows={6}
                className="campo font-mono text-xs"
                placeholder="clave,nombre&#10;MAT-101,Matematicas I"
              />
            </div>
            <div className="flex justify-end">
              <Boton type="submit" disabled={pendiente}>
                {pendiente ? "Importando..." : "Importar"}
              </Boton>
            </div>
          </div>
        </Tarjeta>
      </form>

      {estado.error && <Alerta tipo="error">{estado.error}</Alerta>}

      {estado.ok && (
        <Tarjeta titulo="Resultado de la importacion">
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-slate-200 px-4 py-3">
                <p className="text-xs uppercase text-slate-500">Filas leidas</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">{estado.total}</p>
              </div>
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
                <p className="text-xs uppercase text-emerald-700">Importados</p>
                <p className="mt-1 text-xl font-semibold text-emerald-800">{estado.exitosos}</p>
              </div>
              <div
                className={`rounded-lg border px-4 py-3 ${
                  estado.fallidos ? "border-red-200 bg-red-50" : "border-slate-200"
                }`}
              >
                <p className="text-xs uppercase text-slate-500">Con error</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">{estado.fallidos}</p>
              </div>
            </div>

            {estado.errores && estado.errores.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-medium text-slate-700">
                  Filas que no se pudieron importar:
                </p>
                <ul className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-3 text-sm">
                  {estado.errores.map((error) => (
                    <li key={error.fila} className="text-slate-600">
                      <span className="font-mono text-xs text-slate-400">Fila {error.fila}:</span>{" "}
                      {error.mensaje}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-slate-500">
                  Las filas correctas si se importaron. Corrige las que fallaron y vuelve a subir
                  solo esas.
                </p>
              </div>
            )}
          </div>
        </Tarjeta>
      )}
    </div>
  );
}
