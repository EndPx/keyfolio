# KF-00 — DeepSeek Executor Readiness Proof (worker report)

## Runtime / model identity (substantiated)
- Executor model: `deepseek-v4.1-flash-1017-v2` (DeepSeek Flash), running under **DeepSeek Harness**.
- Provider route: **GATER**, host `api.gater.ai.id` (per KF-D008 / dispatch; no key, token or credential value was read or printed).
- Transport: **Orca** — Orca runtime environment variables present (`ORCA_*`), installed CLI version `1.4.250`. Machine-specific executable path redacted by Codex before publication.
- Task code made no calls to Confidential Intents or financial providers; the Harness model itself runs through the configured GATER route. No financial calls, installs, funds, publishing or deployments were performed. This clarification was added by Codex to distinguish model inference from task API probes.
- No config file or environment value containing secrets was opened. Environment inspection was name-only (`Get-ChildItem Env:` filtered, values hidden).

## Files changed
- `docs/evidence/KF-00/deepseek-result.json` (created)
- `docs/evidence/KF-00/deepseek-worker-report.md` (created)
- No other files edited. Fixture, decisions, status, source configs and manifests untouched. No commit or push.

## Exact commands and exit codes
1. `Get-FileHash -Algorithm SHA256 -LiteralPath 'docs/evidence/KF-00/fixture.json'` — exit `0`.
2. Deterministic compute (PowerShell, inline — no script file written):
   - deduplicate exact repeated revisions (`id|revision|value`);
   - keep highest revision per id;
   - sort retained records by id ascending;
   - sum latest values with `System.Numerics.BigInteger` exact integer arithmetic.
   Exit `0`.
3. `orca --version` — exit `0`, output `1.4.250`.

## Fixture hash
- SHA-256 (uppercase): `9D0F3C5C34F256E84BA42EA6640DDDBA6C43C142A4E43B5CFC5E550423B06837`
- SHA-256 (lowercase): `9d0f3c5c34f256e84ba42ea6640dddba6c43c142a4e43b5cfc5e550423b06837`
- Fixture file length: `366` bytes, LF line endings (11 LF, 0 CRLF).

## Deterministic result
- duplicate_count: `1` (exact repeat of `beta` revision `1` value `"11"` removed)
- retained_count: `3`
- total: `43` (13 + 11 + 19)
- retained_records (sorted by id):
  - `alpha` revision `2` value `"13"`
  - `beta`  revision `1` value `"11"`
  - `gamma` revision `1` value `"19"`

## Blockers and limits
- None. Model route matches the required GATER / DeepSeek Flash config; result is deterministic and derived from reading the fixture file.
- Evidence is local read/compute/write only, as authorized.
