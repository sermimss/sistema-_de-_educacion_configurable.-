import Link from "next/link";
import { redirect } from "next/navigation";
import { Tarjeta } from "@/components/ui";
import { modoPlataforma } from "@/lib/modo";
import { FormularioCodigoAlta } from "../entrada/Formularios";

export const dynamic = "force-dynamic";

export default function PaginaAlta() {
  if (!modoPlataforma()) redirect("/");
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <Tarjeta
          titulo="Dar de alta mi colegio"
          descripcion="Escribe el codigo de alta que recibiste al contratar el servicio."
        >
          <FormularioCodigoAlta />
        </Tarjeta>
        <p className="mt-6 text-center text-sm">
          <Link href="/" className="text-marca-600 hover:underline">
            ← Volver al inicio
          </Link>
        </p>
      </div>
    </main>
  );
}
