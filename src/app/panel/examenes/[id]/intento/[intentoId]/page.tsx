import Link from "next/link";
import { notFound } from "next/navigation";
import { requerirRol } from "@/lib/auth";
import { db } from "@/lib/db";
import { claseAccesible } from "@/lib/docencia";
import { nombreCompleto } from "@/lib/catalogos";
import { fechaHoraLegible } from "@/lib/fechasDia";
import { zonaDelColegio } from "@/lib/tareas";
import { puntosTotales, type OrdenIntento } from "@/lib/examenes";
import { Insignia, Tarjeta } from "@/components/ui";
import { VistaRespuestas } from "../../../VistaRespuestas";

export const dynamic = "force-dynamic";

/// El docente revisa el examen de un alumno y califica sus respuestas abiertas.
export default async function PaginaIntento({ params }: { params: Promise<{ id: string; intentoId: string }> }) {
  const sesion = await requerirRol("DOCENTE");
  const { id, intentoId } = await params;
  const intento = await db.intentoExamen.findUnique({
    where: { id: Number(intentoId) || 0 },
    include: {
      alumno: true,
      respuestas: true,
      examen: { include: { preguntas: { include: { opciones: { orderBy: { orden: "asc" } } } } } },
    },
  });
  if (!intento || intento.examenId !== Number(id) || !intento.enviadoEn || !(await claseAccesible(sesion, intento.examen.claseId))) notFound();
  const zona = await zonaDelColegio();
  return (
    <div className="space-y-6">
      <header>
        <Link href={`/panel/examenes/${intento.examenId}`} className="text-sm text-marca-600 hover:underline">← {intento.examen.titulo}</Link>
        <h1 className="mt-1 text-xl font-semibold text-slate-900">{nombreCompleto(intento.alumno)}</h1>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-600">
          Enviado {fechaHoraLegible(intento.enviadoEn, zona)} ·{" "}
          <strong data-puntaje-intento>{Number(intento.puntaje ?? 0)} de {puntosTotales(intento.examen.preguntas)}</strong>
          {intento.tarde && <Insignia tono="alerta">Tarde</Insignia>}
          {intento.porRevisar && <Insignia tono="alerta">Faltan respuestas abiertas por calificar</Insignia>}
        </p>
      </header>
      <Tarjeta titulo="Respuestas">
        <VistaRespuestas
          preguntas={intento.examen.preguntas}
          respuestas={intento.respuestas}
          orden={intento.orden as OrdenIntento}
          mostrarCorrectas
          calificar
        />
      </Tarjeta>
    </div>
  );
}
