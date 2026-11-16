import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { engineClient } from '../services/engineClient';
import type { Summary } from '../types';

interface Notice { id: string; severity: 'success' | 'error' | 'info'; text: string }

interface EngineContextValue {
  ready: boolean;
  busy: boolean;
  startupError: string | null;
  summary: Summary | null;
  notices: Notice[];
  processFiles(files: File[]): Promise<void>;
  removeFile(fileId: string): Promise<void>;
  refresh(): Promise<void>;
  dismissNotice(id: string): void;
}

const EngineContext = createContext<EngineContextValue | null>(null);

export function EngineProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [startupError, setStartupError] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const noticeTimeouts = useRef(new Map<string, number>());

  const addNotice = useCallback((severity: Notice['severity'], text: string) => {
    const id = crypto.randomUUID();
    setNotices((current) => [...current.slice(-4), { id, severity, text }]);
    const timeout = window.setTimeout(() => {
      setNotices((current) => current.filter((item) => item.id !== id));
      noticeTimeouts.current.delete(id);
    }, 10_000);
    noticeTimeouts.current.set(id, timeout);
  }, []);

  const dismissNotice = useCallback((id: string) => {
    const timeout = noticeTimeouts.current.get(id);
    if (timeout !== undefined) window.clearTimeout(timeout);
    noticeTimeouts.current.delete(id);
    setNotices((current) => current.filter((item) => item.id !== id));
  }, []);

  useEffect(() => () => {
    noticeTimeouts.current.forEach((timeout) => window.clearTimeout(timeout));
    noticeTimeouts.current.clear();
  }, []);

  const refresh = useCallback(async () => {
    setSummary(await engineClient.summary());
  }, []);

  useEffect(() => {
    let active = true;
    engineClient.initialize()
      .then(async () => {
        const initial = await engineClient.summary();
        if (active) {
          setSummary(initial);
          setReady(true);
        }
      })
      .catch((error: Error) => active && setStartupError(error.message));
    return () => { active = false; };
  }, []);

  const processFiles = useCallback(async (files: File[]) => {
    if (!files.length) return;
    setBusy(true);
    try {
      let currentSummary = summary;
      for (const file of files) {
        try {
          const exceedsKnownLimits = Boolean(currentSummary && (
            currentSummary.files.length >= currentSummary.limits.maxFiles
            || currentSummary.limits.activeBytes + file.size > currentSummary.limits.maxTotalBytes
          ));
          const hasInvalidType = !file.name.toLowerCase().endsWith('.json');
          const isTooLarge = Boolean(currentSummary && file.size > currentSummary.limits.maxFileBytes);
          const content = hasInvalidType || isTooLarge || exceedsKnownLimits ? '' : await file.text();
          const result = await engineClient.addFile(crypto.randomUUID(), file, content);
          setSummary(result.summary);
          currentSummary = result.summary;
          if (result.accepted) addNotice('success', `${file.name} fue procesado correctamente.`);
          else addNotice('error', result.diagnostic?.message || `${file.name} fue rechazado.`);
        } catch (error) {
          addNotice('error', `${file.name}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    } finally {
      setBusy(false);
    }
  }, [addNotice, summary]);

  const removeFile = useCallback(async (fileId: string) => {
    setBusy(true);
    try {
      const result = await engineClient.removeFile(fileId);
      setSummary(result.summary);
      if (result.removed) addNotice('info', 'El archivo fue retirado y las métricas se recalcularon.');
    } catch (error) {
      addNotice('error', error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }, [addNotice]);

  const value = useMemo(() => ({
    ready, busy, startupError, summary, notices, processFiles, removeFile, refresh,
    dismissNotice,
  }), [ready, busy, startupError, summary, notices, processFiles, removeFile, refresh, dismissNotice]);

  return <EngineContext.Provider value={value}>{children}</EngineContext.Provider>;
}

export function useEngine() {
  const value = useContext(EngineContext);
  if (!value) throw new Error('useEngine debe utilizarse dentro de EngineProvider.');
  return value;
}

