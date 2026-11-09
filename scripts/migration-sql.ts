import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

export function loadMigrationSql(): string {
  const dir = join(here, '..', 'apps', 'api', 'migrations');
  return readdirSync(dir)
    .filter((name) => /^\d+_.*\.sql$/.test(name) && !name.endsWith('.down.sql'))
    .sort()
    .map((name) => readFileSync(join(dir, name), 'utf8'))
    .join('\n');
}

export function loadDownSql(): string {
  const dir = join(here, '..', 'apps', 'api', 'migrations');
  return readdirSync(dir)
    .filter((name) => /^\d+_.*\.down\.sql$/.test(name))
    .sort()
    .reverse()
    .map((name) => readFileSync(join(dir, name), 'utf8'))
    .join('\n');
}
