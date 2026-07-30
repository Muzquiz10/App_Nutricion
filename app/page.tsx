import { headers } from "next/headers";
import { NutriOSApp } from "./components/NutriOSApp";
import { loadTenantBySlug } from "./lib/supabase/tenant-server";
import { getSupabasePublicConfig } from "./lib/supabase/server";
import { resolveTenantSlugFromHost } from "./lib/tenant";

export const dynamic = "force-dynamic";

export default async function Home() {
  const requestHeaders = await headers();
  const tenantSlug = resolveTenantSlugFromHost(requestHeaders.get("host"));
  const initialTenant = await loadTenantBySlug(tenantSlug);
  const supabaseConfig = await getSupabasePublicConfig();

  return (
    <NutriOSApp
      tenantSlug={tenantSlug}
      initialTenant={initialTenant}
      supabaseConfig={supabaseConfig}
    />
  );
}
