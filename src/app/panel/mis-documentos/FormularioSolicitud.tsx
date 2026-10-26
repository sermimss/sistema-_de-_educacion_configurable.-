"use client";

import { useActionState } from "react";
import { Alerta, Boton, Campo, Selector } from "@/components/ui";
import { accionSolicitar, type EstadoSolicitud } from "./acciones";

export function FormularioSolicitud({ documentos }: { documentos: { id: number; nombre: string }[] }) {
  const [estado, accion, pendiente] = useActionState<EstadoSolicitud, FormData>(accionSolicitar, {});
  return (
    <form action={accion} className="space-y-3">
      {estado.error && <Alerta tipo="error">{estado.error}</Alerta>}
      {estado.ok && estado.mensaje && <Alerta tipo="exito">{estado.mensaje}</Alerta>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Selector etiqueta="Documento" name="plantillaId" required>
          <option value="">Selecciona...</option>
          {documentos.map((d) => (
            <option key={d.id} value={d.id}>{d.nombre}</option>
          ))}
        </Selector>
        <Campo etiqueta="Para que lo necesitas" name="motivo" placeholder="Tramite de beca, empresa de practicas..." />
      </div>
      <div className="flex justify-end">
        <Boton type="submit" disabled={pendiente}>{pendiente ? "Enviando..." : "Solicitar"}</Boton>
      </div>
    </form>
  );
}
