# TransactCheck

TransactCheck es una aplicación web que desarrollé para analizar archivos JSON que contienen transacciones financieras. El objetivo es poder trabajar con archivos de diferentes estructuras, identificar las transacciones, organizar sus datos en un formato común y detectar posibles errores o inconsistencias.

La aplicación permite cargar archivos, visualizar los resultados desde un Dashboard y revisar cada transacción con sus datos originales, valores normalizados y diagnósticos.

Todo el procesamiento se realiza localmente en el navegador utilizando Python y Pyodide, sin necesidad de un servidor, una base de datos o servicios externos para analizar la información.

Este proyecto corresponde a la primera versión funcional (MVP1), enfocada en el procesamiento de archivos JSON.

## Funcionalidades principales

Estas son las funcionalidades que incluye actualmente TransactCheck:

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

La aplicación cuenta con cinco secciones: **Carga de archivos, Dashboard, Transacciones, Inconsistencias y Reglas**.

## Tecnologías utilizadas

Para desarrollar el proyecto utilicé las siguientes tecnologías:

- **React y TypeScript:** desarrollo de la interfaz y sus funcionalidades.
- **PrimeReact:** componentes visuales, tablas, filtros y controles.
- **Python:** identificación, normalización, validación y análisis de transacciones.
- **Pyodide:** permite ejecutar el motor Python directamente en el navegador.
- **Web Workers:** ejecutan el procesamiento fuera del hilo principal de la interfaz.
- **Vite:** entorno de desarrollo y compilación.
- **pytest:** pruebas automatizadas del motor Python.
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

La primera ejecución necesita conexión a Internet para descargar los recursos de Pyodide. El análisis de los archivos se realiza localmente.

## Cómo utilizar TransactCheck

El funcionamiento de la aplicación es sencillo:

1. Ingresa a **Carga de archivos** y selecciona uno o varios archivos JSON.
2. La aplicación verifica que los archivos sean válidos y estén dentro de los límites permitidos.
3. Python analiza los objetos e identifica las posibles transacciones.
4. Desde el **Dashboard** puedes consultar indicadores generales, importes por moneda, estados y diagnósticos.
5. En **Transacciones** puedes buscar, filtrar y revisar los registros procesados.
6. En **Inconsistencias** puedes consultar errores y advertencias.
7. En **Reglas** puedes revisar las configuraciones utilizadas para interpretar los datos.

También puedes consultar el JSON original de cada registro y compararlo con los valores normalizados.

Para facilitar las pruebas, incluí archivos de ejemplo que se pueden seleccionar y cargar directamente desde el frontend, sin necesidad de descargarlos manualmente.

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
│       ├── pages/
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
- `python/transactcheck_engine/`: motor encargado del procesamiento.
- `tests/`: pruebas automatizadas.
- `AGENTS.md`: instrucciones y decisiones técnicas del proyecto.

## Pruebas

El proyecto incluye pruebas automatizadas para comprobar el procesamiento y las reglas de normalización.

Para ejecutarlas:

```bash
python -m pytest -q
```

Para validar TypeScript:

```bash
npm --prefix frontend run typecheck
```

Para comprobar el funcionamiento del motor con Pyodide:

```bash
npm --prefix frontend run smoke:pyodide
```

Para generar la compilación de producción:

```bash
npm --prefix frontend run build
```

También realicé pruebas con archivos JSON de diferentes estructuras y tamaños, incluyendo un archivo cercano al límite de 5 MiB con más de 14,000 transacciones.

Estas pruebas permiten revisar la identificación de registros, los cálculos monetarios, la clasificación de datos y el manejo de errores.

## Archivos de prueba

TransactCheck incluye cinco archivos JSON de ejemplo, disponibles en `data/samples/`.

Estos archivos también aparecen en la interfaz, por lo que pueden seleccionarse y cargarse directamente desde la sección **Carga de archivos**, justo debajo del boton de "Seleccionar archivos", es el boton de "Usar archivos de muestra".

| Archivo | Descripción |
|---|---|
| `heterogeneous.json` | Contiene transacciones con diferentes nombres de campos, monedas, estados y formatos de fecha, el cual es un archivo correcto. |
| `invalid_transactions.json` | Contiene transacciones con datos incorrectos o incompletos para comprobar su validación y los diagnósticos generados, Todos los registros estan incorrectos.|
| `large_mixed_transactions.json` | Archivo de aproximadamente 4.48 MiB con 14,793 transacciones, combinando registros válidos, inválidos y objetos no identificados. |
| `malformed.json` | JSON con errores de sintaxis que debe ser rechazado completamente. |
| `nested.json` | Contiene transacciones dentro de objetos anidados para comprobar su identificación. |

El archivo `large_mixed_transactions.json` es especialmente útil para probar el comportamiento de la aplicación con una cantidad considerable de registros, sin superar el límite permitido.

Durante las pruebas, el motor identificó 14,793 transacciones, clasificó 7,398 como válidas y 7,395 como inválidas, además de separar 121 objetos no identificados.

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

Como es gratuito, es de esperar unos segundos o minutos para que la página se cargue completamente, ya que Pyodide necesita descargar los recursos de Python.

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

El soporte para archivos XML queda considerado para una segunda versión (MVP2), esto aun pendiente.

## Conclusión

Con TransactCheck busqué desarrollar una herramienta que permita analizar archivos de transacciones financieras sin depender de una estructura JSON única.

Durante el desarrollo trabajé con archivos de prueba, revisé los resultados del procesamiento y fui ajustando las reglas para mejorar la identificación y normalización de los datos.

El resultado es una primera versión funcional que permite cargar archivos, analizar transacciones, consultar indicadores y revisar inconsistencias desde una interfaz web.

Además de construir la aplicación, este proyecto me permitió seguir practicando Python, React y el uso de herramientas de inteligencia artificial como apoyo durante el desarrollo.