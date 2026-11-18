import { useEffect, useState, type ReactNode } from 'react';
import type { GameEvent } from '@trucksim/core';
import { IconBook, IconBox, IconChart, IconGauge, IconGear, IconMap, IconMore, IconSparkle, IconChevron } from './components/Icons';
import { SourceBadge } from './components/ui';
import { useMediaQuery, useWakeLock } from './lib/hooks';
import { useSettings } from './lib/settings';
import { onGameEvent, startTelemetry } from './lib/telemetry';
import { speak } from './lib/voice';
import { CareerView } from './views/CareerView';
import { CopilotView } from './views/CopilotView';
import { EVENT_META, eventDetail, JobView } from './views/JobView';
import { MapView } from './views/MapView';
import { SettingsView } from './views/SettingsView';
import { TruckView } from './views/TruckView';
import { WikiView, type WikiTarget } from './views/WikiView';

type Tab = 'map' | 'job' | 'truck' | 'copilot' | 'wiki' | 'career' | 'settings' | 'more';

const NAV: Array<{ id: Tab; label: string; icon: ReactNode }> = [
  { id: 'map', label: 'Hartă', icon: <IconMap /> },
  { id: 'job', label: 'Cursă', icon: <IconBox /> },
  { id: 'truck', label: 'Camion', icon: <IconGauge /> },
  { id: 'copilot', label: 'Copilot', icon: <IconSparkle /> },
  { id: 'wiki', label: 'Wiki', icon: <IconBook /> },
  { id: 'career', label: 'Carieră', icon: <IconChart /> },
  { id: 'settings', label: 'Setări', icon: <IconGear /> },
];
const PHONE_TABS: Tab[] = ['map', 'job', 'truck', 'copilot', 'more'];

function readTab(): Tab {
  const h = location.hash.replace('#', '') as Tab;
  return [...NAV.map((n) => n.id), 'more'].includes(h) ? h : 'map';
}

/** Alerts worth interrupting the driver for (spoken when voice alerts are on). */
const SPOKEN: Partial<Record<GameEvent['type'], (e: GameEvent) => string>> = {
  'warning.fuel': (e) => `Atenție, combustibil puțin. Autonomie aproximativ ${e.details?.rangeKm ?? ''} kilometri.`,
  'warning.rest': () => 'Trebuie să faci o pauză de odihnă în curând.',
  speeding: (e) => `Ești peste limită. Limita este ${e.details?.limitKmh ?? ''}.`,
  fine: () => 'Ai primit o amendă.',
  'job.delivered': () => 'Livrare încheiată. Bravo!',
};
const TOASTED = new Set<GameEvent['type']>(['warning.fuel', 'warning.rest', 'speeding', 'fine', 'tollgate', 'job.delivered', 'job.cancelled', 'job.started', 'ferry', 'train']);

export function App() {
  const [tab, setTab] = useState<Tab>(readTab);
  const [wikiTarget, setWikiTarget] = useState<WikiTarget | null>(null);
  const [toasts, setToasts] = useState<GameEvent[]>([]);
  const settings = useSettings();
  const wide = useMediaQuery('(min-width: 900px)');
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');

  useEffect(() => startTelemetry(), []);
  useWakeLock(settings.keepAwake);

  useEffect(() => {
    const theme = settings.theme === 'auto' ? (prefersDark ? 'dark' : 'light') : settings.theme;
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'light' ? '#f2f2f7' : '#000000');
  }, [settings.theme, prefersDark]);

  useEffect(() => {
    const onHash = () => setTab(readTab());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(
    () =>
      onGameEvent((e) => {
        if (!TOASTED.has(e.type)) return;
        setToasts((t) => [e, ...t].slice(0, 3));
        window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== e.id)), 6000);
        const line = SPOKEN[e.type];
        if (line && settings.voiceAlerts) speak(line(e));
      }),
    [settings.voiceAlerts],
  );

  const go = (t: Tab) => {
    if (t === 'wiki' && tab === 'wiki') setWikiTarget(null);
    history.replaceState(null, '', `#${t}`);
    setTab(t);
  };
  const openWiki = (kind: WikiTarget['kind'], id: string, game?: WikiTarget['game']) => {
    setWikiTarget({ kind, id, game });
    go('wiki');
  };

  const view =
    tab === 'map' ? <MapView />
    : tab === 'job' ? <JobView openWiki={openWiki} />
    : tab === 'truck' ? <TruckView />
    : tab === 'copilot' ? <CopilotView />
    : tab === 'wiki' ? <WikiView target={wikiTarget} setTarget={setWikiTarget} />
    : tab === 'career' ? <CareerView />
    : tab === 'settings' ? <SettingsView />
    : wide ? <MapView /> : <MoreView go={go} />;

  return (
    <div className="app">
      <nav className="sidebar" aria-label="Navigare">
        <div className="sidebar-brand">
          <img src="/icon.svg" alt="" />
          <div><b>TruckSim</b><span>Command Center</span></div>
        </div>
        {NAV.map((n) => (
          <button key={n.id} className="side-link" aria-current={tab === n.id ? 'page' : undefined} onClick={() => go(n.id)}>
            {n.icon}{n.label}
          </button>
        ))}
        <div className="sidebar-foot"><SourceBadge /></div>
      </nav>

      <main className="main">{view}</main>

      <nav className="tabbar glass" aria-label="Navigare">
        {PHONE_TABS.map((id) => {
          const n = id === 'more' ? { label: 'Mai mult', icon: <IconMore /> } : NAV.find((x) => x.id === id)!;
          const current = tab === id || (id === 'more' && ['wiki', 'career', 'settings', 'more'].includes(tab));
          return (
            <button key={id} className="tab" aria-current={current ? 'page' : undefined} onClick={() => go(id)}>
              {n.icon}<span>{n.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="toasts" aria-live="assertive">
        {toasts.map((e) => {
          const m = EVENT_META[e.type];
          const Icon = m.icon;
          return (
            <div key={e.id} className="toast glass">
              <div className="row-icon" style={{ background: m.tone }}><Icon /></div>
              <div style={{ minWidth: 0 }}><b>{m.label}</b><span className="truncate" style={{ display: 'block' }}>{eventDetail(e) || ' '}</span></div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MoreView({ go }: { go: (t: Tab) => void }) {
  const items = NAV.filter((n) => ['wiki', 'career', 'settings'].includes(n.id));
  const tone: Record<string, string> = { wiki: 'var(--orange)', career: 'var(--green)', settings: 'var(--label-3)' };
  return (
    <div className="page"><div className="page-inner">
      <h1 className="large-title">Mai mult</h1>
      <p className="page-sub"><SourceBadge /></p>
      <div className="list">
        {items.map((n) => (
          <button key={n.id} className="row button" onClick={() => go(n.id)}>
            <div className="row-icon" style={{ background: tone[n.id] }}>{n.icon}</div>
            <span className="grow title">{n.label}</span>
            <IconChevron className="chev" />
          </button>
        ))}
      </div>
    </div></div>
  );
}
