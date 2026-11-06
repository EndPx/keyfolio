import type { KeyfolioMode } from '@keyfolio/domain';

export type WorkerAction =
  | { kind: 'idle_exit'; message: string }
  | { kind: 'refuse'; message: string };

/**
 * The worker has no provider ingestion in this slice. In FIXTURE mode it is an
 * idle, no-op entrypoint that exits cleanly; in TESTNET/LIVE it refuses because
 * there is no implemented source adapter — it must not fake a source or signer.
 */
export function decideWorkerAction(mode: KeyfolioMode): WorkerAction {
  if (mode !== 'FIXTURE') {
    return {
      kind: 'refuse',
      message:
        `ingestion provider is not implemented in KF-02a; refusing to fake a source or signer in ${mode} mode. ` +
        'Configure a real provider adapter (KF-03) before running the worker here.',
    };
  }
  return {
    kind: 'idle_exit',
    message: 'FIXTURE idle entrypoint: no provider/source configured; exiting cleanly (ingestion lands in KF-03).',
  };
}