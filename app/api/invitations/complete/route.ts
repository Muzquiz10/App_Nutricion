import { NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "../../../lib/supabase/server";

type CompleteInvitationBody = {
  token?: string;
  fullName?: string;
  age?: number;
  heightCm?: number;
  currentWeightKg?: number;
  objective?: string;
  sex?: string;
  allergies?: string;
  avoidedFoods?: string;
  exerciseRoutine?: string;
  exerciseHoursPerWeek?: number;
  exerciseType?: string;
  password?: string;
  consentAccepted?: boolean;
};

const CURRENT_QUESTIONNAIRE_VERSION = 2;
const validObjectives = new Set([
  "Reducir peso",
  "Ganar masa muscular",
  "Bienestar",
  "Aprendizaje",
]);
const validSexes = new Set(["male", "female"]);

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

  const body = (await request.json()) as CompleteInvitationBody;
  if (
    !body.token ||
    !body.fullName?.trim() ||
    !body.age ||
    !body.heightCm ||
    !body.currentWeightKg ||
    !body.objective ||
    !body.sex ||
    body.exerciseHoursPerWeek === undefined ||
    !body.password ||
    !body.consentAccepted
  ) {
    return NextResponse.json(
      { error: "Faltan datos obligatorios o consentimiento." },
      { status: 400 },
    );
  }

  if (body.password.length < 8) {
    return NextResponse.json(
      { error: "La contraseña debe tener al menos 8 caracteres." },
      { status: 400 },
    );
  }

  if (!validObjectives.has(body.objective)) {
    return NextResponse.json(
      { error: "Selecciona un objetivo valido." },
      { status: 400 },
    );
  }

  if (!validSexes.has(body.sex)) {
    return NextResponse.json(
      { error: "Selecciona el sexo para calcular las calorias basales." },
      { status: 400 },
    );
  }

  if (body.exerciseHoursPerWeek < 0 || body.exerciseHoursPerWeek > 168) {
    return NextResponse.json(
      { error: "Horas de ejercicio no validas." },
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

  const fullName = body.fullName.trim();
  const authUserResult = await resolveInvitationUser({
    supabase,
    sessionToken,
    email: invitation.email,
    password: body.password,
    metadata: {
      full_name: fullName,
      tenant_id: invitation.tenant_id,
      invitation_token: body.token,
      role: "patient",
    },
  });

  if ("error" in authUserResult) {
    return NextResponse.json(
      { error: authUserResult.error },
      { status: authUserResult.status },
    );
  }

  const user = authUserResult.user;
  const patientCode = `PAT-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  const exerciseType = body.exerciseType?.trim() ?? "";
  const exerciseRoutine =
    body.exerciseRoutine?.trim() ||
    buildExerciseRoutine(body.exerciseHoursPerWeek, exerciseType);

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
      objective: body.objective,
      sex: body.sex,
      allergies: body.allergies?.trim() ?? "",
      avoided_foods: body.avoidedFoods?.trim() ?? "",
      exercise_routine: exerciseRoutine,
      exercise_hours_per_week: body.exerciseHoursPerWeek,
      exercise_type: exerciseType,
      questionnaire_version: CURRENT_QUESTIONNAIRE_VERSION,
      questionnaire_completed_at: new Date().toISOString(),
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

async function resolveInvitationUser({
  supabase,
  sessionToken,
  email,
  password,
  metadata,
}: {
  supabase: SupabaseClient;
  sessionToken?: string;
  email: string;
  password: string;
  metadata: Record<string, unknown>;
}): Promise<{ user: User } | { error: string; status: number }> {
  if (sessionToken) {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(sessionToken);

    if (error || !user?.email) {
      return { error: "Sesion no valida.", status: 401 };
    }

    if (user.email.toLowerCase() !== email.toLowerCase()) {
      return { error: "La invitacion pertenece a otro correo.", status: 403 };
    }

    const { data, error: updateError } =
      await supabase.auth.admin.updateUserById(user.id, {
        password,
        email_confirm: true,
        user_metadata: metadata,
      });

    if (updateError || !data.user) {
      return {
        error: updateError?.message ?? "No se pudo preparar el usuario.",
        status: 500,
      };
    }

    return { user: data.user };
  }

  const { data: createdUser, error: createError } =
    await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: metadata,
      app_metadata: { role: "patient" },
    });

  if (!createError && createdUser.user) {
    return { user: createdUser.user };
  }

  if (!createError?.message.toLowerCase().includes("already")) {
    return {
      error: createError?.message ?? "No se pudo crear el usuario.",
      status: 500,
    };
  }

  const existingUser = await findAuthUserByEmail(supabase, email);
  if (!existingUser) {
    return {
      error:
        "Ese correo ya existe en Auth, pero no se pudo localizar para reutilizarlo. Borralo en Authentication > Users y vuelve a aceptar la invitacion.",
      status: 409,
    };
  }

  const reusable = await canReuseExistingAuthUser(supabase, existingUser.id);
  if (!reusable) {
    return {
      error:
        "Ese correo ya pertenece a un usuario activo. Usa otro correo o revisa el usuario en Supabase.",
      status: 409,
    };
  }

  const { data: updatedUser, error: updateError } =
    await supabase.auth.admin.updateUserById(existingUser.id, {
      password,
      email_confirm: true,
      user_metadata: metadata,
      app_metadata: { role: "patient" },
    });

  if (updateError || !updatedUser.user) {
    return {
      error: updateError?.message ?? "No se pudo reutilizar el usuario.",
      status: 500,
    };
  }

  return { user: updatedUser.user };
}

async function findAuthUserByEmail(supabase: SupabaseClient, email: string) {
  const normalizedEmail = email.toLowerCase();

  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 1000,
    });

    if (error) return null;

    const match = data.users.find(
      (user) => user.email?.toLowerCase() === normalizedEmail,
    );
    if (match) return match;
    if (!data.nextPage) return null;
  }

  return null;
}

async function canReuseExistingAuthUser(
  supabase: SupabaseClient,
  userId: string,
) {
  const { data: patientRows } = await supabase
    .from("patients")
    .select("id")
    .eq("user_id", userId)
    .limit(1);

  if ((patientRows ?? []).length > 0) return false;

  const { data: membershipRows } = await supabase
    .from("tenant_members")
    .select("role,status")
    .eq("user_id", userId);

  return !(membershipRows ?? []).some(
    (membership) => membership.status === "active",
  );
}

function buildExerciseRoutine(hours: number, exerciseType: string) {
  const base = `${hours} h/semana`;
  if (!exerciseType) return base;
  return `${base} - ${exerciseType}`;
}
