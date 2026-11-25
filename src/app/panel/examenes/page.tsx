import Link from "next/link";
import { requerirRol } from "@/lib/auth";
import { db } from "@/lib/db";
import { alumnoDeSesion } from "@/lib/alumnoSesion";
import { clasesDelDocente } from "@/lib/docencia";
import { fechaHoraLegible, instanteAFechaHora } from "@/lib/fechasDia";
import { clasesDelAlumno, zonaDelColegio } from "@/lib/tareas";
import { enviarVencidos, ETIQUETA_ESTADO_EXAMEN, estadoParaAlumno, puntosTotales } from "@/lib/examenes";
import { Alerta, EstadoVacio, Insignia, Tarjeta } from "@/components/ui";
import { FormularioExamen } from "./Formularios";

export const dynamic = "force-dynamic";

export default async function PaginaExamenes({ searchParams }: { searchParams: Promise<{ clase?: string; eliminado?: string }> }) {
  const sesion = await requerirRol("DOCENTE", "ALUMNO");
  const params = await searchParams;
  const zona = await zonaDelColegio();
  const ahora = new Date();

  // ---------------- Alumno ----------------
  if (sesion.rol === "ALUMNO") {
    const alumno = await alumnoDeSesion(sesion.usuarioId);
    if (!alumno) return <Alerta tipo="error">Tu usuario no esta ligado a un expediente.</Alerta>;
    await enviarVencidos({ alumnoId: alumno.id });
    const examenes = await db.examen.findMany({
      where: { publicado: true, claseId: { in: await clasesDelAlumno(alumno.id) } },
      orderBy: { cierraEn: "asc" },
      include: {
        clase: { include: { planMateria: { include: { materia: true } } } },
        preguntas: { select: { puntos: true } },
        intentos: { where: { alumnoId: alumno.id } },
      },
    });
    const filas = examenes.map((e) => ({ e, intento: e.intentos[0] ?? null, estado: estadoParaAlumno(e, e.intentos[0] ?? null, ahora) }));
    const activos = filas.filter((f) => ["disponible", "tardio", "en-curso", "proximo"].includes(f.estado));
    const resto = filas.filter((f) => !activos.includes(f)).reverse();
    const Lista = ({ lista }: { lista: typeof filas }) => (
      <ul className="divide-y divide-slate-100">
        {lista.map(({ e, intento, estado }) => (
          <li key={e.id} data-examen={e.titulo}>
            <Link href={`/panel/examenes/${e.id}`} className="flex flex-wrap items-center justify-between gap-2 py-3 hover:bg-slate-50">
              <div>
                <p className="text-sm font-medium text-slate-900">{e.titulo}</p>
                <p className="text-xs text-slate-500">
                  {e.clase.planMateria.materia.nombre} · {estado === "proximo" ? `abre ${fechaHoraLegible(e.abreEn, zona)}` : `cierra ${fechaHoraLegible(e.cierraEn, zona)}`}
                  {e.duracionMinutos ? ` · ${e.duracionMinutos} min` : ""}
                  {intento?.enviadoEn && intento.puntaje != null ? ` · ${Number(intento.puntaje)} de ${puntosTotales(e.preguntas)}${intento.porRevisar ? " (falta revisar)" : ""}` : ""}
                </p>
              </div>
              <Insignia tono={ETIQUETA_ESTADO_EXAMEN[estado].tono}>{ETIQUETA_ESTADO_EXAMEN[estado].texto}</Insignia>
            </Link>
          </li>
        ))}
      </ul>
    );
    return (
      <div className="space-y-6">
        <header>
          <h1 className="text-xl font-semibold text-slate-900">Examenes</h1>
          <p className="mt-1 text-sm text-slate-600">Los examenes en linea de tus clases. Cada uno se presenta una sola vez.</p>
        </header>
        <Tarjeta titulo="Por presentar">{activos.length === 0 ? <EstadoVacio titulo="No tienes examenes pendientes" /> : <Lista lista={activos} />}</Tarjeta>
        {resto.length > 0 && <Tarjeta titulo="Presentados y anteriores"><Lista lista={resto} /></Tarjeta>}
      </div>
    );
  }

  // ---------------- Docente ----------------
  const clases = await clasesDelDocente(sesion.usuarioId);
  const opciones = clases.map((c) => ({ id: c.id, etiqueta: `${c.planMateria.materia.nombre} · ${c.grupo.nombre}` }));
  const filtro = clases.some((c) => c.id === Number(params.clase)) ? Number(params.clase) : 0;
  const ids = filtro ? [filtro] : clases.map((c) => c.id);
  await enviarVencidos({ examen: { claseId: { in: ids } } });
  const examenes = await db.examen.findMany({
    where: { claseId: { in: ids } },
    orderBy: { abreEn: "desc" },
    include: {
      clase: { include: { grupo: true, planMateria: { include: { materia: true } } } },
      _count: { select: { preguntas: true } },
      intentos: { select: { enviadoEn: true, porRevisar: true } },
    },
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-slate-900">Examenes</h1>
        <p className="mt-1 text-sm text-slate-600">Arma examenes en linea para tus clases. Las preguntas cerradas se califican solas.</p>
      </header>
      {params.eliminado && <Alerta tipo="exito">Examen eliminado.</Alerta>}
      <Tarjeta titulo="Nuevo examen" descripcion="Primero sus datos; despues agregas las preguntas y lo publicas">
        {opciones.length === 0 ? (
          <EstadoVacio titulo="No tienes clases asignadas" />
        ) : (
          <FormularioExamen clases={opciones} claseInicial={filtro || undefined} ahora={instanteAFechaHora(ahora, zona)} />
        )}
      </Tarjeta>
      <Tarjeta titulo="Mis examenes">
        {examenes.length === 0 ? (
          <EstadoVacio titulo="Aun no has creado examenes" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {examenes.map((e) => {
              const enviados = e.intentos.filter((i) => i.enviadoEn).length;
              const porRevisar = e.intentos.filter((i) => i.porRevisar).length;
              const estado = !e.publicado ? "Borrador" : ahora < e.abreEn ? "Programado" : ahora <= e.cierraEn ? "Abierto" : "Cerrado";
              return (
                <li key={e.id} data-examen={e.titulo}>
                  <Link href={`/panel/examenes/${e.id}`} className="flex flex-wrap items-center justify-between gap-2 py-3 hover:bg-slate-50">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{e.titulo}</p>
                      <p className="text-xs text-slate-500">
                        {e.clase.planMateria.materia.nombre} · {e.clase.grupo.nombre} · {fechaHoraLegible(e.abreEn, zona)} a {fechaHoraLegible(e.cierraEn, zona)} · {e._count.preguntas} pregunta(s)
                      </p>
                    </div>
                    <span className="flex items-center gap-2 text-xs text-slate-600">
                      {enviados} presentado(s)
                      {porRevisar > 0 && <Insignia tono="alerta">{porRevisar} por revisar</Insignia>}
                      <Insignia tono={estado === "Abierto" ? "exito" : estado === "Borrador" ? "alerta" : "neutro"}>{estado}</Insignia>
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
