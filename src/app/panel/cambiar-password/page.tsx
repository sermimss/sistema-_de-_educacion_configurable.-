import { requerirSesion } from "@/lib/auth";
import { db } from "@/lib/db";
import { configNumero } from "@/lib/configuracion";
import { Alerta, Tarjeta } from "@/components/ui";
import FormularioCambio from "./FormularioCambio";

export const dynamic = "force-dynamic";

export default async function PaginaCambiarPassword() {
  const sesion = await requerirSesion();
  const usuario = await db.usuario.findUnique({ where: { id: sesion.usuarioId } });
  const minimo = await configNumero("seguridad.longitud_minima_password", 8);

  return (
    <div className="mx-auto max-w-md space-y-4">
      <header>
        <h1 className="text-xl font-semibold text-slate-900">Cambiar contrasena</h1>
      </header>
      {usuario?.debeCambiarPassword && (
        <Alerta tipo="aviso">
          Tu cuenta usa una contrasena temporal. Cambiala para poder usar el sistema.
        </Alerta>
      )}
      <Tarjeta>
        <FormularioCambio minimo={minimo} />
      </Tarjeta>
    </div>
  );
}
