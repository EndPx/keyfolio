-- KF-04 local public performance projection. Values are allowlisted aggregate
-- fields only; no balances, positions, activity ids, raw payloads or secrets.
CREATE TABLE performance_snapshots (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trader_id          text NOT NULL,
  window_start       timestamptz NOT NULL,
  window_end         timestamptz NOT NULL,
  pnl_usd            text,
  return_bps         text,
  drawdown_bps       text,
  coverage_start     timestamptz,
  coverage_end       timestamptz,
  coverage_state     text NOT NULL CHECK (coverage_state IN ('COMPLETE', 'PARTIAL', 'UNKNOWN')),
  snapshot_state     text NOT NULL CHECK (snapshot_state IN ('COMPLETE', 'PARTIAL', 'STALE', 'UNAVAILABLE')),
  stale              boolean NOT NULL,
  calculation_version text NOT NULL,
  price_provenance   text,
  ledger_watermark   text NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT performance_snapshots_window_order CHECK (window_end > window_start),
  CONSTRAINT performance_snapshots_unique_projection UNIQUE (trader_id, window_start, window_end, calculation_version)
);
CREATE INDEX performance_snapshots_trader_window_idx ON performance_snapshots (trader_id, window_end DESC);
COMMENT ON TABLE performance_snapshots IS 'KF-04 public aggregate projection; private account payloads are intentionally excluded.';
