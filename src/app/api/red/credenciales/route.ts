import { NextResponse } from "next/server";
import {
  firmar,
  firmaValida,
  momentoFresco,
  camposCredenciales,
} from "@/lib/red";

export const dynamic = "force-dynamic";

/// Entrega los datos de conexion de la base a otra computadora del colegio.
///
/// Solo contesta la computadora que tiene la base activa, y solo a quien firma
/// con la clave de red del colegio. La direccion no viaja aqui: la pone quien
/// pregunta, usando la direccion por la que alcanzo a esta computadora. Asi no
/// hay que adivinar cual de las tarjetas de red es la del colegio.

/// Nonces ya usados, para que una peticion grabada de la red no sirva dos
/// veces. Se acotan: esto vive en memoria y no puede crecer sin limite.
const usados = new Map<string, number>();
const TOPE_NONCES = 5000;

function nonceNuevo(nonce: string): boolean {
  const ahora = Date.now();
  for (const [clave, momento] of usados) {
    if (ahora - momento > 300_000) usados.delete(clave);
  }
  if (usados.has(nonce)) return false;
  if (usados.size >= TOPE_NONCES) return false;
  usados.set(nonce, ahora);
  return true;
}

function partes(url: string) {
  const u = new URL(url);
  return {
    usuario: decodeURIComponent(u.username),
    clave: decodeURIComponent(u.password),
    puerto: u.port || "5432",
    base: u.pathname.replace(/^\//, ""),
    parametros: u.search.replace(/^\?/, ""),
  };
}

export async function POST(peticion: Request) {
  const claveRed = process.env.CLAVE_RED || "";
  if (!claveRed) {
    return NextResponse.json(
      { error: "Esta instalacion no tiene clave de red configurada." },
      { status: 503 }
    );
  }
  // Una computadora que no tiene la base activa no reparte credenciales: si lo
  // hiciera, dos instalaciones podrian terminar apuntandose entre si.
  if (process.env.MANDA !== "1") {
    return NextResponse.json(
      { error: "Esta computadora no tiene la base activa." },
      { status: 409 }
    );
  }
  const urlBase = process.env.DATABASE_URL || "";
  if (!urlBase) {
    return NextResponse.json({ error: "Sin base configurada." }, { status: 503 });
  }

  let cuerpo: unknown;
  try {
    cuerpo = await peticion.json();
  } catch {
    return NextResponse.json({ error: "Peticion invalida." }, { status: 400 });
  }
  const { sitio, momento, nonce, firma } = (cuerpo ?? {}) as Record<string, unknown>;

  if (typeof sitio !== "string" || !sitio || typeof nonce !== "string" || nonce.length < 16) {
    return NextResponse.json({ error: "Peticion invalida." }, { status: 400 });
  }
  if (!momentoFresco(momento)) {
    return NextResponse.json({ error: "Peticion vencida." }, { status: 400 });
  }
  if (!firmaValida(firmar(claveRed, camposCredenciales(sitio, momento as number, nonce)), firma)) {
    return NextResponse.json({ error: "Firma invalida." }, { status: 403 });
  }
  if (!nonceNuevo(nonce)) {
    return NextResponse.json({ error: "Peticion repetida." }, { status: 409 });
  }

  let datos;
  try {
    datos = partes(urlBase);
  } catch {
    return NextResponse.json({ error: "Base mal configurada." }, { status: 500 });
  }

  return NextResponse.json(
    {
      ...datos,
      sitioQueManda: process.env.SITIO_ID || "",
      // Para que quien pregunta pueda comprobar que la respuesta viene de
      // quien comparte la clave, y no de un intermediario.
      firmaRespuesta: firmar(claveRed, ["respuesta", nonce, datos.base, datos.puerto]),
    },
    { status: 200, headers: { "cache-control": "no-store" } }
  );
}
