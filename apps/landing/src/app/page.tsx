import { LandingClient } from '../components/LandingClient';
import { getLandingConfig } from '../config';

export default function LandingPage() {
  const cfg = getLandingConfig();
  return <LandingClient mode={cfg.ok ? cfg.mode : 'LIVE'} configError={cfg.ok ? null : cfg.error} />;
}
