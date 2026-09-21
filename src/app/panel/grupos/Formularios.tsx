"use client";

import { useActionState, useState } from "react";
import { Alerta, Boton, Campo, Selector } from "@/components/ui";
import {
  actualizarGrupo,
  cambiarDocenteClase,
  crearClase,
  crearGrupo,
  darDeBajaInscripcion,
  eliminarClase,
  inscribirAlumno,
  type EstadoFormulario,
} from "./acciones";

export type PlanConGrados = {
  id: number;
  nombre: string;
  nivel: string;
  grados: { id: number; nombre: string }[];
};

type Opcion = { id: number; etiqueta: string };

function Avisos({ estado }: { estado: EstadoFormulario }) {
  return (
    <>
      {estado.error && (
        <Alerta tipo="error">
          <p className="font-medium">{estado.error}</p>
          {estado.detalles && (
            <ul className="mt-1 list-inside list-disc text-xs">
              {estado.detalles.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          )}
        </Alerta>
      )}
      {estado.ok && estado.mensaje && (
        <Alerta tipo="exito">
          <p>{estado.mensaje}</p>
          {estado.detalles && (
            <ul className="mt-1 list-inside list-disc text-xs">
              {estado.detalles.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          )}
        </Alerta>
      )}
    </>
  );
}

export function FormularioNuevoGrupo({
  planes,
  ciclos,
  planteles,
  turnos,
  aulas,
  sugerencia,
}: {
  planes: PlanConGrados[];
  ciclos: Opcion[];
  planteles: Opcion[];
  turnos: Opcion[];
  aulas: Opcion[];
  sugerencia: string;
}) {
  const [estado, accion, pendiente] = useActionState<EstadoFormulario, FormData>(crearGrupo, {});
  const [planId, setPlanId] = useState<number>(planes[0]?.id ?? 0);
  const grados = planes.find((plan) => plan.id === planId)?.grados ?? [];

  return (
    <form action={accion} className="space-y-3">
      <Avisos estado={estado} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Campo
          etiqueta="Nombre del grupo"
          name="nombre"
          required
          placeholder={sugerencia}
          ayuda="El nombre lo decide la escuela"
        />
        <Selector etiqueta="Ciclo escolar" name="cicloId" required>
          {ciclos.map((ciclo) => (
            <option key={ciclo.id} value={ciclo.id}>
              {ciclo.etiqueta}
            </option>
          ))}
        </Selector>
        <Selector
          etiqueta="Plan de estudios"
          name="planId"
          required
          value={planId}
          onChange={(e) => setPlanId(Number(e.target.value))}
        >
          {planes.map((plan) => (
            <option key={plan.id} value={plan.id}>
              {plan.nivel} · {plan.nombre}
            </option>
          ))}
        </Selector>
        <Selector etiqueta="Grado" name="gradoId" required>
          {grados.map((grado) => (
            <option key={grado.id} value={grado.id}>
              {grado.nombre}
            </option>
          ))}
        </Selector>
        <Selector etiqueta="Plantel" name="plantelId">
          <option value="">Sin asignar</option>
          {planteles.map((plantel) => (
            <option key={plantel.id} value={plantel.id}>
              {plantel.etiqueta}
            </option>
          ))}
        </Selector>
        <Selector etiqueta="Turno" name="turnoId">
          <option value="">Sin asignar</option>
          {turnos.map((turno) => (
            <option key={turno.id} value={turno.id}>
              {turno.etiqueta}
            </option>
          ))}
        </Selector>
        <Selector etiqueta="Aula" name="aulaId">
          <option value="">Sin asignar</option>
          {aulas.map((aula) => (
            <option key={aula.id} value={aula.id}>
              {aula.etiqueta}
            </option>
          ))}
        </Selector>
        <Campo etiqueta="Cupo maximo" name="cupoMaximo" type="number" min={1} />
      </div>
      <div className="flex justify-end">
        <Boton type="submit" disabled={pendiente}>
          {pendiente ? "Creando..." : "Crear grupo"}
        </Boton>
      </div>
    </form>
  );
}

export function FormularioEditarGrupo({
  grupo,
  planteles,
  turnos,
  aulas,
}: {
  grupo: {
    id: number;
    nombre: string;
    plantelId: number | null;
    turnoId: number | null;
    aulaId: number | null;
    cupoMaximo: number | null;
    activo: boolean;
  };
  planteles: Opcion[];
  turnos: Opcion[];
  aulas: Opcion[];
}) {
  const [estado, accion, pendiente] = useActionState<EstadoFormulario, FormData>(
    actualizarGrupo,
    {}
  );
  return (
    <form action={accion} className="space-y-3">
      <input type="hidden" name="id" value={grupo.id} />
      <Avisos estado={estado} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Campo etiqueta="Nombre" name="nombre" required defaultValue={grupo.nombre} />
        <Selector etiqueta="Plantel" name="plantelId" defaultValue={grupo.plantelId ?? ""}>
          <option value="">Sin asignar</option>
          {planteles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.etiqueta}
            </option>
          ))}
        </Selector>
        <Selector etiqueta="Turno" name="turnoId" defaultValue={grupo.turnoId ?? ""}>
          <option value="">Sin asignar</option>
          {turnos.map((t) => (
            <option key={t.id} value={t.id}>
              {t.etiqueta}
            </option>
          ))}
        </Selector>
        <Selector etiqueta="Aula" name="aulaId" defaultValue={grupo.aulaId ?? ""}>
          <option value="">Sin asignar</option>
          {aulas.map((a) => (
            <option key={a.id} value={a.id}>
              {a.etiqueta}
            </option>
          ))}
        </Selector>
        <Campo
          etiqueta="Cupo maximo"
          name="cupoMaximo"
          type="number"
          min={1}
          defaultValue={grupo.cupoMaximo ?? ""}
        />
        <label className="flex items-center gap-2 pt-6 text-sm text-slate-700">
          <input
            type="checkbox"
            name="activo"
            defaultChecked={grupo.activo}
            className="h-4 w-4 rounded border-slate-300 text-marca-600"
          />
          Grupo activo
        </label>
      </div>
      <div className="flex justify-end">
        <Boton type="submit" variante="secundario" disabled={pendiente}>
          {pendiente ? "Guardando..." : "Guardar cambios"}
        </Boton>
      </div>
    </form>
  );
}

export function FormularioNuevaClase({
  grupoId,
  materias,
  docentes,
  aulas,
}: {
  grupoId: number;
  materias: Opcion[];
  docentes: Opcion[];
  aulas: Opcion[];
}) {
  const [estado, accion, pendiente] = useActionState<EstadoFormulario, FormData>(crearClase, {});
  // Igual que al inscribir: si al asignar la ultima materia el formulario
  // desapareciera, el aviso de exito se iria con el.
  if (materias.length === 0) {
    return (
      <form action={accion} className="space-y-3">
        <Avisos estado={estado} />
        <p className="text-sm text-slate-500">
          Todas las materias del grado ya tienen clase abierta en este grupo.
        </p>
      </form>
    );
  }
  return (
    <form action={accion} className="space-y-3">
      <input type="hidden" name="grupoId" value={grupoId} />
      <Avisos estado={estado} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Selector etiqueta="Materia" name="planMateriaId" required className="lg:col-span-2">
          <option value="">Selecciona...</option>
          {materias.map((materia) => (
            <option key={materia.id} value={materia.id}>
              {materia.etiqueta}
            </option>
          ))}
        </Selector>
        <Selector etiqueta="Docente" name="docenteId" required>
          <option value="">Selecciona...</option>
          {docentes.map((docente) => (
            <option key={docente.id} value={docente.id}>
              {docente.etiqueta}
            </option>
          ))}
        </Selector>
        <Selector etiqueta="Aula" name="aulaId">
          <option value="">La del grupo</option>
          {aulas.map((aula) => (
            <option key={aula.id} value={aula.id}>
              {aula.etiqueta}
            </option>
          ))}
        </Selector>
      </div>
      <div className="flex justify-end">
        <Boton type="submit" disabled={pendiente}>
          {pendiente ? "Asignando..." : "Abrir clase"}
        </Boton>
      </div>
    </form>
  );
}

export function SelectorDocente({
  claseId,
  grupoId,
  docenteActual,
  docentes,
}: {
  claseId: number;
  grupoId: number;
  docenteActual: number;
  docentes: Opcion[];
}) {
  const [estado, accion, pendiente] = useActionState<EstadoFormulario, FormData>(
    cambiarDocenteClase,
    {}
  );
  return (
    <form action={accion} className="flex items-center gap-2">
      <input type="hidden" name="claseId" value={claseId} />
      <input type="hidden" name="grupoId" value={grupoId} />
      <select
        name="docenteId"
        defaultValue={docenteActual}
        className="campo max-w-[14rem] py-1 text-xs"
        aria-label="Docente de la clase"
      >
        {docentes.map((docente) => (
          <option key={docente.id} value={docente.id}>
            {docente.etiqueta}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={pendiente}
        className="rounded-md px-2 py-1 text-xs font-medium text-marca-600 hover:bg-slate-100"
      >
        {pendiente ? "..." : "Cambiar"}
      </button>
      {estado.error && <span className="text-xs text-red-600">{estado.error}</span>}
    </form>
  );
}

export function BotonEliminarClase({ claseId, grupoId }: { claseId: number; grupoId: number }) {
  const [estado, accion, pendiente] = useActionState<EstadoFormulario, FormData>(eliminarClase, {});
  return (
    <form action={accion}>
      <input type="hidden" name="claseId" value={claseId} />
      <input type="hidden" name="grupoId" value={grupoId} />
      <button
        type="submit"
        disabled={pendiente}
        className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
      >
        {pendiente ? "..." : "Eliminar"}
      </button>
      {estado.error && <p className="mt-1 max-w-xs text-xs text-red-600">{estado.error}</p>}
    </form>
  );
}

export function FormularioInscribir({
  grupoId,
  alumnos,
}: {
  grupoId: number;
  alumnos: Opcion[];
}) {
  const [estado, accion, pendiente] = useActionState<EstadoFormulario, FormData>(
    inscribirAlumno,
    {}
  );
  // El formulario permanece montado aunque la lista quede vacia: si se
  // desmontara al inscribir al ultimo alumno, el aviso de exito se perderia
  // y nadie sabria si la inscripcion se hizo.
  const sinAlumnos = alumnos.length === 0;
  return (
    <form action={accion} className="space-y-3">
      <input type="hidden" name="grupoId" value={grupoId} />
      <Avisos estado={estado} />
      {sinAlumnos ? (
        <p className="text-sm text-slate-500">
          No hay alumnos activos de este plan sin inscripcion en el ciclo.
        </p>
      ) : (
        <div className="flex flex-wrap items-end gap-3">
          <Selector etiqueta="Alumno" name="alumnoId" required className="min-w-[18rem] flex-1">
            <option value="">Selecciona...</option>
            {alumnos.map((alumno) => (
              <option key={alumno.id} value={alumno.id}>
                {alumno.etiqueta}
              </option>
            ))}
          </Selector>
          <Boton type="submit" disabled={pendiente}>
            {pendiente ? "Inscribiendo..." : "Inscribir"}
          </Boton>
        </div>
      )}
    </form>
  );
}

export function BotonDarDeBaja({
  inscripcionId,
  grupoId,
}: {
  inscripcionId: number;
  grupoId: number;
}) {
  const [estado, accion, pendiente] = useActionState<EstadoFormulario, FormData>(
    darDeBajaInscripcion,
    {}
  );
  return (
    <form action={accion}>
      <input type="hidden" name="inscripcionId" value={inscripcionId} />
      <input type="hidden" name="grupoId" value={grupoId} />
      <button
        type="submit"
        disabled={pendiente}
        className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
      >
        {pendiente ? "..." : "Dar de baja"}
      </button>
      {estado.error && <p className="text-xs text-red-600">{estado.error}</p>}
    </form>
  );
}
