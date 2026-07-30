import { NutriOSApp } from "../../components/NutriOSApp";
import { loadTenantBySlug } from "../../lib/supabase/tenant-server";
import { getSupabasePublicConfig } from "../../lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function TenantPreviewPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant } = await params;
  const initialTenant = await loadTenantBySlug(tenant);
  const supabaseConfig = await getSupabasePublicConfig();

  return (
    <NutriOSApp
      tenantSlug={tenant}
      initialTenant={initialTenant}
      supabaseConfig={supabaseConfig}
    />
  );
}
