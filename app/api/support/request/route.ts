import { NextResponse } from "next/server";
import { getSupabaseAdmin, readRuntimeEnv } from "../../../lib/supabase/server";

type SupportRequestBody = {
  tenantId?: string;
  name?: string;
  email?: string;
  subject?: string;
  message?: string;
};

const defaultSupportToEmail = "ej.egmanalytics@gmail.com";

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

  const body = (await request.json()) as SupportRequestBody;
  const tenantId = body.tenantId?.trim();
  const name = body.name?.trim();
  const email = body.email?.trim().toLowerCase();
  const subject = body.subject?.trim();
  const message = body.message?.trim();

  if (!tenantId || !name || !email || !subject || !message) {
    return NextResponse.json(
      { error: "Completa nombre, correo electronico, asunto e incidencia." },
      { status: 400 },
    );
  }

  if (!isValidEmail(email)) {
    return NextResponse.json(
      { error: "Indica un correo electronico valido." },
      { status: 400 },
    );
  }

  const { data: membership, error: membershipError } = await supabase
    .from("tenant_members")
    .select("role,status")
    .eq("tenant_id", tenantId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (membershipError || !membership) {
    return NextResponse.json(
      { error: "No se pudo validar tu acceso al tenant." },
      { status: 403 },
    );
  }

  const { data: tenant, error: tenantError } = await supabase
    .from("tenants")
    .select("name,slug")
    .eq("id", tenantId)
    .maybeSingle();

  if (tenantError || !tenant) {
    return NextResponse.json({ error: "Tenant no encontrado." }, { status: 404 });
  }

  const resendApiKey = await readRuntimeEnv("RESEND_API_KEY");
  const fromEmail = await readRuntimeEnv("SUPPORT_FROM_EMAIL");
  const supportToEmail =
    (await readRuntimeEnv("SUPPORT_TO_EMAIL")) ?? defaultSupportToEmail;

  if (!resendApiKey || !fromEmail) {
    return NextResponse.json(
      { error: "Falta configurar el envio de asistencia tecnica." },
      { status: 500 },
    );
  }

  const authenticatedEmail = user.email ?? "Sin email en Auth";
  const text = buildSupportText({
    name,
    email,
    subject,
    message,
    userId: user.id,
    authenticatedEmail,
    role: membership.role,
    status: membership.status,
    tenantName: tenant.name,
    tenantSlug: tenant.slug,
  });

  const emailResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [supportToEmail],
      reply_to: email,
      subject: `[DietDesk soporte] ${subject}`,
      text,
      html: textToHtml(text),
    }),
  });

  if (!emailResponse.ok) {
    const errorPayload = await emailResponse.text();
    return NextResponse.json(
      {
        error: "No se pudo enviar la incidencia. Revisa la configuracion de email.",
        detail: errorPayload,
      },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function buildSupportText({
  name,
  email,
  subject,
  message,
  userId,
  authenticatedEmail,
  role,
  status,
  tenantName,
  tenantSlug,
}: {
  name: string;
  email: string;
  subject: string;
  message: string;
  userId: string;
  authenticatedEmail: string;
  role: string;
  status: string;
  tenantName: string;
  tenantSlug: string;
}) {
  return [
    "Nueva solicitud de asistencia tecnica en DietDesk",
    "",
    `Nombre: ${name}`,
    `Correo indicado: ${email}`,
    `Asunto: ${subject}`,
    "",
    "Incidencia:",
    message,
    "",
    "Datos internos:",
    `ID de usuario: ${userId}`,
    `Email autenticado: ${authenticatedEmail}`,
    `Rol: ${role}`,
    `Status: ${status}`,
    `Tenant: ${tenantName} (${tenantSlug})`,
  ].join("\n");
}

function textToHtml(text: string) {
  return `<pre style="font-family:Arial,sans-serif;white-space:pre-wrap;line-height:1.5">${escapeHtml(text)}</pre>`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
