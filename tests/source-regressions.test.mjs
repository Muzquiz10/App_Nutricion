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
const trackingRoutePath = new URL("../app/api/tracking/logs/route.ts", import.meta.url);
const chatSendRoutePath = new URL("../app/api/chat/send/route.ts", import.meta.url);
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
  assert.match(worker, /showNotification/);
  assert.match(sql, /create table if not exists public\.notification_preferences/i);
  assert.match(sql, /create table if not exists public\.push_subscriptions/i);
  assert.match(sql, /create table if not exists public\.app_notifications/i);
  assert.match(sql, /email_fallback_due_at/i);
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
  const sql = await readFile(activityDetailsMigrationPath, "utf8");

  assert.match(source, /\{ id: "activities", label: "Actividades", icon: Dumbbell \}/);
  assert.match(source, /activityOptions/);
  assert.match(source, /DurationPickerDialog/);
  assert.match(source, /buildActivityWeekSummary/);
  assert.match(source, /ActivityWeekChart/);
  assert.match(source, /distanceKm/);
  assert.match(route, /durationSeconds/);
  assert.match(route, /distanceKm/);
  assert.match(route, /isMissingExerciseDetailsColumn/);
  assert.match(sql, /add column if not exists duration_seconds/i);
  assert.match(sql, /add column if not exists distance_km/i);
});
