export type GeneratedRewardItem = {
  tier: string;
  title: string;
  points: number;
  reason: string;
};

const TIER_ORDER_BY_LANG: Record<"zh" | "en", string[]> = {
  zh: ["即时奖励", "即时奖励", "恢复配额", "恢复配额", "升级奖励", "主线兑现"],
  en: ["Instant", "Instant", "Restore", "Restore", "Upgrade", "Milestone"],
};

const Q2_LABELS: Record<"zh" | "en", Record<string, string>> = {
  zh: {
    under_20: "20分以下",
    "20_50": "20-50分",
    over_50: "50分以上",
  },
  en: {
    under_20: "Below 20 points/day",
    "20_50": "20-50 points/day",
    over_50: "Above 50 points/day",
  },
};

function expectedTiersFor(language: "zh" | "en"): string[] {
  return TIER_ORDER_BY_LANG[language] ?? TIER_ORDER_BY_LANG.zh;
}

function jsonContractFor(language: "zh" | "en"): string {
  const tiers = expectedTiersFor(language);
  if (language === "en") {
    return `Output exactly one JSON object in this schema:
{"rewards":[{"tier":"${tiers[0]}","title":"Reward name","points":20,"reason":"A brief reason"},{"tier":"${tiers[1]}","title":"Reward name","points":20,"reason":"A brief reason"},{"tier":"${tiers[2]}","title":"Reward name","points":50,"reason":"A brief reason"},{"tier":"${tiers[3]}","title":"Reward name","points":50,"reason":"A brief reason"},{"tier":"${tiers[4]}","title":"Reward name","points":100,"reason":"A brief reason"},{"tier":"${tiers[5]}","title":"Reward name","points":500,"reason":"A brief reason"}]}
Additional rules: rewards length must be 6; tier order must exactly match the schema; points must be positive integers; reason should stay concise (<= 12 words).`;
  }
  return `你必须只输出一个 JSON 对象，结构如下：
{"rewards":[{"tier":"${tiers[0]}","title":"奖励名称","points":20,"reason":"今天就能拿到的小确幸"},{"tier":"${tiers[1]}","title":"奖励名称","points":20,"reason":"低成本的即时快乐"},{"tier":"${tiers[2]}","title":"奖励名称","points":50,"reason":"给自己一个合法摸鱼权"},{"tier":"${tiers[3]}","title":"奖励名称","points":50,"reason":"消除疲劳，快速回血"},{"tier":"${tiers[4]}","title":"奖励名称","points":100,"reason":"中期目标，周末可期"},{"tier":"${tiers[5]}","title":"奖励名称","points":500,"reason":"长期大招，值得等待"}]}
规则补充：rewards 长度固定 6，tier 顺序必须与上面一致；points 必须是正整数；reason 每项不超过 10 个字。`;
}

function buildSystemPrompt(q1: string, q2Band: string, language: "zh" | "en"): string {
  const q2 = Q2_LABELS[language][q2Band] ?? q2Band;
  const tierOrder = expectedTiersFor(language).join(" -> ");
  return `你是一个懂行为经济学的私人成长教练。你的任务是根据用户最想做的事（${q1}）和他们每天的积分获取能力（${q2}），为他们设计一套符合『目标梯度效应』的四档奖励清单。
规则：
1. 即时奖励必须是今天就能实现的小事；主线兑现必须是真正让人期待的大事。
2. 奖励名称要口语化、有画面感（例如：'瘫在沙发上刷一小时剧'，而不是'休息'）。
3. 必须为每个奖励附带一句 10 个字以内的生成理由，帮用户理解为什么这样设置。
4. 你必须严格输出合法的 JSON 格式，不要包含任何 Markdown 标记或多余的文字。
CRITICAL INSTRUCTION:
- You MUST generate 'tier', 'title', and 'reason' strictly in the user's requested language: ${language}.
- Tier values MUST use this exact order and exact wording: ${tierOrder}.
- If language is 'en', do NOT output any Chinese text. If language is 'zh', do NOT output any English text.`;
}

function stripFence(raw: string): string {
  let t = raw.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "");
  }
  return t.trim();
}

function normalizePoints(n: number): number {
  if (!Number.isFinite(n)) return 20;
  return Math.max(5, Math.round(n / 5) * 5);
}

function parseRewards(raw: string, language: "zh" | "en"): GeneratedRewardItem[] {
  const expectedTiers = expectedTiersFor(language);
  const parsed = JSON.parse(stripFence(raw)) as { rewards?: unknown };
  if (!parsed || !Array.isArray(parsed.rewards) || parsed.rewards.length !== 6) {
    throw new Error("模型输出不是 6 条 rewards");
  }
  return parsed.rewards.map((item, idx) => {
    const it = item as Record<string, unknown>;
    const title = String(it.title ?? "").trim();
    const reason = String(it.reason ?? "").trim();
    const points = normalizePoints(Number(it.points));
    const tier = String(it.tier ?? "").trim();
    if (!title) {
      throw new Error(`第 ${idx + 1} 项缺少 title`);
    }
    if (tier !== expectedTiers[idx]) {
      throw new Error(`第 ${idx + 1} 项 tier 无效`);
    }
    return { tier, title, points, reason };
  });
}

async function callOpenAi(systemPrompt: string, language: "zh" | "en"): Promise<string> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error("未配置 OPENAI_API_KEY");
  const model = process.env.OPENAI_REWARD_MODEL?.trim() || "gpt-4o-mini";

  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: jsonContractFor(language) },
    ],
    temperature: 0.65,
  };
  if (!model.includes("gpt-3.5")) {
    body.response_format = { type: "json_object" };
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`OpenAI 请求失败(${res.status}): ${detail.slice(0, 280)}`);
  }
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI 返回为空");
  return content;
}

async function callAnthropic(systemPrompt: string, language: "zh" | "en"): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) throw new Error("未配置 ANTHROPIC_API_KEY");
  const model = process.env.ANTHROPIC_REWARD_MODEL?.trim() || "claude-3-5-haiku-20241022";

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: "user", content: jsonContractFor(language) }],
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Anthropic 请求失败(${res.status}): ${detail.slice(0, 280)}`);
  }
  const json = (await res.json()) as {
    content?: Array<{ type?: string; text?: string }>;
  };
  const text = (json.content ?? [])
    .filter((x) => x.type === "text")
    .map((x) => x.text ?? "")
    .join("");
  if (!text.trim()) throw new Error("Anthropic 返回为空");
  return text;
}

async function callDeepSeek(systemPrompt: string, language: "zh" | "en"): Promise<string> {
  const key = process.env.DEEPSEEK_API_KEY?.trim();
  if (!key) throw new Error("未配置 DEEPSEEK_API_KEY");
  const model = process.env.DEEPSEEK_REWARD_MODEL?.trim() || "deepseek-chat";

  const body = {
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: jsonContractFor(language) },
    ],
    temperature: 0.65,
  };

  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`DeepSeek 请求失败(${res.status}): ${detail.slice(0, 280)}`);
  }
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error("DeepSeek 返回为空");
  return content;
}

export async function generateRewardsWithLlm(
  q1: string,
  q2Band: string,
  language: "zh" | "en"
): Promise<GeneratedRewardItem[]> {
  const prompt = buildSystemPrompt(q1.trim(), q2Band, language);
  const prefer = String(process.env.LLM_PROVIDER ?? "").toLowerCase();
  const hasOpenAi = Boolean(process.env.OPENAI_API_KEY?.trim());
  const hasAnthropic = Boolean(process.env.ANTHROPIC_API_KEY?.trim());
  const hasDeepSeek = Boolean(process.env.DEEPSEEK_API_KEY?.trim());

  let raw = "";
  try {
    if (prefer === "deepseek") {
      raw = await callDeepSeek(prompt, language);
    } else if (prefer === "anthropic") {
      raw = await callAnthropic(prompt, language);
    } else if (prefer === "openai") {
      raw = await callOpenAi(prompt, language);
    } else if (hasOpenAi) {
      raw = await callOpenAi(prompt, language);
    } else if (hasDeepSeek) {
      raw = await callDeepSeek(prompt, language);
    } else {
      raw = await callAnthropic(prompt, language);
    }
  } catch (err) {
    if (prefer === "anthropic" && hasOpenAi) {
      raw = await callOpenAi(prompt, language);
    } else if (prefer === "openai" && hasDeepSeek) {
      raw = await callDeepSeek(prompt, language);
    } else if (prefer === "deepseek" && hasOpenAi) {
      raw = await callOpenAi(prompt, language);
    } else if ((prefer === "openai" || prefer === "deepseek") && hasAnthropic) {
      raw = await callAnthropic(prompt, language);
    } else if (prefer === "" && hasDeepSeek && hasAnthropic) {
      raw = await callAnthropic(prompt, language);
    } else {
      throw err;
    }
  }
  return parseRewards(raw, language);
}
