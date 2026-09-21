import { requerirRol } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatearMoneda } from "@/lib/formato";
import { obtenerInstitucion } from "@/lib/institucion";
import { EstadoVacio, Insignia, Tarjeta } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function PaginaAcademico() {
  await requerirRol("ADMIN");
  const institucion = await obtenerInstitucion();
  const moneda = institucion?.moneda ?? "MXN";

  const [niveles, planteles, turnos, modulos, escalas, conceptos, recargos] = await Promise.all([
    db.nivelEducativo.findMany({
      orderBy: { orden: "asc" },
      include: {
        planes: {
          orderBy: { nombre: "asc" },
          include: { grados: { orderBy: { numero: "asc" } }, _count: { select: { materias: true } } },
        },
      },
    }),
    db.plantel.findMany({ orderBy: { nombre: "asc" } }),
    db.turno.findMany({ orderBy: { orden: "asc" } }),
    db.moduloHorario.findMany({ orderBy: { orden: "asc" } }),
    db.escalaCalificacion.findMany({ include: { rangos: true } }),
    db.conceptoCobro.findMany({ orderBy: { orden: "asc" } }),
    db.reglaRecargo.findMany(),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-slate-900">Estructura academica</h1>
        <p className="mt-1 text-sm text-slate-600">
          Lo que se creo en la instalacion. La edicion completa de cada catalogo llega en la Fase 2.
        </p>
      </header>

      <Tarjeta titulo="Niveles, planes y grados">
        {niveles.length === 0 ? (
          <EstadoVacio titulo="Sin niveles registrados" />
        ) : (
          <div className="space-y-5">
            {niveles.map((nivel) => (
              <div key={nivel.id}>
                <div className="mb-2 flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-slate-900">{nivel.nombre}</h3>
                  <Insignia>{nivel.clave}</Insignia>
                  <Insignia tono="neutro">{nivel.tipoPeriodo}</Insignia>
                </div>
                <div className="space-y-2">
                  {nivel.planes.map((plan) => (
                    <div key={plan.id} className="rounded-lg border border-slate-200 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-medium text-slate-800">
                          {plan.nombre} <span className="text-slate-400">({plan.clave})</span>
                        </span>
                        <span className="text-xs text-slate-500">
                          {plan.duracionPeriodos} periodos · {plan._count.materias} materias
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {plan.grados.map((grado) => (
                          <span
                            key={grado.id}
                            className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
                          >
                            {grado.nombre}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Tarjeta>

      <div className="grid gap-4 lg:grid-cols-2">
        <Tarjeta titulo="Planteles y turnos">
          <div className="space-y-4">
            <ul className="space-y-1">
              {planteles.map((plantel) => (
                <li key={plantel.id} className="flex items-center justify-between text-sm">
                  <span className="text-slate-700">{plantel.nombre}</span>
                  <Insignia>{plantel.clave}</Insignia>
                </li>
              ))}
            </ul>
            <ul className="space-y-1 border-t border-slate-100 pt-3">
              {turnos.map((turno) => (
                <li key={turno.id} className="flex items-center justify-between text-sm">
                  <span className="text-slate-700">{turno.nombre}</span>
                  <span className="text-xs text-slate-500">
                    {turno.horaInicio} — {turno.horaFin}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Tarjeta>

        <Tarjeta titulo="Modulos de horario">
          {modulos.length === 0 ? (
            <EstadoVacio titulo="Sin modulos definidos" />
          ) : (
            <ul className="space-y-1">
              {modulos.map((modulo) => (
                <li key={modulo.id} className="flex items-center justify-between text-sm">
                  <span className={modulo.esReceso ? "text-amber-700" : "text-slate-700"}>
                    {modulo.nombre}
                    {modulo.esReceso && " (receso)"}
                  </span>
                  <span className="text-xs text-slate-500">
                    {modulo.horaInicio} — {modulo.horaFin}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>

        <Tarjeta titulo="Escalas de calificacion">
          {escalas.map((escala) => (
            <div key={escala.id} className="text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-800">{escala.nombre}</span>
                {escala.predeterminada && <Insignia tono="exito">Predeterminada</Insignia>}
              </div>
              <p className="mt-1 text-slate-600">
                {Number(escala.valorMinimo)} a {Number(escala.valorMaximo)} · aprueba con{" "}
                {Number(escala.minimaAprobatoria)} · {escala.decimales} decimales · redondeo{" "}
                {escala.redondeo.toLowerCase()}
              </p>
            </div>
          ))}
        </Tarjeta>

        <Tarjeta titulo="Conceptos de cobro y recargos">
          {conceptos.length === 0 ? (
            <EstadoVacio titulo="Sin conceptos de cobro" />
          ) : (
            <ul className="space-y-1">
              {conceptos.map((concepto) => (
                <li key={concepto.id} className="flex items-center justify-between text-sm">
                  <span className="text-slate-700">
                    {concepto.nombre}{" "}
                    <span className="text-xs text-slate-400">({concepto.periodicidad})</span>
                  </span>
                  <span className="font-medium text-slate-900">
                    {formatearMoneda(concepto.montoBase.toString(), moneda)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {recargos.length > 0 && (
            <div className="mt-3 border-t border-slate-100 pt-3 text-sm text-slate-600">
              {recargos.map((recargo) => (
                <p key={recargo.id}>
                  {recargo.nombre}: {Number(recargo.valor)}
                  {recargo.tipoCalculo === "PORCENTAJE" ? "%" : ` ${moneda}`} tras{" "}
                  {recargo.diasGracia} dia(s) de gracia
                </p>
              ))}
            </div>
          )}
        </Tarjeta>
      </div>
    </div>
  );
}
