"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  createSupabaseBrowser,
  type SupabasePublicConfig,
} from "../lib/supabase/browser";

export function AuthCallbackApp({
  supabaseConfig,
}: {
  supabaseConfig?: SupabasePublicConfig | null;
}) {
  const [message, setMessage] = useState("Preparando tu acceso...");

  useEffect(() => {
    const supabase = createSupabaseBrowser(supabaseConfig);
    const params = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const next = params.get("next") ?? "/";
    const code = params.get("code");

    async function finishAuth() {
      if (!supabase) {
        setMessage("Faltan las variables de Supabase.");
        return;
      }

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setMessage(error.message);
          return;
        }
      }

      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (error) {
          setMessage(error.message);
          return;
        }
      }

      window.location.replace(next.startsWith("/") ? next : "/");
    }

    finishAuth();
  }, [supabaseConfig]);

  return (
    <main className="tenant-bg flex min-h-screen items-center justify-center px-6">
      <div className="flex items-center gap-3 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-5 py-4 shadow-[var(--shadow-soft)]">
        <Loader2 className="size-5 animate-spin text-[var(--tenant-color)]" />
        <p className="text-sm font-medium text-[#26312d]">{message}</p>
      </div>
    </main>
  );
}
