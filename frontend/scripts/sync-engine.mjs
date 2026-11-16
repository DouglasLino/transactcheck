import { cp, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const frontend = resolve(here, '..');
const root = resolve(frontend, '..');
const target = join(frontend, 'public', 'engine');
const samplesTarget = join(frontend, 'public', 'samples');

await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });
await cp(join(root, 'python', 'transactcheck_engine'), join(target, 'transactcheck_engine'), {
  recursive: true,
  filter: (source) => !source.includes('__pycache__') && !source.endsWith('.pyc'),
});
await cp(join(root, 'config'), join(target, 'config'), { recursive: true });
await rm(samplesTarget, { recursive: true, force: true });
await mkdir(samplesTarget, { recursive: true });
const sampleEntries = (await readdir(join(root, 'data', 'samples'), { withFileTypes: true }))
  .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.json'))
  .map((entry) => entry.name)
  .sort();
for (const name of sampleEntries) {
  await cp(join(root, 'data', 'samples', name), join(samplesTarget, name));
}
await writeFile(join(samplesTarget, 'manifest.json'), JSON.stringify({ files: sampleEntries }, null, 2) + '\n', 'utf8');

async function collect(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await collect(path)));
    else files.push(relative(target, path).split('\\').join('/'));
  }
  return files;
}

const files = (await collect(target)).filter((file) => file !== 'manifest.json').sort();
await writeFile(join(target, 'manifest.json'), JSON.stringify({ files }, null, 2) + '\n', 'utf8');
console.log(`Motor sincronizado: ${files.length} archivos; muestras: ${sampleEntries.length}.`);

