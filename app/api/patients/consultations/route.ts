import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../lib/supabase/server";

const validStressLevels = new Set(["none", "low", "medium", "high", "very_high"]);
const validGenders = new Set(["male", "female", "non_binary", "prefer_not_to_say"]);
const validActivityLevels = new Set([
  "sedentary",
  "light_moderate",
  "intense",
  "very_intense",
]);

type ConsultationBody = {
  patientId?: string;
  consultationAt?: string;
  weightKg?: number | null;
  heightCm?: number | null;
  stressLevel?: string | null;
  bodyFatPercentage?: number | null;
  fatMassPercentage?: number | null;
  birthDate?: string | null;
  age?: number | null;
  gender?: string | null;
  isMenstruating?: boolean | null;
  menstruationStartDate?: string | null;
  isPregnant?: boolean | null;
  physicalActivityLevel?: string | null;
  diagnosisProblem?: string | null;
  diagnosisCause?: string | null;
  diagnosisSymptoms?: string | null;
  comments?: string | null;
};

export async function GET(request: Request) {
  const supabase = await getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase no esta configurado en el servidor." },
      { status: 500 },
    );
  }

  const userResult = await getAuthenticatedUser(supabase, request);
  if (!userResult.ok) return userResult.response;

  const { searchParams } = new URL(request.url);
  const patientId = searchParams.get("patientId");
  if (!patientId) {
    return NextResponse.json({ error: "Falta el cliente." }, { status: 400 });
  }

  const access = await verifyNutritionistPatientAccess(
    supabase,
    userResult.userId,
    patientId,
  );
  if (!access.ok) return access.response;

  const { data, error } = await supabase
    .from("patient_consultations")
    .select("*")
    .eq("tenant_id", access.tenantId)
    .eq("patient_id", patientId)
    .order("consultation_at", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, consultations: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = await getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase no esta configurado en el servidor." },
      { status: 500 },
    );
  }

  const userResult = await getAuthenticatedUser(supabase, request);
  if (!userResult.ok) return userResult.response;

  const body = (await request.json()) as ConsultationBody;
  const validationError = validateConsultationBody(body);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const access = await verifyNutritionistPatientAccess(
    supabase,
    userResult.userId,
    body.patientId!,
  );
  if (!access.ok) return access.response;

  const row = {
    tenant_id: access.tenantId,
    patient_id: body.patientId,
    created_by: userResult.userId,
    consultation_at: body.consultationAt,
    weight_kg: body.weightKg ?? null,
    height_cm: body.heightCm ?? null,
    stress_level: body.stressLevel ?? null,
    body_fat_percentage: body.bodyFatPercentage ?? null,
    fat_mass_percentage: body.fatMassPercentage ?? null,
    birth_date: body.birthDate || null,
    age: body.age ?? null,
    gender: body.gender || null,
    is_menstruating: body.isMenstruating ?? null,
    menstruation_start_date:
      body.isMenstruating && body.menstruationStartDate
        ? body.menstruationStartDate
        : null,
    is_pregnant: body.isPregnant ?? null,
    physical_activity_level: body.physicalActivityLevel || null,
    diagnosis_problem: cleanText(body.diagnosisProblem),
    diagnosis_cause: cleanText(body.diagnosisCause),
    diagnosis_symptoms: cleanText(body.diagnosisSymptoms),
    comments: cleanText(body.comments),
  };

  const { data, error } = await supabase
    .from("patient_consultations")
    .insert(row)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const patientPatch = buildPatientPatch(body, access.initialWeightKg);
  if (patientPatch) {
    const { error: patientUpdateError } = await supabase
      .from("patients")
      .update(patientPatch)
      .eq("id", body.patientId);

    if (patientUpdateError) {
      return NextResponse.json(
        { error: patientUpdateError.message },
        { status: 500 },
      );
    }
  }

  if (body.weightKg !== null && body.weightKg !== undefined) {
    await supabase.from("weight_logs").insert({
      tenant_id: access.tenantId,
      patient_id: body.patientId,
      weight_kg: body.weightKg,
      source: "nutritionist",
      logged_at: buildConsultationLoggedAt(body.consultationAt!),
    });
  }

  return NextResponse.json({ ok: true, consultation: data });
}

async function getAuthenticatedUser(
  supabase: Awaited<ReturnType<typeof getSupabaseAdmin>>,
  request: Request,
) {
  if (!supabase) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "Supabase no esta configurado en el servidor." },
        { status: 500 },
      ),
    };
  }

  const token = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "")
    .trim();

  if (!token) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Sesion no encontrada." }, { status: 401 }),
    };
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Sesion no valida." }, { status: 401 }),
    };
  }

  return { ok: true as const, userId: user.id };
}

async function verifyNutritionistPatientAccess(
  supabase: Awaited<ReturnType<typeof getSupabaseAdmin>>,
  userId: string,
  patientId: string,
) {
  if (!supabase) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "Supabase no esta configurado en el servidor." },
        { status: 500 },
      ),
    };
  }

  const { data: patient, error: patientError } = await supabase
    .from("patients")
    .select("id,tenant_id,initial_weight_kg")
    .eq("id", patientId)
    .maybeSingle();

  if (patientError || !patient) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Cliente no encontrado." }, { status: 404 }),
    };
  }

  const { data: membership, error: membershipError } = await supabase
    .from("tenant_members")
    .select("role,status")
    .eq("tenant_id", patient.tenant_id)
    .eq("user_id", userId)
    .maybeSingle();

  if (
    membershipError ||
    !membership ||
    membership.status !== "active" ||
    !["owner", "nutritionist"].includes(membership.role)
  ) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "No tienes permisos para gestionar consultas de este cliente." },
        { status: 403 },
      ),
    };
  }

  return {
    ok: true as const,
    tenantId: patient.tenant_id as string,
    initialWeightKg: patient.initial_weight_kg as number | null,
  };
}

function validateConsultationBody(body: ConsultationBody) {
  if (!body.patientId) return "Falta el cliente.";
  if (!isIsoDate(body.consultationAt)) return "Fecha de consulta no valida.";
  if (!isOptionalNumberInRange(body.weightKg, 1, 400)) return "Peso no valido.";
  if (!isOptionalNumberInRange(body.heightCm, 40, 260)) return "Altura no valida.";
  if (!isOptionalNumberInRange(body.bodyFatPercentage, 0, 100)) {
    return "Porcentaje de grasa no valido.";
  }
  if (!isOptionalNumberInRange(body.fatMassPercentage, 0, 100)) {
    return "Porcentaje de masa grasa no valido.";
  }
  if (!isOptionalNumberInRange(body.age, 0, 120)) return "Edad no valida.";
  if (body.stressLevel && !validStressLevels.has(body.stressLevel)) {
    return "Nivel de estres no valido.";
  }
  if (body.gender && !validGenders.has(body.gender)) {
    return "Genero no valido.";
  }
  if (
    body.physicalActivityLevel &&
    !validActivityLevels.has(body.physicalActivityLevel)
  ) {
    return "Nivel de actividad fisica no valido.";
  }
  if (body.birthDate && !isIsoDate(body.birthDate)) {
    return "Fecha de nacimiento no valida.";
  }
  if (body.isMenstruating && !isIsoDate(body.menstruationStartDate)) {
    return "Indica la fecha de inicio de menstruacion.";
  }
  if (body.menstruationStartDate && !isIsoDate(body.menstruationStartDate)) {
    return "Fecha de inicio de menstruacion no valida.";
  }

  return "";
}

function isOptionalNumberInRange(
  value: number | null | undefined,
  min: number,
  max: number,
) {
  if (value === null || value === undefined) return true;
  return Number.isFinite(value) && value >= min && value <= max;
}

function isIsoDate(value: unknown) {
  if (typeof value !== "string") return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00`);
  return Number.isFinite(date.getTime());
}

function cleanText(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function buildPatientPatch(
  body: ConsultationBody,
  initialWeightKg: number | null,
) {
  const patch: Record<string, unknown> = {};

  if (body.age !== null && body.age !== undefined) {
    patch.age = body.age;
  }
  if (body.heightCm !== null && body.heightCm !== undefined) {
    patch.height_cm = body.heightCm;
  }
  if (body.weightKg !== null && body.weightKg !== undefined) {
    patch.current_weight_kg = body.weightKg;
    if (initialWeightKg === null || initialWeightKg === undefined) {
      patch.initial_weight_kg = body.weightKg;
    }
  }
  if (body.gender === "male" || body.gender === "female") {
    patch.sex = body.gender;
  }

  if (Object.keys(patch).length === 0) return null;

  return {
    ...patch,
    updated_at: new Date().toISOString(),
  };
}

function buildConsultationLoggedAt(consultationAt: string) {
  return `${consultationAt}T12:00:00.000Z`;
}
