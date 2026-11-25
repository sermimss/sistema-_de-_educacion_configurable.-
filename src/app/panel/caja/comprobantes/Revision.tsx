"use client";

import { useActionState, useEffect, startTransition, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alerta, Boton, Campo } from "@/components/ui";
import { accionConfirmarComprobante, accionRechazarComprobante, type EstadoRevisionComprobante } from "./acciones";

export function RevisionComprobante({ id, monto, referencia }: { id: number; monto: number; referencia: string }) {
  const [confirmacion, confirmar, confirmando] = useActionState<EstadoRevisionComprobante, FormData>(accionConfirmarComprobante, {});
  const [rechazo, rechazar, rechazando] = useActionState<EstadoRevisionComprobante, FormData>(accionRechazarComprobante, {});
  const router = useRouter();
  // Se envia sin que React limpie el formulario: tras el aviso de duplicado se conserva lo editado.
  const enviar = (accion: (datos: FormData) => void) => (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const boton = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
    const datos = new FormData(e.currentTarget, boton);
    startTransition(() => accion(datos));
  };
  useEffect(() => {
    if (confirmacion.ok || rechazo.ok) router.refresh();
  }, [confirmacion, rechazo, router]);

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <form onSubmit={enviar(confirmar)} className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50/40 p-3" data-confirmar-comprobante={id}>
        <input type="hidden" name="comprobanteId" value={id} />
        {confirmacion.error && (
          <Alerta tipo="error">
            {confirmacion.error}
            {confirmacion.sinCaja && (
              <>
                {" "}
                <Link href="/panel/caja" className="font-medium underline">Abrir mi caja</Link>
              </>
            )}
          </Alerta>
        )}
        {confirmacion.duplicado && (
          <p className="text-xs text-amber-900" data-aviso-duplicado>
            Pago anterior con esa referencia: {confirmacion.duplicado.folio} · {confirmacion.duplicado.alumno} · {confirmacion.duplicado.monto}
          </p>
        )}
        <div className="grid gap-2 sm:grid-cols-2">
          <Campo etiqueta="Monto a registrar" name="monto" type="number" step="0.01" min={0.01} required defaultValue={monto} />
          <Campo etiqueta="Referencia" name="referencia" required defaultValue={referencia} />
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {confirmacion.duplicado && (
            <Boton type="submit" name="confirmarDuplicado" value="1" variante="secundario" disabled={confirmando}>
              Es otro pago: confirmar
            </Boton>
          )}
          <Boton type="submit" disabled={confirmando}>{confirmando ? "Registrando..." : "Confirmar y registrar el pago"}</Boton>
        </div>
      </form>
      <form onSubmit={enviar(rechazar)} className="space-y-2 rounded-lg border border-red-200 bg-red-50/40 p-3" data-rechazar-comprobante={id}>
        <input type="hidden" name="comprobanteId" value={id} />
        {rechazo.error && <Alerta tipo="error">{rechazo.error}</Alerta>}
        <Campo etiqueta="Motivo del rechazo" name="motivo" maxLength={500} placeholder="Ej. el deposito no aparece en el banco" />
        <div className="flex justify-end">
          <Boton type="submit" variante="peligro" disabled={rechazando}>{rechazando ? "Rechazando..." : "Rechazar"}</Boton>
        </div>
      </form>
    </div>
  );
}
