import bcrypt from "bcryptjs";

const RONDAS = 12;

export async function hashPassword(plano: string): Promise<string> {
  return bcrypt.hash(plano, RONDAS);
}

export async function verificarPassword(plano: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plano, hash);
}

/// Reglas minimas de contrasena. La longitud es configurable por la escuela.
export function validarFortaleza(plano: string, minimo = 8): string | null {
  if (plano.length < minimo) return `La contrasena debe tener al menos ${minimo} caracteres.`;
  if (!/[a-zA-Z]/.test(plano)) return "La contrasena debe incluir al menos una letra.";
  if (!/[0-9]/.test(plano)) return "La contrasena debe incluir al menos un numero.";
  return null;
}
