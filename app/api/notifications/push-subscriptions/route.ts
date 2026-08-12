import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../lib/supabase/server";

type PushSubscriptionBody = {
  tenantId?: string;
  subscription?: {
    endpoint?: string;
    keys?: {
      p256dh?: string;
      auth?: string;
    };
  };
  endpoint?: string;
};

export async function POST(request: Request) {
  const supabase = await getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase no esta configurado en el servidor." },
      { status: 500 },
    );
  }

  const session = await getAuthenticatedUser(request, supabase);
  if ("error" in session) return session.error;

  const body = (await request.json()) as PushSubscriptionBody;
  const endpoint = body.subscription?.endpoint?.trim();
  const p256dh = body.subscription?.keys?.p256dh?.trim();
  const auth = body.subscription?.keys?.auth?.trim();

  if (!body.tenantId || !endpoint || !p256dh || !auth) {
    return NextResponse.json(
      { error: "Faltan datos para activar las notificaciones del dispositivo." },
      { status: 400 },
    );
  }

  const hasAccess = await userCanAccessTenant(supabase, body.tenantId, session.user.id);
  if (!hasAccess) {
    return NextResponse.json(
      { error: "No tienes permisos para configurar este espacio." },
      { status: 403 },
    );
  }

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      tenant_id: body.tenantId,
      user_id: session.user.id,
      endpoint,
      p256dh,
      auth,
      user_agent: request.headers.get("user-agent"),
      is_active: true,
      last_error: null,
    },
    { onConflict: "endpoint" },
  );

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const supabase = await getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase no esta configurado en el servidor." },
      { status: 500 },
    );
  }

  const session = await getAuthenticatedUser(request, supabase);
  if ("error" in session) return session.error;

  const body = (await request.json()) as PushSubscriptionBody;
  if (!body.tenantId) {
    return NextResponse.json(
      { error: "Falta el espacio de trabajo." },
      { status: 400 },
    );
  }

  let query = supabase
    .from("push_subscriptions")
    .update({ is_active: false })
    .eq("tenant_id", body.tenantId)
    .eq("user_id", session.user.id);

  if (body.endpoint) {
    query = query.eq("endpoint", body.endpoint);
  }

  const { error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

async function getAuthenticatedUser(
  request: Request,
  supabase: NonNullable<Awaited<ReturnType<typeof getSupabaseAdmin>>>,
) {
  const token = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "")
    .trim();

  if (!token) {
    return { error: NextResponse.json({ error: "Sesion no encontrada." }, { status: 401 }) };
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    return { error: NextResponse.json({ error: "Sesion no valida." }, { status: 401 }) };
  }

  return { user };
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
