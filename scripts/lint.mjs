import { readdir, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import YAML from 'yaml';
for (const dir of ['src', 'tests', 'scripts', 'examples']) for (const file of await readdir(dir)) {
  if (/\.(m?js)$/.test(file)) { const r = spawnSync(process.execPath, ['--check', `${dir}/${file}`], { stdio: 'inherit' }); if (r.status) process.exit(r.status); }
}
for (const file of ['openapi.yaml', '.github/workflows/ci.yml', '.github/workflows/deploy.yml']) YAML.parse(await readFile(file, 'utf8'));
for (const file of ['host.json', 'local.settings.json.example']) JSON.parse(await readFile(file, 'utf8'));
console.log('Syntax and configuration checks passed');
