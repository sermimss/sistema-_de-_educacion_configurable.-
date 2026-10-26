import Link from "next/link";
import { requerirRol } from "@/lib/auth";
import { db } from "@/lib/db";
import { asegurarCatalogo } from "@/lib/documentos/datos";
import { Insignia, Tarjeta } from "@/components/ui";
import { ETIQUETA_CATEGORIA, Pestanas } from "../Pestanas";
import { FormularioFirmanteParaTodos } from "../firmantes/Formularios";

export const dynamic = "force-dynamic";

export default async function PaginaMachotes() {
  await requerirRol("ADMIN");
  await asegurarCatalogo();
  const [plantillas, pendientes, firmantes] = await Promise.all([
    db.plantillaDocumento.findMany({ orderBy: [{ orden: "asc" }, { nombre: "asc" }], include: { firmante: true } }),
    db.solicitudDocumento.count({ where: { estado: "PENDIENTE" } }),
    db.firmante.findMany({ where: { activo: true }, orderBy: { orden: "asc" } }),
  ]);
  const sinFirmante = plantillas.filter((p) => !p.firmanteId).length;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-900">Documentos</h1>
        <Link
          href="/panel/documentos/machotes/nuevo"
          className="rounded-lg bg-marca-600 px-4 py-2 text-sm font-medium text-marca-contraste hover:bg-marca-700"
        >
          Crear machote propio
        </Link>
      </header>
      <Pestanas actual="/panel/documentos/machotes" pendientes={pendientes} />

      {/* Se queda visible aunque ya no falte ninguno: si desapareciera al
          asignar, se llevaria el aviso de cuantos se asignaron. */}
      {firmantes.length > 0 && (
        <Tarjeta
          titulo="Firmante para los que no tienen"
          descripcion={sinFirmante ? `${sinFirmante} machote(s) sin firmante` : "Todos los machotes tienen firmante"}
        >
          <FormularioFirmanteParaTodos firmantes={firmantes.map((f) => ({ id: f.id, etiqueta: `${f.nombre} · ${f.cargo}` }))} />
        </Tarjeta>
      )}

      <Tarjeta titulo="Machotes" descripcion="Edita la redaccion, los datos que se piden al generar y quien firma.">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="pb-2 pr-4 font-medium">Machote</th>
                <th className="pb-2 pr-4 font-medium">Para</th>
                <th className="pb-2 pr-4 font-medium">Firma</th>
                <th className="pb-2 pr-4 font-medium">Alumnos lo piden</th>
                <th className="pb-2 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {plantillas.map((p) => (
                <tr key={p.id} className={p.activa ? "" : "opacity-50"}>
                  <td className="py-2 pr-4">
                    <span className="font-medium text-slate-800">{p.nombre}</span>
                    {!p.delSistema && <span className="ml-2"><Insignia>propio</Insignia></span>}
                    {!p.activa && <span className="ml-2"><Insignia tono="neutro">desactivado</Insignia></span>}
                  </td>
                  <td className="py-2 pr-4 text-slate-600">{ETIQUETA_CATEGORIA[p.categoria]}</td>
                  <td className="py-2 pr-4 text-slate-600">{p.firmante?.nombre ?? "—"}</td>
                  <td className="py-2 pr-4 text-slate-600">{p.alumnoPuedeSolicitar ? "si" : "no"}</td>
                  <td className="py-2 text-right">
                    <Link href={`/panel/documentos/machotes/${p.id}`} className="font-medium text-marca-600 hover:underline">
                      Editar
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Tarjeta>
    </div>
  );
}
