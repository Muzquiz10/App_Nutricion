"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Archive,
  Bell,
  BookOpen,
  CalendarDays,
  Check,
  ChevronRight,
  ClipboardList,
  Copy,
  FileText,
  ImagePlus,
  KeyRound,
  Loader2,
  LogOut,
  MessageCircle,
  Palette,
  Pencil,
  Plus,
  RotateCcw,
  Send,
  Settings as SettingsIcon,
  ShieldCheck,
  Trash2,
  Upload,
  UserPlus,
  Users,
  Weight,
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
  status?: "active" | "archived";
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

type TabId = "patients" | "plans" | "tracking" | "chat" | "documents" | "settings";
type PatientListView = "active" | "pending" | "archived";

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

const tabs: Array<{ id: TabId; label: string; icon: typeof Users }> = [
  { id: "patients", label: "Clientes", icon: Users },
  { id: "plans", label: "Dietas", icon: BookOpen },
  { id: "tracking", label: "Seguimiento", icon: Activity },
  { id: "chat", label: "Chat", icon: MessageCircle },
  { id: "documents", label: "Documentos", icon: FileText },
  { id: "settings", label: "Configuracion", icon: SettingsIcon },
];

const dayLabels = [
  "Lunes",
  "Martes",
  "Miercoles",
  "Jueves",
  "Viernes",
  "Sabado",
  "Domingo",
];

const mealTypes = ["Desayuno", "Media manana", "Comida", "Merienda", "Cena"];

const mealTypeOrder = new Map(mealTypes.map((mealType, index) => [mealType, index]));
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
  name: "Espacio NutriOS",
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
          description: "Anadir frutos rojos y nueces.",
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
  const [selectedPatientId, setSelectedPatientId] = useState(demoPatients[0]?.id ?? "");
  const [weights, setWeights] = useState<WeightLog[]>(demoWeights);
  const [waists, setWaists] = useState<WaistLog[]>(demoWaist);
  const [exercises, setExercises] = useState<ExerciseLog[]>([]);
  const [mealPhotos, setMealPhotos] = useState<MealPhoto[]>([]);
  const [documents, setDocuments] = useState<DocumentFile[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([demoConversation]);
  const [messages, setMessages] = useState<ChatMessage[]>(demoMessages);
  const [plans, setPlans] = useState<MealPlan[]>([demoPlan]);
  const [activeTab, setActiveTab] = useState<TabId>("patients");
  const [loading, setLoading] = useState(Boolean(supabase));
  const [notice, setNotice] = useState("");
  const [workspaceError, setWorkspaceError] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [sendingRecovery, setSendingRecovery] = useState(false);
  const hasResolvedWorkspace = useRef(!supabase);

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
  const patientMessages = messages
    .filter((item) => item.conversation_id === selectedConversation?.id)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const patientPlans = plans.filter((plan) => plan.patient_id === selectedPatientId);

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
      exerciseRows,
      photoRows,
      documentRows,
      conversationRows,
      messageRows,
      planRows,
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
    ]);

    setWeights((weightRows.data ?? []) as WeightLog[]);
    setWaists((waistRows.data ?? []) as WaistLog[]);
    setExercises((exerciseRows.data ?? []) as ExerciseLog[]);
    setMealPhotos(await withSignedUrls((photoRows.data ?? []) as MealPhoto[], "storage_path"));
    setDocuments(await withSignedUrls((documentRows.data ?? []) as DocumentFile[], "storage_path"));
    setConversations((conversationRows.data ?? []) as Conversation[]);
    setMessages((messageRows.data ?? []) as ChatMessage[]);
    setPlans((planRows.data ?? []) as MealPlan[]);
    finishLoading();
  }, [initialTenant, supabase, tenantSlug, withSignedUrls]);

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

  async function handlePasswordRecovery() {
    if (!supabase) return;
    setNotice("");

    const email = authEmail.trim();
    if (!email) {
      setNotice("Introduce tu correo electronico para enviarte el enlace de recuperacion.");
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

    setNotice("Te hemos enviado un email para crear una nueva contrasena.");
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
          <span className="text-sm font-medium">Cargando NutriOS...</span>
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
              label="Correo electronico"
              type="email"
              value={authEmail}
              onChange={setAuthEmail}
              required
            />
            <Field
              label="Contrasena"
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
              {sendingRecovery ? "Enviando enlace..." : "Has olvidado tu contrasena?"}
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
      <div className="mx-auto grid min-h-screen max-w-[1440px] grid-cols-1 lg:grid-cols-[280px_1fr]">
        <aside className="border-b border-[var(--line)] bg-[#fffbf3]/90 px-4 py-4 lg:border-b-0 lg:border-r lg:px-5 lg:py-6">
          <div className="flex items-center justify-between gap-3 lg:block">
            <Brand tenant={tenant} compact />
            <div className="flex items-center gap-2 lg:mt-6">
              {isDemo && (
                <span className="rounded-full bg-[#f1e7c4] px-3 py-1 text-xs font-semibold text-[#69551f]">
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
              .map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    className={`flex h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-semibold transition ${
                      active
                        ? "bg-[var(--tenant-color)] text-white"
                        : "text-[#4a554f] hover:bg-white"
                    }`}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    <Icon className="size-4" />
                    {role === "patient" && tab.id === "patients"
                      ? "Mi Ficha Personal"
                      : tab.label}
                  </button>
                );
              })}
          </nav>

          <PatientSwitcher
            patients={patients.filter((patient) => !isArchivedPatient(patient))}
            selectedPatientId={selectedPatientId}
            onSelect={setSelectedPatientId}
            role={role}
          />
        </aside>

        <section className="min-w-0 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
          <Header tenant={tenant} role={role} selectedPatient={selectedPatient} />
          {workspaceError && (
            <div className="mt-5 rounded-lg border border-[#e8d9aa] bg-[#fff8df] px-4 py-3 text-sm text-[#6b5420]">
              {workspaceError}
            </div>
          )}
          {notice && (
            <div className="mt-5 rounded-lg border border-[#bee4d7] bg-[#effaf5] px-4 py-3 text-sm text-[#255d50]">
              {notice}
            </div>
          )}

          <div className="mt-5">
            {activeTab === "patients" && (
              <PatientsPanel
                tenant={tenant}
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
            {activeTab === "tracking" && (
              <TrackingPanel
                key={`tracking-${selectedPatientId || "none"}`}
                role={role}
                tenant={tenant}
                selectedPatient={selectedPatient}
                weights={patientWeights}
                waists={patientWaists}
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
                supabase={supabase}
                onTenant={setTenant}
                onNotice={setNotice}
              />
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function Brand({ tenant, compact }: { tenant: Tenant; compact: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-lg bg-[var(--tenant-color)] text-base font-black text-white">
        {tenant.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={tenant.logo_url} alt="" className="h-full w-full object-cover" />
        ) : (
          "N"
        )}
      </div>
      <div className="min-w-0">
        <p className="truncate text-base font-black tracking-normal">NutriOS</p>
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
    <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-semibold uppercase text-[var(--tenant-color)]">
          {role === "patient" ? "Area paciente" : "Panel nutricionista"}
        </p>
        <h1 className="mt-1 text-2xl font-black tracking-normal text-[#17201d] sm:text-3xl">
          {selectedPatient ? selectedPatient.full_name : tenant.name}
        </h1>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Pill icon={ShieldCheck} label="GDPR preparado" />
        <Pill icon={Bell} label="Chat en tiempo real" />
      </div>
    </header>
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
}: {
  patients: Patient[];
  selectedPatientId: string;
  onSelect: (id: string) => void;
  role: UserRole | null;
}) {
  if (role === "patient") return null;

  return (
    <div className="mt-6 hidden lg:block">
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
  tenant,
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
  tenant: Tenant;
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
  const [email, setEmail] = useState("");
  const [manualInviteLink, setManualInviteLink] = useState("");
  const [patientView, setPatientView] = useState<PatientListView>("active");
  const activePatients = patients.filter((patient) => !isArchivedPatient(patient));
  const archivedPatients = patients.filter(isArchivedPatient);
  const latestWeight = selectedPatient
    ? weights
        .filter((item) => item.patient_id === selectedPatient.id)
        .sort((a, b) => new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime())[0]
    : null;

  async function invitePatient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) {
      onNotice("Modo demo: conecta Supabase para enviar invitaciones reales.");
      return;
    }

    const accessToken = await getCurrentAccessToken(supabase);
    if (!accessToken) {
      onNotice("Tu sesion ha caducado. Cierra sesion y vuelve a entrar.");
      return;
    }

    setManualInviteLink("");
    const response = await fetch("/api/invitations/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        email,
        tenantId: tenant.id,
        tenantSlug: tenant.slug,
      }),
    });

    const payload = (await response.json()) as CreateInvitationResponse;
    if (!response.ok) {
      onNotice(payload.error ?? "No se pudo enviar la invitacion.");
      return;
    }

    setEmail("");
    if (payload.delivery === "manual_link" && payload.actionLink) {
      setManualInviteLink(payload.actionLink);
      onNotice(payload.warning ?? "Invitacion creada con enlace manual.");
    } else {
      onNotice("Invitacion enviada al paciente.");
    }
    await onReload();
  }

  async function updatePatientStatus(patient: Patient, status: "active" | "archived") {
    if (!supabase) {
      onNotice("Modo demo: conecta Supabase para cambiar el estado del cliente.");
      return;
    }

    const { error } = await supabase
      .from("patients")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", patient.id);

    if (error) {
      onNotice(error.message);
      return;
    }

    onNotice(status === "archived" ? "Cliente movido a antiguos." : "Cliente reactivado.");
    await onReload();
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

  if (role === "patient") {
    const currentWeight =
      latestWeight?.weight_kg ?? selectedPatient?.current_weight_kg ?? null;
    const currentBmi = selectedPatient
      ? calculateBmi(currentWeight, selectedPatient.height_cm)
      : null;

    return (
      <div className="grid gap-4 lg:grid-cols-4">
        <StatCard label="Peso inicial" value={`${selectedPatient?.initial_weight_kg ?? "-"} kg`} icon={Weight} />
        <StatCard label="Peso actual" value={`${latestWeight?.weight_kg ?? selectedPatient?.current_weight_kg ?? "-"} kg`} icon={Activity} />
        <StatCard label="IMC actual" value={formatOptionalNumber(currentBmi, 1)} icon={ClipboardList} />
        <StatCard label="Fecha de alta" value={formatDate(selectedPatient?.registered_at)} icon={CalendarDays} />
        <PatientQuestionnairePanel
          key={selectedPatient?.id ?? "empty"}
          patient={selectedPatient}
          supabase={supabase}
          onNotice={onNotice}
          onReload={onReload}
        />
        <PatientRecord patient={selectedPatient} role={role} className="lg:col-span-4" />
      </div>
    );
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
      <Panel>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-black">Alta de cliente</h2>
          <UserPlus className="size-5 text-[var(--tenant-color)]" />
        </div>
        <form className="mt-5 space-y-3" onSubmit={invitePatient}>
          <Field
            label="Correo electronico"
            type="email"
            value={email}
            onChange={setEmail}
            required
          />
          <button className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[var(--tenant-color)] px-4 text-sm font-semibold text-white">
            <Send className="size-4" />
            Enviar invitacion
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
      </Panel>

      <Panel className="xl:col-span-1">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-black">
            {patientView === "active" && "Clientes"}
            {patientView === "pending" && "Pendientes de aceptar"}
            {patientView === "archived" && "Clientes antiguos"}
          </h2>
          <span className="rounded-lg bg-[#eef3f0] px-3 py-1 text-sm font-semibold text-[#53605a]">
            {patientView === "active" && activePatients.length}
            {patientView === "pending" && pendingInvitations.length}
            {patientView === "archived" && archivedPatients.length}
          </span>
        </div>
        <div className="mb-4 grid grid-cols-3 gap-2">
          {[
            { id: "active", label: "Activos", count: activePatients.length },
            { id: "pending", label: "Pendientes", count: pendingInvitations.length },
            { id: "archived", label: "Antiguos", count: archivedPatients.length },
          ].map((item) => {
            const active = patientView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`h-10 rounded-lg border px-2 text-xs font-bold transition ${
                  active
                    ? "border-[var(--tenant-color)] bg-[var(--tenant-color)] text-white"
                    : "border-[var(--line)] bg-white text-[#4a554f] hover:border-[#bfb7aa]"
                }`}
                onClick={() => setPatientView(item.id as PatientListView)}
              >
                {item.label} - {item.count}
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
            nextStatus="archived"
          />
        )}
        {patientView === "pending" && (
          <PendingInvitationList
            invitations={pendingInvitations}
            onNotice={onNotice}
          />
        )}
        {patientView === "archived" && (
          <PatientCards
            patients={archivedPatients}
            selectedPatient={selectedPatient}
            onSelectPatient={onSelectPatient}
            onChangeStatus={updatePatientStatus}
            nextStatus="active"
          />
        )}
      </Panel>

      <PatientRecord patient={selectedPatient} role={role} />
    </div>
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
    status: "active" | "archived",
  ) => Promise<void>;
  nextStatus: "active" | "archived";
}) {
  if (patients.length === 0) {
    return <EmptyState text="No hay clientes en esta vista." />;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {patients.map((patient) => {
        const selected = selectedPatient?.id === patient.id;
        const Icon = nextStatus === "archived" ? Archive : RotateCcw;
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
              {nextStatus === "archived" ? "Mover a antiguos" : "Reactivar"}
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
  className = "xl:col-span-2",
}: {
  patient: Patient | null;
  role: UserRole | null;
  className?: string;
}) {
  if (!patient) return <Panel><EmptyState text="Selecciona un cliente." /></Panel>;

  const currentBmi = calculateBmi(patient.current_weight_kg, patient.height_cm);
  const basalCalories = calculateBasalCalories(patient);

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
        <InfoBlock label="IMC actual" value={formatOptionalNumber(currentBmi, 1)} />
        {role !== "patient" && (
          <InfoBlock
            label="Calorias basales (TMB)"
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
  const [title, setTitle] = useState("Plan semanal");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [draftItems, setDraftItems] = useState<DraftMealItem[]>([
    { dayIndex: 1, mealType: "Desayuno", title: "", description: "" },
  ]);

  async function savePlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedPatient) return;
    if (!supabase) {
      onNotice("Modo demo: conecta Supabase para guardar dietas reales.");
      return;
    }

    const items = draftItems.filter((item) => item.title.trim());
    const { data: plan, error: planError } = await supabase
      .from("meal_plans")
      .insert({
        tenant_id: tenant.id,
        patient_id: selectedPatient.id,
        title,
        start_date: startDate,
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
    setDraftItems([{ dayIndex: 1, mealType: "Desayuno", title: "", description: "" }]);
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
            <Field label="Titulo" value={title} onChange={setTitle} required />
            <Field label="Fecha inicio" type="date" value={startDate} onChange={setStartDate} required />
            <div className="space-y-3">
              {draftItems.map((item, index) => (
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
                  setDraftItems((current) => [
                    ...current,
                    { dayIndex: 1, mealType: "Comida", title: "", description: "" },
                  ])
                }
              >
                <Plus className="size-4" />
                Anadir comida
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

  function updateDraftItem(index: number, patch: Partial<DraftMealItem>) {
    setDraftItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    );
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
      onNotice("Escribe el plato antes de anadir la comida.");
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
          Anadir comida
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

function TrackingPanel({
  role,
  tenant,
  selectedPatient,
  weights,
  waists,
  exercises,
  mealPhotos,
  supabase,
  onNotice,
  onReload,
}: {
  role: UserRole | null;
  tenant: Tenant;
  selectedPatient: Patient | null;
  weights: WeightLog[];
  waists: WaistLog[];
  exercises: ExerciseLog[];
  mealPhotos: MealPhoto[];
  supabase: ReturnType<typeof createSupabaseBrowser>;
  onNotice: (message: string) => void;
  onReload: () => Promise<void>;
}) {
  const emptyTrackingDraft = useMemo(
    () => ({
      weight: "",
      waist: "",
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
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  const canRecordTracking = role === "patient";
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
  const weightChartData = buildWeightChartData(weights);
  const waistChartData = buildWaistChartData(waists);
  const bmiChartData = selectedPatient
    ? buildBmiChartData(weights, selectedPatient.height_cm)
    : [];

  async function saveTracking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedPatient) return;
    if (!supabase) {
      onNotice("Modo demo: conecta Supabase para registrar datos reales.");
      return;
    }

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

    const trackingResults = await Promise.all(rows);
    const trackingError = findSupabaseResponseError(trackingResults);
    if (trackingError) {
      onNotice(trackingError);
      return;
    }

    if (photoFile) {
      const path = `${tenant.id}/${selectedPatient.id}/meal-photos/${Date.now()}-${safeFileName(photoFile.name)}`;
      const { error: uploadError } = await supabase.storage
        .from("nutrios-private")
        .upload(path, photoFile, { upsert: false });

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
      });

      if (photoInsert.error) {
        onNotice(photoInsert.error.message);
        return;
      }
    }

    clearTrackingDraft();
    setPhotoFile(null);
    onNotice("Seguimiento actualizado.");
    await onReload();
  }

  function updateTrackingDraft(key: keyof typeof emptyTrackingDraft, value: string) {
    setTrackingDraft((current) => ({
      ...current,
      [key]: value,
    }));
  }

  return (
    <div className={`grid gap-5 ${canRecordTracking ? "xl:grid-cols-[420px_1fr]" : ""}`}>
      {canRecordTracking && (
        <Panel>
          <h2 className="text-lg font-black">Registrar datos</h2>
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
              options={["Desayuno", "Comida", "Cena", "Snack"].map((label) => ({
                value: label,
                label,
              }))}
            />
            <TextArea
              label="Notas de comida"
              value={trackingDraft.mealNotes}
              onChange={(value) => updateTrackingDraft("mealNotes", value)}
            />
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-[#39433f]">Foto</span>
              <input
                className="block w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm"
                type="file"
                accept="image/*"
                onChange={(event) => setPhotoFile(event.target.files?.[0] ?? null)}
              />
            </label>
            <button className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[var(--tenant-color)] px-4 text-sm font-semibold text-white">
              <ImagePlus className="size-4" />
              Guardar registro
            </button>
          </form>
        </Panel>
      )}

      <Panel>
        <h2 className="text-lg font-black">Evolucion</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Metric label="Peso actual" value={latestWeight ? `${latestWeight} kg` : "-"} />
          <Metric label="Cintura actual" value={latestWaist ? `${latestWaist} cm` : "-"} />
          <Metric label="IMC actual" value={formatOptionalNumber(currentBmi, 1)} />
        </div>
        <div className="mt-4 grid gap-4 xl:grid-cols-3">
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
            title="IMC"
            data={bmiChartData}
            dataKey="imc"
            color="#b46a4d"
            emptyText="Sin registros de peso para calcular IMC."
          />
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <LogList title="Ejercicio" items={exercises.map((item) => `${formatDate(item.logged_at)} - ${item.activity}${item.duration_minutes ? `, ${item.duration_minutes} min` : ""}`)} />
          <PhotoList photos={mealPhotos} />
        </div>
      </Panel>
    </div>
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
        <div className="grid h-56 place-items-center">
          <EmptyState text={emptyText} />
        </div>
      ) : (
        <div className="h-56">
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
          <h2 className="text-lg font-black">Anadir documento</h2>
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
  supabase,
  onTenant,
  onNotice,
}: {
  tenant: Tenant;
  role: UserRole | null;
  supabase: ReturnType<typeof createSupabaseBrowser>;
  onTenant: (tenant: Tenant) => void;
  onNotice: (message: string) => void;
}) {
  const [name, setName] = useState(tenant.name);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState(tenant.logo_url ?? "");
  const [logoObjectUrl, setLogoObjectUrl] = useState("");
  const [primaryColor, setPrimaryColor] = useState(tenant.primary_color);

  useEffect(() => {
    return () => {
      if (logoObjectUrl) URL.revokeObjectURL(logoObjectUrl);
    };
  }, [logoObjectUrl]);

  function handleLogoFileChange(file: File | null) {
    if (logoObjectUrl) URL.revokeObjectURL(logoObjectUrl);
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
    let nextLogoUrl = tenant.logo_url;

    if (logoFile && supabase) {
      const path = `${tenant.id}/logo-${Date.now()}-${safeFileName(logoFile.name)}`;
      const { error: uploadError } = await supabase.storage
        .from("nutrios-branding")
        .upload(path, logoFile, { upsert: true });

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
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
      {role !== "patient" && (
        <Panel>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-black">Personalizar mi NutriOS</h2>
            <Palette className="size-5 text-[var(--tenant-color)]" />
          </div>
          <form className="mt-5 grid gap-4 lg:grid-cols-2" onSubmit={saveSettings}>
            <Field label="Nombre visible" value={name} onChange={setName} required />
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-[#39433f]">Logo</span>
              <div className="flex min-h-24 items-center gap-4 rounded-lg border border-[var(--line)] bg-white p-3">
                <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-lg bg-[var(--tenant-color)] text-xl font-black text-white">
                  {logoPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoPreview} alt="" className="h-full w-full object-cover" />
                  ) : (
                    "N"
                  )}
                </div>
                <input
                  className="block min-w-0 flex-1 text-sm"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  onChange={(event) =>
                    handleLogoFileChange(event.target.files?.[0] ?? null)
                  }
                />
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
              <button className="inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--tenant-color)] px-4 text-sm font-semibold text-white">
                <Upload className="size-4" />
                Guardar personalizacion
              </button>
            </div>
          </form>
        </Panel>
      )}

      <AccountSecurityPanel
        supabase={supabase}
        onNotice={onNotice}
        className={role === "patient" ? "xl:col-span-2" : ""}
      />
    </div>
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
      onNotice("Modo demo: conecta Supabase para cambiar contrasenas reales.");
      return;
    }

    if (newPassword.length < 8) {
      onNotice("La contrasena debe tener al menos 8 caracteres.");
      return;
    }

    if (newPassword !== newPasswordConfirm) {
      onNotice("Las contrasenas no coinciden.");
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
    onNotice("Contrasena actualizada.");
  }

  return (
    <Panel className={className}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-black">Configuracion</h2>
        <KeyRound className="size-5 text-[var(--tenant-color)]" />
      </div>
      <form className="mt-5 space-y-4" onSubmit={updatePassword}>
        <Field
          label="Nueva contrasena"
          type="password"
          value={newPassword}
          onChange={setNewPassword}
          required
        />
        <Field
          label="Repetir nueva contrasena"
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
          {saving ? "Guardando..." : "Cambiar contrasena"}
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
    <section className={`rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4 shadow-[var(--shadow-soft)] sm:p-5 ${className}`}>
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

function PhotoList({ photos }: { photos: MealPhoto[] }) {
  return (
    <div>
      <p className="mb-2 text-sm font-black">Fotos de comidas</p>
      <div className="grid grid-cols-2 gap-2">
        {photos.map((photo) => (
          <a
            key={photo.id}
            href={photo.signed_url}
            target="_blank"
            rel="noreferrer"
            className="aspect-square overflow-hidden rounded-lg border border-[var(--line)] bg-[#f7f5ef]"
          >
            {photo.signed_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo.signed_url} alt={photo.notes ?? "Comida"} className="h-full w-full object-cover" />
            ) : (
              <span className="grid h-full place-items-center text-xs font-semibold text-[var(--muted)]">
                Imagen
              </span>
            )}
          </a>
        ))}
        {photos.length === 0 && <EmptyState text="Sin fotos." />}
      </div>
    </div>
  );
}

function isArchivedPatient(patient: Patient) {
  return patient.status === "archived";
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

function getMealTypePosition(mealType: string) {
  return mealTypeOrder.get(mealType) ?? mealTypes.length;
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

function calculateBasalCalories(patient: Patient) {
  const weight = Number(patient.current_weight_kg);
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

  if (session?.access_token) return session.access_token;

  const { data, error } = await supabase.auth.refreshSession();
  if (error) return "";

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
  const [draft, setDraft] = useState<T>(() =>
    readStoredDraft(key, initialValue),
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(key, JSON.stringify(draft));
  }, [draft, key]);

  const clearDraft = useCallback(() => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(key);
    }
    setDraft(initialValue);
  }, [initialValue, key]);

  return [draft, setDraft, clearDraft] as const;
}

function readStoredDraft<T extends Record<string, string>>(
  key: string,
  initialValue: T,
) {
  if (typeof window === "undefined") return initialValue;

  try {
    const rawDraft = window.localStorage.getItem(key);
    if (!rawDraft) return initialValue;
    const storedDraft = JSON.parse(rawDraft) as Partial<T>;
    return {
      ...initialValue,
      ...storedDraft,
    };
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

function safeFileName(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9.\-_]/g, "-")
    .replace(/-+/g, "-");
}
