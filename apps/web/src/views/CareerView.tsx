import { useEffect, useMemo, useState } from 'react';
import { fmt, type GameId, type Trip } from '@trucksim/core';
import { IconChart, IconChevron, IconTrash } from '../components/Icons';
import { Empty, Segmented, Sheet, Stat } from '../components/ui';
import { clearLocalTrips, loadLocalTrips } from '../lib/localTrips';
import { bridgeHttp, useTelemetry } from '../lib/telemetry';
import { EventRow } from './JobView';

type GameFilter = 'all' | GameId;

const STATUS: Record<Trip['status'], { label: string; tone: string }> = {
  delivered: { label: 'Livrată', tone: 'var(--green)' },
  cancelled: { label: 'Anulată', tone: 'var(--red)' },
  abandoned: { label: 'Neterminată', tone: 'var(--label-3)' },
  active: { label: 'În curs', tone: 'var(--blue)' },
};

function useTrips(): { trips: Trip[]; source: 'bridge' | 'browser'; error: string | null; reload: () => void } {
  const t = useTelemetry();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [n, setN] = useState(0);
  const viaBridge = t.link === 'connected';
  useEffect(() => {
    let cancelled = false;
    if (!viaBridge) {
      setTrips(loadLocalTrips());
      setError(null);
      return;
    }
    bridgeHttp('/api/trips?limit=200')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { trips: Trip[] }) => !cancelled && (setTrips(d.trips), setError(null)))
      .catch(() => !cancelled && setError('Nu am putut citi jurnalul de pe bridge.'));
    return () => { cancelled = true; };
  }, [viaBridge, t.tripsVersion, n]);
  return { trips, source: viaBridge ? 'bridge' : 'browser', error, reload: () => setN((x) => x + 1) };
}

export function CareerView() {
  const { trips, source, error, reload } = useTrips();
  const [game, setGame] = useState<GameFilter>('all');
  const [open, setOpen] = useState<Trip | null>(null);
  const list = useMemo(() => trips.filter((t) => game === 'all' || t.gameId === game), [trips, game]);
  const stats = useMemo(() => {
    const delivered = list.filter((t) => t.status === 'delivered');
    const byGame = (g: GameId) => delivered.filter((t) => t.gameId === g).reduce((s, t) => s + (t.revenue ?? 0), 0);
    return {
      delivered: delivered.length,
      km: list.reduce((s, t) => s + (t.drivenKm ?? 0), 0),
      eur: byGame('ets2'),
      usd: byGame('ats'),
      fines: list.reduce((s, t) => s + t.fines, 0),
      fuel: list.reduce((s, t) => s + (t.fuelUsedL ?? 0), 0),
    };
  }, [list]);

  return (
    <div className="page"><div className="page-inner">
      <h1 className="large-title">Carieră</h1>
      <p className="page-sub">{source === 'bridge' ? 'Jurnal salvat pe PC (SQLite)' : 'Curse demo, salvate doar în acest browser'}</p>
      <Segmented<GameFilter> label="Joc" value={game} onChange={setGame} options={[['all', 'Toate'], ['ets2', 'ETS2'], ['ats', 'ATS']]} />

      <div className="grid grid-4" style={{ marginTop: 12 }}>
        <Stat label="Livrări" value={fmt.number(stats.delivered)} />
        <Stat label="Distanță" value={fmt.number(stats.km)} unit="km" />
        <Stat label="Câștig ETS2" value={fmt.money(stats.eur, 'ets2')} tone="var(--green)" />
        <Stat label="Câștig ATS" value={fmt.money(stats.usd, 'ats')} tone="var(--green)" />
      </div>

      {error ? <p className="note" style={{ color: 'var(--orange)' }}>{error}</p> : null}

      <h2 className="section-title">Curse</h2>
      {list.length === 0 ? (
        <Empty icon={<IconChart />} title="Nicio cursă încă">
          Cursele se salvează automat la livrare sau anulare, o singură dată fiecare.
        </Empty>
      ) : (
        <div className="list">
          {list.map((t) => (
            <button key={t.id} className="row button" onClick={() => setOpen(t)}>
              <TripThumb trip={t} />
              <div className="grow">
                <div className="title truncate">{t.sourceCity ?? '?'} → {t.destinationCity ?? '?'}</div>
                <div className="subtitle truncate">
                  <span style={{ color: STATUS[t.status].tone, fontWeight: 600 }}>{STATUS[t.status].label}</span>
                  {' · '}{t.cargo ?? 'marfă necunoscută'} · {t.endedAt ? new Date(t.endedAt).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' }) : ''}
                  {t.source !== 'live' ? ` · ${t.source}` : ''}
                </div>
              </div>
              <div className="value">{t.revenue !== null ? fmt.money(t.revenue, t.gameId) : fmt.distance(t.drivenKm, 'metric')}</div>
              <IconChevron className="chev" />
            </button>
          ))}
        </div>
      )}

      {source === 'browser' && list.length > 0 ? (
        <button className="btn danger" style={{ marginTop: 14 }} onClick={() => { clearLocalTrips(); reload(); }}>
          <IconTrash />Șterge cursele demo
        </button>
      ) : null}
      <p className="note">Exportul (CSV/JSON) și hărțile de călătorie pe drumuri reale vin odată cu harta jocului.</p>

      {open ? <TripSheet trip={open} source={source} onClose={() => setOpen(null)} /> : null}
    </div></div>
  );
}

function pathD(points: Array<{ x: number; z: number }>, size: number, pad: number): string {
  if (points.length < 2) return '';
  const xs = points.map((p) => p.x);
  const zs = points.map((p) => p.z);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
  const span = Math.max(maxX - minX, maxZ - minZ, 1);
  const k = (size - pad * 2) / span;
  const ox = (size - (maxX - minX) * k) / 2;
  const oz = (size - (maxZ - minZ) * k) / 2;
  return points.map((p, i) => `${i ? 'L' : 'M'}${((p.x - minX) * k + ox).toFixed(1)},${((p.z - minZ) * k + oz).toFixed(1)}`).join('');
}

function TripThumb({ trip }: { trip: Trip }) {
  const d = pathD(trip.path, 44, 6);
  return (
    <div style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--fill-2)', flexShrink: 0 }}>
      {d ? <svg width="44" height="44" aria-hidden><path d={d} fill="none" stroke="var(--blue)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg> : null}
    </div>
  );
}

function TripSheet({ trip, source, onClose }: { trip: Trip; source: 'bridge' | 'browser'; onClose: () => void }) {
  const [full, setFull] = useState<Trip>(trip);
  useEffect(() => {
    if (source !== 'bridge') return;
    bridgeHttp(`/api/trips/${encodeURIComponent(trip.id)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { trip: Trip } | null) => d && setFull(d.trip))
      .catch(() => undefined);
  }, [trip.id, source]);
  const units = fmt.defaultUnits(full.gameId);
  const d = pathD(full.path, 300, 18);
  return (
    <Sheet title={`${full.sourceCity ?? '?'} → ${full.destinationCity ?? '?'}`} onClose={onClose}>
      <div className="card" style={{ display: 'grid', placeItems: 'center', padding: 8 }}>
        {d ? (
          <svg viewBox="0 0 300 300" width="100%" style={{ maxWidth: 300 }} aria-label="Traseul parcurs">
            <path d={d} fill="none" stroke="var(--map-route-casing)" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
            <path d={d} fill="none" stroke="var(--blue)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : <p className="muted">Fără traseu înregistrat.</p>}
      </div>
      <div className="grid grid-2" style={{ marginTop: 12 }}>
        <Stat label="Câștig" value={fmt.money(full.revenue, full.gameId)} foot={full.income !== null ? `ofertă ${fmt.money(full.income, full.gameId)}` : undefined} />
        <Stat label="Condus" value={fmt.distance(full.drivenKm, units)} foot={full.plannedDistanceKm ? `planificat ${fmt.distance(full.plannedDistanceKm, units)}` : undefined} />
        <Stat label="Combustibil" value={fmt.volume(full.fuelUsedL, units)} />
        <Stat label="Daune marfă" value={fmt.percent(full.cargoDamage, 1)} foot={full.xp !== null ? `${full.xp} XP` : undefined} />
      </div>
      <div className="list" style={{ marginTop: 12 }}>
        <div className="row"><span className="grow">Marfă</span><span className="value">{full.cargo ?? '—'}{full.cargoMassKg ? ` · ${fmt.mass(full.cargoMassKg, units)}` : ''}</span></div>
        <div className="row"><span className="grow">De la</span><span className="value truncate">{[full.sourceCompany, full.sourceCity].filter(Boolean).join(', ') || '—'}</span></div>
        <div className="row"><span className="grow">La</span><span className="value truncate">{[full.destinationCompany, full.destinationCity].filter(Boolean).join(', ') || '—'}</span></div>
        <div className="row"><span className="grow">Camion</span><span className="value">{full.truck ?? '—'}</span></div>
        <div className="row"><span className="grow">Remorcă</span><span className="value truncate">{full.trailer ?? '—'}</span></div>
        <div className="row"><span className="grow">Amenzi / taxe</span><span className="value">{fmt.money(full.fines, full.gameId)} / {fmt.money(full.tolls, full.gameId)}</span></div>
        <div className="row"><span className="grow">Viteză maximă</span><span className="value">{fmt.speed(full.maxSpeedKmh, units)}</span></div>
        <div className="row"><span className="grow">Durată (joc)</span><span className="value">{full.startGameMin !== null && full.endGameMin !== null ? fmt.duration(full.endGameMin - full.startGameMin) : '—'}</span></div>
      </div>
      {full.events.length ? (
        <>
          <h2 className="section-title">Evenimente</h2>
          <div className="list">{full.events.map((e) => <EventRow key={e.id} e={e} />)}</div>
        </>
      ) : null}
      <p className="note">Sursă: {full.source === 'live' ? 'telemetrie live' : full.source}. Distanța condusă vine din odometru (sau din raportul de livrare al jocului).</p>
    </Sheet>
  );
}
