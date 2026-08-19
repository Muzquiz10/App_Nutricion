import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../lib/supabase/server";

type CalendarEventStatus = "pending" | "confirmed" | "cancelled" | "scheduled";
type CalendarEventType = "appointment" | "block" | "note";
type AppointmentMode = "online" | "presential";

const LEGACY_PENDING_APPOINTMENT_TITLE = "Solicitud pendiente de cita";

type CalendarEventRow = {
  tenant_id?: string;
  patient_id?: string | null;
  title?: string;
  notes?: string | null;
  event_type?: CalendarEventType;
  appointment_mode?: AppointmentMode | null;
  video_url?: string | null;
  blocks_availability?: boolean;
  start_at?: string;
  end_at?: string;
  status?: CalendarEventStatus;
};

type CalendarEventsBody = {
  action?: "create" | "update-status";
  eventId?: string;
  row?: CalendarEventRow;
  status?: CalendarEventStatus;
  title?: string;
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

  const body = (await request.json()) as CalendarEventsBody;

  if (body.action === "create") {
    return createCalendarEvent(supabase, user.id, body.row);
  }

  if (body.action === "update-status") {
    return updateCalendarEventStatus(
      supabase,
      user.id,
      body.eventId,
      body.status,
      body.title,
    );
  }

  return NextResponse.json(
    { error: "Accion de agenda no valida." },
    { status: 400 },
  );
}

async function createCalendarEvent(
  supabase: Awaited<ReturnType<typeof getSupabaseAdmin>>,
  userId: string,
  row: CalendarEventRow | undefined,
) {
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase no esta configurado en el servidor." },
      { status: 500 },
    );
  }

  const validationError = validateCalendarRow(row);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const tenantId = row.tenant_id;
  const membership = await getMembership(supabase, tenantId, userId);
  const isNutritionist = isActiveNutritionist(membership);

  if (!isNutritionist) {
    if (row.status !== "pending" || row.event_type !== "appointment" || !row.patient_id) {
      return NextResponse.json(
        { error: "No tienes permisos para crear este evento." },
        { status: 403 },
      );
    }

    const patient = await getActivePatientForUser(
      supabase,
      row.tenant_id,
      row.patient_id,
      userId,
    );

    if (!patient) {
      return NextResponse.json(
        { error: "No tienes permisos para pedir esta cita." },
        { status: 403 },
      );
    }
  }

  const normalizedVideoUrl = normalizeVideoUrl(row.video_url);
  if (row.video_url && !normalizedVideoUrl) {
    return NextResponse.json(
      { error: "El enlace de videollamada no es valido." },
      { status: 400 },
    );
  }

  let insertRow = {
    ...row,
    ...(normalizedVideoUrl ? { video_url: normalizedVideoUrl } : {}),
  };
  let { data, error } = await supabase
    .from("calendar_events")
    .insert(insertRow)
    .select("*")
    .single();

  if (isCalendarStatusConstraintError(error)) {
    insertRow = toLegacyCalendarInsert(insertRow);
    const legacyInsert = await supabase
      .from("calendar_events")
      .insert(insertRow)
      .select("*")
      .single();
    data = legacyInsert.data;
    error = legacyInsert.error;
  }

  if (error || !data) {
    return NextResponse.json(
      { error: formatCalendarDatabaseError(error) },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, event: data });
}

async function updateCalendarEventStatus(
  supabase: Awaited<ReturnType<typeof getSupabaseAdmin>>,
  userId: string,
  eventId: string | undefined,
  status: CalendarEventStatus | undefined,
  title: string | undefined,
) {
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase no esta configurado en el servidor." },
      { status: 500 },
    );
  }

  if (!eventId || !isCalendarEventStatus(status)) {
    return NextResponse.json(
      { error: "Faltan evento o estado valido." },
      { status: 400 },
    );
  }

  const { data: event, error: eventError } = await supabase
    .from("calendar_events")
    .select("id,tenant_id,title")
    .eq("id", eventId)
    .maybeSingle();

  if (eventError || !event) {
    return NextResponse.json({ error: "Evento no encontrado." }, { status: 404 });
  }

  const membership = await getMembership(supabase, event.tenant_id, userId);
  if (!isActiveNutritionist(membership)) {
    return NextResponse.json(
      { error: "No tienes permisos para modificar esta cita." },
      { status: 403 },
    );
  }

  let updateRow = {
    status,
    ...(title ? { title } : {}),
  };

  let { error } = await supabase
    .from("calendar_events")
    .update(updateRow)
    .eq("id", eventId);

  if (isCalendarStatusConstraintError(error)) {
    updateRow = {
      status: status === "confirmed" ? "scheduled" : status,
      ...(title ? { title } : {}),
    };
    const legacyUpdate = await supabase
      .from("calendar_events")
      .update(updateRow)
      .eq("id", eventId);
    error = legacyUpdate.error;
  }

  if (error) {
    return NextResponse.json(
      { error: formatCalendarDatabaseError(error) },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}

function validateCalendarRow(row: CalendarEventRow | undefined) {
  if (!row?.tenant_id || !row.title || !row.event_type || !row.start_at || !row.end_at) {
    return "Faltan datos para guardar la agenda.";
  }

  if (!isCalendarEventStatus(row.status)) {
    return "Estado de agenda no valido.";
  }

  if (new Date(row.end_at).getTime() <= new Date(row.start_at).getTime()) {
    return "La hora de fin debe ser posterior a la hora de inicio.";
  }

  if (
    row.event_type === "appointment" &&
    (!row.patient_id || !row.appointment_mode)
  ) {
    return "Faltan cliente o tipo de cita.";
  }

  return "";
}

function normalizeVideoUrl(value: string | null | undefined) {
  const rawValue = value?.trim();
  if (!rawValue) return "";

  const withProtocol = /^https?:\/\//i.test(rawValue)
    ? rawValue
    : `https://${rawValue}`;

  try {
    const parsedUrl = new URL(withProtocol);
    if (!["http:", "https:"].includes(parsedUrl.protocol)) return "";
    return parsedUrl.toString();
  } catch {
    return "";
  }
}

async function getMembership(
  supabase: Awaited<ReturnType<typeof getSupabaseAdmin>>,
  tenantId: string,
  userId: string,
) {
  if (!supabase) return null;

  const { data } = await supabase
    .from("tenant_members")
    .select("role,status")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .maybeSingle();

  return data;
}

function isActiveNutritionist(
  membership: { role?: string | null; status?: string | null } | null,
) {
  return (
    membership?.status === "active" &&
    ["owner", "nutritionist"].includes(membership.role ?? "")
  );
}

async function getActivePatientForUser(
  supabase: Awaited<ReturnType<typeof getSupabaseAdmin>>,
  tenantId: string,
  patientId: string,
  userId: string,
) {
  if (!supabase) return null;

  const { data } = await supabase
    .from("patients")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("id", patientId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  return data;
}

function toLegacyCalendarInsert(row: CalendarEventRow) {
  if (row.status === "pending") {
    return {
      ...row,
      title: LEGACY_PENDING_APPOINTMENT_TITLE,
      status: "scheduled" as CalendarEventStatus,
    };
  }

  if (row.status === "confirmed") {
    return {
      ...row,
      status: "scheduled" as CalendarEventStatus,
    };
  }

  return row;
}

function isCalendarEventStatus(status: unknown): status is CalendarEventStatus {
  return (
    status === "pending" ||
    status === "confirmed" ||
    status === "cancelled" ||
    status === "scheduled"
  );
}

function isCalendarStatusConstraintError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const details = error as { code?: string; message?: string };
  return (
    details.code === "23514" ||
    details.message?.includes("calendar_events_status_check") === true
  );
}

function formatCalendarDatabaseError(error: unknown) {
  if (!error || typeof error !== "object") {
    return "No se pudo guardar la agenda.";
  }

  const details = error as { code?: string; message?: string };
  if (
    details.code === "42501" ||
    details.message?.toLowerCase().includes("row-level security")
  ) {
    return "Supabase tiene las politicas de agenda desactualizadas. Ejecuta la migracion 202608040003_calendar_event_policy_repair.sql.";
  }

  if (isCalendarStatusConstraintError(error)) {
    return "Supabase tiene la restriccion de estados de agenda desactualizada. Ejecuta la migracion 202608040003_calendar_event_policy_repair.sql.";
  }

  if (
    details.code === "42703" ||
    details.code === "PGRST204" ||
    details.message?.toLowerCase().includes("video_url")
  ) {
    return "Falta ejecutar la migracion 202608190001_calendar_video_links.sql para guardar enlaces de videollamada.";
  }

  return details.message ?? "No se pudo guardar la agenda.";
}
