/// Referencia de pago de cada alumno: solo numeros (todos los bancos la
/// aceptan en el concepto), fija, con un digito verificador (algoritmo de
/// Luhn) para detectar si se escribio mal. Ej. alumno 17 -> 000000174.

function digitoLuhn(numero: string): number {
  let suma = 0;
  let doble = true;
  for (let i = numero.length - 1; i >= 0; i--) {
    let d = Number(numero[i]);
    if (doble) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    suma += d;
    doble = !doble;
  }
  return (10 - (suma % 10)) % 10;
}

export function referenciaDeAlumno(alumnoId: number): string {
  const base = String(alumnoId).padStart(8, "0");
  return `${base}${digitoLuhn(base)}`;
}

/// El alumno al que corresponde una referencia, o null si no es valida.
export function alumnoDeReferencia(texto: string): number | null {
  const limpio = texto.replace(/[\s-]/g, "");
  if (!/^\d{9}$/.test(limpio)) return null;
  const base = limpio.slice(0, 8);
  if (digitoLuhn(base) !== Number(limpio[8])) return null;
  const id = Number(base);
  return id > 0 ? id : null;
}
