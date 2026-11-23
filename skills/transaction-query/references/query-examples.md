# Esquema y ejemplos de transaction-query

La propuesta del selector usa este contrato:

```json
{
  "skillId": "transaction-query",
  "operation": "summary",
  "arguments": {}
}
```

## Ejemplos

| Pregunta | Operación | Argumentos |
|---|---|---|
| ¿Cuántas transacciones tengo? | `summary` | `{}` |
| ¿Cuántas hay por estado? | `count_by` | `{"groupBy":"status"}` |
| ¿Cuál es el mayor monto en USD? | `extreme_amount` | `{"direction":"maximum","currency":"USD"}` |
| ¿Cuál es la transacción más barata? | `extreme_amount` | `{"direction":"minimum"}` |
| ¿Hay posibles duplicados? | `duplicate_groups` | `{}` |
| ¿Cuáles son los cinco errores más comunes? | `frequent_inconsistencies` | `{"limit":5}` |
| Busca la transacción TX-100 | `find_by_transaction_id` | `{"transactionId":"TX-100"}` |

Antes de solicitar JSON, el clasificador devuelve una única etiqueta:

```text
CONVERSATION
SKILL
UNSUPPORTED
```

`CONVERSATION` continúa en lenguaje natural. `SKILL` activa este contrato. `UNSUPPORTED` informa la limitación o solicita una referencia concreta. Solo un JSON incompleto o con sintaxis inválida admite una segunda generación de reparación; una operación desconocida o argumentos inválidos se rechazan sin ejecutar Python.

## Resultados monetarios

`extreme_amount` devuelve un arreglo `groups`. Cada grupo contiene `currency`, `amount`, `records` y `tieCount`. Si no se indica moneda, cada código se calcula por separado. En un empate, `tieCount` cuenta todos los registros con el mismo extremo exacto.

Los conteos totales no se recortan. Para evitar transferir colecciones voluminosas fuera de Python, el detalle devuelve hasta 20 registros por resultado y hasta 10 grupos de duplicados. `truncated: true` indica que existen más coincidencias en la sesión.

Los conteos por moneda coinciden con las métricas monetarias del dashboard y, por tanto, incluyen únicamente transacciones `VALID`. Los conteos por estado y fuente comprenden las transacciones reconocidas `VALID` e `INVALID`.
