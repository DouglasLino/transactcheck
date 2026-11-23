import type { AssistantSnapshot, AssistantWorkerResponse, ChatMessage } from '../ai/types';
import { ASSISTANT_PROFILE_VERSION } from '../ai/assistantPrompt';

type Listener = (snapshot: AssistantSnapshot) => void;
type PendingRequest = { resolve(value: string | void): void; reject(error: Error): void };
type RequestWithoutId =
  | { action: 'initialize'; profileVersion: string }
  | { action: 'generate'; question: string; history: ChatMessage[] }
  | { action: 'classifyRequest'; question: string; history: ChatMessage[] }
  | { action: 'selectTransactionQuery'; question: string }
  | { action: 'repairTransactionQuery'; question: string; invalidOutput: string };

class LocalAiClient {
  private worker: Worker | null = null;
  private nextRequestId = 1;
  private pending = new Map<number, PendingRequest>();
  private listeners = new Set<Listener>();
  private snapshot: AssistantSnapshot = { status: 'idle', progress: null, error: null, device: null, profileVersion: null };

  getSnapshot = () => this.snapshot;

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  initialize(): Promise<void> {
    if (this.snapshot.status === 'ready') return Promise.resolve();
    return this.send<void>({ action: 'initialize', profileVersion: ASSISTANT_PROFILE_VERSION });
  }

  generate(question: string, history: ChatMessage[]): Promise<string> {
    return this.send<string>({ action: 'generate', question, history });
  }

  selectTransactionQuery(question: string): Promise<string> {
    return this.send<string>({ action: 'selectTransactionQuery', question });
  }

  classifyRequest(question: string, history: ChatMessage[]): Promise<string> {
    return this.send<string>({ action: 'classifyRequest', question, history });
  }

  repairTransactionQuery(question: string, invalidOutput: string): Promise<string> {
    return this.send<string>({ action: 'repairTransactionQuery', question, invalidOutput });
  }

  private ensureWorker() {
    if (this.worker) return;
    this.worker = new Worker(new URL('../workers/assistant.worker.ts', import.meta.url), { type: 'module' });
    this.worker.addEventListener('message', (event: MessageEvent<AssistantWorkerResponse>) => this.handleMessage(event.data));
    this.worker.addEventListener('error', () => {
      const error = new Error('El Worker del asistente no pudo iniciarse.');
      this.worker?.terminate();
      this.worker = null;
      this.update({ status: 'error', error: error.message });
      this.pending.forEach(({ reject }) => reject(error));
      this.pending.clear();
    });
  }

  private send<T extends string | void>(payload: RequestWithoutId): Promise<T> {
    this.ensureWorker();
    const requestId = this.nextRequestId++;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(requestId, { resolve: resolve as (value: string | void) => void, reject });
      this.worker?.postMessage({ ...payload, requestId });
    });
  }

  private handleMessage(message: AssistantWorkerResponse) {
    if (message.type === 'status') {
      this.update({ status: message.status, error: null, progress: message.status === 'loading' ? 0 : this.snapshot.progress });
      return;
    }
    if (message.type === 'progress') {
      this.update({ progress: Math.round(message.progress) });
      return;
    }
    const pending = this.pending.get(message.requestId);
    if (message.type === 'ready') {
      if (message.profileVersion !== ASSISTANT_PROFILE_VERSION) {
        const error = new Error('El Worker conserva un perfil anterior del asistente. Recarga la página para aplicar la identidad de TransactCheck.');
        this.worker?.terminate();
        this.worker = null;
        this.update({ status: 'error', error: error.message, device: null, profileVersion: null });
        pending?.reject(error);
      } else {
        this.update({ status: 'ready', progress: 100, device: message.device, profileVersion: message.profileVersion, error: null });
        pending?.resolve();
      }
    } else if (message.type === 'result') {
      this.update({ status: 'ready', error: null });
      pending?.resolve(message.content);
    } else {
      this.update({ status: 'error', error: message.message });
      pending?.reject(new Error(message.message));
    }
    this.pending.delete(message.requestId);
  }

  private update(changes: Partial<AssistantSnapshot>) {
    this.snapshot = { ...this.snapshot, ...changes };
    this.listeners.forEach((listener) => listener(this.snapshot));
  }
}

export const localAiClient = new LocalAiClient();
