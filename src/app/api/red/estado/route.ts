import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/// Dice el papel de esta computadora dentro de la red del colegio. Sirve para
/// que el personal sepa cual tiene la base activa sin abrir una terminal.
export async function GET() {
  return NextResponse.json(
    {
      sitio: process.env.SITIO_ID || "",
      manda: process.env.MANDA === "1",
      redConfigurada: Boolean(process.env.CLAVE_RED),
      sitioQueManda: process.env.SITIO_QUE_MANDA || (process.env.MANDA === "1" ? process.env.SITIO_ID || "" : ""),
    },
    { status: 200, headers: { "cache-control": "no-store" } }
  );
}
