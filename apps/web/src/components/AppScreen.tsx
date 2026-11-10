'use client';

import type { ReactNode } from 'react';
import { useWallet } from '../wallet/WalletContext';

export type ScreenMode = 'FIXTURE' | 'TESTNET' | 'LIVE';

export function ScreenHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <header className="screen-header"><div><p className="eyebrow">{eyebrow}</p><h1 id="page-title" className="page-title">{title}</h1><p className="screen-description">{description}</p></div>{action}</header>;
}

export function ModePanel({ mode, fixture, testnet, live }: { mode: ScreenMode; fixture: ReactNode; testnet: ReactNode; live?: ReactNode }) {
  if (mode === 'FIXTURE') return <>{fixture}</>;
  if (mode === 'TESTNET') return <>{testnet}</>;
  return <div className="panel mode-panel mode-blocked" role="status"><span className="state-icon" aria-hidden="true">!</span><div><h2 className="panel-title">Live access is unavailable</h2><p className="terms-text">{live ?? 'LIVE mode is fail-closed. No fixture data or private account data is shown until the authorized source is connected.'}</p></div></div>;
}

export function WalletState({ copy, detail = 'Connect your NEAR wallet to continue.' }: { copy: string; detail?: string }) {
  const { accountId, connecting, initError, signIn } = useWallet();
  if (connecting) return <div className="state-row"><span className="state-dot state-dot-warn" aria-hidden="true" /><div><strong>Connecting wallet service</strong><p>{detail}</p></div></div>;
  if (initError) return <div className="state-row"><span className="state-dot state-dot-block" aria-hidden="true" /><div><strong>Wallet service unavailable</strong><p>{initError}</p></div></div>;
  if (!accountId) return <div className="connect-card"><div><p className="eyebrow">Wallet required</p><h2 className="panel-title">{copy}</h2><p className="terms-text">{detail} Keyfolio never sees your keys or signs on your behalf.</p></div><button type="button" className="btn btn-primary" onClick={signIn}>Connect wallet</button></div>;
  return <div className="state-row state-row-ok"><span className="state-dot state-dot-ok" aria-hidden="true" /><div><strong>Wallet connected</strong><p className="mono-value">{accountId}</p></div><span className="badge badge-ok">Owner check pending</span></div>;
}

export function FixtureTag({ children = 'FIXTURE · illustrative sample' }: { children?: ReactNode }) { return <span className="fixture-tag">{children}</span>; }
