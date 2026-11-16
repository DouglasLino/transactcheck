import type { CompactRecordQuery, DashboardAnalytics, DiagnosticQuery, DuplicateGroupQuery, Summary, TransactionDetail, TransactionFilters, TransactionQuery, WorkerRequest } from '../types';

type Resolver = { resolve: (value: unknown) => void; reject: (reason: Error) => void };

class EngineClient {
  private worker = new Worker(new URL('../workers/pyodide.worker.ts', import.meta.url), { type: 'module' });
  private sequence = 0;
  private pending = new Map<number, Resolver>();

  constructor() {
    this.worker.onmessage = (event: MessageEvent<{ id: number; result?: unknown; error?: string }>) => {
      const resolver = this.pending.get(event.data.id);
      if (!resolver) return;
      this.pending.delete(event.data.id);
      if (event.data.error) resolver.reject(new Error(event.data.error));
      else resolver.resolve(event.data.result);
    };
    this.worker.onerror = (event) => {
      const error = new Error(event.message || 'El Worker de Pyodide dejó de responder.');
      this.pending.forEach(({ reject }) => reject(error));
      this.pending.clear();
    };
  }

  request<T>(request: WorkerRequest): Promise<T> {
    const id = ++this.sequence;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (value: unknown) => void, reject });
      this.worker.postMessage({ id, request });
    });
  }

  initialize() { return this.request<{ ready: boolean; pyodideVersion: string }>({ action: 'initialize' }); }
  summary() { return this.request<Summary>({ action: 'summary' }); }
  addFile(fileId: string, file: File, content: string) {
    return this.request<{ accepted: boolean; summary: Summary; diagnostic?: { message: string }; file?: unknown }>({
      action: 'addFile', payload: { fileId, name: file.name, size: file.size, content },
    });
  }
  removeFile(fileId: string) { return this.request<{ removed: boolean; summary: Summary }>({ action: 'removeFile', payload: { fileId } }); }
  queryTransactions(filters: TransactionFilters, sortField: string, sortOrder: number, page: number, pageSize: number) {
    return this.request<TransactionQuery>({ action: 'queryTransactions', payload: { filters, sortField, sortOrder, page, pageSize } });
  }
  queryDiagnostics(scope: string | undefined, severity: string | undefined, code: string | undefined, page: number, pageSize: number, sourceFile?: string, recordFilters?: TransactionFilters) {
    return this.request<DiagnosticQuery>({ action: 'queryDiagnostics', payload: { scope: scope || null, severity: severity || null, code: code || null, sourceFile: sourceFile || null, recordFilters: recordFilters ?? null, page, pageSize } });
  }
  getDashboard(filters: TransactionFilters, temporalGrouping: 'day' | 'month') {
    return this.request<DashboardAnalytics>({ action: 'getDashboard', payload: { filters, temporalGrouping } });
  }
  queryUnidentified(fileId: string | undefined, page: number, pageSize: number) {
    return this.request<CompactRecordQuery>({ action: 'queryUnidentified', payload: { fileId: fileId || null, page, pageSize } });
  }
  queryDuplicateGroups(filters: TransactionFilters, page: number, pageSize: number) {
    return this.request<DuplicateGroupQuery>({ action: 'queryDuplicateGroups', payload: { filters, page, pageSize } });
  }
  getRecord(recordId: string) { return this.request<TransactionDetail | null>({ action: 'getRecord', payload: { recordId } }); }
  getRules() { return this.request<Record<string, unknown>>({ action: 'getRules' }); }
}

export const engineClient = new EngineClient();
