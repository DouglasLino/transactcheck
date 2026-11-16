import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPyodide } from 'pyodide';

const here = dirname(fileURLToPath(import.meta.url));
const frontend = resolve(here, '..');
const root = resolve(frontend, '..');
const engineDirectory = join(frontend, 'public', 'engine');
const manifest = JSON.parse(await readFile(join(engineDirectory, 'manifest.json'), 'utf8'));
const pyodide = await loadPyodide();

for (const relativePath of manifest.files) {
  const content = await readFile(join(engineDirectory, relativePath), 'utf8');
  const target = `/app/${relativePath}`;
  pyodide.FS.mkdirTree(target.slice(0, target.lastIndexOf('/')));
  pyodide.FS.writeFile(target, content, { encoding: 'utf8' });
}

await pyodide.runPythonAsync(`
import sys
sys.path.insert(0, "/app")
from transactcheck_engine.api import initialize, process_request
initialize("/app/config")
`);

function request(action, payload = {}) {
  pyodide.globals.set('__smoke_request', JSON.stringify({ action, payload }));
  const response = JSON.parse(pyodide.runPython('process_request(__smoke_request)'));
  pyodide.globals.delete('__smoke_request');
  return response;
}

const sample = await readFile(join(root, 'data', 'samples', 'heterogeneous.json'), 'utf8');
const result = request('addFile', {
  fileId: 'smoke', name: 'heterogeneous.json', size: Buffer.byteLength(sample), content: sample,
});

if (!result.accepted) throw new Error('El archivo de prueba fue rechazado por Pyodide.');
if (result.summary.metrics.processedTransactions !== 3) throw new Error('Conteo transaccional inesperado en Pyodide.');
if (result.summary.metrics.validTransactions !== 2 || result.summary.metrics.invalidTransactions !== 1) {
  throw new Error('Clasificación inesperada en Pyodide.');
}
const dashboard = request('getDashboard', { filters: { currency: 'USD' }, temporalGrouping: 'day' });
if (dashboard.globalMetrics.processedTransactions !== 3 || dashboard.filteredMetrics.processedTransactions !== 1) {
  throw new Error('Las métricas globales o filtradas del Dashboard son incorrectas en Pyodide.');
}
if (dashboard.filteredMetrics.currencyTotals.USD.positiveCount !== 1) {
  throw new Error('La agregación monetaria del Dashboard es incorrecta en Pyodide.');
}
const page = request('queryTransactions', { filters: { categories: ['INVALID'] }, page: 0, pageSize: 10 });
if (page.total !== 1) throw new Error('El explorador paginado del Dashboard no devolvió la transacción inválida.');
console.log(`Pyodide ${pyodide.version}: Dashboard integrado (global, filtros, moneda y paginación).`);
