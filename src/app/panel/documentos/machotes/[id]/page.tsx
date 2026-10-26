import Link from "next/link";
import { notFound } from "next/navigation";
import { requerirRol } from "@/lib/auth";
import { db } from "@/lib/db";
import { camposExtraDe } from "@/lib/documentos/datos";
import { Alerta, Tarjeta } from "@/components/ui";
import { EditorMachote } from "./EditorMachote";

export const dynamic = "force-dynamic";

export default async function PaginaMachote({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ creado?: string }>;
}) {
  await requerirRol("ADMIN");
  const { id } = await params;
  const { creado } = await searchParams;
  const nuevo = id === "nuevo";
  const plantilla = nuevo ? null : await db.plantillaDocumento.findUnique({ where: { id: Number(id) || 0 } });
  if (!nuevo && !plantilla) notFound();
  const firmantes = await db.firmante.findMany({ where: { activo: true }, orderBy: { orden: "asc" } });

  return (
    <div className="space-y-6">
      <header>
        <Link href="/panel/documentos/machotes" className="text-sm text-marca-600 hover:underline">← Machotes</Link>
        <h1 className="mt-1 text-xl font-semibold text-slate-900">{plantilla?.nombre ?? "Machote nuevo"}</h1>
      </header>
      {creado && <Alerta tipo="exito">Machote creado. Ya aparece en la lista para generar.</Alerta>}
      <Tarjeta>
        <EditorMachote
          machote={{
            id: plantilla?.id ?? null,
            nombre: plantilla?.nombre ?? "",
            descripcion: plantilla?.descripcion ?? "",
            titulo: plantilla?.titulo ?? "",
            cuerpo: plantilla?.cuerpo ?? "[derecha]{{documento.ciudad_fecha}}\n\n**A QUIEN CORRESPONDA:**\n\n",
            categoria: plantilla?.categoria ?? "ALUMNO",
            camposExtra: plantilla ? camposExtraDe(plantilla.camposExtra) : [],
            prefijoFolio: plantilla?.prefijoFolio ?? "",
            firmanteId: plantilla?.firmanteId ?? null,
            alumnoPuedeSolicitar: plantilla?.alumnoPuedeSolicitar ?? false,
            activa: plantilla?.activa ?? true,
            delSistema: plantilla?.delSistema ?? false,
          }}
          firmantes={firmantes.map((f) => ({ id: f.id, etiqueta: `${f.nombre} · ${f.cargo}` }))}
        />
      </Tarjeta>
    </div>
  );
}
