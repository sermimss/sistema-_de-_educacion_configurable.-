import Link from "next/link";
import { turnoAbierto } from "@/lib/caja";
import { requerirSesion } from "@/lib/auth";
import { db } from "@/lib/db";
import { obtenerInstitucion } from "@/lib/institucion";
import { configBool, configNumero, configTexto } from "@/lib/configuracion";
import { alumnoDeSesion } from "@/lib/alumnoSesion";
import { bloquesDelAlumno, bloquesDelDocente } from "@/lib/horarioSemanal";
import { ahoraEnZona } from "@/lib/reuniones";
import { hoyEnZona } from "@/lib/fechasDia";
import { avisosDelAlumno } from "@/lib/avisos";
import { ClasesDeHoy, type BloqueHorario } from "@/components/CuadroHorario";
import { formatearDia } from "@/lib/formato";
import { estaDisponible, navegacionPara } from "@/lib/navegacion";
import { Alerta, EstadoVacio, Insignia, Tarjeta } from "@/components/ui";

export const dynamic = "force-dynamic";

function Indicador({ etiqueta, valor, detalle }: { etiqueta: string; valor: string | number; detalle?: string }) {
  return (
    <div className="tarjeta px-5 py-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{etiqueta}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{valor}</p>
      {detalle && <p className="mt-0.5 text-xs text-slate-500">{detalle}</p>}
    </div>
  );
}

export default async function PaginaPanel() {
  const sesion = await requerirSesion();
  const institucion = await obtenerInstitucion();

  const hoy = new Date();
  const [alumnos, docentes, grupos, planes, gruposEnClases] = await Promise.all([
    db.alumno.count({ where: { estado: "ACTIVO" } }),
    db.empleado.count({ where: { esDocente: true, estado: "ACTIVO" } }),
    db.grupo.count({ where: { activo: true } }),
    db.planEstudios.count({ where: { activo: true } }),
    // Cada grupo tiene sus propias fechas: aqui van los que hoy estan en clases.
    db.grupo.findMany({
      where: {
        activo: true,
        ciclo: { estado: "ACTIVO", fechaInicio: { lte: hoy }, fechaFin: { gte: hoy } },
      },
      include: { grado: true, ciclo: { include: { periodos: { orderBy: { numero: "asc" } } } } },
      orderBy: { nombre: "asc" },
      take: 12,
    }),
  ]);

  // Las clases de hoy del docente o del alumno, con su boton de Meet.
  const ahora = ahoraEnZona(institucion?.zonaHoraria ?? "America/Mexico_City");
  const hoyColegio = hoyEnZona(institucion?.zonaHoraria ?? "America/Mexico_City");
  let bloquesHoy: BloqueHorario[] | null = null;
  if (sesion.rol === "DOCENTE") {
    bloquesHoy = await bloquesDelDocente(sesion.usuarioId, hoyColegio);
  } else if (sesion.rol === "ALUMNO" && (await configBool("portales.alumno_ve_horario", true))) {
    const alumno = await alumnoDeSesion(sesion.usuarioId);
    bloquesHoy = alumno ? (await bloquesDelAlumno(alumno.id, hoyColegio)).bloques : null;
  }
  // Los avisos mas recientes para el alumno.
  let avisosRecientes: Awaited<ReturnType<typeof avisosDelAlumno>> = [];
  if (sesion.rol === "ALUMNO" && (await configBool("portales.alumno_ve_avisos", true))) {
    const alumno = await alumnoDeSesion(sesion.usuarioId);
    if (alumno) avisosRecientes = await avisosDelAlumno(alumno.id, 3);
  }

  const accesosPendientes =
    sesion.rol === "ADMIN" ? await db.solicitudAcceso.count({ where: { estado: "PENDIENTE" } }) : 0;
  // Al docente: lo que le contestaron de sus cambios de horario esta semana.
  const respuestasHorario =
    sesion.rol === "DOCENTE"
      ? await db.solicitudHorario.findMany({
          where: {
            solicitadoPor: sesion.usuarioId,
            estado: { in: ["APROBADA", "RECHAZADA"] },
            resueltaEn: { gte: new Date(Date.now() - 7 * 86_400_000) },
          },
          select: { estado: true },
        })
      : [];
  // Pendientes de tareas y examenes.
  let pendientesAlumno = { tareas: 0, examenes: 0 };
  let pendientesDocente = { entregas: 0, examenes: 0 };
  if (sesion.rol === "ALUMNO") {
    const alumno = await alumnoDeSesion(sesion.usuarioId);
    if (alumno) {
      const clases = (await db.alumnoClase.findMany({ where: { alumnoId: alumno.id, estado: { not: "BAJA" } }, select: { claseId: true } })).map((c) => c.claseId);
      const ahoraPanel = new Date();
      const [tareas, examenes] = await Promise.all([
        db.tarea.count({ where: { claseId: { in: clases }, fechaLimite: { gte: ahoraPanel }, entregas: { none: { alumnoId: alumno.id } } } }),
        db.examen.count({ where: { claseId: { in: clases }, publicado: true, abreEn: { lte: ahoraPanel }, cierraEn: { gte: ahoraPanel }, intentos: { none: { alumnoId: alumno.id } } } }),
      ]);
      pendientesAlumno = { tareas, examenes };
    }
  } else if (sesion.rol === "DOCENTE") {
    const empleado = await db.empleado.findUnique({ where: { usuarioId: sesion.usuarioId }, select: { id: true } });
    if (empleado) {
      const [entregas, examenes] = await Promise.all([
        db.entregaTarea.count({ where: { calificacion: null, tarea: { clase: { docenteId: empleado.id } } } }),
        db.intentoExamen.count({ where: { porRevisar: true, examen: { clase: { docenteId: empleado.id } } } }),
      ]);
      pendientesDocente = { entregas, examenes };
    }
  }
  const comprobantesPorVerificar =
    sesion.rol === "ADMIN" || sesion.rol === "CAJERO"
      ? await db.comprobantePago.count({ where: { estado: "POR_VERIFICAR" } })
      : 0;
  const cajaAbierta = sesion.rol === "CAJERO" ? await turnoAbierto(sesion.usuarioId) : null;
  const cambiosPendientes =
    sesion.rol === "ADMIN" ? await db.solicitudHorario.count({ where: { estado: "PENDIENTE" } }) : 0;
  const escala = await db.escalaCalificacion.findFirst({ where: { predeterminada: true } });
  const faltasAlerta = await configNumero("asistencia.faltas_consecutivas_alerta", 3);
  const diaVencimiento = await configNumero("finanzas.dia_vencimiento_default", 10);
  const modoAsistencia = await configTexto("asistencia.modo_predeterminado", "POR_CLASE");
  const pendientes = navegacionPara(sesion.rol).filter((item) => !estaDisponible(item));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-slate-900">
          Hola, {sesion.nombre.split(" ")[0]}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {institucion?.nombre}
        </p>
      </header>

      {(sesion.rol === "ADMIN" || sesion.rol === "CAJERO") && comprobantesPorVerificar > 0 && (
        <Alerta tipo="aviso">
          <span data-aviso-comprobantes>
            {comprobantesPorVerificar} comprobante(s) de pago por verificar.
          </span>{" "}
          <Link href="/panel/caja/comprobantes" className="font-medium underline">Revisar</Link>
        </Alerta>
      )}

      {sesion.rol === "CAJERO" && (
        <Tarjeta titulo="Caja" descripcion="Cobros, comprobantes y tu corte">
          <p className="text-sm text-slate-600" data-estado-caja-panel>
            {cajaAbierta ? "Tu caja esta abierta." : "Tu caja esta cerrada. Abrela para poder cobrar."}
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            <Link href="/panel/caja" className="rounded-lg bg-marca-600 px-3 py-1.5 font-medium text-white hover:bg-marca-700">
              Ir a caja
            </Link>
            <Link href="/panel/caja/comprobantes" className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50">
              Comprobantes por verificar
            </Link>
            <Link href="/panel/caja/cortes" className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50">
              Mis cortes
            </Link>
          </div>
        </Tarjeta>
      )}

      {sesion.rol === "ADMIN" && (
        <>
          {accesosPendientes > 0 && (
            <Alerta tipo="aviso">
              {accesosPendientes} persona(s) olvidaron su contrasena y piden acceso.{" "}
              <Link href="/panel/accesos" className="font-medium underline">Atender</Link>
            </Alerta>
          )}
          {cambiosPendientes > 0 && (
            <Alerta tipo="aviso">
              {cambiosPendientes} solicitud(es) de cambio de horario esperan tu aprobacion.{" "}
              <Link href="/panel/cambios-horario" className="font-medium underline">Revisar</Link>
            </Alerta>
          )}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Indicador etiqueta="Alumnos activos" valor={alumnos} />
            <Indicador etiqueta="Docentes activos" valor={docentes} />
            <Indicador etiqueta="Grupos" valor={grupos} />
            <Indicador etiqueta="Planes de estudio" valor={planes} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Tarjeta titulo="Grupos en clases" descripcion="Cada grupo con sus propias fechas">
              {gruposEnClases.length > 0 ? (
                <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                  {gruposEnClases.map((grupo) => {
                    const parcial = grupo.ciclo.periodos.find(
                      (p) => p.fechaInicio <= hoy && p.fechaFin >= hoy
                    );
                    return (
                      <li key={grupo.id} className="px-3 py-2 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <Link
                            href={`/panel/grupos/${grupo.id}`}
                            className="font-medium text-slate-900 hover:text-marca-600"
                          >
                            {grupo.nombre} · {grupo.grado.nombre}
                          </Link>
                          {parcial && (
                            <Insignia tono={parcial.capturaAbierta ? "exito" : "neutro"}>
                              {parcial.nombre}
                              {parcial.capturaAbierta ? " · captura abierta" : ""}
                            </Insignia>
                          )}
                        </div>
                        <p className="text-xs text-slate-500">
                          {formatearDia(grupo.ciclo.fechaInicio)} — {formatearDia(grupo.ciclo.fechaFin)}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <EstadoVacio
                  titulo="Ningun grupo esta en clases hoy"
                  mensaje="Al crear un grupo se definen sus fechas de inicio y termino de clases."
                />
              )}
            </Tarjeta>

            <Tarjeta
              titulo="Reglas vigentes"
              descripcion="Definidas en la instalacion, editables en Configuracion"
            >
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-600">Escala de calificacion</dt>
                  <dd className="font-medium text-slate-900">
                    {escala
                      ? `${Number(escala.valorMinimo)} a ${Number(escala.valorMaximo)}`
                      : "Sin definir"}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-600">Minima aprobatoria</dt>
                  <dd className="font-medium text-slate-900">
                    {escala ? Number(escala.minimaAprobatoria) : "—"}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-600">Redondeo</dt>
                  <dd className="font-medium text-slate-900">{escala?.redondeo ?? "—"}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-600">Asistencia predeterminada</dt>
                  <dd className="font-medium text-slate-900">
                    {modoAsistencia === "POR_DIA" ? "Por dia" : "Por clase"}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-600">Alerta por faltas consecutivas</dt>
                  <dd className="font-medium text-slate-900">{faltasAlerta}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-600">Dia de vencimiento de cobros</dt>
                  <dd className="font-medium text-slate-900">Dia {diaVencimiento}</dd>
                </div>
              </dl>
              <Link
                href="/panel/configuracion"
                className="mt-4 inline-block text-sm font-medium text-marca-600 hover:underline"
              >
                Editar configuracion →
              </Link>
            </Tarjeta>
          </div>
        </>
      )}

      {(sesion.rol === "DOCENTE" || sesion.rol === "ALUMNO") && bloquesHoy && (
        <Tarjeta titulo="Tus clases de hoy" descripcion="Con el boton para entrar a las que son en linea">
          <ClasesDeHoy bloques={bloquesHoy} ahora={ahora} />
        </Tarjeta>
      )}

      {(pendientesAlumno.tareas > 0 || pendientesAlumno.examenes > 0) && (
        <Alerta tipo="aviso">
          <span data-pendientes-alumno>
            Tienes {pendientesAlumno.tareas} tarea(s) por entregar y {pendientesAlumno.examenes} examen(es) disponible(s).
          </span>{" "}
          <Link href="/panel/tareas" className="font-medium underline">Tareas</Link> ·{" "}
          <Link href="/panel/examenes" className="font-medium underline">Examenes</Link>
        </Alerta>
      )}
      {(pendientesDocente.entregas > 0 || pendientesDocente.examenes > 0) && (
        <Alerta tipo="aviso">
          <span data-pendientes-docente>
            Tienes {pendientesDocente.entregas} entrega(s) de tareas por calificar y {pendientesDocente.examenes} examen(es) por revisar.
          </span>{" "}
          <Link href="/panel/tareas" className="font-medium underline">Tareas</Link> ·{" "}
          <Link href="/panel/examenes" className="font-medium underline">Examenes</Link>
        </Alerta>
      )}

      {respuestasHorario.length > 0 && (
        <Alerta tipo="info">
          Te contestaron {respuestasHorario.length} solicitud(es) de cambio de horario (
          {respuestasHorario.filter((r) => r.estado === "APROBADA").length} aprobada(s),{" "}
          {respuestasHorario.filter((r) => r.estado === "RECHAZADA").length} rechazada(s)).{" "}
          <Link href="/panel/mi-horario" className="font-medium underline">Ver</Link>
        </Alerta>
      )}

      {sesion.rol === "DOCENTE" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Link href="/panel/mi-horario" className="tarjeta px-5 py-4 hover:border-marca-600">
            <p className="text-sm font-semibold text-slate-900">Mi horario</p>
            <p className="mt-1 text-sm text-slate-600">Todas tus clases de la semana, de todos tus grupos.</p>
          </Link>
          <Link href="/panel/mis-clases" className="tarjeta px-5 py-4 hover:border-marca-600">
            <p className="text-sm font-semibold text-slate-900">Mis clases</p>
            <p className="mt-1 text-sm text-slate-600">
              Tus grupos, horario y como pasas lista en cada clase.
            </p>
          </Link>
          <Link href="/panel/asistencia" className="tarjeta px-5 py-4 hover:border-marca-600">
            <p className="text-sm font-semibold text-slate-900">Pasar lista</p>
            <p className="mt-1 text-sm text-slate-600">Registro del dia y alertas por inasistencia.</p>
          </Link>
          <Link href="/panel/calificaciones" className="tarjeta px-5 py-4 hover:border-marca-600">
            <p className="text-sm font-semibold text-slate-900">Calificaciones</p>
            <p className="mt-1 text-sm text-slate-600">
              Rubros, actividades y la calificacion oficial del periodo.
            </p>
          </Link>
        </div>
      )}

      {avisosRecientes.length > 0 && (
        <Tarjeta
          titulo="Avisos"
          acciones={<Link href="/panel/avisos" className="text-sm text-marca-600 hover:underline">Ver todos</Link>}
        >
          <ul className="divide-y divide-slate-100" data-avisos-recientes>
            {avisosRecientes.map((a) => (
              <li key={a.id} className="py-2">
                <p className="text-sm font-medium text-slate-800">{a.titulo}</p>
                <p className="line-clamp-2 text-xs text-slate-600">{a.contenido}</p>
                {a.archivos.length > 0 && (
                  <Link href="/panel/avisos" className="text-xs text-marca-600 hover:underline">
                    📎 {a.archivos.length} archivo(s) adjunto(s)
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </Tarjeta>
      )}

      {sesion.rol === "ALUMNO" && (
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            ["/panel/mis-calificaciones", "Mis calificaciones", "Tus notas por periodo y tu promedio."],
            ["/panel/mi-asistencia", "Mi asistencia", "Faltas, retardos y tu porcentaje."],
            ["/panel/mi-horario", "Mi horario", "Tus clases de la semana."],
            ["/panel/estado-de-cuenta", "Estado de cuenta", "Cargos, saldo y recibos de pago."],
          ].map(([ruta, titulo, descripcion]) => (
            <Link key={ruta} href={ruta} className="tarjeta px-5 py-4 hover:border-marca-600">
              <p className="text-sm font-semibold text-slate-900">{titulo}</p>
              <p className="mt-1 text-sm text-slate-600">{descripcion}</p>
            </Link>
          ))}
        </div>
      )}

      {pendientes.length > 0 && (
        <Tarjeta titulo="Modulos en construccion" descripcion="Plan de entrega por fases">
          <ul className="grid gap-2 sm:grid-cols-2">
            {pendientes.map((item) => (
              <li
                key={item.ruta}
                className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <span className="text-slate-700">{item.etiqueta}</span>
                <Insignia>Fase {item.fase}</Insignia>
              </li>
            ))}
          </ul>
        </Tarjeta>
      )}
    </div>
  );
}
