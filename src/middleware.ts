import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_SESION, verificarDato, verificarSesion } from "@/lib/sesion";
import {
  CABECERA_COLEGIO,
  COOKIE_ALTA,
  COOKIE_COLEGIO,
  colegioDelHost,
  direccionValida,
  dominioPlataforma,
  modoPlataforma,
} from "@/lib/modo";

const UN_ANIO = 365 * 24 * 3600;

export async function middleware(peticion: NextRequest) {
  const { pathname } = peticion.nextUrl;

  // Las layouts no conocen la ruta actual; se la pasamos por cabecera para
  // poder forzar el cambio de contrasena sin caer en un bucle de redirecciones.
  // La cabecera del colegio se borra siempre: solo la pone este middleware.
  const cabeceras = new Headers(peticion.headers);
  cabeceras.set("x-ruta-actual", pathname);
  cabeceras.delete(CABECERA_COLEGIO);

  const token = peticion.cookies.get(COOKIE_SESION)?.value;
  const sesion = token ? await verificarSesion(token) : null;

  if (!modoPlataforma()) {
    if (pathname.startsWith("/panel") && !sesion) return aAcceso(peticion, pathname);
    return NextResponse.next({ request: { headers: cabeceras } });
  }

  // ---- Modo plataforma: decidir el colegio de esta solicitud ----

  const colegioHost = colegioDelHost(peticion.headers.get("host"));
  const segmentos = pathname.split("/").filter(Boolean);

  // La puerta de un colegio: /<direccion>. Recuerda el colegio y lleva a su
  // inicio de sesion.
  if (!colegioHost && segmentos.length === 1 && direccionValida(segmentos[0])) {
    const direccion = segmentos[0];
    const dominio = dominioPlataforma();
    const destino = dominio
      ? new URL(`https://${direccion}.${dominio}/acceso${peticion.nextUrl.search}`)
      : new URL(`/acceso${peticion.nextUrl.search}`, peticion.url);
    const respuesta = NextResponse.redirect(destino);
    if (!dominio) {
      respuesta.cookies.set(COOKIE_COLEGIO, direccion, {
        path: "/",
        sameSite: "lax",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: UN_ANIO,
      });
    }
    return respuesta;
  }

  if (pathname.startsWith("/panel")) {
    // El panel siempre es el colegio de la sesion firmada, nunca el de la
    // direccion o de una cookie que se pueda cambiar a mano.
    if (!sesion?.colegioId) return aAcceso(peticion, pathname);
    cabeceras.set(CABECERA_COLEGIO, `id:${sesion.colegioId}`);
  } else if (pathname.startsWith("/instalacion")) {
    const alta = peticion.cookies.get(COOKIE_ALTA)?.value;
    const datos = alta ? await verificarDato(alta) : null;
    if (!datos?.colegioId) return NextResponse.redirect(new URL("/alta", peticion.url));
    cabeceras.set(CABECERA_COLEGIO, `id:${Number(datos.colegioId)}`);
  } else if (pathname.startsWith("/plataforma") || pathname.startsWith("/alta")) {
    // El panel del dueno y el alta no pertenecen a ningun colegio.
  } else if (colegioHost) {
    cabeceras.set(CABECERA_COLEGIO, `direccion:${colegioHost}`);
  } else if (pathname === "/" && sesion?.colegioId) {
    cabeceras.set(CABECERA_COLEGIO, `id:${sesion.colegioId}`);
  } else {
    const elegido = peticion.cookies.get(COOKIE_COLEGIO)?.value ?? "";
    if (direccionValida(elegido)) cabeceras.set(CABECERA_COLEGIO, `direccion:${elegido}`);
  }

  return NextResponse.next({ request: { headers: cabeceras } });
}

function aAcceso(peticion: NextRequest, pathname: string) {
  const destino = new URL("/acceso", peticion.url);
  destino.searchParams.set("destino", pathname);
  return NextResponse.redirect(destino);
}

export const config = {
  // Todo menos los archivos estaticos de Next.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
