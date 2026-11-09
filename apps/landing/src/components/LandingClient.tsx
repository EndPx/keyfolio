'use client';

import { useEffect, useRef, useState } from 'react';
import { getLandingWalletState, type LandingMode } from './landingContract';
import { useWallet } from '../wallet/WalletContext';

const scenes = [
  ['01', 'Choose a trader', 'Start with a public profile and the account path it carries.'],
  ['02', 'Compare coverage', 'Read the tracked window before the relationship becomes yours.'],
  ['03', 'Buy access key', 'A wallet-owned key connects you to the trader you chose.'],
  ['04', 'Unlock private/API', 'Your entitlement opens private views and API access.'],
  ['05', 'Copy when eligible', 'Assisted copy appears only after a fresh signed action.'],
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
    }), { threshold: 0.12 });
    observed.forEach((node) => observer.observe(node));
    return () => { observer.disconnect(); root?.classList.remove('motion-ready'); };
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const rect = stage.getBoundingClientRect();
        const focus = window.innerHeight * 0.5;
        const progress = Math.max(0, Math.min(0.999, (focus - rect.top) / Math.max(rect.height, 1)));
        setActiveStep(Math.min(4, Math.floor(progress * 5)));
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => { if (frame) cancelAnimationFrame(frame); window.removeEventListener('scroll', onScroll); };
  }, []);

  function handleConnect() {
    if (mode === 'FIXTURE') return setFixturePreview(true);
    if (mode === 'TESTNET' && walletState.canAct) wallet.signIn();
  }

  const current = scenes[activeStep];

  return <div className="landing" data-mode={mode} data-step={activeStep}>
    <header className="landing-nav"><a className="landing-brand" href="#top" aria-label="Keyfolio home"><img src="/brand/keyfolio-symbol-v1.png" alt="" width="30" height="30" /><span>Keyfolio</span></a><nav aria-label="Marketing"><a href="#journey">Journey</a><a href="#context">Context</a><a className="nav-cta" href={appHref}>Open app <span aria-hidden="true">→</span></a></nav></header>
    <main>
      <section id="top" className="landing-hero" aria-labelledby="landing-title" data-reveal>
        <div className="hero-copy"><p className="landing-kicker">A clearer relationship to another account</p><h1 id="landing-title">Follow the account.<br /><span>Keep the decision yours.</span></h1><p className="hero-lede">Compare a trader's tracked account, then unlock the access you choose. Copy stays in your hands.</p><div className="hero-actions"><a className="landing-btn landing-btn-primary" href={appHref}>Browse traders <span aria-hidden="true">→</span></a><button className="landing-btn landing-btn-quiet" type="button" onClick={handleConnect} disabled={!walletState.canAct}>{mode === 'FIXTURE' ? (fixturePreview ? 'Demo opened' : 'Open the demo') : walletState.label}<span aria-hidden="true">→</span></button></div><p className="sr-only" role="status" aria-live="polite">{walletState.message}</p></div>
        <div className="hero-stage" aria-label="Trader account, tracked path, and access key relationship"><div className="stage-grid" aria-hidden="true" /><div className="stage-orbit" aria-hidden="true" /><img className="hero-art" src="/hero-keyfolio.png" alt="Keyfolio access key connecting a trader account to a tracked path" width="1672" height="941" /><div className="relationship-map" aria-hidden="true"><span className="map-node map-trader">TRADER<br /><b>account</b></span><span className="map-path" /><span className="map-node map-key">ACCESS<br /><b>key</b></span></div><article className="proof-artifact"><p className="eyebrow">{current[0]} / {current[1]}</p><h2>Trader account <span aria-hidden="true">↔</span> access key</h2><div className="artifact-state"><strong>{current[2]}</strong><span>Keyfolio keeps the next step clear</span></div></article></div>
      </section>

      <section ref={stageRef} id="journey" className="journey-section" aria-labelledby="journey-title">
        <div className="journey-sticky"><div className="journey-intro"><p className="landing-kicker">One relationship, five beats</p><h2 id="journey-title">The path stays visible<br /><span>as the access changes.</span></h2><p>Scroll through the decision. One scene owns the viewport at a time.</p><div className="scene-index" aria-label="Current journey step"><span>0{activeStep + 1}</span><i /> <span>05</span></div></div><div className="scene-stage"><div className="scene-glow" /><div className="scene-orbit" /><div className="scene-connection"><span className="scene-dot scene-dot-left" /><span className="scene-line" /><span className="scene-dot scene-dot-right" /></div><img className="scene-art" src="/hero-keyfolio.png" alt="" aria-hidden="true" /><div className="scene-card"><p className="eyebrow">{current[0]}</p><h3>{current[1]}</h3><p>{current[2]}</p></div><div className="scene-word" aria-hidden="true">{activeStep < 2 ? 'TRACE' : activeStep === 2 ? 'KEY' : activeStep === 3 ? 'PRIVATE' : 'ELIGIBLE'}</div></div></div>
        <div className="scene-scroll" aria-hidden="true">{scenes.map(([number, title]) => <div className="scene-beat" key={number} data-scene={number}><span>{number}</span><span>{title}</span></div>)}</div>
      </section>

      <section id="context" className="context-section" aria-labelledby="context-title" data-reveal><div className="context-copy"><p className="landing-kicker">Context before action</p><h2 id="context-title">Every number carries<br /><span>its context.</span></h2><p>Coverage, account health, and performance stay connected to source observations and time.</p></div><div className="context-notes"><article><span>01</span><h3>Coverage</h3><p>Tracked window and gaps stay visible.</p></article><article><span>02</span><h3>Account health</h3><p>A readable idle account can stay healthy.</p></article><article><span>03</span><h3>Performance</h3><p>Return and PnL keep their source context.</p></article></div></section>
      <section className="landing-cta" aria-labelledby="cta-title" data-reveal><div><p className="landing-kicker">Start with the surface</p><h2 id="cta-title">Make the next trade<br /><span>a more informed one.</span></h2></div><div className="cta-actions"><a className="landing-btn landing-btn-primary" href={appHref}>Browse traders <span aria-hidden="true">→</span></a><p>Private views and assisted copy appear when access and fresh source time allow them.</p></div></section>
    </main><footer className="landing-footer"><span>Keyfolio / account-following with proof</span><span>Consent / observations / access / eligibility</span></footer>
  </div>;
}
