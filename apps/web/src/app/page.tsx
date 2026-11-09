import { getWebConfig } from '../config';
import { LandingClient } from '../components/LandingClient';

export default function LandingPage() {
  const cfg = getWebConfig();
  const mode = cfg.ok ? cfg.mode : 'LIVE';
  return <LandingClient mode={mode} configError={cfg.ok ? null : cfg.error} />;
}
