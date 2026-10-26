import { Prisma, type CategoriaDocumento, type Institucion } from "@prisma/client";
import { db } from "../db";
import { nombreCompleto } from "../catalogos";
import { cicloVigenteDeAlumno } from "../calendarioGrupo";
import { promedioDePeriodos } from "../calificaciones";
import { obtenerInstitucion } from "../institucion";
import { CATALOGO_DOCUMENTOS } from "./catalogo";
import { fechaLarga, rellenar, valoresExtra, type CampoExtra, type Valores } from "./campos";

/// Datos reales para llenar los machotes, y la emision de documentos.

/// Siembra los machotes del sistema que falten. Los que el colegio ya edito
/// no se tocan (se reconocen por su clave).
export async function asegurarCatalogo() {
  await db.plantillaDocumento.createMany({
    data: CATALOGO_DOCUMENTOS.map((m, indice) => ({
      clave: m.clave,
      nombre: m.nombre,
      categoria: m.categoria,
      descripcion: m.descripcion,
      titulo: m.titulo,
      cuerpo: m.cuerpo,
      camposExtra: m.camposExtra as unknown as Prisma.InputJsonValue,
      prefijoFolio: m.prefijoFolio,
      alumnoPuedeSolicitar: m.alumnoPuedeSolicitar,
      delSistema: true,
      orden: indice,
    })),
    skipDuplicates: true,
  });
}

export function camposExtraDe(valor: Prisma.JsonValue): CampoExtra[] {
  return Array.isArray(valor) ? (valor as unknown as CampoExtra[]) : [];
}

const ETIQUETA_CONTRATO: Record<string, string> = {
  TIEMPO_COMPLETO: "de tiempo completo",
  MEDIO_TIEMPO: "de medio tiempo",
  POR_HORAS: "por horas",
  HONORARIOS: "por honorarios",
  TEMPORAL: "temporal",
};

/// Nombre en orden natural: "Sofia Ramirez Lopez".
function nombreNatural(p: { nombres: string; apellidoPaterno: string; apellidoMaterno?: string | null }) {
  return [p.nombres, p.apellidoPaterno, p.apellidoMaterno].filter(Boolean).join(" ");
}

export type TablaCalificaciones = {
  periodos: string[];
  filas: { materia: string; porPeriodo: string[]; final: string }[];
};

export type DatosPersona = {
  valores: Valores;
  destinatario: string;
  tablaCalificaciones?: TablaCalificaciones;
};

export async function datosDeAlumno(alumnoId: number): Promise<DatosPersona | null> {
  const alumno = await db.alumno.findUnique({
    where: { id: alumnoId },
    include: {
      plan: { include: { nivel: true } },
      plantel: true,
      turno: true,
      tutores: { orderBy: [{ esResponsableFinanciero: "desc" }, { id: "asc" }] },
    },
  });
  if (!alumno) return null;

  const ciclo = await cicloVigenteDeAlumno(alumno.id);
  const [inscripcion, escala, promedioCiclo] = await Promise.all([
    ciclo
      ? db.inscripcion.findUnique({
          where: { alumnoId_cicloId: { alumnoId: alumno.id, cicloId: ciclo.id } },
          include: { grupo: { include: { turno: true } }, grado: true },
        })
      : null,
    db.escalaCalificacion.findFirst({ where: { predeterminada: true } }),
    ciclo
      ? db.promedioCiclo.findUnique({ where: { alumnoId_cicloId: { alumnoId: alumno.id, cicloId: ciclo.id } } })
      : null,
  ]);

  const decimales = escala?.decimales ?? 2;
  const formatear = (n: number | null) =>
    n == null ? "—" : new Intl.NumberFormat("es-MX", { minimumFractionDigits: 0, maximumFractionDigits: decimales }).format(n);

  let tablaCalificaciones: TablaCalificaciones | undefined;
  if (ciclo) {
    const escalaBase = {
      valorMinimo: Number(escala?.valorMinimo ?? 0),
      valorMaximo: Number(escala?.valorMaximo ?? 100),
      decimales,
      redondeo: escala?.redondeo ?? ("NINGUNO" as const),
      minimaAprobatoria: Number(escala?.minimaAprobatoria ?? 70),
    };
    const clases = await db.alumnoClase.findMany({
      where: { alumnoId: alumno.id, estado: { not: "BAJA" }, clase: { cicloId: ciclo.id } },
      include: {
        clase: {
          include: {
            planMateria: { include: { materia: true } },
            calificaciones: { where: { alumnoId: alumno.id } },
            extraordinarios: { where: { alumnoId: alumno.id }, orderBy: { fecha: "desc" } },
          },
        },
      },
    });
    const peso = new Map(ciclo.periodos.map((p) => [p.id, Number(p.peso)]));
    tablaCalificaciones = {
      periodos: ciclo.periodos.map((p) => p.nombre),
      filas: clases
        .map((ac) => {
          const porPeriodo = new Map(
            ac.clase.calificaciones.map((c) => [c.periodoId, c.calificacion != null ? Number(c.calificacion) : null])
          );
          const extraordinario = ac.clase.extraordinarios[0];
          const final =
            ac.calificacionFinal != null
              ? Number(ac.calificacionFinal)
              : extraordinario
                ? Number(extraordinario.calificacion)
                : promedioDePeriodos(
                    ac.clase.calificaciones.map((c) => ({
                      calificacion: c.calificacion != null ? Number(c.calificacion) : null,
                      peso: peso.get(c.periodoId) ?? 1,
                    })),
                    escalaBase
                  );
          return {
            materia: ac.clase.planMateria.materia.nombre,
            porPeriodo: ciclo.periodos.map((p) => formatear(porPeriodo.get(p.id) ?? null)),
            final: formatear(final),
          };
        })
        .sort((a, b) => a.materia.localeCompare(b.materia)),
    };
  }

  const promedio =
    promedioCiclo?.promedio != null
      ? Number(promedioCiclo.promedio)
      : alumno.promedioGeneral != null
        ? Number(alumno.promedioGeneral)
        : null;
  const tutor = alumno.tutores[0];

  const valores: Valores = {
    "alumno.nombre_completo": nombreNatural(alumno),
    "alumno.nombres": alumno.nombres,
    "alumno.apellidos": [alumno.apellidoPaterno, alumno.apellidoMaterno].filter(Boolean).join(" "),
    "alumno.matricula": alumno.matricula,
    "alumno.curp": alumno.curp ?? "",
    "alumno.nivel": alumno.plan.nivel.nombre,
    "alumno.plan": alumno.plan.nombre,
    "alumno.grado": inscripcion?.grado.nombre ?? "",
    "alumno.grupo": inscripcion?.grupo.nombre ?? "",
    "alumno.turno": inscripcion?.grupo.turno?.nombre ?? alumno.turno?.nombre ?? "",
    "alumno.plantel": alumno.plantel?.nombre ?? "",
    "alumno.inicio_clases": ciclo ? fechaLarga(ciclo.fechaInicio) : "",
    "alumno.fin_clases": ciclo ? fechaLarga(ciclo.fechaFin) : "",
    "alumno.promedio_general": promedio != null ? formatear(promedio) : "",
    "alumno.fecha_ingreso": fechaLarga(alumno.fechaIngreso),
    "alumno.tutor": tutor?.nombre ?? "",
  };
  return { valores, destinatario: nombreNatural(alumno), tablaCalificaciones };
}

export async function datosDePersonal(empleadoId: number): Promise<DatosPersona | null> {
  const e = await db.empleado.findUnique({ where: { id: empleadoId } });
  if (!e) return null;
  return {
    destinatario: nombreNatural(e),
    valores: {
      "personal.nombre_completo": nombreNatural(e),
      "personal.nombres": e.nombres,
      "personal.apellidos": [e.apellidoPaterno, e.apellidoMaterno].filter(Boolean).join(" "),
      "personal.numero_empleado": e.numeroEmpleado,
      "personal.puesto": e.puesto ?? "",
      "personal.grado_academico": e.gradoAcademico ?? "",
      "personal.rfc": e.rfc ?? "",
      "personal.curp": e.curp ?? "",
      "personal.fecha_ingreso": fechaLarga(e.fechaIngreso),
      "personal.tipo_contrato": e.tipoContrato ? ETIQUETA_CONTRATO[e.tipoContrato] ?? "" : "",
    },
  };
}

/// Fecha de hoy en la zona horaria del colegio, como "AAAA-MM-DD".
function hoyDelColegio(institucion: Institucion | null): string {
  const zona = institucion?.zonaHoraria || "America/Mexico_City";
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: zona }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export function valoresGenerales(
  institucion: Institucion | null,
  firmante: { nombre: string; cargo: string } | null,
  folio: string
): Valores {
  const fecha = fechaLarga(hoyDelColegio(institucion));
  const lugar = [institucion?.ciudad, institucion?.estado].filter(Boolean).join(", ");
  return {
    "documento.fecha": fecha,
    "documento.ciudad_fecha": lugar ? `${lugar}, a ${fecha}` : fecha,
    "documento.folio": folio,
    "institucion.nombre": institucion?.nombre ?? "",
    "institucion.nombre_corto": institucion?.nombreCorto ?? institucion?.nombre ?? "",
    "institucion.clave_centro_trabajo": institucion?.claveCentroTrabajo ?? "",
    "institucion.direccion": institucion?.direccion ?? "",
    "institucion.ciudad": institucion?.ciudad ?? "",
    "institucion.telefono": institucion?.telefono ?? "",
    "firmante.nombre": firmante?.nombre ?? "",
    "firmante.cargo": firmante?.cargo ?? "",
  };
}

export async function buscarPersonas(categoria: CategoriaDocumento, texto: string) {
  const q = texto.trim();
  if (q.length < 2) return [];
  const palabras = q.split(/\s+/).slice(0, 4);
  if (categoria === "ALUMNO") {
    const alumnos = await db.alumno.findMany({
      where: {
        AND: palabras.map((p) => ({
          OR: [
            { matricula: { contains: p, mode: "insensitive" as const } },
            { nombres: { contains: p, mode: "insensitive" as const } },
            { apellidoPaterno: { contains: p, mode: "insensitive" as const } },
            { apellidoMaterno: { contains: p, mode: "insensitive" as const } },
          ],
        })),
      },
      orderBy: [{ apellidoPaterno: "asc" }, { nombres: "asc" }],
      take: 20,
      include: { plan: true },
    });
    return alumnos.map((a) => ({
      id: a.id,
      nombre: nombreCompleto(a),
      detalle: `${a.matricula} · ${a.plan.nombre}${a.estado !== "ACTIVO" ? ` · ${a.estado.toLowerCase()}` : ""}`,
    }));
  }
  if (categoria === "PERSONAL") {
    const empleados = await db.empleado.findMany({
      where: {
        AND: palabras.map((p) => ({
          OR: [
            { numeroEmpleado: { contains: p, mode: "insensitive" as const } },
            { nombres: { contains: p, mode: "insensitive" as const } },
            { apellidoPaterno: { contains: p, mode: "insensitive" as const } },
            { apellidoMaterno: { contains: p, mode: "insensitive" as const } },
          ],
        })),
      },
      orderBy: [{ apellidoPaterno: "asc" }, { nombres: "asc" }],
      take: 20,
    });
    return empleados.map((e) => ({
      id: e.id,
      nombre: nombreCompleto(e),
      detalle: `${e.numeroEmpleado}${e.puesto ? ` · ${e.puesto}` : ""}`,
    }));
  }
  return [];
}

/// Folio consecutivo por tipo de documento y ano: CE-2026-0001.
async function siguienteFolio(tx: Prisma.TransactionClient, prefijo: string, anio: string, salto: number) {
  const base = `${prefijo}-${anio}-`;
  // Los documentos no se borran (solo se cancelan), asi que contar basta; si
  // dos se emiten a la vez, el folio repetido choca y se reintenta.
  const emitidos = await tx.documentoEmitido.count({ where: { folio: { startsWith: base } } });
  return `${base}${String(emitidos + 1 + salto).padStart(4, "0")}`;
}

export type SolicitudEmision = {
  plantillaId: number;
  alumnoId?: number | null;
  empleadoId?: number | null;
  capturados: Record<string, string>;
  /// Texto ajustado solo para este documento (con sus {{campos}}).
  cuerpoAjustado?: string | null;
  solicitudId?: number | null;
  emitidoPor: { id: number; nombre: string };
};

export type ResultadoEmision = { ok: true; id: number; folio: string } | { ok: false; error: string };

/// Genera el documento: llena los campos con los datos reales (leidos aqui,
/// nunca los que manda el navegador), le asigna folio y lo guarda tal cual.
export async function emitirDocumento(s: SolicitudEmision): Promise<ResultadoEmision> {
  const plantilla = await db.plantillaDocumento.findUnique({
    where: { id: s.plantillaId },
    include: { firmante: true },
  });
  if (!plantilla || !plantilla.activa) return { ok: false, error: "Ese machote no existe o esta desactivado." };

  let persona: DatosPersona | null = null;
  if (plantilla.categoria === "ALUMNO") {
    if (!s.alumnoId) return { ok: false, error: "Elige al alumno." };
    persona = await datosDeAlumno(s.alumnoId);
    if (!persona) return { ok: false, error: "El alumno no existe." };
  } else if (plantilla.categoria === "PERSONAL") {
    if (!s.empleadoId) return { ok: false, error: "Elige a la persona del personal." };
    persona = await datosDePersonal(s.empleadoId);
    if (!persona) return { ok: false, error: "Esa persona no existe." };
  }

  const extras = camposExtraDe(plantilla.camposExtra);
  const faltantes = extras.filter((c) => c.requerido && !(s.capturados[c.clave] ?? "").trim());
  if (faltantes.length > 0) {
    return { ok: false, error: `Falta capturar: ${faltantes.map((c) => c.etiqueta).join(", ")}.` };
  }
  for (const campo of extras) {
    const valor = (s.capturados[campo.clave] ?? "").trim();
    if (!valor) continue;
    if (campo.tipo === "fecha" && !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return { ok: false, error: `${campo.etiqueta}: fecha invalida.` };
    if (campo.tipo === "hora" && !/^([01]\d|2[0-3]):[0-5]\d$/.test(valor)) return { ok: false, error: `${campo.etiqueta}: hora invalida.` };
    if (campo.tipo === "numero" && !Number.isFinite(Number(valor))) return { ok: false, error: `${campo.etiqueta}: debe ser un numero.` };
    if (campo.tipo === "opcion" && !(campo.opciones ?? []).includes(valor)) return { ok: false, error: `${campo.etiqueta}: opcion invalida.` };
    if (valor.length > 4000) return { ok: false, error: `${campo.etiqueta}: el texto es demasiado largo.` };
  }

  const cuerpoBase = (s.cuerpoAjustado ?? "").trim() || plantilla.cuerpo;
  if (cuerpoBase.length > 20000) return { ok: false, error: "El texto del documento es demasiado largo." };

  const institucion = await obtenerInstitucion();
  const firmante = plantilla.firmante?.activo ? plantilla.firmante : null;
  const anio = new Date().getFullYear().toString();
  const capturadosLimpios = Object.fromEntries(
    extras.map((c) => [c.clave, (s.capturados[c.clave] ?? "").trim()]).filter(([, v]) => v)
  );

  for (let intento = 0; intento < 5; intento++) {
    try {
      const documento = await db.$transaction(async (tx) => {
        const folio = await siguienteFolio(tx, plantilla.prefijoFolio, anio, intento);
        const valores: Valores = {
          ...valoresGenerales(institucion, firmante, folio),
          ...(persona?.valores ?? {}),
          ...valoresExtra(extras, capturadosLimpios, institucion?.simboloMoneda ?? "$"),
        };
        const creado = await tx.documentoEmitido.create({
          data: {
            folio,
            plantillaId: plantilla.id,
            alumnoId: plantilla.categoria === "ALUMNO" ? s.alumnoId : null,
            empleadoId: plantilla.categoria === "PERSONAL" ? s.empleadoId : null,
            destinatario: persona?.destinatario ?? null,
            titulo: rellenar(plantilla.titulo, valores),
            cuerpo: rellenar(cuerpoBase, valores),
            datos: {
              capturados: capturadosLimpios,
              ...(persona?.tablaCalificaciones ? { tablaCalificaciones: persona.tablaCalificaciones } : {}),
              renglones: Math.min(40, Math.max(1, Number(capturadosLimpios.renglones) || 15)),
            } as Prisma.InputJsonValue,
            firmanteNombre: firmante?.nombre ?? null,
            firmanteCargo: firmante?.cargo ?? null,
            firmaId: firmante?.firmaId ?? null,
            selloId: firmante?.selloId ?? null,
            emitidoPorId: s.emitidoPor.id,
            emitidoPorNombre: s.emitidoPor.nombre,
            solicitudId: s.solicitudId ?? null,
          },
        });
        if (s.solicitudId) {
          await tx.solicitudDocumento.update({
            where: { id: s.solicitudId },
            data: { estado: "ATENDIDA", atendidaEn: new Date() },
          });
        }
        return creado;
      });
      return { ok: true, id: documento.id, folio: documento.folio };
    } catch (error) {
      // Dos documentos al mismo tiempo pidieron el mismo folio: se reintenta.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const campo = String((error.meta as { target?: unknown })?.target ?? "");
        if (campo.includes("solicitudId")) return { ok: false, error: "Esa solicitud ya fue atendida." };
        continue;
      }
      throw error;
    }
  }
  return { ok: false, error: "No se pudo asignar folio. Intenta de nuevo." };
}
