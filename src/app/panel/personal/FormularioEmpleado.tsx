"use client";

import { useActionState } from "react";
import { Alerta, Boton, Campo, Selector, Tarjeta } from "@/components/ui";
import { actualizarEmpleado, crearEmpleado, type EstadoFormulario } from "./acciones";

export type EmpleadoEditable = {
  id: number;
  numeroEmpleado: string;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string | null;
  esDocente: boolean;
  puesto: string | null;
  gradoAcademico: string | null;
  email: string | null;
  telefono: string | null;
  rfc: string | null;
  curp: string | null;
  nss: string | null;
  tipoContrato: string | null;
  salarioBase: string | null;
  pagoPorHora: string | null;
  banco: string | null;
  clabe: string | null;
  estado: string;
  tieneUsuario: boolean;
};

export default function FormularioEmpleado({
  empleado,
  nominaActiva,
}: {
  empleado?: EmpleadoEditable;
  nominaActiva: boolean;
}) {
  const esEdicion = Boolean(empleado);
  const [estado, accion, pendiente] = useActionState<EstadoFormulario, FormData>(
    esEdicion ? actualizarEmpleado : crearEmpleado,
    {}
  );

  return (
    <form action={accion} className="space-y-4">
      {empleado && <input type="hidden" name="id" value={empleado.id} />}
      {estado.error && (
        <Alerta tipo="error">
          <p className="font-medium">{estado.error}</p>
          {estado.detalles && (
            <ul className="mt-1 list-inside list-disc text-xs">
              {estado.detalles.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          )}
        </Alerta>
      )}
      {estado.ok && estado.mensaje && <Alerta tipo="exito">{estado.mensaje}</Alerta>}

      <Tarjeta titulo="Datos del personal">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Campo
            etiqueta="Numero de empleado"
            name="numeroEmpleado"
            defaultValue={empleado?.numeroEmpleado ?? ""}
            ayuda={esEdicion ? undefined : "Si lo dejas vacio se genera solo."}
          />
          <Campo etiqueta="Nombre(s)" name="nombres" required defaultValue={empleado?.nombres ?? ""} />
          <Campo
            etiqueta="Apellido paterno"
            name="apellidoPaterno"
            required
            defaultValue={empleado?.apellidoPaterno ?? ""}
          />
          <Campo
            etiqueta="Apellido materno"
            name="apellidoMaterno"
            defaultValue={empleado?.apellidoMaterno ?? ""}
          />
          <Campo etiqueta="Puesto" name="puesto" defaultValue={empleado?.puesto ?? ""} />
          <Campo
            etiqueta="Grado academico"
            name="gradoAcademico"
            defaultValue={empleado?.gradoAcademico ?? ""}
          />
          <Campo etiqueta="Correo" name="email" type="email" defaultValue={empleado?.email ?? ""} />
          <Campo etiqueta="Telefono" name="telefono" defaultValue={empleado?.telefono ?? ""} />
          <Selector etiqueta="Estado" name="estado" defaultValue={empleado?.estado ?? "ACTIVO"}>
            <option value="ACTIVO">Activo</option>
            <option value="LICENCIA">Licencia</option>
            <option value="SUSPENDIDO">Suspendido</option>
            <option value="BAJA">Baja</option>
          </Selector>
          <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 sm:col-span-2">
            <input
              type="checkbox"
              name="esDocente"
              defaultChecked={empleado?.esDocente ?? true}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-marca-600"
            />
            <span>
              <span className="block text-sm font-medium text-slate-800">Imparte clases</span>
              <span className="mt-0.5 block text-xs text-slate-500">
                Solo el personal marcado como docente puede asignarse a una clase.
              </span>
            </span>
          </label>
        </div>
      </Tarjeta>

      {nominaActiva && (
        <Tarjeta titulo="Datos para nomina" descripcion="Se usaran en la Fase 5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Campo etiqueta="RFC" name="rfc" defaultValue={empleado?.rfc ?? ""} />
            <Campo etiqueta="CURP" name="curp" defaultValue={empleado?.curp ?? ""} />
            <Campo etiqueta="NSS" name="nss" defaultValue={empleado?.nss ?? ""} />
            <Selector
              etiqueta="Tipo de contrato"
              name="tipoContrato"
              defaultValue={empleado?.tipoContrato ?? ""}
            >
              <option value="">Sin especificar</option>
              <option value="TIEMPO_COMPLETO">Tiempo completo</option>
              <option value="MEDIO_TIEMPO">Medio tiempo</option>
              <option value="POR_HORAS">Por horas</option>
              <option value="HONORARIOS">Honorarios</option>
              <option value="TEMPORAL">Temporal</option>
            </Selector>
            <Campo
              etiqueta="Salario base"
              name="salarioBase"
              type="number"
              step="0.01"
              min={0}
              defaultValue={empleado?.salarioBase ?? ""}
            />
            <Campo
              etiqueta="Pago por hora"
              name="pagoPorHora"
              type="number"
              step="0.01"
              min={0}
              defaultValue={empleado?.pagoPorHora ?? ""}
            />
            <Campo etiqueta="Banco" name="banco" defaultValue={empleado?.banco ?? ""} />
            <Campo etiqueta="CLABE" name="clabe" defaultValue={empleado?.clabe ?? ""} />
          </div>
        </Tarjeta>
      )}

      {!esEdicion && (
        <Tarjeta titulo="Acceso al sistema">
          <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3">
            <input
              type="checkbox"
              name="crearUsuario"
              defaultChecked
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-marca-600"
            />
            <span>
              <span className="block text-sm font-medium text-slate-800">Crear cuenta de acceso</span>
              <span className="mt-0.5 block text-xs text-slate-500">
                Usuario y contrasena temporal = el numero de empleado. Requiere correo. El rol es
                Docente si imparte clases, Administrador si no.
              </span>
            </span>
          </label>
        </Tarjeta>
      )}

      <div className="flex justify-end">
        <Boton type="submit" disabled={pendiente}>
          {pendiente ? "Guardando..." : esEdicion ? "Guardar cambios" : "Dar de alta"}
        </Boton>
      </div>
    </form>
  );
}
