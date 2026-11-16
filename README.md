# TransactCheck

TransactCheck es una aplicación web en español para cargar archivos JSON heterogéneos, detectar posibles transacciones, normalizarlas a un modelo común, validarlas y explorar métricas y diagnósticos. Todo el procesamiento ocurre localmente en el navegador mediante Python y Pyodide; no existe backend, base de datos ni persistencia de archivos.

## Alcance del MVP1

- Hasta 3 archivos `.json`, 5 MiB por archivo y 15 MiB acumulados.
- Validación sintáctica completa antes de analizar cualquier objeto.
- Detección conservadora en documentos anidados, con rutas JSON y separación entre `VALID`, `INVALID` y `UNIDENTIFIED`.
- Modelo de nueve campos: `transactionId`, `source`, `amount`, `currency`, `status`, `transactionDate`, `transactionType`, `referenceId` y `description`.
- Validez basada únicamente en monto y moneda normalizados.
- Cálculos monetarios con `decimal.Decimal`, transportados a React como strings.
- Posibles duplicados advertidos sin eliminar ni invalidar registros.
- Cinco vistas: carga, dashboard, transacciones, inconsistencias y reglas.
- Sin XML, exportaciones, conversiones de moneda, APIs de IA ni servicios externos de procesamiento. XML queda reservado para MVP2.

## Arquitectura

```text
React / PrimeReact
       │ solicitudes compactas (resumen, página, detalle)
       ▼
Web Worker ── Pyodide 314.0.8
       │
       ├── detección
       ├── normalización
       ├── validación
       ├── métricas con Decimal
       └── sesión en memoria
```

La colección principal, objetos originales y diagnósticos permanecen en `SessionEngine` dentro del Worker. React recibe resúmenes, opciones de filtro, páginas y detalles solicitados. Al retirar un archivo, Python libera sus registros y recalcula duplicados y métricas.

Carpetas principales:

- `python/transactcheck_engine/`: motor compatible con CPython y Pyodide.
- `config/`: alias, catálogos y reglas inspeccionables.
- `frontend/src/workers/`: integración del Worker con Pyodide.
- `frontend/src/pages/`: cinco vistas de la aplicación.
- `data/samples/`: JSON de prueba válidos, anidados y malformados.
- `tests/`: pruebas básicas de reglas e invariantes.

## Requisitos

- Node.js 22.12 o superior (Vite 8 también admite Node 20.19+).
- Python 3.10 o superior.
- Conexión inicial para descargar los recursos estáticos fijados de Pyodide desde jsDelivr. El procesamiento posterior no envía transacciones a ningún servicio.

## Desarrollo local

Desde la raíz del repositorio:

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements-dev.txt
npm --prefix frontend install
npm --prefix frontend run dev
```

Vite mostrará la URL local. El script previo sincroniza automáticamente el motor Python y `config/` hacia los recursos públicos del frontend.

## Pruebas y compilación

```bash
.venv/bin/python -m pytest -q
npm --prefix frontend run typecheck
npm --prefix frontend run smoke:pyodide
npm --prefix frontend run build
```

`smoke:pyodide` ejecuta el motor real dentro de Pyodide y procesa `data/samples/heterogeneous.json`. El build de producción queda en `frontend/dist/` con base `/transactcheck/`.

## Reglas relevantes

- Un JSON malformado se rechaza íntegramente y no consume cupo.
- Un objeto con monto y moneda reconocibles es evidencia mínima, salvo contextos excluidos como resúmenes, subtotales o líneas de producto.
- Un registro transaccional con monto o moneda ausente/ambiguo se conserva como `INVALID`.
- `"1,500"` queda sin monto por ambigüedad cuando no existe contexto fiable.
- `$` no se interpreta como USD; `US$` sí está configurado como alias inequívoco.
- Fechas con barras se evalúan como DMY y MDY. Si ambas interpretaciones son válidas y diferentes, se emite `AMBIGUOUS_DATE`.
- Estados sin equivalencia explícita quedan como `UNKNOWN` y no invalidan la transacción.
- La similitud léxica solo admite una variación tipográfica mínima, con otro campo transaccional de respaldo; no equipara conceptos distintos.

La vista **Reglas** muestra las configuraciones efectivamente cargadas por el motor.

## GitHub Pages

El workflow `.github/workflows/ci-pages.yml` ejecuta pytest, TypeScript, la prueba real de Pyodide y el build. Solo un `push` exitoso a `main` prepara y despliega el artefacto de Pages.

En GitHub:

1. Abrir **Settings → Pages**.
2. Elegir **GitHub Actions** como origen.
3. Confirmar que Actions tiene permisos de lectura/escritura en **Settings → Actions → General → Workflow permissions** cuando la política del repositorio lo requiera.
4. Hacer push a `main` y verificar el workflow **CI y despliegue a GitHub Pages**.
5. Abrir `https://<usuario>.github.io/transactcheck/` después de un despliegue exitoso.

No se debe configurar un servidor Python: GitHub Pages solo aloja archivos estáticos y Pyodide ejecuta Python en el navegador.

## Datos de prueba

- `heterogeneous.json`: alias en español/inglés, montos válidos y ambiguos, estados y fechas.
- `nested.json`: estructuras anidadas, fecha bisiesta y exclusión de resumen.
- `malformed.json`: documento inválido que debe rechazarse por completo.

## Limitaciones documentadas

- No existen preferencias regionales o por fuente configuradas para separadores o fechas ambiguas; esos valores permanecen sin normalizar.
- No se asignan equivalencias universales a `SUCCESS`, `PAID`, `COMPLETED` o `PROCESSING`.
- El nombre del archivo nunca confirma la fuente.
- La prueba automatizada de Pyodide valida el runtime y el mismo puente de archivos; la inspección visual en navegadores reales sigue siendo una revisión manual recomendada antes de la entrega académica.

