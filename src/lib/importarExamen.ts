import type { TipoPregunta } from "@prisma/client";

/// Lee un examen ya escrito por el docente en texto con un formato sencillo:
///
///   1. ¿Cuanto es 2 + 2? (2 puntos)
///   a) 3
///   *b) 4
///   c) 5
///
///   2. ¿Cuales son numeros pares?
///   *a) 2
///   b) 3
///   *c) 8
///
///   3. El 7 es un numero par.
///   Respuesta: Falso
///
///   4. Explica que es una funcion. (5 puntos)
///
/// - Cada pregunta empieza con su numero ("1." o "1)"). Puede seguir en
///   varios renglones.
/// - Las opciones empiezan con una letra ("a)" o "a."), hasta 6.
/// - La correcta se marca con un asterisco (*b) o con un renglon
///   "Respuesta: b" (o "Respuesta: a, c" si son varias).
/// - Una correcta: opcion multiple. Varias: varias correctas.
/// - Sin opciones y con "Respuesta: Verdadero/Falso": verdadero o falso.
/// - Sin opciones ni respuesta: abierta (la califica el docente).
/// - Puntos al final de la pregunta: "(2 puntos)" o "[2 pts]"; si no, 1.
/// - Lo que este antes de la primera pregunta (titulo, instrucciones) se
///   ignora.

export type PreguntaLeida = {
  linea: number;
  tipo: TipoPregunta;
  enunciado: string;
  puntos: number;
  opciones: { texto: string; correcta: boolean }[];
};

export type ErrorLectura = { linea: number; mensaje: string };

export const MAX_PREGUNTAS = 100;
const MAX_OPCIONES = 6;

const RE_PREGUNTA = /^\s*(\d{1,3})\s*[.)]\s*(.*)$/;
const RE_OPCION = /^\s*(\*)?\s*([a-hA-H])\s*[.)]\s*(\*)?\s*(.*?)\s*(\*)?\s*$/;
const RE_RESPUESTA = /^\s*(?:respuesta|resp|r)\s*[:=]\s*(.+?)\s*$/i;
const RE_PUNTOS = /\s*[([]\s*(\d+(?:[.,]\d+)?)\s*(?:puntos?|pts?|pt)\.?\s*[)\]]\s*$/i;

function sinAcentos(t: string): string {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

const esVerdadero = (t: string) => ["v", "verdadero", "cierto", "true"].includes(sinAcentos(t));
const esFalso = (t: string) => ["f", "falso", "false"].includes(sinAcentos(t));

type EnCurso = {
  linea: number;
  enunciado: string[];
  puntos: number;
  opciones: { letra: string; texto: string; correcta: boolean; linea: number }[];
  respuesta: { valor: string; linea: number } | null;
};

export function leerExamenTexto(texto: string): { preguntas: PreguntaLeida[]; errores: ErrorLectura[] } {
  const renglones = texto.replace(/\r\n?/g, "\n").split("\n");
  const preguntas: PreguntaLeida[] = [];
  const errores: ErrorLectura[] = [];
  let actual: EnCurso | null = null;

  const cerrar = () => {
    if (!actual) return;
    const p = actual;
    actual = null;
    const enunciado = p.enunciado.join("\n").trim();
    const error = (mensaje: string, linea = p.linea) => errores.push({ linea, mensaje });
    if (!enunciado) return error("La pregunta no tiene texto.");
    if (enunciado.length > 3000) return error("La pregunta es demasiado larga (maximo 3000 caracteres).");

    if (p.opciones.length > 0) {
      if (p.opciones.length < 2) return error("Una pregunta con opciones necesita al menos dos.");
      if (p.opciones.length > MAX_OPCIONES) return error(`Maximo ${MAX_OPCIONES} opciones por pregunta.`);
      const vacia = p.opciones.find((o) => !o.texto);
      if (vacia) return error(`La opcion ${vacia.letra}) esta vacia.`, vacia.linea);
      const larga = p.opciones.find((o) => o.texto.length > 500);
      if (larga) return error(`La opcion ${larga.letra}) es demasiado larga.`, larga.linea);
      const opciones = p.opciones.map((o) => ({ ...o }));
      if (p.respuesta) {
        const letras = p.respuesta.valor.toLowerCase().split(/[\s,;y]+/).filter(Boolean);
        for (const letra of letras) {
          const o = opciones.find((x) => x.letra === letra.replace(/[).]$/, ""));
          if (!o) return error(`La respuesta "${letra}" no corresponde a ninguna opcion.`, p.respuesta.linea);
          o.correcta = true;
        }
      }
      const correctas = opciones.filter((o) => o.correcta).length;
      if (correctas === 0) return error("Marca la respuesta correcta con un asterisco (*b) o con \"Respuesta: b\".");
      const vf = opciones.length === 2 && esVerdadero(opciones[0].texto) && esFalso(opciones[1].texto);
      if (vf && correctas !== 1) return error("En verdadero o falso marca solo una respuesta.");
      return preguntas.push({
        linea: p.linea,
        tipo: vf ? "VERDADERO_FALSO" : correctas === 1 ? "OPCION_UNICA" : "OPCION_MULTIPLE",
        enunciado,
        puntos: p.puntos,
        opciones: vf
          ? [{ texto: "Verdadero", correcta: opciones[0].correcta }, { texto: "Falso", correcta: opciones[1].correcta }]
          : opciones.map((o) => ({ texto: o.texto, correcta: o.correcta })),
      });
    }

    if (p.respuesta) {
      const valor = p.respuesta.valor;
      if (esVerdadero(valor) || esFalso(valor)) {
        return preguntas.push({
          linea: p.linea,
          tipo: "VERDADERO_FALSO",
          enunciado,
          puntos: p.puntos,
          opciones: [
            { texto: "Verdadero", correcta: esVerdadero(valor) },
            { texto: "Falso", correcta: esFalso(valor) },
          ],
        });
      }
      if (sinAcentos(valor) !== "abierta") {
        return error(`No entiendo la respuesta "${valor}": usa Verdadero, Falso o la letra de la opcion.`, p.respuesta.linea);
      }
    }
    preguntas.push({ linea: p.linea, tipo: "ABIERTA", enunciado, puntos: p.puntos, opciones: [] });
  };

  renglones.forEach((renglon, i) => {
    const linea = i + 1;
    if (!renglon.trim()) return;
    const pregunta = RE_PREGUNTA.exec(renglon);
    if (pregunta) {
      cerrar();
      let enunciado = pregunta[2];
      let puntos = 1;
      const conPuntos = RE_PUNTOS.exec(enunciado);
      if (conPuntos) {
        puntos = Number(conPuntos[1].replace(",", "."));
        enunciado = enunciado.slice(0, conPuntos.index);
      }
      if (!(puntos > 0 && puntos <= 1000)) errores.push({ linea, mensaje: "Los puntos deben ser mayores a 0 y hasta 1000." });
      actual = { linea, enunciado: [enunciado], puntos: Math.round(puntos * 100) / 100, opciones: [], respuesta: null };
      return;
    }
    if (!actual) return; // titulo o instrucciones antes de la primera pregunta
    const p: EnCurso = actual;
    const respuesta = RE_RESPUESTA.exec(renglon);
    if (respuesta) {
      if (p.respuesta) errores.push({ linea, mensaje: "La pregunta ya tiene un renglon de respuesta." });
      p.respuesta = { valor: respuesta[1], linea };
      return;
    }
    const opcion = RE_OPCION.exec(renglon);
    if (opcion && !p.respuesta) {
      const letra = opcion[2].toLowerCase();
      const esperada = String.fromCharCode(97 + p.opciones.length);
      if (letra === esperada) {
        p.opciones.push({ letra, texto: opcion[4].trim(), correcta: Boolean(opcion[1] || opcion[3] || opcion[5]), linea });
        return;
      }
    }
    if (p.opciones.length === 0 && !p.respuesta) {
      p.enunciado.push(renglon.trim());
      return;
    }
    errores.push({ linea, mensaje: `No entiendo este renglon: "${renglon.trim().slice(0, 60)}"` });
  });
  cerrar();

  if (preguntas.length + errores.length === 0) {
    errores.push({ linea: 1, mensaje: "No encontre preguntas: cada pregunta debe empezar con su numero, por ejemplo \"1.\"" });
  }
  if (preguntas.length > MAX_PREGUNTAS) errores.push({ linea: 1, mensaje: `Maximo ${MAX_PREGUNTAS} preguntas por carga.` });
  errores.sort((a, b) => a.linea - b.linea);
  return { preguntas, errores };
}

export const EJEMPLO_EXAMEN = `Parcial 1 de Matematicas
(lo que va antes de la primera pregunta se ignora)

1. ¿Cuanto es 2 + 2? (2 puntos)
a) 3
*b) 4
c) 5

2. ¿Cuales son numeros pares? (2 puntos)
*a) 2
b) 3
*c) 8

3. El 7 es un numero par.
Respuesta: Falso

4. ¿Cual es la capital de Mexico?
a) Guadalajara
b) Ciudad de Mexico
c) Monterrey
Respuesta: b

5. Explica con tus palabras que es una funcion. (5 puntos)
`;
