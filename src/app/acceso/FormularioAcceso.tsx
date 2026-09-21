"use client";

import { useActionState } from "react";
import { Alerta, Boton, Campo } from "@/components/ui";
import { accionAcceder, type EstadoAcceso } from "./acciones";

export default function FormularioAcceso({
  destino,
  reciénInstalado,
}: {
  destino: string;
  reciénInstalado: boolean;
}) {
  const [estado, accion, pendiente] = useActionState<EstadoAcceso, FormData>(accionAcceder, {});

  return (
    <form action={accion} className="space-y-4">
      {reciénInstalado && (
        <Alerta tipo="exito">
          Instalacion completada. Ingresa con la cuenta de administrador que acabas de crear.
        </Alerta>
      )}
      {estado.error && <Alerta tipo="error">{estado.error}</Alerta>}
      <input type="hidden" name="destino" value={destino} />
      <Campo
        etiqueta="Usuario, matricula o correo"
        name="identificador"
        autoComplete="username"
        required
        autoFocus
      />
      <Campo
        etiqueta="Contrasena"
        name="password"
        type="password"
        autoComplete="current-password"
        required
      />
      <Boton type="submit" className="w-full" disabled={pendiente}>
        {pendiente ? "Verificando..." : "Entrar"}
      </Boton>
    </form>
  );
}
