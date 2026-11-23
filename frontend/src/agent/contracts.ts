export type SkillId =
  | 'transaction-detector'
  | 'transaction-normalizer'
  | 'transaction-validator'
  | 'diagnostic-explainer'
  | 'transaction-query';

export type TransactionQueryOperation =
  | 'summary'
  | 'count_by'
  | 'extreme_amount'
  | 'duplicate_groups'
  | 'frequent_inconsistencies'
  | 'find_by_transaction_id';

export interface TransactionQueryProposal {
  skillId: 'transaction-query';
  operation: TransactionQueryOperation;
  arguments: Record<string, unknown>;
}

export interface TransactionQueryExecution {
  ok: boolean;
  skillId: 'transaction-query';
  operation: string;
  result?: Record<string, unknown>;
  error?: { code: string; message: string };
}

export interface AgentTrace {
  skillId: 'transaction-query';
  operation: TransactionQueryOperation;
  interpretationMs: number;
  executionMs: number;
  result: Record<string, unknown>;
}

export interface AgentAnswer {
  content: string;
  trace?: AgentTrace;
  failure?: AgentFailure;
}

export interface AgentFailure {
  stage: 'interpretation' | 'inference' | 'execution';
  code?: string;
}
