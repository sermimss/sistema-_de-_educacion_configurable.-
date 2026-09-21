"use client";

import { useActionState } from "react";
import { Alerta, Boton, Campo } from "@/components/ui";
import { cambiarPassword, type EstadoCambio } from "./acciones";

export default function FormularioCambio({ minimo }: { minimo: number }) {
  const [estado, accion, pendiente] = useActionState<EstadoCambio, FormData>(cambiarPassword, {});
  return (
    <form action={accion} className="space-y-4">
      {estado.error && <Alerta tipo="error">{estado.error}</Alerta>}
      <Campo etiqueta="Contrasena actual" name="actual" type="password" required autoComplete="current-password" />
      <Campo
        etiqueta="Nueva contrasena"
        name="nueva"
        type="password"
        required
        autoComplete="new-password"
        ayuda={`Minimo ${minimo} caracteres, con letras y numeros.`}
      />
      <Campo
        etiqueta="Confirma la nueva contrasena"
        name="confirmacion"
        type="password"
        required
        autoComplete="new-password"
      />
      <Boton type="submit" className="w-full" disabled={pendiente}>
        {pendiente ? "Guardando..." : "Cambiar contrasena"}
      </Boton>
    </form>
  );
}
