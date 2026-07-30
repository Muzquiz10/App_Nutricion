import { InvitationAcceptApp } from "../../components/InvitationAcceptApp";
import { getSupabasePublicConfig } from "../../lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function InvitationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabaseConfig = await getSupabasePublicConfig();
  return <InvitationAcceptApp token={token} supabaseConfig={supabaseConfig} />;
}
