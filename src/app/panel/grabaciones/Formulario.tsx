"use client";

import { useActionState, useState } from "react";
import { Alerta, Boton, Campo, Selector } from "@/components/ui";
import { aFechaDia, fechaDeVencimiento } from "@/lib/grabaciones";
import { accionPublicarGrabacion, type EstadoGrabacion } from "./acciones";

function diaLegible(texto: string): string {
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "long", timeZone: "UTC" }).format(aFechaDia(texto));
}

export function FormularioGrabacion({
  clases,
  claseInicial,
  hoy,
}: {
  clases: { id: number; etiqueta: string }[];
  claseInicial?: number;
  hoy: string;
}) {
  const [estado, accion, pendiente] = useActionState<EstadoGrabacion, FormData>(accionPublicarGrabacion, {});
  const [fecha, setFecha] = useState(hoy);
  const fechaValida = /^\d{4}-\d{2}-\d{2}$/.test(fecha) && fecha <= hoy;

  return (
    <form action={accion} className="space-y-3">
      {estado.error && <Alerta tipo="error">{estado.error}</Alerta>}
      {estado.ok && estado.mensaje && <Alerta tipo="exito">{estado.mensaje}</Alerta>}
      <div className="grid gap-3 sm:grid-cols-3">
        <Selector etiqueta="Clase" name="claseId" required defaultValue={claseInicial ?? clases[0]?.id} className="sm:col-span-2">
          {clases.map((c) => (
            <option key={c.id} value={c.id}>{c.etiqueta}</option>
          ))}
        </Selector>
        <Campo
          etiqueta="Fecha de la clase"
          name="fechaClase"
          type="date"
          required
          max={hoy}
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
        />
      </div>
      <Campo etiqueta="Titulo (opcional)" name="titulo" maxLength={150} placeholder="Por ejemplo: Tema 3, derivadas" />
      <Campo
        etiqueta="Enlace de la grabacion"
        name="enlace"
        required
        placeholder="https://drive.google.com/file/d/..."
        ayuda="Meet la guarda en tu Google Drive, en la carpeta Meet Recordings. Abrela, usa Compartir y copia el enlace."
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600" data-vence>
          {fechaValida ? (
            <>Tus alumnos la podran ver hasta el <strong>{diaLegible(fechaDeVencimiento(fecha))}</strong>.</>
          ) : (
            "Elige la fecha de la clase."
          )}
        </p>
        <Boton type="submit" disabled={pendiente}>{pendiente ? "Publicando..." : "Publicar grabacion"}</Boton>
      </div>
    </form>
  );
}
