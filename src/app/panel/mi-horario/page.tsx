import { requerirRol } from "@/lib/auth";
import { alumnoDeSesion } from "@/lib/alumnoSesion";
import { configBool, configJson } from "@/lib/configuracion";
import { empleadoDeSesion } from "@/lib/docencia";
import { bloquesDelAlumno, bloquesDelDocente } from "@/lib/horarioSemanal";
import { obtenerInstitucion } from "@/lib/institucion";
import { ahoraEnZona } from "@/lib/reuniones";
import { CuadroHorario, ClasesDeHoy } from "@/components/CuadroHorario";
import { Alerta, EstadoVacio, Insignia, Tarjeta } from "@/components/ui";
import { db } from "@/lib/db";
import { DIAS_SEMANA, formatearFechaHora } from "@/lib/formato";
import { hoyEnZona, textoDeFecha, fechaCorta } from "@/lib/fechasDia";
import { describirCambio } from "@/lib/cambiosHorario";
import { FormularioCambio, type BloquePropio } from "./FormularioCambio";
import { accionCancelarSolicitud } from "./acciones";

const ESTADOS = {
  PENDIENTE: { texto: "Pendiente", tono: "alerta" },
  APROBADA: { texto: "Aprobada", tono: "exito" },
  RECHAZADA: { texto: "Rechazada", tono: "peligro" },
  CANCELADA: { texto: "Cancelada", tono: "neutro" },
} as const;

export const dynamic = "force-dynamic";

/// Horario de la semana: el alumno ve las clases de su grupo; el docente, las
/// de todos sus grupos. Cada clase con su boton de Google Meet si lo tiene.
export default async function PaginaMiHorario() {
  const sesion = await requerirRol("ALUMNO", "DOCENTE");
  const [institucion, diasHabiles] = await Promise.all([
    obtenerInstitucion(),
    configJson<number[]>("horarios.dias_habiles", [1, 2, 3, 4, 5]),
  ]);
  const ahora = ahoraEnZona(institucion?.zonaHoraria ?? "America/Mexico_City");
  const hoy = hoyEnZona(institucion?.zonaHoraria ?? "America/Mexico_City");

  let bloques;
  let descripcion = "";
  let cambios: React.ReactNode = null;
  if (sesion.rol === "ALUMNO") {
    const alumno = await alumnoDeSesion(sesion.usuarioId);
    if (!alumno) return <Alerta tipo="error">Tu usuario no esta ligado a un expediente.</Alerta>;
    if (!(await configBool("portales.alumno_ve_horario", true))) {
      return <Alerta tipo="aviso">El colegio tiene desactivada esta seccion.</Alerta>;
    }
    const delAlumno = await bloquesDelAlumno(alumno.id, hoy);
    if (!delAlumno.ciclo) return <Alerta tipo="aviso">Aun no estas inscrito en ningun grupo.</Alerta>;
    bloques = delAlumno.bloques;
    descripcion = `${delAlumno.ciclo}${delAlumno.grupo ? ` · grupo ${delAlumno.grupo}` : ""}`;
  } else {
    if (!(await empleadoDeSesion(sesion.usuarioId))) {
      return <Alerta tipo="aviso">Tu usuario no esta ligado a un registro de personal.</Alerta>;
    }
    bloques = await bloquesDelDocente(sesion.usuarioId, hoy);
    descripcion = `${new Set(bloques.filter((b) => b.id > 0).map((b) => b.titulo + b.detalle)).size} clase(s) a la semana`;
    cambios = await SeccionCambios({ usuarioId: sesion.usuarioId, hoy, bloques: bloques.filter((b) => b.id > 0) });
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-slate-900">Mi horario</h1>
        <p className="mt-1 text-sm text-slate-600">{descripcion}</p>
      </header>

      {bloques.length === 0 ? (
        <Tarjeta>
          <EstadoVacio titulo="Tu horario aun no esta publicado" mensaje="Cuando control escolar lo cargue, aparecera aqui." />
        </Tarjeta>
      ) : (
        <>
          <Tarjeta titulo="Hoy">
            <ClasesDeHoy bloques={bloques} ahora={ahora} />
          </Tarjeta>
          <Tarjeta titulo="La semana">
            <CuadroHorario bloques={bloques} diasHabiles={diasHabiles} ahora={ahora} />
          </Tarjeta>
        </>
      )}
      {cambios}
    </div>
  );
}

/// Pedir cambios de horario (si el colegio lo permite) y ver como van.
async function SeccionCambios({
  usuarioId,
  hoy,
  bloques,
}: {
  usuarioId: number;
  hoy: string;
  bloques: { id: number; diaSemana: number; horaInicio: string; horaFin: string; titulo: string; detalle: string }[];
}) {
  const permitido = await configBool("portales.docente_edita_horario", false);
  const solicitudes = await db.solicitudHorario.findMany({
    where: { solicitadoPor: usuarioId },
    orderBy: { creadaEn: "desc" },
    take: 30,
    include: { horario: { include: { clase: { include: { grupo: true, planMateria: { include: { materia: true } } } } } } },
  });
  if (!permitido && solicitudes.length === 0) return null;
  const propios: BloquePropio[] = bloques.map((b) => ({
    id: b.id,
    diaSemana: b.diaSemana,
    horaInicio: b.horaInicio,
    horaFin: b.horaFin,
    etiqueta: `${b.titulo} · ${b.detalle.split(" · ")[0]} — ${DIAS_SEMANA.find((d) => d.valor === b.diaSemana)?.corto} ${b.horaInicio}-${b.horaFin}`,
  }));

  return (
    <>
      {permitido && (
        <Tarjeta titulo="Solicitar un cambio de horario" descripcion="La administracion lo revisa y lo aprueba; mientras tanto tu horario no cambia">
          {propios.length === 0 ? (
            <EstadoVacio titulo="Aun no tienes bloques en tu horario" />
          ) : (
            <FormularioCambio bloques={propios} hoy={hoy} />
          )}
        </Tarjeta>
      )}
      {solicitudes.length > 0 && (
        <Tarjeta titulo="Mis solicitudes de cambio">
          <ul className="divide-y divide-slate-100">
            {solicitudes.map((s) => {
              const estado = ESTADOS[s.estado];
              const clase = `${s.horario.clase.planMateria.materia.nombre} · ${s.horario.clase.grupo.nombre}`;
              const que =
                s.tipo === "PERMANENTE"
                  ? `De aqui en adelante: ${describirCambio(s)}`
                  : `La clase del ${fechaCorta(textoDeFecha(s.fechaOriginal!))} pasa al ${describirCambio(s)}`;
              return (
                <li key={s.id} className="space-y-1 py-3" data-solicitud-horario={s.estado}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-slate-900">{clase}</p>
                    <Insignia tono={estado.tono}>{s.ajustada && s.estado === "APROBADA" ? "Aprobada con ajustes" : estado.texto}</Insignia>
                  </div>
                  <p className="text-sm text-slate-700">{que}</p>
                  <p className="text-xs text-slate-500">
                    Pedida el {formatearFechaHora(s.creadaEn)} · Motivo: {s.motivo}
                  </p>
                  {s.respuesta && <p className="text-sm text-slate-800" data-respuesta>Respuesta: {s.respuesta}</p>}
                  {s.estado === "PENDIENTE" && (
                    <form action={accionCancelarSolicitud}>
                      <input type="hidden" name="solicitudId" value={s.id} />
                      <button type="submit" className="text-xs text-red-600 hover:underline">Cancelar solicitud</button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        </Tarjeta>
      )}
    </>
  );
}
