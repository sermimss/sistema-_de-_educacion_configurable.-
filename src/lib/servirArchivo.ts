import { esImagen } from "./archivosEntrega";

/// Respuesta para descargar o mostrar un archivo guardado en la base. Las
/// imagenes y los PDF se abren en el navegador; lo demas se descarga. Los
/// tipos ya se validaron por su contenido al subirse (no hay HTML ni SVG).
export function respuestaArchivo(archivo: { nombre: string; mime: string; tamano: number; datos: Uint8Array }) {
  const enLinea = esImagen(archivo.mime) || archivo.mime === "application/pdf";
  const ascii = archivo.nombre.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "");
  return new Response(new Uint8Array(archivo.datos), {
    headers: {
      "Content-Type": archivo.mime,
      "Content-Length": String(archivo.tamano),
      "Content-Disposition": `${enLinea ? "inline" : "attachment"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(archivo.nombre)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
