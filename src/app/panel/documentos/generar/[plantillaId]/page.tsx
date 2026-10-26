import Link from "next/link";
import { notFound } from "next/navigation";
import { requerirRol } from "@/lib/auth";
import { db } from "@/lib/db";
import { obtenerInstitucion } from "@/lib/institucion";
import { imagenIncrustada, marcaParaHoja } from "@/lib/marca";
import {
  buscarPersonas,
  camposExtraDe,
  datosDeAlumno,
  datosDePersonal,
  valoresGenerales,
  type DatosPersona,
} from "@/lib/documentos/datos";
import { Alerta, EstadoVacio, Tarjeta } from "@/components/ui";
import { FormularioEmision } from "./FormularioEmision";

export const dynamic = "force-dynamic";

export default async function PaginaGenerar({
  params,
  searchParams,
}: {
  params: Promise<{ plantillaId: string }>;
  searchParams: Promise<{ q?: string; alumno?: string; empleado?: string; solicitud?: string }>;
}) {
  await requerirRol("ADMIN");
  const { plantillaId } = await params;
  const consulta = await searchParams;
  const plantilla = await db.plantillaDocumento.findUnique({
    where: { id: Number(plantillaId) || 0 },
    include: { firmante: true },
  });
  if (!plantilla) notFound();

  // Viene de una solicitud del portal del alumno: el alumno ya esta elegido.
  const solicitud = consulta.solicitud
    ? await db.solicitudDocumento.findUnique({
        where: { id: Number(consulta.solicitud) || 0 },
        include: { alumno: true },
      })
    : null;
  const solicitudValida = solicitud && solicitud.estado === "PENDIENTE" && solicitud.plantillaId === plantilla.id;

  const alumnoId = plantilla.categoria === "ALUMNO" ? (solicitudValida ? solicitud.alumnoId : Number(consulta.alumno) || 0) : 0;
  const empleadoId = plantilla.categoria === "PERSONAL" ? Number(consulta.empleado) || 0 : 0;

  let persona: DatosPersona | null = null;
  if (alumnoId) persona = await datosDeAlumno(alumnoId);
  if (empleadoId) persona = await datosDePersonal(empleadoId);
  const necesitaPersona = plantilla.categoria !== "GENERAL";
  const resultados = necesitaPersona && !persona ? await buscarPersonas(plantilla.categoria, consulta.q ?? "") : [];
  const parametro = plantilla.categoria === "ALUMNO" ? "alumno" : "empleado";

  const institucion = await obtenerInstitucion();
  const firmante = plantilla.firmante?.activo ? plantilla.firmante : null;

  return (
    <div className="space-y-6">
      <header className="no-imprimir">
        <Link href="/panel/documentos" className="text-sm text-marca-600 hover:underline">
          ← Documentos
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-slate-900">{plantilla.nombre}</h1>
        {plantilla.descripcion && <p className="mt-1 text-sm text-slate-600">{plantilla.descripcion}</p>}
      </header>

      {!plantilla.activa && <Alerta tipo="aviso">Este machote esta desactivado. Activalo en Machotes para usarlo.</Alerta>}
      {!firmante && (
        <Alerta tipo="aviso">
          Este machote no tiene firmante.{" "}
          <Link href={`/panel/documentos/machotes/${plantilla.id}`} className="font-medium underline">Asignale uno</Link>{" "}
          o el documento saldra con la linea de firma en blanco.
        </Alerta>
      )}
      {solicitudValida && (
        <Alerta tipo="info">
          Solicitud de {solicitud.alumno.nombres} {solicitud.alumno.apellidoPaterno}
          {solicitud.motivo ? `: "${solicitud.motivo}"` : "."}
        </Alerta>
      )}

      {necesitaPersona && !persona ? (
        <Tarjeta
          titulo={plantilla.categoria === "ALUMNO" ? "¿Para que alumno es?" : "¿Para quien del personal es?"}
          descripcion="Escribe el nombre, los apellidos o la matricula / numero de empleado."
        >
          <form method="get" className="flex flex-wrap gap-2">
            <input
              name="q"
              defaultValue={consulta.q ?? ""}
              autoFocus
              aria-label="Buscar persona"
              placeholder={plantilla.categoria === "ALUMNO" ? "Sofia Ramirez o 2026-0001" : "Hernandez o DOC-001"}
              className="campo max-w-md flex-1"
            />
            <button type="submit" className="rounded-lg bg-marca-600 px-4 py-2 text-sm font-medium text-marca-contraste hover:bg-marca-700">
              Buscar
            </button>
          </form>
          <div className="mt-4">
            {(consulta.q ?? "").trim().length >= 2 &&
              (resultados.length === 0 ? (
                <EstadoVacio titulo="Sin resultados" mensaje="Revisa como esta escrito." />
              ) : (
                <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                  {resultados.map((r) => (
                    <li key={r.id}>
                      <Link
                        href={`/panel/documentos/generar/${plantilla.id}?${parametro}=${r.id}`}
                        className="flex items-center justify-between px-3 py-2 text-sm hover:bg-slate-50"
                      >
                        <span className="font-medium text-slate-800">{r.nombre}</span>
                        <span className="text-xs text-slate-500">{r.detalle}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ))}
          </div>
        </Tarjeta>
      ) : (
        <>
          {persona && (
            <p className="no-imprimir text-sm text-slate-600">
              Para <span className="font-semibold text-slate-900">{persona.destinatario}</span>
              {!solicitudValida && (
                <>
                  {" · "}
                  <Link href={`/panel/documentos/generar/${plantilla.id}`} className="text-marca-600 hover:underline">
                    cambiar
                  </Link>
                </>
              )}
            </p>
          )}
          <FormularioEmision
            plantilla={{
              id: plantilla.id,
              titulo: plantilla.titulo,
              cuerpo: plantilla.cuerpo,
              camposExtra: camposExtraDe(plantilla.camposExtra),
            }}
            valoresBase={{
              ...valoresGenerales(institucion, firmante, "(se asigna al generar)"),
              ...(persona?.valores ?? {}),
            }}
            datos={{ tablaCalificaciones: persona?.tablaCalificaciones }}
            marca={await marcaParaHoja(institucion)}
            firmante={
              firmante
                ? {
                    nombre: firmante.nombre,
                    cargo: firmante.cargo,
                    firma: await imagenIncrustada(firmante.firmaId),
                    sello: await imagenIncrustada(firmante.selloId),
                  }
                : null
            }
            simboloMoneda={institucion?.simboloMoneda ?? "$"}
            alumnoId={alumnoId || undefined}
            empleadoId={empleadoId || undefined}
            solicitudId={solicitudValida ? solicitud.id : undefined}
          />
        </>
      )}
    </div>
  );
}
