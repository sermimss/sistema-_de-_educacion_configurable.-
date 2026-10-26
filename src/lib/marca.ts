import type { Institucion } from "@prisma/client";
import { colegioActual } from "./colegio";
import { db } from "./db";

/// Identidad visual del colegio: logo y colores, para la interfaz y los
/// documentos impresos.

export const COLOR_PRIMARIO_PREDETERMINADO = "#1d4ed8";
export const COLOR_SECUNDARIO_PREDETERMINADO = "#0f172a";

export function colorValido(valor: unknown): valor is string {
  return typeof valor === "string" && /^#[0-9a-fA-F]{6}$/.test(valor);
}

function luminancia(hex: string): number {
  const canal = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(1) + 0.7152 * canal(3) + 0.0722 * canal(5);
}

/// Texto que se lee sobre un color: blanco sobre colores oscuros y casi negro
/// sobre colores claros (un amarillo o un verde limon con letra blanca no se lee).
export function colorDeTextoSobre(fondo: string): string {
  if (!colorValido(fondo)) return "#ffffff";
  const l = luminancia(fondo);
  const contrasteBlanco = 1.05 / (l + 0.05);
  const contrasteOscuro = (l + 0.05) / (luminancia("#0f172a") + 0.05);
  return contrasteBlanco >= contrasteOscuro ? "#ffffff" : "#0f172a";
}

/// Variables CSS de la marca, para el atributo style de <body> o de un documento.
export function variablesDeMarca(institucion: Pick<Institucion, "colorPrimario" | "colorSecundario"> | null) {
  const primario = colorValido(institucion?.colorPrimario)
    ? institucion.colorPrimario
    : COLOR_PRIMARIO_PREDETERMINADO;
  const secundario = colorValido(institucion?.colorSecundario)
    ? institucion.colorSecundario
    : COLOR_SECUNDARIO_PREDETERMINADO;
  return {
    "--marca-base": primario,
    "--marca-contraste": colorDeTextoSobre(primario),
    "--marca-sec": secundario,
    "--marca-sec-contraste": colorDeTextoSobre(secundario),
  } as Record<string, string>;
}

/// Direccion de la imagen del logo, o null si el colegio no tiene. El logo
/// subido manda sobre la direccion escrita a mano (la de versiones anteriores).
export async function urlLogo(
  institucion: Pick<Institucion, "logoArchivoId" | "logoUrl"> | null
): Promise<string | null> {
  if (!institucion) return null;
  if (institucion.logoArchivoId) {
    const colegio = await colegioActual();
    const parametros = new URLSearchParams({ v: String(institucion.logoArchivoId) });
    if (colegio) parametros.set("c", String(colegio.id));
    return `/api/marca/logo?${parametros}`;
  }
  return institucion.logoUrl || null;
}

/// Tipos de imagen aceptados. SVG no: puede llevar codigo dentro.
const FIRMAS_DE_IMAGEN: { mime: string; prueba: (b: Buffer) => boolean }[] = [
  { mime: "image/png", prueba: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { mime: "image/jpeg", prueba: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: "image/webp", prueba: (b) => b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP" },
];

export const TAMANO_MAXIMO_IMAGEN = 2 * 1024 * 1024;

export type ImagenLeida =
  | { ok: true; mime: string; datos: Uint8Array<ArrayBuffer>; nombre: string }
  | { ok: false; error: string };

/// Lee una imagen subida y comprueba por su contenido (no por su nombre) que
/// de verdad sea PNG, JPG o WebP.
export async function leerImagenSubida(archivo: FormDataEntryValue | null): Promise<ImagenLeida | null> {
  if (!archivo || typeof archivo === "string" || archivo.size === 0) return null;
  if (archivo.size > TAMANO_MAXIMO_IMAGEN) {
    return { ok: false, error: "La imagen pesa mas de 2 MB. Usa una mas ligera." };
  }
  const datos = new Uint8Array(await archivo.arrayBuffer());
  const tipo = FIRMAS_DE_IMAGEN.find((f) => f.prueba(Buffer.from(datos.buffer)));
  if (!tipo) return { ok: false, error: "La imagen debe ser PNG, JPG o WebP." };
  return { ok: true, mime: tipo.mime, datos, nombre: archivo.name.slice(0, 120) };
}

/// Imagen guardada como data: URI, para incrustar firmas y sellos en un
/// documento sin publicarlos en una direccion.
export async function imagenIncrustada(id: number | null | undefined): Promise<string | null> {
  if (!id) return null;
  const archivo = await db.archivoInstitucional.findUnique({ where: { id } });
  if (!archivo) return null;
  return `data:${archivo.mime};base64,${Buffer.from(archivo.datos).toString("base64")}`;
}

/// Datos del membrete para la hoja de un documento.
export async function marcaParaHoja(institucion: Institucion | null) {
  return {
    nombre: institucion?.nombre ?? "",
    lema: institucion?.lema ?? null,
    claveCentroTrabajo: institucion?.claveCentroTrabajo ?? null,
    direccion: [institucion?.direccion, institucion?.ciudad, institucion?.estado].filter(Boolean).join(", ") || null,
    telefono: institucion?.telefono ?? null,
    email: institucion?.email ?? null,
    logo: await urlLogo(institucion),
    colorPrimario: colorValido(institucion?.colorPrimario) ? institucion.colorPrimario : COLOR_PRIMARIO_PREDETERMINADO,
    colorSecundario: colorValido(institucion?.colorSecundario)
      ? institucion.colorSecundario
      : COLOR_SECUNDARIO_PREDETERMINADO,
  };
}
