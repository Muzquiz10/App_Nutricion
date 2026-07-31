import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../lib/supabase/server";

type SendChatMessageBody = {
  tenantId?: string;
  patientId?: string;
  body?: string;
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

  const body = (await request.json()) as SendChatMessageBody;
  const messageBody = body.body?.trim();
  if (!body.tenantId || !body.patientId || !messageBody) {
    return NextResponse.json(
      { error: "Faltan datos para enviar el mensaje." },
      { status: 400 },
    );
  }

  const { data: patient, error: patientError } = await supabase
    .from("patients")
    .select("id,tenant_id,user_id,nutritionist_user_id")
    .eq("id", body.patientId)
    .eq("tenant_id", body.tenantId)
    .maybeSingle();

  if (patientError || !patient) {
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
        { error: "No tienes permisos para enviar mensajes a este cliente." },
        { status: 403 },
      );
    }
  }

  const { data: existingConversation } = await supabase
    .from("conversations")
    .select("*")
    .eq("tenant_id", body.tenantId)
    .eq("patient_id", body.patientId)
    .maybeSingle();

  const conversation =
    existingConversation ??
    (
      await supabase
        .from("conversations")
        .upsert(
          {
            tenant_id: body.tenantId,
            patient_id: body.patientId,
            nutritionist_user_id: patient.nutritionist_user_id,
          },
          { onConflict: "tenant_id,patient_id" },
        )
        .select("*")
        .single()
    ).data;

  if (!conversation) {
    return NextResponse.json(
      { error: "No se pudo preparar la conversacion." },
      { status: 500 },
    );
  }

  const { data: message, error: messageError } = await supabase
    .from("chat_messages")
    .insert({
      tenant_id: body.tenantId,
      conversation_id: conversation.id,
      patient_id: body.patientId,
      sender_id: user.id,
      body: messageBody,
    })
    .select("*")
    .single();

  if (messageError || !message) {
    return NextResponse.json(
      { error: messageError?.message ?? "No se pudo enviar el mensaje." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, conversation, message });
}
