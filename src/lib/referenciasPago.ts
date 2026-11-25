/// Metodos en los que la referencia del banco o del comprobante es
/// obligatoria (para poder conciliar despues). Sin acceso a la base: lo usa
/// tambien el formulario del navegador.
export const REQUIEREN_REFERENCIA = ["TRANSFERENCIA", "DEPOSITO", "TARJETA_CREDITO", "TARJETA_DEBITO", "CHEQUE", "PAGO_EN_LINEA"] as const;

export function requiereReferencia(metodo: string): boolean {
  return (REQUIEREN_REFERENCIA as readonly string[]).includes(metodo);
}
