DROP TABLE IF EXISTS source_health_observations;
DROP TABLE IF EXISTS reconciliation_runs;
DROP TABLE IF EXISTS balance_snapshot_items;
DROP TABLE IF EXISTS balance_snapshots;
DROP TABLE IF EXISTS ledger_quarantines;
ALTER TABLE ledger_events DROP COLUMN IF EXISTS supersedes_event_key;
