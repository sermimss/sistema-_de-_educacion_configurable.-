/// Marca discreta junto al nombre de un alumno con adeudo vencido. Solo se
/// muestra al docente si el colegio lo activa en Configuracion (Portales); no
/// muestra montos.
export function MarcaAdeudo({ visible }: { visible?: boolean }) {
  if (!visible) return null;
  return (
    <span
      className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800"
      title="Tiene un adeudo vencido con el colegio"
      data-marca-adeudo
    >
      adeudo
    </span>
  );
}
