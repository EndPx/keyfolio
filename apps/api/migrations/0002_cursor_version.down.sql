-- Reversible down migration for 0002_cursor_version.sql.

ALTER TABLE worker_cursors
  DROP COLUMN version;
