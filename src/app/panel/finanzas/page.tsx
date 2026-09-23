import Link from "next/link";
import { requerirRol } from "@/lib/auth";
import { db } from "@/lib/db";
import { nombreCompleto } from "@/lib/catalogos";
import { obtenerInstitucion } from "@/lib/institucion";
import { aNumero, centavos } from "@/lib/finanzas";
import { formatearMoneda } from "@/lib/formato";
import { Alerta, EstadoVacio, Insignia, Tarjeta } from "@/components/ui";
import { FormularioGeneracion, BotonRecargos } from "./Operaciones";

export const dynamic = "force-dynamic";

export default async function PaginaFinanzas({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requerirRol("ADMIN");
  const params = await searchParams;
  const busqueda = (params.q ?? "").trim();

  const institucion = await obtenerInstitucion();
  const moneda = institucion?.moneda ?? "MXN";

  const [ciclos, grupos, cargos, pagos, conceptosActivos] = await Promise.all([
    db.cicloEscolar.findMany({ where: { activo: true }, orderBy: { fechaInicio: "desc" } }),
    db.grupo.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    db.cargo.findMany({ where: { estado: { notIn: ["CANCELADO", "CONDONADO"] } } }),
    db.pago.findMany({ where: { estado: { not: "CANCELADO" } } }),
    db.conceptoCobro.count({ where: { activo: true } }),
  ]);

  const hoy = new Date();
  const totalCargado = centavos(cargos.reduce((suma, cargo) => suma + aNumero(cargo.montoTotal), 0));
  const saldo = centavos(cargos.reduce((suma, cargo) => suma + aNumero(cargo.saldo), 0));
  const vencido = centavos(
    cargos
      .filter((cargo) => aNumero(cargo.saldo) > 0 && cargo.fechaVencimiento < hoy)
      .reduce((suma, cargo) => suma + aNumero(cargo.saldo), 0)
  );
  const cobrado = centavos(pagos.reduce((suma, pago) => suma + aNumero(pago.montoTotal), 0));

  const alumnos = busqueda
    ? await db.alumno.findMany({
        where: {
          OR: [
            { matricula: { contains: busqueda, mode: "insensitive" } },
            { nombres: { contains: busqueda, mode: "insensitive" } },
            { apellidoPaterno: { contains: busqueda, mode: "insensitive" } },
          ],
        },
        orderBy: { apellidoPaterno: "asc" },
        take: 30,
        include: { cargos: { where: { estado: { notIn: ["CANCELADO", "CONDONADO"] } } } },
      })
    : await db.alumno.findMany({
        where: { tieneAdeudo: true },
        orderBy: { apellidoPaterno: "asc" },
        take: 30,
        include: { cargos: { where: { estado: { notIn: ["CANCELADO", "CONDONADO"] } } } },
      });

  const cicloActivo = ciclos.find((ciclo) => ciclo.estado === "ACTIVO") ?? ciclos[0];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Finanzas</h1>
          <p className="mt-1 text-sm text-slate-600">
            {conceptosActivos} concepto(s) de cobro activos
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/panel/finanzas/conceptos"
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Conceptos de cobro
          </Link>
          <Link
            href="/panel/finanzas/becas"
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Becas y descuentos
          </Link>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Cargado", totalCargado, "text-slate-900"],
          ["Cobrado", cobrado, "text-emerald-700"],
          ["Saldo pendiente", saldo, "text-slate-900"],
          ["Vencido", vencido, "text-red-700"],
        ].map(([etiqueta, valor, clase]) => (
          <div key={etiqueta as string} className="tarjeta px-5 py-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">{etiqueta as string}</p>
            <p className={`mt-1 text-2xl font-semibold ${clase as string}`}>
              {formatearMoneda(valor as number, moneda)}
            </p>
          </div>
        ))}
      </div>

      {conceptosActivos === 0 ? (
        <Alerta tipo="aviso">
          Todavia no hay conceptos de cobro.{" "}
          <Link href="/panel/finanzas/conceptos" className="font-medium underline">
            Definir el primero
          </Link>
        </Alerta>
      ) : cicloActivo ? (
        <Tarjeta
          titulo="Generar cargos del ciclo"
          descripcion="Usa el motivo, el monto y las fechas que configuraste en cada concepto"
        >
          <FormularioGeneracion
            moneda={moneda}
            ciclos={ciclos.map((ciclo) => ({ id: ciclo.id, etiqueta: ciclo.nombre }))}
            grupos={grupos.map((grupo) => ({ id: grupo.id, etiqueta: grupo.nombre }))}
          />
        </Tarjeta>
      ) : (
        <Alerta tipo="aviso">No hay ciclos escolares activos.</Alerta>
      )}

      {cicloActivo && (
        <Tarjeta titulo="Recargos" descripcion="Recalcula los recargos de los cargos vencidos">
          <BotonRecargos cicloId={cicloActivo.id} />
        </Tarjeta>
      )}

      <Tarjeta
        titulo={busqueda ? `Resultados para "${busqueda}"` : "Alumnos con adeudo vencido"}
        descripcion={`${alumnos.length} alumno(s)`}
      >
        <form method="get" className="mb-4 flex flex-wrap gap-2">
          <input
            name="q"
            defaultValue={busqueda}
            placeholder="Matricula o nombre"
            className="campo max-w-xs"
            aria-label="Buscar alumno"
          />
          <button
            type="submit"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Buscar
          </button>
        </form>

        {alumnos.length === 0 ? (
          <EstadoVacio
            titulo={busqueda ? "Sin coincidencias" : "Ningun alumno con adeudo vencido"}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="pb-2 pr-3 font-medium">Matricula</th>
                  <th className="pb-2 pr-3 font-medium">Alumno</th>
                  <th className="pb-2 pr-3 font-medium">Saldo</th>
                  <th className="pb-2 pr-3 font-medium">Estado</th>
                  <th className="pb-2 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {alumnos.map((alumno) => {
                  const saldoAlumno = centavos(
                    alumno.cargos.reduce((suma, cargo) => suma + aNumero(cargo.saldo), 0)
                  );
                  return (
                    <tr key={alumno.id}>
                      <td className="py-2 pr-3 font-mono text-xs text-slate-600">{alumno.matricula}</td>
                      <td className="py-2 pr-3 font-medium text-slate-800">{nombreCompleto(alumno)}</td>
                      <td className="py-2 pr-3 font-medium text-slate-900">
                        {formatearMoneda(saldoAlumno, moneda)}
                      </td>
                      <td className="py-2 pr-3">
                        {alumno.tieneAdeudo ? (
                          <Insignia tono="peligro">adeudo vencido</Insignia>
                        ) : saldoAlumno > 0 ? (
                          <Insignia tono="alerta">con saldo</Insignia>
                        ) : (
                          <Insignia tono="exito">al corriente</Insignia>
                        )}
                      </td>
                      <td className="py-2 text-right">
                        <Link
                          href={`/panel/finanzas/alumno/${alumno.id}`}
                          className="text-sm font-medium text-marca-600 hover:underline"
                        >
                          Estado de cuenta
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Tarjeta>
    </div>
  );
}
