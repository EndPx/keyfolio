'use client';

import { useEffect, useRef, useState } from 'react';
import { getLandingWalletState, type LandingMode } from './landingContract';
import { useWallet } from '../wallet/WalletContext';

const steps = [
  ['01', 'Choose a trader', 'Start with a public profile and the account coverage it carries.'],
  ['02', 'Compare coverage', 'See the tracked window and context before you decide.'],
  ['03', 'Buy access key', 'A wallet-owned key opens the relationship you chose.'],
  ['04', 'Unlock private/API', 'Your entitlement opens private views and API access.'],
  ['05', 'Copy when eligible', 'Assisted copy appears only after a fresh signed action.'],
] as const;

const artifactStates = [
  ['Choose a trader', 'A public profile is ready to explore.'],
  ['Compare coverage', 'The tracked window is in view.'],
  ['Buy access key', 'Your access key is ready to connect.'],
  ['Unlock private/API', 'Private views follow your entitlement.'],
  ['Copy when eligible', 'A fresh signed action keeps the decision yours.'],
] as const;

export function LandingClient({ mode, configError }: { mode: LandingMode; configError: string | null }) {
  const wallet = useWallet();
  const [fixturePreview, setFixturePreview] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const stageRef = useRef<HTMLElement>(null);
  const walletState = getLandingWalletState(mode, { connecting: wallet.connecting, accountId: wallet.accountId, initError: wallet.initError, fixturePreview, configError });
  const appHref = process.env.NEXT_PUBLIC_APP_URL ?? '/marketplace';

  useEffect(() => {
    const root = document.querySelector('.landing');
    root?.classList.add('motion-ready');
    const observed = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
      if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); }
    }), { threshold: 0.15 });
    observed.forEach((node) => observer.observe(node));
    return () => { observer.disconnect(); root?.classList.remove('motion-ready'); };
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const rect = stage.getBoundingClientRect();
        const progress = Math.max(0, Math.min(0.999, (window.innerHeight * 0.68 - rect.top) / Math.max(rect.height, 1)));
        setActiveStep(Math.min(4, Math.floor(progress * 5)));
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
    return () => { if (frame) cancelAnimationFrame(frame); window.removeEventListener('scroll', onScroll); };
  }, []);

  function handleConnect() {
    if (mode === 'FIXTURE') return setFixturePreview(true);
    if (mode === 'TESTNET' && walletState.canAct) wallet.signIn();
  }

  const currentArtifact = artifactStates[activeStep];

  return <div className="landing" data-mode={mode} data-step={activeStep}>
    <header className="landing-nav"><a className="landing-brand" href="#top" aria-label="Keyfolio home"><img src="/brand/keyfolio-symbol-v1.png" alt="" width={30} height={30} /><span>Keyfolio</span></a><nav aria-label="Marketing"><a href="#proof">Proof</a><a href="#process">Process</a><a className="nav-cta" href={appHref}>Open app <span aria-hidden="true">→</span></a></nav></header>
    <main>
      <section id="top" className="landing-hero" aria-labelledby="landing-title" data-reveal><div className="hero-copy"><p className="landing-kicker"><span className="kicker-dot" /> Account-following with proof</p><h1 id="landing-title">Follow the account.<br /><span>Keep the decision yours.</span></h1><p className="hero-lede">Compare a trader's tracked account, then unlock the access you choose. Copy stays in your hands.</p><div className="hero-actions"><a className="landing-btn landing-btn-primary" href={appHref}>Browse traders <span aria-hidden="true">→</span></a><button className="landing-btn landing-btn-quiet" type="button" onClick={handleConnect} disabled={!walletState.canAct}>{mode === 'FIXTURE' ? (fixturePreview ? 'Demo opened' : 'Open the demo') : walletState.label}<span aria-hidden="true">→</span></button></div><p className="wallet-state" role="status">{mode === 'FIXTURE' ? (fixturePreview ? 'Demo mode is open.' : 'Demo mode is simulated.') : walletState.message}</p><div className="hero-scenario" aria-label="Keyfolio decision path">{steps.map(([number, title], index) => <span key={number} className={index === activeStep ? 'is-active' : ''}><b>{title}</b><i aria-hidden="true">→</i></span>)}</div></div><div className="hero-stage" aria-label="Keyfolio access key and tracked account relationship"><div className="stage-grid" aria-hidden="true" /><div className="stage-orbit" aria-hidden="true" /><div className="stage-header"><span>KEYFOLIO ACCESS</span><span>YOUR DECISION</span></div><img className="hero-art" src="/hero-keyfolio.png" alt="Keyfolio access key connecting trader profiles and tracked market paths" width="1672" height="941" fetchPriority="high" /><article className="proof-artifact"><p className="eyebrow">{currentArtifact[0]}</p><h2>Trader account <span aria-hidden="true">↔</span> access key</h2><div className="artifact-state"><strong>{currentArtifact[1]}</strong><span>Keyfolio keeps the next step clear</span></div></article><span className="stage-tag tag-one">TRACKED ACCOUNT</span><span className="stage-tag tag-two">ACCESS PATH</span></div></section>
      <section ref={stageRef} id="process" className="process-section" aria-labelledby="process-title" data-reveal><div className="section-heading"><p className="landing-kicker">01 / The visible progression</p><h2 id="process-title">From a trader choice<br /><span>to a signed decision.</span></h2><p>Move through five clear steps. The artwork changes with the decision so the path stays visible.</p></div><div className="process-layout"><div className="process-rail" aria-hidden="true"><span className="rail-progress" style={{ height: `${(activeStep + 1) * 20}%` }} /></div><div className="process-steps">{steps.map(([number, title, body], index) => <article key={number} className={`process-step ${index === activeStep ? 'is-active' : ''}`}><span className="step-number">{number}</span><div><h3>{title}</h3><p>{body}</p></div></article>)}</div></div></section>
      <section id="proof" className="proof-section" aria-labelledby="proof-title" data-reveal><div className="section-heading"><p className="landing-kicker">02 / Context before action</p><h2 id="proof-title">Every number carries<br /><span>its context.</span></h2></div><div className="proof-grid"><article><span>COVERAGE</span><h3>Window, gaps, completeness</h3><p>See the tracked period and missing data before comparing return.</p></article><article><span>ACCOUNT HEALTH</span><h3>Readable, stale, withdrawn</h3><p>An idle account can be healthy when observations still succeed.</p></article><article><span>PERFORMANCE</span><h3>Period return, PnL, drawdown</h3><p>Metrics stay connected to their source observations and time.</p></article></div></section>
      <section className="landing-cta" aria-labelledby="cta-title" data-reveal><div><p className="landing-kicker">03 / Start with the surface</p><h2 id="cta-title">Make the next trade<br /><span>a more informed one.</span></h2></div><div className="cta-actions"><a className="landing-btn landing-btn-primary" href={appHref}>Open the marketplace <span aria-hidden="true">→</span></a><p>Private views and assisted copy appear when access and fresh source time allow them.</p></div></section>
    </main><footer className="landing-footer"><span>Keyfolio / account-following with proof</span><span>Consent / observations / access / eligibility</span></footer>
  </div>;
}
