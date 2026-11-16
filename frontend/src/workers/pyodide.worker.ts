/// <reference lib="webworker" />

const PYODIDE_INDEX = 'https://cdn.jsdelivr.net/pyodide/v314.0.8/full/';
const PYODIDE_MODULE = `${PYODIDE_INDEX}pyodide.mjs`;

interface PyodideApi {
  FS: { mkdirTree(path: string): void; writeFile(path: string, content: string, options: { encoding: string }): void };
  globals: { set(name: string, value: unknown): void; delete(name: string): void };
  runPython(code: string): unknown;
  runPythonAsync(code: string): Promise<unknown>;
}

let pyodide: PyodideApi | null = null;

async function initialize() {
  const module = await import(/* @vite-ignore */ PYODIDE_MODULE) as { loadPyodide(options: { indexURL: string }): Promise<PyodideApi> };
  pyodide = await module.loadPyodide({ indexURL: PYODIDE_INDEX });
  const engineBase = new URL(`${import.meta.env.BASE_URL}engine/`, self.location.origin);
  const manifest = await fetch(new URL('manifest.json', engineBase)).then((response) => {
    if (!response.ok) throw new Error(`No se pudo cargar el manifiesto del motor (${response.status}).`);
    return response.json() as Promise<{ files: string[] }>;
  });
  for (const file of manifest.files) {
    const response = await fetch(new URL(file, engineBase));
    if (!response.ok) throw new Error(`No se pudo cargar ${file}.`);
    const content = await response.text();
    const target = `/app/${file}`;
    pyodide.FS.mkdirTree(target.slice(0, target.lastIndexOf('/')));
    pyodide.FS.writeFile(target, content, { encoding: 'utf8' });
  }
  await pyodide.runPythonAsync(`
import sys
sys.path.insert(0, "/app")
from transactcheck_engine.api import initialize, process_request
initialize("/app/config")
`);
  return { ready: true, pyodideVersion: '314.0.8' };
}

const ready = initialize();

self.onmessage = async (event: MessageEvent<{ id: number; request: unknown }>) => {
  const { id, request } = event.data;
  try {
    if ((request as { action?: string }).action === 'initialize') {
      const result = await ready;
      self.postMessage({ id, result });
      return;
    }
    await ready;
    if (!pyodide) throw new Error('Pyodide no está disponible.');
    pyodide.globals.set('__request_json', JSON.stringify(request));
    const response = pyodide.runPython('process_request(__request_json)') as string;
    pyodide.globals.delete('__request_json');
    self.postMessage({ id, result: JSON.parse(response) });
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : String(error) });
  }
};

