import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

type VarianteBoton = "primario" | "secundario" | "peligro" | "fantasma";

const VARIANTES: Record<VarianteBoton, string> = {
  primario: "bg-marca-600 text-white hover:bg-marca-700 disabled:bg-slate-300",
  secundario: "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50",
  peligro: "bg-red-600 text-white hover:bg-red-700",
  fantasma: "text-slate-600 hover:bg-slate-100",
};

export function Boton({
  variante = "primario",
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: VarianteBoton }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium
        transition disabled:cursor-not-allowed ${VARIANTES[variante]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Campo({
  etiqueta,
  ayuda,
  error,
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { etiqueta?: string; ayuda?: string; error?: string }) {
  // El control va dentro del <label> para que la etiqueta quede asociada
  // aunque el campo no tenga id ni name (lectores de pantalla y clic en
  // la etiqueta funcionan igual).
  return (
    <div className={className}>
      <label className="block">
        {etiqueta && (
          <span className="etiqueta-campo">
            {etiqueta}
            {props.required && <span className="ml-0.5 text-red-500">*</span>}
          </span>
        )}
        <input id={props.id ?? props.name} className="campo" {...props} />
      </label>
      {ayuda && !error && <p className="mt-1 text-xs text-slate-500">{ayuda}</p>}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function Selector({
  etiqueta,
  ayuda,
  children,
  className = "",
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { etiqueta?: string; ayuda?: string }) {
  return (
    <div className={className}>
      <label className="block">
        {etiqueta && <span className="etiqueta-campo">{etiqueta}</span>}
        <select id={props.id ?? props.name} className="campo" {...props}>
          {children}
        </select>
      </label>
      {ayuda && <p className="mt-1 text-xs text-slate-500">{ayuda}</p>}
    </div>
  );
}

export function Tarjeta({
  titulo,
  descripcion,
  acciones,
  children,
  className = "",
}: {
  titulo?: string;
  descripcion?: string;
  acciones?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`tarjeta ${className}`}>
      {(titulo || acciones) && (
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            {titulo && <h2 className="text-base font-semibold text-slate-900">{titulo}</h2>}
            {descripcion && <p className="mt-0.5 text-sm text-slate-500">{descripcion}</p>}
          </div>
          {acciones}
        </header>
      )}
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

export function Alerta({
  tipo = "info",
  children,
}: {
  tipo?: "info" | "exito" | "error" | "aviso";
  children: ReactNode;
}) {
  const estilos = {
    info: "bg-blue-50 text-blue-800 border-blue-200",
    exito: "bg-emerald-50 text-emerald-800 border-emerald-200",
    error: "bg-red-50 text-red-800 border-red-200",
    aviso: "bg-amber-50 text-amber-900 border-amber-200",
  }[tipo];
  return <div className={`rounded-lg border px-4 py-3 text-sm ${estilos}`}>{children}</div>;
}

export function Insignia({
  children,
  tono = "neutro",
}: {
  children: ReactNode;
  tono?: "neutro" | "exito" | "alerta" | "peligro";
}) {
  const estilos = {
    neutro: "bg-slate-100 text-slate-700",
    exito: "bg-emerald-100 text-emerald-800",
    alerta: "bg-amber-100 text-amber-800",
    peligro: "bg-red-100 text-red-800",
  }[tono];
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${estilos}`}>
      {children}
    </span>
  );
}

export function EstadoVacio({ titulo, mensaje }: { titulo: string; mensaje?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 px-6 py-10 text-center">
      <p className="text-sm font-medium text-slate-700">{titulo}</p>
      {mensaje && <p className="mt-1 text-sm text-slate-500">{mensaje}</p>}
    </div>
  );
}
