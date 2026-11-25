import Link from "next/link";
import { requerirRol } from "@/lib/auth";
import { db } from "@/lib/db";
import { obtenerInstitucion } from "@/lib/institucion";
import { aNumero } from "@/lib/finanzas";
import { fechaHoraLegible } from "@/lib/fechasDia";
import { formatearMoneda } from "@/lib/formato";
import { EstadoVacio, Insignia, Tarjeta } from "@/components/ui";

export const dynamic = "force-dynamic";

/// Todos los cortes de todos los cajeros.
export default async function PaginaCortes({ searchParams }: { searchParams: Promise<{ cajero?: string }> }) {
  await requerirRol("ADMIN");
  const { cajero } = await searchParams;
  const institucion = await obtenerInstitucion();
  const moneda = institucion?.moneda ?? "MXN";
  const zona = institucion?.zonaHoraria ?? "America/Mexico_City";
  const dinero = (n: number) => formatearMoneda(n, moneda);
  const cajeros = await db.turnoCaja.findMany({ distinct: ["usuarioId"], select: { usuarioId: true, usuarioNombre: true } });
  const filtro = Number(cajero) || 0;
  const turnos = await db.turnoCaja.findMany({
    where: filtro ? { usuarioId: filtro } : {},
    orderBy: { id: "desc" },
    take: 100,
    include: { pagos: { where: { estado: { not: "CANCELADO" } }, select: { montoTotal: true } } },
  });
  return (
    <div className="space-y-6">
      <header>
        <Link href="/panel/caja" className="text-sm text-marca-600 hover:underline">← Caja</Link>
        <h1 className="mt-1 text-xl font-semibold text-slate-900">Cortes de caja</h1>
        <p className="mt-1 text-sm text-slate-600">Los turnos de todos los cajeros, con lo cobrado y la diferencia al contar el efectivo.</p>
      </header>
      <Tarjeta
        acciones={
          cajeros.length > 1 ? (
            <form className="flex items-center gap-2">
              <select name="cajero" defaultValue={filtro || ""} className="campo py-1 text-sm" aria-label="Cajero">
                <option value="">Todos los cajeros</option>
                {cajeros.map((c) => (
                  <option key={c.usuarioId} value={c.usuarioId}>{c.usuarioNombre}</option>
                ))}
              </select>
              <button className="text-sm text-marca-600 hover:underline">Filtrar</button>
            </form>
          ) : undefined
        }
      >
        {turnos.length === 0 ? (
          <EstadoVacio titulo="Aun no hay cortes" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="pb-2 pr-3 font-medium">Corte</th>
                  <th className="pb-2 pr-3 font-medium">Cajero</th>
                  <th className="pb-2 pr-3 font-medium">Apertura</th>
                  <th className="pb-2 pr-3 font-medium">Cierre</th>
                  <th className="pb-2 pr-3 text-right font-medium">Cobrado</th>
                  <th className="pb-2 pr-3 text-right font-medium">Diferencia</th>
                  <th className="pb-2 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {turnos.map((t) => {
                  const diferencia = aNumero(t.diferencia);
                  return (
                    <tr key={t.id} data-corte-lista={t.id}>
                      <td className="py-2 pr-3 font-mono text-xs">#{t.id}</td>
                      <td className="py-2 pr-3">{t.usuarioNombre}</td>
                      <td className="py-2 pr-3 text-xs text-slate-600">{fechaHoraLegible(t.abiertoEn, zona)}</td>
                      <td className="py-2 pr-3 text-xs text-slate-600">{t.cerradoEn ? fechaHoraLegible(t.cerradoEn, zona) : <Insignia tono="alerta">abierta</Insignia>}</td>
                      <td className="py-2 pr-3 text-right">{dinero(t.pagos.reduce((s, p) => s + aNumero(p.montoTotal), 0))}</td>
                      <td className={`py-2 pr-3 text-right ${t.estado === "ABIERTO" ? "text-slate-400" : diferencia === 0 ? "text-emerald-700" : "text-red-700"}`}>
                        {t.estado === "ABIERTO" ? "—" : diferencia === 0 ? "cuadro" : dinero(diferencia)}
                      </td>
                      <td className="py-2 text-right">
                        <Link href={`/panel/caja/corte/${t.id}`} className="text-marca-600 hover:underline">Ver</Link>
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
