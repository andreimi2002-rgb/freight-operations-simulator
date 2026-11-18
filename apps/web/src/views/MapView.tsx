import { useEffect, useMemo, useState } from 'react';
import { DemoSimulator, fmt, type Snapshot } from '@trucksim/core';
import { nextRouteTurn, type MapPoint, type RegionalMap, type RouteTurn, type UpcomingTurn } from '../../../../packages/core/src/regional-map.ts';
import { MapCanvas } from '../components/MapCanvas';
import { needsPairing, PairCard } from '../components/PairCard';
import { IconBox, IconCompass, IconCube, IconFlag, IconLocate, IconMap, IconMinus, IconPlus, IconRoute } from '../components/Icons';
import { SourceBadge } from '../components/ui';
import { useNow, useUnits } from '../lib/hooks';
import { updateSettings, useSettings } from '../lib/settings';
import { useWorldMap } from '../lib/worldMap';
import { bridgeHttp, fetchRegionalMap, freshness, getTelemetryState, switchToDemo, useTelemetry } from '../lib/telemetry';

const ZOOMS = [0.02, 0.035, 0.06, 0.1, 0.16, 0.26, 0.42];

function SpeedLimitSign({ game, limitKmh, units }: { game: Snapshot['game']['id']; limitKmh: number; units: fmt.UnitSystem }) {
  if (game === 'ats') {
    const mph = Math.round(limitKmh / fmt.KM_PER_MILE / 5) * 5;
    return (
      <div className="sign-us" aria-label={`Limită de viteză ${mph} mph`}>
        <span>SPEED</span><span>LIMIT</span><b>{mph}</b>
      </div>
    );
  }
  const v = units === 'imperial' ? Math.round(limitKmh / fmt.KM_PER_MILE) : Math.round(limitKmh);
  return <div className="sign-eu" aria-label={`Limită de viteză ${v}`}><b>{v}</b></div>;
}

function NavBanner({ snap, units, turn }: { snap: Snapshot; units: fmt.UnitSystem; turn: UpcomingTurn | null }) {
  const j = snap.job;
  const n = snap.navigation;
  if (!j && n.distanceKm === null) {
    return (
      <div className="nav-banner idle">
        <div className="nav-icon"><IconRoute /></div>
        <div className="nav-text">
          <div className="nav-primary">Condus liber</div>
          <div className="nav-secondary">Fără cursă și fără rută în GPS-ul jocului · {fmt.gameClock(snap.game.timeAbsMin)}</div>
        </div>
      </div>
    );
  }
  const dest = j?.destinationCity ?? 'Destinație';
  const company = j ? (j.destinationCompany ?? 'companie necunoscută') : null;
  return (
    <div className="nav-banner">
      <div className="nav-icon">
        {turn ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d={turn.direction === 'left' ? 'M17 21V12a4 4 0 0 0-4-4H4m5-5L4 8l5 5' : 'M7 21V12a4 4 0 0 1 4-4h9m-5-5 5 5-5 5'} />
          </svg>
        ) : <IconFlag />}
      </div>
      <div className="nav-text">
        <div className="nav-distance num">{turn ? fmt.distance(turn.mapMetres / 1000, units) : fmt.distance(n.distanceKm, units)}</div>
        <div className="nav-primary truncate">{turn ? (turn.direction === 'left' ? 'Spre stânga' : 'Spre dreapta') : dest}</div>
        <div className="nav-secondary truncate">{turn ? `Rută calculată · distanță pe hartă · ${dest}`
          : `${company ? `${company} · ` : ''}${snap.source === 'demo' ? 'Traseu Demo' : 'Distanță din GPS-ul jocului'}`}</div>
      </div>
    </div>
  );
}

function BottomCard({ snap, units }: { snap: Snapshot; units: fmt.UnitSystem }) {
  const n = snap.navigation;
  const j = snap.job;
  const eta = n.timeMin !== null && snap.game.timeAbsMin !== null ? snap.game.timeAbsMin + n.timeMin : null;
  const realMin = n.timeMin !== null && snap.game.timeScale ? n.timeMin / snap.game.timeScale : null;
  const progress = j?.plannedDistanceKm && n.distanceKm !== null ? 1 - n.distanceKm / j.plannedDistanceKm : null;
  const deadlineLeft = j?.deadlineAbsMin != null && snap.game.timeAbsMin !== null ? j.deadlineAbsMin - snap.game.timeAbsMin : null;
  const late = deadlineLeft !== null && n.timeMin !== null && n.timeMin > deadlineLeft;
  return (
    <div className="map-bottom glass">
      <div className="eta-row">
        <div>
          <div className="eta-value num" style={late ? { color: 'var(--orange)' } : undefined}>{eta !== null ? fmt.gameClock(eta).split(' ')[1] : '—'}</div>
          <div className="eta-label">sosire (joc)</div>
        </div>
        <div>
          <div className="eta-value num">{realMin !== null ? fmt.duration(realMin) : '—'}</div>
          <div className="eta-label">condus real</div>
        </div>
        <div>
          <div className="eta-value num">{fmt.distance(n.distanceKm, units)}</div>
          <div className="eta-label">rămas</div>
        </div>
      </div>
      {j ? (
        <div className="eta-job">
          <IconBox />
          <span className="truncate">
            <b>{j.cargo ?? 'Marfă'}</b> · {j.sourceCity ?? '?'} → {j.destinationCity ?? '?'}
            {deadlineLeft !== null ? ` · termen în ${fmt.duration(deadlineLeft)}` : ''}
          </span>
        </div>
      ) : null}
      {progress !== null ? (
        <div className="bar" style={{ marginTop: 10 }}><i style={{ width: `${Math.max(0, Math.min(1, progress)) * 100}%`, background: 'var(--blue)' }} /></div>
      ) : null}
    </div>
  );
}

export function MapView() {
  const t = useTelemetry();
  const settings = useSettings();
  const now = useNow(1000);
  const f = freshness(t, now);
  const snap = t.snapshot;
  const units = useUnits(snap?.game.id ?? null);
  const [zoomIdx, setZoomIdx] = useState(3);
  const [scaleM, setScaleM] = useState(1000);
  const [regionalMap, setRegionalMap] = useState<RegionalMap | null>(null);
  const [overview, setOverview] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [liveRoute, setLiveRoute] = useState<{ destinationId: string; points: MapPoint[] | null; turns?: RouteTurn[] } | null>(null);
  const demoRoute = useMemo(() => DemoSimulator.route(), []);
  const active = snap?.sdkActive && (f === 'live' || f === 'demo' || f === 'replay');
  const regionalDemo = snap?.source === 'demo' && snap.demoRoute === 'regional';
  const showRegionalMap = (t.link === 'connected' && snap?.game.id !== 'ats')
    || (t.link === 'demo' && Boolean(settings.bridgeUrl && settings.token));
  useEffect(() => {
    setRegionalMap(null);
    setMapError(null);
    if (!showRegionalMap) return;
    const request = new AbortController();
    void fetchRegionalMap()
      .then((map) => { if (!request.signal.aborted) setRegionalMap(map); })
      .catch((error: unknown) => {
        if (!request.signal.aborted) setMapError(error instanceof Error ? error.message : 'Verifică legătura cu bridge-ul.');
      });
    return () => request.abort();
  }, [showRegionalMap, settings.bridgeUrl, settings.token]);
  // Whole ETS2 map, loaded by area around the truck; the RO/BG layer is the
  // fallback while the bridge builds it, and keeps the regional demo route.
  const truckPoint = active && snap?.position ? { x: snap.position.x, z: snap.position.z } : null;
  const world = useWorldMap(showRegionalMap, truckPoint, overview, `${settings.bridgeUrl}|${settings.token}`);
  const baseMap = world.map
    ? { ...world.map, ...(regionalDemo && regionalMap ? { demoRoute: regionalMap.demoRoute, demoTurns: regionalMap.demoTurns, demoDestination: regionalMap.demoDestination } : {}) }
    : regionalMap;
  const visibleMap = showRegionalMap && (snap?.source !== 'demo' || regionalDemo) ? baseMap : null;
  const regionalOverview = Boolean(visibleMap && overview);
  const regionalRoute = useMemo(() => visibleMap?.demoRoute?.map(([x, z]) => ({ x, z })) ?? null, [visibleMap]);
  const liveDestination = active && f === 'live' && snap?.game.id === 'ets2' ? snap.job?.destinationCityId : null;
  useEffect(() => {
    setLiveRoute(null);
    if (!liveDestination) return;
    const request = new AbortController();
    let loading = false;
    const refresh = async () => {
      if (loading) return;
      loading = true;
      try {
        const response = await bridgeHttp('/api/map/ets2/route', { signal: request.signal });
        const result = response.ok ? await response.json() as NonNullable<typeof liveRoute> : null;
        if (!request.signal.aborted) {
          setLiveRoute(result?.destinationId === liveDestination ? result : { destinationId: liveDestination, points: null });
        }
      } catch {
        if (!request.signal.aborted) setLiveRoute({ destinationId: liveDestination, points: null });
      } finally {
        loading = false;
      }
    };
    void refresh();
    const timer = window.setInterval(() => {
      if (!getTelemetryState().snapshot?.game.paused) void refresh();
    }, 12_000);
    return () => {
      request.abort();
      window.clearInterval(timer);
    };
  }, [liveDestination, settings.bridgeUrl, settings.token]);
  const calculatedRoute = useMemo(() => liveDestination && liveRoute?.destinationId === liveDestination
    ? liveRoute.points?.map(([x, z]) => ({ x, z })) ?? null : null, [liveDestination, liveRoute]);
  const pos = active && snap?.position ? snap.position : null;
  const turn = pos && f === 'demo' && regionalDemo && visibleMap?.demoRoute && visibleMap.demoTurns
    ? nextRouteTurn({ points: visibleMap.demoRoute, turns: visibleMap.demoTurns }, pos)
    : pos && liveRoute?.destinationId === liveDestination && liveRoute?.points && liveRoute.turns
      ? nextRouteTurn({ points: liveRoute.points, turns: liveRoute.turns }, pos) : null;
  const speed = active && !snap?.game.paused ? snap!.truck.speedKmh : null;
  const limit = active ? snap!.navigation.speedLimitKmh : null;
  const over = speed !== null && limit !== null && speed > limit + 3;

  return (
    <div className="map-view">
      <div className={`map-stage ${settings.map3d && !regionalOverview ? 'tilt' : ''}`}>
        <MapCanvas
          position={pos}
          trail={t.trail}
          regionalMap={visibleMap}
          overview={regionalOverview}
          route={f === 'demo' && snap?.job ? (regionalDemo ? regionalRoute : demoRoute) : calculatedRoute}
          calculatedRoute={calculatedRoute !== null}
          headingUp={settings.mapHeadingUp}
          zoom={ZOOMS[zoomIdx]!}
          speedKmh={speed}
          onScale={setScaleM}
        />
      </div>

      <div className="map-top">
        {active && snap && !regionalOverview ? <NavBanner snap={snap} units={units} turn={turn} /> : null}
      </div>

      <div className="map-controls glass">
        {visibleMap ? (
          <button className="icon-btn" onClick={() => setOverview(!regionalOverview)} aria-label={regionalOverview ? 'Revino la camion' : world.map ? 'Vedere Europa' : 'Vedere România și Bulgaria'} title={regionalOverview ? 'Revino la camion' : world.map ? 'Vedere Europa' : 'Vedere România și Bulgaria'}>
            {regionalOverview ? <IconLocate /> : <IconMap />}
          </button>
        ) : null}
        {!regionalOverview ? (
          <>
            <button className="icon-btn" onClick={() => updateSettings({ map3d: !settings.map3d })} aria-pressed={settings.map3d} aria-label="Vedere 3D">
              <IconCube style={{ color: settings.map3d ? 'var(--blue)' : 'var(--label-2)' }} />
            </button>
            <button className="icon-btn" onClick={() => updateSettings({ mapHeadingUp: !settings.mapHeadingUp })} aria-label={settings.mapHeadingUp ? 'Orientare spre nord' : 'Orientare după direcția de mers'}>
              {settings.mapHeadingUp ? <IconLocate /> : <IconCompass />}
            </button>
            <hr />
            <button className="icon-btn" onClick={() => setZoomIdx((z) => Math.min(ZOOMS.length - 1, z + 1))} aria-label="Mărește"><IconPlus /></button>
            <button className="icon-btn" onClick={() => setZoomIdx((z) => Math.max(0, z - 1))} aria-label="Micșorează"><IconMinus /></button>
          </>
        ) : null}
      </div>

      <div className="map-meta">
        <SourceBadge />
        <span className="map-scale" style={{ width: 100 }}>{fmt.distance(scaleM / 1000, units)}</span>
        {showRegionalMap || f === 'demo' ? (
          <div className="map-layer-status glass" role="status">
            {world.map && visibleMap ? `Drumuri ETS2 · toată Europa${regionalOverview ? ' (simplificat)' : ''}`
              : world.status === 'building' && !visibleMap ? 'Se construiește harta Europei din joc (prima dată, ~15 s)…'
              : visibleMap ? `Drumuri ETS2 · România + Bulgaria${world.status === 'building' ? ' · Europa se construiește…' : ''}` : f === 'demo' && !regionalDemo
              ? 'Hartă schematică · Demo' : mapError ? 'Stratul rutier nu s-a încărcat' : 'Se încarcă drumurile ETS2…'}
            {mapError ? <small>{mapError}</small> : f === 'demo' && !showRegionalMap ? <small>Conectează bridge-ul pentru drumurile ETS2.</small> : null}
            {liveDestination ? <small>{calculatedRoute ? 'Rută calculată de aplicație · spre oraș'
              : liveRoute?.destinationId === liveDestination ? 'Rută calculată indisponibilă' : 'Se calculează ruta…'}</small> : null}
          </div>
        ) : null}
      </div>

      {!regionalOverview ? <div className="map-dock">
        {active && snap ? (
          <>
            <div className="map-speed">
              <div className={`speed-bubble glass ${over ? 'over' : ''}`}>
                <b className="num">{speed !== null ? Math.round(fmt.speedValue(speed, units)!) : '—'}</b>
                <span>{units === 'imperial' ? 'mph' : 'km/h'}</span>
              </div>
              {limit !== null ? <SpeedLimitSign game={snap.game.id} limitKmh={limit} units={units} /> : null}
            </div>
            <BottomCard snap={snap} units={units} />
          </>
        ) : <OfflineCard />}
      </div> : null}
    </div>
  );
}

function OfflineCard() {
  const t = useTelemetry();
  const settings = useSettings();
  const now = useNow(1000);
  const f = freshness(t, now);
  const msg =
    t.link === 'unconfigured' ? { title: 'Conectează bridge-ul', body: 'Pornește bridge-ul pe PC și introdu adresa și tokenul în Setări. Până atunci poți folosi modul demo.' }
    : t.link === 'unauthorized' ? { title: 'Token greșit', body: t.linkError ?? '' }
    : t.link === 'offline' || t.link === 'connecting' ? { title: t.link === 'connecting' ? 'Mă conectez…' : 'Bridge-ul nu răspunde', body: t.linkError ?? 'Verifică dacă bridge-ul rulează pe PC.' }
    : f === 'stale' ? { title: 'Date vechi', body: 'Bridge-ul nu mai trimite date. Nu afișăm valori vechi ca fiind live.' }
    : { title: 'Aștept jocul', body: 'Bridge-ul e conectat. Pornește ETS2 sau ATS (pluginul de telemetrie e instalat).' };
  if (needsPairing(t.link, settings.bridgeUrl)) {
    return (
      <div className="map-bottom" style={{ padding: 0 }}>
        <PairCard />
      </div>
    );
  }
  return (
    <div className="map-bottom glass">
      <div style={{ fontSize: 20, fontWeight: 700 }}>{msg.title}</div>
      <p className="muted" style={{ margin: '6px 0 12px', fontSize: 15 }}>{msg.body}</p>
      {t.link !== 'demo' ? <button className="btn block" onClick={switchToDemo}>Deschide modul demo</button> : null}
    </div>
  );
}
