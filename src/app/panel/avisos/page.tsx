import { requerirRol } from "@/lib/auth";
import { db } from "@/lib/db";
import { alumnoDeSesion } from "@/lib/alumnoSesion";
import { avisosDelAlumno, SELECCION_ADJUNTO } from "@/lib/avisos";
import { configBool } from "@/lib/configuracion";
import { clasesDelDocente } from "@/lib/docencia";
import { formatearDia, formatearFechaHora } from "@/lib/formato";
import { Alerta, EstadoVacio, Insignia, Tarjeta } from "@/components/ui";
import { Adjuntos, type Adjunto } from "@/components/Adjuntos";
import { accionRetirarAviso } from "./acciones";
import { FormularioAviso } from "./Formulario";

export const dynamic = "force-dynamic";

function TarjetaAviso({
  aviso,
  destino,
  puedeRetirar,
}: {
  aviso: { id: number; titulo: string; contenido: string; autorNombre: string | null; fechaPublicacion: Date; vigenciaHasta: Date | null; archivos: Adjunto[] };
  destino?: string;
  puedeRetirar?: boolean;
}) {
  return (
    <article className="rounded-lg border border-slate-200 p-4" data-aviso>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900">{aviso.titulo}</h3>
        {destino && <Insignia>{destino}</Insignia>}
      </div>
      <p className="mt-2 whitespace-pre-line text-sm text-slate-700">{aviso.contenido}</p>
      <Adjuntos archivos={aviso.archivos} ruta="/panel/avisos/archivo" />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <span>
          {aviso.autorNombre ?? "Administracion"} · {formatearFechaHora(aviso.fechaPublicacion)}
          {aviso.vigenciaHasta ? ` · visible hasta el ${formatearDia(aviso.vigenciaHasta)}` : ""}
        </span>
        {puedeRetirar && (
          <form action={accionRetirarAviso}>
            <input type="hidden" name="avisoId" value={aviso.id} />
            <button type="submit" className="text-red-600 hover:underline">Retirar</button>
          </form>
        )}
      </div>
    </article>
  );
}

export default async function PaginaAvisos() {
  const sesion = await requerirRol("ADMIN", "DOCENTE", "ALUMNO");

  if (sesion.rol === "ALUMNO") {
    if (!(await configBool("portales.alumno_ve_avisos", true))) {
      return <Alerta tipo="aviso">El colegio tiene desactivada esta seccion.</Alerta>;
    }
    const alumno = await alumnoDeSesion(sesion.usuarioId);
    if (!alumno) return <Alerta tipo="error">Tu usuario no esta ligado a un expediente.</Alerta>;
    const avisos = await avisosDelAlumno(alumno.id);
    return (
      <div className="space-y-6">
        <header>
          <h1 className="text-xl font-semibold text-slate-900">Avisos</h1>
          <p className="mt-1 text-sm text-slate-600">Lo que publican tu colegio y tus docentes.</p>
        </header>
        {avisos.length === 0 ? (
          <Tarjeta><EstadoVacio titulo="No hay avisos por ahora" /></Tarjeta>
        ) : (
          <div className="space-y-3">{avisos.map((a) => <TarjetaAviso key={a.id} aviso={a} />)}</div>
        )}
      </div>
    );
  }

  // Administracion y docentes: publicar y ver lo publicado.
  const esAdmin = sesion.rol === "ADMIN";
  const clases = esAdmin ? [] : await clasesDelDocente(sesion.usuarioId);
  const grupos = esAdmin
    ? await db.grupo.findMany({ where: { activo: true }, orderBy: { nombre: "asc" }, include: { grado: true } })
    : [];
  const destinos = esAdmin
    ? [
        { valor: "todos", etiqueta: "Todos los alumnos" },
        ...grupos.map((g) => ({ valor: `grupo:${g.id}`, etiqueta: `Grupo ${g.nombre} · ${g.grado.nombre}` })),
      ]
    : clases.map((c) => ({ valor: `clase:${c.id}`, etiqueta: `${c.planMateria.materia.nombre} · ${c.grupo.nombre}` }));

  const avisos = await db.aviso.findMany({
    where: { activo: true, dirigidoA: { has: "ALUMNO" }, ...(esAdmin ? {} : { publicadoPor: sesion.usuarioId }) },
    orderBy: { fechaPublicacion: "desc" },
    take: 50,
    include: { archivos: { select: SELECCION_ADJUNTO, orderBy: { id: "asc" } } },
  });
  const gruposPorId = new Map(
    (await db.grupo.findMany({ where: { id: { in: avisos.map((a) => a.referenciaId ?? 0) } } })).map((g) => [g.id, g.nombre])
  );
  const clasesPorId = new Map(
    (
      await db.clase.findMany({
        where: { id: { in: avisos.map((a) => a.claseId ?? 0) } },
        include: { planMateria: { include: { materia: true } } },
      })
    ).map((c) => [c.id, c.planMateria.materia.nombre])
  );
  const destinoDe = (a: (typeof avisos)[number]) =>
    a.ambito === "TODOS"
      ? "Todo el colegio"
      : `${a.claseId ? `${clasesPorId.get(a.claseId) ?? "Clase"} · ` : ""}Grupo ${gruposPorId.get(a.referenciaId ?? 0) ?? ""}`;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-slate-900">Avisos</h1>
        <p className="mt-1 text-sm text-slate-600">
          {esAdmin
            ? "Avisos para los alumnos: a todo el colegio o a un grupo."
            : "Avisos para los alumnos de tus clases."}
        </p>
      </header>
      <Tarjeta titulo="Nuevo aviso">
        {destinos.length === 0 ? (
          <EstadoVacio titulo="No tienes clases asignadas" />
        ) : (
          <FormularioAviso destinos={destinos} />
        )}
      </Tarjeta>
      <Tarjeta titulo={esAdmin ? "Avisos publicados" : "Mis avisos publicados"}>
        {avisos.length === 0 ? (
          <EstadoVacio titulo="Aun no hay avisos" />
        ) : (
          <div className="space-y-3">
            {avisos.map((a) => (
              <TarjetaAviso key={a.id} aviso={a} destino={destinoDe(a)} puedeRetirar={esAdmin || a.publicadoPor === sesion.usuarioId} />
            ))}
          </div>
        )}
      </Tarjeta>
    </div>
  );
}
