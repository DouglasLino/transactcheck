import { engineClient } from '../services/engineClient';
import { localAiClient } from '../services/localAiClient';
import type { ChatMessage } from '../ai/types';
import type { AgentAnswer, TransactionQueryOperation } from './contracts';
import { parseRequestKind } from './requestRouter';
import { PlannerValidationError, validateAgentProposal } from './transactionQueryPlanner';

const labels: Record<TransactionQueryOperation, string> = {
  summary: 'resumen de transacciones', count_by: 'conteo agrupado', extreme_amount: 'extremo monetario',
  duplicate_groups: 'posibles duplicados', frequent_inconsistencies: 'inconsistencias frecuentes',
  find_by_transaction_id: 'búsqueda por identificador',
};

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function formatResult(operation: TransactionQueryOperation, result: Record<string, unknown>): string {
  if (operation === 'summary') return `Hay ${result.processedTransactions} transacciones procesadas: ${result.validTransactions} válidas y ${result.invalidTransactions} inválidas. Además, hay ${result.unidentifiedObjects} objetos no identificados.`;
  if (operation === 'count_by') {
    const rows = Object.entries(asRecord(result.counts)).map(([name, count]) => `${name}: ${count}`).join('; ');
    return rows ? `Conteo por ${String(result.groupBy)}: ${rows}.` : 'No hay registros para ese conteo.';
  }
  if (operation === 'extreme_amount') {
    const direction = result.direction === 'maximum' ? 'mayor' : 'menor';
    const groups = Array.isArray(result.groups) ? result.groups.map(asRecord) : [];
    if (!groups.length) return `No hay transacciones válidas con monto y moneda para calcular el ${direction} monto.`;
    const rows = groups.map((group) => {
      const records = Array.isArray(group.records) ? group.records.map(asRecord) : [];
      const ids = records.map((record) => String(record.transactionId || record.recordId)).join(', ');
      return `${group.currency} ${group.amount} (${ids}${Number(group.tieCount) > 1 ? `; empate de ${group.tieCount}` : ''})`;
    });
    return `Monto ${direction} por moneda: ${rows.join('; ')}. Los registros inválidos o sin monto normalizado no participan.`;
  }
  if (operation === 'duplicate_groups') return Number(result.groupCount) > 0 ? `Se encontraron ${result.groupCount} grupos de posibles duplicados. Son advertencias; ningún registro fue eliminado.` : 'No se encontraron grupos de posibles duplicados.';
  if (operation === 'frequent_inconsistencies') {
    const items = Array.isArray(result.items) ? result.items.map(asRecord) : [];
    const rows = items.map((item) => `${item.code}: ${item.count}`).join('; ');
    return rows ? `Inconsistencias más frecuentes: ${rows}. Total de diagnósticos: ${result.totalDiagnostics}.` : 'No se encontraron diagnósticos en los datos activos.';
  }
  const records = Array.isArray(result.records) ? result.records.map(asRecord) : [];
  if (!records.length) return `No se encontró ninguna transacción con el identificador ${String(result.transactionId)}.`;
  const rows = records.map((record) => {
    const diagnostics = Array.isArray(record.diagnostics) ? record.diagnostics.map(asRecord) : [];
    const reasons = diagnostics.map((item) => `${item.code}: ${item.message}`).join(', ');
    return `${record.sourceFile} ${record.jsonPath} (${record.category})${reasons ? ` — ${reasons}` : ' — sin diagnósticos'}`;
  }).join('; ');
  return `Se encontraron ${result.matchCount} coincidencias para ${String(result.transactionId)}: ${rows}.`;
}

export async function runAgentQuery(question: string, history: ChatMessage[]): Promise<AgentAnswer> {
  const interpretationStarted = performance.now();
  let kind;
  try {
    kind = parseRequestKind(await localAiClient.classifyRequest(question, history));
  } catch (error) {
    console.warn('Fallo de clasificación del agente', error);
    return { content: error instanceof Error ? error.message : 'No fue posible interpretar la solicitud de forma segura.', failure: { stage: 'interpretation', code: 'ROUTING_FAILED' } };
  }
  if (kind === 'CONVERSATION') return { content: await localAiClient.generate(question, history) };
  if (kind === 'UNSUPPORTED') {
    return { content: 'No puedo realizar esa solicitud con las capacidades actuales. Si te refieres a una transacción concreta, indica su identificador; también puedes preguntar por conteos, montos por moneda, duplicados o inconsistencias.', failure: { stage: 'interpretation', code: 'UNSUPPORTED' } };
  }

  const rawProposal = await localAiClient.selectTransactionQuery(question);
  let proposal;
  try {
    proposal = validateAgentProposal(rawProposal);
  } catch (error) {
    console.warn('Fallo del planificador transaction-query', {
      code: error instanceof PlannerValidationError ? error.code : 'UNKNOWN', attempt: 1, error,
    });
    if (error instanceof PlannerValidationError && error.recoverable) {
      const repaired = await localAiClient.repairTransactionQuery(question, rawProposal);
      try {
        proposal = validateAgentProposal(repaired);
      } catch (repairError) {
        console.warn('Fallo de recuperación transaction-query', {
          code: repairError instanceof PlannerValidationError ? repairError.code : 'UNKNOWN', attempt: 2, error: repairError,
        });
        return { content: 'No pude interpretar la consulta de datos con suficiente seguridad. Reformúlala indicando la operación y, si corresponde, la moneda o el identificador.', failure: { stage: 'interpretation', code: 'RECOVERY_FAILED' } };
      }
    } else {
      return { content: error instanceof PlannerValidationError && error.code === 'INVALID_ARGUMENTS'
        ? 'Falta información para ejecutar la consulta. Indica la moneda, el criterio o el identificador necesario.'
        : 'No pude relacionar la solicitud con una operación disponible de forma segura. No se ejecutó ninguna consulta.', failure: { stage: 'interpretation', code: error instanceof PlannerValidationError ? error.code : 'PLANNING_FAILED' } };
    }
  }
  const interpretationMs = Math.round(performance.now() - interpretationStarted);
  const executionStarted = performance.now();
  const execution = await engineClient.executeTransactionQuery(proposal);
  const executionMs = Math.round(performance.now() - executionStarted);
  if (!execution.ok || !execution.result) return { content: execution.error?.message || 'La consulta no pudo ejecutarse y no se modificó ningún dato.', failure: { stage: 'execution', code: execution.error?.code } };
  return { content: formatResult(proposal.operation, execution.result), trace: { skillId: 'transaction-query', operation: proposal.operation, interpretationMs, executionMs, result: execution.result } };
}

export function operationLabel(operation: TransactionQueryOperation): string { return labels[operation]; }
