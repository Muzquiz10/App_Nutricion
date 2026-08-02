import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../lib/supabase/server";
import {
  getPatientActivationBlock,
  patientActivationBlockMessage,
} from "../../../lib/patient-activation";

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

  if (patient.user_id) {
    if (body.status === "active") {
      const activationBlock = await getPatientActivationBlock(
        supabase,
        patient.user_id,
        patient.tenant_id,
      );

      if (activationBlock && activationBlock !== "existing_in_same_tenant") {
        return NextResponse.json(
          { error: patientActivationBlockMessage(activationBlock) },
          { status: 409 },
        );
      }
    }
  }

  const now = new Date().toISOString();
  const statusError =
    body.status === "active"
      ? await activatePatient(supabase, patient.id, patient.tenant_id, patient.user_id, now)
      : await inactivatePatient(supabase, patient.id, patient.tenant_id, patient.user_id, now);

  if (statusError) {
    return NextResponse.json({ error: statusError }, { status: 500 });
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

async function activatePatient(
  supabase: Awaited<ReturnType<typeof getSupabaseAdmin>>,
  patientId: string,
  tenantId: string,
  userId: string | null,
  now: string,
) {
  if (!supabase) return "Supabase no esta configurado en el servidor.";

  if (userId) {
    const { error: memberError } = await supabase.from("tenant_members").upsert(
      {
        tenant_id: tenantId,
        user_id: userId,
        role: "patient",
        status: "active",
      },
      { onConflict: "tenant_id,user_id" },
    );

    if (memberError) return toActivationConflictMessage(memberError.message);
  }

  const { error: patientError } = await supabase
    .from("patients")
    .update({ status: "active", updated_at: now })
    .eq("id", patientId);

  if (patientError && userId) {
    await supabase
      .from("tenant_members")
      .update({ status: "disabled" })
      .eq("tenant_id", tenantId)
      .eq("user_id", userId)
      .eq("role", "patient");
  }

  return patientError ? toActivationConflictMessage(patientError.message) : "";
}

async function inactivatePatient(
  supabase: Awaited<ReturnType<typeof getSupabaseAdmin>>,
  patientId: string,
  tenantId: string,
  userId: string | null,
  now: string,
) {
  if (!supabase) return "Supabase no esta configurado en el servidor.";

  if (userId) {
    const { error: memberError } = await supabase
      .from("tenant_members")
      .update({ status: "disabled" })
      .eq("tenant_id", tenantId)
      .eq("user_id", userId)
      .eq("role", "patient");

    if (memberError) return memberError.message;
  }

  const { error: patientError } = await supabase
    .from("patients")
    .update({ status: "inactive", updated_at: now })
    .eq("id", patientId);

  if (patientError && userId) {
    await supabase.from("tenant_members").upsert(
      {
        tenant_id: tenantId,
        user_id: userId,
        role: "patient",
        status: "active",
      },
      { onConflict: "tenant_id,user_id" },
    );
  }

  return patientError?.message ?? "";
}

function toActivationConflictMessage(message: string) {
  if (message.toLowerCase().includes("duplicate")) {
    return "Ese correo ya esta activo con otro nutricionista. Para reactivarlo aqui, primero el nutricionista actual debe moverlo a clientes antiguos.";
  }

  return message;
}
