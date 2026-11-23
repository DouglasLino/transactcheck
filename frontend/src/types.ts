export type ViewId = 'upload' | 'dashboard' | 'transactions' | 'diagnostics' | 'rules' | 'assistant';
export type Category = 'VALID' | 'INVALID' | 'UNIDENTIFIED';
export type Severity = 'ERROR' | 'WARNING' | 'INFO';
export type Scope = 'FILE' | 'RECORD';

export interface CurrencyTotal {
  count: number;
  positiveCount: number;
  negativeCount: number;
  zeroCount: number;
  positive: string;
  negative: string;
  net: string;
}

export interface Metrics {
  processedTransactions: number;
  validTransactions: number;
  invalidTransactions: number;
  unidentifiedObjects: number;
  validPercentage: string;
  statusCounts: Record<string, number>;
  sourceCounts: Record<string, number>;
  typeCounts: Record<string, number>;
  currencyTotals: Record<string, CurrencyTotal>;
  diagnosticSeverityCounts: Record<string, number>;
  diagnosticCodeCounts: Record<string, number>;
  recordDiagnosticCount: number;
  fileDiagnosticCount: number;
  unrecognizedFieldCount: number;
}

export interface FileInfo {
  fileId: string;
  name: string;
  size: number;
  recordCount: number;
  status: string;
}

export interface Summary {
  metrics: Metrics;
  files: FileInfo[];
  limits: { maxFiles: number; maxFileBytes: number; maxTotalBytes: number; activeBytes: number };
  options: {
    sources: string[];
    statuses: string[];
    currencies: string[];
    transactionTypes: string[];
    diagnosticCodes: string[];
    diagnosticFiles: string[];
  };
}

export interface Diagnostic {
  scope: Scope;
  code: string;
  severity: Severity;
  message: string;
  field: string | null;
  originalValue: unknown;
  sourceFile: string;
  jsonPath: string | null;
  details: string;
  recordId?: string | null;
}

export interface TransactionRow {
  recordId: string;
  sourceFile: string;
  jsonPath: string;
  category: Category;
  transactionId: string | null;
  source: string;
  amount: string | null;
  currency: string;
  status: string;
  transactionDate: string | null;
  transactionType: string | null;
  referenceId: string | null;
  description: string | null;
  diagnosticCount: number;
  errorCount: number;
  warningCount: number;
  unidentifiedReason?: string;
}

export interface TransactionDetail extends TransactionRow {
  fileId: string;
  original: Record<string, unknown>;
  normalized: Record<string, unknown> | null;
  diagnostics: Diagnostic[];
  transformations: string[];
  possibleDuplicates: {
    criteria: string[];
    records: TransactionRow[];
  };
}

export interface TransactionQuery {
  items: TransactionRow[];
  total: number;
  page: number;
  pageSize: number;
  filteredMetrics: Metrics;
}

export interface DiagnosticQuery {
  items: Diagnostic[];
  total: number;
  page: number;
  pageSize: number;
}

export interface TransactionFilters {
  search?: string;
  identifierSearch?: string;
  categories?: Category[];
  fileId?: string;
  source?: string;
  status?: string;
  currency?: string;
  transactionType?: string;
  dateFrom?: string;
  dateTo?: string;
  amountMin?: string;
  amountMax?: string;
  diagnosticSeverity?: Severity;
  diagnosticCode?: string;
  incompleteOnly?: boolean;
}

export interface DistributionItem {
  value: string;
  count: number;
  percentage: string;
}

export interface DashboardQuality {
  recordsWithWarnings: number;
  recordsWithErrors: number;
  recordsRequiringReview: number;
  incompleteRecords: number;
  totalDiagnostics: number;
  recordDiagnostics: number;
  fileDiagnostics: number;
  possibleDuplicateRecords: number;
  affectedRecords: number;
  affectedFiles: number;
}

export interface FileAnalysis {
  fileId: string;
  name: string;
  declaredSources: string[];
  processedTransactions: number;
  validTransactions: number;
  invalidTransactions: number;
  unidentifiedObjects: number;
  diagnosticCount: number;
  possibleDuplicateRecords: number;
}

export interface TemporalPoint {
  period: string;
  count: number;
  statusCounts: Record<string, number>;
}

export interface DashboardAnalytics {
  globalMetrics: Metrics;
  filteredMetrics: Metrics;
  quality: DashboardQuality;
  statusDistribution: DistributionItem[];
  typeDistribution: DistributionItem[];
  diagnosticCodeDistribution: DistributionItem[];
  diagnosticSeverityDistribution: DistributionItem[];
  fileAnalysis: FileAnalysis[];
  temporalDistribution: TemporalPoint[];
}

export interface CompactRecordQuery {
  items: TransactionRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface DuplicateGroup {
  groupId: string;
  criterion: string;
  criterionLabel: string;
  recordIds: string[];
  records: TransactionRow[];
}

export interface DuplicateGroupQuery {
  items: DuplicateGroup[];
  total: number;
  page: number;
  pageSize: number;
}

export interface WorkerRequest {
  action: string;
  payload?: Record<string, unknown>;
}

