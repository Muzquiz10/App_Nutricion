import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../lib/supabase/server";

type GoalStatus = "fulfilled" | "in_progress" | "not_fulfilled";

type CustomGoalLogInput = {
  goalId?: string;
  status?: GoalStatus;
  value?: number | null;
};

type MealPhotoLogInput = {
  storagePath?: string;
  mealType?: string;
  notes?: string;
  loggedAt?: string;
};

type TrackingLogsBody = {
  tenantId?: string;
  patientId?: string;
  weightKg?: number | null;
  waistCm?: number | null;
  steps?: number | null;
  exercise?: string | null;
  durationMinutes?: number | null;
  customGoalLogs?: CustomGoalLogInput[];
  mealPhoto?: MealPhotoLogInput | null;
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

  const body = (await request.json()) as TrackingLogsBody;
  if (!body.tenantId || !body.patientId) {
    return NextResponse.json(
      { error: "Faltan cliente o tenant para registrar datos." },
      { status: 400 },
    );
  }

  const { data: patient, error: patientError } = await supabase
    .from("patients")
    .select("id,tenant_id,user_id,status")
    .eq("tenant_id", body.tenantId)
    .eq("id", body.patientId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (patientError || !patient || patient.status !== "active") {
    return NextResponse.json(
      { error: "No tienes permisos para registrar datos en este cliente." },
      { status: 403 },
    );
  }

  const validationError = validateTrackingPayload(body);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const customGoalLogs = body.customGoalLogs ?? [];
  if (customGoalLogs.length > 0) {
    const goalValidationError = await validateCustomGoals(
      supabase,
      body.tenantId,
      body.patientId,
      customGoalLogs,
    );
    if (goalValidationError) {
      return NextResponse.json({ error: goalValidationError }, { status: 403 });
    }
  }

  const writeError = await writeTrackingLogs(supabase, body);
  if (writeError) {
    return NextResponse.json({ error: writeError }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

function validateTrackingPayload(body: TrackingLogsBody) {
  if (body.weightKg != null && (!Number.isFinite(body.weightKg) || body.weightKg <= 0)) {
    return "Peso no valido.";
  }

  if (body.waistCm != null && (!Number.isFinite(body.waistCm) || body.waistCm <= 0)) {
    return "Medida de cintura no valida.";
  }

  if (
    body.steps != null &&
    (!Number.isInteger(body.steps) || body.steps < 0 || body.steps > 200000)
  ) {
    return "Pasos no validos.";
  }

  if (
    body.durationMinutes != null &&
    (!Number.isFinite(body.durationMinutes) || body.durationMinutes < 0)
  ) {
    return "Duracion de actividad no valida.";
  }

  for (const goalLog of body.customGoalLogs ?? []) {
    if (!goalLog.goalId || !isGoalStatus(goalLog.status)) {
      return "Objetivo personalizado no valido.";
    }

    if (
      goalLog.value != null &&
      (!Number.isFinite(goalLog.value) || goalLog.value < 0)
    ) {
      return "Valor de objetivo no valido.";
    }
  }

  if (body.mealPhoto) {
    if (!body.mealPhoto.storagePath || !body.mealPhoto.mealType || !body.mealPhoto.loggedAt) {
      return "Faltan datos de la foto de comida.";
    }
  }

  return "";
}

async function validateCustomGoals(
  supabase: Awaited<ReturnType<typeof getSupabaseAdmin>>,
  tenantId: string,
  patientId: string,
  logs: CustomGoalLogInput[],
) {
  if (!supabase) return "Supabase no esta configurado en el servidor.";

  const goalIds = [...new Set(logs.map((item) => item.goalId).filter(Boolean))];
  const { data, error } = await supabase
    .from("patient_goals")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("patient_id", patientId)
    .eq("goal_type", "custom")
    .eq("is_active", true)
    .in("id", goalIds);

  if (error) return error.message;
  if ((data ?? []).length !== goalIds.length) {
    return "No tienes permisos para registrar uno de estos objetivos.";
  }

  return "";
}

async function writeTrackingLogs(
  supabase: Awaited<ReturnType<typeof getSupabaseAdmin>>,
  body: TrackingLogsBody,
) {
  if (!supabase || !body.tenantId || !body.patientId) {
    return "Supabase no esta configurado en el servidor.";
  }

  const now = new Date().toISOString();
  const loggedOn = getDateKey(now);

  if (body.weightKg != null) {
    const { error } = await supabase.from("weight_logs").insert({
      tenant_id: body.tenantId,
      patient_id: body.patientId,
      weight_kg: body.weightKg,
      source: "patient",
    });
    if (error) return formatTrackingDatabaseError(error);

    const { error: patientError } = await supabase
      .from("patients")
      .update({
        current_weight_kg: body.weightKg,
        updated_at: now,
      })
      .eq("id", body.patientId);
    if (patientError) return formatTrackingDatabaseError(patientError);
  }

  if (body.waistCm != null) {
    const { error } = await supabase.from("waist_logs").insert({
      tenant_id: body.tenantId,
      patient_id: body.patientId,
      waist_cm: body.waistCm,
    });
    if (error) return formatTrackingDatabaseError(error);
  }

  if (body.steps != null) {
    const { error } = await supabase.from("step_logs").upsert(
      {
        tenant_id: body.tenantId,
        patient_id: body.patientId,
        steps: body.steps,
        logged_on: loggedOn,
        source: "patient",
        updated_at: now,
      },
      { onConflict: "patient_id,logged_on" },
    );
    if (error) return formatTrackingDatabaseError(error);
  }

  if (body.exercise?.trim()) {
    const { error } = await supabase.from("exercise_logs").insert({
      tenant_id: body.tenantId,
      patient_id: body.patientId,
      activity: body.exercise.trim(),
      duration_minutes: body.durationMinutes ?? null,
      intensity: "normal",
    });
    if (error) return formatTrackingDatabaseError(error);
  }

  for (const goalLog of body.customGoalLogs ?? []) {
    const { error } = await supabase.from("patient_goal_logs").upsert(
      {
        tenant_id: body.tenantId,
        patient_id: body.patientId,
        goal_id: goalLog.goalId,
        logged_on: loggedOn,
        status: goalLog.status,
        value: goalLog.value ?? null,
        updated_at: now,
      },
      { onConflict: "goal_id,logged_on" },
    );
    if (error) return formatTrackingDatabaseError(error);
  }

  if (body.mealPhoto) {
    const { error } = await supabase.from("meal_photos").insert({
      tenant_id: body.tenantId,
      patient_id: body.patientId,
      storage_path: body.mealPhoto.storagePath,
      meal_type: body.mealPhoto.mealType,
      notes: body.mealPhoto.notes ?? "",
      logged_at: body.mealPhoto.loggedAt,
    });
    if (error) return formatTrackingDatabaseError(error);
  }

  return "";
}

function getDateKey(value: string) {
  return value.slice(0, 10);
}

function isGoalStatus(status: unknown): status is GoalStatus {
  return (
    status === "fulfilled" ||
    status === "in_progress" ||
    status === "not_fulfilled"
  );
}

function formatTrackingDatabaseError(error: unknown) {
  if (!error || typeof error !== "object") {
    return "No se pudo registrar el dato.";
  }

  const details = error as { code?: string; message?: string };
  if (
    details.code === "42501" ||
    details.message?.toLowerCase().includes("row-level security")
  ) {
    return "Supabase ha rechazado el registro por permisos. Cierra sesion y vuelve a entrar; si sigue pasando, revisa que el cliente este activo.";
  }

  return details.message ?? "No se pudo registrar el dato.";
}
