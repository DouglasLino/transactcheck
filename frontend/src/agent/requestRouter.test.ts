import { describe, expect, it } from 'vitest';
import { parseRequestKind } from './requestRouter';

describe('clasificador de solicitudes del agente', () => {
  it.each([
    ['CONVERSATION', 'CONVERSATION'],
    ['CONVERSATION.', 'CONVERSATION'],
    ['"CONVERSATION"', 'CONVERSATION'],
    ['```text\nSKILL\n```', 'SKILL'],
    ['<|im_start|>assistant\nUNSUPPORTED<|im_end|>', 'UNSUPPORTED'],
    ['La clasificación correcta es SKILL', 'SKILL'],
    ['SKILL porque necesita consultar datos', 'SKILL'],
  ])('acepta una única etiqueta controlada: %s', (raw, expected) => {
    expect(parseRequestKind(raw)).toBe(expected);
  });

  it.each(['Hola, soy un asistente.', 'SKILL o CONVERSATION', '{"type":"SKILL"}'])('rechaza clasificaciones ambiguas: %s', (raw) => {
    expect(() => parseRequestKind(raw)).toThrow('clasificar');
  });
});
