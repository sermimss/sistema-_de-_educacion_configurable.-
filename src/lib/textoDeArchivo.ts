import { inflateRawSync } from "node:zlib";

/// Saca el texto de un .txt o de un .docx de Word, sin librerias externas.
/// Del .docx se lee word/document.xml dentro del ZIP. Si el docente uso la
/// numeracion automatica de Word, el primer nivel se toma como pregunta
/// ("1.") y el segundo como opcion ("a)").

export const MAX_BYTES_EXAMEN = 2 * 1024 * 1024;

function decodificarTexto(datos: Uint8Array): string {
  const utf8 = new TextDecoder("utf-8").decode(datos);
  // El Bloc de notas de Windows a veces guarda en ANSI (Windows-1252).
  if (utf8.includes("�")) return new TextDecoder("windows-1252").decode(datos);
  return utf8.replace(/^﻿/, "");
}

/// Busca un archivo dentro de un ZIP usando el directorio central.
function leerDelZip(zip: Buffer, nombre: string): Buffer | null {
  // Fin del directorio central: firma 0x06054b50, en los ultimos ~64 KB.
  let fin = -1;
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 65_557); i--) {
    if (zip.readUInt32LE(i) === 0x06054b50) {
      fin = i;
      break;
    }
  }
  if (fin < 0) return null;
  const entradas = zip.readUInt16LE(fin + 10);
  let pos = zip.readUInt32LE(fin + 16);
  for (let n = 0; n < entradas && pos + 46 <= zip.length; n++) {
    if (zip.readUInt32LE(pos) !== 0x02014b50) return null;
    const metodo = zip.readUInt16LE(pos + 10);
    const comprimido = zip.readUInt32LE(pos + 20);
    const largoNombre = zip.readUInt16LE(pos + 28);
    const largoExtra = zip.readUInt16LE(pos + 30);
    const largoComentario = zip.readUInt16LE(pos + 32);
    const local = zip.readUInt32LE(pos + 42);
    const este = zip.toString("utf8", pos + 46, pos + 46 + largoNombre);
    if (este === nombre) {
      if (zip.readUInt32LE(local) !== 0x04034b50) return null;
      const inicio = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
      const datos = zip.subarray(inicio, inicio + comprimido);
      if (metodo === 0) return Buffer.from(datos);
      if (metodo === 8) return inflateRawSync(datos, { maxOutputLength: 20 * 1024 * 1024 });
      return null;
    }
    pos += 46 + largoNombre + largoExtra + largoComentario;
  }
  return null;
}

function decodificarXml(t: string): string {
  return t
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, "&");
}

function textoDeDocx(zip: Buffer): string | null {
  const xml = leerDelZip(zip, "word/document.xml")?.toString("utf8");
  if (!xml) return null;
  const contadores: number[] = [];
  const renglones: string[] = [];
  for (const parrafo of xml.split(/<\/w:p>/)) {
    const texto = decodificarXml(
      parrafo
        .replace(/<w:tab\/>/g, " ")
        .replace(/<w:br\/>/g, "\n")
        .replace(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<[^>]+>/g, (_, t) => t ?? "")
    );
    const nivel = /<w:numPr>[\s\S]*?<w:ilvl w:val="(\d+)"/.exec(parrafo);
    if (nivel && texto.trim()) {
      const n = Number(nivel[1]);
      contadores.length = n + 1;
      contadores[n] = (contadores[n] ?? 0) + 1;
      const yaNumerado = n === 0 ? /^\s*\d{1,3}\s*[.)]/.test(texto) : /^\s*\*?\s*[a-h]\s*[.)]/i.test(texto);
      if (!yaNumerado) {
        renglones.push(n === 0 ? `${contadores[0]}. ${texto.trim()}` : `${String.fromCharCode(96 + Math.min(contadores[n], 8))}) ${texto.trim()}`);
        continue;
      }
    }
    renglones.push(texto);
  }
  return renglones.join("\n");
}

export async function textoDeArchivo(archivo: File): Promise<{ ok: true; texto: string } | { ok: false; error: string }> {
  if (archivo.size > MAX_BYTES_EXAMEN) return { ok: false, error: "El archivo pesa mas de 2 MB." };
  const nombre = archivo.name.toLowerCase();
  const datos = Buffer.from(await archivo.arrayBuffer());
  if (nombre.endsWith(".txt")) {
    if (datos.subarray(0, 4096).includes(0)) return { ok: false, error: "Ese archivo no es de texto." };
    return { ok: true, texto: decodificarTexto(datos) };
  }
  if (nombre.endsWith(".docx")) {
    if (datos.readUInt32LE(0) !== 0x04034b50) return { ok: false, error: "Ese archivo no es un documento de Word (.docx) valido." };
    const texto = textoDeDocx(datos);
    if (texto == null) return { ok: false, error: "No pude leer el documento de Word. Copia el texto y pegalo en el recuadro." };
    return { ok: true, texto };
  }
  return { ok: false, error: "Sube un archivo .txt o .docx (o pega el texto en el recuadro)." };
}
