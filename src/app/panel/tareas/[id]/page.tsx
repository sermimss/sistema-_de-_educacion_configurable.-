import Link from "next/link";
import { notFound } from "next/navigation";
import { requerirRol } from "@/lib/auth";
import { db } from "@/lib/db";
import { alumnoDeSesion } from "@/lib/alumnoSesion";
import { claseAccesible } from "@/lib/docencia";
import { nombreCompleto } from "@/lib/catalogos";
import { fechaHoraLegible, instanteAFechaHora } from "@/lib/fechasDia";
import { tamanoLegible } from "@/lib/archivosEntrega";
import { alumnoCursa, alumnosDeLaClase, estadoEntrega, ETIQUETA_ESTADO, puedeEntregar, zonaDelColegio } from "@/lib/tareas";
import { Alerta, Insignia, Tarjeta } from "@/components/ui";
import { FormularioCalificar, FormularioEntrega, FormularioTarea } from "../Formularios";
import { accionEliminarTarea } from "../acciones";

export const dynamic = "force-dynamic";

function Archivos({ archivos }: { archivos: { id: number; nombre: string; tamano: number }[] }) {
  if (archivos.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-2" data-archivos>
      {archivos.map((a) => (
        <li key={a.id}>
          <a href={`/panel/tareas/archivo/${a.id}`} className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50" data-archivo={a.nombre}>
            ⬇ {a.nombre} <span className="text-slate-400">({tamanoLegible(a.tamano)})</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

export default async function PaginaTarea({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ creada?: string }> }) {
  const sesion = await requerirRol("DOCENTE", "ALUMNO");
  const { creada } = await searchParams;
  const tarea = await db.tarea.findUnique({
    where: { id: Number((await params).id) || 0 },
    include: { clase: { include: { grupo: true, docente: true, planMateria: { include: { materia: true } } } } },
  });
  if (!tarea) notFound();
  const zona = await zonaDelColegio();
  const ahora = new Date();
  const maximo = Number(tarea.puntosMaximos);
  const encabezado = (
    <header>
      <Link href="/panel/tareas" className="text-sm text-marca-600 hover:underline">← Tareas</Link>
      <h1 className="mt-1 text-xl font-semibold text-slate-900">{tarea.titulo}</h1>
      <p className="mt-1 text-sm text-slate-600">
        {tarea.clase.planMateria.materia.nombre} · {tarea.clase.grupo.nombre} · {nombreCompleto(tarea.clase.docente)} · vale {maximo} puntos
      </p>
      <p className="mt-1 text-sm text-slate-600">
        Entrega hasta el <strong>{fechaHoraLegible(tarea.fechaLimite, zona)}</strong>
        {tarea.aceptaTardias ? " · se aceptan entregas tardias" : " · no se aceptan entregas tardias"}
      </p>
    </header>
  );
  const instrucciones = (
    <Tarjeta titulo="Instrucciones">
      <p className="whitespace-pre-line text-sm text-slate-700">{tarea.instrucciones}</p>
    </Tarjeta>
  );

  // ---------------- Alumno ----------------
  if (sesion.rol === "ALUMNO") {
    const alumno = await alumnoDeSesion(sesion.usuarioId);
    if (!alumno || !(await alumnoCursa(alumno.id, tarea.claseId))) notFound();
    const entrega = await db.entregaTarea.findUnique({
      where: { tareaId_alumnoId: { tareaId: tarea.id, alumnoId: alumno.id } },
      include: { archivos: { select: { id: true, nombre: true, tamano: true } } },
    });
    const estado = estadoEntrega(tarea, entrega, ahora);
    const permiso = puedeEntregar(tarea, entrega, ahora);
    return (
      <div className="space-y-6">
        {encabezado}
        {instrucciones}
        <Tarjeta titulo="Mi entrega" acciones={<Insignia tono={ETIQUETA_ESTADO[estado].tono}>{ETIQUETA_ESTADO[estado].texto}</Insignia>}>
          <div className="space-y-4">
            {entrega && (
              <div className="space-y-2" data-mi-entrega>
                <p className="text-xs text-slate-500">
                  Entregada el {fechaHoraLegible(entrega.entregadaEn, zona)}
                  {entrega.tarde ? " (fuera de tiempo)" : ""}
                </p>
                {entrega.texto && <p className="whitespace-pre-line rounded bg-slate-50 p-2 text-sm text-slate-700">{entrega.texto}</p>}
                <Archivos archivos={entrega.archivos} />
              </div>
            )}
            {entrega?.calificacion != null && (
              <Alerta tipo="exito">
                <span data-calificacion>
                  Calificacion: <strong>{Number(entrega.calificacion)} de {maximo}</strong>
                </span>
                {entrega.comentario && <span className="mt-1 block">Comentario del docente: {entrega.comentario}</span>}
              </Alerta>
            )}
            {permiso.ok ? (
              <>
                {permiso.tarde && <Alerta tipo="aviso">Ya paso la fecha limite: tu entrega quedara marcada como tarde.</Alerta>}
                <FormularioEntrega tareaId={tarea.id} yaEntrego={Boolean(entrega)} />
              </>
            ) : (
              entrega?.calificacion == null && <p className="text-sm text-slate-500" data-no-entrega>{permiso.motivo}</p>
            )}
          </div>
        </Tarjeta>
      </div>
    );
  }

  // ---------------- Docente ----------------
  if (!(await claseAccesible(sesion, tarea.claseId))) notFound();
  const [alumnos, entregas] = await Promise.all([
    alumnosDeLaClase(tarea.claseId),
    db.entregaTarea.findMany({
      where: { tareaId: tarea.id },
      include: { archivos: { select: { id: true, nombre: true, tamano: true } } },
    }),
  ]);
  const porAlumno = new Map(entregas.map((e) => [e.alumnoId, e]));

  return (
    <div className="space-y-6">
      {encabezado}
      {creada && <Alerta tipo="exito">Tarea publicada: tus alumnos ya la ven en su portal.</Alerta>}
      {instrucciones}
      <Tarjeta titulo="Entregas" descripcion={`${entregas.length} de ${alumnos.length} alumno(s) · ${entregas.filter((e) => e.calificacion == null).length} por calificar`}>
        <ul className="divide-y divide-slate-100">
          {alumnos.map((alumno) => {
            const entrega = porAlumno.get(alumno.id) ?? null;
            const estado = estadoEntrega(tarea, entrega, ahora);
            return (
              <li key={alumno.id} className="space-y-2 py-3" data-entrega-alumno={alumno.matricula}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-slate-900">
                    {nombreCompleto(alumno)} <span className="text-xs font-normal text-slate-400">{alumno.matricula}</span>
                  </p>
                  <Insignia tono={ETIQUETA_ESTADO[estado].tono}>
                    {ETIQUETA_ESTADO[estado].texto}
                    {estado === "calificada" ? `: ${Number(entrega!.calificacion)}/${maximo}` : ""}
                  </Insignia>
                </div>
                {entrega && (
                  <div className="space-y-2 rounded-lg bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">
                      {fechaHoraLegible(entrega.entregadaEn, zona)}
                      {entrega.tarde ? " · fuera de tiempo" : ""}
                    </p>
                    {entrega.texto && <p className="whitespace-pre-line text-sm text-slate-700">{entrega.texto}</p>}
                    <Archivos archivos={entrega.archivos} />
                    <FormularioCalificar
                      entregaId={entrega.id}
                      maximo={maximo}
                      calificacion={entrega.calificacion != null ? String(Number(entrega.calificacion)) : ""}
                      comentario={entrega.comentario ?? ""}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Tarjeta>
      <Tarjeta titulo="Editar la tarea">
        <FormularioTarea
          tarea={{
            id: tarea.id,
            titulo: tarea.titulo,
            instrucciones: tarea.instrucciones,
            puntosMaximos: maximo,
            fechaLimite: instanteAFechaHora(tarea.fechaLimite, zona),
            aceptaTardias: tarea.aceptaTardias,
          }}
        />
        {entregas.length === 0 && (
          <form action={accionEliminarTarea} className="mt-3 flex justify-end border-t border-slate-100 pt-3">
            <input type="hidden" name="tareaId" value={tarea.id} />
            <button type="submit" className="text-sm text-red-600 hover:underline">Eliminar tarea (aun no tiene entregas)</button>
          </form>
        )}
      </Tarjeta>
    </div>
  );
}
