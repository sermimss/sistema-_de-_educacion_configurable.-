import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_SESION, verificarSesion } from "@/lib/sesion";

const RUTAS_PUBLICAS = ["/acceso", "/instalacion", "/api/instalacion"];

export async function middleware(peticion: NextRequest) {
  const { pathname } = peticion.nextUrl;

  if (RUTAS_PUBLICAS.some((ruta) => pathname.startsWith(ruta))) {
    return NextResponse.next();
  }

  const token = peticion.cookies.get(COOKIE_SESION)?.value;
  const sesion = token ? await verificarSesion(token) : null;

  if (!sesion) {
    const destino = new URL("/acceso", peticion.url);
    destino.searchParams.set("destino", pathname);
    return NextResponse.redirect(destino);
  }

  // Las layouts no conocen la ruta actual; se la pasamos por cabecera para
  // poder forzar el cambio de contrasena sin caer en un bucle de redirecciones.
  const cabeceras = new Headers(peticion.headers);
  cabeceras.set("x-ruta-actual", pathname);
  return NextResponse.next({ request: { headers: cabeceras } });
}

export const config = {
  matcher: ["/panel/:path*"],
};
