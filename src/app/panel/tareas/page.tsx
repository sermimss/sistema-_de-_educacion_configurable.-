import Link from "next/link";
import { requerirRol } from "@/lib/auth";
import { db } from "@/lib/db";
import { alumnoDeSesion } from "@/lib/alumnoSesion";
import { clasesDelDocente } from "@/lib/docencia";
import { fechaHoraLegible, instanteAFechaHora } from "@/lib/fechasDia";
import { clasesDelAlumno, estadoEntrega, ETIQUETA_ESTADO, zonaDelColegio } from "@/lib/tareas";
import { Alerta, EstadoVacio, Insignia, Tarjeta } from "@/components/ui";
import { FormularioTarea } from "./Formularios";

export const dynamic = "force-dynamic";

export default async function PaginaTareas({ searchParams }: { searchParams: Promise<{ clase?: string; eliminada?: string }> }) {
  const sesion = await requerirRol("DOCENTE", "ALUMNO");
  const params = await searchParams;
  const zona = await zonaDelColegio();
  const ahora = new Date();

  // ---------------- Alumno ----------------
  if (sesion.rol === "ALUMNO") {
    const alumno = await alumnoDeSesion(sesion.usuarioId);
    if (!alumno) return <Alerta tipo="error">Tu usuario no esta ligado a un expediente.</Alerta>;
    const tareas = await db.tarea.findMany({
      where: { claseId: { in: await clasesDelAlumno(alumno.id) } },
      orderBy: { fechaLimite: "asc" },
      include: {
        clase: { include: { planMateria: { include: { materia: true } } } },
        entregas: { where: { alumnoId: alumno.id }, select: { tarde: true, calificacion: true } },
      },
    });
    const conEstado = tareas.map((t) => ({ t, estado: estadoEntrega(t, t.entregas[0] ?? null, ahora) }));
    const pendientes = conEstado.filter((x) => x.estado === "sin-entregar" || (x.estado === "vencida" && x.t.aceptaTardias));
    const resto = conEstado.filter((x) => !pendientes.includes(x)).reverse();
    const Lista = ({ filas }: { filas: typeof conEstado }) => (
      <ul className="divide-y divide-slate-100">
        {filas.map(({ t, estado }) => (
          <li key={t.id} data-tarea={t.titulo}>
            <Link href={`/panel/tareas/${t.id}`} className="flex flex-wrap items-center justify-between gap-2 py-3 hover:bg-slate-50">
              <div>
                <p className="text-sm font-medium text-slate-900">{t.titulo}</p>
                <p className="text-xs text-slate-500">
                  {t.clase.planMateria.materia.nombre} · entrega hasta {fechaHoraLegible(t.fechaLimite, zona)}
                  {estado === "calificada" ? ` · ${Number(t.entregas[0].calificacion)} de ${Number(t.puntosMaximos)}` : ""}
                </p>
              </div>
              <Insignia tono={ETIQUETA_ESTADO[estado].tono}>{ETIQUETA_ESTADO[estado].texto}</Insignia>
            </Link>
          </li>
        ))}
      </ul>
    );
    return (
      <div className="space-y-6">
        <header>
          <h1 className="text-xl font-semibold text-slate-900">Tareas</h1>
          <p className="mt-1 text-sm text-slate-600">Las que piden tus docentes. Entregas tus archivos aqui mismo.</p>
        </header>
        <Tarjeta titulo="Por entregar">
          {pendientes.length === 0 ? <EstadoVacio titulo="No tienes tareas pendientes" /> : <Lista filas={pendientes} />}
        </Tarjeta>
        {resto.length > 0 && (
          <Tarjeta titulo="Entregadas y anteriores">
            <Lista filas={resto} />
          </Tarjeta>
        )}
      </div>
    );
  }

  // ---------------- Docente ----------------
  const clases = await clasesDelDocente(sesion.usuarioId);
  const opciones = clases.map((c) => ({ id: c.id, etiqueta: `${c.planMateria.materia.nombre} · ${c.grupo.nombre}` }));
  const filtro = clases.some((c) => c.id === Number(params.clase)) ? Number(params.clase) : 0;
  const tareas = await db.tarea.findMany({
    where: { claseId: { in: filtro ? [filtro] : clases.map((c) => c.id) } },
    orderBy: { fechaLimite: "desc" },
    include: {
      clase: { include: { grupo: true, planMateria: { include: { materia: true } }, _count: { select: { alumnos: { where: { estado: { not: "BAJA" } } } } } } },
      entregas: { select: { calificacion: true } },
    },
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-slate-900">Tareas</h1>
        <p className="mt-1 text-sm text-slate-600">Pide trabajos a los alumnos de tus clases; ellos suben sus archivos y tu los calificas.</p>
      </header>
      {params.eliminada && <Alerta tipo="exito">Tarea eliminada.</Alerta>}
      <Tarjeta titulo="Pedir una tarea">
        {opciones.length === 0 ? (
          <EstadoVacio titulo="No tienes clases asignadas" />
        ) : (
          <FormularioTarea clases={opciones} claseInicial={filtro || undefined} minimo={instanteAFechaHora(ahora, zona)} />
        )}
      </Tarjeta>
      <Tarjeta titulo="Mis tareas">
        {tareas.length === 0 ? (
          <EstadoVacio titulo="Aun no has pedido tareas" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {tareas.map((t) => {
              const entregadas = t.entregas.length;
              const porCalificar = t.entregas.filter((e) => e.calificacion == null).length;
              return (
                <li key={t.id} data-tarea={t.titulo}>
                  <Link href={`/panel/tareas/${t.id}`} className="flex flex-wrap items-center justify-between gap-2 py-3 hover:bg-slate-50">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{t.titulo}</p>
                      <p className="text-xs text-slate-500">
                        {t.clase.planMateria.materia.nombre} · {t.clase.grupo.nombre} · hasta {fechaHoraLegible(t.fechaLimite, zona)}
                      </p>
                    </div>
                    <span className="flex items-center gap-2 text-xs text-slate-600">
                      {entregadas} de {t.clase._count.alumnos} entregadas
                      {porCalificar > 0 && <Insignia tono="alerta">{porCalificar} por calificar</Insignia>}
                      {t.fechaLimite < ahora ? <Insignia>Cerrada</Insignia> : <Insignia tono="exito">Abierta</Insignia>}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Tarjeta>
    </div>
  );
}
