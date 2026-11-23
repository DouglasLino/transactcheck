# Nota técnica — TransactCheck

## Decisiones de diseño

El MVP usa React 19, TypeScript, Vite y PrimeReact para presentación. La lógica transaccional reside en un paquete Python modular: detección, normalización, validación, métricas y sesión. Pyodide 314.0.8 ejecuta ese paquete dentro de un Web Worker, mantiene una colección principal y expone consultas compactas.

Los importes se parsean y calculan con `decimal.Decimal`; al cruzar hacia JavaScript siguen siendo strings. La carga usa `json.loads` sobre el documento completo antes de detectar objetos. Si la sintaxis falla, el archivo se descarta y solo genera un diagnóstico `FILE`. La detección evita contar contenedores y conserva como `UNIDENTIFIED` los objetos sin evidencia suficiente.

Las reglas semánticas están en JSON versionado. Se prefirió `difflib`, incluido en Python/Pyodide, frente a RapidFuzz para evitar un paquete adicional. La comparación aproximada solo respalda variaciones tipográficas mínimas cuando existe otra evidencia transaccional. Los duplicados generan advertencias y nunca eliminan registros.

La capa agentic incorpora `transaction-query` como primera skill funcional. Transformers.js propone una operación JSON breve; TypeScript valida una lista cerrada de operaciones y argumentos; el Worker de Pyodide ejecuta la consulta sobre la misma colección usada por el dashboard. El modelo no recibe objetos originales ni colecciones completas. Python conserva `Decimal`, separa monedas y devuelve resultados estructurados de solo lectura.

## Uso consciente de IA y ajustes realizados

La IA se utilizó como apoyo para estructurar el repositorio, implementar componentes, preparar pruebas y contrastar el resultado con `AGENTS.md`. Las decisiones funcionales proceden de la especificación del usuario. Las sugerencias no se aplicaron de forma automática:

- Se mantuvo el asistente separado de las reglas financieras. `transaction-query` consulta resultados existentes, pero no modifica detección, normalización, validez ni registros.
- Para similitud se evitó añadir RapidFuzz: `difflib` cumplía el criterio conservador y reducía dependencias. También se limitaron las coincidencias aproximadas para que no crearan equivalencias financieras.
- Durante la revisión se corrigió la herencia de una fuente explícita desde contenedores y se evitó marcar como desconocida una clave aceptada por variación tipográfica.
- Para la PoC se evaluó `SmolLM2-360M-Instruct`, más liviano, pero se prefirió `onnx-community/Qwen2.5-0.5B-Instruct` por su soporte declarado de español, ajuste para instrucciones y artefactos ONNX. Se aplicó Q4, descarga bajo demanda y respaldo WASM en vez de asumir WebGPU.
- La respuesta genérica no se atribuyó de nuevo al texto del prompt sin comprobar el recorrido técnico. Se verificó que el pipeline recibe un único `system` en primera posición y que el tokenizer lo serializa como `<|im_start|>system … <|im_end|>`, seguido del usuario y del marcador de generación del asistente. El resultado es igual con y sin historial respecto a la posición de las instrucciones. No se detectaron roles duplicados ni tokens especiales incorrectos.
- Se identificó un riesgo concreto durante desarrollo: el cliente conserva una única instancia del Web Worker y una actualización mediante HMR puede dejar activo el código anterior. Se añadió una versión del perfil que el Worker debe confirmar; una discrepancia bloquea la conversación y solicita recargar la página. El modelo sigue generando las respuestas, sin sustituciones predefinidas.
- Se compararon los parámetros actuales, deterministas (`do_sample: false`), con la configuración de muestreo publicada para el modelo. No se cambiaron sin evidencia de inferencia porque el muestreo no garantiza mayor obediencia a la identidad y reduciría la reproducibilidad del diagnóstico.
- No se delegaron cifras al LLM. La selección se limita a `summary`, `count_by`, `extreme_amount`, `duplicate_groups`, `frequent_inconsistencies` y `find_by_transaction_id`; cualquier operación o argumento desconocido se rechaza antes de Pyodide. Las respuestas de datos se construyen desde el resultado Python y muestran trazabilidad y tiempos.
- Se corrigió el enrutamiento que obligaba a todas las preguntas a producir JSON. Un primer paso breve clasifica `CONVERSATION`, `SKILL` o `UNSUPPORTED`; solo `SKILL` activa el planificador estructurado. El historial reciente participa en la clasificación y se eliminan metadatos internos antes de enviarlo al tokenizer.
- El parser solo retira Markdown y tokens especiales conocidos, exige que el contenido restante sea un único objeto JSON y registra códigos técnicos. Una salida incompleta o malformada permite una única reparación; esquemas, operaciones y argumentos no permitidos se rechazan sin recuperación ni ejecución.
- El diagnóstico de `ROUTING_FAILED` mostró que el clasificador podía expresar una única etiqueta válida dentro de una frase breve y el parser exigía la etiqueta aislada. Se conservó la decisión del LLM y se amplió únicamente la extracción para aceptar una etiqueta inequívoca en una salida corta sin JSON; respuestas con etiquetas múltiples o estructuras arbitrarias continúan rechazándose. En desarrollo se registra la salida cruda del router cuando cumple un filtro seguro.
- Las pruebas simulan propuestas del modelo para verificar el flujo completo sin presentar esa simulación como inferencia real. La selección de intenciones con Qwen 0.5B Q4 sigue pendiente de validación manual en navegador y puede fallar o ser ambigua; en ese caso no se ejecuta una operación arbitraria.

La verificación automatizada comprende pruebas Python, pruebas unitarias del frontend, TypeScript, smoke test de Pyodide y build. Esta nota requiere revisión humana para confirmar que representa fielmente el proceso y añadir la valoración personal del autor antes de la entrega académica.
