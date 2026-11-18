import type { ReactElement, SVGProps } from 'react';
import { fmt, type GameEvent } from '@trucksim/core';
import { IconBox, IconBuilding, IconChevron, IconTruck, IconClock, IconMoney, IconPin, IconRoute, IconShip, IconToll, IconWarn, IconWeight, IconBolt, IconFuel, IconBed, IconCheck } from '../components/Icons';
import { Bar, Empty, PageHeader, Stat } from '../components/ui';
import { useNow, useUnits } from '../lib/hooks';
import { freshness, useTelemetry } from '../lib/telemetry';
import { useWiki } from '../lib/wiki';

export const EVENT_META: Record<GameEvent['type'], { label: string; tone: string; icon: (p: SVGProps<SVGSVGElement>) => ReactElement }> = {
  'game.connected': { label: 'Joc conectat', tone: 'var(--green)', icon: IconBolt },
  'game.disconnected': { label: 'Joc deconectat', tone: 'var(--label-3)', icon: IconBolt },
  'game.switched': { label: 'Joc schimbat', tone: 'var(--teal)', icon: IconBolt },
  'job.started': { label: 'Cursă nouă', tone: 'var(--blue)', icon: IconBox },
  'job.delivered': { label: 'Livrată', tone: 'var(--green)', icon: IconCheck },
  'job.cancelled': { label: 'Anulată', tone: 'var(--red)', icon: IconWarn },
  fine: { label: 'Amendă', tone: 'var(--red)', icon: IconWarn },
  tollgate: { label: 'Taxă de drum', tone: 'var(--orange)', icon: IconToll },
  ferry: { label: 'Feribot', tone: 'var(--teal)', icon: IconShip },
  train: { label: 'Tren', tone: 'var(--teal)', icon: IconRoute },
  refuel: { label: 'Alimentare', tone: 'var(--green)', icon: IconFuel },
  'warning.fuel': { label: 'Combustibil scăzut', tone: 'var(--orange)', icon: IconFuel },
  'warning.rest': { label: 'Odihnă în curând', tone: 'var(--indigo)', icon: IconBed },
  speeding: { label: 'Peste limită', tone: 'var(--red)', icon: IconWarn },
};

export function eventDetail(e: GameEvent): string {
  const d = e.details ?? {};
  const money = e.amount != null && e.amount !== 0 ? fmt.money(e.amount, e.gameId) : null;
  switch (e.type) {
    case 'fine': return [money, d.offence ? String(d.offence).replace(/_/g, ' ') : null].filter(Boolean).join(' · ');
    case 'job.started': return [d.cargo, d.from && d.to ? `${d.from} → ${d.to}` : null].filter(Boolean).join(' · ');
    case 'job.delivered': return [money, typeof d.xp === 'number' ? `${d.xp} XP` : null].filter(Boolean).join(' · ');
    case 'ferry': case 'train': return [d.from && d.to ? `${d.from} → ${d.to}` : null, money].filter(Boolean).join(' · ');
    case 'warning.fuel': return typeof d.rangeKm === 'number' ? `autonomie ~${d.rangeKm} km` : '';
    case 'warning.rest': return typeof d.minutes === 'number' ? `în ${fmt.duration(d.minutes)} (joc)` : '';
    case 'speeding': return `${d.speedKmh} km/h la limită ${d.limitKmh}`;
    case 'refuel': return typeof d.litres === 'number' ? `${d.litres} L` : '';
    default: return money ?? '';
  }
}

export function EventRow({ e }: { e: GameEvent }) {
  const m = EVENT_META[e.type];
  const Icon = m.icon;
  return (
    <div className="row">
      <div className="row-icon" style={{ background: m.tone }}><Icon /></div>
      <div className="grow">
        <div className="title">{m.label}</div>
        <div className="subtitle truncate">{eventDetail(e) || fmt.gameClock(e.gameTimeMin)}</div>
      </div>
      <div className="value" style={{ fontSize: 13 }}>{new Date(e.ts).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}</div>
    </div>
  );
}

export function JobView({ openWiki: openWikiFor }: { openWiki: (kind: 'city' | 'company' | 'cargo' | 'trailer', id: string, game?: 'ets2' | 'ats') => void }) {
  const t = useTelemetry();
  const now = useNow(1000);
  const f = freshness(t, now);
  const snap = t.snapshot;
  const units = useUnits(snap?.game.id ?? null);
  const { wiki } = useWiki(snap?.game.id ?? 'ets2');
  const live = snap?.sdkActive && f !== 'stale' && f !== 'offline';
  const j = live ? snap!.job : null;

  if (!live || !snap) {
    return (
      <div className="page"><div className="page-inner">
        <PageHeader title="Cursă" />
        <Empty icon={<IconBox />} title="Fără date live">Când jocul rulează și bridge-ul e conectat, aici apare contractul curent.</Empty>
      </div></div>
    );
  }
  if (!j) {
    return (
      <div className="page"><div className="page-inner">
        <PageHeader title="Cursă" />
        <Empty icon={<IconBox />} title="Nicio cursă activă">Acceptă un contract în joc și apare aici, cu termenul, plata și ruta.</Empty>
        <Events events={t.events} />
      </div></div>
    );
  }

  const game = snap.game.id;
  const openWiki = (kind: 'city' | 'company' | 'cargo', id: string) => openWikiFor(kind, id, game ?? undefined);
  const left = j.deadlineAbsMin !== null && snap.game.timeAbsMin !== null ? j.deadlineAbsMin - snap.game.timeAbsMin : null;
  const nav = snap.navigation;
  const progress = j.plannedDistanceKm && nav.distanceKm !== null ? 1 - nav.distanceKm / j.plannedDistanceKm : null;
  const late = left !== null && nav.timeMin !== null && nav.timeMin > left;

  // Link to the encyclopedia only when the game ids match exactly.
  const srcCompany = j.sourceCompanyId ? wiki?.companyByGameId(j.sourceCompanyId) : undefined;
  const dstCompany = j.destinationCompanyId ? wiki?.companyByGameId(j.destinationCompanyId) : undefined;
  const srcCity = j.sourceCityId ? wiki?.city(j.sourceCityId) : undefined;
  const dstCity = j.destinationCityId ? wiki?.city(j.destinationCityId) : undefined;
  const cargo = j.cargoId ? wiki?.cargo(j.cargoId) : undefined;

  return (
    <div className="page"><div className="page-inner">
      <PageHeader title="Cursă" sub={j.market ? <span className="muted">{MARKET[j.market] ?? j.market}</span> : null} />

      <div className="card job-hero">
        <div className="job-cargo">
          <div className="job-cargo-icon"><IconBox /></div>
          <div className="grow">
            <div className="job-cargo-name">{j.cargo ?? 'Marfă necunoscută'}</div>
            <div className="muted" style={{ fontSize: 15 }}>
              {fmt.mass(j.cargoMassKg, units)}{j.specialTransport ? ' · transport special' : ''}{!j.cargoLoaded ? ' · neîncărcată' : ''}
            </div>
          </div>
          {cargo ? <button className="btn" onClick={() => openWiki('cargo', cargo.id)}>Fișă</button> : null}
        </div>

        <div className="route-line">
          <div className="route-stop">
            <span className="route-dot" />
            <div className="grow">
              <div className="route-city">{srcCity?.name ?? j.sourceCity ?? 'Necunoscut'}</div>
              <div className="muted">{j.sourceCompany ?? 'companie necunoscută'}</div>
            </div>
            <WikiLinks a={srcCompany && { label: 'Companie', on: () => openWiki('company', srcCompany.id) }} b={srcCity && { label: 'Oraș', on: () => openWiki('city', srcCity.id) }} />
          </div>
          <div className="route-stop">
            <span className="route-dot end" />
            <div className="grow">
              <div className="route-city">{dstCity?.name ?? j.destinationCity ?? 'Necunoscut'}</div>
              <div className="muted">{j.destinationCompany ?? 'companie necunoscută'}</div>
            </div>
            <WikiLinks a={dstCompany && { label: 'Companie', on: () => openWiki('company', dstCompany.id) }} b={dstCity && { label: 'Oraș', on: () => openWiki('city', dstCity.id) }} />
          </div>
        </div>

        {progress !== null ? (
          <div style={{ marginTop: 14 }}>
            <Bar value={progress} tone="var(--blue)" />
            <div className="muted" style={{ fontSize: 13, marginTop: 6, display: 'flex', justifyContent: 'space-between' }}>
              <span>{fmt.distance(Math.max(0, j.plannedDistanceKm! - (nav.distanceKm ?? 0)), units)} parcurși</span>
              <span>{fmt.distance(j.plannedDistanceKm, units)} planificați</span>
            </div>
          </div>
        ) : null}
      </div>

      <TrailerCard snap={snap} wikiTrailer={(id) => wiki?.trailerByGameId(id)} openTrailer={(id) => openWikiFor('trailer', id, game ?? undefined)} />

      <div className="grid grid-2" style={{ marginTop: 12 }}>
        <Stat icon={<IconMoney />} label="Plată" value={fmt.money(j.income, game)} tone="var(--green)" />
        <Stat
          icon={<IconClock />} label="Termen" tone={late ? 'var(--orange)' : 'var(--blue)'}
          value={left === null ? (j.deadlineAbsMin !== null ? '—' : 'Fără') : left >= 0 ? fmt.duration(left) : `−${fmt.duration(-left)}`}
          foot={j.deadlineAbsMin !== null ? `${fmt.gameClock(j.deadlineAbsMin)}${late ? ' · nu ajungi la timp' : ''}` : 'fără termen'}
        />
        <Stat icon={<IconRoute />} label="Rămas (GPS joc)" value={fmt.distance(nav.distanceKm, units)} foot={nav.timeMin !== null ? `${fmt.duration(nav.timeMin)} timp de joc` : 'fără rută setată'} />
        <Stat icon={<IconWeight />} label="Daune marfă" value={fmt.percent(j.cargoDamage, 1)} tone={j.cargoDamage && j.cargoDamage > 0.05 ? 'var(--red)' : undefined} />
      </div>

      {!wiki ? <p className="note">Fișele din enciclopedie apar când telefonul e conectat la PC (datele se extrag din jocul instalat).</p> : null}

      <Events events={t.events} />
    </div></div>
  );
}

const MARKET: Record<string, string> = {
  cargo_market: 'Piața de marfă',
  quick_job: 'Cursă rapidă',
  freight_market: 'Piața de transport',
  external_contracts: 'World of Trucks · contracte',
  external_market: 'World of Trucks',
};

function WikiLinks({ a, b }: { a?: { label: string; on: () => void } | false; b?: { label: string; on: () => void } | false }) {
  const items = [a, b].filter(Boolean) as Array<{ label: string; on: () => void }>;
  if (!items.length) return null;
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {items.map((i) => (
        <button key={i.label} className="btn" style={{ minHeight: 34, padding: '0 10px', fontSize: 14 }} onClick={i.on}>
          {i.label === 'Oraș' ? <IconPin /> : <IconBuilding />}
          {i.label}
          <IconChevron style={{ width: 12, height: 12 }} />
        </button>
      ))}
    </div>
  );
}

function Events({ events }: { events: GameEvent[] }) {
  if (!events.length) return null;
  return (
    <>
      <h2 className="section-title">Evenimente recente</h2>
      <div className="list">{events.slice(0, 12).map((e) => <EventRow key={e.id} e={e} />)}</div>
    </>
  );
}

const BODY_RO: Record<string, string> = {
  dryvan: 'Dubă', curtainside: 'Prelată', refrigerated: 'Frigorifică', insulated: 'Izotermă', flatbed: 'Platformă',
  container: 'Container', tank: 'Cisternă', food_tank: 'Cisternă alimentară', chemtank: 'Cisternă chimică', fuel_tank: 'Cisternă carburant',
  gas_tank: 'Cisternă gaz', silo: 'Siloz', dumper: 'Basculantă', log: 'Lemn', livestock: 'Animale vii', lowbed: 'Trailer agabaritic',
  lowloader: 'Platformă joasă', car_transporter: 'Transport auto', dropdeck: 'Drop deck', hopper: 'Buncăr', moving_floor: 'Podea mobilă',
};
const CHAIN_RO: Record<string, string> = {
  single: 'semiremorcă simplă', double: 'tren dublu', b_double: 'B-double', hct: 'HCT', triple: 'tren triplu', rmd: 'Rocky Mountain double', tpl: 'turnpike double',
};

function TrailerCard({ snap, wikiTrailer, openTrailer }: {
  snap: NonNullable<ReturnType<typeof useTelemetry>['snapshot']>;
  wikiTrailer: (id: string) => { id: string; name: string; dlc?: string | null } | undefined;
  openTrailer: (id: string) => void;
}) {
  const attached = snap.trailers.filter((t) => t.attached);
  if (!attached.length) {
    return (
      <div className="card" style={{ marginTop: 12, display: 'flex', gap: 12, alignItems: 'center' }}>
        <div className="row-icon" style={{ background: 'var(--label-3)' }}><IconTruck /></div>
        <div><b>Remorcă</b><div className="muted" style={{ fontSize: 14 }}>Nicio remorcă atașată acum{snap.job?.cargoLoaded === false ? ' (o iei de la expeditor)' : ''}.</div></div>
      </div>
    );
  }
  return (
    <>
      <h2 className="section-title">Remorcă{attached.length > 1 ? `i (${attached.length})` : ''}</h2>
      <div className="list">
        {attached.map((t, i) => {
          const w = t.id ? wikiTrailer(t.id) : undefined;
          const bodyLabel = t.bodyType ? BODY_RO[t.bodyType] : undefined;
          const knownName = [t.brand, t.name].filter(Boolean).join(' ') || w?.name;
          const name = knownName || (bodyLabel ? `Remorcă · ${bodyLabel}` : 'Remorcă');
          const details = [
            t.bodyType && (knownName || !bodyLabel) ? (bodyLabel ?? t.bodyType.replace(/_/g, ' ')) : null,
            i === 0 && t.chainType ? (CHAIN_RO[t.chainType] ?? t.chainType) : null,
            t.wheels ? `${t.wheels / 2} axe` : null,
            t.licensePlate ? t.licensePlate.replace(/<[^>]+>/g, '').trim() : null,
          ].filter(Boolean);
          return (
            <button key={i} className="row button" onClick={() => w && openTrailer(w.id)} disabled={!w} style={{ cursor: w ? 'pointer' : 'default' }}>
              <div className="row-icon" style={{ background: 'var(--teal)' }}><IconTruck /></div>
              <div className="grow">
                <div className="title">{name}</div>
                <div className="subtitle">{details.join(' · ') || '—'}</div>
                <div style={{ display: 'flex', gap: 12, marginTop: 6, fontSize: 13 }} className="muted">
                  <span>uzură șasiu {fmt.percent(t.wear.chassis, 1)}</span>
                  <span>roți {fmt.percent(t.wear.wheels, 1)}</span>
                  {t.cargoDamage !== null ? <span>marfă {fmt.percent(t.cargoDamage, 1)}</span> : null}
                </div>
              </div>
              {w ? <IconChevron className="chev" /> : null}
            </button>
          );
        })}
      </div>
    </>
  );
}
