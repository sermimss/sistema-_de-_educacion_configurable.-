"use client";

import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import type { TipoPregunta } from "@prisma/client";
import { accionEnviarExamen, guardarRespuesta } from "./acciones";

export type PreguntaParaContestar = {
  id: number;
  tipo: TipoPregunta;
  enunciado: string;
  puntos: number;
  opciones: { id: number; texto: string }[];
};

type Respuesta = { opciones: number[]; texto: string };

function reloj(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const dos = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${dos(m)}:${dos(s)}` : `${dos(m)}:${dos(s)}`;
}

/// Pantalla para contestar: cada respuesta se guarda sola al momento; con
/// tiempo limite, al llegar a cero se envia con lo que lleve.
export function ContestarExamen({
  intentoId,
  preguntas,
  guardadas,
  msRestantes,
}: {
  intentoId: number;
  preguntas: PreguntaParaContestar[];
  guardadas: Record<number, Respuesta>;
  msRestantes: number | null;
}) {
  const [respuestas, setRespuestas] = useState<Record<number, Respuesta>>(guardadas);
  const [estadoGuardado, setEstadoGuardado] = useState<"" | "guardando" | "guardado" | "error">("");
  const [mensajeError, setMensajeError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [restante, setRestante] = useState(msRestantes);
  const pendientes = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const enVuelo = useRef(new Set<Promise<unknown>>());
  const actuales = useRef(respuestas);
  actuales.current = respuestas;

  const guardar = useCallback(
    (preguntaId: number) => {
      const r = actuales.current[preguntaId] ?? { opciones: [], texto: "" };
      setEstadoGuardado("guardando");
      const promesa = guardarRespuesta(intentoId, preguntaId, r.opciones, r.texto)
        .then((res) => {
          if (res.ok) setEstadoGuardado("guardado");
          else {
            setEstadoGuardado("error");
            setMensajeError(res.error ?? "No se pudo guardar.");
          }
        })
        .catch(() => {
          setEstadoGuardado("error");
          setMensajeError("Sin conexion: tu respuesta no se guardo. Revisa tu internet.");
        });
      enVuelo.current.add(promesa);
      promesa.finally(() => enVuelo.current.delete(promesa));
    },
    [intentoId]
  );

  const cambiar = (preguntaId: number, r: Respuesta, demora = 0) => {
    setRespuestas((prev) => ({ ...prev, [preguntaId]: r }));
    actuales.current = { ...actuales.current, [preguntaId]: r };
    clearTimeout(pendientes.current.get(preguntaId));
    pendientes.current.set(preguntaId, setTimeout(() => {
      pendientes.current.delete(preguntaId);
      guardar(preguntaId);
    }, demora));
  };

  const enviar = useCallback(async () => {
    if (enviando) return;
    setEnviando(true);
    // Primero se guarda lo que estuviera por guardarse.
    for (const [preguntaId, t] of pendientes.current) {
      clearTimeout(t);
      guardar(preguntaId);
    }
    pendientes.current.clear();
    await Promise.allSettled([...enVuelo.current]);
    const datos = new FormData();
    datos.set("intentoId", String(intentoId));
    startTransition(() => accionEnviarExamen(datos));
  }, [enviando, guardar, intentoId]);

  // Reloj: al llegar a cero se envia solo.
  useEffect(() => {
    if (msRestantes == null) return;
    const fin = Date.now() + msRestantes;
    const reloj = setInterval(() => {
      const quedan = fin - Date.now();
      setRestante(quedan);
      if (quedan <= 0) {
        clearInterval(reloj);
        void enviar();
      }
    }, 500);
    return () => clearInterval(reloj);
  }, [msRestantes, enviar]);

  const contestadas = preguntas.filter((p) => {
    const r = respuestas[p.id];
    return r && (r.opciones.length > 0 || r.texto.trim());
  }).length;

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white/95 px-4 py-2 text-sm shadow-sm backdrop-blur">
        <span className="text-slate-600">
          {contestadas} de {preguntas.length} contestadas
          <span className="ml-2 text-xs text-slate-400" data-estado-guardado={estadoGuardado}>
            {estadoGuardado === "guardando" ? "Guardando..." : estadoGuardado === "guardado" ? "Respuestas guardadas" : ""}
          </span>
        </span>
        {restante != null && (
          <span className={`font-mono font-semibold ${restante < 60_000 ? "text-red-600" : "text-slate-800"}`} data-reloj>
            ⏱ {reloj(restante)}
          </span>
        )}
      </div>
      {estadoGuardado === "error" && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{mensajeError}</div>
      )}

      <ol className="space-y-4">
        {preguntas.map((p, i) => {
          const r = respuestas[p.id] ?? { opciones: [], texto: "" };
          return (
            <li key={p.id} className="tarjeta space-y-3 p-4" data-pregunta={i + 1}>
              <div className="flex items-start justify-between gap-3">
                <p className="whitespace-pre-line text-sm font-medium text-slate-900">
                  {i + 1}. {p.enunciado}
                </p>
                <span className="shrink-0 text-xs text-slate-500">{p.puntos} pt{p.puntos === 1 ? "" : "s"}</span>
              </div>
              {p.tipo === "OPCION_MULTIPLE" && <p className="text-xs text-slate-500">Marca todas las correctas.</p>}
              {p.tipo === "ABIERTA" ? (
                <textarea
                  aria-label={`Respuesta a la pregunta ${i + 1}`}
                  className="campo"
                  rows={4}
                  maxLength={5000}
                  value={r.texto}
                  onChange={(e) => cambiar(p.id, { opciones: [], texto: e.target.value }, 800)}
                  onBlur={() => {
                    const t = pendientes.current.get(p.id);
                    if (t) {
                      clearTimeout(t);
                      pendientes.current.delete(p.id);
                      guardar(p.id);
                    }
                  }}
                />
              ) : (
                <div className="space-y-1.5">
                  {p.opciones.map((o) => {
                    const multiple = p.tipo === "OPCION_MULTIPLE";
                    const marcada = r.opciones.includes(o.id);
                    return (
                      <label key={o.id} className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm ${marcada ? "border-marca-500 bg-marca-50" : "border-slate-200"}`}>
                        <input
                          type={multiple ? "checkbox" : "radio"}
                          name={`pregunta-${p.id}`}
                          checked={marcada}
                          onChange={(e) => {
                            const opciones = multiple
                              ? e.target.checked
                                ? [...r.opciones, o.id]
                                : r.opciones.filter((x) => x !== o.id)
                              : [o.id];
                            cambiar(p.id, { opciones, texto: "" });
                          }}
                        />
                        {o.texto}
                      </label>
                    );
                  })}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <p className="text-xs text-slate-500">Al enviar ya no podras cambiar tus respuestas.</p>
        <button
          type="button"
          disabled={enviando}
          onClick={() => {
            const faltan = preguntas.length - contestadas;
            if (faltan > 0 && !confirm(`Te faltan ${faltan} pregunta(s). ¿Enviar de todos modos?`)) return;
            void enviar();
          }}
          className="rounded-lg bg-marca-600 px-4 py-2 text-sm font-medium text-marca-contraste hover:bg-marca-700 disabled:opacity-60"
        >
          {enviando ? "Enviando..." : "Enviar examen"}
        </button>
      </div>
    </div>
  );
}
