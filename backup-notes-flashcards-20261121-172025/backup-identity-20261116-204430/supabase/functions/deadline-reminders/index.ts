import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-deadline-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type PushSubscriptionRow = {
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth_secret: string;
};

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function isSupportedPushEndpoint(endpoint: string) {
  try {
    const url = new URL(endpoint);
    const host = url.hostname.toLowerCase();
    const allowedHosts = ["fcm.googleapis.com", "push.services.mozilla.com", "web.push.apple.com"];
    return url.protocol === "https:"
      && !url.username
      && !url.password
      && (!url.port || url.port === "443")
      && allowedHosts.some((allowedHost) => host === allowedHost || host.endsWith(`.${allowedHost}`));
  } catch {
    return false;
  }
}

function localDateAndMinutes(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    minutes: Number(values.hour) * 60 + Number(values.minute),
  };
}

async function insertNotifications(supabase: ReturnType<typeof createClient>, rows: Record<string, unknown>[]) {
  if (!rows.length) return 0;
  const userIds = [...new Set(rows.map((row) => String(row.user_id)))];
  const sourceKeys = [...new Set(rows.map((row) => String(row.source_key)))];
  const { data: existing, error: existingError } = await supabase
    .from("notifications")
    .select("user_id,source_key")
    .in("user_id", userIds)
    .in("source_key", sourceKeys);
  if (existingError) throw new Error(`Could not check existing notifications: ${existingError.message}`);

  const existingKeys = new Set((existing || []).map((row) => `${row.user_id}:${row.source_key}`));
  const pending = rows.filter((row) => !existingKeys.has(`${row.user_id}:${row.source_key}`));
  for (let offset = 0; offset < pending.length; offset += 100) {
    const { error } = await supabase.from("notifications").insert(pending.slice(offset, offset + 100));
    if (error) throw new Error(`Could not create notifications: ${error.message}`);
  }
  return pending.length;
}

async function createDeadlineNotifications(supabase: ReturnType<typeof createClient>, now: Date) {
  const { data: tasks, error } = await supabase
    .from("tasks")
    .select("id,user_id,title,due_at,reminder_before_minutes")
    .neq("status", "completed")
    .not("due_at", "is", null)
    .lte("due_at", new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString());
  if (error) throw new Error(`Could not retrieve deadlines: ${error.message}`);

  const rows = (tasks || []).flatMap((task) => {
    const dueAt = new Date(task.due_at).getTime();
    const reminderMinutes = Number(task.reminder_before_minutes || 0);
    const notifications = [];
    if (reminderMinutes > 0 && now.getTime() >= dueAt - reminderMinutes * 60_000 && now.getTime() < dueAt) {
      notifications.push({
        user_id: task.user_id,
        type: "task_reminder",
        title: "Deadline coming up",
        message: `${task.title} is due soon.`,
        source_key: `task-reminder:${task.id}`,
      });
    }
    if (now.getTime() >= dueAt) {
      notifications.push({
        user_id: task.user_id,
        type: "overdue_task",
        title: "Deadline overdue",
        message: `${task.title} is past its due date.`,
        source_key: `task-overdue:${task.id}`,
      });
    }
    return notifications;
  });
  return { taskCount: (tasks || []).length, notificationCount: await insertNotifications(supabase, rows) };
}

async function createDailyNotifications(
  supabase: ReturnType<typeof createClient>,
  now: Date,
) {
  const result = { checked: 0, created: 0, claims: [] as Array<{ user_id: string; date: string; notification_id?: string }> };
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const { data: preferences, error } = await supabase
      .from("daily_reminder_preferences")
      .select("user_id,local_time,timezone")
      .eq("enabled", true)
      .order("user_id")
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(`Could not retrieve daily reminder settings: ${error.message}`);
    if (!preferences?.length) break;
    result.checked += preferences.length;

    for (const preference of preferences) {
      let local;
      try {
        local = localDateAndMinutes(now, preference.timezone || "UTC");
      } catch (error) {
        console.error(`Invalid timezone for reminder account ${preference.user_id}.`, error);
        continue;
      }
      const [hour, minute] = String(preference.local_time).slice(0, 5).split(":").map(Number);
      if (local.minutes < hour * 60 + minute) continue;

      const { data: claimed, error: claimError } = await supabase.rpc("claim_daily_reminder", {
        p_user_id: preference.user_id,
        p_reminder_date: local.date,
      });
      if (claimError) throw new Error(`Could not claim a daily reminder: ${claimError.message}`);
      if (!claimed) continue;
      const claim = { user_id: preference.user_id, date: local.date };
      result.claims.push(claim);

      const { data: existing, error: existingError } = await supabase
        .from("notifications")
        .select("id")
        .eq("user_id", preference.user_id)
        .eq("source_key", `daily-reminder:${local.date}`)
        .maybeSingle();
      if (existingError) throw new Error(`Could not check the daily reminder record: ${existingError.message}`);
      if (existing?.id) {
        claim.notification_id = existing.id;
        continue;
      }

      const [{ data: taskRows, error: taskError, count }, { data: profile, error: profileError }] = await Promise.all([
        supabase.from("tasks")
          .select("id", { count: "exact" })
          .eq("user_id", preference.user_id)
          .neq("status", "completed")
          .limit(1),
        supabase.from("profiles").select("language").eq("id", preference.user_id).maybeSingle(),
      ]);
      if (taskError) throw new Error(`Could not load open tasks for the daily reminder: ${taskError.message}`);
      if (profileError) throw new Error(`Could not load reminder language: ${profileError.message}`);
      const openCount = count ?? taskRows?.length ?? 0;
      const isArabic = profile?.language === "ar";
      const title = isArabic ? "حان وقت مراجعة مهامك" : "Time to check your study plan";
      const message = isArabic
        ? openCount > 0
          ? `لديك ${openCount} مهام مفتوحة. افتح Study Zone لمراجعة ما عليك.`
          : "لا توجد مهام مفتوحة الآن. افتح Study Zone لمراجعة خطتك والحفاظ على تقدمك."
        : openCount > 0
          ? `You have ${openCount} open task${openCount === 1 ? "" : "s"}. Open Study Zone to review what is due.`
          : "No open tasks right now. Open Study Zone to review your plan and keep your progress going.";

      const { data: inserted, error: insertError } = await supabase.from("notifications").insert({
        user_id: preference.user_id,
        type: "task_reminder",
        title,
        message,
        source_key: `daily-reminder:${local.date}`,
      }).select("id").single();
      if (insertError) throw new Error(`Could not create a daily reminder: ${insertError.message}`);
      claim.notification_id = inserted.id;
      result.created += 1;
    }
    if (preferences.length < pageSize) break;
  }
  return result;
}

function configureWebPush() {
  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  const subject = Deno.env.get("VAPID_SUBJECT");
  if (!publicKey || !privateKey || !subject) {
    throw new Error("VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and VAPID_SUBJECT are required to send push notifications.");
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
}

async function deliverPendingNotifications(supabase: ReturnType<typeof createClient>) {
  const { data: notifications, error } = await supabase
    .from("notifications")
    .select("id,user_id,type,title,message,source_key")
    .is("push_sent_at", null)
    .is("read_at", null)
    .gte("created_at", new Date(Date.now() - 7 * 86400_000).toISOString())
    .order("created_at", { ascending: true })
    .limit(500);
  if (error) throw new Error(`Could not retrieve pending push notifications: ${error.message}`);

  let attempted = 0;
  let sent = 0;
  let failures = 0;
  const pushEnabledByUser = new Map<string, boolean>();
  for (const notification of notifications || []) {
    let pushEnabled = pushEnabledByUser.get(notification.user_id);
    if (pushEnabled === undefined) {
      const { data: preference, error: preferenceError } = await supabase
        .from("daily_reminder_preferences")
        .select("enabled")
        .eq("user_id", notification.user_id)
        .maybeSingle();
      if (preferenceError) throw new Error(`Could not check push preferences: ${preferenceError.message}`);
      pushEnabled = Boolean(preference?.enabled);
      pushEnabledByUser.set(notification.user_id, pushEnabled);
    }
    if (!pushEnabled) {
      const { error: updateError } = await supabase.from("notifications")
        .update({ push_sent_at: new Date().toISOString() })
        .eq("id", notification.id).is("push_sent_at", null);
      if (updateError) throw new Error(`Could not close a disabled push notification: ${updateError.message}`);
      continue;
    }

    const { data: subscriptions, error: subscriptionError } = await supabase
      .from("push_subscriptions")
      .select("user_id,endpoint,p256dh,auth_secret")
      .eq("user_id", notification.user_id);
    if (subscriptionError) throw new Error(`Could not retrieve push subscriptions: ${subscriptionError.message}`);

    const validSubscriptions: PushSubscriptionRow[] = [];
    for (const subscription of (subscriptions || []) as PushSubscriptionRow[]) {
      if (isSupportedPushEndpoint(subscription.endpoint)) {
        validSubscriptions.push(subscription);
        continue;
      }
      console.error(`Removing unsupported push endpoint for account ${notification.user_id}.`);
      const { error: deleteError } = await supabase.from("push_subscriptions")
        .delete().eq("user_id", notification.user_id).eq("endpoint", subscription.endpoint);
      if (deleteError) throw new Error(`Could not remove an unsupported push endpoint: ${deleteError.message}`);
    }

    if (!validSubscriptions.length) {
      const { error: updateError } = await supabase.from("notifications")
        .update({ push_sent_at: new Date().toISOString() })
        .eq("id", notification.id).is("push_sent_at", null);
      if (updateError) throw new Error(`Could not close an undeliverable notification: ${updateError.message}`);
      continue;
    }

    configureWebPush();
    for (const subscription of validSubscriptions) {
      const { data: claimed, error: claimError } = await supabase.rpc("claim_push_notification_delivery", {
        p_notification_id: notification.id,
        p_user_id: notification.user_id,
        p_endpoint: subscription.endpoint,
      });
      if (claimError) throw new Error(`Could not claim a push delivery: ${claimError.message}`);
      if (!claimed) continue;
      attempted += 1;

      try {
        const url = notification.type === "achievement" ? "./#achievements"
          : notification.source_key?.startsWith("daily-reminder:") ? "./#tasks"
            : notification.type === "task_reminder" || notification.type === "overdue_task" ? "./#deadlines"
              : "./#notifications";
        await webpush.sendNotification({
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth_secret },
        }, JSON.stringify({
          title: notification.title,
          body: notification.message,
          url,
          tag: notification.source_key || notification.id,
        }), { TTL: 86400 });
        const { error: updateError } = await supabase.from("push_notification_deliveries")
          .update({ sent_at: new Date().toISOString(), claimed_until: null })
          .eq("notification_id", notification.id).eq("endpoint", subscription.endpoint);
        if (updateError) throw new Error(`Could not record a push delivery: ${updateError.message}`);
        sent += 1;
      } catch (error) {
        const statusCode = Number((error as { statusCode?: number })?.statusCode);
        if (statusCode === 404 || statusCode === 410) {
          const { error: deleteError } = await supabase.from("push_subscriptions")
            .delete().eq("user_id", notification.user_id).eq("endpoint", subscription.endpoint);
          if (deleteError) throw new Error(`Expired push subscription cleanup failed: ${deleteError.message}`);
          continue;
        }
        failures += 1;
        console.error(`Push delivery failed for notification ${notification.id}.`, error);
        const { error: releaseError } = await supabase.from("push_notification_deliveries")
          .update({ claimed_until: new Date().toISOString() })
          .eq("notification_id", notification.id).eq("endpoint", subscription.endpoint)
          .is("sent_at", null);
        if (releaseError) throw new Error(`Could not release a failed push delivery: ${releaseError.message}`);
      }
    }

    const { count: pendingCount, error: pendingError } = await supabase.from("push_notification_deliveries")
      .select("endpoint", { count: "exact", head: true })
      .eq("notification_id", notification.id)
      .is("sent_at", null);
    if (pendingError) throw new Error(`Could not verify push delivery status: ${pendingError.message}`);
    if (!pendingCount) {
      const { error: updateError } = await supabase.from("notifications")
        .update({ push_sent_at: new Date().toISOString() })
        .eq("id", notification.id).is("push_sent_at", null);
      if (updateError) throw new Error(`Could not mark a push notification as delivered: ${updateError.message}`);
    }
  }
  return { notifications: notifications?.length || 0, attempted, sent, failures };
}

async function settleDailyClaims(
  supabase: ReturnType<typeof createClient>,
  claims: Array<{ user_id: string; date: string; notification_id?: string }>,
) {
  for (const claim of claims) {
    if (!claim.notification_id) {
      const { error } = await supabase.from("daily_reminder_deliveries")
        .update({ claimed_until: new Date().toISOString() })
        .eq("user_id", claim.user_id).eq("reminder_date", claim.date)
        .is("sent_at", null);
      if (error) throw new Error(`Could not release a daily reminder claim: ${error.message}`);
      continue;
    }
    const { data: notification, error: notificationError } = await supabase.from("notifications")
      .select("push_sent_at,read_at").eq("id", claim.notification_id).maybeSingle();
    if (notificationError) throw new Error(`Could not verify daily push status: ${notificationError.message}`);
    const sentAt = notification?.push_sent_at || notification?.read_at || null;
    const { error } = await supabase.from("daily_reminder_deliveries")
      .update({ sent_at: sentAt || null, claimed_until: sentAt ? null : new Date().toISOString() })
      .eq("user_id", claim.user_id).eq("reminder_date", claim.date);
    if (error) throw new Error(`Could not complete the daily reminder claim: ${error.message}`);
  }
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });
  }

  const expectedSecret = Deno.env.get("DEADLINE_CRON_SECRET");
  const providedSecret = request.headers.get("x-deadline-cron-secret");
  if (!expectedSecret || !providedSecret || providedSecret !== expectedSecret) {
    return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Missing server-side Supabase environment configuration.");
    return Response.json({ error: "Server configuration is incomplete" }, { status: 500, headers: corsHeaders });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const now = new Date();
  let dailyClaims: Array<{ user_id: string; date: string; notification_id?: string }> = [];
  try {
    const deadlines = await createDeadlineNotifications(supabase, now);
    const daily = await createDailyNotifications(supabase, now);
    dailyClaims = daily.claims;
    const push = await deliverPendingNotifications(supabase);
    await settleDailyClaims(supabase, dailyClaims);
    return Response.json({
      processed: deadlines.taskCount,
      deadlineNotifications: deadlines.notificationCount,
      dailyPreferencesChecked: daily.checked,
      dailyNotificationsCreated: daily.created,
      push,
    }, { headers: corsHeaders });
  } catch (error) {
    console.error("Reminder processing failed.", error);
    try {
      await settleDailyClaims(supabase, dailyClaims);
    } catch (settleError) {
      console.error("Could not release daily reminder claims after failure.", settleError);
    }
    return Response.json({ error: messageOf(error) }, { status: 500, headers: corsHeaders });
  }
});
