import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AssistantWorkerResponse } from '../ai/types';
import { ASSISTANT_PROFILE_VERSION } from '../ai/assistantPrompt';

const originalWorker = globalThis.Worker;

afterEach(() => {
  vi.resetModules();
  globalThis.Worker = originalWorker;
});

describe('cliente de IA local', () => {
  it('no crea el Worker hasta que el usuario inicia el asistente', async () => {
    class FakeWorker {
      static instances = 0;
      private messageListener?: (event: MessageEvent<AssistantWorkerResponse>) => void;

      constructor() { FakeWorker.instances += 1; }

      addEventListener(type: string, listener: EventListener) {
        if (type === 'message') this.messageListener = listener as (event: MessageEvent<AssistantWorkerResponse>) => void;
      }

      postMessage(request: { requestId: number }) {
        queueMicrotask(() => this.messageListener?.({ data: {
          requestId: request.requestId,
          type: 'ready',
          device: 'wasm',
          profileVersion: ASSISTANT_PROFILE_VERSION,
        } } as MessageEvent<AssistantWorkerResponse>));
      }

      terminate() { /* Sin recursos reales en esta prueba. */ }
    }

    globalThis.Worker = FakeWorker as unknown as typeof Worker;
    const { localAiClient } = await import('./localAiClient');
    expect(FakeWorker.instances).toBe(0);

    await localAiClient.initialize();

    expect(FakeWorker.instances).toBe(1);
    expect(localAiClient.getSnapshot()).toMatchObject({ status: 'ready', device: 'wasm' });
  });

  it('rechaza una instancia del Worker que conserve un perfil anterior', async () => {
    class StaleWorker {
      private messageListener?: (event: MessageEvent<AssistantWorkerResponse>) => void;
      addEventListener(type: string, listener: EventListener) {
        if (type === 'message') this.messageListener = listener as (event: MessageEvent<AssistantWorkerResponse>) => void;
      }
      postMessage(request: { requestId: number }) {
        queueMicrotask(() => this.messageListener?.({ data: {
          requestId: request.requestId,
          type: 'ready',
          device: 'wasm',
          profileVersion: 'generic-v0',
        } } as MessageEvent<AssistantWorkerResponse>));
      }
      terminate() { /* Sin recursos reales en esta prueba. */ }
    }

    globalThis.Worker = StaleWorker as unknown as typeof Worker;
    const { localAiClient } = await import('./localAiClient');

    await expect(localAiClient.initialize()).rejects.toThrow('perfil anterior');
    expect(localAiClient.getSnapshot()).toMatchObject({ status: 'error', device: null, profileVersion: null });
  });
});
