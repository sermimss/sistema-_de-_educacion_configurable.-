"use client";

import { useActionState } from "react";
import { Alerta, Boton, Campo, Selector } from "@/components/ui";
import { MasOpciones } from "@/components/MasOpciones";
import {
  agregarPrerrequisito,
  asignarMateriaAPlan,
  cambiarEstadoMateria,
  crearArea,
  crearMateria,
  eliminarArea,
  eliminarMateria,
  quitarMateriaDePlan,
  type EstadoEliminarMateria,
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

/// Menu discreto (⋯) de una materia del mapa curricular: quitarla del plan.
export function MenuMateriaDelPlan({ planMateriaId, planId, materia }: { planMateriaId: number; planId: number; materia: string }) {
  return (
    <MasOpciones
      opciones={[
        {
          etiqueta: "Quitar del mapa",
          ventana: (cerrar) => <VentanaQuitarMateria planMateriaId={planMateriaId} planId={planId} materia={materia} cerrar={cerrar} />,
        },
      ]}
    />
  );
}

function VentanaQuitarMateria({ planMateriaId, planId, materia, cerrar }: { planMateriaId: number; planId: number; materia: string; cerrar: () => void }) {
  const [estado, accion, pendiente] = useActionState<EstadoFormulario, FormData>(quitarMateriaDePlan, {});
  return (
    <form action={accion} className="space-y-3 text-sm" data-quitar-materia={planMateriaId}>
      <h2 className="text-base font-semibold text-slate-900">Quitar {materia} del mapa curricular</h2>
      <input type="hidden" name="planMateriaId" value={planMateriaId} />
      <input type="hidden" name="planId" value={planId} />
      <p className="text-xs text-slate-600">La materia sigue en el catalogo; solo deja de formar parte de este plan.</p>
      {estado.error && <Alerta tipo="error">{estado.error}</Alerta>}
      <div className="flex justify-end gap-2">
        <Boton type="button" variante="secundario" onClick={cerrar}>Cancelar</Boton>
        <Boton type="submit" variante="peligro" disabled={pendiente}>{pendiente ? "Quitando..." : "Quitar"}</Boton>
      </div>
    </form>
  );
}


type MateriaCatalogo = { id: number; nombre: string; clave: string; activa: boolean };

/// Menu discreto (⋯) de una materia del catalogo: activar o desactivar y eliminar.
export function MenuMateria(materia: MateriaCatalogo) {
  return (
    <MasOpciones
      opciones={[
        { etiqueta: materia.activa ? "Desactivar" : "Activar", accion: cambiarEstadoMateria, campos: { materiaId: materia.id } },
        { etiqueta: "Eliminar materia", ventana: (cerrar) => <VentanaEliminarMateria {...materia} cerrar={cerrar} /> },
      ]}
    />
  );
}

function VentanaEliminarMateria({ id, nombre, clave, cerrar }: MateriaCatalogo & { cerrar: () => void }) {
  const [estado, accion, pendiente] = useActionState<EstadoEliminarMateria, FormData>(eliminarMateria, {});
  return (
    <div className="space-y-3 text-sm" data-eliminar-materia={clave}>
      <h2 className="text-base font-semibold text-slate-900">Eliminar la materia {nombre}</h2>
      <p className="text-xs text-slate-600">
        Se borra del catalogo y se quita de los mapas curriculares donde este. Solo se puede si nunca se abrio una
        clase con ella; si ya se impartio, se puede desactivar.
      </p>
      {estado.error && <Alerta tipo="error">{estado.error}</Alerta>}
      {estado.ofrecerDesactivar && (
        <form action={cambiarEstadoMateria} onSubmit={() => setTimeout(cerrar, 0)} className="flex justify-end">
          <input type="hidden" name="materiaId" value={id} />
          <Boton type="submit" variante="secundario">Desactivar la materia</Boton>
        </form>
      )}
      <form action={accion} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="materiaId" value={id} />
        <Campo etiqueta={`Escribe "${nombre}" o "${clave}" para confirmar`} name="confirmacion" autoComplete="off" className="min-w-[14rem] flex-1" />
        <Boton type="button" variante="secundario" onClick={cerrar}>Cancelar</Boton>
        <Boton type="submit" variante="peligro" disabled={pendiente}>{pendiente ? "Eliminando..." : "Eliminar materia"}</Boton>
      </form>
    </div>
  );
}

type AreaCatalogo = { id: number; nombre: string; materias: number };

/// Menu discreto (⋯) de un area: eliminarla (sus materias quedan sin area).
export function MenuArea(area: AreaCatalogo) {
  return (
    <MasOpciones
      etiqueta={`Mas opciones de ${area.nombre}`}
      opciones={[{ etiqueta: "Eliminar area", ventana: (cerrar) => <VentanaEliminarArea {...area} cerrar={cerrar} /> }]}
    />
  );
}

function VentanaEliminarArea({ id, nombre, materias, cerrar }: AreaCatalogo & { cerrar: () => void }) {
  const [estado, accion, pendiente] = useActionState<EstadoFormulario, FormData>(eliminarArea, {});
  return (
    <form action={accion} className="space-y-3 text-sm" data-eliminar-area={id}>
      <h2 className="text-base font-semibold text-slate-900">Eliminar el area {nombre}</h2>
      <input type="hidden" name="areaId" value={id} />
      <p className="text-xs text-slate-600">
        {materias > 0
          ? `Sus ${materias} materia(s) no se borran: solo quedan sin area.`
          : "No tiene materias."}
      </p>
      {estado.error && <Alerta tipo="error">{estado.error}</Alerta>}
      <div className="flex flex-wrap items-end gap-2">
        <Campo etiqueta={`Escribe "${nombre}" para confirmar`} name="confirmacion" autoComplete="off" className="min-w-[14rem] flex-1" />
        <Boton type="button" variante="secundario" onClick={cerrar}>Cancelar</Boton>
        <Boton type="submit" variante="peligro" disabled={pendiente}>{pendiente ? "Eliminando..." : "Eliminar area"}</Boton>
      </div>
    </form>
  );
}
