import { NextResponse } from "next/server";
import { sesionActual } from "@/lib/auth";
import { generarCsv } from "@/lib/csv";
import { COLUMNAS, EJEMPLO_PLANTILLA, ORDEN_PLANTILLA } from "@/lib/importacion";

export const dynamic = "force-dynamic";

export async function GET(peticion: Request) {
  const sesion = await sesionActual();
  if (!sesion || sesion.rol !== "ADMIN") {
    return new NextResponse("No autorizado", { status: 403 });
  }

  const tipo = new URL(peticion.url).searchParams.get("tipo") ?? "alumnos";
  if (!COLUMNAS[tipo]) return new NextResponse("Tipo no reconocido", { status: 400 });

  const csv = generarCsv(ORDEN_PLANTILLA[tipo], [EJEMPLO_PLANTILLA[tipo]]);

  // El BOM hace que Excel abra el archivo con acentos correctos.
  return new NextResponse(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="plantilla-${tipo}.csv"`,
    },
  });
}
