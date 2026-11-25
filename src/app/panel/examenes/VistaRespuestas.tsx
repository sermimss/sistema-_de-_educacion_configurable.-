import type { OpcionPregunta, PreguntaExamen, RespuestaExamen } from "@prisma/client";
import { puntosAutomaticos } from "@/lib/examenes";
import { FormularioCalificarRespuesta } from "./Formularios";

type Pregunta = PreguntaExamen & { opciones: OpcionPregunta[] };

/// Las respuestas de un intento, pregunta por pregunta, en el orden en que
/// le tocaron al alumno. El docente ve las correctas y califica las abiertas;
/// el alumno ve las correctas solo si el examen lo permite.
export function VistaRespuestas({
  preguntas,
  respuestas,
  orden,
  mostrarCorrectas,
  calificar,
}: {
  preguntas: Pregunta[];
  respuestas: RespuestaExamen[];
  orden: { preguntas: number[]; opciones: Record<string, number[]> };
  mostrarCorrectas: boolean;
  calificar?: boolean;
}) {
  const porId = new Map(preguntas.map((p) => [p.id, p]));
  const lista = orden.preguntas.map((id) => porId.get(id)).filter((p): p is Pregunta => Boolean(p));
  const respuestaDe = new Map(respuestas.map((r) => [r.preguntaId, r]));
  return (
    <ol className="space-y-4">
      {lista.map((p, i) => {
        const r = respuestaDe.get(p.id);
        const maximo = Number(p.puntos);
        const elegidas = r?.opciones ?? [];
        const auto = puntosAutomaticos(p, elegidas);
        const puntos = r?.puntos != null ? Number(r.puntos) : auto;
        const opciones = (orden.opciones[p.id] ?? p.opciones.map((o) => o.id))
          .map((id) => p.opciones.find((o) => o.id === id))
          .filter((o): o is OpcionPregunta => Boolean(o));
        return (
          <li key={p.id} className="space-y-2 rounded-lg border border-slate-200 p-4" data-revision-pregunta={i + 1}>
            <div className="flex items-start justify-between gap-3">
              <p className="whitespace-pre-line text-sm font-medium text-slate-900">
                {i + 1}. {p.enunciado}
              </p>
              <span
                className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${
                  puntos == null ? "bg-amber-100 text-amber-800" : puntos >= maximo ? "bg-emerald-100 text-emerald-800" : puntos > 0 ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800"
                }`}
                data-puntos-pregunta
              >
                {puntos == null ? "Por calificar" : `${puntos} / ${maximo}`}
              </span>
            </div>
            {p.tipo === "ABIERTA" ? (
              <>
                <p className="whitespace-pre-line rounded bg-slate-50 p-2 text-sm text-slate-700">{r?.texto?.trim() || <em className="text-slate-400">Sin respuesta</em>}</p>
                {r?.comentario && <p className="text-xs text-slate-600">Comentario: {r.comentario}</p>}
                {calificar && r && r.texto?.trim() && (
                  <FormularioCalificarRespuesta
                    respuestaId={r.id}
                    maximo={maximo}
                    puntos={r.puntos != null ? String(Number(r.puntos)) : ""}
                    comentario={r.comentario ?? ""}
                  />
                )}
              </>
            ) : (
              <ul className="space-y-1">
                {opciones.map((o) => {
                  const marcada = elegidas.includes(o.id);
                  const marca = mostrarCorrectas && o.correcta ? "✓ " : "";
                  return (
                    <li
                      key={o.id}
                      className={`rounded px-2 py-1 text-sm ${
                        marcada ? (mostrarCorrectas ? (o.correcta ? "bg-emerald-50 text-emerald-900" : "bg-red-50 text-red-900") : "bg-marca-50 text-marca-900") : "text-slate-600"
                      }`}
                      data-opcion-marcada={marcada ? "si" : "no"}
                    >
                      {marcada ? "● " : "○ "}
                      {marca}
                      {o.texto}
                      {mostrarCorrectas && o.correcta && !marcada ? " (correcta)" : ""}
                    </li>
                  );
                })}
                {elegidas.length === 0 && <li className="text-xs italic text-slate-400">Sin respuesta</li>}
              </ul>
            )}
          </li>
        );
      })}
    </ol>
  );
}
