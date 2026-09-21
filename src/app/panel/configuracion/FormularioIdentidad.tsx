"use client";

import { useActionState } from "react";
import { Alerta, Boton, Campo } from "@/components/ui";
import { guardarIdentidad, type EstadoGuardado } from "./acciones";

type Identidad = {
  nombre: string;
  nombreCorto: string | null;
  lema: string | null;
  logoUrl: string | null;
  colorPrimario: string;
  colorSecundario: string;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  razonSocial: string | null;
  rfc: string | null;
  regimenFiscal: string | null;
};

export default function FormularioIdentidad({ institucion }: { institucion: Identidad }) {
  const [estado, accion, pendiente] = useActionState<EstadoGuardado, FormData>(
    guardarIdentidad,
    {}
  );

  return (
    <form action={accion} className="space-y-4">
      {estado.error && <Alerta tipo="error">{estado.error}</Alerta>}
      {estado.ok && estado.mensaje && <Alerta tipo="exito">{estado.mensaje}</Alerta>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Nombre" name="nombre" defaultValue={institucion.nombre} required />
        <Campo etiqueta="Nombre corto" name="nombreCorto" defaultValue={institucion.nombreCorto ?? ""} />
        <Campo etiqueta="Lema" name="lema" defaultValue={institucion.lema ?? ""} className="sm:col-span-2" />
        <Campo
          etiqueta="URL del logo"
          name="logoUrl"
          defaultValue={institucion.logoUrl ?? ""}
          className="sm:col-span-2"
          ayuda="Se usa en el acceso, el panel, las boletas y los recibos."
        />
        <Campo etiqueta="Color principal" name="colorPrimario" type="color" defaultValue={institucion.colorPrimario} />
        <Campo etiqueta="Color secundario" name="colorSecundario" type="color" defaultValue={institucion.colorSecundario} />
        <Campo etiqueta="Telefono" name="telefono" defaultValue={institucion.telefono ?? ""} />
        <Campo etiqueta="Correo" name="email" type="email" defaultValue={institucion.email ?? ""} />
        <Campo etiqueta="Direccion" name="direccion" defaultValue={institucion.direccion ?? ""} className="sm:col-span-2" />
        <Campo etiqueta="Razon social" name="razonSocial" defaultValue={institucion.razonSocial ?? ""} />
        <Campo etiqueta="RFC" name="rfc" defaultValue={institucion.rfc ?? ""} />
        <Campo etiqueta="Regimen fiscal" name="regimenFiscal" defaultValue={institucion.regimenFiscal ?? ""} />
      </div>
      <div className="flex justify-end">
        <Boton type="submit" disabled={pendiente}>
          {pendiente ? "Guardando..." : "Guardar identidad"}
        </Boton>
      </div>
    </form>
  );
}
