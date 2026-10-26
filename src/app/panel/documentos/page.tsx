import Link from "next/link";
import { requerirRol } from "@/lib/auth";
import { db } from "@/lib/db";
import { asegurarCatalogo } from "@/lib/documentos/datos";
import { Alerta, Tarjeta } from "@/components/ui";
import { ETIQUETA_CATEGORIA, Pestanas } from "./Pestanas";

export const dynamic = "force-dynamic";

export default async function PaginaDocumentos() {
  await requerirRol("ADMIN");
  await asegurarCatalogo();
  const [plantillas, pendientes, firmantes, institucion] = await Promise.all([
    db.plantillaDocumento.findMany({
      where: { activa: true },
      orderBy: [{ orden: "asc" }, { nombre: "asc" }],
      include: { firmante: true },
    }),
    db.solicitudDocumento.count({ where: { estado: "PENDIENTE" } }),
    db.firmante.count({ where: { activo: true } }),
    db.institucion.findUnique({ where: { id: 1 }, select: { logoArchivoId: true, logoUrl: true } }),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-slate-900">Documentos</h1>
        <p className="mt-1 text-sm text-slate-600">
          Constancias, oficios, pases y demas documentos con el logo y los colores del colegio.
        </p>
      </header>
      <Pestanas actual="/panel/documentos" pendientes={pendientes} />

      {!institucion?.logoArchivoId && !institucion?.logoUrl && (
        <Alerta tipo="aviso">
          Aun no hay logo del colegio. Subelo en{" "}
          <Link href="/panel/configuracion" className="font-medium underline">Configuracion</Link> y todos
          los documentos saldran con el.
        </Alerta>
      )}
      {firmantes === 0 && (
        <Alerta tipo="aviso">
          Aun no hay quien firme los documentos.{" "}
          <Link href="/panel/documentos/firmantes" className="font-medium underline">Agrega un firmante</Link>{" "}
          con su firma y sello.
        </Alerta>
      )}
      {pendientes > 0 && (
        <Alerta tipo="info">
          Hay {pendientes} solicitud(es) de alumnos esperando.{" "}
          <Link href="/panel/documentos/solicitudes" className="font-medium underline">Atenderlas</Link>
        </Alerta>
      )}

      {(["ALUMNO", "PERSONAL", "GENERAL"] as const).map((categoria) => {
        const lista = plantillas.filter((p) => p.categoria === categoria);
        if (lista.length === 0) return null;
        return (
          <Tarjeta key={categoria} titulo={`Documentos para ${ETIQUETA_CATEGORIA[categoria].toLowerCase()}`}>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {lista.map((p) => (
                <Link
                  key={p.id}
                  href={`/panel/documentos/generar/${p.id}`}
                  className="rounded-lg border border-slate-200 p-3 transition hover:border-marca-600 hover:bg-marca-50"
                >
                  <p className="text-sm font-medium text-slate-900">{p.nombre}</p>
                  {p.descripcion && <p className="mt-0.5 text-xs text-slate-500">{p.descripcion}</p>}
                  <p className="mt-2 text-[11px] text-slate-400">
                    Folio {p.prefijoFolio} · {p.firmante ? `firma ${p.firmante.nombre}` : "sin firmante"}
                  </p>
                </Link>
              ))}
            </div>
          </Tarjeta>
        );
      })}
    </div>
  );
}
