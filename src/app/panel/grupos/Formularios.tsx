"use client";

import { useActionState, useState } from "react";
import { Alerta, Boton, Campo, Selector } from "@/components/ui";
import { DIAS_SEMANA } from "@/lib/formato";
import { repartirParciales, type ParcialCapturado } from "@/lib/fechasGrupo";
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
  grados: { id: number; nombre: string; materias: Opcion[] }[];
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

type RenglonHorario = {
  clave: number;
  planMateriaId: string;
  docenteId: string;
  diaSemana: string;
  horaInicio: string;
  horaFin: string;
  aulaId: string;
};

let siguienteClave = 1;
function renglonVacio(anterior?: RenglonHorario): RenglonHorario {
  // El renglon nuevo arranca donde termino el anterior: mismo dia, a la hora
  // en que acabo. Es lo mas comun al capturar un horario corrido.
  return {
    clave: siguienteClave++,
    planMateriaId: "",
    docenteId: "",
    diaSemana: anterior?.diaSemana ?? "",
    horaInicio: anterior?.horaFin ?? "",
    horaFin: "",
    aulaId: "",
  };
}

export function FormularioNuevoGrupo({
  planes,
  docentes,
  planteles,
  turnos,
  aulas,
  sugerencia,
}: {
  planes: PlanConGrados[];
  docentes: Opcion[];
  planteles: Opcion[];
  turnos: Opcion[];
  aulas: Opcion[];
  sugerencia: string;
}) {
  const [estado, accion, pendiente] = useActionState<EstadoFormulario, FormData>(crearGrupo, {});

  // Todo el formulario es controlado: si el servidor rechaza algo (por
  // ejemplo un choque de horario), lo capturado se queda en pantalla.
  const [nombre, setNombre] = useState("");
  const [planId, setPlanId] = useState<number>(planes[0]?.id ?? 0);
  const grados = planes.find((plan) => plan.id === planId)?.grados ?? [];
  const [gradoId, setGradoId] = useState<number>(grados[0]?.id ?? 0);
  const materias = grados.find((grado) => grado.id === gradoId)?.materias ?? [];
  const [plantelId, setPlantelId] = useState("");
  const [turnoId, setTurnoId] = useState("");
  const [aulaId, setAulaId] = useState("");
  const [cupo, setCupo] = useState("");

  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [numeroParciales, setNumeroParciales] = useState("");
  const [plantillaParcial, setPlantillaParcial] = useState("Parcial {N}");
  const [parciales, setParciales] = useState<ParcialCapturado[]>([]);

  const [renglones, setRenglones] = useState<RenglonHorario[]>([renglonVacio()]);

  function recalcularParciales(cambios: {
    inicio?: string;
    fin?: string;
    cantidad?: string;
    plantilla?: string;
  }) {
    const inicio = cambios.inicio ?? fechaInicio;
    const fin = cambios.fin ?? fechaFin;
    const cantidad = Number(cambios.cantidad ?? numeroParciales);
    const plantilla = cambios.plantilla ?? plantillaParcial;
    setParciales(
      Number.isInteger(cantidad) && cantidad >= 1 && cantidad <= 12
        ? repartirParciales(inicio, fin, cantidad, plantilla)
        : []
    );
  }

  function cambiarParcial(indice: number, cambios: Partial<ParcialCapturado>) {
    setParciales((previos) => previos.map((p, i) => (i === indice ? { ...p, ...cambios } : p)));
  }

  function cambiarRenglon(clave: number, cambios: Partial<RenglonHorario>) {
    setRenglones((previos) => {
      const actualizados = previos.map((r) => (r.clave === clave ? { ...r, ...cambios } : r));
      // Una materia la da un solo docente: al elegir materia se propone el
      // docente que ya tenga en otro renglon.
      if (cambios.planMateriaId) {
        const conDocente = actualizados.find(
          (r) => r.clave !== clave && r.planMateriaId === cambios.planMateriaId && r.docenteId
        );
        if (conDocente) {
          return actualizados.map((r) =>
            r.clave === clave ? { ...r, docenteId: conDocente.docenteId } : r
          );
        }
      }
      return actualizados;
    });
  }

  function cambiarGrado(nuevoGrado: number) {
    setGradoId(nuevoGrado);
    // Las materias cambian con el grado: lo capturado ya no aplica.
    setRenglones([renglonVacio()]);
  }

  const horarioJson = JSON.stringify(
    renglones.map((r) => ({
      planMateriaId: r.planMateriaId,
      docenteId: r.docenteId,
      diaSemana: r.diaSemana,
      horaInicio: r.horaInicio,
      horaFin: r.horaFin,
      ...(r.aulaId ? { aulaId: r.aulaId } : {}),
    }))
  );

  return (
    <form action={accion} className="space-y-6">
      <input type="hidden" name="parciales" value={JSON.stringify(parciales)} />
      <input type="hidden" name="horario" value={horarioJson} />
      <Avisos estado={estado} />

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-800">1. Datos del grupo</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Campo
            etiqueta="Nombre del grupo"
            name="nombre"
            required
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder={sugerencia}
            ayuda="El nombre lo decide la escuela"
          />
          <Selector
            etiqueta="Plan de estudios"
            name="planId"
            required
            value={planId}
            onChange={(e) => {
              const nuevoPlan = Number(e.target.value);
              setPlanId(nuevoPlan);
              cambiarGrado(planes.find((plan) => plan.id === nuevoPlan)?.grados[0]?.id ?? 0);
            }}
          >
            {planes.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.nivel} · {plan.nombre}
              </option>
            ))}
          </Selector>
          <Selector
            etiqueta="Grado"
            name="gradoId"
            required
            value={gradoId}
            onChange={(e) => cambiarGrado(Number(e.target.value))}
          >
            {grados.map((grado) => (
              <option key={grado.id} value={grado.id}>
                {grado.nombre}
              </option>
            ))}
          </Selector>
          <Campo
            etiqueta="Cupo maximo"
            name="cupoMaximo"
            type="number"
            min={1}
            value={cupo}
            onChange={(e) => setCupo(e.target.value)}
          />
          <Selector
            etiqueta="Plantel"
            name="plantelId"
            value={plantelId}
            onChange={(e) => setPlantelId(e.target.value)}
          >
            <option value="">Sin asignar</option>
            {planteles.map((plantel) => (
              <option key={plantel.id} value={plantel.id}>
                {plantel.etiqueta}
              </option>
            ))}
          </Selector>
          <Selector
            etiqueta="Turno"
            name="turnoId"
            value={turnoId}
            onChange={(e) => setTurnoId(e.target.value)}
          >
            <option value="">Sin asignar</option>
            {turnos.map((turno) => (
              <option key={turno.id} value={turno.id}>
                {turno.etiqueta}
              </option>
            ))}
          </Selector>
          <Selector
            etiqueta="Aula"
            name="aulaId"
            value={aulaId}
            onChange={(e) => setAulaId(e.target.value)}
          >
            <option value="">Sin asignar</option>
            {aulas.map((aula) => (
              <option key={aula.id} value={aula.id}>
                {aula.etiqueta}
              </option>
            ))}
          </Selector>
        </div>
      </section>

      <section className="space-y-3 border-t border-slate-100 pt-4">
        <h3 className="text-sm font-semibold text-slate-800">2. Inicio y termino de clases</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Campo
            etiqueta="Inicio de clases"
            name="fechaInicio"
            type="date"
            required
            value={fechaInicio}
            onChange={(e) => {
              setFechaInicio(e.target.value);
              recalcularParciales({ inicio: e.target.value });
            }}
          />
          <Campo
            etiqueta="Termino de clases"
            name="fechaFin"
            type="date"
            required
            value={fechaFin}
            onChange={(e) => {
              setFechaFin(e.target.value);
              recalcularParciales({ fin: e.target.value });
            }}
          />
          <Campo
            etiqueta="Numero de parciales"
            type="number"
            min={1}
            max={12}
            required
            value={numeroParciales}
            onChange={(e) => {
              setNumeroParciales(e.target.value);
              recalcularParciales({ cantidad: e.target.value });
            }}
            ayuda="Parciales, bimestres o como los llame la escuela"
          />
          <Campo
            etiqueta="Nombre de cada parcial"
            value={plantillaParcial}
            onChange={(e) => {
              setPlantillaParcial(e.target.value);
              recalcularParciales({ plantilla: e.target.value });
            }}
            ayuda="Usa {N} para el numero"
          />
        </div>
        {parciales.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs text-slate-500">
              Las fechas se reparten en partes iguales; puedes ajustar cada una. Si cambias las fechas
              del grupo o el numero de parciales, se vuelven a repartir.
            </p>
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {parciales.map((parcial, indice) => (
                <li key={indice} className="grid gap-2 px-3 py-2 sm:grid-cols-3">
                  <input
                    className="campo"
                    aria-label={`Nombre del parcial ${indice + 1}`}
                    value={parcial.nombre}
                    onChange={(e) => cambiarParcial(indice, { nombre: e.target.value })}
                  />
                  <input
                    className="campo"
                    type="date"
                    aria-label={`Inicio del parcial ${indice + 1}`}
                    value={parcial.fechaInicio}
                    onChange={(e) => cambiarParcial(indice, { fechaInicio: e.target.value })}
                  />
                  <input
                    className="campo"
                    type="date"
                    aria-label={`Fin del parcial ${indice + 1}`}
                    value={parcial.fechaFin}
                    onChange={(e) => cambiarParcial(indice, { fechaFin: e.target.value })}
                  />
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-xs text-slate-500">
            Captura las fechas de clases y el numero de parciales para ver sus fechas.
          </p>
        )}
      </section>

      <section className="space-y-3 border-t border-slate-100 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-800">3. Horario del grupo</h3>
          <Boton
            type="button"
            variante="secundario"
            onClick={() => setRenglones((previos) => [...previos, renglonVacio(previos.at(-1))])}
          >
            Agregar renglon
          </Boton>
        </div>
        {materias.length === 0 ? (
          <Alerta tipo="aviso">
            Este grado no tiene materias en el mapa curricular. Agregalas en Materias antes de crear el
            grupo.
          </Alerta>
        ) : docentes.length === 0 ? (
          <Alerta tipo="aviso">No hay docentes activos. Da de alta al personal docente primero.</Alerta>
        ) : null}
        <p className="text-xs text-slate-500">
          Un renglon por cada bloque de clase: que materia, quien la imparte, que dia y a que hora.
          Una materia que se da varios dias lleva un renglon por dia.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[60rem] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="pb-2 pr-2 font-medium">Materia</th>
                <th className="pb-2 pr-2 font-medium">Docente</th>
                <th className="pb-2 pr-2 font-medium">Dia</th>
                <th className="pb-2 pr-2 font-medium">Inicio</th>
                <th className="pb-2 pr-2 font-medium">Fin</th>
                <th className="pb-2 pr-2 font-medium">Aula</th>
                <th className="pb-2 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {renglones.map((renglon, indice) => (
                <tr key={renglon.clave}>
                  <td className="py-2 pr-2">
                    <select
                      className="campo"
                      aria-label={`Materia del renglon ${indice + 1}`}
                      value={renglon.planMateriaId}
                      onChange={(e) => cambiarRenglon(renglon.clave, { planMateriaId: e.target.value })}
                    >
                      <option value="">Selecciona...</option>
                      {materias.map((materia) => (
                        <option key={materia.id} value={materia.id}>
                          {materia.etiqueta}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 pr-2">
                    <select
                      className="campo"
                      aria-label={`Docente del renglon ${indice + 1}`}
                      value={renglon.docenteId}
                      onChange={(e) => cambiarRenglon(renglon.clave, { docenteId: e.target.value })}
                    >
                      <option value="">Selecciona...</option>
                      {docentes.map((docente) => (
                        <option key={docente.id} value={docente.id}>
                          {docente.etiqueta}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 pr-2">
                    <select
                      className="campo"
                      aria-label={`Dia del renglon ${indice + 1}`}
                      value={renglon.diaSemana}
                      onChange={(e) => cambiarRenglon(renglon.clave, { diaSemana: e.target.value })}
                    >
                      <option value="">Dia...</option>
                      {DIAS_SEMANA.map((dia) => (
                        <option key={dia.valor} value={dia.valor}>
                          {dia.nombre}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      className="campo"
                      type="time"
                      aria-label={`Inicio del renglon ${indice + 1}`}
                      value={renglon.horaInicio}
                      onChange={(e) => cambiarRenglon(renglon.clave, { horaInicio: e.target.value })}
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      className="campo"
                      type="time"
                      aria-label={`Fin del renglon ${indice + 1}`}
                      value={renglon.horaFin}
                      onChange={(e) => cambiarRenglon(renglon.clave, { horaFin: e.target.value })}
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <select
                      className="campo"
                      aria-label={`Aula del renglon ${indice + 1}`}
                      value={renglon.aulaId}
                      onChange={(e) => cambiarRenglon(renglon.clave, { aulaId: e.target.value })}
                    >
                      <option value="">La del grupo</option>
                      {aulas.map((aula) => (
                        <option key={aula.id} value={aula.id}>
                          {aula.etiqueta}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 text-right">
                    <button
                      type="button"
                      disabled={renglones.length === 1}
                      onClick={() =>
                        setRenglones((previos) => previos.filter((r) => r.clave !== renglon.clave))
                      }
                      className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:text-slate-300"
                    >
                      Quitar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

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
          No hay alumnos activos de este plan libres en las fechas de este grupo.
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
