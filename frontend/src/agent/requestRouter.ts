export type AgentRequestKind = 'CONVERSATION' | 'SKILL' | 'UNSUPPORTED';

export const REQUEST_ROUTER_PROMPT = `Clasifica la última solicitud dirigida al Asistente TransactCheck. Responde SOLO una etiqueta: CONVERSATION, SKILL o UNSUPPORTED.
CONVERSATION: saludos, identidad, capacidades, explicaciones de TransactCheck o seguimientos que no necesitan consultar datos cargados.
SKILL: necesita datos reales de la sesión y puede resolverse con conteos, estados, monedas, fuentes, extremos monetarios, identificadores, duplicados o inconsistencias.
UNSUPPORTED: pide modificar datos, ejecutar acciones no disponibles, tratar temas ajenos o explicar un registro específico sin identificador ni referencia suficiente.
Ejemplos:
"¿Quién eres?" -> CONVERSATION
"¿Qué significa una transacción inválida?" -> CONVERSATION
"¿Cuántas transacciones tengo?" -> SKILL
"¿Por qué esta transacción es inválida?" sin referencia -> UNSUPPORTED
No respondas la pregunta. No uses JSON ni Markdown.`;

export function parseRequestKind(raw: string): AgentRequestKind {
  let normalized = raw
    .replace(/<\|im_start\|>assistant/gi, '')
    .replace(/<\|im_end\|>/gi, '')
    .replace(/^```(?:text)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
    .replace(/[.!:;]+$/, '')
    .toUpperCase();
  if ((normalized.startsWith('"') && normalized.endsWith('"')) || (normalized.startsWith("'") && normalized.endsWith("'"))) {
    normalized = normalized.slice(1, -1).trim();
  }
  if (normalized === 'CONVERSATION' || normalized === 'SKILL' || normalized === 'UNSUPPORTED') return normalized;
  const labels = normalized.match(/\b(?:CONVERSATION|SKILL|UNSUPPORTED)\b/g) ?? [];
  const uniqueLabels = [...new Set(labels)];
  if (normalized.length <= 160 && !/[{}\[\]]/.test(normalized) && uniqueLabels.length === 1) {
    return uniqueLabels[0] as AgentRequestKind;
  }
  throw new Error('No fue posible clasificar la solicitud de forma segura. Intenta reformularla indicando si deseas una explicación o consultar datos cargados.');
}
