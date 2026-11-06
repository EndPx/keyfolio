// Apply the app-owned initial migration to an EXTERNAL PostgreSQL server.
//
//   pnpm db:migrate            -> requires DATABASE_URL; fails (exit 1) if absent,
//                                 with no implicit fallback to the ephemeral engine.
//
// The isolated local engine is a separate, explicitly-named command:
//   pnpm db:migrate:local

import { pathToFileURL } from 'node:url';
import { loadMigrationSql } from './migration-sql.js';
import { resolveMigrationTarget } from './migration-target.js';

async function applyExternal(url: string): Promise<void> {
  const { Client } = await import('pg');
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query(loadMigrationSql());
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    await client.end();
  }
  console.log('[db-migrate] applied initial migration to external PostgreSQL (DATABASE_URL provided, not printed).');
}

export async function main(): Promise<number> {
  const target = resolveMigrationTarget(process.env);
  if (target.kind === 'missing_url') {
    console.error(`[db-migrate] ${target.reason}`);
    return 1;
  }
  await applyExternal(target.url);
  return 0;
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((err) => {
      console.error('[db-migrate] FAILED:', err);
      process.exitCode = 1;
    });
}