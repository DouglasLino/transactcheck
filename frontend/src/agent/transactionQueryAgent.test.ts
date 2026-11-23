import { beforeEach, describe, expect, it, vi } from 'vitest';

const { classifyRequest, selectTransactionQuery, repairTransactionQuery, generate, executeTransactionQuery } = vi.hoisted(() => ({
  classifyRequest: vi.fn(),
  selectTransactionQuery: vi.fn(),
  repairTransactionQuery: vi.fn(),
  generate: vi.fn(),
  executeTransactionQuery: vi.fn(),
}));

vi.mock('../services/localAiClient', () => ({ localAiClient: { classifyRequest, selectTransactionQuery, repairTransactionQuery, generate } }));
vi.mock('../services/engineClient', () => ({ engineClient: { executeTransactionQuery } }));

import { runAgentQuery } from './transactionQueryAgent';

beforeEach(() => {
  vi.clearAllMocks();
  classifyRequest.mockResolvedValue('SKILL');
});

describe('orquestador transaction-query', () => {
  it('ejecuta en Python únicamente la propuesta validada del modelo', async () => {
    selectTransactionQuery.mockResolvedValue('{"skillId":"transaction-query","operation":"summary","arguments":{}}');
    executeTransactionQuery.mockResolvedValue({ ok: true, result: { processedTransactions: 3, validTransactions: 2, invalidTransactions: 1, unidentifiedObjects: 4 } });
    const answer = await runAgentQuery('¿Cuántas tengo?', []);
    expect(executeTransactionQuery).toHaveBeenCalledWith({ skillId: 'transaction-query', operation: 'summary', arguments: {} });
    expect(answer.content).toContain('3 transacciones');
    expect(answer.trace?.operation).toBe('summary');
  });

  it.each([
    'cual es la transaccion mas alta',
    'transaccion de mayor monto',
    'cual es la mas cara',
  ])('acepta una selección SKILL explicada por el modelo y ejecuta extreme_amount: %s', async (question) => {
    classifyRequest.mockResolvedValue('La clasificación correcta es SKILL');
    selectTransactionQuery.mockResolvedValue('{"skillId":"transaction-query","operation":"extreme_amount","arguments":{"direction":"maximum"}}');
    executeTransactionQuery.mockResolvedValue({ ok: true, result: { direction: 'maximum', groups: [] } });
    const answer = await runAgentQuery(question, []);
    expect(executeTransactionQuery).toHaveBeenCalledWith({
      skillId: 'transaction-query', operation: 'extreme_amount', arguments: { direction: 'maximum' },
    });
    expect(answer.trace?.operation).toBe('extreme_amount');
  });

  it('no ejecuta una operación desconocida', async () => {
    selectTransactionQuery.mockResolvedValue('{"skillId":"transaction-query","operation":"delete_all","arguments":{}}');
    const answer = await runAgentQuery('borra todo', []);
    expect(executeTransactionQuery).not.toHaveBeenCalled();
    expect(answer.content).toContain('operación disponible');
    expect(repairTransactionQuery).not.toHaveBeenCalled();
  });

  it('presenta el error controlado cuando no hay datos', async () => {
    selectTransactionQuery.mockResolvedValue('{"skillId":"transaction-query","operation":"summary","arguments":{}}');
    executeTransactionQuery.mockResolvedValue({ ok: false, error: { code: 'NO_ACTIVE_DATA', message: 'No hay archivos procesados con registros disponibles para consultar.' } });
    const answer = await runAgentQuery('¿Cuántas tengo?', []);
    expect(answer.content).toContain('No hay archivos');
  });

  it.each(['Hola', '¿Quién eres?', '¿Qué puedo hacer aquí?', '¿Para qué sirve este proyecto?', '¿Qué significa una transacción inválida?', '¿Por qué falló?'])('usa lenguaje natural para conversación: %s', async (question) => {
    classifyRequest.mockResolvedValue('La etiqueta es CONVERSATION');
    generate.mockResolvedValue('Soy el asistente de TransactCheck.');
    const history = [{ role: 'user' as const, content: 'Contexto anterior' }];
    const answer = await runAgentQuery(question, history);
    expect(classifyRequest).toHaveBeenCalledWith(question, history);
    expect(selectTransactionQuery).not.toHaveBeenCalled();
    expect(executeTransactionQuery).not.toHaveBeenCalled();
    expect(answer.content).toContain('TransactCheck');
  });

  it('solicita una referencia para una explicación específica ambigua', async () => {
    classifyRequest.mockResolvedValue('UNSUPPORTED');
    const answer = await runAgentQuery('¿Por qué esta transacción es inválida?', []);
    expect(answer.content).toContain('identificador');
    expect(selectTransactionQuery).not.toHaveBeenCalled();
  });

  it('realiza una única recuperación controlada para JSON incompleto', async () => {
    selectTransactionQuery.mockResolvedValue('{"skillId":"transaction-query","operation":"summary"');
    repairTransactionQuery.mockResolvedValue('{"skillId":"transaction-query","operation":"summary","arguments":{}}');
    executeTransactionQuery.mockResolvedValue({ ok: true, result: { processedTransactions: 1, validTransactions: 1, invalidTransactions: 0, unidentifiedObjects: 0 } });
    const answer = await runAgentQuery('¿Cuántas transacciones tengo?', []);
    expect(repairTransactionQuery).toHaveBeenCalledOnce();
    expect(executeTransactionQuery).toHaveBeenCalledOnce();
    expect(answer.content).toContain('1 transacciones');
  });

  it('no ejecuta si también falla la recuperación', async () => {
    selectTransactionQuery.mockResolvedValue('{"skillId":"transaction-query"');
    repairTransactionQuery.mockResolvedValue('respuesta todavía inválida');
    const answer = await runAgentQuery('¿Cuántas transacciones tengo?', []);
    expect(repairTransactionQuery).toHaveBeenCalledOnce();
    expect(executeTransactionQuery).not.toHaveBeenCalled();
    expect(answer.content).toContain('Reformúlala');
  });
});
