import { useState } from 'react';
import { updateSettings, useSettings } from '../lib/settings';
import { reconnect, useTelemetry } from '../lib/telemetry';
import { IconLink } from './Icons';

/**
 * Shown when the app knows the bridge address but has no valid token, for
 * example the iPhone home-screen app, which does not share storage with
 * Safari. The 6-digit code is printed in the bridge window on the PC.
 */
export function needsPairing(link: string, bridgeUrl: string): boolean {
  return Boolean(bridgeUrl) && (link === 'unconfigured' || link === 'unauthorized');
}

export function PairCard({ compact = false }: { compact?: boolean }) {
  const s = useSettings();
  const t = useTelemetry();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!needsPairing(t.link, s.bridgeUrl)) return null;

  async function pair() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${s.bridgeUrl}/api/pair`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const body = (await res.json()) as { token?: string; error?: string };
      if (!res.ok || !body.token) {
        setError(body.error ?? 'Nu a mers. Încearcă din nou.');
        return;
      }
      updateSettings({ connection: 'bridge', token: body.token });
      reconnect();
    } catch {
      setError('PC-ul nu răspunde. Verifică dacă fereastra TruckSim e deschisă și că ești pe același Wi-Fi.');
    } finally {
      setBusy(false);
    }
  }

  const digits = code.replace(/\D/g, '').slice(0, 6);
  return (
    <div className="card pair-card" style={compact ? { marginBottom: 12 } : undefined}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 10 }}>
        <div className="row-icon" style={{ background: 'var(--blue)' }}><IconLink /></div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 18 }}>Împerechează cu PC-ul</div>
          <div className="muted" style={{ fontSize: 14 }}>Scrie codul de 6 cifre din fereastra TruckSim de pe PC.</div>
        </div>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); if (digits.length === 6) void pair(); }} style={{ display: 'flex', gap: 8 }}>
        <input
          className="field num" style={{ fontSize: 24, letterSpacing: '0.3em', textAlign: 'center', fontWeight: 700 }}
          inputMode="numeric" autoComplete="one-time-code" placeholder="000000" aria-label="Cod de împerechere"
          value={digits} onChange={(e) => setCode(e.target.value)}
        />
        <button className="btn primary" type="submit" disabled={busy || digits.length !== 6}>{busy ? '…' : 'Gata'}</button>
      </form>
      {error ? <p className="note" style={{ color: 'var(--orange)' }}>{error}</p> : null}
    </div>
  );
}
