import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const fallos = [];
function comprobar(nombre, condicion, detalle = "") {
  console.log(`${condicion ? "OK  " : "FALLA"} ${nombre}${detalle ? " :: " + detalle : ""}`);
  if (!condicion) fallos.push(nombre);
}

const navegador = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const pagina = await navegador.newPage();

await pagina.goto(`${BASE}/`);
comprobar("Raiz redirige a /acceso", pagina.url().includes("/acceso"), pagina.url());
comprobar("Acceso muestra el nombre del colegio",
  (await pagina.textContent("body")).includes("Colegio de Demostracion"));

// Credenciales incorrectas
await pagina.fill('input[name="identificador"]', "admin");
await pagina.fill('input[name="password"]', "incorrecta");
await pagina.click('button[type="submit"]');
await pagina.waitForTimeout(1500);
comprobar("Rechaza contrasena incorrecta",
  (await pagina.textContent("body")).includes("incorrectos"));

// Acceso correcto como administrador
await pagina.fill('input[name="identificador"]', "admin");
await pagina.fill('input[name="password"]', "Demo1234");
await pagina.click('button[type="submit"]');
await pagina.waitForURL("**/panel", { timeout: 15000 });
const panel = await pagina.textContent("body");
comprobar("Entra al panel de administracion", pagina.url().endsWith("/panel"));
comprobar("Panel muestra indicadores", panel.includes("Alumnos activos"));
comprobar("Panel cuenta los 4 alumnos del demo", /Alumnos activos\s*4/.test(panel.replace(/\s+/g, " ")), );
comprobar("Panel muestra el ciclo activo", panel.includes("Ciclo escolar 2026-2027"));
comprobar("Panel muestra la minima aprobatoria", panel.includes("70"));

// Estructura academica
await pagina.goto(`${BASE}/panel/academico`);
const academico = await pagina.textContent("body");
comprobar("Academico lista el plan", academico.includes("Bachillerato General"));
comprobar("Academico genero los 6 grados", academico.includes("6o Semestre"));
comprobar("Academico lista conceptos de cobro", academico.includes("Colegiatura"));

// Configuracion: cambiar un parametro y verificar que persiste
await pagina.goto(`${BASE}/panel/configuracion`);
comprobar("Configuracion carga los 59 parametros",
  (await pagina.textContent("body")).includes("59 parametros"));
const campoFaltas = pagina.locator('input[name="asistencia.faltas_consecutivas_alerta"]');
comprobar("Existe el parametro de faltas consecutivas", await campoFaltas.count() === 1);
// La prueba es repetible: escribe un valor distinto al que haya ahora.
const faltasAntes = await campoFaltas.inputValue();
const faltasNuevo = faltasAntes === "5" ? "4" : "5";
await campoFaltas.fill(faltasNuevo);
await campoFaltas.locator("xpath=ancestor::form").locator('button[type="submit"]').click();
await pagina.waitForTimeout(2500);
comprobar("Guarda el cambio de configuracion",
  (await pagina.textContent("body")).includes("Se guardaron"));
await pagina.reload();
comprobar("El cambio persiste tras recargar",
  (await pagina.locator('input[name="asistencia.faltas_consecutivas_alerta"]').inputValue()) === faltasNuevo);
await pagina.goto(`${BASE}/panel`);
comprobar("El panel refleja el nuevo valor",
  (await pagina.textContent("body")).replace(/\s+/g, " ").includes(`Alerta por faltas consecutivas${faltasNuevo}`));

// Bitacora
await pagina.goto(`${BASE}/panel/bitacora`);
const bitacora = await pagina.textContent("body");
comprobar("Bitacora registro el inicio de sesion", bitacora.includes("INICIAR_SESION"));
comprobar("Bitacora registro el intento fallido", bitacora.includes("INTENTO_FALLIDO"));
comprobar("Bitacora registro el cambio de configuracion", bitacora.includes("CONFIGURAR"));

// El instalador ya no debe poder ejecutarse
await pagina.goto(`${BASE}/instalacion`);
comprobar("Instalador bloqueado tras instalar", pagina.url().includes("/acceso") || pagina.url().includes("/panel"), pagina.url());

// Acceso como docente y como alumno
const contextoDocente = await navegador.newContext();
const paginaDocente = await contextoDocente.newPage();
await paginaDocente.goto(`${BASE}/acceso`);
await paginaDocente.fill('input[name="identificador"]', "docente");
await paginaDocente.fill('input[name="password"]', "Demo1234");
await paginaDocente.click('button[type="submit"]');
await paginaDocente.waitForURL("**/panel", { timeout: 15000 });
const vistaDocente = await paginaDocente.textContent("body");
comprobar("Docente entra a su panel", vistaDocente.includes("Docente"));
comprobar("Docente NO ve Configuracion", !vistaDocente.includes("Configuracion del sistema"));
await paginaDocente.goto(`${BASE}/panel/configuracion`);
comprobar("Docente bloqueado en Configuracion",
  !paginaDocente.url().includes("/panel/configuracion"), paginaDocente.url());

const contextoAlumno = await navegador.newContext();
const paginaAlumno = await contextoAlumno.newPage();
await paginaAlumno.goto(`${BASE}/acceso`);
await paginaAlumno.fill('input[name="identificador"]', "2026-0001");
await paginaAlumno.fill('input[name="password"]', "Demo1234");
await paginaAlumno.click('button[type="submit"]');
await paginaAlumno.waitForURL("**/panel", { timeout: 15000 });
comprobar("Alumno entra con su matricula",
  (await paginaAlumno.textContent("body")).includes("Sofia"));
await paginaAlumno.goto(`${BASE}/panel/bitacora`);
comprobar("Alumno bloqueado en Bitacora",
  !paginaAlumno.url().includes("/panel/bitacora"), paginaAlumno.url());

// Sesion protegida
const contextoAnonimo = await navegador.newContext();
const paginaAnonima = await contextoAnonimo.newPage();
await paginaAnonima.goto(`${BASE}/panel`);
comprobar("Visitante sin sesion es enviado a /acceso", paginaAnonima.url().includes("/acceso"));

await navegador.close();
console.log(`\n${fallos.length === 0 ? "TODAS LAS PRUEBAS PASARON" : `FALLARON ${fallos.length}: ${fallos.join(", ")}`}`);
process.exit(fallos.length === 0 ? 0 : 1);
