"use client";

import { useActionState, useRef, useState } from "react";
import { Alerta, Boton, Campo, Selector } from "@/components/ui";
import {
  camposDisponibles,
  claveDeEtiqueta,
  type CampoExtra,
  type TipoCampoExtra,
} from "@/lib/documentos/campos";
import type { CategoriaDocumento } from "@prisma/client";
import { accionGuardarMachote, accionRestaurarMachote, type EstadoDocumentos } from "../../acciones";

const TIPOS: { valor: TipoCampoExtra; etiqueta: string }[] = [
  { valor: "texto", etiqueta: "Texto corto" },
  { valor: "texto_largo", etiqueta: "Texto largo" },
  { valor: "fecha", etiqueta: "Fecha" },
  { valor: "hora", etiqueta: "Hora" },
  { valor: "numero", etiqueta: "Numero" },
  { valor: "opcion", etiqueta: "Lista de opciones" },
];

type Fila = CampoExtra & { opcionesTexto: string; claveFija: boolean };

export function EditorMachote({
  machote,
  firmantes,
}: {
  machote: {
    id: number | null;
    nombre: string;
    descripcion: string;
    titulo: string;
    cuerpo: string;
    categoria: CategoriaDocumento;
    camposExtra: CampoExtra[];
    prefijoFolio: string;
    firmanteId: number | null;
    alumnoPuedeSolicitar: boolean;
    activa: boolean;
    delSistema: boolean;
  };
  firmantes: { id: number; etiqueta: string }[];
}) {
  const [estado, accion, pendiente] = useActionState<EstadoDocumentos, FormData>(accionGuardarMachote, {});
  const [estadoRestaurar, restaurar, restaurando] = useActionState<EstadoDocumentos, FormData>(accionRestaurarMachote, {});
  const [categoria, setCategoria] = useState<CategoriaDocumento>(machote.categoria);
  const [cuerpo, setCuerpo] = useState(machote.cuerpo);
  const [filas, setFilas] = useState<Fila[]>(
    machote.camposExtra.map((c) => ({ ...c, opcionesTexto: (c.opciones ?? []).join(" | "), claveFija: true }))
  );
  const areaTexto = useRef<HTMLTextAreaElement>(null);

  const extras: CampoExtra[] = filas.map((f) => ({
    clave: f.clave,
    etiqueta: f.etiqueta,
    tipo: f.tipo,
    requerido: f.requerido,
    ...(f.tipo === "opcion" ? { opciones: f.opcionesTexto.split("|").map((o) => o.trim()).filter(Boolean) } : {}),
    ...(f.valorInicial ? { valorInicial: f.valorInicial } : {}),
  }));

  function insertar(campo: string) {
    const area = areaTexto.current;
    const texto = `{{${campo}}}`;
    if (!area) return setCuerpo((c) => c + texto);
    const inicio = area.selectionStart ?? cuerpo.length;
    const fin = area.selectionEnd ?? inicio;
    const nuevo = cuerpo.slice(0, inicio) + texto + cuerpo.slice(fin);
    setCuerpo(nuevo);
    requestAnimationFrame(() => {
      area.focus();
      area.setSelectionRange(inicio + texto.length, inicio + texto.length);
    });
  }

  function cambiarFila(indice: number, cambios: Partial<Fila>) {
    setFilas((previas) =>
      previas.map((f, i) => {
        if (i !== indice) return f;
        const nueva = { ...f, ...cambios };
        // La clave sale del nombre mientras el dato es nuevo; despues ya no
        // cambia, para no romper el texto que la usa.
        if (cambios.etiqueta !== undefined && !f.claveFija) nueva.clave = claveDeEtiqueta(cambios.etiqueta);
        return nueva;
      })
    );
  }

  return (
    <div className="space-y-6">
      <form action={accion} className="space-y-5">
        {machote.id && <input type="hidden" name="id" value={machote.id} />}
        <input type="hidden" name="camposExtra" value={JSON.stringify(extras)} />
        {estado.error && (
          <Alerta tipo="error">
            <p>{estado.error}</p>
            {estado.detalles && <p className="mt-1 font-mono text-xs">{estado.detalles.join("  ")}</p>}
          </Alerta>
        )}
        {estado.ok && estado.mensaje && <Alerta tipo="exito">{estado.mensaje}</Alerta>}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Campo etiqueta="Nombre del machote" name="nombre" required defaultValue={machote.nombre} />
          {machote.id ? (
            <div>
              <p className="etiqueta-campo">Para</p>
              <p className="py-2 text-sm text-slate-700">
                {categoria === "ALUMNO" ? "Alumnos" : categoria === "PERSONAL" ? "Personal" : "General (sin persona)"}
              </p>
            </div>
          ) : (
            <Selector
              etiqueta="Para"
              name="categoria"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value as CategoriaDocumento)}
            >
              <option value="ALUMNO">Alumnos</option>
              <option value="PERSONAL">Personal</option>
              <option value="GENERAL">General (sin persona)</option>
            </Selector>
          )}
          <Campo
            etiqueta="Prefijo del folio"
            name="prefijoFolio"
            required
            maxLength={6}
            defaultValue={machote.prefijoFolio}
            ayuda="De 1 a 6 letras. Ej. CE da folios CE-2026-0001"
          />
          <Campo etiqueta="Descripcion" name="descripcion" defaultValue={machote.descripcion} className="sm:col-span-2" />
          <Selector etiqueta="Quien firma" name="firmanteId" defaultValue={machote.firmanteId ?? ""}>
            <option value="">Sin firmante</option>
            {firmantes.map((f) => (
              <option key={f.id} value={f.id}>{f.etiqueta}</option>
            ))}
          </Selector>
          <Campo etiqueta="Titulo del documento" name="titulo" defaultValue={machote.titulo} className="sm:col-span-2 lg:col-span-3" />
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
          <div>
            <label className="etiqueta-campo" htmlFor="cuerpo">Texto del documento</label>
            <textarea
              id="cuerpo"
              ref={areaTexto}
              name="cuerpo"
              value={cuerpo}
              onChange={(e) => setCuerpo(e.target.value)}
              rows={22}
              className="campo font-mono text-xs leading-relaxed"
            />
            <p className="mt-1 text-xs text-slate-500">
              Linea en blanco = parrafo nuevo · **texto** = negritas · empieza un parrafo con [derecha] o [centro]
              para alinearlo · [firmas]Firma 1 | Firma 2 dibuja lineas para firmar.
            </p>
          </div>
          <div>
            <p className="etiqueta-campo">Insertar dato</p>
            <div className="max-h-[30rem] space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
              {camposDisponibles(categoria, extras).map((c) => (
                <button
                  key={c.campo}
                  type="button"
                  onClick={() => insertar(c.campo)}
                  className="block w-full rounded px-2 py-1 text-left text-xs text-slate-700 hover:bg-marca-50"
                  title={`{{${c.campo}}}`}
                >
                  {c.etiqueta}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-800">Datos que se piden al generar</p>
            <button
              type="button"
              onClick={() =>
                setFilas((p) => [...p, { clave: "dato", etiqueta: "", tipo: "texto", requerido: true, opcionesTexto: "", claveFija: false }])
              }
              className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Agregar dato
            </button>
          </div>
          <p className="text-xs text-slate-500">
            Lo que el sistema no sabe (empresa, hora, motivo...). Se pregunta al generar y se usa con {"{{extra.clave}}"}.
          </p>
          {filas.length > 0 && (
            <div className="space-y-2">
              {filas.map((fila, i) => (
                <div key={i} className="grid items-end gap-2 rounded-lg border border-slate-200 p-2 sm:grid-cols-[1fr_9rem_10rem_auto_auto]">
                  <Campo
                    etiqueta="Nombre del dato"
                    value={fila.etiqueta}
                    onChange={(e) => cambiarFila(i, { etiqueta: e.target.value })}
                    ayuda={`Se usa como {{extra.${fila.clave}}}`}
                  />
                  <Selector etiqueta="Tipo" value={fila.tipo} onChange={(e) => cambiarFila(i, { tipo: e.target.value as TipoCampoExtra })}>
                    {TIPOS.map((t) => (
                      <option key={t.valor} value={t.valor}>{t.etiqueta}</option>
                    ))}
                  </Selector>
                  {fila.tipo === "opcion" ? (
                    <Campo etiqueta="Opciones (separa con |)" value={fila.opcionesTexto} onChange={(e) => cambiarFila(i, { opcionesTexto: e.target.value })} />
                  ) : (
                    <Campo etiqueta="Valor inicial" value={fila.valorInicial ?? ""} onChange={(e) => cambiarFila(i, { valorInicial: e.target.value })} />
                  )}
                  <label className="flex items-center gap-1 pb-2 text-xs text-slate-700">
                    <input type="checkbox" checked={fila.requerido} onChange={(e) => cambiarFila(i, { requerido: e.target.checked })} />
                    Obligatorio
                  </label>
                  <button
                    type="button"
                    onClick={() => setFilas((p) => p.filter((_, j) => j !== i))}
                    className="pb-2 text-xs font-medium text-red-600 hover:underline"
                  >
                    Quitar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-4 text-sm text-slate-700">
          {categoria === "ALUMNO" && (
            <label className="flex items-center gap-2">
              <input type="checkbox" name="alumnoPuedeSolicitar" defaultChecked={machote.alumnoPuedeSolicitar} className="h-4 w-4 rounded border-slate-300" />
              Los alumnos lo pueden solicitar desde su portal
            </label>
          )}
          <label className="flex items-center gap-2">
            <input type="checkbox" name="activa" defaultChecked={machote.activa} className="h-4 w-4 rounded border-slate-300" />
            Machote activo
          </label>
        </div>

        <div className="flex justify-end">
          <Boton type="submit" disabled={pendiente}>{pendiente ? "Guardando..." : "Guardar machote"}</Boton>
        </div>
      </form>

      {machote.id && machote.delSistema && (
        <form action={restaurar} className="space-y-2 border-t border-slate-100 pt-4">
          <input type="hidden" name="id" value={machote.id} />
          {estadoRestaurar.error && <Alerta tipo="error">{estadoRestaurar.error}</Alerta>}
          {estadoRestaurar.ok && <Alerta tipo="exito">{estadoRestaurar.mensaje} Recarga la pagina para verlo.</Alerta>}
          <button type="submit" disabled={restaurando} className="text-xs text-slate-600 hover:underline">
            {restaurando ? "Restaurando..." : "Restaurar el texto original del sistema"}
          </button>
        </form>
      )}
    </div>
  );
}
