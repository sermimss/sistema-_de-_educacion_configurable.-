import Link from "next/link";
import { notFound } from "next/navigation";
import { requerirRol } from "@/lib/auth";
import { db } from "@/lib/db";
import { alumnoDeSesion } from "@/lib/alumnoSesion";
import { claseAccesible } from "@/lib/docencia";
import { nombreCompleto } from "@/lib/catalogos";
import { fechaHoraLegible, instanteAFechaHora } from "@/lib/fechasDia";
import { alumnoCursa, alumnosDeLaClase, zonaDelColegio } from "@/lib/tareas";
import { enviarVencidos, ETIQUETA_ESTADO_EXAMEN, estadoParaAlumno, puedeVerRespuestas, puntosTotales, type OrdenIntento } from "@/lib/examenes";
import { Alerta, Insignia, Tarjeta } from "@/components/ui";
import { FormularioExamen, FormularioPregunta } from "../Formularios";
import { ImportarExamen } from "../ImportarExamen";
import { VistaRespuestas } from "../VistaRespuestas";
import { accionComenzarExamen, accionEliminarExamen, accionPublicarExamen, accionQuitarPregunta } from "../acciones";

export const dynamic = "force-dynamic";

const TIPO: Record<string, string> = {
  OPCION_UNICA: "Opcion multiple",
  OPCION_MULTIPLE: "Varias correctas",
  VERDADERO_FALSO: "Verdadero o falso",
  ABIERTA: "Abierta",
};

const AVISOS: Record<string, string> = {
  "sin-preguntas": "Agrega al menos una pregunta antes de publicar.",
  "con-intentos": "Ya hay alumnos que lo presentaron: no puede volver a borrador.",
};

export default async function PaginaExamen({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ creado?: string; publicado?: string; borrador?: string; enviado?: string; aviso?: string }>;
}) {
  const sesion = await requerirRol("DOCENTE", "ALUMNO");
  const sp = await searchParams;
  const examenId = Number((await params).id) || 0;
  await enviarVencidos({ examenId });
  const examen = await db.examen.findUnique({
    where: { id: examenId },
    include: {
      clase: { include: { grupo: true, docente: true, planMateria: { include: { materia: true } } } },
      preguntas: { orderBy: { orden: "asc" }, include: { opciones: { orderBy: { orden: "asc" } } } },
    },
  });
  if (!examen) notFound();
  const zona = await zonaDelColegio();
  const ahora = new Date();
  const total = puntosTotales(examen.preguntas);
  const datos = (
    <p className="mt-1 text-sm text-slate-600">
      {examen.clase.planMateria.materia.nombre} · {examen.clase.grupo.nombre} · {examen.preguntas.length} pregunta(s), {total} puntos
      <br />
      Abre {fechaHoraLegible(examen.abreEn, zona)} · cierra {fechaHoraLegible(examen.cierraEn, zona)}
      {examen.duracionMinutos ? ` · ${examen.duracionMinutos} minutos para contestar` : " · sin tiempo limite"}
      {examen.aceptaTardios ? " · se puede presentar despues del cierre" : ""}
    </p>
  );

  // ---------------- Alumno ----------------
  if (sesion.rol === "ALUMNO") {
    const alumno = await alumnoDeSesion(sesion.usuarioId);
    if (!alumno || !examen.publicado || !(await alumnoCursa(alumno.id, examen.claseId))) notFound();
    const intento = await db.intentoExamen.findUnique({
      where: { examenId_alumnoId: { examenId: examen.id, alumnoId: alumno.id } },
      include: { respuestas: true },
    });
    const estado = estadoParaAlumno(examen, intento, ahora);
    return (
      <div className="space-y-6">
        <header>
          <Link href="/panel/examenes" className="text-sm text-marca-600 hover:underline">← Examenes</Link>
          <h1 className="mt-1 flex flex-wrap items-center gap-2 text-xl font-semibold text-slate-900">
            {examen.titulo} <Insignia tono={ETIQUETA_ESTADO_EXAMEN[estado].tono}>{ETIQUETA_ESTADO_EXAMEN[estado].texto}</Insignia>
          </h1>
          {datos}
        </header>
        {sp.enviado && <Alerta tipo="exito">Examen enviado.</Alerta>}
        {examen.instrucciones && (
          <Tarjeta titulo="Instrucciones"><p className="whitespace-pre-line text-sm text-slate-700">{examen.instrucciones}</p></Tarjeta>
        )}
        {(estado === "disponible" || estado === "tardio") && (
          <Tarjeta>
            <form action={accionComenzarExamen} className="flex flex-wrap items-center justify-between gap-3">
              <input type="hidden" name="examenId" value={examen.id} />
              <p className="text-sm text-slate-600">
                Solo tienes un intento.{" "}
                {examen.duracionMinutos ? `Al comenzar corren ${examen.duracionMinutos} minutos; al acabarse se envia solo.` : "Tienes hasta el cierre para enviarlo."}
                {estado === "tardio" && " Ya paso el cierre: quedara marcado como tarde."}
              </p>
              <button type="submit" className="rounded-lg bg-marca-600 px-4 py-2 text-sm font-medium text-marca-contraste hover:bg-marca-700">
                Comenzar examen
              </button>
            </form>
          </Tarjeta>
        )}
        {estado === "en-curso" && (
          <Alerta tipo="aviso">
            Tienes este examen en curso. <Link href={`/panel/examenes/${examen.id}/contestar`} className="font-medium underline">Continuar</Link>
          </Alerta>
        )}
        {estado === "proximo" && <Alerta tipo="info">Este examen abre el {fechaHoraLegible(examen.abreEn, zona)}.</Alerta>}
        {estado === "cerrado" && <Alerta tipo="aviso">El examen ya cerro y no lo presentaste.</Alerta>}
        {intento?.enviadoEn && (
          <Tarjeta titulo="Mi resultado">
            <div className="space-y-4">
              <p className="text-sm text-slate-700" data-resultado>
                Calificacion: <strong>{Number(intento.puntaje ?? 0)} de {total}</strong>
                {intento.porRevisar ? " · el docente aun revisa tus respuestas abiertas" : ""}
                {intento.tarde ? " · presentado fuera de tiempo" : ""}
              </p>
              {puedeVerRespuestas(examen, intento, ahora) ? (
                <VistaRespuestas preguntas={examen.preguntas} respuestas={intento.respuestas} orden={intento.orden as OrdenIntento} mostrarCorrectas />
              ) : (
                <p className="text-xs text-slate-500" data-sin-respuestas>
                  {examen.mostrarRespuestas === "AL_CERRAR"
                    ? `Podras ver tus respuestas correctas cuando cierre el examen (${fechaHoraLegible(examen.cierraEn, zona)}).`
                    : "Tu docente no muestra las respuestas correctas de este examen."}
                </p>
              )}
            </div>
          </Tarjeta>
        )}
      </div>
    );
  }

  // ---------------- Docente ----------------
  if (!(await claseAccesible(sesion, examen.claseId))) notFound();
  const [alumnos, intentos] = await Promise.all([
    alumnosDeLaClase(examen.claseId),
    db.intentoExamen.findMany({ where: { examenId: examen.id } }),
  ]);
  const porAlumno = new Map(intentos.map((i) => [i.alumnoId, i]));
  const editable = intentos.length === 0;
  const estadoExamen = !examen.publicado ? "Borrador" : ahora < examen.abreEn ? "Programado" : ahora <= examen.cierraEn ? "Abierto" : "Cerrado";

  return (
    <div className="space-y-6">
      <header>
        <Link href="/panel/examenes" className="text-sm text-marca-600 hover:underline">← Examenes</Link>
        <h1 className="mt-1 flex flex-wrap items-center gap-2 text-xl font-semibold text-slate-900">
          {examen.titulo} <Insignia tono={examen.publicado ? "exito" : "alerta"}>{estadoExamen}</Insignia>
        </h1>
        {datos}
      </header>
      {sp.creado && <Alerta tipo="exito">Examen creado como borrador. Agrega sus preguntas y despues publicalo.</Alerta>}
      {sp.publicado && <Alerta tipo="exito">Examen publicado: tus alumnos ya lo ven{ahora < examen.abreEn ? ` y podran presentarlo desde el ${fechaHoraLegible(examen.abreEn, zona)}` : ""}.</Alerta>}
      {sp.borrador && <Alerta tipo="info">El examen volvio a borrador: tus alumnos ya no lo ven.</Alerta>}
      {sp.aviso && AVISOS[sp.aviso] && <Alerta tipo="aviso">{AVISOS[sp.aviso]}</Alerta>}

      <Tarjeta
        titulo={`Preguntas (${examen.preguntas.length})`}
        descripcion={editable ? "Puedes agregar o quitar preguntas mientras nadie lo haya empezado" : "Ya hay alumnos que lo empezaron: las preguntas no se pueden cambiar"}
        acciones={
          <form action={accionPublicarExamen}>
            <input type="hidden" name="examenId" value={examen.id} />
            {examen.publicado ? (
              editable && (
                <button name="accion" value="borrador" className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
                  Regresar a borrador
                </button>
              )
            ) : (
              <button name="accion" value="publicar" className="rounded-lg bg-marca-600 px-3 py-1.5 text-sm font-medium text-marca-contraste hover:bg-marca-700">
                Publicar examen
              </button>
            )}
          </form>
        }
      >
        <div className="space-y-4">
          <ol className="space-y-3">
            {examen.preguntas.map((p, i) => (
              <li key={p.id} className="rounded-lg border border-slate-200 p-3" data-pregunta-docente={i + 1}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="whitespace-pre-line text-sm font-medium text-slate-900">{i + 1}. {p.enunciado}</p>
                  <span className="flex items-center gap-2 text-xs text-slate-500">
                    <Insignia>{TIPO[p.tipo]}</Insignia> {Number(p.puntos)} pt(s)
                    {editable && (
                      <form action={accionQuitarPregunta}>
                        <input type="hidden" name="examenId" value={examen.id} />
                        <input type="hidden" name="preguntaId" value={p.id} />
                        <button type="submit" className="text-red-600 hover:underline">Quitar</button>
                      </form>
                    )}
                  </span>
                </div>
                {p.opciones.length > 0 && (
                  <ul className="mt-2 space-y-0.5 text-sm">
                    {p.opciones.map((o) => (
                      <li key={o.id} className={o.correcta ? "font-medium text-emerald-700" : "text-slate-600"}>
                        {o.correcta ? "✓" : "·"} {o.texto}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
          {editable && (
            <div className="border-t border-slate-100 pt-4">
              <p className="mb-2 text-sm font-medium text-slate-800">Agregar pregunta</p>
              <FormularioPregunta examenId={examen.id} />
            </div>
          )}
        </div>
      </Tarjeta>

      {editable && (
        <Tarjeta titulo="Cargar un examen ya escrito" descripcion="Pega el texto o sube un .txt o .docx; revisas la vista previa y confirmas">
          <ImportarExamen examenId={examen.id} />
        </Tarjeta>
      )}

      {examen.publicado && (
        <Tarjeta titulo="Resultados" descripcion={`${intentos.filter((i) => i.enviadoEn).length} de ${alumnos.length} lo presentaron`}>
          <ul className="divide-y divide-slate-100">
            {alumnos.map((alumno) => {
              const intento = porAlumno.get(alumno.id);
              return (
                <li key={alumno.id} className="flex flex-wrap items-center justify-between gap-2 py-2" data-resultado-alumno={alumno.matricula}>
                  <span className="text-sm text-slate-800">
                    {nombreCompleto(alumno)} <span className="text-xs text-slate-400">{alumno.matricula}</span>
                  </span>
                  <span className="flex items-center gap-2 text-sm">
                    {!intento ? (
                      <span className="text-xs text-slate-400">{ahora > examen.cierraEn ? "No lo presento" : "Sin presentar"}</span>
                    ) : !intento.enviadoEn ? (
                      <Insignia tono="alerta">En curso</Insignia>
                    ) : (
                      <>
                        <strong>{Number(intento.puntaje ?? 0)} / {total}</strong>
                        {intento.tarde && <Insignia tono="alerta">Tarde</Insignia>}
                        {intento.porRevisar && <Insignia tono="alerta">Por revisar</Insignia>}
                        <Link href={`/panel/examenes/${examen.id}/intento/${intento.id}`} className="text-xs font-medium text-marca-600 hover:underline">
                          {intento.porRevisar ? "Revisar" : "Ver respuestas"}
                        </Link>
                      </>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </Tarjeta>
      )}

      <Tarjeta titulo="Datos del examen">
        <FormularioExamen
          examen={{
            id: examen.id,
            titulo: examen.titulo,
            instrucciones: examen.instrucciones ?? "",
            abreEn: instanteAFechaHora(examen.abreEn, zona),
            cierraEn: instanteAFechaHora(examen.cierraEn, zona),
            duracionMinutos: examen.duracionMinutos ? String(examen.duracionMinutos) : "",
            aceptaTardios: examen.aceptaTardios,
            desordenar: examen.desordenar,
            mostrarRespuestas: examen.mostrarRespuestas,
          }}
        />
        {editable && (
          <form action={accionEliminarExamen} className="mt-3 flex justify-end border-t border-slate-100 pt-3">
            <input type="hidden" name="examenId" value={examen.id} />
            <button type="submit" className="text-sm text-red-600 hover:underline">Eliminar examen (nadie lo ha empezado)</button>
          </form>
        )}
      </Tarjeta>
    </div>
  );
}
