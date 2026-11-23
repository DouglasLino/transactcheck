import { describe, expect, it } from 'vitest';
import { PlannerValidationError, validateAgentProposal } from './transactionQueryPlanner';

describe('validador de propuestas transaction-query', () => {
  it('acepta operaciones y argumentos permitidos aunque el modelo use un bloque de código', () => {
    const proposal = validateAgentProposal('```json\n{"skillId":"transaction-query","operation":"extreme_amount","arguments":{"direction":"maximum","currency":"USD"}}\n```');
    expect(proposal).toMatchObject({ skillId: 'transaction-query', operation: 'extreme_amount' });
  });

  it('acepta tokens especiales conocidos alrededor del JSON', () => {
    const proposal = validateAgentProposal('<|im_start|>assistant\n{"skillId":"transaction-query","operation":"summary","arguments":{}}<|im_end|>');
    expect(proposal.operation).toBe('summary');
  });

  it.each([
    ['{"skillId":"transaction-query","operation":"summary"', 'INCOMPLETE_JSON'],
    ['{"skillId":"transaction-query",operation:"summary","arguments":{}}', 'MALFORMED_JSON'],
  ])('marca como recuperable una salida incompleta o malformada', (raw, code) => {
    try { validateAgentProposal(raw); } catch (error) {
      expect(error).toBeInstanceOf(PlannerValidationError);
      expect(error).toMatchObject({ code, recoverable: true });
    }
  });

  it.each([
    '{"skillId":"transaction-query","operation":"delete_all","arguments":{}}',
    '{"skillId":"transaction-query","operation":"count_by","arguments":{"groupBy":"date"}}',
    '{"skillId":"transaction-query","operation":"summary","arguments":{"unsafe":true}}',
    'respuesta sin JSON',
    'Aquí está: {"skillId":"transaction-query","operation":"summary","arguments":{}}',
  ])('rechaza propuestas desconocidas o inválidas sin ejecutarlas: %s', (raw) => {
    expect(() => validateAgentProposal(raw)).toThrow();
  });
});
