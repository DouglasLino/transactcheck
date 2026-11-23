import { FormEvent, useState, useSyncExternalStore } from 'react';
import { Button } from 'primereact/button';
import { InputTextarea } from 'primereact/inputtextarea';
import { ProgressBar } from 'primereact/progressbar';
import { Tag } from 'primereact/tag';
import { LOCAL_MODEL_CONFIG } from '../ai/modelConfig';
import type { ChatMessage } from '../ai/types';
import { PageHeader } from '../components/PageHeader';
import { localAiClient } from '../services/localAiClient';
import { operationLabel, runAgentQuery } from '../agent/transactionQueryAgent';

const starterQuestions = [
  '¿Cuántas transacciones tengo cargadas?',
  '¿Cuál es la transacción de mayor monto?',
  '¿Hay posibles transacciones duplicadas?',
  '¿Cuáles son las inconsistencias más frecuentes?',
];

const statusLabels = {
  idle: 'Sin iniciar', loading: 'Cargando modelo', ready: 'Listo', generating: 'Generando', error: 'Error',
};

export function AssistantPage() {
  const snapshot = useSyncExternalStore(localAiClient.subscribe, localAiClient.getSnapshot);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState('');

  const initialize = async () => {
    try { await localAiClient.initialize(); } catch { /* El estado compartido muestra el error. */ }
  };

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    const content = question.trim();
    if (!content || snapshot.status !== 'ready') return;
    const userMessage: ChatMessage = { role: 'user', content };
    setMessages((current) => [...current, userMessage]);
    setQuestion('');
    try {
      const response = await runAgentQuery(content, messages);
      setMessages((current) => [...current, { role: 'assistant', content: response.content, trace: response.trace, failure: response.failure }]);
    } catch {
      setMessages((current) => [...current, { role: 'assistant', content: 'No fue posible completar la inferencia local. Revisa el estado técnico del modelo y vuelve a intentarlo.', failure: { stage: 'inference' } }]);
    }
  };

  const askStarter = (value: string) => setQuestion(value);
  const loading = snapshot.status === 'loading';
  const generating = snapshot.status === 'generating';

  return <div className="page assistant-page">
    <PageHeader eyebrow="Agente local experimental" title="Asistente IA" description="Interpreta consultas en español y puede ejecutar la skill transaction-query sobre los datos activos de la sesión." />
    <section className="assistant-layout">
      <aside className="assistant-info panel">
        <div className="assistant-model-icon"><i className="pi pi-sparkles" /></div>
        <div><span className="assistant-info-label">Modelo</span><strong>{LOCAL_MODEL_CONFIG.id}</strong></div>
        <div><span className="assistant-info-label">Cuantización</span><strong>{LOCAL_MODEL_CONFIG.dtype.toUpperCase()}</strong></div>
        <div><span className="assistant-info-label">Estado</span><Tag className={`assistant-status-tag ${snapshot.status === 'idle' ? 'is-idle' : ''}`} value={statusLabels[snapshot.status]} severity={snapshot.status === 'idle' ? undefined : snapshot.status === 'ready' ? 'success' : snapshot.status === 'error' ? 'danger' : 'info'} /></div>
        {snapshot.device && <div><span className="assistant-info-label">Dispositivo activo</span><strong>{snapshot.device === 'webgpu' ? 'WebGPU' : 'CPU / WASM'}</strong></div>}
        {snapshot.profileVersion && <div><span className="assistant-info-label">Perfil</span><strong>{snapshot.profileVersion}</strong></div>}
        {loading && <div className="assistant-progress"><span>Descarga y preparación{snapshot.progress !== null ? ` · ${snapshot.progress}%` : ''}</span><ProgressBar value={snapshot.progress ?? 0} showValue={false} /></div>}
        {snapshot.error && <div className="assistant-error"><i className="pi pi-times-circle" /><span>{snapshot.error}</span></div>}
        {snapshot.status === 'idle' || snapshot.status === 'error' ? <Button className="assistant-start-button" label={snapshot.status === 'error' ? 'Reintentar' : 'Iniciar asistente'} icon="pi pi-play" onClick={() => void initialize()} /> : null}
        <small>La primera carga descarga aproximadamente 1 GB desde Internet. Para responder, el modelo usa la GPU mediante WebGPU cuando está disponible o la CPU con WASM como respaldo. El navegador puede reutilizar su caché después.</small>
      </aside>

      <section className="assistant-chat panel" aria-label="Conversación con el asistente local">
        <div className="chat-messages" aria-live="polite">
          {messages.length === 0 && <div className="assistant-welcome"><i className="pi pi-comments" /><h2>Consulta los datos activos</h2><p>El modelo selecciona una operación permitida y Python obtiene el resultado desde la misma sesión usada por el dashboard.</p><div>{starterQuestions.map((item) => <button key={item} type="button" onClick={() => askStarter(item)} disabled={snapshot.status !== 'ready'}>{item}</button>)}</div></div>}
          {messages.map((message, index) => <div key={`${message.role}-${index}`} className={`chat-message ${message.role}`}><span><i className={`pi ${message.role === 'user' ? 'pi-user' : 'pi-sparkles'}`} /></span><div><strong>{message.role === 'user' ? 'Tú' : 'Asistente local'}</strong><p>{message.content}</p>{message.failure && <div className="agent-failure"><Tag value={`Fallo de ${message.failure.stage}`} severity="warning" /><small>{message.failure.code || 'Consulta el panel de estado para el detalle técnico.'}</small></div>}{message.trace && <div className="skill-trace"><div><Tag value={message.trace.skillId} severity="info" /><span>{operationLabel(message.trace.operation)}</span></div><small>Interpretación: {message.trace.interpretationMs} ms · Python: {message.trace.executionMs} ms</small><details><summary>Resultado estructurado</summary><pre>{JSON.stringify(message.trace.result, null, 2)}</pre></details></div>}</div></div>)}
          {generating && <div className="chat-message assistant pending"><span><i className="pi pi-spin pi-spinner" /></span><div><strong>Asistente local</strong><p>Generando respuesta…</p></div></div>}
        </div>
        <form className="assistant-composer" onSubmit={(event) => void submit(event)}>
          <InputTextarea value={question} onChange={(event) => setQuestion(event.target.value)} rows={2} autoResize placeholder={snapshot.status === 'ready' ? 'Escribe una pregunta sobre TransactCheck…' : 'Inicia el asistente para escribir…'} disabled={snapshot.status !== 'ready'} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void submit(); } }} />
          <Button type="submit" icon="pi pi-send" label="Enviar" disabled={!question.trim() || snapshot.status !== 'ready'} loading={generating} />
        </form>
      </section>
    </section>
  </div>;
}
