import { useEffect, useState } from 'react';
import { Column } from 'primereact/column';
import { DataTable, type DataTablePageEvent } from 'primereact/datatable';
import { Dropdown } from 'primereact/dropdown';
import { Tag } from 'primereact/tag';
import { useEngine } from '../context/EngineContext';
import { engineClient } from '../services/engineClient';
import type { Diagnostic, DiagnosticQuery, TransactionDetail } from '../types';
import { PageHeader } from '../components/PageHeader';
import { MetricCard } from '../components/MetricCard';
import { RecordDetailDialog } from '../components/RecordDetailDialog';

export function DiagnosticsPage() {
  const { summary, ready } = useEngine();
  const [scope, setScope] = useState<string>();
  const [severity, setSeverity] = useState<string>();
  const [code, setCode] = useState<string>();
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState(25);
  const [query, setQuery] = useState<DiagnosticQuery>({ items: [], total: 0, page: 0, pageSize: 25 });
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<TransactionDetail | null>(null);
  const metrics = summary?.metrics;

  useEffect(() => {
    if (!ready) return;
    let active = true;
    setLoading(true);
    engineClient.queryDiagnostics(scope, severity, code, page, rows).then((result) => active && setQuery(result)).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [ready, scope, severity, code, page, rows, summary]);

  const severityBody = (item: Diagnostic) => <Tag value={item.severity} severity={item.severity === 'ERROR' ? 'danger' : item.severity === 'WARNING' ? 'warning' : 'info'} rounded />;
  const scopeBody = (item: Diagnostic) => <span className={`scope-chip ${item.scope.toLowerCase()}`}><i className={`pi ${item.scope === 'FILE' ? 'pi-file' : 'pi-box'}`} />{item.scope}</span>;
  const originalValueBody = (item: Diagnostic) => {
    if (item.originalValue === null || item.originalValue === undefined || item.originalValue === '') return '—';
    const value = typeof item.originalValue === 'string' ? item.originalValue : JSON.stringify(item.originalValue);
    return <span className="diagnostic-original-value" title={value}>{value}</span>;
  };
  const open = async (item: Diagnostic) => { if (item.recordId) setDetail(await engineClient.getRecord(item.recordId)); };

  return <div className="page">
    <PageHeader eyebrow="Calidad y trazabilidad" title="Inconsistencias" description="Errores de archivo y problemas de registros se mantienen separados y explicados sin descartar información." />
    <div className="metric-grid compact">
      <MetricCard label="Errores" value={metrics?.diagnosticSeverityCounts.ERROR ?? 0} note="Requieren atención" icon="pi-times-circle" tone="red" />
      <MetricCard label="Advertencias" value={metrics?.diagnosticSeverityCounts.WARNING ?? 0} note="No siempre invalidan" icon="pi-exclamation-triangle" tone="amber" />
      <MetricCard label="Información" value={metrics?.diagnosticSeverityCounts.INFO ?? 0} note="Campos no reconocidos" icon="pi-info-circle" tone="blue" />
      <MetricCard label="Posibles duplicados" value={metrics?.diagnosticCodeCounts.POSSIBLE_DUPLICATE ?? 0} note="No se eliminan" icon="pi-copy" tone="violet" />
    </div>
    <section className="diagnostic-explainer"><div><i className="pi pi-file" /><strong>FILE</strong><span>Carga, límites, sintaxis o procesamiento. No crea transacciones inválidas.</span></div><div><i className="pi pi-box" /><strong>RECORD</strong><span>Objeto obtenido de un JSON válido con trazabilidad a su ruta.</span></div></section>
    <section className="filters-panel diagnostic-filters">
      <Dropdown value={scope ?? null} options={['FILE', 'RECORD']} onChange={(event) => { setScope(event.value || undefined); setPage(0); }} placeholder="Alcance" showClear />
      <Dropdown value={severity ?? null} options={['ERROR', 'WARNING', 'INFO']} onChange={(event) => { setSeverity(event.value || undefined); setPage(0); }} placeholder="Severidad" showClear />
      <Dropdown value={code ?? null} options={summary?.options.diagnosticCodes} onChange={(event) => { setCode(event.value || undefined); setPage(0); }} placeholder="Código" showClear filter />
      <span className="result-count">{query.total} diagnósticos</span>
    </section>
    <section className="table-panel">
      <DataTable value={query.items} lazy paginator first={page * rows} rows={rows} rowsPerPageOptions={[10, 25, 50]} totalRecords={query.total} loading={loading} onPage={(event: DataTablePageEvent) => { setPage(event.page ?? 0); setRows(event.rows); }} onRowClick={(event) => void open(event.data as Diagnostic)} emptyMessage="No hay diagnósticos para estos filtros." rowClassName={(item) => item.recordId ? 'clickable-row' : ''} stripedRows>
        <Column header="Severidad" body={severityBody} />
        <Column header="Alcance" body={scopeBody} />
        <Column field="code" header="Código" />
        <Column field="message" header="Descripción" />
        <Column field="sourceFile" header="Archivo" />
        <Column field="originalValue" header="Dato original" body={originalValueBody} />
      </DataTable>
    </section>
    <RecordDetailDialog detail={detail} onHide={() => setDetail(null)} onSelectRecord={(recordId) => void engineClient.getRecord(recordId).then(setDetail)} />
  </div>;
}

