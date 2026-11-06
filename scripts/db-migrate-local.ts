// Apply the app-owned initial migration to an EXPLICITLY LOCAL, ephemeral
// PostgreSQL engine (PGlite). No DATABASE_URL is read here; this command never
// targets an external server.
//
//   pnpm db:migrate:local

import { pathToFileURL } from 'node:url';
import { loadMigrationSql } from './migration-sql.js';

export async function main(): Promise<number> {
  const { PGlite } = await import('@electric-sql/pglite');
  const db = new PGlite();
  await db.exec(`BEGIN;\n${loadMigrationSql()}\nCOMMIT;`);
  const version = await db.query<{ v: string }>('SELECT version() AS v');
  console.log(`[db-migrate:local] applied initial migration to ephemeral PGlite engine: ${version.rows[0]!.v}`);
  return 0;
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((err) => {
      console.error('[db-migrate:local] FAILED:', err);
      process.exitCode = 1;
    });
}