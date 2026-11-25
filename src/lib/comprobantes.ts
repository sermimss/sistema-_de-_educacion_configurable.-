import { validarArchivos } from "./archivosEntrega";

/// Comprobantes de pago: solo PDF o imagen (una foto del ticket o la captura
/// de la transferencia), hasta 10 MB, revisados por su contenido.
const PERMITIDOS = ["application/pdf", "image/png", "image/jpeg", "image/gif", "image/webp"];

export async function validarComprobante(archivo: FormDataEntryValue | null) {
  if (!(archivo instanceof File) || archivo.size === 0) return { ok: false as const, error: "Sube la foto o el PDF de tu comprobante." };
  const r = await validarArchivos([archivo]);
  if (!r.ok) return r;
  const a = r.archivos[0];
  if (!PERMITIDOS.includes(a.mime)) return { ok: false as const, error: "El comprobante debe ser un PDF o una imagen (foto o captura de pantalla)." };
  return { ok: true as const, archivo: a };
}
