import { generateRewardsWithLlm } from "./lib/generateRewardsLlm";

type ReqLike = {
  method?: string;
  body?: unknown;
};

type ResLike = {
  status: (code: number) => ResLike;
  json: (payload: unknown) => void;
  setHeader: (name: string, value: string) => void;
  end: () => void;
};

export default async function handler(req: ReqLike, res: ResLike): Promise<void> {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method Not Allowed", hint: "Use POST /api/generate-rewards" });
    return;
  }

  const body = (req.body ?? {}) as { q1?: unknown; q2Band?: unknown; language?: unknown };
  const q1 = String(body.q1 ?? "").trim();
  const q2Band = String(body.q2Band ?? "").trim();
  const languageRaw = String(body.language ?? "").trim().toLowerCase();
  const language: "zh" | "en" = languageRaw === "en" ? "en" : "zh";

  if (!q1) {
    res.status(400).json({ error: "q1 不能为空" });
    return;
  }

  if (!["under_20", "20_50", "over_50"].includes(q2Band)) {
    res.status(400).json({ error: "q2Band 必须是 under_20 / 20_50 / over_50" });
    return;
  }

  const llmReady = Boolean(process.env.OPENAI_API_KEY?.trim() || process.env.ANTHROPIC_API_KEY?.trim());
  if (!llmReady) {
    res.status(503).json({
      error: "服务器未配置 LLM 密钥",
      hint: "请设置 OPENAI_API_KEY 或 ANTHROPIC_API_KEY",
    });
    return;
  }

  try {
    const rewards = await generateRewardsWithLlm(q1, q2Band, language);
    res.status(200).json({ rewards });
  } catch (e) {
    console.error("[api/generate-rewards] failed:", e);
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
}
