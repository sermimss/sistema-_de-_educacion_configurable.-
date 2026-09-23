import Link from "next/link";
import { requerirRol } from "@/lib/auth";
import { db } from "@/lib/db";
import { nombreCompleto } from "@/lib/catalogos";
import { formatearFecha } from "@/lib/formato";
import { EstadoVacio, Insignia, Tarjeta } from "@/components/ui";
import { FormularioAsignarBeca, FormularioDescuento } from "../Formularios";
import { quitarBeca } from "../acciones";

export const dynamic = "force-dynamic";

export default async function PaginaBecas() {
  await requerirRol("ADMIN");

  const [descuentos, asignaciones, conceptos, alumnos, ciclos] = await Promise.all([
    db.descuento.findMany({
      orderBy: { nombre: "asc" },
      include: { conceptos: true, _count: { select: { alumnos: true } } },
    }),
    db.descuentoAlumno.findMany({
      where: { activo: true },
      orderBy: { fechaAutorizacion: "desc" },
      include: { alumno: true, descuento: true, ciclo: true },
      take: 100,
    }),
    db.conceptoCobro.findMany({ where: { activo: true }, orderBy: { orden: "asc" } }),
    db.alumno.findMany({ where: { estado: "ACTIVO" }, orderBy: { apellidoPaterno: "asc" }, take: 500 }),
    db.cicloEscolar.findMany({ where: { activo: true }, orderBy: { fechaInicio: "desc" } }),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <Link href="/panel/finanzas" className="text-sm text-marca-600 hover:underline">
          ← Finanzas
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-slate-900">Becas y descuentos</h1>
        <p className="mt-1 text-sm text-slate-600">
          El descuento se aplica al generar los cargos. Si asignas una beca despues, vuelve a
          generar para que se refleje.
        </p>
      </header>

      <Tarjeta titulo="Catalogo" descripcion={`${descuentos.length} registro(s)`}>
        <div className="space-y-4">
          {descuentos.length === 0 ? (
            <EstadoVacio titulo="Sin becas ni descuentos" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {descuentos.map((descuento) => (
                <li key={descuento.id} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <p className="font-medium text-slate-800">{descuento.nombre}</p>
                    <p className="text-xs text-slate-500">
                      {Number(descuento.valor)}
                      {descuento.tipoCalculo === "PORCENTAJE" ? "%" : ""} ·{" "}
                      {descuento.aplicaATodos
                        ? "todos los conceptos"
                        : `${descuento.conceptos.length} concepto(s)`}{" "}
                      · {descuento._count.alumnos} alumno(s)
                      {descuento.acumulable ? " · acumulable" : ""}
                    </p>
                  </div>
                  <Insignia tono={descuento.activo ? "exito" : "neutro"}>
                    {descuento.activo ? "activo" : "inactivo"}
                  </Insignia>
                </li>
              ))}
            </ul>
          )}
          <div className="border-t border-slate-100 pt-4">
            <FormularioDescuento
              conceptos={conceptos.map((concepto) => ({
                id: concepto.id,
                etiqueta: concepto.nombre,
              }))}
            />
          </div>
        </div>
      </Tarjeta>

      <Tarjeta titulo="Asignar beca a un alumno">
        <FormularioAsignarBeca
          alumnos={alumnos.map((alumno) => ({
            id: alumno.id,
            etiqueta: `${alumno.matricula} · ${nombreCompleto(alumno)}`,
          }))}
          descuentos={descuentos
            .filter((descuento) => descuento.activo)
            .map((descuento) => ({ id: descuento.id, etiqueta: descuento.nombre }))}
          ciclos={ciclos.map((ciclo) => ({ id: ciclo.id, etiqueta: ciclo.nombre }))}
        />
      </Tarjeta>

      <Tarjeta titulo="Becas asignadas" descripcion={`${asignaciones.length} vigente(s)`}>
        {asignaciones.length === 0 ? (
          <EstadoVacio titulo="Ningun alumno tiene beca asignada" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {asignaciones.map((asignacion) => (
              <li key={asignacion.id} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <Link
                    href={`/panel/finanzas/alumno/${asignacion.alumnoId}`}
                    className="font-medium text-slate-800 hover:text-marca-600"
                  >
                    {nombreCompleto(asignacion.alumno)}
                  </Link>
                  <p className="text-xs text-slate-500">
                    {asignacion.descuento.nombre} ·{" "}
                    {asignacion.ciclo?.nombre ?? "todos los ciclos"} ·{" "}
                    {formatearFecha(asignacion.fechaAutorizacion)}
                  </p>
                </div>
                <form action={quitarBeca}>
                  <input type="hidden" name="asignacionId" value={asignacion.id} />
                  <button type="submit" className="text-xs font-medium text-red-600 hover:underline">
                    quitar
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Tarjeta>
    </div>
  );
}
