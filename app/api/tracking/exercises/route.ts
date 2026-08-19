import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../lib/supabase/server";

type ExerciseMutationBody =
  | {
      action?: "update";
      tenantId?: string;
      patientId?: string;
      exerciseId?: string;
      activity?: string;
      durationSeconds?: number | null;
      distanceKm?: number | null;
    }
  | {
      action?: "delete";
      tenantId?: string;
      patientId?: string;
      exerciseId?: string;
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

  const body = (await request.json()) as ExerciseMutationBody;
  if (!body.tenantId || !body.patientId || !body.exerciseId) {
    return NextResponse.json(
      { error: "Faltan datos para modificar la actividad." },
      { status: 400 },
    );
  }

  const accessError = await validateExerciseAccess(
    supabase,
    user.id,
    body.tenantId,
    body.patientId,
    body.exerciseId,
  );

  if (accessError) {
    return NextResponse.json({ error: accessError }, { status: 403 });
  }

  if (body.action === "delete") {
    const { error } = await supabase
      .from("exercise_logs")
      .delete()
      .eq("id", body.exerciseId)
      .eq("tenant_id", body.tenantId)
      .eq("patient_id", body.patientId);

    if (error) {
      return NextResponse.json(
        { error: formatExerciseDatabaseError(error) },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  }

  if (body.action === "update") {
    return updateExerciseLog(supabase, body);
  }

  return NextResponse.json(
    { error: "Accion de actividad no valida." },
    { status: 400 },
  );
}

async function validateExerciseAccess(
  supabase: Awaited<ReturnType<typeof getSupabaseAdmin>>,
  userId: string,
  tenantId: string,
  patientId: string,
  exerciseId: string,
) {
  if (!supabase) return "Supabase no esta configurado en el servidor.";

  const { data: patient, error: patientError } = await supabase
    .from("patients")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("id", patientId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (patientError || !patient) {
    return "Solo el cliente puede modificar sus actividades.";
  }

  const { data: exercise, error: exerciseError } = await supabase
    .from("exercise_logs")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("patient_id", patientId)
    .eq("id", exerciseId)
    .maybeSingle();

  if (exerciseError || !exercise) {
    return "Actividad no encontrada.";
  }

  return "";
}

async function updateExerciseLog(
  supabase: Awaited<ReturnType<typeof getSupabaseAdmin>>,
  body: Extract<ExerciseMutationBody, { action?: "update" }>,
) {
  if (!supabase || !body.tenantId || !body.patientId || !body.exerciseId) {
    return NextResponse.json(
      { error: "Supabase no esta configurado en el servidor." },
      { status: 500 },
    );
  }

  const activity = body.activity?.trim() ?? "";
  const durationSeconds = body.durationSeconds ?? null;
  const distanceKm = body.distanceKm ?? null;

  if (!activity) {
    return NextResponse.json({ error: "Actividad no valida." }, { status: 400 });
  }

  if (
    durationSeconds != null &&
    (!Number.isInteger(durationSeconds) ||
      durationSeconds < 0 ||
      durationSeconds > 86400)
  ) {
    return NextResponse.json(
      { error: "Duracion de actividad no valida." },
      { status: 400 },
    );
  }

  if (
    distanceKm != null &&
    (!Number.isFinite(distanceKm) || distanceKm < 0 || distanceKm > 1000)
  ) {
    return NextResponse.json({ error: "Distancia no valida." }, { status: 400 });
  }

  const durationMinutes =
    durationSeconds != null ? Math.round(durationSeconds / 60) : null;
  const updateRow = {
    activity,
    duration_minutes: durationMinutes,
    duration_seconds: durationSeconds,
    distance_km: distanceKm,
  };

  const { data, error } = await supabase
    .from("exercise_logs")
    .update(updateRow)
    .eq("id", body.exerciseId)
    .eq("tenant_id", body.tenantId)
    .eq("patient_id", body.patientId)
    .select("*")
    .single();

  if (error && isMissingExerciseDetailsColumn(error)) {
    const fallbackUpdate = await supabase
      .from("exercise_logs")
      .update({
        activity,
        duration_minutes: durationMinutes,
      })
      .eq("id", body.exerciseId)
      .eq("tenant_id", body.tenantId)
      .eq("patient_id", body.patientId)
      .select("*")
      .single();

    if (fallbackUpdate.error) {
      return NextResponse.json(
        { error: formatExerciseDatabaseError(fallbackUpdate.error) },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, exercise: fallbackUpdate.data });
  }

  if (error || !data) {
    return NextResponse.json(
      { error: formatExerciseDatabaseError(error) },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, exercise: data });
}

function formatExerciseDatabaseError(error: unknown) {
  if (!error || typeof error !== "object") {
    return "No se pudo modificar la actividad.";
  }

  const details = error as { code?: string; message?: string };
  if (
    details.code === "42501" ||
    details.message?.toLowerCase().includes("row-level security")
  ) {
    return "Supabase ha rechazado la operacion por permisos.";
  }

  return details.message ?? "No se pudo modificar la actividad.";
}

function isMissingExerciseDetailsColumn(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const details = error as { code?: string; message?: string };
  const message = details.message?.toLowerCase() ?? "";

  return (
    details.code === "42703" ||
    details.code === "PGRST204" ||
    message.includes("duration_seconds") ||
    message.includes("distance_km") ||
    message.includes("schema cache")
  );
}
