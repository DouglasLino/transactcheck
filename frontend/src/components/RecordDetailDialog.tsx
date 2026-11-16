import { Dialog } from 'primereact/dialog';
import { Tag } from 'primereact/tag';
import type { TransactionDetail } from '../types';

const labels: Record<string, string> = {
  transactionId: 'ID de transacción', source: 'Fuente', amount: 'Monto', currency: 'Moneda', status: 'Estado',
  transactionDate: 'Fecha', transactionType: 'Tipo', referenceId: 'Referencia', description: 'Descripción',
};

export function RecordDetailDialog({ detail, onHide, onSelectRecord }: { detail: TransactionDetail | null; onHide(): void; onSelectRecord?(recordId: string): void }) {
  return <Dialog visible={Boolean(detail)} onHide={onHide} header="Trazabilidad de la transacción" className="detail-dialog" modal>
    {detail && <div className="detail-content">
      <div className="detail-meta"><Tag value={detail.category} severity={detail.category === 'VALID' ? 'success' : detail.category === 'INVALID' ? 'danger' : 'warning'} /><span><i className="pi pi-file" /> {detail.sourceFile}</span><code>{detail.jsonPath}</code></div>
      <section><h3>Modelo normalizado</h3>{detail.normalized ? <div className="field-grid">{Object.entries(labels).map(([key, label]) => <div key={key}><span>{label}</span><strong>{detail.normalized?.[key] == null ? 'null' : String(detail.normalized[key])}</strong></div>)}</div> : <p>Este objeto no se reconoció como transacción y no tiene representación normalizada.</p>}</section>
      <section><h3>Transformaciones aplicadas</h3><ul className="transformation-list">{detail.transformations.map((item, index) => <li key={index}><i className="pi pi-arrow-right" />{item}</li>)}</ul></section>
      <section><h3>Diagnósticos del registro</h3>{detail.diagnostics.length ? <div className="diagnostic-list">{detail.diagnostics.map((item, index) => <div key={`${item.code}-${index}`} className={`diagnostic-item ${item.severity.toLowerCase()}`}><Tag value={item.severity} severity={item.severity === 'ERROR' ? 'danger' : item.severity === 'WARNING' ? 'warning' : 'info'} /><div><strong>{item.code}</strong><p>{item.message}</p><small>{item.details}</small></div></div>)}</div> : <p>Sin diagnósticos.</p>}</section>
      {detail.possibleDuplicates.records.length > 0 && <section><h3>Posibles duplicados relacionados</h3><p className="detail-section-note">Coincidencia sospechosa; ningún registro fue eliminado ni confirmado como duplicado.</p><div className="duplicate-related-list">{detail.possibleDuplicates.records.map((record) => <button key={record.recordId} onClick={() => onSelectRecord?.(record.recordId)}><span><strong>{record.transactionId || 'Sin identificador'}</strong><small>{record.sourceFile} · {record.jsonPath}</small></span><i className="pi pi-arrow-right" /></button>)}</div><small>Criterios: {detail.possibleDuplicates.criteria.join(', ')}</small></section>}
      <section><h3>JSON original conservado</h3><details className="json-details" open><summary>Mostrar estructura original</summary><pre>{JSON.stringify(detail.original, null, 2)}</pre></details></section>
    </div>}
  </Dialog>;
}
