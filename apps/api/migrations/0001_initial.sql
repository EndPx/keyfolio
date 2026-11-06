-- Keyfolio KF-02a initial migration (app-owned).
-- Atomic amounts are canonical integer STRINGS stored in a TEXT domain, never
-- NUMERIC(p,0), whose input coercion can round before a CHECK sees the value.
-- Values above the u128 maximum or with fractional/negative/exponent/leading-zero
-- or whitespace forms are rejected; no value is silently rounded or truncated.

-- ---------------------------------------------------------------------------
-- 1. u128 atomic amount domain (zero is a valid balance)
-- ---------------------------------------------------------------------------
CREATE DOMAIN atomic_u128 AS TEXT
  CONSTRAINT atomic_u128_is_canonical
    CHECK (VALUE ~ '^(0|[1-9][0-9]*)$')
  CONSTRAINT atomic_u128_max_length
    CHECK (length(VALUE) <= 39)
  CONSTRAINT atomic_u128_within_range
    CHECK (
      length(VALUE) < 39
      OR VALUE <= '340282366920938463463374607431768211455' COLLATE "C"
    );

-- ---------------------------------------------------------------------------
-- 2. signed atomic ledger delta (rejects -0; magnitude bounded by u128)
-- ---------------------------------------------------------------------------
CREATE DOMAIN signed_atomic_delta AS TEXT
  CONSTRAINT signed_delta_is_canonical
    CHECK (VALUE ~ '^(0|-?[1-9][0-9]*)$')
  CONSTRAINT signed_delta_mag_length
    CHECK (length(regexp_replace(VALUE, '^-', '')) <= 39)
  CONSTRAINT signed_delta_mag_range
    CHECK (
      length(regexp_replace(VALUE, '^-', '')) < 39
      OR regexp_replace(VALUE, '^-', '') <= '340282366920938463463374607431768211455' COLLATE "C"
    );

-- ---------------------------------------------------------------------------
-- 3. known network domain (network-scoped identity)
-- ---------------------------------------------------------------------------
CREATE DOMAIN keyfolio_network AS TEXT
  CONSTRAINT keyfolio_network_is_known CHECK (VALUE IN ('mainnet', 'testnet'));

-- ---------------------------------------------------------------------------
-- 4. source_bindings: immutable, network-scoped account binding.
--    Composite unique keys let dependents enforce (binding, network[, provider])
--    equality through composite foreign keys instead of a bare UUID reference.
-- ---------------------------------------------------------------------------
CREATE TABLE source_bindings (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider             text NOT NULL,
  network              keyfolio_network NOT NULL,
  source_identity_hash text NOT NULL,
  source_account_id    text NOT NULL,
  coverage_start       timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT source_bindings_unique_identity UNIQUE (provider, network, source_identity_hash),
  CONSTRAINT source_bindings_id_network_key UNIQUE (id, network),
  CONSTRAINT source_bindings_id_network_provider_key UNIQUE (id, network, provider)
);

-- ---------------------------------------------------------------------------
-- 5. ledger_events: immutable normalized events. occurred_at is source
--    economic time; source_execution_at is the trusted execution/confirmation
--    time; observed_at is local discovery time (never an eligibility clock).
--    The composite FK ties network+provider to the binding, and the extra
--    unique key lets asset_movements enforce (event, network) equality.
-- ---------------------------------------------------------------------------
CREATE TABLE ledger_events (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider              text NOT NULL,
  network               keyfolio_network NOT NULL,
  binding_id            uuid NOT NULL,
  source_event_id       text NOT NULL,
  revision              integer NOT NULL DEFAULT 1 CHECK (revision >= 1),
  type                  text NOT NULL CHECK (type IN (
                          'DEPOSIT', 'WITHDRAWAL', 'SWAP', 'TRANSFER_IN',
                          'TRANSFER_OUT', 'REFUND', 'FEE', 'CORRECTION'
                        )),
  status                text NOT NULL CHECK (status IN (
                          'OBSERVED', 'PENDING', 'CONFIRMED', 'FAILED',
                          'REFUNDED', 'RECONCILIATION_REQUIRED'
                        )),
  occurred_at           timestamptz NOT NULL,
  source_execution_at   timestamptz,
  observed_at           timestamptz NOT NULL,
  provenance            text,
  normalization_version text NOT NULL,
  CONSTRAINT ledger_events_fk_binding
    FOREIGN KEY (binding_id, network, provider) REFERENCES source_bindings (id, network, provider),
  CONSTRAINT ledger_events_id_network_key UNIQUE (id, network),
  CONSTRAINT ledger_events_unique_revision UNIQUE (provider, network, binding_id, source_event_id, revision)
);

CREATE INDEX ledger_events_binding_occurred_idx ON ledger_events (binding_id, occurred_at, id);

-- ---------------------------------------------------------------------------
-- 6. asset_movements: signed atomic deltas per event; network must match event.
-- ---------------------------------------------------------------------------
CREATE TABLE asset_movements (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id       uuid NOT NULL,
  movement_index integer NOT NULL CHECK (movement_index >= 0),
  network        keyfolio_network NOT NULL,
  asset_id       text NOT NULL,
  signed_delta   signed_atomic_delta NOT NULL,
  classification text NOT NULL,
  CONSTRAINT asset_movements_fk_event
    FOREIGN KEY (event_id, network) REFERENCES ledger_events (id, network) ON DELETE CASCADE,
  CONSTRAINT asset_movements_unique UNIQUE (event_id, movement_index)
);

-- ---------------------------------------------------------------------------
-- 7. worker_cursors: per-binding stream cursors, committed with events; network
--    must match the binding.
-- ---------------------------------------------------------------------------
CREATE TABLE worker_cursors (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  binding_id  uuid NOT NULL,
  network     keyfolio_network NOT NULL,
  stream      text NOT NULL,
  cursor      text NOT NULL,
  lease_owner text,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT worker_cursors_fk_binding
    FOREIGN KEY (binding_id, network) REFERENCES source_bindings (id, network),
  CONSTRAINT worker_cursors_unique UNIQUE (binding_id, stream)
);

-- ---------------------------------------------------------------------------
-- Scope notes: foundation schema only; not yet wired to a live provider.
-- ---------------------------------------------------------------------------
COMMENT ON TABLE source_bindings IS 'KF-02a foundation: immutable account binding. Not yet used by a live provider adapter.';
COMMENT ON TABLE ledger_events   IS 'KF-02a foundation: immutable normalized events. occurred_at=source economic time, source_execution_at=trusted execution/confirmation, observed_at=local observation.';
COMMENT ON TABLE asset_movements IS 'KF-02a foundation: signed atomic deltas per event.';
COMMENT ON TABLE worker_cursors  IS 'KF-02a foundation: transactionally committed per-stream cursors.';