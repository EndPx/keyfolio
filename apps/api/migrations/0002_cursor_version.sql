-- KF-03 persistence: cursor ownership needs a monotonic CAS version so two
-- processors on the same binding/stream cannot advance the cursor
-- inconsistently (L06). updated_at alone is not a safe version.

ALTER TABLE worker_cursors
  ADD COLUMN version bigint NOT NULL DEFAULT 0;
