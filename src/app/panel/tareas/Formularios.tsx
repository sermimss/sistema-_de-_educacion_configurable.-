"use client";

import { useActionState, useRef } from "react";
import { Alerta, Boton, Campo, Selector } from "@/components/ui";
import { EXTENSIONES_ACEPTADAS, MAX_ARCHIVOS } from "@/lib/archivosEntrega";
import { accionCalificarEntrega, accionCrearTarea, accionEditarTarea, accionEntregarTarea, type EstadoTarea } from "./acciones";

function Mensajes({ estado }: { estado: EstadoTarea }) {
  return (
    <>
      {estado.error && <Alerta tipo="error">{estado.error}</Alerta>}
      {estado.ok && estado.mensaje && <Alerta tipo="exito">{estado.mensaje}</Alerta>}
    </>
  );
}

type DatosTarea = { id: number; titulo: string; instrucciones: string; puntosMaximos: number; fechaLimite: string; aceptaTardias: boolean };

/// Pedir una tarea nueva (con clase) o editar una existente.
export function FormularioTarea({
  clases,
  claseInicial,
  tarea,
  minimo,
}: {
  clases?: { id: number; etiqueta: string }[];
  claseInicial?: number;
  tarea?: DatosTarea;
  minimo?: string;
}) {
  const [estado, accion, pendiente] = useActionState<EstadoTarea, FormData>(tarea ? accionEditarTarea : accionCrearTarea, {});
  return (
    <form action={accion} className="space-y-3" data-formulario-tarea>
      {tarea && <input type="hidden" name="tareaId" value={tarea.id} />}
      <Mensajes estado={estado} />
      <div className="grid gap-3 sm:grid-cols-3">
        {clases && (
          <Selector etiqueta="Clase" name="claseId" required defaultValue={claseInicial ?? clases[0]?.id}>
            {clases.map((c) => (
              <option key={c.id} value={c.id}>{c.etiqueta}</option>
            ))}
          </Selector>
        )}
        <Campo etiqueta="Titulo" name="titulo" required maxLength={150} defaultValue={tarea?.titulo} className={clases ? "sm:col-span-2" : "sm:col-span-3"} />
      </div>
      <div>
        <label className="etiqueta-campo" htmlFor={`instrucciones-${tarea?.id ?? "nueva"}`}>Instrucciones</label>
        <textarea
          id={`instrucciones-${tarea?.id ?? "nueva"}`}
          name="instrucciones"
          required
          maxLength={5000}
          rows={4}
          className="campo"
          defaultValue={tarea?.instrucciones}
          placeholder="Que deben hacer y como entregarlo"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Campo etiqueta="Fecha y hora limite" name="fechaLimite" type="datetime-local" required min={minimo} defaultValue={tarea?.fechaLimite} />
        <Campo etiqueta="Vale (puntos)" name="puntosMaximos" type="number" min={0.01} max={1000} step="0.01" required defaultValue={tarea?.puntosMaximos ?? 10} />
        <label className="flex items-end gap-2 pb-2 text-sm text-slate-700">
          <input type="checkbox" name="aceptaTardias" defaultChecked={tarea?.aceptaTardias} className="h-4 w-4 rounded border-slate-300" />
          Aceptar entregas despues de la fecha (marcadas como tarde)
        </label>
      </div>
      <div className="flex justify-end">
        <Boton type="submit" disabled={pendiente}>{pendiente ? "Guardando..." : tarea ? "Guardar cambios" : "Pedir tarea"}</Boton>
      </div>
    </form>
  );
}

/// Entrega del alumno: hasta 3 archivos y un texto. Volver a entregar
/// reemplaza todo.
export function FormularioEntrega({ tareaId, yaEntrego }: { tareaId: number; yaEntrego: boolean }) {
  const [estado, accion, pendiente] = useActionState<EstadoTarea, FormData>(accionEntregarTarea, {});
  const archivos = useRef<HTMLInputElement>(null);
  return (
    <form
      action={accion}
      className="space-y-3"
      data-formulario-entrega
      onSubmit={(e) => {
        const n = archivos.current?.files?.length ?? 0;
        if (n > MAX_ARCHIVOS) {
          e.preventDefault();
          alert(`Puedes subir hasta ${MAX_ARCHIVOS} archivos.`);
        }
      }}
    >
      <input type="hidden" name="tareaId" value={tareaId} />
      <Mensajes estado={estado} />
      {yaEntrego && (
        <Alerta tipo="info">Si vuelves a entregar se reemplaza todo lo anterior: vuelve a subir todos tus archivos.</Alerta>
      )}
      <div>
        <label className="etiqueta-campo" htmlFor={`archivos-${tareaId}`}>Archivos (hasta {MAX_ARCHIVOS}, 10 MB cada uno)</label>
        <input id={`archivos-${tareaId}`} ref={archivos} type="file" name="archivos" multiple accept={EXTENSIONES_ACEPTADAS} className="campo" />
        <p className="mt-1 text-xs text-slate-500">PDF, Word, Excel, PowerPoint, texto o imagenes.</p>
      </div>
      <div>
        <label className="etiqueta-campo" htmlFor={`texto-${tareaId}`}>Respuesta o comentario (opcional)</label>
        <textarea id={`texto-${tareaId}`} name="texto" maxLength={5000} rows={4} className="campo" />
      </div>
      <div className="flex justify-end">
        <Boton type="submit" disabled={pendiente}>{pendiente ? "Subiendo..." : yaEntrego ? "Volver a entregar" : "Entregar tarea"}</Boton>
      </div>
    </form>
  );
}

export function FormularioCalificar({
  entregaId,
  maximo,
  calificacion,
  comentario,
}: {
  entregaId: number;
  maximo: number;
  calificacion: string;
  comentario: string;
}) {
  const [estado, accion, pendiente] = useActionState<EstadoTarea, FormData>(accionCalificarEntrega, {});
  return (
    <form action={accion} className="space-y-2" data-calificar={entregaId}>
      <input type="hidden" name="entregaId" value={entregaId} />
      <Mensajes estado={estado} />
      <div className="grid gap-2 sm:grid-cols-4">
        <Campo etiqueta={`Calificacion (de ${maximo})`} name="calificacion" type="number" min={0} max={maximo} step="0.01" required defaultValue={calificacion} />
        <Campo etiqueta="Comentario para el alumno" name="comentario" maxLength={2000} defaultValue={comentario} className="sm:col-span-3" />
      </div>
      <div className="flex justify-end">
        <Boton type="submit" variante="secundario" disabled={pendiente}>{pendiente ? "Guardando..." : "Guardar calificacion"}</Boton>
      </div>
    </form>
  );
}
