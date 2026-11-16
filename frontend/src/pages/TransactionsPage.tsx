import { useEffect, useState } from 'react';
import { Button } from 'primereact/button';
import { Column } from 'primereact/column';
import { DataTable, type DataTablePageEvent, type DataTableSortEvent } from 'primereact/datatable';
import { Dropdown } from 'primereact/dropdown';
import { InputText } from 'primereact/inputtext';
import { Tag } from 'primereact/tag';
import { useEngine } from '../context/EngineContext';
import { engineClient } from '../services/engineClient';
import type { Category, TransactionDetail, TransactionFilters, TransactionQuery, TransactionRow } from '../types';
import { MetricCard } from '../components/MetricCard';
import { PageHeader } from '../components/PageHeader';
import { RecordDetailDialog } from '../components/RecordDetailDialog';

const emptyQuery: TransactionQuery = { items: [], total: 0, page: 0, pageSize: 20, filteredMetrics: null as unknown as TransactionQuery['filteredMetrics'] };

export function TransactionsPage() {
  const { summary, ready } = useEngine();
  const [filters, setFilters] = useState<TransactionFilters>({});
  const [query, setQuery] = useState<TransactionQuery>(emptyQuery);
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState(20);
  const [sortField, setSortField] = useState('transactionDate');
  const [sortOrder, setSortOrder] = useState<-1 | 1>(-1);
  const [loading, setLoading] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [detail, setDetail] = useState<TransactionDetail | null>(null);

  useEffect(() => {
    if (!ready) return;
    let active = true;
    setLoading(true);
    setQueryError(null);
    const timer = window.setTimeout(() => {
      engineClient.queryTransactions(filters, sortField, sortOrder, page, rows)
        .then((result) => active && setQuery(result))
        .catch((error: Error) => active && setQueryError(error.message))
        .finally(() => active && setLoading(false));
    }, 180);
    return () => { active = false; window.clearTimeout(timer); };
  }, [ready, filters, sortField, sortOrder, page, rows, summary]);

  const update = (key: keyof TransactionFilters, value: unknown) => { setPage(0); setFilters((current) => ({ ...current, [key]: value || undefined })); };
  const openDetail = async (row: TransactionRow) => setDetail(await engineClient.getRecord(row.recordId));
  const categoryBody = (row: TransactionRow) => <Tag value={row.category === 'VALID' ? 'Válida' : 'Inválida'} severity={row.category === 'VALID' ? 'success' : 'danger'} rounded />;
  const valueBody = (row: TransactionRow) => <span className="amount-cell">{row.amount ?? '—'} <small>{row.currency}</small></span>;

  return <div className="page">
    <PageHeader eyebrow="Exploración" title="Transacciones" description="Filtra, ordena y revisa registros sin copiar la colección completa fuera del motor Python." actions={<Button outlined icon="pi pi-filter-slash" label="Limpiar filtros" onClick={() => { setFilters({}); setPage(0); }} />} />
    <section className="filters-panel">
      <span className="search-field"><i className="pi pi-search" /><InputText value={filters.search ?? ''} onChange={(event) => update('search', event.target.value)} placeholder="Buscar en campos y original…" /></span>
      <Dropdown value={filters.categories?.[0] ?? null} options={[{ label: 'Válidas', value: 'VALID' }, { label: 'Inválidas', value: 'INVALID' }]} onChange={(event) => update('categories', event.value ? [event.value as Category] : undefined)} placeholder="Validez" showClear />
      <Dropdown value={filters.source ?? null} options={summary?.options.sources} onChange={(event) => update('source', event.value)} placeholder="Fuente" showClear />
      <Dropdown value={filters.status ?? null} options={summary?.options.statuses} onChange={(event) => update('status', event.value)} placeholder="Estado" showClear />
      <Dropdown value={filters.currency ?? null} options={summary?.options.currencies} onChange={(event) => update('currency', event.value)} placeholder="Moneda" showClear />
      <Dropdown value={filters.transactionType ?? null} options={summary?.options.transactionTypes} onChange={(event) => update('transactionType', event.value)} placeholder="Tipo" showClear />
      <InputText value={filters.amountMin ?? ''} onChange={(event) => update('amountMin', event.target.value)} placeholder="Monto mínimo" inputMode="decimal" />
      <InputText value={filters.amountMax ?? ''} onChange={(event) => update('amountMax', event.target.value)} placeholder="Monto máximo" inputMode="decimal" />
      <label className="date-filter"><span>Desde</span><input type="date" value={filters.dateFrom ?? ''} onChange={(event) => update('dateFrom', event.target.value)} /></label>
      <label className="date-filter"><span>Hasta</span><input type="date" value={filters.dateTo ?? ''} onChange={(event) => update('dateTo', event.target.value)} /></label>
    </section>
    {queryError && <div className="query-error" role="alert"><i className="pi pi-exclamation-circle" /><span>No se pudieron consultar las transacciones: {queryError}</span></div>}
    {query.filteredMetrics && <div className="selection-metrics"><span>Métricas de la selección filtrada</span><div><MetricCard label="Resultados" value={query.total} note="Coincidencias" icon="pi-filter" /><MetricCard label="Válidas" value={query.filteredMetrics.validTransactions} note={`${query.filteredMetrics.validPercentage}%`} icon="pi-check" tone="green" /><MetricCard label="Inválidas" value={query.filteredMetrics.invalidTransactions} note="En esta selección" icon="pi-times" tone="red" /></div></div>}
    <section className="table-panel">
      <DataTable value={query.items} lazy paginator first={page * rows} rows={rows} rowsPerPageOptions={[10, 20, 50]} totalRecords={query.total} loading={loading} onPage={(event: DataTablePageEvent) => { setPage(event.page ?? 0); setRows(event.rows); }} sortField={sortField} sortOrder={sortOrder} onSort={(event: DataTableSortEvent) => { setSortField(String(event.sortField)); setSortOrder(event.sortOrder === 1 ? 1 : -1); setPage(0); }} onRowClick={(event) => void openDetail(event.data as TransactionRow)} emptyMessage="No hay transacciones que coincidan con los filtros." rowHover stripedRows>
        <Column field="category" header="Validez" body={categoryBody} sortable />
        <Column field="transactionId" header="ID" sortable body={(row: TransactionRow) => row.transactionId || '—'} />
        <Column field="amount" header="Monto" body={valueBody} sortable />
        <Column field="status" header="Estado" sortable />
        <Column field="source" header="Fuente" sortable />
        <Column field="transactionDate" header="Fecha" sortable body={(row: TransactionRow) => row.transactionDate || '—'} />
        <Column field="sourceFile" header="Archivo" sortable />
        <Column header="" body={() => <i className="pi pi-chevron-right row-action" />} />
      </DataTable>
    </section>
    <RecordDetailDialog detail={detail} onHide={() => setDetail(null)} onSelectRecord={(recordId) => void engineClient.getRecord(recordId).then(setDetail)} />
  </div>;
}
