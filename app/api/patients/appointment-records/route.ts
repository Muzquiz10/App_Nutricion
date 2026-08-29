import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../lib/supabase/server";

const validAdvanceStatuses = new Set(["yes", "no", "illness", "other"]);

type AppointmentRecordBody = {
  patientId?: string;
  recordedAt?: string;
  advanceStatus?: string | null;
  advanceOther?: string | null;
  comment?: string | null;
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
    .from("patient_appointment_records")
    .select("*")
    .eq("tenant_id", access.tenantId)
    .eq("patient_id", patientId)
    .order("recorded_at", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, records: data ?? [] });
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

  const body = (await request.json()) as AppointmentRecordBody;
  const validationError = validateAppointmentRecordBody(body);
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
    recorded_at: body.recordedAt,
    advance_status: body.advanceStatus,
    advance_other:
      body.advanceStatus === "other" ? cleanText(body.advanceOther) : null,
    comment: cleanText(body.comment),
  };

  const { data, error } = await supabase
    .from("patient_appointment_records")
    .insert(row)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, record: data });
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
    .select("id,tenant_id")
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
        { error: "No tienes permisos para registrar citas de este cliente." },
        { status: 403 },
      ),
    };
  }

  return { ok: true as const, tenantId: patient.tenant_id as string };
}

function validateAppointmentRecordBody(body: AppointmentRecordBody) {
  if (!body.patientId) return "Falta el cliente.";
  if (!isIsoDate(body.recordedAt)) return "Fecha de cita no valida.";
  if (!body.advanceStatus || !validAdvanceStatuses.has(body.advanceStatus)) {
    return "Avance no valido.";
  }
  if (body.advanceStatus === "other" && !cleanText(body.advanceOther)) {
    return "Indica el detalle de otros.";
  }

  return "";
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
