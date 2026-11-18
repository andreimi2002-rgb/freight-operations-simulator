import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type Anthropic from '@anthropic-ai/sdk';
import type { GoogleGenAI } from '@google/genai';
import { answerLocally, type CopilotContext } from '@trucksim/core';
import { askClaude, CLAUDE_MODELS, claudeClient, claudeError, validateClaude } from './ai/claude.ts';
import { askGemini, geminiClient, geminiError, isTransientGemini, listGeminiModels, probeGemini, type ModelOption } from './ai/gemini.ts';
import type { ChatReply, ChatTurn, ProviderId } from './ai/prompt.ts';

export type { ChatReply, ChatTurn, ProviderId } from './ai/prompt.ts';

/**
 * AI Co-Driver on the bridge. Providers:
 * - gemini: Google Gemini, free key from aistudio.google.com (default choice in Settings);
 * - claude: Anthropic Claude, paid per use;
 * - local:  rule-based answers about the game, offline, no key.
 * Keys are saved from the app into var/ai.json on the PC (git-ignored) and
 * never sent back to the browser. Environment variables work as a fallback.
 */

interface ProviderStore {
  apiKey?: string;
  model?: string;
  models?: ModelOption[];
}

interface StoredAi {
  provider?: ProviderId;
  gemini?: ProviderStore;
  claude?: ProviderStore;
  updatedAt?: string;
}

export interface ProviderInfo {
  hasKey: boolean;
  keySource: 'app' | 'env' | null;
  /** Last 4 characters only. */
  keyHint: string | null;
  model: string | null;
  models: ModelOption[];
}

export interface AiInfo {
  provider: ProviderId;
  model: string | null;
  gemini: ProviderInfo;
  claude: ProviderInfo;
}

const file = (varDir: string) => join(varDir, 'ai.json');

function load(varDir: string): StoredAi {
  try {
    if (!existsSync(file(varDir))) return {};
    const raw = JSON.parse(readFileSync(file(varDir), 'utf8')) as StoredAi & { apiKey?: string; model?: string };
    // Earlier format: { apiKey, model } for Claude only.
    if (raw.apiKey && !raw.claude) return { provider: 'claude', claude: { apiKey: raw.apiKey, model: raw.model } };
    return raw;
  } catch {
    return {};
  }
}

const hint = (key: string | undefined) => (key ? `…${key.slice(-4)}` : null);

export class CoDriver {
  private stored: StoredAi;
  private readonly varDir: string;
  private claude: Anthropic | null = null;
  private gemini: GoogleGenAI | null = null;
  provider: ProviderId = 'local';

  constructor(opts: { varDir: string }) {
    this.varDir = opts.varDir;
    this.stored = load(opts.varDir);
    this.apply();
  }

  private envGeminiKey(): string | undefined {
    return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || undefined;
  }
  private envClaude(): boolean {
    return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_PROFILE);
  }
  private geminiKey(): string | undefined {
    return this.stored.gemini?.apiKey ?? this.envGeminiKey();
  }
  private claudeAvailable(): boolean {
    return Boolean(this.stored.claude?.apiKey) || this.envClaude();
  }

  get geminiModel(): string | null {
    return this.stored.gemini?.model ?? this.stored.gemini?.models?.[0]?.id ?? process.env.TRUCKSIM_GEMINI_MODEL ?? null;
  }
  get claudeModel(): string {
    return this.stored.claude?.model ?? process.env.TRUCKSIM_AI_MODEL ?? CLAUDE_MODELS[0]!.id;
  }
  get model(): string | null {
    return this.provider === 'gemini' ? this.geminiModel : this.provider === 'claude' ? this.claudeModel : null;
  }

  private apply(): void {
    const gk = this.geminiKey();
    this.gemini = gk ? geminiClient(gk) : null;
    this.claude = this.claudeAvailable() ? claudeClient(this.stored.claude?.apiKey) : null;
    const wanted = this.stored.provider ?? (gk ? 'gemini' : this.claude ? 'claude' : 'local');
    this.provider =
      wanted === 'gemini' && this.gemini && this.geminiModel ? 'gemini'
      : wanted === 'claude' && this.claude ? 'claude'
      : wanted === 'gemini' && this.gemini ? 'gemini'
      : 'local';
  }

  info(): AiInfo {
    const gApp = this.stored.gemini?.apiKey;
    const cApp = this.stored.claude?.apiKey;
    return {
      provider: this.provider,
      model: this.model,
      gemini: {
        hasKey: Boolean(this.geminiKey()),
        keySource: gApp ? 'app' : this.envGeminiKey() ? 'env' : null,
        keyHint: hint(this.geminiKey()),
        model: this.geminiModel,
        models: this.stored.gemini?.models ?? [],
      },
      claude: {
        hasKey: this.claudeAvailable(),
        keySource: cApp ? 'app' : this.envClaude() ? 'env' : null,
        keyHint: hint(cApp ?? process.env.ANTHROPIC_API_KEY),
        model: this.claudeModel,
        models: CLAUDE_MODELS,
      },
    };
  }

  /**
   * Switches provider and/or saves a key or model. A new key is checked first
   * with a free call (model listing); nothing is saved if the check fails.
   * `apiKey: null` removes the saved key of that provider.
   */
  async configure(input: { provider: ProviderId; apiKey?: string | null; model?: string }): Promise<{ ok: true } | { ok: false; error: string }> {
    const next: StoredAi = { ...this.stored, provider: input.provider, updatedAt: new Date().toISOString() };

    if (input.provider === 'gemini') {
      const g: ProviderStore = { ...(next.gemini ?? {}) };
      if (input.apiKey === null) delete g.apiKey;
      else if (input.apiKey?.trim()) g.apiKey = input.apiKey.trim();
      const key = g.apiKey ?? this.envGeminiKey();
      if (!key) return { ok: false, error: 'Lipsește cheia Gemini.' };
      if (input.apiKey || !g.models?.length) {
        try {
          g.models = await listGeminiModels(key);
        } catch (err) {
          return { ok: false, error: geminiError(err) };
        }
        if (!g.models.length) return { ok: false, error: 'Cheia e validă, dar nu are acces la niciun model Gemini de chat.' };
      }
      if (input.model && !g.models?.some((m) => m.id === input.model)) return { ok: false, error: 'Model necunoscut.' };
      const preferred = input.model ?? (g.model && g.models?.some((m) => m.id === g.model) ? g.model : undefined);
      const order = [...(preferred ? [preferred] : []), ...(g.models ?? []).map((m) => m.id).filter((id) => id !== preferred)];
      const probe = await probeGemini(key, order);
      if ('error' in probe) return { ok: false, error: probe.error };
      g.models = (g.models ?? []).filter((m) => !probe.retired.includes(m.id));
      g.model = probe.model;
      next.gemini = g;
    } else if (input.provider === 'claude') {
      const c: ProviderStore = { ...(next.claude ?? {}) };
      if (input.apiKey === null) delete c.apiKey;
      else if (input.apiKey?.trim()) c.apiKey = input.apiKey.trim();
      if (!c.apiKey && !this.envClaude()) return { ok: false, error: 'Lipsește cheia Claude.' };
      const model = input.model ?? c.model ?? this.claudeModel;
      if (!CLAUDE_MODELS.some((m) => m.id === model)) return { ok: false, error: 'Model necunoscut.' };
      const error = await validateClaude(c.apiKey, model);
      if (error) return { ok: false, error };
      c.model = model;
      next.claude = c;
    }

    mkdirSync(this.varDir, { recursive: true });
    writeFileSync(file(this.varDir), JSON.stringify(next, null, 2));
    this.stored = next;
    this.apply();
    return { ok: true };
  }

  async ask(question: string, history: ChatTurn[], ctx: () => CopilotContext): Promise<ChatReply> {
    const local = async (note?: string): Promise<ChatReply> => {
      const text = await answerLocally(question, ctx());
      return { text: note ? `${text} (Răspuns local: ${note.replace(/\.$/, '').toLowerCase()}.)` : text, provider: 'local', model: null, toolsUsed: [] };
    };
    if (this.provider === 'gemini' && this.gemini && this.geminiModel) {
      // Free-tier models are often busy (503) or rate-limited (429): try the
      // chosen model, then up to two others, before falling back to local rules.
      const order = [this.geminiModel, ...(this.stored.gemini?.models ?? []).map((m) => m.id).filter((id) => id !== this.geminiModel)];
      let lastErr: unknown = null;
      for (const model of order.slice(0, 3)) {
        try {
          return await askGemini(this.gemini, model, question, history, ctx);
        } catch (err) {
          lastErr = err;
          console.warn(`[ai] gemini ${model} failed:`, err instanceof Error ? err.message.slice(0, 160) : err);
          if (!isTransientGemini(err)) break;
        }
      }
      return local(geminiError(lastErr));
    }
    try {
      if (this.provider === 'claude' && this.claude) {
        return await askClaude(this.claude, this.claudeModel, question, history, ctx);
      }
    } catch (err) {
      const reason = this.provider === 'gemini' ? geminiError(err) : claudeError(err);
      console.warn(`[ai] ${this.provider} request failed:`, err instanceof Error ? err.message : err);
      return local(reason);
    }
    return local();
  }
}
