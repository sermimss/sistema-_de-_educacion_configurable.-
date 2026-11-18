"use client";

import { useActionState } from "react";
import { Alerta, Boton, Campo } from "@/components/ui";
import { accionSolicitarAcceso, type EstadoRecuperar } from "./acciones";

export function FormularioRecuperar() {
  const [estado, accion, pendiente] = useActionState<EstadoRecuperar, FormData>(accionSolicitarAcceso, {});
  if (estado.enviado) {
    return (
      <Alerta tipo="exito">
        Listo. Si tu usuario existe, la administracion de tu colegio ya recibio tu solicitud y te dara una
        contrasena temporal. Al entrar con ella, el sistema te pedira cambiarla.
      </Alerta>
    );
  }
  return (
    <form action={accion} className="space-y-4">
      {estado.error && <Alerta tipo="error">{estado.error}</Alerta>}
      <Campo etiqueta="Tu usuario, matricula o correo" name="identificador" required autoFocus autoComplete="username" />
      <Campo
        etiqueta="Como te localizamos (opcional)"
        name="mensaje"
        placeholder="Grupo 2B, telefono 55..."
        ayuda="Para que la administracion sepa como entregarte la contrasena."
      />
      <Boton type="submit" className="w-full" disabled={pendiente}>
        {pendiente ? "Enviando..." : "Pedir una contrasena nueva"}
      </Boton>
    </form>
  );
}
