import { useEffect, type ReactNode } from 'react';
import { freshness, useTelemetry, type Freshness } from '../lib/telemetry';
import { useNow } from '../lib/hooks';
import { IconClose } from './Icons';

const LABEL: Record<Freshness, string> = {
  live: 'Live',
  demo: 'Demo',
  replay: 'Replay',
  stale: 'Date vechi',
  offline: 'Offline',
  nogame: 'Joc oprit',
};

export function SourceBadge({ compact = false }: { compact?: boolean }) {
  const t = useTelemetry();
  const now = useNow(1000);
  const f = freshness(t, now);
  const game = t.snapshot?.sdkActive ? t.snapshot.game.id : null;
  return (
    <span className={`badge ${f}`} role="status" aria-live="polite">
      <span className="dot" />
      {LABEL[f]}
      {!compact && game ? ` · ${game.toUpperCase()}` : ''}
    </span>
  );
}

export function Stat(props: { label: ReactNode; icon?: ReactNode; value: ReactNode; unit?: string; foot?: ReactNode; tone?: string }) {
  return (
    <div className="stat">
      <div className="stat-label" style={props.tone ? { color: props.tone } : undefined}>
        {props.icon}
        {props.label}
      </div>
      <div className="stat-value">
        {props.value}
        {props.unit ? <small>{props.unit}</small> : null}
      </div>
      {props.foot ? <div className="stat-foot">{props.foot}</div> : null}
    </div>
  );
}

export function Bar({ value, tone }: { value: number | null; tone?: string }) {
  const v = value === null ? 0 : Math.max(0, Math.min(1, value));
  return (
    <div className="bar" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v * 100)}>
      <i style={{ width: `${v * 100}%`, background: tone }} />
    </div>
  );
}

export function Switch(props: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="switch">
      <input type="checkbox" role="switch" aria-label={props.label} checked={props.checked} onChange={(e) => props.onChange(e.target.checked)} />
      <span />
    </label>
  );
}

export function Segmented<T extends string>(props: { value: T; options: Array<[T, string]>; onChange: (v: T) => void; label: string }) {
  return (
    <div className="segmented" role="group" aria-label={props.label}>
      {props.options.map(([v, l]) => (
        <button key={v} type="button" aria-pressed={props.value === v} onClick={() => props.onChange(v)}>
          {l}
        </button>
      ))}
    </div>
  );
}

export function Sheet(props: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && props.onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [props]);
  return (
    <div className="sheet-backdrop" onClick={props.onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={props.title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grabber" />
        <div className="sheet-head">
          <h2>{props.title}</h2>
          <button className="icon-btn" style={{ background: 'var(--fill)', width: 32, height: 32, color: 'var(--label-2)' }} onClick={props.onClose} aria-label="Închide">
            <IconClose style={{ width: 16, height: 16 }} />
          </button>
        </div>
        {props.children}
      </div>
    </div>
  );
}

/** Circular gauge (Apple Activity-ring style). */
export function Ring(props: { value: number | null; size?: number; stroke?: number; tone: string; children?: ReactNode; label: string }) {
  const size = props.size ?? 120;
  const stroke = props.stroke ?? 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = props.value === null ? 0 : Math.max(0, Math.min(1, props.value));
  return (
    <div style={{ position: 'relative', width: size, height: size }} role="meter" aria-label={props.label} aria-valuenow={Math.round(v * 100)} aria-valuemin={0} aria-valuemax={100}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--fill)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={props.tone} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${c * v} ${c}`} style={{ transition: 'stroke-dasharray 0.5s' }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>{props.children}</div>
    </div>
  );
}

export function Empty(props: { icon: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      {props.icon}
      <h3>{props.title}</h3>
      {props.children ? <p>{props.children}</p> : null}
      {props.action}
    </div>
  );
}

export function PageHeader(props: { title: string; right?: ReactNode; sub?: ReactNode }) {
  return (
    <header>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
        <h1 className="large-title">{props.title}</h1>
        <div style={{ paddingBottom: 6 }}>{props.right}</div>
      </div>
      <div className="page-sub">
        <SourceBadge />
        {props.sub}
      </div>
    </header>
  );
}
