import { NextResponse } from "next/server";
import { createAppointmentNotification } from "../../../lib/notifications/server";
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

type CalendarEventInsertRow = CalendarEventRow & {
  created_by: string;
};

type StoredCalendarEvent = {
  id: string;
  tenant_id: string;
  patient_id: string | null;
  created_by: string | null;
  title: string;
  event_type: CalendarEventType;
  appointment_mode: AppointmentMode | null;
  start_at: string;
  end_at: string;
  status: CalendarEventStatus;
};

type CalendarNotificationPatient = {
  id: string;
  tenant_id: string;
  user_id: string | null;
  nutritionist_user_id: string;
  full_name: string;
};

type CalendarEventsBody = {
  action?: "create" | "update-status" | "update-video-url";
  eventId?: string;
  row?: CalendarEventRow;
  status?: CalendarEventStatus;
  title?: string;
  videoUrl?: string | null;
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
    return createCalendarEvent(supabase, request, user.id, body.row);
  }

  if (body.action === "update-status") {
    return updateCalendarEventStatus(
      supabase,
      request,
      user.id,
      body.eventId,
      body.status,
      body.title,
    );
  }

  if (body.action === "update-video-url") {
    return updateCalendarEventVideoUrl(
      supabase,
      user.id,
      body.eventId,
      body.videoUrl,
    );
  }

  return NextResponse.json(
    { error: "Accion de agenda no valida." },
    { status: 400 },
  );
}

async function createCalendarEvent(
  supabase: Awaited<ReturnType<typeof getSupabaseAdmin>>,
  request: Request,
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
    created_by: userId,
    ...(normalizedVideoUrl ? { video_url: normalizedVideoUrl } : {}),
  } as CalendarEventInsertRow;
  let { data, error } = await supabase
    .from("calendar_events")
    .insert(insertRow)
    .select("*")
    .single();

  if (
    isCalendarStatusConstraintError(error) &&
    !(insertRow.event_type === "appointment" && insertRow.status === "pending")
  ) {
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

  await notifyCalendarEventCreated({
    supabase,
    request,
    userId,
    event: data as StoredCalendarEvent,
    isNutritionist,
  });

  return NextResponse.json({ ok: true, event: data });
}

async function updateCalendarEventStatus(
  supabase: Awaited<ReturnType<typeof getSupabaseAdmin>>,
  request: Request,
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
    .select("id,tenant_id,patient_id,created_by,title,event_type,appointment_mode,start_at,end_at,status")
    .eq("id", eventId)
    .maybeSingle();

  if (eventError || !event) {
    return NextResponse.json({ error: "Evento no encontrado." }, { status: 404 });
  }

  const storedEvent = event as StoredCalendarEvent;
  const membership = await getMembership(supabase, storedEvent.tenant_id, userId);
  const isNutritionist = isActiveNutritionist(membership);
  const patientCanConfirm = await canPatientConfirmAppointment(
    supabase,
    storedEvent,
    userId,
    status,
  );

  if (!isNutritionist && !patientCanConfirm) {
    return NextResponse.json(
      { error: "No tienes permisos para modificar esta cita." },
      { status: 403 },
    );
  }

  let updateRow = {
    status,
    ...(isNutritionist && title ? { title } : {}),
  };

  let { error } = await supabase
    .from("calendar_events")
    .update(updateRow)
    .eq("id", eventId);

  if (isCalendarStatusConstraintError(error)) {
    updateRow = {
      status: status === "confirmed" ? "scheduled" : status,
      ...(isNutritionist && title ? { title } : {}),
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

  await notifyCalendarEventStatusUpdated({
    supabase,
    request,
    userId,
    event: storedEvent,
    status,
    isNutritionist,
  });

  return NextResponse.json({ ok: true });
}

async function updateCalendarEventVideoUrl(
  supabase: Awaited<ReturnType<typeof getSupabaseAdmin>>,
  userId: string,
  eventId: string | undefined,
  videoUrl: string | null | undefined,
) {
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase no esta configurado en el servidor." },
      { status: 500 },
    );
  }

  if (!eventId) {
    return NextResponse.json(
      { error: "Falta la cita para guardar el enlace." },
      { status: 400 },
    );
  }

  const { data: event, error: eventError } = await supabase
    .from("calendar_events")
    .select("id,tenant_id,event_type,appointment_mode")
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

  if (event.event_type !== "appointment" || event.appointment_mode !== "online") {
    return NextResponse.json(
      { error: "Solo se puede editar el enlace en citas online." },
      { status: 400 },
    );
  }

  const normalizedVideoUrl = normalizeVideoUrl(videoUrl);
  if (videoUrl?.trim() && !normalizedVideoUrl) {
    return NextResponse.json(
      { error: "El enlace de videollamada no es valido." },
      { status: 400 },
    );
  }

  const { error } = await supabase
    .from("calendar_events")
    .update({ video_url: normalizedVideoUrl || null })
    .eq("id", eventId);

  if (error) {
    return NextResponse.json(
      { error: formatCalendarDatabaseError(error) },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}

async function notifyCalendarEventCreated({
  supabase,
  request,
  userId,
  event,
  isNutritionist,
}: {
  supabase: NonNullable<Awaited<ReturnType<typeof getSupabaseAdmin>>>;
  request: Request;
  userId: string;
  event: StoredCalendarEvent;
  isNutritionist: boolean;
}) {
  if (!isPendingAppointment(event) || !event.patient_id) return;

  const patient = await getCalendarNotificationPatient(
    supabase,
    event.tenant_id,
    event.patient_id,
  );
  if (!patient) return;

  const when = formatAppointmentWhen(event);

  if (isNutritionist) {
    const tenantName = await getTenantName(supabase, event.tenant_id);
    await createAppointmentNotification({
      supabase,
      request,
      tenantId: event.tenant_id,
      patientId: patient.id,
      recipientUserId: patient.user_id,
      actorUserId: userId,
      title: "Cita pendiente de confirmar",
      body: `${tenantName} te ha propuesto una cita ${when}. Entra en Agenda para confirmarla.`,
    });
    return;
  }

  await createAppointmentNotification({
    supabase,
    request,
    tenantId: event.tenant_id,
    patientId: patient.id,
    recipientUserId: patient.nutritionist_user_id,
    actorUserId: userId,
    title: "Nueva solicitud de cita",
    body: `${patient.full_name} ha solicitado una cita ${when}. Entra en Agenda para revisarla.`,
  });
}

async function notifyCalendarEventStatusUpdated({
  supabase,
  request,
  userId,
  event,
  status,
  isNutritionist,
}: {
  supabase: NonNullable<Awaited<ReturnType<typeof getSupabaseAdmin>>>;
  request: Request;
  userId: string;
  event: StoredCalendarEvent;
  status: CalendarEventStatus;
  isNutritionist: boolean;
}) {
  if (event.event_type !== "appointment" || !event.patient_id) return;

  const patient = await getCalendarNotificationPatient(
    supabase,
    event.tenant_id,
    event.patient_id,
  );
  if (!patient) return;

  const when = formatAppointmentWhen(event);

  if (status === "confirmed" && isNutritionist) {
    await createAppointmentNotification({
      supabase,
      request,
      tenantId: event.tenant_id,
      patientId: patient.id,
      recipientUserId: patient.user_id,
      actorUserId: userId,
      title: "Cita confirmada",
      body: `Tu cita ${when} ha sido confirmada.`,
    });
    return;
  }

  if (status === "confirmed" && !isNutritionist) {
    await createAppointmentNotification({
      supabase,
      request,
      tenantId: event.tenant_id,
      patientId: patient.id,
      recipientUserId: patient.nutritionist_user_id,
      actorUserId: userId,
      title: "Cita confirmada por el cliente",
      body: `${patient.full_name} ha confirmado la cita ${when}.`,
    });
    return;
  }

  if (status === "cancelled") {
    await createAppointmentNotification({
      supabase,
      request,
      tenantId: event.tenant_id,
      patientId: patient.id,
      recipientUserId: isNutritionist ? patient.user_id : patient.nutritionist_user_id,
      actorUserId: userId,
      title: "Cita cancelada",
      body: `La cita ${when} ha sido cancelada.`,
    });
  }
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

async function canPatientConfirmAppointment(
  supabase: Awaited<ReturnType<typeof getSupabaseAdmin>>,
  event: StoredCalendarEvent,
  userId: string,
  nextStatus: CalendarEventStatus | undefined,
) {
  if (!supabase) return false;
  if (nextStatus !== "confirmed") return false;
  if (!isPendingAppointment(event) || !event.patient_id) return false;
  if (!event.created_by || event.created_by === userId) return false;

  const patient = await getActivePatientForUser(
    supabase,
    event.tenant_id,
    event.patient_id,
    userId,
  );

  return Boolean(patient);
}

async function getCalendarNotificationPatient(
  supabase: NonNullable<Awaited<ReturnType<typeof getSupabaseAdmin>>>,
  tenantId: string,
  patientId: string,
): Promise<CalendarNotificationPatient | null> {
  const { data } = await supabase
    .from("patients")
    .select("id,tenant_id,user_id,nutritionist_user_id,full_name")
    .eq("tenant_id", tenantId)
    .eq("id", patientId)
    .eq("status", "active")
    .maybeSingle();

  return data as CalendarNotificationPatient | null;
}

async function getTenantName(
  supabase: NonNullable<Awaited<ReturnType<typeof getSupabaseAdmin>>>,
  tenantId: string,
) {
  const { data } = await supabase
    .from("tenants")
    .select("name")
    .eq("id", tenantId)
    .maybeSingle();

  return data?.name ?? "Tu profesional";
}

function isPendingAppointment(event: StoredCalendarEvent) {
  return (
    event.event_type === "appointment" &&
    (event.status === "pending" ||
      (event.status === "scheduled" &&
        event.title === LEGACY_PENDING_APPOINTMENT_TITLE))
  );
}

function formatAppointmentWhen(event: Pick<StoredCalendarEvent, "start_at">) {
  return new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Madrid",
  }).format(new Date(event.start_at));
}

function toLegacyCalendarInsert(row: CalendarEventInsertRow) {
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
