import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const migrationUrl = new URL('../migrations/0001_initial.sql', import.meta.url);
const migrationSql = readFileSync(fileURLToPath(migrationUrl), 'utf8');
const downSql = readFileSync(fileURLToPath(new URL('../migrations/0001_initial.down.sql', import.meta.url)), 'utf8');

const UINT_MAX = '340282366920938463463374607431768211455';
const UINT_OVERFLOW = '340282366920938463463374607431768211456';
const NINE_39 = '999999999999999999999999999999999999999'; // 39 nines: overflow
const NINE_38 = '99999999999999999999999999999999999999'; // 38 nines: in range

let db: PGlite;
let engineVersion = '';

function sqlstate(err: unknown): string {
  return (err as { code?: string }).code ?? '';
}

/** Run `sql`, expecting it to raise the given SQLSTATE; returns the actual state. */
async function expectSqlState(sql: string, expectedState: string): Promise<string> {
  try {
    await db.query(sql);
  } catch (err) {
    const actual = sqlstate(err);
    assert.equal(actual, expectedState, `expected SQLSTATE ${expectedState}, got ${actual}: ${(err as Error).message}\n\t${sql}`);
    return actual;
  }
  throw new Error(`expected SQL to fail with ${expectedState} but it succeeded: ${sql}`);
}

before(async () => {
  db = new PGlite();
  await db.exec(`BEGIN;\n${migrationSql}\nCOMMIT;`);
  const v = await db.query<{ v: string }>('SELECT version() AS v');
  engineVersion = v.rows[0]!.v;
});

test('reports the actual PostgreSQL engine version', () => {
  assert.match(engineVersion, /PostgreSQL \d+/);
});

test('atomic_u128 casts: canonical strings accepted with exact round-trip', async () => {
  const accepts: Array<[string, string]> = [
    ['zero', '0'],
    ['one', '1'],
    ['38 nines (within range)', NINE_38],
    ['u128 maximum', UINT_MAX],
  ];
  for (const [name, v] of accepts) {
    const r = await db.query<{ v: string }>(`SELECT '${v}'::atomic_u128 AS v`);
    assert.equal(r.rows[0]!.v, v, `exact round-trip for ${name}`);
  }
});

test('atomic_u128 casts reject invalid inputs with SQLSTATE 23514 (check violation)', async () => {
  const rejects: Array<[string, string]> = [
    ['text fraction 1.5', "'1.5'::atomic_u128"],
    ['text fraction 1.0', "'1.0'::atomic_u128"],
    ['leading zero 01', "'01'::atomic_u128"],
    ['double leading zero 00', "'00'::atomic_u128"],
    ['negative -1', "'-1'::atomic_u128"],
    ['plus sign +1', "'+1'::atomic_u128"],
    ['exponent 1e3', "'1e3'::atomic_u128"],
    ['leading whitespace', "' 1'::atomic_u128"],
    ['trailing whitespace', "'1 '::atomic_u128"],
    ['empty string', "''::atomic_u128"],
    ['u128 max + 1', `'${UINT_OVERFLOW}'::atomic_u128`],
    ['39 nines (overflow)', `'${NINE_39}'::atomic_u128`],
  ];
  for (const [name, expr] of rejects) {
    await expectSqlState(`SELECT ${expr} AS v`, '23514');
  }
});

test('SQL numeric literal 1.5 and text 1.5 both fail the domain with 23514', async () => {
  await expectSqlState('SELECT 1.5::atomic_u128 AS v', '23514');
  await expectSqlState("SELECT '1.5'::atomic_u128 AS v", '23514');
  await expectSqlState('SELECT 1.0::atomic_u128 AS v', '23514');
});

test('DB lexical limitations: numeric literals keep their fractional form before the domain rejects them', async () => {
  const r = await db.query<{ t: string; u: string }>('SELECT 1.5::text AS t, 1.0::text AS u');
  assert.equal(r.rows[0]!.t, '1.5');
  assert.equal(r.rows[0]!.u, '1.0');
});

test('fractional INSERTs (numeric and text) reject without touching a preexisting sentinel', async () => {
  await db.exec('CREATE TEMP TABLE _amount_sentinel (v atomic_u128)');
  await db.exec("INSERT INTO _amount_sentinel VALUES ('7'::atomic_u128)");

  const verifySentinelUnchanged = async (): Promise<void> => {
    const rows = await db.query<{ v: string }>('SELECT v FROM _amount_sentinel ORDER BY v');
    assert.deepEqual(rows.rows.map((r) => r.v), ['7'], 'sentinel row must be unchanged after a rejected insert');
  };

  await expectSqlState("INSERT INTO _amount_sentinel VALUES (1.5::atomic_u128)", '23514');
  await verifySentinelUnchanged();

  await expectSqlState("INSERT INTO _amount_sentinel VALUES ('1.5'::atomic_u128)", '23514');
  await verifySentinelUnchanged();

  // the u128 maximum round-trips exactly and leaves the sentinel untouched
  await db.exec(`INSERT INTO _amount_sentinel VALUES ('${UINT_MAX}'::atomic_u128)`);
  const stored = await db.query<{ v: string }>('SELECT v FROM _amount_sentinel');
  const values = stored.rows.map((r) => r.v).sort();
  assert.deepEqual(values, ['7', UINT_MAX].sort(), 'sentinel preserved and maximum stored with no rounding');
});

test('signed_atomic_delta rejects -0 and overflow with 23514, accepts canonical magnitudes', async () => {
  const accepts = ['0', '1', '-1', UINT_MAX, `-${UINT_MAX}`, NINE_38];
  for (const v of accepts) {
    const r = await db.query<{ v: string }>(`SELECT '${v}'::signed_atomic_delta AS v`);
    assert.equal(r.rows[0]!.v, v);
  }
  const rejects: Array<[string, string]> = [
    ['negative zero', "'-0'::signed_atomic_delta"],
    ['leading zero', "'01'::signed_atomic_delta"],
    ['plus', "'+1'::signed_atomic_delta"],
    ['fraction', "'1.5'::signed_atomic_delta"],
    ['negative fraction', "'-1.5'::signed_atomic_delta"],
    ['negative overflow', `'-${UINT_OVERFLOW}'::signed_atomic_delta`],
  ];
  for (const [, expr] of rejects) {
    await expectSqlState(`SELECT ${expr} AS v`, '23514');
  }
});

test('keyfolio_network domain rejects unknown networks with 23514', async () => {
  for (const n of ['mainnet', 'testnet']) {
    const r = await db.query<{ v: string }>(`SELECT '${n}'::keyfolio_network AS v`);
    assert.equal(r.rows[0]!.v, n);
  }
  for (const n of ['localnet', 'Mainnet', 'bsc', 'neartest']) {
    await expectSqlState(`SELECT '${n}'::keyfolio_network AS v`, '23514');
  }
});

test('composite FKs enforce network/provider consistency (SQLSTATE 23503)', async () => {
  const binding = await db.query<{ id: string }>(
    "INSERT INTO source_bindings (provider, network, source_identity_hash, source_account_id) VALUES ('fixture', 'testnet', 'h1', 'acct_1') RETURNING id::text AS id",
  );
  const b = binding.rows[0]!.id;

  // event must match binding network
  await expectSqlState(
    `INSERT INTO ledger_events (provider, network, binding_id, source_event_id, status, type, occurred_at, observed_at, normalization_version) VALUES ('fixture', 'mainnet', '${b}', 'e1', 'CONFIRMED', 'SWAP', now(), now(), 'v0')`,
    '23503',
  );
  // event must match binding provider
  await expectSqlState(
    `INSERT INTO ledger_events (provider, network, binding_id, source_event_id, status, type, occurred_at, observed_at, normalization_version) VALUES ('other', 'testnet', '${b}', 'e2', 'CONFIRMED', 'SWAP', now(), now(), 'v0')`,
    '23503',
  );
  // cursor must match binding network
  await expectSqlState(
    `INSERT INTO worker_cursors (binding_id, network, stream, cursor) VALUES ('${b}', 'mainnet', 'activity', 'c1')`,
    '23503',
  );

  // valid event, then movement with mismatched network
  const ev = await db.query<{ id: string }>(
    `INSERT INTO ledger_events (provider, network, binding_id, source_event_id, status, type, occurred_at, observed_at, normalization_version) VALUES ('fixture', 'testnet', '${b}', 'e3', 'CONFIRMED', 'SWAP', now(), now(), 'v0') RETURNING id::text AS id`,
  );
  const e = ev.rows[0]!.id;
  await expectSqlState(
    `INSERT INTO asset_movements (event_id, movement_index, network, asset_id, signed_delta, classification) VALUES ('${e}', 0, 'mainnet', 'usdc', '-1', 'external')`,
    '23503',
  );
});

test('foundation schema: identity/events/movement/cursor round-trip with constraints', async () => {
  const binding = await db.query<{ id: string }>(
    "INSERT INTO source_bindings (provider, network, source_identity_hash, source_account_id) VALUES ('fixture', 'testnet', 'roundtrip', 'acct_1') RETURNING id::text AS id",
  );
  const bindingId = binding.rows[0]!.id;

  const event = await db.query<{ id: string }>(
    `INSERT INTO ledger_events (provider, network, binding_id, source_event_id, revision, type, status, occurred_at, source_execution_at, observed_at, provenance, normalization_version)
     VALUES ('fixture', 'testnet', '${bindingId}', 'evt-1', 1, 'SWAP', 'CONFIRMED', now(), now(), now(), 'synthetic', 'v0.1.0') RETURNING id::text AS id`,
  );
  const eventId = event.rows[0]!.id;

  const movement = await db.query<{ id: string }>(
    `INSERT INTO asset_movements (event_id, movement_index, network, asset_id, signed_delta, classification)
     VALUES ('${eventId}', 0, 'testnet', 'usdc', '-1000000', 'external') RETURNING id::text AS id`,
  );
  assert.ok(movement.rows[0]!.id);

  const cursor = await db.query<{ id: string }>(
    `INSERT INTO worker_cursors (binding_id, network, stream, cursor) VALUES ('${bindingId}', 'testnet', 'activity', 'opq-1') RETURNING id::text AS id`,
  );
  assert.ok(cursor.rows[0]!.id);

  await expectSqlState(
    "INSERT INTO source_bindings (provider, network, source_identity_hash, source_account_id) VALUES ('fixture', 'testnet', 'roundtrip', 'acct_2')",
    '23505',
  );

  await expectSqlState(
    "INSERT INTO source_bindings (provider, network, source_identity_hash, source_account_id) VALUES ('fixture', 'localnet', 'h2', 'acct_3')",
    '23514',
  );
});

test('migration is reversible: up → down → up', async () => {
  const fresh = new PGlite();
  await fresh.exec(`BEGIN;\n${migrationSql}\nCOMMIT;`);
  assert.ok((await fresh.query<{ r: string | null }>("SELECT to_regclass('source_bindings') AS r")).rows[0]!.r !== null);

  await fresh.exec(`BEGIN;\n${downSql}\nCOMMIT;`);
  assert.equal((await fresh.query<{ r: string | null }>("SELECT to_regclass('source_bindings') AS r")).rows[0]!.r, null);
  assert.equal((await fresh.query<{ r: string | null }>("SELECT to_regclass('ledger_events') AS r")).rows[0]!.r, null);

  let domainGone = false;
  try {
    await fresh.query("SELECT '1'::atomic_u128 AS v");
  } catch {
    domainGone = true;
  }
  assert.equal(domainGone, true, 'atomic_u128 domain must be dropped by the down migration');

  await fresh.exec(`BEGIN;\n${migrationSql}\nCOMMIT;`);
  assert.ok((await fresh.query<{ r: string | null }>("SELECT to_regclass('source_bindings') AS r")).rows[0]!.r !== null);
  assert.equal((await fresh.query<{ v: string }>("SELECT '1'::atomic_u128 AS v")).rows[0]!.v, '1');
});