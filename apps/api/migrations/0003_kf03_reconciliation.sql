-- KF-03 local reconciliation persistence.  This is additive to the KF-02
-- foundation and keeps all event, quarantine, snapshot and health writes in
-- the worker transaction that advances the cursor.

ALTER TABLE ledger_events
  ADD COLUMN supersedes_event_key text;

CREATE TABLE ledger_quarantines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES ledger_events (id) ON DELETE CASCADE,
  movement_index integer,
  reason text NOT NULL,
  normalization_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ledger_quarantines_movement_index CHECK (movement_index IS NULL OR movement_index >= 0),
  CONSTRAINT ledger_quarantines_unique UNIQUE (event_id, movement_index, reason)
);

CREATE TABLE balance_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  binding_id uuid NOT NULL,
  network keyfolio_network NOT NULL,
  boundary text NOT NULL CHECK (boundary IN ('opening', 'closing')),
  snapshot_at timestamptz NOT NULL,
  source_execution_at timestamptz,
  provenance text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT balance_snapshots_id_network_key UNIQUE (id, network),
  CONSTRAINT balance_snapshots_fk_binding FOREIGN KEY (binding_id, network)
    REFERENCES source_bindings (id, network)
);

CREATE TABLE balance_snapshot_items (
  snapshot_id uuid NOT NULL REFERENCES balance_snapshots (id) ON DELETE CASCADE,
  network keyfolio_network NOT NULL,
  asset_id text NOT NULL,
  amount_atomic atomic_u128 NOT NULL,
  PRIMARY KEY (snapshot_id, asset_id),
  CONSTRAINT balance_snapshot_items_fk_snapshot_network FOREIGN KEY (snapshot_id, network)
    REFERENCES balance_snapshots (id, network),
  CONSTRAINT balance_snapshot_items_network CHECK (asset_id LIKE network || ':%')
);

CREATE TABLE reconciliation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  binding_id uuid NOT NULL,
  network keyfolio_network NOT NULL,
  opening_snapshot_id uuid NOT NULL REFERENCES balance_snapshots (id),
  closing_snapshot_id uuid NOT NULL REFERENCES balance_snapshots (id),
  result text NOT NULL CHECK (result IN ('BALANCED', 'MISMATCH', 'INCOMPLETE')),
  coverage_state text NOT NULL CHECK (coverage_state IN ('COMPLETE', 'PARTIAL', 'UNKNOWN')),
  mismatches jsonb NOT NULL DEFAULT '[]'::jsonb,
  normalization_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reconciliation_runs_fk_opening_network FOREIGN KEY (opening_snapshot_id, network)
    REFERENCES balance_snapshots (id, network),
  CONSTRAINT reconciliation_runs_fk_closing_network FOREIGN KEY (closing_snapshot_id, network)
    REFERENCES balance_snapshots (id, network),
  CONSTRAINT reconciliation_runs_fk_binding FOREIGN KEY (binding_id, network)
    REFERENCES source_bindings (id, network)
);

CREATE TABLE source_health_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  binding_id uuid NOT NULL,
  network keyfolio_network NOT NULL,
  observed_at timestamptz NOT NULL,
  access_state text NOT NULL CHECK (access_state IN ('READABLE', 'UNAUTHORIZED', 'DISCONNECTED', 'UNKNOWN')),
  freshness_state text NOT NULL CHECK (freshness_state IN ('FRESH', 'STALE', 'UNKNOWN')),
  coverage_state text NOT NULL CHECK (coverage_state IN ('COMPLETE', 'PARTIAL', 'UNKNOWN')),
  schema_state text NOT NULL CHECK (schema_state IN ('VALID', 'INVALID', 'UNKNOWN')),
  reconciliation_state text NOT NULL CHECK (reconciliation_state IN ('BALANCED', 'MISMATCH', 'UNKNOWN')),
  last_trade_at timestamptz,
  error_code text,
  CONSTRAINT source_health_observations_fk_binding FOREIGN KEY (binding_id, network)
    REFERENCES source_bindings (id, network)
);

CREATE INDEX balance_snapshots_binding_time_idx ON balance_snapshots (binding_id, network, snapshot_at);
CREATE INDEX source_health_binding_time_idx ON source_health_observations (binding_id, network, observed_at);
