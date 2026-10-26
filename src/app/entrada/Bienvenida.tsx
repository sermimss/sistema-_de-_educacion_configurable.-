import Link from "next/link";
import { Tarjeta } from "@/components/ui";
import { FormularioMiColegio } from "./Formularios";

export function nombrePlataforma(): string {
  return process.env.PLATAFORMA_NOMBRE?.trim() || "Plataforma de gestion escolar";
}

/// La pregunta de entrada de la plataforma: o ya perteneces a un colegio, o
/// vienes a contratar el servicio y dar de alta el tuyo.
export function Bienvenida({ recordado }: { recordado: { direccion: string; nombre: string } | null }) {
  return (
    <main className="min-h-screen px-4 py-12">
      <div className="mx-auto max-w-4xl">
        <header className="mb-10 text-center">
          <h1 className="text-2xl font-semibold text-slate-900">{nombrePlataforma()}</h1>
          <p className="mt-2 text-sm text-slate-600">
            Control escolar, calificaciones, asistencia y finanzas de tu colegio.
          </p>
        </header>

        {recordado && (
          <div className="mb-6 rounded-lg border border-marca-100 bg-marca-50 px-4 py-3 text-center text-sm text-slate-700">
            La ultima vez entraste a <span className="font-semibold">{recordado.nombre}</span>.{" "}
            <Link href={`/${recordado.direccion}`} className="font-medium text-marca-700 underline">
              Entrar ahi
            </Link>
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          <Tarjeta
            titulo="Ya tengo un colegio registrado"
            descripcion="Entra con el usuario y la contrasena que te dio tu colegio."
          >
            <FormularioMiColegio />
          </Tarjeta>
          <Tarjeta
            titulo="Quiero contratar el servicio"
            descripcion="Da de alta tu colegio y configuralo a tu medida."
          >
            <div className="space-y-4 text-sm text-slate-600">
              <p>
                Con el codigo de alta que te entregamos al contratar, el asistente te guia para
                configurar tu colegio: planteles, planes de estudio, evaluacion, asistencia y
                cobros. Al terminar recibes la direccion propia de tu colegio.
              </p>
              <Link
                href="/alta"
                className="inline-flex w-full items-center justify-center rounded-lg bg-marca-600 px-4 py-2 text-sm font-medium text-marca-contraste hover:bg-marca-700"
              >
                Dar de alta mi colegio
              </Link>
            </div>
          </Tarjeta>
        </div>
      </div>
    </main>
  );
}
