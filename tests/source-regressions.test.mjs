import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const componentPath = new URL("../app/components/NutriOSApp.tsx", import.meta.url);
const homePagePath = new URL("../app/page.tsx", import.meta.url);
const repairMigrationPath = new URL(
  "../supabase/migrations/202608040003_calendar_event_policy_repair.sql",
  import.meta.url,
);
const mealServingMigrationPath = new URL(
  "../supabase/migrations/202608100001_meal_item_serving_fields.sql",
  import.meta.url,
);
const chatNotificationsMigrationPath = new URL(
  "../supabase/migrations/202608120001_chat_notifications.sql",
  import.meta.url,
);
const activityDetailsMigrationPath = new URL(
  "../supabase/migrations/202608150001_exercise_activity_details.sql",
  import.meta.url,
);
const usageAnalyticsMigrationPath = new URL(
  "../supabase/migrations/202608150002_usage_analytics.sql",
  import.meta.url,
);
const calendarVideoLinksMigrationPath = new URL(
  "../supabase/migrations/202608190001_calendar_video_links.sql",
  import.meta.url,
);
const patientConsultationsMigrationPath = new URL(
  "../supabase/migrations/202608220001_patient_consultations.sql",
  import.meta.url,
);
const trackingRoutePath = new URL("../app/api/tracking/logs/route.ts", import.meta.url);
const exerciseRoutePath = new URL("../app/api/tracking/exercises/route.ts", import.meta.url);
const analyticsRoutePath = new URL("../app/api/analytics/events/route.ts", import.meta.url);
const chatSendRoutePath = new URL("../app/api/chat/send/route.ts", import.meta.url);
const calendarEventsRoutePath = new URL("../app/api/calendar/events/route.ts", import.meta.url);
const patientConsultationsRoutePath = new URL(
  "../app/api/patients/consultations/route.ts",
  import.meta.url,
);
const notificationServerPath = new URL("../app/lib/notifications/server.ts", import.meta.url);
const brandPath = new URL("../app/lib/brand.ts", import.meta.url);
const manifestPath = new URL("../public/manifest.webmanifest", import.meta.url);
const pushWorkerPath = new URL("../public/push-sw.js", import.meta.url);

test("browser calendar writes go through the server API", async () => {
  const source = await readFile(componentPath, "utf8");

  assert.match(source, /fetch\("\/api\/calendar\/events"/);
  assert.doesNotMatch(source, /\.from\("calendar_events"\)\.(insert|update|delete)\(/);
});

test("data entry remains patient-only and uses the server API", async () => {
  const source = await readFile(componentPath, "utf8");

  assert.match(source, /\{ id: "data-entry", label: "Registro de datos", icon: Plus, patientOnly: true \}/);
  assert.match(source, /activeTab === "data-entry" && role === "patient"/);
  assert.match(source, /fetch\("\/api\/tracking\/logs"/);
});

test("calendar repair migration fixes constraints and policies together", async () => {
  const sql = await readFile(repairMigrationPath, "utf8");

  assert.match(sql, /drop constraint if exists/i);
  assert.match(sql, /calendar_events_status_check/i);
  assert.match(sql, /status in \('pending', 'confirmed', 'cancelled'\)/i);
  assert.match(sql, /Patients can create own appointments/i);
  assert.match(sql, /get_calendar_busy_slots/i);
});

test("home route is the shared app entry point", async () => {
  const source = await readFile(homePagePath, "utf8");

  assert.match(source, /commonEntry/);
  assert.match(source, /tenantSlug="app"/);
  assert.doesNotMatch(source, /resolveTenantSlugFromHost/);
});

test("goals tab is first and goals panel stays only there", async () => {
  const source = await readFile(componentPath, "utf8");

  assert.ok(
    source.indexOf('{ id: "goals", label: "Objetivos", icon: Target }') <
      source.indexOf('{ id: "patients", label: "Clientes", icon: Users }'),
  );
  assert.match(source, /activeTab === "goals" && \(\s*<GoalsPanel/);
  assert.doesNotMatch(source, /goals-panel-open/);
});

test("diet builder keeps serving fields and weekly calendar", async () => {
  const source = await readFile(componentPath, "utf8");
  const sql = await readFile(mealServingMigrationPath, "utf8");

  assert.match(source, /Nombre de la dieta/);
  assert.match(source, /Unidad de medida/);
  assert.match(source, /Tipo de alimento/);
  assert.match(source, /Modo/);
  assert.match(source, /Modificar dieta/);
  assert.match(source, /Guardar cambios/);
  assert.match(source, /Publicar dieta/);
  assert.match(source, /Descargar \/ imprimir/);
  assert.match(source, /Compartir/);
  assert.match(source, /Copiar/);
  assert.match(source, /Pegar/);
  assert.match(source, /Duplicar dieta/);
  assert.match(source, /Activar dieta/);
  assert.match(source, /Desactivar dieta/);
  assert.match(source, /normalizeMealType/);
  assert.match(source, /Media tarde"\) return "Merienda"/);
  assert.match(source, /normalizeMealType\(item\.meal_type\) === normalizeMealType\(mealType\)/);
  assert.match(source, /printing-diet-calendar/);
  assert.match(source, /diet-print-header/);
  assert.match(sql, /add column if not exists quantity/i);
  assert.match(sql, /add column if not exists unit/i);
  assert.match(sql, /add column if not exists food_name/i);
});

test("statistics charts use european dates and stable step trends", async () => {
  const source = await readFile(componentPath, "utf8");

  assert.match(source, /formatShortEuropeanDate/);
  assert.match(source, /getMondayDateKey/);
  assert.match(source, /StepEvolutionChart/);
  assert.match(source, /ComposedChart/);
  assert.match(source, /ReferenceLine/);
  assert.doesNotMatch(source, /date: item\.logged_at\.slice\(5, 10\)/);
  assert.doesNotMatch(source, /date: item\.logged_on\.slice\(5, 10\)/);
});

test("chat notifications support push, in-app notices, and email fallback", async () => {
  const source = await readFile(componentPath, "utf8");
  const sql = await readFile(chatNotificationsMigrationPath, "utf8");
  const chatRoute = await readFile(chatSendRoutePath, "utf8");
  const notificationServer = await readFile(notificationServerPath, "utf8");
  const worker = await readFile(pushWorkerPath, "utf8");

  assert.match(source, /NotificationSettingsPanel/);
  assert.match(source, /NotificationsPanel/);
  assert.match(source, /Activar este dispositivo/);
  assert.match(source, /registerDeviceSubscription/);
  assert.match(source, /setDeviceSubscribed\(saved\)/);
  assert.match(source, /\/api\/notifications\/preferences/);
  assert.match(source, /\/api\/notifications\/push-subscriptions/);
  assert.match(source, /\/api\/chat\/read/);
  assert.match(source, /process-email-fallback/);
  assert.match(chatRoute, /createChatMessageNotification/);
  assert.match(notificationServer, /processDueAppEmailFallbacks/);
  assert.match(notificationServer, /\.in\("type", \["chat_message", "appointment"\]\)/);
  assert.match(worker, /showNotification/);
  assert.match(sql, /create table if not exists public\.notification_preferences/i);
  assert.match(sql, /create table if not exists public\.push_subscriptions/i);
  assert.match(sql, /create table if not exists public\.app_notifications/i);
  assert.match(sql, /email_fallback_due_at/i);
});

test("appointment notifications require customer confirmation and immediate email", async () => {
  const source = await readFile(componentPath, "utf8");
  const calendarRoute = await readFile(calendarEventsRoutePath, "utf8");
  const notificationServer = await readFile(notificationServerPath, "utf8");

  assert.match(source, /Cita enviada al cliente para confirmar/);
  assert.match(source, /Citas pendientes de confirmar/);
  assert.match(source, /Confirmar cita/);
  assert.match(source, /selectedDraftPatientIsValid/);
  assert.match(source, /isPendingPatientConfirmation/);
  assert.match(source, /isPendingNutritionistConfirmation/);
  assert.match(source, /notification\.href === "agenda"/);
  assert.match(calendarRoute, /createAppointmentNotification/);
  assert.match(calendarRoute, /canPatientConfirmAppointment/);
  assert.match(calendarRoute, /insertRow\.event_type === "appointment" && insertRow\.status === "pending"/);
  assert.match(calendarRoute, /Cita pendiente de confirmar/);
  assert.match(calendarRoute, /Cita confirmada por el cliente/);
  assert.match(notificationServer, /type: "appointment"/);
  assert.match(notificationServer, /sendImmediateNotificationEmail/);
  assert.match(notificationServer, /email_sent_at/);
  assert.match(notificationServer, /Abrir agenda en/);
});

test("visible brand and installed app assets use B-aura Connect", async () => {
  const brand = await readFile(brandPath, "utf8");
  const manifest = await readFile(manifestPath, "utf8");
  const worker = await readFile(pushWorkerPath, "utf8");

  assert.match(brand, /B-aura Connect/);
  assert.match(brand, /B-Aura_Connect_icono\.svg/);
  assert.match(brand, /B-Aura_Connect_logo\.svg/);
  assert.match(brand, /B-Aura_Connect_logo_con_slogan\.svg/);
  assert.match(manifest, /"id": "\/"/);
  assert.match(manifest, /B-Aura_Connect_icono\.svg/);
  assert.match(worker, /B-Aura_Connect_icono\.svg/);
});

test("activity tracking has structured sport, duration and weekly summaries", async () => {
  const source = await readFile(componentPath, "utf8");
  const route = await readFile(trackingRoutePath, "utf8");
  const exerciseRoute = await readFile(exerciseRoutePath, "utf8");
  const sql = await readFile(activityDetailsMigrationPath, "utf8");

  assert.match(source, /\{ id: "activities", label: "Actividades", icon: Dumbbell \}/);
  assert.match(source, /activityOptions/);
  assert.match(source, /DurationPickerDialog/);
  assert.match(source, /DistancePickerDialog/);
  assert.match(source, /Modificar/);
  assert.match(source, /postExerciseMutation/);
  assert.match(source, /formatDistanceForInput/);
  assert.match(source, /buildActivityWeekSummary/);
  assert.match(source, /ActivityWeekChart/);
  assert.match(source, /onPreviousWeek/);
  assert.match(source, /distanceKm/);
  assert.match(route, /durationSeconds/);
  assert.match(route, /distanceKm/);
  assert.match(route, /isMissingExerciseDetailsColumn/);
  assert.match(exerciseRoute, /action\?: "update"/);
  assert.match(exerciseRoute, /action\?: "delete"/);
  assert.match(exerciseRoute, /Solo el cliente puede modificar sus actividades/);
  assert.match(sql, /add column if not exists duration_seconds/i);
  assert.match(sql, /add column if not exists distance_km/i);
});

test("usage analytics records tab sessions through the server API", async () => {
  const source = await readFile(componentPath, "utf8");
  const route = await readFile(analyticsRoutePath, "utf8");
  const sql = await readFile(usageAnalyticsMigrationPath, "utf8");

  assert.match(source, /getOrCreateAnalyticsSessionId/);
  assert.match(source, /eventName: "tab_view"/);
  assert.match(source, /fetch\("\/api\/analytics\/events"/);
  assert.match(source, /GoalReferenceIcon/);
  assert.match(source, /Footprints/);
  assert.match(source, /Weight/);
  assert.match(source, /Dumbbell/);
  assert.match(route, /analytics_sessions/);
  assert.match(route, /analytics_events/);
  assert.match(route, /sanitizeAnalyticsMetadata/);
  assert.match(sql, /create table if not exists public\.analytics_sessions/i);
  assert.match(sql, /create table if not exists public\.analytics_events/i);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /analytics_powerbi_tab_usage/i);
});

test("calendar and statistics support video links and sleep charts", async () => {
  const source = await readFile(componentPath, "utf8");
  const calendarRoute = await readFile(new URL("../app/api/calendar/events/route.ts", import.meta.url), "utf8");
  const sql = await readFile(calendarVideoLinksMigrationPath, "utf8");

  assert.match(source, /Enlace de videollamada/);
  assert.match(source, /Abrir videollamada/);
  assert.match(source, /AppointmentVideoLinkEditor/);
  assert.match(source, /Añadir enlace/);
  assert.match(source, /Editar enlace/);
  assert.match(source, /action: "update-video-url"/);
  assert.match(source, /SleepEvolutionChart/);
  assert.match(source, /buildSleepChartData/);
  assert.match(source, /goalLogs=\{patientGoalLogs\}/);
  assert.match(source, /tenant\.logo_url \|\| APP_ICON_SRC/);
  assert.match(calendarRoute, /normalizeVideoUrl/);
  assert.match(calendarRoute, /updateCalendarEventVideoUrl/);
  assert.match(calendarRoute, /Solo se puede editar el enlace en citas online/);
  assert.match(calendarRoute, /video_url/);
  assert.match(sql, /add column if not exists video_url/i);
});

test("nutritionist patient detail has consultation records", async () => {
  const source = await readFile(componentPath, "utf8");
  const route = await readFile(patientConsultationsRoutePath, "utf8");
  const sql = await readFile(patientConsultationsMigrationPath, "utf8");

  assert.match(source, /PatientDetailTab = "record" \| "consultations"/);
  assert.match(source, /Ficha del cliente/);
  assert.match(source, /Consultas/);
  assert.match(source, /Medidas básicas/);
  assert.match(source, /Datos personales/);
  assert.match(source, /Menstruación y embarazo/);
  assert.match(source, /Nivel Actividad Física/);
  assert.match(source, /Diagnóstico/);
  assert.match(source, /Guardar consulta/);
  assert.match(source, /\/api\/patients\/consultations/);
  assert.match(route, /verifyNutritionistPatientAccess/);
  assert.match(route, /patient_consultations/);
  assert.match(route, /validActivityLevels/);
  assert.match(sql, /create table if not exists public\.patient_consultations/i);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /Nutritionists can insert patient consultations/i);
});
