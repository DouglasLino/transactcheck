import type { TransactionQueryOperation, TransactionQueryProposal } from './contracts';

export const TRANSACTION_QUERY_PLANNER_PROMPT = `Convierte la consulta de datos de TransactCheck en una operación. Devuelve SOLO JSON compacto, sin Markdown ni explicación.
Formato: {"skillId":"transaction-query","operation":string,"arguments":{}}
Operaciones permitidas:
- summary: totales, válidas, inválidas o no identificadas. Sin argumentos.
- count_by: conteos. arguments.groupBy = "status", "currency" o "source".
- extreme_amount: mayor o menor monto. arguments.direction = "maximum" o "minimum"; arguments.currency = código ISO opcional.
- duplicate_groups: posibles duplicados. Sin argumentos.
- frequent_inconsistencies: inconsistencias frecuentes. arguments.limit = entero opcional entre 1 y 20.
- find_by_transaction_id: búsqueda exacta o explicación de invalidez con referencia explícita. arguments.transactionId = texto.
Ejemplos equivalentes para extreme_amount maximum: "transacción más alta", "transacción de mayor monto" y "la más cara".
Si falta un argumento obligatorio, no lo inventes.`;

export const TRANSACTION_QUERY_REPAIR_PROMPT = `Repara una salida JSON de transaction-query incompleta o malformada. Devuelve SOLO un objeto JSON compacto con skillId, operation y arguments. Conserva únicamente información presente en la pregunta. No inventes argumentos ni agregues Markdown.`;

export type PlannerFailureCode = 'MISSING_JSON' | 'INCOMPLETE_JSON' | 'MALFORMED_JSON' | 'INVALID_SCHEMA' | 'UNKNOWN_OPERATION' | 'INVALID_ARGUMENTS';

export class PlannerValidationError extends Error {
  constructor(readonly code: PlannerFailureCode, message: string, readonly recoverable = false) { super(message); }
}

const operations = new Set<TransactionQueryOperation>([
  'summary', 'count_by', 'extreme_amount', 'duplicate_groups',
  'frequent_inconsistencies', 'find_by_transaction_id',
]);

function extractJson(raw: string): unknown {
  const sanitized = raw
    .replace(/<\|im_start\|>assistant/gi, '')
    .replace(/<\|im_end\|>/gi, '')
    .trim();
  const fenced = sanitized.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const candidate = (fenced ? fenced[1] : sanitized).trim();
  if (!candidate.startsWith('{')) throw new PlannerValidationError('MISSING_JSON', 'El selector no produjo una operación estructurada.', false);
  if (!candidate.endsWith('}')) throw new PlannerValidationError('INCOMPLETE_JSON', 'La operación JSON quedó incompleta.', true);
  try {
    return JSON.parse(candidate);
  } catch {
    throw new PlannerValidationError('MALFORMED_JSON', 'La operación JSON tiene sintaxis inválida.', true);
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function validateAgentProposal(raw: string): TransactionQueryProposal {
  const value = extractJson(raw);
  if (!isPlainObject(value) || !isPlainObject(value.arguments)) throw new PlannerValidationError('INVALID_SCHEMA', 'La operación no cumple el contrato esperado.');
  if (value.skillId !== 'transaction-query' || typeof value.operation !== 'string' || !operations.has(value.operation as TransactionQueryOperation)) {
    throw new PlannerValidationError('UNKNOWN_OPERATION', 'La operación propuesta no está permitida.');
  }
  const proposal: TransactionQueryProposal = { skillId: 'transaction-query', operation: value.operation as TransactionQueryOperation, arguments: value.arguments };
  validateArguments(proposal);
  return proposal;
}

function validateArguments(proposal: TransactionQueryProposal): void {
  const args = proposal.arguments;
  const allowed = (() => {
    switch (proposal.operation) {
      case 'summary': case 'duplicate_groups': return new Set<string>();
      case 'count_by': return new Set(['groupBy']);
      case 'extreme_amount': return new Set(['direction', 'currency']);
      case 'frequent_inconsistencies': return new Set(['limit']);
      case 'find_by_transaction_id': return new Set(['transactionId']);
    }
  })();
  if (Object.keys(args).some((key) => !allowed.has(key))) throw new PlannerValidationError('INVALID_ARGUMENTS', 'La operación contiene argumentos no permitidos.');
  if (proposal.operation === 'count_by' && !['status', 'currency', 'source'].includes(String(args.groupBy))) throw new PlannerValidationError('INVALID_ARGUMENTS', 'El agrupamiento propuesto no es válido.');
  if (proposal.operation === 'extreme_amount') {
    if (!['maximum', 'minimum'].includes(String(args.direction))) throw new PlannerValidationError('INVALID_ARGUMENTS', 'La dirección del extremo no es válida.');
    if (args.currency != null && (typeof args.currency !== 'string' || !/^[A-Za-z]{3}$/.test(args.currency))) throw new PlannerValidationError('INVALID_ARGUMENTS', 'La moneda propuesta no es válida.');
  }
  if (proposal.operation === 'frequent_inconsistencies' && args.limit != null && (!Number.isInteger(args.limit) || Number(args.limit) < 1 || Number(args.limit) > 20)) throw new PlannerValidationError('INVALID_ARGUMENTS', 'El límite propuesto no es válido.');
  if (proposal.operation === 'find_by_transaction_id' && (typeof args.transactionId !== 'string' || !args.transactionId.trim())) throw new PlannerValidationError('INVALID_ARGUMENTS', 'Falta un identificador de transacción válido.');
}
