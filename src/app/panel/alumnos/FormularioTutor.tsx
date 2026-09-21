"use client";

import { useActionState } from "react";
import { Alerta, Boton, Campo } from "@/components/ui";
import { agregarTutor, type EstadoFormulario } from "./acciones";

export default function FormularioTutor({ alumnoId }: { alumnoId: number }) {
  const [estado, accion, pendiente] = useActionState<EstadoFormulario, FormData>(agregarTutor, {});

  return (
    <form action={accion} className="space-y-3">
      <input type="hidden" name="alumnoId" value={alumnoId} />
      {estado.error && <Alerta tipo="error">{estado.error}</Alerta>}
      {estado.ok && estado.mensaje && <Alerta tipo="exito">{estado.mensaje}</Alerta>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Campo etiqueta="Nombre del tutor" name="nombre" required />
        <Campo etiqueta="Parentesco" name="parentesco" />
        <Campo etiqueta="Telefono" name="telefono" />
        <Campo etiqueta="Correo" name="email" type="email" />
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            name="esResponsableFinanciero"
            defaultChecked
            className="h-4 w-4 rounded border-slate-300 text-marca-600"
          />
          Responsable de pago
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            name="esContactoEmergencia"
            defaultChecked
            className="h-4 w-4 rounded border-slate-300 text-marca-600"
          />
          Contacto de emergencia
        </label>
        <Boton type="submit" variante="secundario" disabled={pendiente}>
          {pendiente ? "Agregando..." : "Agregar tutor"}
        </Boton>
      </div>
    </form>
  );
}
