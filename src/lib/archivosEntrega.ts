/// Archivos que se suben (entregas de tareas, material de tareas y adjuntos
/// de avisos): se aceptan documentos de Office, PDF, texto e imagenes
/// (capturas de pantalla incluidas), revisando el contenido y no solo la
/// extension, para que nadie suba un programa disfrazado de documento.

export const MAX_ARCHIVOS = 5;
export const MAX_BYTES = 10 * 1024 * 1024;
export const EXTENSIONES_ACEPTADAS = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.png,.jpg,.jpeg,.gif,.webp";

type Formato = { mime: string; firma: (b: Uint8Array) => boolean };

const empieza = (b: Uint8Array, bytes: number[]) => bytes.every((x, i) => b[i] === x);
const ZIP = (b: Uint8Array) => empieza(b, [0x50, 0x4b, 0x03, 0x04]);
const OLE = (b: Uint8Array) => empieza(b, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);

const FORMATOS: Record<string, Formato> = {
  pdf: { mime: "application/pdf", firma: (b) => empieza(b, [0x25, 0x50, 0x44, 0x46]) },
  docx: { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", firma: ZIP },
  xlsx: { mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", firma: ZIP },
  pptx: { mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation", firma: ZIP },
  doc: { mime: "application/msword", firma: OLE },
  xls: { mime: "application/vnd.ms-excel", firma: OLE },
  ppt: { mime: "application/vnd.ms-powerpoint", firma: OLE },
  png: { mime: "image/png", firma: (b) => empieza(b, [0x89, 0x50, 0x4e, 0x47]) },
  jpg: { mime: "image/jpeg", firma: (b) => empieza(b, [0xff, 0xd8, 0xff]) },
  jpeg: { mime: "image/jpeg", firma: (b) => empieza(b, [0xff, 0xd8, 0xff]) },
  gif: { mime: "image/gif", firma: (b) => empieza(b, [0x47, 0x49, 0x46, 0x38]) },
  webp: { mime: "image/webp", firma: (b) => empieza(b, [0x52, 0x49, 0x46, 0x46]) && empieza(b.subarray(8), [0x57, 0x45, 0x42, 0x50]) },
  // Texto: sin bytes nulos en el inicio.
  txt: { mime: "text/plain; charset=utf-8", firma: (b) => !b.subarray(0, 4096).includes(0) },
};

export type ArchivoValidado = { nombre: string; mime: string; tamano: number; datos: Uint8Array<ArrayBuffer> };

/// Nombre seguro para guardar y para descargar.
export function nombreLimpio(nombre: string): string {
  const base = nombre.split(/[\\/]/).pop() ?? "archivo";
  return base.replace(/[^\p{L}\p{N} ._()-]/gu, "_").replace(/\s+/g, " ").trim().slice(0, 120) || "archivo";
}

export async function validarArchivos(
  archivos: File[],
  maximo = MAX_ARCHIVOS
): Promise<{ ok: true; archivos: ArchivoValidado[] } | { ok: false; error: string }> {
  const reales = archivos.filter((a) => a && a.size > 0);
  if (reales.length > maximo) return { ok: false, error: `Puedes subir hasta ${maximo} archivos.` };
  const validados: ArchivoValidado[] = [];
  for (const archivo of reales) {
    const nombre = nombreLimpio(archivo.name);
    if (archivo.size > MAX_BYTES) return { ok: false, error: `${nombre} pesa mas de 10 MB.` };
    const extension = nombre.toLowerCase().split(".").pop() ?? "";
    const formato = FORMATOS[extension];
    if (!formato) return { ok: false, error: `${nombre}: solo se aceptan PDF, Word, Excel, PowerPoint, texto o imagenes.` };
    const datos = new Uint8Array(await archivo.arrayBuffer());
    if (!formato.firma(datos)) return { ok: false, error: `${nombre} no es realmente un archivo .${extension}.` };
    validados.push({ nombre, mime: formato.mime, tamano: datos.length, datos });
  }
  return { ok: true, archivos: validados };
}

/// Los archivos de un formulario (campo "archivos").
export function archivosDelFormulario(formData: FormData, campo = "archivos"): File[] {
  return formData.getAll(campo).filter((a): a is File => a instanceof File && a.size > 0);
}

export const esImagen = (mime: string) => mime.startsWith("image/");

export function tamanoLegible(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
