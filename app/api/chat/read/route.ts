import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../lib/supabase/server";

type MarkChatReadBody = {
  tenantId?: string;
  patientId?: string;
  conversationId?: string;
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

  const body = (await request.json()) as MarkChatReadBody;
  if (!body.tenantId || !body.patientId || !body.conversationId) {
    return NextResponse.json(
      { error: "Faltan datos para marcar el chat como leido." },
      { status: 400 },
    );
  }

  const { data: patient } = await supabase
    .from("patients")
    .select("id,tenant_id,user_id")
    .eq("id", body.patientId)
    .eq("tenant_id", body.tenantId)
    .maybeSingle();

  if (!patient) {
    return NextResponse.json({ error: "Cliente no encontrado." }, { status: 404 });
  }

  if (patient.user_id !== user.id) {
    const { data: membership } = await supabase
      .from("tenant_members")
      .select("role,status")
      .eq("tenant_id", body.tenantId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    if (!membership || !["owner", "nutritionist"].includes(membership.role)) {
      return NextResponse.json(
        { error: "No tienes permisos para leer este chat." },
        { status: 403 },
      );
    }
  }

  const readAt = new Date().toISOString();
  const { data: messages, error: messageError } = await supabase
    .from("chat_messages")
    .update({ read_at: readAt })
    .eq("tenant_id", body.tenantId)
    .eq("patient_id", body.patientId)
    .eq("conversation_id", body.conversationId)
    .neq("sender_id", user.id)
    .is("read_at", null)
    .select("id");

  if (messageError) {
    return NextResponse.json({ error: messageError.message }, { status: 500 });
  }

  await supabase
    .from("app_notifications")
    .update({ read_at: readAt, email_fallback_due_at: null })
    .eq("tenant_id", body.tenantId)
    .eq("user_id", user.id)
    .eq("patient_id", body.patientId)
    .eq("type", "chat_message")
    .is("read_at", null);

  return NextResponse.json({
    ok: true,
    readAt,
    messageIds: (messages ?? []).map((message) => message.id),
  });
}
