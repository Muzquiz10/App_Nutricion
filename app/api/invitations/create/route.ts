import { NextResponse } from "next/server";
import {
  getPublicAppOrigin,
  getSupabaseAdmin,
} from "../../../lib/supabase/server";

type CreateInvitationBody = {
  email?: string;
  tenantId?: string;
  tenantSlug?: string;
};

type InviteMetadata = {
  tenant_id: string;
  tenant_slug: string;
  invitation_token: string;
  role: "patient";
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

  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString();
  const { data: invitation, error: invitationError } = await supabase
    .from("invitations")
    .insert({
      tenant_id: body.tenantId,
      invited_by: user.id,
      email,
      role: "patient",
      status: "pending",
      expires_at: expiresAt,
    })
    .select("id, token")
    .single();

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
    if (isEmailRateLimitError(inviteError)) {
      const { data: linkData, error: linkError } =
        await supabase.auth.admin.generateLink({
          type: "invite",
          email,
          options: {
            redirectTo,
            data: metadata,
          },
        });

      const actionLink = linkData.properties?.action_link;
      if (!linkError && actionLink) {
        return NextResponse.json({
          ok: true,
          delivery: "manual_link",
          invitationId: invitation.id,
          invitationUrl: `${appOrigin}${invitePath}`,
          actionLink,
          warning:
            "Supabase ha alcanzado el limite de emails. Usa el enlace manual para esta prueba.",
        });
      }
    }

    await supabase
      .from("invitations")
      .update({ status: "revoked" })
      .eq("id", invitation.id);

    return NextResponse.json(
      { error: toInvitationErrorMessage(inviteError.message) },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    delivery: "email",
    invitationId: invitation.id,
    invitationUrl: `${appOrigin}${invitePath}`,
  });
}

function isEmailRateLimitError(error: { message?: string; status?: number }) {
  return (
    error.status === 429 ||
    String(error.message ?? "")
      .toLowerCase()
      .includes("rate limit")
  );
}

function toInvitationErrorMessage(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("already been registered")) {
    return "Ese correo ya existe en Supabase Auth. Borra tambien el usuario en Authentication > Users o usa otro correo para la prueba.";
  }
  if (normalized.includes("rate limit")) {
    return "Supabase ha alcanzado el limite de emails. Espera a que se libere el limite o configura SMTP propio.";
  }
  return message;
}
