"use client";

import { useActionState } from "react";
import { Alerta, Boton, Campo, Selector, Tarjeta } from "@/components/ui";
import { crearAlumno, actualizarAlumno, type EstadoFormulario } from "./acciones";

export type CatalogosAlumno = {
  planes: { id: number; nombre: string; clave: string; nivel: string }[];
  planteles: { id: number; nombre: string }[];
  turnos: { id: number; nombre: string }[];
};

export type AlumnoEditable = {
  id: number;
  matricula: string;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string | null;
  curp: string | null;
  fechaNacimiento: string | null;
  sexo: string | null;
  email: string | null;
  telefono: string | null;
  direccion: string | null;
  ciudad: string | null;
  codigoPostal: string | null;
  planId: number;
  plantelId: number | null;
  turnoId: number | null;
  estado: string;
  tipoSangre: string | null;
  alergias: string | null;
  padecimientos: string | null;
  rfcFacturacion: string | null;
  tieneUsuario: boolean;
};

const ESTADOS = [
  ["ACTIVO", "Activo"],
  ["BAJA_TEMPORAL", "Baja temporal"],
  ["BAJA_DEFINITIVA", "Baja definitiva"],
  ["EGRESADO", "Egresado"],
  ["SUSPENDIDO", "Suspendido"],
];

export default function FormularioAlumno({
  catalogos,
  alumno,
  exigeCurp,
  muestraMedicos,
}: {
  catalogos: CatalogosAlumno;
  alumno?: AlumnoEditable;
  exigeCurp: boolean;
  muestraMedicos: boolean;
}) {
  const esEdicion = Boolean(alumno);
  const [estado, accion, pendiente] = useActionState<EstadoFormulario, FormData>(
    esEdicion ? actualizarAlumno : crearAlumno,
    {}
  );

  return (
    <form action={accion} className="space-y-4">
      {alumno && <input type="hidden" name="id" value={alumno.id} />}
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

      <Tarjeta titulo="Datos personales">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Campo
            etiqueta="Matricula"
            name="matricula"
            defaultValue={alumno?.matricula ?? ""}
            ayuda={esEdicion ? undefined : "Si la dejas vacia se genera con la plantilla configurada."}
          />
          <Campo etiqueta="Nombre(s)" name="nombres" required defaultValue={alumno?.nombres ?? ""} />
          <Campo
            etiqueta="Apellido paterno"
            name="apellidoPaterno"
            required
            defaultValue={alumno?.apellidoPaterno ?? ""}
          />
          <Campo
            etiqueta="Apellido materno"
            name="apellidoMaterno"
            defaultValue={alumno?.apellidoMaterno ?? ""}
          />
          <Campo
            etiqueta="CURP"
            name="curp"
            required={exigeCurp}
            defaultValue={alumno?.curp ?? ""}
          />
          <Campo
            etiqueta="Fecha de nacimiento"
            name="fechaNacimiento"
            type="date"
            defaultValue={alumno?.fechaNacimiento ?? ""}
          />
          <Selector etiqueta="Sexo" name="sexo" defaultValue={alumno?.sexo ?? ""}>
            <option value="">Sin especificar</option>
            <option value="F">Femenino</option>
            <option value="M">Masculino</option>
            <option value="X">Otro</option>
          </Selector>
          <Campo etiqueta="Correo" name="email" type="email" defaultValue={alumno?.email ?? ""} />
          <Campo etiqueta="Telefono" name="telefono" defaultValue={alumno?.telefono ?? ""} />
          <Campo
            etiqueta="Direccion"
            name="direccion"
            className="sm:col-span-2"
            defaultValue={alumno?.direccion ?? ""}
          />
          <Campo etiqueta="Ciudad" name="ciudad" defaultValue={alumno?.ciudad ?? ""} />
          <Campo
            etiqueta="Codigo postal"
            name="codigoPostal"
            defaultValue={alumno?.codigoPostal ?? ""}
          />
        </div>
      </Tarjeta>

      <Tarjeta titulo="Ubicacion academica">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Selector etiqueta="Plan de estudios" name="planId" required defaultValue={alumno?.planId ?? ""}>
            <option value="">Selecciona...</option>
            {catalogos.planes.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.nivel} · {plan.nombre}
              </option>
            ))}
          </Selector>
          <Selector etiqueta="Plantel" name="plantelId" defaultValue={alumno?.plantelId ?? ""}>
            <option value="">Sin asignar</option>
            {catalogos.planteles.map((plantel) => (
              <option key={plantel.id} value={plantel.id}>
                {plantel.nombre}
              </option>
            ))}
          </Selector>
          <Selector etiqueta="Turno" name="turnoId" defaultValue={alumno?.turnoId ?? ""}>
            <option value="">Sin asignar</option>
            {catalogos.turnos.map((turno) => (
              <option key={turno.id} value={turno.id}>
                {turno.nombre}
              </option>
            ))}
          </Selector>
          <Selector etiqueta="Estado" name="estado" defaultValue={alumno?.estado ?? "ACTIVO"}>
            {ESTADOS.map(([valor, texto]) => (
              <option key={valor} value={valor}>
                {texto}
              </option>
            ))}
          </Selector>
        </div>
      </Tarjeta>

      {muestraMedicos && (
        <Tarjeta titulo="Datos medicos" descripcion="Se muestran porque estan activados en Configuracion">
          <div className="grid gap-4 sm:grid-cols-3">
            <Campo etiqueta="Tipo de sangre" name="tipoSangre" defaultValue={alumno?.tipoSangre ?? ""} />
            <Campo etiqueta="Alergias" name="alergias" defaultValue={alumno?.alergias ?? ""} />
            <Campo
              etiqueta="Padecimientos"
              name="padecimientos"
              defaultValue={alumno?.padecimientos ?? ""}
            />
          </div>
        </Tarjeta>
      )}

      <Tarjeta titulo="Facturacion y acceso">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            etiqueta="RFC para facturacion"
            name="rfcFacturacion"
            defaultValue={alumno?.rfcFacturacion ?? ""}
            ayuda="Del responsable de pago. Se usara al timbrar."
          />
          {!esEdicion && (
            <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3">
              <input
                type="checkbox"
                name="crearUsuario"
                defaultChecked
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-marca-600"
              />
              <span>
                <span className="block text-sm font-medium text-slate-800">
                  Crear cuenta de acceso
                </span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  Usuario y contrasena temporal = la matricula. El alumno debera cambiarla al
                  entrar.
                </span>
              </span>
            </label>
          )}
          {esEdicion && alumno?.tieneUsuario && (
            <div className="rounded-lg border border-slate-200 p-3 text-sm text-slate-600">
              Este alumno ya tiene cuenta de acceso.
            </div>
          )}
        </div>
      </Tarjeta>

      <div className="flex justify-end gap-2">
        <Boton type="submit" disabled={pendiente}>
          {pendiente ? "Guardando..." : esEdicion ? "Guardar cambios" : "Dar de alta"}
        </Boton>
      </div>
    </form>
  );
}
