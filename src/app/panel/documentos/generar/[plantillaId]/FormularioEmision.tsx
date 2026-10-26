"use client";

import { useActionState, useMemo, useState } from "react";
import { Alerta, Boton, Campo, Selector } from "@/components/ui";
import { HojaDocumento, type DatosHoja, type MarcaHoja } from "@/components/HojaDocumento";
import { rellenar, valoresExtra, type CampoExtra, type Valores } from "@/lib/documentos/campos";
import { accionEmitir, type EstadoDocumentos } from "../../acciones";

export function FormularioEmision({
  plantilla,
  valoresBase,
  datos,
  marca,
  firmante,
  simboloMoneda,
  alumnoId,
  empleadoId,
  solicitudId,
}: {
  plantilla: { id: number; titulo: string; cuerpo: string; camposExtra: CampoExtra[] };
  valoresBase: Valores;
  datos: DatosHoja;
  marca: MarcaHoja;
  firmante: { nombre: string | null; cargo: string | null; firma: string | null; sello: string | null } | null;
  simboloMoneda: string;
  alumnoId?: number;
  empleadoId?: number;
  solicitudId?: number;
}) {
  const [estado, accion, pendiente] = useActionState<EstadoDocumentos, FormData>(accionEmitir, {});
  const [capturados, setCapturados] = useState<Record<string, string>>(
    Object.fromEntries(plantilla.camposExtra.map((c) => [c.clave, c.valorInicial ?? ""]))
  );
  const [ajustar, setAjustar] = useState(false);
  const [cuerpo, setCuerpo] = useState(plantilla.cuerpo);

  const valores = useMemo(
    () => ({ ...valoresBase, ...valoresExtra(plantilla.camposExtra, capturados, simboloMoneda) }),
    [valoresBase, plantilla.camposExtra, capturados, simboloMoneda]
  );
  const renglones = Math.min(40, Math.max(1, Number(capturados.renglones) || 15));

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      <form action={accion} className="no-imprimir space-y-4">
        <input type="hidden" name="plantillaId" value={plantilla.id} />
        {alumnoId && <input type="hidden" name="alumnoId" value={alumnoId} />}
        {empleadoId && <input type="hidden" name="empleadoId" value={empleadoId} />}
        {solicitudId && <input type="hidden" name="solicitudId" value={solicitudId} />}
        {estado.error && <Alerta tipo="error">{estado.error}</Alerta>}

        {plantilla.camposExtra.length > 0 ? (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-slate-800">Datos para este documento</p>
            {plantilla.camposExtra.map((campo) => {
              const comun = {
                name: `extra_${campo.clave}`,
                required: campo.requerido,
                value: capturados[campo.clave] ?? "",
              };
              const cambiar = (valor: string) => setCapturados((p) => ({ ...p, [campo.clave]: valor }));
              if (campo.tipo === "texto_largo") {
                return (
                  <div key={campo.clave}>
                    <label className="etiqueta-campo" htmlFor={`extra-${campo.clave}`}>
                      {campo.etiqueta}
                      {campo.requerido && <span className="ml-0.5 text-red-500">*</span>}
                    </label>
                    <textarea
                      id={`extra-${campo.clave}`}
                      {...comun}
                      rows={4}
                      maxLength={4000}
                      className="campo"
                      onChange={(e) => cambiar(e.target.value)}
                    />
                  </div>
                );
              }
              if (campo.tipo === "opcion") {
                return (
                  <Selector key={campo.clave} etiqueta={campo.etiqueta} {...comun} onChange={(e) => cambiar(e.target.value)}>
                    <option value="">Selecciona...</option>
                    {(campo.opciones ?? []).map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </Selector>
                );
              }
              return (
                <Campo
                  key={campo.clave}
                  etiqueta={campo.etiqueta}
                  type={campo.tipo === "fecha" ? "date" : campo.tipo === "hora" ? "time" : campo.tipo === "numero" ? "number" : "text"}
                  step={campo.tipo === "numero" ? "any" : undefined}
                  {...comun}
                  onChange={(e) => cambiar(e.target.value)}
                />
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-slate-600">Este documento se llena solo con los datos del sistema.</p>
        )}

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            name="ajustar"
            checked={ajustar}
            onChange={(e) => setAjustar(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          Ajustar el texto solo para este documento
        </label>
        {ajustar && (
          <div>
            <textarea
              name="cuerpoAjustado"
              aria-label="Texto de este documento"
              value={cuerpo}
              onChange={(e) => setCuerpo(e.target.value)}
              rows={14}
              className="campo font-mono text-xs"
            />
            <p className="mt-1 text-xs text-slate-500">
              El machote no cambia; solo este documento. Los campos entre {"{{ }}"} se siguen llenando solos.
            </p>
          </div>
        )}

        <Boton type="submit" className="w-full" disabled={pendiente}>
          {pendiente ? "Generando..." : "Generar documento"}
        </Boton>
        <p className="text-xs text-slate-500">Al generarlo recibe su folio y queda en el historial.</p>
      </form>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-slate-100 p-4" data-vista-previa>
        <HojaDocumento
          marca={marca}
          titulo={rellenar(plantilla.titulo, valores)}
          cuerpo={rellenar(ajustar ? cuerpo : plantilla.cuerpo, valores)}
          datos={{ ...datos, renglones }}
          firmante={firmante}
        />
      </div>
    </div>
  );
}
