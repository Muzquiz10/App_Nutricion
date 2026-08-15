import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../lib/supabase/server";

type UserRole = "owner" | "nutritionist" | "patient";
type AnalyticsEventName = "session_start" | "tab_view" | "session_end";

type AnalyticsEventBody = {
  tenantId?: string;
  sessionId?: string;
  role?: UserRole;
  patientId?: string | null;
  eventName?: AnalyticsEventName;
  tabId?: string;
  tabLabel?: string;
  durationSeconds?: number | null;
  deviceType?: string;
  metadata?: Record<string, unknown>;
};

const eventNames = new Set<AnalyticsEventName>([
  "session_start",
  "tab_view",
  "session_end",
]);

const allowedMetadataValueTypes = new Set(["string", "number", "boolean"]);

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

  const body = (await request.json()) as AnalyticsEventBody;
  const validationError = validateAnalyticsPayload(body);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const resolvedAccess = await resolveAnalyticsAccess(
    supabase,
    body.tenantId!,
    user.id,
    body.patientId ?? null,
  );

  if (!resolvedAccess.ok) {
    return NextResponse.json({ error: resolvedAccess.error }, { status: 403 });
  }

  const now = new Date().toISOString();
  const userAgent = request.headers.get("user-agent")?.slice(0, 500) ?? null;
  const deviceType = normalizeDeviceType(body.deviceType);

  const sessionPayload: Record<string, unknown> = {
    id: body.sessionId,
    tenant_id: body.tenantId,
    user_id: user.id,
    role: resolvedAccess.role,
    last_seen_at: now,
    user_agent: userAgent,
    device_type: deviceType,
  };

  if (body.eventName === "session_start") {
    sessionPayload.started_at = now;
  }

  if (body.eventName === "session_end") {
    sessionPayload.ended_at = now;
  }

  const { error: sessionError } = await supabase
    .from("analytics_sessions")
    .upsert(sessionPayload, { onConflict: "id" });

  if (sessionError) {
    if (isMissingAnalyticsTable(sessionError)) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    return NextResponse.json({ error: sessionError.message }, { status: 500 });
  }

  const { error: eventError } = await supabase.from("analytics_events").insert({
    tenant_id: body.tenantId,
    session_id: body.sessionId,
    user_id: user.id,
    role: resolvedAccess.role,
    patient_id: resolvedAccess.patientId,
    event_name: body.eventName,
    tab_id: normalizeAnalyticsText(body.tabId, 60),
    tab_label: normalizeAnalyticsText(body.tabLabel, 120),
    duration_seconds: body.durationSeconds ?? null,
    device_type: deviceType,
    metadata: sanitizeAnalyticsMetadata(body.metadata),
  });

  if (eventError) {
    if (isMissingAnalyticsTable(eventError)) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    return NextResponse.json({ error: eventError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

function validateAnalyticsPayload(body: AnalyticsEventBody) {
  if (!isUuid(body.tenantId ?? "")) return "Tenant no valido.";
  if (!isUuid(body.sessionId ?? "")) return "Sesion de analitica no valida.";
  if (!body.eventName || !eventNames.has(body.eventName)) return "Evento no valido.";

  if (body.patientId && !isUuid(body.patientId)) {
    return "Cliente no valido.";
  }

  if (
    body.durationSeconds != null &&
    (!Number.isInteger(body.durationSeconds) ||
      body.durationSeconds < 0 ||
      body.durationSeconds > 86400)
  ) {
    return "Duracion no valida.";
  }

  return "";
}

async function resolveAnalyticsAccess(
  supabase: Awaited<ReturnType<typeof getSupabaseAdmin>>,
  tenantId: string,
  userId: string,
  requestedPatientId: string | null,
): Promise<
  | { ok: true; role: UserRole; patientId: string | null }
  | { ok: false; error: string }
> {
  if (!supabase) return { ok: false, error: "Supabase no esta configurado." };

  const { data: membership } = await supabase
    .from("tenant_members")
    .select("role,status")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (membership && ["owner", "nutritionist"].includes(membership.role)) {
    if (!requestedPatientId) {
      return { ok: true, role: membership.role as UserRole, patientId: null };
    }

    const { data: patient } = await supabase
      .from("patients")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("id", requestedPatientId)
      .maybeSingle();

    return patient
      ? { ok: true, role: membership.role as UserRole, patientId: patient.id }
      : { ok: false, error: "Cliente no encontrado para este tenant." };
  }

  const patientQuery = supabase
    .from("patients")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .eq("status", "active");

  const { data: patient } = requestedPatientId
    ? await patientQuery.eq("id", requestedPatientId).maybeSingle()
    : await patientQuery.maybeSingle();

  if (!patient) {
    return { ok: false, error: "Usuario sin acceso activo a este tenant." };
  }

  return { ok: true, role: "patient", patientId: patient.id };
}

function sanitizeAnalyticsMetadata(metadata: AnalyticsEventBody["metadata"]) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(metadata)
      .slice(0, 20)
      .filter(([, value]) => value === null || allowedMetadataValueTypes.has(typeof value))
      .map(([key, value]) => [key.slice(0, 60), value]),
  );
}

function normalizeAnalyticsText(value: string | undefined, maxLength: number) {
  const trimmedValue = value?.trim() ?? "";
  return trimmedValue ? trimmedValue.slice(0, maxLength) : null;
}

function normalizeDeviceType(value: string | undefined) {
  if (value === "mobile" || value === "tablet" || value === "desktop") {
    return value;
  }

  return "unknown";
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isMissingAnalyticsTable(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const details = error as { code?: string; message?: string };
  const message = details.message?.toLowerCase() ?? "";

  return (
    details.code === "42P01" ||
    details.code === "PGRST205" ||
    message.includes("analytics_sessions") ||
    message.includes("analytics_events") ||
    message.includes("schema cache")
  );
}
