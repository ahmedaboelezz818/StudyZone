/*
 * Study Zone native Android shell.
 *
 * Loaded only inside the Capacitor WebView (it is a no-op on the website).
 * Responsibilities:
 *  - status bar, splash screen, keyboard and safe-area integration;
 *  - hardware back button handling;
 *  - app lifecycle -> offline sync + focus reconciliation;
 *  - local notifications for tasks, exams and the focus timer;
 *  - optional FCM push token registration;
 *  - deep links into app pages.
 */
(() => {
  "use strict";

  const cap = window.Capacitor;
  const plugins = cap?.Plugins || {};
  const isNative = Boolean(cap?.isNativePlatform?.());
  const platform = cap?.getPlatform?.() || "web";
  if (!isNative) {
    window.StudyZoneNotifications = window.StudyZoneNotifications || {
      isNative: false,
      requestPermission: async () =>
        typeof Notification !== "undefined" ? Notification.permission : "denied",
      syncTaskReminders: () => {},
      cancelAll: () => {},
    };
    return;
  }

  const {
    App,
    Keyboard,
    LocalNotifications,
    Network,
    PushNotifications,
    SplashScreen,
    StatusBar,
  } = plugins;

  const iconPlugin = cap?.Plugins?.StudyZoneIconPlugin;
  const widgetPlugin = cap?.Plugins?.StudyZoneWidgetPlugin;

  const root = document.documentElement;
  // Channel IDs end in _v2 on purpose. Android never lets an app change the
  // sound of an existing channel, so users who had the old (possibly silent)
  // channels get fresh channels that actually carry the new bell. The IDs are
  // stable from now on and must not be bumped per release.
  const CHANNEL_REMINDERS = "studyzone_reminders_v2";
  const CHANNEL_DEADLINES = "studyzone_deadlines_v2";
  const CHANNEL_FOCUS = "studyzone_focus_v2";
  const CHANNEL_GOALS = "studyzone_goals_v2";
  const CHANNEL_ACHIEVEMENTS = "studyzone_achievements_v2";
  const CHANNEL_GENERAL = "studyzone_general_v2";
  const NOTIFICATION_SOUND = "beep.wav";
  const SCHEDULED_KEY = "studyzone.native.scheduled.v1";
  const PUSH_TOKEN_KEY = "studyzone.native.push-token";
  const FOCUS_NOTIFICATION_ID = 900001;
  const TEST_NOTIFICATION_BASE = 990000;
  const MAX_SCHEDULED = 60;

  root.classList.add("is-native", `is-${platform}`, "native-app");
  root.dataset.nativePlatform = platform;

  const config = window.studyFlowSupabaseConfig || {};

  function language() {
    return window.StudyZoneApp?.language === "ar" ||
      document.documentElement.lang === "ar"
      ? "ar"
      : "en";
  }

  function text(en, ar) {
    return language() === "ar" ? ar : en;
  }

  function notificationTypes() {
    try {
      const saved = JSON.parse(
        localStorage.getItem("studyzone.notification.types") || "null",
      );
      return {
        tasks: true,
        deadlines: true,
        exams: true,
        sessions: true,
        pomodoro: true,
        goals: true,
        team: true,
        challenges: true,
        achievements: true,
        ...(saved || {}),
      };
    } catch {
      return {
        tasks: true,
        deadlines: true,
        exams: true,
        sessions: true,
        pomodoro: true,
        goals: true,
        team: true,
        challenges: true,
        achievements: true,
      };
    }
  }

  function readScheduled() {
    try {
      const parsed = JSON.parse(localStorage.getItem(SCHEDULED_KEY) || "[]");
      return Array.isArray(parsed) ? parsed.filter(Number.isFinite) : [];
    } catch {
      return [];
    }
  }

  function writeScheduled(ids) {
    localStorage.setItem(SCHEDULED_KEY, JSON.stringify([...new Set(ids)]));
  }

  function stableId(prefix, value) {
    let hash = 0;
    const source = String(value || "");
    for (let index = 0; index < source.length; index += 1) {
      hash = (hash * 31 + source.charCodeAt(index)) >>> 0;
    }
    return prefix + (hash % 90000);
  }

  function readAccessToken() {
    try {
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (!key || !key.startsWith("sb-") || !key.endsWith("-auth-token"))
          continue;
        const parsed = JSON.parse(localStorage.getItem(key) || "null");
        const session = parsed?.session || parsed;
        if (session?.access_token) return session.access_token;
      }
    } catch {
      /* ignore */
    }
    return "";
  }

  function readUserId() {
    try {
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (!key || !key.startsWith("sb-") || !key.endsWith("-auth-token"))
          continue;
        const parsed = JSON.parse(localStorage.getItem(key) || "null");
        const session = parsed?.session || parsed;
        if (session?.user?.id) return session.user.id;
      }
    } catch {
      /* ignore */
    }
    return "";
  }

  // ---- Status bar ---------------------------------------------------------
  function applyStatusBar() {
    if (!StatusBar) return;
    const light = root.dataset.theme === "light";
    StatusBar.setStyle({ style: light ? "DARK" : "LIGHT" }).catch(() => {});
    StatusBar.setOverlaysWebView?.({ overlay: true }).catch(() => {});
    StatusBar.setBackgroundColor?.({ color: "#00000000" }).catch(() => {});
  }
  applyStatusBar();
  window.addEventListener("studyzone:theme-changed", applyStatusBar);

  // ---- Splash screen ------------------------------------------------------
  const hideSplash = () => {
    SplashScreen?.hide?.({ fadeOutDuration: 220 }).catch(() => {});
  };
  if (document.readyState === "complete") window.setTimeout(hideSplash, 250);
  else window.addEventListener("load", () => window.setTimeout(hideSplash, 250), { once: true });

  // ---- Keyboard & safe area ----------------------------------------------
  const keyboard = {
    async init() {
      if (!Keyboard) return;
      Keyboard.setAccessoryBarVisible?.({ isVisible: false }).catch(() => {});
      Keyboard.addListener("keyboardWillShow", (info) => {
        root.style.setProperty(
          "--keyboard-height",
          `${Math.max(0, info?.keyboardHeight || 0)}px`,
        );
        root.classList.add("keyboard-open");
        window.setTimeout(() => {
          const focused = document.activeElement;
          if (focused && /^(INPUT|TEXTAREA|SELECT)$/.test(focused.tagName))
            focused.scrollIntoView({ block: "center", behavior: "smooth" });
        }, 120);
      });
      Keyboard.addListener("keyboardWillHide", () => {
        root.style.setProperty("--keyboard-height", "0px");
        root.classList.remove("keyboard-open");
      });
    },
  };
  void keyboard.init();

  // ---- Local notifications ------------------------------------------------
  const notifications = {
    ready: false,
    permission: "prompt",
    scheduling: false,
    lastSignature: "",
    async init() {
      if (!LocalNotifications) return;
      try {
        const status = await LocalNotifications.checkPermissions();
        this.permission = status?.display || "prompt";
        await this.createChannels();
        this.ready = true;
        if (this.permission === "granted") this.scheduleFromApp();
      } catch (error) {
        console.warn("[StudyZoneNotifications] init failed", error);
      }
    },
    async createChannels(accentColor) {
      if (!LocalNotifications?.createChannel) return;
      const color = accentColor || this.themeAccentColor();
      const make = (id, nameEn, nameAr, descEn, descAr, importance) =>
        LocalNotifications.createChannel({
          id,
          name: text(nameEn, nameAr),
          description: text(descEn, descAr),
          importance,
          visibility: 1,
          vibration: true,
          lights: true,
          lightColor: color,
          sound: NOTIFICATION_SOUND,
        });
      await Promise.all([
        make(
          CHANNEL_REMINDERS,
          "Task reminders",
          "تذكيرات المهام",
          "Tasks and study reminders",
          "المهام وتذكيرات الدراسة",
          5,
        ),
        make(
          CHANNEL_DEADLINES,
          "Deadline alerts",
          "تنبيهات المواعيد",
          "Deadlines and exams",
          "المواعيد النهائية والاختبارات",
          5,
        ),
        make(
          CHANNEL_FOCUS,
          "Focus & Pomodoro",
          "التركيز وبومودورو",
          "Focus and break completion",
          "انتهاء التركيز والاستراحة",
          5,
        ),
        make(
          CHANNEL_GOALS,
          "Study goals",
          "أهداف الدراسة",
          "Daily goals and streaks",
          "الأهداف اليومية والسلاسل",
          4,
        ),
        make(
          CHANNEL_ACHIEVEMENTS,
          "Achievements",
          "الإنجازات",
          "Streaks and rewards",
          "السلاسل والمكافآت",
          3,
        ),
        make(
          CHANNEL_GENERAL,
          "General notifications",
          "إشعارات عامة",
          "Other Study Zone updates",
          "تحديثات Study Zone الأخرى",
          3,
        ),
      ]).catch(() => {});
    },
    async requestPermission() {
      if (!LocalNotifications) return "denied";
      try {
        const status = await LocalNotifications.requestPermissions();
        this.permission = status?.display || "denied";
        if (this.permission === "granted") {
          await this.createChannels();
          this.ready = true;
          this.scheduleFromApp();
          void push.register();
        }
        return this.permission;
      } catch (error) {
        console.warn("[StudyZoneNotifications] permission failed", error);
        return "denied";
      }
    },
    async cancelScheduled() {
      if (!LocalNotifications) return;
      const ids = readScheduled();
      if (!ids.length) return;
      try {
        await LocalNotifications.cancel({
          notifications: ids.map((id) => ({ id })),
        });
      } catch (error) {
        console.warn("[StudyZoneNotifications] cancel failed", error);
      }
      writeScheduled([]);
    },
    async cancelAll() {
      if (!LocalNotifications) return;
      try {
        await LocalNotifications.cancel({
          notifications: [{ id: FOCUS_NOTIFICATION_ID }],
        });
      } catch {
        /* ignore */
      }
      await this.cancelScheduled();
      this.lastSignature = "";
    },
    buildTaskNotifications(tasks, examResults) {
      const types = notificationTypes();
      const now = Date.now();
      const notifications = [];
      const taskLimit = Math.floor(MAX_SCHEDULED * 0.65);
      const examLimit = MAX_SCHEDULED - taskLimit;

      if (types.tasks || types.deadlines) {
        const sorted = (Array.isArray(tasks) ? tasks : [])
          .filter(
            (task) =>
              task &&
              !task.completed_at &&
              task.status !== "completed" &&
              task.due_at &&
              !Number.isNaN(new Date(task.due_at).getTime()),
          )
          .sort((a, b) => new Date(a.due_at) - new Date(b.due_at))
          .slice(0, taskLimit);
        for (const task of sorted) {
          const due = new Date(task.due_at).getTime();
          const lead = Number(task.reminder_before_minutes);
          const offset = (Number.isFinite(lead) && lead >= 0 ? lead : 30) * 60000;
          let at = due - offset;
          if (at < now + 60000) at = due;
          if (at < now + 60000) continue;
          const subject = task.subject || task.subjects?.name || "";
          notifications.push({
            id: stableId(100000, `task:${task.id || task.title}:${due}`),
            title: text(
              "⏰ Study Zone task",
              "⏰ مهمة في Study Zone",
            ),
            body: subject
              ? text(
                  `Don't forget: ${task.title} · ${subject}`,
                  `لا تنسى: ${task.title} · ${subject}`,
                )
              : text(
                  `Task due soon: ${task.title || "Untitled"}`,
                  `مهمة مستحقة قريباً: ${task.title || "بدون عنوان"}`,
                ),
            schedule: { at: new Date(at), allowWhileIdle: true },
            channelId: CHANNEL_REMINDERS,
            smallIcon: "ic_stat_studyzone",
            iconColor: this.themeAccentColor(),
            sound: NOTIFICATION_SOUND,
            extra: { page: "tasks", taskId: task.id || null },
          });
        }
      }

      if (types.exams) {
        const exams = (Array.isArray(examResults) ? examResults : [])
          .filter(
            (exam) =>
              exam?.exam_at && !Number.isNaN(new Date(exam.exam_at).getTime()),
          )
          .map((exam) => ({ ...exam, at: new Date(exam.exam_at).getTime() }))
          .filter((exam) => exam.at > now)
          .sort((a, b) => a.at - b.at)
          .slice(0, examLimit);
        for (const exam of exams) {
          const triggers = [
            exam.at - 24 * 3600000,
            exam.at - 3600000,
          ].filter((at) => at > now + 60000);
          for (const at of triggers) {
            notifications.push({
              id: stableId(200000, `exam:${exam.id || exam.title}:${at}`),
              title: text("📚 Exam reminder", "تذكير باختبار"),
              body: text(
                `Prepare for: ${exam.title || exam.subject || "Exam"}`,
                `استعد لاختبار: ${exam.title || exam.subject || "اختبار"}`,
              ),
              schedule: { at: new Date(at), allowWhileIdle: true },
              channelId: CHANNEL_DEADLINES,
              smallIcon: "ic_stat_studyzone",
              iconColor: this.themeAccentColor(),
              sound: NOTIFICATION_SOUND,
              extra: { page: "exams", examId: exam.id || null },
            });
          }
        }
      }

      return notifications.slice(0, MAX_SCHEDULED);
    },
    themeAccentColor() {
      try {
        const value =
          typeof getComputedStyle === "function"
            ? getComputedStyle(document.documentElement).getPropertyValue("--accent")
            : null;
        const trimmed = (value || "").trim();
        if (trimmed) return trimmed;
      } catch (error) {
        /* fall through to the default accent */
      }
      return "#06D6A0";
    },
    async syncTaskReminders(tasks, examResults) {
      if (!LocalNotifications || this.permission !== "granted") return;
      if (this.scheduling) return;
      const pending = this.buildTaskNotifications(tasks, examResults);
      const signature = pending
        .map((item) => `${item.id}:${item.schedule.at.getTime()}`)
        .join("|") + `|${language()}`;
      if (signature === this.lastSignature) return;
      this.scheduling = true;
      try {
        await this.cancelScheduled();
        if (pending.length) {
          await LocalNotifications.schedule({ notifications: pending });
          writeScheduled(pending.map((item) => item.id));
        }
        this.lastSignature = signature;
      } catch (error) {
        console.warn("[StudyZoneNotifications] scheduling failed", error);
      } finally {
        this.scheduling = false;
      }
    },
    scheduleFromApp() {
      const app = window.StudyZoneApp;
      if (!app) return;
      this.syncTaskReminders(app.tasks || [], app.exams || []);
      this.syncFocusReminder(app.focus);
    },
    async syncFocusReminder(focus) {
      if (!LocalNotifications || this.permission !== "granted") return;
      const types = notificationTypes();
      const enabled = types.pomodoro || types.sessions;
      const running = focus?.status === "running" && Number(focus.endAt) > Date.now();
      try {
        if (!enabled || !running) {
          await LocalNotifications.cancel({
            notifications: [{ id: FOCUS_NOTIFICATION_ID }],
          });
          return;
        }
        const isFocus = focus.type === "focus";
        await LocalNotifications.schedule({
          notifications: [
            {
              id: FOCUS_NOTIFICATION_ID,
              title: isFocus
                ? text("🎯 Focus complete", "اكتملت جلسة التركيز")
                : text("☕ Break over", "انتهت الاستراحة"),
              body: isFocus
                ? text(
                    "Great job! Time for a short break.",
                    "أحسنت! حان وقت استراحة قصيرة.",
                  )
                : text(
                    "Ready to focus again?",
                    "هل أنت مستعد للتركيز مرة أخرى؟",
                  ),
              schedule: {
                at: new Date(Number(focus.endAt)),
                allowWhileIdle: true,
              },
              channelId: CHANNEL_FOCUS,
              smallIcon: "ic_stat_studyzone",
              iconColor: this.themeAccentColor(),
              sound: NOTIFICATION_SOUND,
              extra: { page: "focus" },
            },
          ],
        });
      } catch (error) {
        console.warn("[StudyZoneNotifications] focus reminder failed", error);
      }
    },
    async testNotification() {
      if (!LocalNotifications) {
        showNativeToast(text("Notifications need the Android app.", "الإشعارات تحتاج تطبيق أندرويد."));
        return false;
      }
      try {
        let status = await LocalNotifications.checkPermissions();
        if (status?.display !== "granted") {
          status = await LocalNotifications.requestPermissions();
        }
        this.permission = status?.display || "denied";
        if (this.permission !== "granted") {
          showNativeToast(
            text(
              "Notifications are blocked. Open Android settings to allow them.",
              "الإشعارات محظورة. افتح إعدادات أندرويد للسماح بها.",
            ),
          );
          return false;
        }
        await this.createChannels();
        const id = TEST_NOTIFICATION_BASE + (Math.floor(Date.now() / 1000) % 1000);
        await LocalNotifications.schedule({
          notifications: [
            {
              id,
              title: text("🔔 Study Zone test", "🔔 اختبار Study Zone"),
              body: text(
                "If you can hear this bell, notification sound works.",
                "إذا سمعت هذا الجرس، فصوت الإشعارات يعمل.",
              ),
              schedule: { at: new Date(Date.now() + 700), allowWhileIdle: true },
              channelId: CHANNEL_REMINDERS,
              smallIcon: "ic_stat_studyzone",
              iconColor: this.themeAccentColor(),
              sound: NOTIFICATION_SOUND,
              extra: { page: "settings" },
            },
          ],
        });
        return true;
      } catch (error) {
        console.warn("[StudyZoneNotifications] test notification failed", error);
        showNativeToast(text("Could not send the test notification.", "تعذر إرسال إشعار الاختبار."));
        return false;
      }
    },
  };

  // ---- Push (FCM) ---------------------------------------------------------
  const push = {
    async register() {
      if (!PushNotifications) return null;
      try {
        let permission = await PushNotifications.checkPermissions();
        if (permission?.receive !== "granted")
          permission = await PushNotifications.requestPermissions();
        if (permission?.receive !== "granted") return null;
        await PushNotifications.register();
        return permission;
      } catch (error) {
        console.warn(
          "[StudyZonePush] push registration needs Firebase configuration",
          error,
        );
        return null;
      }
    },
    async saveToken(token) {
      if (!token) return;
      localStorage.setItem(PUSH_TOKEN_KEY, token);
      const userId = readUserId();
      const accessToken = readAccessToken();
      if (!userId || !accessToken || !config.url || !config.anonKey) return;
      try {
        await fetch(`${config.url}/rest/v1/device_push_tokens`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            apikey: config.anonKey,
            authorization: `Bearer ${accessToken}`,
            prefer: "resolution=merge-duplicates,return=minimal",
          },
          body: JSON.stringify({
            user_id: userId,
            token,
            platform: "android",
            updated_at: new Date().toISOString(),
          }),
        });
      } catch (error) {
        console.warn("[StudyZonePush] could not store push token", error);
      }
    },
    async init() {
      if (!PushNotifications) return;
      PushNotifications.addListener("registration", (token) =>
        this.saveToken(token?.value),
      );
      PushNotifications.addListener("registrationError", (error) =>
        console.warn("[StudyZonePush] registration error", error),
      );
      PushNotifications.addListener("pushNotificationReceived", (notification) => {
        // Foreground delivery: the in-app UI already reacts to local data, so
        // only route deep links here.
        const page = notification?.data?.page;
        if (page) window.StudyZoneApp?.navigate?.(page);
      });
      PushNotifications.addListener(
        "pushNotificationActionPerformed",
        (action) => {
          const page = action?.notification?.data?.page;
          if (page) window.StudyZoneApp?.navigate?.(page);
        },
      );
      if (localStorage.getItem(PUSH_TOKEN_KEY)) return;
      // Registration is attempted after notification permission is granted so
      // Android 13+ does not silently drop the request.
    },
  };
  void push.init();

  // ---- Lifecycle ----------------------------------------------------------
  let lastBackAt = 0;
  function closeTopLayer() {
    const modal = document.querySelector(".modal-backdrop:not([hidden])");
    if (modal) {
      modal.querySelector("[data-close-modal]")?.click();
      if (!modal.hidden) modal.hidden = true;
      return true;
    }
    const sidebar = document.getElementById("sidebar");
    if (sidebar?.classList.contains("open")) {
      sidebar.classList.remove("open");
      return true;
    }
    return false;
  }

  function onBackButton({ canGoBack } = {}) {
    if (closeTopLayer()) return;
    const page = window.StudyZoneApp?.page || "dashboard";
    if (page !== "dashboard") {
      window.StudyZoneApp?.navigate?.("dashboard");
      return;
    }
    const now = Date.now();
    if (now - lastBackAt < 2000) {
      if (typeof App?.minimizeApp === "function") App.minimizeApp();
      else App?.exitApp?.();
      return;
    }
    lastBackAt = now;
    showNativeToast(text("Press back again to exit", "اضغط رجوع مرة أخرى للخروج"));
  }

  function showNativeToast(message) {
    let region = document.getElementById("toast-region");
    if (!region) return;
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    region.append(toast);
    window.setTimeout(() => {
      toast.classList.add("leaving");
      window.setTimeout(() => toast.remove(), 250);
    }, 2200);
  }

  async function onResume() {
    document.documentElement.classList.remove("app-background");
    window.StudyZoneApp?.reconcileFocus?.();
    window.StudyZoneOffline?.syncNow?.();
    window.StudyZoneApp?.syncReminders?.();
    notifications.syncFocusReminder(window.StudyZoneApp?.focus);
  }

  function onPause() {
    document.documentElement.classList.add("app-background");
    notifications.syncFocusReminder(window.StudyZoneApp?.focus);
  }

  App?.addListener?.("backButton", onBackButton);
  App?.addListener?.("appStateChange", ({ isActive }) => {
    if (isActive) void onResume();
    else onPause();
  });
  App?.addListener?.("appUrlOpen", ({ url }) => {
    try {
      const parsed = new URL(url);
      const page = (parsed.hash || "").replace(/^#/, "");
      if (page) window.StudyZoneApp?.navigate?.(page);
    } catch {
      /* ignore malformed links */
    }
  });

  // ---- Network ------------------------------------------------------------
  Network?.addListener?.("networkStatusChange", (status) => {
    if (status?.connected) {
      window.dispatchEvent(new Event("online"));
      void window.StudyZoneOffline?.syncNow?.();
    } else {
      window.dispatchEvent(new Event("offline"));
    }
    window.StudyZoneSyncUI?.refresh?.();
  });

  // ---- Theme / language refresh ------------------------------------------
  window.addEventListener("studyzone:theme-changed", async (event) => {
    applyStatusBar();
    const themeId =
      event?.detail?.theme ||
      document.documentElement.dataset.themePreset ||
      "original";
    notifications.setLauncherIcon?.(themeId);
    const accent = notifications.themeAccentColor();
    await notifications.createChannels(accent);
    refreshNotifications();
  });
  const refreshNotifications = async () => {
    const accent = notifications.themeAccentColor();
    await notifications.createChannels(accent);
    notifications.syncTaskReminders(
      window.StudyZoneApp?.tasks || [],
      window.StudyZoneApp?.exams || [],
    );
    notifications.syncFocusReminder(window.StudyZoneApp?.focus);
  };
  window.addEventListener("studyzone:notification-types", refreshNotifications);
  window.addEventListener("online", refreshNotifications);

  // Keep the native focus notification aligned with the timestamp-based timer.
  let focusSignature = "";
  window.setInterval(() => {
    const focus = window.StudyZoneApp?.focus;
    if (!focus) return;
    const signature = `${focus.status}:${focus.endAt || 0}:${focus.type}`;
    if (signature === focusSignature) return;
    focusSignature = signature;
    notifications.syncFocusReminder(focus);
  }, 5000);

  // Public API used by app.js.
  window.StudyZoneNotifications = {
    isNative: true,
    platform,
    requestPermission: () => notifications.requestPermission(),
    syncTaskReminders: (tasks, exams) =>
      notifications.syncTaskReminders(tasks, exams),
    cancelAll: () => notifications.cancelAll(),
    testNotification: () => notifications.testNotification(),
    syncFocusReminder: (focus) => notifications.syncFocusReminder(focus),
    scheduleFromApp: () => notifications.scheduleFromApp(),
    registerPush: () => push.register(),
    setLauncherIcon: (themeId) => {
      if (iconPlugin) {
        void iconPlugin.setLauncherIcon({ themeId }).catch(() => {});
      }
    },
    setWidgetData: (themeId, widgetType, widgetId, dataJson) => {
      if (widgetPlugin) {
        void widgetPlugin.setWidgetData({ themeId, widgetType, widgetId: widgetId || 0, dataJson }).catch(() => {});
      }
    },
    requestWidgetUpdate: () => {
      if (widgetPlugin) {
        void widgetPlugin.requestWidgetUpdate().catch(() => {});
      }
    },
    get permission() {
      return notifications.permission;
    },
  };

  void notifications.init();
  window.setTimeout(() => {
    const themeId = document.documentElement.dataset.themePreset || "original";
    window.StudyZoneNotifications?.setLauncherIcon?.(themeId);
    window.StudyZoneApp?.syncWidgets?.();
  }, 600);
  if (window.StudyZoneApp?.page === "settings") {
    window.setTimeout(() => window.StudyZoneApp?.render?.(), 0);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => notifications.scheduleFromApp(), {
      once: true,
    });
  } else {
    notifications.scheduleFromApp();
  }
})();
