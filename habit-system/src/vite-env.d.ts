/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_HABIT_API_BASE?: string;
  readonly VITE_APP_MODE?: string;
  /** OpenAI-兼容接口（如 OpenAI、DeepSeek）的 Key；勿写入代码，仅 Vercel/本地 .env */
  readonly VITE_AI_API_KEY?: string;
  /** 默认 https://api.openai.com/v1 ；DeepSeek 示例: https://api.deepseek.com/v1 */
  readonly VITE_AI_BASE_URL?: string;
  /** 默认 gpt-4o-mini ；DeepSeek 常用 deepseek-chat */
  readonly VITE_AI_MODEL?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
