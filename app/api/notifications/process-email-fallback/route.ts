import { NextResponse } from "next/server";
import { processDueChatEmailFallbacks } from "../../../lib/notifications/server";
import { getSupabaseAdmin, readRuntimeEnv } from "../../../lib/supabase/server";

type ProcessFallbackBody = {
  tenantId?: string;
};

export async function POST(request: Request) {
  const supabase = await getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase no esta configurado en el servidor." },
      { status: 500 },
    );
  }

  const body = await safeReadBody(request);
  const secret = await readRuntimeEnv("NOTIFICATION_JOB_SECRET");
  const providedSecret = request.headers.get("x-notification-job-secret");
  const authorizedBySecret = Boolean(secret && providedSecret === secret);

  if (!authorizedBySecret) {
    const token = request.headers
      .get("authorization")
      ?.replace(/^Bearer\s+/i, "")
      .trim();

    if (!token) {
      return NextResponse.json({ error: "Sesion no encontrada." }, { status: 401 });
    }

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      return NextResponse.json({ error: "Sesion no valida." }, { status: 401 });
    }

    if (!body.tenantId) {
      return NextResponse.json(
        { error: "Falta el espacio de trabajo." },
        { status: 400 },
      );
    }

    const hasAccess = await userCanAccessTenant(supabase, body.tenantId, user.id);
    if (!hasAccess) {
      return NextResponse.json(
        { error: "No tienes permisos para procesar este espacio." },
        { status: 403 },
      );
    }
  }

  const result = await processDueChatEmailFallbacks({
    supabase,
    request,
    tenantId: body.tenantId,
  });

  return NextResponse.json({ ok: true, ...result });
}

async function safeReadBody(request: Request): Promise<ProcessFallbackBody> {
  try {
    return (await request.json()) as ProcessFallbackBody;
  } catch {
    return {};
  }
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
