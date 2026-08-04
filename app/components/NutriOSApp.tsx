"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Archive,
  Bell,
  BookOpen,
  CalendarDays,
  Camera,
  Check,
  ChevronRight,
  ClipboardList,
  Copy,
  FileText,
  Footprints,
  Frown,
  ImagePlus,
  KeyRound,
  LifeBuoy,
  Loader2,
  Meh,
  LogOut,
  MessageCircle,
  Palette,
  Pencil,
  Plus,
  RotateCcw,
  Send,
  Settings as SettingsIcon,
  ShieldCheck,
  Smile,
  Target,
  Trash2,
  Upload,
  UserPlus,
  Users,
  Weight,
  X,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
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
  APP_LOGO_WITH_SLOGAN_SRC,
  APP_NAME,
} from "../lib/brand";
import type { Tenant } from "../lib/types";

type UserRole = "owner" | "nutritionist" | "patient";

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
  intensity: string | null;
  logged_at: string;
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
  created_at: string;
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
  meal_type: string;
  title: string;
  description: string | null;
  position: number;
};

type DraftMealItem = {
  dayIndex: number;
  mealType: string;
  title: string;
  description: string;
};

type TabId =
  | "patients"
  | "plans"
  | "goals"
  | "data-entry"
  | "stats"
  | "tracking"
  | "chat"
  | "documents"
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
  { id: "patients", label: "Clientes", icon: Users },
  { id: "plans", label: "Dietas", icon: BookOpen },
  { id: "goals", label: "Objetivos", icon: Target },
  { id: "data-entry", label: "Registro de datos", icon: Plus, patientOnly: true },
  { id: "stats", label: "Estadísticas", icon: Activity },
  { id: "chat", label: "Chat", icon: MessageCircle },
  { id: "documents", label: "Documentos", icon: FileText },
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

const mealTypes = ["Desayuno", "Media mañana", "Comida", "Merienda", "Cena"];
const mealPhotoTypes = [...mealTypes, "Snack"];
const maxLogoFileSizeBytes = 2 * 1024 * 1024;
const maxMealPhotoDimension = 1600;
const mealPhotoQuality = 0.82;

const mealTypeOrder = new Map(mealTypes.map((mealType, index) => [mealType, index]));
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
    iconClass: "bg-[#dcefe7] text-[#2f7d6d]",
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
  primary_color: "#2f7d6d",
  privacy_policy_url: null,
});

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
          meal_type: "Desayuno",
          title: "Yogur sin lactosa con avena",
          description: "Añadir frutos rojos y nueces.",
          position: 1,
        },
        {
          id: "item-2",
          meal_type: "Comida",
          title: "Pollo con arroz integral",
          description: "Verduras salteadas y aceite de oliva.",
          position: 2,
        },
      ],
    },
  ],
};

export function NutriOSApp({
  tenantSlug,
  initialTenant,
  supabaseConfig,
}: {
  tenantSlug: string;
  initialTenant?: Tenant | null;
  supabaseConfig?: SupabasePublicConfig | null;
}) {
  const supabase = useMemo(
    () => createSupabaseBrowser(supabaseConfig),
    [supabaseConfig],
  );
  const isDemo = !supabase;
  const [tenant, setTenant] = useState<Tenant>(
    initialTenant ?? demoTenant(tenantSlug),
  );
  const [role, setRole] = useState<UserRole | null>(isDemo ? "nutritionist" : null);
  const [sessionUserId, setSessionUserId] = useState(isDemo ? "demo-nutritionist" : "");
  const [patients, setPatients] = useState<Patient[]>(demoPatients);
  const [pendingInvitations, setPendingInvitations] =
    useState<PendingInvitation[]>(demoPendingInvitations);
  const [selectedPatientId, setSelectedPatientId] = useStoredValue(
    `nutrios:${tenantSlug}:selected-patient`,
    demoPatients[0]?.id ?? "",
  );
  const [weights, setWeights] = useState<WeightLog[]>(demoWeights);
  const [waists, setWaists] = useState<WaistLog[]>(demoWaist);
  const [steps, setSteps] = useState<StepLog[]>(demoSteps);
  const [goals, setGoals] = useState<PatientGoal[]>(demoGoals);
  const [goalLogs, setGoalLogs] = useState<PatientGoalLog[]>(demoGoalLogs);
  const [exercises, setExercises] = useState<ExerciseLog[]>([]);
  const [mealPhotos, setMealPhotos] = useState<MealPhoto[]>([]);
  const [documents, setDocuments] = useState<DocumentFile[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([demoConversation]);
  const [messages, setMessages] = useState<ChatMessage[]>(demoMessages);
  const [plans, setPlans] = useState<MealPlan[]>([demoPlan]);
  const [activeTab, setActiveTab] = useStoredValue<TabId>(
    `nutrios:${tenantSlug}:active-tab`,
    "patients",
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
  const showGoalsPanel =
    activeTab === "goals" ||
    (role === "patient" && activeTab === "data-entry");

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

    const { data: tenantRow } = await supabase
      .from("tenants")
      .select("*")
      .eq("slug", tenantSlug)
      .maybeSingle();

    const resolvedTenant = (tenantRow as Tenant | null) ?? initialTenant ?? null;

    if (!resolvedTenant) {
      setWorkspaceError(
        `No existe ningun nutricionista configurado para ${tenantSlug}.`,
      );
      finishLoading();
      return;
    }

    setTenant(resolvedTenant);

    if (!session) {
      finishLoading();
      return;
    }

    setSessionUserId(session.user.id);

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

    setRole(membership.role as UserRole);

    if (["owner", "nutritionist"].includes(membership.role)) {
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
      membership.role === "patient"
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
    if (patientIds.length === 0) {
      setWeights([]);
      setWaists([]);
      setSteps([]);
      setGoals([]);
      setGoalLogs([]);
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
  }, [initialTenant, setSelectedPatientId, supabase, tenantSlug, withSignedUrls]);

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

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setNotice("");
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
    const resetPath = `/auth/reset-password?next=${encodeURIComponent(`/n/${tenantSlug}`)}`;
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
      <main className="nutrios-app tenant-bg flex min-h-screen items-center justify-center px-4" style={appStyle}>
        <section className="w-full max-w-md rounded-lg border border-[var(--line)] bg-[var(--panel)] p-6 shadow-[var(--shadow-soft)]">
          <Brand tenant={tenant} compact={false} />
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
                    title={
                      role === "patient" && tab.id === "patients"
                        ? "Mi Ficha Personal"
                        : tab.label
                    }
                  >
                    <Icon className="size-4 shrink-0" />
                    <span
                      className={`whitespace-nowrap transition-opacity lg:overflow-hidden ${
                        sidebarExpanded ? "lg:w-auto lg:opacity-100" : "lg:w-0 lg:opacity-0"
                      }`}
                    >
                      {role === "patient" && tab.id === "patients"
                        ? "Mi Ficha Personal"
                        : tab.label}
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
          <Header tenant={tenant} role={role} selectedPatient={selectedPatient} />
          {workspaceError && (
            <div className="mt-5 rounded-lg border border-[#e8d9aa] bg-[#fff8df] px-4 py-3 text-sm text-[#6b5420]">
              {workspaceError}
            </div>
          )}
          {showGoalsPanel && (
            <GoalsPanel
              tenant={tenant}
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
                role={role}
                tenant={tenant}
                selectedPatient={selectedPatient}
                supabase={supabase}
                goals={goals.filter((goal) => goal.patient_id === selectedPatientId)}
                goalLogs={patientGoalLogs}
                onNotice={setNotice}
                onReload={loadWorkspace}
              />
            )}
            {activeTab === "stats" && (
              <StatsPanel
                selectedPatient={selectedPatient}
                weights={patientWeights}
                waists={patientWaists}
                steps={patientSteps}
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
            {activeTab === "settings" && (
              <SettingsPanel
                tenant={tenant}
                role={role}
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
  tenant,
  selectedPatient,
  goals,
  weights,
  steps,
  exercises,
  goalLogs,
}: {
  tenant: Tenant;
  selectedPatient: Patient | null;
  goals: PatientGoal[];
  weights: WeightLog[];
  steps: StepLog[];
  exercises: ExerciseLog[];
  goalLogs: PatientGoalLog[];
}) {
  const [isOpen, setIsOpen] = useStoredValue(
    `nutrios:${tenant.slug}:goals-panel-open`,
    true,
  );
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
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 text-left"
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
      >
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
        <ChevronRight
          className={`size-5 shrink-0 text-[var(--muted)] transition ${
            isOpen ? "rotate-90" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="mt-4">
          {!selectedPatient ? (
            <EmptyState text="No hay cliente seleccionado." />
          ) : (
            <>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {goalSummaries.map((summary) => (
                  <GoalStatusCard key={summary.id} summary={summary} />
                ))}
                {goalSummaries.length === 0 && (
                  <EmptyState text="Sin objetivos activos para hoy." />
                )}
              </div>
            </>
          )}
        </div>
      )}
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
      <div className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-lg bg-white p-1.5 shadow-sm ring-1 ring-[var(--line)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={APP_ICON_SRC} alt="" className="h-full w-full object-contain" />
      </div>
      <div
        className={`min-w-0 ${
          collapsible && expanded
            ? "lg:w-auto lg:overflow-hidden lg:opacity-100 lg:transition-opacity"
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
}: {
  tenant: Tenant;
  role: UserRole | null;
  selectedPatient: Patient | null;
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
        <Pill icon={ShieldCheck} label="GDPR preparado" />
        <Pill icon={Bell} label="Chat en tiempo real" />
      </div>
    </header>
  );
}

function AppFooter() {
  return (
    <footer className="mt-8 flex flex-col gap-3 border-t border-[var(--line)] py-5 text-sm text-[var(--muted)] sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="font-semibold text-[#39433f]">
          © 2026 EgmAnalytics. Todos los derechos reservados.
        </p>
        <p className="mt-1">DietDesk es propiedad de EgmAnalytics.</p>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={APP_LOGO_WITH_SLOGAN_SRC}
        alt="DietDesk. Menos gestion. Mas nutricion."
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
            value={basalCalories ? `${basalCalories} kcal/dia` : "Faltan datos para calcular"}
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
  selectedPatient,
  plans,
  supabase,
  onNotice,
  onReload,
}: {
  role: UserRole | null;
  tenant: Tenant;
  selectedPatient: Patient | null;
  plans: MealPlan[];
  supabase: ReturnType<typeof createSupabaseBrowser>;
  onNotice: (message: string) => void;
  onReload: () => Promise<void>;
}) {
  const emptyPlanDraft = useMemo(
    () => ({
      title: "Plan semanal",
      startDate: new Date().toISOString().slice(0, 10),
      draftItems: [
        { dayIndex: 1, mealType: "Desayuno", title: "", description: "" },
      ] as DraftMealItem[],
    }),
    [],
  );
  const [planDraft, setPlanDraft, clearPlanDraft] = useStoredValue(
    `nutrios:draft:plan:${selectedPatient?.id ?? "none"}`,
    emptyPlanDraft,
  );

  async function savePlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedPatient) return;
    if (!supabase) {
      onNotice("Modo demo: conecta Supabase para guardar dietas reales.");
      return;
    }

    const items = planDraft.draftItems.filter((item) => item.title.trim());
    const { data: plan, error: planError } = await supabase
      .from("meal_plans")
      .insert({
        tenant_id: tenant.id,
        patient_id: selectedPatient.id,
        title: planDraft.title,
        start_date: planDraft.startDate,
        status: "published",
      })
      .select("id")
      .single();

    if (planError || !plan) {
      onNotice(planError?.message ?? "No se pudo guardar la dieta.");
      return;
    }

    const dayRows = Array.from(new Set(items.map((item) => item.dayIndex))).map((dayIndex) => ({
      meal_plan_id: plan.id,
      day_index: dayIndex,
      day_label: dayLabels[dayIndex - 1],
    }));

    const { data: insertedDays, error: dayError } = await supabase
      .from("meal_plan_days")
      .insert(dayRows)
      .select("id,day_index");

    if (dayError || !insertedDays) {
      onNotice(dayError?.message ?? "No se pudieron guardar los dias.");
      return;
    }

    const mealRows = items.map((item, index) => ({
      meal_plan_day_id: insertedDays.find((day) => day.day_index === item.dayIndex)?.id,
      meal_type: item.mealType,
      title: item.title,
      description: item.description,
      position: index + 1,
    }));

    const { error: itemError } = await supabase.from("meal_items").insert(mealRows);
    if (itemError) {
      onNotice(itemError.message);
      return;
    }

    onNotice("Dieta publicada para el cliente.");
    clearPlanDraft();
    await onReload();
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

  return (
    <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
      {role !== "patient" && (
        <Panel>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-black">Crear dieta</h2>
            <ClipboardList className="size-5 text-[var(--tenant-color)]" />
          </div>
          <form className="mt-5 space-y-4" onSubmit={savePlan}>
            <Field
              label="Titulo"
              value={planDraft.title}
              onChange={(value) => updatePlanDraft({ title: value })}
              required
            />
            <Field
              label="Fecha inicio"
              type="date"
              value={planDraft.startDate}
              onChange={(value) => updatePlanDraft({ startDate: value })}
              required
            />
            <div className="space-y-3">
              {planDraft.draftItems.map((item, index) => (
                <div key={index} className="rounded-lg border border-[var(--line)] bg-white p-3">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <SelectField
                      label="Dia"
                      value={String(item.dayIndex)}
                      onChange={(value) => updateDraftItem(index, { dayIndex: Number(value) })}
                      options={dayLabels.map((label, dayIndex) => ({
                        value: String(dayIndex + 1),
                        label,
                      }))}
                    />
                    <SelectField
                      label="Comida"
                      value={item.mealType}
                      onChange={(value) => updateDraftItem(index, { mealType: value })}
                      options={mealTypes.map((label) => ({
                        value: label,
                        label,
                      }))}
                    />
                  </div>
                  <Field
                    label="Plato"
                    value={item.title}
                    onChange={(value) => updateDraftItem(index, { title: value })}
                  />
                  <TextArea
                    label="Indicaciones"
                    value={item.description}
                    onChange={(value) => updateDraftItem(index, { description: value })}
                  />
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--line)] bg-white px-4 text-sm font-semibold"
                onClick={() =>
                  setPlanDraft((current) => ({
                    ...current,
                    draftItems: [
                      ...current.draftItems,
                      { dayIndex: 1, mealType: "Comida", title: "", description: "" },
                    ],
                  }))
                }
              >
                <Plus className="size-4" />
                Añadir comida
              </button>
              <button className="inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--tenant-color)] px-4 text-sm font-semibold text-white">
                <Check className="size-4" />
                Publicar
              </button>
            </div>
          </form>
        </Panel>
      )}

      <Panel className={role === "patient" ? "xl:col-span-2" : ""}>
        <h2 className="text-lg font-black">Dieta publicada</h2>
        <div className="mt-4 grid gap-4">
          {plans.map((plan) => (
            <MealPlanCard
              key={plan.id}
              plan={plan}
              role={role}
              supabase={supabase}
              onNotice={onNotice}
              onReload={onReload}
              onDeletePlan={deletePlan}
            />
          ))}
          {plans.length === 0 && <EmptyState text="No hay dietas publicadas para este cliente." />}
        </div>
      </Panel>
    </div>
  );

  function updatePlanDraft(patch: Partial<Omit<typeof emptyPlanDraft, "draftItems">>) {
    setPlanDraft((current) => ({
      ...current,
      ...patch,
    }));
  }

  function updateDraftItem(index: number, patch: Partial<DraftMealItem>) {
    setPlanDraft((current) => ({
      ...current,
      draftItems: current.draftItems.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    }));
  }
}

function MealPlanCard({
  plan,
  role,
  supabase,
  onNotice,
  onReload,
  onDeletePlan,
}: {
  plan: MealPlan;
  role: UserRole | null;
  supabase: ReturnType<typeof createSupabaseBrowser>;
  onNotice: (message: string) => void;
  onReload: () => Promise<void>;
  onDeletePlan: (plan: MealPlan) => Promise<void>;
}) {
  const isEditable = role !== "patient";
  const sortedDays = dayLabels.map((label, index) => {
    const dayIndex = index + 1;
    const existingDay =
      (plan.meal_plan_days ?? []).find((day) => day.day_index === dayIndex) ??
      null;
    return { dayIndex, label, day: existingDay };
  });

  return (
    <div className="rounded-lg border border-[var(--line)] bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-black">{plan.title}</p>
          <p className="text-sm text-[var(--muted)]">
            Inicio {formatDate(plan.start_date)} - {plan.status}
          </p>
        </div>
        {isEditable && (
          <button
            type="button"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#e8c7be] bg-[#fff3ef] px-3 text-xs font-bold text-[#8d3c2f]"
            onClick={() => onDeletePlan(plan)}
          >
            <Trash2 className="size-4" />
            Borrar dieta
          </button>
        )}
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {sortedDays.map(({ dayIndex, label, day }) => (
          <MealPlanDayEditor
            key={`${plan.id}-${dayIndex}`}
            planId={plan.id}
            dayIndex={dayIndex}
            dayLabel={label}
            day={day}
            isEditable={isEditable}
            supabase={supabase}
            onNotice={onNotice}
            onReload={onReload}
          />
        ))}
      </div>
    </div>
  );
}

function MealPlanDayEditor({
  planId,
  dayIndex,
  dayLabel,
  day,
  isEditable,
  supabase,
  onNotice,
  onReload,
}: {
  planId: string;
  dayIndex: number;
  dayLabel: string;
  day: MealPlanDay | null;
  isEditable: boolean;
  supabase: ReturnType<typeof createSupabaseBrowser>;
  onNotice: (message: string) => void;
  onReload: () => Promise<void>;
}) {
  const [newMealType, setNewMealType] = useState("Comida");
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [isAddingMeal, setIsAddingMeal] = useState(false);
  const sortedItems = [...(day?.meal_items ?? [])].sort(
    (a, b) =>
      getMealTypePosition(a.meal_type) - getMealTypePosition(b.meal_type) ||
      a.position - b.position,
  );

  async function addMeal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newTitle.trim()) {
      onNotice("Escribe el plato antes de añadir la comida.");
      return;
    }
    if (!supabase) {
      onNotice("Modo demo: conecta Supabase para editar dietas reales.");
      return;
    }

    let dayId = day?.id;
    if (!dayId) {
      const { data: insertedDay, error: dayError } = await supabase
        .from("meal_plan_days")
        .insert({
          meal_plan_id: planId,
          day_index: dayIndex,
          day_label: dayLabel,
        })
        .select("id")
        .single();

      if (dayError || !insertedDay) {
        onNotice(dayError?.message ?? "No se pudo crear el dia de la dieta.");
        return;
      }

      dayId = insertedDay.id;
    }

    const nextPosition =
      sortedItems.reduce((max, item) => Math.max(max, item.position), 0) + 1;
    const { error } = await supabase.from("meal_items").insert({
      meal_plan_day_id: dayId,
      meal_type: newMealType,
      title: newTitle.trim(),
      description: newDescription.trim() || null,
      position: nextPosition,
    });

    if (error) {
      onNotice(error.message);
      return;
    }

    setNewMealType("Comida");
    setNewTitle("");
    setNewDescription("");
    setIsAddingMeal(false);
    onNotice("Comida anadida a la dieta.");
    await onReload();
  }

  return (
    <div className="rounded-lg bg-[#f7f5ef] p-3">
      <p className="font-bold">{dayLabel}</p>
      <div className="mt-2 space-y-2">
        {sortedItems.map((item) =>
          isEditable ? (
            <EditableMealItem
              key={item.id}
              item={item}
              supabase={supabase}
              onNotice={onNotice}
              onReload={onReload}
            />
          ) : (
            <div key={item.id} className="rounded-md bg-white px-3 py-2 text-sm">
              <p className="font-semibold">
                {item.meal_type}: {item.title}
              </p>
              {item.description && (
                <p className="mt-1 text-[var(--muted)]">{item.description}</p>
              )}
            </div>
          ),
        )}
        {sortedItems.length === 0 && (
          <p className="rounded-md border border-dashed border-[#d8d1c4] px-3 py-2 text-sm text-[var(--muted)]">
            Sin comidas para este dia.
          </p>
        )}
      </div>
      {isEditable && !isAddingMeal && (
        <button
          type="button"
          className="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-[var(--line)] bg-white px-3 text-xs font-bold text-[#53605a]"
          onClick={() => setIsAddingMeal(true)}
        >
          <Plus className="size-4" />
          Añadir comida
        </button>
      )}
      {isEditable && isAddingMeal && (
        <form className="mt-3 rounded-md border border-[var(--line)] bg-white p-3" onSubmit={addMeal}>
          <div className="grid gap-2">
            <SelectField
              label="Comida"
              value={newMealType}
              onChange={setNewMealType}
              options={mealTypes.map((label) => ({ value: label, label }))}
            />
            <Field label="Plato" value={newTitle} onChange={setNewTitle} />
            <TextArea
              label="Indicaciones"
              value={newDescription}
              onChange={setNewDescription}
            />
            <div className="flex flex-wrap gap-2">
              <button className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-lg bg-[var(--tenant-color)] px-3 text-xs font-bold text-white">
                <Check className="size-4" />
                Guardar
              </button>
              <button
                type="button"
                className="inline-flex h-9 items-center justify-center rounded-lg border border-[var(--line)] bg-white px-3 text-xs font-bold text-[#53605a]"
                onClick={() => {
                  setIsAddingMeal(false);
                  setNewMealType("Comida");
                  setNewTitle("");
                  setNewDescription("");
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}

function EditableMealItem({
  item,
  supabase,
  onNotice,
  onReload,
}: {
  item: MealItem;
  supabase: ReturnType<typeof createSupabaseBrowser>;
  onNotice: (message: string) => void;
  onReload: () => Promise<void>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [mealType, setMealType] = useState(item.meal_type);
  const [title, setTitle] = useState(item.title);
  const [description, setDescription] = useState(item.description ?? "");

  async function saveMeal() {
    if (!title.trim()) {
      onNotice("El plato no puede quedar vacio.");
      return;
    }
    if (!supabase) {
      onNotice("Modo demo: conecta Supabase para editar dietas reales.");
      return;
    }

    const { error } = await supabase
      .from("meal_items")
      .update({
        meal_type: mealType,
        title: title.trim(),
        description: description.trim() || null,
      })
      .eq("id", item.id);

    if (error) {
      onNotice(error.message);
      return;
    }

    onNotice("Comida actualizada.");
    setIsEditing(false);
    await onReload();
  }

  async function deleteMeal() {
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
    <div className="rounded-md border border-[var(--line)] bg-white p-3 text-sm">
      {!isEditing && (
        <div>
          <p className="font-semibold">
            {item.meal_type}: {item.title}
          </p>
          {item.description && (
            <p className="mt-1 text-[var(--muted)]">{item.description}</p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-lg border border-[var(--line)] bg-[#faf8f1] px-3 text-xs font-bold text-[#53605a]"
              onClick={() => setIsEditing(true)}
            >
              <Pencil className="size-4" />
              Modificar
            </button>
            <button
              type="button"
              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[#e8c7be] bg-[#fff3ef] px-3 text-xs font-bold text-[#8d3c2f]"
              onClick={deleteMeal}
            >
              <Trash2 className="size-4" />
              Borrar
            </button>
          </div>
        </div>
      )}
      {isEditing && (
        <div className="grid gap-2">
          <SelectField
            label="Comida"
            value={mealType}
            onChange={setMealType}
            options={mealTypes.map((label) => ({ value: label, label }))}
          />
          <Field label="Plato" value={title} onChange={setTitle} />
          <TextArea label="Indicaciones" value={description} onChange={setDescription} />
          <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-lg bg-[var(--tenant-color)] px-3 text-xs font-bold text-white"
            onClick={saveMeal}
          >
            <Check className="size-4" />
            Guardar
          </button>
          <button
            type="button"
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[#e8c7be] bg-[#fff3ef] px-3 text-xs font-bold text-[#8d3c2f]"
            onClick={deleteMeal}
          >
            <Trash2 className="size-4" />
            Borrar
          </button>
          <button
            type="button"
            className="inline-flex h-9 items-center justify-center rounded-lg border border-[var(--line)] bg-white px-3 text-xs font-bold text-[#53605a]"
            onClick={() => {
              setMealType(item.meal_type);
              setTitle(item.title);
              setDescription(item.description ?? "");
              setIsEditing(false);
            }}
          >
            Cancelar
          </button>
        </div>
      </div>
      )}
    </div>
  );
}

function DataEntryPanel({
  role,
  tenant,
  selectedPatient,
  supabase,
  goals,
  goalLogs,
  onNotice,
  onReload,
}: {
  role: UserRole | null;
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
      duration: "",
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
      const rows: PromiseLike<unknown>[] = [];
      if (trackingDraft.weight) {
        rows.push(
          supabase.from("weight_logs").insert({
            tenant_id: tenant.id,
            patient_id: selectedPatient.id,
            weight_kg: Number(trackingDraft.weight),
            source: role === "patient" ? "patient" : "nutritionist",
          }),
        );
        rows.push(
          supabase
            .from("patients")
            .update({
              current_weight_kg: Number(trackingDraft.weight),
              updated_at: new Date().toISOString(),
            })
            .eq("id", selectedPatient.id),
        );
      }
      if (trackingDraft.waist) {
        rows.push(
          supabase.from("waist_logs").insert({
            tenant_id: tenant.id,
            patient_id: selectedPatient.id,
            waist_cm: Number(trackingDraft.waist),
          }),
        );
      }
      if (trackingDraft.steps) {
        const stepCount = Number(trackingDraft.steps);
        if (!Number.isInteger(stepCount) || stepCount < 0 || stepCount > 200000) {
          onNotice("Pasos no validos.");
          return;
        }

        rows.push(
          supabase.from("step_logs").upsert(
            {
              tenant_id: tenant.id,
              patient_id: selectedPatient.id,
              steps: stepCount,
              logged_on: getLocalDateString(),
              source: "patient",
              updated_at: new Date().toISOString(),
            },
            { onConflict: "patient_id,logged_on" },
          ),
        );
      }
      if (trackingDraft.exercise) {
        rows.push(
          supabase.from("exercise_logs").insert({
            tenant_id: tenant.id,
            patient_id: selectedPatient.id,
            activity: trackingDraft.exercise,
            duration_minutes: trackingDraft.duration
              ? Number(trackingDraft.duration)
              : null,
            intensity: "normal",
          }),
        );
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

        rows.push(
          supabase.from("patient_goal_logs").upsert(
            {
              tenant_id: tenant.id,
              patient_id: selectedPatient.id,
              goal_id: goal.id,
              logged_on: getLocalDateString(),
              status,
              value: numericValue,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "goal_id,logged_on" },
          ),
        );
      }

      const trackingResults = await Promise.all(rows);
      const trackingError = findSupabaseResponseError(trackingResults);
      if (trackingError) {
        onNotice(trackingError);
        return;
      }

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

        const photoInsert = await supabase.from("meal_photos").insert({
          tenant_id: tenant.id,
          patient_id: selectedPatient.id,
          storage_path: path,
          meal_type: trackingDraft.mealType,
          notes: trackingDraft.mealNotes,
          logged_at: loggedAt,
        });

        if (photoInsert.error) {
          onNotice(photoInsert.error.message);
          return;
        }
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
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Ejercicio realizado"
              value={trackingDraft.exercise}
              onChange={(value) => updateTrackingDraft("exercise", value)}
            />
            <Field
              label="Minutos"
              type="number"
              value={trackingDraft.duration}
              onChange={(value) => updateTrackingDraft("duration", value)}
            />
          </div>
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

function StatsPanel({
  selectedPatient,
  weights,
  waists,
  steps,
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
  const todayStepLog = steps.find((item) => item.logged_on === getLocalDateString());
  const currentBmi = selectedPatient
    ? calculateBmi(latestWeight, selectedPatient.height_cm)
    : null;
  const initialBmi = selectedPatient
    ? calculateBmi(selectedPatient.initial_weight_kg, selectedPatient.height_cm)
    : null;
  const weightChartData = buildWeightChartData(weights);
  const waistChartData = buildWaistChartData(waists);
  const stepChartData = buildStepChartData(steps);
  const bmiChartData = selectedPatient
    ? buildBmiChartData(weights, selectedPatient.height_cm)
    : [];

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
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label="Peso actual" value={latestWeight ? `${latestWeight} kg` : "-"} />
        <Metric label="Cintura actual" value={latestWaist ? `${latestWaist} cm` : "-"} />
        <Metric label="Pasos hoy" value={todayStepLog ? formatInteger(todayStepLog.steps) : "-"} />
        <Metric label="IMC inicial" value={formatOptionalNumber(initialBmi, 1)} />
        <Metric label="IMC actual" value={formatOptionalNumber(currentBmi, 1)} />
      </div>
      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <EvolutionChart
          title="Peso"
          data={weightChartData}
          dataKey="peso"
          color="#2f7d6d"
          emptyText="Sin registros de peso."
        />
        <EvolutionChart
          title="Cintura"
          data={waistChartData}
          dataKey="cintura"
          color="#4d6fa9"
          emptyText="Sin registros de cintura."
        />
        <EvolutionChart
          title="Pasos"
          data={stepChartData}
          dataKey="pasos"
          color="#7b7f3b"
          emptyText="Sin registros de pasos."
        />
        <EvolutionChart
          title="IMC"
          data={bmiChartData}
          dataKey="imc"
          color="#b46a4d"
          emptyText="Sin registros de peso para calcular IMC."
        />
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <LogList title="Ejercicio" items={exercises.map((item) => `${formatDate(item.logged_at)} - ${item.activity}${item.duration_minutes ? `, ${item.duration_minutes} min` : ""}`)} />
        <LogList title="Pasos diarios" items={steps.map((item) => `${formatDate(item.logged_on)} - ${formatInteger(item.steps)} pasos`)} />
        <div className="lg:col-span-2">
          <PhotoList photos={mealPhotos} onDeletePhoto={deleteMealPhoto} />
        </div>
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
              <YAxis tick={{ fontSize: 12 }} domain={["auto", "auto"]} />
              <Tooltip />
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
  messages,
  currentUserId,
  supabase,
  onNotice,
  onMessageSent,
  onConversationReady,
}: {
  tenant: Tenant;
  selectedPatient: Patient | null;
  messages: ChatMessage[];
  currentUserId: string;
  supabase: ReturnType<typeof createSupabaseBrowser>;
  onNotice: (message: string) => void;
  onMessageSent: (message: ChatMessage) => void;
  onConversationReady: (conversation: Conversation) => void;
}) {
  const [body, setBody] = useState("");

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
            <Field label="Titulo" value={title} onChange={setTitle} />
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
  pendingInvitations,
  supabase,
  onTenant,
  onNotice,
  onReload,
}: {
  tenant: Tenant;
  role: UserRole | null;
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

function LogList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="mb-2 text-sm font-black">{title}</p>
      <div className="grid gap-2">
        {items.map((item) => (
          <div key={item} className="rounded-md bg-[#f7f5ef] px-3 py-2 text-sm">
            {item}
          </div>
        ))}
        {items.length === 0 && <EmptyState text="Sin registros." />}
      </div>
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
      date: item.logged_at.slice(5, 10),
      peso: Number(item.weight_kg),
    }));
}

function buildWaistChartData(waists: WaistLog[]) {
  return waists
    .slice()
    .sort((a, b) => new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime())
    .map((item) => ({
      date: item.logged_at.slice(5, 10),
      cintura: Number(item.waist_cm),
    }));
}

function buildStepChartData(steps: StepLog[]) {
  return steps
    .slice()
    .sort((a, b) => new Date(a.logged_on).getTime() - new Date(b.logged_on).getTime())
    .map((item) => ({
      date: item.logged_on.slice(5, 10),
      pasos: Number(item.steps),
    }));
}

function buildBmiChartData(weights: WeightLog[], heightCm: number) {
  return weights
    .slice()
    .sort((a, b) => new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime())
    .map((item) => ({
      date: item.logged_at.slice(5, 10),
      imc: roundNumber(calculateBmi(item.weight_kg, heightCm), 1),
    }))
    .filter((item): item is { date: string; imc: number } => item.imc !== null);
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

function findSupabaseResponseError(responses: unknown[]) {
  for (const response of responses) {
    if (
      typeof response === "object" &&
      response !== null &&
      "error" in response
    ) {
      const error = (response as { error?: { message?: string } | null }).error;
      if (error?.message) return error.message;
    }
  }

  return "";
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
