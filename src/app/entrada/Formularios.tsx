"use client";

import { useActionState } from "react";
import { Alerta, Boton, Campo } from "@/components/ui";
import { canjearCodigoAlta, irAMiColegio, type EstadoEntrada } from "./acciones";

export function FormularioMiColegio() {
  const [estado, accion, pendiente] = useActionState<EstadoEntrada, FormData>(irAMiColegio, {});
  return (
    <form action={accion} className="space-y-3">
      {estado.error && <Alerta tipo="error">{estado.error}</Alerta>}
      <Campo
        etiqueta="Direccion de tu colegio"
        name="direccion"
        required
        placeholder="mi-colegio"
        ayuda="La que te compartio tu colegio. Tambien puedes pegarla completa."
      />
      <Boton type="submit" className="w-full" disabled={pendiente}>
        {pendiente ? "Buscando..." : "Ir a mi colegio"}
      </Boton>
    </form>
  );
}

export function FormularioCodigoAlta() {
  const [estado, accion, pendiente] = useActionState<EstadoEntrada, FormData>(
    canjearCodigoAlta,
    {}
  );
  return (
    <form action={accion} className="space-y-3">
      {estado.error && <Alerta tipo="error">{estado.error}</Alerta>}
      <Campo
        etiqueta="Codigo de alta"
        name="codigo"
        required
        autoComplete="off"
        placeholder="ALTA-XXXX-XXXX-XXXX"
        ayuda="Te lo entrega la administracion de la plataforma al contratar."
      />
      <Boton type="submit" className="w-full" disabled={pendiente}>
        {pendiente ? "Revisando..." : "Comenzar la configuracion"}
      </Boton>
    </form>
  );
}
