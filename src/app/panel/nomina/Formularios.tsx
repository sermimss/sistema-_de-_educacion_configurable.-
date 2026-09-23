"use client";

import { useActionState } from "react";
import { Alerta, Boton, Campo, Selector } from "@/components/ui";
import {
  accionCalcularNomina,
  agregarLineaRecibo,
  autorizarPeriodo,
  cancelarRecibo,
  crearPeriodoNomina,
  eliminarConceptoNomina,
  guardarConceptoNomina,
  pagarPeriodo,
  type EstadoNomina,
} from "./acciones";

type Opcion = { id: number; etiqueta: string };

function Avisos({ estado }: { estado: EstadoNomina }) {
  return (
    <>
      {estado.error && (
        <Alerta tipo="error">
          <p className="font-medium">{estado.error}</p>
          {estado.detalles && (
            <ul className="mt-1 list-inside list-disc text-xs">
              {estado.detalles.slice(0, 10).map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          )}
        </Alerta>
      )}
      {estado.ok && estado.mensaje && <Alerta tipo="exito">{estado.mensaje}</Alerta>}
    </>
  );
}

export type ConceptoNominaEditable = {
  id?: number;
  clave: string;
  nombre: string;
  tipo: string;
  tipoCalculo: string;
  valor: string;
  gravable: boolean;
  claveSat: string;
  activo: boolean;
};

export function FormularioConceptoNomina({ concepto }: { concepto?: ConceptoNominaEditable }) {
  const [estado, accion, pendiente] = useActionState<EstadoNomina, FormData>(
    guardarConceptoNomina,
    {}
  );
  return (
    <form action={accion} className="space-y-3">
      {concepto?.id && <input type="hidden" name="id" value={concepto.id} />}
      <Avisos estado={estado} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Campo etiqueta="Clave" name="clave" required defaultValue={concepto?.clave ?? ""} />
        <Campo
          etiqueta="Nombre del concepto"
          name="nombre"
          required
          defaultValue={concepto?.nombre ?? ""}
          placeholder="Prima vacacional, prestamo..."
        />
        <Selector etiqueta="Tipo" name="tipo" defaultValue={concepto?.tipo ?? "PERCEPCION"}>
          <option value="PERCEPCION">Percepcion</option>
          <option value="DEDUCCION">Deduccion</option>
          <option value="OTRO_PAGO">Otro pago</option>
        </Selector>
        <Selector
          etiqueta="Como se calcula"
          name="tipoCalculo"
          defaultValue={concepto?.tipoCalculo ?? "FIJO"}
        >
          <option value="FIJO">Monto fijo</option>
          <option value="PORCENTAJE">Porcentaje del sueldo del periodo</option>
        </Selector>
        <Campo
          etiqueta="Valor"
          name="valor"
          type="number"
          step="0.01"
          min={0}
          required
          defaultValue={concepto?.valor ?? ""}
        />
        <Campo
          etiqueta="Clave SAT"
          name="claveSat"
          defaultValue={concepto?.claveSat ?? ""}
          ayuda="Opcional, para el CFDI de nomina"
        />
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            name="gravable"
            defaultChecked={concepto?.gravable ?? true}
            className="h-4 w-4 rounded border-slate-300 text-marca-600"
          />
          Gravable
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            name="activo"
            defaultChecked={concepto?.activo ?? true}
            className="h-4 w-4 rounded border-slate-300 text-marca-600"
          />
          Activo
        </label>
        <Boton type="submit" disabled={pendiente}>
          {pendiente ? "Guardando..." : concepto?.id ? "Guardar cambios" : "Crear concepto"}
        </Boton>
      </div>
    </form>
  );
}

export function BotonEliminarConceptoNomina({ conceptoId }: { conceptoId: number }) {
  const [estado, accion, pendiente] = useActionState<EstadoNomina, FormData>(
    eliminarConceptoNomina,
    {}
  );
  return (
    <form action={accion} className="inline">
      <input type="hidden" name="conceptoId" value={conceptoId} />
      <button
        type="submit"
        disabled={pendiente}
        className="text-xs font-medium text-red-600 hover:underline"
      >
        {pendiente ? "..." : "eliminar"}
      </button>
      {estado.error && <p className="mt-1 max-w-sm text-xs text-red-600">{estado.error}</p>}
    </form>
  );
}

export function FormularioPeriodo({ periodicidad }: { periodicidad: string }) {
  const [estado, accion, pendiente] = useActionState<EstadoNomina, FormData>(
    crearPeriodoNomina,
    {}
  );
  return (
    <form action={accion} className="space-y-3">
      <Avisos estado={estado} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Campo
          etiqueta="Nombre del periodo"
          name="nombre"
          required
          placeholder="Septiembre 2026"
          ayuda={`Periodicidad configurada: ${periodicidad.toLowerCase()}`}
        />
        <Campo etiqueta="Desde" name="fechaInicio" type="date" required />
        <Campo etiqueta="Hasta" name="fechaFin" type="date" required />
        <Campo etiqueta="Fecha de pago" name="fechaPago" type="date" required />
      </div>
      <div className="flex justify-end">
        <Boton type="submit" disabled={pendiente}>
          {pendiente ? "Creando..." : "Crear periodo"}
        </Boton>
      </div>
    </form>
  );
}

export function BotonCalcular({ periodoId }: { periodoId: number }) {
  const [estado, accion, pendiente] = useActionState<EstadoNomina, FormData>(
    accionCalcularNomina,
    {}
  );
  return (
    <form action={accion} className="space-y-3">
      <input type="hidden" name="periodoId" value={periodoId} />
      <Avisos estado={estado} />
      <Boton type="submit" disabled={pendiente}>
        {pendiente ? "Calculando..." : "Calcular nomina del periodo"}
      </Boton>
      <p className="text-xs text-slate-500">
        Recalcular no toca los recibos ya autorizados ni los pagados, y conserva los ajustes
        capturados a mano.
      </p>
    </form>
  );
}

export function BotonAutorizar({
  periodoId,
  borradores,
}: {
  periodoId: number;
  borradores: number;
}) {
  const [estado, accion, pendiente] = useActionState<EstadoNomina, FormData>(autorizarPeriodo, {});
  // El formulario no se desmonta cuando ya no quedan borradores: si lo hiciera,
  // el aviso de exito desapareceria junto con el y nadie sabria cuantos
  // recibos se autorizaron.
  return (
    <form action={accion} className="space-y-3">
      <input type="hidden" name="periodoId" value={periodoId} />
      <Avisos estado={estado} />
      {borradores === 0 ? (
        <p className="text-sm text-slate-500">No quedan recibos en borrador.</p>
      ) : (
        <Boton type="submit" variante="secundario" disabled={pendiente}>
          {pendiente ? "Autorizando..." : `Autorizar los ${borradores} recibo(s) en borrador`}
        </Boton>
      )}
    </form>
  );
}

export function FormularioPagar({
  periodoId,
  fechaPago,
  autorizados,
  pagado,
}: {
  periodoId: number;
  fechaPago: string;
  autorizados: number;
  pagado: boolean;
}) {
  const [estado, accion, pendiente] = useActionState<EstadoNomina, FormData>(pagarPeriodo, {});
  // Igual que al autorizar: el formulario sigue montado tras pagar para no
  // perder la confirmacion.
  if (pagado || autorizados === 0) {
    return (
      <form action={accion} className="space-y-3">
        <Avisos estado={estado} />
        <p className="text-sm text-slate-500">
          {pagado
            ? "Este periodo ya esta pagado."
            : "No hay recibos autorizados listos para pagar."}
        </p>
      </form>
    );
  }
  return (
    <form action={accion} className="space-y-3">
      <input type="hidden" name="periodoId" value={periodoId} />
      <Avisos estado={estado} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Selector etiqueta="Metodo de pago" name="metodoPago" defaultValue="TRANSFERENCIA">
          <option value="TRANSFERENCIA">Transferencia</option>
          <option value="EFECTIVO">Efectivo</option>
          <option value="CHEQUE">Cheque</option>
          <option value="DEPOSITO">Deposito</option>
          <option value="OTRO">Otro</option>
        </Selector>
        <Campo etiqueta="Fecha de pago" name="fechaPago" type="date" defaultValue={fechaPago} />
        <div className="flex items-end">
          <Boton type="submit" disabled={pendiente}>
            {pendiente ? "Registrando..." : "Marcar el periodo como pagado"}
          </Boton>
        </div>
      </div>
    </form>
  );
}

export function FormularioLinea({
  reciboId,
  conceptos,
}: {
  reciboId: number;
  conceptos: Opcion[];
}) {
  const [estado, accion, pendiente] = useActionState<EstadoNomina, FormData>(
    agregarLineaRecibo,
    {}
  );
  return (
    <form action={accion} className="space-y-3">
      <input type="hidden" name="reciboId" value={reciboId} />
      <Avisos estado={estado} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Selector etiqueta="Concepto" name="conceptoId" required className="lg:col-span-2">
          <option value="">Selecciona...</option>
          {conceptos.map((concepto) => (
            <option key={concepto.id} value={concepto.id}>
              {concepto.etiqueta}
            </option>
          ))}
        </Selector>
        <Campo etiqueta="Cantidad" name="cantidad" type="number" step="0.01" ayuda="Horas, dias... opcional" />
        <Campo etiqueta="Importe" name="importe" type="number" step="0.01" min={0.01} required />
      </div>
      <div className="flex justify-end">
        <Boton type="submit" variante="secundario" disabled={pendiente || conceptos.length === 0}>
          {pendiente ? "Agregando..." : "Agregar al recibo"}
        </Boton>
      </div>
    </form>
  );
}

export function FormularioCancelarRecibo({ reciboId }: { reciboId: number }) {
  const [estado, accion, pendiente] = useActionState<EstadoNomina, FormData>(cancelarRecibo, {});
  return (
    <form action={accion} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="reciboId" value={reciboId} />
      <input
        name="motivo"
        placeholder="Motivo de la cancelacion"
        className="campo w-64 py-1 text-xs"
        aria-label="Motivo de la cancelacion del recibo"
      />
      <button
        type="submit"
        disabled={pendiente}
        className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
      >
        {pendiente ? "..." : "Cancelar recibo"}
      </button>
      {estado.error && <span className="text-xs text-red-600">{estado.error}</span>}
      {estado.ok && <span className="text-xs text-emerald-700">{estado.mensaje}</span>}
    </form>
  );
}
