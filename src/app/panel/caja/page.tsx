import Link from "next/link";
import { randomUUID } from "node:crypto";
import { requerirRol } from "@/lib/auth";
import { db } from "@/lib/db";
import { nombreCompleto } from "@/lib/catalogos";
import { obtenerInstitucion } from "@/lib/institucion";
import { configBool } from "@/lib/configuracion";
import { aNumero, resumenDeCuenta } from "@/lib/finanzas";
import { prepararCuenta, saldoAFavor } from "@/lib/cobranza";
import { NOMBRE_METODO, resumenTurno, turnoAbierto } from "@/lib/caja";
import { fechaHoraLegible, hoyEnZona } from "@/lib/fechasDia";
import { formatearMoneda } from "@/lib/formato";
import { Alerta, EstadoVacio, Insignia, Tarjeta } from "@/components/ui";
import { FormularioPago } from "../finanzas/Operaciones";
import { FormularioAbrirCaja, FormularioCerrarCaja } from "./Formularios";

export const dynamic = "force-dynamic";

export default async function PaginaCaja({ searchParams }: { searchParams: Promise<{ q?: string; alumno?: string }> }) {
  const sesion = await requerirRol("ADMIN");
  const params = await searchParams;
  const institucion = await obtenerInstitucion();
  const moneda = institucion?.moneda ?? "MXN";
  const zona = institucion?.zonaHoraria ?? "America/Mexico_City";
  const dinero = (n: number) => formatearMoneda(n, moneda);
  const turno = await turnoAbierto(sesion.usuarioId);

  const misCortes = await db.turnoCaja.findMany({ where: { usuarioId: sesion.usuarioId, estado: "CERRADO" }, orderBy: { id: "desc" }, take: 5 });
  const encabezado = (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Caja</h1>
        <p className="mt-1 text-sm text-slate-600">Busca al alumno, cobra e imprime el recibo. Al terminar tu turno haces el corte.</p>
      </div>
      <Link href="/panel/caja/cortes" className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
        Cortes de caja
      </Link>
    </header>
  );

  if (!turno) {
    return (
      <div className="space-y-6">
        {encabezado}
        <Tarjeta titulo="Tu caja esta cerrada" descripcion="Abrela para empezar a cobrar; todo lo que cobres quedara en tu corte">
          <FormularioAbrirCaja />
        </Tarjeta>
        {misCortes.length > 0 && (
          <Tarjeta titulo="Tus ultimos cortes">
            <ul className="divide-y divide-slate-100">
              {misCortes.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span>Corte #{c.id} · {fechaHoraLegible(c.cerradoEn!, zona)}</span>
                  <span className="flex items-center gap-2">
                    <Insignia tono={aNumero(c.diferencia) === 0 ? "exito" : "peligro"}>
                      {aNumero(c.diferencia) === 0 ? "cuadro" : `diferencia ${dinero(aNumero(c.diferencia))}`}
                    </Insignia>
                    <Link href={`/panel/caja/corte/${c.id}`} className="text-marca-600 hover:underline">Ver</Link>
                  </span>
                </li>
              ))}
            </ul>
          </Tarjeta>
        )}
      </div>
    );
  }

  const resumen = await resumenTurno(turno.id);
  const busqueda = (params.q ?? "").trim();
  const encontrados = busqueda
    ? await db.alumno.findMany({
        where: {
          OR: [
            { matricula: { contains: busqueda, mode: "insensitive" } },
            { nombres: { contains: busqueda, mode: "insensitive" } },
            { apellidoPaterno: { contains: busqueda, mode: "insensitive" } },
            { apellidoMaterno: { contains: busqueda, mode: "insensitive" } },
          ],
        },
        orderBy: [{ apellidoPaterno: "asc" }, { nombres: "asc" }],
        take: 15,
        include: { plan: true },
      })
    : [];

  // Alumno elegido: su cuenta al dia y el formulario de cobro.
  const alumnoId = Number(params.alumno) || 0;
  const alumno = alumnoId ? await db.alumno.findUnique({ where: { id: alumnoId }, include: { plan: true } }) : null;
  let cuenta: React.ReactNode = null;
  if (alumno) {
    await prepararCuenta(alumno.id);
    const [resumenCuenta, aFavor, cargos, permiteParciales] = await Promise.all([
      resumenDeCuenta(alumno.id),
      saldoAFavor(alumno.id),
      db.cargo.findMany({
        where: { alumnoId: alumno.id, estado: { in: ["PENDIENTE", "PARCIAL", "VENCIDO"] }, saldo: { gt: 0 } },
        orderBy: { fechaVencimiento: "asc" },
      }),
      configBool("finanzas.permite_pagos_parciales", true),
    ]);
    const ahora = new Date();
    cuenta = (
      <Tarjeta
        titulo={`${nombreCompleto(alumno)} · ${alumno.matricula}`}
        descripcion={alumno.plan.nombre}
        acciones={<Link href={`/panel/finanzas/alumno/${alumno.id}`} className="text-sm text-marca-600 hover:underline">Estado de cuenta completo</Link>}
      >
        <div className="space-y-4" data-cuenta-caja>
          <div className="flex flex-wrap gap-4 text-sm">
            <span>Debe: <strong>{dinero(resumenCuenta.saldo)}</strong></span>
            <span className={resumenCuenta.vencido > 0 ? "text-red-700" : "text-slate-600"}>Vencido: <strong>{dinero(resumenCuenta.vencido)}</strong></span>
            {aFavor > 0 && <span className="text-emerald-700">A favor: <strong>{dinero(aFavor)}</strong></span>}
          </div>
          <FormularioPago
            alumnoId={alumno.id}
            cargos={cargos.map((c) => ({
              id: c.id,
              descripcion: c.descripcion,
              saldo: aNumero(c.saldo),
              vence: c.fechaVencimiento.toISOString().slice(0, 10),
              vencido: c.fechaVencimiento < ahora,
            }))}
            permiteParciales={permiteParciales}
            moneda={moneda}
            claveCaptura={randomUUID()}
            hoy={hoyEnZona(zona)}
            saldoFavor={aFavor}
            imprimirYVolverA="/panel/caja"
          />
        </div>
      </Tarjeta>
    );
  }

  const cobros = await db.pago.findMany({
    where: { turnoId: turno.id },
    orderBy: { registradoEn: "desc" },
    include: { alumno: true, recibo: true },
  });

  return (
    <div className="space-y-6">
      {encabezado}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" data-resumen-turno>
        {[
          ["Caja abierta", fechaHoraLegible(turno.abiertoEn, zona)],
          ["Fondo inicial", dinero(aNumero(turno.fondoInicial))],
          ["Cobrado en el turno", `${dinero(resumen.totalCobrado)} (${resumen.cobros})`],
          ["Efectivo en caja", dinero(resumen.efectivoEsperado)],
        ].map(([etiqueta, valor]) => (
          <div key={etiqueta} className="tarjeta px-5 py-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">{etiqueta}</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{valor}</p>
          </div>
        ))}
      </div>

      <Tarjeta titulo="Cobrar">
        <form method="get" className="flex flex-wrap gap-2" data-buscar-alumno>
          <input name="q" defaultValue={busqueda} placeholder="Matricula, nombre o apellido" className="campo max-w-sm" aria-label="Buscar alumno" autoFocus={!alumno} />
          <button type="submit" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Buscar
          </button>
        </form>
        {busqueda && (
          <ul className="mt-3 divide-y divide-slate-100" data-resultados-caja>
            {encontrados.length === 0 && <li className="py-2 text-sm text-slate-500">Sin coincidencias.</li>}
            {encontrados.map((a) => (
              <li key={a.id}>
                <Link href={`/panel/caja?alumno=${a.id}`} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm hover:bg-slate-50">
                  <span>
                    <span className="font-mono text-xs text-slate-500">{a.matricula}</span> {nombreCompleto(a)}
                  </span>
                  <span className="text-xs text-slate-500">{a.plan.nombre}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Tarjeta>

      {cuenta}

      <Tarjeta titulo="Cobros de este turno" descripcion={`${resumen.cobros} cobro(s)${resumen.cancelados ? ` · ${resumen.cancelados} cancelado(s)` : ""}`}>
        {cobros.length === 0 ? (
          <EstadoVacio titulo="Aun no hay cobros en este turno" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {cobros.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm" data-cobro-turno={p.folio}>
                <span>
                  <span className="font-mono text-xs text-slate-500">{p.folio}</span> {nombreCompleto(p.alumno)} ·{" "}
                  {NOMBRE_METODO[p.metodoPago]}
                  {p.referencia ? ` · ref ${p.referencia}` : ""}
                </span>
                <span className="flex items-center gap-2">
                  <strong>{dinero(aNumero(p.montoTotal))}</strong>
                  {p.estado === "CANCELADO" ? (
                    <Insignia tono="peligro">cancelado</Insignia>
                  ) : (
                    <Link href={`/panel/finanzas/recibo/${p.id}`} className="text-xs text-marca-600 hover:underline">Recibo</Link>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Tarjeta>

      <Tarjeta titulo="Cerrar caja (corte)" descripcion="Cuenta el efectivo que hay en la caja">
        <div className="mb-3 flex flex-wrap gap-2 text-xs">
          {resumen.porMetodo.map((f) => (
            <Insignia key={f.metodo}>{NOMBRE_METODO[f.metodo]}: {dinero(f.total)} ({f.cobros})</Insignia>
          ))}
        </div>
        <FormularioCerrarCaja esperado={resumen.efectivoEsperado} moneda={moneda} />
        <p className="mt-2 text-xs text-slate-500">
          Antes de cerrar puedes revisar el <Link href={`/panel/caja/corte/${turno.id}`} className="underline">corte parcial</Link>.
        </p>
      </Tarjeta>
      {!alumno && misCortes.length === 0 && <Alerta tipo="info">Busca un alumno por matricula o nombre para cobrarle.</Alerta>}
    </div>
  );
}
