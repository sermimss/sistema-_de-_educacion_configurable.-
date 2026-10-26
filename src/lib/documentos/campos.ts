import type { CategoriaDocumento } from "@prisma/client";

/// Campos de los machotes y como se reemplazan. Sin acceso a la base: lo
/// usan el editor y la vista previa en el navegador, y el servidor al emitir.

export type TipoCampoExtra = "texto" | "texto_largo" | "fecha" | "hora" | "numero" | "opcion";

/// Dato que se pide al generar porque el sistema no lo tiene.
export type CampoExtra = {
  clave: string;
  etiqueta: string;
  tipo: TipoCampoExtra;
  requerido: boolean;
  opciones?: string[];
  valorInicial?: string;
};

export type CampoDisponible = { campo: string; etiqueta: string };

const CAMPOS_GENERALES: CampoDisponible[] = [
  { campo: "documento.ciudad_fecha", etiqueta: "Lugar y fecha (Ciudad, Estado, a 26 de octubre de 2026)" },
  { campo: "documento.fecha", etiqueta: "Fecha de hoy (26 de octubre de 2026)" },
  { campo: "documento.folio", etiqueta: "Folio del documento" },
  { campo: "institucion.nombre", etiqueta: "Nombre del colegio" },
  { campo: "institucion.nombre_corto", etiqueta: "Nombre corto del colegio" },
  { campo: "institucion.clave_centro_trabajo", etiqueta: "Clave de centro de trabajo (CCT)" },
  { campo: "institucion.direccion", etiqueta: "Direccion del colegio" },
  { campo: "institucion.ciudad", etiqueta: "Ciudad" },
  { campo: "institucion.telefono", etiqueta: "Telefono del colegio" },
  { campo: "firmante.nombre", etiqueta: "Nombre de quien firma" },
  { campo: "firmante.cargo", etiqueta: "Cargo de quien firma" },
];

const CAMPOS_ALUMNO: CampoDisponible[] = [
  { campo: "alumno.nombre_completo", etiqueta: "Nombre completo" },
  { campo: "alumno.nombres", etiqueta: "Nombre(s)" },
  { campo: "alumno.apellidos", etiqueta: "Apellidos" },
  { campo: "alumno.matricula", etiqueta: "Matricula" },
  { campo: "alumno.curp", etiqueta: "CURP" },
  { campo: "alumno.nivel", etiqueta: "Nivel educativo" },
  { campo: "alumno.plan", etiqueta: "Plan de estudios" },
  { campo: "alumno.grado", etiqueta: "Grado" },
  { campo: "alumno.grupo", etiqueta: "Grupo" },
  { campo: "alumno.turno", etiqueta: "Turno" },
  { campo: "alumno.plantel", etiqueta: "Plantel" },
  { campo: "alumno.inicio_clases", etiqueta: "Inicio de clases de su grupo" },
  { campo: "alumno.fin_clases", etiqueta: "Termino de clases de su grupo" },
  { campo: "alumno.promedio_general", etiqueta: "Promedio general" },
  { campo: "alumno.fecha_ingreso", etiqueta: "Fecha de ingreso" },
  { campo: "alumno.tutor", etiqueta: "Padre, madre o tutor responsable" },
  { campo: "tabla_calificaciones", etiqueta: "Tabla de calificaciones (en su propio parrafo)" },
  { campo: "tabla_control_practicas", etiqueta: "Tabla de control de practicas (en su propio parrafo)" },
];

const CAMPOS_PERSONAL: CampoDisponible[] = [
  { campo: "personal.nombre_completo", etiqueta: "Nombre completo" },
  { campo: "personal.nombres", etiqueta: "Nombre(s)" },
  { campo: "personal.apellidos", etiqueta: "Apellidos" },
  { campo: "personal.numero_empleado", etiqueta: "Numero de empleado" },
  { campo: "personal.puesto", etiqueta: "Puesto" },
  { campo: "personal.grado_academico", etiqueta: "Grado academico" },
  { campo: "personal.rfc", etiqueta: "RFC" },
  { campo: "personal.curp", etiqueta: "CURP" },
  { campo: "personal.fecha_ingreso", etiqueta: "Fecha de ingreso" },
  { campo: "personal.tipo_contrato", etiqueta: "Tipo de contrato" },
];

export function camposDisponibles(categoria: CategoriaDocumento, extras: CampoExtra[]): CampoDisponible[] {
  return [
    ...(categoria === "ALUMNO" ? CAMPOS_ALUMNO : categoria === "PERSONAL" ? CAMPOS_PERSONAL : []),
    ...extras.map((e) => ({ campo: `extra.${e.clave}`, etiqueta: `${e.etiqueta} (se pide al generar)` })),
    ...CAMPOS_GENERALES,
  ];
}

export type Valores = Record<string, string>;

const PATRON_CAMPO = /\{\{\s*([a-z_]+(?:\.[a-z0-9_]+)?)\s*\}\}/g;
const TABLAS = new Set(["tabla_calificaciones", "tabla_control_practicas"]);

/// Reemplaza cada {{campo}} con su valor. Un campo sin dato queda como una
/// linea para llenar a mano, asi el documento nunca sale con llaves.
export function rellenar(cuerpo: string, valores: Valores): string {
  return cuerpo.replace(PATRON_CAMPO, (_todo, campo: string) => {
    if (TABLAS.has(campo)) return `{{${campo}}}`;
    const valor = valores[campo];
    // El valor no puede traer campos nuevos ni tablas: se desarma "{{".
    return valor ? valor.replace(/\{\{/g, "{ {") : "__________";
  });
}

/// Campos que el cuerpo usa y el sistema no reconoce (por un error al escribir).
export function camposDesconocidos(cuerpo: string, categoria: CategoriaDocumento, extras: CampoExtra[]): string[] {
  const conocidos = new Set(camposDisponibles(categoria, extras).map((c) => c.campo));
  const usados = [...cuerpo.matchAll(PATRON_CAMPO)].map((m) => m[1]);
  return [...new Set(usados.filter((u) => !conocidos.has(u) && !u.endsWith("_moneda")))];
}

// ---------------------------------------------------------------------------
// De texto a bloques que se dibujan en la hoja
// ---------------------------------------------------------------------------

export type Tramo = { texto: string; negrita: boolean };
export type Bloque =
  | { tipo: "parrafo"; alineacion: "izquierda" | "derecha" | "centro"; lineas: Tramo[][] }
  | { tipo: "firmas"; textos: string[] }
  | { tipo: "tabla_calificaciones" }
  | { tipo: "tabla_control_practicas" };

function tramos(linea: string): Tramo[] {
  return linea
    .split(/(\*\*[^*]+\*\*)/g)
    .filter(Boolean)
    .map((parte) =>
      parte.startsWith("**") && parte.endsWith("**") && parte.length > 4
        ? { texto: parte.slice(2, -2), negrita: true }
        : { texto: parte, negrita: false }
    );
}

export function aBloques(texto: string): Bloque[] {
  return texto
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((parrafo) => parrafo.trim())
    .filter(Boolean)
    .map((parrafo): Bloque => {
      if (parrafo === "{{tabla_calificaciones}}") return { tipo: "tabla_calificaciones" };
      if (parrafo === "{{tabla_control_practicas}}") return { tipo: "tabla_control_practicas" };
      if (parrafo.startsWith("[firmas]")) {
        return {
          tipo: "firmas",
          textos: parrafo.slice(8).split("|").map((t) => t.trim()).filter(Boolean),
        };
      }
      let alineacion: "izquierda" | "derecha" | "centro" = "izquierda";
      if (parrafo.startsWith("[derecha]")) {
        alineacion = "derecha";
        parrafo = parrafo.slice(9);
      } else if (parrafo.startsWith("[centro]")) {
        alineacion = "centro";
        parrafo = parrafo.slice(8);
      }
      return { tipo: "parrafo", alineacion, lineas: parrafo.split("\n").map(tramos) };
    });
}

/// Fecha "AAAA-MM-DD" en palabras: "26 de octubre de 2026".
export function fechaLarga(fecha: Date | string | null | undefined): string {
  if (!fecha) return "";
  const valor = typeof fecha === "string" ? new Date(`${fecha.slice(0, 10)}T12:00:00Z`) : fecha;
  if (Number.isNaN(valor.getTime())) return "";
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "long", timeZone: "UTC" }).format(valor);
}

/// Valores de los datos capturados al generar, ya con el formato del documento.
export function valoresExtra(extras: CampoExtra[], capturados: Record<string, string>, simboloMoneda = "$"): Valores {
  const valores: Valores = {};
  for (const campo of extras) {
    const crudo = (capturados[campo.clave] ?? "").trim();
    if (!crudo) continue;
    if (campo.tipo === "fecha") valores[`extra.${campo.clave}`] = fechaLarga(crudo);
    else if (campo.tipo === "numero") {
      const numero = Number(crudo);
      valores[`extra.${campo.clave}`] = Number.isFinite(numero)
        ? new Intl.NumberFormat("es-MX", { maximumFractionDigits: 2 }).format(numero)
        : crudo;
      if (Number.isFinite(numero)) {
        valores[`extra.${campo.clave}_moneda`] = `${simboloMoneda}${new Intl.NumberFormat("es-MX", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(numero)}`;
      }
    } else valores[`extra.${campo.clave}`] = crudo;
  }
  return valores;
}

/// Revisa la lista de datos que pide un machote (al editarlo).
export function validarCamposExtra(entrada: unknown): { ok: true; campos: CampoExtra[] } | { ok: false; error: string } {
  if (!Array.isArray(entrada)) return { ok: false, error: "La lista de datos a capturar no es valida." };
  const tipos: TipoCampoExtra[] = ["texto", "texto_largo", "fecha", "hora", "numero", "opcion"];
  const campos: CampoExtra[] = [];
  const vistas = new Set<string>();
  for (const item of entrada as Record<string, unknown>[]) {
    const etiqueta = String(item?.etiqueta ?? "").trim();
    const clave = String(item?.clave ?? "").trim();
    const tipo = String(item?.tipo ?? "") as TipoCampoExtra;
    if (!etiqueta) return { ok: false, error: "Cada dato a capturar necesita un nombre." };
    if (!/^[a-z][a-z0-9_]{0,39}$/.test(clave)) {
      return { ok: false, error: `El campo "${etiqueta}" tiene una clave invalida.` };
    }
    if (vistas.has(clave)) return { ok: false, error: `Hay dos datos con la clave ${clave}.` };
    if (!tipos.includes(tipo)) return { ok: false, error: `El campo "${etiqueta}" tiene un tipo invalido.` };
    vistas.add(clave);
    const opciones =
      tipo === "opcion"
        ? String(Array.isArray(item.opciones) ? item.opciones.join("|") : item.opciones ?? "")
            .split("|")
            .map((o) => o.trim())
            .filter(Boolean)
        : undefined;
    if (tipo === "opcion" && (!opciones || opciones.length < 2)) {
      return { ok: false, error: `El campo "${etiqueta}" necesita al menos dos opciones.` };
    }
    campos.push({
      clave,
      etiqueta: etiqueta.slice(0, 120),
      tipo,
      requerido: Boolean(item.requerido),
      ...(opciones ? { opciones } : {}),
      ...(item.valorInicial ? { valorInicial: String(item.valorInicial).slice(0, 500) } : {}),
    });
  }
  return { ok: true, campos };
}

/// "Fecha de inicio" -> "fecha_de_inicio", para la clave de un dato nuevo.
export function claveDeEtiqueta(etiqueta: string): string {
  return (
    etiqueta
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .replace(/^(\d)/, "c_$1")
      .slice(0, 40) || "dato"
  );
}
