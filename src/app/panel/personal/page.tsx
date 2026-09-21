import Link from "next/link";
import { requerirRol } from "@/lib/auth";
import { db } from "@/lib/db";
import { nombreCompleto } from "@/lib/catalogos";
import { Boton, EstadoVacio, Insignia, Tarjeta } from "@/components/ui";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function PaginaPersonal({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tipo?: string }>;
}) {
  await requerirRol("ADMIN");
  const params = await searchParams;
  const busqueda = (params.q ?? "").trim();

  const filtros: Prisma.EmpleadoWhereInput = {};
  if (busqueda) {
    filtros.OR = [
      { numeroEmpleado: { contains: busqueda, mode: "insensitive" } },
      { nombres: { contains: busqueda, mode: "insensitive" } },
      { apellidoPaterno: { contains: busqueda, mode: "insensitive" } },
      { email: { contains: busqueda, mode: "insensitive" } },
    ];
  }
  if (params.tipo === "docentes") filtros.esDocente = true;
  if (params.tipo === "administrativos") filtros.esDocente = false;

  const personal = await db.empleado.findMany({
    where: filtros,
    orderBy: [{ apellidoPaterno: "asc" }, { nombres: "asc" }],
    include: { _count: { select: { clases: true } }, usuario: { select: { rol: true } } },
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Personal y docentes</h1>
          <p className="mt-1 text-sm text-slate-600">{personal.length} registro(s)</p>
        </div>
        <Link href="/panel/personal/nuevo">
          <Boton type="button">Nuevo registro</Boton>
        </Link>
      </header>

      <Tarjeta>
        <form className="mb-4 flex flex-wrap gap-3" method="get">
          <input
            name="q"
            defaultValue={busqueda}
            placeholder="Numero, nombre o correo"
            className="campo max-w-xs"
            aria-label="Buscar personal"
          />
          <select name="tipo" defaultValue={params.tipo ?? ""} className="campo max-w-xs" aria-label="Tipo">
            <option value="">Todos</option>
            <option value="docentes">Solo docentes</option>
            <option value="administrativos">Solo administrativos</option>
          </select>
          <Boton type="submit" variante="secundario">
            Buscar
          </Boton>
        </form>

        {personal.length === 0 ? (
          <EstadoVacio titulo="Sin registros de personal" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="pb-2 pr-4 font-medium">Numero</th>
                  <th className="pb-2 pr-4 font-medium">Nombre</th>
                  <th className="pb-2 pr-4 font-medium">Puesto</th>
                  <th className="pb-2 pr-4 font-medium">Clases</th>
                  <th className="pb-2 pr-4 font-medium">Estado</th>
                  <th className="pb-2 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {personal.map((empleado) => (
                  <tr key={empleado.id}>
                    <td className="py-2 pr-4 font-mono text-xs text-slate-600">
                      {empleado.numeroEmpleado}
                    </td>
                    <td className="py-2 pr-4 font-medium text-slate-800">
                      {nombreCompleto(empleado)}
                      {empleado.esDocente && (
                        <span className="ml-2 text-xs font-normal text-slate-500">docente</span>
                      )}
                    </td>
                    <td className="py-2 pr-4 text-slate-600">{empleado.puesto ?? "—"}</td>
                    <td className="py-2 pr-4 text-slate-600">{empleado._count.clases}</td>
                    <td className="py-2 pr-4">
                      <Insignia tono={empleado.estado === "ACTIVO" ? "exito" : "alerta"}>
                        {empleado.estado.toLowerCase()}
                      </Insignia>
                    </td>
                    <td className="py-2 text-right">
                      <Link
                        href={`/panel/personal/${empleado.id}`}
                        className="text-sm font-medium text-marca-600 hover:underline"
                      >
                        Abrir
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Tarjeta>
    </div>
  );
}
