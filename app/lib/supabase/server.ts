import { createClient } from "@supabase/supabase-js";

export async function getSupabaseAdmin() {
  const url = await readRuntimeEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = await readRuntimeEnv("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !serviceRoleKey) return null;

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function getSupabasePublicConfig() {
  const url = await readRuntimeEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = await readRuntimeEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  if (!url || !anonKey) return null;

  return {
    url,
    anonKey,
  };
}

export async function getPublicAppOrigin(request: Request) {
  const configuredOrigin = await readRuntimeEnv("NEXT_PUBLIC_APP_URL");
  if (configuredOrigin) return configuredOrigin.replace(/\/$/, "");

  const origin = request.headers.get("origin");
  if (origin) return origin.replace(/\/$/, "");

  const host = request.headers.get("host") ?? "localhost:3000";
  const protocol = host.includes("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}

async function readRuntimeEnv(name: string) {
  if (process.env[name]) return process.env[name];

  try {
    const workerModule = (await import("cloudflare:workers")) as unknown as {
      env?: Record<string, string | undefined>;
    };
    return workerModule.env?.[name];
  } catch {
    return undefined;
  }
}
