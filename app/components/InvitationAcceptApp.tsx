"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Check, ChevronRight, Loader2, ShieldCheck } from "lucide-react";
import {
  createSupabaseBrowser,
  type SupabasePublicConfig,
} from "../lib/supabase/browser";

type InvitationPayload = {
  id: string;
  email: string;
  role: string;
  status: string;
  expires_at: string;
  tenant: {
    id: string;
    slug: string;
    name: string;
    logo_url: string | null;
    primary_color: string;
    privacy_policy_url: string | null;
  };
};

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

export function InvitationAcceptApp({
  token,
  supabaseConfig,
}: {
  token: string;
  supabaseConfig?: SupabasePublicConfig | null;
}) {
  const supabase = useMemo(
    () => createSupabaseBrowser(supabaseConfig),
    [supabaseConfig],
  );
  const [invitation, setInvitation] = useState<InvitationPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [age, setAge] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [currentWeightKg, setCurrentWeightKg] = useState("");
  const [objective, setObjective] = useState(goalOptions[0]);
  const [sex, setSex] = useState("male");
  const [allergies, setAllergies] = useState("");
  const [avoidedFoods, setAvoidedFoods] = useState("");
  const [exerciseHoursPerWeek, setExerciseHoursPerWeek] = useState("");
  const [exerciseType, setExerciseType] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [consentAccepted, setConsentAccepted] = useState(false);

  useEffect(() => {
    async function loadInvitation() {
      const response = await fetch(`/api/invitations/${token}`);
      const payload = (await response.json()) as InvitationPayload & {
        error?: string;
      };
      if (!response.ok) {
        setMessage(payload.error ?? "Invitacion no disponible.");
        setLoading(false);
        return;
      }
      setInvitation(payload as InvitationPayload);

      if (supabase) {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        setSessionEmail(session?.user.email ?? null);
      }

      setLoading(false);
    }

    loadInvitation();
  }, [supabase, token]);

  const color = invitation?.tenant.primary_color ?? "#2f7d6d";
  const style = {
    "--tenant-color": color,
    "--tenant-color-dark": color,
  } as React.CSSProperties;
  const sessionEmailMismatch = Boolean(
    invitation &&
      sessionEmail &&
      invitation.email.toLowerCase() !== sessionEmail.toLowerCase(),
  );

  async function signOutWrongSession() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setSessionEmail(null);
    setMessage(
      "Sesion cerrada. Ya puedes completar esta invitacion.",
    );
  }

  async function completeInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) {
      setMessage("Faltan las variables de Supabase.");
      return;
    }
    if (!invitation) return;
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const currentEmail = session?.user.email ?? null;
    if (
      currentEmail &&
      currentEmail.toLowerCase() !== invitation.email.toLowerCase()
    ) {
      setSessionEmail(currentEmail);
      setMessage(
        `Esta invitacion es para ${invitation.email}, pero la sesion activa es ${currentEmail ?? "otro usuario"}. Cierra sesion y abre el enlace desde el correo correcto.`,
      );
      return;
    }
    if (password.length < 8) {
      setMessage("La contrasena debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== passwordConfirm) {
      setMessage("Las contrasenas no coinciden.");
      return;
    }

    setMessage("");
    const response = await fetch("/api/invitations/complete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(session?.access_token
          ? { Authorization: `Bearer ${session.access_token}` }
          : {}),
      },
      body: JSON.stringify({
        token,
        fullName,
        age: Number(age),
        heightCm: Number(heightCm),
        currentWeightKg: Number(currentWeightKg),
        objective,
        sex,
        allergies,
        avoidedFoods,
        exerciseHoursPerWeek: Number(exerciseHoursPerWeek),
        exerciseType,
        password,
        consentAccepted,
      }),
    });

    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setMessage(payload.error ?? "No se pudo completar el alta.");
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: invitation.email,
      password,
    });

    if (signInError) {
      setMessage(
        "Alta completada. Ahora inicia sesion con el correo del cliente y la contrasena que acabas de crear.",
      );
      return;
    }

    window.location.replace(`/n/${invitation.tenant.slug}`);
  }

  if (loading) {
    return (
      <main className="tenant-bg flex min-h-screen items-center justify-center px-4" style={style}>
        <div className="flex items-center gap-3 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-5 py-4 shadow-[var(--shadow-soft)]">
          <Loader2 className="size-5 animate-spin text-[var(--tenant-color)]" />
          <p className="text-sm font-semibold">Validando invitacion...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="nutrios-app tenant-bg min-h-screen px-4 py-6" style={style}>
      <section className="mx-auto max-w-3xl rounded-lg border border-[var(--line)] bg-[var(--panel)] p-5 shadow-[var(--shadow-soft)] sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase text-[var(--tenant-color)]">NutriDesk</p>
            <h1 className="mt-1 text-2xl font-black tracking-normal text-[#17201d]">
              Alta con {invitation?.tenant.name ?? "tu nutricionista"}
            </h1>
            <p className="mt-2 text-sm text-[var(--muted)]">{invitation?.email}</p>
          </div>
          <div className="grid size-11 place-items-center rounded-lg bg-[var(--tenant-color)] text-white">
            <ShieldCheck className="size-5" />
          </div>
        </div>

        {message && (
          <div className="mt-5 rounded-lg border border-[#e8d9aa] bg-[#fff8df] px-4 py-3 text-sm text-[#6b5420]">
            {message}
          </div>
        )}

        {sessionEmailMismatch && (
          <div className="mt-5 rounded-lg border border-[#e8d9aa] bg-[#fff8df] p-4 text-sm text-[#6b5420]">
            <p className="font-semibold">La sesion activa no coincide con la invitacion.</p>
            <p className="mt-2 leading-6">
              Esta invitacion es para {invitation?.email}, pero ahora mismo esta abierta la sesion de {sessionEmail}. Cierra esta sesion para completar el alta del cliente.
            </p>
            <button
              type="button"
              className="mt-3 inline-flex h-10 items-center justify-center rounded-lg bg-[var(--tenant-color)] px-4 text-sm font-semibold text-white"
              onClick={signOutWrongSession}
            >
              Cerrar esta sesion
            </button>
          </div>
        )}

        {!sessionEmailMismatch && (
        <form className="mt-6 grid gap-4 md:grid-cols-2" onSubmit={completeInvitation}>
          <Field label="Nombre y apellidos" value={fullName} onChange={setFullName} required />
          <Field label="Edad" type="number" value={age} onChange={setAge} required />
          <Field label="Altura cm" type="number" value={heightCm} onChange={setHeightCm} required />
          <Field label="Peso actual kg" type="number" step="0.1" value={currentWeightKg} onChange={setCurrentWeightKg} required />
          <SelectField
            label="Objetivo"
            value={objective}
            onChange={setObjective}
            options={goalOptions.map((label) => ({ value: label, label }))}
          />
          <SelectField
            label="Sexo para calculo basal"
            value={sex}
            onChange={setSex}
            options={sexOptions}
          />
          <TextArea label="Alergias/intolerancias" value={allergies} onChange={setAllergies} />
          <TextArea label="Alimentos a evitar" value={avoidedFoods} onChange={setAvoidedFoods} />
          <Field
            label="Horas estimadas de ejercicio a la semana"
            type="number"
            step="0.5"
            value={exerciseHoursPerWeek}
            onChange={setExerciseHoursPerWeek}
            required
          />
          <TextArea label="Tipo de ejercicio" value={exerciseType} onChange={setExerciseType} />
          <div className="grid gap-4">
            <Field label="Contrasena" type="password" value={password} onChange={setPassword} required />
            <Field label="Repetir contrasena" type="password" value={passwordConfirm} onChange={setPasswordConfirm} required />
          </div>
          <label className="md:col-span-2 flex items-start gap-3 rounded-lg border border-[var(--line)] bg-white p-3 text-sm">
            <input
              type="checkbox"
              className="mt-1 size-4"
              checked={consentAccepted}
              onChange={(event) => setConsentAccepted(event.target.checked)}
              required
            />
            <span className="leading-6 text-[#39433f]">
              Acepto el tratamiento de mis datos personales y de salud para el seguimiento nutricional.
              {invitation?.tenant.privacy_policy_url && (
                <>
                  {" "}
                  <a
                    className="font-semibold text-[var(--tenant-color)] underline"
                    href={invitation.tenant.privacy_policy_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Politica de privacidad
                  </a>
                </>
              )}
            </span>
          </label>
          <div className="md:col-span-2">
            <button className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[var(--tenant-color)] px-4 text-sm font-semibold text-white sm:w-auto">
              <Check className="size-4" />
              Completar alta
              <ChevronRight className="size-4" />
            </button>
          </div>
        </form>
        )}
      </section>
    </main>
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
