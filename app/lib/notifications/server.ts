import type { SupabaseClient } from "@supabase/supabase-js";
import { APP_NAME } from "../brand";
import { getPublicAppOrigin, readRuntimeEnv } from "../supabase/server";
import { sendWebPush, type StoredPushSubscription } from "./web-push";

type NotificationPreferences = {
  email_enabled: boolean;
  push_enabled: boolean;
};

type ChatNotificationPatient = {
  id: string;
  tenant_id: string;
  user_id: string | null;
  nutritionist_user_id: string;
};

type ChatNotificationMessage = {
  id: string;
  sender_id: string;
};

type AppNotificationRow = {
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
};

const fallbackMinutes = 5;
const defaultSupportEmail = "ej.egmanalytics@gmail.com";

export async function createChatMessageNotification({
  supabase,
  request,
  tenantId,
  patient,
  message,
}: {
  supabase: SupabaseClient;
  request: Request;
  tenantId: string;
  patient: ChatNotificationPatient;
  message: ChatNotificationMessage;
}) {
  const recipientUserId =
    patient.user_id === message.sender_id
      ? patient.nutritionist_user_id
      : patient.user_id;

  if (!recipientUserId || recipientUserId === message.sender_id) return;

  const preferences = await getNotificationPreferences(
    supabase,
    tenantId,
    recipientUserId,
  );
  const emailFallbackDueAt = preferences.email_enabled
    ? new Date(Date.now() + fallbackMinutes * 60 * 1000).toISOString()
    : null;

  const { error } = await supabase.from("app_notifications").insert({
    tenant_id: tenantId,
    user_id: recipientUserId,
    patient_id: patient.id,
    type: "chat_message",
    title: "Nuevo mensaje",
    body: `Tienes un nuevo mensaje en ${APP_NAME}.`,
    href: "chat",
    related_message_id: message.id,
    email_fallback_due_at: emailFallbackDueAt,
  });

  if (error) {
    console.error("Could not create chat notification", error.message);
  }

  if (preferences.push_enabled) {
    await sendPushNotificationsToUser({
      supabase,
      request,
      tenantId,
      userId: recipientUserId,
    });
  }
}

export async function createAppointmentNotification({
  supabase,
  request,
  tenantId,
  patientId,
  recipientUserId,
  actorUserId,
  title,
  body,
}: {
  supabase: SupabaseClient;
  request: Request;
  tenantId: string;
  patientId: string | null;
  recipientUserId: string | null | undefined;
  actorUserId: string;
  title: string;
  body: string;
}) {
  if (!recipientUserId || recipientUserId === actorUserId) return;

  const preferences = await getNotificationPreferences(
    supabase,
    tenantId,
    recipientUserId,
  );
  const emailFallbackDueAt = preferences.email_enabled
    ? new Date(Date.now() + fallbackMinutes * 60 * 1000).toISOString()
    : null;

  const { error } = await supabase.from("app_notifications").insert({
    tenant_id: tenantId,
    user_id: recipientUserId,
    patient_id: patientId,
    type: "appointment",
    title,
    body,
    href: "agenda",
    email_fallback_due_at: emailFallbackDueAt,
  });

  if (error) {
    console.error("Could not create appointment notification", error.message);
  }

  if (preferences.push_enabled) {
    await sendPushNotificationsToUser({
      supabase,
      request,
      tenantId,
      userId: recipientUserId,
    });
  }
}

export async function processDueAppEmailFallbacks({
  supabase,
  request,
  tenantId,
}: {
  supabase: SupabaseClient;
  request: Request;
  tenantId?: string;
}) {
  let query = supabase
    .from("app_notifications")
    .select("id,tenant_id,user_id,patient_id,type,title,body,href,related_message_id,read_at")
    .in("type", ["chat_message", "appointment"])
    .is("email_sent_at", null)
    .not("email_fallback_due_at", "is", null)
    .lte("email_fallback_due_at", new Date().toISOString())
    .order("email_fallback_due_at", { ascending: true })
    .limit(25);

  if (tenantId) {
    query = query.eq("tenant_id", tenantId);
  }

  const { data: notifications, error } = await query;
  if (error || !notifications) {
    return { processed: 0, sent: 0, error: error?.message };
  }

  let sent = 0;

  for (const notification of notifications as AppNotificationRow[]) {
    const result = await processOneEmailFallback(supabase, request, notification);
    if (result === "sent") sent += 1;
  }

  return { processed: notifications.length, sent };
}

export const processDueChatEmailFallbacks = processDueAppEmailFallbacks;

async function processOneEmailFallback(
  supabase: SupabaseClient,
  request: Request,
  notification: AppNotificationRow,
) {
  if (notification.read_at) {
    await supabase
      .from("app_notifications")
      .update({ email_fallback_due_at: null })
      .eq("id", notification.id);
    return "skipped";
  }

  if (notification.type === "chat_message") {
    if (!notification.related_message_id) {
      await supabase
        .from("app_notifications")
        .update({ email_fallback_due_at: null })
        .eq("id", notification.id);
      return "skipped";
    }

    const { data: message } = await supabase
      .from("chat_messages")
      .select("id,read_at")
      .eq("id", notification.related_message_id)
      .maybeSingle();

    if (!message || message.read_at) {
      await supabase
        .from("app_notifications")
        .update({ email_fallback_due_at: null })
        .eq("id", notification.id);
      return "skipped";
    }
  }

  const preferences = await getNotificationPreferences(
    supabase,
    notification.tenant_id,
    notification.user_id,
  );
  if (!preferences.email_enabled) {
    await supabase
      .from("app_notifications")
      .update({ email_fallback_due_at: null })
      .eq("id", notification.id);
    return "skipped";
  }

  const email = await getUserEmail(supabase, notification.user_id);
  if (!email) {
    await markEmailFallbackError(supabase, notification.id, "Usuario sin email.");
    return "error";
  }

  const emailResult = await sendNotificationEmail({
    request,
    to: email,
    notification,
  });

  if (!emailResult.ok) {
    await markEmailFallbackError(supabase, notification.id, emailResult.error);
    return "error";
  }

  await supabase
    .from("app_notifications")
    .update({
      email_sent_at: new Date().toISOString(),
      email_error: null,
    })
    .eq("id", notification.id);

  return "sent";
}

async function sendPushNotificationsToUser({
  supabase,
  request,
  tenantId,
  userId,
}: {
  supabase: SupabaseClient;
  request: Request;
  tenantId: string;
  userId: string;
}) {
  const vapid = await getVapidConfig(request);
  if (!vapid) return;

  const { data: subscriptions } = await supabase
    .from("push_subscriptions")
    .select("id,endpoint,p256dh,auth")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .eq("is_active", true);

  for (const subscription of subscriptions ?? []) {
    try {
      const response = await sendWebPush(subscription as StoredPushSubscription, vapid);
      if (response.ok) {
        await supabase
          .from("push_subscriptions")
          .update({ last_error: null })
          .eq("id", subscription.id);
        continue;
      }

      await supabase
        .from("push_subscriptions")
        .update({
          is_active: ![404, 410].includes(response.status),
          last_error: `${response.status} ${await response.text()}`,
        })
        .eq("id", subscription.id);
    } catch (error) {
      await supabase
        .from("push_subscriptions")
        .update({ last_error: String(error) })
        .eq("id", subscription.id);
    }
  }
}

async function getNotificationPreferences(
  supabase: SupabaseClient,
  tenantId: string,
  userId: string,
): Promise<NotificationPreferences> {
  const { data } = await supabase
    .from("notification_preferences")
    .select("email_enabled,push_enabled")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .maybeSingle();

  return {
    email_enabled: data?.email_enabled ?? true,
    push_enabled: data?.push_enabled ?? true,
  };
}

async function getVapidConfig(request: Request) {
  const publicKey = await readRuntimeEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY");
  const privateKey = await readRuntimeEnv("VAPID_PRIVATE_KEY");
  if (!publicKey || !privateKey) return null;

  const supportEmail =
    (await readRuntimeEnv("NOTIFICATIONS_CONTACT_EMAIL")) ??
    (await readRuntimeEnv("SUPPORT_TO_EMAIL")) ??
    defaultSupportEmail;
  const subject =
    (await readRuntimeEnv("VAPID_SUBJECT")) ?? `mailto:${supportEmail}`;

  // Reading the origin keeps the fallback URL aligned with production/custom domains.
  await getPublicAppOrigin(request);

  return { publicKey, privateKey, subject };
}

async function sendNotificationEmail({
  request,
  to,
  notification,
}: {
  request: Request;
  to: string;
  notification: AppNotificationRow;
}) {
  const resendApiKey = await readRuntimeEnv("RESEND_API_KEY");
  const fromEmail =
    (await readRuntimeEnv("NOTIFICATIONS_FROM_EMAIL")) ??
    (await readRuntimeEnv("SUPPORT_FROM_EMAIL"));

  if (!resendApiKey || !fromEmail) {
    return { ok: false, error: "Falta configurar Resend para notificaciones." };
  }

  const appOrigin = await getPublicAppOrigin(request);
  const appUrl = `${appOrigin}/`;
  const text = buildNotificationEmailText(notification, appUrl);
  const subject =
    notification.type === "chat_message"
      ? `[${APP_NAME}] Tienes un nuevo mensaje`
      : `[${APP_NAME}] ${notification.title}`;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [to],
      subject,
      text,
      html: textToHtml(text),
      headers: {
        "X-Baura-Connect-Notification-Id": notification.id,
      },
    }),
  });

  if (!response.ok) {
    return { ok: false, error: await response.text() };
  }

  return { ok: true, error: "" };
}

function buildNotificationEmailText(
  notification: AppNotificationRow,
  appUrl: string,
) {
  if (notification.type === "chat_message") {
    return [
      `Tienes un nuevo mensaje sin leer en ${APP_NAME}.`,
      "",
      "Por privacidad, el contenido del mensaje solo se muestra dentro de la aplicación.",
      "",
      `Abrir ${APP_NAME}: ${appUrl}`,
    ].join("\n");
  }

  return [
    notification.title,
    "",
    notification.body,
    "",
    `Abrir agenda en ${APP_NAME}: ${appUrl}`,
  ].join("\n");
}

async function getUserEmail(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase.auth.admin.getUserById(userId);
  if (error) return "";
  return data.user?.email ?? "";
}

async function markEmailFallbackError(
  supabase: SupabaseClient,
  notificationId: string,
  error: string,
) {
  await supabase
    .from("app_notifications")
    .update({ email_error: error.slice(0, 1000) })
    .eq("id", notificationId);
}

function textToHtml(text: string) {
  return `<pre style="font-family:Arial,sans-serif;white-space:pre-wrap;line-height:1.5">${escapeHtml(text)}</pre>`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
