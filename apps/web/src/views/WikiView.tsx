import { useMemo, useState, type ReactNode } from 'react';
import type { WikiGame, WikiIndex, WikiKind } from '@trucksim/core';
import { IconBack, IconBook, IconBox, IconBuilding, IconChevron, IconLink, IconPin, IconSearch, IconTruck } from '../components/Icons';
import { Segmented } from '../components/ui';
import { currentGame, useWiki } from '../lib/wiki';
import { useTelemetry } from '../lib/telemetry';

export interface WikiTarget { kind: WikiKind; id: string; game?: WikiGame }

const KIND_ICON: Record<WikiKind, { icon: ReactNode; tone: string }> = {
  city: { icon: <IconPin />, tone: 'var(--blue)' },
  company: { icon: <IconBuilding />, tone: 'var(--indigo)' },
  cargo: { icon: <IconBox />, tone: 'var(--orange)' },
  truck: { icon: <IconTruck />, tone: 'var(--green)' },
  trailer: { icon: <IconTruck />, tone: 'var(--teal)' },
};

type Filter = 'all' | WikiKind;

export function WikiView({ target, setTarget }: { target: WikiTarget | null; setTarget: (t: WikiTarget | null) => void }) {
  const t = useTelemetry();
  const [picked, setPicked] = useState<WikiGame>(() => currentGame());
  const game = target?.game ?? picked;
  const { wiki, loading } = useWiki(game);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const open = (x: WikiTarget | null) => setTarget(x ? { ...x, game: x.game ?? game } : null);

  if (target && wiki) return <Detail wiki={wiki} target={target} open={open} />;

  const origin = wiki?.data.origin === 'game' ? 'din jocul instalat pe PC' : wiki ? 'Truck Simulator Wiki' : null;
  return (
    <div className="page"><div className="page-inner">
      <h1 className="large-title">Wiki</h1>
      <p className="page-sub">
        {wiki ? `${origin} · ${wiki.data.cities.length} orașe, ${wiki.data.companies.length} companii, ${wiki.data.cargo.length} mărfuri` : loading ? 'se încarcă…' : ''}
      </p>
      <div style={{ marginBottom: 12 }}>
        <Segmented<WikiGame> label="Joc" value={game} onChange={(g) => { setPicked(g); setTarget(null); }} options={[['ets2', 'Euro Truck Simulator 2'], ['ats', 'American Truck Simulator']]} />
      </div>
      <div className="search" style={{ marginBottom: 12 }}>
        <IconSearch />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Caută orașe, companii, mărfuri, camioane" aria-label="Caută în wiki" autoComplete="off" />
      </div>
      <Segmented<Filter>
        label="Categorie" value={filter} onChange={setFilter}
        options={[['all', 'Tot'], ['city', 'Orașe'], ['company', 'Companii'], ['cargo', 'Mărfuri'], ['truck', 'Camioane'], ['trailer', 'Remorci']]}
      />
      {wiki ? <Results wiki={wiki} q={q} filter={filter} open={open} />
        : loading ? <p className="note">Se încarcă datele…</p>
        : <p className="note" style={{ marginTop: 16 }}>{t.link === 'connected'
            ? 'Bridge-ul nu are încă date pentru acest joc (extragerea rulează la pornire; jocul trebuie să fie instalat pe PC).'
            : 'Enciclopedia completă vine de la PC: conectează aplicația la bridge. Fără PC e disponibil doar ATS (din Truck Simulator Wiki).'}</p>}
      <Attribution wiki={wiki} />
    </div></div>
  );
}

function Results({ wiki, q, filter, open }: { wiki: WikiIndex; q: string; filter: Filter; open: (t: WikiTarget) => void }) {
  const items = useMemo(() => {
    const kinds = filter === 'all' ? undefined : [filter];
    if (q.trim()) return wiki.search(q, 60, kinds).map((h) => ({ kind: h.kind, id: h.id, title: h.title, subtitle: h.subtitle }));
    // Browse lists when there is no query.
    const d = wiki.data;
    const pick = filter === 'all' ? 'city' : filter;
    const list =
      pick === 'city' ? d.cities.map((c) => ({ kind: 'city' as const, id: c.id, title: c.name, subtitle: `${c.state} · ${c.companyCount ?? 0} companii` }))
      : pick === 'company' ? d.companies.map((c) => ({ kind: 'company' as const, id: c.id, title: c.name, subtitle: c.industry ?? '' }))
      : pick === 'cargo' ? d.cargo.map((c) => ({ kind: 'cargo' as const, id: c.id, title: c.name, subtitle: c.dlc ? 'DLC' : 'joc de bază' }))
      : pick === 'truck' ? d.trucks.map((c) => ({ kind: 'truck' as const, id: c.id, title: c.name, subtitle: `${c.manufacturer ?? ''}${c.maxHp ? ` · până la ${c.maxHp} CP` : ''}` }))
      : d.trailers.map((c) => ({ kind: 'trailer' as const, id: c.id, title: c.name, subtitle: `${c.cargo.length} mărfuri` }));
    return list.sort((a, b) => a.title.localeCompare(b.title));
  }, [wiki, q, filter]);

  if (!items.length) return <p className="note" style={{ marginTop: 16 }}>Nimic găsit pentru „{q}”.</p>;
  return (
    <>
      <h2 className="section-title">{q.trim() ? `${items.length} rezultate` : filter === 'all' ? 'Orașe' : 'Toate'}</h2>
      <div className="list">
        {items.slice(0, 150).map((i) => (
          <button key={`${i.kind}:${i.id}`} className="row button" onClick={() => open({ kind: i.kind, id: i.id })}>
            <div className="row-icon" style={{ background: KIND_ICON[i.kind].tone }}>{KIND_ICON[i.kind].icon}</div>
            <div className="grow">
              <div className="title truncate">{i.title}</div>
              <div className="subtitle truncate">{i.subtitle}</div>
            </div>
            <IconChevron className="chev" />
          </button>
        ))}
      </div>
    </>
  );
}

function Chips({ items, open }: { items: Array<{ label: string; target?: WikiTarget }>; open: (t: WikiTarget) => void }) {
  if (!items.length) return <span className="muted">—</span>;
  return (
    <div className="chips wrap">
      {items.map((i) => (
        <button key={i.label} className="chip" disabled={!i.target} onClick={() => i.target && open(i.target)}>{i.label}</button>
      ))}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="row" style={{ alignItems: 'flex-start' }}>
      <div className="muted" style={{ width: 120, flexShrink: 0, fontSize: 15 }}>{label}</div>
      <div className="grow" style={{ fontSize: 15 }}>{children}</div>
    </div>
  );
}

function Detail({ wiki, target, open }: { wiki: WikiIndex; target: WikiTarget; open: (t: WikiTarget | null) => void }) {
  const go = (t: WikiTarget) => open(t);
  const cityChip = (id: string) => ({ label: wiki.city(id)?.name ?? id, target: wiki.city(id) ? { kind: 'city' as const, id } : undefined });
  const companyChip = (id: string) => ({ label: wiki.company(id)?.name ?? id, target: wiki.company(id) ? { kind: 'company' as const, id } : undefined });
  const cargoChip = (id: string) => ({ label: wiki.cargo(id)?.name ?? id, target: wiki.cargo(id) ? { kind: 'cargo' as const, id } : undefined });

  let title = '';
  let subtitle = '';
  let url: string | undefined;
  let body: ReactNode = null;

  if (target.kind === 'city') {
    const c = wiki.city(target.id);
    if (!c) return <Missing open={open} />;
    title = c.name; subtitle = `Oraș · ${c.state}${c.dlc ? ` · ${dlcName(c.dlc)}` : ''}`; url = c.wiki?.url ?? undefined;
    const companies = [...new Set((c.depots ?? []).map((d) => d.company))];
    body = (
      <div className="list">
        {c.population ? <Field label="Populație">{c.population.toLocaleString('ro-RO')}</Field> : null}
        <Field label="Companii"><Chips items={companies.map(companyChip)} open={go} /></Field>
        {(c.depots ?? []).some((d) => d.type) ? <Field label="Depozite">{(c.depots ?? []).map((d) => d.type).filter(Boolean).join(', ')}</Field> : null}
        {c.facilityDetails?.length || c.facilities?.length ? <Field label="Facilități">{c.facilityDetails?.length ? c.facilityDetails.join('; ') : c.facilities?.join(', ')}</Field> : null}
        {c.roads?.length ? <Field label="Drumuri">{c.roads.join(', ')}</Field> : null}
        {c.neighbors?.length ? <Field label="Vecini"><Chips items={c.neighbors.map(cityChip)} open={go} /></Field> : null}
        {c.landmarks?.length ? <Field label="Repere">{c.landmarks.join(', ')}</Field> : null}
        {c.timezone?.game ? <Field label="Fus orar">{c.timezone.game}</Field> : null}
      </div>
    );
  } else if (target.kind === 'company') {
    const c = wiki.company(target.id);
    if (!c) return <Missing open={open} />;
    title = c.name; subtitle = [`Companie`, c.industry ?? c.category].filter(Boolean).join(" · "); url = c.wiki?.url;
    body = (
      <>
        <div className="list">
          <Field label="ID-uri joc"><span className="mono" style={{ fontSize: 13 }}>{c.defIds.join(', ')}</span></Field>
        </div>
        {c.depotTypes.map((d, i) => (
          <div key={i}>
            <h2 className="section-title">{d.type ?? 'Depozit'}{d.gameId ? ` · ${d.gameId}` : ''}</h2>
            <div className="list">
              <Field label="Orașe"><Chips items={d.cities.map(cityChip)} open={go} /></Field>
              <Field label="Livrează"><Chips items={d.provides.slice(0, 40).map(cargoChip)} open={go} /></Field>
              <Field label="Primește"><Chips items={d.accepts.slice(0, 40).map(cargoChip)} open={go} /></Field>
            </div>
          </div>
        ))}
      </>
    );
  } else if (target.kind === 'cargo') {
    const c = wiki.cargo(target.id);
    if (!c) return <Missing open={open} />;
    title = c.name; subtitle = `Marfă${c.dlc ? ` · ${dlcName(c.dlc)}` : ''}`; url = c.wiki?.url;
    const providers = wiki.data.companies.filter((co) => co.depotTypes.some((d) => d.provides.includes(c.id)));
    const receivers = wiki.data.companies.filter((co) => co.depotTypes.some((d) => d.accepts.includes(c.id)));
    body = (
      <div className="list">
        {c.unitMassKg ? <Field label="Masă pe unitate">{`${c.unitMassKg.toLocaleString('ro-RO')} kg`}</Field> : null}
        {c.weightLb ? <Field label="Greutate (wiki)">{c.weightLb.min === c.weightLb.max ? `${c.weightLb.min.toLocaleString('ro-RO')} lb` : `${c.weightLb.min.toLocaleString('ro-RO')}–${c.weightLb.max.toLocaleString('ro-RO')} lb`}</Field> : null}
        <Field label="Plată de bază / unitate / km">{c.valuePerKm ?? '—'}</Field>
        <Field label="Caracteristici">{c.flags.length ? c.flags.join(', ') : '—'}{c.hazmatClass ? ` · ADR ${c.hazmatClass}` : ''}</Field>
        <Field label="Remorci">{c.trailerTypes.join(', ') || '—'}</Field>
        <Field label="Livrată de"><Chips items={providers.map((p) => companyChip(p.id))} open={go} /></Field>
        <Field label="Primită de"><Chips items={receivers.map((p) => companyChip(p.id))} open={go} /></Field>
      </div>
    );
  } else if (target.kind === 'truck') {
    const t = wiki.truck(target.id);
    if (!t) return <Missing open={open} />;
    title = t.name; subtitle = ['Camion', t.electric ? 'electric' : null, t.dlc ? dlcName(t.dlc) : t.availability].filter(Boolean).join(' · '); url = t.wiki?.url ?? undefined;
    body = (
      <>
        <div className="list">
          <Field label="Putere max.">{t.maxHp ? `${t.maxHp} CP` : '—'}</Field>
          {t.bodyStyles?.length ? <Field label="Cabine">{t.bodyStyles.join(', ')}</Field> : null}
          {t.chassis?.length ? <Field label="Șasiu">{t.chassis.join(', ')}</Field> : null}
          {t.transmissions?.length ? <Field label="Cutii de viteze">{t.transmissions.join(', ')}</Field> : null}
          {t.engines?.length ? null : <Field label="Disponibil">{t.availability ?? '—'}</Field>}
        </div>
        {t.engines?.length ? (
          <>
            <h2 className="section-title">Motoare ({t.engines.length})</h2>
            <div className="list">
              {t.engines.map((e, i) => (
                <div className="row" key={i}>
                  <div className="grow">
                    <div className="title" style={{ fontSize: 16 }}>{e.name}</div>
                    <div className="subtitle">
                      {[e.torqueNm ? `${e.torqueNm.toLocaleString('ro-RO')} Nm` : null, e.volumeL ? `${e.volumeL} L` : null, e.unlock != null ? `nivel ${e.unlock}` : null].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <div className="value" style={{ fontWeight: 600, color: 'var(--label)' }}>{e.hp ? `${e.hp} CP` : e.kw ? `${e.kw} kW` : '—'}</div>
                </div>
              ))}
            </div>
          </>
        ) : null}
      </>
    );
  } else {
    const t = wiki.trailer(target.id);
    if (!t) return <Missing open={open} />;
    title = t.name; subtitle = ['Remorcă', t.brand, t.dlc ? dlcName(t.dlc) : t.bodies ? 'joc de bază' : null].filter(Boolean).join(' · ');
    body = (
      <>
        <div className="list">
          {t.chassis?.length ? <Field label="Șasiu / axe">{t.chassis.join(', ')}</Field> : null}
          {t.cargo.length ? <Field label="Mărfuri"><Chips items={t.cargo.map(cargoChip)} open={go} /></Field> : null}
        </div>
        {t.bodies?.length ? (
          <>
            <h2 className="section-title">Caroserii ({t.bodies.length})</h2>
            <div className="list">
              {t.bodies.map((b, i) => (
                <div className="row" key={i}>
                  <span className="grow">{b.name}</span>
                  <span className="value">{[b.volumeM3 ? `${b.volumeM3} m³` : null, b.lengthM ? `${b.lengthM.toLocaleString('ro-RO')} m` : null].filter(Boolean).join(' · ')}</span>
                </div>
              ))}
            </div>
          </>
        ) : null}
      </>
    );
  }

  return (
    <div className="page"><div className="page-inner">
      <button className="btn" style={{ background: 'transparent', padding: 0, minHeight: 36 }} onClick={() => open(null)}>
        <IconBack style={{ width: 18, height: 18 }} /> Wiki
      </button>
      <div style={{ display: 'flex', gap: 14, alignItems: 'center', margin: '8px 0 18px' }}>
        <div className="row-icon" style={{ width: 52, height: 52, borderRadius: 14, background: KIND_ICON[target.kind].tone }}>{KIND_ICON[target.kind].icon}</div>
        <div style={{ minWidth: 0 }}>
          <h1 className="large-title" style={{ fontSize: 30, margin: 0 }}>{title}</h1>
          <div className="muted">{subtitle}</div>
        </div>
      </div>
      {body}
      {url ? (
        <a className="btn" style={{ marginTop: 14 }} href={url} target="_blank" rel="noopener noreferrer"><IconLink />Pagina din Truck Simulator Wiki</a>
      ) : null}
      <Attribution wiki={wiki} />
    </div></div>
  );
}

function Missing({ open }: { open: (t: null) => void }) {
  return (
    <div className="page"><div className="page-inner">
      <p className="note">Intrarea nu există în date.</p>
      <button className="btn" onClick={() => open(null)}>Înapoi</button>
    </div></div>
  );
}

/** Display names of map DLCs; unknown ids are shown as they are. */
const DLC_NAMES: Record<string, string> = {
  balkan_e: 'DLC Road to the Black Sea', balkan_w: 'DLC West Balkans', balt: 'DLC Beyond the Baltic Sea', east: 'DLC Going East!',
  north: 'DLC Scandinavia', fr: 'DLC Vive la France!', it: 'DLC Italia', iberia: 'DLC Iberia', greece: 'DLC Greece',
  heart_russia: 'DLC Heart of Russia', nordic_horizons: 'DLC Nordic Horizons',
  krone: 'DLC Krone Trailer Pack', schmitz: 'DLC Schmitz Cargobull Trailer Pack', kogel: 'DLC Kögel Trailer Pack',
  wielton: 'DLC Wielton Trailer Pack', feldbinder: 'DLC Feldbinder Trailer Pack', kassbohrer: 'DLC Kässbohrer Trailer Pack',
  schwarzmuller: 'DLC Schwarzmüller Trailer Pack', tirsan: 'DLC Tırsan Trailer Pack', lodeking: 'DLC Lode King & Prestige Trailers Pack',
};
function dlcName(id: string): string {
  return DLC_NAMES[id] ?? `DLC ${id.replace(/_/g, ' ')}`;
}

function Attribution({ wiki }: { wiki: WikiIndex | null }) {
  if (!wiki) return null;
  const m = wiki.data.meta;
  if (wiki.data.origin === 'game' && wiki.data.game === 'ets2') {
    return (
      <p className="note" style={{ marginTop: 24 }}>
        <IconBook style={{ width: 14, height: 14, verticalAlign: -2 }} /> Date extrase pe PC din jocul tău instalat, cu DLC-urile tale. Conținut SCS Software; nu sunt publicate nicăieri.
      </p>
    );
  }
  if (wiki.data.origin === 'game') {
    return (
      <p className="note" style={{ marginTop: 24 }}>
        <IconBook style={{ width: 14, height: 14, verticalAlign: -2 }} /> Date extrase pe PC din jocul tău instalat (conținut SCS Software, nepublicat). Detalii suplimentare (repere, drumuri, facilități) din Truck Simulator Wiki, licență{' '}
        <a href={m.licenceUrl} target="_blank" rel="noopener noreferrer">{m.licence}</a>, preluate la {m.retrieved}.
      </p>
    );
  }
  return (
    <p className="note" style={{ marginTop: 24 }}>
      <IconBook style={{ width: 14, height: 14, verticalAlign: -2 }} /> {m.attribution} Licență{' '}
      <a href={m.licenceUrl} target="_blank" rel="noopener noreferrer">{m.licence}</a>. Date preluate la {m.retrieved}; pot diferi de versiunea ta de joc.
    </p>
  );
}
