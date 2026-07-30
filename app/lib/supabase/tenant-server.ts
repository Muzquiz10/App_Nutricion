import type { Tenant } from "../types";
import { getSupabaseAdmin } from "./server";

export async function loadTenantBySlug(slug: string): Promise<Tenant | null> {
  const supabase = await getSupabaseAdmin();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("tenants")
    .select("id,slug,name,logo_url,primary_color,privacy_policy_url")
    .eq("slug", slug)
    .maybeSingle();

  if (error || !data) return null;
  return data as Tenant;
}
