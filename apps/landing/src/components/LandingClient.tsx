'use client';

import { useEffect, useState } from 'react';
import { getLandingWalletState, type LandingMode } from './landingContract';
import { useWallet } from '../wallet/WalletContext';

export function LandingClient({ mode, configError }: { mode: LandingMode; configError: string | null }) {
  const wallet = useWallet();
  const [fixturePreview, setFixturePreview] = useState(false);
  useEffect(() => {
    document.querySelector('.landing')?.classList.add('motion-ready');
    const nodes = Array.from(document.querySelectorAll<HTMLElement>('.landing .reveal'));
    if (!('IntersectionObserver' in window)) { nodes.forEach((node) => node.classList.add('is-visible')); return; }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => { if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); } });
    }, { threshold: 0.12 });
    nodes.forEach((node) => observer.observe(node));
    return () => {
      observer.disconnect();
      document.querySelector('.landing')?.classList.remove('motion-ready');
    };
  }, []);
  const walletState = getLandingWalletState(mode, { connecting: wallet.connecting, accountId: wallet.accountId, initError: wallet.initError, fixturePreview, configError });
  const appHref = process.env.NEXT_PUBLIC_APP_URL ?? '/marketplace';
  function handleConnect() {
    if (mode === 'FIXTURE') return setFixturePreview(true);
    if (mode === 'TESTNET' && walletState.canAct) wallet.signIn();
  }

  return (
    <div className="landing" data-mode={mode}>
      <header className="landing-nav">
        <a className="landing-brand" href="#top" aria-label="Keyfolio home">
          <img src="/brand/keyfolio-symbol-v1.png" alt="" width={30} height={30} aria-hidden="true" />
          <span>Keyfolio</span>
        </a>
        <nav aria-label="Marketing">
          <a href="#how-it-works">How it works</a>
          <a href="#trust">Why Keyfolio</a>
          <a className="nav-cta" href={appHref}>Open app <span aria-hidden="true">↗</span></a>
        </nav>
      </header>
      <section id="top" className="landing-hero" aria-labelledby="landing-title">
        <div className="hero-copy reveal reveal-one">
          <p className="landing-kicker"><span className="kicker-dot" aria-hidden="true" /> Account-following, with proof</p>
          <h1 id="landing-title">See the signal.<br /><span>Keep the keys.</span></h1>
          <p className="hero-lede">Keyfolio turns consented trading activity into a clear, comparable record — so followers can understand coverage, tracked performance, and access before they commit.</p>
          <div className="hero-actions"><button className="landing-btn landing-btn-primary" type="button" onClick={handleConnect} disabled={!walletState.canAct} aria-describedby="wallet-state">{walletState.label}<span aria-hidden="true">↗</span></button><a className="landing-btn landing-btn-quiet" href={appHref}>Explore traders <span aria-hidden="true">→</span></a></div>
          <p id="wallet-state" className="wallet-state" role="status">{walletState.message}</p>
          {mode === 'TESTNET' && wallet.accountId ? <button className="wallet-signout" type="button" onClick={() => void wallet.signOut()}>Sign out</button> : null}
        </div>
        <div className="hero-visual reveal reveal-two" aria-label="Illustrative tracked performance card"><div className="orb-aura" aria-hidden="true" /><div className="orb-core" aria-hidden="true"><span>K</span></div><svg className="equity-ribbon" viewBox="0 0 720 360" role="img" aria-label="Illustrative equity ribbon rising over a tracked window"><defs><linearGradient id="ribbon-fill" x1="0" x2="1"><stop offset="0" stopColor="#4a7dff" stopOpacity="0" /><stop offset=".5" stopColor="#4a7dff" stopOpacity=".28" /><stop offset="1" stopColor="#9cb7ff" stopOpacity=".08" /></linearGradient></defs><path d="M20 286 C130 258 130 220 220 240 S320 268 390 184 S500 108 700 54 L700 360 L20 360Z" fill="url(#ribbon-fill)" /><path d="M20 286 C130 258 130 220 220 240 S320 268 390 184 S500 108 700 54" fill="none" stroke="#8aa9ff" strokeWidth="2.5" strokeLinecap="round" /><path d="M20 304 C120 280 160 266 232 278 S330 290 404 222 S520 148 700 102" fill="none" stroke="#fff" strokeOpacity=".18" strokeWidth="1" strokeDasharray="5 9" /></svg><article className="tracked-card"><div className="tracked-card-head"><div><p className="eyebrow">Illustrative sample</p><h2>Tracked performance</h2></div><span className="card-menu" aria-hidden="true">•••</span></div><div className="tracked-main"><div><span className="tracked-value">+18.42%</span><span className="tracked-period">30-day TWR · complete window</span></div><span className="tracked-up">↗</span></div><div className="mini-chart" aria-hidden="true"><span className="mini-line" /></div><dl className="tracked-stats"><div><dt>Coverage</dt><dd>99.8%</dd></div><div><dt>Settled swaps</dt><dd>142</dd></div><div><dt>Max drawdown</dt><dd className="pnl-down">−4.10%</dd></div></dl><p className="card-foot">Computed by Keyfolio from consented account observations · 07 Nov 2026 UTC</p></article><span className="visual-label label-top">SOURCE HEALTH <b>●</b></span><span className="visual-label label-bottom">PERIOD LOCKED · 30D</span></div>
      </section>
      <section id="trust" className="landing-section intro-section reveal reveal-three" aria-labelledby="measure-title"><div className="section-heading"><p className="landing-kicker">01 · The record behind the number</p><h2 id="measure-title">Performance is only useful<br />when its context is visible.</h2></div><div className="measure-grid"><article><span className="measure-index">01</span><h3>Coverage</h3><p>See the tracked window, gaps, and whether a period is complete before comparing returns.</p></article><article><span className="measure-index">02</span><h3>Source health</h3><p>Separate readable, stale, disconnected, and consent-withdrawn states from trading inactivity.</p></article><article><span className="measure-index">03</span><h3>Tracked performance</h3><p>Compare period-labeled return, PnL, drawdown, and settled swaps computed from source data.</p></article></div></section>
      <section id="how-it-works" className="landing-section access-section reveal reveal-four" aria-labelledby="access-title"><div className="section-heading"><p className="landing-kicker">02 · A clearer path to access</p><h2 id="access-title">Permission follows<br />the decision.</h2></div><div className="access-flow"><div className="flow-step"><span>01</span><strong>Choose a trader</strong><p>Start with a strategy and identity you can inspect.</p></div><div className="flow-connector" aria-hidden="true">→</div><div className="flow-step"><span>02</span><strong>Compare coverage</strong><p>Read tracked windows, source health, and performance together.</p></div><div className="flow-connector" aria-hidden="true">→</div><div className="flow-step"><span>03</span><strong>Buy the transferable NFT key</strong><p>Your access right is recorded in a wallet-owned key.</p></div><div className="flow-connector" aria-hidden="true">→</div><div className="flow-step"><span>04</span><strong>Unlock private read / API</strong><p>Entitlement gates the detail and API scopes you can use.</p></div><div className="flow-connector" aria-hidden="true">→</div><div className="flow-step"><span>05</span><strong>Assisted copy, when eligible</strong><p>Only trusted source time, entitlement, and your signature allow it.</p></div></div></section>
      <section className="landing-cta reveal reveal-five" aria-labelledby="cta-title"><div><p className="landing-kicker">03 · Start with the surface</p><h2 id="cta-title">Make the next trade<br />a more informed one.</h2></div><div className="cta-actions"><a className="landing-btn landing-btn-primary" href={appHref}>Browse the marketplace <span aria-hidden="true">→</span></a><p>Illustrative interface only. Metrics shown here are sample data, not live trader performance.</p></div></section><footer className="landing-footer"><span>Keyfolio · Account-following with proof</span><span>Tracked performance · source health · consent</span></footer>
    </div>
  );
}


