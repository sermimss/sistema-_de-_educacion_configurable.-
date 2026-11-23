import { requerirRol } from "@/lib/auth";
import { db } from "@/lib/db";
import { alumnoDeSesion } from "@/lib/alumnoSesion";
import { nombreCompleto } from "@/lib/catalogos";
import { clasesDelDocente } from "@/lib/docencia";
import { obtenerInstitucion } from "@/lib/institucion";
import { formatearDia } from "@/lib/formato";
import { aFechaDia, diasRestantes, grabacionVigente, hoyEnZona } from "@/lib/grabaciones";
import { Alerta, EstadoVacio, Insignia, Selector, Tarjeta } from "@/components/ui";
import { FormularioGrabacion } from "./Formulario";

export const dynamic = "force-dynamic";

const AVISOS: Record<string, string> = {
  vencida: "Esa grabacion ya cumplio su mes y no se puede ver.",
  "no-existe": "Esa grabacion no esta disponible para ti.",
};

function BotonVer({ id, texto = "Ver grabacion" }: { id: number; texto?: string }) {
  return (
    <a
      href={`/panel/grabaciones/ver/${id}`}
      target="_blank"
      rel="noopener noreferrer"
      data-ver-grabacion={id}
      className="inline-flex items-center rounded-lg bg-marca-600 px-3 py-1.5 text-sm font-medium text-marca-contraste hover:bg-marca-700"
    >
      {texto}
    </a>
  );
}

function Vigencia({ disponibleHasta, hoy }: { disponibleHasta: Date; hoy: string }) {
  if (!grabacionVigente(disponibleHasta, hoy)) return <Insignia tono="peligro">Vencida</Insignia>;
  const dias = diasRestantes(disponibleHasta, hoy);
  if (dias === 0) return <Insignia tono="alerta">Ultimo dia</Insignia>;
  return <Insignia tono={dias <= 3 ? "alerta" : "exito"}>{dias === 1 ? "Queda 1 dia" : `Quedan ${dias} dias`}</Insignia>;
}

export default async function PaginaGrabaciones({
  searchParams,
}: {
  searchParams: Promise<{ clase?: string; aviso?: string }>;
}) {
  const sesion = await requerirRol("ADMIN", "DOCENTE", "ALUMNO");
  const params = await searchParams;
  const institucion = await obtenerInstitucion();
  const hoy = hoyEnZona(institucion?.zonaHoraria ?? "America/Mexico_City");
  const aviso = params.aviso ? AVISOS[params.aviso] : null;
  const zona = institucion?.zonaHoraria ?? "America/Mexico_City";
  const fechaHora = (f: Date) => {
    try {
      return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short", timeZone: zona }).format(f);
    } catch {
      return f.toISOString();
    }
  };

  // ---------------- Alumno: solo las vigentes de sus clases ----------------
  if (sesion.rol === "ALUMNO") {
    const alumno = await alumnoDeSesion(sesion.usuarioId);
    if (!alumno) return <Alerta tipo="error">Tu usuario no esta ligado a un expediente.</Alerta>;
    const misClases = await db.alumnoClase.findMany({
      where: { alumnoId: alumno.id, estado: { not: "BAJA" } },
      select: { claseId: true },
    });
    const grabaciones = await db.grabacion.findMany({
      where: { claseId: { in: misClases.map((c) => c.claseId) }, disponibleHasta: { gte: aFechaDia(hoy) } },
      orderBy: [{ fechaClase: "desc" }, { id: "desc" }],
      include: { clase: { include: { planMateria: { include: { materia: true } }, grupo: true } } },
    });
    return (
      <div className="space-y-6">
        <header>
          <h1 className="text-xl font-semibold text-slate-900">Grabaciones de mis clases</h1>
          <p className="mt-1 text-sm text-slate-600">
            Cada grabacion se puede ver hasta el mismo dia del mes siguiente a la clase. Despues ya no se puede abrir.
          </p>
        </header>
        {aviso && <Alerta tipo="aviso">{aviso}</Alerta>}
        <Tarjeta>
          {grabaciones.length === 0 ? (
            <EstadoVacio titulo="No hay grabaciones disponibles" mensaje="Aqui apareceran cuando tus docentes las compartan." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {grabaciones.map((g) => (
                <li key={g.id} className="flex flex-wrap items-center justify-between gap-3 py-3" data-grabacion={g.titulo ?? g.clase.planMateria.materia.nombre}>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900">{g.titulo ?? `Clase del ${formatearDia(g.fechaClase)}`}</p>
                    <p className="text-xs text-slate-600">
                      {g.clase.planMateria.materia.nombre} · Clase del {formatearDia(g.fechaClase)} · Disponible hasta el{" "}
                      {formatearDia(g.disponibleHasta)}
                      {g.autorNombre ? ` · ${g.autorNombre}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Vigencia disponibleHasta={g.disponibleHasta} hoy={hoy} />
                    <BotonVer id={g.id} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>
      </div>
    );
  }

  // ---------------- Docente y administracion ----------------
  const esAdmin = sesion.rol === "ADMIN";
  const clases = esAdmin
    ? await db.clase.findMany({
        where: { ciclo: { estado: "ACTIVO" } },
        orderBy: [{ grupoId: "asc" }, { id: "asc" }],
        include: { grupo: true, planMateria: { include: { materia: true } } },
      })
    : await clasesDelDocente(sesion.usuarioId);
  const opciones = clases.map((c) => ({ id: c.id, etiqueta: `${c.planMateria.materia.nombre} · ${c.grupo.nombre}` }));
  const filtro = Number(params.clase) || 0;
  const claseFiltrada = clases.some((c) => c.id === filtro) ? filtro : 0;
  const ids = claseFiltrada ? [claseFiltrada] : clases.map((c) => c.id);

  const grabaciones = await db.grabacion.findMany({
    where: { claseId: { in: ids } },
    orderBy: [{ fechaClase: "desc" }, { id: "desc" }],
    take: 200,
    include: {
      clase: {
        include: {
          planMateria: { include: { materia: true } },
          grupo: true,
          _count: { select: { alumnos: { where: { estado: { not: "BAJA" } } } } },
        },
      },
      vistas: { orderBy: { ultimaVez: "desc" }, include: { alumno: true } },
    },
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-slate-900">Grabaciones de clases</h1>
        <p className="mt-1 text-sm text-slate-600">
          Los alumnos de la clase ven cada grabacion hasta el mismo dia del mes siguiente a la clase.
          {esAdmin ? " La administracion y el docente la siguen viendo despues." : " Tu la sigues viendo despues, marcada como vencida."}
        </p>
      </header>
      {aviso && <Alerta tipo="aviso">{aviso}</Alerta>}

      {!esAdmin && (
        <Tarjeta titulo="Compartir una grabacion" descripcion="Al terminar tu clase en Meet">
          {opciones.length === 0 ? (
            <EstadoVacio titulo="No tienes clases asignadas" />
          ) : (
            <FormularioGrabacion clases={opciones} claseInicial={claseFiltrada || undefined} hoy={hoy} />
          )}
        </Tarjeta>
      )}

      <Tarjeta
        titulo={esAdmin ? "Grabaciones publicadas" : "Mis grabaciones"}
        acciones={
          opciones.length > 1 ? (
            <form className="flex items-center gap-2">
              <Selector name="clase" defaultValue={claseFiltrada || ""} aria-label="Filtrar por clase">
                <option value="">Todas las clases</option>
                {opciones.map((c) => (
                  <option key={c.id} value={c.id}>{c.etiqueta}</option>
                ))}
              </Selector>
              <button type="submit" className="text-sm text-marca-600 hover:underline">Filtrar</button>
            </form>
          ) : undefined
        }
      >
        {grabaciones.length === 0 ? (
          <EstadoVacio titulo="Aun no hay grabaciones" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {grabaciones.map((g) => {
              const inscritos = g.clase._count.alumnos;
              return (
                <li key={g.id} className="space-y-2 py-3" data-grabacion={g.titulo ?? g.clase.planMateria.materia.nombre}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900">{g.titulo ?? `Clase del ${formatearDia(g.fechaClase)}`}</p>
                      <p className="text-xs text-slate-600">
                        {g.clase.planMateria.materia.nombre} · {g.clase.grupo.nombre} · Clase del {formatearDia(g.fechaClase)} ·{" "}
                        Para alumnos hasta el {formatearDia(g.disponibleHasta)}
                        {esAdmin && g.autorNombre ? ` · ${g.autorNombre}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Vigencia disponibleHasta={g.disponibleHasta} hoy={hoy} />
                      <BotonVer id={g.id} texto="Abrir" />
                    </div>
                  </div>
                  <details className="rounded-lg bg-slate-50 px-3 py-2 text-sm" data-vistas>
                    <summary className="cursor-pointer text-slate-700">
                      La abrieron {g.vistas.length} de {inscritos} alumno(s)
                    </summary>
                    {g.vistas.length === 0 ? (
                      <p className="mt-2 text-xs text-slate-500">Nadie la ha abierto todavia.</p>
                    ) : (
                      <table className="mt-2 w-full text-left text-xs">
                        <thead className="text-slate-500">
                          <tr>
                            <th className="py-1 font-medium">Alumno</th>
                            <th className="py-1 font-medium">Veces</th>
                            <th className="py-1 font-medium">Ultima vez</th>
                          </tr>
                        </thead>
                        <tbody>
                          {g.vistas.map((v) => (
                            <tr key={v.id} className="border-t border-slate-200" data-vista={v.alumno.matricula}>
                              <td className="py-1">{nombreCompleto(v.alumno)} <span className="text-slate-400">{v.alumno.matricula}</span></td>
                              <td className="py-1">{v.veces}</td>
                              <td className="py-1">{fechaHora(v.ultimaVez)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </details>
                </li>
              );
            })}
          </ul>
        )}
      </Tarjeta>
    </div>
  );
}
