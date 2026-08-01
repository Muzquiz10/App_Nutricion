import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../lib/supabase/server";

const CURRENT_QUESTIONNAIRE_VERSION = 2;
const validObjectives = new Set([
  "Reducir peso",
  "Ganar masa muscular",
  "Bienestar",
  "Aprendizaje",
]);
const validSexes = new Set(["male", "female"]);

type QuestionnaireBody = {
  patientId?: string;
  fullName?: string;
  age?: number;
  heightCm?: number;
  currentWeightKg?: number;
  objective?: string;
  sex?: string;
  allergies?: string;
  avoidedFoods?: string;
  exerciseHoursPerWeek?: number;
  exerciseType?: string;
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
    return NextResponse.json({ error: "Sesion no valida." }, { status: 401 });
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(sessionToken);

  if (userError || !user) {
    return NextResponse.json({ error: "Sesion no valida." }, { status: 401 });
  }

  const body = (await request.json()) as QuestionnaireBody;
  const validationError = validateBody(body);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const { data: patient, error: patientError } = await supabase
    .from("patients")
    .select("id,tenant_id,user_id,current_weight_kg")
    .eq("id", body.patientId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (patientError || !patient) {
    return NextResponse.json(
      { error: "No se encontro una ficha vinculada a tu usuario." },
      { status: 404 },
    );
  }

  const fullName = body.fullName!.trim();
  const exerciseType = body.exerciseType?.trim() ?? "";
  const exerciseRoutine = buildExerciseRoutine(
    body.exerciseHoursPerWeek!,
    exerciseType,
  );
  const now = new Date().toISOString();

  const { error: updateError } = await supabase
    .from("patients")
    .update({
      full_name: fullName,
      age: body.age,
      height_cm: body.heightCm,
      current_weight_kg: body.currentWeightKg,
      objective: body.objective,
      sex: body.sex,
      allergies: body.allergies?.trim() ?? "",
      avoided_foods: body.avoidedFoods?.trim() ?? "",
      exercise_routine: exerciseRoutine,
      exercise_hours_per_week: body.exerciseHoursPerWeek,
      exercise_type: exerciseType,
      questionnaire_version: CURRENT_QUESTIONNAIRE_VERSION,
      questionnaire_completed_at: now,
      updated_at: now,
    })
    .eq("id", patient.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  const { error: profileError } = await supabase.from("profiles").upsert({
    user_id: user.id,
    full_name: fullName,
    global_role: "patient",
    updated_at: now,
  });

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  if (
    Number(patient.current_weight_kg) !== Number(body.currentWeightKg)
  ) {
    await supabase.from("weight_logs").insert({
      tenant_id: patient.tenant_id,
      patient_id: patient.id,
      weight_kg: body.currentWeightKg,
      source: "patient",
      logged_at: now,
    });
  }

  return NextResponse.json({ ok: true });
}

function validateBody(body: QuestionnaireBody) {
  if (!body.patientId) return "Falta la ficha del cliente.";
  if (!body.fullName?.trim()) return "Falta el nombre y apellidos.";
  if (!body.age || body.age < 0 || body.age > 120) return "Edad no valida.";
  if (!body.heightCm || body.heightCm < 40 || body.heightCm > 260) {
    return "Altura no valida.";
  }
  if (
    !body.currentWeightKg ||
    body.currentWeightKg < 1 ||
    body.currentWeightKg > 400
  ) {
    return "Peso no valido.";
  }
  if (!body.objective || !validObjectives.has(body.objective)) {
    return "Selecciona un objetivo valido.";
  }
  if (!body.sex || !validSexes.has(body.sex)) {
    return "Selecciona el sexo para calcular las calorias basales.";
  }
  if (
    body.exerciseHoursPerWeek === undefined ||
    body.exerciseHoursPerWeek < 0 ||
    body.exerciseHoursPerWeek > 168
  ) {
    return "Horas de ejercicio no validas.";
  }

  return "";
}

function buildExerciseRoutine(hours: number, exerciseType: string) {
  const base = `${hours} h/semana`;
  if (!exerciseType) return base;
  return `${base} - ${exerciseType}`;
}
