import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../lib/supabase/server";

type CompleteInvitationBody = {
  token?: string;
  fullName?: string;
  age?: number;
  heightCm?: number;
  currentWeightKg?: number;
  allergies?: string;
  avoidedFoods?: string;
  exerciseRoutine?: string;
  consentAccepted?: boolean;
};

export async function POST(request: Request) {
  const supabase = await getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase no esta configurado en el servidor." },
      { status: 500 },
    );
  }

  const sessionToken = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "")
    .trim();

  if (!sessionToken) {
    return NextResponse.json({ error: "Sesion no encontrada." }, { status: 401 });
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(sessionToken);

  if (userError || !user?.email) {
    return NextResponse.json({ error: "Sesion no valida." }, { status: 401 });
  }

  const body = (await request.json()) as CompleteInvitationBody;
  if (
    !body.token ||
    !body.fullName?.trim() ||
    !body.age ||
    !body.heightCm ||
    !body.currentWeightKg ||
    !body.consentAccepted
  ) {
    return NextResponse.json(
      { error: "Faltan datos obligatorios o consentimiento." },
      { status: 400 },
    );
  }

  const { data: invitation, error: invitationError } = await supabase
    .from("invitations")
    .select("id,email,status,expires_at,tenant_id,invited_by")
    .eq("token", body.token)
    .maybeSingle();

  if (invitationError || !invitation) {
    return NextResponse.json(
      { error: "Invitacion no encontrada." },
      { status: 404 },
    );
  }

  if (
    invitation.status !== "pending" ||
    new Date(invitation.expires_at) < new Date()
  ) {
    return NextResponse.json(
      { error: "La invitacion ya no esta activa." },
      { status: 410 },
    );
  }

  if (invitation.email.toLowerCase() !== user.email.toLowerCase()) {
    return NextResponse.json(
      { error: "La invitacion pertenece a otro correo." },
      { status: 403 },
    );
  }

  const fullName = body.fullName.trim();
  const patientCode = `PAT-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

  const { error: profileError } = await supabase.from("profiles").upsert({
    user_id: user.id,
    full_name: fullName,
    global_role: "patient",
    updated_at: new Date().toISOString(),
  });

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  const { error: memberError } = await supabase.from("tenant_members").upsert(
    {
      tenant_id: invitation.tenant_id,
      user_id: user.id,
      role: "patient",
      status: "active",
    },
    { onConflict: "tenant_id,user_id" },
  );

  if (memberError) {
    return NextResponse.json({ error: memberError.message }, { status: 500 });
  }

  const { data: patient, error: patientError } = await supabase
    .from("patients")
    .insert({
      tenant_id: invitation.tenant_id,
      user_id: user.id,
      nutritionist_user_id: invitation.invited_by,
      patient_code: patientCode,
      full_name: fullName,
      age: body.age,
      height_cm: body.heightCm,
      initial_weight_kg: body.currentWeightKg,
      current_weight_kg: body.currentWeightKg,
      allergies: body.allergies?.trim() ?? "",
      avoided_foods: body.avoidedFoods?.trim() ?? "",
      exercise_routine: body.exerciseRoutine?.trim() ?? "",
      consent_given_at: new Date().toISOString(),
      gdpr_policy_version: "2026-07-30",
    })
    .select("id")
    .single();

  if (patientError || !patient) {
    return NextResponse.json(
      { error: patientError?.message ?? "No se pudo crear la ficha." },
      { status: 500 },
    );
  }

  await supabase.from("weight_logs").insert({
    tenant_id: invitation.tenant_id,
    patient_id: patient.id,
    weight_kg: body.currentWeightKg,
    source: "initial",
    logged_at: new Date().toISOString(),
  });

  await supabase.from("consent_records").insert({
    tenant_id: invitation.tenant_id,
    user_id: user.id,
    patient_id: patient.id,
    consent_type: "privacy_and_health_data",
    policy_version: "2026-07-30",
  });

  await supabase.from("conversations").insert({
    tenant_id: invitation.tenant_id,
    patient_id: patient.id,
    nutritionist_user_id: invitation.invited_by,
  });

  await supabase
    .from("invitations")
    .update({ status: "accepted", accepted_at: new Date().toISOString() })
    .eq("id", invitation.id);

  return NextResponse.json({ ok: true, patientId: patient.id });
}
