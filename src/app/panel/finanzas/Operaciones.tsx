"use client";

import { useActionState, useState } from "react";
import { Alerta, Boton, Campo, Selector } from "@/components/ui";
import type { EstadoFinanzas } from "./acciones";
import { Avisos, type Opcion } from "./Formularios";
import {
  accionActualizarRecargos,
  accionGenerarCargos,
  cambiarEstadoCargo,
  cancelarPago,
  crearCargoManual,
  crearConvenio,
  registrarPago,
  type EstadoGeneracion,
} from "./operaciones";

export function FormularioGeneracion({
  ciclos,
  grupos,
  moneda,
}: {
  ciclos: Opcion[];
  grupos: Opcion[];
  moneda: string;
}) {
  const [estado, accion, pendiente] = useActionState<EstadoGeneracion, FormData>(
    accionGenerarCargos,
    {}
  );
  const [confirmar, setConfirmar] = useState(false);

  return (
    <form action={accion} className="space-y-4">
      <input type="hidden" name="accion" value={confirmar ? "confirmar" : "previa"} />
      <Avisos estado={estado} />

      <div className="grid gap-3 sm:grid-cols-3">
        <Selector etiqueta="Ciclo escolar" name="cicloId" required>
          {ciclos.map((ciclo) => (
            <option key={ciclo.id} value={ciclo.id}>
              {ciclo.etiqueta}
            </option>
          ))}
        </Selector>
        <Selector etiqueta="Solo un grupo" name="grupoId">
          <option value="">Todos los grupos</option>
          {grupos.map((grupo) => (
            <option key={grupo.id} value={grupo.id}>
              {grupo.etiqueta}
            </option>
          ))}
        </Selector>
        <Campo etiqueta="Solo un alumno (id)" name="alumnoId" type="number" min={1} ayuda="Opcional" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Boton
          type="submit"
          variante="secundario"
          disabled={pendiente}
          onClick={() => setConfirmar(false)}
        >
          {pendiente && !confirmar ? "Calculando..." : "Ver que se generaria"}
        </Boton>
        <Boton type="submit" disabled={pendiente} onClick={() => setConfirmar(true)}>
          {pendiente && confirmar ? "Generando..." : "Generar cargos"}
        </Boton>
        <p className="text-xs text-slate-500">
          Generar dos veces no duplica: los cargos que ya existen se omiten.
        </p>
      </div>

      {estado.vistaPrevia && estado.vistaPrevia.lineas.length > 0 && (
        <div className="rounded-lg border border-slate-200">
          <p className="border-b border-slate-200 px-3 py-2 text-xs text-slate-600">
            {estado.vistaPrevia.creados} por generar · {estado.vistaPrevia.omitidos} ya existen ·
            total {estado.vistaPrevia.montoTotal} {moneda}
          </p>
          <div className="max-h-80 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2 font-medium">Alumno</th>
                  <th className="px-3 py-2 font-medium">Motivo</th>
                  <th className="px-3 py-2 font-medium">Vence</th>
                  <th className="px-3 py-2 font-medium">Monto</th>
                  <th className="px-3 py-2 font-medium">Beca</th>
                  <th className="px-3 py-2 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {estado.vistaPrevia.lineas.map((linea, indice) => (
                  <tr key={`${linea.alumnoId}-${linea.conceptoId}-${indice}`}>
                    <td className="px-3 py-1.5 text-slate-700">{linea.alumno}</td>
                    <td className="px-3 py-1.5 text-slate-700">{linea.motivo}</td>
                    <td className="px-3 py-1.5 text-slate-500">{linea.fechaVencimiento}</td>
                    <td className="px-3 py-1.5 font-medium text-slate-900">{linea.montoTotal}</td>
                    <td className="px-3 py-1.5 text-xs text-emerald-700">
                      {linea.montoDescuento > 0 ? `-${linea.montoDescuento}` : ""}
                    </td>
                    <td className="px-3 py-1.5 text-xs text-slate-500">
                      {linea.yaExiste ? "ya existe" : "nuevo"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </form>
  );
}

export function BotonRecargos({ cicloId }: { cicloId: number }) {
  const [estado, accion, pendiente] = useActionState<EstadoFinanzas, FormData>(
    accionActualizarRecargos,
    {}
  );
  return (
    <form action={accion} className="space-y-3">
      <input type="hidden" name="cicloId" value={cicloId} />
      <Avisos estado={estado} />
      <Boton type="submit" variante="secundario" disabled={pendiente}>
        {pendiente ? "Revisando..." : "Aplicar recargos a los cargos vencidos"}
      </Boton>
    </form>
  );
}

export function FormularioCargoManual({
  alumnoId,
  conceptos,
}: {
  alumnoId: number;
  conceptos: Opcion[];
}) {
  const [estado, accion, pendiente] = useActionState<EstadoFinanzas, FormData>(
    crearCargoManual,
    {}
  );
  return (
    <form action={accion} className="space-y-3">
      <input type="hidden" name="alumnoId" value={alumnoId} />
      <Avisos estado={estado} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Campo
          etiqueta="Motivo del cargo"
          name="descripcion"
          required
          className="lg:col-span-2"
          placeholder="Reposicion de credencial"
        />
        <Campo etiqueta="Monto" name="monto" type="number" step="0.01" min={0.01} required />
        <Campo etiqueta="Vence el" name="fechaVencimiento" type="date" required />
        <Selector etiqueta="Ligar a un concepto" name="conceptoId" className="lg:col-span-2">
          <option value="">Sin concepto (cargo suelto)</option>
          {conceptos.map((concepto) => (
            <option key={concepto.id} value={concepto.id}>
              {concepto.etiqueta}
            </option>
          ))}
        </Selector>
        <Campo etiqueta="Notas" name="notas" className="lg:col-span-2" />
      </div>
      <div className="flex justify-end">
        <Boton type="submit" variante="secundario" disabled={pendiente}>
          {pendiente ? "Creando..." : "Agregar cargo"}
        </Boton>
      </div>
    </form>
  );
}

export function FormularioPago({
  alumnoId,
  cargos,
  permiteParciales,
  moneda,
}: {
  alumnoId: number;
  cargos: { id: number; descripcion: string; saldo: number; vence: string; vencido: boolean }[];
  permiteParciales: boolean;
  moneda: string;
}) {
  const [estado, accion, pendiente] = useActionState<EstadoFinanzas, FormData>(registrarPago, {});
  const [reparto, setReparto] = useState<Record<number, string>>({});
  const [monto, setMonto] = useState("");

  const sumaReparto = Object.values(reparto).reduce(
    (total, valor) => total + (Number(valor) || 0),
    0
  );

  function cubrirTodo() {
    const nuevo: Record<number, string> = {};
    for (const cargo of cargos) nuevo[cargo.id] = String(cargo.saldo);
    setReparto(nuevo);
    setMonto(String(Math.round(cargos.reduce((t, c) => t + c.saldo, 0) * 100) / 100));
  }

  return (
    <form action={accion} className="space-y-4">
      <input type="hidden" name="alumnoId" value={alumnoId} />
      <Avisos estado={estado} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Campo
          etiqueta="Monto recibido"
          name="monto"
          type="number"
          step="0.01"
          min={0.01}
          required
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
        />
        <Selector etiqueta="Metodo de pago" name="metodoPago" defaultValue="EFECTIVO">
          <option value="EFECTIVO">Efectivo</option>
          <option value="TRANSFERENCIA">Transferencia</option>
          <option value="TARJETA_CREDITO">Tarjeta de credito</option>
          <option value="TARJETA_DEBITO">Tarjeta de debito</option>
          <option value="CHEQUE">Cheque</option>
          <option value="DEPOSITO">Deposito</option>
          <option value="PAGO_EN_LINEA">Pago en linea</option>
          <option value="OTRO">Otro</option>
        </Selector>
        <Campo etiqueta="Referencia" name="referencia" />
        <Campo etiqueta="Banco" name="banco" />
      </div>

      <div className="rounded-lg border border-slate-200">
        <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
          <p className="text-xs text-slate-600">
            Deja el reparto vacio y el pago se aplica del cargo mas viejo al mas nuevo.
            {!permiteParciales && " El colegio exige cubrir el saldo completo de cada cargo."}
          </p>
          <button
            type="button"
            onClick={cubrirTodo}
            className="whitespace-nowrap rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Cubrir todo
          </button>
        </div>
        <div className="max-h-64 overflow-y-auto">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-100">
              {cargos.map((cargo) => (
                <tr key={cargo.id}>
                  <td className="px-3 py-1.5 text-slate-700">
                    {cargo.descripcion}
                    <span className={`ml-2 text-xs ${cargo.vencido ? "text-red-600" : "text-slate-400"}`}>
                      vence {cargo.vence}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-right text-slate-600">
                    saldo {cargo.saldo} {moneda}
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <input
                      name={`aplicar_${cargo.id}`}
                      type="number"
                      step="0.01"
                      min={0}
                      max={cargo.saldo}
                      value={reparto[cargo.id] ?? ""}
                      onChange={(e) =>
                        setReparto((previo) => ({ ...previo, [cargo.id]: e.target.value }))
                      }
                      placeholder="0.00"
                      className="campo w-28 py-1 text-right"
                      aria-label={`Aplicar a ${cargo.descripcion}`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">
          Reparto capturado: {Math.round(sumaReparto * 100) / 100} {moneda}
        </p>
        <Boton type="submit" disabled={pendiente || cargos.length === 0}>
          {pendiente ? "Registrando..." : "Registrar pago"}
        </Boton>
      </div>
    </form>
  );
}

export function BotonCancelarPago({ pagoId }: { pagoId: number }) {
  const [estado, accion, pendiente] = useActionState<EstadoFinanzas, FormData>(cancelarPago, {});
  return (
    <form action={accion} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="pagoId" value={pagoId} />
      <input
        name="motivo"
        placeholder="Motivo de la cancelacion"
        className="campo w-56 py-1 text-xs"
        aria-label="Motivo de la cancelacion"
      />
      <button
        type="submit"
        disabled={pendiente}
        className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
      >
        {pendiente ? "..." : "Cancelar pago"}
      </button>
      {estado.error && <span className="text-xs text-red-600">{estado.error}</span>}
    </form>
  );
}

export function BotonEstadoCargo({ cargoId }: { cargoId: number }) {
  const [estado, accion, pendiente] = useActionState<EstadoFinanzas, FormData>(
    cambiarEstadoCargo,
    {}
  );
  return (
    <form action={accion} className="flex flex-wrap items-center justify-end gap-1">
      <input type="hidden" name="cargoId" value={cargoId} />
      <input
        name="motivo"
        placeholder="Motivo"
        className="campo w-32 py-0.5 text-[11px]"
        aria-label="Motivo"
      />
      <button
        type="submit"
        name="estado"
        value="CONDONADO"
        disabled={pendiente}
        className="rounded px-1.5 py-0.5 text-[11px] font-medium text-amber-700 hover:bg-amber-50"
      >
        condonar
      </button>
      <button
        type="submit"
        name="estado"
        value="CANCELADO"
        disabled={pendiente}
        className="rounded px-1.5 py-0.5 text-[11px] font-medium text-red-600 hover:bg-red-50"
      >
        cancelar
      </button>
      {estado.error && <p className="w-full text-right text-[11px] text-red-600">{estado.error}</p>}
    </form>
  );
}

export function FormularioConvenio({
  alumnoId,
  cargos,
}: {
  alumnoId: number;
  cargos: { id: number; descripcion: string; saldo: number }[];
}) {
  const [estado, accion, pendiente] = useActionState<EstadoFinanzas, FormData>(crearConvenio, {});
  return (
    <form action={accion} className="space-y-3">
      <input type="hidden" name="alumnoId" value={alumnoId} />
      <Avisos estado={estado} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Campo etiqueta="Parcialidades" name="parcialidades" type="number" min={2} max={24} defaultValue="3" required />
        <Campo etiqueta="Primera parcialidad" name="primeraFecha" type="date" required />
        <Campo etiqueta="Notas" name="notas" />
      </div>
      <div>
        <p className="etiqueta-campo">Cargos a incluir</p>
        <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-3">
          {cargos.length === 0 ? (
            <span className="text-xs text-slate-400">Sin cargos pendientes.</span>
          ) : (
            cargos.map((cargo) => (
              <label key={cargo.id} className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  name="cargos"
                  value={cargo.id}
                  className="h-4 w-4 rounded border-slate-300 text-marca-600"
                />
                {cargo.descripcion} · saldo {cargo.saldo}
              </label>
            ))
          )}
        </div>
        <p className="mt-1 text-xs text-slate-500">Si no marcas ninguno se incluyen todos los pendientes.</p>
      </div>
      <div className="flex justify-end">
        <Boton type="submit" variante="secundario" disabled={pendiente || cargos.length === 0}>
          {pendiente ? "Creando..." : "Crear convenio"}
        </Boton>
      </div>
    </form>
  );
}
