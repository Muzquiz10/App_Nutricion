"use client";

import { createBrowserClient } from "@supabase/ssr";

export type SupabasePublicConfig = {
  url: string;
  anonKey: string;
};

export function hasSupabaseBrowserConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function createSupabaseBrowser(config?: SupabasePublicConfig | null) {
  const url = config?.url ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = config?.anonKey ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) return null;
  return createBrowserClient(url, anonKey);
}
