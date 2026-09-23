import { chromium } from "playwright";

const BASE = process.env.BASE_PRUEBAS ?? "http://localhost:3000";
const fallos = [];
function comprobar(nombre, ok, detalle = "") {
  console.log(`${ok ? "OK  " : "FALLA"} ${nombre}${detalle ? " :: " + detalle : ""}`);
  if (!ok) fallos.push(nombre);
}

const navegador = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const p = await navegador.newPage();
p.on("pageerror", (e) => console.log("ERROR DE PAGINA:", e.message));

await p.goto(`${BASE}/`);
comprobar("Base vacia lleva al asistente", p.url().includes("/instalacion"), p.url());

// Paso 1: no deja avanzar sin nombre
await p.getByRole("button", { name: "Continuar" }).click();
await p.waitForTimeout(400);
comprobar("Valida el nombre obligatorio",
  (await p.textContent("body")).includes("Escribe el nombre de la institucion"));

await p.getByLabel("Nombre de la institucion").fill("Instituto Vanguardia");
await p.getByLabel("Nombre corto").fill("Vanguardia");
await p.getByLabel("Lema").fill("Ciencia y servicio");
await p.getByLabel("RFC").fill("IVA260101AB1");
await p.getByRole("button", { name: "Continuar" }).click();
await p.waitForTimeout(300);

// Paso 2: planteles y turnos (agrega un segundo plantel)
comprobar("Llega a planteles", (await p.textContent("body")).includes("Agregar plantel"));
await p.getByRole("button", { name: "Agregar plantel" }).click();
const nombresPlantel = p.getByLabel("Nombre", { exact: true });
await nombresPlantel.nth(1).fill("Plantel Norte");
await p.getByLabel("Clave", { exact: true }).nth(1).fill("NOR");
await p.getByRole("button", { name: "Continuar" }).click();
await p.waitForTimeout(300);

// Paso 3: niveles y planes (cambia la duracion del plan a 9 cuatrimestres)
comprobar("Llega a niveles y planes", (await p.textContent("body")).includes("Planes de estudio"));
await p.getByLabel("Nombre", { exact: true }).first().fill("Licenciatura");
await p.getByLabel("Clave", { exact: true }).first().fill("LIC");
await p.getByLabel("Tipo de periodo").selectOption("CUATRIMESTRE");
await p.getByLabel("Nombre del plan").fill("Licenciatura en Enfermeria");
await p.getByLabel("Clave", { exact: true }).nth(1).fill("LE-01");
await p.getByLabel("Duracion (periodos)").fill("9");
await p.getByLabel("Nombre de cada periodo").fill("Cuatrimestre {N}");
await p.getByRole("button", { name: "Continuar" }).click();
await p.waitForTimeout(300);

// Paso 4: ciclo
comprobar("Llega al ciclo", (await p.textContent("body")).includes("Nombre del ciclo"));
await p.getByLabel("Nombre del ciclo").fill("Ciclo 2026-A");
await p.getByLabel("Clave", { exact: true }).fill("2026A");
await p.getByLabel("Numero de periodos de evaluacion").fill("4");
await p.getByRole("button", { name: "Continuar" }).click();
await p.waitForTimeout(300);

// Paso 5: escala (valida rango y usa 0-10 con aprobatoria 6)
comprobar("Llega a la escala", (await p.textContent("body")).includes("Calificacion minima aprobatoria"));
await p.getByLabel("Valor maximo").fill("10");
await p.getByLabel("Calificacion minima aprobatoria").fill("80");
await p.getByRole("button", { name: "Continuar" }).click();
await p.waitForTimeout(400);
comprobar("Rechaza aprobatoria fuera de la escala",
  (await p.textContent("body")).includes("dentro de la escala"));
await p.getByLabel("Calificacion minima aprobatoria").fill("6");
await p.getByLabel("Nombre de la escala").fill("Escala 0 a 10");
await p.getByLabel("Decimales").fill("1");
await p.getByRole("button", { name: "Continuar" }).click();
await p.waitForTimeout(300);

// Paso 6: horarios (quita el viernes)
comprobar("Llega a horarios", (await p.textContent("body")).includes("Dias habiles"));
await p.getByRole("button", { name: "Viernes" }).click();
await p.getByRole("button", { name: "Continuar" }).click();
await p.waitForTimeout(300);

// Paso 7: asistencia (alerta a las 4 faltas)
comprobar("Llega a asistencia", (await p.textContent("body")).includes("Faltas consecutivas que disparan alerta"));
await p.getByLabel("Faltas consecutivas que disparan alerta").fill("4");
await p.getByRole("button", { name: "Continuar" }).click();
await p.waitForTimeout(300);

// Paso 8: finanzas
comprobar("Llega a finanzas", (await p.textContent("body")).includes("Conceptos de cobro"));
await p.getByLabel("Dia de vencimiento predeterminado").fill("5");
const montos = p.getByLabel("Monto", { exact: true });
await montos.nth(0).fill("6500");
await montos.nth(1).fill("3200");
await p.getByLabel("Valor", { exact: true }).fill("12");
await p.getByRole("button", { name: "Continuar" }).click();
await p.waitForTimeout(300);

// Paso 9: administrador
comprobar("Llega al administrador", (await p.textContent("body")).includes("Nombre de usuario"));
await p.getByRole("button", { name: "Continuar" }).click();
await p.waitForTimeout(400);
comprobar("Valida el usuario del administrador",
  (await p.textContent("body")).includes("al menos 3 caracteres"));
await p.getByLabel("Nombre de usuario").fill("direccion");
await p.getByLabel("Correo electronico").fill("direccion@vanguardia.mx");
await p.getByLabel("Nombre(s)").fill("Maria");
await p.getByLabel("Apellido paterno").fill("Serrano");
await p.getByLabel("Contrasena").fill("Corta1");
await p.getByRole("button", { name: "Continuar" }).click();
await p.waitForTimeout(400);
comprobar("Valida la longitud de la contrasena",
  (await p.textContent("body")).includes("al menos 8 caracteres"));
await p.getByLabel("Contrasena").fill("Vanguardia2026");
await p.getByRole("button", { name: "Continuar" }).click();
await p.waitForTimeout(400);

// Paso 10: resumen
const resumen = (await p.textContent("body")).replace(/\s+/g, " ");
comprobar("Resumen muestra la institucion", resumen.includes("Instituto Vanguardia"));
comprobar("Resumen cuenta 9 grados", resumen.includes("9 grados"), resumen.slice(resumen.indexOf("Oferta academica"), resumen.indexOf("Oferta academica") + 90));
comprobar("Resumen muestra la escala 0 a 10", resumen.includes("0 a 10 · aprueba con 6"));

await p.getByRole("button", { name: "Instalar sistema" }).click();
await p.waitForURL("**/acceso**", { timeout: 30000 });
comprobar("Instalacion completada", p.url().includes("instalado=1"), p.url());
comprobar("Acceso muestra el colegio recien creado",
  (await p.textContent("body")).includes("Instituto Vanguardia"));

// Entrar con la cuenta creada por el asistente
await p.getByLabel("Usuario, matricula o correo").fill("direccion");
await p.getByLabel("Contrasena").fill("Vanguardia2026");
await p.getByRole("button", { name: "Entrar" }).click();
await p.waitForURL("**/panel", { timeout: 20000 });
const panel = (await p.textContent("body")).replace(/\s+/g, " ");
comprobar("Entra con la cuenta del asistente", panel.includes("Hola, Maria"));
comprobar("El panel usa la escala configurada", panel.includes("0 a 10"));
comprobar("El panel usa la aprobatoria configurada", panel.includes("Minima aprobatoria6"));
comprobar("El panel usa la alerta de 4 faltas", panel.includes("consecutivas4"));
comprobar("El panel usa el dia de vencimiento 5", panel.includes("Dia 5"));
comprobar("El panel muestra 1 plan de estudios", panel.includes("Planes de estudio1"));

await p.goto(`${BASE}/panel/academico`);
const academico = (await p.textContent("body")).replace(/\s+/g, " ");
comprobar("Se crearon los 9 cuatrimestres", academico.includes("Cuatrimestre 9"));
comprobar("Se crearon los 2 planteles", academico.includes("Plantel Norte"));
comprobar("El concepto tomo el monto capturado", academico.includes("$6,500.00"));
comprobar("El recargo quedo al 12%", academico.includes("12%"));

await p.goto(`${BASE}/instalacion`);
comprobar("El asistente ya no se puede repetir", !p.url().includes("/instalacion"), p.url());

await navegador.close();
console.log(`\n${fallos.length === 0 ? "TODAS LAS PRUEBAS DEL ASISTENTE PASARON" : `FALLARON ${fallos.length}: ${fallos.join(", ")}`}`);
process.exit(fallos.length === 0 ? 0 : 1);
