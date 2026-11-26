import Link from "next/link";
import { requerirRol } from "@/lib/auth";
import { aceptaNuevoIngreso, etiquetaModalidad } from "@/lib/modalidad";
import { db } from "@/lib/db";
import { formatearMoneda } from "@/lib/formato";
import { obtenerInstitucion } from "@/lib/institucion";
import { Alerta, Boton, EstadoVacio, Insignia, Tarjeta } from "@/components/ui";
import { FormularioNivel } from "./FormulariosPrograma";
import { EliminarNivel } from "./EliminarNivel";
import { accionOfertaNivel } from "./programas";

export const dynamic = "force-dynamic";

export default async function PaginaAcademico({
  searchParams,
}: {
  searchParams: Promise<{ eliminado?: string; planes?: string; avisos?: string; conceptos?: string; nivel?: string }>;
}) {
  await requerirRol("ADMIN");
  const aviso = await searchParams;
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

  const activos = niveles.filter((n) => n.activo);
  const deBaja = niveles.filter((n) => !n.activo);
  const extrasEliminado = [
    Number(aviso.planes) > 0 ? ` junto con ${aviso.planes} carrera(s) o certificacion(es) sin alumnos` : "",
    Number(aviso.avisos) > 0 ? `. Se desactivaron ${aviso.avisos} aviso(s) dirigidos a el` : "",
    Number(aviso.conceptos) > 0 ? `. Se desactivaron ${aviso.conceptos} concepto(s) de cobro solo para el` : "",
  ].join("");

  return (
    <div className="space-y-6">
      {aviso.eliminado && (
        <Alerta tipo="exito">
          <span data-nivel-eliminado>Nivel {aviso.eliminado.slice(0, 80)} eliminado{extrasEliminado}.</span>
        </Alerta>
      )}
      {aviso.nivel === "baja" && <Alerta tipo="exito">Nivel dado de baja: ya no se ofrece y se conserva su historial.</Alerta>}
      {aviso.nivel === "reactivado" && <Alerta tipo="exito">El nivel se vuelve a mostrar. Reactiva sus carreras desde Administrar si las volveras a ofrecer.</Alerta>}
      <header>
        <h1 className="text-xl font-semibold text-slate-900">Estructura academica</h1>
        <p className="mt-1 text-sm text-slate-600">
          Niveles, carreras y certificaciones del colegio. Puedes agregar mas, editarlas, darlas de baja o cambiarles la
          modalidad (semestral, cuatrimestral...).
        </p>
      </header>

      <Tarjeta
        titulo="Niveles, carreras y certificaciones"
        acciones={
          <Link
            href="/panel/academico/nuevo"
            className="rounded-lg bg-marca-600 px-3 py-1.5 text-sm font-medium text-marca-contraste hover:bg-marca-700"
          >
            Agregar carrera o certificacion
          </Link>
        }
      >
        {activos.length === 0 ? (
          <EstadoVacio titulo="Sin niveles registrados" />
        ) : (
          <div className="space-y-5">
            {activos.map((nivel) => (
              <div key={nivel.id}>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold text-slate-900">{nivel.nombre}</h3>
                  <Insignia>{nivel.clave}</Insignia>
                  <Insignia tono="neutro">{etiquetaModalidad(nivel.tipoPeriodo)}</Insignia>
                  <Link href={`/panel/academico/nuevo?nivel=${nivel.id}`} className="ml-auto text-xs font-medium text-marca-600 hover:underline">
                    + Agregar a este nivel
                  </Link>
                </div>
                <div className="space-y-2">
                  {nivel.planes.length === 0 && <p className="text-xs text-slate-500">Aun sin carreras ni certificaciones.</p>}
                  {nivel.planes.map((plan) => (
                    <div key={plan.id} className="rounded-lg border border-slate-200 p-3" data-programa={plan.clave}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-800">
                          <Insignia tono={plan.tipo === "CARRERA" ? "neutro" : "exito"}>
                            {plan.tipo === "CARRERA" ? "Carrera" : "Certificacion"}
                          </Insignia>
                          <span>
                            {plan.nombre} <span className="text-slate-400">({plan.clave})</span>
                          </span>
                        </span>
                        <span className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <Insignia>{etiquetaModalidad(plan.modalidad)}</Insignia>
                          {!aceptaNuevoIngreso(plan) && <Insignia tono="alerta">sin nuevo ingreso</Insignia>}
                          {plan.duracionPeriodos} periodos · {plan._count.materias} materias
                          <Link href={`/panel/academico/plan/${plan.id}`} className="font-medium text-marca-600 hover:underline">
                            Administrar
                          </Link>
                        </span>
                      </div>
                      {plan.tituloOtorga && <p className="mt-1 text-xs text-slate-500">Otorga: {plan.tituloOtorga}</p>}
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
                <div className="mt-2">
                  <EliminarNivel id={nivel.id} nombre={nivel.nombre} clave={nivel.clave} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Tarjeta>

      {deBaja.length > 0 && (
        <Tarjeta titulo="Niveles dados de baja" descripcion="Ya no se ofrecen; se conservan por el historial de sus alumnos">
          <ul className="space-y-4">
            {deBaja.map((nivel) => (
              <li key={nivel.id} className="space-y-2" data-nivel-baja={nivel.clave}>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-semibold text-slate-700">{nivel.nombre}</span>
                  <Insignia tono="alerta">dado de baja</Insignia>
                  <span className="text-xs text-slate-500">
                    {nivel.planes.map((plan) => (
                      <Link key={plan.id} href={`/panel/academico/plan/${plan.id}`} className="mr-2 hover:underline">
                        {plan.nombre}
                      </Link>
                    ))}
                  </span>
                  <form action={accionOfertaNivel} className="ml-auto">
                    <input type="hidden" name="nivelId" value={nivel.id} />
                    <input type="hidden" name="accion" value="reactivar" />
                    <Boton type="submit" variante="secundario">Volver a ofrecer</Boton>
                  </form>
                </div>
                <EliminarNivel id={nivel.id} nombre={nivel.nombre} clave={nivel.clave} />
              </li>
            ))}
          </ul>
        </Tarjeta>
      )}

      <Tarjeta titulo="Agregar un nivel" descripcion="Por ejemplo: Posgrado o Educacion continua, si no se creo en la instalacion">
        <FormularioNivel />
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
