import Link from "next/link";
import { requerirRol } from "@/lib/auth";
import { db } from "@/lib/db";
import { nombreCompleto } from "@/lib/catalogos";
import { obtenerInstitucion } from "@/lib/institucion";
import { configNumero } from "@/lib/configuracion";
import { fechasDeVencimiento } from "@/lib/finanzas";
import { formatearFecha, formatearMoneda } from "@/lib/formato";
import { EstadoVacio, Insignia, Tarjeta } from "@/components/ui";
import {
  BotonEliminarConcepto,
  FormularioConcepto,
  FormularioRecargo,
  type ConceptoEditable,
} from "../Formularios";
import { alternarConcepto, eliminarRecargo } from "../acciones";

export const dynamic = "force-dynamic";

const ETIQUETA_PERIODICIDAD: Record<string, string> = {
  UNICO: "Una sola vez",
  MENSUAL: "Mensual",
  BIMESTRAL: "Bimestral",
  POR_PERIODO_ACADEMICO: "Por periodo academico",
  SEMESTRAL: "Semestral",
  ANUAL: "Anual",
};

export default async function PaginaConceptos({
  searchParams,
}: {
  searchParams: Promise<{ editar?: string }>;
}) {
  await requerirRol("ADMIN");
  const params = await searchParams;
  const institucion = await obtenerInstitucion();
  const moneda = institucion?.moneda ?? "MXN";
  const diaSugerido = await configNumero("finanzas.dia_vencimiento_default", 10);

  const [conceptos, reglas, niveles, planes, grados, grupos, alumnos, ciclo] = await Promise.all([
    db.conceptoCobro.findMany({
      orderBy: [{ activo: "desc" }, { orden: "asc" }],
      include: { _count: { select: { cargos: true } } },
    }),
    db.reglaRecargo.findMany({ orderBy: { id: "asc" } }),
    db.nivelEducativo.findMany({ orderBy: { orden: "asc" } }),
    db.planEstudios.findMany({ orderBy: { nombre: "asc" }, include: { nivel: true } }),
    db.grado.findMany({ orderBy: [{ planId: "asc" }, { numero: "asc" }], include: { plan: true } }),
    db.grupo.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    db.alumno.findMany({
      where: { estado: "ACTIVO" },
      orderBy: { apellidoPaterno: "asc" },
      take: 500,
    }),
    db.cicloEscolar.findFirst({
      where: { estado: "ACTIVO" },
      include: { periodos: { orderBy: { numero: "asc" } } },
    }),
  ]);

  const editando = conceptos.find((concepto) => concepto.id === Number(params.editar));

  const referencias = {
    niveles: niveles.map((n) => ({ id: n.id, etiqueta: n.nombre })),
    planes: planes.map((p) => ({ id: p.id, etiqueta: `${p.nivel.nombre} · ${p.nombre}` })),
    grados: grados.map((g) => ({ id: g.id, etiqueta: `${g.plan.nombre} · ${g.nombre}` })),
    grupos: grupos.map((g) => ({ id: g.id, etiqueta: g.nombre })),
    alumnos: alumnos.map((a) => ({ id: a.id, etiqueta: `${a.matricula} · ${nombreCompleto(a)}` })),
  };

  const comoEditable = (concepto: (typeof conceptos)[number]): ConceptoEditable => ({
    id: concepto.id,
    clave: concepto.clave,
    nombre: concepto.nombre,
    leyenda: concepto.leyenda ?? "",
    descripcion: concepto.descripcion ?? "",
    tipo: concepto.tipo,
    montoBase: String(Number(concepto.montoBase)),
    periodicidad: concepto.periodicidad,
    numeroCargos: concepto.numeroCargos ? String(concepto.numeroCargos) : "",
    diaVencimiento: concepto.diaVencimiento ? String(concepto.diaVencimiento) : "",
    fechaPrimerCargo: concepto.fechaPrimerCargo
      ? concepto.fechaPrimerCargo.toISOString().slice(0, 10)
      : "",
    ambito: concepto.ambito,
    referenciaId: concepto.referenciaId ? String(concepto.referenciaId) : "",
    obligatorio: concepto.obligatorio,
    generaRecargo: concepto.generaRecargo,
    aplicaDescuentos: concepto.aplicaDescuentos,
    activo: concepto.activo,
    tasaIva: concepto.tasaIva != null ? String(Number(concepto.tasaIva)) : "",
    claveProdServSat: concepto.claveProdServSat ?? "",
    claveUnidadSat: concepto.claveUnidadSat ?? "",
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/panel/finanzas" className="text-sm text-marca-600 hover:underline">
            ← Finanzas
          </Link>
          <h1 className="mt-1 text-xl font-semibold text-slate-900">Conceptos de cobro</h1>
          <p className="mt-1 text-sm text-slate-600">
            Cada cobro lo define el colegio: el motivo, el monto, cuando se cobra, cuantas veces y a
            quien.
          </p>
        </div>
      </header>

      <Tarjeta titulo={`${conceptos.length} concepto(s)`}>
        {conceptos.length === 0 ? (
          <EstadoVacio titulo="Sin conceptos de cobro" mensaje="Crea el primero con el formulario de abajo." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="pb-2 pr-3 font-medium">Clave</th>
                  <th className="pb-2 pr-3 font-medium">Motivo</th>
                  <th className="pb-2 pr-3 font-medium">Monto</th>
                  <th className="pb-2 pr-3 font-medium">Cuando</th>
                  <th className="pb-2 pr-3 font-medium">Aplica a</th>
                  <th className="pb-2 pr-3 font-medium">Cargos</th>
                  <th className="pb-2 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {conceptos.map((concepto) => {
                  const fechas = ciclo
                    ? fechasDeVencimiento(
                        {
                          periodicidad: concepto.periodicidad,
                          diaVencimiento: concepto.diaVencimiento,
                          fechaPrimerCargo: concepto.fechaPrimerCargo,
                          numeroCargos: concepto.numeroCargos,
                        },
                        ciclo
                      )
                    : [];
                  return (
                    <tr key={concepto.id} className={concepto.activo ? "" : "opacity-50"}>
                      <td className="py-2 pr-3 font-mono text-xs text-slate-600">{concepto.clave}</td>
                      <td className="py-2 pr-3">
                        <p className="font-medium text-slate-800">{concepto.nombre}</p>
                        {concepto.leyenda && (
                          <p className="text-xs text-slate-500">&ldquo;{concepto.leyenda}&rdquo;</p>
                        )}
                      </td>
                      <td className="py-2 pr-3 font-medium text-slate-900">
                        {formatearMoneda(Number(concepto.montoBase), moneda)}
                      </td>
                      <td className="py-2 pr-3 text-xs text-slate-600">
                        <p>{ETIQUETA_PERIODICIDAD[concepto.periodicidad]}</p>
                        <p className="text-slate-400">
                          {fechas.length > 0
                            ? `${fechas.length} cargo(s), 1o el ${formatearFecha(fechas[0])}`
                            : concepto.diaVencimiento
                              ? `Dia ${concepto.diaVencimiento}`
                              : "Sin fechas calculadas"}
                        </p>
                      </td>
                      <td className="py-2 pr-3 text-xs text-slate-600">
                        {concepto.ambito === "TODOS" ? "Todos" : concepto.ambito.toLowerCase()}
                      </td>
                      <td className="py-2 pr-3 text-slate-600">{concepto._count.cargos}</td>
                      <td className="py-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/panel/finanzas/conceptos?editar=${concepto.id}`}
                            className="text-xs font-medium text-marca-600 hover:underline"
                          >
                            editar
                          </Link>
                          <form action={alternarConcepto} className="inline">
                            <input type="hidden" name="conceptoId" value={concepto.id} />
                            <button type="submit" className="text-xs font-medium text-slate-500 hover:underline">
                              {concepto.activo ? "desactivar" : "activar"}
                            </button>
                          </form>
                          {concepto._count.cargos === 0 && (
                            <BotonEliminarConcepto conceptoId={concepto.id} />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Tarjeta>

      <Tarjeta
        titulo={editando ? `Editar ${editando.nombre}` : "Nuevo concepto de cobro"}
        acciones={
          editando ? (
            <Link href="/panel/finanzas/conceptos" className="text-sm text-marca-600 hover:underline">
              Cancelar edicion
            </Link>
          ) : undefined
        }
      >
        <FormularioConcepto
          key={editando?.id ?? "nuevo"}
          concepto={editando ? comoEditable(editando) : undefined}
          referencias={referencias}
          diaSugerido={diaSugerido}
        />
      </Tarjeta>

      <Tarjeta titulo="Recargos por pago tardio" descripcion={`${reglas.length} regla(s)`}>
        <div className="space-y-4">
          {reglas.length > 0 && (
            <ul className="divide-y divide-slate-100">
              {reglas.map((regla) => (
                <li key={regla.id} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <p className="font-medium text-slate-800">{regla.nombre}</p>
                    <p className="text-xs text-slate-500">
                      {Number(regla.valor)}
                      {regla.tipoCalculo === "PORCENTAJE" ? "%" : ` ${moneda}`} ·{" "}
                      {regla.diasGracia} dia(s) de gracia · {regla.frecuencia.toLowerCase()}
                      {regla.topeMaximo ? ` · tope ${Number(regla.topeMaximo)}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Insignia tono={regla.activa ? "exito" : "neutro"}>
                      {regla.activa ? "activa" : "inactiva"}
                    </Insignia>
                    <form action={eliminarRecargo}>
                      <input type="hidden" name="recargoId" value={regla.id} />
                      <button type="submit" className="text-xs font-medium text-red-600 hover:underline">
                        eliminar
                      </button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="border-t border-slate-100 pt-4">
            <FormularioRecargo />
          </div>
        </div>
      </Tarjeta>
    </div>
  );
}
