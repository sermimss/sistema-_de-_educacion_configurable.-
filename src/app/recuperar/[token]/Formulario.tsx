"use client";

import { useActionState } from "react";
import { Alerta, Boton, Campo, Selector } from "@/components/ui";
import { accionRecuperarAdministrador, type EstadoRecuperacion } from "./acciones";

export function FormularioRecuperarAdministrador({
  token,
  cuentas,
}: {
  token: string;
  cuentas: { id: number; etiqueta: string }[];
}) {
  const [estado, accion, pendiente] = useActionState<EstadoRecuperacion, FormData>(accionRecuperarAdministrador, {});
  return (
    <form action={accion} className="space-y-3">
      <input type="hidden" name="token" value={token} />
      {estado.error && <Alerta tipo="error">{estado.error}</Alerta>}
      {cuentas.length === 1 ? (
        <>
          <input type="hidden" name="usuarioId" value={cuentas[0].id} />
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
            Tu usuario es <strong data-usuario-recuperado>{cuentas[0].etiqueta}</strong>
          </p>
        </>
      ) : (
        <Selector etiqueta="Cuenta de administrador" name="usuarioId" required>
          <option value="">Selecciona...</option>
          {cuentas.map((c) => (
            <option key={c.id} value={c.id}>{c.etiqueta}</option>
          ))}
        </Selector>
      )}
      <Campo etiqueta="Contrasena nueva" name="password" type="password" required autoComplete="new-password" ayuda="Minimo 8 caracteres, con letras y numeros." />
      <Campo etiqueta="Confirma la contrasena" name="confirmacion" type="password" required autoComplete="new-password" />
      <Boton type="submit" className="w-full" disabled={pendiente}>
        {pendiente ? "Guardando..." : "Guardar y entrar a mi colegio"}
      </Boton>
    </form>
  );
}
