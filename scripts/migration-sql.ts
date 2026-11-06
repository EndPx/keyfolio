import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

export function loadMigrationSql(): string {
  return readFileSync(join(here, '..', 'apps', 'api', 'migrations', '0001_initial.sql'), 'utf8');
}

export function loadDownSql(): string {
  return readFileSync(join(here, '..', 'apps', 'api', 'migrations', '0001_initial.down.sql'), 'utf8');
}