"use client";

import { useEffect, useRef, useState } from "react";
import { EXTENSIONES_ACEPTADAS, MAX_ARCHIVOS, tamanoLegible } from "@/lib/archivosEntrega";

const MAX_BYTES = 10 * 1024 * 1024;
const EXTENSIONES = EXTENSIONES_ACEPTADAS.split(",").map((e) => e.slice(1));
const EXTENSION_DE_MIME: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp" };

/// Nombre para una captura pegada: captura-2026-11-27-1530.png
function nombreCaptura(tipo: string, indice: number) {
  const d = new Date();
  const dos = (n: number) => String(n).padStart(2, "0");
  const sello = `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}-${dos(d.getHours())}${dos(d.getMinutes())}${dos(d.getSeconds())}`;
  return `captura-${sello}${indice ? `-${indice + 1}` : ""}.${EXTENSION_DE_MIME[tipo] ?? "png"}`;
}

/// Elegir archivos, arrastrarlos o pegar una captura (Ctrl+V) en cualquier
/// parte del formulario. Los archivos viajan en el campo `name` del
/// formulario como si se hubieran elegido con el boton.
export function SelectorArchivos({
  name = "archivos",
  etiqueta,
  maximo = MAX_ARCHIVOS,
  ayuda = "Imagenes (capturas incluidas), PDF, Word, Excel, PowerPoint o texto; 10 MB cada uno.",
}: {
  name?: string;
  etiqueta: string;
  maximo?: number;
  ayuda?: string;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const zona = useRef<HTMLDivElement>(null);
  const [archivos, setArchivos] = useState<File[]>([]);
  const [aviso, setAviso] = useState("");
  const [encima, setEncima] = useState(false);

  // Si se eligieron archivos antes de que la pagina terminara de cargar, se toman.
  useEffect(() => {
    const previos = [...(entrada.current?.files ?? [])];
    if (previos.length) agregar(previos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // El campo real del formulario refleja siempre la lista.
  useEffect(() => {
    if (!entrada.current) return;
    const dt = new DataTransfer();
    archivos.forEach((a) => dt.items.add(a));
    entrada.current.files = dt.files;
  }, [archivos]);

  function agregar(nuevos: File[]) {
    const rechazados: string[] = [];
    const validos = nuevos.filter((a) => {
      const ext = a.name.toLowerCase().split(".").pop() ?? "";
      if (!EXTENSIONES.includes(ext)) rechazados.push(`${a.name}: tipo no permitido`);
      else if (a.size > MAX_BYTES) rechazados.push(`${a.name}: pesa mas de 10 MB`);
      else return true;
      return false;
    });
    const juntos = [...archivos, ...validos];
    if (juntos.length > maximo) rechazados.push(`Maximo ${maximo} archivos: se dejaron los primeros ${maximo}`);
    setArchivos(juntos.slice(0, maximo));
    setAviso(rechazados.join(" · "));
  }

  // Archivos elegidos con el boton: se escucha el evento del navegador (React
  // ignora una segunda eleccion si el primer archivo se llama igual). Lo
  // elegido se suma a lo que ya estaba (el navegador lo reemplazaria).
  useEffect(() => {
    const campo = entrada.current;
    if (!campo) return;
    const alElegir = () => {
      const elegidos = [...(campo.files ?? [])].filter((f) => !archivos.includes(f));
      if (elegidos.length) agregar(elegidos);
      else {
        const dt = new DataTransfer();
        archivos.forEach((a) => dt.items.add(a));
        campo.files = dt.files;
      }
    };
    campo.addEventListener("change", alElegir);
    return () => campo.removeEventListener("change", alElegir);
  });

  // Pegar una captura en cualquier parte del formulario; limpiar al reiniciarlo.
  useEffect(() => {
    const formulario = zona.current?.closest("form");
    if (!formulario) return;
    const alPegar = (e: ClipboardEvent) => {
      const imagenes = [...(e.clipboardData?.items ?? [])]
        .filter((item) => item.kind === "file")
        .map((item) => item.getAsFile())
        .filter((f): f is File => Boolean(f));
      if (imagenes.length === 0) return;
      e.preventDefault();
      agregar(
        imagenes.map((f, i) =>
          f.name && f.name !== "image.png" ? f : new File([f], nombreCaptura(f.type, i), { type: f.type || "image/png" })
        )
      );
    };
    const alReiniciar = () => {
      setArchivos([]);
      setAviso("");
    };
    formulario.addEventListener("paste", alPegar);
    formulario.addEventListener("reset", alReiniciar);
    return () => {
      formulario.removeEventListener("paste", alPegar);
      formulario.removeEventListener("reset", alReiniciar);
    };
  });

  const id = `${name}-${etiqueta.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <div data-selector-archivos>
      <label className="etiqueta-campo" htmlFor={id}>
        {etiqueta} <span className="font-normal text-slate-500">(opcional, hasta {maximo})</span>
      </label>
      <div
        ref={zona}
        tabIndex={0}
        onDragOver={(e) => {
          e.preventDefault();
          setEncima(true);
        }}
        onDragLeave={() => setEncima(false)}
        onDrop={(e) => {
          e.preventDefault();
          setEncima(false);
          agregar([...e.dataTransfer.files]);
        }}
        className={`rounded-lg border border-dashed p-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-marca-500 ${encima ? "border-marca-500 bg-marca-50" : "border-slate-300 bg-slate-50/60"}`}
      >
        <div className="flex flex-wrap items-center gap-2 text-slate-600">
          <button
            type="button"
            onClick={() => entrada.current?.click()}
            className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Elegir archivos
          </button>
          <span className="text-xs">o arrastralos aqui, o pega una captura con Ctrl+V</span>
        </div>
        {/* El campo real: tambien acepta archivos elegidos directamente. */}
        <input
          id={id}
          ref={entrada}
          type="file"
          name={name}
          multiple
          accept={EXTENSIONES_ACEPTADAS}
          className="sr-only"
        />
        {archivos.length > 0 && (
          <ul className="mt-2 space-y-1" data-archivos-elegidos>
            {archivos.map((a, i) => (
              <li key={`${a.name}-${i}`} className="flex items-center justify-between gap-2 rounded bg-white px-2 py-1 text-xs text-slate-700">
                <span className="truncate">
                  {a.name} <span className="text-slate-400">({tamanoLegible(a.size)})</span>
                </span>
                <button
                  type="button"
                  onClick={() => setArchivos((actuales) => actuales.filter((_, j) => j !== i))}
                  className="shrink-0 text-slate-400 hover:text-red-600"
                  aria-label={`Quitar ${a.name}`}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {aviso && <p className="mt-1 text-xs text-red-600">{aviso}</p>}
      <p className="mt-1 text-xs text-slate-500">{ayuda}</p>
    </div>
  );
}
