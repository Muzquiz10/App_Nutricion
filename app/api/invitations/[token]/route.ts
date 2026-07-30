import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../lib/supabase/server";

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const supabase = await getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase no esta configurado en el servidor." },
      { status: 500 },
    );
  }

  const { token } = await context.params;
  const { data, error } = await supabase
    .from("invitations")
    .select(
      "id,email,role,status,expires_at,tenant:tenants(id,slug,name,logo_url,primary_color,privacy_policy_url)",
    )
    .eq("token", token)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json(
      { error: "Invitacion no encontrada." },
      { status: 404 },
    );
  }

  if (data.status !== "pending" || new Date(data.expires_at) < new Date()) {
    return NextResponse.json(
      { error: "La invitacion ya no esta activa." },
      { status: 410 },
    );
  }

  return NextResponse.json(data);
}
