import type { Meta } from '@keyfolio/api-contract';
import { randomUUID } from 'node:crypto';

/** Construct the shared response metadata for a request. */
export function makeMeta(overrides?: Partial<Meta>): Meta {
  return {
    request_id: randomUUID(),
    observed_at: new Date().toISOString(),
    coverage: 'none',
    stale: false,
    ...overrides,
  };
}