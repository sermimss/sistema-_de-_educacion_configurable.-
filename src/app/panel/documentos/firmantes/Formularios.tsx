"use client";

import { useActionState, useState } from "react";
import { Alerta, Boton, Campo, Selector } from "@/components/ui";
import { accionFirmanteParaTodos, accionGuardarFirmante, type EstadoDocumentos } from "../acciones";

function ImagenElegida({ nombre, etiqueta, actual }: { nombre: string; etiqueta: string; actual: string | null }) {
  const [vista, setVista] = useState<string | null>(actual);
  const [quitar, setQuitar] = useState(false);
  return (
    <div>
      <label className="etiqueta-campo" htmlFor={`${nombre}-${etiqueta}`}>{etiqueta}</label>
      <div className="flex items-center gap-3">
        <div className="flex h-16 w-24 items-center justify-center rounded border border-dashed border-slate-300 bg-white">
          {vista && !quitar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={vista} alt="" className="max-h-14 max-w-[5.5rem] object-contain" />
          ) : (
            <span className="text-[10px] text-slate-400">sin imagen</span>
          )}
        </div>
        <div className="space-y-1">
          <input
            id={`${nombre}-${etiqueta}`}
            name={nombre}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => {
              const archivo = e.target.files?.[0];
              if (archivo) {
                setQuitar(false);
                setVista(URL.createObjectURL(archivo));
              }
            }}
            className="block text-xs text-slate-600"
          />
          {actual && (
            <label className="flex items-center gap-1 text-xs text-slate-600">
              <input
                type="checkbox"
                name={nombre === "firma" ? "quitarFirma" : "quitarSello"}
                checked={quitar}
                onChange={(e) => setQuitar(e.target.checked)}
              />
              Quitar
            </label>
          )}
        </div>
      </div>
    </div>
  );
}

export function FormularioFirmante({
  firmante,
}: {
  firmante?: { id: number; nombre: string; cargo: string; activo: boolean; firma: string | null; sello: string | null };
}) {
  const [estado, accion, pendiente] = useActionState<EstadoDocumentos, FormData>(accionGuardarFirmante, {});
  return (
    <form action={accion} className="space-y-3">
      {firmante && <input type="hidden" name="id" value={firmante.id} />}
      {estado.error && <Alerta tipo="error">{estado.error}</Alerta>}
      {estado.ok && estado.mensaje && <Alerta tipo="exito">{estado.mensaje}</Alerta>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Nombre de quien firma" name="nombre" required defaultValue={firmante?.nombre} placeholder="Mtra. Maria Serrano" />
        <Campo etiqueta="Cargo" name="cargo" required defaultValue={firmante?.cargo} placeholder="Directora General" />
        <ImagenElegida nombre="firma" etiqueta="Imagen de la firma" actual={firmante?.firma ?? null} />
        <ImagenElegida nombre="sello" etiqueta="Imagen del sello" actual={firmante?.sello ?? null} />
      </div>
      <p className="text-xs text-slate-500">PNG con fondo transparente se ve mejor. Maximo 2 MB por imagen.</p>
      <div className="flex items-center justify-between">
        {firmante ? (
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="activo" defaultChecked={firmante.activo} className="h-4 w-4 rounded border-slate-300" />
            Activo
          </label>
        ) : <span />}
        <Boton type="submit" variante={firmante ? "secundario" : "primario"} disabled={pendiente}>
          {pendiente ? "Guardando..." : firmante ? "Guardar cambios" : "Agregar firmante"}
        </Boton>
      </div>
    </form>
  );
}

export function FormularioFirmanteParaTodos({ firmantes }: { firmantes: { id: number; etiqueta: string }[] }) {
  const [estado, accion, pendiente] = useActionState<EstadoDocumentos, FormData>(accionFirmanteParaTodos, {});
  return (
    <form action={accion} className="flex flex-wrap items-end gap-3">
      {estado.error && <Alerta tipo="error">{estado.error}</Alerta>}
      {estado.ok && estado.mensaje && <Alerta tipo="exito">{estado.mensaje}</Alerta>}
      <Selector etiqueta="Firmante" name="firmanteId" required className="min-w-[16rem]">
        {firmantes.map((f) => (
          <option key={f.id} value={f.id}>{f.etiqueta}</option>
        ))}
      </Selector>
      <Boton type="submit" disabled={pendiente}>{pendiente ? "Asignando..." : "Asignar a los que no tienen"}</Boton>
    </form>
  );
}
