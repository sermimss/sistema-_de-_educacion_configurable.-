"use client";

import { useActionState } from "react";
import { Alerta, Boton, Campo, Selector } from "@/components/ui";
import {
  agregarPrerrequisito,
  asignarMateriaAPlan,
  crearArea,
  crearMateria,
  quitarMateriaDePlan,
  type EstadoFormulario,
} from "./acciones";

type Opcion = { id: number; etiqueta: string };

export function FormularioMateria({ areas }: { areas: Opcion[] }) {
  const [estado, accion, pendiente] = useActionState<EstadoFormulario, FormData>(crearMateria, {});
  return (
    <form action={accion} className="space-y-3">
      {estado.error && <Alerta tipo="error">{estado.error}</Alerta>}
      {estado.ok && estado.mensaje && <Alerta tipo="exito">{estado.mensaje}</Alerta>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Campo etiqueta="Clave" name="clave" required placeholder="MAT-101" />
        <Campo etiqueta="Nombre de la materia" name="nombre" required />
        <Selector etiqueta="Area" name="areaId">
          <option value="">Sin area</option>
          {areas.map((area) => (
            <option key={area.id} value={area.id}>
              {area.etiqueta}
            </option>
          ))}
        </Selector>
        <Campo etiqueta="Descripcion" name="descripcion" />
      </div>
      <div className="flex justify-end">
        <Boton type="submit" disabled={pendiente}>
          {pendiente ? "Guardando..." : "Agregar materia"}
        </Boton>
      </div>
    </form>
  );
}

export function FormularioArea() {
  const [estado, accion, pendiente] = useActionState<EstadoFormulario, FormData>(crearArea, {});
  return (
    <form action={accion} className="space-y-3">
      {estado.error && <Alerta tipo="error">{estado.error}</Alerta>}
      {estado.ok && estado.mensaje && <Alerta tipo="exito">{estado.mensaje}</Alerta>}
      <div className="grid gap-3 sm:grid-cols-3">
        <Campo etiqueta="Nombre del area" name="nombre" required placeholder="Ciencias de la salud" />
        <Campo etiqueta="Clave" name="clave" />
        <div className="flex items-end">
          <Boton type="submit" variante="secundario" disabled={pendiente}>
            {pendiente ? "Guardando..." : "Agregar area"}
          </Boton>
        </div>
      </div>
    </form>
  );
}

export function FormularioAsignarMateria({
  planId,
  grados,
  materias,
}: {
  planId: number;
  grados: Opcion[];
  materias: Opcion[];
}) {
  const [estado, accion, pendiente] = useActionState<EstadoFormulario, FormData>(
    asignarMateriaAPlan,
    {}
  );
  return (
    <form action={accion} className="space-y-3">
      <input type="hidden" name="planId" value={planId} />
      {estado.error && <Alerta tipo="error">{estado.error}</Alerta>}
      {estado.ok && estado.mensaje && <Alerta tipo="exito">{estado.mensaje}</Alerta>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Selector etiqueta="Grado" name="gradoId" required>
          <option value="">Selecciona...</option>
          {grados.map((grado) => (
            <option key={grado.id} value={grado.id}>
              {grado.etiqueta}
            </option>
          ))}
        </Selector>
        <Selector etiqueta="Materia" name="materiaId" required className="lg:col-span-2">
          <option value="">Selecciona...</option>
          {materias.map((materia) => (
            <option key={materia.id} value={materia.id}>
              {materia.etiqueta}
            </option>
          ))}
        </Selector>
        <Campo etiqueta="Creditos" name="creditos" type="number" min={0} />
        <Campo etiqueta="Horas por semana" name="horasSemana" type="number" min={0} />
      </div>
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            name="obligatoria"
            defaultChecked
            className="h-4 w-4 rounded border-slate-300 text-marca-600"
          />
          Materia obligatoria
        </label>
        <Boton type="submit" disabled={pendiente}>
          {pendiente ? "Agregando..." : "Agregar al mapa curricular"}
        </Boton>
      </div>
    </form>
  );
}

export function FormularioPrerrequisito({
  planId,
  materiasDelPlan,
}: {
  planId: number;
  materiasDelPlan: { id: number; etiqueta: string }[];
}) {
  const [estado, accion, pendiente] = useActionState<EstadoFormulario, FormData>(
    agregarPrerrequisito,
    {}
  );
  return (
    <form action={accion} className="space-y-3">
      <input type="hidden" name="planId" value={planId} />
      {estado.error && <Alerta tipo="error">{estado.error}</Alerta>}
      {estado.ok && estado.mensaje && <Alerta tipo="exito">{estado.mensaje}</Alerta>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Selector etiqueta="Para cursar esta materia" name="planMateriaId" required>
          <option value="">Selecciona...</option>
          {materiasDelPlan.map((materia) => (
            <option key={materia.id} value={materia.id}>
              {materia.etiqueta}
            </option>
          ))}
        </Selector>
        <Selector etiqueta="Debe tener aprobada" name="requierePlanMateriaId" required>
          <option value="">Selecciona...</option>
          {materiasDelPlan.map((materia) => (
            <option key={materia.id} value={materia.id}>
              {materia.etiqueta}
            </option>
          ))}
        </Selector>
      </div>
      <div className="flex justify-end">
        <Boton type="submit" variante="secundario" disabled={pendiente}>
          {pendiente ? "Guardando..." : "Agregar prerrequisito"}
        </Boton>
      </div>
    </form>
  );
}

export function BotonQuitarMateria({
  planMateriaId,
  planId,
}: {
  planMateriaId: number;
  planId: number;
}) {
  const [estado, accion, pendiente] = useActionState<EstadoFormulario, FormData>(
    quitarMateriaDePlan,
    {}
  );
  return (
    <form action={accion} className="text-right">
      <input type="hidden" name="planMateriaId" value={planMateriaId} />
      <input type="hidden" name="planId" value={planId} />
      <button
        type="submit"
        disabled={pendiente}
        className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:text-slate-400"
      >
        {pendiente ? "Quitando..." : "Quitar"}
      </button>
      {estado.error && <p className="mt-1 max-w-xs text-xs text-red-600">{estado.error}</p>}
    </form>
  );
}
