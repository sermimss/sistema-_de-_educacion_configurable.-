import type { ModoRedondeo } from "@prisma/client";

export type EscalaBasica = {
  valorMinimo: number;
  valorMaximo: number;
  decimales: number;
  redondeo: ModoRedondeo;
  minimaAprobatoria: number;
};

/// Aplica el modo de redondeo configurado por la institucion.
/// NINGUNO trunca: 8.99 con 1 decimal queda en 8.9, no en 9.0.
export function aplicarRedondeo(valor: number, decimales: number, modo: ModoRedondeo): number {
  if (!Number.isFinite(valor)) return 0;
  const factor = 10 ** Math.max(0, decimales);
  switch (modo) {
    case "MATEMATICO":
      return Math.round(valor * factor) / factor;
    case "HACIA_ARRIBA":
      return Math.ceil(valor * factor) / factor;
    case "HACIA_ABAJO":
      return Math.floor(valor * factor) / factor;
    case "NINGUNO":
    default:
      return Math.trunc(valor * factor) / factor;
  }
}

export function normalizarConEscala(valor: number, escala: EscalaBasica): number {
  const acotado = Math.min(Math.max(valor, escala.valorMinimo), escala.valorMaximo);
  return aplicarRedondeo(acotado, escala.decimales, escala.redondeo);
}

export function aprueba(valor: number | null | undefined, escala: EscalaBasica): boolean {
  if (valor == null) return false;
  return valor >= escala.minimaAprobatoria;
}

export type RubroConActividades = {
  id: number;
  nombre: string;
  peso: number;
  actividades: {
    id: number;
    puntosMaximos: number;
    calificacion: number | null;
  }[];
};

export type ResultadoRubro = {
  rubroId: number;
  nombre: string;
  peso: number;
  /// Porcentaje logrado dentro del rubro (0 a 1), o null si no hay nada capturado.
  logro: number | null;
  actividadesCalificadas: number;
  actividadesTotales: number;
};

export type CalculoSugerido = {
  rubros: ResultadoRubro[];
  sumaPesos: number;
  /// Calificacion sugerida en la escala de la institucion, o null si no hay
  /// nada capturado todavia.
  sugerida: number | null;
  /// Peso efectivamente considerado (los rubros sin capturas no cuentan).
  pesoConsiderado: number;
};

/// Calcula la calificacion sugerida del periodo a partir de los rubros que el
/// docente definio. Es solo una sugerencia: la calificacion oficial siempre la
/// confirma el docente, porque asi lo pidio la institucion.
export function calcularSugerida(
  rubros: RubroConActividades[],
  escala: EscalaBasica
): CalculoSugerido {
  const resultados: ResultadoRubro[] = rubros.map((rubro) => {
    const calificadas = rubro.actividades.filter((a) => a.calificacion != null);
    const puntosPosibles = calificadas.reduce((suma, a) => suma + a.puntosMaximos, 0);
    const puntosObtenidos = calificadas.reduce((suma, a) => suma + (a.calificacion ?? 0), 0);
    return {
      rubroId: rubro.id,
      nombre: rubro.nombre,
      peso: rubro.peso,
      logro: puntosPosibles > 0 ? puntosObtenidos / puntosPosibles : null,
      actividadesCalificadas: calificadas.length,
      actividadesTotales: rubro.actividades.length,
    };
  });

  const conCapturas = resultados.filter((r) => r.logro != null && r.peso > 0);
  const pesoConsiderado = conCapturas.reduce((suma, r) => suma + r.peso, 0);
  const sumaPesos = rubros.reduce((suma, r) => suma + r.peso, 0);

  if (pesoConsiderado === 0) {
    return { rubros: resultados, sumaPesos, sugerida: null, pesoConsiderado: 0 };
  }

  // El logro se pondera solo entre los rubros que ya tienen capturas, para que
  // a media parcial la sugerencia no salga artificialmente baja.
  const logroPonderado = conCapturas.reduce(
    (suma, r) => suma + (r.logro ?? 0) * (r.peso / pesoConsiderado),
    0
  );
  const rango = escala.valorMaximo - escala.valorMinimo;
  const bruta = escala.valorMinimo + logroPonderado * rango;

  return {
    rubros: resultados,
    sumaPesos,
    pesoConsiderado,
    sugerida: normalizarConEscala(bruta, escala),
  };
}

/// Promedio de los periodos, respetando el peso de cada uno.
export function promedioDePeriodos(
  calificaciones: { calificacion: number | null; peso: number }[],
  escala: EscalaBasica
): number | null {
  const validas = calificaciones.filter((c) => c.calificacion != null && c.peso > 0);
  if (validas.length === 0) return null;
  const pesoTotal = validas.reduce((suma, c) => suma + c.peso, 0);
  const suma = validas.reduce((acumulado, c) => acumulado + (c.calificacion ?? 0) * c.peso, 0);
  return normalizarConEscala(suma / pesoTotal, escala);
}

export function promedioSimple(valores: number[], escala: EscalaBasica): number | null {
  if (valores.length === 0) return null;
  const suma = valores.reduce((total, valor) => total + valor, 0);
  return normalizarConEscala(suma / valores.length, escala);
}
