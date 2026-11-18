import { useMemo, useState, type ReactNode } from 'react';
import type { WikiIndex, WikiKind } from '@trucksim/core';
import { IconBack, IconBook, IconBox, IconBuilding, IconChevron, IconLink, IconPin, IconSearch, IconTruck } from '../components/Icons';
import { Segmented } from '../components/ui';
import { useWiki } from '../lib/wiki';

export interface WikiTarget { kind: WikiKind; id: string }

const KIND_ICON: Record<WikiKind, { icon: ReactNode; tone: string }> = {
  city: { icon: <IconPin />, tone: 'var(--blue)' },
  company: { icon: <IconBuilding />, tone: 'var(--indigo)' },
  cargo: { icon: <IconBox />, tone: 'var(--orange)' },
  truck: { icon: <IconTruck />, tone: 'var(--green)' },
  trailer: { icon: <IconTruck />, tone: 'var(--teal)' },
};

type Filter = 'all' | WikiKind;

export function WikiView({ target, setTarget }: { target: WikiTarget | null; setTarget: (t: WikiTarget | null) => void }) {
  const wiki = useWiki();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  if (target && wiki) return <Detail wiki={wiki} target={target} open={setTarget} />;

  return (
    <div className="page"><div className="page-inner">
      <h1 className="large-title">Wiki</h1>
      <p className="page-sub">American Truck Simulator · {wiki ? `${wiki.data.cities.length} orașe, ${wiki.data.companies.length} companii, ${wiki.data.cargo.length} mărfuri` : 'se încarcă…'}</p>
      <div className="search" style={{ marginBottom: 12 }}>
        <IconSearch />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Caută orașe, companii, mărfuri, camioane" aria-label="Caută în wiki" autoComplete="off" />
      </div>
      <Segmented<Filter>
        label="Categorie" value={filter} onChange={setFilter}
        options={[['all', 'Tot'], ['city', 'Orașe'], ['company', 'Companii'], ['cargo', 'Mărfuri'], ['truck', 'Camioane']]}
      />
      {wiki ? <Results wiki={wiki} q={q} filter={filter} open={setTarget} /> : <p className="note">Se încarcă datele…</p>}
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
    title = c.name; subtitle = `Oraș · ${c.state}${c.dlc ? ` · DLC ${c.dlc}` : ''}`; url = c.wiki?.url;
    const companies = [...new Set((c.depots ?? []).map((d) => d.company))];
    body = (
      <div className="list">
        <Field label="Companii"><Chips items={companies.map(companyChip)} open={go} /></Field>
        <Field label="Depozite">{(c.depots ?? []).map((d) => d.type).filter(Boolean).join(', ') || '—'}</Field>
        <Field label="Facilități">{c.facilityDetails?.length ? c.facilityDetails.join('; ') : c.facilities?.join(', ') || '—'}</Field>
        <Field label="Drumuri">{c.roads?.join(', ') || '—'}</Field>
        <Field label="Vecini"><Chips items={(c.neighbors ?? []).map(cityChip)} open={go} /></Field>
        <Field label="Repere">{c.landmarks?.join(', ') || '—'}</Field>
        <Field label="Fus orar">{c.timezone?.game ?? '—'}</Field>
      </div>
    );
  } else if (target.kind === 'company') {
    const c = wiki.company(target.id);
    if (!c) return <Missing open={open} />;
    title = c.name; subtitle = `Companie · ${c.industry ?? c.category ?? ''}`; url = c.wiki?.url;
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
    title = c.name; subtitle = `Marfă${c.dlc ? ` · DLC ${c.dlc}` : ''}`; url = c.wiki?.url;
    const providers = wiki.data.companies.filter((co) => co.depotTypes.some((d) => d.provides.includes(c.id)));
    const receivers = wiki.data.companies.filter((co) => co.depotTypes.some((d) => d.accepts.includes(c.id)));
    body = (
      <div className="list">
        <Field label="Greutate">{c.weightLb ? (c.weightLb.min === c.weightLb.max ? `${c.weightLb.min.toLocaleString('ro-RO')} lb` : `${c.weightLb.min.toLocaleString('ro-RO')}–${c.weightLb.max.toLocaleString('ro-RO')} lb`) : '—'}</Field>
        <Field label="Valoare de bază">{c.valuePerKm ?? '—'}</Field>
        <Field label="Caracteristici">{c.flags.length ? c.flags.join(', ') : '—'}{c.hazmatClass ? ` · ADR ${c.hazmatClass}` : ''}</Field>
        <Field label="Remorci">{c.trailerTypes.join(', ') || '—'}</Field>
        <Field label="Livrată de"><Chips items={providers.map((p) => companyChip(p.id))} open={go} /></Field>
        <Field label="Primită de"><Chips items={receivers.map((p) => companyChip(p.id))} open={go} /></Field>
      </div>
    );
  } else if (target.kind === 'truck') {
    const t = wiki.truck(target.id);
    if (!t) return <Missing open={open} />;
    title = t.name; subtitle = `Camion · ${t.manufacturer ?? ''}`; url = t.wiki?.url;
    body = (
      <div className="list">
        <Field label="Putere max.">{t.maxHp ? `${t.maxHp} CP` : '—'}{t.electric ? ' · electric' : ''}</Field>
        <Field label="Cabine">{t.bodyStyles?.join(', ') || '—'}</Field>
        <Field label="Transmisii">{t.transmissions?.join(', ') || '—'}</Field>
        <Field label="Disponibil">{t.availability ?? '—'}</Field>
      </div>
    );
  } else {
    const t = wiki.trailer(target.id);
    if (!t) return <Missing open={open} />;
    title = t.name; subtitle = 'Remorcă';
    body = <div className="list"><Field label="Mărfuri"><Chips items={t.cargo.map(cargoChip)} open={go} /></Field></div>;
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

function Attribution({ wiki }: { wiki: WikiIndex | null }) {
  if (!wiki) return null;
  const m = wiki.data.meta;
  return (
    <p className="note" style={{ marginTop: 24 }}>
      <IconBook style={{ width: 14, height: 14, verticalAlign: -2 }} /> {m.attribution} Licență{' '}
      <a href={m.licenceUrl} target="_blank" rel="noopener noreferrer">{m.licence}</a>. Date preluate la {m.retrieved}; pot diferi de versiunea ta de joc.
    </p>
  );
}
