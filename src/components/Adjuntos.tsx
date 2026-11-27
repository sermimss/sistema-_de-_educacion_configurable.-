import { esImagen, tamanoLegible } from "@/lib/archivosEntrega";

export type Adjunto = { id: number; nombre: string; mime: string; tamano: number };

/// Archivos adjuntos: las imagenes se ven ahi mismo (clic para verlas en
/// grande) y los PDF y documentos aparecen como enlace para abrir o
/// descargar. `ruta` es la base de la descarga, por ejemplo /panel/avisos/archivo.
export function Adjuntos({ archivos, ruta }: { archivos: Adjunto[]; ruta: string }) {
  if (archivos.length === 0) return null;
  const imagenes = archivos.filter((a) => esImagen(a.mime));
  const otros = archivos.filter((a) => !esImagen(a.mime));
  return (
    <div className="mt-3 space-y-2" data-adjuntos>
      {imagenes.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {imagenes.map((a) => (
            <a key={a.id} href={`${ruta}/${a.id}`} target="_blank" rel="noopener noreferrer" title={a.nombre} data-adjunto-imagen={a.nombre}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`${ruta}/${a.id}`}
                alt={a.nombre}
                loading="lazy"
                className="h-32 max-w-[14rem] rounded-lg border border-slate-200 bg-white object-contain hover:opacity-90"
              />
            </a>
          ))}
        </div>
      )}
      {otros.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {otros.map((a) => (
            <li key={a.id}>
              <a
                href={`${ruta}/${a.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                data-adjunto={a.nombre}
              >
                📎 {a.nombre} <span className="text-slate-400">({tamanoLegible(a.tamano)})</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
