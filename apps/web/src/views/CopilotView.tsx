import { useEffect, useRef, useState } from 'react';
import { answerLocally, detectIntent } from '@trucksim/core';
import { PairCard } from '../components/PairCard';
import { IconMic, IconSend, IconSparkle, IconSpeaker, IconSpeakerOff, IconStop } from '../components/Icons';
import { PageHeader } from '../components/ui';
import { loadLocalTrips } from '../lib/localTrips';
import { updateSettings, useSettings } from '../lib/settings';
import { bridgeHttp, useTelemetry, getTelemetryState } from '../lib/telemetry';
import { listen, speak, speechInputSupport, stopSpeaking, type ListenHandle } from '../lib/voice';
import { currentGame, loadWiki } from '../lib/wiki';

interface Msg {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  meta?: string;
}

// Kept at module level so the conversation survives tab switches.
let conversation: Msg[] = [];
let nextId = 1;

const SUGGESTIONS = ['Cât mai avem?', 'Câtă motorină mai am?', 'Ce marfă duc?', 'Cum stăm cu camionul?', 'Când trebuie să mă odihnesc?', 'Cum a fost ultima cursă?'];

async function ask(question: string, history: Msg[]): Promise<{ text: string; meta: string }> {
  const t = getTelemetryState();
  if (t.link === 'connected') {
    try {
      const res = await bridgeHttp('/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({ question, history: history.slice(-10).map((m) => ({ role: m.role, text: m.text })) }),
      });
      if (res.ok) {
        const r = (await res.json()) as { text: string; provider: 'gemini' | 'claude' | 'local'; model: string | null };
        return { text: r.text, meta: r.provider === 'local' ? 'Reguli locale · prin bridge' : `${r.model ?? r.provider} · prin bridge` };
      }
    } catch {
      /* fall through to local */
    }
  }
  // The AI runs on the PC. Without the bridge, only game questions can be answered here.
  if (t.link !== 'connected' && t.link !== 'demo' && !detectIntent(question)) {
    return {
      text: t.link === 'unconfigured' || t.link === 'unauthorized'
        ? 'Nu sunt împerecheat cu PC-ul, așa că AI-ul nu e disponibil. Introdu codul de 6 cifre din fereastra TruckSim de pe PC (cardul de mai sus).'
        : 'Nu am legătură cu PC-ul acum, așa că AI-ul nu e disponibil. Verifică dacă fereastra TruckSim e deschisă pe PC și dacă telefonul e pe același Wi-Fi.',
      meta: 'Fără conexiune la PC',
    };
  }
  const wiki = await loadWiki(currentGame());
  const text = await answerLocally(question, {
    snapshot: t.snapshot,
    now: Date.now(),
    trips: (n) => loadLocalTrips().slice(0, n),
    wiki,
  });
  return { text, meta: 'Reguli locale · în browser' };
}

export function CopilotView() {
  const settings = useSettings();
  const t = useTelemetry();
  const [msgs, setMsgs] = useState<Msg[]>(conversation);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [partial, setPartial] = useState('');
  const [micError, setMicError] = useState<string | null>(null);
  const handle = useRef<ListenHandle | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const mic = speechInputSupport();

  useEffect(() => {
    conversation = msgs;
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [msgs, busy]);

  async function send(text: string, spoken = false) {
    const q = text.trim();
    if (!q || busy) return;
    const user: Msg = { id: nextId++, role: 'user', text: q };
    const history = msgs;
    setMsgs((m) => [...m, user]);
    setInput('');
    setBusy(true);
    try {
      const r = await ask(q, history);
      setMsgs((m) => [...m, { id: nextId++, role: 'assistant', text: r.text, meta: r.meta }]);
      // Spoken questions always get a spoken answer; typed ones only when voice is on.
      if (settings.voiceReplies || spoken) speak(r.text, { interrupt: true });
    } finally {
      setBusy(false);
    }
  }

  function toggleMic() {
    if (listening) {
      handle.current?.stop();
      return;
    }
    setMicError(null);
    stopSpeaking();
    const h = listen({
      onPartial: setPartial,
      onFinal: (text) => void send(text, true),
      onError: setMicError,
      onEnd: () => {
        setListening(false);
        setPartial('');
        handle.current = null;
      },
    });
    if (h) {
      handle.current = h;
      setListening(true);
    }
  }

  const providerHint = t.link === 'connected'
    ? t.status?.ai.provider && t.status.ai.provider !== 'local' ? `${t.status.ai.model ?? t.status.ai.provider} pe PC` : 'reguli locale pe PC (fără cheie API)'
    : 'reguli locale în browser';

  return (
    <div className="page copilot-page"><div className="page-inner copilot-inner">
      <PageHeader
        title="Copilot"
        sub={<span className="muted">{providerHint}</span>}
        right={
          <button className="icon-btn" onClick={() => { stopSpeaking(); updateSettings({ voiceReplies: !settings.voiceReplies }); }} aria-label={settings.voiceReplies ? 'Oprește vocea' : 'Pornește vocea'}>
            {settings.voiceReplies ? <IconSpeaker /> : <IconSpeakerOff style={{ color: 'var(--label-3)' }} />}
          </button>
        }
      />

      <PairCard compact />

      <div className="chat" aria-live="polite">
        {msgs.length === 0 ? (
          <div className="chat-empty">
            <div className="chat-orb"><IconSparkle /></div>
            <h3>Întreabă-mă orice</h3>
            <p className="muted">Despre cursă, camion sau orice altceva. Cifrele din joc le iau doar din telemetrie: dacă nu am date live, îți spun asta în loc să inventez.</p>
          </div>
        ) : null}
        {msgs.map((m) => (
          <div key={m.id} className={`bubble-wrap ${m.role}`}>
            <div className={`bubble ${m.role}`}>{m.text}</div>
            {m.meta ? <div className="bubble-meta">{m.meta}</div> : null}
          </div>
        ))}
        {busy ? <div className="bubble-wrap assistant"><div className="bubble assistant typing"><i /><i /><i /></div></div> : null}
        <div ref={endRef} />
      </div>

      {t.link === 'connected' && t.status?.ai.provider === 'local' ? (
        <button className="callout info" style={{ border: 0, width: '100%', textAlign: 'left', cursor: 'pointer', marginBottom: 10 }} onClick={() => { location.hash = 'settings'; }}>
          <IconSparkle />
          <div style={{ fontSize: 14 }}><b>Vrei să pot răspunde la orice?</b><div className="muted">Adaugă o cheie Gemini gratuită în Setări → Copilot AI. Durează un minut.</div></div>
        </button>
      ) : null}

      {micError ? <p className="note" style={{ color: 'var(--orange)' }}>{micError}</p> : null}
      {!mic.ok ? <p className="note">{mic.reason}</p> : null}

      <div className="composer-dock">
      <div className="chips">
        {SUGGESTIONS.map((s) => <button key={s} className="chip" onClick={() => void send(s)}>{s}</button>)}
      </div>
      <form className="composer glass" onSubmit={(e) => { e.preventDefault(); void send(input); }}>
        <button
          type="button" className={`mic ${listening ? 'on' : ''}`} onClick={toggleMic} disabled={!mic.ok}
          aria-label={listening ? 'Oprește ascultarea' : 'Vorbește'}
        >
          {listening ? <IconStop /> : <IconMic />}
        </button>
        <input
          value={listening ? partial : input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={listening ? 'Te ascult…' : 'Scrie o întrebare'}
          aria-label="Întrebare"
          readOnly={listening}
        />
        <button type="submit" className="send" disabled={!input.trim() || busy} aria-label="Trimite"><IconSend /></button>
      </form>
      </div>
    </div></div>
  );
}
