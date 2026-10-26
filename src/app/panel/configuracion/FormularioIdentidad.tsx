"use client";

import { useActionState, useState } from "react";
import { Alerta, Boton, Campo } from "@/components/ui";
import { coloresDominantes, leerPixeles, proponerColores, type ColorDetectado } from "@/lib/coloresLogo";
import { guardarIdentidad, type EstadoGuardado } from "./acciones";

type Identidad = {
  nombre: string;
  nombreCorto: string | null;
  lema: string | null;
  logo: string | null;
  colorPrimario: string;
  colorSecundario: string;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  ciudad: string | null;
  estado: string | null;
  claveCentroTrabajo: string | null;
  razonSocial: string | null;
  rfc: string | null;
  regimenFiscal: string | null;
};

/// Mismo calculo que el servidor: texto blanco u oscuro segun el fondo.
function textoSobre(hex: string): string {
  const canal = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const l = 0.2126 * canal(1) + 0.7152 * canal(3) + 0.0722 * canal(5);
  return 1.05 / (l + 0.05) >= (l + 0.05) / 0.0601 ? "#ffffff" : "#0f172a";
}

function SelectorColor({
  etiqueta,
  nombre,
  valor,
  alCambiar,
}: {
  etiqueta: string;
  nombre: string;
  valor: string;
  alCambiar: (valor: string) => void;
}) {
  return (
    <div>
      <label className="etiqueta-campo" htmlFor={nombre}>{etiqueta}</label>
      <div className="flex items-center gap-2">
        <input
          id={nombre}
          name={nombre}
          type="color"
          value={valor}
          onChange={(e) => alCambiar(e.target.value)}
          className="h-10 w-14 cursor-pointer rounded-lg border border-slate-300 bg-white p-1"
        />
        <span className="font-mono text-sm text-slate-600">{valor}</span>
      </div>
    </div>
  );
}

export default function FormularioIdentidad({ institucion }: { institucion: Identidad }) {
  const [estado, accion, pendiente] = useActionState<EstadoGuardado, FormData>(guardarIdentidad, {});
  const [primario, setPrimario] = useState(institucion.colorPrimario);
  const [secundario, setSecundario] = useState(institucion.colorSecundario);
  const [vistaLogo, setVistaLogo] = useState<string | null>(institucion.logo);
  const [detectados, setDetectados] = useState<ColorDetectado[]>([]);
  const [quitarLogo, setQuitarLogo] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  async function alElegirLogo(archivo: File | undefined) {
    setAviso(null);
    if (!archivo) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(archivo.type)) {
      setAviso("El logo debe ser PNG, JPG o WebP.");
      return;
    }
    if (archivo.size > 2 * 1024 * 1024) {
      setAviso("La imagen pesa mas de 2 MB. Usa una mas ligera.");
      return;
    }
    setQuitarLogo(false);
    setVistaLogo(URL.createObjectURL(archivo));
    try {
      const colores = coloresDominantes(await leerPixeles(archivo));
      setDetectados(colores);
      const propuesta = proponerColores(colores);
      if (propuesta) {
        setPrimario(propuesta.primario);
        setSecundario(propuesta.secundario);
        setAviso("Tomamos los colores del logo. Revisa la vista previa y ajustalos si quieres antes de guardar.");
      }
    } catch {
      setAviso("No pudimos leer los colores del logo; eligelos a mano.");
    }
  }

  return (
    <form action={accion} className="space-y-5">
      {estado.error && <Alerta tipo="error">{estado.error}</Alerta>}
      {estado.ok && estado.mensaje && <Alerta tipo="exito">{estado.mensaje}</Alerta>}

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-3">
          <label className="etiqueta-campo" htmlFor="logo">
            Logo institucional
          </label>
          <input
            id="logo"
            name="logo"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => alElegirLogo(e.target.files?.[0])}
            className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
          />
          <p className="text-xs text-slate-500">
            PNG, JPG o WebP de hasta 2 MB. De preferencia con fondo transparente o blanco.
          </p>
          {institucion.logo && (
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                name="quitarLogo"
                checked={quitarLogo}
                onChange={(e) => {
                  setQuitarLogo(e.target.checked);
                  setVistaLogo(e.target.checked ? null : institucion.logo);
                }}
                className="h-4 w-4 rounded border-slate-300"
              />
              Quitar el logo actual
            </label>
          )}
          {aviso && <Alerta tipo="info">{aviso}</Alerta>}

          <div className="grid gap-3 sm:grid-cols-2">
            <SelectorColor etiqueta="Color principal" nombre="colorPrimario" valor={primario} alCambiar={setPrimario} />
            <SelectorColor etiqueta="Color secundario" nombre="colorSecundario" valor={secundario} alCambiar={setSecundario} />
          </div>
          {detectados.length > 0 && (
            <div>
              <p className="text-xs text-slate-500">
                Colores del logo (clic para usarlo como principal; clic derecho como secundario):
              </p>
              <div className="mt-1 flex flex-wrap gap-2">
                {detectados.map((color) => (
                  <button
                    key={color.hex}
                    type="button"
                    title={`${color.hex} · ${Math.round(color.peso * 100)}% del logo`}
                    aria-label={`Usar ${color.hex}`}
                    onClick={() => setPrimario(color.hex)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setSecundario(color.hex);
                    }}
                    className="h-8 w-8 rounded-full border border-slate-300 shadow-sm"
                    style={{ backgroundColor: color.hex }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <div>
          <p className="etiqueta-campo">Vista previa</p>
          <div className="overflow-hidden rounded-xl border border-slate-200" data-vista-previa-marca>
            <div className="flex items-center gap-3 px-4 py-3" style={{ backgroundColor: secundario, color: textoSobre(secundario) }}>
              {vistaLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={vistaLogo} alt="" className="h-10 w-auto rounded bg-white p-1" />
              ) : (
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold"
                  style={{ backgroundColor: primario, color: textoSobre(primario) }}
                >
                  {(institucion.nombreCorto || institucion.nombre).charAt(0).toUpperCase()}
                </span>
              )}
              <span className="text-sm font-semibold">{institucion.nombreCorto || institucion.nombre}</span>
            </div>
            <div className="space-y-3 bg-white p-4">
              <div className="h-1.5 w-24 rounded" style={{ backgroundColor: primario }} />
              <p className="text-sm text-slate-600">Asi se ven los botones, menus y documentos del colegio.</p>
              <span
                className="inline-flex rounded-lg px-4 py-2 text-sm font-medium"
                style={{ backgroundColor: primario, color: textoSobre(primario) }}
              >
                Boton de ejemplo
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2">
        <Campo etiqueta="Nombre" name="nombre" defaultValue={institucion.nombre} required />
        <Campo etiqueta="Nombre corto" name="nombreCorto" defaultValue={institucion.nombreCorto ?? ""} />
        <Campo etiqueta="Lema" name="lema" defaultValue={institucion.lema ?? ""} className="sm:col-span-2" />
        <Campo etiqueta="Telefono" name="telefono" defaultValue={institucion.telefono ?? ""} />
        <Campo etiqueta="Correo" name="email" type="email" defaultValue={institucion.email ?? ""} />
        <Campo etiqueta="Direccion" name="direccion" defaultValue={institucion.direccion ?? ""} className="sm:col-span-2" />
        <Campo etiqueta="Ciudad" name="ciudad" defaultValue={institucion.ciudad ?? ""} ayuda="Aparece en la fecha de los documentos" />
        <Campo etiqueta="Estado" name="estado" defaultValue={institucion.estado ?? ""} />
        <Campo etiqueta="Clave de centro de trabajo (CCT)" name="claveCentroTrabajo" defaultValue={institucion.claveCentroTrabajo ?? ""} />
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
