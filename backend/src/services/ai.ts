import 'dotenv/config';
import { z } from 'zod';
import type {
  ChatMessage,
  DataSource,
  LearningPathPhase,
  PracticeQuestion,
  Profile,
  ProjectIdea,
  SkillGap,
} from '../store.js';

/**
 * Custom error type for AI provider failures.
 */
export class AiProviderError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'AiProviderError';
  }
}

/** Result wrapper used by the AI service functions. */
export interface AiResult<T> {
  data: T;
  source: DataSource;
  model: string | null;
  warning?: string;
}

const DEFAULT_API_URL = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_MODEL = 'gpt-4o-mini';
const MAX_HISTORY_MESSAGES = 12;
const MAX_HISTORY_CHARS = 12000;

export function isDemoMode(): boolean {
  return process.env.DEMO_MODE?.trim().toLowerCase() !== 'false';
}

export function getAiConfig() {
  const apiKey = process.env.LLM_API_KEY?.trim() || '';
  const apiUrl = process.env.LLM_API_URL?.trim() || DEFAULT_API_URL;
  const model = process.env.LLM_MODEL?.trim() || DEFAULT_MODEL;
  const timeoutMs = Math.max(
    5000,
    Math.min(60000, Number(process.env.LLM_TIMEOUT_MS || 25000))
  );
  return { configured: Boolean(apiKey), demoMode: isDemoMode(), apiKey, apiUrl, model, timeoutMs };
}

export function getPublicAiStatus() {
  const cfg = getAiConfig();
  return {
    configured: cfg.configured,
    demoMode: cfg.demoMode,
    mode: cfg.configured ? 'ai' : cfg.demoMode ? 'demo' : 'unconfigured',
    model: cfg.configured ? cfg.model : null,
    providerConfigured: cfg.configured,
  };
}

/**
 * Low‑level wrapper for OpenAI‑compatible chat completions.
 */
export async function callLlmCompletions(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  options: { temperature?: number; maxTokens?: number } = {}
): Promise<{ content: string; model: string }> {
  const cfg = getAiConfig();

  if (!cfg.configured) {
    throw new AiProviderError(
      503,
      'LLM_API_KEY is not configured. Add a valid OpenAI-compatible API key in .env to enable live AI responses.'
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);

  try {
    const response = await fetch(cfg.apiUrl, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.model,
        temperature: options.temperature ?? 0.3,
        max_tokens: options.maxTokens ?? 1400,
        messages,
      }),
    });

    if (response.status === 401 || response.status === 403) {
      throw new AiProviderError(
        502,
        'LLM provider rejected credentials (401/403). Verify LLM_API_KEY and LLM_API_URL in .env.'
      );
    }
    if (response.status === 429) {
      throw new AiProviderError(429, 'LLM provider rate limit exceeded (429). Please wait a few seconds and try again.');
    }
    if (!response.ok) {
      throw new AiProviderError(502, `LLM provider returned HTTP ${response.status}.`);
    }

    const payload = (await response.json()) as { model?: string; choices?: Array<{ message?: { content?: string } }> };
    const content = payload.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new AiProviderError(502, 'LLM provider returned an empty response.');
    }
    return { content, model: payload.model || cfg.model };
  } catch (err) {
    if (err instanceof AiProviderError) throw err;
    if (err instanceof Error && err.name === 'AbortError') {
      throw new AiProviderError(504, `LLM request timed out after ${Math.round(cfg.timeoutMs / 1000)}s.`);
    }
    throw new AiProviderError(502, `Failed to connect to LLM provider: ${err instanceof Error ? err.message : 'Network error'}`);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Helper to extract JSON from a possibly wrapped LLM response.
 */
export function extractJson(raw: string): unknown {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const firstObj = cleaned.indexOf('{');
    const firstArr = cleaned.indexOf('[');
    const startCandidates = [firstObj, firstArr].filter((i) => i >= 0);
    if (startCandidates.length === 0) throw new Error('No JSON object or array found in LLM response');
    const start = Math.min(...startCandidates);
    const end = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'));
    if (end <= start) throw new Error('Malformed JSON boundaries in LLM response');
    return JSON.parse(cleaned.slice(start, end + 1));
  }
}

/**
 * Generic JSON‑typed AI call returning the raw parsed data.
 */
export async function aiJson<T>(params: {
  systemPrompt: string;
  userPrompt: string;
  schema: z.ZodType<T>;
  fallbackFactory: () => T;
  temperature?: number;
}): Promise<AiResult<T>> {
  const cfg = getAiConfig();
  if (!cfg.configured) {
    if (!cfg.demoMode) {
      throw new AiProviderError(503, 'LLM_API_KEY is missing while DEMO_MODE=false. Configure LLM_API_KEY in .env.');
    }
    return { data: params.fallbackFactory(), source: 'demo', model: null };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);
  try {
    const { content, model } = await callLlmCompletions(
      [
        { role: 'system', content: `${params.systemPrompt}\nReturn ONLY valid JSON matching the requested schema.` },
        { role: 'user', content: params.userPrompt },
      ],
      { temperature: params.temperature ?? 0.2 }
    );
    const parsed = extractJson(content);
    const validated = params.schema.parse(parsed);
    return { data: validated, source: 'llm', model };
  } catch (err) {
    const reason =
      err instanceof AiProviderError
        ? err.message
        : err instanceof Error
        ? `Invalid LLM structured response: ${err.message}`
        : 'Unknown AI error';
    if (!cfg.demoMode) {
      if (err instanceof AiProviderError) throw err;
      throw new AiProviderError(502, reason);
    }
    console.warn('[EduPath AI Fallback]', reason);
    return { data: params.fallbackFactory(), source: 'fallback', model: cfg.model, warning: reason };
  } finally {
    clearTimeout(timer);
  }
}

/** Convenience wrapper used throughout the codebase to obtain plain data. */
export async function ai<T>(prompt: string, schemaDesc: string, fallbackValue: T): Promise<T> {
  const result = await aiJson<T>({
    systemPrompt: '',
    userPrompt: `${prompt}\n${schemaDesc}`,
    schema: z.any(),
    fallbackFactory: () => fallbackValue,
  });
  return result.data;
}

/** Trim conversation history for token limits. */
export function trimConversationHistory(history: ChatMessage[]): Array<{ role: 'user' | 'assistant'; content: string }> {
  const recent = history.slice(-MAX_HISTORY_MESSAGES);
  const formatted: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  let charBudget = MAX_HISTORY_CHARS;
  for (let i = recent.length - 1; i >= 0; i--) {
    const item = recent[i];
    const snippet = item.content.slice(0, 2500);
    if (charBudget - snippet.length < 0 && formatted.length > 0) break;
    charBudget -= snippet.length;
    formatted.unshift({ role: item.role === 'user' ? 'user' : 'assistant', content: snippet });
  }
  return formatted;
}

/** Demo chat response builder – unchanged from original implementation. */
export function buildDemoChatResponse(params: {
  profile: Profile;
  message: string;
  nextAction: string;
  gaps: SkillGap[];
  progress: Record<string, unknown>;
  struggleSkills: string[];
}): { answer: string; actions: string[]; references: string[] } {
  const { profile, message, nextAction, gaps, progress, struggleSkills } = params;
  const q = message.toLowerCase();
  const topGaps = gaps.filter((g) => g.priority === 'High');
  const focusSkill = topGaps[0]?.skill || gaps[0]?.skill || 'Core Fundamentals';
  let topicSection = '';
  if (/dsa|algorithm|data structure|array|tree|graph|dp|dynamic programming|binary search|leetcode|complexity/.test(q)) {
    topicSection = [
      `### DSA & Coding Guidance`,
      `For problem‑solving interviews targeting **${profile.target_role}**, follow a structured pattern approach:`,
      `1. **Clarify constraints & complexity** before coding.`,
      `2. **Core pattern example — Binary Search invariant**:`,
      '```python\n' +
        'def binary_search(nums: list[int], target: int) -> int:\n' +
        '    lo, hi = 0, len(nums) - 1\n' +
        '    while lo <= hi:\n' +
        '        mid = lo + (hi - lo) // 2\n' +
        '        if nums[mid] == target:\n' +
        '            return mid\n' +
        '        if nums[mid] < target:\n' +
        '            lo = mid + 1\n' +
        '        else:\n' +
        '            hi = mid - 1\n' +
        '    return -1\n' +
        '```',
      `3. Practice **2 medium problems** on your weakest pattern and write down the invariant after solving.`,
    ].join('\n\n');
  } else if (/attention|transformer|llm|rag|mlops|machine learning|neural|pytorch|ai/.test(q)) {
    topicSection = [
      `### AI / ML Technical Breakdown (${focusSkill})`,
      `Since your target role is **${profile.target_role}** and **${focusSkill}** is a priority gap:`,
      `- **Scaled Dot‑Product Attention**: \`Attention(Q, K, V) = softmax((Q @ K.T) / sqrt(d_k)) @ V\`. Dividing by \`sqrt(d_k)\` prevents softmax saturation when embedding dimension \`d_k\` is large.`,
      `- **Practical next step**: Implement one self‑attention block in PyTorch with unit tests checking output shape \`(batch, seq_len, d_model)\`, then evaluate retrieval Recall@k if working on RAG.`,
    ].join('\n\n');
  } else if (/react|frontend|backend|node|express|api|web|sql|postgres|database|typescript/.test(q)) {
    topicSection = [
      `### Full‑Stack Engineering Guidance`,
      `When building production web/API systems for **${profile.target_role}**:`,
      `- Validate every request boundary with a schema (e.g. Zod on TypeScript APIs) and return consistent \`4xx\` errors.`,
      `- Keep credentials server‑side, parameterize SQL queries (\`$1, $2\`), and separate pure business logic from route handlers so it can be unit‑tested.`,
    ].join('\n\n');
  } else if (/interview|resume|career|job|ready|salary|portfolio/.test(q)) {
    topicSection = [
      `### ${profile.target_role} Interview Readiness`,
      `- **Current readiness**: \`${progress.overall ?? 0}%\` overall, \`${progress.completed ?? 0}\` tasks completed, practice average \`${progress.practiceScore ?? 0}%\`.`,
      `- **Strengths to highlight**: ${profile.skills.slice(0, 4).join(', ') || 'your core skills'}.`,
      `- **Key gaps to close before interviews**: ${topGaps.map((g) => g.skill).join(', ') || 'None critical'}.`,
      `- Pair every major project on your resume with a measurable metric (latency, Recall@k, test coverage, or cost reduction).`,
    ].join('\n\n');
  } else if (/plan|schedule|today|next|study|week|learn/.test(q)) {
    topicSection = [
      `### Personalized ${profile.study_minutes} min/day Study Plan`,
      `1. **First ${Math.round(profile.study_minutes * 0.4)} min — Concept & Code**: Tackle **\"${nextAction}\"**.`,
      `2. **Next ${Math.round(profile.study_minutes * 0.4)} min — Hands‑on Build**: Apply it inside a small script or mini‑project aligned with your **${profile.learning_style}** style.`,
      `3. **Final ${Math.max(10, Math.round(profile.study_minutes * 0.2))} min — Recall Check**: Complete a Practice Lab quiz to verify mastery.`,
    ].join('\n\n');
  } else {
    topicSection = [
      `### Personalized Guidance for ${profile.name} (${profile.target_role})`,
      `- **Next Best Action**: **${nextAction}**`,
      `- **Top Skill Gaps**: ${topGaps.map((g) => `${g.skill} (${g.currentLevel}/${g.requiredLevel})`).join(', ') || 'All core skills on track'}`,
      `- Ask me about a specific coding concept, algorithm, system design trade‑off, interview prep, or study schedule!`,
    ].join('\n\n');
  }
  const struggleBanner =
    struggleSkills.length > 0
      ? `\n\n> **Adaptive Alert:** Recent practice scores show struggle in **${struggleSkills.join(', ')}**. Focus on prerequisite review tasks before advancing.`
      : '';
  const demoNotice = `\n\n---\n*Demo Mode response (no \`LLM_API_KEY\` configured in \`.env\`). Configure \`LLM_API_KEY\` to unlock live OpenAI‑compatible AI mentoring.*`;
  return {
    answer: `${topicSection}${struggleBanner}${demoNotice}`,
    actions: [`Work on \"${nextAction}\"`, `Practice ${focusSkill} in Practice Lab`, 'Review Skill Gaps & Weekly Plan'],
    references: topGaps.map((g) => `${g.skill}: ${g.action}`).slice(0, 4),
  };
}

/** Chat completion wrapper used by the backend chat endpoint. */
export async function aiChatCompletion(params: {
  profile: Profile;
  history: ChatMessage[];
  message: string;
  context: {
    nextAction: string;
    gaps: SkillGap[];
    progress: Record<string, unknown>;
    struggleSkills: string[];
    learningPathPhases: string[];
    documentSkills: string[];
  };
}): Promise<AiResult<{ answer: string; actions: string[]; references: string[] }>> {
  const cfg = getAiConfig();
  if (!cfg.configured) {
    if (!cfg.demoMode) {
      throw new AiProviderError(503, 'LLM_API_KEY is missing while DEMO_MODE=false. Add LLM_API_KEY to .env to use the AI Learning Assistant.');
    }
    return {
      data: buildDemoChatResponse({
        profile: params.profile,
        message: params.message,
        nextAction: params.context.nextAction,
        gaps: params.context.gaps,
        progress: params.context.progress,
        struggleSkills: params.context.struggleSkills,
      }),
      source: 'demo',
      model: null,
    };
  }
  const systemPrompt = [
    'You are EduPath, an expert personalized AI learning coach, CS tutor, and career mentor.',
    'Support programming/coding doubts (with concise code examples), Computer Science fundamentals, AI/ML, Data Structures & Algorithms, Web Development, skill‑gap remediation, study planning, interview preparation, and project architecture.',
    'Always personalize guidance to the learner context below. Be accurate, practical, encouraging, and never fabricate facts.',
    `Learner Profile: ${JSON.stringify(params.profile)}`,
    `Resume/Document Skills: ${JSON.stringify(params.context.documentSkills)}`,
    `Skill Gaps: ${JSON.stringify(params.context.gaps)}`,
    `Learning Path Phases: ${JSON.stringify(params.context.learningPathPhases)}`,
    `Next Best Action: ${params.context.nextAction}`,
    `Progress & Struggle Signals: ${JSON.stringify(params.context.progress)} | Struggles: ${JSON.stringify(params.context.struggleSkills)}`,
    'Respond with JSON: {"answer": string, "actions": string[], "references": string[]}.',
  ].join('\n');
  const historyMessages = trimConversationHistory(params.history);
  try {
    const { content, model } = await callLlmCompletions(
      [
        { role: 'system', content: systemPrompt },
        ...historyMessages,
        { role: 'user', content: params.message },
      ],
      { temperature: 0.4, maxTokens: 1600 }
    );
    try {
      const parsed = extractJson(content);
      const validated = (z.object({ answer: z.string(), actions: z.array(z.string()), references: z.array(z.string()) })).parse(parsed);
      return { data: validated, source: 'llm', model };
    } catch {
      return {
        data: { answer: content, actions: [`Focus next on \"${params.context.nextAction}\"`, 'Test understanding in Practice Lab'], references: params.context.gaps.filter((g) => g.priority === 'High').map((g) => g.skill).slice(0, 3) },
        source: 'llm',
        model,
      };
    }
  } catch (err) {
    const reason = err instanceof AiProviderError ? err.message : err instanceof Error ? err.message : 'Unknown LLM provider error';
    if (!cfg.demoMode) {
      if (err instanceof AiProviderError) throw err;
      throw new AiProviderError(502, reason);
    }
    console.warn('[EduPath Chat Fallback]', reason);
    const demoReply = buildDemoChatResponse({
      profile: params.profile,
      message: params.message,
      nextAction: params.context.nextAction,
      gaps: params.context.gaps,
      progress: params.context.progress,
      struggleSkills: params.context.struggleSkills,
    });
    return { data: { ...demoReply, answer: `> **Live AI unavailable (${reason}) — showing offline fallback guidance.**\n\n${demoReply.answer}` }, source: 'fallback', model: cfg.model, warning: reason };
  }
}

// Export fallback data for convenience.
export { fallback };
