import { buildWeekHabitDataSummaryForModel } from "../lib/weekHabitAnalysis";

const COACH_SYSTEM_PROMPT = `你是一位在英国工作的资深效率专家。请根据用户给出的习惯数据，输出三条犀利、幽默且具有实操性的**英文**建议。请用 **Markdown** 返回（可含小标题、列表、加粗），语气要符合极客感 AI 产品经理的范儿。**回复全文必须使用英文。**
结构建议：先一行 \`##\` 风格标题，再三个列表项，每项用加粗小标题开头 (如 **Sprint check:** ）。`;

const DEFAULT_BASE = "https://api.openai.com/v1";
const DEFAULT_MODEL = "gpt-4o-mini";

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

type OpenAICompatResponse = {
  choices?: { message?: { content?: string } }[];
  error?: { message?: string };
};

function isPromotionBuild(): boolean {
  return String(import.meta.env.VITE_APP_MODE ?? "PERSONAL").toUpperCase() === "PROMOTION";
}

function getApiKey(): string {
  return String(import.meta.env.VITE_AI_API_KEY ?? "").trim();
}

function getBaseUrl(): string {
  const raw = String(import.meta.env.VITE_AI_BASE_URL ?? "").trim();
  return raw || DEFAULT_BASE;
}

function getModel(): string {
  const raw = String(import.meta.env.VITE_AI_MODEL ?? "").trim();
  return raw || DEFAULT_MODEL;
}

/**
 * 推广版无 Key 时：高质感 Mock，便于演示
 */
function getDeepMockHabitCoachMarkdown(): string {
  return `## Week verdict: your data has opinions

- **Sprint review:** The delta between *“I will sleep on time”* and your log is a classic *scope miss*—you’re not failing discipline; you’re failing estimation. Tighten the loop: one non-negotiable *lights-out* block, 5 nights/7, then ship.

- **Velocity hack:** Stacking 5 micro-wins (wake, English, 10 minutes of move) before noon compounds faster than a heroic Sunday reset. **Batch like a release train**, not a waterfall death march.

- **PM move:** On Sunday, run a 10-minute *retro*—*green / amber / red* for sleep, move, and focus. If red twice in a row, **cut scope** (fewer habits) until green; velocity without stability is just noisy logging.

*Mock coach output — set \`VITE_AI_API_KEY\` for live model responses.*`;
}

export class AiCoachError extends Error {
  constructor(
    message: string,
    readonly code: "NO_KEY" | "HTTP" | "EMPTY" = "HTTP"
  ) {
    super(message);
    this.name = "AiCoachError";
  }
}

async function postChatCompletions(userContent: string): Promise<string> {
  const key = getApiKey();
  if (!key) {
    if (isPromotionBuild()) {
      return getDeepMockHabitCoachMarkdown();
    }
    throw new AiCoachError("Missing VITE_AI_API_KEY in environment", "NO_KEY");
  }

  const base = getBaseUrl().replace(/\/$/, "");
  const url = `${base}/chat/completions`;
  const model = getModel();
  const body = {
    model,
    temperature: 0.65,
    max_tokens: 800,
    messages: [
      { role: "system" as const, content: COACH_SYSTEM_PROMPT },
      { role: "user" as const, content: userContent },
    ] satisfies ChatMessage[],
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
  });

  const json = (await res.json()) as OpenAICompatResponse;
  if (!res.ok) {
    const msg = json.error?.message ?? res.statusText ?? `HTTP ${res.status}`;
    throw new AiCoachError(msg, "HTTP");
  }
  const text = json.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new AiCoachError("Empty model response", "EMPTY");
  }
  return text;
}

/**
 * 从 LocalStorage 汇总过去一周并调用 OpenAI-兼容 Chat API 返回教练文案（英文 Markdown）
 */
export async function requestHabitCoachAnalysis(): Promise<string> {
  const dataText = buildWeekHabitDataSummaryForModel();
  if (isPromotionBuild() && !getApiKey()) {
    // 明确先走「深度 Mock」，避免多一次网络；若将来要在 Mock 中混入 `dataText` 可在模板里 `console.log` 或拼接摘要行
    return [getDeepMockHabitCoachMarkdown(), "", `---`, "", `*Data used (device):*`, dataText].join(
      "\n"
    );
  }
  if (!getApiKey()) {
    throw new AiCoachError("Missing VITE_AI_API_KEY in environment", "NO_KEY");
  }
  return postChatCompletions(
    `Here is the habit data:\n\n${dataText}\n\nRespond in English with Markdown.`
  );
}
