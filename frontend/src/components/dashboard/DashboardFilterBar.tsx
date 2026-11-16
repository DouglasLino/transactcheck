import { Button } from 'primereact/button';
import { Dropdown } from 'primereact/dropdown';
import { InputText } from 'primereact/inputtext';
import type { Category, Summary, TransactionFilters } from '../../types';

interface DashboardFilterBarProps {
  filters: TransactionFilters;
  summary: Summary;
  onChange(key: keyof TransactionFilters, value: unknown): void;
  onReset(): void;
}

export function DashboardFilterBar({ filters, summary, onChange, onReset }: DashboardFilterBarProps) {
  const fileOptions = summary.files.map((file) => ({ label: file.name, value: file.fileId }));
  return <section className="dashboard-filter-bar" aria-label="Filtros del Dashboard">
    <div className="dashboard-filter-heading"><span><i className="pi pi-filter" /> Filtros de análisis</span><Button text size="small" icon="pi pi-filter-slash" label="Restablecer" onClick={onReset} tooltip="Quita todos los filtros." /></div>
    <div className="dashboard-filter-grid">
      <Dropdown value={filters.fileId ?? null} options={fileOptions} onChange={(event) => onChange('fileId', event.value)} placeholder="Archivo de origen" showClear tooltip="Limita el análisis a un archivo." />
      <Dropdown value={filters.status ?? null} options={summary.options.statuses} onChange={(event) => onChange('status', event.value)} placeholder="Estado" showClear tooltip="Filtra por estado normalizado." />
      <Dropdown value={filters.transactionType ?? null} options={summary.options.transactionTypes} onChange={(event) => onChange('transactionType', event.value)} placeholder="Tipo" showClear tooltip="Filtra por tipo reconocido." />
      <Dropdown value={filters.currency ?? null} options={summary.options.currencies} onChange={(event) => onChange('currency', event.value)} placeholder="Moneda" showClear tooltip="Filtra sin mezclar monedas." />
      <Dropdown value={filters.categories?.[0] ?? null} options={[{ label: 'Válidas', value: 'VALID' }, { label: 'Inválidas', value: 'INVALID' }]} onChange={(event) => onChange('categories', event.value ? [event.value as Category] : undefined)} placeholder="Validez" showClear tooltip="Filtra por validación mínima." />
      <label className="dashboard-date-field" data-pr-tooltip="Fecha normalizada mínima."><span>Desde</span><input type="date" value={filters.dateFrom ?? ''} onChange={(event) => onChange('dateFrom', event.target.value)} /></label>
      <label className="dashboard-date-field" data-pr-tooltip="Fecha normalizada máxima."><span>Hasta</span><input type="date" value={filters.dateTo ?? ''} onChange={(event) => onChange('dateTo', event.target.value)} /></label>
      <span className="dashboard-search-field" data-pr-tooltip="Busca por ID o referencia."><i className="pi pi-search" /><InputText value={filters.identifierSearch ?? ''} onChange={(event) => onChange('identifierSearch', event.target.value)} placeholder="Identificador o referencia" /></span>
    </div>
  </section>;
}

