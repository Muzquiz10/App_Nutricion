import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../lib/supabase/server";

type NotificationPreferencesBody = {
  tenantId?: string;
  emailEnabled?: boolean;
  pushEnabled?: boolean;
};

export async function POST(request: Request) {
  const supabase = await getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase no esta configurado en el servidor." },
      { status: 500 },
    );
  }

  const token = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "")
    .trim();

  if (!token) {
    return NextResponse.json({ error: "Sesion no encontrada." }, { status: 401 });
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);

  if (userError || !user) {
    return NextResponse.json({ error: "Sesion no valida." }, { status: 401 });
  }

  const body = (await request.json()) as NotificationPreferencesBody;
  if (!body.tenantId) {
    return NextResponse.json(
      { error: "Falta el espacio de trabajo." },
      { status: 400 },
    );
  }

  const hasAccess = await userCanAccessTenant(supabase, body.tenantId, user.id);
  if (!hasAccess) {
    return NextResponse.json(
      { error: "No tienes permisos para configurar este espacio." },
      { status: 403 },
    );
  }

  const { data, error } = await supabase
    .from("notification_preferences")
    .upsert(
      {
        tenant_id: body.tenantId,
        user_id: user.id,
        email_enabled: body.emailEnabled ?? true,
        push_enabled: body.pushEnabled ?? true,
      },
      { onConflict: "tenant_id,user_id" },
    )
    .select("tenant_id,user_id,email_enabled,push_enabled")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "No se pudieron guardar las preferencias." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, preferences: data });
}

async function userCanAccessTenant(
  supabase: NonNullable<Awaited<ReturnType<typeof getSupabaseAdmin>>>,
  tenantId: string,
  userId: string,
) {
  const { data: membership } = await supabase
    .from("tenant_members")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (membership) return true;

  const { data: patient } = await supabase
    .from("patients")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  return Boolean(patient);
}
