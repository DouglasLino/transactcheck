# TransactCheck

TransactCheck es una aplicación web para analizar archivos JSON con transacciones financieras. Permite trabajar con estructuras heterogéneas, identificar posibles registros transaccionales, normalizar sus datos a un formato común y detectar errores o inconsistencias.

La aplicación permite cargar archivos, visualizar los resultados desde un Dashboard y revisar cada transacción con sus datos originales, valores normalizados y diagnósticos.

Todo el procesamiento se realiza localmente en el navegador utilizando Python y Pyodide, sin necesidad de un servidor, una base de datos o servicios externos para analizar la información.

Este proyecto corresponde a la primera versión funcional (MVP1), enfocada en el procesamiento de archivos JSON.

## Funcionalidades principales

TransactCheck incluye las siguientes funcionalidades:

- Carga de hasta 3 archivos JSON, con un máximo de 5 MiB por archivo y 15 MiB acumulados.
- Validación de archivos JSON antes de procesarlos.
- Identificación de transacciones en archivos con diferentes estructuras, incluyendo objetos anidados.
- Normalización de campos como identificador, monto, moneda, estado y fecha.
- Clasificación de transacciones válidas e inválidas, separando los objetos que no representan transacciones.
- Detección de errores, advertencias y posibles duplicados.
- Dashboard interactivo con indicadores, gráficos, filtros y análisis monetario.
- Consulta de transacciones con sus valores originales, normalizados y diagnósticos.
- Procesamiento de montos positivos, negativos y cero, utilizando `Decimal` para mantener la precisión.
- Visualización de resultados sin necesidad de guardar información en una base de datos.
- Asistente local experimental con la skill de consulta `transaction-query` conectada al motor transaccional.

La aplicación conserva sus cinco secciones transaccionales —**Carga de archivos, Dashboard, Transacciones, Inconsistencias y Reglas**— y añade una sexta vista experimental: **Asistente IA**.

## Tecnologías utilizadas

La aplicación utiliza las siguientes tecnologías:

- **React y TypeScript:** desarrollo de la interfaz y sus funcionalidades.
- **PrimeReact:** componentes visuales, tablas, filtros y controles.
- **Python:** identificación, normalización, validación y análisis de transacciones.
- **Pyodide:** permite ejecutar el motor Python directamente en el navegador.
- **Web Workers:** ejecutan el procesamiento fuera del hilo principal de la interfaz.
- **Vite:** entorno de desarrollo y compilación.
- **pytest:** pruebas automatizadas del motor Python.
- **Transformers.js:** inferencia experimental de un modelo generativo local en el navegador.
- **GitHub Actions y GitHub Pages:** validación, compilación y publicación de la aplicación.

El motor Python también puede ejecutarse de manera independiente con CPython, lo que facilita realizar pruebas sin depender del navegador.

## Instalación y ejecución

Para ejecutar TransactCheck localmente necesitas:

- Node.js 22.12 o superior.
- Python 3.10 o superior.
- npm.

Primero, clona el repositorio y entra en la carpeta del proyecto.

```bash
git clone https://github.com/DouglasLino/transactcheck.git
cd transactcheck
```

Crea un entorno virtual de Python:

```bash
python3 -m venv .venv
```

Activa el entorno virtual.

En macOS o Linux:

```bash
source .venv/bin/activate
```

En Windows (PowerShell):

```powershell
.venv\Scripts\Activate.ps1
```

Instala las dependencias de Python:

```bash
python -m pip install -r requirements-dev.txt
```

Instala las dependencias del frontend:

```bash
npm --prefix frontend install
```

Inicia la aplicación:

```bash
npm --prefix frontend run dev
```

Vite mostrará la dirección local para abrir TransactCheck desde el navegador.

La primera ejecución necesita conexión a Internet para descargar los recursos de Pyodide. El análisis de archivos se realiza localmente.

## Cómo utilizar TransactCheck

El funcionamiento de la aplicación es sencillo:

1. Ingresa a **Carga de archivos** y selecciona uno o varios archivos JSON.
2. La aplicación verifica que los archivos sean válidos y estén dentro de los límites permitidos.
3. Python analiza los objetos e identifica las posibles transacciones.
4. Desde el **Dashboard** puedes consultar indicadores generales, importes por moneda, estados y diagnósticos.
5. En **Transacciones** puedes buscar, filtrar y revisar los registros procesados.
6. En **Inconsistencias** puedes consultar errores y advertencias.
7. En **Reglas** puedes revisar las configuraciones utilizadas para interpretar los datos.
8. En **Asistente IA** se puede iniciar el modelo local y consultar conteos, extremos monetarios por moneda, duplicados, inconsistencias e identificadores sobre la sesión activa.

También puedes consultar el JSON original de cada registro y compararlo con los valores normalizados.

La interfaz incorpora archivos de ejemplo que se pueden seleccionar y cargar directamente, sin descargarlos manualmente.

## Estructura del proyecto

Las carpetas principales son:

```text
transactcheck/
├── .github/workflows/
├── config/
├── data/
│   └── samples/
│       ├── heterogeneous.json
│       ├── invalid_transactions.json
│       ├── large_mixed_transactions.json
│       ├── malformed.json
│       └── nested.json
├── frontend/
│   └── src/
│       ├── agent/
│       ├── ai/
│       ├── pages/
│       ├── services/
│       └── workers/
├── python/
│   └── transactcheck_engine/
├── tests/
├── AGENTS.md
└── README.md
```

- `config/`: configuraciones de alias, monedas, estados y otras reglas.
- `data/samples/`: archivos JSON utilizados para las pruebas.
- `frontend/`: interfaz web desarrollada con React.
- `frontend/src/ai/`: configuración, mensajes y contratos de la inferencia local.
- `frontend/src/agent/`: selección, validación y orquestación de operaciones del agente.
- `skills/transaction-query/`: instrucciones y ejemplos de la primera skill funcional.
- `python/transactcheck_engine/`: motor encargado del procesamiento.
- `tests/`: pruebas automatizadas.
- `AGENTS.md`: instrucciones y decisiones técnicas del proyecto.

## Pruebas

El proyecto incluye pruebas automatizadas para comprobar el procesamiento, las reglas de normalización y componentes del asistente que no requieren descargar el modelo.

Para ejecutarlas:

```bash
python -m pytest -q
```

Para validar TypeScript:

```bash
npm --prefix frontend run typecheck
```

Para ejecutar las pruebas unitarias del frontend sin descargar el modelo:

```bash
npm --prefix frontend test
```

Para comprobar el funcionamiento del motor con Pyodide:

```bash
npm --prefix frontend run smoke:pyodide
```

Para generar la compilación de producción:

```bash
npm --prefix frontend run build
```

Los datos de muestra permiten revisar la identificación de registros, los cálculos monetarios, la clasificación de datos y el manejo de errores, incluido un archivo cercano al límite de 5 MiB con más de 14,000 transacciones.

## Asistente IA experimental

La vista **Asistente IA** es una prueba de viabilidad independiente del motor transaccional. Usa `onnx-community/Qwen2.5-0.5B-Instruct` con Transformers.js y cuantización `q4`: un modelo generativo ajustado para instrucciones, de aproximadamente 0.5 mil millones de parámetros y con artefactos ONNX compatibles. Su familia declara soporte para español.

El modelo se descarga únicamente cuando el usuario pulsa **Iniciar asistente**. La primera carga puede requerir aproximadamente 1 GB de descarga desde Internet, incluido el archivo Q4 de unos 786 MB y sus recursos asociados; el navegador puede reutilizar su caché en visitas posteriores. Los pesos no forman parte del repositorio ni del build de GitHub Pages.

La inferencia se ejecuta en un Web Worker separado. La aplicación intenta usar WebGPU y, si no está disponible o falla la inicialización, utiliza CPU mediante WASM. WebGPU es opcional, pero normalmente ofrece mejor rendimiento. Se recomienda un navegador actualizado con WebAssembly, un equipo de 64 bits y al menos 8 GB de RAM total; esta cifra es una recomendación práctica, no un mínimo medido. En CPU, la carga y la generación pueden tardar considerablemente más. El consumo exacto depende del navegador, dispositivo y backend.

Para probarlo:

1. Ejecuta la aplicación y abre **Asistente IA**.
2. Pulsa **Iniciar asistente** y espera a que el estado cambie a **Listo**.
3. Carga un archivo JSON y envía una pregunta, por ejemplo `¿Cuál es la transacción de mayor monto?`.
4. Comprueba en el panel si se utilizó WebGPU o CPU/WASM.

La personalización utiliza un prompt central con identidad, contexto resumido, capacidades y restricciones de TransactCheck, acompañado de ejemplos conversacionales breves. El mensaje `system` y estos ejemplos se conservan en cada interacción antes del historial reciente; Transformers.js aplica la plantilla de chat incluida con el tokenizer de Qwen. El panel muestra la versión del perfil confirmada por el Worker y rechaza una instancia anterior conservada durante el desarrollo. No se sustituyen las respuestas generadas por textos predefinidos.

La skill funcional `transaction-query` permite consultar el total de transacciones, categorías, conteos por estado, moneda o fuente, extremos monetarios, posibles duplicados, inconsistencias frecuentes e identificadores exactos. Qwen primero clasifica cada solicitud como conversación, consulta de datos o capacidad no soportada. Las conversaciones continúan en lenguaje natural; únicamente las consultas de datos producen una operación JSON que el orquestador valida antes de solicitar el resultado al mismo Worker de Pyodide que mantiene la sesión. El modelo no recibe los JSON completos ni genera las cifras mostradas.

Los extremos se calculan con `Decimal`, se separan por moneda, incluyen negativos y cero, conservan empates y excluyen registros sin monto válido. La interfaz identifica la skill y operación utilizadas, muestra los tiempos de interpretación y ejecución y permite inspeccionar el resultado estructurado. Los fallos distinguen interpretación, inferencia y ejecución. El planificador acepta delimitadores Markdown y tokens especiales conocidos; si el JSON está incompleto o malformado realiza una sola reparación, pero nunca ejecuta operaciones desconocidas o argumentos inválidos. Las demás skills permanecen como contratos futuros sin implementación. La selección real de operaciones por Qwen requiere validación manual en un navegador compatible; las pruebas automatizadas simulan sus propuestas para verificar validación, rechazo y ejecución.

## Archivos de prueba

TransactCheck incluye cinco archivos JSON de ejemplo, disponibles en `data/samples/`.

Estos archivos aparecen en la interfaz y se pueden cargar desde **Carga de archivos** mediante la opción **Usar archivos de muestra**.

| Archivo | Descripción |
|---|---|
| `heterogeneous.json` | Contiene transacciones con distintos nombres de campos, monedas, estados y formatos de fecha. |
| `invalid_transactions.json` | Contiene transacciones incorrectas o incompletas para comprobar validaciones y diagnósticos. |
| `large_mixed_transactions.json` | Archivo de aproximadamente 4.48 MiB con 14,793 transacciones, combinando registros válidos, inválidos y objetos no identificados. |
| `malformed.json` | JSON con errores de sintaxis que debe ser rechazado completamente. |
| `nested.json` | Contiene transacciones dentro de objetos anidados para comprobar su identificación. |

El archivo `large_mixed_transactions.json` permite probar la aplicación con una cantidad considerable de registros sin superar el límite permitido. En la validación de referencia del conjunto, el motor identificó 14,793 transacciones: 7,398 válidas, 7,395 inválidas y 121 objetos no identificados.

## Publicación en GitHub Pages

TransactCheck está preparado para publicarse mediante GitHub Actions y GitHub Pages.

El flujo de trabajo se encuentra en:

```text
.github/workflows/ci-pages.yml
```

Este flujo ejecuta las pruebas, valida el frontend y genera la compilación de producción.


Una vez publicado, el proyecto puede abrirse desde:

https://douglaslino.github.io/transactcheck/

GitHub Pages únicamente aloja los archivos de la aplicación. Python se ejecuta en el navegador mediante Pyodide.

La carga inicial puede tardar mientras Pyodide descarga los recursos de Python.

Hay un indicador en la parte superior de la interfaz que muestra el progreso de la carga de Pyodide y el motor Python.


## Consideraciones y limitaciones

TransactCheck busca identificar y normalizar transacciones sin inventar información cuando los datos no son suficientemente claros.

Por ejemplo:

- Un monto como `"1,500"` puede ser ambiguo y quedar sin normalizar.
- El símbolo `$` no siempre permite identificar una moneda específica.
- Algunas fechas pueden interpretarse de diferentes maneras.
- Los estados desconocidos se conservan como `UNKNOWN`.
- Los objetos que no representan transacciones se mantienen separados.
- Los posibles duplicados se señalan para revisión, pero no se eliminan automáticamente.
- El nombre del archivo no determina el sistema o proveedor de origen.

Una transacción se considera válida cuando su monto y moneda pueden normalizarse correctamente. Las advertencias en otros campos no necesariamente la invalidan.

Esta primera versión trabaja únicamente con archivos JSON. No incluye exportaciones, conversión de monedas, almacenamiento permanente ni conexión a servicios externos de procesamiento.

El soporte para archivos XML se considera para una segunda versión (MVP2) y no está implementado.

## Estado del proyecto

El MVP1 permite cargar, analizar y explorar transacciones JSON durante la sesión del navegador. El procesamiento financiero se mantiene en Python/Pyodide. El asistente local puede consultar resultados mediante `transaction-query`, pero su selección de operaciones con el modelo pequeño permanece experimental y pendiente de validación manual en navegadores compatibles.
