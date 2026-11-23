export type AssistantStatus = 'idle' | 'loading' | 'ready' | 'generating' | 'error';
export type InferenceDevice = 'webgpu' | 'wasm';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  trace?: import('../agent/contracts').AgentTrace;
  failure?: import('../agent/contracts').AgentFailure;
}

export interface AssistantSnapshot {
  status: AssistantStatus;
  progress: number | null;
  error: string | null;
  device: InferenceDevice | null;
  profileVersion: string | null;
}

export type AssistantWorkerRequest =
  | { requestId: number; action: 'initialize'; profileVersion: string }
  | { requestId: number; action: 'generate'; question: string; history: ChatMessage[] }
  | { requestId: number; action: 'classifyRequest'; question: string; history: ChatMessage[] }
  | { requestId: number; action: 'selectTransactionQuery'; question: string }
  | { requestId: number; action: 'repairTransactionQuery'; question: string; invalidOutput: string };

export type AssistantWorkerResponse =
  | { requestId: number; type: 'status'; status: Exclude<AssistantStatus, 'idle' | 'error'> }
  | { requestId: number; type: 'progress'; progress: number }
  | { requestId: number; type: 'ready'; device: InferenceDevice; profileVersion: string }
  | { requestId: number; type: 'result'; content: string }
  | { requestId: number; type: 'error'; message: string };
