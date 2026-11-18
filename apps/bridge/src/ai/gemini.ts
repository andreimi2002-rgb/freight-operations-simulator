import { ApiError, GoogleGenAI, type Content, type Part } from '@google/genai';
import { runTool, type CopilotContext } from '@trucksim/core';
import { MAX_TOOL_ROUNDS, plainToolSchemas, SYSTEM, type ChatReply, type ChatTurn } from './prompt.ts';

/**
 * Google Gemini through the official SDK. A key from aistudio.google.com is
 * free (rate-limited); on the free tier Google may use prompts to improve
 * its products, which Settings says plainly.
 */

export interface ModelOption {
  id: string;
  label: string;
  note: string;
}

export function geminiClient(apiKey: string): GoogleGenAI {
  return new GoogleGenAI({ apiKey });
}

/** Version number in a model id, e.g. "gemini-2.5-flash" -> 2.5. */
function version(id: string): number {
  const m = /gemini-(\d+(?:\.\d+)?)/.exec(id);
  return m ? Number(m[1]) : 0;
}

/**
 * Text chat models the key can use, best default first: newest stable
 * "flash" (fast, generous free limits), then the rest.
 */
export async function listGeminiModels(apiKey: string): Promise<ModelOption[]> {
  const pager = await geminiClient(apiKey).models.list({ config: { pageSize: 100 } });
  const out: ModelOption[] = [];
  for await (const m of pager) {
    const id = (m.name ?? '').replace(/^models\//, '');
    if (!id.startsWith('gemini-')) continue;
    if (m.supportedActions && !m.supportedActions.includes('generateContent')) continue;
    if (/(embedding|image|tts|audio|live|vision|aqa|robotics|computer-use|native|banana)/.test(id)) continue;
    const kind = id.includes('flash-lite') ? 'cel mai rapid' : id.includes('flash') ? 'rapid, recomandat' : id.includes('pro') ? 'cel mai capabil, limite gratuite mici' : 'general';
    const preview = /(preview|exp|latest)/.test(id);
    out.push({ id, label: m.displayName ?? id, note: preview ? `${kind} · previzualizare` : kind });
  }
  const rank = (o: ModelOption) => {
    const preview = /(preview|exp|latest)/.test(o.id) ? 1 : 0;
    const family = o.id.includes('flash-lite') ? 1 : o.id.includes('flash') ? 0 : 2;
    return [preview, family, -version(o.id), o.id.length] as const;
  };
  out.sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return (ra[i] as number) - (rb[i] as number);
    return a.id.localeCompare(b.id);
  });
  return out;
}

/**
 * Listing models succeeds even when generation is not allowed (billing, free
 * tier), so a key is accepted only after a tiny real request. Tries the
 * preferred model first, then the next few; returns the first that answers.
 */
export async function probeGemini(
  apiKey: string,
  candidates: string[],
): Promise<{ model: string; retired: string[] } | { error: string }> {
  const client = geminiClient(apiKey);
  let last: unknown = null;
  const retired: string[] = [];
  for (const model of candidates.slice(0, 10)) {
    try {
      await client.models.generateContent({ model, contents: 'Răspunde doar: ok', config: { maxOutputTokens: 8 } });
      return { model, retired };
    } catch (err) {
      last = err;
      // Key or account problems are the same for every model: stop early.
      if (err instanceof ApiError && [400, 401, 402, 403].includes(err.status)) break;
      // Listed but no longer served to this account.
      if (err instanceof ApiError && err.status === 404) retired.push(model);
      // 429/5xx: busy or rate-limited right now, try the next model.
    }
  }
  return { error: geminiError(last) };
}

/** Errors worth retrying on another model: overloaded, rate-limited, gone. */
export function isTransientGemini(err: unknown): boolean {
  return err instanceof ApiError && [404, 429, 500, 503, 504].includes(err.status);
}

export function geminiError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 400 && /api key/i.test(err.message)) return 'Cheia nu este validă. Verifică dacă ai copiat-o întreagă.';
    if (err.status === 402) {
      return 'Proiectul Google al acestei chei are facturare cu plată anticipată și creditul e zero, așa că nivelul gratuit nu se aplică. Creează o cheie nouă în AI Studio, într-un proiect nou fără facturare (Create API key → Create project).';
    }
    if (err.status === 403) return 'Cheia nu are acces (sau API-ul nu e activat pentru proiect).';
    if (err.status === 404) return 'Modelul nu este disponibil pentru cheia ta.';
    if (err.status === 429) return 'Ai atins limita gratuită de cereri. Mai încearcă peste un minut.';
    if (err.status === 503 || err.status === 500) return 'Serverele Google sunt supraîncărcate acum. Mai încearcă puțin mai târziu.';
    return `Eroare API ${err.status}.`;
  }
  if (err instanceof TypeError) return 'PC-ul nu poate ajunge la serviciul Google. Verifică internetul.';
  return 'Eroare necunoscută.';
}

export async function askGemini(
  client: GoogleGenAI,
  model: string,
  question: string,
  history: ChatTurn[],
  ctx: () => CopilotContext,
): Promise<ChatReply> {
  const contents: Content[] = [
    ...history.slice(-10).map((t) => ({ role: t.role === 'assistant' ? 'model' : 'user', parts: [{ text: t.text }] })),
    { role: 'user', parts: [{ text: question }] },
  ];
  const functionDeclarations = plainToolSchemas().map((t) => ({
    name: t.name,
    description: t.description,
    parametersJsonSchema: t.schema,
  }));
  const used: string[] = [];
  const reply = (text: string): ChatReply => ({ text, provider: 'gemini', model, toolsUsed: used });

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const res = await client.models.generateContent({
      model,
      contents,
      config: { systemInstruction: SYSTEM, tools: [{ functionDeclarations }], maxOutputTokens: 2048 },
    });
    const calls = res.functionCalls ?? [];
    const modelContent = res.candidates?.[0]?.content;
    if (calls.length && modelContent && round < MAX_TOOL_ROUNDS) {
      // Keep the model turn as returned (it may carry thought signatures).
      contents.push(modelContent);
      const c = ctx();
      const parts: Part[] = [];
      for (const call of calls) {
        const name = call.name ?? '';
        used.push(name);
        const output = await runTool(name, call.args ?? {}, c);
        parts.push({ functionResponse: { ...(call.id ? { id: call.id } : {}), name, response: { output } } });
      }
      contents.push({ role: 'user', parts });
      continue;
    }
    const text = (res.text ?? '').trim();
    if (!text && res.promptFeedback?.blockReason) return reply('Nu pot răspunde la asta.');
    return reply(text || 'Nu am un răspuns.');
  }
  return reply('Nu am reușit să termin răspunsul.');
}
