import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../lib/supabase/server";

type PatientStatus = "active" | "inactive";

type PatientStatusBody = {
  patientId?: string;
  status?: PatientStatus;
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

  const body = (await request.json()) as PatientStatusBody;
  if (!body.patientId || !isPatientStatus(body.status)) {
    return NextResponse.json(
      { error: "Faltan cliente o estado valido." },
      { status: 400 },
    );
  }

  const { data: patient, error: patientError } = await supabase
    .from("patients")
    .select("id,tenant_id,user_id,full_name")
    .eq("id", body.patientId)
    .maybeSingle();

  if (patientError || !patient) {
    return NextResponse.json({ error: "Cliente no encontrado." }, { status: 404 });
  }

  const { data: membership, error: membershipError } = await supabase
    .from("tenant_members")
    .select("role,status")
    .eq("tenant_id", patient.tenant_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (
    membershipError ||
    !membership ||
    membership.status !== "active" ||
    !["owner", "nutritionist"].includes(membership.role)
  ) {
    return NextResponse.json(
      { error: "No tienes permisos para cambiar este cliente." },
      { status: 403 },
    );
  }

  const now = new Date().toISOString();
  const { error: updatePatientError } = await supabase
    .from("patients")
    .update({ status: body.status, updated_at: now })
    .eq("id", patient.id);

  if (updatePatientError) {
    return NextResponse.json(
      { error: updatePatientError.message },
      { status: 500 },
    );
  }

  if (patient.user_id) {
    const memberError =
      body.status === "active"
        ? await reactivatePatientMember(supabase, patient.tenant_id, patient.user_id)
        : await disablePatientMember(supabase, patient.tenant_id, patient.user_id);

    if (memberError) {
      return NextResponse.json({ error: memberError }, { status: 500 });
    }
  }

  return NextResponse.json({
    ok: true,
    patientName: patient.full_name,
    status: body.status,
  });
}

function isPatientStatus(status: unknown): status is PatientStatus {
  return status === "active" || status === "inactive";
}

async function reactivatePatientMember(
  supabase: Awaited<ReturnType<typeof getSupabaseAdmin>>,
  tenantId: string,
  userId: string,
) {
  if (!supabase) return "Supabase no esta configurado en el servidor.";

  const { error } = await supabase.from("tenant_members").upsert(
    {
      tenant_id: tenantId,
      user_id: userId,
      role: "patient",
      status: "active",
    },
    { onConflict: "tenant_id,user_id" },
  );

  return error?.message ?? "";
}

async function disablePatientMember(
  supabase: Awaited<ReturnType<typeof getSupabaseAdmin>>,
  tenantId: string,
  userId: string,
) {
  if (!supabase) return "Supabase no esta configurado en el servidor.";

  const { error } = await supabase
    .from("tenant_members")
    .update({ status: "disabled" })
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .eq("role", "patient");

  return error?.message ?? "";
}
