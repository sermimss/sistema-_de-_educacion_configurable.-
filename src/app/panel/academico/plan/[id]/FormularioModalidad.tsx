"use client";

import { useActionState, useState } from "react";
import type { TipoPeriodoAcademico } from "@prisma/client";
import { Alerta, Boton, Campo, Selector } from "@/components/ui";
import { MODALIDADES, nombrePeriodo, periodosEquivalentes, plantillaSugerida } from "@/lib/modalidad";
import { accionCambiarModalidad, type EstadoModalidad } from "../../acciones";

export function FormularioModalidad({
  plan,
  enUso,
}: {
  plan: { id: number; nombre: string; clave: string; modalidad: TipoPeriodoAcademico; periodos: number };
  enUso: boolean;
}) {
  const [estado, accion, pendiente] = useActionState<EstadoModalidad, FormData>(accionCambiarModalidad, {});
  const inicial: TipoPeriodoAcademico = plan.modalidad === "SEMESTRE" ? "CUATRIMESTRE" : "SEMESTRE";
  const [modalidad, setModalidad] = useState<TipoPeriodoAcademico>(inicial);
  const [periodos, setPeriodos] = useState(String(periodosEquivalentes(plan.modalidad, plan.periodos, inicial)));
  const [plantilla, setPlantilla] = useState(plantillaSugerida(inicial));
  const etiqueta = MODALIDADES.find((m) => m.valor === modalidad)?.etiqueta ?? "";
  const n = Math.min(30, Math.max(0, Number(periodos) || 0));

  return (
    <form action={accion} className="space-y-4">
      <input type="hidden" name="planId" value={plan.id} />
      {estado.error && <Alerta tipo="error">{estado.error}</Alerta>}

      <div className="grid gap-3 sm:grid-cols-3">
        <Selector
          etiqueta="Nueva modalidad"
          name="modalidad"
          value={modalidad}
          onChange={(e) => {
            const m = e.target.value as TipoPeriodoAcademico;
            setModalidad(m);
            setPeriodos(String(periodosEquivalentes(plan.modalidad, plan.periodos, m)));
            setPlantilla(plantillaSugerida(m));
          }}
        >
          {MODALIDADES.map((m) => (
            <option key={m.valor} value={m.valor}>{m.etiqueta}</option>
          ))}
        </Selector>
        <Campo
          etiqueta="Numero de periodos"
          name="periodos"
          type="number"
          min={1}
          max={30}
          required
          value={periodos}
          onChange={(e) => setPeriodos(e.target.value)}
          ayuda="Se propone la misma duracion en meses"
        />
        <Campo
          etiqueta="Nombre de cada periodo"
          name="plantilla"
          required
          value={plantilla}
          onChange={(e) => setPlantilla(e.target.value)}
          ayuda="Usa {N} para el numero"
        />
      </div>

      {n > 0 && plantilla.includes("{N}") && (
        <div>
          <p className="text-xs text-slate-500">Quedaria asi:</p>
          <div className="mt-1 flex flex-wrap gap-1.5" data-vista-periodos>
            {Array.from({ length: n }, (_, i) => (
              <span key={i} className="rounded bg-marca-50 px-2 py-0.5 text-xs text-marca-700">
                {nombrePeriodo(plantilla, i + 1)}
              </span>
            ))}
          </div>
        </div>
      )}

      {enUso ? (
        <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm text-slate-700">
            Este plan ya tiene alumnos o grupos, asi que se creara un <strong>plan nuevo</strong> en
            modalidad {etiqueta.toLowerCase()}. Los alumnos actuales terminan en {plan.clave}, que deja de
            recibir alumnos de nuevo ingreso.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo etiqueta="Nombre del plan nuevo" name="nombre" required defaultValue={`${plan.nombre} (${etiqueta})`} />
            <Campo etiqueta="Clave del plan nuevo" name="clave" required defaultValue={`${plan.clave}-${modalidad.slice(0, 1)}`} />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="copiarMaterias" defaultChecked className="h-4 w-4 rounded border-slate-300" />
            Copiar las materias y prerrequisitos al plan nuevo (repartidas en los periodos nuevos para que solo las acomodes)
          </label>
        </div>
      ) : (
        <Alerta tipo="info">
          El plan aun no tiene alumnos ni grupos: se convierte tal cual. Sus materias se reparten en los periodos
          nuevos; revisalas despues en el mapa curricular.
        </Alerta>
      )}

      <div className="flex justify-end">
        <Boton type="submit" disabled={pendiente}>
          {pendiente ? "Aplicando..." : enUso ? "Crear el plan nuevo" : "Convertir el plan"}
        </Boton>
      </div>
    </form>
  );
}
