"use client";

import { useActionState, useEffect, useState } from "react";
import { Alerta, Boton } from "@/components/ui";
import { EJEMPLO_EXAMEN } from "@/lib/importarExamen";
import { accionConfirmarImportacion, accionVistaImportacion, type VistaImportacion } from "./acciones";

const TIPO: Record<string, string> = {
  OPCION_UNICA: "Opcion multiple",
  OPCION_MULTIPLE: "Varias correctas",
  VERDADERO_FALSO: "Verdadero o falso",
  ABIERTA: "Abierta",
};

/// Cargar un examen ya escrito: se pega el texto o se sube un .txt/.docx, se
/// ve como se entendio cada pregunta y se confirma.
export function ImportarExamen({ examenId }: { examenId: number }) {
  const [vista, verVista, leyendo] = useActionState<VistaImportacion, FormData>(accionVistaImportacion, {});
  const [confirmacion, confirmar, agregando] = useActionState<VistaImportacion, FormData>(accionConfirmarImportacion, {});
  const [texto, setTexto] = useState("");
  const [mostrarVista, setMostrarVista] = useState(false);

  // Lo que se leyo de un archivo pasa al recuadro, para corregirlo ahi.
  useEffect(() => {
    if (vista.texto != null) setTexto(vista.texto);
    setMostrarVista(true);
  }, [vista]);
  useEffect(() => {
    if (confirmacion.agregadas) {
      setTexto("");
      setMostrarVista(false);
    }
  }, [confirmacion]);

  const resultado = confirmacion.errores ? confirmacion : vista;
  const listo = mostrarVista && resultado.preguntas && resultado.preguntas.length > 0 && resultado.errores?.length === 0;

  return (
    <div className="space-y-4" data-importar-examen>
      {confirmacion.agregadas ? (
        <Alerta tipo="exito">Se agregaron {confirmacion.agregadas} pregunta(s) al examen. Revisalas abajo antes de publicarlo.</Alerta>
      ) : null}
      <details className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
        <summary className="cursor-pointer font-medium">Como escribir el examen</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Cada pregunta empieza con su numero: <code>1.</code> o <code>1)</code>. Puede ocupar varios renglones.</li>
          <li>Las opciones empiezan con una letra: <code>a)</code> o <code>a.</code> (hasta 6).</li>
          <li>Marca la correcta con un asterisco: <code>*b) 4</code>, o con un renglon <code>Respuesta: b</code>. Si marcas varias, es de varias correctas.</li>
          <li>Verdadero o falso: sin opciones y con <code>Respuesta: Verdadero</code> o <code>Respuesta: Falso</code>.</li>
          <li>Pregunta abierta: sin opciones ni respuesta.</li>
          <li>Puntos al final de la pregunta: <code>(2 puntos)</code>. Si no los pones, vale 1.</li>
          <li>En Word puedes usar la numeracion automatica: las preguntas en el primer nivel y las opciones en el segundo.</li>
        </ul>
        <button type="button" onClick={() => setTexto(EJEMPLO_EXAMEN)} className="mt-2 text-sm font-medium text-marca-600 hover:underline">
          Poner un ejemplo en el recuadro
        </button>
      </details>

      <form action={verVista} className="space-y-3">
        <input type="hidden" name="examenId" value={examenId} />
        {vista.error && <Alerta tipo="error">{vista.error}</Alerta>}
        <div>
          <label className="etiqueta-campo" htmlFor={`texto-examen-${examenId}`}>Texto del examen</label>
          <textarea
            id={`texto-examen-${examenId}`}
            name="texto"
            rows={10}
            className="campo font-mono text-xs"
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value);
              setMostrarVista(false);
            }}
            placeholder={"1. ¿Cuanto es 2 + 2?\na) 3\n*b) 4\nc) 5"}
          />
        </div>
        <div>
          <label className="etiqueta-campo" htmlFor={`archivo-examen-${examenId}`}>O sube el archivo (.txt o .docx de Word)</label>
          <input id={`archivo-examen-${examenId}`} type="file" name="archivo" accept=".txt,.docx" className="campo" />
        </div>
        <div className="flex justify-end">
          <Boton type="submit" variante="secundario" disabled={leyendo}>{leyendo ? "Leyendo..." : "Ver vista previa"}</Boton>
        </div>
      </form>

      {mostrarVista && resultado.preguntas && (
        <div className="space-y-3 border-t border-slate-100 pt-4" data-vista-importacion>
          {confirmacion.error && <Alerta tipo="error">{confirmacion.error}</Alerta>}
          {resultado.errores && resultado.errores.length > 0 && (
            <Alerta tipo="error">
              Hay {resultado.errores.length} problema(s); corrigelos en el recuadro y vuelve a ver la vista previa:
              <ul className="mt-1 list-disc pl-5" data-errores-importacion>
                {resultado.errores.map((e, i) => (
                  <li key={i}>Renglon {e.linea}: {e.mensaje}</li>
                ))}
              </ul>
            </Alerta>
          )}
          {resultado.preguntas.length > 0 && (
            <>
              <p className="text-sm text-slate-700">
                Entendi {resultado.preguntas.length} pregunta(s), {resultado.preguntas.reduce((s, p) => s + p.puntos, 0)} puntos:
              </p>
              <ol className="space-y-2">
                {resultado.preguntas.map((p, i) => (
                  <li key={i} className="rounded-lg border border-slate-200 p-3 text-sm" data-pregunta-leida={i + 1}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="whitespace-pre-line font-medium text-slate-900">{i + 1}. {p.enunciado}</p>
                      <span className="shrink-0 text-xs text-slate-500">{TIPO[p.tipo]} · {p.puntos} pt(s)</span>
                    </div>
                    {p.opciones.length > 0 && (
                      <ul className="mt-1 space-y-0.5">
                        {p.opciones.map((o, j) => (
                          <li key={j} className={o.correcta ? "font-medium text-emerald-700" : "text-slate-600"}>
                            {o.correcta ? "✓" : "·"} {o.texto}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ol>
            </>
          )}
          {listo && (
            <form action={confirmar} className="flex justify-end">
              <input type="hidden" name="examenId" value={examenId} />
              <input type="hidden" name="texto" value={texto} />
              <Boton type="submit" disabled={agregando}>
                {agregando ? "Agregando..." : `Agregar ${resultado.preguntas!.length} pregunta(s) al examen`}
              </Boton>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
