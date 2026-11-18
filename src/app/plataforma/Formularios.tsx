"use client";

import { useActionState } from "react";
import { Alerta, Boton, Campo } from "@/components/ui";
import {
  accionCrearCodigo,
  accionEntrarDueno,
  accionPrimerDueno,
  accionEnlaceRecuperacion,
  accionRecuperarDueno,
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

export function FormularioRecuperarDueno() {
  const [estado, accion, pendiente] = useActionState<EstadoDueno, FormData>(accionRecuperarDueno, {});
  return (
    <form action={accion} className="space-y-3">
      {estado.error && <Alerta tipo="error">{estado.error}</Alerta>}
      <Campo
        etiqueta="Clave de arranque"
        name="claveArranque"
        type="password"
        required
        autoComplete="off"
        ayuda="La variable PLATAFORMA_CLAVE_ARRANQUE del servidor. En Render: tu servicio, Environment."
      />
      <Campo etiqueta="Contrasena nueva" name="password" type="password" required autoComplete="new-password" ayuda="Minimo 10 caracteres." />
      <Campo etiqueta="Confirma la contrasena" name="confirmacion" type="password" required autoComplete="new-password" />
      <Boton type="submit" className="w-full" disabled={pendiente}>
        {pendiente ? "Revisando..." : "Poner contrasena nueva y entrar"}
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

export function BotonEnlaceRecuperacion({ colegioId, nombre }: { colegioId: number; nombre: string }) {
  const [estado, accion, pendiente] = useActionState<EstadoDueno, FormData>(accionEnlaceRecuperacion, {});
  return (
    <form action={accion} className="space-y-1">
      <input type="hidden" name="colegioId" value={colegioId} />
      <button
        type="submit"
        disabled={pendiente}
        className="rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
        title={`Para que el administrador de ${nombre} recupere su acceso`}
      >
        {pendiente ? "..." : "Enlace de recuperacion"}
      </button>
      {estado.error && <p className="text-xs text-red-600">{estado.error}</p>}
      {estado.enlace && (
        <div className="max-w-xs rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-left text-xs text-slate-700">
          <p className="break-all font-mono select-all" data-enlace-recuperacion>{estado.enlace}</p>
          <p className="mt-1">Envialo al administrador de {nombre}. Sirve una vez y vence en 1 hora.</p>
        </div>
      )}
    </form>
  );
}

