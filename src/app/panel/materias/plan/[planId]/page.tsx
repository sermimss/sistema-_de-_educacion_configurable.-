import Link from "next/link";
import { notFound } from "next/navigation";
import { requerirRol } from "@/lib/auth";
import { db } from "@/lib/db";
import { configBool } from "@/lib/configuracion";
import { Alerta, EstadoVacio, Insignia, Tarjeta } from "@/components/ui";
import {
  BotonQuitarMateria,
  FormularioAsignarMateria,
  FormularioPrerrequisito,
} from "../../Formularios";
import { quitarPrerrequisito } from "../../acciones";

export const dynamic = "force-dynamic";

export default async function PaginaMapaCurricular({
  params,
}: {
  params: Promise<{ planId: string }>;
}) {
  await requerirRol("ADMIN");
  const { planId } = await params;
  const id = Number(planId);
  if (!Number.isFinite(id)) notFound();

  const plan = await db.planEstudios.findUnique({
    where: { id },
    include: {
      nivel: true,
      grados: { orderBy: { numero: "asc" } },
      materias: {
        orderBy: [{ gradoId: "asc" }, { orden: "asc" }],
        include: {
          materia: true,
          grado: true,
          prerrequisitos: { include: { requiere: { include: { materia: true } } } },
          _count: { select: { clases: true } },
        },
      },
    },
  });
  if (!plan) notFound();

  const [materiasDisponibles, exigePrerrequisitos] = await Promise.all([
    db.materia.findMany({ where: { activa: true }, orderBy: { nombre: "asc" } }),
    configBool("academico.exige_prerrequisitos", true),
  ]);

  const porGrado = plan.grados.map((grado) => ({
    grado,
    materias: plan.materias.filter((m) => m.gradoId === grado.id),
  }));

  const opcionesMaterias = plan.materias.map((m) => ({
    id: m.id,
    etiqueta: `${m.grado.nombre} · ${m.materia.nombre}`,
  }));

  const totalCreditos = plan.materias.reduce((suma, m) => suma + (m.creditos ?? 0), 0);

  return (
    <div className="space-y-6">
      <header>
        <Link href="/panel/materias" className="text-sm text-marca-600 hover:underline">
          ← Materias
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-slate-900">{plan.nombre}</h1>
        <p className="mt-1 text-sm text-slate-600">
          {plan.nivel.nombre} · {plan.duracionPeriodos} periodos · {plan.materias.length} materias ·{" "}
          {totalCreditos} creditos
        </p>
      </header>

      <Tarjeta titulo="Agregar materia al mapa curricular">
        <FormularioAsignarMateria
          planId={plan.id}
          grados={plan.grados.map((g) => ({ id: g.id, etiqueta: g.nombre }))}
          materias={materiasDisponibles.map((m) => ({
            id: m.id,
            etiqueta: `${m.clave} · ${m.nombre}`,
          }))}
        />
      </Tarjeta>

      <div className="space-y-4">
        {porGrado.map(({ grado, materias }) => (
          <Tarjeta key={grado.id} titulo={grado.nombre} descripcion={`${materias.length} materia(s)`}>
            {materias.length === 0 ? (
              <EstadoVacio titulo="Sin materias en este grado" />
            ) : (
              <ul className="divide-y divide-slate-100">
                {materias.map((planMateria) => (
                  <li key={planMateria.id} className="flex items-start justify-between gap-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-slate-800">
                        {planMateria.materia.nombre}
                        <span className="ml-2 font-mono text-xs text-slate-400">
                          {planMateria.materia.clave}
                        </span>
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {planMateria.obligatoria ? "Obligatoria" : "Optativa"}
                        {planMateria.creditos ? ` · ${planMateria.creditos} creditos` : ""}
                        {planMateria.horasSemana ? ` · ${planMateria.horasSemana} h/semana` : ""}
                        {planMateria._count.clases > 0
                          ? ` · ${planMateria._count.clases} clase(s)`
                          : ""}
                      </p>
                      {planMateria.prerrequisitos.length > 0 && (
                        <ul className="mt-1.5 space-y-1">
                          {planMateria.prerrequisitos.map((prerrequisito) => (
                            <li key={prerrequisito.id} className="flex items-center gap-2 text-xs">
                              <Insignia tono="alerta">
                                requiere {prerrequisito.requiere.materia.nombre}
                              </Insignia>
                              <form action={quitarPrerrequisito}>
                                <input
                                  type="hidden"
                                  name="prerrequisitoId"
                                  value={prerrequisito.id}
                                />
                                <input type="hidden" name="planId" value={plan.id} />
                                <button
                                  type="submit"
                                  className="text-xs text-slate-400 hover:text-red-600"
                                >
                                  quitar
                                </button>
                              </form>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <BotonQuitarMateria planMateriaId={planMateria.id} planId={plan.id} />
                  </li>
                ))}
              </ul>
            )}
          </Tarjeta>
        ))}
      </div>

      <Tarjeta
        titulo="Prerrequisitos"
        descripcion="La materia requerida debe estar en un grado anterior"
      >
        {!exigePrerrequisitos && (
          <div className="mb-4">
            <Alerta tipo="aviso">
              La validacion de prerrequisitos esta desactivada en Configuracion, asi que estos
              registros quedan como referencia pero no bloquean la inscripcion.
            </Alerta>
          </div>
        )}
        {opcionesMaterias.length < 2 ? (
          <EstadoVacio
            titulo="Hacen falta al menos dos materias"
            mensaje="Agrega materias al mapa curricular para poder encadenarlas."
          />
        ) : (
          <FormularioPrerrequisito planId={plan.id} materiasDelPlan={opcionesMaterias} />
        )}
      </Tarjeta>
    </div>
  );
}
