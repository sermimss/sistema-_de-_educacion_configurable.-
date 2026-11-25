import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requerirRol } from "@/lib/auth";
import { db } from "@/lib/db";
import { alumnoDeSesion } from "@/lib/alumnoSesion";
import { enviarVencidos, type OrdenIntento } from "@/lib/examenes";
import { ContestarExamen, type PreguntaParaContestar } from "../../ContestarExamen";

export const dynamic = "force-dynamic";

export default async function PaginaContestar({ params }: { params: Promise<{ id: string }> }) {
  const sesion = await requerirRol("ALUMNO");
  const alumno = await alumnoDeSesion(sesion.usuarioId);
  const examenId = Number((await params).id) || 0;
  if (!alumno) notFound();
  await enviarVencidos({ examenId, alumnoId: alumno.id });
  const intento = await db.intentoExamen.findUnique({
    where: { examenId_alumnoId: { examenId, alumnoId: alumno.id } },
    include: {
      respuestas: true,
      examen: { include: { preguntas: { include: { opciones: true } }, clase: { include: { planMateria: { include: { materia: true } } } } } },
    },
  });
  if (!intento || intento.enviadoEn) redirect(`/panel/examenes/${examenId}`);

  // Las preguntas en el orden que le toco; sin decir cuales son correctas.
  const orden = intento.orden as OrdenIntento;
  const porId = new Map(intento.examen.preguntas.map((p) => [p.id, p]));
  const preguntas: PreguntaParaContestar[] = orden.preguntas
    .map((id) => porId.get(id))
    .filter((p) => p != null)
    .map((p) => ({
      id: p.id,
      tipo: p.tipo,
      enunciado: p.enunciado,
      puntos: Number(p.puntos),
      opciones: (orden.opciones[p.id] ?? []).map((oid) => p.opciones.find((o) => o.id === oid)).filter((o) => o != null).map((o) => ({ id: o.id, texto: o.texto })),
    }));
  const guardadas = Object.fromEntries(intento.respuestas.map((r) => [r.preguntaId, { opciones: r.opciones, texto: r.texto ?? "" }]));

  return (
    <div className="space-y-4">
      <header>
        <Link href={`/panel/examenes/${examenId}`} className="text-sm text-marca-600 hover:underline">← {intento.examen.titulo}</Link>
        <h1 className="mt-1 text-xl font-semibold text-slate-900">{intento.examen.titulo}</h1>
        <p className="text-sm text-slate-600">{intento.examen.clase.planMateria.materia.nombre} · tus respuestas se guardan solas</p>
        {intento.examen.instrucciones && <p className="mt-2 whitespace-pre-line text-sm text-slate-700">{intento.examen.instrucciones}</p>}
      </header>
      <ContestarExamen
        intentoId={intento.id}
        preguntas={preguntas}
        guardadas={guardadas}
        msRestantes={intento.venceEn ? intento.venceEn.getTime() - Date.now() : null}
      />
    </div>
  );
}
