/**
 * Voice in the browser: Web Speech API for push-to-talk recognition and
 * speech synthesis in Romanian. Both need the page in the foreground on iOS;
 * the microphone also needs HTTPS (or localhost).
 */

interface RecognitionResultEvent {
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
}

interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((e: RecognitionResultEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type RecognitionCtor = new () => Recognition;

function ctor(): RecognitionCtor | null {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function speechInputSupport(): { ok: boolean; reason: string | null } {
  // Check HTTPS first: on plain HTTP Safari hides the speech API entirely.
  if (!window.isSecureContext) {
    return { ok: false, reason: 'Microfonul merge doar prin HTTPS (cu Tailscale; vezi docs/SETUP.md). Până atunci poți scrie întrebările.' };
  }
  if (!ctor()) return { ok: false, reason: 'Browserul nu are recunoaștere vocală. Folosește Safari pe iPhone/iPad sau Chrome.' };
  return { ok: true, reason: null };
}

export interface ListenHandle {
  stop(): void;
  cancel(): void;
}

export function listen(handlers: {
  onPartial: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (message: string) => void;
  onEnd: () => void;
}): ListenHandle | null {
  const C = ctor();
  if (!C) return null;
  const rec = new C();
  rec.lang = 'ro-RO';
  rec.interimResults = true;
  rec.continuous = false;
  rec.maxAlternatives = 1;
  let finalText = '';
  rec.onresult = (e) => {
    let text = '';
    let final = false;
    for (let i = 0; i < e.results.length; i++) {
      const r = e.results[i]!;
      text += r[0]?.transcript ?? '';
      if (r.isFinal) final = true;
    }
    if (final) finalText = text.trim();
    handlers.onPartial(text);
  };
  rec.onerror = (e) => {
    const map: Record<string, string> = {
      'not-allowed': 'Accesul la microfon a fost refuzat. Permite-l din setările Safari.',
      'no-speech': 'Nu am auzit nimic.',
      network: 'Recunoașterea vocală are nevoie de internet.',
      'audio-capture': 'Nu găsesc un microfon.',
    };
    if (e.error !== 'aborted') handlers.onError(map[e.error] ?? `Eroare microfon: ${e.error}`);
  };
  rec.onend = () => {
    if (finalText) handlers.onFinal(finalText);
    handlers.onEnd();
  };
  rec.start();
  return { stop: () => rec.stop(), cancel: () => rec.abort() };
}

let voice: SpeechSynthesisVoice | null = null;

function pickVoice(): SpeechSynthesisVoice | null {
  if (voice) return voice;
  const voices = window.speechSynthesis?.getVoices() ?? [];
  voice = voices.find((v) => v.lang === 'ro-RO' && /enhanced|premium/i.test(v.name)) ??
    voices.find((v) => v.lang.toLowerCase().startsWith('ro')) ?? null;
  return voice;
}

if (typeof window !== 'undefined' && window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = () => {
    voice = null;
    pickVoice();
  };
}

export function speak(text: string, opts: { interrupt?: boolean } = {}): void {
  const synth = window.speechSynthesis;
  if (!synth) return;
  if (opts.interrupt) synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'ro-RO';
  const v = pickVoice();
  if (v) u.voice = v;
  u.rate = 1.03;
  synth.speak(u);
}

export function stopSpeaking(): void {
  window.speechSynthesis?.cancel();
}
