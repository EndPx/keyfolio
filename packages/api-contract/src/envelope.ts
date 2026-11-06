// Wire envelope shared across every Keyfolio API response (baseline01 section 11).
// Browser-safe: no Node-only imports.

export interface Meta {
  request_id: string;
  observed_at: string;
  coverage: string;
  stale: boolean;
}

export interface ErrorBody {
  code: string;
  message: string;
  retryable: boolean;
}

export interface SuccessEnvelope<T> {
  data: T;
  meta: Meta;
  error: null;
}

export interface FailureEnvelope {
  data: null;
  meta: Meta;
  error: ErrorBody;
}

export type Envelope<T> = SuccessEnvelope<T> | FailureEnvelope;

export function success<T>(data: T, meta: Meta): SuccessEnvelope<T> {
  return { data, meta, error: null };
}

export function failure(meta: Meta, code: string, message: string, retryable = false): FailureEnvelope {
  return { data: null, meta, error: { code, message, retryable } };
}

export function isSuccessEnvelope<T>(envelope: Envelope<T>): envelope is SuccessEnvelope<T> {
  return envelope.error === null;
}