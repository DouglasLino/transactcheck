# Nota técnica — TransactCheck MVP1

## Decisiones de diseño

El MVP usa React 19, TypeScript, Vite y PrimeReact para presentación. La lógica transaccional reside en un paquete Python modular: detección, normalización, validación, métricas y sesión. Pyodide 314.0.8 ejecuta ese paquete dentro de un Web Worker para no bloquear la interfaz. El Worker mantiene una única colección principal y expone consultas compactas de resúmenes, páginas filtradas y detalles.

Los importes se parsean y calculan con `decimal.Decimal`; al cruzar hacia JavaScript siguen siendo strings. La carga usa `json.loads` sobre el documento completo antes de detectar objetos. Si la sintaxis falla, el archivo se descarta y solo genera un diagnóstico `FILE`. La detección evita contar contenedores y no desciende dentro de una transacción ya reconocida. Los objetos sin evidencia suficiente se conservan como `UNIDENTIFIED`.

Las reglas semánticas están en JSON versionado. Se prefirió `difflib`, incluido en Python/Pyodide, frente a RapidFuzz para evitar un paquete adicional. La comparación aproximada solo respalda variaciones tipográficas mínimas cuando existe otra evidencia transaccional; no decide equivalencias semánticas. Fuentes explícitas en contenedores se heredan, pero los nombres de archivo no se usan como evidencia.

Los duplicados generan advertencias por objeto original idéntico, identificador + fuente o coincidencia de referencia, fecha, monto y moneda. Nunca se eliminan registros. Al retirar un archivo se recalculan coincidencias, métricas y diagnósticos.

## Uso consciente de IA

La IA se utilizó como apoyo técnico para estructurar el repositorio, implementar el motor y la interfaz, preparar pruebas y revisar la implementación contra `AGENTS.md`. Las decisiones funcionales provienen de la especificación del usuario. Durante la revisión se corrigió la herencia de una fuente explícita desde el contenedor y se evitó reportar como desconocida una clave aceptada por variación tipográfica. No se añadieron equivalencias financieras no aprobadas.

Esta nota requiere revisión humana antes de la entrega académica para confirmar que describe fielmente el proceso de trabajo y añadir, si corresponde, observaciones personales del autor.
