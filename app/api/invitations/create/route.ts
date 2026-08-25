import { NextResponse } from "next/server";
import {
  getPublicAppOrigin,
  getSupabaseAdmin,
} from "../../../lib/supabase/server";
import {
  findAuthUserByEmail,
  getPatientActivationBlock,
  patientActivationBlockMessage,
} from "../../../lib/patient-activation";

type CreateInvitationBody = {
  email?: string;
  tenantId?: string;
  tenantSlug?: string;
  portalAccess?: Partial<ClientPortalAccess>;
};

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

type InviteMetadata = {
  tenant_id: string;
  tenant_slug: string;
  invitation_token: string;
  role: "patient";
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

  const body = (await request.json()) as CreateInvitationBody;
  const email = body.email?.trim().toLowerCase();
  if (!email || !body.tenantId || !body.tenantSlug) {
    return NextResponse.json(
      { error: "Faltan email o tenant." },
      { status: 400 },
    );
  }

  const portalAccess = normalizePortalAccess(body.portalAccess);

  const { data: membership, error: membershipError } = await supabase
    .from("tenant_members")
    .select("role,status")
    .eq("tenant_id", body.tenantId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (
    membershipError ||
    !membership ||
    membership.status !== "active" ||
    !["owner", "nutritionist"].includes(membership.role)
  ) {
    return NextResponse.json(
      { error: "No tienes permisos para invitar pacientes." },
      { status: 403 },
    );
  }

  const existingAuthUser = await findAuthUserByEmail(supabase, email);
  if (existingAuthUser) {
    const activationBlock = await getPatientActivationBlock(
      supabase,
      existingAuthUser.id,
      body.tenantId,
    );

    if (activationBlock) {
      return NextResponse.json(
        { error: patientActivationBlockMessage(activationBlock) },
        { status: 409 },
      );
    }
  }

  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString();
  const invitationPayload = {
    tenant_id: body.tenantId,
    invited_by: user.id,
    email,
    role: "patient",
    status: "pending",
    portal_access: portalAccess,
    expires_at: expiresAt,
  };
  let invitationResult = await supabase
    .from("invitations")
    .insert(invitationPayload)
    .select("id, token")
    .single();

  if (isMissingPortalAccessColumn(invitationResult.error)) {
    invitationResult = await supabase
      .from("invitations")
      .insert({
        tenant_id: invitationPayload.tenant_id,
        invited_by: invitationPayload.invited_by,
        email: invitationPayload.email,
        role: invitationPayload.role,
        status: invitationPayload.status,
        expires_at: invitationPayload.expires_at,
      })
      .select("id, token")
      .single();
  }

  const { data: invitation, error: invitationError } = invitationResult;

  if (invitationError || !invitation) {
    return NextResponse.json(
      { error: invitationError?.message ?? "No se pudo crear la invitacion." },
      { status: 500 },
    );
  }

  const appOrigin = await getPublicAppOrigin(request);
  const invitePath = `/invitacion/${invitation.token}`;
  const redirectTo = `${appOrigin}/auth/callback?next=${encodeURIComponent(invitePath)}`;
  const metadata: InviteMetadata = {
    tenant_id: body.tenantId,
    tenant_slug: body.tenantSlug,
    invitation_token: invitation.token,
    role: "patient",
  };

  const { error: inviteError } = await supabase.auth.admin.inviteUserByEmail(
    email,
    {
      redirectTo,
      data: metadata,
    },
  );

  if (inviteError) {
    return NextResponse.json({
      ok: true,
      delivery: "manual_link",
      invitationId: invitation.id,
      invitationUrl: `${appOrigin}${invitePath}`,
      actionLink: `${appOrigin}${invitePath}`,
      warning: toManualInvitationWarning(inviteError.message),
    });
  }

  return NextResponse.json({
    ok: true,
    delivery: "email",
    invitationId: invitation.id,
    invitationUrl: `${appOrigin}${invitePath}`,
  });
}

function normalizePortalAccess(
  value: Partial<ClientPortalAccess> | undefined,
): ClientPortalAccess {
  return accessKeys.reduce<ClientPortalAccess>((result, key) => {
    result[key] =
      typeof value?.[key] === "boolean"
        ? Boolean(value[key])
        : defaultPortalAccess[key];
    return result;
  }, { ...defaultPortalAccess });
}

function isMissingPortalAccessColumn(
  error: { message?: string; code?: string } | null,
) {
  if (!error) return false;
  return (
    error.code === "PGRST204" ||
    /portal_access|schema cache/i.test(error.message ?? "")
  );
}

function toManualInvitationWarning(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("already been registered")) {
    return "Supabase no ha enviado el email porque ese correo ya existe en Auth. Usa este enlace manual para completar el alta.";
  }
  if (normalized.includes("rate limit")) {
    return "Supabase ha alcanzado el limite de emails. Usa este enlace manual para completar el alta.";
  }
  return "Supabase no ha podido enviar el email. Usa este enlace manual para completar el alta.";
}
