import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/// Tope para la consulta de prueba. La verificacion de salud tiene que
/// contestar rapido SIEMPRE: si se quedara esperando a una base caida, el
/// hospedaje daria el servicio por muerto y lo reiniciaria en ciclo, que es
/// justo lo que produce un 502 permanente.
const TOPE_MS = 2000;

async function revisarBase(): Promise<"ok" | "sin-conexion" | "lenta"> {
  try {
    const consulta = db.$queryRaw`SELECT 1`;
    const resultado = await Promise.race([
      consulta.then(() => "ok" as const),
      new Promise<"lenta">((resolver) => setTimeout(() => resolver("lenta"), TOPE_MS)),
    ]);
    return resultado;
  } catch {
    return "sin-conexion";
  }
}

export async function GET() {
  const baseDeDatos = await revisarBase();

  let instalado = false;
  if (baseDeDatos === "ok") {
    try {
      const institucion = await db.institucion.findUnique({
        where: { id: 1 },
        select: { instalado: true },
      });
      instalado = Boolean(institucion?.instalado);
    } catch {
      // La tabla puede no existir todavia si faltan migraciones.
    }
  }

  // Siempre 200 mientras el proceso viva: el cuerpo dice como esta la base.
  return NextResponse.json(
    { ok: true, baseDeDatos, instalado, fecha: new Date().toISOString() },
    { status: 200 }
  );
}
