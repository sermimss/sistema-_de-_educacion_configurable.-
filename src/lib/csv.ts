/// Lector de CSV sin dependencias. Soporta comillas dobles, comas dentro de
/// comillas, saltos de linea dentro de comillas y separador ; o , (se detecta).

export type FilaCsv = Record<string, string>;

function detectarSeparador(texto: string): string {
  const primeraLinea = texto.split(/\r?\n/, 1)[0] ?? "";
  const comas = (primeraLinea.match(/,/g) ?? []).length;
  const puntoComa = (primeraLinea.match(/;/g) ?? []).length;
  return puntoComa > comas ? ";" : ",";
}

function dividirFilas(texto: string, separador: string): string[][] {
  const filas: string[][] = [];
  let campo = "";
  let fila: string[] = [];
  let enComillas = false;

  for (let i = 0; i < texto.length; i++) {
    const caracter = texto[i];

    if (enComillas) {
      if (caracter === '"') {
        if (texto[i + 1] === '"') {
          campo += '"';
          i++;
        } else {
          enComillas = false;
        }
      } else {
        campo += caracter;
      }
      continue;
    }

    if (caracter === '"') {
      enComillas = true;
    } else if (caracter === separador) {
      fila.push(campo);
      campo = "";
    } else if (caracter === "\n") {
      fila.push(campo);
      filas.push(fila);
      fila = [];
      campo = "";
    } else if (caracter !== "\r") {
      campo += caracter;
    }
  }

  if (campo.length > 0 || fila.length > 0) {
    fila.push(campo);
    filas.push(fila);
  }

  return filas.filter((f) => f.some((valor) => valor.trim() !== ""));
}

/// Normaliza el encabezado: minusculas, sin acentos, con guion bajo.
export function normalizarEncabezado(valor: string): string {
  return valor
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

export function leerCsv(texto: string): { encabezados: string[]; filas: FilaCsv[] } {
  const limpio = texto.replace(/^﻿/, "");
  const separador = detectarSeparador(limpio);
  const crudas = dividirFilas(limpio, separador);
  if (crudas.length === 0) return { encabezados: [], filas: [] };

  const encabezados = crudas[0].map(normalizarEncabezado);
  const filas = crudas.slice(1).map((valores) => {
    const fila: FilaCsv = {};
    encabezados.forEach((encabezado, indice) => {
      fila[encabezado] = (valores[indice] ?? "").trim();
    });
    return fila;
  });

  return { encabezados, filas };
}

export function generarCsv(encabezados: string[], filas: string[][]): string {
  const escapar = (valor: string) =>
    /[",\n;]/.test(valor) ? `"${valor.replace(/"/g, '""')}"` : valor;
  return [encabezados, ...filas].map((fila) => fila.map(escapar).join(",")).join("\n");
}
