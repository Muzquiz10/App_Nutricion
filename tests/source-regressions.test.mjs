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
