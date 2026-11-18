import { notFound } from "next/navigation";
import { clienteDeEsquema } from "@/lib/clientes";
import { modoPlataforma } from "@/lib/modo";
import { buscarEnlaceRecuperacion } from "@/lib/plataforma";
import { Alerta, Tarjeta } from "@/components/ui";
import { FormularioRecuperarAdministrador } from "./Formulario";

export const dynamic = "force-dynamic";

export default async function PaginaRecuperarAdministrador({ params }: { params: Promise<{ token: string }> }) {
  if (!modoPlataforma()) notFound();
  const { token } = await params;
  const enlace = await buscarEnlaceRecuperacion(token);

  const cuentas = enlace
    ? await clienteDeEsquema(enlace.colegio.esquema).usuario.findMany({
        where: { rol: "ADMIN", activo: true },
        include: { empleado: true },
        orderBy: { id: "asc" },
      })
    : [];

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <Tarjeta
          titulo="Recuperar el acceso de administracion"
          descripcion={enlace ? enlace.colegio.nombre : undefined}
        >
          {!enlace ? (
            <Alerta tipo="aviso">
              Este enlace ya se uso o vencio (dura una hora). Pide uno nuevo a la administracion de la plataforma.
            </Alerta>
          ) : cuentas.length === 0 ? (
            <Alerta tipo="aviso">Este colegio no tiene cuentas de administrador activas.</Alerta>
          ) : (
            <FormularioRecuperarAdministrador
              token={token}
              cuentas={cuentas.map((c) => ({
                id: c.id,
                etiqueta: c.empleado ? `${c.usuario} (${c.empleado.nombres} ${c.empleado.apellidoPaterno})` : c.usuario,
              }))}
            />
          )}
        </Tarjeta>
      </div>
    </main>
  );
}
