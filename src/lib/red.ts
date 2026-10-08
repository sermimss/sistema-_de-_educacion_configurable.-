/// Red local del colegio.
///
/// El sistema se instala en varias computadoras del colegio y cada una trae su
/// propia base de datos, lista para funcionar sola. Pero si dos estan en la
/// misma red no pueden escribir cada una en su base: se duplicarian los folios
/// de recibo y el mismo alumno tendria dos saldos distintos. Asi que en una red
/// solo UNA base esta activa, y las demas computadoras sirven el sistema contra
/// esa. Cualquiera puede ser la que manda; no hay que designar un servidor.
///
/// Las instalaciones se reconocen por una "clave de red" que el colegio define
/// una sola vez. Sin ella, cualquier aparato conectado al WiFi podria decir
/// "yo soy la base del colegio" y quedarse con las contrasenas o mandar a todos
/// a un sistema falso. Todo anuncio va firmado con esa clave.
///
/// Las mismas primitivas estan en scripts/protocolo-red.mjs, porque el
/// descubridor corre como proceso aparte y no puede importar TypeScript.
/// pruebas/red.mjs verifica que las dos implementaciones firmen igual.

import { createHmac, timingSafeEqual } from "node:crypto";

/// Puerto de descubrimiento. Esta en el rango privado y no lo usa ningun
/// servicio conocido.
export const PUERTO_DESCUBRIMIENTO = 47808;

export const VERSION_PROTOCOLO = 1;

/// Margen de tiempo aceptado entre computadoras. Los relojes de la red del
/// colegio no estan sincronizados al segundo.
export const MARGEN_MS = 120_000;

export type Anuncio = {
  sitio: string;
  puerto: number;
  manda: boolean;
  instalado: boolean;
  version: string;
  momento: number;
};

/// Cadena canonica a firmar. El orden es fijo y ningun campo puede traer "|",
/// para que dos mensajes distintos no puedan producir la misma cadena.
function canonica(campos: (string | number | boolean)[]): string {
  return campos
    .map((c) => {
      const texto = String(c);
      if (texto.includes("|")) throw new Error("campo invalido en firma de red");
      return texto;
    })
    .join("|");
}

export function firmar(claveRed: string, campos: (string | number | boolean)[]): string {
  return createHmac("sha256", claveRed).update(canonica(campos)).digest("hex");
}

/// Comparacion en tiempo constante: comparar firmas con === filtra informacion
/// sobre la clave segun cuanto tarda en fallar.
export function firmaValida(esperada: string, recibida: unknown): boolean {
  if (typeof recibida !== "string" || recibida.length !== esperada.length) return false;
  try {
    return timingSafeEqual(Buffer.from(esperada, "hex"), Buffer.from(recibida, "hex"));
  } catch {
    return false;
  }
}

export function momentoFresco(momento: unknown, ahora = Date.now()): boolean {
  return typeof momento === "number" && Number.isFinite(momento) && Math.abs(ahora - momento) <= MARGEN_MS;
}

/// Campos que firma quien pide las credenciales de la base.
export function camposCredenciales(sitio: string, momento: number, nonce: string) {
  return ["credenciales", sitio, momento, nonce];
}

/// Campos que firma quien contesta un sondeo de descubrimiento.
export function camposAnuncio(a: Anuncio, nonce: string) {
  return ["anuncio", a.sitio, a.puerto, a.manda, a.instalado, a.version, a.momento, nonce];
}

/// Campos que firma quien lanza un sondeo. Tambien va firmado para que una
/// instalacion no revele su puerto ni su version a cualquier aparato de la red:
/// solo contesta a quien ya comparte la clave del colegio.
export function camposSondeo(nonce: string, momento: number) {
  return ["busco", nonce, momento];
}
