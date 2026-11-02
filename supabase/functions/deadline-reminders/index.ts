import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-deadline-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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
  const { data: tasks, error: taskError } = await supabase
    .from("tasks")
    .select("id,user_id,title,due_at,reminder_before_minutes")
    .neq("status", "completed")
    .not("due_at", "is", null)
    .lte("due_at", new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString());

  if (taskError) {
    console.error("Could not retrieve tasks for deadline reminders.", taskError);
    return Response.json({ error: "Could not retrieve deadlines" }, { status: 500, headers: corsHeaders });
  }

  const notifications = (tasks || []).flatMap((task) => {
    const dueAt = new Date(task.due_at).getTime();
    const reminderMinutes = Number(task.reminder_before_minutes || 0);
    const rows = [];

    if (reminderMinutes > 0 && now.getTime() >= dueAt - reminderMinutes * 60_000 && now.getTime() < dueAt) {
      rows.push({
        user_id: task.user_id,
        type: "task_reminder",
        title: "Deadline coming up",
        message: `${task.title} is due soon.`,
        source_key: `task-reminder:${task.id}`,
      });
    }

    if (now.getTime() >= dueAt) {
      rows.push({
        user_id: task.user_id,
        type: "overdue_task",
        title: "Deadline overdue",
        message: `${task.title} is past its due date.`,
        source_key: `task-overdue:${task.id}`,
      });
    }

    return rows;
  });

  if (notifications.length) {
    const { error: insertError } = await supabase
      .from("notifications")
      .upsert(notifications, { onConflict: "user_id,source_key", ignoreDuplicates: true });
    if (insertError) {
      console.error("Could not create deadline notifications.", insertError);
      return Response.json({ error: "Could not create reminders" }, { status: 500, headers: corsHeaders });
    }
  }

  return Response.json({ processed: (tasks || []).length, notifications: notifications.length }, { headers: corsHeaders });
});
