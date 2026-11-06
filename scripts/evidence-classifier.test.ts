import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  DOMAIN_CHECK_SQLSTATE,
  classifyEvidenceResult,
  runEvidenceChecks,
  type EvidenceCheck,
} from './evidence-classifier.js';

test('classifyEvidenceResult sets actual and passed independently of expected', () => {
  const ok = classifyEvidenceResult({ statement: "SELECT '1'::atomic_u128 AS v", expected: 'OK' }, 'OK');
  assert.equal(ok.actual, 'OK');
  assert.equal(ok.expected, 'OK');
  assert.equal(ok.passed, true);

  const reject = classifyEvidenceResult(
    { statement: "SELECT '1.5'::atomic_u128 AS v", expected: 'ERROR', expectedSqlstate: DOMAIN_CHECK_SQLSTATE },
    'ERROR',
    DOMAIN_CHECK_SQLSTATE,
    'check violated',
  );
  assert.equal(reject.actual, 'ERROR');
  assert.equal(reject.expected, 'ERROR');
  assert.equal(reject.passed, true);

  // actual != expected must never pass
  assert.equal(classifyEvidenceResult({ statement: 'x', expected: 'ERROR' }, 'OK').passed, false);
  assert.equal(classifyEvidenceResult({ statement: 'x', expected: 'OK' }, 'ERROR', '23514').passed, false);
  // ERROR with the wrong SQLSTATE must not pass
  assert.equal(
    classifyEvidenceResult({ statement: 'x', expected: 'ERROR', expectedSqlstate: '23514' }, 'ERROR', '23503').passed,
    false,
  );
});

test('an expected-ERROR check that unexpectedly succeeds fails (no fabricated evidence)', async () => {
  const checks: EvidenceCheck[] = [
    { statement: "SELECT '1.5'::atomic_u128 AS v", expected: 'ERROR', expectedSqlstate: DOMAIN_CHECK_SQLSTATE },
  ];
  const { results, anyFailed } = await runEvidenceChecks(async () => undefined, checks);
  assert.equal(results[0].actual, 'OK');
  assert.equal(results[0].passed, false, 'an ERROR-expected row that succeeded must fail');
  assert.equal(anyFailed, true);
});

test('an expected-OK check that throws fails (no fabricated evidence)', async () => {
  const checks: EvidenceCheck[] = [
    { statement: "SELECT '0'::atomic_u128 AS v", expected: 'OK' },
  ];
  const { results, anyFailed } = await runEvidenceChecks(async () => {
    const err = new Error('boom') as Error & { code?: string };
    err.code = '23514';
    throw err;
  }, checks);
  assert.equal(results[0].actual, 'ERROR');
  assert.equal(results[0].passed, false, 'an OK-expected row that threw must fail');
  assert.equal(anyFailed, true);
});

test('an expected-ERROR check throwing an unexpected SQLSTATE fails', async () => {
  const checks: EvidenceCheck[] = [
    { statement: "SELECT '1.5'::atomic_u128 AS v", expected: 'ERROR', expectedSqlstate: DOMAIN_CHECK_SQLSTATE },
  ];
  const { results, anyFailed } = await runEvidenceChecks(async () => {
    const err = new Error('foreign key violation') as Error & { code?: string };
    err.code = '23503';
    throw err;
  }, checks);
  assert.equal(results[0].sqlstate, '23503');
  assert.equal(results[0].passed, false, 'an unexpected SQLSTATE must fail');
  assert.equal(anyFailed, true);
});