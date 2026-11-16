import { useRef, useState } from 'react';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { Tag } from 'primereact/tag';
import { useEngine } from '../context/EngineContext';
import { PageHeader } from '../components/PageHeader';

function bytes(value: number) {
  return value < 1024 * 1024 ? `${(value / 1024).toFixed(1)} KiB` : `${(value / 1024 / 1024).toFixed(2)} MiB`;
}

interface SampleManifest { files: string[] }

export function UploadPage({ onNavigate }: { onNavigate(view: 'dashboard' | 'diagnostics'): void }) {
  const { summary, busy, ready, processFiles, removeFile } = useEngine();
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [samplesVisible, setSamplesVisible] = useState(false);
  const [sampleNames, setSampleNames] = useState<string[]>([]);
  const [sampleContents, setSampleContents] = useState<Record<string, string>>({});
  const [activeSample, setActiveSample] = useState<string | null>(null);
  const [selectedSamples, setSelectedSamples] = useState<string[]>([]);
  const [samplesLoading, setSamplesLoading] = useState(false);
  const [samplesError, setSamplesError] = useState<string | null>(null);
  const files = summary?.files ?? [];
  const limits = summary?.limits;

  const submit = (list: FileList | null) => {
    if (list) void processFiles(Array.from(list));
    if (input.current) input.current.value = '';
  };

  const openSamples = async () => {
    setSamplesVisible(true);
    if (sampleNames.length) return;
    setSamplesLoading(true);
    setSamplesError(null);
    try {
      const base = import.meta.env.BASE_URL;
      const response = await fetch(`${base}samples/manifest.json`);
      if (!response.ok) throw new Error('No se pudo leer el catálogo de muestras.');
      const manifest = await response.json() as SampleManifest;
      setSampleNames(manifest.files);
      if (manifest.files[0]) await previewSample(manifest.files[0]);
    } catch (error) {
      setSamplesError(error instanceof Error ? error.message : String(error));
    } finally {
      setSamplesLoading(false);
    }
  };

  const previewSample = async (name: string) => {
    setActiveSample(name);
    if (sampleContents[name] !== undefined) return;
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}samples/${encodeURIComponent(name)}`);
      if (!response.ok) throw new Error(`No se pudo leer ${name}.`);
      const content = await response.text();
      setSampleContents((current) => ({ ...current, [name]: content }));
    } catch (error) {
      setSamplesError(error instanceof Error ? error.message : String(error));
    }
  };

  const toggleSample = (name: string) => {
    const alreadySelected = selectedSamples.includes(name);
    if (!alreadySelected && selectedSamples.length >= Math.max(3 - files.length, 0)) return;
    setSelectedSamples((current) => alreadySelected ? current.filter((item) => item !== name) : [...current, name]);
  };

  const addSamples = async (continueToDashboard: boolean) => {
    setSamplesError(null);
    try {
      const loaded = await Promise.all(selectedSamples.map(async (name) => {
        let content = sampleContents[name];
        if (content === undefined) {
          const response = await fetch(`${import.meta.env.BASE_URL}samples/${encodeURIComponent(name)}`);
          if (!response.ok) throw new Error(`No se pudo leer ${name}.`);
          content = await response.text();
        }
        return new File([content], name, { type: 'application/json' });
      }));
      await processFiles(loaded);
      setSelectedSamples([]);
      setSamplesVisible(false);
      if (continueToDashboard) onNavigate('dashboard');
    } catch (error) {
      setSamplesError(error instanceof Error ? error.message : String(error));
    }
  };

  const closeSamples = () => {
    setSamplesVisible(false);
  };

  const activeFileNames = new Set(files.map((file) => file.name));
  const availableSlots = Math.max(3 - files.length, 0);

  return <div className="page upload-page">
    <PageHeader eyebrow="Paso 1" title="Carga tus archivos JSON" description="Agrega hasta tres archivos. Cada documento se valida por completo antes de analizar cualquier transacción." actions={files.length > 0 && <Button label="Ver dashboard" icon="pi pi-arrow-right" iconPos="right" onClick={() => onNavigate('dashboard')} />} />
    <section className="upload-layout">
      <div className={`drop-zone ${dragging ? 'dragging' : ''}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); submit(event.dataTransfer.files); }}>
        <div className="upload-illustration"><i className="pi pi-cloud-upload" /></div>
        <h2>Suelta aquí tus archivos</h2>
        <p>Solo JSON · máximo 5 MiB por archivo · 15 MiB acumulados</p>
        <Button label="Seleccionar archivos" icon="pi pi-folder-open" disabled={!ready || busy || files.length >= 3} onClick={() => input.current?.click()} />
        <Button className="sample-picker-trigger" label="Usar archivos de muestra" icon="pi pi-box" severity="secondary" outlined size="small" disabled={!ready || busy || files.length >= 3} onClick={() => void openSamples()} />
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
    <Dialog visible={samplesVisible} onHide={closeSamples} header="Archivos de muestra" className="sample-picker-dialog" modal dismissableMask closeOnEscape closable draggable={false}>
      <div className="sample-picker-intro"><span>Selecciona hasta {availableSlots} {availableSlots === 1 ? 'archivo' : 'archivos'} para completar la sesión.</span><small>El contenido se procesa localmente con las mismas validaciones que un archivo elegido desde tu equipo.</small></div>
      {samplesLoading ? <div className="sample-picker-state"><i className="pi pi-spin pi-spinner" /> Cargando muestras…</div> : samplesError ? <div className="sample-picker-state error"><i className="pi pi-exclamation-circle" /> {samplesError}</div> : <div className="sample-picker-body">
        <div className="sample-picker-list" role="listbox" aria-label="Archivos de muestra">{sampleNames.map((name) => {
          const selected = selectedSamples.includes(name);
          const alreadyLoaded = activeFileNames.has(name);
          const selectionFull = !selected && selectedSamples.length >= availableSlots;
          return <div key={name} className={`${activeSample === name ? 'active' : ''} ${alreadyLoaded ? 'disabled' : ''}`}>
            <button className="sample-preview-button" onClick={() => void previewSample(name)} aria-selected={activeSample === name}><i className="pi pi-file" /><span><strong>{name}</strong><small>{alreadyLoaded ? 'Ya está en la sesión' : 'Vista previa disponible'}</small></span><i className="pi pi-angle-right" /></button>
            <label aria-label={`Seleccionar ${name}`}><input type="checkbox" checked={selected} disabled={alreadyLoaded || selectionFull || busy} onChange={() => toggleSample(name)} /><span /></label>
          </div>;
        })}</div>
        <div className="sample-preview"><div><span>Vista previa</span><strong>{activeSample ?? 'Selecciona un archivo'}</strong></div><pre>{activeSample ? (sampleContents[activeSample] ?? 'Cargando contenido…') : 'Selecciona un archivo de la lista para ver su contenido.'}</pre></div>
      </div>}
      <div className="sample-picker-footer"><span>{selectedSamples.length} seleccionados · {availableSlots} cupos disponibles</span><div><Button label="Agregar seleccionados" icon="pi pi-plus" outlined disabled={!selectedSamples.length || busy} loading={busy} onClick={() => void addSamples(false)} /><Button label="Continuar" icon="pi pi-arrow-right" iconPos="right" disabled={busy || (!selectedSamples.length && files.length === 0)} onClick={() => selectedSamples.length ? void addSamples(true) : onNavigate('dashboard')} /></div></div>
    </Dialog>
  </div>;
}

