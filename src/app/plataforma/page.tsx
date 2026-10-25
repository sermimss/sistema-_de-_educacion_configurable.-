import { redirect } from "next/navigation";
import { Alerta, Tarjeta } from "@/components/ui";
import { duenoActual, duenoRegistrado, hayClaveArranque } from "@/lib/dueno";
import { modoPlataforma } from "@/lib/modo";
import { FormularioEntrarDueno, FormularioPrimerDueno } from "./Formularios";

export const dynamic = "force-dynamic";

export default async function PaginaPlataforma() {
  if (!modoPlataforma()) redirect("/");
  if (await duenoActual()) redirect("/plataforma/panel");
  const registrado = await duenoRegistrado();

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <Tarjeta
          titulo="Administracion de la plataforma"
          descripcion={registrado ? "Solo para el dueno de la plataforma." : "Crea la cuenta del dueno."}
        >
          {registrado ? (
            <FormularioEntrarDueno />
          ) : hayClaveArranque() ? (
            <FormularioPrimerDueno />
          ) : (
            <Alerta tipo="aviso">
              Para crear la cuenta del dueno, define la variable PLATAFORMA_CLAVE_ARRANQUE (minimo 12
              caracteres) en el entorno del servidor y vuelve a cargar esta pagina.
            </Alerta>
          )}
        </Tarjeta>
      </div>
    </main>
  );
}
