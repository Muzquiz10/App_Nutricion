import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../lib/supabase/server";

type ClientFeatureAccessKey =
  | "goals"
  | "plans"
  | "data_entry"
  | "activities"
  | "stats"
  | "chat"
  | "documents"
  | "agenda";

type ClientPortalAccess = Record<ClientFeatureAccessKey, boolean>;

type PatientAccessBody = {
  patientId?: string;
  portalAccess?: Partial<ClientPortalAccess>;
};

const accessKeys: ClientFeatureAccessKey[] = [
  "goals",
  "plans",
  "data_entry",
  "activities",
  "stats",
  "chat",
  "documents",
  "agenda",
];

const defaultPortalAccess: ClientPortalAccess = {
  goals: true,
  plans: true,
  data_entry: true,
  activities: true,
  stats: true,
  chat: true,
  documents: true,
  agenda: true,
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

  const body = (await request.json()) as PatientAccessBody;
  const portalAccess = normalizePortalAccess(body.portalAccess);

  if (!body.patientId || !portalAccess) {
    return NextResponse.json(
      { error: "Faltan cliente o accesos validos." },
      { status: 400 },
    );
  }

  const { data: patient, error: patientError } = await supabase
    .from("patients")
    .select("id,tenant_id")
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
      { error: "No tienes permisos para cambiar los accesos de este cliente." },
      { status: 403 },
    );
  }

  const { error: updateError } = await supabase
    .from("patients")
    .update({
      portal_access: portalAccess,
      updated_at: new Date().toISOString(),
    })
    .eq("id", patient.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, portalAccess });
}

function normalizePortalAccess(
  value: Partial<ClientPortalAccess> | undefined,
): ClientPortalAccess | null {
  if (!value || typeof value !== "object") return null;

  return accessKeys.reduce<ClientPortalAccess>((result, key) => {
    result[key] =
      typeof value[key] === "boolean" ? Boolean(value[key]) : defaultPortalAccess[key];
    return result;
  }, { ...defaultPortalAccess });
}
