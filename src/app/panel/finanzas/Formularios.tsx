"use client";

import { useActionState, useState } from "react";
import { Alerta, Boton, Campo, Selector } from "@/components/ui";
import {
  eliminarConcepto,
  guardarConcepto,
  guardarDescuento,
  guardarRecargo,
  asignarBeca,
  type EstadoFinanzas,
} from "./acciones";

export type Opcion = { id: number; etiqueta: string };

export function Avisos({ estado }: { estado: EstadoFinanzas }) {
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

export type ConceptoEditable = {
  id?: number;
  clave: string;
  nombre: string;
  leyenda: string;
  descripcion: string;
  tipo: string;
  montoBase: string;
  periodicidad: string;
  numeroCargos: string;
  diaVencimiento: string;
  fechaPrimerCargo: string;
  ambito: string;
  referenciaId: string;
  obligatorio: boolean;
  generaRecargo: boolean;
  aplicaDescuentos: boolean;
  activo: boolean;
  tasaIva: string;
  claveProdServSat: string;
  claveUnidadSat: string;
};

export function FormularioConcepto({
  concepto,
  referencias,
  diaSugerido,
}: {
  concepto?: ConceptoEditable;
  referencias: { niveles: Opcion[]; planes: Opcion[]; grados: Opcion[]; grupos: Opcion[]; alumnos: Opcion[] };
  diaSugerido: number;
}) {
  const [estado, accion, pendiente] = useActionState<EstadoFinanzas, FormData>(guardarConcepto, {});
  const [ambito, setAmbito] = useState(concepto?.ambito ?? "TODOS");
  const [periodicidad, setPeriodicidad] = useState(concepto?.periodicidad ?? "MENSUAL");

  const opcionesAmbito: Record<string, Opcion[]> = {
    NIVEL: referencias.niveles,
    PLAN: referencias.planes,
    GRADO: referencias.grados,
    GRUPO: referencias.grupos,
    ALUMNO: referencias.alumnos,
  };

  return (
    <form action={accion} className="space-y-4">
      {concepto?.id && <input type="hidden" name="id" value={concepto.id} />}
      <Avisos estado={estado} />

      <div>
        <p className="mb-2 text-sm font-semibold text-slate-800">Motivo y monto</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Campo etiqueta="Clave" name="clave" required defaultValue={concepto?.clave ?? ""} />
          <Campo
            etiqueta="Motivo del cobro"
            name="nombre"
            required
            defaultValue={concepto?.nombre ?? ""}
            placeholder="Colegiatura, examen extemporaneo..."
          />
          <Campo
            etiqueta="Monto"
            name="montoBase"
            type="number"
            step="0.01"
            min={0}
            required
            defaultValue={concepto?.montoBase ?? ""}
          />
          <Selector etiqueta="Tipo" name="tipo" defaultValue={concepto?.tipo ?? "COLEGIATURA"}>
            <option value="INSCRIPCION">Inscripcion</option>
            <option value="REINSCRIPCION">Reinscripcion</option>
            <option value="COLEGIATURA">Colegiatura</option>
            <option value="MATERIAL">Material</option>
            <option value="UNIFORME">Uniforme</option>
            <option value="TRANSPORTE">Transporte</option>
            <option value="EVENTO">Evento</option>
            <option value="EXAMEN">Examen</option>
            <option value="TRAMITE">Tramite</option>
            <option value="OTRO">Otro</option>
          </Selector>
          <Campo
            etiqueta="Leyenda en el recibo"
            name="leyenda"
            className="sm:col-span-2"
            defaultValue={concepto?.leyenda ?? ""}
            ayuda="Como debe leerse en el estado de cuenta. Vacio usa el motivo."
          />
          <Campo
            etiqueta="Descripcion interna"
            name="descripcion"
            className="sm:col-span-2"
            defaultValue={concepto?.descripcion ?? ""}
          />
        </div>
      </div>

      <div className="border-t border-slate-100 pt-4">
        <p className="mb-2 text-sm font-semibold text-slate-800">Cuando se cobra</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Selector
            etiqueta="Periodicidad"
            name="periodicidad"
            value={periodicidad}
            onChange={(e) => setPeriodicidad(e.target.value)}
          >
            <option value="UNICO">Una sola vez</option>
            <option value="MENSUAL">Mensual</option>
            <option value="BIMESTRAL">Bimestral</option>
            <option value="POR_PERIODO_ACADEMICO">Por periodo academico</option>
            <option value="SEMESTRAL">Semestral</option>
            <option value="ANUAL">Anual</option>
          </Selector>
          <Campo
            etiqueta="Fecha del primer cargo"
            name="fechaPrimerCargo"
            type="date"
            defaultValue={concepto?.fechaPrimerCargo ?? ""}
            ayuda="Vacio: el inicio del ciclo."
          />
          <Campo
            etiqueta="Dia de vencimiento"
            name="diaVencimiento"
            type="number"
            min={1}
            max={31}
            defaultValue={concepto?.diaVencimiento ?? String(diaSugerido)}
          />
          <Campo
            etiqueta="Cuantos cargos"
            name="numeroCargos"
            type="number"
            min={1}
            max={60}
            defaultValue={concepto?.numeroCargos ?? ""}
            disabled={periodicidad === "UNICO"}
            ayuda={
              periodicidad === "UNICO"
                ? "Un solo cargo."
                : "Vacio: los que quepan en el ciclo o los periodos del plan."
            }
          />
        </div>
      </div>

      <div className="border-t border-slate-100 pt-4">
        <p className="mb-2 text-sm font-semibold text-slate-800">A quien se le cobra</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Selector
            etiqueta="Aplica a"
            name="ambito"
            value={ambito}
            onChange={(e) => setAmbito(e.target.value)}
          >
            <option value="TODOS">Todos los alumnos</option>
            <option value="NIVEL">Un nivel educativo</option>
            <option value="PLAN">Un plan de estudios</option>
            <option value="GRADO">Un grado</option>
            <option value="GRUPO">Un grupo</option>
            <option value="ALUMNO">Un alumno</option>
          </Selector>
          {ambito !== "TODOS" && (
            <Selector
              etiqueta="Cual"
              name="referenciaId"
              required
              defaultValue={concepto?.referenciaId ?? ""}
            >
              <option value="">Selecciona...</option>
              {(opcionesAmbito[ambito] ?? []).map((opcion) => (
                <option key={opcion.id} value={opcion.id}>
                  {opcion.etiqueta}
                </option>
              ))}
            </Selector>
          )}
        </div>
      </div>

      <div className="border-t border-slate-100 pt-4">
        <p className="mb-2 text-sm font-semibold text-slate-800">Reglas</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["obligatorio", "Obligatorio", concepto?.obligatorio ?? true],
            ["generaRecargo", "Genera recargo si se vence", concepto?.generaRecargo ?? true],
            ["aplicaDescuentos", "Acepta becas y descuentos", concepto?.aplicaDescuentos ?? true],
            ["activo", "Activo", concepto?.activo ?? true],
          ].map(([nombre, etiqueta, valor]) => (
            <label
              key={nombre as string}
              className="flex items-center gap-2 rounded-lg border border-slate-200 p-3 text-sm text-slate-700"
            >
              <input
                type="checkbox"
                name={nombre as string}
                defaultChecked={valor as boolean}
                className="h-4 w-4 rounded border-slate-300 text-marca-600"
              />
              {etiqueta as string}
            </label>
          ))}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Campo
            etiqueta="IVA (fraccion)"
            name="tasaIva"
            type="number"
            step="0.01"
            min={0}
            max={1}
            defaultValue={concepto?.tasaIva ?? ""}
            ayuda="0 exento, 0.16 para 16%"
          />
          <Campo
            etiqueta="Clave ProdServ SAT"
            name="claveProdServSat"
            defaultValue={concepto?.claveProdServSat ?? ""}
          />
          <Campo
            etiqueta="Clave unidad SAT"
            name="claveUnidadSat"
            defaultValue={concepto?.claveUnidadSat ?? ""}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Boton type="submit" disabled={pendiente}>
          {pendiente ? "Guardando..." : concepto?.id ? "Guardar cambios" : "Crear concepto"}
        </Boton>
      </div>
    </form>
  );
}

export function BotonEliminarConcepto({ conceptoId }: { conceptoId: number }) {
  const [estado, accion, pendiente] = useActionState<EstadoFinanzas, FormData>(
    eliminarConcepto,
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

export function FormularioRecargo({
  regla,
}: {
  regla?: {
    id: number;
    nombre: string;
    tipoCalculo: string;
    valor: string;
    diasGracia: string;
    frecuencia: string;
    topeMaximo: string;
    aplicaATodos: boolean;
    activa: boolean;
  };
}) {
  const [estado, accion, pendiente] = useActionState<EstadoFinanzas, FormData>(guardarRecargo, {});
  return (
    <form action={accion} className="space-y-3">
      {regla && <input type="hidden" name="id" value={regla.id} />}
      <Avisos estado={estado} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Campo etiqueta="Nombre" name="nombre" required defaultValue={regla?.nombre ?? "Recargo por pago tardio"} />
        <Selector etiqueta="Tipo" name="tipoCalculo" defaultValue={regla?.tipoCalculo ?? "PORCENTAJE"}>
          <option value="PORCENTAJE">Porcentaje del saldo</option>
          <option value="FIJO">Monto fijo</option>
        </Selector>
        <Campo etiqueta="Valor" name="valor" type="number" step="0.01" min={0} required defaultValue={regla?.valor ?? "10"} />
        <Campo etiqueta="Dias de gracia" name="diasGracia" type="number" min={0} max={60} defaultValue={regla?.diasGracia ?? "3"} />
        <Selector etiqueta="Cada cuanto se cobra" name="frecuencia" defaultValue={regla?.frecuencia ?? "UNICA"}>
          <option value="UNICA">Una sola vez</option>
          <option value="DIARIA">Por cada dia de atraso</option>
          <option value="SEMANAL">Por cada semana de atraso</option>
          <option value="MENSUAL">Por cada mes de atraso</option>
        </Selector>
        <Campo etiqueta="Tope maximo" name="topeMaximo" type="number" step="0.01" min={0} defaultValue={regla?.topeMaximo ?? ""} ayuda="Vacio: sin tope" />
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="aplicaATodos" defaultChecked={regla?.aplicaATodos ?? true} className="h-4 w-4 rounded border-slate-300 text-marca-600" />
          Aplica a todos los conceptos
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="activa" defaultChecked={regla?.activa ?? true} className="h-4 w-4 rounded border-slate-300 text-marca-600" />
          Activa
        </label>
        <Boton type="submit" variante="secundario" disabled={pendiente}>
          {pendiente ? "Guardando..." : regla ? "Guardar regla" : "Crear regla"}
        </Boton>
      </div>
    </form>
  );
}

export function FormularioDescuento({ conceptos }: { conceptos: Opcion[] }) {
  const [estado, accion, pendiente] = useActionState<EstadoFinanzas, FormData>(guardarDescuento, {});
  return (
    <form action={accion} className="space-y-3">
      <Avisos estado={estado} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Campo etiqueta="Nombre" name="nombre" required placeholder="Beca academica 50%" />
        <Selector etiqueta="Tipo" name="tipoCalculo" defaultValue="PORCENTAJE">
          <option value="PORCENTAJE">Porcentaje</option>
          <option value="FIJO">Monto fijo</option>
        </Selector>
        <Campo etiqueta="Valor" name="valor" type="number" step="0.01" min={0} required />
        <Campo etiqueta="Descripcion" name="descripcion" />
        <Campo etiqueta="Vigente desde" name="vigenciaInicio" type="date" />
        <Campo etiqueta="Vigente hasta" name="vigenciaFin" type="date" />
      </div>
      <div>
        <p className="etiqueta-campo">Conceptos a los que aplica</p>
        <div className="flex flex-wrap gap-2 rounded-lg border border-slate-200 p-3">
          {conceptos.length === 0 ? (
            <span className="text-xs text-slate-400">No hay conceptos de cobro todavia.</span>
          ) : (
            conceptos.map((concepto) => (
              <label key={concepto.id} className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" name="conceptos" value={concepto.id} className="h-4 w-4 rounded border-slate-300 text-marca-600" />
                {concepto.etiqueta}
              </label>
            ))
          )}
        </div>
        <p className="mt-1 text-xs text-slate-500">Si no marcas ninguno, aplica a todos.</p>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="acumulable" className="h-4 w-4 rounded border-slate-300 text-marca-600" />
          Acumulable con otras becas
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="requiereAutorizacion" defaultChecked className="h-4 w-4 rounded border-slate-300 text-marca-600" />
          Requiere autorizacion
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="activo" defaultChecked className="h-4 w-4 rounded border-slate-300 text-marca-600" />
          Activo
        </label>
        <Boton type="submit" disabled={pendiente}>
          {pendiente ? "Guardando..." : "Crear descuento"}
        </Boton>
      </div>
    </form>
  );
}

export function FormularioAsignarBeca({
  alumnos,
  descuentos,
  ciclos,
}: {
  alumnos: Opcion[];
  descuentos: Opcion[];
  ciclos: Opcion[];
}) {
  const [estado, accion, pendiente] = useActionState<EstadoFinanzas, FormData>(asignarBeca, {});
  return (
    <form action={accion} className="space-y-3">
      <Avisos estado={estado} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Selector etiqueta="Alumno" name="alumnoId" required className="lg:col-span-2">
          <option value="">Selecciona...</option>
          {alumnos.map((alumno) => (
            <option key={alumno.id} value={alumno.id}>
              {alumno.etiqueta}
            </option>
          ))}
        </Selector>
        <Selector etiqueta="Beca o descuento" name="descuentoId" required>
          <option value="">Selecciona...</option>
          {descuentos.map((descuento) => (
            <option key={descuento.id} value={descuento.id}>
              {descuento.etiqueta}
            </option>
          ))}
        </Selector>
        <Selector etiqueta="Ciclo" name="cicloId">
          <option value="">Todos los ciclos</option>
          {ciclos.map((ciclo) => (
            <option key={ciclo.id} value={ciclo.id}>
              {ciclo.etiqueta}
            </option>
          ))}
        </Selector>
        <Campo etiqueta="Observaciones" name="observaciones" className="lg:col-span-3" />
      </div>
      <div className="flex justify-end">
        <Boton type="submit" variante="secundario" disabled={pendiente || alumnos.length === 0}>
          {pendiente ? "Asignando..." : "Asignar beca"}
        </Boton>
      </div>
    </form>
  );
}
