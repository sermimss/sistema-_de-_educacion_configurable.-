import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/// Verificacion de salud para el servicio de hospedaje. Siempre responde 200
/// si el proceso vive; el cuerpo dice si la base contesta y si el colegio ya
/// completo el asistente de instalacion.
export async function GET() {
  let baseDeDatos: "ok" | "sin-conexion" = "sin-conexion";
  let instalado = false;

  try {
    const institucion = await db.institucion.findUnique({
      where: { id: 1 },
      select: { instalado: true },
    });
    baseDeDatos = "ok";
    instalado = Boolean(institucion?.instalado);
  } catch {
    baseDeDatos = "sin-conexion";
  }

  return NextResponse.json(
    { ok: true, baseDeDatos, instalado, fecha: new Date().toISOString() },
    { status: 200 }
  );
}
