import { requerirRol } from "@/lib/auth";
import { db } from "@/lib/db";
import { imagenIncrustada } from "@/lib/marca";
import { Tarjeta } from "@/components/ui";
import { Pestanas } from "../Pestanas";
import { FormularioFirmante } from "./Formularios";

export const dynamic = "force-dynamic";

export default async function PaginaFirmantes() {
  await requerirRol("ADMIN");
  const [firmantes, pendientes] = await Promise.all([
    db.firmante.findMany({ orderBy: [{ activo: "desc" }, { orden: "asc" }, { id: "asc" }] }),
    db.solicitudDocumento.count({ where: { estado: "PENDIENTE" } }),
  ]);
  const conImagenes = await Promise.all(
    firmantes.map(async (f) => ({
      id: f.id,
      nombre: f.nombre,
      cargo: f.cargo,
      activo: f.activo,
      firma: await imagenIncrustada(f.firmaId),
      sello: await imagenIncrustada(f.selloId),
    }))
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-slate-900">Documentos</h1>
      </header>
      <Pestanas actual="/panel/documentos/firmantes" pendientes={pendientes} />
      <Tarjeta titulo="Nuevo firmante" descripcion="Quien firma los documentos, con la imagen de su firma y el sello.">
        <FormularioFirmante />
      </Tarjeta>
      {conImagenes.map((f) => (
        <Tarjeta key={f.id} titulo={`${f.nombre} · ${f.cargo}`}>
          <FormularioFirmante firmante={f} />
        </Tarjeta>
      ))}
    </div>
  );
}
