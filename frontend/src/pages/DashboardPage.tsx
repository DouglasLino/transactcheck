import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from 'primereact/button';
import { Column } from 'primereact/column';
import { DataTable, type DataTablePageEvent, type DataTableSortEvent } from 'primereact/datatable';
import { Dropdown } from 'primereact/dropdown';
import { InputText } from 'primereact/inputtext';
import { Paginator } from 'primereact/paginator';
import { Tag } from 'primereact/tag';
import { Tooltip } from 'primereact/tooltip';
import { DashboardFilterBar } from '../components/dashboard/DashboardFilterBar';
import { DashboardKpiCard } from '../components/dashboard/DashboardKpiCard';
import { CurrencyAnalysis, DistributionPanel, EmptyState, PanelTitle, TemporalAnalysis } from '../components/dashboard/DashboardVisuals';
import { RecordDetailDialog } from '../components/RecordDetailDialog';
import { useEngine } from '../context/EngineContext';
import { engineClient } from '../services/engineClient';
import type { CompactRecordQuery, DashboardAnalytics, Diagnostic, DiagnosticQuery, DuplicateGroupQuery, TransactionDetail, TransactionFilters, TransactionQuery, TransactionRow } from '../types';

const emptyTransactions: TransactionQuery = { items: [], total: 0, page: 0, pageSize: 10, filteredMetrics: null as unknown as TransactionQuery['filteredMetrics'] };
const emptyDiagnostics: DiagnosticQuery = { items: [], total: 0, page: 0, pageSize: 10 };
const emptyRecords: CompactRecordQuery = { items: [], total: 0, page: 0, pageSize: 5 };
const emptyDuplicates: DuplicateGroupQuery = { items: [], total: 0, page: 0, pageSize: 5 };

function hasActiveFilters(filters: TransactionFilters) {
  return Object.values(filters).some((value) => value !== undefined && value !== null && value !== '' && (!Array.isArray(value) || value.length > 0));
}

export function DashboardPage() {
  const { summary, ready } = useEngine();
  const [filters, setFilters] = useState<TransactionFilters>({});
  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null);
  const [temporalGrouping, setTemporalGrouping] = useState<'day' | 'month'>('day');
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<TransactionQuery>(emptyTransactions);
  const [transactionPage, setTransactionPage] = useState(0);
  const [transactionRows, setTransactionRows] = useState(10);
  const [sortField, setSortField] = useState('transactionDate');
  const [sortOrder, setSortOrder] = useState<-1 | 1>(-1);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [diagnostics, setDiagnostics] = useState<DiagnosticQuery>(emptyDiagnostics);
  const [diagnosticPage, setDiagnosticPage] = useState(0);
  const [diagnosticScope, setDiagnosticScope] = useState<string>();
  const [diagnosticSeverity, setDiagnosticSeverity] = useState<string>();
  const [diagnosticCode, setDiagnosticCode] = useState<string>();
  const [diagnosticFile, setDiagnosticFile] = useState<string>();
  const [unidentified, setUnidentified] = useState<CompactRecordQuery>(emptyRecords);
  const [unidentifiedPage, setUnidentifiedPage] = useState(0);
  const [duplicates, setDuplicates] = useState<DuplicateGroupQuery>(emptyDuplicates);
  const [duplicatePage, setDuplicatePage] = useState(0);
  const [detail, setDetail] = useState<TransactionDetail | null>(null);
  const explorerRef = useRef<HTMLElement>(null);
  const diagnosticRef = useRef<HTMLElement>(null);
  const unidentifiedRef = useRef<HTMLElement>(null);
  const duplicateRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!ready) return;
    let active = true;
    setLoadingAnalytics(true);
    setDashboardError(null);
    const timer = window.setTimeout(() => {
      engineClient.getDashboard(filters, temporalGrouping)
        .then((result) => active && setAnalytics(result))
        .catch((error: Error) => active && setDashboardError(error.message))
        .finally(() => active && setLoadingAnalytics(false));
    }, 120);
    return () => { active = false; window.clearTimeout(timer); };
  }, [ready, filters, temporalGrouping, summary]);

  useEffect(() => {
    if (!ready) return;
    let active = true;
    setLoadingTransactions(true);
    const timer = window.setTimeout(() => {
      engineClient.queryTransactions(filters, sortField, sortOrder, transactionPage, transactionRows)
        .then((result) => active && setTransactions(result))
        .finally(() => active && setLoadingTransactions(false));
    }, 140);
    return () => { active = false; window.clearTimeout(timer); };
  }, [ready, filters, sortField, sortOrder, transactionPage, transactionRows, summary]);

  useEffect(() => {
    if (!ready) return;
    let active = true;
    engineClient.queryDiagnostics(diagnosticScope, diagnosticSeverity, diagnosticCode, diagnosticPage, 10, diagnosticFile, filters)
      .then((result) => active && setDiagnostics(result));
    return () => { active = false; };
  }, [ready, filters, diagnosticScope, diagnosticSeverity, diagnosticCode, diagnosticFile, diagnosticPage, summary]);

  useEffect(() => {
    if (!ready) return;
    let active = true;
    engineClient.queryUnidentified(filters.fileId, unidentifiedPage, 5).then((result) => active && setUnidentified(result));
    return () => { active = false; };
  }, [ready, filters.fileId, unidentifiedPage, summary]);

  useEffect(() => {
    if (!ready) return;
    let active = true;
    engineClient.queryDuplicateGroups(filters, duplicatePage, 5).then((result) => active && setDuplicates(result));
    return () => { active = false; };
  }, [ready, filters, duplicatePage, summary]);

  const filtered = hasActiveFilters(filters);
  const globalMetrics = summary?.metrics;
  const metrics = filtered ? (analytics?.filteredMetrics ?? summary?.metrics) : summary?.metrics;
  const quality = analytics?.quality;

  const updateFilter = (key: keyof TransactionFilters, value: unknown) => {
    setFilters((current) => ({ ...current, [key]: value || undefined }));
    setTransactionPage(0);
    setDiagnosticPage(0);
    setDuplicatePage(0);
  };
  const resetFilters = () => {
    setFilters({});
    setTransactionPage(0);
    setDiagnosticPage(0);
    setDuplicatePage(0);
  };
  const applyAndExplore = (key: keyof TransactionFilters, value: unknown) => {
    updateFilter(key, value);
    window.setTimeout(() => explorerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  };
  const openRecord = async (recordId: string) => setDetail(await engineClient.getRecord(recordId));

  const activeChips = useMemo(() => {
    if (!summary) return [];
    const labels: Array<{ key: keyof TransactionFilters; label: string }> = [];
    if (filters.fileId) labels.push({ key: 'fileId', label: `Archivo: ${summary.files.find((item) => item.fileId === filters.fileId)?.name ?? filters.fileId}` });
    if (filters.status) labels.push({ key: 'status', label: `Estado: ${filters.status}` });
    if (filters.transactionType) labels.push({ key: 'transactionType', label: `Tipo: ${filters.transactionType}` });
    if (filters.currency) labels.push({ key: 'currency', label: `Moneda: ${filters.currency}` });
    if (filters.categories?.length) labels.push({ key: 'categories', label: `Validez: ${filters.categories[0] === 'VALID' ? 'Válidas' : 'Inválidas'}` });
    if (filters.dateFrom) labels.push({ key: 'dateFrom', label: `Desde: ${filters.dateFrom}` });
    if (filters.dateTo) labels.push({ key: 'dateTo', label: `Hasta: ${filters.dateTo}` });
    if (filters.identifierSearch) labels.push({ key: 'identifierSearch', label: `ID/ref: ${filters.identifierSearch}` });
    if (filters.search) labels.push({ key: 'search', label: `Búsqueda: ${filters.search}` });
    if (filters.diagnosticSeverity) labels.push({ key: 'diagnosticSeverity', label: `Diagnóstico: ${filters.diagnosticSeverity}` });
    if (filters.diagnosticCode) labels.push({ key: 'diagnosticCode', label: `Código: ${filters.diagnosticCode}` });
    if (filters.incompleteOnly) labels.push({ key: 'incompleteOnly', label: 'Campos incompletos' });
    return labels;
  }, [filters, summary]);

  const selectTemporalPeriod = (period: string) => {
    if (period.length === 7) {
      const [year, month] = period.split('-').map(Number);
      const lastDay = new Date(year, month, 0).getDate();
      setFilters((current) => ({ ...current, dateFrom: `${period}-01`, dateTo: `${period}-${String(lastDay).padStart(2, '0')}` }));
    } else {
      setFilters((current) => ({ ...current, dateFrom: period, dateTo: period }));
    }
    setTransactionPage(0);
  };

  if (!summary) return null;
  const noFiles = summary.files.length === 0;

  return <div className="page dashboard-page">
    <Tooltip target=".dashboard-page [data-pr-tooltip]" showDelay={250} hideDelay={100} />
    <header className="dashboard-header">
      <div><span className="eyebrow">Centro de análisis</span><h1>Dashboard</h1><p>Investiga métricas, calidad, trazabilidad y registros procesados desde una sola vista.</p></div>
      <div className="dashboard-header-stats"><span data-pr-tooltip="JSON activos en esta sesión."><i className="pi pi-file" /><strong>{summary.files.length}</strong> archivos activos</span><span data-pr-tooltip="Transacciones reconocidas globales."><i className="pi pi-database" /><strong>{globalMetrics?.processedTransactions ?? 0}</strong> procesadas</span><span data-pr-tooltip="Diagnósticos FILE y RECORD."><i className="pi pi-exclamation-circle" /><strong>{(globalMetrics?.recordDiagnosticCount ?? 0) + (globalMetrics?.fileDiagnosticCount ?? 0)}</strong> diagnósticos</span><Button outlined icon="pi pi-filter-slash" label="Restablecer filtros" disabled={!filtered} onClick={resetFilters} tooltip="Quita todos los filtros." /></div>
    </header>

    <DashboardFilterBar filters={filters} summary={summary} onChange={updateFilter} onReset={resetFilters} />
    {activeChips.length > 0 && <div className="active-filter-strip"><span>Resultados filtrados</span>{activeChips.map((item) => <button key={item.key} onClick={() => updateFilter(item.key, undefined)} data-pr-tooltip="Quitar este filtro.">{item.label}<i className="pi pi-times" /></button>)}<small>Los indicadores principales muestran el subconjunto; los totales globales permanecen en la cabecera.</small></div>}
    {dashboardError && <div className="query-error" role="alert"><i className="pi pi-exclamation-circle" />No se pudo actualizar el Dashboard: {dashboardError}</div>}
    {loadingAnalytics && <div className="dashboard-loading"><i className="pi pi-spin pi-spinner" /> Actualizando análisis…</div>}

    {noFiles ? <div className="dashboard-empty-stack"><section className="dashboard-welcome-empty"><i className="pi pi-chart-line" /><h2>Aún no hay archivos activos para analizar</h2><p>Carga uno o más archivos JSON desde la vista Carga de archivos. Los archivos rechazados no afectan las métricas transaccionales.</p></section>{(globalMetrics?.fileDiagnosticCount ?? 0) > 0 && <section className="dashboard-panel"><PanelTitle eyebrow="Archivos rechazados" title="Diagnósticos de carga disponibles" note="Estos errores no crean transacciones inválidas ni afectan los porcentajes de validez." /><DataTable value={diagnostics.items.filter((item) => item.scope === 'FILE')} emptyMessage="No hay diagnósticos de archivo disponibles." stripedRows><Column header="Severidad" body={(item: Diagnostic) => <Tag value={item.severity} severity="danger" />} /><Column field="code" header="Código" /><Column field="message" header="Mensaje" /><Column field="sourceFile" header="Archivo" /><Column field="details" header="Detalle" /></DataTable></section>}</div> : <>
      <section className="dashboard-section">
        <div className="dashboard-section-heading"><div><span className="eyebrow">Procesamiento</span><h2>Estado general</h2></div><span className={filtered ? 'filtered-badge' : 'global-badge'} data-pr-tooltip={filtered ? 'Métricas de los filtros activos.' : 'Métricas de todos los archivos activos.'}>{filtered ? 'Selección filtrada' : 'Totales globales'}</span></div>
        <div className="dashboard-kpi-grid processing">
          <DashboardKpiCard label="Procesadas" value={metrics?.processedTransactions ?? 0} description="Válidas + inválidas" tooltip="Transacciones reconocidas por el motor. No incluye objetos no identificados." icon="pi-database" onClick={() => explorerRef.current?.scrollIntoView({ behavior: 'smooth' })} />
          <DashboardKpiCard label="Válidas" value={metrics?.validTransactions ?? 0} description="Monto y moneda válidos" tooltip="Solo amount y currency determinan la validez mínima." icon="pi-check-circle" tone="green" onClick={() => applyAndExplore('categories', ['VALID'])} />
          <DashboardKpiCard label="Inválidas" value={metrics?.invalidTransactions ?? 0} description="Monto o moneda con error" tooltip="Son transacciones reconocidas que no cumplen la validación mínima." icon="pi-times-circle" tone="red" onClick={() => applyAndExplore('categories', ['INVALID'])} />
          <DashboardKpiCard label="Validez" value={`${metrics?.validPercentage ?? '0.00'}%`} description="Sobre transacciones procesadas" tooltip="Los archivos rechazados y objetos no identificados no forman parte del porcentaje." icon="pi-percentage" tone="green" />
          <DashboardKpiCard label="No identificados" value={metrics?.unidentifiedObjects ?? 0} description={filters.fileId ? 'Del archivo seleccionado' : 'Globales; otros filtros no aplican'} tooltip="Objetos sin evidencia suficiente de ser transacciones; no afectan montos ni validez." icon="pi-question-circle" tone="amber" onClick={() => unidentifiedRef.current?.scrollIntoView({ behavior: 'smooth' })} />
        </div>
      </section>

      <section className="dashboard-section">
        <div className="dashboard-section-heading"><div><span className="eyebrow">Calidad</span><h2>Registros que requieren atención</h2></div><small>Los conteos son registros únicos, no cantidad de diagnósticos.</small></div>
        <div className="dashboard-kpi-grid quality">
          <DashboardKpiCard label="Con advertencias" value={quality?.recordsWithWarnings ?? 0} description="Registros afectados" tooltip="Cada registro se cuenta una sola vez aunque tenga varias advertencias." icon="pi-exclamation-triangle" tone="amber" onClick={() => applyAndExplore('diagnosticSeverity', 'WARNING')} />
          <DashboardKpiCard label="Con errores" value={quality?.recordsWithErrors ?? 0} description="Registros afectados" tooltip="Errores asociados a registros de la selección actual." icon="pi-times-circle" tone="red" onClick={() => applyAndExplore('diagnosticSeverity', 'ERROR')} />
          <DashboardKpiCard label="Diagnósticos" value={quality?.totalDiagnostics ?? 0} description={`${quality?.affectedRecords ?? 0} registros · ${quality?.affectedFiles ?? 0} archivos`} tooltip="Cantidad de diagnósticos; puede superar al número de registros afectados." icon="pi-list-check" tone="blue" onClick={() => diagnosticRef.current?.scrollIntoView({ behavior: 'smooth' })} />
          <DashboardKpiCard label="Posibles duplicados" value={quality?.possibleDuplicateRecords ?? 0} description="Registros, no confirmaciones" tooltip="Advertencias calculadas por las reglas existentes; no se elimina ningún registro." icon="pi-copy" tone="violet" onClick={() => duplicateRef.current?.scrollIntoView({ behavior: 'smooth' })} />
          <DashboardKpiCard label="Campos incompletos" value={quality?.incompleteRecords ?? 0} description="Atributos opcionales ausentes" tooltip="No implica invalidez: identifica registros con campos opcionales nulos o UNKNOWN." icon="pi-list" tone="blue" onClick={() => applyAndExplore('incompleteOnly', true)} />
        </div>
      </section>

      <section className="dashboard-analysis-grid">
        <CurrencyAnalysis totals={metrics?.currencyTotals ?? {}} filtered={filtered} globalTotals={globalMetrics?.currencyTotals ?? {}} onResetFilters={resetFilters} onSelect={(currency) => applyAndExplore('currency', currency)} />
        <DistributionPanel eyebrow="Distribución" title="Estados normalizados" items={analytics?.statusDistribution ?? []} emptyMessage="No hay estados disponibles para esta selección." onSelect={(status) => applyAndExplore('status', status)} />
        <DistributionPanel eyebrow="Clasificación" title="Tipos de transacción" items={analytics?.typeDistribution ?? []} emptyMessage="No hay tipos disponibles para esta selección." onSelect={(type) => applyAndExplore('transactionType', type)} />
        <TemporalAnalysis points={analytics?.temporalDistribution ?? []} grouping={temporalGrouping} onGroupingChange={setTemporalGrouping} onSelect={selectTemporalPeriod} />
      </section>

      <section className="dashboard-panel dashboard-file-panel">
        <PanelTitle eyebrow="Procedencia" title="Análisis por archivo de origen" note="El nombre físico y la fuente declarada se muestran por separado." />
        <div className="dashboard-file-table"><div className="dashboard-file-head"><span>Archivo</span><span>Fuente declarada</span><span>Detectadas</span><span>Válidas</span><span>Inválidas</span><span>No identificadas</span><span>Diagnósticos</span><span>Duplicados</span></div>{(analytics?.fileAnalysis ?? []).map((file) => <button key={file.fileId} className={filters.fileId === file.fileId ? 'selected' : ''} onClick={() => updateFilter('fileId', file.fileId)} data-pr-tooltip={`Analizar solo ${file.name}.`}><strong>{file.name}</strong><span>{file.declaredSources.join(', ') || 'UNKNOWN'}</span><span>{file.processedTransactions}</span><span className="positive">{file.validTransactions}</span><span className="negative">{file.invalidTransactions}</span><span>{file.unidentifiedObjects}</span><span>{file.diagnosticCount}</span><span>{file.possibleDuplicateRecords}</span></button>)}</div>
      </section>

      <section ref={explorerRef} className="dashboard-panel dashboard-anchor">
        <div className="dashboard-panel-title"><div><span className="eyebrow">Investigación</span><h2>Explorador de transacciones</h2><p>{transactions.total} registros coinciden con la selección actual.</p></div><span className="dashboard-search-field explorer-search" data-pr-tooltip="Busca en normalizado y JSON original."><i className="pi pi-search" /><InputText value={filters.search ?? ''} onChange={(event) => updateFilter('search', event.target.value)} placeholder="Buscar en campos y original" /></span></div>
        <DataTable value={transactions.items} lazy paginator first={transactionPage * transactionRows} rows={transactionRows} rowsPerPageOptions={[10, 20, 50]} totalRecords={transactions.total} loading={loadingTransactions} onPage={(event: DataTablePageEvent) => { setTransactionPage(event.page ?? 0); setTransactionRows(event.rows); }} sortField={sortField} sortOrder={sortOrder} onSort={(event: DataTableSortEvent) => { setSortField(String(event.sortField)); setSortOrder(event.sortOrder === 1 ? 1 : -1); setTransactionPage(0); }} onRowClick={(event) => void openRecord((event.data as TransactionRow).recordId)} emptyMessage="No hay transacciones que coincidan con los filtros." rowHover stripedRows>
          <Column field="transactionId" header="Identificador" sortable body={(row: TransactionRow) => row.transactionId || 'Sin ID'} />
          <Column field="transactionDate" header="Fecha" sortable body={(row: TransactionRow) => row.transactionDate || '—'} />
          <Column field="transactionType" header="Tipo" sortable body={(row: TransactionRow) => row.transactionType || 'SIN_TIPO'} />
          <Column field="status" header="Estado" sortable />
          <Column field="amount" header="Monto" sortable body={(row: TransactionRow) => <span className="amount-cell">{row.amount ?? '—'} <small>{row.currency}</small></span>} />
          <Column field="category" header="Validez" sortable body={(row: TransactionRow) => <span data-pr-tooltip={row.category === 'VALID' ? 'Monto y moneda válidos.' : 'Monto o moneda con error.'}><Tag value={row.category === 'VALID' ? 'Válida' : 'Inválida'} severity={row.category === 'VALID' ? 'success' : 'danger'} rounded /></span>} />
          <Column header="Diagnósticos" body={(row: TransactionRow) => <span className="row-diagnostics" data-pr-tooltip={`${row.errorCount} errores · ${row.warningCount} advertencias.`}>{row.errorCount > 0 && <Tag value={`${row.errorCount} E`} severity="danger" />}{row.warningCount > 0 && <Tag value={`${row.warningCount} A`} severity="warning" />}{row.diagnosticCount === 0 && '—'}</span>} />
          <Column field="sourceFile" header="Archivo" sortable />
          <Column header="" body={() => <Button text rounded icon="pi pi-eye" aria-label="Inspeccionar transacción" tooltip="Abrir detalle y trazabilidad." />} />
        </DataTable>
      </section>

      <section ref={diagnosticRef} className="dashboard-panel dashboard-anchor">
        <div className="dashboard-panel-title"><div><span className="eyebrow">Calidad de datos</span><h2>Diagnósticos y calidad de datos</h2><p>{diagnostics.total} diagnósticos coinciden con los filtros.</p></div><div className="diagnostic-summary-inline">{(analytics?.diagnosticSeverityDistribution ?? []).map((item) => <span key={item.value} className={item.value.toLowerCase()} data-pr-tooltip={`${item.count} diagnósticos ${item.value}.`}><strong>{item.count}</strong>{item.value}</span>)}</div></div>
        <div className="dashboard-inline-filters"><Dropdown value={diagnosticSeverity ?? null} options={['ERROR', 'WARNING', 'INFO']} onChange={(event) => { setDiagnosticSeverity(event.value || undefined); setDiagnosticPage(0); }} placeholder="Severidad" showClear tooltip="Filtra por nivel de impacto." /><Dropdown value={diagnosticScope ?? null} options={['FILE', 'RECORD']} onChange={(event) => { setDiagnosticScope(event.value || undefined); setDiagnosticPage(0); }} placeholder="Alcance" showClear tooltip="FILE: archivo; RECORD: registro." /><Dropdown value={diagnosticFile ?? null} options={summary.options.diagnosticFiles} onChange={(event) => { setDiagnosticFile(event.value || undefined); setDiagnosticPage(0); }} placeholder="Archivo" showClear tooltip="Filtra diagnósticos por archivo." /><Dropdown value={diagnosticCode ?? null} options={summary.options.diagnosticCodes} onChange={(event) => { setDiagnosticCode(event.value || undefined); setDiagnosticPage(0); }} placeholder="Código" showClear filter tooltip="Filtra por código técnico." /></div>
        <div className="dashboard-diagnostic-layout"><div className="diagnostic-frequency"><h3>Más frecuentes</h3>{(analytics?.diagnosticCodeDistribution ?? []).length === 0 ? <p>Sin diagnósticos en esta selección.</p> : (analytics?.diagnosticCodeDistribution ?? []).slice(0, 6).map((item) => <button key={item.value} onClick={() => { setDiagnosticCode(item.value); setDiagnosticPage(0); }} data-pr-tooltip="Seleccionar para filtrar."><span>{item.value}</span><strong>{item.count}</strong></button>)}</div><DataTable value={diagnostics.items} lazy paginator first={diagnosticPage * 10} rows={10} totalRecords={diagnostics.total} onPage={(event: DataTablePageEvent) => setDiagnosticPage(event.page ?? 0)} onRowClick={(event) => { const item = event.data as Diagnostic; if (item.recordId) void openRecord(item.recordId); }} emptyMessage="No hay diagnósticos para esta selección." stripedRows>
          <Column header="Severidad" body={(item: Diagnostic) => <Tag value={item.severity} severity={item.severity === 'ERROR' ? 'danger' : item.severity === 'WARNING' ? 'warning' : 'info'} />} />
          <Column field="code" header="Código" />
          <Column field="message" header="Mensaje" />
          <Column field="scope" header="Alcance" />
          <Column field="sourceFile" header="Archivo" />
          <Column field="field" header="Campo" body={(item: Diagnostic) => item.field || '—'} />
          <Column header="" body={(item: Diagnostic) => item.recordId ? <i className="pi pi-eye" /> : <i className="pi pi-file" />} />
        </DataTable></div>
      </section>

      <section className="dashboard-lower-grid">
        <article ref={unidentifiedRef} className="dashboard-panel dashboard-anchor"><PanelTitle eyebrow="Fuera del conteo transaccional" title="Objetos no identificados" note="Se conservan sin convertirlos automáticamente en transacciones." />{unidentified.total === 0 ? <EmptyState icon="pi-check-circle" text="No hay objetos no identificados para el archivo seleccionado." /> : <DataTable value={unidentified.items} lazy paginator first={unidentifiedPage * 5} rows={5} totalRecords={unidentified.total} onPage={(event: DataTablePageEvent) => setUnidentifiedPage(event.page ?? 0)} onRowClick={(event) => void openRecord((event.data as TransactionRow).recordId)} emptyMessage="Sin objetos no identificados." stripedRows><Column field="sourceFile" header="Archivo" /><Column field="jsonPath" header="Ruta" body={(row: TransactionRow) => <code>{row.jsonPath}</code>} /><Column field="unidentifiedReason" header="Motivo" /><Column field="diagnosticCount" header="Diagnósticos" /><Column header="" body={() => <i className="pi pi-eye" />} /></DataTable>}</article>
        <article ref={duplicateRef} className="dashboard-panel dashboard-anchor"><PanelTitle eyebrow="Revisión, no eliminación" title="Posibles duplicados" note="Grupos detectados con las reglas actuales." />{duplicates.total === 0 ? <EmptyState icon="pi-copy" text="No se detectaron grupos de posibles duplicados en esta selección." /> : <><div className="duplicate-groups">{duplicates.items.map((group) => <div key={group.groupId}><div data-pr-tooltip="Coincidencia para revisión; no confirma duplicidad."><Tag value="POSIBLE" severity="warning" /><strong>{group.criterionLabel}</strong><span>{group.records.length} registros</span></div>{group.records.map((record) => <button key={record.recordId} onClick={() => void openRecord(record.recordId)} data-pr-tooltip="Abrir detalle y comparar."><span>{record.transactionId || 'Sin ID'}</span><small>{record.sourceFile}</small><i className="pi pi-eye" /></button>)}</div>)}</div><Paginator first={duplicatePage * 5} rows={5} totalRecords={duplicates.total} onPageChange={(event) => setDuplicatePage(event.page)} /></>}</article>
      </section>
    </>}
    <RecordDetailDialog detail={detail} onHide={() => setDetail(null)} onSelectRecord={(recordId) => void openRecord(recordId)} />
  </div>;
}
