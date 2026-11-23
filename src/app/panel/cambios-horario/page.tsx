import { requerirRol } from "@/lib/auth";
import { db } from "@/lib/db";
import { configBool } from "@/lib/configuracion";
import { nombreCompleto } from "@/lib/catalogos";
import { formatearFechaHora } from "@/lib/formato";
import { fechaCorta, textoDeFecha } from "@/lib/fechasDia";
import { choquesDelCambio, describirCambio, nombreDia } from "@/lib/cambiosHorario";
import { Alerta, EstadoVacio, Insignia, Tarjeta } from "@/components/ui";
import { RevisionSolicitud } from "./Revision";

export const dynamic = "force-dynamic";

const ESTADOS = {
  PENDIENTE: { texto: "Pendiente", tono: "alerta" },
  APROBADA: { texto: "Aprobada", tono: "exito" },
  RECHAZADA: { texto: "Rechazada", tono: "peligro" },
  CANCELADA: { texto: "Cancelada por el docente", tono: "neutro" },
} as const;

const incluir = {
  horario: {
    include: {
      aula: true,
      clase: { include: { grupo: true, docente: true, aula: true, planMateria: { include: { materia: true } } } },
    },
  },
} as const;

/// Bandeja de solicitudes de cambio de horario de los docentes.
export default async function PaginaCambiosHorario({
  searchParams,
}: {
  searchParams: Promise<{ aprobada?: string; rechazada?: string }>;
}) {
  await requerirRol("ADMIN");
  const params = await searchParams;
  const [permitido, pendientes, atendidas, aulas] = await Promise.all([
    configBool("portales.docente_edita_horario", false),
    db.solicitudHorario.findMany({ where: { estado: "PENDIENTE" }, orderBy: { creadaEn: "asc" }, include: incluir }),
    db.solicitudHorario.findMany({ where: { estado: { not: "PENDIENTE" } }, orderBy: { resueltaEn: "desc" }, take: 50, include: incluir }),
    db.aula.findMany({ where: { activa: true }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true } }),
  ]);

  // Se vuelve a revisar si lo pedido todavia cabe: el horario pudo cambiar.
  const choques = new Map<number, string[]>();
  for (const s of pendientes) {
    choques.set(
      s.id,
      await choquesDelCambio(s.horarioId, {
        tipo: s.tipo,
        nuevoDia: s.nuevoDia,
        fechaOriginal: s.fechaOriginal ? textoDeFecha(s.fechaOriginal) : null,
        nuevaFecha: s.nuevaFecha ? textoDeFecha(s.nuevaFecha) : null,
        horaInicio: s.horaInicio,
        horaFin: s.horaFin,
        aulaId: null,
      })
    );
  }

  const resultado = params.aprobada
    ? atendidas.find((s) => s.id === Number(params.aprobada))
    : params.rechazada
      ? atendidas.find((s) => s.id === Number(params.rechazada))
      : null;

  const actual = (s: (typeof pendientes)[number]) =>
    `${nombreDia(s.horario.diaSemana)} ${s.horario.horaInicio}-${s.horario.horaFin}${
      s.horario.aula ?? s.horario.clase.aula ? ` · ${(s.horario.aula ?? s.horario.clase.aula)!.nombre}` : ""
    }`;
  const pedido = (s: (typeof pendientes)[number]) =>
    s.tipo === "PERMANENTE"
      ? `De aqui en adelante: ${describirCambio(s)}`
      : `Solo la clase del ${fechaCorta(textoDeFecha(s.fechaOriginal!))}: pasa al ${describirCambio(s)}`;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-slate-900">Cambios de horario</h1>
        <p className="mt-1 text-sm text-slate-600">
          Lo que piden los docentes. Al aprobar, el horario cambia para el docente y sus alumnos.
        </p>
      </header>

      {!permitido && (
        <Alerta tipo="info">
          Los docentes no pueden enviar solicitudes: la opcion &quot;El docente puede editar su horario&quot; esta apagada en
          Configuracion &gt; Portales.
        </Alerta>
      )}
      {resultado && (
        <Alerta tipo={resultado.estado === "APROBADA" ? "exito" : "aviso"}>
          {resultado.estado === "APROBADA"
            ? `Cambio aprobado${resultado.ajustada ? " con ajustes" : ""}: ${resultado.horario.clase.planMateria.materia.nombre} · ${resultado.horario.clase.grupo.nombre} queda ${describirCambio(resultado)}.`
            : "Solicitud rechazada. El docente vera el motivo."}
        </Alerta>
      )}

      <Tarjeta titulo="Por revisar" descripcion={`${pendientes.length} solicitud(es)`}>
        {pendientes.length === 0 ? (
          <EstadoVacio titulo="No hay solicitudes pendientes" />
        ) : (
          <div className="space-y-6">
            {pendientes.map((s) => {
              const conflicto = choques.get(s.id) ?? [];
              return (
                <article key={s.id} className="space-y-3 border-b border-slate-100 pb-6 last:border-0 last:pb-0" data-solicitud-pendiente={s.id}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {s.horario.clase.planMateria.materia.nombre} · {s.horario.clase.grupo.nombre}
                      </p>
                      <p className="text-xs text-slate-500">
                        {nombreCompleto(s.horario.clase.docente)} · pedida el {formatearFechaHora(s.creadaEn)}
                      </p>
                    </div>
                    <Insignia tono={s.tipo === "PERMANENTE" ? "neutro" : "alerta"}>
                      {s.tipo === "PERMANENTE" ? "Permanente" : "Una fecha"}
                    </Insignia>
                  </div>
                  <dl className="grid gap-1 text-sm sm:grid-cols-[8rem_1fr]">
                    <dt className="text-slate-500">Horario actual</dt>
                    <dd className="text-slate-800">{actual(s)}</dd>
                    <dt className="text-slate-500">Pide</dt>
                    <dd className="font-medium text-slate-900" data-pide>{pedido(s)}</dd>
                    <dt className="text-slate-500">Motivo</dt>
                    <dd className="text-slate-800">{s.motivo}</dd>
                  </dl>
                  {conflicto.length > 0 && (
                    <Alerta tipo="aviso">
                      Desde que se pidio, el horario cambio y ahora choca:
                      <ul className="mt-1 list-disc pl-5">
                        {conflicto.map((c) => <li key={c}>{c}</li>)}
                      </ul>
                    </Alerta>
                  )}
                  <RevisionSolicitud
                    solicitud={{
                      id: s.id,
                      tipo: s.tipo,
                      nuevoDia: s.nuevoDia,
                      nuevaFecha: s.nuevaFecha ? textoDeFecha(s.nuevaFecha) : null,
                      horaInicio: s.horaInicio,
                      horaFin: s.horaFin,
                      aulaActual: (s.horario.aula ?? s.horario.clase.aula)?.nombre ?? null,
                    }}
                    aulas={aulas}
                  />
                </article>
              );
            })}
          </div>
        )}
      </Tarjeta>

      <Tarjeta titulo="Atendidas">
        {atendidas.length === 0 ? (
          <EstadoVacio titulo="Aun no hay solicitudes atendidas" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {atendidas.map((s) => (
              <li key={s.id} className="space-y-1 py-3" data-solicitud-atendida={s.estado}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-slate-900">
                    {s.horario.clase.planMateria.materia.nombre} · {s.horario.clase.grupo.nombre} ·{" "}
                    <span className="font-normal text-slate-600">{nombreCompleto(s.horario.clase.docente)}</span>
                  </p>
                  <Insignia tono={ESTADOS[s.estado].tono}>
                    {s.ajustada && s.estado === "APROBADA" ? "Aprobada con ajustes" : ESTADOS[s.estado].texto}
                  </Insignia>
                </div>
                <p className="text-sm text-slate-700">{pedido(s)}</p>
                {s.respuesta && <p className="text-xs text-slate-600">{s.respuesta}</p>}
                <p className="text-xs text-slate-400">{s.resueltaEn ? formatearFechaHora(s.resueltaEn) : ""}</p>
              </li>
            ))}
          </ul>
        )}
      </Tarjeta>
    </div>
  );
}
