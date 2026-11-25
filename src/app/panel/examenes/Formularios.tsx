"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import type { MostrarRespuestas, TipoPregunta } from "@prisma/client";
import { Alerta, Boton, Campo, Selector } from "@/components/ui";
import { accionAgregarPregunta, accionCalificarRespuesta, accionCrearExamen, accionEditarExamen, type EstadoExamen } from "./acciones";

function Mensajes({ estado }: { estado: EstadoExamen }) {
  return (
    <>
      {estado.error && <Alerta tipo="error">{estado.error}</Alerta>}
      {estado.ok && estado.mensaje && <Alerta tipo="exito">{estado.mensaje}</Alerta>}
    </>
  );
}

export type ConfigExamen = {
  id: number;
  titulo: string;
  instrucciones: string;
  abreEn: string;
  cierraEn: string;
  duracionMinutos: string;
  aceptaTardios: boolean;
  desordenar: boolean;
  mostrarRespuestas: MostrarRespuestas;
};

export function FormularioExamen({
  clases,
  claseInicial,
  examen,
  ahora,
}: {
  clases?: { id: number; etiqueta: string }[];
  claseInicial?: number;
  examen?: ConfigExamen;
  ahora?: string;
}) {
  const [estado, accion, pendiente] = useActionState<EstadoExamen, FormData>(examen ? accionEditarExamen : accionCrearExamen, {});
  return (
    <form action={accion} className="space-y-3" data-formulario-examen>
      {examen && <input type="hidden" name="examenId" value={examen.id} />}
      <Mensajes estado={estado} />
      <div className="grid gap-3 sm:grid-cols-3">
        {clases && (
          <Selector etiqueta="Clase" name="claseId" required defaultValue={claseInicial ?? clases[0]?.id}>
            {clases.map((c) => (
              <option key={c.id} value={c.id}>{c.etiqueta}</option>
            ))}
          </Selector>
        )}
        <Campo etiqueta="Titulo" name="titulo" required maxLength={150} defaultValue={examen?.titulo} className={clases ? "sm:col-span-2" : "sm:col-span-3"} />
      </div>
      <div>
        <label className="etiqueta-campo" htmlFor={`instrucciones-examen-${examen?.id ?? "nuevo"}`}>Instrucciones (opcional)</label>
        <textarea id={`instrucciones-examen-${examen?.id ?? "nuevo"}`} name="instrucciones" maxLength={3000} rows={2} className="campo" defaultValue={examen?.instrucciones} />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Campo etiqueta="Abre" name="abreEn" type="datetime-local" required defaultValue={examen?.abreEn ?? ahora} />
        <Campo etiqueta="Cierra" name="cierraEn" type="datetime-local" required defaultValue={examen?.cierraEn} />
        <Campo etiqueta="Tiempo limite en minutos (opcional)" name="duracionMinutos" type="number" min={1} max={600} defaultValue={examen?.duracionMinutos} ayuda="Vacio: sin limite, hasta el cierre" />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Selector etiqueta="El alumno ve sus respuestas correctas" name="mostrarRespuestas" defaultValue={examen?.mostrarRespuestas ?? "NUNCA"}>
          <option value="NUNCA">Nunca (solo su calificacion)</option>
          <option value="AL_TERMINAR">Al terminar su examen</option>
          <option value="AL_CERRAR">Cuando cierre el examen</option>
        </Selector>
        <label className="flex items-end gap-2 pb-2 text-sm text-slate-700">
          <input type="checkbox" name="desordenar" defaultChecked={examen?.desordenar} className="h-4 w-4 rounded border-slate-300" />
          Preguntas y opciones en desorden para cada alumno
        </label>
        <label className="flex items-end gap-2 pb-2 text-sm text-slate-700">
          <input type="checkbox" name="aceptaTardios" defaultChecked={examen?.aceptaTardios} className="h-4 w-4 rounded border-slate-300" />
          Permitir presentarlo despues del cierre (marcado como tarde)
        </label>
      </div>
      <div className="flex justify-end">
        <Boton type="submit" disabled={pendiente}>{pendiente ? "Guardando..." : examen ? "Guardar datos" : "Crear examen y agregar preguntas"}</Boton>
      </div>
    </form>
  );
}

const TIPOS: { valor: TipoPregunta; texto: string }[] = [
  { valor: "OPCION_UNICA", texto: "Opcion multiple (una correcta)" },
  { valor: "OPCION_MULTIPLE", texto: "Varias correctas" },
  { valor: "VERDADERO_FALSO", texto: "Verdadero o falso" },
  { valor: "ABIERTA", texto: "Respuesta abierta" },
];

export function FormularioPregunta({ examenId }: { examenId: number }) {
  const [estado, accion, pendiente] = useActionState<EstadoExamen, FormData>(accionAgregarPregunta, {});
  const [tipo, setTipo] = useState<TipoPregunta>("OPCION_UNICA");
  const formulario = useRef<HTMLFormElement>(null);
  // Se vacia solo cuando la pregunta se agrego; si hay error, se conserva lo escrito.
  useEffect(() => {
    if (estado.ok) formulario.current?.reset();
  }, [estado]);
  return (
    <form
      ref={formulario}
      onSubmit={(e) => {
        e.preventDefault();
        const datos = new FormData(e.currentTarget);
        startTransition(() => accion(datos));
      }}
      className="space-y-3"
      data-formulario-pregunta
    >
      <input type="hidden" name="examenId" value={examenId} />
      <Mensajes estado={estado} />
      <div className="grid gap-3 sm:grid-cols-4">
        <Selector etiqueta="Tipo de pregunta" name="tipo" value={tipo} onChange={(e) => setTipo(e.target.value as TipoPregunta)} className="sm:col-span-3">
          {TIPOS.map((t) => (
            <option key={t.valor} value={t.valor}>{t.texto}</option>
          ))}
        </Selector>
        <Campo etiqueta="Puntos" name="puntos" type="number" min={0.01} step="0.01" required defaultValue={1} />
      </div>
      <div>
        <label className="etiqueta-campo" htmlFor={`enunciado-${examenId}`}>Pregunta</label>
        <textarea id={`enunciado-${examenId}`} name="enunciado" required maxLength={3000} rows={2} className="campo" />
      </div>
      {(tipo === "OPCION_UNICA" || tipo === "OPCION_MULTIPLE") && (
        <fieldset className="space-y-2">
          <legend className="etiqueta-campo">
            Opciones ({tipo === "OPCION_UNICA" ? "marca la correcta" : "marca todas las correctas"}; las vacias no se usan)
          </legend>
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type={tipo === "OPCION_UNICA" ? "radio" : "checkbox"}
                name="correcta"
                value={i}
                aria-label={`Opcion ${i + 1} es correcta`}
                className="h-4 w-4"
              />
              <input name={`opcion${i}`} maxLength={500} className="campo" aria-label={`Opcion ${i + 1}`} placeholder={`Opcion ${i + 1}`} />
            </div>
          ))}
        </fieldset>
      )}
      {tipo === "VERDADERO_FALSO" && (
        <fieldset className="flex gap-4 text-sm text-slate-700">
          <legend className="etiqueta-campo">La respuesta correcta es</legend>
          <label className="flex items-center gap-2"><input type="radio" name="respuestaVF" value="V" /> Verdadero</label>
          <label className="flex items-center gap-2"><input type="radio" name="respuestaVF" value="F" /> Falso</label>
        </fieldset>
      )}
      {tipo === "ABIERTA" && <p className="text-xs text-slate-500">El alumno escribe su respuesta y tu la calificas al revisar.</p>}
      <div className="flex justify-end">
        <Boton type="submit" variante="secundario" disabled={pendiente}>{pendiente ? "Agregando..." : "Agregar pregunta"}</Boton>
      </div>
    </form>
  );
}

export function FormularioCalificarRespuesta({
  respuestaId,
  maximo,
  puntos,
  comentario,
}: {
  respuestaId: number;
  maximo: number;
  puntos: string;
  comentario: string;
}) {
  const [estado, accion, pendiente] = useActionState<EstadoExamen, FormData>(accionCalificarRespuesta, {});
  return (
    <form action={accion} className="space-y-2" data-calificar-respuesta={respuestaId}>
      <input type="hidden" name="respuestaId" value={respuestaId} />
      <Mensajes estado={estado} />
      <div className="grid gap-2 sm:grid-cols-4">
        <Campo etiqueta={`Puntos (de ${maximo})`} name="puntos" type="number" min={0} max={maximo} step="0.01" required defaultValue={puntos} />
        <Campo etiqueta="Comentario" name="comentario" maxLength={1000} defaultValue={comentario} className="sm:col-span-3" />
      </div>
      <div className="flex justify-end">
        <Boton type="submit" variante="secundario" disabled={pendiente}>{pendiente ? "Guardando..." : "Guardar"}</Boton>
      </div>
    </form>
  );
}
