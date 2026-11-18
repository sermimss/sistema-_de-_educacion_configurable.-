import Link from "next/link";
import { redirect } from "next/navigation";
import { Alerta, Tarjeta } from "@/components/ui";
import { duenoActual, duenoRegistrado, hayClaveArranque } from "@/lib/dueno";
import { modoPlataforma } from "@/lib/modo";
import { FormularioEntrarDueno, FormularioPrimerDueno, FormularioRecuperarDueno } from "./Formularios";

export const dynamic = "force-dynamic";

export default async function PaginaPlataforma({
  searchParams,
}: {
  searchParams: Promise<{ recuperar?: string }>;
}) {
  if (!modoPlataforma()) redirect("/");
  if (await duenoActual()) redirect("/plataforma/panel");
  const registrado = await duenoRegistrado();
  const recuperar = registrado && (await searchParams).recuperar === "1";

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <Tarjeta
          titulo="Administracion de la plataforma"
          descripcion={
            recuperar
              ? "Te mostramos tu usuario y pones una contrasena nueva."
              : registrado
                ? "Solo para el dueno de la plataforma."
                : "Crea la cuenta del dueno."
          }
        >
          {recuperar ? (
            <div className="space-y-4">
              <FormularioRecuperarDueno />
              <Link href="/plataforma" className="block text-center text-sm text-marca-600 hover:underline">
                ← Volver a entrar
              </Link>
            </div>
          ) : registrado ? (
            <div className="space-y-4">
              <FormularioEntrarDueno />
              <Link href="/plataforma?recuperar=1" className="block text-center text-sm text-marca-600 hover:underline">
                ¿Olvidaste tu usuario o contrasena?
              </Link>
            </div>
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
