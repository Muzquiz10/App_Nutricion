"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ChevronRight, KeyRound, Loader2 } from "lucide-react";
import {
  createSupabaseBrowser,
  type SupabasePublicConfig,
} from "../lib/supabase/browser";

export function PasswordResetApp({
  supabaseConfig,
}: {
  supabaseConfig?: SupabasePublicConfig | null;
}) {
  const supabase = useMemo(
    () => createSupabaseBrowser(supabaseConfig),
    [supabaseConfig],
  );
  const [nextPath] = useState(() => {
    if (typeof window === "undefined") return "/";
    const params = new URLSearchParams(window.location.search);
    const next = params.get("next");
    return next?.startsWith("/") ? next : "/";
  });
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [checkingSession, setCheckingSession] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function checkSession() {
      if (!supabase) {
        setMessage("Faltan las variables de Supabase.");
        setCheckingSession(false);
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setMessage("Abre esta pantalla desde el enlace del email de recuperacion.");
      }

      setCheckingSession(false);
    }

    void checkSession();
  }, [supabase]);

  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase) return;

    if (password.length < 8) {
      setMessage("La contrasena debe tener al menos 8 caracteres.");
      return;
    }

    if (password !== passwordConfirm) {
      setMessage("Las contrasenas no coinciden.");
      return;
    }

    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Contrasena actualizada. Redirigiendo...");
    window.setTimeout(() => {
      window.location.replace(nextPath);
    }, 900);
  }

  return (
    <main className="nutrios-app tenant-bg flex min-h-screen items-center justify-center px-4">
      <section className="w-full max-w-md rounded-lg border border-[var(--line)] bg-[var(--panel)] p-6 shadow-[var(--shadow-soft)]">
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-lg bg-[var(--tenant-color)] text-white">
            <KeyRound className="size-5" />
          </div>
          <div>
            <p className="text-base font-black">NutriDesk</p>
            <p className="text-sm text-[var(--muted)]">Nueva contrasena</p>
          </div>
        </div>

        {checkingSession ? (
          <div className="mt-8 flex items-center gap-3 rounded-lg border border-[var(--line)] bg-white px-4 py-3 text-sm font-semibold">
            <Loader2 className="size-4 animate-spin text-[var(--tenant-color)]" />
            Preparando recuperacion...
          </div>
        ) : (
          <form className="mt-8 space-y-4" onSubmit={savePassword}>
            <PasswordField
              label="Nueva contrasena"
              value={password}
              onChange={setPassword}
            />
            <PasswordField
              label="Repetir nueva contrasena"
              value={passwordConfirm}
              onChange={setPasswordConfirm}
            />
            <button
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[var(--tenant-color)] px-4 text-sm font-semibold text-white disabled:opacity-60"
              disabled={saving || Boolean(message && message.startsWith("Abre esta pantalla"))}
            >
              <ChevronRight className="size-4" />
              {saving ? "Guardando..." : "Guardar contrasena"}
            </button>
          </form>
        )}

        {message && (
          <p className="mt-4 rounded-lg border border-[#e8d9aa] bg-[#fff8df] px-3 py-2 text-sm text-[#6b5420]">
            {message}
          </p>
        )}
      </section>
    </main>
  );
}

function PasswordField({
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
      <input
        className="h-11 w-full rounded-lg border border-[var(--line)] bg-white px-3 text-sm"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        type="password"
        required
      />
    </label>
  );
}
