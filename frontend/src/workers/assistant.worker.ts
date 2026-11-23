/// <reference lib="webworker" />
import { pipeline } from '@huggingface/transformers';
import { LOCAL_MODEL_CONFIG } from '../ai/modelConfig';
import { ASSISTANT_PROFILE_VERSION } from '../ai/assistantPrompt';
import { buildModelMessages, extractAssistantText, formatInferenceError } from '../ai/modelMessages';
import type { AssistantWorkerRequest, AssistantWorkerResponse, InferenceDevice } from '../ai/types';
import { TRANSACTION_QUERY_PLANNER_PROMPT, TRANSACTION_QUERY_REPAIR_PROMPT } from '../agent/transactionQueryPlanner';
import { REQUEST_ROUTER_PROMPT } from '../agent/requestRouter';

interface TextGenerator {
  (messages: ReturnType<typeof buildModelMessages>, options: {
    max_new_tokens: number;
    do_sample: boolean;
    repetition_penalty: number;
    return_full_text: boolean;
  }): Promise<unknown>;
}

interface ProgressPayload {
  status?: string;
  file?: string;
  progress?: number;
  loaded?: number;
  total?: number;
}

const worker = self as DedicatedWorkerGlobalScope;
let generator: TextGenerator | null = null;
let activeDevice: InferenceDevice | null = null;
let initialization: Promise<void> | null = null;
const fileProgress = new Map<string, { loaded: number; total: number }>();

function traceRouterOutput(requestId: number, content: string) {
  if (!import.meta.env.DEV) return;
  const safeToPrint = content.length <= 160 && /^[\p{L}\s"'`<>|_.:;!?-]+$/u.test(content);
  console.debug('[TransactCheck][router]', {
    requestId,
    raw: safeToPrint ? content : '[salida ocultada por seguridad]',
    length: content.length,
  });
}

function respond(message: AssistantWorkerResponse) {
  worker.postMessage(message);
}

function reportProgress(requestId: number, payload: unknown) {
  const info = payload as ProgressPayload;
  if (info.status === 'progress_total' && typeof info.progress === 'number') {
    respond({ requestId, type: 'progress', progress: Math.max(0, Math.min(100, info.progress)) });
    return;
  }
  if (info.status !== 'progress' || !info.file || typeof info.loaded !== 'number' || typeof info.total !== 'number') return;
  fileProgress.set(info.file, { loaded: info.loaded, total: info.total });
  const totals = [...fileProgress.values()].reduce((sum, item) => ({ loaded: sum.loaded + item.loaded, total: sum.total + item.total }), { loaded: 0, total: 0 });
  if (totals.total > 0) respond({ requestId, type: 'progress', progress: (totals.loaded / totals.total) * 100 });
}

async function createPipeline(requestId: number, device: InferenceDevice): Promise<TextGenerator> {
  const created = await pipeline('text-generation', LOCAL_MODEL_CONFIG.id, {
    dtype: LOCAL_MODEL_CONFIG.dtype,
    device,
    progress_callback: (payload: unknown) => reportProgress(requestId, payload),
  });
  return created as unknown as TextGenerator;
}

async function initialize(requestId: number) {
  if (generator && activeDevice) {
    respond({ requestId, type: 'ready', device: activeDevice, profileVersion: ASSISTANT_PROFILE_VERSION });
    return;
  }
  if (!initialization) {
    initialization = (async () => {
      respond({ requestId, type: 'status', status: 'loading' });
      fileProgress.clear();
      const supportsWebGpu = Boolean((worker.navigator as Navigator & { gpu?: unknown }).gpu);
      if (supportsWebGpu) {
        try {
          generator = await createPipeline(requestId, 'webgpu');
          activeDevice = 'webgpu';
          return;
        } catch {
          generator = null;
          fileProgress.clear();
        }
      }
      generator = await createPipeline(requestId, 'wasm');
      activeDevice = 'wasm';
    })();
  }
  try {
    await initialization;
    if (!activeDevice) throw new Error('No se pudo seleccionar un dispositivo de inferencia.');
    respond({ requestId, type: 'ready', device: activeDevice, profileVersion: ASSISTANT_PROFILE_VERSION });
  } catch (error) {
    initialization = null;
    throw error;
  }
}

async function generate(request: Extract<AssistantWorkerRequest, { action: 'generate' }>) {
  if (!generator) throw new Error('Primero debes iniciar y cargar el modelo local.');
  respond({ requestId: request.requestId, type: 'status', status: 'generating' });
  const output = await generator(buildModelMessages(request.history, request.question), {
    max_new_tokens: LOCAL_MODEL_CONFIG.maxNewTokens,
    do_sample: false,
    repetition_penalty: 1.05,
    // Al recibir un Chat estructurado, el pipeline aplica la plantilla del tokenizer
    // de Qwen con add_generation_prompt=true y conserva el rol system.
    return_full_text: false,
  });
  respond({ requestId: request.requestId, type: 'result', content: extractAssistantText(output) });
}

async function selectTransactionQuery(request: Extract<AssistantWorkerRequest, { action: 'selectTransactionQuery' }>) {
  if (!generator) throw new Error('Primero debes iniciar y cargar el modelo local.');
  respond({ requestId: request.requestId, type: 'status', status: 'generating' });
  const output = await generator([
    { role: 'system', content: TRANSACTION_QUERY_PLANNER_PROMPT },
    { role: 'user', content: request.question.trim() },
  ], {
    max_new_tokens: 128,
    do_sample: false,
    repetition_penalty: 1.05,
    return_full_text: false,
  });
  respond({ requestId: request.requestId, type: 'result', content: extractAssistantText(output) });
}

async function classifyRequest(request: Extract<AssistantWorkerRequest, { action: 'classifyRequest' }>) {
  if (!generator) throw new Error('Primero debes iniciar y cargar el modelo local.');
  respond({ requestId: request.requestId, type: 'status', status: 'generating' });
  const recentHistory = request.history.slice(-4).map(({ role, content }) => ({ role, content }));
  const output = await generator([
    { role: 'system', content: REQUEST_ROUTER_PROMPT },
    ...recentHistory,
    { role: 'user', content: request.question.trim() },
  ], {
    max_new_tokens: 24,
    do_sample: false,
    repetition_penalty: 1.05,
    return_full_text: false,
  });
  const content = extractAssistantText(output);
  traceRouterOutput(request.requestId, content);
  respond({ requestId: request.requestId, type: 'result', content });
}

async function repairTransactionQuery(request: Extract<AssistantWorkerRequest, { action: 'repairTransactionQuery' }>) {
  if (!generator) throw new Error('Primero debes iniciar y cargar el modelo local.');
  respond({ requestId: request.requestId, type: 'status', status: 'generating' });
  const output = await generator([
    { role: 'system', content: `${TRANSACTION_QUERY_PLANNER_PROMPT}\n${TRANSACTION_QUERY_REPAIR_PROMPT}` },
    { role: 'user', content: `Pregunta: ${request.question.trim()}\nSalida a reparar: ${request.invalidOutput.slice(0, 800)}` },
  ], {
    max_new_tokens: 128,
    do_sample: false,
    repetition_penalty: 1.05,
    return_full_text: false,
  });
  respond({ requestId: request.requestId, type: 'result', content: extractAssistantText(output) });
}

worker.addEventListener('message', (event: MessageEvent<AssistantWorkerRequest>) => {
  const request = event.data;
  const task = request.action === 'initialize'
    ? initialize(request.requestId)
    : request.action === 'classifyRequest'
      ? classifyRequest(request)
    : request.action === 'selectTransactionQuery'
      ? selectTransactionQuery(request)
      : request.action === 'repairTransactionQuery'
        ? repairTransactionQuery(request)
        : generate(request);
  void task
    .catch((error: unknown) => respond({
      requestId: request.requestId,
      type: 'error',
      message: formatInferenceError(error, request.action === 'initialize' ? 'initialize' : 'generate'),
    }));
});
