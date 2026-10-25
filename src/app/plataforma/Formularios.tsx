"use client";

import { useActionState } from "react";
import { Alerta, Boton, Campo } from "@/components/ui";
import {
  accionCrearCodigo,
  accionEntrarDueno,
  accionPrimerDueno,
  type EstadoDueno,
} from "./acciones";

export function FormularioPrimerDueno() {
  const [estado, accion, pendiente] = useActionState<EstadoDueno, FormData>(accionPrimerDueno, {});
  return (
    <form action={accion} className="space-y-3">
      {estado.error && <Alerta tipo="error">{estado.error}</Alerta>}
      <Campo
        etiqueta="Clave de arranque"
        name="claveArranque"
        type="password"
        required
        autoComplete="off"
        ayuda="La que pusiste en PLATAFORMA_CLAVE_ARRANQUE en el entorno del servidor."
      />
      <Campo etiqueta="Usuario" name="usuario" required autoComplete="username" />
      <Campo etiqueta="Contrasena" name="password" type="password" required autoComplete="new-password" ayuda="Minimo 10 caracteres." />
      <Campo etiqueta="Confirma la contrasena" name="confirmacion" type="password" required autoComplete="new-password" />
      <Boton type="submit" className="w-full" disabled={pendiente}>
        {pendiente ? "Creando..." : "Crear mi cuenta de dueno"}
      </Boton>
    </form>
  );
}

export function FormularioEntrarDueno() {
  const [estado, accion, pendiente] = useActionState<EstadoDueno, FormData>(accionEntrarDueno, {});
  return (
    <form action={accion} className="space-y-3">
      {estado.error && <Alerta tipo="error">{estado.error}</Alerta>}
      <Campo etiqueta="Usuario" name="usuario" required autoComplete="username" />
      <Campo etiqueta="Contrasena" name="password" type="password" required autoComplete="current-password" />
      <Boton type="submit" className="w-full" disabled={pendiente}>
        {pendiente ? "Verificando..." : "Entrar"}
      </Boton>
    </form>
  );
}

export function FormularioNuevoCodigo() {
  const [estado, accion, pendiente] = useActionState<EstadoDueno, FormData>(accionCrearCodigo, {});
  return (
    <form action={accion} className="space-y-3">
      {estado.ok && estado.codigo && (
        <Alerta tipo="exito">
          <p>{estado.mensaje}</p>
          <p className="mt-2 select-all font-mono text-base font-semibold" data-codigo-alta>
            {estado.codigo}
          </p>
        </Alerta>
      )}
      <div className="flex flex-wrap items-end gap-3">
        <Campo
          etiqueta="Para quien es"
          name="etiqueta"
          className="min-w-[16rem] flex-1"
          placeholder="Colegio Vanguardia, contacto Maria"
        />
        <Boton type="submit" disabled={pendiente}>
          {pendiente ? "Generando..." : "Generar codigo de alta"}
        </Boton>
      </div>
    </form>
  );
}
