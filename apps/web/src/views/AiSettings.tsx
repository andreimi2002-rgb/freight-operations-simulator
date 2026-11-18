import { useEffect, useState } from 'react';
import { IconCheck, IconLink, IconSparkle, IconWarn } from '../components/Icons';
import { Segmented } from '../components/ui';
import { bridgeHttp, useTelemetry } from '../lib/telemetry';

type ProviderId = 'gemini' | 'claude' | 'local';
interface ModelOption { id: string; label: string; note: string }
interface ProviderInfo { hasKey: boolean; keySource: 'app' | 'env' | null; keyHint: string | null; model: string | null; models: ModelOption[] }
interface AiInfo { provider: ProviderId; model: string | null; gemini: ProviderInfo; claude: ProviderInfo }

const META: Record<Exclude<ProviderId, 'local'>, { name: string; keyUrl: string; keyLabel: string; placeholder: string; blurb: string }> = {
  gemini: {
    name: 'Google Gemini',
    keyUrl: 'https://aistudio.google.com/apikey',
    keyLabel: 'Ia o cheie gratuită (aistudio.google.com)',
    placeholder: 'AIza…',
    blurb: 'Gratuit, cu limite de cereri pe minut și pe zi. Pe nivelul gratuit, Google poate folosi conversațiile ca să-și îmbunătățească modelele.',
  },
  claude: {
    name: 'Anthropic Claude',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    keyLabel: 'Creează o cheie (console.anthropic.com)',
    placeholder: 'sk-ant-…',
    blurb: 'Plătit la folosire, din creditul contului Anthropic. Conversațiile din API nu sunt folosite la antrenare.',
  },
};

/** The key travels in clear over plain HTTP on the LAN; on the PC itself or over HTTPS it does not. */
function transportIsPrivate(bridgeUrl: string): boolean {
  try {
    const u = new URL(bridgeUrl);
    return u.protocol === 'https:' || ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname);
  } catch {
    return false;
  }
}

export function AiSettings({ bridgeUrl }: { bridgeUrl: string }) {
  const t = useTelemetry();
  const [info, setInfo] = useState<AiInfo | null>(null);
  const [tab, setTab] = useState<ProviderId>('gemini');
  const [key, setKey] = useState('');
  const [model, setModel] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (t.link !== 'connected') return;
    bridgeHttp('/api/ai/config')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: AiInfo | null) => {
        if (!d) return;
        setInfo(d);
        if (d.provider !== 'local') setTab(d.provider);
      })
      .catch(() => undefined);
  }, [t.link]);

  if (t.link !== 'connected') return <p className="note">Conectează-te la bridge ca să configurezi copilotul AI.</p>;
  if (!info) return <p className="note">Se încarcă…</p>;

  async function save(body: { provider: ProviderId; apiKey?: string | null; model?: string }) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await bridgeHttp('/api/ai/config', { method: 'POST', body: JSON.stringify(body) });
      const d = (await res.json()) as AiInfo & { error?: string };
      if (!res.ok) {
        setMsg({ ok: false, text: d.error ?? 'Nu am putut salva.' });
        return;
      }
      setInfo(d);
      setKey('');
      setModel(null);
      setMsg({ ok: true, text: d.provider === 'local' ? 'Copilotul folosește regulile locale.' : `Gata. Copilotul folosește ${labelOf(d)}.` });
    } catch {
      setMsg({ ok: false, text: 'Bridge-ul nu răspunde.' });
    } finally {
      setBusy(false);
    }
  }

  const activeLabel = info.provider === 'local' ? 'Reguli locale' : labelOf(info);

  return (
    <>
      <div className="list">
        <div className="row">
          <div className="row-icon" style={{ background: info.provider === 'local' ? 'var(--label-3)' : 'var(--purple)' }}><IconSparkle /></div>
          <div className="grow">
            <div className="title">{activeLabel}</div>
            <div className="subtitle">{info.provider === 'local' ? 'doar întrebări despre joc, fără internet' : 'răspunde la orice; datele din joc doar din telemetrie'}</div>
          </div>
          <span className="badge live" style={{ visibility: info.provider === 'local' ? 'hidden' : 'visible' }}>Activ</span>
        </div>
        <div className="row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
          <Segmented<ProviderId>
            label="Furnizor AI" value={tab} onChange={(v) => { setTab(v); setKey(''); setModel(null); setMsg(null); }}
            options={[['gemini', 'Gemini (gratuit)'], ['claude', 'Claude'], ['local', 'Local']]}
          />
        </div>
      </div>

      {tab === 'local' ? (
        <div className="list" style={{ marginTop: 12 }}>
          <div className="row"><span className="grow muted" style={{ fontSize: 15 }}>Răspunsuri din reguli, în română, doar despre joc: distanță, combustibil, cursă, camion, odihnă, istoric, wiki. Merge fără internet și fără cheie.</span></div>
          <button className="row button" disabled={busy || info.provider === 'local'} onClick={() => void save({ provider: 'local' })}>
            <span className="grow" style={{ color: info.provider === 'local' ? 'var(--label-3)' : 'var(--blue)' }}>{info.provider === 'local' ? 'Folosit acum' : 'Folosește regulile locale'}</span>
          </button>
        </div>
      ) : (
        <ProviderPanel
          id={tab} p={info[tab]} active={info.provider === tab} busy={busy}
          keyValue={key} setKey={setKey} model={model ?? info[tab].model} setModel={setModel}
          onSave={(apiKey, m) => void save({ provider: tab, apiKey, model: m })}
          onRemove={() => void save({ provider: tab, apiKey: null })}
          showTransportWarning={!transportIsPrivate(bridgeUrl) && key.length > 0}
          bridgeUrl={bridgeUrl}
        />
      )}

      {msg ? (
        <div className={`callout ${msg.ok ? 'info' : ''}`} style={{ marginTop: 12 }}>
          {msg.ok ? <IconCheck /> : <IconWarn />}<div>{msg.text}</div>
        </div>
      ) : null}
      <p className="note">Cheile se verifică printr-un apel gratuit și se salvează doar pe PC (var/ai.json). Nu ajung în browser și nici în git.</p>
    </>
  );
}

function ProviderPanel(props: {
  id: 'gemini' | 'claude'; p: ProviderInfo; active: boolean; busy: boolean;
  keyValue: string; setKey: (v: string) => void; model: string | null; setModel: (v: string) => void;
  onSave: (apiKey: string | undefined, model: string | undefined) => void; onRemove: () => void;
  showTransportWarning: boolean; bridgeUrl: string;
}) {
  const m = META[props.id];
  const { p } = props;
  const changed = props.keyValue.trim().length > 0 || (props.model !== null && props.model !== p.model) || !props.active;
  const canSave = props.keyValue.trim().length > 0 || p.hasKey;
  return (
    <>
      <div className="list" style={{ marginTop: 12 }}>
        <div className="row"><span className="grow muted" style={{ fontSize: 15 }}>{m.blurb}</span></div>
        <div className="row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
          <label htmlFor={`key-${props.id}`}>
            {p.hasKey ? `Cheie ${p.keyHint ?? ''} ${p.keySource === 'env' ? '(variabilă de mediu)' : '(salvată pe PC)'} · schimb-o opțional` : `Cheie ${m.name}`}
          </label>
          <input
            id={`key-${props.id}`} className="field mono" type="password" value={props.keyValue} onChange={(e) => props.setKey(e.target.value)}
            placeholder={m.placeholder} autoCapitalize="off" autoCorrect="off" autoComplete="off" spellCheck={false}
          />
          <a className="btn" href={m.keyUrl} target="_blank" rel="noopener noreferrer"><IconLink />{m.keyLabel}</a>
        </div>
        {p.models.length ? (
          <div className="row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
            <span>Model</span>
            <div className="list" style={{ background: 'var(--fill-2)', maxHeight: 280, overflowY: 'auto' }}>
              {p.models.map((o) => (
                <button key={o.id} type="button" className="row button" onClick={() => props.setModel(o.id)} aria-pressed={props.model === o.id}>
                  <div className="grow">
                    <div className="title" style={{ fontSize: 16 }}>{o.label}</div>
                    <div className="subtitle">{o.note}</div>
                  </div>
                  {props.model === o.id ? <IconCheck style={{ width: 20, color: 'var(--blue)' }} /> : null}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <div className="row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
          <button className="btn primary" disabled={props.busy || !canSave || !changed} onClick={() => props.onSave(props.keyValue.trim() || undefined, props.model ?? undefined)}>
            {props.busy ? 'Verific…' : props.active ? 'Salvează' : `Folosește ${m.name}`}
          </button>
        </div>
        {p.keySource === 'app' ? (
          <button className="row button" style={{ color: 'var(--red)' }} onClick={props.onRemove} disabled={props.busy}>Șterge cheia salvată</button>
        ) : null}
      </div>
      {props.showTransportWarning ? (
        <div className="callout" style={{ marginTop: 12 }}>
          <IconWarn />
          <div style={{ fontSize: 14 }}>
            Ești conectat prin HTTP în rețeaua locală, deci cheia ar circula necriptată prin Wi-Fi. E mai sigur s-o introduci de pe PC (localhost) sau prin adresa HTTPS din Tailscale.
          </div>
        </div>
      ) : null}
    </>
  );
}

function labelOf(info: AiInfo): string {
  if (info.provider === 'local') return 'Reguli locale';
  const p = info[info.provider];
  return p.models.find((m) => m.id === p.model)?.label ?? p.model ?? info.provider;
}
