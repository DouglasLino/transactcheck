import { ASSISTANT_FEW_SHOT_MESSAGES, ASSISTANT_SYSTEM_PROMPT } from './assistantPrompt';
import { LOCAL_MODEL_CONFIG } from './modelConfig';
import type { ChatMessage } from './types';

export interface ModelMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export function buildModelMessages(
  history: ChatMessage[],
  question: string,
  systemPrompt = ASSISTANT_SYSTEM_PROMPT,
): ModelMessage[] {
  const recentHistory = history.slice(-LOCAL_MODEL_CONFIG.maxHistoryMessages).map(({ role, content }) => ({ role, content }));
  return [
    { role: 'system', content: systemPrompt },
    ...ASSISTANT_FEW_SHOT_MESSAGES,
    ...recentHistory,
    { role: 'user', content: question.trim() },
  ];
}

export function extractAssistantText(output: unknown): string {
  if (!Array.isArray(output) || output.length === 0) throw new Error('El modelo no devolvió una respuesta.');
  const first = output[0] as { generated_text?: unknown };
  const generated = first.generated_text;
  if (typeof generated === 'string' && generated.trim()) return generated.trim();
  if (Array.isArray(generated)) {
    const assistant = [...generated].reverse().find((item): item is { role: string; content: string } => (
      typeof item === 'object' && item !== null
      && (item as { role?: unknown }).role === 'assistant'
      && typeof (item as { content?: unknown }).content === 'string'
    ));
    if (assistant?.content.trim()) return assistant.content.trim();
  }
  throw new Error('No fue posible interpretar la respuesta generada.');
}

export function formatInferenceError(error: unknown, phase: 'initialize' | 'generate'): string {
  const detail = error instanceof Error ? error.message : String(error);
  const normalized = detail.toLowerCase();
  if (normalized.includes('fetch') || normalized.includes('network') || normalized.includes('download')) {
    return 'No se pudo descargar el modelo. Comprueba la conexión, el espacio disponible del navegador y vuelve a intentarlo.';
  }
  if (normalized.includes('memory') || normalized.includes('allocation')) {
    return 'El dispositivo no tiene memoria suficiente para ejecutar este modelo local.';
  }
  const action = phase === 'initialize' ? 'iniciar el modelo local' : 'generar la respuesta';
  return `No fue posible ${action}. Detalle técnico: ${detail}`;
}
