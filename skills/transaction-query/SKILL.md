---
name: transaction-query
description: Consulta de forma segura los resultados transaccionales activos de TransactCheck mediante operaciones estructuradas de solo lectura. Se aplica a conteos, agrupaciones, extremos monetarios, duplicados, inconsistencias e identificadores; no modifica registros ni reglas.
---

# Transaction Query

Usa esta skill únicamente para consultar la sesión activa del motor Python de TransactCheck.

## Flujo

1. Activa la skill solo después de que el clasificador identifique una consulta de datos. Las conversaciones y solicitudes no soportadas no pasan por el planificador JSON.
2. Convierte la intención en una de las operaciones admitidas y sus argumentos JSON.
3. Rechaza intenciones ambiguas, operaciones desconocidas y argumentos no permitidos. Reintenta una sola vez si el JSON está incompleto o malformado.
4. Ejecuta la operación mediante `executeTransactionQuery` en el Worker de Pyodide.
5. Presenta solamente los datos estructurados devueltos por Python e identifica la skill y la operación utilizadas.

## Operaciones

- `summary`: conteos procesados, válidos, inválidos y no identificados.
- `count_by`: agrupación por `status`, `currency` o `source`.
- `extreme_amount`: máximo o mínimo mediante `direction`; acepta `currency` opcional.
- `duplicate_groups`: grupos de posibles duplicados.
- `frequent_inconsistencies`: diagnósticos más frecuentes; acepta `limit` entre 1 y 20.
- `find_by_transaction_id`: coincidencia exacta mediante `transactionId`.

Para esquemas y casos esperados, consulta [references/query-examples.md](references/query-examples.md).

## Restricciones

- Trata la skill como solo lectura; no modifica, elimina ni reclasifica registros.
- No envía objetos originales ni colecciones completas al modelo.
- Mantiene respuestas compactas: conserva conteos totales y marca `truncated` cuando limita el detalle transportado.
- Conserva montos como strings decimales y deja comparaciones monetarias a Python con `Decimal`.
- No compara monedas entre sí. Sin moneda explícita, devuelve extremos separados por moneda.
- Incluye montos negativos y cero en su orden natural; excluye registros inválidos o sin monto normalizado y conserva todos los empates.
- No confirma duplicados: reporta únicamente los grupos advertidos por el motor.
- Si no hay datos activos, informa el estado sin inventar resultados.
