import { useState } from 'react';
import { Button } from 'primereact/button';
import { ProgressBar } from 'primereact/progressbar';
import type { ViewId } from '../types';
import { useEngine } from '../context/EngineContext';

const items: Array<{ id: ViewId; icon: string; label: string }> = [
  { id: 'upload', icon: 'pi-upload', label: 'Carga de archivos' },
  { id: 'dashboard', icon: 'pi-chart-bar', label: 'Dashboard' },
  { id: 'transactions', icon: 'pi-list', label: 'Transacciones' },
  { id: 'diagnostics', icon: 'pi-exclamation-triangle', label: 'Inconsistencias' },
  { id: 'rules', icon: 'pi-book', label: 'Reglas' },
  { id: 'assistant', icon: 'pi-sparkles', label: 'Asistente IA' },
];

export function AppLayout({ view, onNavigate, children }: { view: ViewId; onNavigate(view: ViewId): void; children: React.ReactNode }) {
  const { ready, busy, startupError, notices, dismissNotice } = useEngine();
  const [dark, setDark] = useState(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false);
  const [menuOpen, setMenuOpen] = useState(false);

  const toggleTheme = () => {
    setDark((value) => {
      document.documentElement.classList.toggle('dark', !value);
      return !value;
    });
  };

  return (
    <div className={`app-shell ${dark ? 'theme-dark' : ''}`}>
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="brand">
          <span className="brand-mark"><i className="pi pi-verified" /></span>
          <div><strong>TransactCheck</strong><small>MVP1 · procesamiento local</small></div>
        </div>
        <nav aria-label="Navegación principal">
          {items.map((item) => (
            <button key={item.id} className={view === item.id ? 'active' : ''} onClick={() => { onNavigate(item.id); setMenuOpen(false); }}>
              <i className={`pi ${item.icon}`} /><span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="privacy-note"><i className="pi pi-lock" /><span>Los datos permanecen en esta sesión del navegador.</span></div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <Button className="menu-button" text rounded icon="pi pi-bars" aria-label="Abrir menú" onClick={() => setMenuOpen(!menuOpen)} />
          <div className="engine-status">
            <span className={`status-dot ${ready ? 'online' : startupError ? 'error' : ''}`} />
            {startupError ? 'Motor no disponible' : ready ? 'Motor Python listo' : 'Iniciando Pyodide…'}
          </div>
          <Button text rounded icon={dark ? 'pi pi-sun' : 'pi pi-moon'} aria-label="Cambiar modo de color" onClick={toggleTheme} />
        </header>
        {(busy || !ready) && !startupError && <ProgressBar mode="indeterminate" style={{ height: '3px' }} />}
        <main>{startupError ? <div className="fatal-error"><i className="pi pi-times-circle" /><h2>No se pudo iniciar el motor</h2><p>{startupError}</p><p>Comprueba la conexión inicial necesaria para descargar Pyodide y recarga la página.</p></div> : children}</main>
      </div>
      <div className="notice-stack" aria-live="polite">
        {notices.map((notice) => <button key={notice.id} className={`notice ${notice.severity}`} onClick={() => dismissNotice(notice.id)}><i className={`pi ${notice.severity === 'success' ? 'pi-check-circle' : notice.severity === 'error' ? 'pi-times-circle' : 'pi-info-circle'}`} /><span>{notice.text}</span><i className="pi pi-times" /></button>)}
      </div>
      {menuOpen && <button className="menu-scrim" aria-label="Cerrar menú" onClick={() => setMenuOpen(false)} />}
    </div>
  );
}

