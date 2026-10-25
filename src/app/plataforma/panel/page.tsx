import { EstadoVacio, Insignia, Tarjeta } from "@/components/ui";
import { direccionPublica } from "@/lib/colegio";
import { requerirDueno } from "@/lib/dueno";
import { formatearFechaHora } from "@/lib/formato";
import { alumnosPorColegio, listarCodigos, listarColegios, type EstadoColegio } from "@/lib/plataforma";
import {
  accionEstadoColegio,
  accionNotasColegio,
  accionRevocarCodigo,
  accionSalirDueno,
} from "../acciones";
import { FormularioNuevoCodigo } from "../Formularios";

export const dynamic = "force-dynamic";

const ETIQUETA_ESTADO: Record<EstadoColegio, { texto: string; tono: "exito" | "alerta" | "neutro" | "peligro" }> = {
  CONFIGURANDO: { texto: "configurando", tono: "neutro" },
  PENDIENTE_PAGO: { texto: "pendiente de pago", tono: "alerta" },
  ACTIVO: { texto: "activo", tono: "exito" },
  SUSPENDIDO: { texto: "suspendido", tono: "peligro" },
};

function BotonEstado({ colegioId, estado, texto, peligro }: { colegioId: number; estado: string; texto: string; peligro?: boolean }) {
  return (
    <form action={accionEstadoColegio}>
      <input type="hidden" name="colegioId" value={colegioId} />
      <input type="hidden" name="estado" value={estado} />
      <button
        type="submit"
        className={`rounded-md px-2 py-1 text-xs font-medium ${
          peligro ? "text-red-600 hover:bg-red-50" : "text-marca-600 hover:bg-slate-100"
        }`}
      >
        {texto}
      </button>
    </form>
  );
}

export default async function PanelDueno() {
  const dueno = await requerirDueno();
  const [colegios, codigos] = await Promise.all([listarColegios(), listarCodigos()]);
  const alumnos = await alumnosPorColegio(colegios);
  const urls = new Map<number, string>();
  for (const colegio of colegios) {
    if (colegio.direccion) urls.set(colegio.id, await direccionPublica(colegio.direccion));
  }
  const nombrePorId = new Map(colegios.map((c) => [c.id, c.nombre || `Colegio ${c.id}`]));
  const pendientes = colegios.filter((c) => c.estado === "PENDIENTE_PAGO").length;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Administracion de la plataforma</h1>
          <p className="mt-1 text-sm text-slate-600">
            {colegios.length} colegio(s) · {pendientes} pendiente(s) de pago · sesion de {dueno.usuario}
          </p>
        </div>
        <form action={accionSalirDueno}>
          <button type="submit" className="text-sm text-slate-600 hover:text-slate-900">
            Salir
          </button>
        </form>
      </header>

      <Tarjeta
        titulo="Codigos de alta"
        descripcion="Cada codigo sirve para dar de alta un solo colegio. Entregalo a quien contrata."
      >
        <div className="space-y-5">
          <FormularioNuevoCodigo />
          {codigos.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="pb-2 pr-4 font-medium">Codigo</th>
                    <th className="pb-2 pr-4 font-medium">Para quien</th>
                    <th className="pb-2 pr-4 font-medium">Creado</th>
                    <th className="pb-2 pr-4 font-medium">Estado</th>
                    <th className="pb-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {codigos.map((codigo) => (
                    <tr key={codigo.id}>
                      <td className="py-2 pr-4 font-mono text-xs text-slate-600">ALTA-····-····-{codigo.pista}</td>
                      <td className="py-2 pr-4 text-slate-700">{codigo.etiqueta ?? "—"}</td>
                      <td className="py-2 pr-4 text-slate-500">{formatearFechaHora(codigo.creadoEn)}</td>
                      <td className="py-2 pr-4">
                        {codigo.revocado ? (
                          <Insignia tono="neutro">revocado</Insignia>
                        ) : codigo.colegioId ? (
                          <Insignia tono="exito">usado · {nombrePorId.get(codigo.colegioId)}</Insignia>
                        ) : (
                          <Insignia tono="alerta">sin usar</Insignia>
                        )}
                      </td>
                      <td className="py-2 text-right">
                        {!codigo.revocado && !codigo.colegioId && (
                          <form action={accionRevocarCodigo}>
                            <input type="hidden" name="codigoId" value={codigo.id} />
                            <button type="submit" className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50">
                              Revocar
                            </button>
                          </form>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Tarjeta>

      <Tarjeta
        titulo="Colegios"
        descripcion="Marca como pagado para abrir un colegio; suspende para cerrarle el acceso."
      >
        {colegios.length === 0 ? (
          <EstadoVacio titulo="Aun no hay colegios" mensaje="Genera un codigo de alta y entregalo a tu primer cliente." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="pb-2 pr-4 font-medium">Colegio</th>
                  <th className="pb-2 pr-4 font-medium">Direccion</th>
                  <th className="pb-2 pr-4 font-medium">Estado</th>
                  <th className="pb-2 pr-4 font-medium">Alumnos</th>
                  <th className="pb-2 pr-4 font-medium">Notas</th>
                  <th className="pb-2 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {colegios.map((colegio) => {
                  const etiqueta = ETIQUETA_ESTADO[colegio.estado];
                  return (
                    <tr key={colegio.id} data-colegio={colegio.direccion ?? ""}>
                      <td className="py-2 pr-4">
                        <p className="font-medium text-slate-800">{colegio.nombre || "(sin terminar)"}</p>
                        <p className="text-xs text-slate-500">alta {formatearFechaHora(colegio.creadoEn)}</p>
                      </td>
                      <td className="py-2 pr-4 font-mono text-xs text-slate-600">
                        {urls.get(colegio.id) ?? "—"}
                      </td>
                      <td className="py-2 pr-4">
                        <Insignia tono={etiqueta.tono}>{etiqueta.texto}</Insignia>
                      </td>
                      <td className="py-2 pr-4 text-slate-600">{alumnos.get(colegio.id) ?? "—"}</td>
                      <td className="py-2 pr-4">
                        <form action={accionNotasColegio} className="flex items-center gap-1">
                          <input type="hidden" name="colegioId" value={colegio.id} />
                          <input
                            name="notas"
                            defaultValue={colegio.notas ?? ""}
                            className="campo w-44 py-1 text-xs"
                            aria-label={`Notas de ${colegio.nombre}`}
                            placeholder="Pago, contacto..."
                          />
                          <button type="submit" className="text-xs text-marca-600 hover:underline">
                            Guardar
                          </button>
                        </form>
                      </td>
                      <td className="py-2 text-right">
                        <div className="flex justify-end gap-1">
                          {colegio.estado === "PENDIENTE_PAGO" && (
                            <BotonEstado colegioId={colegio.id} estado="ACTIVO" texto="Marcar como pagado" />
                          )}
                          {colegio.estado === "SUSPENDIDO" && (
                            <BotonEstado colegioId={colegio.id} estado="ACTIVO" texto="Reactivar" />
                          )}
                          {(colegio.estado === "ACTIVO" || colegio.estado === "PENDIENTE_PAGO") && (
                            <BotonEstado colegioId={colegio.id} estado="SUSPENDIDO" texto="Suspender" peligro />
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
    </div>
  );
}
