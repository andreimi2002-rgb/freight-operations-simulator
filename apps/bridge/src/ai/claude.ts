import Anthropic from '@anthropic-ai/sdk';
import { runTool, TOOL_SPECS, type CopilotContext } from '@trucksim/core';
import { MAX_TOOL_ROUNDS, SYSTEM, type ChatReply, type ChatTurn } from './prompt.ts';

export const CLAUDE_MODELS = [
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5', note: 'cel mai capabil' },
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5', note: 'echilibrat' },
  { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5', note: 'cel mai rapid și ieftin' },
];

/** `apiKey` undefined means: use the SDK's own credential lookup (environment). */
export function claudeClient(apiKey: string | undefined): Anthropic {
  return apiKey ? new Anthropic({ apiKey }) : new Anthropic();
}

export async function validateClaude(apiKey: string | undefined, model: string): Promise<string | null> {
  try {
    const probe = new Anthropic({ ...(apiKey ? { apiKey } : {}), maxRetries: 0, timeout: 15_000 });
    await probe.models.retrieve(model);
    return null;
  } catch (err) {
    return claudeError(err);
  }
}

export function claudeError(err: unknown): string {
  return err instanceof Anthropic.AuthenticationError ? 'Cheia nu este validă. Verifică dacă ai copiat-o întreagă.'
    : err instanceof Anthropic.PermissionDeniedError ? 'Cheia nu are acces la acest model.'
    : err instanceof Anthropic.NotFoundError ? 'Modelul nu este disponibil pentru contul tău.'
    : err instanceof Anthropic.RateLimitError ? 'Limita de cereri a fost atinsă.'
    : err instanceof Anthropic.APIConnectionError ? 'PC-ul nu poate ajunge la api.anthropic.com. Verifică internetul.'
    : err instanceof Anthropic.APIError ? `Eroare API ${err.status}.`
    : 'Eroare necunoscută.';
}

export async function askClaude(
  client: Anthropic,
  model: string,
  question: string,
  history: ChatTurn[],
  ctx: () => CopilotContext,
): Promise<ChatReply> {
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    ...history.slice(-10).map((t) => ({ role: t.role, content: t.text })),
    { role: 'user', content: question },
  ];
  const tools: Anthropic.Beta.BetaTool[] = TOOL_SPECS.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema,
    strict: true,
  }));
  const used: string[] = [];
  const reply = (text: string): ChatReply => ({ text, provider: 'claude', model, toolsUsed: used });

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const response = await client.beta.messages.create({
      model,
      max_tokens: 4000,
      system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
      tools,
      messages,
      output_config: { effort: 'low' },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    });

    if (response.stop_reason === 'refusal') return reply('Nu pot răspunde la asta.');
    if (response.stop_reason === 'tool_use' && round < MAX_TOOL_ROUNDS) {
      messages.push({ role: 'assistant', content: response.content });
      const c = ctx();
      const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
      for (const block of response.content) {
        if (block.type !== 'tool_use') continue;
        used.push(block.name);
        const result = await runTool(block.name, (block.input ?? {}) as Record<string, unknown>, c);
        results.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(result) });
      }
      messages.push({ role: 'user', content: results });
      continue;
    }
    if (response.stop_reason === 'pause_turn') {
      messages.push({ role: 'assistant', content: response.content });
      continue;
    }
    const text = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
      .map((b) => b.text)
      .join(' ')
      .trim();
    return reply(text || 'Nu am un răspuns.');
  }
  return reply('Nu am reușit să termin răspunsul.');
}
