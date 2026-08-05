import { headers } from "next/headers";
import { NutriOSApp } from "./components/NutriOSApp";
import { getSupabasePublicConfig } from "./lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Home() {
  await headers();
  const supabaseConfig = await getSupabasePublicConfig();

  return (
    <NutriOSApp
      tenantSlug="app"
      commonEntry
      supabaseConfig={supabaseConfig}
    />
  );
}
