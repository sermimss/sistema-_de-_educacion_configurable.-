"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";
import { Alerta, Boton, Campo, Selector } from "@/components/ui";
import { SelectorArchivos } from "@/components/SelectorArchivos";
import { accionPublicarAviso, type EstadoAviso } from "./acciones";

export function FormularioAviso({ destinos }: { destinos: { valor: string; etiqueta: string }[] }) {
  const [estado, accion, pendiente] = useActionState<EstadoAviso, FormData>(accionPublicarAviso, {});
  const formulario = useRef<HTMLFormElement>(null);
  // Se limpia solo al publicarse; con un error se conserva lo escrito y los archivos.
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
      data-formulario-aviso
    >
      {estado.error && <Alerta tipo="error">{estado.error}</Alerta>}
      {estado.ok && estado.mensaje && <Alerta tipo="exito">{estado.mensaje}</Alerta>}
      <div className="grid gap-3 sm:grid-cols-3">
        <Campo etiqueta="Titulo" name="titulo" required maxLength={150} className="sm:col-span-2" />
        <Selector etiqueta="Para" name="para" required>
          {destinos.map((d) => (
            <option key={d.valor} value={d.valor}>{d.etiqueta}</option>
          ))}
        </Selector>
      </div>
      <div>
        <label className="etiqueta-campo" htmlFor="contenido-aviso">Aviso</label>
        <textarea id="contenido-aviso" name="contenido" required maxLength={3000} rows={4} className="campo" />
      </div>
      <SelectorArchivos etiqueta="Imagenes o archivos" />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Campo etiqueta="Visible hasta (opcional)" name="vigenciaHasta" type="date" ayuda="Vacio: hasta que lo retires" />
        <Boton type="submit" disabled={pendiente}>{pendiente ? "Publicando..." : "Publicar aviso"}</Boton>
      </div>
    </form>
  );
}
