import Link from "next/link";
import { requerirRol } from "@/lib/auth";
import { db } from "@/lib/db";
import { catalogosEscolares, nombreCompleto } from "@/lib/catalogos";
import { Boton, EstadoVacio, Insignia, Tarjeta } from "@/components/ui";
import type { EstadoAlumno, Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const TAMANO = 25;

const TONO_ESTADO: Record<string, "exito" | "alerta" | "peligro" | "neutro"> = {
  ACTIVO: "exito",
  BAJA_TEMPORAL: "alerta",
  SUSPENDIDO: "alerta",
  BAJA_DEFINITIVA: "peligro",
  EGRESADO: "neutro",
};

export default async function PaginaAlumnos({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; estado?: string; plan?: string; pagina?: string }>;
}) {
  await requerirRol("ADMIN");
  const params = await searchParams;
  const pagina = Math.max(1, Number(params.pagina ?? 1));
  const busqueda = (params.q ?? "").trim();
  const catalogos = await catalogosEscolares();

  const filtros: Prisma.AlumnoWhereInput = {};
  if (busqueda) {
    filtros.OR = [
      { matricula: { contains: busqueda, mode: "insensitive" } },
      { nombres: { contains: busqueda, mode: "insensitive" } },
      { apellidoPaterno: { contains: busqueda, mode: "insensitive" } },
      { apellidoMaterno: { contains: busqueda, mode: "insensitive" } },
      { curp: { contains: busqueda, mode: "insensitive" } },
    ];
  }
  if (params.estado) filtros.estado = params.estado as EstadoAlumno;
  if (params.plan) filtros.planId = Number(params.plan);

  const [alumnos, total] = await Promise.all([
    db.alumno.findMany({
      where: filtros,
      orderBy: [{ apellidoPaterno: "asc" }, { nombres: "asc" }],
      take: TAMANO,
      skip: (pagina - 1) * TAMANO,
      include: {
        plan: { select: { nombre: true } },
        inscripciones: {
          orderBy: { fecha: "desc" },
          take: 1,
          include: { grupo: { select: { nombre: true } } },
        },
      },
    }),
    db.alumno.count({ where: filtros }),
  ]);

  const paginas = Math.max(1, Math.ceil(total / TAMANO));
  const parametros = new URLSearchParams();
  if (busqueda) parametros.set("q", busqueda);
  if (params.estado) parametros.set("estado", params.estado);
  if (params.plan) parametros.set("plan", params.plan);
  const base = parametros.toString() ? `?${parametros.toString()}&` : "?";

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Alumnos</h1>
          <p className="mt-1 text-sm text-slate-600">{total} alumno(s) registrados</p>
        </div>
        <div className="flex gap-2">
          <Link href="/panel/importar?tipo=alumnos">
            <Boton variante="secundario" type="button">
              Importar CSV
            </Boton>
          </Link>
          <Link href="/panel/alumnos/nuevo">
            <Boton type="button">Nuevo alumno</Boton>
          </Link>
        </div>
      </header>

      <Tarjeta>
        <form className="mb-4 grid gap-3 sm:grid-cols-4" method="get">
          <input
            name="q"
            defaultValue={busqueda}
            placeholder="Matricula, nombre o CURP"
            className="campo sm:col-span-2"
            aria-label="Buscar alumno"
          />
          <select name="estado" defaultValue={params.estado ?? ""} className="campo" aria-label="Estado">
            <option value="">Todos los estados</option>
            <option value="ACTIVO">Activos</option>
            <option value="BAJA_TEMPORAL">Baja temporal</option>
            <option value="BAJA_DEFINITIVA">Baja definitiva</option>
            <option value="EGRESADO">Egresados</option>
            <option value="SUSPENDIDO">Suspendidos</option>
          </select>
          <div className="flex gap-2">
            <select name="plan" defaultValue={params.plan ?? ""} className="campo" aria-label="Plan">
              <option value="">Todos los planes</option>
              {catalogos.planes.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.nombre}
                </option>
              ))}
            </select>
            <Boton type="submit" variante="secundario">
              Buscar
            </Boton>
          </div>
        </form>

        {alumnos.length === 0 ? (
          <EstadoVacio
            titulo="Sin alumnos que coincidan"
            mensaje="Ajusta la busqueda o da de alta un alumno nuevo."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="pb-2 pr-4 font-medium">Matricula</th>
                  <th className="pb-2 pr-4 font-medium">Alumno</th>
                  <th className="pb-2 pr-4 font-medium">Plan</th>
                  <th className="pb-2 pr-4 font-medium">Grupo</th>
                  <th className="pb-2 pr-4 font-medium">Estado</th>
                  <th className="pb-2 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {alumnos.map((alumno) => (
                  <tr key={alumno.id}>
                    <td className="py-2 pr-4 font-mono text-xs text-slate-600">{alumno.matricula}</td>
                    <td className="py-2 pr-4 font-medium text-slate-800">
                      {nombreCompleto(alumno)}
                    </td>
                    <td className="py-2 pr-4 text-slate-600">{alumno.plan.nombre}</td>
                    <td className="py-2 pr-4 text-slate-600">
                      {alumno.inscripciones[0]?.grupo.nombre ?? "—"}
                    </td>
                    <td className="py-2 pr-4">
                      <Insignia tono={TONO_ESTADO[alumno.estado] ?? "neutro"}>
                        {alumno.estado.replace(/_/g, " ").toLowerCase()}
                      </Insignia>
                    </td>
                    <td className="py-2 text-right">
                      <Link
                        href={`/panel/alumnos/${alumno.id}`}
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

        {paginas > 1 && (
          <nav className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-sm">
            <Link
              href={`${base}pagina=${pagina - 1}`}
              className={pagina <= 1 ? "pointer-events-none text-slate-300" : "text-marca-600"}
            >
              Anterior
            </Link>
            <span className="text-slate-500">
              Pagina {pagina} de {paginas}
            </span>
            <Link
              href={`${base}pagina=${pagina + 1}`}
              className={pagina >= paginas ? "pointer-events-none text-slate-300" : "text-marca-600"}
            >
              Siguiente
            </Link>
          </nav>
        )}
      </Tarjeta>
    </div>
  );
}
