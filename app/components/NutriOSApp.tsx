"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Archive,
  Bell,
  Ban,
  BookOpen,
  CalendarDays,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  Copy,
  Dumbbell,
  FileText,
  Footprints,
  Frown,
  ImagePlus,
  KeyRound,
  LifeBuoy,
  Loader2,
  MapPin,
  Meh,
  LogOut,
  MessageCircle,
  Palette,
  Pencil,
  Plus,
  Printer,
  RotateCcw,
  Send,
  Settings as SettingsIcon,
  Share2,
  ShieldCheck,
  Smile,
  Target,
  Trash2,
  Upload,
  UserPlus,
  Video,
  Users,
  Weight,
  X,
} from "lucide-react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  createSupabaseBrowser,
  type SupabasePublicConfig,
} from "../lib/supabase/browser";
import {
  APP_ICON_SRC,
  APP_LOGO_SRC,
  APP_LOGO_WITH_SLOGAN_SRC,
  APP_NAME,
  APP_PRIMARY_COLOR,
} from "../lib/brand";
import type { Tenant } from "../lib/types";

type UserRole = "owner" | "nutritionist" | "patient";
type LoginIntent = "patient" | "professional";
type DietEditorMode = "create" | "edit";

type Patient = {
  id: string;
  tenant_id: string;
  user_id: string | null;
  nutritionist_user_id: string;
  patient_code: string;
  full_name: string;
  age: number;
  height_cm: number;
  initial_weight_kg: number;
  current_weight_kg: number;
  waist_cm: number | null;
  objective: string | null;
  sex: "male" | "female" | null;
  allergies: string | null;
  avoided_foods: string | null;
  exercise_routine: string | null;
  exercise_hours_per_week: number | null;
  exercise_type: string | null;
  questionnaire_version?: number;
  questionnaire_completed_at?: string | null;
  status?: "active" | "inactive" | "archived";
  registered_at: string;
};

type PendingInvitation = {
  id: string;
  email: string;
  token: string;
  status: string;
  expires_at: string;
  created_at: string;
};

type WeightLog = {
  id: string;
  patient_id: string;
  weight_kg: number;
  logged_at: string;
  source: string | null;
};

type WaistLog = {
  id: string;
  patient_id: string;
  waist_cm: number;
  logged_at: string;
};

type ExerciseLog = {
  id: string;
  patient_id: string;
  activity: string;
  duration_minutes: number | null;
  duration_seconds?: number | null;
  distance_km?: number | null;
  intensity: string | null;
  logged_at: string;
};

type ActivityWeekSummary = {
  weekStart: string;
  weekEnd: string;
  durationSeconds: number;
  distanceKm: number;
  activityCount: number;
  days: Array<{
    dateKey: string;
    label: string;
    shortLabel: string;
    durationSeconds: number;
    distanceKm: number;
    logs: ExerciseLog[];
  }>;
};

type StepLog = {
  id: string;
  patient_id: string;
  steps: number;
  logged_on: string;
  source: "patient" | "integration";
};

type GoalType =
  | "steps_daily"
  | "weight_logged"
  | "activity_logged"
  | "custom";

type GoalStatus = "fulfilled" | "in_progress" | "not_fulfilled";
type CustomGoalInputType = "check" | "number" | "minutes" | "sleep_hours";

type PatientGoal = {
  id: string;
  tenant_id: string;
  patient_id: string;
  goal_type: GoalType;
  title: string;
  target_value: number | null;
  unit: string | null;
  is_active: boolean;
  custom_status: GoalStatus;
  custom_input_type?: CustomGoalInputType | null;
  created_at: string;
  updated_at: string;
};

type GoalSummary = PatientGoal & {
  status: GoalStatus;
  detail: string;
};

type PatientGoalLog = {
  id: string;
  tenant_id: string;
  patient_id: string;
  goal_id: string;
  logged_on: string;
  status: GoalStatus;
  value: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type AppointmentMode = "online" | "presential";
type CalendarEventType = "appointment" | "block" | "note";
type CalendarEventStatus = "pending" | "confirmed" | "cancelled" | "scheduled";
const LEGACY_PENDING_APPOINTMENT_TITLE = "Solicitud pendiente de cita";

type AppointmentAvailability = {
  id: string;
  tenant_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  slot_minutes: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type CalendarEvent = {
  id: string;
  tenant_id: string;
  patient_id: string | null;
  created_by: string | null;
  title: string;
  notes: string | null;
  event_type: CalendarEventType;
  appointment_mode: AppointmentMode | null;
  blocks_availability: boolean;
  start_at: string;
  end_at: string;
  status: CalendarEventStatus;
  created_at: string;
  updated_at: string;
};

type AvailableAppointmentSlot = {
  id: string;
  dateKey: string;
  startAt: string;
  endAt: string;
  label: string;
};

type CalendarBusySlot = {
  id: string;
  start_at: string;
  end_at: string;
};

type MealPhoto = {
  id: string;
  patient_id: string;
  storage_path: string;
  signed_url?: string;
  notes: string | null;
  meal_type: string | null;
  logged_at: string;
};

type DocumentFile = {
  id: string;
  patient_id: string;
  title: string;
  storage_path: string;
  signed_url?: string;
  content_type: string | null;
  created_at: string;
};

type Conversation = {
  id: string;
  patient_id: string;
  nutritionist_user_id: string;
};

type ChatMessage = {
  id: string;
  conversation_id: string;
  patient_id: string;
  sender_id: string;
  body: string;
  read_at?: string | null;
  created_at: string;
};

type AppNotification = {
  id: string;
  tenant_id: string;
  user_id: string;
  patient_id: string | null;
  type: "chat_message" | "appointment";
  title: string;
  body: string;
  href: string | null;
  related_message_id: string | null;
  read_at: string | null;
  email_fallback_due_at?: string | null;
  email_sent_at?: string | null;
  created_at: string;
};

type NotificationPreferences = {
  tenant_id?: string;
  user_id?: string;
  email_enabled: boolean;
  push_enabled: boolean;
};

type MealPlan = {
  id: string;
  patient_id: string;
  title: string;
  start_date: string | null;
  status: string;
  meal_plan_days?: MealPlanDay[];
};

type MealPlanDay = {
  id: string;
  day_index: number;
  day_label: string;
  notes: string | null;
  meal_items?: MealItem[];
};

type MealItem = {
  id: string;
  meal_plan_day_id?: string;
  meal_type: string;
  title: string;
  description: string | null;
  quantity?: number | string | null;
  unit?: string | null;
  food_name?: string | null;
  position: number;
};

type DraftMealItem = {
  dayIndex: number;
  mealType: string;
  quantity?: string;
  unit?: string;
  foodName?: string;
  title: string;
  description: string;
};

type MealPlanDraft = {
  title: string;
  startDate: string;
  entryRows: DraftMealItem[];
  draftItems: DraftMealItem[];
};

type TabId =
  | "patients"
  | "plans"
  | "goals"
  | "data-entry"
  | "activities"
  | "stats"
  | "tracking"
  | "chat"
  | "documents"
  | "agenda"
  | "notifications"
  | "settings";
type PatientListView = "active" | "pending" | "inactive";

type CreateInvitationResponse = {
  error?: string;
  delivery?: "email" | "manual_link";
  invitationId?: string;
  invitationUrl?: string;
  actionLink?: string;
  warning?: string;
};

type SendChatMessageResponse = {
  error?: string;
  conversation?: Conversation;
  message?: ChatMessage;
};

type MarkChatReadResponse = {
  error?: string;
  ok?: boolean;
  readAt?: string;
  messageIds?: string[];
};

type NotificationPreferencesResponse = {
  error?: string;
  ok?: boolean;
  preferences?: NotificationPreferences;
};

type QuestionnaireResponse = {
  error?: string;
  ok?: boolean;
};

type DeleteMealPhotoResponse = {
  error?: string;
  ok?: boolean;
  warning?: string;
};

type UpdatePatientStatusResponse = {
  error?: string;
  ok?: boolean;
  patientName?: string;
  status?: "active" | "inactive";
};

type SupportRequestResponse = {
  error?: string;
  ok?: boolean;
};

const tabs: Array<{
  id: TabId;
  label: string;
  icon: typeof Users;
  patientOnly?: boolean;
  nutritionistOnly?: boolean;
}> = [
  { id: "goals", label: "Objetivos", icon: Target },
  { id: "patients", label: "Clientes", icon: Users },
  { id: "plans", label: "Dietas", icon: BookOpen },
  { id: "data-entry", label: "Registro de datos", icon: Plus, patientOnly: true },
  { id: "activities", label: "Actividades", icon: Dumbbell },
  { id: "stats", label: "Estadísticas", icon: Activity },
  { id: "chat", label: "Chat", icon: MessageCircle },
  { id: "documents", label: "Documentos", icon: FileText },
  { id: "agenda", label: "Agenda", icon: CalendarDays },
  { id: "notifications", label: "Notificaciones", icon: Bell },
  { id: "settings", label: "Configuración", icon: SettingsIcon },
];

const dayLabels = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
];
const activityWeekdayLabels = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
];
const activityWeekdayShortLabels = ["L", "M", "X", "J", "V", "S", "D"];

const mealTypes = ["Desayuno", "Almuerzo", "Comida", "Media tarde", "Cena"];
const mealPhotoTypes = [...mealTypes, "Snack"];
const mealUnitOptions = [
  "Gramos",
  "Kilogramos",
  "Mililitros",
  "Litros",
  "Unidades",
  "Cucharadas",
  "Cucharaditas",
  "Tazas",
  "Raciones",
];
const activityOptions = [
  "",
  "Correr",
  "Caminar",
  "Bicicleta",
  "Bicicleta Interior",
  "Bicicleta Rodillo",
  "Natación",
  "Fuerza",
  "Yoga",
  "Elíptica",
  "Cardio",
  "Pilates",
  "Senderismo",
  "Pádel",
  "Tenis",
  "Fútbol",
  "Baloncesto",
  "Remo",
  "HIIT",
  "Boxeo",
  "Movilidad",
  "Otro",
].map((label) => ({
  value: label,
  label: label || "Selecciona un deporte",
}));
const maxLogoFileSizeBytes = 2 * 1024 * 1024;
const maxMealPhotoDimension = 1600;
const mealPhotoQuality = 0.82;
const weekdayOptions = [
  { value: "1", label: "Lunes" },
  { value: "2", label: "Martes" },
  { value: "3", label: "Miercoles" },
  { value: "4", label: "Jueves" },
  { value: "5", label: "Viernes" },
  { value: "6", label: "Sabado" },
  { value: "0", label: "Domingo" },
];
const agendaWeekdayLabels = ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado", "Domingo"];
const appointmentModeOptions: Array<{ value: AppointmentMode; label: string }> = [
  { value: "online", label: "Online" },
  { value: "presential", label: "Presencial" },
];
const calendarEventTypeOptions: Array<{ value: CalendarEventType; label: string }> = [
  { value: "block", label: "Bloqueo" },
  { value: "note", label: "Nota" },
];

const mealTypeOrder = new Map<string, number>([
  ...mealTypes.map((mealType, index) => [mealType, index] as const),
  ["Media mañana", 1],
  ["Merienda", 3],
]);
const mealPhotoTypeOrder = new Map(
  mealPhotoTypes.map((mealType, index) => [mealType, index]),
);
const systemGoalDefinitions: Record<
  Exclude<GoalType, "custom">,
  { title: string; unit: string | null }
> = {
  steps_daily: { title: "Pasos diarios", unit: "pasos" },
  weight_logged: { title: "Registrar peso", unit: null },
  activity_logged: { title: "Realizar actividad", unit: null },
};
const goalCreationOptions: Array<{
  value: Exclude<GoalType, "steps_daily">;
  label: string;
}> = [
  { value: "weight_logged", label: "Registro de peso" },
  { value: "activity_logged", label: "Actividad realizada" },
  { value: "custom", label: "Objetivo personalizado" },
];
const measurableGoalOptions: Array<{ value: "steps_daily"; label: string }> = [
  { value: "steps_daily", label: "Pasos diarios" },
];
const customGoalInputOptions: Array<{ value: CustomGoalInputType; label: string }> = [
  { value: "check", label: "Sí/No" },
  { value: "number", label: "Numérico" },
  { value: "minutes", label: "Tiempo en minutos" },
  { value: "sleep_hours", label: "Horas de sueño" },
];
const checkGoalStatusOptions: Array<{ value: string; label: string }> = [
  { value: "", label: "Sin cambios" },
  { value: "fulfilled", label: "Hecho" },
  { value: "not_fulfilled", label: "No hecho" },
];
const goalStatusMeta: Record<
  GoalStatus,
  {
    label: string;
    icon: typeof Users;
    cardClass: string;
    iconClass: string;
    badgeClass: string;
  }
> = {
  fulfilled: {
    label: "Cumplido",
    icon: Smile,
    cardClass: "border-[#b8dccd] bg-[#effaf5]",
    iconClass: "bg-[#e4f4e6] text-[#4b9f51]",
    badgeClass: "bg-[#dcefe7] text-[#255d50]",
  },
  in_progress: {
    label: "En proceso",
    icon: Meh,
    cardClass: "border-[#ead39b] bg-[#fff8df]",
    iconClass: "bg-[#f3e2b2] text-[#8a5c18]",
    badgeClass: "bg-[#f3e2b2] text-[#6b5420]",
  },
  not_fulfilled: {
    label: "No cumplido",
    icon: Frown,
    cardClass: "border-[#efc4ba] bg-[#fff3f0]",
    iconClass: "bg-[#f7d7cf] text-[#8a3327]",
    badgeClass: "bg-[#f7d7cf] text-[#8a3327]",
  },
};
const currentQuestionnaireVersion = 2;
const goalOptions = [
  "Reducir peso",
  "Ganar masa muscular",
  "Bienestar",
  "Aprendizaje",
];
const sexOptions = [
  { value: "male", label: "Hombre" },
  { value: "female", label: "Mujer" },
];

const demoTenant = (slug: string): Tenant => ({
  id: "demo-tenant",
  slug,
  name: `Espacio ${APP_NAME}`,
  logo_url: null,
  primary_color: APP_PRIMARY_COLOR,
  privacy_policy_url: null,
});

const commonLoginTenant: Tenant = {
  id: "common-login",
  slug: "app",
  name: "Acceso común",
  logo_url: null,
  primary_color: APP_PRIMARY_COLOR,
  privacy_policy_url: null,
};

const demoPatients: Patient[] = [
  {
    id: "demo-patient-1",
    tenant_id: "demo-tenant",
    user_id: "demo-patient-user",
    nutritionist_user_id: "demo-nutritionist",
    patient_code: "PAT-8F42C1A9",
    full_name: "Laura Martin Ruiz",
    age: 34,
    height_cm: 168,
    initial_weight_kg: 76.2,
    current_weight_kg: 73.4,
    waist_cm: 82,
    objective: "Reducir peso",
    sex: "female",
    allergies: "Lactosa",
    avoided_foods: "Pescado azul y brocoli",
    exercise_routine: "Camina 4 dias por semana y hace fuerza 2 dias",
    exercise_hours_per_week: 5,
    exercise_type: "Caminar y fuerza",
    questionnaire_version: 2,
    questionnaire_completed_at: new Date("2026-07-03T09:30:00").toISOString(),
    status: "active",
    registered_at: new Date("2026-07-03T09:30:00").toISOString(),
  },
  {
    id: "demo-patient-2",
    tenant_id: "demo-tenant",
    user_id: "demo-patient-user-2",
    nutritionist_user_id: "demo-nutritionist",
    patient_code: "PAT-12DA88B4",
    full_name: "Carlos Sanz Perez",
    age: 41,
    height_cm: 181,
    initial_weight_kg: 91.1,
    current_weight_kg: 89.9,
    waist_cm: 96,
    objective: "Bienestar",
    sex: "male",
    allergies: "Sin alergias declaradas",
    avoided_foods: "Coliflor",
    exercise_routine: "Bicicleta los fines de semana",
    exercise_hours_per_week: 2,
    exercise_type: "Bicicleta",
    questionnaire_version: 2,
    questionnaire_completed_at: new Date("2026-07-10T16:00:00").toISOString(),
    status: "active",
    registered_at: new Date("2026-07-10T16:00:00").toISOString(),
  },
];

const demoPendingInvitations: PendingInvitation[] = [
  {
    id: "demo-invite-1",
    email: "cliente.pendiente@example.com",
    token: "demo-token",
    status: "pending",
    expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 10).toISOString(),
    created_at: new Date().toISOString(),
  },
];

const demoWeights: WeightLog[] = [
  {
    id: "w1",
    patient_id: "demo-patient-1",
    weight_kg: 76.2,
    source: "initial",
    logged_at: "2026-07-03",
  },
  {
    id: "w2",
    patient_id: "demo-patient-1",
    weight_kg: 75.4,
    source: "patient",
    logged_at: "2026-07-10",
  },
  {
    id: "w3",
    patient_id: "demo-patient-1",
    weight_kg: 74.5,
    source: "patient",
    logged_at: "2026-07-17",
  },
  {
    id: "w4",
    patient_id: "demo-patient-1",
    weight_kg: 73.4,
    source: "patient",
    logged_at: "2026-07-24",
  },
];

const demoWaist: WaistLog[] = [
  { id: "c1", patient_id: "demo-patient-1", waist_cm: 86, logged_at: "2026-07-03" },
  { id: "c2", patient_id: "demo-patient-1", waist_cm: 84, logged_at: "2026-07-17" },
  { id: "c3", patient_id: "demo-patient-1", waist_cm: 82, logged_at: "2026-07-24" },
];

const demoSteps: StepLog[] = [
  { id: "s1", patient_id: "demo-patient-1", steps: 6800, logged_on: "2026-07-22", source: "patient" },
  { id: "s2", patient_id: "demo-patient-1", steps: 8400, logged_on: "2026-07-23", source: "patient" },
  { id: "s3", patient_id: "demo-patient-1", steps: 9200, logged_on: "2026-07-24", source: "patient" },
  { id: "s4", patient_id: "demo-patient-1", steps: 6200, logged_on: getLocalDateString(), source: "patient" },
];

const demoExercises: ExerciseLog[] = [
  {
    id: "ex-demo-1",
    patient_id: "demo-patient-1",
    activity: "Fuerza",
    duration_minutes: 45,
    duration_seconds: 45 * 60,
    distance_km: null,
    intensity: "normal",
    logged_at: addDaysToDateKey(getMondayDateKey(getLocalDateString()), 0),
  },
  {
    id: "ex-demo-2",
    patient_id: "demo-patient-1",
    activity: "Correr",
    duration_minutes: 36,
    duration_seconds: 36 * 60 + 20,
    distance_km: 6.2,
    intensity: "normal",
    logged_at: addDaysToDateKey(getMondayDateKey(getLocalDateString()), 2),
  },
  {
    id: "ex-demo-3",
    patient_id: "demo-patient-1",
    activity: "Yoga",
    duration_minutes: 30,
    duration_seconds: 30 * 60,
    distance_km: null,
    intensity: "normal",
    logged_at: addDaysToDateKey(getMondayDateKey(getLocalDateString()), 5),
  },
  {
    id: "ex-demo-4",
    patient_id: "demo-patient-1",
    activity: "Bicicleta",
    duration_minutes: 58,
    duration_seconds: 58 * 60,
    distance_km: 18.4,
    intensity: "normal",
    logged_at: addDaysToDateKey(addDaysToDateKey(getMondayDateKey(getLocalDateString()), -7), 1),
  },
];

const demoGoals: PatientGoal[] = [
  {
    id: "goal-demo-steps",
    tenant_id: "demo-tenant",
    patient_id: "demo-patient-1",
    goal_type: "steps_daily",
    title: "Pasos diarios",
    target_value: 8000,
    unit: "pasos",
    is_active: true,
    custom_status: "in_progress",
    custom_input_type: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "goal-demo-weight",
    tenant_id: "demo-tenant",
    patient_id: "demo-patient-1",
    goal_type: "weight_logged",
    title: "Registrar peso",
    target_value: null,
    unit: null,
    is_active: true,
    custom_status: "in_progress",
    custom_input_type: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "goal-demo-custom",
    tenant_id: "demo-tenant",
    patient_id: "demo-patient-1",
    goal_type: "custom",
    title: "Preparar comidas de la semana",
    target_value: null,
    unit: "hecho",
    is_active: true,
    custom_status: "fulfilled",
    custom_input_type: "check",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const demoGoalLogs: PatientGoalLog[] = [
  {
    id: "goal-log-demo-custom",
    tenant_id: "demo-tenant",
    patient_id: "demo-patient-1",
    goal_id: "goal-demo-custom",
    logged_on: getLocalDateString(),
    status: "fulfilled",
    value: null,
    notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const demoAvailability: AppointmentAvailability[] = [
  {
    id: "availability-demo-1",
    tenant_id: "demo-tenant",
    weekday: 1,
    start_time: "09:00:00",
    end_time: "13:00:00",
    slot_minutes: 60,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "availability-demo-2",
    tenant_id: "demo-tenant",
    weekday: 3,
    start_time: "16:00:00",
    end_time: "20:00:00",
    slot_minutes: 60,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const demoCalendarEvents: CalendarEvent[] = [
  {
    id: "calendar-demo-1",
    tenant_id: "demo-tenant",
    patient_id: "demo-patient-1",
    created_by: "demo-nutritionist",
    title: "Revision mensual",
    notes: "Primera revision de progreso.",
    event_type: "appointment",
    appointment_mode: "online",
    blocks_availability: true,
    start_at: buildLocalDateTimeIso(getLocalDateString(new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)), "10:00"),
    end_at: buildLocalDateTimeIso(getLocalDateString(new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)), "11:00"),
    status: "confirmed",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "calendar-demo-2",
    tenant_id: "demo-tenant",
    patient_id: null,
    created_by: "demo-nutritionist",
    title: "Gestion interna",
    notes: "Bloque no disponible.",
    event_type: "block",
    appointment_mode: null,
    blocks_availability: true,
    start_at: buildLocalDateTimeIso(getLocalDateString(new Date(Date.now() + 4 * 24 * 60 * 60 * 1000)), "12:00"),
    end_at: buildLocalDateTimeIso(getLocalDateString(new Date(Date.now() + 4 * 24 * 60 * 60 * 1000)), "13:00"),
    status: "confirmed",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "calendar-demo-3",
    tenant_id: "demo-tenant",
    patient_id: "demo-patient-2",
    created_by: "demo-patient-user-2",
    title: "Solicitud de cita",
    notes: null,
    event_type: "appointment",
    appointment_mode: "presential",
    blocks_availability: true,
    start_at: buildLocalDateTimeIso(getLocalDateString(new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)), "17:00"),
    end_at: buildLocalDateTimeIso(getLocalDateString(new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)), "18:00"),
    status: "pending",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const demoBusySlots: CalendarBusySlot[] = demoCalendarEvents
  .filter((event) => isCalendarEventBlocking(event))
  .map((event) => ({
    id: event.id,
    start_at: event.start_at,
    end_at: event.end_at,
  }));

const demoConversation: Conversation = {
  id: "demo-conversation",
  patient_id: "demo-patient-1",
  nutritionist_user_id: "demo-nutritionist",
};

const demoMessages: ChatMessage[] = [
  {
    id: "m1",
    conversation_id: "demo-conversation",
    patient_id: "demo-patient-1",
    sender_id: "demo-patient-user",
    body: "Ayer cambie la cena por una tortilla francesa. Lo registro aqui.",
    created_at: "2026-07-24T18:20:00",
  },
  {
    id: "m2",
    conversation_id: "demo-conversation",
    patient_id: "demo-patient-1",
    sender_id: "demo-nutritionist",
    body: "Perfecto. Mantente con una racion de verdura y revisamos el peso el viernes.",
    created_at: "2026-07-24T19:02:00",
  },
];

const demoPlan: MealPlan = {
  id: "demo-plan",
  patient_id: "demo-patient-1",
  title: "Plan semanal equilibrado",
  start_date: "2026-07-27",
  status: "published",
  meal_plan_days: [
    {
      id: "day-1",
      day_index: 1,
      day_label: "Lunes",
      notes: null,
      meal_items: [
        {
          id: "item-1",
          meal_plan_day_id: "day-1",
          meal_type: "Desayuno",
          title: "Yogur sin lactosa con avena",
          description: "Añadir frutos rojos y nueces.",
          quantity: 250,
          unit: "Gramos",
          food_name: "Yogur sin lactosa con avena",
          position: 1,
        },
        {
          id: "item-2",
          meal_plan_day_id: "day-1",
          meal_type: "Comida",
          title: "Pollo con arroz integral",
          description: "Verduras salteadas y aceite de oliva.",
          quantity: 1,
          unit: "Raciones",
          food_name: "Pollo con arroz integral",
          position: 2,
        },
      ],
    },
  ],
};

export function NutriOSApp({
  tenantSlug,
  initialTenant,
  commonEntry = false,
  supabaseConfig,
}: {
  tenantSlug: string;
  initialTenant?: Tenant | null;
  commonEntry?: boolean;
  supabaseConfig?: SupabasePublicConfig | null;
}) {
  const supabase = useMemo(
    () => createSupabaseBrowser(supabaseConfig),
    [supabaseConfig],
  );
  const isDemo = !supabase;
  const [tenant, setTenant] = useState<Tenant>(
    commonEntry ? commonLoginTenant : initialTenant ?? demoTenant(tenantSlug),
  );
  const [role, setRole] = useState<UserRole | null>(isDemo ? "nutritionist" : null);
  const [sessionUserId, setSessionUserId] = useState(isDemo ? "demo-nutritionist" : "");
  const [patients, setPatients] = useState<Patient[]>(demoPatients);
  const [pendingInvitations, setPendingInvitations] =
    useState<PendingInvitation[]>(demoPendingInvitations);
  const [selectedPatientId, setSelectedPatientId] = useStoredValue(
    `nutrios:${commonEntry ? "common" : tenantSlug}:selected-patient`,
    demoPatients[0]?.id ?? "",
  );
  const [weights, setWeights] = useState<WeightLog[]>(demoWeights);
  const [waists, setWaists] = useState<WaistLog[]>(demoWaist);
  const [steps, setSteps] = useState<StepLog[]>(demoSteps);
  const [goals, setGoals] = useState<PatientGoal[]>(demoGoals);
  const [goalLogs, setGoalLogs] = useState<PatientGoalLog[]>(demoGoalLogs);
  const [availabilitySlots, setAvailabilitySlots] =
    useState<AppointmentAvailability[]>(demoAvailability);
  const [calendarEvents, setCalendarEvents] =
    useState<CalendarEvent[]>(demoCalendarEvents);
  const [calendarBusySlots, setCalendarBusySlots] =
    useState<CalendarBusySlot[]>(demoBusySlots);
  const [exercises, setExercises] = useState<ExerciseLog[]>(demoExercises);
  const [mealPhotos, setMealPhotos] = useState<MealPhoto[]>([]);
  const [documents, setDocuments] = useState<DocumentFile[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([demoConversation]);
  const [messages, setMessages] = useState<ChatMessage[]>(demoMessages);
  const [appNotifications, setAppNotifications] = useState<AppNotification[]>([]);
  const [notificationPreferences, setNotificationPreferences] =
    useState<NotificationPreferences>({
      email_enabled: true,
      push_enabled: true,
    });
  const [plans, setPlans] = useState<MealPlan[]>([demoPlan]);
  const [loginIntent, setLoginIntent] = useState<LoginIntent>("patient");
  const [activeTab, setActiveTab] = useStoredValue<TabId>(
    `nutrios:${commonEntry ? "common" : tenantSlug}:active-tab`,
    "goals",
  );
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [sidebarCollapsedAfterClick, setSidebarCollapsedAfterClick] = useState(false);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [notice, setNotice] = useState("");
  const [workspaceError, setWorkspaceError] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [sendingRecovery, setSendingRecovery] = useState(false);
  const hasResolvedWorkspace = useRef(!supabase);

  useEffect(() => {
    if (activeTab === "tracking") {
      setActiveTab(role === "patient" ? "data-entry" : "stats");
      return;
    }

    if (activeTab === "data-entry" && role && role !== "patient") {
      setActiveTab("stats");
    }

  }, [activeTab, role, setActiveTab]);

  const selectedPatient = patients.find((patient) => patient.id === selectedPatientId) ?? null;
  const selectedConversation =
    conversations.find((conversation) => conversation.patient_id === selectedPatientId) ??
    null;

  const patientWeights = weights
    .filter((item) => item.patient_id === selectedPatientId)
    .sort((a, b) => new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime());
  const patientWaists = waists
    .filter((item) => item.patient_id === selectedPatientId)
    .sort((a, b) => new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime());
  const patientSteps = steps
    .filter((item) => item.patient_id === selectedPatientId)
    .sort((a, b) => new Date(a.logged_on).getTime() - new Date(b.logged_on).getTime());
  const patientGoalLogs = goalLogs
    .filter((item) => item.patient_id === selectedPatientId)
    .sort((a, b) => b.logged_on.localeCompare(a.logged_on));
  const patientMessages = messages
    .filter((item) => item.conversation_id === selectedConversation?.id)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const patientPlans = plans.filter((plan) => plan.patient_id === selectedPatientId);
  const showGoalsPanel = Boolean(role);
  const pendingAppointmentCount = calendarEvents.filter(
    (event) => isPendingCalendarAppointment(event),
  ).length;
  const unreadAppNotificationCount = appNotifications.filter(
    (notification) => !notification.read_at,
  ).length;

  function handleSidebarEnter() {
    if (!sidebarCollapsedAfterClick) {
      setSidebarExpanded(true);
    }
  }

  function handleSidebarLeave() {
    setSidebarExpanded(false);
    setSidebarCollapsedAfterClick(false);
  }

  function handleTabClick(tabId: TabId, trigger: HTMLButtonElement) {
    setActiveTab(tabId);

    if (typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches) {
      setSidebarExpanded(false);
      setSidebarCollapsedAfterClick(true);
      trigger.blur();
    }
  }

  const withSignedUrls = useCallback(
    async <T extends { storage_path: string }>(rows: T[], key: keyof T) => {
      if (!supabase) return rows;
      return Promise.all(
        rows.map(async (row) => {
          const { data } = await supabase.storage
            .from("nutrios-private")
            .createSignedUrl(String(row[key]), 60 * 60);
          return { ...row, signed_url: data?.signedUrl };
        }),
      );
    },
    [supabase],
  );

  const loadWorkspace = useCallback(async () => {
    if (!supabase) return;
    if (!hasResolvedWorkspace.current) {
      setLoading(true);
    }
    setWorkspaceError("");
    const finishLoading = () => {
      hasResolvedWorkspace.current = true;
      setLoading(false);
    };

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      setRole(null);
      setAppNotifications([]);
      setNotificationPreferences({
        email_enabled: true,
        push_enabled: true,
      });
      if (commonEntry) {
        setTenant(commonLoginTenant);
      }
      finishLoading();
      return;
    }

    setSessionUserId(session.user.id);

    let resolvedTenant: Tenant | null = null;
    let resolvedRole: UserRole | null = null;

    if (commonEntry) {
      const workspace = await resolveCommonWorkspace(
        supabase,
        session.user.id,
        loginIntent,
      );

      if (!workspace) {
        setRole(null);
        setWorkspaceError(
          loginIntent === "professional"
            ? "No encontramos ningun perfil profesional activo para este usuario."
            : "No encontramos ninguna ficha de cliente activa para este usuario.",
        );
        finishLoading();
        return;
      }

      resolvedTenant = workspace.tenant;
      resolvedRole = workspace.role;
    } else {
      const { data: tenantRow } = await supabase
        .from("tenants")
        .select("*")
        .eq("slug", tenantSlug)
        .maybeSingle();

      resolvedTenant = (tenantRow as Tenant | null) ?? initialTenant ?? null;

      if (!resolvedTenant) {
        setWorkspaceError(
          `No existe ningun nutricionista configurado para ${tenantSlug}.`,
        );
        finishLoading();
        return;
      }

      const { data: membership } = await supabase
        .from("tenant_members")
        .select("role,status")
        .eq("tenant_id", resolvedTenant.id)
        .eq("user_id", session.user.id)
        .eq("status", "active")
        .maybeSingle();

      if (!membership) {
        setRole(null);
        setWorkspaceError("Tu usuario todavia no esta vinculado a este espacio.");
        finishLoading();
        return;
      }

      resolvedRole = membership.role as UserRole;
    }

    if (!resolvedTenant || !resolvedRole) {
      setRole(null);
      setWorkspaceError("No se pudo resolver tu espacio de trabajo.");
      finishLoading();
      return;
    }

    setTenant(resolvedTenant);
    setRole(resolvedRole);

    const [preferenceRows, notificationRows] = await Promise.all([
      supabase
        .from("notification_preferences")
        .select("tenant_id,user_id,email_enabled,push_enabled")
        .eq("tenant_id", resolvedTenant.id)
        .eq("user_id", session.user.id)
        .maybeSingle(),
      supabase
        .from("app_notifications")
        .select("*")
        .eq("tenant_id", resolvedTenant.id)
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    setNotificationPreferences(
      (preferenceRows.data as NotificationPreferences | null) ?? {
        tenant_id: resolvedTenant.id,
        user_id: session.user.id,
        email_enabled: true,
        push_enabled: true,
      },
    );
    setAppNotifications((notificationRows.data ?? []) as AppNotification[]);

    if (["owner", "nutritionist"].includes(resolvedRole)) {
      const { data: invitationRows } = await supabase
        .from("invitations")
        .select("id,email,token,status,expires_at,created_at")
        .eq("tenant_id", resolvedTenant.id)
        .eq("status", "pending")
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false });
      setPendingInvitations((invitationRows ?? []) as PendingInvitation[]);
    } else {
      setPendingInvitations([]);
    }

    const patientQuery =
      resolvedRole === "patient"
        ? supabase
            .from("patients")
            .select("*")
            .eq("tenant_id", resolvedTenant.id)
            .eq("user_id", session.user.id)
        : supabase
            .from("patients")
            .select("*")
            .eq("tenant_id", resolvedTenant.id)
            .order("registered_at", { ascending: false });

    const { data: patientRows } = await patientQuery;
    const loadedPatients = (patientRows ?? []) as Patient[];
    setPatients(loadedPatients);
    setSelectedPatientId((currentPatientId) =>
      loadedPatients.some((patient) => patient.id === currentPatientId)
        ? currentPatientId
        : loadedPatients[0]?.id || "",
    );

    const patientIds = loadedPatients.map((patient) => patient.id);
    const [availabilityRows, calendarEventRows, busySlotRows] = await Promise.all([
      supabase
        .from("appointment_availability")
        .select("*")
        .eq("tenant_id", resolvedTenant.id)
        .order("weekday", { ascending: true })
        .order("start_time", { ascending: true }),
      supabase
        .from("calendar_events")
        .select("*")
        .eq("tenant_id", resolvedTenant.id)
        .order("start_at", { ascending: true }),
      supabase.rpc("get_calendar_busy_slots", {
        target_tenant_id: resolvedTenant.id,
      }),
    ]);

    setAvailabilitySlots((availabilityRows.data ?? []) as AppointmentAvailability[]);
    setCalendarEvents((calendarEventRows.data ?? []) as CalendarEvent[]);
    setCalendarBusySlots((busySlotRows.data ?? []) as CalendarBusySlot[]);

    if (patientIds.length === 0) {
      setWeights([]);
      setWaists([]);
      setSteps([]);
      setGoals([]);
      setGoalLogs([]);
      setAvailabilitySlots((availabilityRows.data ?? []) as AppointmentAvailability[]);
      setCalendarEvents((calendarEventRows.data ?? []) as CalendarEvent[]);
      setCalendarBusySlots((busySlotRows.data ?? []) as CalendarBusySlot[]);
      setExercises([]);
      setMealPhotos([]);
      setDocuments([]);
      setConversations([]);
      setMessages([]);
      setPlans([]);
      finishLoading();
      return;
    }

    const [
      weightRows,
      waistRows,
      stepRows,
      exerciseRows,
      photoRows,
      documentRows,
      conversationRows,
      messageRows,
      planRows,
      goalRows,
      goalLogRows,
    ] = await Promise.all([
      supabase
        .from("weight_logs")
        .select("*")
        .in("patient_id", patientIds)
        .order("logged_at", { ascending: false }),
      supabase
        .from("waist_logs")
        .select("*")
        .in("patient_id", patientIds)
        .order("logged_at", { ascending: false }),
      supabase
        .from("step_logs")
        .select("*")
        .in("patient_id", patientIds)
        .order("logged_on", { ascending: false }),
      supabase
        .from("exercise_logs")
        .select("*")
        .in("patient_id", patientIds)
        .order("logged_at", { ascending: false }),
      supabase
        .from("meal_photos")
        .select("*")
        .in("patient_id", patientIds)
        .order("logged_at", { ascending: false }),
      supabase
        .from("documents")
        .select("*")
        .in("patient_id", patientIds)
        .order("created_at", { ascending: false }),
      supabase.from("conversations").select("*").in("patient_id", patientIds),
      supabase
        .from("chat_messages")
        .select("*")
        .in("patient_id", patientIds)
        .order("created_at", { ascending: true }),
      supabase
        .from("meal_plans")
        .select("*, meal_plan_days(*, meal_items(*))")
        .in("patient_id", patientIds)
        .order("created_at", { ascending: false }),
      supabase
        .from("patient_goals")
        .select("*")
        .in("patient_id", patientIds)
        .order("created_at", { ascending: true }),
      supabase
        .from("patient_goal_logs")
        .select("*")
        .in("patient_id", patientIds)
        .order("logged_on", { ascending: false }),
    ]);

    setWeights((weightRows.data ?? []) as WeightLog[]);
    setWaists((waistRows.data ?? []) as WaistLog[]);
    setSteps((stepRows.data ?? []) as StepLog[]);
    setGoals((goalRows.data ?? []) as PatientGoal[]);
    setGoalLogs((goalLogRows.data ?? []) as PatientGoalLog[]);
    setExercises((exerciseRows.data ?? []) as ExerciseLog[]);
    setMealPhotos(await withSignedUrls((photoRows.data ?? []) as MealPhoto[], "storage_path"));
    setDocuments(await withSignedUrls((documentRows.data ?? []) as DocumentFile[], "storage_path"));
    setConversations((conversationRows.data ?? []) as Conversation[]);
    setMessages((messageRows.data ?? []) as ChatMessage[]);
    setPlans((planRows.data ?? []) as MealPlan[]);
    finishLoading();
  }, [
    commonEntry,
    initialTenant,
    loginIntent,
    setSelectedPatientId,
    supabase,
    tenantSlug,
    withSignedUrls,
  ]);

  useEffect(() => {
    if (!supabase) return;

    const timer = window.setTimeout(() => {
      void loadWorkspace();
    }, 0);
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "TOKEN_REFRESHED") return;
      void loadWorkspace();
    });

    return () => {
      window.clearTimeout(timer);
      data.subscription.unsubscribe();
    };
  }, [loadWorkspace, supabase]);

  useEffect(() => {
    if (!supabase || !selectedConversation) return;

    const channel = supabase
      .channel(`nutrios-chat-${selectedConversation.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `conversation_id=eq.${selectedConversation.id}`,
        },
        (payload) => {
          setMessages((current) => {
            const next = payload.new as ChatMessage;
            if (current.some((item) => item.id === next.id)) return current;
            return [...current, next];
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedConversation, supabase]);

  useEffect(() => {
    if (!supabase || !sessionUserId) return;

    const channel = supabase
      .channel(`dietdesk-notifications-${sessionUserId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "app_notifications",
          filter: `user_id=eq.${sessionUserId}`,
        },
        (payload) => {
          const notification = payload.new as AppNotification;
          setAppNotifications((current) => {
            if (current.some((item) => item.id === notification.id)) return current;
            return [notification, ...current].slice(0, 50);
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionUserId, supabase]);

  useEffect(() => {
    if (!supabase || !role || !tenant.id) return;

    async function processEmailFallbacks() {
      const accessToken = await getCurrentAccessToken(supabase);
      if (!accessToken) return;

      await fetch("/api/notifications/process-email-fallback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ tenantId: tenant.id }),
      });
    }

    void processEmailFallbacks();
    const timer = window.setInterval(processEmailFallbacks, 60 * 1000);

    return () => window.clearInterval(timer);
  }, [role, supabase, tenant.id]);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setNotice("");
    setWorkspaceError("");
    const { error } = await supabase.auth.signInWithPassword({
      email: authEmail,
      password: authPassword,
    });
    setNotice(error ? error.message : "Sesion iniciada.");
  }

  useEffect(() => {
    if (!notice) return;

    const timer = window.setTimeout(() => {
      setNotice("");
    }, 5200);

    return () => window.clearTimeout(timer);
  }, [notice]);

  async function handlePasswordRecovery() {
    if (!supabase) return;
    setNotice("");

    const email = authEmail.trim();
    if (!email) {
      setNotice("Introduce tu correo electrónico para enviarte el enlace de recuperación.");
      return;
    }

    setSendingRecovery(true);
    const nextPath = commonEntry ? "/" : `/n/${tenantSlug}`;
    const resetPath = `/auth/reset-password?next=${encodeURIComponent(nextPath)}`;
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(resetPath)}`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });
    setSendingRecovery(false);

    if (error) {
      setNotice(error.message);
      return;
    }

    setNotice("Te hemos enviado un email para crear una nueva contraseña.");
  }

  async function handleLogout() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setRole(null);
    setSessionUserId("");
    if (commonEntry) {
      setTenant(commonLoginTenant);
    }
  }

  async function markNotificationRead(notificationId: string) {
    const readAt = new Date().toISOString();
    setAppNotifications((current) =>
      current.map((notification) =>
        notification.id === notificationId
          ? { ...notification, read_at: notification.read_at ?? readAt }
          : notification,
      ),
    );

    if (!supabase) return;
    await supabase
      .from("app_notifications")
      .update({ read_at: readAt, email_fallback_due_at: null })
      .eq("id", notificationId);
  }

  async function markAllNotificationsRead() {
    const readAt = new Date().toISOString();
    setAppNotifications((current) =>
      current.map((notification) => ({
        ...notification,
        read_at: notification.read_at ?? readAt,
      })),
    );

    if (!supabase) return;
    await supabase
      .from("app_notifications")
      .update({ read_at: readAt, email_fallback_due_at: null })
      .eq("tenant_id", tenant.id)
      .eq("user_id", sessionUserId)
      .is("read_at", null);
  }

  async function openNotification(notification: AppNotification) {
    await markNotificationRead(notification.id);
    if (notification.patient_id) {
      setSelectedPatientId(notification.patient_id);
    }
    if (notification.href === "chat") {
      setActiveTab("chat");
      return;
    }
    setActiveTab("notifications");
  }

  const appStyle = {
    "--tenant-color": tenant.primary_color,
    "--tenant-color-dark": tenant.primary_color,
  } as React.CSSProperties;

  if (loading) {
    return (
      <main className="nutrios-app tenant-bg flex items-center justify-center px-6">
        <div className="flex items-center gap-3 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-5 py-4 shadow-[var(--shadow-soft)]">
          <Loader2 className="size-5 animate-spin text-[var(--tenant-color)]" />
          <span className="text-sm font-medium">Cargando {APP_NAME}...</span>
        </div>
      </main>
    );
  }

  if (supabase && !role) {
    return (
      <main
        className="nutrios-app tenant-bg flex min-h-screen items-center justify-center px-4 py-8"
        style={appStyle}
      >
        <section className="grid w-full max-w-6xl overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--panel)] shadow-[var(--shadow-soft)] lg:grid-cols-[minmax(0,1.1fr)_minmax(360px,1fr)]">
          <div className="flex min-h-[260px] items-center justify-center bg-[var(--brand-accent-soft)] px-6 py-10 sm:min-h-[340px] sm:px-8 lg:min-h-[500px]">
            <div className="w-full max-w-[560px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={APP_LOGO_WITH_SLOGAN_SRC}
                alt={APP_NAME}
                className="h-auto w-full"
              />
            </div>
          </div>

          <div className="p-6 sm:p-8">
            {commonEntry && (
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  { id: "patient", title: "Soy cliente", icon: Users },
                  { id: "professional", title: "Soy profesional", icon: ClipboardList },
                ].map((item) => {
                  const Icon = item.icon;
                  const active = loginIntent === item.id;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`flex min-h-14 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-black transition ${
                        active
                          ? "border-[var(--tenant-color)] bg-[var(--tenant-color)] text-white shadow-md"
                          : "border-[var(--line)] bg-white text-[#39433f] hover:border-[var(--tenant-color)]"
                      }`}
                      onClick={() => {
                        setWorkspaceError("");
                        setLoginIntent(item.id as LoginIntent);
                      }}
                    >
                      <Icon className="size-4" />
                      {item.title}
                    </button>
                  );
                })}
              </div>
            )}

          <form className="mt-8 space-y-4" onSubmit={handleLogin}>
            <Field
              label="Correo electrónico"
              type="email"
              value={authEmail}
              onChange={setAuthEmail}
              required
            />
            <Field
              label="Contraseña"
              type="password"
              value={authPassword}
              onChange={setAuthPassword}
              required
            />
            <button
              type="button"
              className="text-sm font-semibold text-[var(--tenant-color)] hover:underline"
              onClick={handlePasswordRecovery}
              disabled={sendingRecovery}
            >
              {sendingRecovery ? "Enviando enlace..." : "Has olvidado tu contraseña?"}
            </button>
            <button className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[var(--tenant-color)] px-4 text-sm font-semibold text-white">
              <ChevronRight className="size-4" />
              Entrar
            </button>
          </form>
          {(workspaceError || notice) && (
            <p className="mt-4 rounded-lg border border-[#e8d9aa] bg-[#fff8df] px-3 py-2 text-sm text-[#6b5420]">
              {workspaceError || notice}
            </p>
          )}
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="nutrios-app tenant-bg" style={appStyle}>
      <div className="mx-auto grid min-h-screen max-w-[1440px] grid-cols-1 lg:grid-cols-[5rem_minmax(0,1fr)]">
        <aside
          className={`border-b border-[var(--line)] bg-[#fffbf3]/90 px-4 py-4 transition-[width,box-shadow,background-color] duration-200 lg:sticky lg:top-0 lg:z-30 lg:h-screen lg:overflow-hidden lg:border-b-0 lg:border-r lg:px-4 lg:py-6 ${
            sidebarExpanded
              ? "lg:w-72 lg:bg-[#fffbf3]/95 lg:shadow-[var(--shadow-soft)]"
              : "lg:w-20"
          }`}
          onMouseEnter={handleSidebarEnter}
          onMouseLeave={handleSidebarLeave}
          onFocusCapture={() => {
            setSidebarCollapsedAfterClick(false);
            setSidebarExpanded(true);
          }}
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
              setSidebarExpanded(false);
            }
          }}
          data-expanded={sidebarExpanded}
        >
          <div className="flex items-center justify-between gap-3 lg:block">
            <Brand tenant={tenant} compact collapsible expanded={sidebarExpanded} />
            <div
              className={`flex items-center gap-2 lg:mt-6 lg:transition-all ${
                sidebarExpanded ? "lg:justify-start" : "lg:justify-center"
              }`}
            >
              {isDemo && (
                <span
                  className={`rounded-full bg-[#f1e7c4] px-3 py-1 text-xs font-semibold text-[#69551f] lg:overflow-hidden lg:transition-all ${
                    sidebarExpanded ? "lg:max-w-32 lg:px-3 lg:opacity-100" : "lg:max-w-0 lg:px-0 lg:opacity-0"
                  }`}
                >
                  Demo local
                </span>
              )}
              {supabase && (
                <button
                  className="grid size-9 place-items-center rounded-lg border border-[var(--line)] bg-white text-[#39433f]"
                  onClick={handleLogout}
                  title="Cerrar sesion"
                >
                  <LogOut className="size-4" />
                </button>
              )}
            </div>
          </div>

          <nav className="mt-5 flex gap-2 overflow-x-auto pb-1 lg:grid lg:overflow-visible lg:pb-0">
            {tabs
              .filter((tab) => !tab.patientOnly || role === "patient")
              .filter((tab) => !tab.nutritionistOnly || role !== "patient")
              .map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                const tabLabel =
                  role === "patient" && tab.id === "patients"
                    ? "Mi Ficha Personal"
                    : role === "patient" && tab.id === "agenda"
                      ? "Citas"
                      : tab.label;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    className={`inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-black shadow-sm transition-all lg:w-full ${
                      sidebarExpanded ? "lg:gap-2 lg:px-3" : "lg:gap-0 lg:px-0"
                    } ${
                      active
                        ? "border-[var(--tenant-color)] bg-[var(--tenant-color)] text-white shadow-md"
                        : "border-[var(--line)] bg-white/85 text-[#39433f] hover:border-[var(--tenant-color)] hover:bg-white"
                    }`}
                    onClick={(event) => handleTabClick(tab.id, event.currentTarget)}
                    aria-current={active ? "page" : undefined}
                    title={tabLabel}
                  >
                    <Icon className="size-4 shrink-0" />
                    <span
                      className={`whitespace-nowrap transition-opacity lg:overflow-hidden ${
                        sidebarExpanded ? "lg:w-auto lg:opacity-100" : "lg:w-0 lg:opacity-0"
                      }`}
                    >
                      {tabLabel}
                    </span>
                  </button>
                );
              })}
          </nav>

          <PatientSwitcher
            patients={patients.filter(isActivePatient)}
            selectedPatientId={selectedPatientId}
            onSelect={setSelectedPatientId}
            role={role}
            expanded={sidebarExpanded}
          />
        </aside>

        <section className="min-w-0 overflow-x-hidden px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
          <Header
            tenant={tenant}
            role={role}
            selectedPatient={selectedPatient}
            notificationCount={
              unreadAppNotificationCount + (role !== "patient" ? pendingAppointmentCount : 0)
            }
            onOpenNotifications={() => setActiveTab("notifications")}
          />
          {workspaceError && (
            <div className="mt-5 rounded-lg border border-[#e8d9aa] bg-[#fff8df] px-4 py-3 text-sm text-[#6b5420]">
              {workspaceError}
            </div>
          )}
          {showGoalsPanel && (
            <GoalsPanel
              selectedPatient={selectedPatient}
              goals={goals}
              weights={weights}
              steps={steps}
              exercises={exercises}
              goalLogs={goalLogs}
            />
          )}

          <div className="mt-5">
            {activeTab === "patients" && (
              <PatientsPanel
                role={role}
                patients={patients}
                pendingInvitations={pendingInvitations}
                selectedPatient={selectedPatient}
                weights={weights}
                onSelectPatient={setSelectedPatientId}
                onNotice={setNotice}
                onReload={loadWorkspace}
                supabase={supabase}
              />
            )}
            {activeTab === "plans" && (
              <PlansPanel
                role={role}
                tenant={tenant}
                professionalName={tenant.name}
                selectedPatient={selectedPatient}
                plans={patientPlans}
                supabase={supabase}
                onNotice={setNotice}
                onReload={loadWorkspace}
              />
            )}
            {activeTab === "goals" && role !== "patient" && (
              <GoalsManagementPanel
                patients={patients}
                selectedPatient={selectedPatient}
                goals={goals}
                supabase={supabase}
                onNotice={setNotice}
                onReload={loadWorkspace}
              />
            )}
            {activeTab === "goals" && role === "patient" && (
              <div className="sr-only" aria-live="polite">
                Objetivos de hoy visibles.
              </div>
            )}
            {activeTab === "data-entry" && role === "patient" && (
              <DataEntryPanel
                key={`data-entry-${selectedPatientId || "none"}`}
                tenant={tenant}
                selectedPatient={selectedPatient}
                supabase={supabase}
                goals={goals.filter((goal) => goal.patient_id === selectedPatientId)}
                goalLogs={patientGoalLogs}
                onNotice={setNotice}
                onReload={loadWorkspace}
              />
            )}
            {activeTab === "activities" && (
              <ActivitiesPanel
                key={`activities-${selectedPatientId || "none"}`}
                selectedPatient={selectedPatient}
                exercises={exercises.filter((item) => item.patient_id === selectedPatientId)}
              />
            )}
            {activeTab === "stats" && (
              <StatsPanel
                selectedPatient={selectedPatient}
                weights={patientWeights}
                waists={patientWaists}
                steps={patientSteps}
                goals={goals.filter((goal) => goal.patient_id === selectedPatientId)}
                exercises={exercises.filter((item) => item.patient_id === selectedPatientId)}
                mealPhotos={mealPhotos.filter((item) => item.patient_id === selectedPatientId)}
                supabase={supabase}
                onNotice={setNotice}
                onReload={loadWorkspace}
              />
            )}
            {activeTab === "chat" && (
              <ChatPanel
                tenant={tenant}
                selectedPatient={selectedPatient}
                conversation={selectedConversation}
                messages={patientMessages}
                currentUserId={sessionUserId}
                supabase={supabase}
                onNotice={setNotice}
                onMessageSent={(message) =>
                  setMessages((current) =>
                    current.some((item) => item.id === message.id)
                      ? current
                      : [...current, message],
                  )
                }
                onConversationReady={(conversation) =>
                  setConversations((current) =>
                    current.some((item) => item.id === conversation.id)
                      ? current
                      : [...current, conversation],
                  )
                }
                onMessagesRead={(messageIds, readAt) => {
                  setMessages((current) =>
                    current.map((message) =>
                      messageIds.includes(message.id) ? { ...message, read_at: readAt } : message,
                    ),
                  );
                  setAppNotifications((current) =>
                    current.map((notification) =>
                      notification.patient_id === selectedPatientId &&
                      notification.type === "chat_message"
                        ? { ...notification, read_at: notification.read_at ?? readAt }
                        : notification,
                    ),
                  );
                }}
              />
            )}
            {activeTab === "documents" && (
              <DocumentsPanel
                tenant={tenant}
                role={role}
                selectedPatient={selectedPatient}
                documents={documents.filter((item) => item.patient_id === selectedPatientId)}
                supabase={supabase}
                onNotice={setNotice}
                onReload={loadWorkspace}
              />
            )}
            {activeTab === "agenda" && (
              <AgendaPanel
                tenant={tenant}
                role={role}
                patients={patients}
                selectedPatient={selectedPatient}
                availabilitySlots={availabilitySlots}
                calendarEvents={calendarEvents}
                calendarBusySlots={calendarBusySlots}
                supabase={supabase}
                onNotice={setNotice}
                onReload={loadWorkspace}
              />
            )}
            {activeTab === "notifications" && (
              <NotificationsPanel
                role={role}
                notifications={appNotifications}
                patients={patients}
                pendingAppointmentCount={pendingAppointmentCount}
                onOpenNotification={openNotification}
                onMarkAllRead={markAllNotificationsRead}
                onOpenAgenda={() => setActiveTab("agenda")}
              />
            )}
            {activeTab === "settings" && (
              <SettingsPanel
                tenant={tenant}
                role={role}
                preferences={notificationPreferences}
                onPreferences={setNotificationPreferences}
                pendingInvitations={pendingInvitations}
                supabase={supabase}
                onTenant={setTenant}
                onNotice={setNotice}
                onReload={loadWorkspace}
              />
            )}
          </div>
          <AppFooter />
        </section>
      </div>
      {notice && <NoticeToast message={notice} onClose={() => setNotice("")} />}
    </main>
  );
}

function GoalsPanel({
  selectedPatient,
  goals,
  weights,
  steps,
  exercises,
  goalLogs,
}: {
  selectedPatient: Patient | null;
  goals: PatientGoal[];
  weights: WeightLog[];
  steps: StepLog[];
  exercises: ExerciseLog[];
  goalLogs: PatientGoalLog[];
}) {
  const goalSummaries = selectedPatient
    ? buildGoalSummaries({
        patient: selectedPatient,
        goals,
        weights,
        steps,
        exercises,
        goalLogs,
      })
    : [];

  return (
    <Panel className="mt-5">
      <div className="flex w-full items-center justify-between gap-3 text-left">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[#eaf4ef] text-[var(--tenant-color)]">
            <Target className="size-5" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-lg font-black">Objetivos de hoy</h2>
            <p className="truncate text-sm text-[var(--muted)]">
              {selectedPatient
                ? selectedPatient.full_name
                : "Selecciona un cliente para ver su cumplimiento"}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4">
        {!selectedPatient ? (
          <EmptyState text="No hay cliente seleccionado." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {goalSummaries.map((summary) => (
              <GoalStatusCard key={summary.id} summary={summary} />
            ))}
            {goalSummaries.length === 0 && (
              <EmptyState text="Sin objetivos activos para hoy." />
            )}
          </div>
        )}
      </div>
    </Panel>
  );
}

function GoalsManagementPanel({
  patients,
  selectedPatient,
  goals,
  supabase,
  onNotice,
  onReload,
}: {
  patients: Patient[];
  selectedPatient: Patient | null;
  goals: PatientGoal[];
  supabase: ReturnType<typeof createSupabaseBrowser>;
  onNotice: (message: string) => void;
  onReload: () => Promise<void>;
}) {
  const activePatients = patients.filter(isActivePatient);
  const [goalTypeToCreate, setGoalTypeToCreate] =
    useState<Exclude<GoalType, "steps_daily">>("weight_logged");
  const [createPatientIds, setCreatePatientIds] = useState<string[]>(() =>
    selectedPatient ? [selectedPatient.id] : [],
  );
  const [customTitle, setCustomTitle] = useState("");
  const [customInputType, setCustomInputType] =
    useState<CustomGoalInputType>("check");
  const [customTargetValue, setCustomTargetValue] = useState("");
  const [measuredGoalType, setMeasuredGoalType] =
    useState<"steps_daily">("steps_daily");
  const [measuredPatientId, setMeasuredPatientId] = useState(
    selectedPatient?.id ?? "",
  );
  const [measuredValue, setMeasuredValue] = useState("8000");
  const [managedPatientId, setManagedPatientId] = useState(
    selectedPatient?.id ?? "",
  );
  const measuredPatient =
    activePatients.find((patient) => patient.id === measuredPatientId) ??
    selectedPatient ??
    activePatients[0] ??
    null;
  const managedPatient =
    activePatients.find((patient) => patient.id === managedPatientId) ??
    selectedPatient ??
    activePatients[0] ??
    null;
  const managedPatientGoals = managedPatient
    ? goals
        .filter((goal) => goal.patient_id === managedPatient.id)
        .sort(compareGoals)
    : [];

  async function saveSystemGoalForPatients(
    goalType: Exclude<GoalType, "custom">,
    patientIds: string[],
    targetValue: number | null = null,
  ) {
    if (!supabase) {
      onNotice("Modo demo: conecta Supabase para guardar objetivos reales.");
      return;
    }

    if (goalType === "steps_daily" && (!targetValue || targetValue < 1)) {
      onNotice("Indica un objetivo de pasos valido.");
      return;
    }

    const patientsById = new Map(patients.map((patient) => [patient.id, patient]));
    const uniquePatientIds = Array.from(new Set(patientIds)).filter((patientId) =>
      patientsById.has(patientId),
    );

    if (uniquePatientIds.length === 0) {
      onNotice("Selecciona al menos un cliente.");
      return;
    }

    const definition = systemGoalDefinitions[goalType];

    try {
      await Promise.all(
        uniquePatientIds.map(async (patientId) => {
          const patient = patientsById.get(patientId);
          if (!patient) return;

          const existingGoal = goals.find(
            (goal) =>
              goal.patient_id === patientId && goal.goal_type === goalType,
          );
          const payload = {
            title: definition.title,
            target_value: goalType === "steps_daily" ? targetValue : null,
            unit: definition.unit,
            is_active: true,
            custom_status: "in_progress" as GoalStatus,
            updated_at: new Date().toISOString(),
          };

          const response = existingGoal
            ? await supabase
                .from("patient_goals")
                .update(payload)
                .eq("id", existingGoal.id)
            : await supabase.from("patient_goals").insert({
                tenant_id: patient.tenant_id,
                patient_id: patient.id,
                goal_type: goalType,
                ...payload,
              });

          if (response.error) throw new Error(response.error.message);
        }),
      );

      onNotice(
        uniquePatientIds.length === 1
          ? "Objetivo actualizado."
          : "Objetivos actualizados para los clientes seleccionados.",
      );
      await onReload();
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "No se pudo guardar el objetivo.");
    }
  }

  async function createGoal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (goalTypeToCreate !== "custom") {
      await saveSystemGoalForPatients(goalTypeToCreate, createPatientIds);
      return;
    }

    if (!supabase) {
      onNotice("Modo demo: conecta Supabase para guardar objetivos reales.");
      return;
    }

    const title = customTitle.trim();
    if (!title) {
      onNotice("Indica el nombre del objetivo personalizado.");
      return;
    }

    const targetValue =
      customInputType === "check" ? null : Number(customTargetValue);
    if (
      customInputType !== "check" &&
      (!Number.isFinite(targetValue) || targetValue <= 0)
    ) {
      onNotice("Indica el objetivo numerico que debe cumplir el cliente.");
      return;
    }

    const patientsById = new Map(patients.map((patient) => [patient.id, patient]));
    const rows = createPatientIds
      .map((patientId) => patientsById.get(patientId))
      .filter((patient): patient is Patient => Boolean(patient))
      .map((patient) => ({
        tenant_id: patient.tenant_id,
        patient_id: patient.id,
        goal_type: "custom" as GoalType,
        title,
        target_value: targetValue,
        unit: getCustomGoalUnit(customInputType),
        is_active: true,
        custom_status: "in_progress" as GoalStatus,
        custom_input_type: customInputType,
      }));

    if (rows.length === 0) {
      onNotice("Selecciona al menos un cliente.");
      return;
    }

    const { error } = await supabase.from("patient_goals").insert(rows);

    if (error) {
      onNotice(error.message);
      return;
    }

    setCustomTitle("");
    setCustomInputType("check");
    setCustomTargetValue("");
    onNotice("Objetivo creado para los clientes seleccionados.");
    await onReload();
  }

  async function updateMeasuredGoal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!measuredPatient) {
      onNotice("Selecciona un cliente.");
      return;
    }

    const targetValue = Number(measuredValue);
    if (!Number.isInteger(targetValue) || targetValue < 1 || targetValue > 200000) {
      onNotice("El objetivo de pasos debe estar entre 1 y 200000.");
      return;
    }

    await saveSystemGoalForPatients(measuredGoalType, [measuredPatient.id], targetValue);
  }

  async function toggleGoal(goal: PatientGoal, isActive: boolean) {
    if (!supabase) {
      onNotice("Modo demo: conecta Supabase para guardar objetivos reales.");
      return;
    }

    const { error } = await supabase
      .from("patient_goals")
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq("id", goal.id);

    if (error) {
      onNotice(error.message);
      return;
    }

    onNotice(isActive ? "Objetivo activado." : "Objetivo desactivado.");
    await onReload();
  }

  async function deleteCustomGoal(goal: PatientGoal) {
    if (!supabase) {
      onNotice("Modo demo: conecta Supabase para borrar objetivos reales.");
      return;
    }

    const { error } = await supabase.from("patient_goals").delete().eq("id", goal.id);

    if (error) {
      onNotice(error.message);
      return;
    }

    onNotice("Objetivo eliminado.");
    await onReload();
  }

  function toggleCreatePatient(patientId: string, checked: boolean) {
    setCreatePatientIds((current) =>
      checked
        ? Array.from(new Set([...current, patientId]))
        : current.filter((id) => id !== patientId),
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <Panel>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-black">Crear objetivos</h2>
          <Target className="size-5 text-[var(--tenant-color)]" />
        </div>
        <form className="mt-5 grid gap-4" onSubmit={createGoal}>
          <SelectField
            label="Tipo de objetivo"
            value={goalTypeToCreate}
            onChange={(value) =>
              setGoalTypeToCreate(value as Exclude<GoalType, "steps_daily">)
            }
            options={goalCreationOptions}
          />
          {goalTypeToCreate === "custom" && (
            <>
              <Field
                label="Nombre del objetivo"
                value={customTitle}
                onChange={setCustomTitle}
              />
              <SelectField
                label="Indicar unidad de medición"
                value={customInputType}
                onChange={(value) => setCustomInputType(value as CustomGoalInputType)}
                options={customGoalInputOptions}
              />
              {customInputType !== "check" && (
                <Field
                  label={getCustomGoalTargetLabel(customInputType)}
                  type="number"
                  value={customTargetValue}
                  onChange={setCustomTargetValue}
                  step={customInputType === "minutes" ? "1" : "0.1"}
                />
              )}
            </>
          )}
          <PatientCheckboxList
            patients={activePatients}
            selectedPatientIds={createPatientIds}
            onToggle={toggleCreatePatient}
            onSelectAll={() =>
              setCreatePatientIds(activePatients.map((patient) => patient.id))
            }
            onClear={() => setCreatePatientIds([])}
          />
          <button className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[var(--tenant-color)] px-4 text-sm font-semibold text-white">
            <Plus className="size-4" />
            Crear objetivo
          </button>
        </form>
      </Panel>

      <Panel>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-black">Actualizar objetivos</h2>
          <Footprints className="size-5 text-[var(--tenant-color)]" />
        </div>
        <form className="mt-5 grid gap-4" onSubmit={updateMeasuredGoal}>
          <SelectField
            label="Objetivo"
            value={measuredGoalType}
            onChange={(value) => setMeasuredGoalType(value as "steps_daily")}
            options={measurableGoalOptions}
          />
          <SelectField
            label="Cliente"
            value={measuredPatient?.id ?? ""}
            onChange={setMeasuredPatientId}
            options={activePatients.map((patient) => ({
              value: patient.id,
              label: patient.full_name,
            }))}
          />
          <Field
            label="Pasos diarios"
            type="number"
            value={measuredValue}
            onChange={setMeasuredValue}
            step="1"
          />
          <button className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[var(--tenant-color)] px-4 text-sm font-semibold text-white">
            <Check className="size-4" />
            Actualizar objetivo
          </button>
        </form>
      </Panel>

      <Panel>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-black">Activar o desactivar</h2>
          <ClipboardList className="size-5 text-[var(--tenant-color)]" />
        </div>
        <div className="mt-5 grid gap-4">
          <SelectField
            label="Cliente"
            value={managedPatient?.id ?? ""}
            onChange={setManagedPatientId}
            options={activePatients.map((patient) => ({
              value: patient.id,
              label: patient.full_name,
            }))}
          />
          <div className="grid gap-2">
            {managedPatientGoals.map((goal) => (
              <GoalManagementRow
                key={goal.id}
                goal={goal}
                onToggle={toggleGoal}
                onDelete={deleteCustomGoal}
              />
            ))}
            {managedPatientGoals.length === 0 && (
              <EmptyState text="Este cliente todavia no tiene objetivos configurados." />
            )}
          </div>
        </div>
      </Panel>
    </div>
  );
}

function GoalStatusCard({ summary }: { summary: GoalSummary }) {
  const meta = goalStatusMeta[summary.status];
  const Icon = meta.icon;

  return (
    <div className={`rounded-lg border p-3 ${meta.cardClass}`}>
      <div className="flex items-start gap-3">
        <span className={`grid size-10 shrink-0 place-items-center rounded-lg ${meta.iconClass}`}>
          <Icon className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-[#24342f]">
            {summary.title}
          </p>
          <p className="mt-1 min-h-5 text-sm text-[#4a554f]">{summary.detail}</p>
          <span className={`mt-3 inline-flex rounded-md px-2 py-1 text-xs font-black ${meta.badgeClass}`}>
            {meta.label}
          </span>
        </div>
      </div>
    </div>
  );
}

function GoalManagementRow({
  goal,
  onToggle,
  onDelete,
}: {
  goal: PatientGoal;
  onToggle: (goal: PatientGoal, isActive: boolean) => Promise<void>;
  onDelete: (goal: PatientGoal) => Promise<void>;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-[var(--line)] bg-white p-3">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
        <div className="min-w-0">
          <p className="break-words text-sm font-black leading-5">{goal.title}</p>
          <p className="mt-1 text-xs font-semibold text-[var(--muted)]">
            {formatGoalType(goal)}{goal.is_active ? " activo" : " inactivo"}
          </p>
        </div>
        <div className="flex min-w-0 flex-wrap gap-2 sm:justify-end">
          <button
            type="button"
            className="inline-flex h-9 min-w-0 items-center rounded-lg border border-[var(--line)] bg-[#fbfaf6] px-3 text-xs font-black text-[#39433f]"
            onClick={() => onToggle(goal, !goal.is_active)}
          >
            {goal.is_active ? "Desactivar" : "Activar"}
          </button>
          {goal.goal_type === "custom" && (
            <button
              type="button"
              className="grid size-9 place-items-center rounded-lg border border-[#efc4ba] bg-[#fff3f0] text-[#8a3327]"
              onClick={() => onDelete(goal)}
              title="Borrar objetivo"
            >
              <Trash2 className="size-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function PatientCheckboxList({
  patients,
  selectedPatientIds,
  onToggle,
  onSelectAll,
  onClear,
}: {
  patients: Patient[];
  selectedPatientIds: string[];
  onToggle: (patientId: string, checked: boolean) => void;
  onSelectAll: () => void;
  onClear: () => void;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-[#39433f]">Clientes</span>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            className="text-xs font-black text-[var(--tenant-color)]"
            onClick={onSelectAll}
          >
            Todos
          </button>
          <button
            type="button"
            className="text-xs font-black text-[var(--muted)]"
            onClick={onClear}
          >
            Limpiar
          </button>
        </div>
      </div>
      <div className="max-h-56 overflow-auto rounded-lg border border-[var(--line)] bg-white">
        {patients.map((patient) => (
          <label
            key={patient.id}
            className="flex items-center gap-2 border-b border-[var(--line)] px-3 py-2 text-sm last:border-b-0"
          >
            <input
              type="checkbox"
              className="size-4 accent-[var(--tenant-color)]"
              checked={selectedPatientIds.includes(patient.id)}
              onChange={(event) => onToggle(patient.id, event.target.checked)}
            />
            <span className="min-w-0 truncate font-semibold">
              {patient.full_name}
            </span>
          </label>
        ))}
        {patients.length === 0 && (
          <div className="p-3">
            <EmptyState text="No hay clientes activos." />
          </div>
        )}
      </div>
    </div>
  );
}

function Brand({
  tenant,
  compact,
  collapsible = false,
  expanded = false,
}: {
  tenant: Tenant;
  compact: boolean;
  collapsible?: boolean;
  expanded?: boolean;
}) {
  const showHorizontalLogo = collapsible && expanded;

  return (
    <div
      className={`flex items-center gap-3 ${
        collapsible && expanded
          ? "lg:justify-start lg:transition-all"
          : collapsible
            ? "lg:justify-center lg:transition-all"
          : ""
      }`}
    >
      <div
        className={`grid size-11 shrink-0 place-items-center overflow-hidden rounded-lg bg-white p-1.5 shadow-sm ring-1 ring-[var(--line)] ${
          showHorizontalLogo ? "lg:hidden" : ""
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={APP_ICON_SRC} alt="" className="h-full w-full object-contain" />
      </div>
      {showHorizontalLogo && (
        <div className="hidden min-w-0 lg:block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={APP_LOGO_SRC}
            alt={APP_NAME}
            className="h-auto w-44 select-none object-contain"
          />
        </div>
      )}
      <div
        className={`min-w-0 ${
          collapsible && expanded
            ? "lg:hidden"
            : collapsible
              ? "lg:w-0 lg:overflow-hidden lg:opacity-0 lg:transition-opacity"
              : ""
        }`}
      >
        <p className="truncate text-base font-black tracking-normal">{APP_NAME}</p>
        <p className="truncate text-sm text-[var(--muted)]">
          {compact ? tenant.name : `${tenant.name} - ${tenant.slug}`}
        </p>
      </div>
    </div>
  );
}

function Header({
  tenant,
  role,
  selectedPatient,
  notificationCount,
  onOpenNotifications,
}: {
  tenant: Tenant;
  role: UserRole | null;
  selectedPatient: Patient | null;
  notificationCount: number;
  onOpenNotifications: () => void;
}) {
  return (
    <header className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-8">
        <div className="min-w-0">
          <p className="text-sm font-semibold uppercase text-[var(--tenant-color)]">
            {role === "patient" ? "Area paciente" : "Panel nutricionista"}
          </p>
          <h1 className="mt-1 break-words text-xl font-black tracking-normal text-[#17201d] sm:text-3xl">
            {selectedPatient ? selectedPatient.full_name : tenant.name}
          </h1>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        <button
          type="button"
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--line)] bg-white px-3 text-sm font-semibold text-[#3b4741] shadow-sm hover:border-[var(--tenant-color)]"
          onClick={onOpenNotifications}
        >
          <Bell className="size-4 text-[var(--tenant-color)]" />
          Notificaciones
          <span
            className={`grid min-w-6 place-items-center rounded-md px-1.5 py-0.5 text-xs font-black ${
              notificationCount > 0
                ? "bg-[#fff3f0] text-[#8a3327]"
                : "bg-[#eef3f0] text-[var(--muted)]"
            }`}
          >
            {notificationCount}
          </span>
        </button>
        <Pill icon={ShieldCheck} label="GDPR preparado" />
        <Pill icon={Bell} label="Chat en tiempo real" />
      </div>
    </header>
  );
}

function NotificationsPanel({
  role,
  notifications,
  patients,
  pendingAppointmentCount,
  onOpenNotification,
  onMarkAllRead,
  onOpenAgenda,
}: {
  role: UserRole | null;
  notifications: AppNotification[];
  patients: Patient[];
  pendingAppointmentCount: number;
  onOpenNotification: (notification: AppNotification) => void;
  onMarkAllRead: () => Promise<void>;
  onOpenAgenda: () => void;
}) {
  const sortedNotifications = notifications
    .slice()
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const unreadCount = sortedNotifications.filter((notification) => !notification.read_at).length;
  const hasAppointmentNotice = role !== "patient" && pendingAppointmentCount > 0;

  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-black">Notificaciones</h2>
          <p className="text-sm text-[var(--muted)]">
            Avisos de nuevos mensajes y citas pendientes.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--line)] bg-white px-4 text-sm font-black text-[#39433f] disabled:opacity-50"
          onClick={onMarkAllRead}
          disabled={unreadCount === 0}
        >
          <Check className="size-4 text-[var(--tenant-color)]" />
          Marcar todo como leido
        </button>
      </div>

      <div className="mt-5 grid gap-3">
        {hasAppointmentNotice && (
          <button
            type="button"
            className="flex items-start gap-3 rounded-lg border border-[#ead39b] bg-[#fff8df] p-4 text-left"
            onClick={onOpenAgenda}
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-white text-[#8a6a20]">
              <CalendarDays className="size-5" />
            </span>
            <span className="min-w-0">
              <span className="block font-black text-[#34291a]">
                Citas pendientes de confirmar
              </span>
              <span className="mt-1 block text-sm text-[#6b5420]">
                Tienes {pendingAppointmentCount} solicitud{pendingAppointmentCount === 1 ? "" : "es"} pendiente{pendingAppointmentCount === 1 ? "" : "s"}.
              </span>
            </span>
          </button>
        )}

        {sortedNotifications.map((notification) => {
          const unread = !notification.read_at;
          const patientName = getPatientName(patients, notification.patient_id);

          return (
            <button
              type="button"
              key={notification.id}
              className={`flex items-start gap-3 rounded-lg border p-4 text-left transition hover:border-[var(--tenant-color)] ${
                unread
                  ? "border-[#bee4d7] bg-[#effaf5]"
                  : "border-[var(--line)] bg-white"
              }`}
              onClick={() => onOpenNotification(notification)}
            >
              <span
                className={`grid size-10 shrink-0 place-items-center rounded-lg ${
                  unread
                    ? "bg-[var(--tenant-color)] text-white"
                    : "bg-[#f0eee7] text-[var(--tenant-color)]"
                }`}
              >
                <MessageCircle className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-black text-[#17201d]">{notification.title}</span>
                  {unread && (
                    <span className="rounded-full bg-[#dcefe7] px-2 py-0.5 text-[11px] font-black uppercase text-[var(--tenant-color)]">
                      Nuevo
                    </span>
                  )}
                </span>
                <span className="mt-1 block text-sm text-[#39433f]">
                  {notification.body}
                </span>
                <span className="mt-1 block text-xs font-semibold text-[var(--muted)]">
                  {patientName ? `${patientName} - ` : ""}
                  {formatDateTime(notification.created_at)}
                </span>
              </span>
              <ChevronRight className="mt-2 size-4 shrink-0 text-[var(--muted)]" />
            </button>
          );
        })}

        {!hasAppointmentNotice && sortedNotifications.length === 0 && (
          <EmptyState text="No tienes notificaciones pendientes." />
        )}
      </div>
    </Panel>
  );
}

function AppFooter() {
  return (
    <footer className="mt-8 flex flex-col gap-3 border-t border-[var(--line)] py-5 text-sm text-[var(--muted)] sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="font-semibold text-[#39433f]">
          © 2026 EgmAnalytics. Todos los derechos reservados.
        </p>
        <p className="mt-1">{APP_NAME} es propiedad de EgmAnalytics.</p>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={APP_LOGO_WITH_SLOGAN_SRC}
        alt={`${APP_NAME}. Menos gestion. Mas nutricion.`}
        className="h-auto w-44 select-none object-contain sm:w-56"
      />
    </footer>
  );
}

function NoticeToast({
  message,
  onClose,
}: {
  message: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-x-3 top-3 z-50 mx-auto max-w-md rounded-lg border border-[#bee4d7] bg-[#effaf5] p-3 text-sm text-[#255d50] shadow-[0_18px_50px_rgba(36,45,42,0.18)] sm:inset-x-auto sm:right-5 sm:top-5">
      <div className="flex items-start gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#dcefe7] text-[var(--tenant-color)]">
          <Check className="size-4" />
        </span>
        <p className="min-w-0 flex-1 pt-1 font-semibold leading-5">{message}</p>
        <button
          type="button"
          className="grid size-8 shrink-0 place-items-center rounded-lg text-[#255d50] hover:bg-white/70"
          onClick={onClose}
          aria-label="Cerrar aviso"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}

function Pill({ icon: Icon, label }: { icon: typeof Users; label: string }) {
  return (
    <span className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--line)] bg-white px-3 text-sm font-semibold text-[#3b4741]">
      <Icon className="size-4 text-[var(--tenant-color)]" />
      {label}
    </span>
  );
}

async function resolveCommonWorkspace(
  supabase: ReturnType<typeof createSupabaseBrowser>,
  userId: string,
  loginIntent: LoginIntent,
): Promise<{ tenant: Tenant; role: UserRole } | null> {
  if (!supabase) return null;

  if (loginIntent === "professional") {
    const { data: membershipRows } = await supabase
      .from("tenant_members")
      .select(
        "role,status,created_at,tenant:tenants(id,slug,name,logo_url,primary_color,privacy_policy_url)",
      )
      .eq("user_id", userId)
      .eq("status", "active")
      .order("created_at", { ascending: true });

    const professionalMembership = (membershipRows ?? []).find((row) =>
      ["owner", "nutritionist"].includes(String(row.role)),
    );
    const tenant = normalizeJoinedTenant(professionalMembership?.tenant);

    if (professionalMembership && tenant) {
      return {
        tenant,
        role: professionalMembership.role as UserRole,
      };
    }

    return null;
  }

  const { data: patientRows } = await supabase
    .from("patients")
    .select(
      "id,registered_at,tenant:tenants(id,slug,name,logo_url,primary_color,privacy_policy_url)",
    )
    .eq("user_id", userId)
    .eq("status", "active")
    .order("registered_at", { ascending: false });
  const patientTenant = normalizeJoinedTenant(patientRows?.[0]?.tenant);

  return patientTenant
    ? {
        tenant: patientTenant,
        role: "patient",
      }
    : null;
}

function normalizeJoinedTenant(value: Tenant | Tenant[] | null | undefined) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function PatientSwitcher({
  patients,
  selectedPatientId,
  onSelect,
  role,
  expanded = false,
}: {
  patients: Patient[];
  selectedPatientId: string;
  onSelect: (id: string) => void;
  role: UserRole | null;
  expanded?: boolean;
}) {
  if (role === "patient") return null;

  return (
    <div
      className={`mt-6 hidden lg:block lg:transition-all ${
        expanded
          ? "lg:pointer-events-auto lg:translate-x-0 lg:opacity-100"
          : "lg:pointer-events-none lg:translate-x-2 lg:opacity-0"
      }`}
    >
      <p className="mb-2 text-xs font-bold uppercase text-[var(--muted)]">Clientes</p>
      <div className="grid max-h-[45vh] gap-2 overflow-y-auto pr-1 scrollbar-thin">
        {patients.map((patient) => (
          <button
            key={patient.id}
            className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
              patient.id === selectedPatientId
                ? "border-[var(--tenant-color)] bg-white text-[#17201d]"
                : "border-transparent text-[#59645f] hover:bg-white"
            }`}
            onClick={() => onSelect(patient.id)}
          >
            <span className="block truncate font-semibold">{patient.full_name}</span>
            <span className="text-xs text-[var(--muted)]">{patient.patient_code}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function PatientsPanel({
  role,
  patients,
  pendingInvitations,
  selectedPatient,
  weights,
  onSelectPatient,
  onNotice,
  onReload,
  supabase,
}: {
  role: UserRole | null;
  patients: Patient[];
  pendingInvitations: PendingInvitation[];
  selectedPatient: Patient | null;
  weights: WeightLog[];
  onSelectPatient: (id: string) => void;
  onNotice: (message: string) => void;
  onReload: () => Promise<void>;
  supabase: ReturnType<typeof createSupabaseBrowser>;
}) {
  const [patientView, setPatientView] = useState<PatientListView>("active");
  const activePatients = patients.filter(isActivePatient);
  const inactivePatients = patients.filter(isInactivePatient);
  const selectedPatientWeights = selectedPatient
    ? weights.filter((item) => item.patient_id === selectedPatient.id)
    : [];
  const currentWeight = getCurrentWeightKg(selectedPatient, selectedPatientWeights);
  const currentBmi = selectedPatient
    ? calculateBmi(currentWeight, selectedPatient.height_cm)
    : null;

  async function updatePatientStatus(patient: Patient, status: "active" | "inactive") {
    if (!supabase) {
      onNotice("Modo demo: conecta Supabase para cambiar el estado del cliente.");
      return;
    }

    const accessToken = await getCurrentAccessToken(supabase);
    if (!accessToken) {
      onNotice("Tu sesion ha caducado. Cierra sesion y vuelve a entrar.");
      return;
    }

    const response = await fetch("/api/patients/status", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        patientId: patient.id,
        status,
      }),
    });

    const payload = (await response.json()) as UpdatePatientStatusResponse;

    if (!response.ok) {
      onNotice(payload.error ?? "No se pudo cambiar el estado del cliente.");
      return;
    }

    const patientName = payload.patientName ?? patient.full_name;
    onNotice(
      status === "inactive"
        ? `${patientName} se ha movido a clientes antiguos.`
        : `${patientName} vuelve a estar activo.`,
    );
    await onReload();
  }

  if (role === "patient") {
    return (
      <div className="grid gap-4 lg:grid-cols-4">
        <StatCard label="Peso inicial" value={`${selectedPatient?.initial_weight_kg ?? "-"} kg`} icon={Weight} />
        <StatCard label="Peso actual" value={`${currentWeight ?? "-"} kg`} icon={Activity} />
        <StatCard label="IMC actual" value={formatOptionalNumber(currentBmi, 1)} icon={ClipboardList} />
        <StatCard label="Fecha de alta" value={formatDate(selectedPatient?.registered_at)} icon={CalendarDays} />
        <PatientQuestionnairePanel
          key={selectedPatient?.id ?? "empty"}
          patient={selectedPatient}
          supabase={supabase}
          onNotice={onNotice}
          onReload={onReload}
        />
        <PatientRecord
          patient={selectedPatient}
          role={role}
          weights={selectedPatientWeights}
          className="lg:col-span-4"
        />
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      <Panel>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-black">
            {patientView === "active" && "Clientes"}
            {patientView === "pending" && "Pendientes de aceptar"}
            {patientView === "inactive" && "Clientes antiguos"}
          </h2>
          <span className="rounded-lg bg-[#eef3f0] px-3 py-1 text-sm font-semibold text-[#53605a]">
            {patientView === "active" && activePatients.length}
            {patientView === "pending" && pendingInvitations.length}
            {patientView === "inactive" && inactivePatients.length}
          </span>
        </div>
        <div className="mb-4 grid gap-2 sm:grid-cols-3">
          {[
            { id: "active", label: "Activos", count: activePatients.length },
            { id: "pending", label: "Pendientes", count: pendingInvitations.length },
            { id: "inactive", label: "Antiguos", count: inactivePatients.length },
          ].map((item) => {
            const active = patientView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`flex min-h-11 items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm font-bold transition ${
                  active
                    ? "border-[var(--tenant-color)] bg-[var(--tenant-color)] text-white"
                    : "border-[var(--line)] bg-white text-[#4a554f] hover:border-[#bfb7aa]"
                }`}
                onClick={() => setPatientView(item.id as PatientListView)}
              >
                <span className="min-w-0 truncate">{item.label}</span>
                <span
                  className={`grid min-w-8 place-items-center rounded-md px-2 py-1 text-xs ${
                    active ? "bg-white/20 text-white" : "bg-[#eef3f0] text-[#53605a]"
                  }`}
                >
                  {item.count}
                </span>
              </button>
            );
          })}
        </div>

        {patientView === "active" && (
          <PatientCards
            patients={activePatients}
            selectedPatient={selectedPatient}
            onSelectPatient={onSelectPatient}
            onChangeStatus={updatePatientStatus}
            nextStatus="inactive"
          />
        )}
        {patientView === "pending" && (
          <PendingInvitationList
            invitations={pendingInvitations}
            onNotice={onNotice}
          />
        )}
        {patientView === "inactive" && (
          <PatientCards
            patients={inactivePatients}
            selectedPatient={selectedPatient}
            onSelectPatient={onSelectPatient}
            onChangeStatus={updatePatientStatus}
            nextStatus="active"
          />
        )}
      </Panel>

      <PatientRecord
        patient={selectedPatient}
        role={role}
        weights={selectedPatientWeights}
      />
    </div>
  );
}

function InvitationPanel({
  tenant,
  pendingInvitations,
  supabase,
  onNotice,
  onReload,
}: {
  tenant: Tenant;
  pendingInvitations: PendingInvitation[];
  supabase: ReturnType<typeof createSupabaseBrowser>;
  onNotice: (message: string) => void;
  onReload: () => Promise<void>;
}) {
  const [inviteDraft, setInviteDraft, clearInviteDraft] = useStoredDraft(
    `nutrios:draft:invite:${tenant.id}`,
    { email: "" },
  );
  const [manualInviteLink, setManualInviteLink] = useState("");
  const [sendingInvite, setSendingInvite] = useState(false);

  async function invitePatient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sendingInvite) return;

    if (!supabase) {
      onNotice("Modo demo: conecta Supabase para enviar invitaciones reales.");
      return;
    }

    const accessToken = await getCurrentAccessToken(supabase);
    if (!accessToken) {
      onNotice("Tu sesion ha caducado. Cierra sesion y vuelve a entrar.");
      return;
    }

    setSendingInvite(true);
    setManualInviteLink("");

    try {
      const response = await fetch("/api/invitations/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          email: inviteDraft.email,
          tenantId: tenant.id,
          tenantSlug: tenant.slug,
        }),
      });

      const payload = (await response.json()) as CreateInvitationResponse;
      if (!response.ok) {
        onNotice(payload.error ?? "No se pudo enviar la invitacion.");
        return;
      }

      clearInviteDraft();
      if (payload.delivery === "manual_link" && payload.actionLink) {
        setManualInviteLink(payload.actionLink);
        onNotice(payload.warning ?? "Invitacion creada con enlace manual.");
      } else {
        onNotice("Invitacion enviada al paciente.");
      }
      await onReload();
    } finally {
      setSendingInvite(false);
    }
  }

  async function copyManualInviteLink() {
    if (!manualInviteLink) return;
    try {
      await navigator.clipboard.writeText(manualInviteLink);
      onNotice("Enlace copiado.");
    } catch {
      onNotice("No se pudo copiar automaticamente. Selecciona el enlace y copialo manualmente.");
    }
  }

  return (
    <Panel>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-black sm:text-lg">Dar de alta cliente</h2>
        <UserPlus className="size-5 text-[var(--tenant-color)]" />
      </div>
      <form className="mt-5 space-y-3" onSubmit={invitePatient}>
        <Field
          label="Correo electronico"
          type="email"
          value={inviteDraft.email}
          onChange={(value) =>
            setInviteDraft((current) => ({ ...current, email: value }))
          }
          required
        />
        <button
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[var(--tenant-color)] px-4 text-sm font-black text-white disabled:opacity-60"
          disabled={sendingInvite}
        >
          {sendingInvite ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
          {sendingInvite ? "Enviando..." : "Enviar invitacion"}
        </button>
      </form>
      <p className="mt-4 text-sm leading-6 text-[var(--muted)]">
        El cliente completara su ficha al aceptar la invitacion. El ID interno y la fecha de registro se generan automaticamente.
      </p>
      {manualInviteLink && (
        <div className="mt-4 rounded-lg border border-[#e8d9aa] bg-[#fff8df] p-3">
          <p className="text-sm font-semibold text-[#6b5420]">
            Enlace manual de invitacion. Envia este enlace al cliente para completar el alta.
          </p>
          <div className="mt-3 flex gap-2">
            <input
              className="h-10 min-w-0 flex-1 rounded-lg border border-[#e8d9aa] bg-white px-3 text-xs text-[#3f3724]"
              value={manualInviteLink}
              readOnly
              onFocus={(event) => event.currentTarget.select()}
            />
            <button
              type="button"
              className="grid size-10 shrink-0 place-items-center rounded-lg bg-[var(--tenant-color)] text-white"
              onClick={copyManualInviteLink}
              title="Copiar enlace"
            >
              <Copy className="size-4" />
            </button>
          </div>
        </div>
      )}
      {pendingInvitations.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-sm font-black">Invitaciones pendientes</p>
          <PendingInvitationList
            invitations={pendingInvitations}
            onNotice={onNotice}
          />
        </div>
      )}
    </Panel>
  );
}

function PatientCards({
  patients,
  selectedPatient,
  onSelectPatient,
  onChangeStatus,
  nextStatus,
}: {
  patients: Patient[];
  selectedPatient: Patient | null;
  onSelectPatient: (id: string) => void;
  onChangeStatus: (
    patient: Patient,
    status: "active" | "inactive",
  ) => Promise<void>;
  nextStatus: "active" | "inactive";
}) {
  if (patients.length === 0) {
    return <EmptyState text="No hay clientes en esta vista." />;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {patients.map((patient) => {
        const selected = selectedPatient?.id === patient.id;
        const Icon = nextStatus === "inactive" ? Archive : RotateCcw;
        const inactive = isInactivePatient(patient);
        return (
          <article
            key={patient.id}
            className={`rounded-lg border bg-white p-4 shadow-sm transition ${
              selected ? "border-[var(--tenant-color)]" : "border-[var(--line)]"
            }`}
          >
            <button
              type="button"
              onClick={() => onSelectPatient(patient.id)}
              className="block w-full text-left"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-black">{patient.full_name}</p>
                  <p className="mt-1 text-xs font-semibold text-[var(--muted)]">
                    {patient.patient_code}
                  </p>
                  <span
                    className={`mt-2 inline-flex rounded-md px-2 py-1 text-xs font-bold ${
                      inactive
                        ? "bg-[#f5eee3] text-[#795548]"
                        : "bg-[#effaf5] text-[#255d50]"
                    }`}
                  >
                    {inactive ? "Antiguo/inactivo" : "Activo"}
                  </span>
                  {needsQuestionnaireUpdate(patient) && (
                    <span className="mt-2 inline-flex rounded-md bg-[#fff8df] px-2 py-1 text-xs font-bold text-[#6b5420]">
                      Ficha pendiente
                    </span>
                  )}
                </div>
                <ChevronRight className="size-4 text-[var(--muted)]" />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                <Metric label="Edad" value={`${patient.age}`} />
                <Metric label="Altura" value={`${patient.height_cm} cm`} />
                <Metric label="Inicial" value={`${patient.initial_weight_kg} kg`} />
                <Metric label="Actual" value={`${patient.current_weight_kg} kg`} />
              </div>
            </button>
            <button
              type="button"
              className="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-[var(--line)] bg-[#faf8f1] px-3 text-xs font-bold text-[#53605a]"
              onClick={() => onChangeStatus(patient, nextStatus)}
            >
              <Icon className="size-4" />
              {nextStatus === "inactive" ? "Mover a antiguos" : "Pasar a activo"}
            </button>
          </article>
        );
      })}
    </div>
  );
}

function PendingInvitationList({
  invitations,
  onNotice,
}: {
  invitations: PendingInvitation[];
  onNotice: (message: string) => void;
}) {
  async function copyInvitationLink(token: string) {
    const link = `${window.location.origin}/invitacion/${token}`;
    try {
      await navigator.clipboard.writeText(link);
      onNotice("Enlace de invitacion copiado.");
    } catch {
      onNotice("No se pudo copiar automaticamente. Abre el enlace y copialo desde la barra del navegador.");
    }
  }

  if (invitations.length === 0) {
    return <EmptyState text="No hay invitaciones pendientes." />;
  }

  return (
    <div className="grid gap-3">
      {invitations.map((invitation) => (
        <article
          key={invitation.id}
          className="rounded-lg border border-[var(--line)] bg-white p-4 shadow-sm"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-black">{invitation.email}</p>
              <p className="mt-1 text-xs font-semibold text-[var(--muted)]">
                Enviada: {formatDate(invitation.created_at)}
              </p>
            </div>
            <span className="shrink-0 rounded-lg bg-[#fff8df] px-2 py-1 text-xs font-bold text-[#6b5420]">
              Pendiente
            </span>
          </div>
          <p className="mt-3 text-sm text-[var(--muted)]">
            Caduca: {formatDate(invitation.expires_at)}
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
            <input
              className="h-9 min-w-0 rounded-lg border border-[var(--line)] bg-[#faf8f1] px-3 text-xs text-[#3f3724]"
              value={`/invitacion/${invitation.token}`}
              readOnly
              onFocus={(event) => event.currentTarget.select()}
            />
            <a
              className="inline-flex h-9 items-center justify-center rounded-lg border border-[var(--line)] bg-white px-3 text-xs font-bold text-[#53605a]"
              href={`/invitacion/${invitation.token}`}
              target="_blank"
              rel="noreferrer"
            >
              Abrir
            </a>
            <button
              type="button"
              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[var(--tenant-color)] px-3 text-xs font-bold text-white"
              onClick={() => copyInvitationLink(invitation.token)}
            >
              <Copy className="size-4" />
              Copiar
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}

function PatientQuestionnairePanel({
  patient,
  supabase,
  onNotice,
  onReload,
}: {
  patient: Patient | null;
  supabase: ReturnType<typeof createSupabaseBrowser>;
  onNotice: (message: string) => void;
  onReload: () => Promise<void>;
}) {
  const emptyQuestionnaireDraft = useMemo(
    () => ({
      fullName: patient?.full_name ?? "",
      age: patient ? String(patient.age) : "",
      heightCm: patient ? String(patient.height_cm) : "",
      currentWeightKg: patient ? String(patient.current_weight_kg) : "",
      objective: patient?.objective ?? goalOptions[0],
      sex: patient?.sex ?? "male",
      allergies: patient?.allergies ?? "",
      avoidedFoods: patient?.avoided_foods ?? "",
      exerciseHoursPerWeek:
        patient?.exercise_hours_per_week !== null &&
        patient?.exercise_hours_per_week !== undefined
          ? String(patient.exercise_hours_per_week)
          : "",
      exerciseType: patient?.exercise_type || patient?.exercise_routine || "",
    }),
    [patient],
  );
  const [questionnaireDraft, setQuestionnaireDraft, clearQuestionnaireDraft] =
    useStoredDraft(
      `nutrios:draft:questionnaire:${patient?.id ?? "none"}`,
      emptyQuestionnaireDraft,
  );
  const [saving, setSaving] = useState(false);

  if (!patient) {
    return (
      <Panel className="lg:col-span-4">
        <EmptyState text="No hay ficha vinculada a este usuario." />
      </Panel>
    );
  }

  const needsUpdate = needsQuestionnaireUpdate(patient);

  async function saveQuestionnaire(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase || !patient) {
      onNotice("Modo demo: conecta Supabase para actualizar fichas reales.");
      return;
    }

    setSaving(true);
    const accessToken = await getCurrentAccessToken(supabase);
    if (!accessToken) {
      setSaving(false);
      onNotice("Tu sesion ha caducado. Cierra sesion y vuelve a entrar.");
      return;
    }

    const response = await fetch("/api/patients/questionnaire", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        patientId: patient.id,
        fullName: questionnaireDraft.fullName,
        age: Number(questionnaireDraft.age),
        heightCm: Number(questionnaireDraft.heightCm),
        currentWeightKg: Number(questionnaireDraft.currentWeightKg),
        objective: questionnaireDraft.objective,
        sex: questionnaireDraft.sex,
        allergies: questionnaireDraft.allergies,
        avoidedFoods: questionnaireDraft.avoidedFoods,
        exerciseHoursPerWeek: Number(questionnaireDraft.exerciseHoursPerWeek),
        exerciseType: questionnaireDraft.exerciseType,
      }),
    });

    const payload = (await response.json()) as QuestionnaireResponse;
    setSaving(false);

    if (!response.ok) {
      onNotice(payload.error ?? "No se pudo actualizar la ficha.");
      return;
    }

    clearQuestionnaireDraft();
    onNotice("Ficha personal actualizada.");
    await onReload();
  }

  function updateQuestionnaireDraft(
    key: keyof typeof emptyQuestionnaireDraft,
    value: string,
  ) {
    setQuestionnaireDraft((current) => ({
      ...current,
      [key]: value,
    }));
  }

  return (
    <Panel className="lg:col-span-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-black">Actualizar ficha personal</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {needsUpdate
              ? "Hay campos nuevos pendientes de completar."
              : "Puedes modificar tus datos cuando cambien."}
          </p>
        </div>
        <span
          className={`rounded-lg px-3 py-1 text-sm font-semibold ${
            needsUpdate
              ? "bg-[#fff8df] text-[#6b5420]"
              : "bg-[#eaf4ef] text-[#255d50]"
          }`}
        >
          {needsUpdate ? "Pendiente" : "Actualizada"}
        </span>
      </div>
      <form className="mt-5 grid gap-4 md:grid-cols-2" onSubmit={saveQuestionnaire}>
        <Field
          label="Nombre y apellidos"
          value={questionnaireDraft.fullName}
          onChange={(value) => updateQuestionnaireDraft("fullName", value)}
          required
        />
        <Field
          label="Edad"
          type="number"
          value={questionnaireDraft.age}
          onChange={(value) => updateQuestionnaireDraft("age", value)}
          required
        />
        <Field
          label="Altura cm"
          type="number"
          value={questionnaireDraft.heightCm}
          onChange={(value) => updateQuestionnaireDraft("heightCm", value)}
          required
        />
        <Field
          label="Peso actual kg"
          type="number"
          step="0.1"
          value={questionnaireDraft.currentWeightKg}
          onChange={(value) => updateQuestionnaireDraft("currentWeightKg", value)}
          required
        />
        <SelectField
          label="Objetivo"
          value={questionnaireDraft.objective}
          onChange={(value) => updateQuestionnaireDraft("objective", value)}
          options={goalOptions.map((label) => ({ value: label, label }))}
        />
        <SelectField
          label="Sexo para calculo basal"
          value={questionnaireDraft.sex}
          onChange={(value) => updateQuestionnaireDraft("sex", value)}
          options={sexOptions}
        />
        <TextArea
          label="Alergias/intolerancias"
          value={questionnaireDraft.allergies}
          onChange={(value) => updateQuestionnaireDraft("allergies", value)}
        />
        <TextArea
          label="Alimentos a evitar"
          value={questionnaireDraft.avoidedFoods}
          onChange={(value) => updateQuestionnaireDraft("avoidedFoods", value)}
        />
        <Field
          label="Horas estimadas de ejercicio a la semana"
          type="number"
          step="0.5"
          value={questionnaireDraft.exerciseHoursPerWeek}
          onChange={(value) =>
            updateQuestionnaireDraft("exerciseHoursPerWeek", value)
          }
          required
        />
        <TextArea
          label="Tipo de ejercicio"
          value={questionnaireDraft.exerciseType}
          onChange={(value) => updateQuestionnaireDraft("exerciseType", value)}
        />
        <div className="md:col-span-2">
          <button
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--tenant-color)] px-4 text-sm font-semibold text-white disabled:opacity-60"
            disabled={saving}
          >
            <Check className="size-4" />
            {saving ? "Guardando..." : "Guardar ficha"}
          </button>
        </div>
      </form>
    </Panel>
  );
}

function PatientRecord({
  patient,
  role,
  weights,
  className = "xl:col-span-2",
}: {
  patient: Patient | null;
  role: UserRole | null;
  weights: WeightLog[];
  className?: string;
}) {
  if (!patient) return <Panel><EmptyState text="Selecciona un cliente." /></Panel>;

  const currentWeight = getCurrentWeightKg(patient, weights);
  const initialBmi = calculateBmi(patient.initial_weight_kg, patient.height_cm);
  const currentBmi = calculateBmi(currentWeight, patient.height_cm);
  const basalCalories = calculateBasalCalories(patient, currentWeight);

  return (
    <Panel className={className}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-lg font-black">
            {role === "patient" ? "Mi ficha personal" : "Ficha del cliente"}
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Alta: {formatDate(patient.registered_at)} - ID: {patient.patient_code}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {needsQuestionnaireUpdate(patient) && (
            <span className="rounded-lg bg-[#fff8df] px-3 py-1 text-sm font-semibold text-[#6b5420]">
              Ficha pendiente
            </span>
          )}
          <span className="rounded-lg bg-[#eaf4ef] px-3 py-1 text-sm font-semibold text-[#255d50]">
            Consentimiento registrado
          </span>
        </div>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <InfoBlock label="Objetivo" value={patient.objective} />
        <InfoBlock label="IMC inicial" value={formatOptionalNumber(initialBmi, 1)} />
        <InfoBlock label="IMC actual" value={formatOptionalNumber(currentBmi, 1)} />
        {role !== "patient" && (
          <InfoBlock
            label="Calorias basales actuales (TMB)"
            value={basalCalories ? `${basalCalories} kcal/día` : "Faltan datos para calcular"}
          />
        )}
        <InfoBlock label="Sexo para calculo basal" value={formatSex(patient.sex)} />
        <InfoBlock label="Alergias/intolerancias" value={patient.allergies} />
        <InfoBlock label="Alimentos a evitar" value={patient.avoided_foods} />
        <InfoBlock
          label="Horas ejercicio/semana"
          value={
            patient.exercise_hours_per_week !== null &&
            patient.exercise_hours_per_week !== undefined
              ? `${patient.exercise_hours_per_week} h`
              : null
          }
        />
        <InfoBlock label="Tipo de ejercicio" value={patient.exercise_type || patient.exercise_routine} />
        <InfoBlock label="Base de evolucion" value={`${patient.initial_weight_kg} kg desde ${formatDate(patient.registered_at)}`} />
      </div>
    </Panel>
  );
}

function PlansPanel({
  role,
  tenant,
  professionalName,
  selectedPatient,
  plans,
  supabase,
  onNotice,
  onReload,
}: {
  role: UserRole | null;
  tenant: Tenant;
  professionalName: string;
  selectedPatient: Patient | null;
  plans: MealPlan[];
  supabase: ReturnType<typeof createSupabaseBrowser>;
  onNotice: (message: string) => void;
  onReload: () => Promise<void>;
}) {
  const emptyPlanDraft = useMemo(
    (): MealPlanDraft => ({
      title: "Plan semanal",
      startDate: new Date().toISOString().slice(0, 10),
      entryRows: [createDraftMealItem()],
      draftItems: [],
    }),
    [],
  );
  const [planDraft, setPlanDraft, clearPlanDraft] = useStoredValue<MealPlanDraft>(
    `nutrios:draft:plan:${selectedPatient?.id ?? "none"}`,
    emptyPlanDraft,
  );
  const [selectedPlanId, setSelectedPlanId] = useStoredValue(
    `nutrios:selected:plan:${selectedPatient?.id ?? "none"}`,
    "",
  );
  const [dietEditorMode, setDietEditorMode] = useStoredValue<DietEditorMode>(
    `nutrios:diet-editor-mode:${selectedPatient?.id ?? "none"}`,
    "create",
  );
  const [publishing, setPublishing] = useState(false);
  const normalizedDraft = normalizePlanDraft(planDraft);
  const entryRows = normalizedDraft.entryRows;
  const draftItems = sortDraftItems(
    normalizedDraft.draftItems.filter(hasCompleteDraftMealItem),
  );
  const isNutritionist = role !== "patient";
  const isEditingSavedPlan = isNutritionist && dietEditorMode === "edit";
  const availablePlans = useMemo(
    () => (isNutritionist ? plans : plans.filter((plan) => isPlanActive(plan))),
    [isNutritionist, plans],
  );
  const selectedPublishedPlan =
    availablePlans.find((plan) => plan.id === selectedPlanId) ?? availablePlans[0] ?? null;
  const draftPlan =
    selectedPatient && draftItems.length > 0
      ? buildDraftMealPlan(normalizedDraft, draftItems, selectedPatient.id)
      : null;
  const activePlan =
    isNutritionist && !isEditingSavedPlan && draftPlan
      ? draftPlan
      : selectedPublishedPlan;
  const activePlanIsDraft = Boolean(isNutritionist && !isEditingSavedPlan && draftPlan);

  useEffect(() => {
    if (!availablePlans.length || availablePlans.some((plan) => plan.id === selectedPlanId)) return;
    setSelectedPlanId(availablePlans[0].id);
  }, [availablePlans, selectedPlanId, setSelectedPlanId]);

  function addRowsToDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validRows = entryRows.filter(hasCompleteDraftMealItem);
    if (validRows.length === 0) {
      onNotice("Completa al menos una línea con cantidad y alimento.");
      return;
    }

    setPlanDraft((current) => {
      const draft = normalizePlanDraft(current);

      return {
        ...draft,
        draftItems: sortDraftItems([...draft.draftItems, ...validRows]),
        entryRows: [createDraftMealItem()],
      };
    });
    onNotice("Comidas añadidas al borrador de la dieta.");
  }

  async function addRowsToPublishedPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedPublishedPlan) {
      onNotice("Elige una dieta guardada para modificarla.");
      return;
    }

    if (!supabase) {
      onNotice("Modo demo: conecta Supabase para editar dietas reales.");
      return;
    }

    const validRows = entryRows.filter(hasCompleteDraftMealItem);
    if (validRows.length === 0) {
      onNotice("Completa al menos una línea con cantidad y alimento.");
      return;
    }

    setPublishing(true);
    const errorMessage = await appendMealRowsToPlan(supabase, selectedPublishedPlan, validRows);
    if (errorMessage) {
      onNotice(errorMessage);
      setPublishing(false);
      return;
    }

    setPlanDraft((current) => ({
      ...normalizePlanDraft(current),
      entryRows: [createDraftMealItem()],
    }));
    onNotice("Comidas añadidas a la dieta.");
    await onReload();
    setPublishing(false);
  }

  async function publishDraftPlan() {
    if (!selectedPatient) return;
    if (!supabase) {
      onNotice("Modo demo: conecta Supabase para guardar dietas reales.");
      return;
    }
    if (draftItems.length === 0) {
      onNotice("Añade comidas al plan antes de publicarlo.");
      return;
    }

    setPublishing(true);
    const { data: plan, error: planError } = await supabase
      .from("meal_plans")
      .insert({
        tenant_id: tenant.id,
        patient_id: selectedPatient.id,
        title: normalizedDraft.title.trim() || "Plan semanal",
        start_date: normalizedDraft.startDate,
        status: "published",
      })
      .select("id")
      .single();

    if (planError || !plan) {
      onNotice(planError?.message ?? "No se pudo guardar la dieta.");
      setPublishing(false);
      return;
    }

    const dayRows = Array.from(new Set(draftItems.map((item) => item.dayIndex))).map((dayIndex) => ({
      meal_plan_id: plan.id,
      day_index: dayIndex,
      day_label: dayLabels[dayIndex - 1],
    }));

    const { data: insertedDays, error: dayError } = await supabase
      .from("meal_plan_days")
      .insert(dayRows)
      .select("id,day_index");

    if (dayError || !insertedDays) {
      onNotice(dayError?.message ?? "No se pudieron guardar los días.");
      setPublishing(false);
      return;
    }

    const mealRows = draftItems
      .map((item, index) => {
        const mealPlanDayId = insertedDays.find((day) => day.day_index === item.dayIndex)?.id;
        if (!mealPlanDayId) return null;

        return mealItemPayloadFromDraft(item, mealPlanDayId, index + 1);
      })
      .filter(Boolean);

    const itemError = await insertMealRows(supabase, mealRows);
    if (itemError) {
      onNotice(itemError.message);
      setPublishing(false);
      return;
    }

    const archiveError = await deactivateOtherMealPlans(
      supabase,
      selectedPatient.id,
      plan.id,
    );
    if (archiveError) {
      onNotice(archiveError.message);
      setPublishing(false);
      return;
    }

    onNotice("Dieta publicada para el cliente.");
    clearPlanDraft();
    setSelectedPlanId(plan.id);
    await onReload();
    setPublishing(false);
  }

  async function deletePlan(plan: MealPlan) {
    if (!supabase) {
      onNotice("Modo demo: conecta Supabase para borrar dietas reales.");
      return;
    }

    const confirmed = window.confirm(`Quieres borrar la dieta "${plan.title}"?`);
    if (!confirmed) return;

    const { error } = await supabase.from("meal_plans").delete().eq("id", plan.id);
    if (error) {
      onNotice(error.message);
      return;
    }

    onNotice("Dieta borrada.");
    await onReload();
  }

  async function duplicatePlan(plan: MealPlan) {
    if (!supabase) {
      onNotice("Modo demo: conecta Supabase para duplicar dietas reales.");
      return;
    }

    const duplicatedPlan = await duplicateMealPlan(
      supabase,
      tenant.id,
      plan,
      `${plan.title} copia`,
    );

    if (duplicatedPlan.error || !duplicatedPlan.planId) {
      onNotice(duplicatedPlan.error?.message ?? "No se pudo duplicar la dieta.");
      return;
    }

    setSelectedPlanId(duplicatedPlan.planId);
    onNotice("Dieta duplicada como inactiva.");
    await onReload();
  }

  async function togglePlanStatus(plan: MealPlan) {
    if (!supabase) {
      onNotice("Modo demo: conecta Supabase para activar o desactivar dietas reales.");
      return;
    }

    if (isPlanActive(plan)) {
      const { error } = await supabase
        .from("meal_plans")
        .update({ status: "archived" })
        .eq("id", plan.id);

      if (error) {
        onNotice(error.message);
        return;
      }

      onNotice("Dieta desactivada.");
      await onReload();
      return;
    }

    const archiveError = await deactivateOtherMealPlans(supabase, plan.patient_id, plan.id);
    if (archiveError) {
      onNotice(archiveError.message);
      return;
    }

    const { error } = await supabase
      .from("meal_plans")
      .update({ status: "published" })
      .eq("id", plan.id);

    if (error) {
      onNotice(error.message);
      return;
    }

    onNotice("Dieta activada.");
    await onReload();
  }

  return (
    <div className="grid gap-5">
      {isNutritionist && (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <Panel>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-black">
                {dietEditorMode === "edit" ? "Modificar dieta" : "Crear dieta"}
              </h2>
              <ClipboardList className="size-5 text-[var(--tenant-color)]" />
            </div>
            <div className="mt-5">
              <SelectField
                label="Modo"
                value={dietEditorMode}
                onChange={(value) => setDietEditorMode(value as DietEditorMode)}
                options={[
                  { value: "create", label: "Crear dieta" },
                  { value: "edit", label: "Modificar dieta" },
                ]}
              />
            </div>
            {dietEditorMode === "create" && (
              <form className="mt-5 space-y-4" onSubmit={addRowsToDraft}>
              <Field
                label="Nombre de la dieta"
                value={normalizedDraft.title}
                onChange={(value) => updatePlanDraft({ title: value })}
                required
              />
              <Field
                label="Fecha inicio"
                type="date"
                value={normalizedDraft.startDate}
                onChange={(value) => updatePlanDraft({ startDate: value })}
                required
              />
              <div className="space-y-3 rounded-lg border border-[var(--line)] bg-white p-3">
                {entryRows.map((item, index) => (
                  <DietBuilderRow
                    key={index}
                    item={item}
                    canRemove={entryRows.length > 1}
                    onChange={(patch) => updateEntryRow(index, patch)}
                    onRemove={() => removeEntryRow(index)}
                  />
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--line)] bg-white px-4 text-sm font-semibold"
                  onClick={addEntryRow}
                >
                  <Plus className="size-4" />
                  Añadir línea
                </button>
                <button className="inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--tenant-color)] px-4 text-sm font-semibold text-white">
                  <Check className="size-4" />
                  Añadir al plan
                </button>
              </div>
              </form>
            )}
            {dietEditorMode === "edit" && (
              <div className="mt-5 space-y-4">
                {plans.length === 0 && (
                  <EmptyState text="No hay dietas guardadas para modificar." />
                )}
                {plans.length > 0 && (
                  <>
                    <SelectField
                      label="Dieta a modificar"
                      value={selectedPublishedPlan?.id ?? ""}
                      onChange={setSelectedPlanId}
                      options={plans.map((savedPlan) => ({
                        value: savedPlan.id,
                        label: `${savedPlan.title} - ${formatDate(savedPlan.start_date)} - ${formatMealPlanStatus(savedPlan)}`,
                      }))}
                    />
                    {selectedPublishedPlan && (
                      <MealPlanMetadataEditor
                        key={selectedPublishedPlan.id}
                        plan={selectedPublishedPlan}
                        supabase={supabase}
                        onNotice={onNotice}
                        onReload={onReload}
                      />
                    )}
                    <form className="space-y-4" onSubmit={addRowsToPublishedPlan}>
                      <div className="space-y-3 rounded-lg border border-[var(--line)] bg-white p-3">
                        {entryRows.map((item, index) => (
                          <DietBuilderRow
                            key={index}
                            item={item}
                            canRemove={entryRows.length > 1}
                            onChange={(patch) => updateEntryRow(index, patch)}
                            onRemove={() => removeEntryRow(index)}
                          />
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--line)] bg-white px-4 text-sm font-semibold"
                          onClick={addEntryRow}
                        >
                          <Plus className="size-4" />
                          Añadir línea
                        </button>
                        <button
                          className="inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--tenant-color)] px-4 text-sm font-semibold text-white disabled:opacity-60"
                          disabled={!selectedPublishedPlan || publishing}
                        >
                          <Check className="size-4" />
                          {publishing ? "Guardando..." : "Añadir a la dieta"}
                        </button>
                      </div>
                    </form>
                  </>
                )}
              </div>
            )}
          </Panel>

          <Panel>
            <DietPublishedSummary
              plan={activePlan}
              isDraft={activePlanIsDraft}
              plans={plans}
              selectedPlanId={selectedPublishedPlan?.id ?? ""}
              onSelectPlan={setSelectedPlanId}
              onDeletePlan={deletePlan}
              onDuplicatePlan={duplicatePlan}
              onTogglePlanStatus={togglePlanStatus}
            />
          </Panel>
        </div>
      )}

      <Panel className="diet-print-card">
        <MealPlanCalendar
          plan={activePlan}
          isDraft={activePlanIsDraft}
          isEditable={isNutritionist}
          professionalName={professionalName}
          patientName={selectedPatient?.full_name ?? ""}
          supabase={supabase}
          publishing={publishing}
          onPublish={publishDraftPlan}
          onNotice={onNotice}
          onReload={onReload}
          onUpdateDraftMeal={updateDraftPlanMeal}
          onDeleteDraftMeal={deleteDraftPlanMeal}
          onPasteDraftDay={pasteDraftDayMeals}
        />
      </Panel>
    </div>
  );

  function updatePlanDraft(patch: Partial<Omit<MealPlanDraft, "draftItems" | "entryRows">>) {
    setPlanDraft((current) => ({
      ...normalizePlanDraft(current),
      ...patch,
    }));
  }

  function updateEntryRow(index: number, patch: Partial<DraftMealItem>) {
    setPlanDraft((current) => {
      const draft = normalizePlanDraft(current);

      return {
        ...draft,
        entryRows: draft.entryRows.map((item, itemIndex) =>
          itemIndex === index ? normalizeDraftMealItem({ ...item, ...patch }) : item,
        ),
      };
    });
  }

  function addEntryRow() {
    setPlanDraft((current) => {
      const draft = normalizePlanDraft(current);
      const lastRow = draft.entryRows.at(-1);

      return {
        ...draft,
        entryRows: [
          ...draft.entryRows,
          createDraftMealItem({
            dayIndex: lastRow?.dayIndex ?? 1,
            mealType: lastRow?.mealType ?? "Desayuno",
          }),
        ],
      };
    });
  }

  function removeEntryRow(index: number) {
    setPlanDraft((current) => {
      const draft = normalizePlanDraft(current);
      const nextRows = draft.entryRows.filter((_, itemIndex) => itemIndex !== index);

      return {
        ...draft,
        entryRows: nextRows.length > 0 ? nextRows : [createDraftMealItem()],
      };
    });
  }

  function updateDraftPlanMeal(index: number, patch: Partial<DraftMealItem>) {
    setPlanDraft((current) => {
      const draft = normalizePlanDraft(current);

      return {
        ...draft,
        draftItems: sortDraftItems(
          draft.draftItems.map((item, itemIndex) =>
            itemIndex === index ? normalizeDraftMealItem({ ...item, ...patch }) : item,
          ),
        ),
      };
    });
  }

  function deleteDraftPlanMeal(index: number) {
    setPlanDraft((current) => {
      const draft = normalizePlanDraft(current);

      return {
        ...draft,
        draftItems: draft.draftItems.filter((_, itemIndex) => itemIndex !== index),
      };
    });
  }

  function pasteDraftDayMeals(targetDayIndex: number, copiedItems: MealItem[]) {
    setPlanDraft((current) => {
      const draft = normalizePlanDraft(current);

      return {
        ...draft,
        draftItems: sortDraftItems([
          ...draft.draftItems,
          ...copiedItems.map((item) => mealItemToDraftMealItem(item, targetDayIndex)),
        ]),
      };
    });
  }
}

function MealPlanMetadataEditor({
  plan,
  supabase,
  onNotice,
  onReload,
}: {
  plan: MealPlan;
  supabase: ReturnType<typeof createSupabaseBrowser>;
  onNotice: (message: string) => void;
  onReload: () => Promise<void>;
}) {
  const [title, setTitle] = useState(plan.title);
  const [startDate, setStartDate] = useState(plan.start_date ?? "");
  const [saving, setSaving] = useState(false);

  async function savePlanDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase) {
      onNotice("Modo demo: conecta Supabase para editar dietas reales.");
      return;
    }

    const nextTitle = title.trim();
    if (!nextTitle) {
      onNotice("Indica el nombre de la dieta.");
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from("meal_plans")
      .update({
        title: nextTitle,
        start_date: startDate || null,
      })
      .eq("id", plan.id);

    setSaving(false);
    if (error) {
      onNotice(error.message);
      return;
    }

    onNotice("Datos de la dieta actualizados.");
    await onReload();
  }

  return (
    <form
      className="grid gap-3 rounded-lg border border-[var(--line)] bg-[#faf8f1] p-3"
      onSubmit={savePlanDetails}
    >
      <Field
        label="Nombre de la dieta"
        value={title}
        onChange={setTitle}
        required
      />
      <Field
        label="Fecha inicio"
        type="date"
        value={startDate}
        onChange={setStartDate}
      />
      <button
        className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[var(--line)] bg-white px-4 text-sm font-bold text-[#39433f] disabled:opacity-60"
        disabled={saving}
      >
        <Check className="size-4" />
        {saving ? "Guardando..." : "Guardar cambios"}
      </button>
    </form>
  );
}

function DietBuilderRow({
  item,
  canRemove,
  onChange,
  onRemove,
}: {
  item: DraftMealItem;
  canRemove: boolean;
  onChange: (patch: Partial<DraftMealItem>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="grid gap-3 rounded-lg bg-[#faf8f1] p-3">
      <div className="grid gap-3 md:grid-cols-2">
        <SelectField
          label="Día"
          value={String(item.dayIndex)}
          onChange={(value) => onChange({ dayIndex: Number(value) })}
          options={dayLabels.map((label, dayIndex) => ({
            value: String(dayIndex + 1),
            label,
          }))}
        />
        <SelectField
          label="Comida"
          value={item.mealType}
          onChange={(value) => onChange({ mealType: value })}
          options={mealTypes.map((label) => ({
            value: label,
            label,
          }))}
        />
      </div>
      <div className="grid gap-3 md:grid-cols-[110px_150px_minmax(0,1fr)_auto]">
        <Field
          label="Cantidad"
          type="number"
          step="0.01"
          value={item.quantity ?? ""}
          onChange={(value) => onChange({ quantity: value })}
          required
        />
        <SelectField
          label="Unidad de medida"
          value={formatMealUnit(item.unit ?? "Gramos")}
          onChange={(value) => onChange({ unit: value })}
          options={mealUnitOptions.map((label) => ({
            value: label,
            label,
          }))}
        />
        <Field
          label="Tipo de alimento"
          value={item.foodName ?? item.title}
          onChange={(value) => onChange({ foodName: value, title: value })}
          required
        />
        {canRemove && (
          <button
            type="button"
            className="mt-6 inline-flex h-11 items-center justify-center rounded-lg border border-[#e8c7be] bg-[#fff3ef] px-3 text-[#8d3c2f]"
            onClick={onRemove}
            aria-label="Eliminar línea"
          >
            <Trash2 className="size-4" />
          </button>
        )}
      </div>
    </div>
  );
}

function DietPublishedSummary({
  plan,
  isDraft,
  plans,
  selectedPlanId,
  onSelectPlan,
  onDeletePlan,
  onDuplicatePlan,
  onTogglePlanStatus,
}: {
  plan: MealPlan | null;
  isDraft: boolean;
  plans: MealPlan[];
  selectedPlanId: string;
  onSelectPlan: (planId: string) => void;
  onDeletePlan: (plan: MealPlan) => Promise<void>;
  onDuplicatePlan: (plan: MealPlan) => Promise<void>;
  onTogglePlanStatus: (plan: MealPlan) => Promise<void>;
}) {
  const groupedItems = getPlanMeals(plan);

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-black">Dieta publicada</h2>
        <BookOpen className="size-5 text-[var(--tenant-color)]" />
      </div>
      {plans.length > 0 && (
        <div className="mt-4">
          <SelectField
            label="Dieta guardada"
            value={selectedPlanId}
            onChange={onSelectPlan}
            options={plans.map((savedPlan) => ({
              value: savedPlan.id,
              label: `${savedPlan.title} - ${formatDate(savedPlan.start_date)} - ${formatMealPlanStatus(savedPlan)}`,
            }))}
          />
        </div>
      )}
      {!plan && <div className="mt-4"><EmptyState text="Añade comidas al plan para montar la dieta." /></div>}
      {plan && (
        <div className="mt-4 space-y-3">
          <div className="rounded-lg border border-[var(--line)] bg-white p-3">
            <p className="font-black">{plan.title}</p>
            <p className="text-sm text-[var(--muted)]">
              Inicio {formatDate(plan.start_date)} - {isDraft ? "Borrador" : formatMealPlanStatus(plan)}
            </p>
          </div>
          <div className="max-h-[430px] space-y-3 overflow-y-auto pr-1">
            {groupedItems.map(({ dayLabel, items }) => (
              <div key={dayLabel} className="rounded-lg bg-[#f7f5ef] p-3">
                <p className="text-sm font-black">{dayLabel}</p>
                <div className="mt-2 space-y-2">
                  {items.map((item) => (
                    <div key={item.id} className="rounded-md bg-white px-3 py-2 text-sm">
                      <p className="font-bold">{formatMealTypeLabel(item.meal_type)}</p>
                      <p className="text-[var(--muted)]">{formatMealServing(item)}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {groupedItems.length === 0 && (
              <p className="rounded-md border border-dashed border-[#d8d1c4] px-3 py-2 text-sm text-[var(--muted)]">
                Sin comidas añadidas.
              </p>
            )}
          </div>
          {!isDraft && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--line)] bg-white px-3 text-xs font-bold text-[#53605a]"
                onClick={() => onDuplicatePlan(plan)}
              >
                <Copy className="size-4" />
                Duplicar dieta
              </button>
              <button
                type="button"
                className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-bold ${
                  isPlanActive(plan)
                    ? "border-[#e8c7be] bg-[#fff3ef] text-[#8d3c2f]"
                    : "border-[#b8dccd] bg-[#effaf5] text-[#255d50]"
                }`}
                onClick={() => onTogglePlanStatus(plan)}
              >
                {isPlanActive(plan) ? <Ban className="size-4" /> : <Check className="size-4" />}
                {isPlanActive(plan) ? "Desactivar dieta" : "Activar dieta"}
              </button>
              <button
                type="button"
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#e8c7be] bg-[#fff3ef] px-3 text-xs font-bold text-[#8d3c2f]"
                onClick={() => onDeletePlan(plan)}
              >
                <Trash2 className="size-4" />
                Borrar dieta
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MealPlanCalendar({
  plan,
  isDraft,
  isEditable,
  professionalName,
  patientName,
  supabase,
  publishing,
  onPublish,
  onNotice,
  onReload,
  onUpdateDraftMeal,
  onDeleteDraftMeal,
  onPasteDraftDay,
}: {
  plan: MealPlan | null;
  isDraft: boolean;
  isEditable: boolean;
  professionalName: string;
  patientName: string;
  supabase: ReturnType<typeof createSupabaseBrowser>;
  publishing: boolean;
  onPublish: () => Promise<void>;
  onNotice: (message: string) => void;
  onReload: () => Promise<void>;
  onUpdateDraftMeal: (index: number, patch: Partial<DraftMealItem>) => void;
  onDeleteDraftMeal: (index: number) => void;
  onPasteDraftDay: (targetDayIndex: number, copiedItems: MealItem[]) => void;
}) {
  const planDays = plan?.meal_plan_days ?? [];
  const [copiedDay, setCopiedDay] = useState<{
    dayIndex: number;
    dayLabel: string;
    items: MealItem[];
  } | null>(null);

  function handlePrint() {
    if (typeof document === "undefined") return;

    document.body.classList.add("printing-diet-calendar");
    const clearPrintMode = () => document.body.classList.remove("printing-diet-calendar");
    window.addEventListener("afterprint", clearPrintMode, { once: true });
    window.setTimeout(() => {
      window.print();
      window.setTimeout(clearPrintMode, 1000);
    }, 0);
  }

  async function handleShare() {
    if (!plan || typeof window === "undefined") return;

    const shareText = [
      `Dieta: ${plan.title}`,
      `Profesional: ${professionalName || APP_NAME}`,
      patientName ? `Cliente: ${patientName}` : "",
      `Inicio: ${formatDate(plan.start_date)}`,
      `Estado: ${isDraft ? "Borrador" : formatMealPlanStatus(plan)}`,
    ]
      .filter(Boolean)
      .join("\n");

    try {
      if (navigator.share) {
        await navigator.share({
          title: `Dieta ${plan.title}`,
          text: shareText,
          url: window.location.href,
        });
        return;
      }

      if (navigator.clipboard) {
        await navigator.clipboard.writeText(`${shareText}\n${window.location.href}`);
        onNotice("Información de la dieta copiada para compartir.");
        return;
      }

      onNotice("Tu navegador no permite compartir desde aquí.");
    } catch {
      onNotice("No se pudo abrir el menú de compartir.");
    }
  }

  function copyDay(dayIndex: number) {
    if (!plan) return;

    const items = getMealItemsForDay(plan, dayIndex);
    if (items.length === 0) {
      onNotice("Ese día no tiene comidas para copiar.");
      return;
    }

    setCopiedDay({
      dayIndex,
      dayLabel: dayLabels[dayIndex - 1],
      items,
    });
    onNotice(`Comidas de ${dayLabels[dayIndex - 1]} copiadas.`);
  }

  async function pasteDay(targetDayIndex: number) {
    if (!plan || !copiedDay) return;
    if (copiedDay.dayIndex === targetDayIndex) {
      onNotice("Elige un día diferente para pegar las comidas.");
      return;
    }

    if (isDraft) {
      onPasteDraftDay(targetDayIndex, copiedDay.items);
      onNotice(`Comidas pegadas en ${dayLabels[targetDayIndex - 1]}.`);
      return;
    }

    if (!supabase) {
      onNotice("Modo demo: conecta Supabase para editar dietas reales.");
      return;
    }

    const mealPlanDayId = await getOrCreateMealPlanDayId(
      supabase,
      plan.id,
      planDays,
      targetDayIndex,
    );
    if (!mealPlanDayId) {
      onNotice("No se pudo crear el día destino.");
      return;
    }

    const targetItems = getMealItemsForDay(plan, targetDayIndex);
    const nextPosition =
      targetItems.reduce((max, item) => Math.max(max, item.position), 0) + 1;
    const rows = copiedDay.items.map((item, index) =>
      mealItemPayloadFromDraft(
        mealItemToDraftMealItem(item, targetDayIndex),
        mealPlanDayId,
        nextPosition + index,
      ),
    );
    const error = await insertMealRows(supabase, rows);

    if (error) {
      onNotice(error.message);
      return;
    }

    onNotice(`Comidas pegadas en ${dayLabels[targetDayIndex - 1]}.`);
    await onReload();
  }

  return (
    <div>
      {plan && (
        <div className="diet-print-header">
          <div>
            <p className="diet-print-kicker">{APP_NAME}</p>
            <h1>Calendario de dieta</h1>
          </div>
          <div className="diet-print-meta">
            <div>
              <span>Profesional</span>
              <strong>{professionalName || APP_NAME}</strong>
            </div>
            <div>
              <span>Cliente</span>
              <strong>{patientName || "Cliente"}</strong>
            </div>
            <div>
              <span>Dieta</span>
              <strong>{plan.title}</strong>
            </div>
            <div>
              <span>Inicio</span>
              <strong>{formatDate(plan.start_date)}</strong>
            </div>
            <div>
              <span>Estado</span>
              <strong>{isDraft ? "Borrador" : formatMealPlanStatus(plan)}</strong>
            </div>
          </div>
        </div>
      )}
      <div className="print-hidden flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="inline-flex items-center rounded-full bg-[#eef7fb] px-3 py-1 text-xs font-black uppercase text-[var(--tenant-color)]">
            {isDraft ? "Borrador pendiente" : plan ? formatMealPlanStatus(plan) : "Sin dieta"}
          </div>
          <h2 className="mt-2 text-lg font-black">Vista dieta</h2>
          <p className="text-sm text-[var(--muted)]">
            {plan
              ? `${plan.title} · Inicio ${formatDate(plan.start_date)}`
              : "El calendario se rellenará al añadir comidas al plan."}
          </p>
        </div>
        <div className="print-hidden flex flex-wrap gap-2">
          {isEditable && isDraft && (
            <button
              type="button"
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--tenant-color)] px-4 text-sm font-bold text-white disabled:opacity-60"
              onClick={onPublish}
              disabled={publishing}
            >
              <Check className="size-4" />
              {publishing ? "Publicando..." : "Publicar dieta"}
            </button>
          )}
          <button
            type="button"
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--line)] bg-white px-4 text-sm font-bold text-[#39433f] disabled:opacity-60"
            onClick={handleShare}
            disabled={!plan}
          >
            <Share2 className="size-4" />
            Compartir
          </button>
          <button
            type="button"
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--line)] bg-white px-4 text-sm font-bold text-[#39433f] disabled:opacity-60"
            onClick={handlePrint}
            disabled={!plan}
          >
            <Printer className="size-4" />
            Descargar / imprimir
          </button>
        </div>
      </div>

      {!plan && (
        <div className="mt-4">
          <EmptyState text="Todavía no hay dieta para mostrar." />
        </div>
      )}
      {plan && (
        <div className="diet-calendar-scroll mt-4 overflow-x-auto">
          <div className="diet-calendar-grid min-w-[980px] overflow-hidden rounded-lg border border-[var(--line)] bg-white">
            <div className="diet-calendar-header-row grid grid-cols-[130px_repeat(7,minmax(120px,1fr))] border-b border-[var(--line)] bg-[#f2efe7]">
              <div className="diet-calendar-corner border-r border-[var(--line)] p-3 text-xs font-black uppercase text-[var(--muted)]">
                Comida / día
              </div>
              {dayLabels.map((dayLabel, dayIndex) => {
                const calendarDayIndex = dayIndex + 1;

                return (
                <div
                  key={dayLabel}
                  className="diet-calendar-day-header border-r border-[var(--line)] p-3 text-xs font-black uppercase text-[#53605a] last:border-r-0"
                >
                  <div className="flex flex-col gap-2">
                    <span>{dayLabel}</span>
                    {isEditable && (
                      <div className="print-hidden flex flex-wrap gap-1">
                        <button
                          type="button"
                          className="inline-flex h-7 flex-1 items-center justify-center gap-1 rounded-md border border-[var(--line)] bg-white px-2 text-[11px] font-bold normal-case text-[#53605a]"
                          onClick={() => copyDay(calendarDayIndex)}
                        >
                          <Copy className="size-3" />
                          Copiar
                        </button>
                        <button
                          type="button"
                          className="inline-flex h-7 flex-1 items-center justify-center gap-1 rounded-md border border-[var(--line)] bg-white px-2 text-[11px] font-bold normal-case text-[#53605a] disabled:opacity-50"
                          onClick={() => pasteDay(calendarDayIndex)}
                          disabled={!copiedDay}
                        >
                          Pegar
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                );
              })}
            </div>
            {mealTypes.map((mealType) => (
              <div
                key={mealType}
                className="diet-calendar-row grid grid-cols-[130px_repeat(7,minmax(120px,1fr))] border-b border-[var(--line)] last:border-b-0"
              >
                <div className="diet-calendar-meal-label border-r border-[var(--line)] bg-[#faf8f1] p-3 text-sm font-black">
                  {mealType}
                </div>
                {dayLabels.map((dayLabel, dayIndex) => {
                  const calendarDayIndex = dayIndex + 1;
                  const cellItems = getMealItemsForCell(plan, calendarDayIndex, mealType);

                  return (
                    <div
                      key={`${mealType}-${dayLabel}`}
                      className="diet-calendar-cell min-h-[118px] border-r border-[var(--line)] p-2 last:border-r-0"
                    >
                      <div className="space-y-2">
                        {cellItems.map((item) => (
                          <CalendarMealItem
                            key={item.id}
                            item={item}
                            planId={plan.id}
                            planDays={planDays}
                            currentDayIndex={calendarDayIndex}
                            isDraft={isDraft}
                            isEditable={isEditable}
                            supabase={supabase}
                            onNotice={onNotice}
                            onReload={onReload}
                            onUpdateDraftMeal={onUpdateDraftMeal}
                            onDeleteDraftMeal={onDeleteDraftMeal}
                          />
                        ))}
                        {cellItems.length === 0 && (
                          <p className="diet-calendar-empty rounded-md border border-dashed border-[#e0dbd0] px-2 py-3 text-center text-xs font-semibold text-[var(--muted)]">
                            Sin alimento
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CalendarMealItem({
  item,
  planId,
  planDays,
  currentDayIndex,
  isDraft,
  isEditable,
  supabase,
  onNotice,
  onReload,
  onUpdateDraftMeal,
  onDeleteDraftMeal,
}: {
  item: MealItem;
  planId: string;
  planDays: MealPlanDay[];
  currentDayIndex: number;
  isDraft: boolean;
  isEditable: boolean;
  supabase: ReturnType<typeof createSupabaseBrowser>;
  onNotice: (message: string) => void;
  onReload: () => Promise<void>;
  onUpdateDraftMeal: (index: number, patch: Partial<DraftMealItem>) => void;
  onDeleteDraftMeal: (index: number) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [dayIndex, setDayIndex] = useState(String(currentDayIndex));
  const [mealType, setMealType] = useState(formatMealTypeLabel(item.meal_type));
  const [quantity, setQuantity] = useState(formatMealQuantityValue(item));
  const [unit, setUnit] = useState(formatMealUnit(item.unit ?? "Gramos"));
  const [foodName, setFoodName] = useState(getMealFoodName(item));
  const draftIndex = getDraftMealIndex(item);

  function startEditing() {
    setDayIndex(String(currentDayIndex));
    setMealType(formatMealTypeLabel(item.meal_type));
    setQuantity(formatMealQuantityValue(item));
    setUnit(formatMealUnit(item.unit ?? "Gramos"));
    setFoodName(getMealFoodName(item));
    setIsEditing(true);
  }

  async function saveMeal() {
    if (!foodName.trim() || !quantity.trim()) {
      onNotice("Completa cantidad y alimento.");
      return;
    }

    if (isDraft) {
      if (draftIndex === null) return;
      onUpdateDraftMeal(draftIndex, {
        dayIndex: Number(dayIndex),
        mealType,
        quantity,
        unit,
        foodName,
        title: foodName,
        description: "",
      });
      setIsEditing(false);
      onNotice("Comida actualizada en el borrador.");
      return;
    }

    if (!supabase) {
      onNotice("Modo demo: conecta Supabase para editar dietas reales.");
      return;
    }

    const mealPlanDayId = await getOrCreateMealPlanDayId(
      supabase,
      planId,
      planDays,
      Number(dayIndex),
    );
    if (!mealPlanDayId) {
      onNotice("No se pudo localizar el día de la dieta.");
      return;
    }

    const payload = mealItemPayloadFromDraft(
      {
        dayIndex: Number(dayIndex),
        mealType,
        quantity,
        unit,
        foodName,
        title: foodName,
        description: "",
      },
      mealPlanDayId,
      item.position,
    );
    const error = await updateMealItem(supabase, item.id, payload);

    if (error) {
      onNotice(error.message);
      return;
    }

    setIsEditing(false);
    onNotice("Comida actualizada.");
    await onReload();
  }

  async function deleteMeal() {
    if (isDraft) {
      if (draftIndex !== null) {
        onDeleteDraftMeal(draftIndex);
        onNotice("Comida eliminada del borrador.");
      }
      return;
    }

    if (!supabase) {
      onNotice("Modo demo: conecta Supabase para editar dietas reales.");
      return;
    }

    const { error } = await supabase.from("meal_items").delete().eq("id", item.id);
    if (error) {
      onNotice(error.message);
      return;
    }

    onNotice("Comida eliminada.");
    await onReload();
  }

  return (
    <div className="diet-calendar-item rounded-md border border-[var(--line)] bg-[#fffdf8] p-2 text-xs">
      {!isEditing && (
        <div>
          <p className="font-black text-[#17201d]">{getMealFoodName(item)}</p>
          <p className="mt-1 text-[var(--muted)]">{formatMealQuantity(item)}</p>
          {isEditable && (
            <div className="print-hidden mt-2 flex flex-wrap gap-1">
              <button
                type="button"
                className="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-md border border-[var(--line)] bg-white px-2 font-bold text-[#53605a]"
                onClick={startEditing}
              >
                <Pencil className="size-3.5" />
                Modificar
              </button>
              <button
                type="button"
                className="inline-flex h-8 items-center justify-center rounded-md border border-[#e8c7be] bg-[#fff3ef] px-2 text-[#8d3c2f]"
                onClick={deleteMeal}
                aria-label="Borrar comida"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          )}
        </div>
      )}
      {isEditing && (
        <div className="grid gap-2">
          <SelectField
            label="Día"
            value={dayIndex}
            onChange={setDayIndex}
            options={dayLabels.map((label, index) => ({
              value: String(index + 1),
              label,
            }))}
          />
          <SelectField
            label="Comida"
            value={mealType}
            onChange={setMealType}
            options={mealTypes.map((label) => ({ value: label, label }))}
          />
          <Field
            label="Cantidad"
            type="number"
            step="0.01"
            value={quantity}
            onChange={setQuantity}
          />
          <SelectField
            label="Unidad"
            value={unit}
            onChange={setUnit}
            options={mealUnitOptions.map((label) => ({ value: label, label }))}
          />
          <Field label="Alimento" value={foodName} onChange={setFoodName} />
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              className="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-md bg-[var(--tenant-color)] px-2 font-bold text-white"
              onClick={saveMeal}
            >
              <Check className="size-3.5" />
              Guardar
            </button>
            <button
              type="button"
              className="inline-flex h-8 items-center justify-center rounded-md border border-[var(--line)] bg-white px-2 font-bold text-[#53605a]"
              onClick={() => setIsEditing(false)}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function getPlanMeals(plan: MealPlan | null) {
  if (!plan) return [];

  return dayLabels
    .map((dayLabel, index) => {
      const dayIndex = index + 1;
      const items = getMealItemsForDay(plan, dayIndex);

      return { dayLabel, items };
    })
    .filter(({ items }) => items.length > 0);
}

function getMealItemsForDay(plan: MealPlan, dayIndex: number) {
  return ((plan.meal_plan_days ?? []).find((day) => day.day_index === dayIndex)?.meal_items ?? [])
    .slice()
    .sort(
      (a, b) =>
        getMealTypePosition(a.meal_type) - getMealTypePosition(b.meal_type) ||
        a.position - b.position,
    );
}

function getMealItemsForCell(plan: MealPlan, dayIndex: number, mealType: string) {
  return getMealItemsForDay(plan, dayIndex).filter(
    (item) => formatMealTypeLabel(item.meal_type) === mealType,
  );
}

function buildDraftMealPlan(
  draft: MealPlanDraft,
  draftItems: DraftMealItem[],
  patientId: string,
): MealPlan {
  return {
    id: "draft-plan",
    patient_id: patientId,
    title: draft.title.trim() || "Plan semanal",
    start_date: draft.startDate,
    status: "draft",
    meal_plan_days: dayLabels
      .map((dayLabel, dayIndex) => {
        const items = draftItems
          .map((item, index) => ({ item, index }))
          .filter(({ item }) => item.dayIndex === dayIndex + 1)
          .map(({ item, index }) => ({
            id: `draft-item-${index}`,
            meal_plan_day_id: `draft-day-${dayIndex + 1}`,
            meal_type: item.mealType,
            title: item.foodName ?? item.title,
            description: null,
            quantity: item.quantity,
            unit: item.unit,
            food_name: item.foodName ?? item.title,
            position: index + 1,
          }));

        return {
          id: `draft-day-${dayIndex + 1}`,
          day_index: dayIndex + 1,
          day_label: dayLabel,
          notes: null,
          meal_items: items,
        };
      })
      .filter((day) => day.meal_items.length > 0),
  };
}

function createDraftMealItem(patch: Partial<DraftMealItem> = {}): DraftMealItem {
  return normalizeDraftMealItem({
    dayIndex: 1,
    mealType: "Desayuno",
    quantity: "",
    unit: "Gramos",
    foodName: "",
    title: "",
    description: "",
    ...patch,
  });
}

function normalizePlanDraft(draft: Partial<MealPlanDraft>): MealPlanDraft {
  const entryRows = normalizeDraftMealItems(draft.entryRows);
  const draftItems = normalizeDraftMealItems(draft.draftItems);

  return {
    title: draft.title ?? "Plan semanal",
    startDate: draft.startDate ?? new Date().toISOString().slice(0, 10),
    entryRows: entryRows.length > 0 ? entryRows : [createDraftMealItem()],
    draftItems: sortDraftItems(draftItems),
  };
}

function normalizeDraftMealItems(items?: Partial<DraftMealItem>[]) {
  return (items ?? []).map(normalizeDraftMealItem);
}

function normalizeDraftMealItem(item: Partial<DraftMealItem>): DraftMealItem {
  const foodName = item.foodName ?? item.title ?? "";

  return {
    dayIndex: Number(item.dayIndex || 1),
    mealType: formatMealTypeLabel(item.mealType || "Desayuno"),
    quantity: item.quantity ?? "",
    unit: formatMealUnit(item.unit || "Gramos"),
    foodName,
    title: foodName,
    description: item.description ?? "",
  };
}

function hasCompleteDraftMealItem(item: DraftMealItem) {
  return Boolean((item.foodName ?? item.title).trim() && (item.quantity ?? "").trim());
}

function mealItemToDraftMealItem(item: MealItem, dayIndex: number): DraftMealItem {
  const foodName = getMealFoodName(item);

  return {
    dayIndex,
    mealType: formatMealTypeLabel(item.meal_type),
    quantity: formatMealQuantityValue(item),
    unit: formatMealUnit(item.unit ?? "Gramos"),
    foodName,
    title: foodName,
    description: "",
  };
}

function sortDraftItems(items: DraftMealItem[]) {
  return [...items].sort(
    (a, b) =>
      a.dayIndex - b.dayIndex ||
      getMealTypePosition(a.mealType) - getMealTypePosition(b.mealType),
  );
}

function mealItemPayloadFromDraft(
  item: DraftMealItem,
  mealPlanDayId: string,
  position: number,
) {
  const foodName = (item.foodName ?? item.title).trim();

  return {
    meal_plan_day_id: mealPlanDayId,
    meal_type: item.mealType,
    title: foodName,
    description: null,
    quantity: parseMealQuantity(item.quantity ?? ""),
    unit: formatMealUnit(item.unit ?? "Gramos"),
    food_name: foodName,
    position,
  };
}

async function insertMealRows(
  supabase: ReturnType<typeof createSupabaseBrowser>,
  mealRows: Array<ReturnType<typeof mealItemPayloadFromDraft> | null>,
) {
  if (!supabase) return null;

  const rows = mealRows.filter(Boolean) as Array<ReturnType<typeof mealItemPayloadFromDraft>>;
  const { error } = await supabase.from("meal_items").insert(rows);
  if (!isMissingMealServingColumnError(error)) return error;

  const { error: fallbackError } = await supabase
    .from("meal_items")
    .insert(rows.map(toLegacyMealItemPayload));

  return fallbackError;
}

async function updateMealItem(
  supabase: ReturnType<typeof createSupabaseBrowser>,
  itemId: string,
  payload: ReturnType<typeof mealItemPayloadFromDraft>,
) {
  if (!supabase) return null;

  const { error } = await supabase.from("meal_items").update(payload).eq("id", itemId);
  if (!isMissingMealServingColumnError(error)) return error;

  const { error: fallbackError } = await supabase
    .from("meal_items")
    .update(toLegacyMealItemPayload(payload))
    .eq("id", itemId);

  return fallbackError;
}

async function deactivateOtherMealPlans(
  supabase: ReturnType<typeof createSupabaseBrowser>,
  patientId: string,
  activePlanId: string,
) {
  if (!supabase) return null;

  const { error } = await supabase
    .from("meal_plans")
    .update({ status: "archived" })
    .eq("patient_id", patientId)
    .eq("status", "published")
    .neq("id", activePlanId);

  return error;
}

async function duplicateMealPlan(
  supabase: ReturnType<typeof createSupabaseBrowser>,
  tenantId: string,
  plan: MealPlan,
  title: string,
) {
  if (!supabase) return { planId: null, error: null };

  const { data: insertedPlan, error: planError } = await supabase
    .from("meal_plans")
    .insert({
      tenant_id: tenantId,
      patient_id: plan.patient_id,
      title,
      start_date: plan.start_date,
      status: "archived",
    })
    .select("id")
    .single();

  if (planError || !insertedPlan) {
    return { planId: null, error: planError };
  }

  const sourceDays = plan.meal_plan_days ?? [];
  if (sourceDays.length === 0) {
    return { planId: insertedPlan.id as string, error: null };
  }

  const { data: insertedDays, error: dayError } = await supabase
    .from("meal_plan_days")
    .insert(
      sourceDays.map((day) => ({
        meal_plan_id: insertedPlan.id,
        day_index: day.day_index,
        day_label: day.day_label,
        notes: day.notes,
      })),
    )
    .select("id,day_index");

  if (dayError || !insertedDays) {
    return { planId: null, error: dayError };
  }

  const mealRows = sourceDays.flatMap((day) => {
    const targetDayId = insertedDays.find((insertedDay) => insertedDay.day_index === day.day_index)?.id;
    if (!targetDayId) return [];

    return getMealItemsForDay(plan, day.day_index).map((item, index) =>
      mealItemPayloadFromDraft(
        mealItemToDraftMealItem(item, day.day_index),
        targetDayId,
        index + 1,
      ),
    );
  });
  const itemError = await insertMealRows(supabase, mealRows);

  return {
    planId: itemError ? null : (insertedPlan.id as string),
    error: itemError,
  };
}

async function appendMealRowsToPlan(
  supabase: ReturnType<typeof createSupabaseBrowser>,
  plan: MealPlan,
  items: DraftMealItem[],
) {
  if (!supabase) return null;

  const dayIdByIndex = new Map<number, string>(
    (plan.meal_plan_days ?? []).map((day) => [day.day_index, day.id]),
  );
  const nextPositionByDay = new Map<number, number>(
    dayLabels.map((_, index) => {
      const dayIndex = index + 1;
      const nextPosition =
        getMealItemsForDay(plan, dayIndex).reduce(
          (max, item) => Math.max(max, item.position),
          0,
        ) + 1;

      return [dayIndex, nextPosition];
    }),
  );
  const mealRows: Array<ReturnType<typeof mealItemPayloadFromDraft>> = [];

  for (const item of sortDraftItems(items)) {
    let mealPlanDayId = dayIdByIndex.get(item.dayIndex);

    if (!mealPlanDayId) {
      const { data, error } = await supabase
        .from("meal_plan_days")
        .insert({
          meal_plan_id: plan.id,
          day_index: item.dayIndex,
          day_label: dayLabels[item.dayIndex - 1],
        })
        .select("id")
        .single();

      if (error || !data) {
        return error?.message ?? "No se pudo crear el día de la dieta.";
      }

      mealPlanDayId = data.id as string;
      dayIdByIndex.set(item.dayIndex, mealPlanDayId);
      nextPositionByDay.set(item.dayIndex, 1);
    }

    const nextPosition = nextPositionByDay.get(item.dayIndex) ?? 1;
    mealRows.push(mealItemPayloadFromDraft(item, mealPlanDayId, nextPosition));
    nextPositionByDay.set(item.dayIndex, nextPosition + 1);
  }

  const error = await insertMealRows(supabase, mealRows);
  return error?.message ?? null;
}

function toLegacyMealItemPayload(payload: ReturnType<typeof mealItemPayloadFromDraft>) {
  return {
    meal_plan_day_id: payload.meal_plan_day_id,
    meal_type: payload.meal_type,
    title: payload.food_name,
    description: formatQuantityAndUnit(payload.quantity, payload.unit),
    position: payload.position,
  };
}

function isMissingMealServingColumnError(error: { message?: string; code?: string } | null) {
  if (!error) return false;

  return (
    error.code === "PGRST204" ||
    /food_name|quantity|unit|schema cache/i.test(error.message ?? "")
  );
}

async function getOrCreateMealPlanDayId(
  supabase: ReturnType<typeof createSupabaseBrowser>,
  planId: string,
  planDays: MealPlanDay[],
  dayIndex: number,
) {
  const existingDay = planDays.find((day) => day.day_index === dayIndex);
  if (existingDay) return existingDay.id;
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("meal_plan_days")
    .insert({
      meal_plan_id: planId,
      day_index: dayIndex,
      day_label: dayLabels[dayIndex - 1],
    })
    .select("id")
    .single();

  if (error || !data) return null;

  return data.id as string;
}

function getMealFoodName(item: MealItem) {
  return item.food_name?.trim() || item.title;
}

function getMealQuantity(item: MealItem) {
  if (item.quantity !== undefined && item.quantity !== null && String(item.quantity).trim()) {
    return String(item.quantity).replace(".", ",");
  }

  return "";
}

function formatMealQuantityValue(item: MealItem) {
  return getMealQuantity(item).replace(",", ".");
}

function formatMealQuantity(item: MealItem) {
  const quantity = getMealQuantity(item);
  if (quantity && item.unit) return `${quantity} ${formatMealUnit(item.unit)}`;
  if (item.description) return item.description;
  return "Sin cantidad indicada";
}

function formatMealServing(item: MealItem) {
  return `${formatMealQuantity(item)} · ${getMealFoodName(item)}`;
}

function formatQuantityAndUnit(quantity: number | null, unit: string | null) {
  if (quantity === null && !unit) return null;

  return `${quantity ?? ""} ${unit ? formatMealUnit(unit) : ""}`.trim() || null;
}

function parseMealQuantity(value: string) {
  const normalized = value.replace(",", ".").trim();
  if (!normalized) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatMealTypeLabel(mealType: string) {
  if (mealType === "Media mañana") return "Almuerzo";
  if (mealType === "Merienda") return "Media tarde";

  return mealType;
}

function formatMealUnit(unit: string) {
  const normalizedUnit = unit.trim();
  const knownUnit = mealUnitOptions.find(
    (option) => option.toLocaleLowerCase("es-ES") === normalizedUnit.toLocaleLowerCase("es-ES"),
  );
  if (knownUnit) return knownUnit;

  return normalizedUnit
    ? normalizedUnit.charAt(0).toLocaleUpperCase("es-ES") + normalizedUnit.slice(1)
    : "Gramos";
}

function isPlanActive(plan: MealPlan) {
  return plan.status === "published";
}

function formatMealPlanStatus(plan: MealPlan) {
  if (plan.status === "draft") return "Borrador";
  if (isPlanActive(plan)) return "Activa";
  if (plan.status === "archived") return "Inactiva";

  return plan.status;
}

function getDraftMealIndex(item: MealItem) {
  const match = /^draft-item-(\d+)$/.exec(item.id);

  return match ? Number(match[1]) : null;
}

function DataEntryPanel({
  tenant,
  selectedPatient,
  supabase,
  goals,
  goalLogs,
  onNotice,
  onReload,
}: {
  tenant: Tenant;
  selectedPatient: Patient | null;
  supabase: ReturnType<typeof createSupabaseBrowser>;
  goals: PatientGoal[];
  goalLogs: PatientGoalLog[];
  onNotice: (message: string) => void;
  onReload: () => Promise<void>;
}) {
  const emptyTrackingDraft = useMemo(
    () => ({
      weight: "",
      waist: "",
      steps: "",
      exercise: "",
      durationSeconds: "",
      distanceKm: "",
      mealType: "Comida",
      mealNotes: "",
    }),
    [],
  );
  const [trackingDraft, setTrackingDraft, clearTrackingDraft] = useStoredDraft(
    `nutrios:draft:tracking:${selectedPatient?.id ?? "none"}`,
    emptyTrackingDraft,
  );
  const [customGoalDrafts, setCustomGoalDrafts, clearCustomGoalDrafts] =
    useStoredValue<Record<string, string>>(
      `nutrios:draft:custom-goals:${selectedPatient?.id ?? "none"}`,
      {},
  );
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [savingTracking, setSavingTracking] = useState(false);
  const [durationPickerOpen, setDurationPickerOpen] = useState(false);
  const [distancePickerOpen, setDistancePickerOpen] = useState(false);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const activeCustomGoals = goals
    .filter(
      (goal) =>
        goal.patient_id === selectedPatient?.id &&
        goal.goal_type === "custom" &&
        goal.is_active,
    )
    .sort(compareGoals);

  async function saveTracking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingTracking) return;
    if (!selectedPatient) return;
    if (!supabase) {
      onNotice("Modo demo: conecta Supabase para registrar datos reales.");
      return;
    }

    setSavingTracking(true);

    try {
      const customGoalLogs: Array<{
        goalId: string;
        status: GoalStatus;
        value: number | null;
      }> = [];

      if (trackingDraft.weight) {
        const weightKg = Number(trackingDraft.weight);
        if (!Number.isFinite(weightKg) || weightKg <= 0) {
          onNotice("Peso no valido.");
          return;
        }
      }

      if (trackingDraft.waist) {
        const waistCm = Number(trackingDraft.waist);
        if (!Number.isFinite(waistCm) || waistCm <= 0) {
          onNotice("Medida de cintura no valida.");
          return;
        }
      }

      if (trackingDraft.steps) {
        const stepCount = Number(trackingDraft.steps);
        if (!Number.isInteger(stepCount) || stepCount < 0 || stepCount > 200000) {
          onNotice("Pasos no validos.");
          return;
        }
      }

      const durationSeconds = trackingDraft.durationSeconds
        ? Number(trackingDraft.durationSeconds)
        : null;
      const distanceKm = trackingDraft.distanceKm
        ? Number(trackingDraft.distanceKm)
        : null;

      if (
        durationSeconds != null &&
        (!Number.isInteger(durationSeconds) || durationSeconds < 0 || durationSeconds > 86400)
      ) {
        onNotice("Duración de actividad no válida.");
        return;
      }

      if (
        distanceKm != null &&
        (!Number.isFinite(distanceKm) || distanceKm < 0 || distanceKm > 1000)
      ) {
        onNotice("Distancia no válida.");
        return;
      }

      if ((durationSeconds || distanceKm) && !trackingDraft.exercise) {
        onNotice("Selecciona el deporte realizado.");
        return;
      }

      if (trackingDraft.exercise) {
        const activity = trackingDraft.exercise.trim();
        if (!activity) {
          onNotice("Actividad no válida.");
          return;
        }
      }

      for (const goal of activeCustomGoals) {
        const rawValue = customGoalDrafts[goal.id];
        if (rawValue === undefined || rawValue === "") continue;

        const inputType = getCustomGoalInputType(goal);
        const isCheckGoal = inputType === "check";
        const numericValue = isCheckGoal ? null : Number(rawValue);

        if (!isCheckGoal && (!Number.isFinite(numericValue) || numericValue < 0)) {
          onNotice(`Valor no valido para ${goal.title}.`);
          return;
        }

        const status = isCheckGoal
          ? (rawValue as GoalStatus)
          : deriveNumericCustomGoalStatus(goal, numericValue);

        customGoalLogs.push({
          goalId: goal.id,
          status,
          value: numericValue,
        });
      }

      let mealPhoto:
        | {
            storagePath: string;
            mealType: string;
            notes: string;
            loggedAt: string;
          }
        | null = null;

      if (photoFile) {
        const optimizedPhotoFile = await optimizeMealPhotoFile(photoFile);
        const loggedAt = new Date().toISOString();
        const photoDay = getLocalDateString(new Date(loggedAt));
        const photoTimestamp = loggedAt.replace(/\D/g, "");
        const path = `${tenant.id}/${selectedPatient.id}/meal-photos/${photoDay}/${photoTimestamp}-${safeFileName(optimizedPhotoFile.name)}`;
        const { error: uploadError } = await supabase.storage
          .from("nutrios-private")
          .upload(path, optimizedPhotoFile, {
            upsert: false,
            contentType: optimizedPhotoFile.type || undefined,
          });

        if (uploadError) {
          onNotice(uploadError.message);
          return;
        }

        mealPhoto = {
          storagePath: path,
          mealType: trackingDraft.mealType,
          notes: trackingDraft.mealNotes,
          loggedAt,
        };
      }

      const { error } = await postTrackingLogs(supabase, {
        tenantId: tenant.id,
        patientId: selectedPatient.id,
        weightKg: trackingDraft.weight ? Number(trackingDraft.weight) : null,
        waistCm: trackingDraft.waist ? Number(trackingDraft.waist) : null,
        steps: trackingDraft.steps ? Number(trackingDraft.steps) : null,
        exercise: trackingDraft.exercise.trim() || null,
        durationMinutes: durationSeconds != null ? Math.round(durationSeconds / 60) : null,
        durationSeconds,
        distanceKm,
        customGoalLogs,
        mealPhoto,
      });

      if (error) {
        onNotice(error);
        return;
      }

      clearTrackingDraft();
      clearCustomGoalDrafts();
      setPhotoFile(null);
      if (galleryInputRef.current) galleryInputRef.current.value = "";
      if (cameraInputRef.current) cameraInputRef.current.value = "";
      onNotice("Registro actualizado.");
      await onReload();
    } finally {
      setSavingTracking(false);
    }
  }

  function updateTrackingDraft(key: keyof typeof emptyTrackingDraft, value: string) {
    setTrackingDraft((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function updateCustomGoalDraft(goalId: string, value: string) {
    setCustomGoalDrafts((current) => ({
      ...current,
      [goalId]: value,
    }));
  }

  return (
    <Panel className="mx-auto max-w-2xl">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-black">Registro de datos</h2>
        <Footprints className="size-5 text-[var(--tenant-color)]" />
      </div>
      {!selectedPatient ? (
        <div className="mt-5">
          <EmptyState text="No hay ficha de cliente seleccionada." />
        </div>
      ) : (
        <form className="mt-5 space-y-4" onSubmit={saveTracking}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Peso kg"
              type="number"
              value={trackingDraft.weight}
              onChange={(value) => updateTrackingDraft("weight", value)}
              step="0.1"
            />
            <Field
              label="Cintura cm"
              type="number"
              value={trackingDraft.waist}
              onChange={(value) => updateTrackingDraft("waist", value)}
              step="0.1"
            />
          </div>
          <Field
            label="Pasos de hoy"
            type="number"
            value={trackingDraft.steps}
            onChange={(value) => updateTrackingDraft("steps", value)}
            step="1"
          />
          <div className="grid gap-3 sm:grid-cols-3">
            <SelectField
              label="Ejercicio realizado"
              value={trackingDraft.exercise}
              onChange={(value) => updateTrackingDraft("exercise", value)}
              options={activityOptions}
            />
            <div>
              <span className="mb-1 block text-sm font-semibold text-[#39433f]">
                Tiempo de actividad
              </span>
              <button
                type="button"
                className="flex h-11 w-full items-center justify-between gap-2 rounded-lg border border-[var(--line)] bg-white px-3 text-left text-sm font-semibold text-[#27312d] transition hover:border-[var(--tenant-color)]"
                onClick={() => setDurationPickerOpen(true)}
              >
                <span>{formatDurationSeconds(Number(trackingDraft.durationSeconds || 0))}</span>
                <Clock className="size-4 text-[var(--tenant-color)]" />
              </button>
            </div>
            <div>
              <span className="mb-1 block text-sm font-semibold text-[#39433f]">
                Distancia
              </span>
              <button
                type="button"
                className="flex h-11 w-full items-center justify-between gap-2 rounded-lg border border-[var(--line)] bg-white px-3 text-left text-sm font-semibold text-[#27312d] transition hover:border-[var(--tenant-color)]"
                onClick={() => setDistancePickerOpen(true)}
              >
                <span>{formatDistanceForInput(Number(trackingDraft.distanceKm || 0))}</span>
                <MapPin className="size-4 text-[var(--tenant-color)]" />
              </button>
            </div>
          </div>
          {durationPickerOpen && (
            <DurationPickerDialog
              value={trackingDraft.durationSeconds}
              onCancel={() => setDurationPickerOpen(false)}
              onDone={(totalSeconds) => {
                updateTrackingDraft("durationSeconds", totalSeconds ? String(totalSeconds) : "");
                setDurationPickerOpen(false);
              }}
            />
          )}
          {distancePickerOpen && (
            <DistancePickerDialog
              valueKm={trackingDraft.distanceKm}
              onCancel={() => setDistancePickerOpen(false)}
              onDone={(totalMeters) => {
                updateTrackingDraft(
                  "distanceKm",
                  totalMeters ? formatDistanceKmForStorage(totalMeters) : "",
                );
                setDistancePickerOpen(false);
              }}
            />
          )}
          <SelectField
            label="Comida fotografiada"
            value={trackingDraft.mealType}
            onChange={(value) => updateTrackingDraft("mealType", value)}
            options={mealPhotoTypes.map((label) => ({
              value: label,
              label,
            }))}
          />
          <TextArea
            label="Notas de comida"
            value={trackingDraft.mealNotes}
            onChange={(value) => updateTrackingDraft("mealNotes", value)}
          />
          {activeCustomGoals.length > 0 && (
            <div className="rounded-lg border border-[var(--line)] bg-[#fbfaf6] p-3">
              <p className="text-sm font-black">Objetivos personalizados</p>
              <div className="mt-3 grid gap-3">
                {activeCustomGoals.map((goal) => {
                  const todayLog = getTodayGoalLog(goal, goalLogs);
                  const inputType = getCustomGoalInputType(goal);
                  const draftValue = customGoalDrafts[goal.id] ?? "";

                  return (
                    <div
                      key={goal.id}
                      className="rounded-lg border border-[var(--line)] bg-white p-3"
                    >
                      <div className="mb-3 min-w-0">
                        <p className="break-words text-sm font-black">{goal.title}</p>
                        <p className="mt-1 text-xs font-semibold text-[var(--muted)]">
                          {formatCustomGoalDefinition(goal)}
                        </p>
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          Hoy: {formatCustomGoalLog(todayLog, goal)}
                        </p>
                      </div>
                      {inputType === "check" ? (
                        <SelectField
                          label="Registro de hoy"
                          value={draftValue}
                          onChange={(value) => updateCustomGoalDraft(goal.id, value)}
                          options={checkGoalStatusOptions}
                        />
                      ) : (
                        <Field
                          label={getCustomGoalInputLabel(goal)}
                          type="number"
                          value={draftValue}
                          onChange={(value) => updateCustomGoalDraft(goal.id, value)}
                          step={inputType === "minutes" ? "1" : "0.1"}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <div>
            <span className="mb-1 block text-sm font-semibold text-[#39433f]">Foto</span>
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-[var(--line)] bg-white px-4 text-sm font-semibold text-[#39433f] transition hover:border-[var(--tenant-color)] disabled:opacity-60"
                onClick={() => galleryInputRef.current?.click()}
                disabled={savingTracking}
              >
                <ImagePlus className="size-4 text-[var(--tenant-color)]" />
                Elegir foto
              </button>
              <button
                type="button"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-[var(--line)] bg-white px-4 text-sm font-semibold text-[#39433f] transition hover:border-[var(--tenant-color)] disabled:opacity-60"
                onClick={() => cameraInputRef.current?.click()}
                disabled={savingTracking}
              >
                <Camera className="size-4 text-[var(--tenant-color)]" />
                Abrir camara
              </button>
            </div>
            <input
              ref={galleryInputRef}
              className="sr-only"
              type="file"
              accept="image/*"
              onChange={(event) => setPhotoFile(event.target.files?.[0] ?? null)}
            />
            <input
              ref={cameraInputRef}
              className="sr-only"
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(event) => setPhotoFile(event.target.files?.[0] ?? null)}
            />
            <p className="mt-2 truncate text-xs font-semibold text-[var(--muted)]">
              {photoFile
                ? `${photoFile.name} (${formatFileSize(photoFile.size)}). Se optimizará antes de subirla.`
                : "Sin foto seleccionada."}
            </p>
          </div>
          <button
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[var(--tenant-color)] px-4 text-sm font-black text-white disabled:opacity-60"
            disabled={savingTracking}
          >
            {savingTracking ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ImagePlus className="size-4" />
            )}
            {savingTracking ? "Guardando..." : "Guardar registro"}
          </button>
        </form>
      )}
    </Panel>
  );
}

function DurationPickerDialog({
  value,
  onCancel,
  onDone,
}: {
  value: string;
  onCancel: () => void;
  onDone: (totalSeconds: number) => void;
}) {
  const initialSeconds = Math.max(0, Math.trunc(Number(value || 0) || 0));
  const [hours, setHours] = useState(() => Math.floor(initialSeconds / 3600));
  const [minutes, setMinutes] = useState(() =>
    Math.floor((initialSeconds % 3600) / 60),
  );
  const [seconds, setSeconds] = useState(() => initialSeconds % 60);

  const totalSeconds = hours * 3600 + minutes * 60 + seconds;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#121715]/45 px-4 py-6">
      <div
        className="w-full max-w-md rounded-lg border border-[var(--line)] bg-[#f7f5ef] p-4 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="Elegir tiempo de actividad"
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold uppercase text-[var(--tenant-color)]">
              Duración
            </p>
            <p className="mt-1 text-3xl font-black">
              {formatDurationSeconds(totalSeconds)}
            </p>
          </div>
          <button
            type="button"
            className="grid size-9 place-items-center rounded-lg border border-[var(--line)] bg-white text-[#39433f]"
            onClick={onCancel}
            aria-label="Cerrar"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-3">
          <DurationPartInput
            label="Horas"
            value={hours}
            max={24}
            onChange={setHours}
          />
          <DurationPartInput
            label="Minutos"
            value={minutes}
            max={59}
            onChange={setMinutes}
          />
          <DurationPartInput
            label="Segundos"
            value={seconds}
            max={59}
            onChange={setSeconds}
          />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-[var(--line)] bg-white px-4 text-sm font-black text-[#39433f]"
            onClick={onCancel}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-[var(--tenant-color)] px-4 text-sm font-black text-white"
            onClick={() => onDone(totalSeconds)}
          >
            Hecho
          </button>
        </div>
      </div>
    </div>
  );
}

function DurationPartInput({
  label,
  value,
  max,
  onChange,
}: {
  label: string;
  value: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-center text-xs font-black uppercase text-[var(--muted)]">
        {label}
      </span>
      <input
        className="h-16 w-full rounded-lg border border-[var(--line)] bg-white text-center text-2xl font-black text-[#27312d]"
        type="number"
        min="0"
        max={max}
        value={value}
        onChange={(event) =>
          onChange(clampDurationPart(event.target.value, max))
        }
      />
    </label>
  );
}

function DistancePickerDialog({
  valueKm,
  onCancel,
  onDone,
}: {
  valueKm: string;
  onCancel: () => void;
  onDone: (totalMeters: number) => void;
}) {
  const initialMeters = Math.max(0, Math.round((Number(valueKm || 0) || 0) * 1000));
  const [kilometers, setKilometers] = useState(() => Math.floor(initialMeters / 1000));
  const [meters, setMeters] = useState(() => initialMeters % 1000);
  const totalMeters = kilometers * 1000 + meters;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#121715]/45 px-4 py-6">
      <div
        className="w-full max-w-md rounded-lg border border-[var(--line)] bg-[#f7f5ef] p-4 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="Elegir distancia de actividad"
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold uppercase text-[var(--tenant-color)]">
              Distancia
            </p>
            <p className="mt-1 text-3xl font-black">
              {formatDistanceForInput(totalMeters / 1000)}
            </p>
          </div>
          <button
            type="button"
            className="grid size-9 place-items-center rounded-lg border border-[var(--line)] bg-white text-[#39433f]"
            onClick={onCancel}
            aria-label="Cerrar"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <DistancePartInput
            label="Kilómetros"
            value={kilometers}
            max={1000}
            onChange={setKilometers}
          />
          <DistancePartInput
            label="Metros"
            value={meters}
            max={999}
            onChange={setMeters}
          />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-[var(--line)] bg-white px-4 text-sm font-black text-[#39433f]"
            onClick={onCancel}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-[var(--tenant-color)] px-4 text-sm font-black text-white"
            onClick={() => onDone(totalMeters)}
          >
            Hecho
          </button>
        </div>
      </div>
    </div>
  );
}

function DistancePartInput({
  label,
  value,
  max,
  onChange,
}: {
  label: string;
  value: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-center text-xs font-black uppercase text-[var(--muted)]">
        {label}
      </span>
      <input
        className="h-16 w-full rounded-lg border border-[var(--line)] bg-white text-center text-2xl font-black text-[#27312d]"
        type="number"
        min="0"
        max={max}
        value={value}
        onChange={(event) =>
          onChange(clampDurationPart(event.target.value, max))
        }
      />
    </label>
  );
}

function ActivitiesPanel({
  selectedPatient,
  exercises,
}: {
  selectedPatient: Patient | null;
  exercises: ExerciseLog[];
}) {
  const currentWeekStart = getMondayDateKey(getLocalDateString());
  const [selectedWeekStart, setSelectedWeekStart] = useState(currentWeekStart);

  const weekKeys = useMemo(
    () => buildActivityWeekKeys(exercises, currentWeekStart),
    [currentWeekStart, exercises],
  );
  const selectedSummary = useMemo(
    () => buildActivityWeekSummary(exercises, selectedWeekStart),
    [exercises, selectedWeekStart],
  );
  const previousSummary = useMemo(
    () => buildActivityWeekSummary(exercises, addDaysToDateKey(selectedWeekStart, -7)),
    [exercises, selectedWeekStart],
  );
  const fourWeekAverage = useMemo(
    () => buildPreviousActivityWeekAverage(exercises, selectedWeekStart, 4),
    [exercises, selectedWeekStart],
  );
  const nextWeekStart = addDaysToDateKey(selectedWeekStart, 7);
  const previousWeekStart = addDaysToDateKey(selectedWeekStart, -7);
  const canMoveNext = nextWeekStart <= currentWeekStart;
  const activitySummaryMetrics = [
    {
      label: "Duración",
      value: formatDurationSeconds(selectedSummary.durationSeconds),
      comparison: formatActivityComparison(
        selectedSummary.durationSeconds,
        previousSummary.durationSeconds,
        "semana anterior",
      ),
      average: formatActivityComparison(
        selectedSummary.durationSeconds,
        fourWeekAverage.durationSeconds,
        "media 4 semanas",
      ),
      icon: Clock,
    },
    {
      label: "Actividades",
      value: `${selectedSummary.activityCount}`,
      comparison: formatActivityComparison(
        selectedSummary.activityCount,
        previousSummary.activityCount,
        "semana anterior",
      ),
      average: formatActivityComparison(
        selectedSummary.activityCount,
        fourWeekAverage.activityCount,
        "media 4 semanas",
      ),
      icon: Dumbbell,
    },
    {
      label: "Distancia",
      value: formatActivityDistance(selectedSummary.distanceKm),
      comparison: formatActivityComparison(
        selectedSummary.distanceKm,
        previousSummary.distanceKm,
        "semana anterior",
      ),
      average: formatActivityComparison(
        selectedSummary.distanceKm,
        fourWeekAverage.distanceKm,
        "media 4 semanas",
      ),
      icon: MapPin,
    },
  ];

  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-black">Actividades</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Resumen semanal e histórico de ejercicio registrado.
          </p>
        </div>
        <Dumbbell className="size-5 text-[var(--tenant-color)]" />
      </div>
      {!selectedPatient ? (
        <div className="mt-5">
          <EmptyState text="No hay ficha de cliente seleccionada." />
        </div>
      ) : (
        <div className="mt-5 space-y-5">
          <ActivityWeekChart
            title="Instantánea semanal"
            summary={selectedSummary}
            metrics={activitySummaryMetrics}
            onPreviousWeek={() => setSelectedWeekStart(previousWeekStart)}
            onNextWeek={() => setSelectedWeekStart(nextWeekStart)}
            canMoveNext={canMoveNext}
            emptyText="Sin actividades en esta semana."
          />

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div>
              <p className="mb-2 text-sm font-black">Actividades por día</p>
              <div className="grid gap-2">
                {selectedSummary.days.map((day) => (
                  <details
                    key={day.dateKey}
                    className="group rounded-lg border border-[var(--line)] bg-[#fbfaf6] p-3"
                    open={day.logs.length > 0}
                  >
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
                      <div className="flex min-w-0 items-center gap-2">
                        <ChevronRight className="size-4 shrink-0 text-[var(--muted)] transition group-open:rotate-90" />
                        <span className="truncate text-sm font-black">
                          {day.label} · {formatDate(`${day.dateKey}T12:00:00`)}
                        </span>
                      </div>
                      <span className="shrink-0 rounded-md bg-white px-2 py-1 text-xs font-bold text-[var(--muted)]">
                        {day.logs.length} act.
                      </span>
                    </summary>
                    <div className="mt-3 grid gap-2">
                      {day.logs.map((log) => (
                        <div
                          key={log.id}
                          className="grid gap-2 rounded-lg bg-white p-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto]"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-black">{log.activity}</p>
                            <p className="mt-1 text-xs text-[var(--muted)]">
                              {formatPhotoTime(log.logged_at)}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2 sm:justify-end">
                            <span className="rounded-md bg-[#f6f3eb] px-2 py-1 font-bold">
                              {formatDurationSeconds(getExerciseDurationSeconds(log))}
                            </span>
                            <span className="rounded-md bg-[#f6f3eb] px-2 py-1 font-bold">
                              {formatActivityDistance(getExerciseDistanceKm(log))}
                            </span>
                          </div>
                        </div>
                      ))}
                      {day.logs.length === 0 && <EmptyState text="Sin actividades." />}
                    </div>
                  </details>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-black">Histórico de semanas</p>
              <div className="grid max-h-[520px] gap-2 overflow-y-auto pr-1">
                {weekKeys.map((weekKey) => {
                  const summary = buildActivityWeekSummary(exercises, weekKey);
                  const active = weekKey === selectedWeekStart;

                  return (
                    <button
                      key={weekKey}
                      type="button"
                      className={`rounded-lg border p-3 text-left transition ${
                        active
                          ? "border-[var(--tenant-color)] bg-[#eef8f0]"
                          : "border-[var(--line)] bg-white hover:border-[var(--tenant-color)]"
                      }`}
                      onClick={() => setSelectedWeekStart(weekKey)}
                    >
                      <p className="text-sm font-black">{formatActivityWeekTitle(summary)}</p>
                      <p className="mt-1 text-xs font-semibold text-[var(--muted)]">
                        {formatDurationSeconds(summary.durationSeconds)} ·{" "}
                        {summary.activityCount} actividades ·{" "}
                        {formatActivityDistance(summary.distanceKm)}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </Panel>
  );
}

function ActivitySummaryMetric({
  label,
  value,
  comparison,
  average,
  icon: Icon,
}: {
  label: string;
  value: string;
  comparison: string;
  average: string;
  icon: typeof Users;
}) {
  return (
    <div className="rounded-lg bg-[#f6f3eb] p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-[var(--muted)]">{label}</p>
          <p className="mt-1 text-xl font-black">{value}</p>
        </div>
        <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-white text-[var(--tenant-color)]">
          <Icon className="size-4" />
        </div>
      </div>
      <div className="mt-2 grid gap-1 text-[11px] font-semibold text-[var(--muted)]">
        <span>{comparison}</span>
        <span>{average}</span>
      </div>
    </div>
  );
}

function ActivityWeekChart({
  title,
  summary,
  metrics,
  onPreviousWeek,
  onNextWeek,
  canMoveNext = false,
  emptyText,
}: {
  title: string;
  summary: ActivityWeekSummary;
  metrics?: Array<{
    label: string;
    value: string;
    comparison: string;
    average: string;
    icon: typeof Users;
  }>;
  onPreviousWeek?: () => void;
  onNextWeek?: () => void;
  canMoveNext?: boolean;
  emptyText: string;
}) {
  const data = summary.days.map((day) => ({
    day: day.shortLabel,
    horas: roundNumber(day.durationSeconds / 3600, 2) ?? 0,
    actividades: day.logs.length,
  }));
  const hasData = summary.activityCount > 0;

  return (
    <div className="rounded-lg border border-[var(--line)] bg-white p-3">
      <div className="mb-3 grid grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center gap-2">
        {onPreviousWeek ? (
          <button
            type="button"
            className="grid size-11 place-items-center rounded-lg border border-[var(--line)] bg-[#f7f5ef] text-[#39433f] transition hover:border-[var(--tenant-color)]"
            onClick={onPreviousWeek}
            aria-label="Ver semana anterior"
            title="Semana anterior"
          >
            <ChevronLeft className="size-5" />
          </button>
        ) : (
          <span />
        )}
        <div className="min-w-0 text-center">
          <p className="truncate text-sm font-black">{title}</p>
          <p className="truncate text-xs font-semibold text-[var(--muted)]">
            {formatActivityWeekTitle(summary)}
          </p>
        </div>
        {onNextWeek ? (
          <button
            type="button"
            className="grid size-11 place-items-center rounded-lg border border-[var(--line)] bg-[#f7f5ef] text-[#39433f] transition hover:border-[var(--tenant-color)] disabled:cursor-not-allowed disabled:opacity-45"
            onClick={onNextWeek}
            disabled={!canMoveNext}
            aria-label="Ver semana siguiente"
            title="Semana siguiente"
          >
            <ChevronRight className="size-5" />
          </button>
        ) : (
          <span />
        )}
      </div>
      {metrics?.length ? (
        <div className="mb-4 grid gap-2 sm:grid-cols-3">
          {metrics.map((metric) => (
            <ActivitySummaryMetric key={metric.label} {...metric} />
          ))}
        </div>
      ) : null}
      {!hasData ? (
        <div className="grid h-64 place-items-center sm:h-72">
          <EmptyState text={emptyText} />
        </div>
      ) : (
        <div className="h-64 sm:h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5dfd3" />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis
                tick={{ fontSize: 12 }}
                allowDecimals
                tickFormatter={(value) => `${formatOptionalNumber(Number(value), 1)} h`}
              />
              <Tooltip
                formatter={(value, name) =>
                  name === "horas"
                    ? [`${formatOptionalNumber(Number(value), 2)} h`, "Duración"]
                    : [formatInteger(Number(value)), "Actividades"]
                }
              />
              <Bar
                dataKey="horas"
                name="Duración"
                fill={APP_PRIMARY_COLOR}
                radius={[6, 6, 0, 0]}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function StatsPanel({
  selectedPatient,
  weights,
  waists,
  steps,
  goals,
  exercises,
  mealPhotos,
  supabase,
  onNotice,
  onReload,
}: {
  selectedPatient: Patient | null;
  weights: WeightLog[];
  waists: WaistLog[];
  steps: StepLog[];
  goals: PatientGoal[];
  exercises: ExerciseLog[];
  mealPhotos: MealPhoto[];
  supabase: ReturnType<typeof createSupabaseBrowser>;
  onNotice: (message: string) => void;
  onReload: () => Promise<void>;
}) {
  const latestWeight =
    weights
      .slice()
      .sort((a, b) => new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime())[0]
      ?.weight_kg ?? selectedPatient?.current_weight_kg ?? null;
  const latestWaist =
    waists
      .slice()
      .sort((a, b) => new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime())[0]
      ?.waist_cm ?? selectedPatient?.waist_cm ?? null;
  const currentBmi = selectedPatient
    ? calculateBmi(latestWeight, selectedPatient.height_cm)
    : null;
  const initialBmi = selectedPatient
    ? calculateBmi(selectedPatient.initial_weight_kg, selectedPatient.height_cm)
    : null;
  const stepGoalTarget =
    goals.find((goal) => goal.goal_type === "steps_daily" && goal.is_active)
      ?.target_value ?? null;
  const weightChartData = buildWeightChartData(weights);
  const waistChartData = buildWaistChartData(waists);
  const stepChartData = buildStepChartData(steps);
  const bmiChartData = selectedPatient
    ? buildBmiChartData(weights, selectedPatient.height_cm)
    : [];
  const currentActivityWeekSummary = buildActivityWeekSummary(
    exercises,
    getMondayDateKey(getLocalDateString()),
  );

  async function deleteMealPhoto(photo: MealPhoto) {
    if (!supabase) {
      onNotice("Modo demo: conecta Supabase para borrar fotos reales.");
      return;
    }

    const accessToken = await getCurrentAccessToken(supabase);
    if (!accessToken) {
      onNotice("Tu sesion ha caducado. Cierra sesion y vuelve a entrar.");
      return;
    }

    const response = await fetch("/api/meal-photos/delete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ photoId: photo.id }),
    });
    const payload = (await response.json()) as DeleteMealPhotoResponse;

    if (!response.ok || payload.error) {
      onNotice(payload.error ?? "No se pudo borrar la foto.");
      return;
    }

    onNotice(payload.warning ?? "Foto eliminada.");
    await onReload();
  }

  return (
    <Panel>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-black">Estadísticas</h2>
        <Activity className="size-5 text-[var(--tenant-color)]" />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Peso actual" value={latestWeight ? `${latestWeight} kg` : "-"} />
        <Metric label="Cintura actual" value={latestWaist ? `${latestWaist} cm` : "-"} />
        <Metric label="IMC inicial" value={formatOptionalNumber(initialBmi, 1)} />
        <Metric label="IMC actual" value={formatOptionalNumber(currentBmi, 1)} />
      </div>
      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <EvolutionChart
          title="Peso"
          data={weightChartData}
          dataKey="peso"
          color={APP_PRIMARY_COLOR}
          emptyText="Sin registros de peso."
        />
        <EvolutionChart
          title="Cintura"
          data={waistChartData}
          dataKey="cintura"
          color="#4d6fa9"
          emptyText="Sin registros de cintura."
        />
        <StepEvolutionChart
          title="Pasos"
          data={stepChartData}
          goalTarget={stepGoalTarget}
          emptyText="Sin registros de pasos."
        />
        <EvolutionChart
          title="IMC"
          data={bmiChartData}
          dataKey="imc"
          color="#b46a4d"
          emptyText="Sin registros de peso para calcular IMC."
        />
        <ActivityWeekChart
          title="Actividades esta semana"
          summary={currentActivityWeekSummary}
          emptyText="Sin actividades esta semana."
        />
      </div>
      <div className="mt-5">
        <PhotoList photos={mealPhotos} onDeletePhoto={deleteMealPhoto} />
      </div>
    </Panel>
  );
}

function EvolutionChart({
  title,
  data,
  dataKey,
  color,
  emptyText,
}: {
  title: string;
  data: Array<Record<string, number | string | undefined> & { date: string }>;
  dataKey: string;
  color: string;
  emptyText: string;
}) {
  const domain = getChartDomain(data, dataKey, getMinimumChartSpan(dataKey));

  return (
    <div className="rounded-lg border border-[var(--line)] bg-white p-3">
      <p className="mb-3 text-sm font-black">{title}</p>
      {data.length === 0 ? (
        <div className="grid h-64 place-items-center sm:h-72">
          <EmptyState text={emptyText} />
        </div>
      ) : (
        <div className="h-64 sm:h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5dfd3" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} domain={domain} />
              <Tooltip formatter={formatChartTooltipValue} />
              <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={3} dot />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function ChatPanel({
  tenant,
  selectedPatient,
  conversation,
  messages,
  currentUserId,
  supabase,
  onNotice,
  onMessageSent,
  onConversationReady,
  onMessagesRead,
}: {
  tenant: Tenant;
  selectedPatient: Patient | null;
  conversation: Conversation | null;
  messages: ChatMessage[];
  currentUserId: string;
  supabase: ReturnType<typeof createSupabaseBrowser>;
  onNotice: (message: string) => void;
  onMessageSent: (message: ChatMessage) => void;
  onConversationReady: (conversation: Conversation) => void;
  onMessagesRead: (messageIds: string[], readAt: string) => void;
}) {
  const [body, setBody] = useState("");

  useEffect(() => {
    if (!supabase || !selectedPatient || !conversation) return;

    const unreadIncomingMessages = messages.filter(
      (message) => message.sender_id !== currentUserId && !message.read_at,
    );
    if (unreadIncomingMessages.length === 0) return;

    let cancelled = false;

    async function markChatRead() {
      const accessToken = await getCurrentAccessToken(supabase);
      if (!accessToken || cancelled) return;

      const response = await fetch("/api/chat/read", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          tenantId: tenant.id,
          patientId: selectedPatient.id,
          conversationId: conversation.id,
        }),
      });
      const payload = (await response.json()) as MarkChatReadResponse;
      if (!response.ok || !payload.readAt || !payload.messageIds?.length || cancelled) return;

      onMessagesRead(payload.messageIds, payload.readAt);
    }

    void markChatRead();

    return () => {
      cancelled = true;
    };
  }, [
    conversation,
    currentUserId,
    messages,
    onMessagesRead,
    selectedPatient,
    supabase,
    tenant.id,
  ]);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedPatient || !body.trim()) return;
    if (!supabase) {
      onNotice("Modo demo: conecta Supabase para usar el chat real.");
      return;
    }

    const accessToken = await getCurrentAccessToken(supabase);
    if (!accessToken) {
      onNotice("Tu sesion ha caducado. Cierra sesion y vuelve a entrar.");
      return;
    }

    const response = await fetch("/api/chat/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        tenantId: tenant.id,
        patientId: selectedPatient.id,
        body,
      }),
    });

    const payload = (await response.json()) as SendChatMessageResponse;

    if (!response.ok || !payload.message || !payload.conversation) {
      onNotice(payload.error ?? "No se pudo enviar el mensaje.");
      return;
    }

    onConversationReady(payload.conversation);
    onMessageSent(payload.message);
    setBody("");
  }

  return (
    <Panel>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-black">Chat</h2>
        <MessageCircle className="size-5 text-[var(--tenant-color)]" />
      </div>
      <div className="mt-5 grid max-h-[55vh] gap-3 overflow-y-auto rounded-lg border border-[var(--line)] bg-white p-4 scrollbar-thin">
        {messages.map((message) => {
          const mine = message.sender_id === currentUserId;
          return (
            <div
              key={message.id}
              className={`max-w-[82%] rounded-lg px-3 py-2 text-sm ${
                mine
                  ? "ml-auto bg-[var(--tenant-color)] text-white"
                  : "bg-[#f0eee7] text-[#27312d]"
              }`}
            >
              <p>{message.body}</p>
              <p className={`mt-1 text-xs ${mine ? "text-white/75" : "text-[var(--muted)]"}`}>
                {formatDateTime(message.created_at)}
              </p>
            </div>
          );
        })}
        {messages.length === 0 && <EmptyState text="No hay mensajes todavia." />}
      </div>
      <form className="mt-4 flex gap-2" onSubmit={sendMessage}>
        <input
          className="h-11 min-w-0 flex-1 rounded-lg border border-[var(--line)] bg-white px-3 text-sm"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Escribe un mensaje"
        />
        <button className="grid size-11 place-items-center rounded-lg bg-[var(--tenant-color)] text-white">
          <Send className="size-4" />
        </button>
      </form>
    </Panel>
  );
}

function StepEvolutionChart({
  title,
  data,
  goalTarget,
  emptyText,
}: {
  title: string;
  data: Array<{ date: string; pasos: number; mediaSemanal: number }>;
  goalTarget: number | null;
  emptyText: string;
}) {
  const domain = getStepChartDomain(data, goalTarget);

  return (
    <div className="rounded-lg border border-[var(--line)] bg-white p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-black">{title}</p>
        <div className="flex flex-wrap gap-2 text-[11px] font-bold text-[var(--muted)]">
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-sm bg-[#7b7f3b]" />
            Diario
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-0.5 w-4 bg-[#4b9f51]" />
            Media semanal
          </span>
          {goalTarget ? (
            <span className="inline-flex items-center gap-1">
              <span className="h-0.5 w-4 border-t-2 border-dashed border-[#b46a4d]" />
              Objetivo
            </span>
          ) : null}
        </div>
      </div>
      {data.length === 0 ? (
        <div className="grid h-64 place-items-center sm:h-72">
          <EmptyState text={emptyText} />
        </div>
      ) : (
        <div className="h-64 sm:h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5dfd3" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis
                tick={{ fontSize: 12 }}
                domain={domain}
                allowDecimals={false}
                tickFormatter={(value) => formatInteger(value)}
              />
              <Tooltip formatter={formatChartTooltipValue} />
              <Bar
                dataKey="pasos"
                name="Pasos diarios"
                fill="#7b7f3b"
                radius={[6, 6, 0, 0]}
              />
              <Line
                type="monotone"
                dataKey="mediaSemanal"
                name="Media semanal"
                stroke="#4b9f51"
                strokeWidth={3}
                dot={false}
              />
              {goalTarget ? (
                <ReferenceLine
                  y={goalTarget}
                  stroke="#b46a4d"
                  strokeDasharray="6 4"
                  label={{
                    value: `Objetivo ${formatInteger(goalTarget)}`,
                    position: "insideTopRight",
                    fill: "#8d3c2f",
                    fontSize: 11,
                    fontWeight: 800,
                  }}
                />
              ) : null}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function AgendaPanel({
  tenant,
  role,
  patients,
  selectedPatient,
  availabilitySlots,
  calendarEvents,
  calendarBusySlots,
  supabase,
  onNotice,
  onReload,
}: {
  tenant: Tenant;
  role: UserRole | null;
  patients: Patient[];
  selectedPatient: Patient | null;
  availabilitySlots: AppointmentAvailability[];
  calendarEvents: CalendarEvent[];
  calendarBusySlots: CalendarBusySlot[];
  supabase: ReturnType<typeof createSupabaseBrowser>;
  onNotice: (message: string) => void;
  onReload: () => Promise<void>;
}) {
  const activePatients = patients.filter(isActivePatient);

  if (role === "patient") {
    return (
      <PatientAgendaPanel
        tenant={tenant}
        selectedPatient={selectedPatient}
        availabilitySlots={availabilitySlots}
        calendarEvents={calendarEvents}
        calendarBusySlots={calendarBusySlots}
        supabase={supabase}
        onNotice={onNotice}
        onReload={onReload}
      />
    );
  }

  return (
    <NutritionistAgendaPanel
      tenant={tenant}
      patients={activePatients}
      selectedPatient={selectedPatient}
      availabilitySlots={availabilitySlots}
      calendarEvents={calendarEvents}
      calendarBusySlots={calendarBusySlots}
      supabase={supabase}
      onNotice={onNotice}
      onReload={onReload}
    />
  );
}

function PatientAgendaPanel({
  tenant,
  selectedPatient,
  availabilitySlots,
  calendarEvents,
  calendarBusySlots,
  supabase,
  onNotice,
  onReload,
}: {
  tenant: Tenant;
  selectedPatient: Patient | null;
  availabilitySlots: AppointmentAvailability[];
  calendarEvents: CalendarEvent[];
  calendarBusySlots: CalendarBusySlot[];
  supabase: ReturnType<typeof createSupabaseBrowser>;
  onNotice: (message: string) => void;
  onReload: () => Promise<void>;
}) {
  const [showBooking, setShowBooking] = useState(false);
  const [selectedBookingDate, setSelectedBookingDate] = useState(getLocalDateString());
  const [appointmentMode, setAppointmentMode] = useState<AppointmentMode>("online");
  const [bookingSlotId, setBookingSlotId] = useState("");
  const patientEvents = calendarEvents
    .filter((event) => event.patient_id === selectedPatient?.id)
    .sort(compareCalendarEvents);
  const availableSlots = useMemo(
    () => buildAvailableAppointmentSlots(availabilitySlots, calendarBusySlots, 28),
    [availabilitySlots, calendarBusySlots],
  );
  const selectedDaySlots = availableSlots.filter(
    (slot) => slot.dateKey === selectedBookingDate,
  );

  async function bookAppointment(slot: AvailableAppointmentSlot) {
    if (!selectedPatient) {
      onNotice("No hay cliente seleccionado para agendar la cita.");
      return;
    }

    if (!supabase) {
      onNotice("Modo demo: conecta Supabase para agendar citas reales.");
      return;
    }

    setBookingSlotId(slot.id);
    const row = {
      tenant_id: tenant.id,
      patient_id: selectedPatient.id,
      title: "Cita con nutricionista",
      event_type: "appointment",
      appointment_mode: appointmentMode,
      blocks_availability: true,
      start_at: slot.startAt,
      end_at: slot.endAt,
      status: "pending",
    } satisfies Omit<CalendarEvent, "id" | "created_by" | "created_at" | "updated_at">;
    const { error } = await postCalendarEventMutation(supabase, {
      action: "create",
      row,
    });
    setBookingSlotId("");

    if (error) {
      onNotice(error);
      return;
    }

    setShowBooking(false);
    setSelectedBookingDate(slot.dateKey);
    onNotice("Solicitud de cita enviada. Queda pendiente de confirmar.");
    await onReload();
  }

  return (
    <div className="grid gap-5">
      <Panel>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-black">Citas</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Agenda una cita con tu nutricionista y revisa tus proximas sesiones.
            </p>
          </div>
          <button
            type="button"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[var(--tenant-color)] px-4 text-sm font-black text-white"
            onClick={() => {
              if (!showBooking && availableSlots[0]) {
                setSelectedBookingDate(availableSlots[0].dateKey);
              }
              setShowBooking((current) => !current);
            }}
          >
            <CalendarDays className="size-4" />
            Agendar cita
          </button>
        </div>

        {showBooking && (
          <div className="mt-5 rounded-lg border border-[var(--line)] bg-white p-3 sm:p-4">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
              <BookingCalendar
                availableSlots={availableSlots}
                selectedDate={selectedBookingDate}
                onSelectDate={setSelectedBookingDate}
              />
              <div className="rounded-lg border border-[var(--line)] bg-[#fbfaf6] p-3">
                <SelectField
                  label="Tipo de cita"
                  value={appointmentMode}
                  onChange={(value) => setAppointmentMode(value as AppointmentMode)}
                  options={appointmentModeOptions}
                />
                <div className="mt-4">
                  <p className="text-sm font-black text-[#24342f]">
                    {formatBookingDateLabel(selectedBookingDate)}
                  </p>
                  <div className="mt-3 grid gap-2">
                    {selectedDaySlots.map((slot) => (
                      <button
                        key={slot.id}
                        type="button"
                        className="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-left text-sm transition hover:border-[var(--tenant-color)] disabled:opacity-60"
                        onClick={() => bookAppointment(slot)}
                        disabled={bookingSlotId === slot.id}
                      >
                        <span className="font-black text-[#24342f]">
                          {formatAgendaTimeRange(slot.startAt, slot.endAt)}
                        </span>
                        <ChevronRight className="size-4 shrink-0 text-[var(--tenant-color)]" />
                      </button>
                    ))}
                    {selectedDaySlots.length === 0 && (
                      <EmptyState text="No hay horas disponibles en este dia." />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </Panel>

      <AgendaCalendar
        title="Calendario"
        events={patientEvents}
        patients={selectedPatient ? [selectedPatient] : []}
      />
    </div>
  );
}

function NutritionistAgendaPanel({
  tenant,
  patients,
  selectedPatient,
  availabilitySlots,
  calendarEvents,
  calendarBusySlots,
  supabase,
  onNotice,
  onReload,
}: {
  tenant: Tenant;
  patients: Patient[];
  selectedPatient: Patient | null;
  availabilitySlots: AppointmentAvailability[];
  calendarEvents: CalendarEvent[];
  calendarBusySlots: CalendarBusySlot[];
  supabase: ReturnType<typeof createSupabaseBrowser>;
  onNotice: (message: string) => void;
  onReload: () => Promise<void>;
}) {
  const [availabilityDraft, setAvailabilityDraft] = useState({
    weekday: "1",
    startTime: "09:00",
    endTime: "13:00",
    slotMinutes: "60",
  });
  const [appointmentDraft, setAppointmentDraft] = useState({
    patientId: selectedPatient?.id ?? patients[0]?.id ?? "",
    date: getLocalDateString(),
    startTime: "09:00",
    durationMinutes: "60",
    mode: "online" as AppointmentMode,
    notes: "",
  });
  const [eventDraft, setEventDraft] = useState({
    title: "",
    date: getLocalDateString(),
    startTime: "12:00",
    durationMinutes: "60",
    eventType: "block" as CalendarEventType,
    blocksAvailability: true,
    notes: "",
  });
  const [activeAgendaTool, setActiveAgendaTool] =
    useState<"" | "availability" | "appointment" | "event">("");
  const [savingAgenda, setSavingAgenda] = useState(false);
  const visibleEvents = [...calendarEvents].sort(compareCalendarEvents);
  const pendingAppointments = visibleEvents.filter(
    (event) => isPendingCalendarAppointment(event),
  );
  const appointmentPatientId = appointmentDraft.patientId || patients[0]?.id || "";
  const availableSlots = useMemo(
    () => buildAvailableAppointmentSlots(availabilitySlots, calendarBusySlots, 28),
    [availabilitySlots, calendarBusySlots],
  );

  async function saveAvailability(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) {
      onNotice("Modo demo: conecta Supabase para guardar disponibilidad real.");
      return;
    }

    const slotMinutes = Number(availabilityDraft.slotMinutes);
    if (!slotMinutes || slotMinutes < 15) {
      onNotice("La duracion minima del hueco debe ser de 15 minutos.");
      return;
    }

    setSavingAgenda(true);
    const { error } = await supabase.from("appointment_availability").insert({
      tenant_id: tenant.id,
      weekday: Number(availabilityDraft.weekday),
      start_time: availabilityDraft.startTime,
      end_time: availabilityDraft.endTime,
      slot_minutes: slotMinutes,
      is_active: true,
    });
    setSavingAgenda(false);

    if (error) {
      onNotice(error.message);
      return;
    }

    onNotice("Disponibilidad guardada.");
    await onReload();
  }

  async function deleteAvailability(slot: AppointmentAvailability) {
    if (!supabase) {
      onNotice("Modo demo: conecta Supabase para borrar disponibilidad real.");
      return;
    }

    const { error } = await supabase
      .from("appointment_availability")
      .delete()
      .eq("id", slot.id);

    if (error) {
      onNotice(error.message);
      return;
    }

    onNotice("Disponibilidad eliminada.");
    await onReload();
  }

  async function scheduleAppointment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const patient = patients.find((item) => item.id === appointmentPatientId);
    if (!patient) {
      onNotice("Selecciona un cliente para agendar la cita.");
      return;
    }

    await insertCalendarEvent({
      tenant,
      supabase,
      onNotice,
      onReload,
      setSavingAgenda,
      row: {
        tenant_id: tenant.id,
        patient_id: patient.id,
        title: `Cita con ${patient.full_name}`,
        notes: appointmentDraft.notes || null,
        event_type: "appointment",
        appointment_mode: appointmentDraft.mode,
        blocks_availability: true,
        start_at: buildLocalDateTimeIso(appointmentDraft.date, appointmentDraft.startTime),
        end_at: addMinutesIso(
          buildLocalDateTimeIso(appointmentDraft.date, appointmentDraft.startTime),
          Number(appointmentDraft.durationMinutes) || 60,
        ),
        status: "confirmed",
      },
      successMessage: "Cita agendada.",
    });
  }

  async function saveOtherEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!eventDraft.title.trim()) {
      onNotice("Indica un titulo para el evento.");
      return;
    }

    await insertCalendarEvent({
      tenant,
      supabase,
      onNotice,
      onReload,
      setSavingAgenda,
      row: {
        tenant_id: tenant.id,
        patient_id: null,
        title: eventDraft.title,
        notes: eventDraft.notes || null,
        event_type: eventDraft.eventType,
        appointment_mode: null,
        blocks_availability: eventDraft.blocksAvailability,
        start_at: buildLocalDateTimeIso(eventDraft.date, eventDraft.startTime),
        end_at: addMinutesIso(
          buildLocalDateTimeIso(eventDraft.date, eventDraft.startTime),
          Number(eventDraft.durationMinutes) || 60,
        ),
        status: "confirmed",
      },
      successMessage: "Evento guardado.",
      afterSuccess: () =>
        setEventDraft((current) => ({
          ...current,
          title: "",
          notes: "",
        })),
    });
  }

  async function cancelEvent(event: CalendarEvent) {
    if (!supabase) {
      onNotice("Modo demo: conecta Supabase para cancelar eventos reales.");
      return;
    }

    const { error } = await postCalendarEventMutation(supabase, {
      action: "update-status",
      eventId: event.id,
      status: "cancelled",
    });

    if (error) {
      onNotice(error);
      return;
    }

    onNotice("Evento cancelado.");
    await onReload();
  }

  async function confirmAppointment(event: CalendarEvent) {
    if (!supabase) {
      onNotice("Modo demo: conecta Supabase para confirmar citas reales.");
      return;
    }

    const { error } = await postCalendarEventMutation(supabase, {
      action: "update-status",
      eventId: event.id,
      status: "confirmed",
      title: buildConfirmedAppointmentTitle(event, patients),
    });

    if (error) {
      onNotice(error);
      return;
    }

    onNotice("Cita confirmada.");
    await onReload();
  }

  return (
    <div className="grid gap-5">
      <Panel>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-black">Gestionar agenda</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Ajusta tu horario, agenda citas y bloquea huecos desde este menú.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[560px]">
            {[
              { id: "availability", label: "Ajustar mi horario", icon: Clock },
              { id: "appointment", label: "Agendar cita con cliente", icon: CalendarDays },
              { id: "event", label: "Añadir bloqueo o cita", icon: Plus },
            ].map((tool) => {
              const Icon = tool.icon;
              const active = activeAgendaTool === tool.id;

              return (
                <button
                  key={tool.id}
                  type="button"
                  className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-black transition ${
                    active
                      ? "border-[var(--tenant-color)] bg-[var(--tenant-color)] text-white"
                      : "border-[var(--line)] bg-white text-[#39433f] hover:border-[var(--tenant-color)]"
                  }`}
                  onClick={() =>
                    setActiveAgendaTool((current) =>
                      current === tool.id
                        ? ""
                        : (tool.id as "availability" | "appointment" | "event"),
                    )
                  }
                >
                  <Icon className="size-4" />
                  {tool.label}
                </button>
              );
            })}
          </div>
        </div>
      </Panel>

      <div className="grid min-w-0 gap-5">
        {activeAgendaTool === "availability" && (
          <Panel>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-black sm:text-lg">Ajustar mi horario</h2>
              <CalendarDays className="size-5 text-[var(--tenant-color)]" />
            </div>
            <form className="mt-5 grid gap-4 lg:grid-cols-[minmax(160px,1fr)_1fr_1fr_minmax(160px,1fr)_auto]" onSubmit={saveAvailability}>
              <SelectField
                label="Día"
                value={availabilityDraft.weekday}
                onChange={(value) =>
                  setAvailabilityDraft((current) => ({ ...current, weekday: value }))
                }
                options={weekdayOptions}
              />
              <Field
                label="Desde"
                type="time"
                value={availabilityDraft.startTime}
                onChange={(value) =>
                  setAvailabilityDraft((current) => ({ ...current, startTime: value }))
                }
                required
              />
              <Field
                label="Hasta"
                type="time"
                value={availabilityDraft.endTime}
                onChange={(value) =>
                  setAvailabilityDraft((current) => ({ ...current, endTime: value }))
                }
                required
              />
              <Field
                label="Duración cita (min)"
                type="number"
                value={availabilityDraft.slotMinutes}
                onChange={(value) =>
                  setAvailabilityDraft((current) => ({ ...current, slotMinutes: value }))
                }
                required
              />
              <button
                className="inline-flex h-11 items-center justify-center gap-2 self-end rounded-lg bg-[var(--tenant-color)] px-4 text-sm font-black text-white disabled:opacity-60"
                disabled={savingAgenda}
              >
                <Plus className="size-4" />
                Guardar
              </button>
            </form>
            <div className="mt-5 grid gap-2 lg:grid-cols-3">
              {availabilitySlots.filter((slot) => slot.is_active).map((slot) => (
                <div
                  key={slot.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-[var(--line)] bg-white p-3 text-sm"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-black">
                      {weekdayOptions.find((option) => option.value === String(slot.weekday))?.label}
                    </span>
                    <span className="text-xs text-[var(--muted)]">
                      {formatTimeString(slot.start_time)} - {formatTimeString(slot.end_time)} · {slot.slot_minutes} min
                    </span>
                  </span>
                  <button
                    type="button"
                    className="grid size-9 shrink-0 place-items-center rounded-lg border border-[#efc4ba] bg-[#fff3f0] text-[#8a3327]"
                    onClick={() => deleteAvailability(slot)}
                    title="Eliminar disponibilidad"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
              {availabilitySlots.filter((slot) => slot.is_active).length === 0 && (
                <EmptyState text="Aún no hay disponibilidad configurada." />
              )}
            </div>
          </Panel>
        )}

        {activeAgendaTool === "appointment" && (
          <Panel>
            <h2 className="text-base font-black sm:text-lg">Agendar cita con cliente</h2>
            <form className="mt-5 grid gap-4 lg:grid-cols-2" onSubmit={scheduleAppointment}>
              <SelectField
                label="Cliente"
                value={appointmentPatientId}
                onChange={(value) =>
                  setAppointmentDraft((current) => ({ ...current, patientId: value }))
                }
                options={patients.map((patient) => ({
                  value: patient.id,
                  label: patient.full_name,
                }))}
              />
              <SelectField
                label="Tipo"
                value={appointmentDraft.mode}
                onChange={(value) =>
                  setAppointmentDraft((current) => ({
                    ...current,
                    mode: value as AppointmentMode,
                  }))
                }
                options={appointmentModeOptions}
              />
              <Field
                label="Fecha"
                type="date"
                value={appointmentDraft.date}
                onChange={(value) =>
                  setAppointmentDraft((current) => ({ ...current, date: value }))
                }
                required
              />
              <Field
                label="Hora"
                type="time"
                value={appointmentDraft.startTime}
                onChange={(value) =>
                  setAppointmentDraft((current) => ({ ...current, startTime: value }))
                }
                required
              />
              <Field
                label="Duración (min)"
                type="number"
                value={appointmentDraft.durationMinutes}
                onChange={(value) =>
                  setAppointmentDraft((current) => ({
                    ...current,
                    durationMinutes: value,
                  }))
                }
                required
              />
              <div className="lg:col-span-2">
                <TextArea
                  label="Notas"
                  value={appointmentDraft.notes}
                  onChange={(value) =>
                    setAppointmentDraft((current) => ({ ...current, notes: value }))
                  }
                />
              </div>
              <button
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[var(--tenant-color)] px-4 text-sm font-black text-white disabled:opacity-60 lg:w-fit"
                disabled={savingAgenda}
              >
                <CalendarDays className="size-4" />
                Agendar cita
              </button>
            </form>
          </Panel>
        )}

        {activeAgendaTool === "event" && (
          <Panel>
            <h2 className="text-base font-black sm:text-lg">Añadir bloqueo o cita</h2>
            <form className="mt-5 grid gap-4 lg:grid-cols-2" onSubmit={saveOtherEvent}>
              <Field
                label="Título"
                value={eventDraft.title}
                onChange={(value) =>
                  setEventDraft((current) => ({ ...current, title: value }))
                }
                required
              />
              <SelectField
                label="Tipo"
                value={eventDraft.eventType}
                onChange={(value) =>
                  setEventDraft((current) => ({
                    ...current,
                    eventType: value as CalendarEventType,
                  }))
                }
                options={calendarEventTypeOptions}
              />
              <Field
                label="Fecha"
                type="date"
                value={eventDraft.date}
                onChange={(value) =>
                  setEventDraft((current) => ({ ...current, date: value }))
                }
                required
              />
              <Field
                label="Hora"
                type="time"
                value={eventDraft.startTime}
                onChange={(value) =>
                  setEventDraft((current) => ({ ...current, startTime: value }))
                }
                required
              />
              <Field
                label="Duración (min)"
                type="number"
                value={eventDraft.durationMinutes}
                onChange={(value) =>
                  setEventDraft((current) => ({ ...current, durationMinutes: value }))
                }
                required
              />
              <label className="flex h-11 items-center gap-3 self-end rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm font-semibold text-[#39433f]">
                <input
                  type="checkbox"
                  checked={eventDraft.blocksAvailability}
                  onChange={(event) =>
                    setEventDraft((current) => ({
                      ...current,
                      blocksAvailability: event.target.checked,
                    }))
                  }
                />
                Bloquear disponibilidad
              </label>
              <div className="lg:col-span-2">
                <TextArea
                  label="Notas"
                  value={eventDraft.notes}
                  onChange={(value) =>
                    setEventDraft((current) => ({ ...current, notes: value }))
                  }
                />
              </div>
              <button
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[var(--tenant-color)] px-4 text-sm font-black text-white disabled:opacity-60 lg:w-fit"
                disabled={savingAgenda}
              >
                <Plus className="size-4" />
                Guardar evento
              </button>
            </form>
          </Panel>
        )}
      </div>

      {pendingAppointments.length > 0 && (
        <PendingAppointmentsPanel
          events={pendingAppointments}
          patients={patients}
          onConfirm={confirmAppointment}
          onCancel={cancelEvent}
        />
      )}

      <div className="grid min-w-0 gap-5">
        <AgendaCalendar
          title="Agenda"
          events={visibleEvents}
          patients={patients}
          onCancel={cancelEvent}
        />
        <Panel>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-black">Próximos huecos disponibles</h2>
            <Clock className="size-5 text-[var(--tenant-color)]" />
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {availableSlots.slice(0, 8).map((slot) => (
              <div
                key={slot.id}
                className="rounded-lg border border-[var(--line)] bg-white p-3 text-sm"
              >
                <p className="font-black">{slot.label}</p>
                <p className="mt-1 text-xs font-semibold text-[var(--muted)]">
                  {formatDate(slot.startAt)}
                </p>
              </div>
            ))}
            {availableSlots.length === 0 && (
              <div className="sm:col-span-2 xl:col-span-4">
                <EmptyState text="No hay huecos disponibles con la configuración actual." />
              </div>
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function AgendaCalendar({
  title,
  events,
  patients,
  onCancel,
}: {
  title: string;
  events: CalendarEvent[];
  patients: Patient[];
  onCancel?: (event: CalendarEvent) => void;
}) {
  const weeks = getAgendaWeeks(4);
  const eventsByDay = groupCalendarEventsByDay(events);

  return (
    <Panel>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-black">{title}</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Vista semanal de lunes a domingo.
          </p>
        </div>
        <span className="inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--line)] bg-white px-3 text-sm font-black text-[#39433f]">
          <CalendarDays className="size-4 text-[var(--tenant-color)]" />
          Desde {formatBookingDateLabel(weeks[0][0].dateKey)}
        </span>
      </div>
      <div className="mt-5 overflow-x-auto pb-2 scrollbar-thin">
        <div className="min-w-[1180px] rounded-lg border border-[var(--line)] bg-white shadow-sm">
          <div className="grid grid-cols-7 border-b border-[var(--line)] bg-[#f3f0e8]">
            {agendaWeekdayLabels.map((label) => (
              <div
                key={label}
                className="px-3 py-3 text-xs font-black uppercase text-[var(--muted)]"
              >
                {label}
              </div>
            ))}
          </div>
          {weeks.map((week) => (
            <div
              key={week[0].dateKey}
              className="grid grid-cols-7 border-b border-[var(--line)] last:border-b-0"
            >
              {week.map((day) => {
                const dayEvents = eventsByDay.get(day.dateKey) ?? [];
                return (
                  <div
                    key={day.dateKey}
                    className={`min-h-48 border-r border-[var(--line)] bg-[#fbfaf6] p-2 last:border-r-0 ${
                      day.isToday ? "bg-[#effaf5]" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-black text-[#24342f]">{day.dayNumber}</p>
                        <p className="text-[11px] font-bold text-[var(--muted)]">
                          {day.monthLabel}
                        </p>
                      </div>
                      {dayEvents.length > 0 && (
                        <span className="grid min-w-7 place-items-center rounded-md bg-white px-2 py-1 text-xs font-black text-[var(--tenant-color)]">
                          {dayEvents.length}
                        </span>
                      )}
                    </div>
                    <div className="mt-3 grid gap-2">
                      {dayEvents.slice(0, 3).map((event) => (
                        <AgendaEventCard
                          key={event.id}
                          event={event}
                          patientName={getPatientName(patients, event.patient_id)}
                          onCancel={onCancel}
                        />
                      ))}
                      {dayEvents.length > 3 && (
                        <p className="rounded-md bg-white px-2 py-1 text-xs font-black text-[var(--muted)]">
                          +{dayEvents.length - 3} mas
                        </p>
                      )}
                      {dayEvents.length === 0 && (
                        <p className="rounded-lg border border-dashed border-[var(--line)] bg-white/70 px-2 py-4 text-center text-xs font-semibold text-[var(--muted)]">
                          Sin eventos
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}

function BookingCalendar({
  availableSlots,
  selectedDate,
  onSelectDate,
}: {
  availableSlots: AvailableAppointmentSlot[];
  selectedDate: string;
  onSelectDate: (dateKey: string) => void;
}) {
  const weeks = getAgendaWeeks(4);
  const slotCountByDay = countSlotsByDay(availableSlots);

  return (
    <div className="overflow-x-auto pb-2 scrollbar-thin">
      <div className="min-w-[760px] rounded-lg border border-[var(--line)] bg-white shadow-sm">
        <div className="grid grid-cols-7 border-b border-[var(--line)] bg-[#f3f0e8]">
          {agendaWeekdayLabels.map((label) => (
            <div
              key={label}
              className="px-3 py-3 text-xs font-black uppercase text-[var(--muted)]"
            >
              {label}
            </div>
          ))}
        </div>
        {weeks.map((week) => (
          <div
            key={week[0].dateKey}
            className="grid grid-cols-7 border-b border-[var(--line)] last:border-b-0"
          >
            {week.map((day) => {
              const slotsCount = slotCountByDay.get(day.dateKey) ?? 0;
              const selected = selectedDate === day.dateKey;
              const available = slotsCount > 0;

              return (
                <button
                  key={day.dateKey}
                  type="button"
                  className={`min-h-28 border-r border-[var(--line)] p-3 text-left transition last:border-r-0 ${
                    selected
                      ? "bg-[var(--tenant-color)] text-white"
                      : available
                        ? "bg-[#effaf5] text-[#24342f] hover:bg-[#dcefe7]"
                        : "bg-[#f6f3ed] text-[#9a9388]"
                  }`}
                  onClick={() => onSelectDate(day.dateKey)}
                >
                  <span className="block text-sm font-black">{day.dayNumber}</span>
                  <span
                    className={`mt-1 block text-[11px] font-bold ${
                      selected ? "text-white/80" : "text-[var(--muted)]"
                    }`}
                  >
                    {day.monthLabel}
                  </span>
                  <span
                    className={`mt-4 inline-flex rounded-md px-2 py-1 text-xs font-black ${
                      selected
                        ? "bg-white/20 text-white"
                        : available
                          ? "bg-white text-[#255d50]"
                          : "bg-white/70 text-[#8a8378]"
                    }`}
                  >
                    {available ? `${slotsCount} huecos` : "Sin huecos"}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function PendingAppointmentsPanel({
  events,
  patients,
  onConfirm,
  onCancel,
}: {
  events: CalendarEvent[];
  patients: Patient[];
  onConfirm: (event: CalendarEvent) => void;
  onCancel: (event: CalendarEvent) => void;
}) {
  return (
    <Panel>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-black">Solicitudes de cita pendientes</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Confirma o cancela las citas solicitadas por clientes.
          </p>
        </div>
        <span className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#fff3f0] px-3 text-sm font-black text-[#8a3327]">
          <Bell className="size-4" />
          {events.length}
        </span>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {events.map((event) => (
          <article
            key={event.id}
            className="rounded-lg border border-[#ead39b] bg-[#fff8df] p-4 text-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-black text-[#24342f]">
                  {getPatientName(patients, event.patient_id) || event.title}
                </p>
                <p className="mt-1 text-xs font-semibold text-[#6b5420]">
                  {formatDate(event.start_at)} · {formatAgendaTimeRange(event.start_at, event.end_at)}
                </p>
              </div>
              <span className="rounded-md bg-white px-2 py-1 text-xs font-black text-[#8a5c18]">
                Pendiente
              </span>
            </div>
            {event.appointment_mode && (
              <p className="mt-3 inline-flex rounded-md bg-white/80 px-2 py-1 text-xs font-black text-[#39433f]">
                {formatAppointmentMode(event.appointment_mode)}
              </p>
            )}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[var(--tenant-color)] px-3 text-xs font-black text-white"
                onClick={() => onConfirm(event)}
              >
                <Check className="size-4" />
                Confirmar
              </button>
              <button
                type="button"
                className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[#efc4ba] bg-white px-3 text-xs font-black text-[#8a3327]"
                onClick={() => onCancel(event)}
              >
                <Ban className="size-4" />
                Cancelar
              </button>
            </div>
          </article>
        ))}
      </div>
    </Panel>
  );
}

function AgendaEventCard({
  event,
  patientName,
  onCancel,
}: {
  event: CalendarEvent;
  patientName: string;
  onCancel?: (event: CalendarEvent) => void;
}) {
  const meta = getCalendarEventMeta(event);

  return (
    <article className={`min-w-0 overflow-hidden rounded-lg border p-2 text-xs ${meta.className}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-black text-[#24342f]">{event.title}</p>
          <p className="mt-1 truncate text-[11px] font-semibold text-[#4a554f]">
            {formatAgendaTimeRange(event.start_at, event.end_at)}
          </p>
        </div>
        <meta.Icon className="size-4 shrink-0 text-[var(--tenant-color)]" />
      </div>
      {patientName && (
        <p className="mt-2 truncate text-[11px] font-semibold text-[var(--muted)]">
          {patientName}
        </p>
      )}
      <div className="mt-2 flex flex-wrap gap-1.5">
        <span className={`inline-flex rounded-md px-2 py-1 text-[11px] font-black ${getCalendarStatusClass(event)}`}>
          {formatCalendarEventStatus(event)}
        </span>
        {event.appointment_mode && (
          <span className="inline-flex rounded-md bg-white/80 px-2 py-1 text-[11px] font-black text-[#39433f]">
            {formatAppointmentMode(event.appointment_mode)}
          </span>
        )}
      </div>
      {event.notes && (
        <p className="mt-2 line-clamp-2 text-[11px] leading-4 text-[#4a554f]">
          {event.notes}
        </p>
      )}
      {onCancel && event.status !== "cancelled" && (
        <button
          type="button"
          className="mt-3 inline-flex h-8 w-full items-center justify-center gap-2 rounded-lg border border-[#efc4ba] bg-white px-2 text-[11px] font-black text-[#8a3327]"
          onClick={() => onCancel(event)}
        >
          <Ban className="size-3.5" />
          Cancelar
        </button>
      )}
    </article>
  );
}

async function insertCalendarEvent({
  tenant,
  supabase,
  onNotice,
  onReload,
  setSavingAgenda,
  row,
  successMessage,
  afterSuccess,
}: {
  tenant: Tenant;
  supabase: ReturnType<typeof createSupabaseBrowser>;
  onNotice: (message: string) => void;
  onReload: () => Promise<void>;
  setSavingAgenda: (saving: boolean) => void;
  row: Omit<CalendarEvent, "id" | "created_by" | "created_at" | "updated_at">;
  successMessage: string;
  afterSuccess?: () => void;
}) {
  if (!supabase) {
    onNotice("Modo demo: conecta Supabase para guardar eventos reales.");
    return;
  }

  if (new Date(row.end_at).getTime() <= new Date(row.start_at).getTime()) {
    onNotice("La hora de fin debe ser posterior a la hora de inicio.");
    return;
  }

  setSavingAgenda(true);
  const { error } = await postCalendarEventMutation(supabase, {
    action: "create",
    row: {
      ...row,
      tenant_id: tenant.id,
    },
  });
  setSavingAgenda(false);

  if (error) {
    onNotice(error);
    return;
  }

  afterSuccess?.();
  onNotice(successMessage);
  await onReload();
}

async function postCalendarEventMutation(
  supabase: ReturnType<typeof createSupabaseBrowser>,
  body:
    | {
        action: "create";
        row: Omit<CalendarEvent, "id" | "created_by" | "created_at" | "updated_at">;
      }
    | {
        action: "update-status";
        eventId: string;
        status: CalendarEventStatus;
        title?: string;
      },
) {
  if (!supabase) {
    return { error: "Modo demo: conecta Supabase para guardar agenda real." };
  }

  const accessToken = await getCurrentAccessToken(supabase);
  if (!accessToken) {
    return { error: "Tu sesion ha caducado. Cierra sesion y vuelve a entrar." };
  }

  const response = await fetch("/api/calendar/events", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as { error?: string; ok?: boolean };

  if (!response.ok || !payload.ok) {
    return { error: payload.error ?? "No se pudo guardar la agenda." };
  }

  return { error: "" };
}

async function postTrackingLogs(
  supabase: ReturnType<typeof createSupabaseBrowser>,
  body: {
    tenantId: string;
    patientId: string;
    weightKg: number | null;
    waistCm: number | null;
    steps: number | null;
    exercise: string | null;
    durationMinutes: number | null;
    durationSeconds: number | null;
    distanceKm: number | null;
    customGoalLogs: Array<{
      goalId: string;
      status: GoalStatus;
      value: number | null;
    }>;
    mealPhoto: {
      storagePath: string;
      mealType: string;
      notes: string;
      loggedAt: string;
    } | null;
  },
) {
  if (!supabase) {
    return { error: "Modo demo: conecta Supabase para registrar datos reales." };
  }

  const accessToken = await getCurrentAccessToken(supabase);
  if (!accessToken) {
    return { error: "Tu sesion ha caducado. Cierra sesion y vuelve a entrar." };
  }

  const response = await fetch("/api/tracking/logs", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as { error?: string; ok?: boolean };

  if (!response.ok || !payload.ok) {
    return { error: payload.error ?? "No se pudo registrar el dato." };
  }

  return { error: "" };
}

function DocumentsPanel({
  tenant,
  role,
  selectedPatient,
  documents,
  supabase,
  onNotice,
  onReload,
}: {
  tenant: Tenant;
  role: UserRole | null;
  selectedPatient: Patient | null;
  documents: DocumentFile[];
  supabase: ReturnType<typeof createSupabaseBrowser>;
  onNotice: (message: string) => void;
  onReload: () => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);

  async function uploadDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedPatient || !file) return;
    if (!supabase) {
      onNotice("Modo demo: conecta Supabase para subir documentos reales.");
      return;
    }

    const path = `${tenant.id}/${selectedPatient.id}/documents/${Date.now()}-${safeFileName(file.name)}`;
    const { error: uploadError } = await supabase.storage
      .from("nutrios-private")
      .upload(path, file, { upsert: false });

    if (uploadError) {
      onNotice(uploadError.message);
      return;
    }

    const { error } = await supabase.from("documents").insert({
      tenant_id: tenant.id,
      patient_id: selectedPatient.id,
      title: title || file.name,
      storage_path: path,
      content_type: file.type,
    });

    if (error) {
      onNotice(error.message);
      return;
    }

    setTitle("");
    setFile(null);
    onNotice("Documento subido.");
    await onReload();
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
      {role !== "patient" && (
        <Panel>
          <h2 className="text-lg font-black">Añadir documento</h2>
          <form className="mt-5 space-y-4" onSubmit={uploadDocument}>
            <Field label="Título" value={title} onChange={setTitle} />
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-[#39433f]">Archivo</span>
              <input
                className="block w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm"
                type="file"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </label>
            <button className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[var(--tenant-color)] px-4 text-sm font-semibold text-white">
              <FileText className="size-4" />
              Subir
            </button>
          </form>
        </Panel>
      )}
      <Panel className={role === "patient" ? "xl:col-span-2" : ""}>
        <h2 className="text-lg font-black">Documentacion</h2>
        <div className="mt-4 grid gap-3">
          {documents.map((document) => (
            <a
              key={document.id}
              href={document.signed_url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between gap-3 rounded-lg border border-[var(--line)] bg-white p-3 text-sm"
            >
              <span className="min-w-0">
                <span className="block truncate font-semibold">{document.title}</span>
                <span className="text-[var(--muted)]">{formatDate(document.created_at)}</span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-[var(--muted)]" />
            </a>
          ))}
          {documents.length === 0 && <EmptyState text="No hay documentos para este cliente." />}
        </div>
      </Panel>
    </div>
  );
}

function SettingsPanel({
  tenant,
  role,
  preferences,
  onPreferences,
  pendingInvitations,
  supabase,
  onTenant,
  onNotice,
  onReload,
}: {
  tenant: Tenant;
  role: UserRole | null;
  preferences: NotificationPreferences;
  onPreferences: (preferences: NotificationPreferences) => void;
  pendingInvitations: PendingInvitation[];
  supabase: ReturnType<typeof createSupabaseBrowser>;
  onTenant: (tenant: Tenant) => void;
  onNotice: (message: string) => void;
  onReload: () => Promise<void>;
}) {
  const [name, setName] = useState(tenant.name);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState(tenant.logo_url ?? "");
  const [logoObjectUrl, setLogoObjectUrl] = useState("");
  const [primaryColor, setPrimaryColor] = useState(tenant.primary_color);
  const [savingBrand, setSavingBrand] = useState(false);
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      if (logoObjectUrl) URL.revokeObjectURL(logoObjectUrl);
    };
  }, [logoObjectUrl]);

  function handleLogoFileChange(file: File | null) {
    if (logoObjectUrl) URL.revokeObjectURL(logoObjectUrl);

    if (file && file.size > maxLogoFileSizeBytes) {
      setLogoFile(null);
      setLogoObjectUrl("");
      setLogoPreview(tenant.logo_url ?? "");
      if (logoInputRef.current) logoInputRef.current.value = "";
      onNotice(`El logo no puede superar ${formatFileSize(maxLogoFileSizeBytes)}.`);
      return;
    }

    setLogoFile(file);

    if (!file) {
      setLogoObjectUrl("");
      setLogoPreview(tenant.logo_url ?? "");
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setLogoObjectUrl(objectUrl);
    setLogoPreview(objectUrl);
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingBrand) return;

    let nextLogoUrl = tenant.logo_url;
    setSavingBrand(true);

    try {
      if (logoFile && supabase) {
        const path = `${tenant.id}/logo-${Date.now()}-${safeFileName(logoFile.name)}`;
        const { error: uploadError } = await supabase.storage
          .from("nutrios-branding")
          .upload(path, logoFile, {
            upsert: true,
            contentType: logoFile.type || undefined,
          });

        if (uploadError) {
          onNotice(uploadError.message);
          return;
        }

        const { data } = supabase.storage.from("nutrios-branding").getPublicUrl(path);
        nextLogoUrl = data.publicUrl;
      }

      const nextTenant = {
        ...tenant,
        name,
        logo_url: nextLogoUrl,
        primary_color: primaryColor,
      };

      if (!supabase) {
        onTenant({
          ...nextTenant,
          logo_url: logoPreview || nextTenant.logo_url,
        });
        onNotice("Marca actualizada en modo demo.");
        return;
      }

      const { error } = await supabase
        .from("tenants")
        .update({
          name,
          logo_url: nextLogoUrl,
          primary_color: primaryColor,
          updated_at: new Date().toISOString(),
        })
        .eq("id", tenant.id);

      if (error) {
        onNotice(error.message);
        return;
      }

      onTenant(nextTenant);
      setLogoFile(null);
      if (logoObjectUrl) URL.revokeObjectURL(logoObjectUrl);
      setLogoObjectUrl("");
      setLogoPreview(nextLogoUrl ?? "");
      onNotice("Personalizacion guardada.");
    } finally {
      setSavingBrand(false);
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
      {role !== "patient" && (
        <div className="grid min-w-0 gap-5">
          <InvitationPanel
            tenant={tenant}
            pendingInvitations={pendingInvitations}
            supabase={supabase}
            onNotice={onNotice}
            onReload={onReload}
          />
          <Panel>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-black sm:text-lg">Personalizar mi {APP_NAME}</h2>
              <Palette className="size-5 text-[var(--tenant-color)]" />
            </div>
            <form className="mt-5 grid gap-4 lg:grid-cols-2" onSubmit={saveSettings}>
              <Field label="Nombre visible" value={name} onChange={setName} required />
              <label className="block min-w-0 lg:col-span-2">
                <span className="mb-1 block text-sm font-semibold text-[#39433f]">Logo</span>
                <div className="grid gap-3 rounded-lg border border-[var(--line)] bg-white p-3 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
                  <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-lg bg-[var(--tenant-color)] text-xl font-black text-white">
                    {logoPreview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={logoPreview} alt="" className="h-full w-full object-cover" />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={APP_ICON_SRC} alt="" className="h-full w-full object-contain bg-white p-2" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <button
                      type="button"
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[var(--line)] bg-[#fbfaf6] px-4 text-sm font-black text-[#39433f] hover:border-[var(--tenant-color)]"
                      onClick={() => logoInputRef.current?.click()}
                    >
                      <Upload className="size-4 text-[var(--tenant-color)]" />
                      Seleccionar logo
                    </button>
                    <input
                      ref={logoInputRef}
                      className="sr-only"
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      onChange={(event) =>
                        handleLogoFileChange(event.target.files?.[0] ?? null)
                      }
                    />
                    <p className="mt-2 text-xs font-semibold text-[var(--muted)]">
                      PNG, JPG, WebP o SVG. Máximo {formatFileSize(maxLogoFileSizeBytes)}.
                    </p>
                    <p className="mt-1 truncate text-xs text-[var(--muted)]">
                      {logoFile ? `${logoFile.name} (${formatFileSize(logoFile.size)})` : "Sin archivo nuevo seleccionado."}
                    </p>
                  </div>
                </div>
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-[#39433f]">Color principal</span>
                <div className="flex h-11 items-center gap-3 rounded-lg border border-[var(--line)] bg-white px-3">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(event) => setPrimaryColor(event.target.value)}
                    className="size-7 rounded border-0 bg-transparent p-0"
                  />
                  <span className="text-sm font-semibold">{primaryColor}</span>
                </div>
              </label>
              <div className="lg:col-span-2">
                <button
                  className="inline-flex h-11 items-center gap-2 rounded-lg bg-[var(--tenant-color)] px-4 text-sm font-black text-white disabled:opacity-60"
                  disabled={savingBrand}
                >
                  {savingBrand ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Upload className="size-4" />
                  )}
                  {savingBrand ? "Guardando..." : "Guardar personalizacion"}
                </button>
              </div>
            </form>
          </Panel>
        </div>
      )}

      <div className={`grid min-w-0 gap-5 ${role === "patient" ? "xl:col-span-2" : ""}`}>
        <NotificationSettingsPanel
          tenant={tenant}
          preferences={preferences}
          supabase={supabase}
          onPreferences={onPreferences}
          onNotice={onNotice}
        />
        <AccountSecurityPanel
          supabase={supabase}
          onNotice={onNotice}
        />
        <TechnicalSupportPanel
          tenant={tenant}
          supabase={supabase}
          onNotice={onNotice}
        />
      </div>
    </div>
  );
}

function NotificationSettingsPanel({
  tenant,
  preferences,
  supabase,
  onPreferences,
  onNotice,
}: {
  tenant: Tenant;
  preferences: NotificationPreferences;
  supabase: ReturnType<typeof createSupabaseBrowser>;
  onPreferences: (preferences: NotificationPreferences) => void;
  onNotice: (message: string) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [deviceSubscribed, setDeviceSubscribed] = useState(false);
  const [permission, setPermission] = useState("default");

  const registerDeviceSubscription = useCallback(
    async (subscription: PushSubscription, quiet = false) => {
      if (!supabase) return false;

      const accessToken = await getCurrentAccessToken(supabase);
      if (!accessToken) {
        if (!quiet) {
          onNotice("Tu sesion ha caducado. Cierra sesion y vuelve a entrar.");
        }
        return false;
      }

      const response = await fetch("/api/notifications/push-subscriptions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          tenantId: tenant.id,
          subscription: subscription.toJSON(),
        }),
      });
      const payload = (await response.json()) as { error?: string; ok?: boolean };

      if (!response.ok) {
        if (!quiet) {
          onNotice(payload.error ?? "No se pudo activar este dispositivo.");
        }
        return false;
      }

      return true;
    },
    [onNotice, supabase, tenant.id],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadDeviceStatus() {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setPermission("unsupported");
        return;
      }

      setPermission(Notification.permission);
      const registration = await navigator.serviceWorker.getRegistration("/push-sw.js");
      const subscription = await registration?.pushManager.getSubscription();
      if (!subscription || Notification.permission !== "granted" || !preferences.push_enabled) {
        if (!cancelled) {
          setDeviceSubscribed(false);
        }
        return;
      }

      const saved = await registerDeviceSubscription(subscription, true);
      if (!cancelled) {
        setDeviceSubscribed(saved);
      }
    }

    void loadDeviceStatus();

    return () => {
      cancelled = true;
    };
  }, [preferences.push_enabled, registerDeviceSubscription]);

  async function savePreferences(patch: Partial<NotificationPreferences>) {
    if (!supabase) {
      onPreferences({ ...preferences, ...patch });
      onNotice("Preferencias actualizadas en modo demo.");
      return;
    }

    const accessToken = await getCurrentAccessToken(supabase);
    if (!accessToken) {
      onNotice("Tu sesion ha caducado. Cierra sesion y vuelve a entrar.");
      return;
    }

    setSaving(true);
    const nextPreferences = { ...preferences, ...patch };
    const response = await fetch("/api/notifications/preferences", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        tenantId: tenant.id,
        emailEnabled: nextPreferences.email_enabled,
        pushEnabled: nextPreferences.push_enabled,
      }),
    });
    const payload = (await response.json()) as NotificationPreferencesResponse;
    setSaving(false);

    if (!response.ok || !payload.preferences) {
      onNotice(payload.error ?? "No se pudieron guardar las preferencias.");
      return;
    }

    onPreferences(payload.preferences);
    onNotice("Preferencias de notificaciones actualizadas.");
  }

  async function activateDevicePush() {
    if (!preferences.push_enabled) {
      onNotice("Activa primero las notificaciones por la app.");
      return;
    }
    if (!supabase) {
      onNotice("Modo demo: conecta Supabase para activar notificaciones reales.");
      return;
    }
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setPermission("unsupported");
      onNotice("Este navegador no soporta notificaciones web push.");
      return;
    }

    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) {
      onNotice("Falta configurar NEXT_PUBLIC_VAPID_PUBLIC_KEY.");
      return;
    }

    const nextPermission = await Notification.requestPermission();
    setPermission(nextPermission);
    if (nextPermission !== "granted") {
      onNotice("No se han concedido permisos de notificacion en este dispositivo.");
      return;
    }

    setSaving(true);
    try {
      const registration = await navigator.serviceWorker.register("/push-sw.js");
      await registration.update().catch(() => undefined);
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        }));

      const saved = await registerDeviceSubscription(subscription);
      setDeviceSubscribed(saved);
      if (saved) {
        onNotice("Notificaciones activadas en este dispositivo.");
      }
    } catch {
      setDeviceSubscribed(false);
      onNotice("No se pudo activar este dispositivo. Revisa los permisos del navegador.");
    } finally {
      setSaving(false);
    }
  }

  async function disableDevicePush() {
    await savePreferences({ push_enabled: false });
    if (!supabase || !("serviceWorker" in navigator)) return;

    const registration = await navigator.serviceWorker.getRegistration("/push-sw.js");
    const subscription = await registration?.pushManager.getSubscription();
    await subscription?.unsubscribe();

    const accessToken = await getCurrentAccessToken(supabase);
    if (!accessToken) return;

    await fetch("/api/notifications/push-subscriptions", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        tenantId: tenant.id,
        endpoint: subscription?.endpoint,
      }),
    });
    setDeviceSubscribed(false);
  }

  const permissionLabel =
    permission === "granted"
      ? "Permiso concedido"
      : permission === "denied"
        ? "Permiso bloqueado en el navegador"
        : permission === "unsupported"
          ? "No soportado en este navegador"
          : "Permiso pendiente";

  return (
    <Panel>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-black sm:text-lg">Notificaciones</h2>
        <Bell className="size-5 text-[var(--tenant-color)]" />
      </div>
      <div className="mt-5 grid gap-3">
        <NotificationToggle
          title="Notificaciones por email"
          description={`Si un mensaje sigue sin leerse pasados 5 minutos, ${APP_NAME} enviara un correo.`}
          checked={preferences.email_enabled}
          disabled={saving}
          onChange={(checked) => savePreferences({ email_enabled: checked })}
        />
        <NotificationToggle
          title="Notificaciones por la app"
          description="Permite avisos push en este navegador o movil cuando hay mensajes nuevos."
          checked={preferences.push_enabled}
          disabled={saving}
          onChange={(checked) =>
            checked ? savePreferences({ push_enabled: true }) : disableDevicePush()
          }
        />
      </div>
      <div className="mt-4 rounded-lg border border-[var(--line)] bg-white p-3">
        <p className="text-sm font-black">Este dispositivo</p>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {deviceSubscribed ? "Dispositivo activado." : permissionLabel}
        </p>
        <button
          type="button"
          className="mt-3 inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--tenant-color)] px-4 text-sm font-black text-white disabled:opacity-60"
          onClick={activateDevicePush}
          disabled={saving || !preferences.push_enabled || deviceSubscribed}
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Bell className="size-4" />}
          {deviceSubscribed ? "Dispositivo activado" : "Activar este dispositivo"}
        </button>
      </div>
    </Panel>
  );
}

function NotificationToggle({
  title,
  description,
  checked,
  disabled,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start justify-between gap-4 rounded-lg border border-[var(--line)] bg-white p-3">
      <span className="min-w-0">
        <span className="block text-sm font-black text-[#17201d]">{title}</span>
        <span className="mt-1 block text-sm text-[var(--muted)]">{description}</span>
      </span>
      <input
        type="checkbox"
        className="mt-1 size-5 shrink-0 accent-[var(--tenant-color)]"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}

function TechnicalSupportPanel({
  tenant,
  supabase,
  onNotice,
}: {
  tenant: Tenant;
  supabase: ReturnType<typeof createSupabaseBrowser>;
  onNotice: (message: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [supportName, setSupportName] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [supportSubject, setSupportSubject] = useState("");
  const [supportMessage, setSupportMessage] = useState("");
  const [sendingSupport, setSendingSupport] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadUser() {
      if (!supabase) return;

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!isMounted || !user) return;
      setSupportEmail((current) => current || user.email || "");
      setSupportName((current) => {
        const metadataName =
          typeof user.user_metadata?.full_name === "string"
            ? user.user_metadata.full_name
            : "";
        return current || metadataName;
      });
    }

    void loadUser();

    return () => {
      isMounted = false;
    };
  }, [supabase]);

  async function sendSupportRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sendingSupport) return;

    if (!supabase) {
      onNotice("Modo demo: conecta Supabase para enviar asistencia tecnica.");
      return;
    }

    const accessToken = await getCurrentAccessToken(supabase);
    if (!accessToken) {
      onNotice("Tu sesion ha caducado. Cierra sesion y vuelve a entrar.");
      return;
    }

    setSendingSupport(true);
    const response = await fetch("/api/support/request", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        tenantId: tenant.id,
        name: supportName,
        email: supportEmail,
        subject: supportSubject,
        message: supportMessage,
      }),
    });

    const payload = (await response.json()) as SupportRequestResponse;
    setSendingSupport(false);

    if (!response.ok) {
      onNotice(payload.error ?? "No se pudo enviar la incidencia.");
      return;
    }

    setSupportSubject("");
    setSupportMessage("");
    setIsOpen(false);
    onNotice("Incidencia enviada a asistencia tecnica.");
  }

  return (
    <Panel>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-black sm:text-lg">Asistencia tecnica</h2>
        <LifeBuoy className="size-5 text-[var(--tenant-color)]" />
      </div>
      <button
        type="button"
        className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--line)] bg-white px-4 text-sm font-black text-[#39433f] hover:border-[var(--tenant-color)]"
        onClick={() => setIsOpen((current) => !current)}
      >
        <LifeBuoy className="size-4 text-[var(--tenant-color)]" />
        {isOpen ? "Cerrar asistencia" : "Solicitar asistencia"}
      </button>

      {isOpen && (
        <form className="mt-5 space-y-4" onSubmit={sendSupportRequest}>
          <Field label="Nombre" value={supportName} onChange={setSupportName} required />
          <Field
            label="Correo electronico"
            type="email"
            value={supportEmail}
            onChange={setSupportEmail}
            required
          />
          <Field label="Asunto" value={supportSubject} onChange={setSupportSubject} required />
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-[#39433f]">
              Incidencia
            </span>
            <textarea
              className="min-h-32 w-full resize-y rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm"
              value={supportMessage}
              onChange={(event) => setSupportMessage(event.target.value)}
              required
            />
          </label>
          <button
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--tenant-color)] px-4 text-sm font-semibold text-white disabled:opacity-60"
            disabled={sendingSupport}
          >
            {sendingSupport ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            {sendingSupport ? "Enviando..." : "Enviar incidencia"}
          </button>
        </form>
      )}
    </Panel>
  );
}

function AccountSecurityPanel({
  supabase,
  onNotice,
  className = "",
}: {
  supabase: ReturnType<typeof createSupabaseBrowser>;
  onNotice: (message: string) => void;
  className?: string;
}) {
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase) {
      onNotice("Modo demo: conecta Supabase para cambiar contraseñas reales.");
      return;
    }

    if (newPassword.length < 8) {
      onNotice("La contraseña debe tener al menos 8 caracteres.");
      return;
    }

    if (newPassword !== newPasswordConfirm) {
      onNotice("Las contraseñas no coinciden.");
      return;
    }

    setSaving(true);
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    setSaving(false);

    if (error) {
      onNotice(error.message);
      return;
    }

    setNewPassword("");
    setNewPasswordConfirm("");
    onNotice("Contraseña actualizada.");
  }

  return (
    <Panel className={className}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-black sm:text-lg">Cambiar mi contraseña</h2>
        <KeyRound className="size-5 text-[var(--tenant-color)]" />
      </div>
      <form className="mt-5 space-y-4" onSubmit={updatePassword}>
        <Field
          label="Nueva contraseña"
          type="password"
          value={newPassword}
          onChange={setNewPassword}
          required
        />
        <Field
          label="Repetir nueva contraseña"
          type="password"
          value={newPasswordConfirm}
          onChange={setNewPasswordConfirm}
          required
        />
        <button
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--tenant-color)] px-4 text-sm font-semibold text-white disabled:opacity-60"
          disabled={saving}
        >
          <KeyRound className="size-4" />
          {saving ? "Guardando..." : "Cambiar contraseña"}
        </button>
      </form>
    </Panel>
  );
}

function Panel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`min-w-0 rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4 shadow-[var(--shadow-soft)] sm:p-5 ${className}`}>
      {children}
    </section>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Users;
}) {
  return (
    <Panel>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-[var(--muted)]">{label}</p>
          <p className="mt-1 text-2xl font-black">{value}</p>
        </div>
        <div className="grid size-10 place-items-center rounded-lg bg-[#eaf4ef] text-[var(--tenant-color)]">
          <Icon className="size-5" />
        </div>
      </div>
    </Panel>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-md bg-[#f6f3eb] px-2 py-1">
      <span className="block text-xs text-[var(--muted)]">{label}</span>
      <span className="font-semibold">{value}</span>
    </span>
  );
}

function InfoBlock({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div className="rounded-lg border border-[var(--line)] bg-white p-3">
      <p className="text-xs font-bold uppercase text-[var(--muted)]">{label}</p>
      <p className="mt-2 text-sm leading-6 text-[#2c3732]">{value || "Sin datos"}</p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  step,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  step?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-[#39433f]">{label}</span>
      <input
        className="h-11 w-full rounded-lg border border-[var(--line)] bg-white px-3 text-sm"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        type={type}
        required={required}
        step={step}
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-[#39433f]">{label}</span>
      <textarea
        className="min-h-24 w-full resize-y rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-[#39433f]">{label}</span>
      <select
        className="h-11 w-full rounded-lg border border-[var(--line)] bg-white px-3 text-sm"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-[#cfc8bb] bg-[#faf8f1] px-4 py-8 text-center text-sm font-semibold text-[var(--muted)]">
      {text}
    </div>
  );
}

function PhotoList({
  photos,
  onDeletePhoto,
}: {
  photos: MealPhoto[];
  onDeletePhoto?: (photo: MealPhoto) => void;
}) {
  const groupedPhotos = groupMealPhotosByDay(photos);
  const todayDateKey = getLocalDateString();

  return (
    <div>
      <p className="mb-2 text-sm font-black">Fotos de comidas</p>
      <div className="grid gap-4">
        {groupedPhotos.map((group) => (
          <details
            key={group.dateKey}
            className="group rounded-lg border border-[var(--line)] bg-[#fbfaf6] p-3"
            open={group.dateKey === todayDateKey}
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
              <div className="flex min-w-0 items-center gap-2">
                <ChevronRight className="size-4 shrink-0 text-[var(--muted)] transition group-open:rotate-90" />
                <CalendarDays className="size-4 shrink-0 text-[var(--tenant-color)]" />
                <p className="truncate text-sm font-black">
                  {formatPhotoDayLabel(group.dateKey)}
                </p>
              </div>
              <span className="shrink-0 rounded-md bg-white px-2 py-1 text-xs font-bold text-[var(--muted)]">
                {formatPhotoCount(group.photos.length)}
              </span>
            </summary>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {group.photos.map((photo) => (
                <PhotoCard
                  key={photo.id}
                  photo={photo}
                  onDeletePhoto={onDeletePhoto}
                />
              ))}
            </div>
          </details>
        ))}
        {photos.length === 0 && <EmptyState text="Sin fotos." />}
      </div>
    </div>
  );
}

function PhotoCard({
  photo,
  onDeletePhoto,
}: {
  photo: MealPhoto;
  onDeletePhoto?: (photo: MealPhoto) => void;
}) {
  const mealType = photo.meal_type || "Sin tipo";

  return (
    <div className="relative aspect-square overflow-hidden rounded-lg border border-[var(--line)] bg-[#f7f5ef] shadow-sm">
      <a
        href={photo.signed_url}
        target="_blank"
        rel="noreferrer"
        className="block h-full w-full"
      >
        {photo.signed_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo.signed_url}
            alt={`${mealType}${photo.notes ? ` - ${photo.notes}` : ""}`}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="grid h-full place-items-center text-xs font-semibold text-[var(--muted)]">
            Imagen
          </span>
        )}
      </a>
      <span className="absolute left-2 top-2 max-w-[calc(100%-3rem)] truncate rounded-md bg-white/95 px-2 py-1 text-[11px] font-black text-[#24342f] shadow-sm">
        {mealType}
      </span>
      {onDeletePhoto && (
        <button
          type="button"
          className="absolute right-2 top-2 grid size-8 place-items-center rounded-lg bg-white/95 text-[#8a3327] shadow-sm"
          onClick={() => onDeletePhoto(photo)}
          title="Borrar foto"
        >
          <Trash2 className="size-4" />
        </button>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#17201d]/85 to-transparent px-2 pb-2 pt-8 text-white">
        <p className="text-xs font-bold">{formatPhotoTime(photo.logged_at)}</p>
        {photo.notes && (
          <p className="mt-0.5 max-h-8 overflow-hidden text-xs leading-4 text-white/85">
            {photo.notes}
          </p>
        )}
      </div>
    </div>
  );
}

function isActivePatient(patient: Patient) {
  return !isInactivePatient(patient);
}

function isInactivePatient(patient: Patient) {
  return patient.status === "inactive" || patient.status === "archived";
}

function needsQuestionnaireUpdate(patient: Patient) {
  const exerciseHours = patient.exercise_hours_per_week;
  return (
    (patient.questionnaire_version ?? 1) < currentQuestionnaireVersion ||
    !patient.objective ||
    !patient.sex ||
    exerciseHours === null ||
    exerciseHours === undefined ||
    (Number(exerciseHours) > 0 && !patient.exercise_type)
  );
}

function buildGoalSummaries({
  patient,
  goals,
  weights,
  steps,
  exercises,
  goalLogs,
}: {
  patient: Patient;
  goals: PatientGoal[];
  weights: WeightLog[];
  steps: StepLog[];
  exercises: ExerciseLog[];
  goalLogs: PatientGoalLog[];
}) {
  return goals
    .filter((goal) => goal.patient_id === patient.id && goal.is_active)
    .sort(compareGoals)
    .map((goal) => ({
      ...goal,
      ...evaluateGoalStatus(goal, weights, steps, exercises, goalLogs),
    }));
}

function evaluateGoalStatus(
  goal: PatientGoal,
  weights: WeightLog[],
  steps: StepLog[],
  exercises: ExerciseLog[],
  goalLogs: PatientGoalLog[],
): Pick<GoalSummary, "status" | "detail"> {
  const today = getLocalDateString();

  if (goal.goal_type === "steps_daily") {
    const target = Number(goal.target_value) || 0;
    const todayStepLog = steps.find(
      (item) => item.patient_id === goal.patient_id && item.logged_on === today,
    );
    const currentSteps = Number(todayStepLog?.steps ?? 0);
    const targetLabel = target ? formatInteger(target) : "-";

    if (target && currentSteps >= target) {
      return {
        status: "fulfilled",
        detail: `${formatInteger(currentSteps)} de ${targetLabel} pasos`,
      };
    }

    if (currentSteps > 0) {
      return {
        status: "in_progress",
        detail: `${formatInteger(currentSteps)} de ${targetLabel} pasos`,
      };
    }

    return {
      status: "not_fulfilled",
      detail: target ? `Sin pasos hoy. Objetivo ${targetLabel}` : "Sin objetivo de pasos",
    };
  }

  if (goal.goal_type === "weight_logged") {
    const hasWeightToday = weights.some(
      (item) =>
        item.patient_id === goal.patient_id &&
        getLogDateKey(item.logged_at) === today,
    );

    return {
      status: hasWeightToday ? "fulfilled" : "not_fulfilled",
      detail: hasWeightToday ? "Peso registrado hoy" : "Peso pendiente hoy",
    };
  }

  if (goal.goal_type === "activity_logged") {
    const hasActivityToday = exercises.some(
      (item) =>
        item.patient_id === goal.patient_id &&
        getLogDateKey(item.logged_at) === today,
    );

    return {
      status: hasActivityToday ? "fulfilled" : "not_fulfilled",
      detail: hasActivityToday ? "Actividad registrada hoy" : "Actividad pendiente hoy",
    };
  }

  const todayGoalLog = goalLogs.find(
    (item) => item.goal_id === goal.id && item.logged_on === today,
  );
  return evaluateCustomGoalStatus(goal, todayGoalLog);
}

function compareGoals(first: PatientGoal, second: PatientGoal) {
  const order: Record<GoalType, number> = {
    steps_daily: 1,
    weight_logged: 2,
    activity_logged: 3,
    custom: 4,
  };

  return (
    order[first.goal_type] - order[second.goal_type] ||
    first.created_at.localeCompare(second.created_at)
  );
}

function formatGoalType(goal: PatientGoal) {
  if (goal.goal_type === "steps_daily") {
    const target = Number(goal.target_value) || 0;
    return target ? `${formatInteger(target)} pasos diarios -` : "Pasos diarios -";
  }

  if (goal.goal_type === "weight_logged") return "Registro de peso -";
  if (goal.goal_type === "activity_logged") return "Actividad -";
  return `${formatCustomGoalDefinition(goal)} -`;
}

function getCustomGoalInputType(goal: PatientGoal): CustomGoalInputType {
  return goal.custom_input_type ?? "check";
}

function getCustomGoalUnit(inputType: CustomGoalInputType) {
  if (inputType === "minutes") return "min";
  if (inputType === "sleep_hours") return "h";
  if (inputType === "number") return "cifra";
  return "hecho";
}

function getCustomGoalTargetLabel(inputType: CustomGoalInputType) {
  if (inputType === "minutes") return "Minutos objetivo";
  if (inputType === "sleep_hours") return "Horas objetivo";
  return "Cifra objetivo";
}

function getCustomGoalInputLabel(goal: PatientGoal) {
  const inputType = getCustomGoalInputType(goal);
  if (inputType === "minutes") return "Minutos de hoy";
  if (inputType === "sleep_hours") return "Horas de sueño";
  return "Cifra de hoy";
}

function formatCustomGoalDefinition(goal: PatientGoal) {
  const inputType = getCustomGoalInputType(goal);
  const target = Number(goal.target_value) || 0;

  if (inputType === "check") return "Sí/No";
  if (inputType === "minutes") return target ? `${formatInteger(target)} min objetivo` : "Minutos";
  if (inputType === "sleep_hours") return target ? `${target} h objetivo` : "Horas de sueño";
  return target ? `${target} objetivo` : "Cifra";
}

function getTodayGoalLog(goal: PatientGoal, goalLogs: PatientGoalLog[]) {
  const today = getLocalDateString();
  return (
    goalLogs.find(
      (item) => item.goal_id === goal.id && item.logged_on === today,
    ) ?? null
  );
}

function formatCustomGoalLog(
  goalLog: PatientGoalLog | null,
  goal: PatientGoal,
) {
  if (!goalLog) return "Sin registrar";

  const inputType = getCustomGoalInputType(goal);
  if (inputType === "check") {
    return goalLog.status === "fulfilled" ? "Hecho" : "No hecho";
  }

  if (goalLog.value === null || goalLog.value === undefined) return "Sin registrar";
  return formatCustomGoalValue(goalLog.value, inputType);
}

function formatCustomGoalValue(value: number, inputType: CustomGoalInputType) {
  if (inputType === "minutes") return `${formatInteger(value)} min`;
  if (inputType === "sleep_hours") return `${value} h`;
  return `${value}`;
}

function deriveNumericCustomGoalStatus(goal: PatientGoal, value: number | null) {
  if (getCustomGoalInputType(goal) === "sleep_hours") {
    return deriveSleepGoalStatus(goal, value);
  }

  const amount = Number(value ?? 0);
  const target = Number(goal.target_value) || 0;

  if (target > 0 && amount >= target) return "fulfilled";
  if (amount > 0) return target > 0 ? "in_progress" : "fulfilled";
  return "not_fulfilled";
}

function evaluateCustomGoalStatus(
  goal: PatientGoal,
  goalLog: PatientGoalLog | null | undefined,
): Pick<GoalSummary, "status" | "detail"> {
  const inputType = getCustomGoalInputType(goal);

  if (!goalLog) {
    return {
      status: "not_fulfilled",
      detail: "Pendiente de registrar hoy",
    };
  }

  if (inputType === "check") {
    return {
      status: goalLog.status,
      detail: goalLog.status === "fulfilled" ? "Marcado como hecho" : "Marcado como no hecho",
    };
  }

  const value = Number(goalLog.value ?? 0);
  const target = Number(goal.target_value) || 0;

  if (inputType === "sleep_hours") {
    const status = deriveSleepGoalStatus(goal, value);
    return {
      status,
      detail: getSleepGoalStatusMessage(status),
    };
  }

  const status = deriveNumericCustomGoalStatus(goal, value);
  const valueLabel = formatCustomGoalValue(value, inputType);
  const targetLabel = target
    ? formatCustomGoalValue(target, inputType)
    : "";

  return {
    status,
    detail: targetLabel ? `${valueLabel} de ${targetLabel}` : valueLabel,
  };
}

function deriveSleepGoalStatus(goal: PatientGoal, value: number | null): GoalStatus {
  const hours = Number(value ?? 0);
  const target = Number(goal.target_value) || 0;

  if (hours < 5) return "not_fulfilled";

  if (target > 0) {
    const fulfillmentRatio = hours / target;
    if (fulfillmentRatio >= 0.55 && fulfillmentRatio < 0.95) {
      return "in_progress";
    }
  }

  return "fulfilled";
}

function getSleepGoalStatusMessage(status: GoalStatus) {
  if (status === "not_fulfilled") return "Echate una siesta";
  if (status === "in_progress") return "Casi lo conseguiste";
  return "Conseguido";
}

function buildAvailableAppointmentSlots(
  availabilitySlots: AppointmentAvailability[],
  busySlots: CalendarBusySlot[],
  daysAhead: number,
): AvailableAppointmentSlot[] {
  const now = Date.now();
  const slots: AvailableAppointmentSlot[] = [];

  for (let dayOffset = 0; dayOffset < daysAhead; dayOffset += 1) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + dayOffset);
    const dateKey = getLocalDateString(date);
    const weekday = date.getDay();

    availabilitySlots
      .filter((slot) => slot.is_active && slot.weekday === weekday)
      .forEach((availability) => {
        const startMinutes = parseTimeToMinutes(availability.start_time);
        const endMinutes = parseTimeToMinutes(availability.end_time);
        const duration = availability.slot_minutes || 60;

        for (
          let cursor = startMinutes;
          cursor + duration <= endMinutes;
          cursor += duration
        ) {
          const startAt = buildLocalDateTimeIso(dateKey, minutesToTime(cursor));
          const endAt = buildLocalDateTimeIso(dateKey, minutesToTime(cursor + duration));
          const startsAtMs = new Date(startAt).getTime();

          if (startsAtMs <= now + 5 * 60 * 1000) continue;
          if (busySlots.some((busySlot) => timeRangesOverlap(startAt, endAt, busySlot.start_at, busySlot.end_at))) {
            continue;
          }

          slots.push({
            id: `${availability.id}-${dateKey}-${cursor}`,
            dateKey,
            startAt,
            endAt,
            label: `${formatShortWeekday(date)} ${formatTimeString(minutesToTime(cursor))}`,
          });
        }
      });
  }

  return slots.sort((first, second) => first.startAt.localeCompare(second.startAt));
}

function groupCalendarEventsByDay(events: CalendarEvent[]) {
  const grouped = new Map<string, CalendarEvent[]>();

  events.forEach((event) => {
    const dateKey = getLocalDateString(new Date(event.start_at));
    const dayEvents = grouped.get(dateKey) ?? [];
    dayEvents.push(event);
    grouped.set(dateKey, dayEvents.sort(compareCalendarEvents));
  });

  return grouped;
}

function getAgendaWeeks(weekCount: number) {
  const firstMonday = getMondayStart(new Date());

  return Array.from({ length: weekCount }, (_, weekIndex) =>
    Array.from({ length: 7 }, (_, dayIndex) => {
      const date = new Date(firstMonday);
      date.setDate(firstMonday.getDate() + weekIndex * 7 + dayIndex);
      const dateKey = getLocalDateString(date);

      return {
        dateKey,
        dayNumber: new Intl.DateTimeFormat("es-ES", { day: "2-digit" }).format(date),
        monthLabel: new Intl.DateTimeFormat("es-ES", { month: "short" }).format(date),
        isToday: dateKey === getLocalDateString(),
      };
    }),
  );
}

function getMondayStart(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  const weekday = date.getDay();
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  date.setDate(date.getDate() + mondayOffset);
  return date;
}

function countSlotsByDay(slots: AvailableAppointmentSlot[]) {
  const countByDay = new Map<string, number>();

  slots.forEach((slot) => {
    countByDay.set(slot.dateKey, (countByDay.get(slot.dateKey) ?? 0) + 1);
  });

  return countByDay;
}

function formatBookingDateLabel(dateKey: string) {
  return new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(new Date(`${dateKey}T12:00:00`));
}

function compareCalendarEvents(first: CalendarEvent, second: CalendarEvent) {
  return new Date(first.start_at).getTime() - new Date(second.start_at).getTime();
}

function getPatientName(patients: Patient[], patientId: string | null) {
  if (!patientId) return "";
  return patients.find((patient) => patient.id === patientId)?.full_name ?? "";
}

function getCalendarEventMeta(event: CalendarEvent) {
  if (event.status === "cancelled") {
    return {
      Icon: Ban,
      className: "border-[#d9d3c7] bg-[#f4f1ea] opacity-80",
    };
  }

  if (isPendingCalendarAppointment(event)) {
    return {
      Icon: Bell,
      className: "border-[#ead39b] bg-[#fff8df]",
    };
  }

  if (event.event_type === "appointment") {
    return {
      Icon: event.appointment_mode === "online" ? Video : MapPin,
      className: "border-[#b8dccd] bg-[#effaf5]",
    };
  }

  if (event.event_type === "block") {
    return {
      Icon: Ban,
      className: "border-[#efc4ba] bg-[#fff3f0]",
    };
  }

  return {
    Icon: FileText,
    className: "border-[#d9d3c7] bg-white",
  };
}

function isCalendarEventBlocking(event: CalendarEvent) {
  return event.blocks_availability && event.status !== "cancelled";
}

function isPendingCalendarAppointment(event: CalendarEvent) {
  return (
    event.event_type === "appointment" &&
    (event.status === "pending" ||
      (event.status === "scheduled" &&
        event.title === LEGACY_PENDING_APPOINTMENT_TITLE))
  );
}

function formatCalendarEventStatus(event: CalendarEvent) {
  if (isPendingCalendarAppointment(event)) return "Pendiente";
  if (event.status === "cancelled") return "Cancelada";
  return "Confirmada";
}

function getCalendarStatusClass(event: CalendarEvent) {
  if (isPendingCalendarAppointment(event)) return "bg-[#f3e2b2] text-[#6b5420]";
  if (event.status === "cancelled") return "bg-[#f7d7cf] text-[#8a3327]";
  return "bg-[#dcefe7] text-[#255d50]";
}

function buildConfirmedAppointmentTitle(event: CalendarEvent, patients: Patient[]) {
  const patientName = getPatientName(patients, event.patient_id);
  return patientName ? `Cita con ${patientName}` : "Cita con nutricionista";
}

function formatAppointmentMode(mode: AppointmentMode) {
  return mode === "online" ? "Online" : "Presencial";
}

function formatAgendaTimeRange(startAt: string, endAt: string) {
  return `${formatPhotoTime(startAt)} - ${formatPhotoTime(endAt)}`;
}

function buildLocalDateTimeIso(dateKey: string, time: string) {
  const [hours, minutes] = time.slice(0, 5).split(":").map(Number);
  const date = new Date(`${dateKey}T00:00:00`);
  date.setHours(hours || 0, minutes || 0, 0, 0);
  return date.toISOString();
}

function addMinutesIso(value: string, minutes: number) {
  return new Date(new Date(value).getTime() + minutes * 60 * 1000).toISOString();
}

function parseTimeToMinutes(value: string) {
  const [hours, minutes] = value.slice(0, 5).split(":").map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

function minutesToTime(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function formatTimeString(value: string) {
  return value.slice(0, 5);
}

function formatShortWeekday(date: Date) {
  return new Intl.DateTimeFormat("es-ES", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  }).format(date);
}

function timeRangesOverlap(
  firstStart: string,
  firstEnd: string,
  secondStart: string,
  secondEnd: string,
) {
  return (
    new Date(firstStart).getTime() < new Date(secondEnd).getTime() &&
    new Date(firstEnd).getTime() > new Date(secondStart).getTime()
  );
}

function getLogDateKey(value: string) {
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  return getLocalDateString(new Date(value));
}

function getMealTypePosition(mealType: string) {
  return mealTypeOrder.get(mealType) ?? mealTypes.length;
}

function getMealPhotoTypePosition(mealType: string | null) {
  return mealPhotoTypeOrder.get(mealType ?? "") ?? mealPhotoTypes.length;
}

function clampDurationPart(value: string, max: number) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return 0;
  return Math.min(max, Math.max(0, Math.trunc(numericValue)));
}

function formatDurationSeconds(totalSeconds: number | null | undefined) {
  const safeSeconds = Math.max(0, Math.trunc(Number(totalSeconds) || 0));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  const parts: string[] = [];

  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  if (seconds || parts.length === 0) parts.push(`${seconds}s`);

  return parts.join(" ");
}

function getExerciseDurationSeconds(log: ExerciseLog) {
  const durationSeconds = Number(log.duration_seconds);
  if (Number.isFinite(durationSeconds) && durationSeconds > 0) {
    return durationSeconds;
  }

  const durationMinutes = Number(log.duration_minutes);
  if (Number.isFinite(durationMinutes) && durationMinutes > 0) {
    return durationMinutes * 60;
  }

  return 0;
}

function getExerciseDistanceKm(log: ExerciseLog) {
  const distance = Number(log.distance_km);
  return Number.isFinite(distance) && distance > 0 ? distance : 0;
}

function formatActivityDistance(distanceKm: number | null | undefined) {
  const distance = Number(distanceKm);
  if (!Number.isFinite(distance) || distance <= 0) return "0 km";

  return `${distance.toLocaleString("es-ES", {
    maximumFractionDigits: distance >= 10 ? 1 : 2,
  })} km`;
}

function formatDistanceForInput(distanceKm: number | null | undefined) {
  const totalMeters = Math.max(0, Math.round((Number(distanceKm) || 0) * 1000));
  const kilometers = Math.floor(totalMeters / 1000);
  const meters = totalMeters % 1000;

  return `${kilometers} km ${meters} m`;
}

function formatDistanceKmForStorage(totalMeters: number) {
  return (totalMeters / 1000).toFixed(3).replace(/\.?0+$/, "");
}

function addDaysToDateKey(dateKey: string, days: number) {
  const date = parseLocalDateKey(dateKey);
  date.setDate(date.getDate() + days);
  return getLocalDateString(date);
}

function buildActivityWeekKeys(exercises: ExerciseLog[], currentWeekStart: string) {
  const weekKeys = new Set<string>([currentWeekStart]);

  for (const exercise of exercises) {
    weekKeys.add(getMondayDateKey(exercise.logged_at));
  }

  return Array.from(weekKeys).sort((a, b) => b.localeCompare(a));
}

function buildActivityWeekSummary(
  exercises: ExerciseLog[],
  weekStart: string,
): ActivityWeekSummary {
  const weekEnd = addDaysToDateKey(weekStart, 6);
  const days = activityWeekdayLabels.map((label, index) => {
    const dateKey = addDaysToDateKey(weekStart, index);
    const logs = exercises
      .filter((log) => getLogDateKey(log.logged_at) === dateKey)
      .sort((a, b) => new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime());
    const durationSeconds = logs.reduce(
      (total, log) => total + getExerciseDurationSeconds(log),
      0,
    );
    const distanceKm = logs.reduce(
      (total, log) => total + getExerciseDistanceKm(log),
      0,
    );

    return {
      dateKey,
      label,
      shortLabel: activityWeekdayShortLabels[index] ?? label.slice(0, 1),
      durationSeconds,
      distanceKm,
      logs,
    };
  });

  return {
    weekStart,
    weekEnd,
    durationSeconds: days.reduce((total, day) => total + day.durationSeconds, 0),
    distanceKm: days.reduce((total, day) => total + day.distanceKm, 0),
    activityCount: days.reduce((total, day) => total + day.logs.length, 0),
    days,
  };
}

function buildPreviousActivityWeekAverage(
  exercises: ExerciseLog[],
  selectedWeekStart: string,
  numberOfWeeks: number,
) {
  const summaries = Array.from({ length: numberOfWeeks }, (_, index) =>
    buildActivityWeekSummary(
      exercises,
      addDaysToDateKey(selectedWeekStart, -7 * (index + 1)),
    ),
  );

  return {
    durationSeconds:
      summaries.reduce((total, summary) => total + summary.durationSeconds, 0) /
      numberOfWeeks,
    distanceKm:
      summaries.reduce((total, summary) => total + summary.distanceKm, 0) /
      numberOfWeeks,
    activityCount:
      summaries.reduce((total, summary) => total + summary.activityCount, 0) /
      numberOfWeeks,
  };
}

function formatActivityComparison(current: number, reference: number, label: string) {
  if (!reference) {
    return `${label}: sin referencia`;
  }

  const change = ((current - reference) / reference) * 100;
  if (Math.abs(change) < 1) return `${label}: igual`;

  return `${label}: ${change > 0 ? "+" : ""}${Math.round(change)}%`;
}

function formatActivityWeekTitle(summary: ActivityWeekSummary) {
  const currentWeekStart = getMondayDateKey(getLocalDateString());
  const previousWeekStart = addDaysToDateKey(currentWeekStart, -7);

  if (summary.weekStart === currentWeekStart) return "Esta semana";
  if (summary.weekStart === previousWeekStart) return "Última semana";

  return `${formatDate(`${summary.weekStart}T12:00:00`)} - ${formatDate(
    `${summary.weekEnd}T12:00:00`,
  )}`;
}

function groupMealPhotosByDay(photos: MealPhoto[]) {
  const groups = new Map<string, MealPhoto[]>();

  for (const photo of photos) {
    const dateKey = getLocalDateString(new Date(photo.logged_at));
    groups.set(dateKey, [...(groups.get(dateKey) ?? []), photo]);
  }

  return Array.from(groups.entries())
    .map(([dateKey, groupPhotos]) => ({
      dateKey,
      photos: groupPhotos
        .slice()
        .sort(
          (a, b) =>
            getMealPhotoTypePosition(a.meal_type) -
              getMealPhotoTypePosition(b.meal_type) ||
            new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime(),
        ),
    }))
    .sort((a, b) => b.dateKey.localeCompare(a.dateKey));
}

function buildWeightChartData(weights: WeightLog[]) {
  return weights
    .slice()
    .sort((a, b) => new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime())
    .map((item) => ({
      date: formatShortEuropeanDate(item.logged_at),
      peso: Number(item.weight_kg),
    }));
}

function buildWaistChartData(waists: WaistLog[]) {
  return waists
    .slice()
    .sort((a, b) => new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime())
    .map((item) => ({
      date: formatShortEuropeanDate(item.logged_at),
      cintura: Number(item.waist_cm),
    }));
}

function buildStepChartData(steps: StepLog[]) {
  const sortedSteps = steps
    .slice()
    .sort((a, b) => new Date(a.logged_on).getTime() - new Date(b.logged_on).getTime());
  const weeklyValues = new Map<string, number[]>();

  for (const item of sortedSteps) {
    const weekKey = getMondayDateKey(item.logged_on);
    weeklyValues.set(weekKey, [...(weeklyValues.get(weekKey) ?? []), Number(item.steps)]);
  }

  const weeklyAverageByKey = new Map(
    Array.from(weeklyValues.entries()).map(([weekKey, values]) => [
      weekKey,
      Math.round(values.reduce((total, value) => total + value, 0) / values.length),
    ]),
  );

  return sortedSteps.map((item) => {
    const weekKey = getMondayDateKey(item.logged_on);

    return {
      date: formatShortEuropeanDate(item.logged_on),
      pasos: Number(item.steps),
      mediaSemanal: weeklyAverageByKey.get(weekKey) ?? Number(item.steps),
    };
  });
}

function buildBmiChartData(weights: WeightLog[], heightCm: number) {
  return weights
    .slice()
    .sort((a, b) => new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime())
    .map((item) => ({
      date: formatShortEuropeanDate(item.logged_at),
      imc: roundNumber(calculateBmi(item.weight_kg, heightCm), 1),
    }))
    .filter((item): item is { date: string; imc: number } => item.imc !== null);
}

function formatShortEuropeanDate(value: string) {
  const dateKey = getLogDateKey(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    return `${dateKey.slice(8, 10)}/${dateKey.slice(5, 7)}`;
  }

  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(value));
}

function getMondayDateKey(value: string) {
  const date = parseLocalDateKey(getLogDateKey(value));
  const dayOffset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - dayOffset);
  return getLocalDateString(date);
}

function parseLocalDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function getMinimumChartSpan(dataKey: string) {
  if (dataKey === "peso") return 8;
  if (dataKey === "cintura") return 10;
  if (dataKey === "imc") return 4;
  return 1;
}

function getChartDomain(
  data: Array<Record<string, number | string | undefined>>,
  dataKey: string,
  minSpan: number,
) {
  const values = data
    .map((item) => Number(item[dataKey]))
    .filter((value) => Number.isFinite(value));

  return buildStableDomain(values, minSpan);
}

function getStepChartDomain(
  data: Array<{ pasos: number; mediaSemanal: number }>,
  goalTarget: number | null,
) {
  const values = data.flatMap((item) => [item.pasos, item.mediaSemanal]);
  if (goalTarget) values.push(goalTarget);

  return buildStableDomain(values, goalTarget ? goalTarget * 1.2 : 10000, 0);
}

function buildStableDomain(values: number[], minSpan: number, floor?: number) {
  if (values.length === 0) return undefined;

  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const rawSpan = Math.max(maxValue - minValue, minSpan);
  const span = rawSpan * 1.25;
  const center = (minValue + maxValue) / 2;
  let lower = center - span / 2;
  let upper = center + span / 2;

  if (floor !== undefined && lower < floor) {
    upper += floor - lower;
    lower = floor;
  }

  return [Math.floor(lower * 10) / 10, Math.ceil(upper * 10) / 10] as [number, number];
}

function formatChartTooltipValue(value: number | string) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return value;
  if (Number.isInteger(numericValue)) return formatInteger(numericValue);
  return numericValue.toLocaleString("es-ES", { maximumFractionDigits: 1 });
}

function getLatestWeightLog(weights: WeightLog[]) {
  return (
    weights
      .slice()
      .sort((a, b) => new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime())[0] ??
    null
  );
}

function getCurrentWeightKg(patient: Patient | null, weights: WeightLog[]) {
  return getLatestWeightLog(weights)?.weight_kg ?? patient?.current_weight_kg ?? null;
}

function calculateBmi(
  weightKg: number | null | undefined,
  heightCm: number | null | undefined,
) {
  const weight = Number(weightKg);
  const height = Number(heightCm);
  if (!weight || !height) return null;
  const heightM = height / 100;
  return weight / (heightM * heightM);
}

function calculateBasalCalories(
  patient: Patient,
  currentWeightKg: number | null | undefined = patient.current_weight_kg,
) {
  const weight = Number(currentWeightKg);
  const height = Number(patient.height_cm);
  const age = Number(patient.age);
  if (!patient.sex || !weight || !height || !age) return null;

  const value =
    patient.sex === "male"
      ? 88.362 + 13.397 * weight + 4.799 * height - 5.677 * age
      : 447.593 + 9.247 * weight + 3.098 * height - 4.33 * age;

  return Math.round(value);
}

function roundNumber(value: number | null, digits: number) {
  if (value === null) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function formatOptionalNumber(value: number | null, digits: number) {
  if (value === null) return "-";
  return value.toFixed(digits);
}

function formatInteger(value: number | string) {
  return Number(value).toLocaleString("es-ES", { maximumFractionDigits: 0 });
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = `${value}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from(rawData, (char) => char.charCodeAt(0));
}

function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatSex(sex: Patient["sex"]) {
  if (sex === "male") return "Hombre";
  if (sex === "female") return "Mujer";
  return null;
}

async function getCurrentAccessToken(
  supabase: ReturnType<typeof createSupabaseBrowser>,
) {
  if (!supabase) return "";

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) return "";

  const expiresAtMs = session.expires_at ? session.expires_at * 1000 : 0;
  if (session.access_token && expiresAtMs - Date.now() > 60_000) {
    return session.access_token;
  }

  const { data, error } = await supabase.auth.refreshSession();
  if (error) {
    return expiresAtMs && expiresAtMs <= Date.now()
      ? ""
      : session.access_token ?? "";
  }

  return data.session?.access_token ?? "";
}

function useStoredDraft<T extends Record<string, string>>(
  key: string,
  initialValue: T,
) {
  const [draft, setDraft, clearDraft] = useStoredValue(key, initialValue);

  return [draft, setDraft, clearDraft] as const;
}

function useStoredValue<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() =>
    readStoredValue(key, initialValue),
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  const clearValue = useCallback(() => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(key);
    }
    setValue(initialValue);
  }, [initialValue, key]);

  return [value, setValue, clearValue] as const;
}

function readStoredValue<T>(
  key: string,
  initialValue: T,
) {
  if (typeof window === "undefined") return initialValue;

  try {
    const rawValue = window.localStorage.getItem(key);
    if (!rawValue) return initialValue;
    const storedValue = JSON.parse(rawValue) as T;
    if (
      typeof initialValue === "object" &&
      initialValue !== null &&
      !Array.isArray(initialValue) &&
      typeof storedValue === "object" &&
      storedValue !== null &&
      !Array.isArray(storedValue)
    ) {
      return {
        ...initialValue,
        ...storedValue,
      };
    }
    return storedValue;
  } catch {
    return initialValue;
  }
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatPhotoDayLabel(dateKey: string) {
  const today = getLocalDateString();
  const yesterday = getLocalDateString(new Date(Date.now() - 24 * 60 * 60 * 1000));
  const formattedDate = formatDate(`${dateKey}T12:00:00`);

  if (dateKey === today) return `Hoy - ${formattedDate}`;
  if (dateKey === yesterday) return `Ayer - ${formattedDate}`;
  return formattedDate;
}

function formatPhotoTime(value: string) {
  return new Intl.DateTimeFormat("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatPhotoCount(count: number) {
  return `${count} foto${count === 1 ? "" : "s"}`;
}

function safeFileName(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9.\-_]/g, "-")
    .replace(/-+/g, "-");
}

async function optimizeMealPhotoFile(file: File) {
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") {
    return file;
  }

  const imageUrl = URL.createObjectURL(file);

  try {
    const image = await loadImageElement(imageUrl);
    const scale = Math.min(
      1,
      maxMealPhotoDimension / Math.max(image.naturalWidth, image.naturalHeight),
    );

    if (scale >= 1 && file.size <= 900 * 1024) return file;

    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) return file;

    context.drawImage(image, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", mealPhotoQuality);
    });

    if (!blob || blob.size >= file.size) return file;

    const baseName = file.name.replace(/\.[^.]+$/, "");
    return new File([blob], `${baseName || "foto-comida"}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

function loadImageElement(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("No se pudo preparar la imagen."));
    image.src = src;
  });
}
