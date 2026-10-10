# Plan de entrega por fases

## Fase 1 — Nucleo configurable (completa)

- Modelo de datos completo de las cinco fases.
- Asistente de instalacion en 10 pasos: institucion, planteles y turnos,
  niveles y planes, ciclo y periodos, escala de evaluacion, horarios,
  asistencia, finanzas, cuenta de administrador y confirmacion.
- Motor de configuracion con 59 parametros editables.
- Acceso, roles (administrador, docente, alumno) y permisos por pantalla.
- Bitacora de auditoria.
- Consulta de la estructura academica creada.
- Empaquetado con Docker y suites de prueba de extremo a extremo.

## Fase 2 — Control escolar (completa)

- Alta, edicion, busqueda y expediente de alumnos, con matricula generada
  segun la plantilla configurada, tutores y datos medicos opcionales.
- Alta de personal y docentes, con los datos de nomina que usara la Fase 5.
- Catalogo de materias y areas; mapa curricular por plan y grado con creditos,
  horas y prerrequisitos encadenados.
- Grupos con cupo, apertura de clases (materia + docente) e inscripcion de
  alumnos, que valida plan, cupo y prerrequisitos aprobados.
- Importador CSV de alumnos, personal y materias, con plantilla descargable e
  informe de errores por fila.
- Cuentas de acceso con contrasena temporal y cambio obligatorio en el primer
  ingreso.

Reglas de integridad que quedaron cubiertas:

- No se puede retirar una materia del plan si tiene clases abiertas o es
  prerrequisito de otra.
- No se puede eliminar una clase que ya tiene calificaciones, actividades o
  asistencia.
- No se puede quitar el perfil docente a quien tiene clases asignadas.
- No se puede bajar el cupo de un grupo por debajo de los alumnos inscritos.
- Un alumno no puede estar inscrito en dos grupos del mismo ciclo.

## Fase 3 — Academico (completa)

- Cuadro de horarios por grupo, con bloques tomados de los modulos que el
  colegio definio o con horas capturadas a mano. Al guardar se revisa que el
  docente, el aula y el grupo no queden en dos lugares a la vez, y que el dia
  sea habil; cada validacion se puede apagar desde Configuracion.
- Portal del docente: sus clases del ciclo, su horario y las preferencias de
  cada clase.
- Pase de lista por clase o por dia completo, a eleccion de cada docente, con
  cinco estados (presente, ausente, retardo, justificada, salida anticipada) y
  nota por alumno. Al alcanzarse el numero de faltas consecutivas configurado
  se levanta una alerta y se notifica a los administrativos dentro del sistema.
- Bandeja de alertas de inasistencia para direccion, con seguimiento.
- Rubros de evaluacion por clase y periodo, definidos por el docente, con
  validacion de que los pesos no pasen de 100%.
- Actividades con puntos maximos y captura por alumno.
- Calificacion sugerida a partir de los rubros capturados, que el docente copia
  o ignora: la oficial siempre la confirma el.
- Cierre de periodo por clase (exige tener todas las calificaciones), reapertura
  por direccion, y apertura o cierre de la captura de cada periodo para todo el
  colegio.
- Extraordinarios, recuperaciones y titulo de suficiencia, con el tope de
  calificacion que la escuela configuro.
- Recalculo de promedios: calificacion final por materia respetando el peso de
  cada periodo, promedio del ciclo, materias aprobadas y reprobadas, creditos,
  posicion en el ranking y cuadro de honor.
- Boleta lista para imprimir o guardar como PDF desde el navegador, con el
  logo, los datos y los colores del colegio, las calificaciones por periodo, la
  final, el promedio, el lugar en el ranking y el resumen de asistencia.

Reglas de integridad que quedaron cubiertas:

- Un bloque de horario no se guarda si choca con otro del mismo docente, aula o
  grupo, ni en un dia que no sea habil.
- No se captura en un periodo cuya captura esta cerrada.
- No se cierra un periodo al que le faltan calificaciones.
- Una calificacion cerrada no se edita; solo direccion puede reabrirla.
- Los puntos de una actividad no pueden pasar de su maximo, y la calificacion
  del periodo no puede salirse de la escala: se valida en el servidor, no solo
  en el navegador.
- Un docente solo entra a sus propias clases.

## Fase 4 — Finanzas y portales (completa)

- Catalogo de conceptos de cobro donde el colegio define el motivo, el monto,
  la periodicidad, la fecha del primer cargo, el dia de vencimiento, cuantos
  cargos se generan y a quien aplican (todos, un nivel, un plan, un grado, un
  grupo o un alumno).
- Generacion de cargos con vista previa antes de confirmar. Es idempotente: no
  duplica los cargos que ya existen.
- Cargos sueltos con motivo, monto y fecha libres, fuera del catalogo.
- Becas y descuentos por porcentaje o monto fijo, ligados a conceptos concretos
  o a todos, con vigencia y asignacion por alumno. Se acumulan o no segun la
  configuracion del colegio.
- Reglas de recargo por pago tardio: porcentaje o monto fijo, dias de gracia,
  frecuencia (una vez, diaria, semanal o mensual) y tope maximo. El recalculo
  parte de cero, asi que correrlo dos veces no cobra dos veces.
- Caja: pagos totales y parciales, reparto manual entre cargos o automatico del
  mas viejo al mas nuevo, con los metodos de pago del catalogo.
- Cancelacion de pagos con motivo, que restaura los saldos.
- Convenios de pago en parcialidades, con su calendario.
- Recibo listo para imprimir o guardar como PDF, con los datos del colegio y la
  estructura CFDI 4.0 guardada para el timbrado futuro.
- Bandera de adeudo y bloqueo configurable de servicios (boleta, reinscripcion,
  portal o constancias) a partir de los dias de atraso que fije el colegio.
- Portal del alumno: calificaciones, asistencia, horario y estado de cuenta con
  sus recibos, cada seccion activable desde Configuracion.

Reglas de integridad que quedaron cubiertas:

- Un concepto con cargos generados no se borra, solo se desactiva.
- Un cargo con pagos aplicados no se cancela ni se condona sin cancelar antes
  el pago.
- El reparto de un pago no puede exceder el monto recibido ni el saldo de cada
  cargo.
- Si el colegio no permite pagos parciales, el pago tiene que cubrir el saldo
  completo del cargo.
- Los saldos, estados y la bandera de adeudo se recalculan tras cada pago,
  cancelacion o recargo.

Pendiente de esta fase:

- **Pago en linea.** La configuracion de la pasarela existe en el modelo de
  datos, pero la integracion con el proveedor (Stripe, Mercado Pago, OpenPay o
  Conekta) no esta hecha: requiere credenciales reales y una cuenta activa para
  probarse de punta a punta.
- **Timbrado CFDI.** El recibo guarda todos los campos que pide el CFDI 4.0,
  pero conectar un PAC es trabajo aparte.

## Fase 5 — Nomina (completa)

- Catalogo de conceptos de nomina definido por el colegio: percepciones,
  deducciones y otros pagos, con monto fijo o porcentaje del sueldo del
  periodo, bandera de gravable y clave SAT opcional.
- Periodos de nomina con sus fechas y su fecha de pago, validando que no se
  encimen entre si.
- Calculo del periodo para todo el personal activo. El sueldo sale del salario
  base prorrateado por los dias del periodo (el prorrateo se apaga desde
  Configuracion). Recalcular no duplica recibos, respeta los ya autorizados o
  pagados y conserva los ajustes capturados a mano.
- Ajustes por recibo (bonos, prestamos, horas extra) marcados como manuales,
  de modo que un recalculo no los borra aunque usen un concepto que ya aplica
  automaticamente.
- Autorizacion masiva de los recibos en borrador y pago del periodo con su
  metodo y fecha.
- Recibo de nomina listo para imprimir o guardar como PDF, con los datos del
  colegio y del empleado, percepciones, deducciones y neto.
- Cancelacion de recibos con motivo, registrada en la bitacora.
- Todo el modulo se puede apagar desde Configuracion.

Reglas de integridad que quedaron cubiertas:

- Un concepto que ya aparece en recibos no se borra, solo se desactiva.
- No se autoriza un periodo con recibos en neto cero o negativo.
- No se paga un periodo con recibos todavia en borrador.
- Un recibo autorizado o pagado no se modifica ni se recalcula.
- Un periodo pagado ya no ofrece recalcularse.

Pendiente declarado:

- **Tablas fiscales.** El sistema no calcula el ISR ni las cuotas de seguridad
  social: cada colegio captura sus propios porcentajes o montos. Inventar esas
  tablas seria peor que no tenerlas.
- **CFDI de nomina.** El recibo es un comprobante interno; el timbrado requiere
  conectar un PAC.

---

# Entrega adicional: paquete instalable (sin internet)

El sistema nacio como servicio web, pero un colegio puede preferir no depender
de internet. Se agrego una segunda forma de entrega, **con el mismo codigo**:
el sistema se instala en una computadora del colegio y las demas entran por la
red interna.

Lo que se construyo:

- `scripts/empaquetar.sh` arma un paquete autocontenido (servidor compilado,
  dependencias, migraciones y la herramienta que las aplica). La instalacion no
  descarga nada.
- `scripts/instalar-linux.sh` crea la base, genera las claves de esa
  instalacion, y deja el sistema como servicio de systemd.
- `scripts/instalar-windows.ps1` hace lo equivalente con una tarea programada.
- `scripts/cierre-dependencias.mjs` calcula que dependencias necesita la
  herramienta de migraciones, en lugar de elegirlas a mano.
- `docs/instalacion-local.md` es la guia para el colegio.

Fallas encontradas al probar el paquete de verdad, y corregidas:

1. **Migraciones imposibles en el colegio.** Las dependencias de Prisma se
   habian elegido a mano y faltaban indirectas; el paquete arrancaba pero no
   podia crear las tablas. Ahora el arbol se calcula.
2. **Sistema invisible para el resto del colegio.** El arranque tomaba la
   direccion de escucha de `HOSTNAME`, que el sistema operativo ya trae puesto
   con el nombre de la maquina; el servidor solo respondia en la propia
   computadora. Ahora escucha en toda la red.
3. **Claves del desarrollo repartidas a cada colegio.** Next copia el `.env`
   del desarrollo dentro de la compilacion, y ese archivo viajaba en el
   paquete. Ahora se borra al empaquetar y el empaquetado se aborta si
   reaparece.
4. **Instalacion nueva tratada como actualizacion.** El instalador miraba si
   existia el archivo de configuracion *despues* de copiar, asi que un archivo
   que viniera en el paquete pasaba por configuracion previa y no se generaban
   claves nuevas. Ahora se decide antes de copiar.
5. **Windows: archivo de configuracion ilegible.** Se escribia en UTF8, que en
   Windows PowerShell antepone una marca invisible; el arranque leeria mal la
   primera linea y el sistema quedaria sin base de datos. Ahora se escribe en
   ASCII.

Verificado en este entorno:

- Paquete extraido fuera del proyecto, sin npm y sin acceso al `node_modules`
  del codigo: aplica las 60 tablas sobre una base vacia y levanta.
- Responde en `localhost` y en la direccion de red de la maquina.
- Las 29 pruebas del asistente de instalacion pasan contra el sistema
  empaquetado y contra el ya instalado.
- Reinstalar encima conserva los datos del colegio y la clave de sesiones, y
  no reaplica migraciones.
- El archivo de claves queda en 600 y con dueño del usuario del servicio.
- La unidad de systemd generada pasa `systemd-analyze verify`.

Pendiente declarado:

- **El instalador de Windows no pudo probarse.** Este entorno no tiene
  PowerShell. Se reviso a mano contra las mismas fallas encontradas en Linux y
  se corrigieron las equivalentes, pero antes de usarlo en un colegio debe
  correrse en un equipo Windows de prueba.
- **systemd no corre como init en este entorno**, asi que el registro del
  servicio no pudo ejecutarse aqui. Se verifico que la unidad generada es
  valida y que el sistema instalado funciona corriendo como el usuario del
  servicio, que es lo que systemd haria.

---

# Entrega adicional: varias computadoras como un solo sistema

El paquete instalable dejaba una dependencia incomoda: si la computadora que
guarda los datos se apaga, nadie entra. La peticion fue que **cada computadora
funcione con su propia base, pero que las de una misma red se comporten como
una sola**.

## La decision y por que

Lo que las palabras piden al pie de la letra es que varias bases escriban a la
vez y se pongan de acuerdo. Para este sistema eso no es aceptable: dos cajas
cobrando al mismo tiempo generarian **el mismo folio de recibo dos veces** y el
mismo alumno tendria **dos saldos distintos** segun donde se consultara. En
control escolar seria molesto; en finanzas y en facturacion es inadmisible.

Asi que se implemento lo que si es correcto y cumple la intencion:

- Cada instalacion trae su propia base y **puede trabajar sola**.
- En una misma red, **solo una base queda activa**; las demas computadoras
  sirven el sistema contra esa.
- **Cualquiera puede ser la que manda.** No hay que designar un servidor: el
  papel se decide en cada arranque.

La contraparte se declara en lugar de esconderse: si la computadora con los
datos se apaga, las demas **no abren el sistema**. Es preferible a abrir una
copia paralela que despues nadie podria reconciliar.

## Como se reconocen

Por una **clave de red del colegio** que se define una vez. Al arrancar, cada
computadora pregunta por la red local (difusion UDP, puerto 47808) si alguien
ya tiene los datos abiertos. Quien contesta firma su anuncio con esa clave.

Sin firma, cualquier aparato conectado al WiFi podria decir "yo tengo la base
del colegio" y quedarse con las contrasenas o mandar a todos a un sistema
falso. El sondeo tambien va firmado, para que una instalacion no revele su
puerto ni su version a quien no comparte la clave.

Las credenciales de la base se piden por HTTP a quien manda, firmadas, con
marca de tiempo y numero de un solo uso. La direccion no viaja en la respuesta:
la pone quien pregunta, usando la direccion por la que alcanzo al vecino, para
no tener que adivinar cual de las tarjetas de red es la del colegio.

En Linux el instalador abre PostgreSQL **solo** a la red local, solo para el
usuario del sistema y solo para esa base. En Windows ese paso es manual y esta
documentado.

## Piezas

- `src/lib/red.ts` y `scripts/protocolo-red.mjs`: las primitivas de firma. Son
  dos copias porque el descubridor corre como proceso aparte y no puede
  importar TypeScript; `pruebas/red-local.mjs` comprueba que firman igual.
- `scripts/red-escolar.mjs`: busca vecinos y se anuncia.
- `scripts/elegir-papel.mjs`: decide el papel en cada arranque.
- `scripts/abrir-base-a-la-red.sh`: abre PostgreSQL a la red local, acotado.
- `src/app/api/red/credenciales`: entrega los datos de conexion, firmado.
- `src/app/api/red/estado`: dice que papel tiene cada computadora.

## Fallas encontradas al probarlo, y corregidas

1. **Si el vecino no contestaba, se partian los datos en dos.** La primera
   version tomaba la base local cuando no lograba hablar con quien manda —
   exactamente el escenario que se queria evitar. Ahora no abre.
2. **Cada computadora anunciaba el puerto equivocado.** El anunciador leia
   `PUERTO` y el resto del sistema usa `PORT`, asi que anunciaba el 3000 y las
   demas no podian sumarse a ella. Se detecto porque la segunda computadora
   nunca lograba conectarse.
3. **`listen_addresses` no toma efecto al recargar PostgreSQL.** Hace falta
   reiniciarlo. Peor: la decision de reiniciar se tomaba mirando el archivo de
   configuracion, asi que una segunda corrida veia el archivo correcto y no
   reiniciaba nunca. Ahora se mira el valor que el motor tiene cargado y se
   comprueba al final que de verdad acepta conexiones de la red.
4. **El script moria si faltaba `ip`.** Hay instalaciones minimas de Linux sin
   iproute2; en lugar de avisar, abortaba la instalacion. Ahora recurre a
   `hostname` y, si tampoco, avisa y deja el sistema en modo local.
5. **"fetch failed" como unico diagnostico.** No dice nada a quien tenga que
   arreglar la red. Ahora se registra la causa y el puerto.

## Verificado en este entorno

- Dos instalaciones, cada una con su base vacia, en la misma red:
  - la primera migra sus 60 tablas y queda al mando;
  - la segunda la encuentra, pide credenciales, **no migra**, y queda sumada;
  - las dos muestran el mismo colegio, y un concepto de cobro dado de alta en
    la segunda **aparece en la primera**;
  - la base local de la segunda sigue con **0 tablas**: quedo en reposo;
  - `pg_stat_activity` confirma la conexion entrante por la red.
- Una tercera instalacion **sin clave de red** se comporta como antes: trabaja
  sola y no se anuncia.
- Un sondeo con otra clave no recibe respuesta; una peticion de credenciales
  sin la clave recibe 403 sin filtrar nada; una repetida, 409; una vencida,
  400; y una computadora que no manda no reparte credenciales.
- PostgreSQL abierto a la red acepta `escuela_a` desde la red local y **rechaza**
  `escuela_b` y el usuario `postgres`.
- Las suites anteriores siguen pasando, cada una en las condiciones que pide su
  documentacion: humo 26, control-escolar 28, academico 40, finanzas 40,
  nomina 41, integridad-finanzas 27, asistente 29. Mas red-local 22.

## Pendiente declarado

- **El arranque de Windows no pudo probarse.** Este entorno no tiene
  PowerShell. La eleccion de papel se escribio en el `arrancar.cmd` siguiendo
  la misma logica que en Linux, y el paso de abrir PostgreSQL quedo documentado
  como manual, pero nada de eso se ejecuto en un Windows real.
- **La eleccion no es un protocolo de consenso.** Cada computadora espera un
  lapso propio antes de declararse al mando y vuelve a mirar la red, asi que la
  ventana en que dos podrian creerse al mando es de fracciones de segundo, pero
  no es cero. Para una red de colegio alcanza; se declara en la guia.
- **Sin relevo automatico.** Si la computadora con los datos se apaga, otra no
  toma su lugar: tendria la base vacia. Un relevo de verdad necesita
  replicacion, que es el trabajo que sigue si el colegio lo necesita.

---

# Entrega adicional: respaldos verificados

El respaldo existia solo como una linea de cron en la guia. Una linea en un
documento no respalda nada: hay que escribirla bien, acordarse de ponerla, y
no equivocarse. Ahora es parte del sistema y queda programada al instalar.

## Lo que hace

Todas las noches a las 22:00, en la computadora que tiene los datos:

1. Saca la copia y la comprime.
2. **La restaura en una base temporal y compara los conteos tabla por tabla.**
3. Deja una segunda copia en el disco externo, si esta disponible.
4. Rota las de mas de 30 dias.

El paso 2 es la razon de ser de esto. Una copia que nunca se probo no es un
respaldo: es un archivo del que nadie sabe nada hasta el dia en que hace falta.
Si no restaura o no coincide, el respaldo falla con codigo distinto de cero
para que systemd lo reporte, en lugar de quedarse callado.

## Medido

Base con 504 alumnos y un ciclo completo de pase de lista, 285,000 registros
de asistencia:

| | |
|---|---|
| Base en disco | 43 MB |
| Respaldo comprimido | 1.2 MB |

Un ciclo entero de un colegio mediano cabe en poco mas de un megabyte. El
almacenamiento no es el costo del resguardo local; la disciplina si.

## Piezas

- `scripts/respaldar.sh`: respaldo con verificacion (Linux, probado).
- `scripts/restaurar.sh`: restauracion con confirmacion y copia de seguridad
  previa (Linux, probado).
- `scripts/respaldar-windows.ps1`: equivalente para Windows (sin probar).
- Unidad y temporizador de systemd, registrados por el instalador de Linux.
- Tarea programada equivalente en el instalador de Windows.

## Fallas encontradas al probarlo, y corregidas

1. **La restauracion dejaba el sistema inservible.** Al recrear el esquema como
   `postgres`, las tablas quedaban a nombre de `postgres` y el usuario de la
   aplicacion no veia ninguna. Lo peor: el guion imprimia "Restauracion
   terminada" con los conteos correctos, porque consultaba como administrador.
   Ahora el esquema queda a nombre del usuario del sistema, la restauracion
   corre con sus credenciales, y **la comprobacion final consulta por donde
   consulta la aplicacion**, no como administrador.
2. **`psql` no acepta la cadena de conexion de Prisma.** El parametro
   `?schema=public` lo hace fallar con "invalid URI query parameter". Se arma
   una cadena limpia dejando solo los parametros que libpq conoce, y el esquema
   se pasa por separado.
3. **Se respaldaba la base vacia de una computadora secundaria.** El guion
   preguntaba al sistema su papel en la red, pero si el sistema esta apagado
   no hay respuesta y terminaba copiando una base sin datos: un archivo de unos
   kilobytes que parece un respaldo correcto. Ahora tambien se mira la base
   misma y se niega a respaldar si no hay colegio cargado.
4. **Una copia a medias quedaba guardada.** Si `pg_dump` fallaba despues de
   haber escrito algo, el archivo quedaba roto en la carpeta de respaldos. Se
   comprueba la integridad del comprimido y se borra si no pasa.

## Verificado en este entorno

- Respaldo con verificacion por restauracion sobre 285,000 registros.
- Copia a disco externo conectado, y aviso ruidoso cuando no esta.
- Un respaldo truncado se rechaza antes de tocar la base.
- **Desastre total simulado** (esquema borrado) y restauracion completa: 60
  tablas, 504 alumnos, 285,000 asistencias, cargos y pagos de vuelta.
- Tras restaurar, las tablas quedan a nombre del usuario de la aplicacion, el
  sistema reporta el colegio instalado y pasan las 26 pruebas de humo.
- Una base sin colegio cargado no genera ningun archivo.
- Las unidades de systemd pasan `systemd-analyze verify` y el horario se
  normaliza correctamente.
- Ciclo completo repetido desde el paquete final recien armado.

## Pendiente declarado

- **El respaldo de Windows no pudo probarse**: este entorno no tiene
  PowerShell. Queda con un aviso en la cabecera del propio guion, en el
  instalador y en la guia: hay que correrlo a mano y restaurar en un equipo de
  prueba antes de depender de el. Un respaldo en el que no se puede confiar es
  peor que no tener ninguno, porque da falsa tranquilidad.
- **Las copias de Windows usan el formato propio de PostgreSQL** (`.dump`) y
  las de Linux `.sql.gz`. Cada una se restaura con el guion de su sistema; no
  son intercambiables.
- **La copia fuera de la computadora sigue dependiendo de una persona.** El
  sistema avisa cuando el disco externo no esta, pero no puede conectarlo.

---

# Nota de verificacion: PowerShell instalado en el entorno

Hasta aqui, todo lo de Windows se habia entregado sin probar, porque el entorno
de desarrollo no tenia PowerShell. Se instalo PowerShell 7.6.6 desde el
repositorio oficial de Microsoft (`packages.microsoft.com`) y con eso se pudo
cerrar buena parte de ese hueco.

## Lo que el analisis revelo

Inventariando los comandos de cada guion contra los que existen en PowerShell
para Linux:

- **`respaldar-windows.ps1` no usa ni un comando exclusivo de Windows.** Es
  decir, se podia probar completo. Lo mismo para el restaurador.
- **`instalar-windows.ps1` usa ocho que solo existen en Windows**:
  `Register-ScheduledTask`, `New-ScheduledTaskAction`,
  `New-ScheduledTaskSettingsSet`, `New-ScheduledTaskTrigger`,
  `Start-ScheduledTask`, `New-NetFirewallRule`, `Get-NetIPAddress`,
  `Get-Acl`/`Set-Acl`. Esas siguen sin poder probarse.

## Fallas encontradas al poder correrlo, y corregidas

1. **La verificacion del respaldo se saltaba en silencio.** El guion intentaba
   crear una base temporal para probar la copia, y el usuario del sistema no
   tiene permiso de crear bases. Resultado: cada noche habria dicho "listo"
   sin comprobar nada, que es justo lo que el guion existe para evitar. Ahora
   el instalador crea una base fija `<base>_verificacion` propiedad del usuario
   del sistema, el respaldo la reutiliza, y si falta avisa a gritos y termina
   con error para que el Programador de tareas lo marque como fallido.
2. **Faltaba el guardia de base vacia.** En Linux ya se habia agregado, en
   Windows no: una computadora secundaria habria generado cada noche un archivo
   de unos kilobytes que parece un respaldo correcto.
3. **No habia restaurador para Windows.** Habia respaldo y no habia como
   recuperarlo. Se escribio `restaurar-windows.ps1`, con la misma logica que el
   de Linux: confirmacion escribiendo el nombre de la base, copia de seguridad
   previa, restauracion con el usuario del sistema, y comprobacion de que la
   aplicacion alcanza los datos.
4. **Un mensaje de error que no decia que hacer.** Si el esquema de la base no
   es del usuario del sistema, el vaciado falla; el guion se detenia sin perder
   nada, pero sin explicar. Ahora nombra la causa probable y da el comando
   exacto para arreglarlo.

## Verificado en PowerShell 7 contra PostgreSQL real

- Sintaxis de los tres guiones: valida (analizador de PowerShell, no `bash -n`).
- Respaldo con verificacion por restauracion y comparacion de conteos.
- Copia al disco externo conectado, y aviso ruidoso cuando no esta.
- Base sin colegio cargado: no genera ningun archivo.
- Falta la base de verificacion: guarda el respaldo, avisa y sale con codigo 2.
- Respaldo dañado: el restaurador lo rechaza antes de tocar la base.
- **Ciclo completo**: desastre simulado, restauracion, 60 tablas de vuelta a
  nombre del usuario de la aplicacion, sistema reportando el colegio instalado
  y las 26 pruebas de humo pasando.

## Lo que sigue sin probarse

- El **Programador de tareas** de Windows que dispara el respaldo cada noche.
  Por eso la guia pide confirmar al dia siguiente con
  `Get-ScheduledTaskInfo SistemaEscolarRespaldo`.
- El **firewall**, los **permisos de archivo** y la **deteccion de la direccion
  de red** del instalador de Windows.
- Las **rutas propias de Windows** (`C:\Program Files\PostgreSQL`,
  `C:\SistemaEscolar`).

Eso ya no se arregla con PowerShell en Linux: necesita una computadora Windows.
