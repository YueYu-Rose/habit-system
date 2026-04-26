import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

/**
 * 若未配置 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY，返回 null，应用回退为本地 Mock 认证与 LocalStorage
 */
export function isSupabaseConfigured(): boolean {
  const u = String(import.meta.env.VITE_SUPABASE_URL ?? "").trim();
  const k = String(import.meta.env.VITE_SUPABASE_ANON_KEY ?? "").trim();
  return Boolean(u && k);
}

export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (client) return client;
  const url = String(import.meta.env.VITE_SUPABASE_URL).trim();
  const anon = String(import.meta.env.VITE_SUPABASE_ANON_KEY).trim();
  client = createClient(url, anon, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return client;
}
