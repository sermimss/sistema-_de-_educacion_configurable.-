import Link from "next/link";

const PESTANAS = [
  { ruta: "/panel/documentos", etiqueta: "Generar" },
  { ruta: "/panel/documentos/solicitudes", etiqueta: "Solicitudes" },
  { ruta: "/panel/documentos/emitidos", etiqueta: "Historial" },
  { ruta: "/panel/documentos/machotes", etiqueta: "Machotes" },
  { ruta: "/panel/documentos/firmantes", etiqueta: "Firmantes" },
];

export function Pestanas({ actual, pendientes }: { actual: string; pendientes?: number }) {
  return (
    <nav className="no-imprimir flex flex-wrap gap-1 border-b border-slate-200">
      {PESTANAS.map((p) => (
        <Link
          key={p.ruta}
          href={p.ruta}
          className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
            actual === p.ruta
              ? "border-marca-600 text-marca-700"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          {p.etiqueta}
          {p.etiqueta === "Solicitudes" && pendientes ? (
            <span className="ml-1.5 rounded-full bg-marca-600 px-1.5 py-0.5 text-[10px] text-marca-contraste">
              {pendientes}
            </span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}

export const ETIQUETA_CATEGORIA = { ALUMNO: "Alumnos", PERSONAL: "Personal", GENERAL: "Generales" } as const;
