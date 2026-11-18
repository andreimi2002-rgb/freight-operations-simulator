import { useEffect, useState } from 'react';
import { IconCheck, IconInfo, IconWarn } from '../components/Icons';
import { Segmented, Switch } from '../components/ui';
import { updateSettings, useSettings, type Theme, type UnitPref } from '../lib/settings';
import { bridgeHttp, reconnect, useTelemetry } from '../lib/telemetry';
import { AiSettings } from './AiSettings';
import { PairCard } from '../components/PairCard';

interface Recording { name: string; bytes: number; modified: number }

export function SettingsView() {
  const s = useSettings();
  const t = useTelemetry();
  const [url, setUrl] = useState(s.bridgeUrl);
  const [token, setToken] = useState(s.token);
  const [test, setTest] = useState<{ ok: boolean; text: string } | null>(null);
  const [recordings, setRecordings] = useState<Recording[]>([]);

  useEffect(() => {
    if (t.link !== 'connected') return;
    bridgeHttp('/api/recordings')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { recordings: Recording[] } | null) => d && setRecordings(d.recordings))
      .catch(() => undefined);
  }, [t.link]);

  async function save() {
    const clean = url.trim().replace(/\/$/, '');
    setTest(null);
    try {
      const res = await fetch(`${clean}/api/health`);
      const body = (await res.json()) as { app?: string; version?: string };
      if (body.app !== 'trucksim-bridge') throw new Error('not a bridge');
      setTest({ ok: true, text: `Bridge ${body.version} găsit.` });
    } catch {
      setTest({
        ok: false,
        text: location.protocol === 'https:' && clean.startsWith('http:')
          ? 'Pagina e HTTPS, deci bridge-ul trebuie să fie tot HTTPS (Tailscale Serve).'
          : 'Bridge-ul nu răspunde la adresa asta. Verifică dacă rulează și că ești în aceeași rețea.',
      });
    }
    updateSettings({ bridgeUrl: clean, token: token.trim(), connection: 'bridge' });
    reconnect();
  }

  async function setMode(mode: 'live' | 'demo' | 'replay', file?: string) {
    await bridgeHttp('/api/mode', { method: 'POST', body: JSON.stringify({ mode, file }) });
  }

  return (
    <div className="page"><div className="page-inner" style={{ maxWidth: 720 }}>
      <h1 className="large-title">Setări</h1>
      <p className="page-sub">Totul se salvează doar pe acest dispozitiv.</p>

      <h2 className="section-title">Sursa datelor</h2>
      <Segmented
        label="Sursa datelor" value={s.connection}
        onChange={(v) => updateSettings({ connection: v })}
        options={[['bridge', 'PC (bridge)'], ['demo', 'Demo în browser']]}
      />
      {s.connection === 'demo' ? (
        <p className="note">Modul demo simulează cursa ETS2 Brașov → Ruse. Toate valorile sunt inventate și marcate DEMO.</p>
      ) : null}

      {s.connection === 'bridge' ? (
        <>
          <h2 className="section-title">Conexiune la PC</h2>
          <PairCard compact />
          <div className="list">
            <div className="row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
              <label className="muted" htmlFor="bridge-url" style={{ fontSize: 13 }}>Adresa bridge-ului</label>
              <input id="bridge-url" className="field" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://pc-ul-tau.tail1234.ts.net" inputMode="url" autoCapitalize="off" autoCorrect="off" />
              <label className="muted" htmlFor="bridge-token" style={{ fontSize: 13 }}>Token (afișat de bridge la pornire)</label>
              <input id="bridge-token" className="field mono" value={token} onChange={(e) => setToken(e.target.value)} type="password" autoCapitalize="off" autoCorrect="off" />
              <button className="btn primary" onClick={() => void save()} disabled={!url.trim() || !token.trim()}>Conectează</button>
            </div>
          </div>
          <div className="list" style={{ marginTop: 12 }}>
            <div className="row">
              <div className="grow">Stare</div>
              <div className="value">{LINK[t.link]}</div>
            </div>
            {t.status ? (
              <>
                <div className="row"><div className="grow">Mod bridge</div><div className="value">{t.status.mode}{t.status.replayFile ? ` · ${t.status.replayFile}` : ''}</div></div>
                <div className="row"><div className="grow">Plugin telemetrie</div><div className="value">{t.status.pluginDetected ? 'detectat' : 'negăsit (jocul e oprit?)'}</div></div>
                <div className="row"><div className="grow">Înregistrare</div><div className="value truncate">{t.status.recording ?? 'nu'}</div></div>
                <div className="row"><div className="grow">Copilot</div><div className="value">{t.status.ai.provider === 'local' ? 'reguli locale' : (t.status.ai.model ?? t.status.ai.provider)}</div></div>
              </>
            ) : null}
          </div>
          {test ? (
            <div className={`callout ${test.ok ? 'info' : ''}`} style={{ marginTop: 12 }}>
              {test.ok ? <IconCheck /> : <IconWarn />}<div>{test.text}</div>
            </div>
          ) : null}
          {t.linkError ? <p className="note" style={{ color: 'var(--orange)' }}>{t.linkError}</p> : null}

          {t.link === 'connected' ? (
            <>
              <h2 className="section-title">Mod bridge</h2>
              <div className="list">
                <button className="row button" onClick={() => void setMode('live')}><span className="grow">Live (jocul)</span>{t.status?.mode === 'live' ? <IconCheck style={{ width: 20, color: 'var(--blue)' }} /> : null}</button>
                <button className="row button" onClick={() => void setMode('demo')}><span className="grow">Demo pe bridge</span>{t.status?.mode === 'demo' ? <IconCheck style={{ width: 20, color: 'var(--blue)' }} /> : null}</button>
                {recordings.slice(0, 8).map((r) => (
                  <button key={r.name} className="row button" onClick={() => void setMode('replay', r.name)}>
                    <div className="grow"><div className="title truncate" style={{ fontSize: 16 }}>Replay · {r.name}</div><div className="subtitle">{(r.bytes / 1024).toFixed(0)} KB</div></div>
                    {t.status?.replayFile === r.name ? <IconCheck style={{ width: 20, color: 'var(--blue)' }} /> : null}
                  </button>
                ))}
              </div>
              <p className="note">Sesiunile live se înregistrează automat în folderul recordings/ de pe PC și pot fi redate aici.</p>
            </>
          ) : null}

          <div className="callout info" style={{ marginTop: 16 }}>
            <IconInfo />
            <div style={{ fontSize: 14 }}>
              <b>iPhone / iPad:</b> pentru microfon și pentru a folosi aplicația de pe Netlify ai nevoie de HTTPS până la PC. Instalează Tailscale pe PC și pe iPhone, rulează <span className="mono">tailscale serve --bg {bridgePort(s.bridgeUrl)}</span> pe PC și folosește adresa <span className="mono">https://…ts.net</span> afișată. Detalii în docs/SETUP.md.
            </div>
          </div>
        </>
      ) : null}

      {s.connection === 'bridge' ? (
        <>
          <h2 className="section-title" id="ai">Copilot AI</h2>
          <AiSettings bridgeUrl={s.bridgeUrl} />
        </>
      ) : null}

      <h2 className="section-title">Afișare</h2>
      <div className="list">
        <div className="row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
          <span>Temă</span>
          <Segmented<Theme> label="Temă" value={s.theme} onChange={(v) => updateSettings({ theme: v })} options={[['auto', 'Auto'], ['light', 'Luminoasă'], ['dark', 'Întunecată'], ['night', 'Night Drive']]} />
        </div>
        <div className="row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
          <span>Unități</span>
          <Segmented<UnitPref> label="Unități" value={s.units} onChange={(v) => updateSettings({ units: v })} options={[['auto', 'După joc'], ['metric', 'km, L'], ['imperial', 'mi, gal']]} />
        </div>
        <div className="row"><span className="grow">Ecranul rămâne aprins</span><Switch label="Ecranul rămâne aprins" checked={s.keepAwake} onChange={(v) => updateSettings({ keepAwake: v })} /></div>
      </div>

      <h2 className="section-title">Voce</h2>
      <div className="list">
        <div className="row"><span className="grow">Răspunsuri citite cu voce tare</span><Switch label="Răspunsuri vocale" checked={s.voiceReplies} onChange={(v) => updateSettings({ voiceReplies: v })} /></div>
        <div className="row"><span className="grow">Alerte vocale (combustibil, odihnă, viteză)</span><Switch label="Alerte vocale" checked={s.voiceAlerts} onChange={(v) => updateSettings({ voiceAlerts: v })} /></div>
      </div>
      <p className="note">Audio nu se înregistrează și nu se salvează. Recunoașterea vocală o face browserul (Safari folosește serviciul Apple).</p>

      <h2 className="section-title">Despre</h2>
      <div className="list">
        <div className="row"><span className="grow">TruckSim Command Center</span><span className="value">0.1.0</span></div>
        <div className="row"><span className="grow muted" style={{ fontSize: 14 }}>Proiect personal, neafiliat cu SCS Software. Euro Truck Simulator 2 și American Truck Simulator sunt mărci SCS Software.</span></div>
      </div>
    </div></div>
  );
}

function bridgePort(url: string): string {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' && u.port ? u.port : '8787';
  } catch {
    return '8787';
  }
}

const LINK: Record<string, string> = {
  demo: 'demo', connecting: 'se conectează…', connected: 'conectat', unauthorized: 'token greșit', offline: 'offline', unconfigured: 'neconfigurat',
};
