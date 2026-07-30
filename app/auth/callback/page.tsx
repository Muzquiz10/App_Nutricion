import { AuthCallbackApp } from "../../components/AuthCallbackApp";
import { getSupabasePublicConfig } from "../../lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AuthCallbackPage() {
  const supabaseConfig = await getSupabasePublicConfig();
  return <AuthCallbackApp supabaseConfig={supabaseConfig} />;
}
