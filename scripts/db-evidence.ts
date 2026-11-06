// Print a machine-readable evidence table for the atomic_u128 TEXT domain,
// run against an ephemeral PGlite (real PostgreSQL) engine. This is the
// "exact SQL failures/successes" record used in docs/evidence/KF-02.
//
// Outcomes are classified by what actually happened, never by what was
// expected: a successful execution is `OK`, a thrown execution is `ERROR`,
// `expected` is reported separately with a `passed` boolean, and the process
// exits non-zero on any outcome mismatch or unexpected SQLSTATE.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  DOMAIN_CHECK_SQLSTATE,
  runEvidenceChecks,
  type EvidenceCheck,
  type EvidenceResult,
} from './evidence-classifier.js';

const here = dirname(fileURLToPath(import.meta.url));
const migrationPath = join(here, '..', 'apps', 'api', 'migrations', '0001_initial.sql');
const migrationSql = readFileSync(migrationPath, 'utf8');

const checks: EvidenceCheck[] = [
  { statement: "SELECT '0'::atomic_u128 AS v", expected: 'OK' },
  { statement: "SELECT '1'::atomic_u128 AS v", expected: 'OK' },
  { statement: "SELECT '340282366920938463463374607431768211455'::atomic_u128 AS v", expected: 'OK' },
  { statement: "SELECT '1.5'::atomic_u128 AS v", expected: 'ERROR', expectedSqlstate: DOMAIN_CHECK_SQLSTATE },
  { statement: 'SELECT 1.5::atomic_u128 AS v', expected: 'ERROR', expectedSqlstate: DOMAIN_CHECK_SQLSTATE },
  { statement: 'SELECT 1.0::atomic_u128 AS v', expected: 'ERROR', expectedSqlstate: DOMAIN_CHECK_SQLSTATE },
  { statement: "SELECT '01'::atomic_u128 AS v", expected: 'ERROR', expectedSqlstate: DOMAIN_CHECK_SQLSTATE },
  { statement: "SELECT '-1'::atomic_u128 AS v", expected: 'ERROR', expectedSqlstate: DOMAIN_CHECK_SQLSTATE },
  { statement: "SELECT '+1'::atomic_u128 AS v", expected: 'ERROR', expectedSqlstate: DOMAIN_CHECK_SQLSTATE },
  { statement: "SELECT '1e3'::atomic_u128 AS v", expected: 'ERROR', expectedSqlstate: DOMAIN_CHECK_SQLSTATE },
  { statement: "SELECT ' 1'::atomic_u128 AS v", expected: 'ERROR', expectedSqlstate: DOMAIN_CHECK_SQLSTATE },
  { statement: "SELECT '340282366920938463463374607431768211456'::atomic_u128 AS v", expected: 'ERROR', expectedSqlstate: DOMAIN_CHECK_SQLSTATE },
  { statement: "SELECT '999999999999999999999999999999999999999'::atomic_u128 AS v", expected: 'ERROR', expectedSqlstate: DOMAIN_CHECK_SQLSTATE },
  { statement: "SELECT '0'::signed_atomic_delta AS v", expected: 'OK' },
  { statement: "SELECT '-1325'::signed_atomic_delta AS v", expected: 'OK' },
  { statement: "SELECT '-0'::signed_atomic_delta AS v", expected: 'ERROR', expectedSqlstate: DOMAIN_CHECK_SQLSTATE },
  { statement: 'SELECT 1.5::text AS t, 1.0::text AS u', expected: 'OK' },
];

async function main(): Promise<void> {
  const { PGlite } = await import('@electric-sql/pglite');
  const db = new PGlite();
  try {
    await db.exec(`BEGIN;\n${migrationSql}\nCOMMIT;`);
    const v = await db.query<{ v: string }>('SELECT version() AS v');
    const versionRow: EvidenceResult = {
      statement: 'SELECT version()',
      expected: 'OK',
      actual: 'OK',
      passed: v.rows[0] != null,
      detail: v.rows[0]?.v,
    };
    const { results, anyFailed } = await runEvidenceChecks((sql) => db.query(sql), checks);
    console.log(JSON.stringify([versionRow, ...results], null, 2));
    if (anyFailed) process.exitCode = 1;
  } finally {
    await db.close();
  }
}

main().catch((err) => {
  console.error('db-evidence failed:', err);
  process.exitCode = 1;
});