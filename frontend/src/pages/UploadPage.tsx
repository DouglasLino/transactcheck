import { useRef, useState } from 'react';
import { Button } from 'primereact/button';
import { Tag } from 'primereact/tag';
import { useEngine } from '../context/EngineContext';
import { PageHeader } from '../components/PageHeader';

function bytes(value: number) {
  return value < 1024 * 1024 ? `${(value / 1024).toFixed(1)} KiB` : `${(value / 1024 / 1024).toFixed(2)} MiB`;
}

export function UploadPage({ onNavigate }: { onNavigate(view: 'dashboard' | 'diagnostics'): void }) {
  const { summary, busy, ready, processFiles, removeFile } = useEngine();
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const files = summary?.files ?? [];
  const limits = summary?.limits;

  const submit = (list: FileList | null) => {
    if (list) void processFiles(Array.from(list));
    if (input.current) input.current.value = '';
  };

  return <div className="page upload-page">
    <PageHeader eyebrow="Paso 1" title="Carga tus archivos JSON" description="Agrega hasta tres archivos. Cada documento se valida por completo antes de analizar cualquier transacción." actions={files.length > 0 && <Button label="Ver dashboard" icon="pi pi-arrow-right" iconPos="right" onClick={() => onNavigate('dashboard')} />} />
    <section className="upload-layout">
      <div className={`drop-zone ${dragging ? 'dragging' : ''}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); submit(event.dataTransfer.files); }}>
        <div className="upload-illustration"><i className="pi pi-cloud-upload" /></div>
        <h2>Suelta aquí tus archivos</h2>
        <p>Solo JSON · máximo 5 MiB por archivo · 15 MiB acumulados</p>
        <Button label="Seleccionar archivos" icon="pi pi-folder-open" disabled={!ready || busy || files.length >= 3} onClick={() => input.current?.click()} />
        <input ref={input} hidden type="file" accept=".json,application/json" multiple onChange={(event) => submit(event.target.files)} />
        <small>No se envían datos a un servidor ni se conservan al cerrar la sesión.</small>
      </div>
      <aside className="limit-panel">
        <h3>Capacidad de la sesión</h3>
        <div className="limit-value"><strong>{files.length}</strong><span>/ 3 archivos</span></div>
        <div className="capacity-track"><span style={{ width: `${Math.min((files.length / 3) * 100, 100)}%` }} /></div>
        <div className="limit-row"><span>Uso acumulado</span><strong>{bytes(limits?.activeBytes ?? 0)} / 15 MiB</strong></div>
        <div className="limit-row"><span>Diagnósticos de archivo</span><button onClick={() => onNavigate('diagnostics')}>{summary?.metrics.fileDiagnosticCount ?? 0} <i className="pi pi-arrow-right" /></button></div>
        <div className="validation-sequence"><span><i className="pi pi-check" /> Extensión y límites</span><span><i className="pi pi-check" /> Sintaxis completa</span><span><i className="pi pi-check" /> Detección y normalización</span></div>
      </aside>
    </section>
    <section className="section-block">
      <div className="section-heading"><div><span className="eyebrow">Sesión actual</span><h2>Archivos procesados</h2></div><span>{files.length} de 3 cupos utilizados</span></div>
      {files.length === 0 ? <div className="empty-state"><i className="pi pi-inbox" /><h3>Aún no hay archivos activos</h3><p>Los archivos rechazados no consumen cupo ni alteran resultados anteriores.</p></div> : <div className="file-list">{files.map((file) => <article key={file.fileId} className="file-card"><div className="file-type">JSON</div><div className="file-info"><strong>{file.name}</strong><span>{bytes(file.size)} · {file.recordCount} objetos clasificados</span></div><Tag value="Procesado" severity="success" rounded /><Button text rounded severity="danger" icon="pi pi-trash" aria-label={`Retirar ${file.name}`} disabled={busy} onClick={() => void removeFile(file.fileId)} /></article>)}</div>}
    </section>
  </div>;
}

