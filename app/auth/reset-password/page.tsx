import { PasswordResetApp } from "../../components/PasswordResetApp";
import { getSupabasePublicConfig } from "../../lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ResetPasswordPage() {
  const supabaseConfig = await getSupabasePublicConfig();
  return <PasswordResetApp supabaseConfig={supabaseConfig} />;
}
