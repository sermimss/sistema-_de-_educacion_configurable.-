// Primitivas del protocolo de red local del colegio.
//
// Es el gemelo de src/lib/red.ts: el descubridor corre como proceso aparte y no
// puede importar TypeScript. pruebas/red.mjs verifica que las dos
// implementaciones firmen exactamente igual, para que no se separen con el
// tiempo.

import { createHmac, timingSafeEqual } from "node:crypto";

export const PUERTO_DESCUBRIMIENTO = 47808;
export const VERSION_PROTOCOLO = 1;
export const MARGEN_MS = 120_000;

function canonica(campos) {
  return campos
    .map((c) => {
      const texto = String(c);
      if (texto.includes("|")) throw new Error("campo invalido en firma de red");
      return texto;
    })
    .join("|");
}

export function firmar(claveRed, campos) {
  return createHmac("sha256", claveRed).update(canonica(campos)).digest("hex");
}

export function firmaValida(esperada, recibida) {
  if (typeof recibida !== "string" || recibida.length !== esperada.length) return false;
  try {
    return timingSafeEqual(Buffer.from(esperada, "hex"), Buffer.from(recibida, "hex"));
  } catch {
    return false;
  }
}

export function momentoFresco(momento, ahora = Date.now()) {
  return typeof momento === "number" && Number.isFinite(momento) && Math.abs(ahora - momento) <= MARGEN_MS;
}

export function camposCredenciales(sitio, momento, nonce) {
  return ["credenciales", sitio, momento, nonce];
}

export function camposAnuncio(a, nonce) {
  return ["anuncio", a.sitio, a.puerto, a.manda, a.instalado, a.version, a.momento, nonce];
}

export function camposSondeo(nonce, momento) {
  return ["busco", nonce, momento];
}
