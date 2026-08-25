import { NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { APP_NAME } from "../../../lib/brand";
import {
  getPublicAppOrigin,
  getSupabaseAdmin,
  readRuntimeEnv,
} from "../../../lib/supabase/server";
import {
  findAuthUserByEmail,
  getPatientActivationBlock,
  patientActivationBlockMessage,
} from "../../../lib/patient-activation";

type CreateManagedPatientBody = {
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

const CURRENT_QUESTIONNAIRE_VERSION = 2;
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
    data: { user: requester },
    error: userError,
  } = await supabase.auth.getUser(token);

  if (userError || !requester) {
    return NextResponse.json({ error: "Sesion no valida." }, { status: 401 });
  }

  const body = (await request.json()) as CreateManagedPatientBody;
  const email = body.email?.trim().toLowerCase();

  if (!email || !isValidEmail(email) || !body.tenantId) {
    return NextResponse.json(
      { error: "Faltan email o tenant validos." },
      { status: 400 },
    );
  }

  const { data: membership, error: membershipError } = await supabase
    .from("tenant_members")
    .select("role,status")
    .eq("tenant_id", body.tenantId)
    .eq("user_id", requester.id)
    .maybeSingle();

  if (
    membershipError ||
    !membership ||
    membership.status !== "active" ||
    !["owner", "nutritionist"].includes(membership.role)
  ) {
    return NextResponse.json(
      { error: "No tienes permisos para crear clientes." },
      { status: 403 },
    );
  }

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id,name,slug")
    .eq("id", body.tenantId)
    .maybeSingle();

  const tenantName = tenant?.name ?? body.tenantSlug ?? APP_NAME;
  const portalAccess = normalizePortalAccess(body.portalAccess);
  const temporaryPassword = generateTemporaryPassword();
  const patientName = email;
  const patientCode = `PAT-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

  const authUserResult = await resolveManagedPatientUser({
    supabase,
    email,
    tenantId: body.tenantId,
    password: temporaryPassword,
    metadata: {
      full_name: patientName,
      tenant_id: body.tenantId,
      tenant_slug: tenant?.slug ?? body.tenantSlug,
      onboarding_mode: "professional",
      role: "patient",
    },
  });

  if ("error" in authUserResult) {
    return NextResponse.json(
      { error: authUserResult.error },
      { status: authUserResult.status },
    );
  }

  const patientUser = authUserResult.user;
  const now = new Date().toISOString();

  const { error: profileError } = await supabase.from("profiles").upsert({
    user_id: patientUser.id,
    full_name: patientName,
    global_role: "patient",
    updated_at: now,
  });

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  const { data: patient, error: patientError } = await supabase
    .from("patients")
    .insert({
      tenant_id: body.tenantId,
      user_id: patientUser.id,
      nutritionist_user_id: requester.id,
      patient_code: patientCode,
      full_name: patientName,
      age: null,
      height_cm: null,
      initial_weight_kg: null,
      current_weight_kg: null,
      objective: null,
      sex: null,
      allergies: "",
      avoided_foods: "",
      exercise_routine: "",
      exercise_hours_per_week: null,
      exercise_type: "",
      questionnaire_version: CURRENT_QUESTIONNAIRE_VERSION,
      questionnaire_completed_at: now,
      onboarding_mode: "professional",
      portal_access: portalAccess,
      consent_given_at: null,
      gdpr_policy_version: "2026-07-30",
    })
    .select("id")
    .single();

  if (patientError || !patient) {
    const rawMessage = patientError?.message ?? "No se pudo crear la ficha.";
    const message = toActivationConflictMessage(rawMessage);

    return NextResponse.json(
      { error: message },
      { status: message === rawMessage ? 500 : 409 },
    );
  }

  const { error: memberError } = await supabase.from("tenant_members").upsert(
    {
      tenant_id: body.tenantId,
      user_id: patientUser.id,
      role: "patient",
      status: "active",
    },
    { onConflict: "tenant_id,user_id" },
  );

  if (memberError) {
    await supabase.from("patients").delete().eq("id", patient.id);
    return NextResponse.json(
      { error: toActivationConflictMessage(memberError.message) },
      { status: 409 },
    );
  }

  await supabase.from("conversations").insert({
    tenant_id: body.tenantId,
    patient_id: patient.id,
    nutritionist_user_id: requester.id,
  });

  const emailResult = await sendManagedPatientWelcomeEmail({
    request,
    email,
    temporaryPassword,
    tenantName,
  });

  return NextResponse.json({
    ok: true,
    patientId: patient.id,
    warning: emailResult.ok
      ? undefined
      : "Cliente creado, pero no se pudo enviar el email con la contraseña temporal. Revisa la configuracion de Resend.",
  });
}

async function resolveManagedPatientUser({
  supabase,
  email,
  tenantId,
  password,
  metadata,
}: {
  supabase: SupabaseClient;
  email: string;
  tenantId: string;
  password: string;
  metadata: Record<string, unknown>;
}): Promise<{ user: User } | { error: string; status: number }> {
  const existingUser = await findAuthUserByEmail(supabase, email);
  if (existingUser) {
    const activationBlock = await getPatientActivationBlock(
      supabase,
      existingUser.id,
      tenantId,
    );

    if (activationBlock) {
      return {
        error: patientActivationBlockMessage(activationBlock),
        status: 409,
      };
    }

    const { data: updatedUser, error: updateError } =
      await supabase.auth.admin.updateUserById(existingUser.id, {
        password,
        email_confirm: true,
        user_metadata: metadata,
        app_metadata: { role: "patient" },
      });

    if (updateError || !updatedUser.user) {
      return {
        error: updateError?.message ?? "No se pudo preparar el usuario.",
        status: 500,
      };
    }

    return { user: updatedUser.user };
  }

  const { data: createdUser, error: createError } =
    await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: metadata,
      app_metadata: { role: "patient" },
    });

  if (createError || !createdUser.user) {
    return {
      error: createError?.message ?? "No se pudo crear el usuario.",
      status: 500,
    };
  }

  return { user: createdUser.user };
}

async function sendManagedPatientWelcomeEmail({
  request,
  email,
  temporaryPassword,
  tenantName,
}: {
  request: Request;
  email: string;
  temporaryPassword: string;
  tenantName: string;
}) {
  const resendApiKey = await readRuntimeEnv("RESEND_API_KEY");
  const fromEmail =
    (await readRuntimeEnv("NOTIFICATIONS_FROM_EMAIL")) ??
    (await readRuntimeEnv("SUPPORT_FROM_EMAIL"));

  if (!resendApiKey || !fromEmail) {
    return { ok: false, error: "Falta configurar Resend." };
  }

  const appOrigin = await getPublicAppOrigin(request);
  const appUrl = `${appOrigin}/`;
  const subject = `[${APP_NAME}] Tu acceso a ${tenantName}`;
  const text = [
    `Hola,`,
    ``,
    `Tu profesional ha creado tu acceso a ${APP_NAME}.`,
    ``,
    `Email: ${email}`,
    `Contraseña temporal: ${temporaryPassword}`,
    `Acceso: ${appUrl}`,
    ``,
    `Por seguridad, cambia tu contraseña desde Configuración cuando entres por primera vez.`,
  ].join("\n");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [email],
      subject,
      text,
      html: textToHtml(text),
    }),
  });

  if (!response.ok) {
    return { ok: false, error: await response.text() };
  }

  return { ok: true };
}

function generateTemporaryPassword() {
  return `${crypto.randomUUID().replace(/-/g, "").slice(0, 14)}Aa1!`;
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

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function toActivationConflictMessage(message: string) {
  if (message.toLowerCase().includes("duplicate")) {
    return "Ese correo ya esta activo con otro nutricionista. Para darlo de alta aqui, primero el nutricionista actual debe moverlo a clientes antiguos.";
  }

  return message;
}

function textToHtml(text: string) {
  return text
    .split("\n")
    .map((line) => (line ? `<p>${escapeHtml(line)}</p>` : "<br />"))
    .join("");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
