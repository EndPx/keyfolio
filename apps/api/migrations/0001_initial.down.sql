-- Reversible down migration for 0001_initial.sql.
-- Run inside a transaction: psql -1 -v ON_ERROR_STOP=1 -f 0001_initial.down.sql

DROP TABLE IF EXISTS worker_cursors;
DROP TABLE IF EXISTS asset_movements;
DROP TABLE IF EXISTS ledger_events;
DROP TABLE IF EXISTS source_bindings;

DROP DOMAIN IF EXISTS keyfolio_network;
DROP DOMAIN IF EXISTS signed_atomic_delta;
DROP DOMAIN IF EXISTS atomic_u128;