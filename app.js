(() => {
  "use strict";

  const config = window.studyFlowSupabaseConfig || {};
  const configured = Boolean(config.url && config.anonKey);
  const supabase =
    configured && window.supabase?.createClient
      ? window.supabase.createClient(config.url, config.anonKey)
      : null;
  let subjects = [
    {
      id: "subject-calculus",
      name: "Calculus II",
      color: "#06D6A0",
      credits: 4,
      progress: 72,
    },
    {
      id: "subject-algorithms",
      name: "Algorithms",
      color: "#75CDB1",
      credits: 3,
      progress: 81,
    },
    {
      id: "subject-biology",
      name: "Biology",
      color: "#9ECDAF",
      credits: 3,
      progress: 64,
    },
    {
      id: "subject-history",
      name: "History",
      color: "#C1D79D",
      credits: 2,
      progress: 55,
    },
  ];
  const seededTasks = [
    {
      id: "demo-task-1",
      title: "Discrete math problem set",
      subject_id: "subject-algorithms",
      subject: "Algorithms",
      due_at: todayAt(17, 30),
      priority: "high",
      status: "in_progress",
      estimated_minutes: 130,
    },
    {
      id: "demo-task-2",
      title: "Biology flashcards review",
      subject_id: "subject-biology",
      subject: "Biology",
      due_at: tomorrowAt(9),
      priority: "medium",
      status: "not_started",
      estimated_minutes: 75,
    },
    {
      id: "demo-task-3",
      title: "History essay outline",
      subject_id: "subject-history",
      subject: "History",
      due_at: dayAtOffset(2, 16),
      priority: "urgent",
      status: "in_progress",
      estimated_minutes: 105,
    },
    {
      id: "demo-task-4",
      title: "Calculus revision quiz",
      subject_id: "subject-calculus",
      subject: "Calculus II",
      due_at: dayAtOffset(3, 20),
      priority: "low",
      status: "completed",
      estimated_minutes: 45,
    },
  ];
  let activity = [
    { day: "Mon", hours: 2.8 },
    { day: "Tue", hours: 3.4 },
    { day: "Wed", hours: 2.5 },
    { day: "Thu", hours: 4.1 },
    { day: "Fri", hours: 3.7 },
    { day: "Sat", hours: 5.2 },
    { day: "Sun", hours: 2.1 },
  ];
  let goals = [
    {
      title: "Finish revision pack",
      progress: 78,
      due: "5 days",
      detail: "Review key topics before the assessment",
    },
    {
      title: "Keep weekly study rhythm",
      progress: 86,
      due: "2 days",
      detail: "Reach 12 focused hours this week",
    },
    {
      title: "Submit essay draft",
      progress: 64,
      due: "1 week",
      detail: "Complete the outline and first draft",
    },
  ];
  let schedule = [
    {
      day: "Monday",
      time: "08:00",
      title: "Limits and derivatives",
      subject: "Calculus II",
      length: "90 min",
    },
    {
      day: "Tuesday",
      time: "17:00",
      title: "Graphs + shortest path",
      subject: "Algorithms",
      length: "105 min",
    },
    {
      day: "Wednesday",
      time: "19:00",
      title: "Cell structure review",
      subject: "Biology",
      length: "75 min",
    },
    {
      day: "Thursday",
      time: "15:30",
      title: "Essay drafting sprint",
      subject: "History",
      length: "90 min",
    },
  ];
  const achievementCatalog = [
    {
      code: "first-task",
      name: "First Task",
      description: "Complete your first task.",
      symbol: "✓",
      reward: 10,
    },
    {
      code: "focus-starter",
      name: "Focus Starter",
      description: "Complete your first verified focus session.",
      symbol: "◷",
      reward: 15,
    },
    {
      code: "focus-master",
      name: "Focus Master",
      description: "Complete 10 verified focus sessions.",
      symbol: "✦",
      reward: 50,
    },
    {
      code: "deadline-hero",
      name: "Deadline Hero",
      description: "Complete 10 tasks with deadlines.",
      symbol: "◇",
      reward: 50,
    },
    {
      code: "study-streak",
      name: "Study Streak",
      description: "Build a 7-day activity streak.",
      symbol: "↗",
      reward: 40,
    },
    {
      code: "consistency-champion",
      name: "Consistency Champion",
      description: "Build a 30-day activity streak.",
      symbol: "✧",
      reward: 150,
    },
    {
      code: "level-5",
      name: "Rising Scholar",
      description: "Reach level 5.",
      symbol: "★",
      reward: 50,
    },
    {
      code: "level-10",
      name: "Study Champion",
      description: "Reach level 10.",
      symbol: "♛",
      reward: 100,
    },
    {
      code: "level-20",
      name: "Master Strategist",
      description: "Reach level 20.",
      symbol: "✪",
      reward: 200,
    },
    {
      code: "level-50",
      name: "Study Legend",
      description: "Reach level 50.",
      symbol: "♜",
      reward: 500,
    },
  ];
  let examResults = [
    { subject: "Algorithms", score: 88 },
    { subject: "Calculus II", score: 92 },
    { subject: "Biology", score: 84 },
    { subject: "History", score: 78 },
  ];
  let sampleFiles = [
    { name: "calculus-derivatives.pdf", type: "PDF", subject: "Calculus II" },
    { name: "algo-graphs-notes.md", type: "Notes", subject: "Algorithms" },
    { name: "biology-diagrams.png", type: "Image", subject: "Biology" },
  ];
  let sampleNotes = [
    {
      title: "Core theorem summary",
      subject: "Algorithms",
      updated: "2 hours ago",
    },
    { title: "Cell structure recall", subject: "Biology", updated: "Today" },
    { title: "Essay thesis points", subject: "History", updated: "Yesterday" },
  ];
  const previewSchedule = schedule;
  const previewActivity = activity;
  const previewGoals = goals;
  const previewExamResults = examResults;
  const previewFiles = sampleFiles;
  const previewNotes = sampleNotes;
  const storageKey = "studyflow.tasks.v1";
  const authPromptStorageKey = "studyzone.auth-prompt-seen";
  let tasks = readLocalTasks();
  let currentPage = "dashboard";
  let lastRenderedPage = "";
  let authMode = "signin";
  let deferredInstallPrompt = null;
  let pwaInstalled = false;
  let pwaUpdateWorker = null;
  let pwaUpdateReload = false;
  const defaultFocusSettings = Object.freeze({
    focusMinutes: 25,
    shortBreakMinutes: 5,
    longBreakMinutes: 15,
    longBreakInterval: 4,
    autoStartFocus: false,
    autoStartBreaks: false,
    soundEnabled: true,
    browserNotifications: false,
    showSeconds: true,
    clockSize: "default",
    startSound: "focus-start",
    endSound: "focus-end",
    breakEndSound: "break-end",
    soundVolume: 80,
    soundDuration: 5,
    soundRepeat: false,
  });
  let focusSettings = { ...defaultFocusSettings };
  const notificationPrefsKey = "studyzone.notification-prefs.v1";
  let notificationPrefs = {
    sound: true,
    dnd: false,
    start: "22:00",
    end: "07:00",
    vibration_enabled: true,
    taskSound: "task-reminder",
    taskVolume: 80,
    taskDuration: 5,
    taskRepeat: false,
  };
  let notificationsPrimed = false;
  try {
    const storedNotificationPrefs = JSON.parse(
      localStorage.getItem(notificationPrefsKey) || "null",
    );
    if (
      storedNotificationPrefs &&
      typeof storedNotificationPrefs === "object"
    ) {
      notificationPrefs = {
        sound: storedNotificationPrefs.sound !== false,
        dnd: storedNotificationPrefs.dnd === true,
        start: /^\d{2}:\d{2}$/.test(storedNotificationPrefs.start || "")
          ? storedNotificationPrefs.start
          : "22:00",
        end: /^\d{2}:\d{2}$/.test(storedNotificationPrefs.end || "")
          ? storedNotificationPrefs.end
          : "07:00",
        taskSound: ALERT_SOUNDS.some(
          (sound) => sound.id === storedNotificationPrefs.taskSound,
        )
          ? storedNotificationPrefs.taskSound
          : "task-reminder",
        taskVolume: [0, 10, 25, 50, 75, 100].includes(
          Number(storedNotificationPrefs.taskVolume),
        )
          ? Number(storedNotificationPrefs.taskVolume)
          : 80,
        taskDuration: [3, 5, 10, 15].includes(
          Number(storedNotificationPrefs.taskDuration),
        )
          ? Number(storedNotificationPrefs.taskDuration)
          : 5,
        taskRepeat: storedNotificationPrefs.taskRepeat === true,
      };
    }
  } catch (error) {
    console.warn("Could not restore notification preferences.", error);
  }
  let focusSession = {
    id: "",
    type: "focus",
    cycle: 1,
    status: "idle",
    remainingMs: defaultFocusSettings.focusMinutes * 60000,
    endAt: null,
    runStartedAt: null,
    elapsedBeforeRunMs: 0,
    startedAt: null,
    remoteStarted: false,
    subjectId: "",
    taskId: "",
    goal: "",
    tools: "",
    durationMinutes: null,
  };
  let focusRecords = [];
  let pendingFocusRecords = [];
  let focusLoadedIdentity = "";
  let focusTicker = null;
  let focusSettingsOpen = false;
  let distractionFree = false;
  let focusDataError = "";
  let focusSaving = false;
  const focusRecordSavesInFlight = new Set();
  const focusText = {
    en: {
      eyebrow: "MAKE TIME FOR WHAT MATTERS",
      title: "Focus",
      subtitle: "A quieter space for your next study session.",
      settings: "Timer settings",
      focus: "Focus",
      shortBreak: "Short break",
      longBreak: "Long break",
      cycle: "Pomodoro cycle",
      stayFocused: "Stay focused",
      takeBreak: "Take a mindful break",
      focusHint: "One thing at a time. You’re making progress.",
      breakHint: "Step away, stretch, and let your mind reset.",
      next: "Next",
      subject: "Study subject",
      chooseSubject: "Choose a subject",
      task: "Link a task",
      noTask: "No task linked",
      distraction: "Distraction-free",
      exitDistraction: "Exit focus mode",
      start: "Start",
      pause: "Pause",
      resume: "Resume",
      reset: "Reset",
      skip: "Skip session",
      ready: "Ready when you are",
      paused: "Session paused",
      complete: "Session complete",
      focusTimeToday: "Focus today",
      completedToday: "Sessions today",
      weeklyHours: "Focus this week",
      streak: "Daily streak",
      totalCycles: "Focus cycles",
      weeklyChart: "Focus this week",
      sessionHistory: "Recent sessions",
      noHistory: "No completed focus sessions yet",
      noHistoryHint: "Your completed focus blocks will appear here.",
      settingsTitle: "Timer settings",
      durations: "Session lengths",
      focusDuration: "Focus duration",
      shortDuration: "Short break",
      longDuration: "Long break",
      longInterval: "Long break after",
      sessions: "focus sessions",
      behavior: "Session behavior",
      autoFocus: "Auto-start focus sessions",
      autoBreaks: "Auto-start breaks",
      sound: "Completion sound",
      browserNotifications: "Browser notifications",
      showSeconds: "Show seconds on the flip clock",
      clockSize: "Clock size",
      clockSizeCompact: "Compact",
      clockSizeDefault: "Cozy",
      clockSizeLarge: "Large",
      saveSettings: "Save settings",
      restoreDefaults: "Restore defaults",
      focusStartSound: "Focus start sound",
      focusEndSound: "Focus end sound",
      breakEndSound: "Break end sound",
      soundVolume: "Sound volume",
      soundDuration: "Sound duration",
      soundRepeat: "Repeat completion sound",
      soundPreview: "Preview sound",
      settingsSaved: "Focus settings saved.",
      settingsError: "Could not save your focus settings.",
      invalidSettings:
        "Enter valid session lengths between 1 and 180 minutes and an interval between 2 and 12.",
      notificationsUnsupported: "Browser notifications are not supported here.",
      notificationsDenied:
        "Notification permission was denied. You can enable it in your browser settings.",
      notificationReady:
        "Browser notifications enabled while Study Zone is open.",
      focusCompleted: "Focus session complete. Take a short break.",
      focusCompletedTitle: "Focus session complete!",
      cycleCompletedTitle: "Pomodoro cycle complete!",
      focusRewardDetail: "Focused for {duration} · {count} completed sessions",
      breakCompleted: "Break complete. You’re ready for another focus session.",
      sessionSaved: "Focus session saved.",
      sessionError: "Could not save focus session.",
      dataError: "Focus history could not be loaded.",
      today: "Today",
      yesterday: "Yesterday",
      mins: "min",
      hours: "h",
      minutes: "minutes",
      thisCycle: "Cycle",
      notSavedGuest:
        "Guest focus history is saved in this browser. Sign in to sync it across devices.",
      databaseNote:
        "Signed-in session history and timer settings are saved to your private Supabase account.",
      pending: "Saving session…",
      hourChart: "hours",
      emptySubject: "Independent study",
    },
    ar: {
      eyebrow: "خصص وقتًا لما يهمك",
      title: "التركيز",
      subtitle: "مساحة هادئة لجلسة الدراسة القادمة.",
      settings: "إعدادات المؤقت",
      focus: "تركيز",
      shortBreak: "استراحة قصيرة",
      longBreak: "استراحة طويلة",
      cycle: "دورة بومودورو",
      stayFocused: "حافظ على تركيزك",
      takeBreak: "استمتع باستراحة هادئة",
      focusHint: "مهمة واحدة في كل مرة. أنت تحرز تقدمًا.",
      breakHint: "ابتعد قليلًا وتمدد ودع ذهنك يستعيد نشاطه.",
      next: "التالي",
      subject: "المادة الدراسية",
      chooseSubject: "اختر مادة",
      task: "اربط بمهمة",
      noTask: "لا توجد مهمة مرتبطة",
      distraction: "وضع التركيز",
      exitDistraction: "إنهاء وضع التركيز",
      start: "ابدأ",
      pause: "إيقاف مؤقت",
      resume: "استئناف",
      reset: "إعادة ضبط",
      skip: "تخطَّ الجلسة",
      ready: "ابدأ عندما تكون مستعدًا",
      paused: "الجلسة متوقفة مؤقتًا",
      complete: "اكتملت الجلسة",
      focusTimeToday: "وقت التركيز اليوم",
      completedToday: "جلسات اليوم",
      weeklyHours: "تركيز هذا الأسبوع",
      streak: "أيام التركيز المتتالية",
      totalCycles: "دورات التركيز",
      weeklyChart: "تركيز هذا الأسبوع",
      sessionHistory: "الجلسات الأخيرة",
      noHistory: "لا توجد جلسات تركيز مكتملة بعد",
      noHistoryHint: "ستظهر هنا جلسات التركيز التي أكملتها.",
      settingsTitle: "إعدادات المؤقت",
      durations: "مدة الجلسات",
      focusDuration: "مدة التركيز",
      shortDuration: "الاستراحة القصيرة",
      longDuration: "الاستراحة الطويلة",
      longInterval: "الاستراحة الطويلة بعد",
      sessions: "جلسات تركيز",
      behavior: "سلوك الجلسات",
      autoFocus: "بدء جلسات التركيز تلقائيًا",
      autoBreaks: "بدء الاستراحات تلقائيًا",
      sound: "صوت عند اكتمال الجلسة",
      browserNotifications: "إشعارات المتصفح",
      showSeconds: "عرض الثواني في الساعة القلّابة",
      clockSize: "حجم الساعة",
      clockSizeCompact: "مضغوط",
      clockSizeDefault: "مريح",
      clockSizeLarge: "كبير",
      saveSettings: "حفظ الإعدادات",
      restoreDefaults: "استعادة الافتراضية",
      focusStartSound: "صوت بداية التركيز",
      focusEndSound: "صوت نهاية التركيز",
      breakEndSound: "صوت نهاية الاستراحة",
      soundVolume: "مستوى صوت المؤقت",
      soundDuration: "مدة صوت المؤقت",
      soundRepeat: "تكرار صوت اكتمال الجلسة",
      soundPreview: "تجربة الصوت",
      settingsSaved: "تم حفظ إعدادات التركيز.",
      settingsError: "تعذر حفظ إعدادات التركيز.",
      invalidSettings:
        "أدخل مددًا صحيحة بين دقيقة و١٨٠ دقيقة، وفاصلًا بين جلستين و١٢ جلسة.",
      notificationsUnsupported: "إشعارات المتصفح غير مدعومة هنا.",
      notificationsDenied:
        "تم رفض إذن الإشعارات. يمكنك تفعيله من إعدادات المتصفح.",
      notificationReady: "إشعارات المتصفح مفعلة أثناء فتح Study Zone.",
      focusCompleted: "اكتملت جلسة التركيز. حان وقت استراحة قصيرة.",
      focusCompletedTitle: "اكتملت جلسة التركيز!",
      cycleCompletedTitle: "اكتملت دورة بومودورو!",
      focusRewardDetail: "تركيز لمدة {duration} · {count} جلسات مكتملة",
      breakCompleted: "انتهت الاستراحة. أنت مستعد لجلسة تركيز جديدة.",
      sessionSaved: "تم حفظ جلسة التركيز.",
      sessionError: "تعذر حفظ جلسة التركيز.",
      dataError: "تعذر تحميل سجل التركيز.",
      today: "اليوم",
      yesterday: "أمس",
      mins: "د",
      hours: "س",
      minutes: "دقيقة",
      thisCycle: "الدورة",
      notSavedGuest:
        "يُحفظ سجل التركيز للضيف على هذا الجهاز. سجّل الدخول لمزامنته بين أجهزتك.",
      databaseNote:
        "يُحفظ سجل الجلسات وإعدادات المؤقت في حسابك الخاص على Supabase.",
      pending: "جارٍ حفظ الجلسة…",
      hourChart: "ساعات",
      emptySubject: "دراسة مستقلة",
    },
  };
  let session = null;
  let accountProfile = null;
  let adminAuthorization = { status: "unknown", userId: null };
  let adminVerificationRequest = 0;
  let adminUsers = [];
  let adminUsersLoading = false;
  let adminUsersError = "";
  let adminUsersTotal = 0;
  let adminUsersPage = 0;
  let adminUsersSearch = "";
  let adminUsersRequest = 0;
  const adminUsersPageSize = 25;
  let userNotifications = [];
  let dailyReminderPreference = {
    enabled: false,
    local_time: "09:00",
    timezone: "UTC",
  };
  let rewardSummary = null;
  let earnedAchievements = [];
  const rewardCounterValues = new Map();
  const savedMotionLevel = localStorage.getItem("studyflow.motion");
  let motionLevel = ["full", "reduced", "off"].includes(savedMotionLevel)
    ? savedMotionLevel
    : localStorage.getItem("studyflow.animations") === "off"
      ? "off"
      : "full";
  let animationsEnabled = motionLevel !== "off";

  // ---- Animation settings ---------------------------------------------------
  const savedAnimationEnabled = localStorage.getItem("studyflow.animation-enabled");
  let animationEnabled = savedAnimationEnabled === null ? true : savedAnimationEnabled === "true";
  const savedAnimationIntensity = localStorage.getItem("studyflow.animation-intensity");
  let animationIntensity = ["low", "medium", "high"].includes(savedAnimationIntensity)
    ? savedAnimationIntensity
    : "medium";
  const savedAnimationSpeed = localStorage.getItem("studyflow.animation-speed");
  let animationSpeed = ["slow", "normal", "fast"].includes(savedAnimationSpeed)
    ? savedAnimationSpeed
    : "normal";
  const savedReducedMotion = localStorage.getItem("studyflow.reduced-motion");
  let reducedMotion =
    savedReducedMotion === "true" ||
    (typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)")).matches;

  let animationEffects = {
    pageTransitions: true,
    buttonEffects: true,
    completionEffects: true,
    xpAnimations: true,
    chartAnimations: true,
    pixelEffects: true,
  };
  try {
    const savedEffectPrefs = JSON.parse(
      localStorage.getItem("studyflow.animation-effects") || "null",
    );
    if (savedEffectPrefs && typeof savedEffectPrefs === "object") {
      animationEffects = { ...animationEffects, ...savedEffectPrefs };
    }
  } catch {
    /* use defaults */
  }

  let searchTerm = "";
  let statusFilter = "all";
  let deadlineSearch = "";
  let deadlineFilter = "all";
  let deadlineSort = "due";
  let deadlineView = "list";
  let deadlineMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1,
  );
  let selectedDeadlineDate = dateKey(new Date());
  let dashboardMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1,
  );
  let dashboardSelectedDate = dateKey(new Date());
  let deadlineCalendarMode = "month";
  let editingDeadlineId = null;
  let deadlinesLoading = false;
  const statusChangesInFlight = new Set();
  const taskDayStorageKey = "studyzone.task-view.v1";
  const localNotesKey = "studyzone.notes.v1";
  let taskViewMode = "day";
  let taskViewDate = startOfLocalDay(new Date());
  let taskShowCompleted =
    localStorage.getItem("studyzone.show-completed") !== "false";
  let taskEditingId = null;
  let pendingSeriesAction = null;
  let recurrenceSupported = true;
  let notesColorSupported = true;
  let notesSchemaChecked = false;
  let noteSearch = "";
  let noteSubjectFilter = "";
  let noteSort = "updated";
  let noteTypeFilter = "all";
  let notesView = "main"; // "main" | "media"
  let mediaFilter = "all"; // "all" | "image" | "video"
  let mediaEditorDraft = null; // {id?, title, description, attachments:[...], mode:'image'|'video'}
  let noteEditorState = null;
  let noteSaveTimer = null;
  let noteSaveStatus = "idle";
  let noteEditorElement = null;
  let taskSectionState = {
    overdue: true,
    today: true,
    nodate: true,
    completed: true,
  };

  // ---- Analytics state -------------------------------------------------------
  const analyticsStorageKey = "studyzone.analytics.v1";
  let analyticsRange = "weekly";
  let analyticsCustomStart = null;
  let analyticsCustomRange = { start: null, end: null };
  let analyticsMetric = "studyHours";
  let analyticsMode = "days";
  let analyticsBuckets = [];
  let analyticsValues = [];
  let analyticsChartMetric = "studyHours";
  let analyticsChartGeometry = null;
  let analyticsChartSeries = null;
  let analyticsHeatmapType = "overall";
  let analyticsHeatmapYear = null;
  let analyticsHeatmapSelected = null;
  try {
    const savedAnalytics = JSON.parse(
      localStorage.getItem(analyticsStorageKey) || "null",
    );
    if (savedAnalytics && typeof savedAnalytics === "object") {
      if (["daily", "weekly", "monthly", "yearly", "rolling7", "rolling30", "custom"].includes(savedAnalytics.range))
        analyticsRange = savedAnalytics.range;
      if (savedAnalytics.customStart && Number.isInteger(savedAnalytics.customStart) && savedAnalytics.customStart >= 0 && savedAnalytics.customStart <= 6)
        analyticsCustomStart = savedAnalytics.customStart;
      if (savedAnalytics.customRange && savedAnalytics.customRange.start && savedAnalytics.customRange.end)
        analyticsCustomRange = savedAnalytics.customRange;
      if (typeof savedAnalytics.metric === "string" && savedAnalytics.metric)
        analyticsMetric = savedAnalytics.metric;
    }
  } catch {
    /* use defaults */
  }
  function saveAnalyticsSettings() {
    try {
      localStorage.setItem(analyticsStorageKey, JSON.stringify({
        range: analyticsRange,
        customStart: analyticsCustomStart,
        customRange: analyticsCustomRange,
        metric: analyticsMetric,
      }));
    } catch {
      /* storage unavailable */
    }
    if (supabase && session) {
      void supabase
        .from("profiles")
        .update({ notification_settings: { ...notificationTypes(), analytics_range: analyticsRange, analytics_custom_start: analyticsCustomStart, analytics_custom_range: analyticsCustomRange, analytics_metric: analyticsMetric } })
        .eq("id", session.user.id)
        .then(({ error }) => {
          if (error && !isMissingColumnError(error))
            console.warn("Could not sync analytics settings.", error);
        });
    }
  }

  const analyticsMetrics = [
    { id: "studyHours", labelKey: "Study Hours" },
    { id: "completedTasks", labelKey: "Completed Tasks" },
    { id: "focusSessions", labelKey: "Focus Sessions" },
    { id: "productivity", labelKey: "Productivity" },
    { id: "completionRate", labelKey: "Completion Rate" },
  ];

  function analyticsMetricLabel(metric) {
    const entry = analyticsMetrics.find((item) => item.id === metric);
    return entry ? translateUiText(entry.labelKey) : translateUiText("Study Hours");
  }

  function buildAnalyticsBuckets(start, end, mode) {
    const buckets = [];
    const monthStart = new Date(start.getFullYear(), start.getMonth(), 1);
    const monthEnd = new Date(start.getFullYear(), start.getMonth() + 1, 0);
    if (mode === "months" && end > new Date(monthEnd.getFullYear(), monthEnd.getMonth(), 1)) {
      const year = start.getFullYear();
      for (let month = 0; month < 12; month += 1) {
        const ms = new Date(year, month, 1);
        buckets.push({
          start: new Date(ms.getFullYear(), ms.getMonth(), 1),
          end: new Date(ms.getFullYear(), ms.getMonth() + 1, 0),
          key: localDateKey(ms),
        });
      }
      return buckets;
    }
    if (mode === "months") {
      buckets.push({
        start: monthStart,
        end: monthEnd,
        key: localDateKey(monthStart),
      });
      return buckets;
    }
    let cursor = new Date(start);
    const endDate = new Date(end);
    while (cursor <= endDate) {
      buckets.push({ start: new Date(cursor), end: new Date(cursor), key: localDateKey(cursor) });
      cursor = addLocalDays(cursor, 1);
    }
    return buckets;
  }

  function analyticsBucketLabel(bucket, mode) {
    const date = new Date(bucket.start);
    const text = new Intl.DateTimeFormat(focusLocale(), {
      month: "short",
      day: "numeric",
      ...(mode === "months" ? { year: "numeric" } : {}),
    }).format(date);
    const weekday = new Intl.DateTimeFormat(focusLocale(), { weekday: "short" }).format(date);
    return { main: appLanguage === "ar" ? weekday : text, key: bucket.key };
  }

  function formatAnalyticsMetricValue(metric, value) {
    const number = (next) => new Intl.NumberFormat(focusLocale(), { maximumFractionDigits: 1 }).format(next);
    if (metric === "studyHours" || metric === "productivity") {
      const rounded = Math.round(value * 10) / 10;
      const text = focusText[appLanguage];
      return `${number(rounded)}${text.hours}`;
    }
    if (metric === "completionRate") {
      return `${Math.round(value)}%`;
    }
    const rounded = Math.round(value * 10) / 10;
    return number(rounded);
  }

  // ---- Activity contribution heatmap -----------------------------------------
  const heatmapActivityTypes = [
    { id: "studyTime", labelEn: "Study Time", labelAr: "وقت الدراسة" },
    { id: "focusSessions", labelEn: "Focus Sessions", labelAr: "جلسات التركيز" },
    { id: "completedTasks", labelEn: "Completed Tasks", labelAr: "المهام المكتملة" },
    { id: "habits", labelEn: "Habits Completed", labelAr: "العادات المكتملة" },
    { id: "overall", labelEn: "Overall Activity", labelAr: "النشاط الإجمالي" },
  ];

  function heatmapTypeLabel(type) {
    const entry =
      heatmapActivityTypes.find((item) => item.id === type) ||
      heatmapActivityTypes[heatmapActivityTypes.length - 1];
    return appLanguage === "ar" ? entry.labelAr : entry.labelEn;
  }

  function heatmapAvailableYears() {
    const years = new Set();
    const currentYear = new Date().getFullYear();
    years.add(currentYear);
    years.add(currentYear - 1);
    const addYear = (value) => {
      const date = value instanceof Date ? value : new Date(value);
      if (Number.isNaN(date.getTime())) return;
      const year = date.getFullYear();
      if (year >= 2000 && year <= 2100) years.add(year);
    };
    focusRecords.forEach((record) => {
      if (!record.completed || record.session_type !== "focus") return;
      addYear(record.ended_at || record.started_at);
    });
    tasks.forEach((task) => {
      if (task.status !== "completed" || task.routine_id || !task.completed_at)
        return;
      addYear(task.completed_at);
    });
    routineDays.forEach((record) => {
      if (record.status !== "completed") return;
      addYear(record.completed_at || record.occurrence_date);
    });
    return [...years].sort((a, b) => b - a);
  }

  function heatmapActiveYear() {
    const available = heatmapAvailableYears();
    if (
      Number.isInteger(analyticsHeatmapYear) &&
      available.includes(analyticsHeatmapYear)
    )
      return analyticsHeatmapYear;
    const currentYear = new Date().getFullYear();
    return available.includes(currentYear) ? currentYear : available[0];
  }

  function buildHeatmapYearData(year) {
    const days = [];
    const map = new Map();
    const cursor = new Date(year, 0, 1);
    while (cursor.getFullYear() === year) {
      const key = dateKey(cursor);
      const day = {
        date: new Date(cursor),
        key,
        studySeconds: 0,
        focusSessions: 0,
        completedTasks: 0,
        habitsCompleted: 0,
        overall: 0,
      };
      map.set(key, day);
      days.push(day);
      cursor.setDate(cursor.getDate() + 1);
    }

    const focusSeen = new Set();
    focusRecords.forEach((record) => {
      if (!record.completed || record.session_type !== "focus") return;
      const ended = new Date(record.ended_at || record.started_at);
      if (Number.isNaN(ended.getTime())) return;
      const day = map.get(dateKey(ended));
      if (!day) return;
      const signature =
        record.id != null
          ? `id:${record.id}`
          : `${record.started_at || ""}|${record.ended_at || ""}|${record.duration_seconds || 0}`;
      if (focusSeen.has(signature)) return;
      focusSeen.add(signature);
      day.focusSessions += 1;
      day.studySeconds += Math.max(0, Number(record.duration_seconds) || 0);
    });

    const taskSeen = new Set();
    tasks.forEach((task) => {
      if (task.status !== "completed" || task.routine_id || !task.completed_at)
        return;
      const completed = new Date(task.completed_at);
      if (Number.isNaN(completed.getTime())) return;
      const day = map.get(dateKey(completed));
      if (!day) return;
      const signature =
        task.id != null
          ? `id:${task.id}`
          : `${task.title || ""}|${task.completed_at}`;
      if (taskSeen.has(signature)) return;
      taskSeen.add(signature);
      day.completedTasks += 1;
    });

    const habitSeen = new Set();
    routineDays.forEach((record) => {
      if (record.status !== "completed") return;
      const completed = record.completed_at ? new Date(record.completed_at) : null;
      const key =
        completed && !Number.isNaN(completed.getTime())
          ? dateKey(completed)
          : record.occurrence_date;
      const day = map.get(key);
      if (!day) return;
      const signature = `${record.routine_id || "routine"}:${record.occurrence_date || key}`;
      if (habitSeen.has(signature)) return;
      habitSeen.add(signature);
      day.habitsCompleted += 1;
    });

    days.forEach((day) => {
      // Focus sessions are represented by the study minutes they produced, so
      // they are not added again here. This keeps "Overall" free of duplicates.
      day.overall =
        Math.ceil(day.studySeconds / 60) +
        day.completedTasks * 10 +
        day.habitsCompleted * 5;
    });

    return { days, map, year };
  }

  function heatmapValue(type, day) {
    if (!day) return 0;
    if (type === "studyTime") return day.studySeconds;
    if (type === "focusSessions") return day.focusSessions;
    if (type === "completedTasks") return day.completedTasks;
    if (type === "habits") return day.habitsCompleted;
    return day.overall;
  }

  function heatmapLevel(type, day) {
    const value = heatmapValue(type, day);
    if (!value) return 0;
    const cuts =
      type === "studyTime"
        ? [30, 60, 120]
        : type === "overall"
          ? [25, 60, 120]
          : [2, 4, 6];
    const normalized =
      type === "studyTime" ? value / 60 : value;
    if (normalized >= cuts[2]) return 4;
    if (normalized >= cuts[1]) return 3;
    if (normalized >= cuts[0]) return 2;
    return 1;
  }

  function heatmapStudyDuration(seconds) {
    const text = focusText[appLanguage];
    const totalMinutes = Math.round(Math.max(0, Number(seconds) || 0) / 60);
    if (totalMinutes <= 0) return appLanguage === "ar" ? "لا وقت دراسة" : "No study time";
    if (totalMinutes < 60) return `${new Intl.NumberFormat(focusLocale()).format(totalMinutes)}${text.mins}`;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return minutes
      ? `${new Intl.NumberFormat(focusLocale()).format(hours)}${text.hours} ${new Intl.NumberFormat(focusLocale()).format(minutes)}${text.mins}`
      : `${new Intl.NumberFormat(focusLocale()).format(hours)}${text.hours}`;
  }

  function heatmapCountValue(type, value) {
    const number = new Intl.NumberFormat(focusLocale(), {
      maximumFractionDigits: 1,
    }).format(value);
    if (type === "focusSessions")
      return appLanguage === "ar"
        ? `${number} جلسة`
        : `${number} ${value === 1 ? "session" : "sessions"}`;
    if (type === "completedTasks")
      return appLanguage === "ar"
        ? `${number} مهمة`
        : `${number} ${value === 1 ? "task" : "tasks"}`;
    if (type === "habits")
      return appLanguage === "ar"
        ? `${number} عادة`
        : `${number} ${value === 1 ? "habit" : "habits"}`;
    return appLanguage === "ar"
      ? `${number} نقطة`
      : `${number} ${value === 1 ? "pt" : "pts"}`;
  }

  function heatmapFormattedValue(type, value) {
    if (type === "studyTime") return heatmapStudyDuration(value);
    return heatmapCountValue(type, value);
  }

  function heatmapDateLabel(date) {
    return new Intl.DateTimeFormat(focusLocale(), {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date);
  }

  function heatmapTooltipParts(type, day) {
    const value = heatmapValue(type, day);
    const parts = [heatmapDateLabel(day.date), heatmapTypeLabel(type)];
    parts.push(
      value
        ? heatmapFormattedValue(type, value)
        : appLanguage === "ar"
          ? "لا يوجد نشاط"
          : "No activity",
    );
    if (value && type === "studyTime" && day.focusSessions)
      parts.push(heatmapCountValue("focusSessions", day.focusSessions));
    if (value && type === "focusSessions" && day.studySeconds)
      parts.push(heatmapStudyDuration(day.studySeconds));
    if (value && type === "overall")
      parts.push(
        `${heatmapStudyDuration(day.studySeconds)} · ${heatmapCountValue("completedTasks", day.completedTasks)} · ${heatmapCountValue("habits", day.habitsCompleted)}`,
      );
    return parts;
  }

  function heatmapDetailMarkup(type, day) {
    if (!day)
      return `<div class="sz-hm-detail-empty">${appLanguage === "ar" ? "اختر يومًا لعرض تفاصيل نشاطه." : "Select a day to inspect its activity."}</div>`;
    const value = heatmapValue(type, day);
    const rows = [];
    if (!value) {
      rows.push(
        `<span>${appLanguage === "ar" ? "لا يوجد نشاط مسجّل في هذا اليوم." : "No activity recorded for this day."}</span>`,
      );
    } else if (type === "studyTime") {
      if (day.focusSessions)
        rows.push(`<span>${appLanguage === "ar" ? "جلسات التركيز" : "Focus sessions"}: <strong>${heatmapCountValue("focusSessions", day.focusSessions)}</strong></span>`);
    } else if (type === "focusSessions") {
      if (day.studySeconds)
        rows.push(`<span>${appLanguage === "ar" ? "وقت الدراسة" : "Study time"}: <strong>${heatmapStudyDuration(day.studySeconds)}</strong></span>`);
    } else if (type === "overall") {
      rows.push(`<span>${appLanguage === "ar" ? "وقت الدراسة" : "Study time"}: <strong>${heatmapStudyDuration(day.studySeconds)}</strong></span>`);
      rows.push(`<span>${appLanguage === "ar" ? "المهام المكتملة" : "Completed tasks"}: <strong>${heatmapCountValue("completedTasks", day.completedTasks)}</strong></span>`);
      rows.push(`<span>${appLanguage === "ar" ? "العادات المكتملة" : "Habits completed"}: <strong>${heatmapCountValue("habits", day.habitsCompleted)}</strong></span>`);
    }
    return `<div class="sz-hm-detail-head"><div><strong>${escapeHtml(heatmapDateLabel(day.date))}</strong><span>${escapeHtml(heatmapTypeLabel(type))}</span></div><b>${escapeHtml(value ? heatmapFormattedValue(type, value) : appLanguage === "ar" ? "لا يوجد نشاط" : "No activity")}</b></div><div class="sz-hm-detail-rows">${rows.join("")}</div>`;
  }

  function heatmapGridData(year) {
    const data = buildHeatmapYearData(year);
    const firstDay = new Date(year, 0, 1);
    const lastDay = new Date(year, 11, 31);
    const gridStart = new Date(firstDay);
    gridStart.setDate(firstDay.getDate() - firstDay.getDay());
    const gridEnd = new Date(lastDay);
    gridEnd.setDate(lastDay.getDate() + (6 - lastDay.getDay()));
    const cells = [];
    const cursor = new Date(gridStart);
    while (cursor <= gridEnd) {
      const key = dateKey(cursor);
      const inYear = cursor.getFullYear() === year;
      cells.push({
        date: new Date(cursor),
        key,
        inYear,
        day: inYear ? data.map.get(key) || null : null,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    const weekCount = Math.max(1, Math.ceil(cells.length / 7));
    const monthLabels = [];
    for (let month = 0; month < 12; month += 1) {
      const monthStart = new Date(year, month, 1);
      const weekIndex = Math.max(
        0,
        Math.floor(
          Math.round((monthStart - gridStart) / 86400000) / 7,
        ),
      );
      const nextMonth = month < 11 ? new Date(year, month + 1, 1) : null;
      const nextWeekIndex = nextMonth
        ? Math.max(
            weekIndex + 1,
            Math.floor(
              Math.round((nextMonth - gridStart) / 86400000) / 7,
            ),
          )
        : weekCount;
      monthLabels.push({
        label: new Intl.DateTimeFormat(focusLocale(), {
          month: "short",
        }).format(monthStart),
        weekIndex,
        span: Math.max(1, Math.min(weekCount - weekIndex, nextWeekIndex - weekIndex)),
      });
    }
    const todayKey = dateKey(new Date());
    const selectedKey =
      analyticsHeatmapSelected && data.map.has(analyticsHeatmapSelected)
        ? analyticsHeatmapSelected
        : year === new Date().getFullYear()
          ? todayKey
          : null;
    const eligible = data.days.filter(
      (day) => year < new Date().getFullYear() || day.key <= todayKey,
    );
    const values = eligible.map((day) => heatmapValue(analyticsHeatmapType, day));
    const total = values.reduce((sum, value) => sum + value, 0);
    const activeDays = values.filter((value) => value > 0).length;
    let longestStreak = 0;
    let runningStreak = 0;
    values.forEach((value) => {
      if (value > 0) {
        runningStreak += 1;
        longestStreak = Math.max(longestStreak, runningStreak);
      } else {
        runningStreak = 0;
      }
    });
    let mostActive = null;
    eligible.forEach((day) => {
      const value = heatmapValue(analyticsHeatmapType, day);
      if (!value) return;
      if (!mostActive || value > mostActive.value)
        mostActive = { day, value };
    });
    const weeks = Array.from({ length: weekCount }, (_, weekIndex) => {
      const weekStart = new Date(gridStart);
      weekStart.setDate(gridStart.getDate() + weekIndex * 7);
      const levels = Array.from({ length: 7 }, (_, dayIndex) => {
        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + dayIndex);
        const day = date.getFullYear() === year ? data.map.get(dateKey(date)) || null : null;
        return heatmapLevel(analyticsHeatmapType, day);
      });
      return levels;
    });
    const weekLabels = weeks.map((levels, weekIndex) => {
      const weekStart = new Date(gridStart);
      weekStart.setDate(gridStart.getDate() + weekIndex * 7);
      return new Intl.DateTimeFormat(focusLocale(), { month: "short" }).format(weekStart);
    });
    return {
      ...data,
      cells,
      weeks,
      weekLabels,
      weekCount,
      monthLabels,
      selectedKey,
      eligible,
      total,
      activeDays,
      longestStreak,
      mostActive,
      average: eligible.length ? total / eligible.length : 0,
    };
  }

  function attachHeatmapHandlers(host) {
    const grid = host.querySelector("[data-heatmap-grid]");
    const tip = host.querySelector("[data-heatmap-tooltip]");
    if (!grid || !tip) return;
    let activeCell = null;
    const hide = () => {
      tip.hidden = true;
      activeCell = null;
    };
    const show = (cell) => {
      const parts = (cell.dataset.tip || "").split("|");
      if (parts.length < 3) return;
      activeCell = cell;
      tip.innerHTML = `<strong>${escapeHtml(parts[0])}</strong><span>${escapeHtml(parts[1])}</span><b>${escapeHtml(parts[2])}</b>${parts[3] ? `<small>${escapeHtml(parts[3])}</small>` : ""}`;
      tip.hidden = false;
      const rect = cell.getBoundingClientRect();
      const tooltipRect = tip.getBoundingClientRect();
      let left = rect.left + rect.width / 2;
      left = Math.max(
        tooltipRect.width / 2 + 8,
        Math.min(left, window.innerWidth - tooltipRect.width / 2 - 8),
      );
      let top = rect.top - 10;
      let placement = "top";
      if (top - tooltipRect.height < 8) {
        top = rect.bottom + 10;
        placement = "bottom";
      }
      tip.dataset.placement = placement;
      tip.style.left = `${left}px`;
      tip.style.top = `${top}px`;
    };
    grid.addEventListener("pointerover", (event) => {
      const cell = event.target.closest("[data-heatmap-cell]");
      if (cell && cell === event.target) show(cell);
    });
    grid.addEventListener("pointerout", (event) => {
      const cell = event.target.closest("[data-heatmap-cell]");
      if (!cell) return;
      if (event.relatedTarget && cell.contains(event.relatedTarget)) return;
      hide();
    });
    grid.addEventListener("focusin", (event) => {
      const cell = event.target.closest("[data-heatmap-cell]");
      if (cell) show(cell);
    });
    grid.addEventListener("focusout", () => hide());
    grid.addEventListener("click", () => hide());
    if (!window.__studyZoneHeatmapScrollBound) {
      window.__studyZoneHeatmapScrollBound = true;
      document.addEventListener(
        "scroll",
        () => {
          document
            .querySelectorAll("[data-heatmap-tooltip]")
            .forEach((tooltip) => {
              tooltip.hidden = true;
            });
        },
        true,
      );
    }
  }

  function analyticsNiceMax(value) {
    const safe = Math.max(0, value);
    if (safe <= 0) return 1;
    const exponent = Math.floor(Math.log10(safe));
    const base = Math.pow(10, exponent);
    const ratio = safe / base;
    const nice = ratio <= 1 ? 1 : ratio <= 2 ? 2 : ratio <= 2.5 ? 2.5 : ratio <= 5 ? 5 : 10;
    return nice * base;
  }

  function analyticsSmoothPath(points) {
    if (points.length === 0) return "";
    if (points.length < 2) return `M${points[0].x},${points[0].y}`;
    let d = `M${points[0].x},${points[0].y}`;
    for (let i = 0; i < points.length - 1; i += 1) {
      const p0 = points[i - 1] || points[i];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2] || p2;
      const c1x = p1.x + (p2.x - p0.x) / 6;
      const c1y = p1.y + (p2.y - p0.y) / 6;
      const c2x = p2.x - (p3.x - p1.x) / 6;
      const c2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
    }
    return d;
  }

  function buildAnalyticsLineChart(buckets, values, metric) {
    const width = 640;
    const height = 220;
    const left = 30;
    const right = 16;
    const top = 16;
    const bottom = 28;
    const plotWidth = width - left - right;
    const plotHeight = height - top - bottom;
    const base = top + plotHeight;
    const max = analyticsNiceMax(Math.max(...values, metric === "completionRate" ? 10 : 0));
    const count = buckets.length;
    const series = values.map((value, index) => {
      const reversed = appLanguage === "ar";
      const x = count === 1 ? left + plotWidth / 2 : reversed ? width - right - (plotWidth * index) / (count - 1) : left + (plotWidth * index) / (count - 1);
      const y = top + plotHeight * (1 - value / max);
      return { x, y, value, bucket: buckets[index] };
    });
    analyticsChartSeries = series;
    const line = analyticsSmoothPath(series);
    const first = series[0];
    const last = series[series.length - 1];
    const area = `${line} L${last.x.toFixed(2)},${base} L${first.x.toFixed(2)},${base} Z`;
    const ticks = [0, 1, 2, 3, 4].map((step) => (max * step) / 4);
    const gridLines = ticks
      .map((value) => {
        const y = top + plotHeight * (1 - value / max);
        const label = formatAnalyticsMetricValue(metric, value);
        const anchor = appLanguage === "ar" ? "end" : "start";
        const xPos = appLanguage === "ar" ? width - right - 8 : left + 8;
        return `<line class="analytics-chart-grid" x1="${left}" x2="${width - right}" y1="${y}" y2="${y}"/><text class="analytics-chart-tick" x="${xPos}" y="${y + 3}" text-anchor="${anchor}">${escapeHtml(label)}</text>`;
      })
      .join("");
    const labelStep = Math.max(1, Math.ceil(count / 6));
    const labelIndexes = series
      .map((point, index) => ({ point, index }))
      .filter(({ index }) => index === series.length - 1 || index % labelStep === 0)
      .map(({ point, index }) => ({ point, index, label: analyticsBucketLabel(point.bucket, analyticsMode).main }));
    const dots = series
      .map(
        (point, index) =>
          `<circle class="analytics-chart-dot" cx="${point.x}" cy="${point.y}" r="4" data-index="${index}"><title>${escapeHtml(analyticsBucketLabel(point.bucket, analyticsMode).main)}: ${escapeHtml(formatAnalyticsMetricValue(metric, point.value))}</title></circle>`,
      )
      .join("");
    const labels = labelIndexes
      .map(({ point, label }) => `<text class="analytics-chart-tick" x="${point.x}" y="${height - 8}" text-anchor="middle">${escapeHtml(label)}</text>`)
      .join("");
    const svg = `<svg class="analytics-line-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(translateUiText("Performance Overview"))}: ${escapeHtml(analyticsMetricLabel(metric))}"><defs><linearGradient id="analytics-chart-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" class="analytics-chart-stop-top"/><stop offset="100%" class="analytics-chart-stop-bottom" /></linearGradient></defs>${gridLines}<path class="analytics-chart-area" d="${area}" /><path class="analytics-chart-line" pathLength="1" d="${line}" />${dots}${labels}</svg>`;
    analyticsChartMetric = metric;
    analyticsChartGeometry = { width, height, left, right, top, bottom, plotWidth, plotHeight, base, max, count };
    return svg;
  }

  function attachAnalyticsLineChartHandlers(host) {
    const container = host.querySelector(".analytics-chart-body") || host;
    const svgEl = container.querySelector("svg");
    const tip = host.querySelector(".analytics-chart-tip");
    if (!svgEl || !tip) return;
    function positionTip(clientX, clientY) {
      const svgRect = svgEl.getBoundingClientRect();
      const scaleX = 640 / svgRect.width;
      const scaleY = 220 / svgRect.height;
      const x = (clientX - svgRect.left) * scaleX;
      const y = (clientY - svgRect.top) * scaleY;
      tip.style.left = `${Math.max(34, Math.min(x, 640 - 34))}px`;
      tip.style.top = `${Math.max(34, y)}px`;
      tip.style.transform = "translate(-50%, calc(-100% - 12px))";
    }
    function renderTip(index) {
      const series = analyticsChartSeries;
      const point = series ? series[index] : null;
      if (!point) {
        tip.hidden = true;
        return;
      }
      tip.hidden = false;
      positionTip(0, 0);
      tip.innerHTML = `<strong>${escapeHtml(formatAnalyticsMetricValue(analyticsChartMetric, point.value))}</strong><span>${escapeHtml(analyticsBucketLabel(point.bucket, analyticsMode).main)}</span>`;
    }
    function indexFromPoint(clientX, clientY) {
      const geo = analyticsChartGeometry;
      const series = analyticsChartSeries;
      if (!geo || !series) return null;
      const svgRect = svgEl.getBoundingClientRect();
      const scaleX = 640 / svgRect.width;
      const scaleY = 220 / svgRect.height;
      const x = (clientX - svgRect.left) * scaleX;
      const y = (clientY - svgRect.top) * scaleY;
      let best = 0;
      let bestDist = Infinity;
      series.forEach((point, index) => {
        const dist = (x - point.x) * (x - point.x) + (y - point.y) * (y - point.y);
        if (dist <= bestDist) {
          bestDist = dist;
          best = index;
        }
      });
      const tolerance = 14 * Math.max(scaleX, scaleY);
      return Math.sqrt(bestDist) <= tolerance ? best : null;
    }
    host.addEventListener("pointermove", (event) => {
      const index = indexFromPoint(event.clientX, event.clientY);
      if (index === null) return;
      renderTip(index);
    });
    host.addEventListener("pointerdown", (event) => {
      const index = indexFromPoint(event.clientX, event.clientY);
      if (index === null) return;
      renderTip(index);
    });
    host.addEventListener("pointerleave", () => {
      tip.hidden = true;
    });
  }

  function analyticsMetricValue(metric, bucket, recordsInRange, tasksInRange, completedTasks) {
    const key = bucket.key;
    const secondsInBucket = recordsInRange
      .filter((record) => dateKey(new Date(record.ended_at || record.started_at)) === key)
      .reduce((sum, record) => sum + Number(record.duration_seconds || 0), 0);
    if (metric === "studyHours") return secondsInBucket / 3600;
    if (metric === "focusSessions") {
      return recordsInRange.filter((record) => dateKey(new Date(record.ended_at || record.started_at)) === key).length;
    }
    const completedInBucket = completedTasks.filter((task) => taskEndKey(task) === key).length;
    const tasksInBucket = tasksInRange.filter((task) => taskEndKey(task) === key).length;
    if (metric === "completedTasks") return completedInBucket;
    if (metric === "completionRate") return tasksInBucket ? (completedInBucket / tasksInBucket) * 100 : 0;
    if (metric === "productivity") {
      const hours = secondsInBucket / 3600;
      return hours > 0 ? completedInBucket / hours : 0;
    }
    return 0;
  }

  let teams = [];
  let teamMembers = [];
  let teamTasks = [];
  let selectedTeamId = null;
  let teamsLoading = false;
  let teamsLoaded = false;
  let teamsSupported = true;
  let teamsError = "";
  let teamInvites = [];
  let teamJoinRequests = [];

  let voiceNotes = [];
  let voiceNotesLoading = false;
  let voiceNotesLoaded = false;
  let voiceNotesSupported = true;
  let voiceNotesError = "";
  let voiceRecorder = null;
  let voiceStream = null;
  let voiceChunks = [];
  let voiceBlob = null;
  let voicePreviewUrl = "";
  let voiceStartedAt = 0;
  let voicePausedTotal = 0;
  let voicePauseStartedAt = 0;
  let voiceTimerHandle = null;
  let voiceState = "idle";
  let voiceMimeType = "";
  let voiceDurationSeconds = 0;
  try {
    const storedTaskView = JSON.parse(
      localStorage.getItem(taskDayStorageKey) || "null",
    );
    if (storedTaskView?.mode === "all" || storedTaskView?.mode === "day")
      taskViewMode = storedTaskView.mode;
  } catch (error) {
    console.warn("Could not restore the saved task view.", error);
  }
  let notes = readLocalNotes();

  // ---- Focus intelligence state -------------------------------------------
  const routinesStorageKey = "studyzone.routines.v1";
  const routineDaysStorageKey = "studyzone.routine-days.v1";
  const journalStorageKey = "studyzone.journal.v1";
  const distractionStorageKey = "studyzone.distractions.v1";
  const focusSoundPrefsKey = "studyzone.focus-sounds.v1";
  const pendingOpsStorageKey = "studyzone.pending-ops.v1";
  let routines = readLocalJson(routinesStorageKey, []);
  let routineDays = readLocalJson(routineDaysStorageKey, []);
  let routinesLoading = false;
  let routinesLoaded = false;
  let routinesSupported = true;
  let routinesError = "";
  let taskAllDaySupported = true;
  let taskUsageSupported = true;
  let journalEntries = readLocalJson(journalStorageKey, []);
  let journalLoaded = false;
  let journalSupported = true;
  let journalDate = dateKey(new Date());
  let focusDistractions = readLocalJson(distractionStorageKey, []);
  let distractionsSupported = true;
  let smartSortEnabled = false;
  let quickCaptureType = "task";
  let globalSearchQuery = "";
  let searchSelectedTaskId = null;
  let focusPrepContext = { subjectId: "", taskId: "", goal: "", tools: "", minutes: 25 };
  let focusGoal = "";
  let focusTools = "";
  let focusSoundId = "off";
  let focusSoundVolume = 30;
  let focusSoundEngine = null;
  let shortcutsOpen = false;
  let weeklyReviewOpen = false;
  try {
    const soundPrefs = JSON.parse(
      localStorage.getItem(focusSoundPrefsKey) || "null",
    );
    if (soundPrefs && typeof soundPrefs === "object") {
      if (["off", "rain", "white", "brown", "forest", "fireplace"].includes(soundPrefs.id))
        focusSoundId = soundPrefs.id;
      if (Number(soundPrefs.volume) >= 0 && Number(soundPrefs.volume) <= 100)
        focusSoundVolume = Number(soundPrefs.volume);
    }
  } catch (error) {
    console.warn("Could not restore focus sound preferences.", error);
  }

  function readLocalJson(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "null");
      return value == null ? fallback : value;
    } catch (error) {
      console.warn(`Could not restore ${key}.`, error);
      return fallback;
    }
  }

  function writeLocalJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`Could not persist ${key}.`, error);
    }
  }

  /** Reads a CSS custom property from the document root so JS can use theme colors. */
  function getThemeColor(name, fallback) {
    try {
      const value = getComputedStyle(document.documentElement).getPropertyValue(name);
      const trimmed = (value || "").trim();
      return trimmed ? trimmed : fallback;
    } catch {
      return fallback;
    }
  }

  function saveLocalRoutines() {
    writeLocalJson(routinesStorageKey, routines);
  }

  function saveLocalRoutineDays() {
    writeLocalJson(routineDaysStorageKey, routineDays);
  }

  function saveLocalJournal() {
    writeLocalJson(journalStorageKey, journalEntries);
  }

  function saveLocalDistractions() {
    writeLocalJson(distractionStorageKey, focusDistractions);
  }

  const deadlineText = {
    en: {
      eyebrow: "STAY A STEP AHEAD",
      title: "Deadlines",
      subtitle: "Keep track of everything you need to finish.",
      add: "Add deadline",
      total: "Total deadlines",
      upcoming: "Upcoming",
      overdue: "Overdue",
      completed: "Completed",
      search: "Search deadlines",
      all: "All",
      filterUpcoming: "Upcoming",
      filterOverdue: "Overdue",
      filterCompleted: "Completed",
      dueDate: "Due date",
      priority: "Priority",
      recentlyAdded: "Recently added",
      list: "List view",
      calendar: "Calendar view",
      due: "Due",
      remaining: "left",
      tomorrow: "Due tomorrow",
      today: "Due today",
      overdueBy: "Overdue by",
      day: "day",
      days: "days",
      hour: "hour",
      hours: "hours",
      minute: "minute",
      minutes: "minutes",
      pending: "Pending",
      statusCompleted: "Completed",
      statusOverdue: "Overdue",
      noDeadlines: "No deadlines yet",
      noDeadlinesHint:
        "Add the dates you need to remember. They’ll stay in your account.",
      noResults: "No matching deadlines",
      noResultsHint: "Try a different search or filter.",
      showing: "Showing",
      deadline: "deadline",
      deadlines: "deadlines",
      noDate: "No date selected",
      noDateHint: "Choose a calendar day to see its deadlines.",
      noDateItems: "Nothing due on this day.",
      monthLabel: "Calendar month",
      previous: "Previous month",
      next: "Next month",
      currentMonth: "This month",
      modalAdd: "Add deadline",
      modalEdit: "Edit deadline",
      modalHelp: "Keep the important details and due time together.",
      titleLabel: "Deadline title",
      titlePlaceholder: "e.g. Submit research summary",
      description: "Description",
      optional: "Optional",
      descriptionPlaceholder: "Add helpful details",
      subject: "Subject",
      independent: "Independent study",
      low: "Low",
      medium: "Medium",
      high: "High",
      urgent: "Urgent",
      date: "Due date",
      time: "Due time",
      reminder: "Reminder",
      noReminder: "No reminder",
      minBefore: "minutes before",
      hourBefore: "1 hour before",
      dayBefore: "1 day before",
      cancel: "Cancel",
      save: "Save deadline",
      saving: "Saving…",
      close: "Close",
      deleteConfirm: "Delete this deadline? This cannot be undone.",
      validationTitle: "Enter a deadline title.",
      validationDate: "Choose a due date.",
      validationPast: "The due date must be in the future.",
      saveSuccess: "Deadline saved.",
      updateSuccess: "Deadline updated.",
      deleteSuccess: "Deadline deleted.",
      completeSuccess: "Deadline completed.",
      reopenSuccess: "Deadline reopened.",
      loadError: "Could not load deadlines.",
      saveError: "Could not save this deadline.",
      deleteError: "Could not delete the deadline.",
      edit: "Edit",
      delete: "Delete",
      priorityLabel: "Priority",
      reminderUnavailable:
        "Run the deadline migration to enable saved reminders.",
      reminderNote:
        "Reminders are saved with your deadline. Delivery requires the scheduled Supabase function.",
      sampleNote:
        "Guest preview data is stored in this browser. Sign in to sync deadlines across devices.",
      emptySubject: "No subjects yet",
      daysShort: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
      months: [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
      ],
    },
    ar: {
      eyebrow: "رتّب أولوياتك",
      title: "المواعيد النهائية",
      subtitle: "تابع كل ما تحتاج إلى إنجازه في الوقت المناسب.",
      add: "أضف موعدًا",
      total: "كل المواعيد",
      upcoming: "القادمة",
      overdue: "المتأخرة",
      completed: "المكتملة",
      search: "ابحث في المواعيد",
      all: "الكل",
      filterUpcoming: "القادمة",
      filterOverdue: "متأخرة",
      filterCompleted: "مكتملة",
      dueDate: "تاريخ الاستحقاق",
      priority: "الأولوية",
      recentlyAdded: "الأحدث إضافة",
      list: "عرض القائمة",
      calendar: "عرض التقويم",
      due: "الموعد",
      remaining: "متبقية",
      tomorrow: "موعدها غدًا",
      today: "موعدها اليوم",
      overdueBy: "متأخر منذ",
      day: "يوم",
      days: "أيام",
      hour: "ساعة",
      hours: "ساعات",
      minute: "دقيقة",
      minutes: "دقائق",
      pending: "قيد الانتظار",
      statusCompleted: "مكتمل",
      statusOverdue: "متأخر",
      noDeadlines: "لا توجد مواعيد بعد",
      noDeadlinesHint:
        "أضف المواعيد التي تريد تذكّرها، وستبقى محفوظة في حسابك.",
      noResults: "لا توجد مواعيد مطابقة",
      noResultsHint: "جرّب تغيير البحث أو عوامل التصفية.",
      showing: "عرض",
      deadline: "موعد",
      deadlines: "مواعيد",
      noDate: "لم يُحدَّد يوم",
      noDateHint: "اختر يومًا من التقويم لعرض مواعيده.",
      noDateItems: "لا توجد مواعيد لهذا اليوم.",
      monthLabel: "شهر التقويم",
      previous: "الشهر السابق",
      next: "الشهر التالي",
      currentMonth: "هذا الشهر",
      modalAdd: "إضافة موعد",
      modalEdit: "تعديل الموعد",
      modalHelp: "أضف تفاصيل الموعد وتاريخه لتبقى كلها في مكان واحد.",
      titleLabel: "عنوان الموعد",
      titlePlaceholder: "مثال: تسليم ملخص البحث",
      description: "الوصف",
      optional: "اختياري",
      descriptionPlaceholder: "أضف تفاصيل تساعدك",
      subject: "المادة",
      independent: "دراسة مستقلة",
      low: "منخفضة",
      medium: "متوسطة",
      high: "عالية",
      urgent: "عاجلة",
      date: "تاريخ الاستحقاق",
      time: "وقت الاستحقاق",
      reminder: "التذكير",
      noReminder: "بلا تذكير",
      minBefore: "دقيقة قبل الموعد",
      hourBefore: "قبل ساعة",
      dayBefore: "قبل يوم",
      cancel: "إلغاء",
      save: "حفظ الموعد",
      saving: "جارٍ الحفظ…",
      close: "إغلاق",
      deleteConfirm: "هل تريد حذف هذا الموعد؟ لا يمكن التراجع عن ذلك.",
      validationTitle: "أدخل عنوان الموعد.",
      validationDate: "اختر تاريخ الاستحقاق.",
      validationPast: "يجب أن يكون الموعد في المستقبل.",
      saveSuccess: "تم حفظ الموعد.",
      updateSuccess: "تم تحديث الموعد.",
      deleteSuccess: "تم حذف الموعد.",
      completeSuccess: "تم إنجاز الموعد.",
      reopenSuccess: "تمت إعادة فتح الموعد.",
      loadError: "تعذّر تحميل المواعيد.",
      saveError: "تعذّر حفظ الموعد.",
      deleteError: "تعذّر حذف الموعد.",
      edit: "تعديل",
      delete: "حذف",
      priorityLabel: "الأولوية",
      reminderUnavailable: "شغّل ترحيل المواعيد لتفعيل حفظ التذكيرات.",
      reminderNote:
        "يُحفظ التذكير مع الموعد. يتطلب إرسال التنبيه تفعيل وظيفة Supabase مجدولة.",
      sampleNote:
        "تُحفظ بيانات المعاينة على هذا الجهاز. سجّل الدخول لمزامنة مواعيدك بين الأجهزة.",
      emptySubject: "لا توجد مواد بعد",
      daysShort: [
        "الأحد",
        "الإثنين",
        "الثلاثاء",
        "الأربعاء",
        "الخميس",
        "الجمعة",
        "السبت",
      ],
      months: [
        "يناير",
        "فبراير",
        "مارس",
        "أبريل",
        "مايو",
        "يونيو",
        "يوليو",
        "أغسطس",
        "سبتمبر",
        "أكتوبر",
        "نوفمبر",
        "ديسمبر",
      ],
    },
  };
  const savedLanguage = localStorage.getItem("studyflow.language");
  let appLanguage =
    savedLanguage === "ar" || savedLanguage === "en"
      ? savedLanguage
      : navigator.language?.toLowerCase().startsWith("ar")
        ? "ar"
        : "en";

  function shouldAnimate(effectId) {
    if (!animationsEnabled) return false;
    if (document.visibilityState !== "visible") return false;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
    if (reducedMotion) return false;
    if (effectId && animationEffects[effectId] === false) return false;
    return true;
  }

  function shouldUseFullMotion() {
    return shouldAnimate() && motionLevel === "full";
  }

  const interfaceText = {
    "YOUR STUDY LIFE, ORGANIZED": "حياتك الدراسية، منظمة",
    WORKSPACE: "مساحة العمل",
    "Main navigation": "التنقل الرئيسي",
    "Progress navigation": "التنقل بين الإنجازات",
    "YOUR PROGRESS": "تقدمك",
    Dashboard: "لوحة التحكم",
    "Study planner": "مخطط الدراسة",
    Tasks: "المهام",
    Deadlines: "المواعيد النهائية",
    Subjects: "المواد الدراسية",
    "Study files": "ملفات الدراسة",
    Notes: "الملاحظات",
    "Voice notes": "الملاحظات الصوتية",
    Teams: "الفرق",
    "Focus timer": "مؤقت التركيز",
    Analytics: "التحليلات",
    Goals: "الأهداف",
    "Exams & results": "الاختبارات والنتائج",
    Achievements: "الإنجازات",
    Notifications: "الإشعارات",
    Profile: "الملف الشخصي",
    Settings: "الإعدادات",
    Admin: "الإدارة",
    "Admin dashboard": "لوحة إدارة النظام",
    "Registered users": "المستخدمون المسجلون",
    "Review registered accounts and their sign-in status.":
      "راجع الحسابات المسجلة وحالة تسجيل الدخول.",
    "This private list is visible only to authorized administrators.":
      "هذه القائمة خاصة بالمديرين المصرح لهم فقط.",
    "Search by name or email": "ابحث بالاسم أو البريد الإلكتروني",
    Search: "بحث",
    Refresh: "تحديث",
    "Loading users…": "جارٍ تحميل المستخدمين…",
    "Could not load users.": "تعذر تحميل المستخدمين.",
    "No users found.": "لم يتم العثور على مستخدمين.",
    User: "المستخدم",
    Role: "الدور",
    Joined: "تاريخ الانضمام",
    "Last sign-in": "آخر تسجيل دخول",
    "Email status": "حالة البريد",
    Confirmed: "مؤكد",
    "Pending confirmation": "بانتظار التأكيد",
    of: "من",
    Previous: "السابق",
    Next: "التالي",
    student: "طالب",
    admin: "مدير",
    "STUDY STREAK": "أيام الدراسة المتتالية",
    "12 days": "١٢ يومًا",
    "Student account": "حساب طالب",
    "Demo workspace": "مساحة تجريبية",
    "Supabase ready": "Supabase جاهز",
    "Supabase connected": "تم الاتصال بـSupabase",
    "Open navigation": "فتح قائمة التنقل",
    "Open profile": "فتح الملف الشخصي",
    "Study Zone dashboard": "لوحة تحكم Study Zone",
    Workspace: "مساحة العمل",
    Today: "اليوم",
    Close: "إغلاق",
    "STAY ON TRACK": "حافظ على إنجازك",
    "Add a task": "إضافة مهمة",
    "Task name": "اسم المهمة",
    "e.g. Review chapter 4": "مثال: مراجعة الفصل الرابع",
    Subject: "المادة الدراسية",
    Priority: "الأولوية",
    Medium: "متوسطة",
    Low: "منخفضة",
    High: "عالية",
    Urgent: "عاجلة",
    low: "منخفضة",
    medium: "متوسطة",
    high: "عالية",
    urgent: "عاجلة",
    "Due date": "تاريخ الاستحقاق",
    "Starts on": "يبدأ في",
    "Estimated minutes": "المدة المقدرة بالدقائق",
    Repeat: "التكرار",
    "Does not repeat": "بدون تكرار",
    "Every day": "يوميًا",
    "Every week": "أسبوعيًا",
    "Every month": "شهريًا",
    "Choose weekdays": "اختيار أيام الأسبوع",
    "Repeat on": "التكرار في",
    "Repeat until": "تكرار حتى",
    "Choose an end date within the next year. Each occurrence is saved as its own task.":
      "اختر تاريخ انتهاء خلال السنة القادمة. يُحفظ كل موعد كمهمة مستقلة.",
    Mon: "الإثنين",
    Tue: "الثلاثاء",
    Wed: "الأربعاء",
    Thu: "الخميس",
    Fri: "الجمعة",
    Sat: "السبت",
    Sun: "الأحد",
    "Save task": "حفظ المهمة",
    "KEEP IT MOVING": "واصل التقدم",
    "Add deadline": "إضافة موعد نهائي",
    "Keep the important details and due time together.":
      "اجمع تفاصيل الموعد وتاريخه في مكان واحد.",
    "Deadline title": "عنوان الموعد",
    "e.g. Submit research summary": "مثال: تسليم ملخص البحث",
    Description: "الوصف",
    Optional: "اختياري",
    "Add helpful details": "أضف تفاصيل مفيدة",
    "Due time": "وقت الاستحقاق",
    Reminder: "التذكير",
    "No reminder": "بلا تذكير",
    "15 minutes before": "قبل الموعد بـ١٥ دقيقة",
    "1 hour before": "قبل الموعد بساعة",
    "1 day before": "قبل الموعد بيوم",
    Cancel: "إلغاء",
    "Save deadline": "حفظ الموعد",
    "YOUR STUDY LIFE, ORGANIZED": "حياتك الدراسية، منظمة",
    "Welcome to Study Zone": "مرحبًا بك في Study Zone",
    "Connect Supabase to create an account or sign in.":
      "اربط Supabase لإنشاء حساب أو تسجيل الدخول.",
    "Sign in": "تسجيل الدخول",
    "Create account": "إنشاء حساب",
    "Your name": "اسمك",
    "Email address": "البريد الإلكتروني",
    Password: "كلمة المرور",
    "At least 6 characters": "٦ أحرف على الأقل",
    "Sign out": "تسجيل الخروج",
    "Your password is handled securely by Supabase Auth.":
      "تُدار كلمة مرورك بأمان عبر خدمة Supabase Auth.",
    "Choose language": "اختر اللغة",
    "Toggle light theme": "تبديل السمة الفاتحة",
    "Motion & celebrations": "الحركة والاحتفالات",
    "Choose how much motion Study Zone uses.":
      "اختر مستوى الحركة في Study Zone.",
    "Full Motion": "حركة كاملة",
    "Layered transitions and celebrations": "انتقالات واحتفالات متكاملة",
    "Reduced Motion": "حركة مخففة",
    "Short, gentle transitions": "انتقالات قصيرة وهادئة",
    "Motion Off": "إيقاف الحركة",
    "Disable nonessential animation": "إيقاف الحركات غير الضرورية",
    "Animation level": "مستوى الحركة",
    "You’re offline. Network-backed data and sync are unavailable; changes may not be saved.":
      "أنت غير متصل بالإنترنت. البيانات والمزامنة عبر الشبكة غير متاحة؛ قد لا تُحفظ التغييرات.",
    "Settings saved.": "تم حفظ الإعدادات.",
    "Language changed.": "تم تغيير اللغة.",
    Unlocked: "تم الفتح",
    "Connect your account for real rewards": "اربط حسابك لعرض مكافآتك الفعلية",
    "Based on verified activity": "بناءً على النشاط الموثق",
    "tasks finished": " مهام مكتملة",
    "left · ": " متبقية · ",
    "Amazing! Task completed!": "عاش! خلصت المهمة بنجاح!",
    "Great job! You're making progress!": "أحسنت! أنت تحرز تقدمًا رائعًا!",
    "A new step toward your goal!": "خطوة جديدة نحو هدفك!",
    "Deadline completed!": "أحسنت! أنجزت الموعد!",
    "Task completed": "أُنجزت المهمة",
    "Deadline completed": "أُنجز الموعد",
    "Deadline completed.": "أُنجز الموعد النهائي.",
    "Focus session complete!": "اكتملت جلسة التركيز!",
    "Pomodoro cycle complete!": "اكتملت دورة بومودورو!",
    "Level up!": "ارتقيت إلى مستوى جديد!",
    "Achievement unlocked!": "إنجاز جديد!",
    "Your progress is adding up.": "تقدمك يتراكم خطوة بخطوة.",
    "You're building a great study streak!": "أنت تبني سلسلة دراسة رائعة!",
    "Goal reached!": "تم تحقيق الهدف!",
    "First Task": "المهمة الأولى",
    "Complete your first task.": "أنجز مهمتك الأولى.",
    "Focus Starter": "بداية التركيز",
    "Complete your first verified focus session.": "أكمل أول جلسة تركيز موثقة.",
    "Focus Master": "خبير التركيز",
    "Complete 10 verified focus sessions.": "أكمل ١٠ جلسات تركيز موثقة.",
    "Deadline Hero": "بطل المواعيد",
    "Complete 10 tasks with deadlines.": "أنجز ١٠ مهام لها مواعيد نهائية.",
    "Study Streak": "سلسلة الدراسة",
    "Build a 7-day activity streak.":
      "حافظ على نشاط دراسي لمدة ٧ أيام متتالية.",
    "Consistency Champion": "بطل الاستمرارية",
    "Build a 30-day activity streak.":
      "حافظ على نشاط دراسي لمدة ٣٠ يومًا متتاليًا.",
    "Sign in to earn secure rewards.": "سجّل الدخول لكسب المكافآت بأمان.",
    "Rewards load after applying the latest Supabase migration.":
      "ستظهر المكافآت بعد تطبيق آخر تحديث لقاعدة Supabase.",
    "Earned achievements": "الإنجازات المكتسبة",
    "No achievements unlocked yet.": "لم تُفتح إنجازات بعد.",
    Level: "المستوى",
    XP: "نقطة خبرة",
    "Progress to next level": "التقدم نحو المستوى التالي",
    "Completed tasks": "المهام المكتملة",
    "Focus sessions": "جلسات التركيز",
    "Goals achieved": "الأهداف المحققة",
    "Study streak": "سلسلة الدراسة",
    "Your level increased!": "ارتقى مستواك!",
    "You've reached a new study milestone.": "لقد وصلت إلى محطة دراسية جديدة.",
    "Install app": "تثبيت التطبيق",
    "Install Study Zone": "تثبيت Study Zone",
    Done: "تم",
    "A new version is available.": "يتوفر إصدار جديد.",
    "Update now": "حدّث الآن",
    "App installed.": "تم تثبيت التطبيق.",
    "Could not start installation.": "تعذّر بدء التثبيت.",
    "MAKE TIME FOR WHAT MATTERS": "خصص وقتًا لما يهمك",
    "Add a task": "إضافة مهمة",
    "STUDY THIS WEEK": "الدراسة هذا الأسبوع",
    " across the last 7 days": " خلال الأيام السبعة الماضية",
    "TASKS COMPLETED": "المهام المكتملة",
    " tasks finished": " مهام منجزة",
    "CURRENT LEVEL": "المستوى الحالي",
    " · steady progress": " · تقدم ثابت",
    "STUDY STREAK": "أيام الدراسة المتتالية",
    " · best this term": " · الأفضل هذا الفصل",
    "Personal best · ": "أفضل إنجاز · ",
    "Add a subject to start tracking course progress.":
      "أضف مادة لمتابعة تقدمك الدراسي.",
    "A clear plan makes room for your best work.":
      "الخطة الواضحة تهيئ لك أفضل إنجاز.",
    "Study rhythm": "وتيرة الدراسة",
    "Sample hours from the past week": "ساعات تجريبية من الأسبوع الماضي",
    "View analytics →": "عرض التحليلات ←",
    "Subject progress": "التقدم في المواد",
    "Current mastery estimates": "تقديرات مستوى الإتقان الحالي",
    "Up next": "التالي",
    "Your planned study blocks": "جلساتك الدراسية المخططة",
    "Open planner →": "فتح المخطط ←",
    "Recent achievements": "الإنجازات الأخيرة",
    "Keep building your rhythm": "واصل بناء عادتك الدراسية",
    "Goal progress": "التقدم نحو الأهداف",
    "Small steps add up": "الخطوات الصغيرة تصنع فرقًا",
    "Quick start": "ابدأ بسرعة",
    "Pick up where you left off": "تابع من حيث توقفت",
    "Focus →": "التركيز ←",
    "Review your upcoming tasks": "راجع مهامك القادمة",
    "Tasks →": "المهام ←",
    "Explore your study materials": "استكشف موادك الدراسية",
    "Files →": "الملفات ←",
    "Preview figures are sample data until you connect your Supabase project.":
      "الأرقام المعروضة تجريبية حتى تربط مشروع Supabase.",
    TASKBOARD: "لوحة المهام",
    "Tasks & deadlines": "المهام والمواعيد النهائية",
    "Keep assignments, priorities, and due dates in one calm place.":
      "نظّم واجباتك وأولوياتك ومواعيدها في مكان واحد.",
    "Search tasks": "ابحث في المهام",
    "Filter task status": "تصفية حالة المهام",
    "All tasks": "كل المهام",
    "Not started": "لم تبدأ",
    "In progress": "قيد التنفيذ",
    Completed: "مكتملة",
    "New task": "مهمة جديدة",
    Reopen: "إعادة فتح",
    Complete: "إنجاز",
    Delete: "حذف",
    "No tasks found": "لم يتم العثور على مهام",
    "Try another search or add your next task.":
      "جرّب بحثًا آخر أو أضف مهمتك التالية.",
    "Your tasks": "مهامك",
    " tasks remaining": " مهام متبقية",
    "Tasks are stored in this browser in preview mode. Signed-in accounts use Supabase.":
      "تُحفظ المهام في هذا المتصفح في وضع المعاينة، وتُزامن مع Supabase بعد تسجيل الدخول.",
    "Independent study": "دراسة مستقلة",
    "Discrete math problem set": "مجموعة مسائل الرياضيات المتقطعة",
    "Biology flashcards review": "مراجعة بطاقات الأحياء",
    "History essay outline": "مخطط مقال التاريخ",
    "Calculus revision quiz": "اختبار مراجعة التفاضل والتكامل",
    "No due date": "بلا موعد استحقاق",
    "Search deadlines": "ابحث في المواعيد النهائية",
    "Filter task status": "تصفية حالة المهام",
    "Add a task": "إضافة مهمة",
    "WEEK AT A GLANCE": "أسبوعك بنظرة سريعة",
    "Make a realistic plan, then give yourself room to adapt.":
      "ضع خطة واقعية واترك مساحة للتغيير.",
    "Plan a block": "إضافة جلسة",
    "This week": "هذا الأسبوع",
    "Planned sessions · preview": "الجلسات المخططة · معاينة",
    "Open day": "يوم متاح",
    "No study blocks planned.": "لا توجد جلسات دراسية مخططة.",
    "Planned vs. actual": "المخطط مقابل الفعلي",
    "Compare time blocks with completed focus sessions":
      "قارن الجلسات المخططة بجلسات التركيز المكتملة",
    "planned this week": "مخطط هذا الأسبوع",
    "5.1 hours logged in this sample week":
      "سُجلت ٥٫١ ساعات في هذا الأسبوع التجريبي",
    "Planning tip": "نصيحة للتخطيط",
    "Leave a little breathing room between study blocks. A flexible plan is easier to keep than a perfect one.":
      "اترك وقتًا للراحة بين الجلسات. فالخطة المرنة أسهل التزامًا من الخطة المثالية.",
    "YOUR COURSES": "موادك الدراسية",
    "A quick view of your courses, credits, and learning progress.":
      "نظرة سريعة على موادك وساعاتها وتقدمك الدراسي.",
    "Add subject": "إضافة مادة",
    credits: "ساعات معتمدة",
    "Keep your notes, tasks, and study sessions connected to this course.":
      "اربط ملاحظاتك ومهامك وجلساتك الدراسية بهذه المادة.",
    "Learning progress": "التقدم الدراسي",
    "No subjects yet": "لا توجد مواد بعد",
    "Add your first course to start organizing your study workspace.":
      "أضف مادتك الأولى لتنظيم مساحة دراستك.",
    "Subject details loaded from your account. Course progress appears as you log study sessions.":
      "تم تحميل المواد من حسابك. سيظهر تقدمك عند تسجيل جلسات الدراسة.",
    "Preview content. Subject management will be backed by your Supabase database.":
      "محتوى تجريبي. ستُدار المواد عبر قاعدة بيانات Supabase.",
    "STUDY MATERIALS": "المواد الدراسية",
    "Your files": "ملفاتك",
    "A tidy home for resources from every course.": "مكان منظم لمراجع كل مادة.",
    "Upload file": "رفع ملف",
    "Course resources": "مراجع المقرر",
    "Organize future uploads by subject and folder.":
      "نظّم ملفاتك حسب المادة والمجلد.",
    "Sample file cards are for layout preview. Storage uploads require a private Supabase bucket.":
      "الملفات المعروضة تجريبية. يتطلب رفع الملفات إعداد مساحة تخزين خاصة في Supabase.",
    "YOUR KNOWLEDGE VAULT": "مستودع معرفتك",
    "Capture what matters and find it when you need it.":
      "دوّن ما يهمك واعثر عليه وقت الحاجة.",
    "New note": "ملاحظة جديدة",
    Updated: "تم التحديث",
    "A place for your key ideas, examples, and questions to revisit later.":
      "مساحة لأفكارك وأمثلتك وأسئلتك المهمة للعودة إليها لاحقًا.",
    "Sample content only. Notes can be stored in your private Supabase workspace.":
      "محتوى تجريبي. يمكن حفظ ملاحظاتك في مساحة Supabase الخاصة بك.",
    "YOUR STUDY PATTERNS": "أنماط دراستك",
    "Understand your study habits without losing sight of the bigger picture.":
      "افهم عادات دراستك مع الحفاظ على نظرتك الشاملة.",
    "Analytics date range": "النطاق الزمني للتحليلات",
    "Last 7 days": "آخر ٧ أيام",
    "Last 30 days": "آخر ٣٠ يومًا",
    "This semester": "هذا الفصل الدراسي",
    "STUDY TIME": "وقت الدراسة",
    " across 7 days": " خلال ٧ أيام",
    "DAILY AVERAGE": "المعدل اليومي",
    " each day": " يوميًا",
    "On track · ": "على المسار الصحيح · ",
    "TASK COMPLETION": "إنجاز المهام",
    " tasks finished": " مهام منجزة",
    "SUBJECTS ACTIVE": "المواد النشطة",
    " courses this week": " مواد هذا الأسبوع",
    "Balanced · ": "متوازن · ",
    "Daily study hours": "ساعات الدراسة اليومية",
    "Sample focus time · hours per day": "وقت تركيز تجريبي · ساعات يوميًا",
    "Recent exam results": "نتائج الاختبارات الأخيرة",
    "Score by subject": "النتيجة حسب المادة",
    "Scores shown are sample content only.": "النتائج المعروضة تجريبية فقط.",
    "How to read these numbers": "كيفية قراءة هذه الأرقام",
    "Study time is summed from completed focus sessions. Task completion is completed tasks divided by all tasks in the selected range. Connect your database to replace the preview with your records.":
      "يُحسب وقت الدراسة من جلسات التركيز المكتملة. ونسبة إنجاز المهام هي المهام المكتملة مقسومة على إجمالي المهام في الفترة المحددة. اربط قاعدة بياناتك لعرض سجلاتك الفعلية.",
    "Performance Overview": "نظرة عامة على الأداء",
    "Study Hours": "ساعات الدراسة",
    "Completed Tasks": "المهام المكتملة",
    "Focus Sessions": "جلسات التركيز",
    "Productivity": "الإنتاجية",
    "Completion Rate": "معدل الإنجاز",
    "Peak value": "أعلى قيمة",
    "Lowest value": "أدنى قيمة",
    "Average": "المتوسط",
    "Change": "التغيير",
    "Metric": "المؤشر",
    "MILESTONES THAT MATTER": "إنجازات تستحق الاحتفاء",
    "Turn the semester into small, achievable steps.":
      "حوّل الفصل الدراسي إلى خطوات صغيرة قابلة للإنجاز.",
    "Create a goal": "إنشاء هدف",
    LEFT: "متبقية",
    "Preview goals. Your own goals will be stored per-user after connecting Supabase.":
      "أهداف تجريبية. ستُحفظ أهدافك في حسابك بعد ربط Supabase.",
    "EXAM TRACKER": "متابعة الاختبارات",
    "Keep upcoming assessments and your progress in one view.":
      "تابع اختباراتك القادمة وتقدمك في مكان واحد.",
    "Add exam": "إضافة اختبار",
    "PAST RESULT · SAMPLE": "نتيجة سابقة · تجريبية",
    "Recorded exam score preview": "معاينة نتيجة اختبار مسجلة",
    "Upcoming assessments": "الاختبارات القادمة",
    "No upcoming exams connected": "لا توجد اختبارات قادمة مرتبطة",
    "Add your real exam dates after connecting the database.":
      "أضف مواعيد اختباراتك بعد ربط قاعدة البيانات.",
    MILESTONES: "محطات الإنجاز",
    "Celebrate consistency and progress, not just perfect days.":
      "احتفِ بالاستمرار والتقدم، لا بالأيام المثالية فقط.",
    "Unlocked in sample data": "مفتوح في البيانات التجريبية",
    "Keep going to unlock": "واصل التقدم لفتحه",
    "Your progress level": "مستوى تقدمك",
    "sample XP": "نقاط خبرة تجريبية",
    "XP and rewards must be granted by trusted database operations, never directly from the browser.":
      "يجب منح نقاط الخبرة والمكافآت عبر عمليات قاعدة بيانات موثوقة، وليس مباشرة من المتصفح.",
    UPDATES: "التحديثات",
    "A quiet place for reminders, milestones, and important updates.":
      "مساحة هادئة للتذكيرات والإنجازات والتحديثات المهمة.",
    "Mark all read": "تحديد الكل كمقروء",
    "All caught up": "أنت على اطلاع بكل جديد",
    "Sign in to sync notifications": "سجّل الدخول لمزامنة الإشعارات",
    "Deadline reminders will appear here when generated.":
      "ستظهر تذكيرات المواعيد هنا عند إنشائها.",
    "Your private deadline notifications are attached to your account.":
      "إشعارات مواعيدك الخاصة مرتبطة بحسابك.",
    "YOUR ACCOUNT": "حسابك",
    "Your academic workspace, at a glance.": "نظرة سريعة على مساحة دراستك.",
    Level: "المستوى",
    "Day streak": "أيام متتالية",
    "Academic profile": "الملف الدراسي",
    "Personal details stay private to your account":
      "بياناتك الشخصية خاصة بحسابك",
    Program: "البرنامج الدراسي",
    "Computer Science · sample profile": "علوم الحاسب · ملف تجريبي",
    "Current term": "الفصل الحالي",
    "Fall term · update in your profile":
      "فصل الخريف · عدّل بياناتك في الملف الشخصي",
    Timezone: "المنطقة الزمنية",
    "Edit profile": "تعديل الملف الشخصي",
    "MAKE IT YOURS": "خصص تجربتك",
    "Tune Study Zone to the way you like to work.":
      "اضبط Study Zone بما يناسب أسلوب عملك.",
    Appearance: "المظهر",
    "Dark theme": "السمة الداكنة",
    "Designed for focus, day or night": "مصممة للتركيز ليلًا ونهارًا",
    "Emerald accents": "لمسات الزمرد",
    "Official Study Zone color palette": "لوحة ألوان Study Zone الرسمية",
    "Orange": "Orange",
    "Warm orange surfaces with a bright amber accent": "Warm orange surfaces with a bright amber accent",
    Language: "اللغة",
    "Display language": "لغة العرض",
    "Deadlines appear in the selected language.":
      "تُعرض المواعيد باللغة المحددة.",
    Reminders: "التذكيرات",
    "Task reminders": "تذكيرات المهام",
    "Upcoming deadlines": "المواعيد القادمة",
    "Study nudges": "تذكيرات الدراسة",
    "Gentle focus reminders": "تذكيرات لطيفة للتركيز",
    "Daily study check-in": "تذكير يومي بالدراسة",
    "Review your open tasks once a day, even when Study Zone is closed.":
      "راجع مهامك المفتوحة مرة يوميًا، حتى عند إغلاق Study Zone.",
    "Enable push reminders": "تفعيل الإشعارات الفورية",
    "Reminder time": "وقت التذكير",
    "Uses this device’s timezone.": "يستخدم المنطقة الزمنية لهذا الجهاز.",
    "Save reminder": "حفظ التذكير",
    "Get a daily task check-in plus deadline and achievement notifications, even when Study Zone is closed.":
      "احصل على تذكير يومي بالمهام وإشعارات المواعيد والإنجازات حتى عند إغلاق Study Zone.",
    "Push reminders need notification permission and the server setup described in README.md.":
      "تتطلب الإشعارات الفورية إذن الإشعارات وإعداد الخادم الموضح في README.md.",
    "Sign in to configure daily reminders.":
      "سجّل الدخول لإعداد التذكيرات اليومية.",
    "Choose a profile photo from your device":
      "اختر صورة الملف الشخصي من جهازك",
    "PNG, JPEG, or WebP · up to 2 MB": "PNG أو JPEG أو WebP · حتى ٢ ميجابايت",
    "Could not save your reminder.": "تعذّر حفظ التذكير.",
    "Notification permission is required to enable daily push reminders.":
      "يلزم السماح بالإشعارات لتفعيل التذكير اليومي.",
    "Daily push is not configured yet. Ask your administrator to finish the VAPID setup.":
      "لم يتم إعداد الإشعارات اليومية بعد. اطلب من المسؤول إكمال إعداد VAPID.",
    "Reminder saved.": "تم حفظ التذكير.",
    "Profile photo uploaded.": "تم رفع صورة الملف الشخصي.",
    "Reach level 5.": "وصل إلى المستوى ٥.",
    "Reach level 10.": "وصل إلى المستوى ١٠.",
    "Reach level 20.": "وصل إلى المستوى ٢٠.",
    "Reach level 50.": "وصل إلى المستوى ٥٠.",
    "Rising Scholar": "طالب صاعد",
    "Study Champion": "بطل الدراسة",
    "Master Strategist": "استراتيجي متمكن",
    "Study Legend": "أسطورة الدراسة",
    Reward: "المكافأة",
    "Data & privacy": "البيانات والخصوصية",
    "Account data": "بيانات الحساب",
    "Stored in your private Supabase account when configured":
      "تُحفظ في حساب Supabase الخاص بك بعد الإعداد",
    "Service keys": "مفاتيح الخدمة",
    "Only the public anon key belongs in this browser config.":
      "يُسمح بوضع المفتاح العام anon فقط في إعدادات المتصفح.",
    ADMINISTRATION: "إدارة النظام",
    "Protected operational metrics and account administration.":
      "مؤشرات التشغيل المحمية وإدارة الحسابات.",
    "Checking administrator access…": "جارٍ التحقق من صلاحية المدير…",
    "Administrator access denied.": "تم رفض صلاحية الوصول إلى لوحة الإدارة.",
    "Could not verify administrator access.": "تعذّر التحقق من صلاحية المدير.",
    "Administrator access verified.": "تم التحقق من صلاحية المدير.",
    "No administrative services are connected yet.":
      "لم يتم ربط أدوات الإدارة بعد.",
    "The admin role is verified by Supabase for your signed-in account.":
      "تحقّق Supabase من صلاحية المدير لحسابك المسجّل.",
    "REGISTERED USERS": "المستخدمون المسجلون",
    " Configure a protected server query": " أعد إعداد استعلام خادم محمي",
    "ACTIVE SESSIONS": "الجلسات النشطة",
    " Admin-only metric unavailable": " المؤشر متاح للمدير فقط",
    "SYSTEM STATUS": "حالة النظام",
    Protected: "محمي",
    " No admin endpoint configured": " لم يتم إعداد واجهة الإدارة",
    "Access control": "التحكم في الوصول",
    "The database uses a non-user-editable profile role field and row-level policies. Add an Edge Function or trusted server for any cross-user administration or suspension feature.":
      "تستخدم قاعدة البيانات دورًا للملف الشخصي لا يستطيع المستخدم تعديله وسياسات على مستوى الصفوف. أضف وظيفة Edge أو خادمًا موثوقًا لأي إدارة بين المستخدمين أو لتعليق الحسابات.",
    "Sample study hours over the last seven days":
      "ساعات دراسة تجريبية خلال الأيام السبعة الماضية",
    "Could not load tasks.": "تعذّر تحميل المهام.",
    "Could not save this task.": "تعذّر حفظ هذه المهمة.",
    "Could not update task:": "تعذّر تحديث المهمة:",
    "Could not delete task:": "تعذّر حذف المهمة:",
    "Task saved to your account.": "تم حفظ المهمة في حسابك.",
    "Task saved in this browser.": "تم حفظ المهمة في هذا المتصفح.",
    "Task completed.": "تم إنجاز المهمة.",
    "Task reopened.": "تمت إعادة فتح المهمة.",
    "Task deleted.": "تم حذف المهمة.",
    "Enter a task name.": "أدخل اسم المهمة.",
    "Could not load notifications:": "تعذّر تحميل الإشعارات:",
    "Could not update notifications:": "تعذّر تحديث الإشعارات:",
    "Could not mark notifications as read.": "تعذّر تحديد الإشعارات كمقروءة.",
    "Notifications marked as read.": "تم تحديد الإشعارات كمقروءة.",
    "Sign in to manage your notifications.": "سجّل الدخول لإدارة إشعاراتك.",
    "Signed out.": "تم تسجيل الخروج.",
    "Your account is ready.": "حسابك جاهز.",
    "Welcome back.": "مرحبًا بعودتك.",
    "Check your email to confirm your new account.":
      "تحقق من بريدك الإلكتروني لتأكيد حسابك الجديد.",
    "Small steps. Meaningful progress.": "خطوات صغيرة، وتقدم ملموس.",
    "Plan a block": "إضافة جلسة",
    "New task": "مهمة جديدة",
    "Add subject": "إضافة مادة",
    "Upload file": "رفع ملف",
    "New note": "ملاحظة جديدة",
    "Create a goal": "إنشاء هدف",
    "Add exam": "إضافة اختبار",
    "Set SUPABASE_URL and SUPABASE_ANON_KEY in supabase-config.js to enable sign-in.":
      "أضف SUPABASE_URL وSUPABASE_ANON_KEY إلى supabase-config.js لتفعيل تسجيل الدخول.",
    "Language saved on this device, but account sync failed:":
      "تم حفظ اللغة على هذا الجهاز، لكن تعذرت مزامنتها مع الحساب:",
    "Could not load subjects:": "تعذّر تحميل المواد:",
    "Could not load tasks:": "تعذّر تحميل المهام:",
    "Could not load notifications:": "تعذّر تحميل الإشعارات:",
    "Could not update notifications:": "تعذّر تحديث الإشعارات:",
    "Could not restore session:": "تعذّرت استعادة الجلسة:",
    "Could not sign out:": "تعذّر تسجيل الخروج:",
    "Invalid login credentials": "بيانات تسجيل الدخول غير صحيحة.",
    "User already registered": "هذا البريد الإلكتروني مسجل بالفعل.",
    "Email not confirmed": "لم يتم تأكيد البريد الإلكتروني بعد.",
    "Password should be at least 6 characters":
      "يجب ألا تقل كلمة المرور عن ٦ أحرف.",
    "Failed to fetch": "تعذر الاتصال بالخادم. تحقق من اتصالك بالإنترنت.",
    "Authentication failed":
      "تعذّر تسجيل الدخول. تحقق من بياناتك وحاول مجددًا.",
    "Delete this deadline? This cannot be undone.":
      "هل تريد حذف هذا الموعد؟ لا يمكن التراجع عن ذلك.",
    "This is a local preview. Add your Supabase project details to enable authentication.":
      "هذه معاينة محلية. أضف بيانات مشروع Supabase لتفعيل تسجيل الدخول.",
    "Sign in to sync your private study workspace.":
      "سجّل الدخول لمزامنة مساحة دراستك الخاصة.",
    "Your password is handled securely by Supabase Auth.":
      "تُدار كلمة مرورك بأمان عبر خدمة Supabase Auth.",
    "Add your Supabase URL and public anon key in supabase-config.js and allow the SDK to load":
      "أضف رابط Supabase ومفتاح anon العام إلى supabase-config.js وتأكد من تحميل مكتبة SDK.",
    "Study planning is a preview; scheduling is not implemented, so nothing was saved.":
      "مخطط الدراسة للمعاينة؛ إنشاء الجلسات غير منفذ، ولم يُحفظ أي شيء.",
    "Subject management is not implemented yet; no subject was created.":
      "إدارة المواد غير منفذة حاليًا؛ لم تُضف أي مادة.",
    "File uploads are unavailable; storage upload is not implemented, so no file was uploaded.":
      "رفع الملفات غير متاح؛ آلية الرفع غير منفذة، ولم يُرفع أي ملف.",
    "Notes are a preview; note editing is not implemented, so nothing was saved.":
      "الملاحظات للمعاينة؛ تحرير الملاحظات غير منفذ، ولم يُحفظ أي شيء.",
    "Goals are a preview; goal creation is not implemented, so no goal was saved.":
      "الأهداف للمعاينة؛ إنشاء الأهداف غير منفذ، ولم يُحفظ أي هدف.",
    "Exam tracking is not implemented yet; no exam or result was saved.":
      "متابعة الاختبارات غير منفذة حاليًا؛ لم يُحفظ أي اختبار أو نتيجة.",
    "Notification read state will sync after connecting your account.":
      "ستُزامن حالة قراءة الإشعارات بعد ربط حسابك.",
    "No subjects yet": "لا توجد مواد بعد",
    "Independent study": "دراسة مستقلة",
    "Calculus II": "التفاضل والتكامل ٢",
    Algorithms: "الخوارزميات",
    Biology: "الأحياء",
    History: "التاريخ",
    Monday: "الإثنين",
    Tuesday: "الثلاثاء",
    Wednesday: "الأربعاء",
    Thursday: "الخميس",
    Friday: "الجمعة",
    Saturday: "السبت",
    Sunday: "الأحد",
    Mon: "الإثنين",
    Tue: "الثلاثاء",
    Wed: "الأربعاء",
    Thu: "الخميس",
    Fri: "الجمعة",
    Sat: "السبت",
    Sun: "الأحد",
    "Limits and derivatives": "النهايات والمشتقات",
    "Graphs + shortest path": "الرسوم البيانية وأقصر مسار",
    "Cell structure review": "مراجعة تركيب الخلية",
    "Essay drafting sprint": "جلسة مكثفة لكتابة المقال",
    "Finish revision pack": "إنهاء حزمة المراجعة",
    "Review key topics before the assessment":
      "مراجعة الموضوعات الأساسية قبل الاختبار",
    "Keep weekly study rhythm": "حافظ على وتيرة الدراسة الأسبوعية",
    "Reach 12 focused hours this week": "أنجز ١٢ ساعة تركيز هذا الأسبوع",
    "Submit essay draft": "تسليم مسودة المقال",
    "Complete the outline and first draft": "أكمل المخطط والمسودة الأولى",
    "A week in motion": "أسبوع من النشاط",
    "Studied seven days in a row": "الدراسة سبعة أيام متتالية",
    "Deep focus": "تركيز عميق",
    "Finished ten focus sessions": "إكمال عشر جلسات تركيز",
    "Exam ready": "جاهز للاختبار",
    "Score above 85% on a mock exam": "الحصول على أكثر من ٨٥٪ في اختبار تجريبي",
    "Goal keeper": "ملتزم بالأهداف",
    "Complete all weekly goals": "إكمال جميع أهداف الأسبوع",
    "Core theorem summary": "ملخص النظرية الأساسية",
    "Cell structure recall": "مراجعة تركيب الخلية",
    "Essay thesis points": "أفكار أطروحة المقال",
    "calculus-derivatives.pdf": "مشتقات-التفاضل.pdf",
    "algo-graphs-notes.md": "ملاحظات-الرسوم-البيانية.md",
    "biology-diagrams.png": "رسوم-الأحياء.png",
    "Good morning": "صباح الخير",
    "Good afternoon": "مرحبًا",
    "Good evening": "مساء الخير",
    "2 hours ago": "قبل ساعتين",
    Yesterday: "أمس",
    "Today ·": "اليوم ·",
    "Tomorrow ·": "غدًا ·",
    "Control which notifications you receive and how they are delivered.":
      "التحكم في الإشعارات التي تصلك وطريقة وصولها.",
    "Preview sound": "معاينة الصوت",
    Vibration: "الاهتزاز",
    "Vibrate on notifications": "الاهتزاز عند الإشعارات",
    "Enable vibration": "تفعيل الاهتزاز",
    "Default task reminder": "التذكير الافتراضي للمهام",
    "Default reminder for new tasks": "التذكير الافتراضي للمهام الجديدة",
    "At task start": "عند بدء المهمة",
    "30 minutes before": "قبل ٣٠ دقيقة",
    "Default all-day reminder time": "وقت التذكير الافتراضي لليوم الكامل",
    "Time to remind for all-day tasks":
      "وقت التذكير للمهام التي ليس لها وقت محدد",
    "Suppress notifications during these hours": "كتم الإشعارات خلال هذه الساعات",
    From: "من",
    To: "إلى",
  };
  // The runtime dictionaries are generated into locales.js from this object
  // plus the additive Android/offline strings. Merging keeps one central
  // source while still allowing the translation files to be edited directly.
  if (window.studyZoneLocales?.ar) {
    Object.assign(interfaceText, window.studyZoneLocales.ar);
  }
  const originalTextNodes = new WeakMap();
  const originalAttributes = new WeakMap();

  function translateUiText(value, { preserveNumeric = false } = {}) {
    const text = String(value ?? "");
    const trimmed = text.trim();
    if (!trimmed) return text;
    if (appLanguage === "ar") {
      const arabicQuantity = (value, forms) => {
        const number = Number(value);
        const form =
          number === 1
            ? forms.one
            : number === 2
              ? forms.two
              : number >= 3 && number <= 10
                ? forms.few
                : forms.many;
        return `${new Intl.NumberFormat("ar-EG").format(number)} ${form}`;
      };
      if (interfaceText[text]) return interfaceText[text];
      if (interfaceText[trimmed])
        return text.replace(trimmed, interfaceText[trimmed]);
      const iconButton = trimmed.match(/^([＋↑])\s*(.+)$/);
      if (iconButton && interfaceText[iconButton[2]]) {
        return text.replace(
          trimmed,
          `${iconButton[1]} ${interfaceText[iconButton[2]]}`,
        );
      }
      const greeting = trimmed.match(
        /^Good (morning|afternoon|evening), (.+)\.$/,
      );
      if (greeting)
        return text.replace(
          trimmed,
          `${interfaceText[`Good ${greeting[1]}`]}، ${greeting[2]}.`,
        );
      const chartTooltip = trimmed.match(
        /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun): ([\d.]+) hours?$/,
      );
      if (chartTooltip) {
        const day = interfaceText[chartTooltip[1]];
        const hours = new Intl.NumberFormat("ar-EG", {
          maximumFractionDigits: 1,
        }).format(Number(chartTooltip[2]));
        return text.replace(trimmed, `${day}: ${hours} ساعة`);
      }
      const hours = trimmed.match(/^([\d,.]+)h$/);
      if (hours)
        return text.replace(
          trimmed,
          `${new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 1 }).format(Number(hours[1].replace(",", "")))} س`,
        );
      const duration = trimmed.match(/^([\d,.]+) min$/);
      if (duration) {
        const number = Number(duration[1].replace(",", ""));
        return text.replace(
          trimmed,
          `${new Intl.NumberFormat("ar-EG").format(number)} ${number === 1 ? "دقيقة" : "دقيقة"}`,
        );
      }
      const timeDuration = trimmed.match(/^(\d{1,2}:\d{2}) · (\d+) min$/);
      if (timeDuration) {
        const time = timeDuration[1].replace(/\d/g, (digit) =>
          new Intl.NumberFormat("ar-EG").format(Number(digit)),
        );
        return text.replace(
          trimmed,
          `${time} · ${new Intl.NumberFormat("ar-EG").format(Number(timeDuration[2]))} دقيقة`,
        );
      }
      const xp = trimmed.match(/^(.*?)((?:[\d,.]+)) (sample )?XP$/);
      if (xp) {
        const points = new Intl.NumberFormat("ar-EG").format(
          Number(xp[2].replace(",", "")),
        );
        return text.replace(
          trimmed,
          `${xp[1]}${points} ${xp[3] ? "نقطة خبرة تجريبية" : "نقطة خبرة"}`,
        );
      }
      const daysLeft = trimmed.match(/^(\d+) DAYS LEFT$/);
      if (daysLeft)
        return text.replace(
          trimmed,
          `متبقي ${arabicQuantity(daysLeft[1], { one: "يوم واحد", two: "يومان", few: "أيام", many: "يوم" })}`,
        );
      const weeksLeft = trimmed.match(/^(\d+) WEEK LEFT$/);
      if (weeksLeft)
        return text.replace(
          trimmed,
          `متبقي ${arabicQuantity(weeksLeft[1], { one: "أسبوع واحد", two: "أسبوعان", few: "أسابيع", many: "أسبوع" })}`,
        );
      const shortWeeks = trimmed.match(/^(\d+) weeks?$/);
      if (shortWeeks)
        return text.replace(
          trimmed,
          `${new Intl.NumberFormat("ar-EG").format(Number(shortWeeks[1]))} ${Number(shortWeeks[1]) === 1 ? "أسبوع" : "أسابيع"}`,
        );
      const sampleXp = trimmed.match(/^([\d,.]+) sample XP$/);
      if (sampleXp)
        return text.replace(
          trimmed,
          `${new Intl.NumberFormat("ar-EG").format(Number(sampleXp[1].replace(",", "")))} نقطة خبرة تجريبية`,
        );
      const fileType = trimmed.match(/^(.+) · (PDF|Notes|Image)$/);
      if (fileType) {
        const type = { PDF: "PDF", Notes: "ملاحظات", Image: "صورة" }[
          fileType[2]
        ];
        return text.replace(trimmed, `${fileType[1]} · ${type}`);
      }
      const numeric = preserveNumeric
        ? null
        : trimmed.match(/^([+-]?\d[\d,.]*(?:\/\d[\d,.]*)?)(%)?$/);
      if (numeric) {
        const localized = numeric[1].replace(/\d/g, (digit) =>
          new Intl.NumberFormat("ar-EG").format(Number(digit)),
        );
        return text.replace(trimmed, `${localized}${numeric[2] ? "٪" : ""}`);
      }
      const relativeTime = trimmed.match(
        /^Updated (Today|Yesterday|\d+ hours? ago)$/,
      );
      if (relativeTime) {
        const value =
          relativeTime[1] === "Today"
            ? "اليوم"
            : relativeTime[1] === "Yesterday"
              ? "أمس"
              : relativeTime[1].replace(/^(\d+) hours? ago$/, (_, count) => {
                  const number = Number(count);
                  if (number === 1) return "قبل ساعة";
                  if (number === 2) return "قبل ساعتين";
                  return `قبل ${new Intl.NumberFormat("ar-EG").format(number)} ساعات`;
                });
        return text.replace(trimmed, `تم التحديث ${value}`);
      }
      const remainingShort = trimmed.match(/^(\d+) left ·$/);
      if (remainingShort)
        return text.replace(
          trimmed,
          `متبقي ${new Intl.NumberFormat("ar-EG").format(Number(remainingShort[1]))} ·`,
        );
      const shortDays = trimmed.match(/^(\d+) days?$/);
      if (shortDays)
        return text.replace(
          trimmed,
          arabicQuantity(shortDays[1], {
            one: "يوم واحد",
            two: "يومان",
            few: "أيام",
            many: "يوم",
          }),
        );
      const blockCount = trimmed.match(/^(\d+) blocks?$/);
      if (blockCount)
        return text.replace(
          trimmed,
          arabicQuantity(blockCount[1], {
            one: "جلسة واحدة",
            two: "جلستان",
            few: "جلسات",
            many: "جلسة",
          }),
        );
      const remainingTasks = trimmed.match(/^(\d+) tasks remaining$/);
      if (remainingTasks)
        return text.replace(
          trimmed,
          `${arabicQuantity(remainingTasks[1], { one: "مهمة", two: "مهمتان", few: "مهام", many: "مهمة" })} متبقية`,
        );
      const creditCount = trimmed.match(/^(\d+) credits$/);
      if (creditCount)
        return text.replace(
          trimmed,
          arabicQuantity(creditCount[1], {
            one: "ساعة معتمدة",
            two: "ساعتان معتمدتان",
            few: "ساعات معتمدة",
            many: "ساعة معتمدة",
          }),
        );
      const taskDays = trimmed.match(/^(\d+) days? left$/);
      if (taskDays)
        return text.replace(
          trimmed,
          `متبقي ${arabicQuantity(taskDays[1], { one: "يوم واحد", two: "يومان", few: "أيام", many: "يوم" })}`,
        );
      const level = trimmed.match(/^Level (\d+)$/);
      if (level)
        return text.replace(
          trimmed,
          `المستوى ${new Intl.NumberFormat("ar-EG").format(Number(level[1]))}`,
        );
      const signedIn = trimmed.match(/^Signed in as (.+)$/);
      if (signedIn)
        return text.replace(trimmed, `تم تسجيل الدخول باسم ${signedIn[1]}`);
      const languageSync = trimmed.match(
        /^Language saved on this device, but account sync failed:?\s*(.*)$/,
      );
      if (languageSync)
        return text.replace(
          trimmed,
          `تم حفظ اللغة على هذا الجهاز، لكن تعذرت مزامنتها مع الحساب.${languageSync[1] ? ` ${languageSync[1]}` : ""}`,
        );
      const signOutError = trimmed.match(/^Could not sign out:?\s*(.*)$/);
      if (signOutError)
        return text.replace(
          trimmed,
          `تعذّر تسجيل الخروج.${signOutError[1] ? ` ${signOutError[1]}` : ""}`,
        );
      const sessionError = trimmed.match(
        /^Could not restore session:?\s*(.*)$/,
      );
      if (sessionError)
        return text.replace(
          trimmed,
          `تعذّرت استعادة الجلسة.${sessionError[1] ? ` ${sessionError[1]}` : ""}`,
        );
      const updated = trimmed.match(/^Updated (.+)$/);
      if (updated) return text.replace(trimmed, `تم التحديث ${updated[1]}`);
      const after = trimmed.match(
        /^Could not (load|save|update|delete|restore) (.+?)(?::)?(.*)$/,
      );
      if (after) {
        const action = {
          load: "تحميل",
          save: "حفظ",
          update: "تحديث",
          delete: "حذف",
          restore: "استعادة",
        }[after[1]];
        const subject =
          {
            subjects: "المواد",
            tasks: "المهام",
            task: "المهمة",
            notifications: "الإشعارات",
            session: "الجلسة",
            "focus session": "جلسة التركيز",
            "focus settings": "إعدادات التركيز",
            "this task": "هذه المهمة",
            "the deadline": "الموعد",
          }[after[2].trim()] || after[2].trim();
        const detail = after[3] ? translateUiText(after[3]) : "";
        return text.replace(trimmed, `تعذّر ${action} ${subject}${detail}`);
      }
      const deleteTask = trimmed.match(/^Delete "(.+)"\?$/);
      if (deleteTask)
        return text.replace(trimmed, `هل تريد حذف "${deleteTask[1]}"؟`);
      const actionForTask = trimmed.match(/^(Complete|Reopen|Delete) (.+)$/);
      if (actionForTask) {
        const action = {
          Complete: "إنجاز",
          Reopen: "إعادة فتح",
          Delete: "حذف",
        }[actionForTask[1]];
        return text.replace(trimmed, `${action} ${actionForTask[2]}`);
      }
      return text;
    }
    return text;
  }

  function translateInterface() {
    document.documentElement.lang = appLanguage;
    document.documentElement.dir = appLanguage === "ar" ? "rtl" : "ltr";
    document.title =
      appLanguage === "ar"
        ? "Study Zone — حياتك الدراسية، منظمة"
        : "Study Zone — Your Study Life, Organized";
    const description = document.querySelector('meta[name="description"]');
    if (description)
      description.content =
        appLanguage === "ar"
          ? "Study Zone — حياتك الدراسية، منظمة."
          : "Study Zone — Your Study Life, Organized.";
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
    );
    let node;
    while ((node = walker.nextNode())) {
      if (node.parentElement?.closest("script,style,textarea,[data-sz-no-translate]"))
        continue;
      if (!originalTextNodes.has(node))
        originalTextNodes.set(node, node.nodeValue);
      const source = originalTextNodes.get(node);
      const preserveNumeric = Boolean(
        node.parentElement?.closest('[dir="auto"],[data-ltr]'),
      );
      node.nodeValue =
        appLanguage === "ar" && !node.parentElement?.closest("#flip-clock")
          ? translateUiText(source, { preserveNumeric })
          : source;
    }
    document
      .querySelectorAll(
        "input[placeholder],textarea[placeholder],[aria-label],[title]",
      )
      .forEach((element) => {
        if (element.closest("[data-sz-no-translate]")) return;
        if (!originalAttributes.has(element))
          originalAttributes.set(element, new Map());
        const originals = originalAttributes.get(element);
        for (const attribute of ["placeholder", "aria-label", "title"]) {
          if (!element.hasAttribute(attribute)) continue;
          if (!originals.has(attribute))
            originals.set(attribute, element.getAttribute(attribute));
          const source = originals.get(attribute);
          element.setAttribute(
            attribute,
            appLanguage === "ar" ? translateUiText(source) : source,
          );
        }
      });
    updatePwaInstallButton();
    refreshPwaInstructions();
  }

  function isStandaloneMode() {
    return (
      Boolean(window.matchMedia?.("(display-mode: standalone)").matches) ||
      window.navigator.standalone === true
    );
  }

  function isIosDevice() {
    const userAgentData = window.navigator.userAgentData;
    const platform = userAgentData?.platform || window.navigator.platform || "";
    const userAgent = window.navigator.userAgent || "";
    const touchPlatform = window.navigator.platform || "";
    const isAppleTouchDevice =
      Boolean(touchPlatform) &&
      /mac|iphone|ipad|ipod/i.test(String(touchPlatform)) &&
      (window.navigator.maxTouchPoints || 0) > 1;
    if (userAgentData?.platform)
      return /ios|iphone|ipad|ipod/i.test(String(userAgentData.platform));
    if (/iphone|ipad|ipod/i.test(userAgent)) return true;
    if (isAppleTouchDevice) return true;
    return false;
  }

  function isPwaInstalled() {
    return isStandaloneMode();
  }

  function getPwaInstallInstructions() {
    const userAgent = navigator.userAgent || "";
    const isIos = isIosDevice();
    const isSafari =
      /safari/i.test(userAgent) &&
      !/(chrome|crios|android|edg|opr|firefox|fxios)/i.test(userAgent);
    const isMacSafari = navigator.platform?.includes("Mac") && isSafari;
    if (appLanguage === "ar") {
      if (isIos)
        return "على iPhone أو iPad: افتح الصفحة في Safari، واضغط «مشاركة»، ثم اختر «إضافة إلى الشاشة الرئيسية». تختلف الخطوات حسب إصدار النظام.";
      if (isMacSafari)
        return "على Safari في Mac: من قائمة ملف اختر «إضافة إلى Dock». يعتمد ذلك على إصدار Safari وmacOS.";
      if (/android/i.test(userAgent))
        return "على Android: استخدم قائمة المتصفح واختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية» إذا ظهر الخيار. يختلف الدعم حسب المتصفح ومتطلباته.";
      return "استخدم قائمة المتصفح واختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية» إذا ظهر الخيار. تختلف إمكانية التثبيت حسب المتصفح والجهاز.";
    }
    if (isIos)
      return "On iPhone or iPad: open this page in Safari, tap Share, then choose Add to Home Screen. The exact steps vary by iOS version.";
    if (isMacSafari)
      return "In Safari on Mac, choose File > Add to Dock. Availability depends on your Safari and macOS versions.";
    if (/android/i.test(userAgent))
      return "On Android, open the browser menu and choose Install app or Add to Home screen if offered. Support varies by browser and its requirements.";
    return "Use your browser menu and choose Install app or Add to Home screen if offered. Installation options vary by browser and device.";
  }

  function getPwaInstallState() {
    if (pwaInstalled || isStandaloneMode()) return "installed";
    if (deferredInstallPrompt) return "available";
    if (isIosDevice()) return "instructions";
    const userAgent = navigator.userAgent || "";
    if (/firefox|fxios/i.test(userAgent)) return "instructions";
    return "available";
  }

  function updatePwaInstallButton() {
    const button = document.getElementById("pwa-install");
    if (!button) return;
    const state = getPwaInstallState();
    button.hidden = state === "installed";
    button.dataset.pwaState = state;
  }

  function updateOfflineStatus() {
    const status = document.getElementById("offline-status");
    if (status) status.hidden = navigator.onLine;
  }

  function refreshPwaInstructions() {
    const instructions = document.getElementById("pwa-install-instructions");
    const description = document.getElementById("pwa-install-description");
    if (description) {
      description.textContent =
        getPwaInstallState() === "installed"
          ? appLanguage === "ar"
            ? "Study Zone جاهز على هذا الجهاز الآن."
            : "Study Zone is ready on this device now."
          : appLanguage === "ar"
            ? "مساحة دراسة واحدة تنظّم مهمتك ومواعيدك وجلسات تركيزك."
            : "One calm workspace that keeps your tasks, deadlines, and focus sessions organized.";
    }
    if (instructions) instructions.textContent = getPwaInstallInstructions();
  }

  function showPwaUpdateNotice(worker) {
    if (!worker || document.querySelector(".pwa-update-toast")) return;
    pwaUpdateWorker = worker;
    const toast = document.createElement("div");
    toast.className = "toast pwa-update-toast";
    toast.setAttribute("role", "status");
    const message = document.createElement("span");
    message.textContent = "A new version is available.";
    const button = document.createElement("button");
    button.className = "text-button";
    button.type = "button";
    button.textContent = "Update now";
    button.addEventListener("click", () => {
      pwaUpdateReload = true;
      button.disabled = true;
      pwaUpdateWorker?.postMessage({ type: "SKIP_WAITING" });
    });
    toast.append(message, button);
    document.getElementById("toast-region").append(toast);
    translateInterface();
  }

  async function handlePwaInstall() {
    if (!deferredInstallPrompt) {
      refreshPwaInstructions();
      openModal(document.getElementById("pwa-install-modal"));
      return;
    }
    const prompt = deferredInstallPrompt;
    deferredInstallPrompt = null;
    updatePwaInstallButton();
    try {
      await prompt.prompt();
      const outcome = await prompt.userChoice;
      if (outcome?.outcome === "accepted") {
        pwaInstalled = true;
        updatePwaInstallButton();
        refreshPwaInstructions();
        showToast("App installed.");
      } else {
        deferredInstallPrompt = null;
        updatePwaInstallButton();
        refreshPwaInstructions();
      }
    } catch (error) {
      console.error("Could not start Study Zone installation.", error);
      showToast("Could not start installation.");
    }
  }

  function todayAt(hour, minute) {
    const date = new Date();
    date.setHours(hour, minute, 0, 0);
    return date.toISOString();
  }

  function tomorrowAt(hour) {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    date.setHours(hour, 0, 0, 0);
    return date.toISOString();
  }

  function dayAtOffset(days, hour) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    date.setHours(hour, 0, 0, 0);
    return date.toISOString();
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(
      /[&<>"']/g,
      (char) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[char],
    );
  }

  function readLocalTasks() {
    try {
      const saved = localStorage.getItem(storageKey);
      if (!saved) return seededTasks.map((task) => ({ ...task }));
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed))
        throw new Error("Stored task data is invalid.");
      return parsed;
    } catch (error) {
      console.error("Could not read saved tasks.", error);
      return seededTasks.map((task) => ({ ...task }));
    }
  }

  // ---- Media notes storage (IndexedDB, persistent local blobs) -------------
  const mediaDbName = "studyzone-media-v1";
  const mediaStoreName = "blobs";
  let mediaDbPromise = null;

  function openMediaDb() {
    if (mediaDbPromise) return mediaDbPromise;
    mediaDbPromise = new Promise((resolve, reject) => {
      if (!("indexedDB" in window)) {
        reject(new Error("IndexedDB unavailable"));
        return;
      }
      const req = indexedDB.open(mediaDbName, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(mediaStoreName)) {
          db.createObjectStore(mediaStoreName, { keyPath: "id" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error("Could not open media database"));
    });
    return mediaDbPromise;
  }

  async function putMediaBlob(id, blob, meta = {}) {
    const db = await openMediaDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(mediaStoreName, "readwrite");
      tx.objectStore(mediaStoreName).put({ id, blob, meta, updatedAt: Date.now() });
      tx.oncomplete = () => resolve(id);
      tx.onerror = () => reject(tx.error || new Error("Could not save media"));
    });
  }

  async function getMediaBlob(id) {
    if (!id) return null;
    try {
      const db = await openMediaDb();
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(mediaStoreName, "readonly");
        const req = tx.objectStore(mediaStoreName).get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error || new Error("Could not read media"));
      });
    } catch {
      return null;
    }
  }

  async function deleteMediaBlob(id) {
    if (!id) return;
    try {
      const db = await openMediaDb();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(mediaStoreName, "readwrite");
        tx.objectStore(mediaStoreName).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error || new Error("Could not delete media"));
      });
    } catch {
      /* ignore */
    }
  }

  const mediaObjectUrlCache = new Map();
  async function getMediaObjectUrl(id) {
    if (!id) return "";
    if (mediaObjectUrlCache.has(id)) return mediaObjectUrlCache.get(id);
    const record = await getMediaBlob(id);
    if (!record?.blob) return "";
    const url = URL.createObjectURL(record.blob);
    mediaObjectUrlCache.set(id, url);
    return url;
  }

  function revokeMediaObjectUrl(id) {
    if (!id || !mediaObjectUrlCache.has(id)) return;
    try { URL.revokeObjectURL(mediaObjectUrlCache.get(id)); } catch {}
    mediaObjectUrlCache.delete(id);
  }

  const MEDIA_NOTE_PREFIX = "__SZ_MEDIA_NOTE__:";
  const NOTE_MEDIA_BUCKET = "note-media";

  function isMediaNote(note) {
    return note?.type === "image" || note?.type === "video" || (Array.isArray(note?.attachments) && note.attachments.length > 0);
  }

  function noteAttachments(note) {
    return Array.isArray(note?.attachments) ? note.attachments : [];
  }

  function noteTypeOf(note) {
    if (note?.type === "voice") return "voice";
    if (note?.type === "image" || note?.type === "video") return note.type;
    const attachments = noteAttachments(note);
    if (attachments.length) return attachments.some((a) => a?.kind === "video") ? "video" : "image";
    return "text";
  }

  function serializeMediaNoteContent(note) {
    const prefix = "__SZ_MEDIA_NOTE__:";
    const bucket = "note-media";
    const payload = {
      v: 1,
      type: noteTypeOf(note),
      description: String(note?.description || ""),
      attachments: noteAttachments(note).map((a) => ({
        id: String(a?.id || a?.localKey || ""),
        kind: a?.kind === "video" ? "video" : "image",
        name: String(a?.name || ""),
        mime: String(a?.mime || ""),
        size: Number(a?.size) || 0,
        duration: Number(a?.duration) || 0,
        width: Number(a?.width) || 0,
        height: Number(a?.height) || 0,
        createdAt: a?.createdAt || null,
        localKey: String(a?.localKey || a?.id || ""),
        storagePath: String(a?.storagePath || ""),
        bucket: String(a?.bucket || bucket),
      })),
    };
    return prefix + JSON.stringify(payload);
  }

  function parseMediaNoteContent(content) {
    const prefix = "__SZ_MEDIA_NOTE__:";
    const raw = String(content || "");
    if (!raw.startsWith(prefix)) return null;
    try {
      const data = JSON.parse(raw.slice(prefix.length));
      if (!data || typeof data !== "object") return null;
      const attachments = Array.isArray(data.attachments) ? data.attachments : [];
      return {
        type: data.type === "image" || data.type === "video" ? data.type : (attachments.some((a) => a?.kind === "video") ? "video" : attachments.length ? "image" : "text"),
        description: typeof data.description === "string" ? data.description : "",
        attachments,
      };
    } catch {
      return null;
    }
  }

  function normalizeNoteRecord(note) {
    if (!note || typeof note !== "object") return note;
    const next = { ...note };
    const media = parseMediaNoteContent(next.content);
    if (media) {
      next.type = media.type;
      next.description = media.description;
      next.attachments = Array.isArray(media.attachments) ? media.attachments : [];
    } else {
      if (!Array.isArray(next.attachments)) next.attachments = [];
      next.type = next.type || (noteAttachments(next).length ? (noteAttachments(next).some((a) => a?.kind === "video") ? "video" : "image") : "text");
      if (typeof next.description !== "string") next.description = "";
    }
    return next;
  }

  function readLocalNotes() {
    try {
      const saved = localStorage.getItem(localNotesKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed.map(normalizeNoteRecord);
      }
    } catch (error) {
      console.error("Could not read saved notes.", error);
    }
    return sampleNotes.map((note, index) => normalizeNoteRecord({
      id: `local-note-${index + 1}`,
      title: note.title,
      content: `<p>${escapeHtml(
        note.title === "Core theorem summary"
          ? "A shortest path is only as good as the weights you give it. Revisit Dijkstra's assumptions before the next problem set."
          : note.title === "Cell structure recall"
            ? "Mitochondria: ATP production. Ribosomes: protein synthesis. Nucleus: stores genetic material."
            : "Thesis: progress in the discipline came from small, repeatable experiments rather than one big breakthrough.",
      )}</p>`,
      subject_id: "",
      subject: note.subject,
      is_favorite: index === 0,
      color: "",
      type: "text",
      attachments: [],
      description: "",
      created_at: new Date(Date.now() - index * 86400000).toISOString(),
      updated_at: new Date(Date.now() - index * 86400000).toISOString(),
    }));
  }

  function saveLocalNotes() {
    try {
      localStorage.setItem(localNotesKey, JSON.stringify(notes));
    } catch (error) {
      console.error("Could not save notes in this browser.", error);
    }
  }

  function saveLocalTasks() {
    localStorage.setItem(storageKey, JSON.stringify(tasks));
  }

  function initials(name) {
    return String(name || "Student")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0] || "")
      .join("")
      .toUpperCase();
  }

  function subjectName(id) {
    return (
      subjects.find((subject) => subject.id === id)?.name || "Independent study"
    );
  }

  function formatDue(value) {
    if (!value) return translateUiText("No due date");
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "No due date";
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const locale = appLanguage === "ar" ? "ar-EG" : "en";
    const prefix = isToday
      ? appLanguage === "ar"
        ? "اليوم"
        : "Today"
      : date.toDateString() === tomorrow.toDateString()
        ? appLanguage === "ar"
          ? "غدًا"
          : "Tomorrow"
        : date.toLocaleDateString(locale, {
            weekday: "short",
            month: "short",
            day: "numeric",
          });
    return `${prefix} · ${date.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" })}`;
  }

  function setConnectionState(text, connected) {
    const status = document.getElementById("connection-state");
    status.replaceChildren(
      document.createElement("i"),
      document.createTextNode(text),
    );
    status.classList.toggle("connected", Boolean(connected));
    translateInterface();
  }

  const modalCloseTimers = new WeakMap();

  function openModal(modal) {
    if (!modal) return;
    const pending = modalCloseTimers.get(modal);
    if (pending) {
      window.clearTimeout(pending);
      modalCloseTimers.delete(modal);
    }
    modal.classList.remove("modal-closing");
    modal.hidden = false;
  }

  function closeModal(modal) {
    if (!modal || modal.hidden || modal.classList.contains("modal-closing"))
      return;
    if (!shouldAnimate()) {
      modal.hidden = true;
      modal.classList.remove("modal-closing");
      return;
    }
    modal.classList.add("modal-closing");
    const timer = window.setTimeout(() => {
      modalCloseTimers.delete(modal);
      if (!modal.classList.contains("modal-closing")) return;
      modal.hidden = true;
      modal.classList.remove("modal-closing");
    }, 200);
    modalCloseTimers.set(modal, timer);
  }

  function dismissToast(toast) {
    if (!toast?.isConnected || toast.classList.contains("toast-leaving"))
      return;
    toast.classList.add("toast-leaving");
    const remove = () => toast.remove();
    if (!shouldAnimate()) {
      remove();
      return;
    }
    const animation = toast.animate(
      [
        { opacity: 1, transform: "translateY(0) scale(1)" },
        { opacity: 0, transform: "translateY(6px) scale(.98)" },
      ],
      {
        duration: motionLevel === "reduced" ? 120 : 200,
        easing: "cubic-bezier(.4,0,.6,1)",
        fill: "forwards",
      },
    );
    animation.finished.then(remove).catch(remove);
    window.setTimeout(remove, 260);
  }

  function showToast(message) {
    const region = document.getElementById("toast-region");
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    region.append(toast);
    translateInterface();
    window.setTimeout(() => dismissToast(toast), 3300);
  }

  function showRewardToast(amount) {
    if (amount <= 0) return;
    const region = document.getElementById("toast-region");
    const toast = document.createElement("div");
    toast.className = "toast reward-toast";
    const label = document.createElement("span");
    label.textContent =
      appLanguage === "ar" ? "مكافأة التقدم" : "Progress reward";
    const points = document.createElement("strong");
    points.dir = "ltr";
    points.textContent = `+${new Intl.NumberFormat(appLanguage === "ar" ? "ar-EG" : "en").format(amount)} XP`;
    toast.append(label, points);
    region.append(toast);
    window.setTimeout(() => dismissToast(toast), 4000);
    if (shouldAnimate())
      toast.animate(
        [
          { opacity: 0, transform: "translateY(8px) scale(.98)" },
          { opacity: 1, transform: "translateY(0) scale(1)" },
        ],
        {
          duration: motionLevel === "reduced" ? 150 : 260,
          easing: "cubic-bezier(.2,.7,.2,1)",
        },
      );
  }

  function openCelebration(
    title,
    description,
    amount = 0,
    isUserContent = false,
  ) {
    const modal = document.getElementById("celebration-modal");
    document.getElementById("celebration-title").textContent =
      translateUiText(title);
    document.getElementById("celebration-description").textContent =
      isUserContent ? description : translateUiText(description);
    const xp = document.getElementById("celebration-xp");
    xp.dir = "ltr";
    xp.hidden = amount <= 0;
    xp.textContent =
      amount > 0
        ? `+${new Intl.NumberFormat(appLanguage === "ar" ? "ar-EG" : "en").format(amount)} XP`
        : "";
    openModal(modal);
    if (shouldAnimate()) {
      const offset = motionLevel === "reduced" ? 4 : 14;
      const scale = motionLevel === "reduced" ? 0.99 : 0.96;
      modal.querySelector(".celebration-modal").animate(
        [
          { opacity: 0, transform: `translateY(${offset}px) scale(${scale})` },
          { opacity: 1, transform: "translateY(0) scale(1)" },
        ],
        {
          duration: motionLevel === "reduced" ? 160 : 320,
          easing: "cubic-bezier(.2,.7,.2,1)",
        },
      );
      if (shouldUseFullMotion()) launchConfetti();
    }
  }

  function rewardCounterMarkup(key, value) {
    const number = Math.max(0, Math.floor(Number(value) || 0));
    return `<span data-reward-counter="${key}" data-counter-value="${number}">${new Intl.NumberFormat(appLanguage === "ar" ? "ar-EG" : "en").format(number)}</span>`;
  }

  function animateRewardCounters() {
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    document.querySelectorAll("[data-reward-counter]").forEach((counter) => {
      const key = counter.dataset.rewardCounter;
      const target = Number(counter.dataset.counterValue);
      const previous = rewardCounterValues.get(key);
      rewardCounterValues.set(key, target);
      if (
        !Number.isFinite(target) ||
        previous === target ||
        !shouldAnimate() ||
        reduceMotion
      )
        return;
      const startValue = previous ?? 0;
      const start = performance.now();
      const duration = motionLevel === "reduced" ? 180 : 420;
      const update = (now) => {
        const progress = Math.min(1, (now - start) / duration);
        const eased = 1 - (1 - progress) ** 3;
        const value = Math.round(startValue + (target - startValue) * eased);
        counter.textContent = new Intl.NumberFormat(
          appLanguage === "ar" ? "ar-EG" : "en",
        ).format(value);
        if (progress < 1) requestAnimationFrame(update);
      };
      requestAnimationFrame(update);
    });
  }

  function launchConfetti() {
    if (!shouldUseFullMotion()) return;
    const layer = document.createElement("div");
    layer.className = "celebration-particles";
    layer.setAttribute("aria-hidden", "true");
    const colors = [
      getThemeColor("--color-primary", "#6b7280"),
      getThemeColor("--color-text", "#f3f4f6"),
      getThemeColor("--color-secondary", "#d1d5db"),
    ];
    for (let index = 0; index < 24; index += 1) {
      const particle = document.createElement("i");
      particle.style.setProperty(
        "--particle-x",
        `${Math.round(Math.random() * 100)}vw`,
      );
      particle.style.setProperty(
        "--particle-y",
        `${Math.round(20 + Math.random() * 60)}vh`,
      );
      particle.style.setProperty(
        "--particle-delay",
        `${Math.random() * 180}ms`,
      );
      particle.style.setProperty(
        "--particle-color",
        colors[index % colors.length],
      );
      layer.append(particle);
    }
    document.body.append(layer);
    window.setTimeout(() => layer.remove(), 1500);
  }

  async function refreshRewardSummary({
    celebrate = false,
    previous = rewardSummary,
  } = {}) {
    if (!supabase || !session) {
      rewardSummary = null;
      earnedAchievements = [];
      return null;
    }
    const [summaryResult, achievementsResult] = await Promise.all([
      supabase
        .from("user_xp")
        .select("total_xp,level,current_streak,best_streak")
        .eq("user_id", session.user.id)
        .maybeSingle(),
      supabase
        .from("user_achievements")
        .select("earned_at,achievements(code,name,description,xp_reward)")
        .eq("user_id", session.user.id)
        .order("earned_at", { ascending: false }),
    ]);
    if (summaryResult.error || achievementsResult.error) {
      const error = summaryResult.error || achievementsResult.error;
      console.error(
        "Could not load Study Zone rewards. Apply the secure study rewards migration if it has not been applied.",
        error,
      );
      rewardSummary = null;
      earnedAchievements = [];
      updateStreakSidebar();
      if (session)
        showToast("Rewards load after applying the latest Supabase migration.");
      return null;
    }
    const oldSummary = previous;
    const oldCodes = new Set(
      earnedAchievements.map((item) => item.achievements?.code).filter(Boolean),
    );
    rewardSummary = summaryResult.data || {
      total_xp: 0,
      level: 1,
      current_streak: 0,
      best_streak: 0,
    };
    earnedAchievements = achievementsResult.data || [];
    updateStreakSidebar(
      Boolean(
        oldSummary &&
        Number(rewardSummary.current_streak) >
          Number(oldSummary.current_streak),
      ),
    );

    if (celebrate && oldSummary) {
      const xpGained = Math.max(
        0,
        Number(rewardSummary.total_xp) - Number(oldSummary.total_xp),
      );
      showRewardToast(xpGained);
      if (Number(rewardSummary.level) > Number(oldSummary.level)) {
        openCelebration(
          "Level up!",
          "You've reached a new study milestone.",
          xpGained,
        );
      } else {
        const newAchievement = earnedAchievements.find(
          (item) => !oldCodes.has(item.achievements?.code),
        );
        if (newAchievement?.achievements) {
          openCelebration(
            newAchievement.achievements.name || "Achievement unlocked!",
            newAchievement.achievements.description ||
              "Your progress is adding up.",
            Number(newAchievement.achievements.xp_reward) || 0,
          );
        } else if (xpGained > 0) {
          const newStreak = Number(rewardSummary.current_streak);
          const oldStreak = Number(oldSummary.current_streak);
          if (
            [7, 14, 30, 100].some(
              (milestone) => oldStreak < milestone && newStreak >= milestone,
            )
          ) {
            openCelebration(
              "Study Streak",
              "You're building a great study streak!",
            );
          }
        }
      }
    }
    if (["dashboard", "profile", "achievements"].includes(currentPage))
      scheduleRender();
    return rewardSummary;
  }

  async function animateCompletionCard(card) {
    if (!card || !shouldAnimate()) return;
    card.classList.add("is-completing");
    await new Promise((resolve) => window.setTimeout(resolve, 220));
  }

  function updateStreakSidebar(animate = false) {
    const element = document.getElementById("study-streak-value");
    if (!element) return;
    if (!rewardSummary) {
      element.textContent = "—";
      return;
    }
    const count = Number(rewardSummary.current_streak);
    const dayLabel =
      appLanguage === "ar"
        ? count === 1
          ? "يوم"
          : count === 2
            ? "يومان"
            : "أيام"
        : count === 1
          ? "day"
          : "days";
    element.textContent = `${new Intl.NumberFormat(appLanguage === "ar" ? "ar-EG" : "en").format(count)} ${dayLabel}`;
    if (animate && shouldAnimate()) {
      element.animate(
        [
          { transform: "scale(.86)", color: "var(--secondary)" },
          { transform: "scale(1.12)", color: "var(--accent)" },
          { transform: "scale(1)", color: "var(--polar)" },
        ],
        { duration: 360, easing: "cubic-bezier(.2,.7,.2,1)" },
      );
    }
  }

  function pageHeading(eyebrow, title, subtitle, action = "") {
    return `<div class="page-heading"><div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1><p class="page-subtitle">${subtitle}</p></div>${action}</div>`;
  }

  function panelHeading(title, subtitle = "", action = "") {
    return `<div class="panel-heading"><div><h2>${title}</h2>${subtitle ? `<p>${subtitle}</p>` : ""}</div>${action}</div>`;
  }

  function statCard(label, value, note, symbol, positive = "") {
    return `<article class="stat-card"><div class="stat-top"><span class="stat-label">${label}</span><span class="stat-icon">${symbol}</span></div><div class="stat-value">${value}</div><div class="stat-foot"><span class="positive">${positive}</span>${note}</div></article>`;
  }

  function lineChart(chartActivity = activity) {
    const width = 620;
    const height = 190;
    const left = 25;
    const right = 12;
    const top = 14;
    const bottom = 25;
    const max = Math.max(
      6,
      Math.ceil(Math.max(0, ...chartActivity.map((item) => item.hours)) / 2) *
        2,
    );
    const plotWidth = width - left - right;
    const plotHeight = height - top - bottom;
    const localizedActivity =
      appLanguage === "ar"
        ? ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) =>
            chartActivity.find((item) => item.day === day),
          )
        : chartActivity;
    const points = localizedActivity.filter(Boolean).map((item, index) => ({
      x:
        appLanguage === "ar"
          ? width - right - (plotWidth * index) / (localizedActivity.length - 1)
          : left + (plotWidth * index) / (localizedActivity.length - 1),
      y: top + plotHeight * (1 - item.hours / max),
      ...item,
    }));
    const line = points
      .map((point, index) => `${index ? "L" : "M"}${point.x},${point.y}`)
      .join(" ");
    const areaPath = `${line} L${points.at(-1).x},${top + plotHeight} L${points[0].x},${top + plotHeight} Z`;
    const yLines = [0, 2, 4, 6]
      .map((value) => {
        const y = top + plotHeight * (1 - value / max);
        const localizedValue = new Intl.NumberFormat(
          appLanguage === "ar" ? "ar-EG" : "en",
        ).format(value);
        return `<line class="chart-gridline" x1="${left}" x2="${width - right}" y1="${y}" y2="${y}"/><text class="chart-label" x="${appLanguage === "ar" ? width - 18 : 0}" text-anchor="${appLanguage === "ar" ? "end" : "start"}" y="${y + 3}">${localizedValue}${appLanguage === "ar" ? "س" : "h"}</text>`;
      })
      .join("");
    const dots = points
      .map((point) => {
        const day = appLanguage === "ar" ? interfaceText[point.day] : point.day;
        const hours = new Intl.NumberFormat(
          appLanguage === "ar" ? "ar-EG" : "en",
          { maximumFractionDigits: 1 },
        ).format(point.hours);
        return `<circle class="chart-dot" cx="${point.x}" cy="${point.y}" r="3.5"><title>${day}: ${hours} ${appLanguage === "ar" ? "ساعة" : "hours"}</title></circle>`;
      })
      .join("");
    const labels = points
      .map(
        (point) =>
          `<text class="chart-label" text-anchor="middle" x="${point.x}" y="${height - 4}">${appLanguage === "ar" ? interfaceText[point.day] : point.day}</text>`,
      )
      .join("");
    const ariaLabel =
      appLanguage === "ar"
        ? "ساعات الدراسة خلال الأيام السبعة الماضية"
        : session
          ? "Verified focus time over the last seven days"
          : "Sample study hours over the last seven days";
    const themePrimary = getThemeColor("--color-primary", "#6b7280");
    return `<div class="chart-area"><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${ariaLabel}"><defs><linearGradient id="chart-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="${themePrimary}" stop-opacity=".21"/><stop offset="100%" stop-color="${themePrimary}" stop-opacity="0"/></linearGradient></defs>${yLines}<path class="chart-area-fill" d="${areaPath}"/><path class="chart-line" pathLength="1" d="${line}"/>${dots}${labels}</svg></div>`;
  }

  function dashboardPage() {
    const tr = (english, arabic) => (appLanguage === "ar" ? arabic : english);
    const locale = appLanguage === "ar" ? "ar-EG" : "en";
    const formattedNumber = (value) =>
      new Intl.NumberFormat(locale).format(Number(value) || 0);
    const clampPercent = (value) =>
      Math.min(100, Math.max(0, Math.round(Number(value) || 0)));
    const tickClass = (value) =>
      value >= 100
        ? "is-complete"
        : value >= 60
          ? "is-high"
          : value >= 30
            ? "is-mid"
            : "is-low";
    const todayKey = dateKey(new Date());
    const todayAll = tasksForDay(todayKey);
    const openTasks = tasks.filter((task) => task.status !== "completed");
    const overdueTasks = openTasks
      .filter((task) => {
        const endKey = taskEndKey(task);
        return endKey && endKey < todayKey;
      })
      .sort(taskSort);
    const overdueIds = new Set(overdueTasks.map((task) => task.id));
    const todayTasks = todayAll
      .filter(
        (task) => task.status !== "completed" && !overdueIds.has(task.id),
      )
      .sort(taskSort);
    const completedToday = todayAll.filter(
      (task) => task.status === "completed",
    );
    const totalToday = todayTasks.length + completedToday.length;
    const progress = totalToday
      ? Math.round((completedToday.length / totalToday) * 100)
      : 0;
    const firstName = (
      accountProfile?.display_name ||
      session?.user?.user_metadata?.full_name ||
      (session ? "there" : "Student")
    )
      .trim()
      .split(/\s+/)[0];
    const hour = new Date().getHours();
    const greeting =
      appLanguage === "ar"
        ? hour < 12
          ? "صباح الخير"
          : hour < 18
            ? "مرحبًا"
            : "مساء الخير"
        : hour < 12
          ? "Good morning"
          : hour < 18
            ? "Good afternoon"
            : "Good evening";
    const dayLabelText = new Intl.DateTimeFormat(locale, {
      weekday: "long",
      month: "long",
      day: "numeric",
    }).format(new Date());
    const focusStats = getFocusStats();
    const focusMinutes = Math.floor(focusStats.todaySeconds / 60);
    const focusWeekHours = (focusStats.weekSeconds / 3600).toFixed(1);
    const focusTargetPercent = clampPercent((focusMinutes / 120) * 100);
    const nextDeadline = tasks
      .filter(
        (task) =>
          task.status !== "completed" &&
          task.due_at &&
          new Date(task.due_at) > new Date(),
      )
      .sort((a, b) => new Date(a.due_at) - new Date(b.due_at))[0];

    const heroQuotes =
      appLanguage === "ar"
        ? [
            "خطوات صغيرة تتكرر كل يوم تصنع زخمًا حقيقيًا.",
            "ركّز على الصفحة التالية، لا على الكتاب كله.",
            "الخطة الهادئة أفضل من الخطة المزدحمة.",
          ]
        : [
            "Small steps, repeated daily, become real momentum.",
            "Focus on the next page, not the whole book.",
            "A calm plan beats a crowded one.",
          ];
    const heroQuote = heroQuotes[new Date().getDate() % heroQuotes.length];
    const streakValue =
      Number(rewardSummary?.current_streak) || focusStats.streak || 0;

    const statBlock = ({
      tone,
      icon,
      label,
      value,
      note,
      trend = "",
      percent = null,
    }) => `<article class="sz-stat ${tone}">
      <div class="sz-stat-head"><span class="sz-icon-tile">${icon}</span>${trend ? `<span class="sz-stat-trend">${trend}</span>` : ""}</div>
      <p class="sz-stat-label">${label}</p>
      <p class="sz-stat-value">${value}</p>
      <p class="sz-stat-note">${note}</p>
      ${
        percent == null
          ? ""
          : `<div class="sz-track ${tickClass(percent)}"><span style="width:${clampPercent(percent)}%"></span></div>`
      }
    </article>`;

    const statGrid = `<div class="sz-stat-grid">
      ${statBlock({
        tone: "tone-blue",
        icon: "✓",
        label: tr("TODAY'S TASKS", "مهام اليوم"),
        value: `${formattedNumber(completedToday.length)}<small>/${formattedNumber(totalToday)}</small>`,
        note: totalToday
          ? tr(
              `${progress}% of today is complete`,
              `${progress}% من اليوم مكتمل`,
            )
          : tr("Add your first task for today", "أضف أول مهمة لليوم"),
        trend: `${progress}%`,
        percent: progress,
      })}
      ${statBlock({
        tone: "tone-orange",
        icon: "!",
        label: tr("OVERDUE", "متأخرة"),
        value: formattedNumber(overdueTasks.length),
        note: overdueTasks.length
          ? tr("Needs a little attention", "تحتاج بعض الاهتمام")
          : tr("All clear — nicely done", "كل شيء واضح — أحسنت"),
        trend: overdueTasks.length ? tr("open", "مفتوحة") : tr("clear", "واضح"),
      })}
      ${statBlock({
        tone: "tone-purple",
        icon: "◷",
        label: tr("FOCUS TODAY", "تركيز اليوم"),
        value: `${formattedNumber(focusMinutes)}<small> min</small>`,
        note: `${formattedNumber(focusStats.todaySessions)} ${tr("sessions completed", "جلسات مكتملة")}`,
        trend: `${focusWeekHours}h ${tr("this week", "هذا الأسبوع")}`,
        percent: focusTargetPercent,
      })}
      ${statBlock({
        tone: "tone-green",
        icon: "↗",
        label: tr("STUDY STREAK", "سلسلة الدراسة"),
        value: `${formattedNumber(streakValue)}<small> ${tr("days", "يوم")}</small>`,
        note: rewardSummary
          ? `${tr("Level", "المستوى")} ${formattedNumber(Number(rewardSummary.level) || 1)} · ${tr("Keep it alive", "حافظ عليها")}`
          : tr("Sign in to track verified days", "سجّل الدخول لتتبع أيامك"),
        trend: streakValue ? tr("on fire", "متواصل") : tr("start", "ابدأ"),
      })}
    </div>`;

    const nextTone = nextDeadline
      ? getDeadlineStatus(nextDeadline) === "overdue"
        ? "tone-orange"
        : "tone-cyan"
      : "tone-slate";
    const hero = `<section class="sz-hero">
      <div class="sz-hero-media"><img src="./assets/images/hero-study-desk.webp" alt="" loading="eager" decoding="async" fetchpriority="high" onerror="this.remove()" /></div>
      <div class="sz-hero-content">
        <div class="sz-hero-top">
          <span class="sz-hero-badge"><i></i>${escapeHtml(dayLabelText)}</span>
          <span class="sz-hero-badge">✦ ${tr("Your study life, organized", "حياتك الدراسية، منظمة")}</span>
        </div>
        <p class="sz-hero-kicker">${tr("WELCOME BACK", "أهلًا بعودتك")}</p>
        <h1>${escapeHtml(greeting)},<br /><span>${escapeHtml(firstName)}.</span></h1>
        <p class="sz-hero-quote">${escapeHtml(heroQuote)}</p>
        <div class="sz-hero-meta">
          <span class="sz-hero-chip tone-cyan"><i></i><b>${formattedNumber(todayTasks.length)}</b> ${tr("open today", "مفتوحة اليوم")}</span>
          <span class="sz-hero-chip tone-purple"><i></i><b>${formattedNumber(focusMinutes)}</b> ${tr("focus minutes", "دقائق تركيز")}</span>
          <span class="sz-hero-chip ${nextTone}"><i></i><b>${nextDeadline ? escapeHtml(taskDueLabel(nextDeadline, { includeDate: true })) : tr("No deadline", "لا موعد")}</b> ${nextDeadline ? escapeHtml(nextDeadline.title) : tr("a clear runway", "طريق واضح")}</span>
        </div>
        <div class="sz-hero-actions">
          <button class="button button-primary" data-action="new-task" data-date="${todayKey}">＋ ${tr("New task", "مهمة جديدة")}</button>
          <button class="button button-secondary" data-navigate="focus">◷ ${tr("Start focus", "ابدأ التركيز")}</button>
        </div>
      </div>
      <div class="sz-hero-side">
        <div class="sz-hero-progress">
          <div class="sz-ring" style="--sz-p:${progress}"><div class="sz-ring-inner"><strong>${progress}%</strong><small>${tr("done", "مكتمل")}</small></div></div>
          <div class="sz-hero-progress-copy"><strong>${tr("Today's momentum", "زخم اليوم")}</strong><small>${completedToday.length} ${tr("of", "من")} ${totalToday} ${tr("tasks complete", "مهمة مكتملة")}</small></div>
          <div class="sz-hero-progress-meta"><span>${tr("Study streak", "سلسلة الدراسة")}</span><b>${streakValue} ${tr("days", "يوم")}</b></div>
        </div>
      </div>
    </section>`;

    const dashMonth =
      dashboardMonth instanceof Date && !Number.isNaN(dashboardMonth.getTime())
        ? dashboardMonth
        : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const dashMonthStart = new Date(
      dashMonth.getFullYear(),
      dashMonth.getMonth(),
      1,
    );
    const eventsByKey = new Map();
    getDeadlines().forEach((deadline) => {
      const range = deadlineDateRange(deadline);
      const startDate = parseLocalDateKey(range.start);
      const endDate = parseLocalDateKey(range.end);
      if (!startDate || !endDate) return;
      const cursor = new Date(startDate);
      let guard = 0;
      while (cursor <= endDate && guard < 370) {
        const key = dateKey(cursor);
        const list = eventsByKey.get(key) || [];
        if (!list.some((item) => item.id === deadline.id)) list.push(deadline);
        eventsByKey.set(key, list);
        cursor.setDate(cursor.getDate() + 1);
        guard += 1;
      }
    });
    const toneForDeadline = (deadline) => {
      if (deadline.status === "completed") return "tone-done";
      if (getDeadlineStatus(deadline) === "overdue") return "tone-overdue";
      if (deadline.priority === "high") return "tone-red";
      if (deadline.priority === "low") return "tone-slate";
      return "tone-blue";
    };
    const startOffset = dashMonthStart.getDay();
    const daysInDashMonth = new Date(
      dashMonthStart.getFullYear(),
      dashMonthStart.getMonth() + 1,
      0,
    ).getDate();
    const dashCellCount =
      Math.ceil((startOffset + daysInDashMonth) / 7) * 7;
    const gridStart = new Date(dashMonthStart);
    gridStart.setDate(dashMonthStart.getDate() - startOffset);
    const calendarDays = Array.from({ length: dashCellCount }, (_, index) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + index);
      const key = dateKey(date);
      const dayEvents = eventsByKey.get(key) || [];
      const classes = ["sz-cal-day"];
      if (date.getMonth() !== dashMonthStart.getMonth())
        classes.push("is-outside");
      if (key === todayKey) classes.push("is-today");
      if (key === dashboardSelectedDate) classes.push("is-selected");
      if (date.getDay() === 0 || date.getDay() === 6)
        classes.push("is-weekend");
      const eventMarkup = dayEvents
        .slice(0, 2)
        .map(
          (deadline) =>
            `<span class="sz-cal-event ${toneForDeadline(deadline)}"><i></i>${escapeHtml(deadline.title)}</span>`,
        )
        .join("");
      const dotMarkup = dayEvents
        .slice(0, 4)
        .map((deadline) => `<i class="${toneForDeadline(deadline)}"></i>`)
        .join("");
      return `<button type="button" class="${classes.join(" ")}" data-action="dash-cal-select" data-date="${key}" aria-pressed="${key === dashboardSelectedDate}" aria-label="${escapeHtml(new Intl.DateTimeFormat(locale, { dateStyle: "full" }).format(date))}"><span class="sz-cal-num">${new Intl.NumberFormat(locale).format(date.getDate())}</span><span class="sz-cal-events">${eventMarkup}${dayEvents.length > 2 ? `<span class="sz-cal-more">+${dayEvents.length - 2}</span>` : ""}</span><span class="sz-cal-dots">${dotMarkup}</span></button>`;
    }).join("");
    const selectedDateObject =
      parseLocalDateKey(dashboardSelectedDate) || new Date();
    const selectedLabel = new Intl.DateTimeFormat(locale, {
      weekday: "long",
      month: "short",
      day: "numeric",
    }).format(selectedDateObject);
    const selectedDayTasks = tasksForDay(dashboardSelectedDate).sort(taskSort);
    const agendaMarkup = selectedDayTasks
      .slice(0, 4)
      .map((task) => {
        const done = task.status === "completed";
        const overdue =
          !done &&
          taskEndKey(task) &&
          taskEndKey(task) < dateKey(new Date());
        const tone = done
          ? "tone-done"
          : overdue
            ? "tone-overdue"
            : task.priority === "high"
              ? "tone-red"
              : task.routine_id
                ? "tone-purple"
                : "tone-blue";
        return `<button type="button" class="sz-agenda-item ${done ? "is-done" : ""} ${overdue ? "is-overdue" : ""}" data-action="${task.routine_id ? "routine-edit" : "task-edit"}" data-id="${escapeHtml(task.routine_id || task.id)}"><span class="sz-agenda-dot ${tone}"></span><span class="sz-agenda-copy"><strong dir="auto">${escapeHtml(task.title)}</strong><small dir="auto">${escapeHtml(task.subject || subjectName(task.subject_id) || tr("Task", "مهمة"))}${task.routine_id ? " · ↻" : ""}</small></span><time>${escapeHtml(taskDueLabel(task))}</time></button>`;
      })
      .join("");
    const monthLabel = new Intl.DateTimeFormat(locale, {
      month: "long",
      year: "numeric",
    }).format(dashMonthStart);
    const weekdayLabels = deadlineText[appLanguage].daysShort
      .map((day) => `<span>${day}</span>`)
      .join("");
    const calendarPanel = `<section class="sz-card sz-dash-calendar">
      <div class="sz-cal-head">
        <div class="sz-cal-title"><p class="sz-kicker">${tr("PLAN THE MONTH", "خطّط للشهر")}</p><h2 id="dashboard-calendar-month">${escapeHtml(monthLabel)}</h2><p>${tr("Select a day to see its agenda", "اختر يومًا لعرض أجندته")}</p></div>
        <div class="sz-cal-nav"><button type="button" class="sz-today" data-action="dash-cal-today">${tr("Today", "اليوم")}</button><button type="button" class="icon-button" data-action="dash-cal-prev" aria-label="${tr("Previous month", "الشهر السابق")}">‹</button><button type="button" class="icon-button" data-action="dash-cal-next" aria-label="${tr("Next month", "الشهر التالي")}">›</button></div>
      </div>
      <div class="sz-cal-weekdays">${weekdayLabels}</div>
      <div class="sz-cal-grid">${calendarDays}</div>
      <div class="sz-cal-legend"><span class="tone-red"><i></i>${tr("High", "عالية")}</span><span class="tone-blue"><i></i>${tr("Medium", "متوسطة")}</span><span class="tone-slate"><i></i>${tr("Low", "منخفضة")}</span><span class="tone-done"><i></i>${tr("Completed", "مكتملة")}</span></div>
      <div class="sz-cal-agenda">
        <div class="sz-cal-agenda-head"><strong>${escapeHtml(selectedLabel)}</strong><small>${formattedNumber(selectedDayTasks.length)} ${tr(selectedDayTasks.length === 1 ? "item" : "items", "عنصر")}</small></div>
        <div class="sz-agenda-list">${agendaMarkup || `<div class="sz-empty" style="padding:18px"><strong>${tr("Nothing scheduled", "لا يوجد شيء مجدول")}</strong><p>${tr("A quiet day is still a good day.", "اليوم الهادئ يوم جيد أيضًا.")}</p></div>`}</div>
      </div>
    </section>`;

    const taskRowForDashboard = (task) => {
      const done = task.status === "completed";
      const overdue = overdueIds.has(task.id);
      const subject = task.subject || subjectName(task.subject_id);
      return `<div class="sz-task ${done ? "is-done" : ""} ${overdue ? "is-overdue" : ""}">
        <button type="button" class="sz-task-check ${done ? "is-checked" : ""}" data-action="toggle-task" data-id="${escapeHtml(task.id)}" aria-label="${done ? tr("Reopen", "إعادة فتح") : tr("Complete", "إكمال")} ${escapeHtml(task.title)}">${done ? "✓" : ""}</button>
        <button type="button" class="sz-task-main" data-action="${task.routine_id ? "routine-edit" : "task-edit"}" data-id="${escapeHtml(task.routine_id || task.id)}">
          <strong dir="auto">${escapeHtml(task.title)}${task.routine_id ? " ↻" : ""}</strong>
          <small dir="auto">${escapeHtml(subject || tr("Task", "مهمة"))} · ${escapeHtml(taskDueLabel(task))}</small>
        </button>
        <div class="sz-task-badges"><span class="priority ${escapeHtml(task.priority || "medium")}">${escapeHtml(deadlineText[appLanguage][task.priority] || task.priority || "medium")}</span></div>
      </div>`;
    };
    const todaysList = todayTasks.slice(0, 5).map(taskRowForDashboard).join("");
    const overdueList = overdueTasks
      .slice(0, 3)
      .map(taskRowForDashboard)
      .join("");
    const tasksPanel = `<section class="sz-card">
      <div class="sz-card-head"><div><p class="sz-kicker">${tr("TODAY'S FOCUS", "تركيز اليوم")}</p><h2>${tr("Today's tasks", "مهام اليوم")}</h2><p>${todayTasks.length} ${tr("open", "مفتوحة")} · ${completedToday.length} ${tr("done", "مكتملة")}</p></div><button class="panel-link" data-navigate="tasks">${tr("All tasks →", "كل المهام ←")}</button></div>
      <div class="sz-progress" style="margin-bottom:14px"><div class="sz-progress-line"><span>${tr("Daily progress", "تقدم اليوم")}</span><strong>${progress}%</strong></div><div class="sz-track ${tickClass(progress)}"><span style="width:${progress}%"></span></div></div>
      <div class="sz-task-list">${todaysList || `<div class="sz-empty"><span class="sz-empty-icon">✓</span><strong>${tr("Nothing due today", "لا مهام لليوم")}</strong><p>${tr("Add a task or clear your overdue list.", "أضف مهمة أو راجع المهام المتأخرة.")}</p></div>`}</div>
      ${overdueList ? `<div class="sz-task-group-label">${tr("Overdue", "متأخرة")} · ${formattedNumber(overdueTasks.length)}</div><div class="sz-task-list">${overdueList}</div>` : ""}
      <div class="sz-quick-actions">
        <button type="button" class="sz-quick-action tone-blue" data-action="new-task" data-date="${todayKey}"><i>＋</i>${tr("Task", "مهمة")}</button>
        <button type="button" class="sz-quick-action tone-amber" data-action="note-add"><i>✎</i>${tr("Note", "ملاحظة")}</button>
        <button type="button" class="sz-quick-action tone-purple" data-navigate="focus"><i>◷</i>${tr("Focus", "تركيز")}</button>
        <button type="button" class="sz-quick-action tone-cyan" data-navigate="tasks"><i>▦</i>${tr("Calendar", "التقويم")}</button>
      </div>
    </section>`;

    const focusMax = Math.max(
      1,
      ...focusStats.days.map((day) => Number(day.seconds) || 0),
    );
    const focusBars = focusStats.days
      .map((day) => {
        const height = Math.max(
          3,
          Math.round(((Number(day.seconds) || 0) / focusMax) * 100),
        );
        return `<div title="${escapeHtml(new Intl.DateTimeFormat(locale, { weekday: "short" }).format(day.date))}: ${Math.round(Number(day.seconds || 0) / 60)} min"><span style="height:${height}%"></span></div>`;
      })
      .join("");
    const focusCard = `<section class="sz-card sz-focus-card">
      <div class="sz-focus-top"><div><p class="sz-kicker">${tr("DEEP WORK", "عمل عميق")}</p><h2>${tr("Focus today", "تركيز اليوم")}</h2></div><span class="sz-pill tone-purple"><i></i>${focusStats.streak} ${tr("day streak", "يوم متتالي")}</span></div>
      <div class="sz-focus-main">
        <div class="sz-ring sz-ring-sm" style="--sz-p:${focusTargetPercent}"><div class="sz-ring-inner"><strong>${focusMinutes}</strong><small>min</small></div></div>
        <div class="sz-focus-copy"><strong>${formattedNumber(focusStats.todaySessions)}<small> ${tr("sessions", "جلسات")}</small></strong><span>${tr("A 120-minute daily target", "هدف يومي 120 دقيقة")}</span></div>
      </div>
      <div class="sz-focus-bars">${focusBars}</div>
      <div class="sz-focus-stats"><div><strong>${focusWeekHours}h</strong><small>${tr("This week", "هذا الأسبوع")}</small></div><div><strong>${formattedNumber(focusStats.totalCycles)}</strong><small>${tr("All sessions", "كل الجلسات")}</small></div></div>
      ${
        nextDeadline
          ? `<div class="sz-cal-agenda-head" style="margin-bottom:7px"><strong>${tr("Next deadline", "أقرب موعد")}</strong><small>${escapeHtml(taskDueLabel(nextDeadline, { includeDate: true }))}</small></div><button type="button" class="sz-agenda-item" data-action="task-edit" data-id="${escapeHtml(nextDeadline.id)}"><span class="sz-agenda-dot ${nextTone}"></span><span class="sz-agenda-copy"><strong dir="auto">${escapeHtml(nextDeadline.title)}</strong><small>${escapeHtml(nextDeadline.subject || subjectName(nextDeadline.subject_id) || tr("Task", "مهمة"))}</small></span><time>${escapeHtml(formatPriority(nextDeadline.priority || "medium"))}</time></button>`
          : ""
      }
      <button class="button button-primary button-small full-button" data-navigate="focus" style="margin-top:14px">${tr("Start a focus session", "ابدأ جلسة تركيز")}</button>
    </section>`;

    const habitWindow = Array.from({ length: 7 }, (_, index) =>
      dateKey(addLocalDays(startOfLocalDay(new Date()), index - 6)),
    );
    const activeRoutines = routines
      .filter((routine) =>
        habitWindow.some((key) => routineOccursOnKey(routine, key)),
      )
      .slice(0, 6);
    const todayRoutines = routines.filter((routine) =>
      routineOccursOnKey(routine, todayKey),
    );
    const doneToday = todayRoutines.filter(
      (routine) => routineDayFor(routine.id, todayKey)?.status === "completed",
    ).length;
    const habitPercent = todayRoutines.length
      ? Math.round((doneToday / todayRoutines.length) * 100)
      : 0;
    const habitTones = [
      "tone-green",
      "tone-cyan",
      "tone-purple",
      "tone-blue",
      "tone-amber",
      "tone-pink",
    ];
    const habitHead = `<div class="sz-habit-row sz-habit-head"><span>${tr("Habit", "العادة")}</span>${habitWindow
      .map((key) => {
        const date = parseLocalDateKey(key);
        return `<span>${new Intl.DateTimeFormat(locale, { weekday: "narrow" }).format(date)} ${new Intl.NumberFormat(locale).format(date.getDate())}</span>`;
      })
      .join("")}</div>`;
    const habitRows = activeRoutines
      .map((routine, index) => {
        const tone = habitTones[index % habitTones.length];
        const cells = habitWindow
          .map((key) => {
            if (!routineOccursOnKey(routine, key)) {
              return `<span class="sz-habit-day is-empty" aria-hidden="true">·</span>`;
            }
            const done =
              routineDayFor(routine.id, key)?.status === "completed";
            const future = key > todayKey;
            const date = parseLocalDateKey(key);
            const dayNumber = new Intl.NumberFormat(locale).format(
              date.getDate(),
            );
            return `<button type="button" class="sz-habit-day ${done ? "is-done" : ""} ${key === todayKey ? "is-today" : ""} ${future ? "is-future" : ""}" data-action="habit-toggle" data-id="${escapeHtml(routine.id)}" data-date="${key}" aria-pressed="${done}" ${future ? "disabled" : ""} aria-label="${escapeHtml(routine.title)} · ${escapeHtml(new Intl.DateTimeFormat(locale, { dateStyle: "full" }).format(date))}">${done ? "✓" : dayNumber}</button>`;
          })
          .join("");
        const cadence =
          routine.routine_type === "weekdays" || routine.routine_type === "custom"
            ? tr("Selected days", "أيام محددة")
            : routine.routine_type === "interval"
              ? `${routine.interval_days || 1} ${tr("day rhythm", "يوم متتالي")}`
              : tr("Every day", "كل يوم");
        return `<div class="sz-habit-row"><div class="sz-habit-name"><span class="sz-habit-icon ${tone}">↻</span><div><strong dir="auto">${escapeHtml(routine.title)}</strong><small>${escapeHtml(cadence)}</small></div></div>${cells}</div>`;
      })
      .join("");
    const habitsPanel = `<section class="sz-card sz-habits">
      <div class="sz-card-head"><div><p class="sz-kicker">${tr("CONSISTENCY", "الاستمرارية")}</p><h2>${tr("Habit tracker", "متتبع العادات")}</h2><p>${tr("Small actions, seven days at a time", "خطوات صغيرة، سبعة أيام في كل مرة")}</p></div><span class="sz-pill ${habitPercent >= 60 ? "tone-green" : "tone-orange"}"><i></i>${habitPercent}%</span></div>
      ${
        activeRoutines.length
          ? `<div class="sz-habit-scroll"><div class="sz-habit-table">${habitHead}${habitRows}</div></div>`
          : `<div class="sz-empty"><span class="sz-empty-icon">↻</span><strong>${tr("Build your first habit", "ابدأ عادتك الأولى")}</strong><p>${tr("Create a recurring task and check it off each day.", "أنشئ مهمة متكررة وأنجزها كل يوم.")}</p><button class="button button-secondary button-small" data-action="new-task">${tr("New recurring task", "مهمة متكررة جديدة")}</button></div>`
      }
      <div class="sz-habit-foot"><div class="sz-progress"><div class="sz-progress-line"><span>${tr("Today", "اليوم")}</span><strong>${doneToday}/${todayRoutines.length}</strong></div><div class="sz-track ${tickClass(habitPercent)}"><span style="width:${habitPercent}%"></span></div></div><span class="sz-pill ${habitPercent >= 60 ? "tone-green" : "tone-orange"}"><i></i>${tr("daily rhythm", "إيقاع يومي")}</span></div>
    </section>`;

    const goalRows = goals
      .slice(0, 4)
      .map((goal, index) => {
        const percent = clampPercent(goal.progress);
        const complete = percent >= 100;
        const goalValue = goal.target_value
          ? `${formattedNumber(goal.current_value || 0)}/${formattedNumber(goal.target_value)}${escapeHtml(goal.unit || "")}`
          : `${percent}%`;
        return `<div class="sz-goal"><div class="sz-ring sz-ring-xs ${complete ? "tone-green" : index % 2 ? "tone-purple" : "tone-blue"}" style="--sz-p:${percent}"><div class="sz-ring-inner"><strong>${percent}%</strong></div></div><div class="sz-goal-copy"><strong dir="auto">${escapeHtml(goal.title)}</strong><small dir="auto">${escapeHtml(goal.detail || goal.details || goal.due || tr("Keep moving", "واصل التقدم"))}</small><div class="sz-track ${tickClass(percent)}"><span style="width:${percent}%"></span></div></div><span class="sz-goal-value ${complete ? "is-complete" : ""}">${goalValue}</span></div>`;
      })
      .join("");
    const goalsPanel = `<section class="sz-card">
      <div class="sz-card-head"><div><p class="sz-kicker">${tr("MILESTONES", "المحطات")}</p><h2>${tr("Goal progress", "تقدم الأهداف")}</h2><p>${tr("Small steps add up", "خطوات صغيرة تضيف")}</p></div><button class="panel-link" data-navigate="goals">${tr("Goals →", "الأهداف ←")}</button></div>
      <div class="sz-goal-list">${goalRows || `<div class="sz-empty"><span class="sz-empty-icon">◎</span><strong>${tr("No goals yet", "لا أهداف بعد")}</strong><p>${tr("Turn a wish into a measurable milestone.", "حوّل أمنية إلى محطة قابلة للقياس.")}</p></div>`}</div>
    </section>`;

    const focusSpark = focusStats.days
      .map((day) => {
        const height = Math.max(
          4,
          Math.round(((Number(day.seconds) || 0) / focusMax) * 100),
        );
        return `<div title="${escapeHtml(new Intl.DateTimeFormat(locale, { weekday: "short" }).format(day.date))}"><span style="height:${height}%"></span></div>`;
      })
      .join("");
    const analyticsPanel = `<section class="sz-card">
      <div class="sz-card-head"><div><p class="sz-kicker">${tr("AT A GLANCE", "لمحة سريعة")}</p><h2>${tr("Mini analytics", "تحليلات مصغرة")}</h2><p>${tr("How today is shaping up", "كيف يسير يومك")}</p></div><button class="panel-link" data-navigate="analytics">${tr("Analytics →", "التحليلات ←")}</button></div>
      <div class="sz-mini-analytics"><div class="sz-donut" style="--sz-p:${progress}"><div class="sz-donut-inner"><strong>${progress}%</strong><small>${tr("today", "اليوم")}</small></div></div><div class="sz-legend"><div class="sz-legend-row tone-green"><i></i>${tr("Completed", "مكتملة")}<b>${formattedNumber(completedToday.length)}</b></div><div class="sz-legend-row tone-blue"><i></i>${tr("Open", "مفتوحة")}<b>${formattedNumber(todayTasks.length)}</b></div><div class="sz-legend-row tone-orange"><i></i>${tr("Overdue", "متأخرة")}<b>${formattedNumber(overdueTasks.length)}</b></div></div></div>
      <div class="sz-mini-spark">${focusSpark}</div>
    </section>`;

    const latestNote = notes
      .slice()
      .sort(
        (a, b) =>
          new Date(b.updated_at || b.created_at || 0) -
          new Date(a.updated_at || a.created_at || 0),
      )[0];
    const journalCard = `<section class="sz-image-card">
      <div class="sz-image-card-media"><img src="./assets/images/journal-notebook.webp" alt="" loading="lazy" decoding="async" onerror="this.remove()" /></div>
      <div class="sz-image-card-body"><p class="sz-kicker">${tr("STUDY JOURNAL", "مفكرة الدراسة")}</p><h3>${tr("Reflect, then grow.", "تأمل، ثم انمُ.")}</h3><p>${latestNote ? escapeHtml(latestNote.title || tr("Your latest note is waiting.", "ملاحظتك الأخيرة بانتظارك.")) : tr("A few honest lines can reset your whole week.", "بضعة أسطر صادقة تعيد ضبط أسبوعك.")}</p><button class="button button-secondary button-small" data-navigate="journal">${tr("Open journal", "افتح المفكرة")}</button></div>
    </section>`;

    const motivationQuote =
      appLanguage === "ar"
        ? "لا تحتاج أن تكون مبالغًا، فقط منتظمًا."
        : "You do not have to be extreme, just consistent.";
    const quoteCard = `<section class="sz-card sz-quote-card"><span class="sz-quote-mark">“</span><p class="sz-quote-text">${escapeHtml(motivationQuote)}</p><p class="sz-quote-author">${tr("A note to future you", "ملاحظة لك في المستقبل")} · Study Zone</p><div class="sz-hero-meta" style="margin-top:16px"><span class="sz-hero-chip tone-amber" style="background:rgba(var(--sz-amber-rgb),.08);border-color:rgba(var(--sz-amber-rgb),.2);color:var(--color-text)"><i></i>${tr("One page at a time", "صفحة واحدة في كل مرة")}</span></div><button class="button button-secondary button-small" data-navigate="notes" style="margin-top:14px">${tr("Write a note", "اكتب ملاحظة")}</button></section>`;

    const badges =
      earnedAchievements
        .slice(0, 3)
        .map((item, index) => {
          const achievement = Array.isArray(item.achievements)
            ? item.achievements[0]
            : item.achievements;
          const catalog = achievementCatalog.find(
            (entry) => entry.code === achievement?.code,
          );
          if (!achievement) return "";
          return `<div class="sz-badge ${habitTones[index % habitTones.length]}"><span class="sz-badge-icon">${catalog?.symbol || "✦"}</span><div><strong>${escapeHtml(achievement.name || catalog?.name || tr("Achievement unlocked!", "تم فتح إنجاز!"))}</strong><small>${escapeHtml(achievement.description || catalog?.description || "")}</small></div></div>`;
        })
        .join("") ||
      `<div class="sz-empty" style="padding:20px"><span class="sz-empty-icon">✦</span><strong>${session ? tr("No achievements yet", "لا إنجازات بعد") : tr("Sign in to earn rewards", "سجّل الدخول لتكسب المكافآت")}</strong><p>${session ? tr("Keep showing up — the first badge is close.", "استمر بالحضور — أول شارة قريبة.") : tr("Secure rewards follow verified study sessions.", "المكافآت الآمنة تتبع جلسات الدراسة الموثقة.")}</p></div>`;
    const achievementsPanel = `<section class="sz-card"><div class="sz-card-head"><div><p class="sz-kicker">${tr("MOMENTUM", "الزخم")}</p><h2>${tr("Recent achievements", "آخر الإنجازات")}</h2><p>${tr("Keep building your rhythm", "واصل بناء إيقاعك")}</p></div><button class="panel-link" data-navigate="achievements">${tr("All →", "الكل ←")}</button></div><div class="sz-badge-list">${badges}</div></section>`;

    const subjectsPanel = `<section class="sz-card">
      <div class="sz-card-head"><div><p class="sz-kicker">${tr("YOUR COURSES", "موادك")}</p><h2>${tr("Subject progress", "تقدم المواد")}</h2><p>${tr("Current learning progress", "تقدم التعلم الحالي")}</p></div><button class="panel-link" data-navigate="subjects">${tr("Subjects →", "المواد ←")}</button></div>
      <div class="sz-subject-grid">${subjects
        .slice(0, 6)
        .map((subject) => {
          const percent =
            subject.progress == null ? null : clampPercent(subject.progress);
          return `<div class="sz-subject-item"><div class="sz-subject-head"><span class="sz-subject-dot" style="background:${escapeHtml(subject.color || "var(--sz-teal)")}"></span><strong dir="auto">${escapeHtml(subject.name)}</strong><span>${percent == null ? "—" : `${percent}%`}</span></div><div class="sz-track ${percent == null ? "" : tickClass(percent)}"><span style="width:${percent == null ? 0 : percent}%"></span></div></div>`;
        })
        .join("") || `<div class="sz-empty" style="grid-column:1/-1;padding:20px"><strong>${tr("No subjects yet", "لا مواد بعد")}</strong><p>${tr("Add a course to connect tasks, notes and focus sessions.", "أضف مادة لربط المهام والملاحظات وجلسات التركيز.")}</p></div>`}</div>
    </section>`;

    return `${hero}
      ${statGrid}
      <div class="sz-dash">
        <div class="sz-dash-main">
          <div class="sz-dash-main-left">${calendarPanel}${tasksPanel}</div>
          <div class="sz-dash-main-right">${focusCard}</div>
        </div>
        <div class="sz-dash-lower">${habitsPanel}${goalsPanel}${analyticsPanel}</div>
        <div class="sz-dash-bottom">${journalCard}${quoteCard}${achievementsPanel}</div>
        ${subjectsPanel}
      </div>
      <p class="data-caption">${session ? tr("Everything above is calculated from your saved tasks, notes, habits, and verified focus sessions.", "كل ما سبق محسوب من مهامك وملاحظاتك وعاداتك وجلسات التركيز الموثقة.") : tr("Guest preview data is stored in this browser. Sign in to sync your private workspace.", "بيانات المعاينة محفوظة في هذا المتصفح. سجّل الدخول لمزامنة مساحتك الخاصة.")}</p>`;
  }

  function startOfLocalDay(value = new Date()) {
    const date = value instanceof Date ? value : new Date(value);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function addLocalDays(date, days) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
  }

  // ---- Recurring routines & all-day helpers --------------------------------

  function isAllDayTask(task) {
    if (!task) return false;
    if (task.__routine || task.routine_id) return true;
    if (task.is_all_day === true) return true;
    if (!task.due_at) return false;
    const due = new Date(task.due_at);
    return (
      !task.starts_at &&
      due.getHours() === 23 &&
      due.getMinutes() === 59
    );
  }

  function normalizeRoutine(row) {
    return {
      id: row.id,
      user_id: row.user_id,
      title: row.title || "",
      description: row.description || "",
      subject_id: row.subject_id || null,
      priority: row.priority || "medium",
      routine_type: row.routine_type || "daily",
      weekdays: Array.isArray(row.weekdays)
        ? row.weekdays.map(Number)
        : Array.isArray(row.recurrence_days)
          ? row.recurrence_days.map(Number)
          : [],
      interval_days: Math.max(1, Number(row.interval_days) || 1),
      start_date: row.start_date || dateKey(new Date()),
      end_date: row.end_date || null,
      paused: row.paused === true,
      paused_at: row.paused_at || null,
      estimated_minutes: Number(row.estimated_minutes) || 30,
      reminder_before_minutes: Number(row.reminder_before_minutes) || 0,
      created_at: row.created_at || new Date().toISOString(),
      updated_at: row.updated_at || new Date().toISOString(),
    };
  }

  function routineOccursOnKey(routine, key) {
    if (!routine || !key) return false;
    if (routine.start_date && key < routine.start_date) return false;
    if (routine.end_date && key > routine.end_date) return false;
    if (routine.paused) {
      const pausedKey =
        routine.paused_at || dateKey(startOfLocalDay(new Date()));
      if (!pausedKey || key >= pausedKey) return false;
    }
    const date = parseLocalDateKey(key);
    if (!date) return false;
    const type = routine.routine_type || "daily";
    if (type === "weekdays" || type === "custom") {
      return (routine.weekdays || []).map(Number).includes(date.getDay());
    }
    if (type === "interval") {
      const start = parseLocalDateKey(routine.start_date);
      if (!start) return true;
      const diff = Math.round((date - start) / 86400000);
      const interval = Math.max(1, Number(routine.interval_days) || 1);
      return diff >= 0 && diff % interval === 0;
    }
    return true;
  }

  function routineDayFor(routineId, key) {
    return (
      routineDays.find(
        (day) =>
          String(day.routine_id) === String(routineId) &&
          day.occurrence_date === key,
      ) || null
    );
  }

  function routineVirtualTask(routine, key) {
    const record = routineDayFor(routine.id, key);
    const completed = record?.status === "completed";
    return {
      id: `routine:${routine.id}:${key}`,
      routine_id: routine.id,
      occurrence_date: key,
      title: routine.title,
      description: routine.description || "",
      subject_id: routine.subject_id || null,
      subject: subjectName(routine.subject_id),
      priority: routine.priority || "medium",
      status: completed ? "completed" : "not_started",
      is_all_day: true,
      due_at: `${key}T23:59:00`,
      starts_at: null,
      recurrence_group_id: null,
      recurrence_type: routine.routine_type,
      recurrence_days: routine.weekdays || [],
      recurrence_until: routine.end_date || null,
      estimated_minutes: routine.estimated_minutes || 30,
      reminder_before_minutes: routine.reminder_before_minutes || 0,
      completed_at: record?.completed_at || null,
      skipped: record?.status === "skipped",
      __routine: routine,
      __routineRecord: record || null,
    };
  }

  function routineTasksForDay(key) {
    return routines
      .filter((routine) => routineOccursOnKey(routine, key))
      .map((routine) => routineVirtualTask(routine, key))
      .filter((task) => !task.skipped);
  }

  function tasksForDay(key) {
    return tasks
      .filter((task) => taskOccursOnKey(task, key))
      .concat(routineTasksForDay(key));
  }

  function taskSort(a, b) {
    return smartSortEnabled ? sortTasksSmart(a, b) : sortTasksByPlan(a, b);
  }

  function smartTaskScore(task) {
    if (!task || task.status === "completed") return -1;
    const todayKey = dateKey(new Date());
    const endKey = taskEndKey(task);
    let score = 0;
    if (endKey) {
      const days = Math.round(
        (parseLocalDateKey(endKey) - parseLocalDateKey(todayKey)) / 86400000,
      );
      if (days < 0) score += 1000 + Math.min(240, Math.abs(days) * 8);
      else if (days === 0) score += 320;
      else if (days === 1) score += 220;
      else if (days <= 3) score += 120;
      else if (days <= 7) score += 50;
    }
    score += 90 - (priorityRank[task.priority] ?? 2) * 25;
    score += Math.min(120, Number(task.postpone_count || 0) * 18);
    score += Math.min(60, Number(task.open_count || 0) * 3);
    if (isAllDayTask(task)) score += 12;
    return score;
  }

  function sortTasksSmart(a, b) {
    const difference = smartTaskScore(b) - smartTaskScore(a);
    if (difference !== 0) return difference;
    return sortTasksByPlan(a, b);
  }

  function mostUsedTasks(limit = 4) {
    const ranked = tasks
      .filter((task) => !task.routine_id)
      .map((task) => ({
        task,
        score:
          Number(task.open_count || 0) +
          Number(task.completed_count || 0) * 2 +
          (task.last_opened_at ? 1 : 0),
      }))
      .filter((entry) => entry.score > 0)
      .sort(
        (a, b) =>
          b.score - a.score ||
          new Date(b.task.last_opened_at || 0) -
            new Date(a.task.last_opened_at || 0),
      )
      .slice(0, limit)
      .map((entry) => entry.task);
    if (ranked.length) return ranked;
    return tasks
      .filter((task) => task.status !== "completed")
      .sort(
        (a, b) =>
          new Date(b.created_at || 0) - new Date(a.created_at || 0),
      )
      .slice(0, limit);
  }

  async function trackTaskUsage(task, field) {
    if (!task || !field || String(task.id).startsWith("routine:")) return;
    const next = Number(task[field] || 0) + 1;
    task[field] = next;
    if (field === "open_count") task.last_opened_at = new Date().toISOString();
    if (!supabase || !session) {
      saveLocalTasks();
      return;
    }
    if (!taskUsageSupported) return;
    const patch = { [field]: next };
    if (field === "open_count") patch.last_opened_at = task.last_opened_at;
    const { error } = await supabase
      .from("tasks")
      .update(patch)
      .eq("id", task.id);
    if (error) {
      if (isMissingColumnError(error)) taskUsageSupported = false;
      else console.warn("Could not update task usage counters.", error);
    }
  }

  function isMissingColumnError(error) {
    return /(column .* does not exist|42703|PGRST204)/i.test(
      `${error?.code || ""} ${error?.message || ""}`,
    );
  }

  function routineTypeFormValue(routine) {
    if (!routine) return "none";
    if (routine.routine_type === "weekdays" || routine.routine_type === "custom")
      return "weekdays_permanent";
    if (routine.routine_type === "interval") return "interval_permanent";
    return "daily_permanent";
  }

  function routineTypeFromFormValue(value) {
    if (value === "weekdays_permanent") return "weekdays";
    if (value === "interval_permanent") return "interval";
    return "daily";
  }

  function isRoutineRepeatType(value) {
    return String(value || "").endsWith("_permanent");
  }

  function resetRoutineFormState(form) {
    if (!form) return;
    const hidden = form.elements.namedItem("routine_id");
    if (hidden) hidden.value = "";
  }

  function parseLocalDateKey(key) {
    const [year, month, day] = String(key || "")
      .split("-")
      .map(Number);
    if (!year || !month || !day) return null;
    const date = new Date(year, month - 1, day);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function taskDateRange(task) {
    if (!task) return null;
    const startValue = task.starts_at || task.due_at;
    const endValue = task.due_at || task.starts_at;
    if (!startValue || !endValue) return null;
    const start = startOfLocalDay(new Date(startValue));
    const end = startOfLocalDay(new Date(endValue));
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()))
      return null;
    return start <= end ? { start, end } : { start: end, end: start };
  }

  function taskOccursOnKey(task, key) {
    const range = taskDateRange(task);
    const day = parseLocalDateKey(key);
    return Boolean(range && day && day >= range.start && day <= range.end);
  }

  function taskEndKey(task) {
    const range = taskDateRange(task);
    return range ? dateKey(range.end) : null;
  }

  function taskSeries(task) {
    if (!task) return [];
    if (!task.recurrence_group_id) return [task];
    const group = tasks.filter(
      (item) => item.recurrence_group_id === task.recurrence_group_id,
    );
    return group.length ? group : [task];
  }

  function seriesScopeIds(task, scope) {
    const group = taskSeries(task);
    if (scope === "all") return group.map((item) => item.id);
    if (scope === "future") {
      const anchor = taskEndKey(task) || dateKey(new Date());
      return group
        .filter((item) => (taskEndKey(item) || "") >= anchor)
        .map((item) => item.id);
    }
    return [task.id];
  }

  const priorityRank = { urgent: 0, high: 1, medium: 2, low: 3 };

  function sortTasksByPlan(a, b) {
    const aRange = taskDateRange(a);
    const bRange = taskDateRange(b);
    const aTime = aRange ? aRange.end.getTime() : Number.POSITIVE_INFINITY;
    const bTime = bRange ? bRange.end.getTime() : Number.POSITIVE_INFINITY;
    if (aTime !== bTime) return aTime - bTime;
    const priority =
      (priorityRank[a.priority] ?? 2) - (priorityRank[b.priority] ?? 2);
    if (priority !== 0) return priority;
    return String(a.title || "").localeCompare(
      String(b.title || ""),
      appLanguage === "ar" ? "ar" : "en",
    );
  }

  function openTaskCountForDay(key) {
    return tasksForDay(key).filter((task) => task.status !== "completed").length;
  }

  function formatTaskTime(task) {
    if (!task?.due_at || isAllDayTask(task)) return "";
    const date = new Date(task.due_at);
    if (Number.isNaN(date.getTime())) return "";
    if (date.getHours() === 23 && date.getMinutes() === 59) return "";
    return new Intl.DateTimeFormat(appLanguage === "ar" ? "ar-EG" : "en", {
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  }

  function formatTaskDayLabel(date) {
    return new Intl.DateTimeFormat(appLanguage === "ar" ? "ar-EG" : "en", {
      weekday: "short",
      month: "short",
      day: "numeric",
    }).format(date);
  }

  function taskDueLabel(task, { includeDate = false } = {}) {
    const range = taskDateRange(task);
    if (!range) return translateUiText("No due date");
    const timeValue = formatTaskTime(task);
    const multiDay = dateKey(range.start) !== dateKey(range.end);
    const allDayLabel = appLanguage === "ar" ? "طوال اليوم" : "All day";
    if (multiDay)
      return `${formatTaskDayLabel(range.start)} → ${formatTaskDayLabel(range.end)}`;
    if (isAllDayTask(task)) {
      return includeDate
        ? `${formatTaskDayLabel(range.end)} · ${allDayLabel}`
        : allDayLabel;
    }
    if (includeDate)
      return `${formatTaskDayLabel(range.end)}${timeValue ? ` · ${timeValue}` : ""}`;
    return timeValue || allDayLabel;
  }

  function taskRow(task, { showDate = false } = {}) {
    const completed = task.status === "completed";
    const routine = Boolean(task.routine_id);
    const range = taskDateRange(task);
    const dueLabel = taskDueLabel(task, { includeDate: showDate });
    const subject = task.subject || subjectName(task.subject_id);
    const description = task.description?.trim()
      ? `<small class="task-description" dir="auto">${escapeHtml(task.description)}</small>`
      : "";
    const repeating = routine
      ? `<span class="task-repeat task-repeat-routine" title="${appLanguage === "ar" ? "مهمة يومية متكررة" : "Recurring routine"}">↻</span>`
      : task.recurrence_group_id
        ? `<span class="task-repeat" title="${appLanguage === "ar" ? "مهمة متكررة" : "Repeating task"}">↻</span>`
        : "";
    const overdue =
      !completed &&
      !routine &&
      range &&
      dateKey(range.end) < dateKey(new Date());
    const routineActions = routine
      ? `<button class="task-icon" data-action="routine-edit" data-id="${escapeHtml(task.routine_id)}" aria-label="${appLanguage === "ar" ? "تعديل المهمة اليومية" : "Edit routine"}">✎</button>
         ${completed ? "" : `<button class="task-icon" data-action="routine-skip" data-id="${escapeHtml(task.routine_id)}" data-date="${escapeHtml(task.occurrence_date)}" aria-label="${appLanguage === "ar" ? "تخطي اليوم" : "Skip today"}">↷</button>`}
         <button class="task-icon" data-action="routine-toggle-pause" data-id="${escapeHtml(task.routine_id)}" aria-label="${task.__routine?.paused ? (appLanguage === "ar" ? "استئناف التكرار" : "Resume routine") : (appLanguage === "ar" ? "إيقاف التكرار مؤقتًا" : "Pause routine")}">${task.__routine?.paused ? "▶" : "Ⅱ"}</button>
         <button class="task-icon danger" data-action="routine-delete" data-id="${escapeHtml(task.routine_id)}" aria-label="${appLanguage === "ar" ? "حذف المهمة اليومية" : "Delete routine"}">×</button>`
      : `<button class="task-icon" data-action="task-edit" data-id="${escapeHtml(task.id)}" aria-label="${appLanguage === "ar" ? "تعديل المهمة" : "Edit task"}">✎</button>
         <button class="task-icon" data-action="move-task" data-id="${escapeHtml(task.id)}" aria-label="${appLanguage === "ar" ? "نقل المهمة" : "Move task"}">→</button>
         <button class="task-icon danger" data-action="delete-task" data-id="${escapeHtml(task.id)}" aria-label="${appLanguage === "ar" ? "حذف المهمة" : "Delete task"}">×</button>`;
    return `<div class="task-row ${completed ? "completed" : ""} ${overdue ? "is-overdue" : ""} ${routine ? "is-routine" : ""}" data-task-id="${escapeHtml(task.id)}" ${routine ? `data-routine-id="${escapeHtml(task.routine_id)}"` : ""}>
      <button class="task-check ${completed ? "checked" : ""}" data-action="toggle-task" data-id="${escapeHtml(task.id)}" aria-label="${completed ? "Reopen" : "Complete"} ${escapeHtml(task.title)}">${completed ? "✓" : ""}</button>
      <div class="task-main"><strong class="task-title" dir="auto">${escapeHtml(task.title)}${repeating}</strong>${description}<span class="task-meta-inline" dir="auto">${escapeHtml(subject)}</span></div>
      <span class="task-meta" dir="auto">${escapeHtml(subject)}</span>
      <span class="task-due ${overdue ? "overdue" : ""}">${escapeHtml(dueLabel)}</span>
      <span class="priority ${escapeHtml(task.priority || "medium")}">${escapeHtml(deadlineText[appLanguage][task.priority] || task.priority || "medium")}</span>
      <div class="task-actions">${routineActions}</div>
    </div>`;
  }

  function taskSection(
    key,
    title,
    items,
    { count = items.length, collapsed = false, hint = "" } = {},
  ) {
    if (!items.length && !hint) return "";
    const open = collapsed ? false : taskSectionState[key] !== false;
    const body = open
      ? `<div class="task-list">${items.map((task) => taskRow(task, { showDate: key === "overdue" || key === "nodate" })).join("") || `<div class="empty-state"><strong>${escapeHtml(hint)}</strong></div>`}</div>`
      : "";
    return `<section class="task-group task-group-${key}">
      <button class="task-group-head" data-action="toggle-task-section" data-section="${key}" aria-expanded="${open}">
        <span class="task-group-title">${escapeHtml(title)}</span>
        <span class="task-group-count">${new Intl.NumberFormat(appLanguage === "ar" ? "ar-EG" : "en").format(count)}</span>
        <span class="task-group-chevron">${open ? "⌃" : "⌄"}</span>
      </button>${body}</section>`;
  }

  function taskProgressRing(completedCount, totalCount) {
    const percent = totalCount
      ? Math.round((completedCount / totalCount) * 100)
      : 0;
    const radius = 26;
    const circumference = 2 * Math.PI * radius;
    const dash = (percent / 100) * circumference;
    const label = appLanguage === "ar" ? "إنجاز اليوم" : "Day progress";
    return `<div class="task-progress-ring" role="progressbar" aria-label="${label}" aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100">
      <svg viewBox="0 0 64 64" aria-hidden="true"><circle class="ring-track" cx="32" cy="32" r="${radius}"/><circle class="ring-fill" cx="32" cy="32" r="${radius}" stroke-dasharray="${dash} ${circumference}" transform="rotate(-90 32 32)"/></svg>
      <strong>${percent}%</strong>
    </div>`;
  }

  function taskPage() {
    const selectedKey = dateKey(taskViewDate);
    const todayKey = dateKey(new Date());
    const dayMode = taskViewMode === "day";
    const buckets = { overdue: [], day: [], nodate: [], completed: [] };
    const dayTasksAll = tasksForDay(selectedKey);
    const openTasks = tasks.filter((task) => task.status !== "completed");
    if (dayMode) {
      buckets.overdue = openTasks
        .filter((task) => {
          const endKey = taskEndKey(task);
          return endKey && endKey < todayKey;
        })
        .sort(taskSort);
      const overdueIds = new Set(buckets.overdue.map((task) => task.id));
      buckets.day = dayTasksAll
        .filter(
          (task) =>
            task.status !== "completed" &&
            !overdueIds.has(task.id),
        )
        .sort(taskSort);
      buckets.nodate = openTasks
        .filter((task) => !taskDateRange(task) && !overdueIds.has(task.id))
        .sort(taskSort);
      buckets.completed = dayTasksAll
        .filter((task) => task.status === "completed")
        .sort(taskSort);
    } else {
      const todayRoutines = routineTasksForDay(todayKey);
      buckets.day = tasks
        .filter((task) => task.status !== "completed")
        .concat(todayRoutines.filter((task) => task.status !== "completed"))
        .sort(taskSort);
      buckets.completed = tasks
        .filter((task) => task.status === "completed")
        .concat(todayRoutines.filter((task) => task.status === "completed"))
        .sort(taskSort);
    }
    const dayTasks = buckets.day.concat(
      buckets.overdue.filter((task) => taskOccursOnKey(task, selectedKey)),
    );
    const completedOnDay = buckets.completed.filter(
      (task) => taskOccursOnKey(task, selectedKey) || !dayMode,
    );
    const totalOnDay = dayTasks.length + completedOnDay.length;
    const percent = totalOnDay
      ? Math.round((completedOnDay.length / totalOnDay) * 100)
      : 0;
    const stripStart = addLocalDays(taskViewDate, -3);
    const strip = Array.from({ length: 7 }, (_, index) => {
      const date = addLocalDays(stripStart, index);
      const key = dateKey(date);
      const count = openTaskCountForDay(key);
      const selected = key === selectedKey;
      const isToday = key === todayKey;
      return `<button class="day-chip ${selected ? "selected" : ""} ${isToday ? "today" : ""}" data-action="task-select-day" data-date="${key}" aria-pressed="${selected}">
        <span>${new Intl.DateTimeFormat(appLanguage === "ar" ? "ar-EG" : "en", { weekday: "short" }).format(date)}</span>
        <strong>${new Intl.NumberFormat(appLanguage === "ar" ? "ar-EG" : "en").format(date.getDate())}</strong>
        ${count ? `<i class="day-chip-count">${new Intl.NumberFormat(appLanguage === "ar" ? "ar-EG" : "en").format(count)}</i>` : `<i class="day-chip-dot"></i>`}
      </button>`;
    }).join("");
    const search = `<label class="search-box"><span>⌕</span><input id="task-search" type="search" dir="auto" value="${escapeHtml(searchTerm)}" placeholder="Search tasks" aria-label="Search tasks"></label>`;
    const filters = `<select class="filter-select" id="task-filter" aria-label="Filter task status"><option value="all" ${statusFilter === "all" ? "selected" : ""}>All statuses</option><option value="not_started" ${statusFilter === "not_started" ? "selected" : ""}>Not started</option><option value="in_progress" ${statusFilter === "in_progress" ? "selected" : ""}>In progress</option><option value="completed" ${statusFilter === "completed" ? "selected" : ""}>Completed</option></select>`;
    const matchesSearch = (task) => {
      const text =
        `${task.title} ${task.description || ""} ${task.subject || subjectName(task.subject_id)}`.toLowerCase();
      return (
        (!searchTerm || text.includes(searchTerm.toLowerCase())) &&
        (statusFilter === "all" || task.status === statusFilter)
      );
    };
    Object.keys(buckets).forEach((key) => {
      buckets[key] = buckets[key].filter(matchesSearch);
    });
    const sections = dayMode
      ? `${taskSection("overdue", appLanguage === "ar" ? "المهام المتأخرة" : "Overdue", buckets.overdue)}
         ${totalOnDay || buckets.overdue.length || buckets.nodate.length ? "" : `<div class="empty-state task-empty"><strong>${appLanguage === "ar" ? "يومك مرتب" : "Your day is clear"}</strong>${appLanguage === "ar" ? "أضف مهمة أو اختر يومًا آخر." : "Add a task or pick another day."}<button class="button button-primary button-small" data-action="new-task" data-date="${selectedKey}">＋ Add a task</button></div>`}
         ${taskSection(
           "today",
           selectedKey === todayKey
             ? appLanguage === "ar"
               ? "مهام اليوم"
               : "Today"
             : formatTaskDayLabel(taskViewDate),
           buckets.day,
         )}
         ${taskSection("nodate", appLanguage === "ar" ? "بلا موعد" : "No date", buckets.nodate)}
         ${taskShowCompleted ? taskSection("completed", appLanguage === "ar" ? "المكتملة" : "Completed", buckets.completed) : ""}`
      : `${taskSection("today", appLanguage === "ar" ? "كل المهام المفتوحة" : "All open tasks", buckets.day)}
         ${taskSection("completed", appLanguage === "ar" ? "المكتملة" : "Completed", buckets.completed)}`;

    const suggestionReason = (task) => {
      const endKey = taskEndKey(task);
      const today = dateKey(new Date());
      if (endKey && endKey < today)
        return appLanguage === "ar" ? "متأخرة — ابدأ بها" : "Overdue · start here";
      if (endKey === today)
        return appLanguage === "ar" ? "مستحقة اليوم" : "Due today";
      if (Number(task.postpone_count || 0) >= 2)
        return appLanguage === "ar"
          ? `تم تأجيلها ${Number(task.postpone_count)} مرات`
          : `Postponed ${Number(task.postpone_count)} times`;
      return appLanguage === "ar"
        ? "أعلى أولوية متاحة"
        : "Highest available priority";
    };
    const suggested = tasks
      .filter((task) => task.status !== "completed")
      .slice()
      .sort(sortTasksSmart)
      .slice(0, 3);
    const smartPanel = suggested.length
      ? `<section class="panel task-smart-panel">
          ${panelHeading(
            appLanguage === "ar" ? "أولويات ذكية" : "SMART PRIORITIES",
            appLanguage === "ar" ? "ترتيب مقترح لليوم" : "A suggested focus order",
            `<button class="button button-secondary button-small" data-action="toggle-smart-sort">${smartSortEnabled ? (appLanguage === "ar" ? "الترتيب اليدوي" : "Manual order") : appLanguage === "ar" ? "استخدم الاقتراح" : "Use suggested order"}</button>`,
          )}
          <div class="smart-task-list">${suggested
            .map(
              (task, index) =>
                `<button class="smart-task-row" data-action="task-edit" data-id="${escapeHtml(task.id)}">
                  <span class="smart-task-rank">${new Intl.NumberFormat(appLanguage === "ar" ? "ar-EG" : "en", { minimumIntegerDigits: 2 }).format(index + 1)}</span>
                  <span class="smart-task-main"><strong dir="auto">${escapeHtml(task.title)}</strong><small>${escapeHtml(suggestionReason(task))}</small></span>
                  <span class="priority ${escapeHtml(task.priority || "medium")}">${escapeHtml(deadlineText[appLanguage][task.priority] || task.priority || "medium")}</span>
                </button>`,
            )
            .join("")}</div>
        </section>`
      : "";
    const usedTasks = mostUsedTasks(4);
    const mostUsedPanel = usedTasks.length
      ? `<section class="panel task-smart-panel">
          ${panelHeading(
            appLanguage === "ar" ? "الأكثر استخدامًا" : "MOST USED",
            appLanguage === "ar" ? "المهام التي تعود إليها" : "The tasks you return to",
            `<button class="panel-link" data-action="task-view-mode" data-mode="all">${appLanguage === "ar" ? "عرض الكل ←" : "View all →"}</button>`,
          )}
          <div class="smart-task-list">${usedTasks
            .map(
              (task) =>
                `<button class="smart-task-row" data-action="task-edit" data-id="${escapeHtml(task.id)}">
                  <span class="smart-task-rank">${new Intl.NumberFormat(appLanguage === "ar" ? "ar-EG" : "en").format(Number(task.open_count || 0) + Number(task.completed_count || 0) * 2)}</span>
                  <span class="smart-task-main"><strong dir="auto">${escapeHtml(task.title)}</strong><small>${escapeHtml(task.subject || subjectName(task.subject_id))} · ${Number(task.completed_count || 0)} ${appLanguage === "ar" ? "إكمال" : "completions"}</small></span>
                  <span class="task-due">${escapeHtml(taskDueLabel(task))}</span>
                </button>`,
            )
            .join("")}</div>
        </section>`
      : "";
    const pausedRoutines = routines.filter((routine) => routine.paused);
    const pausedPanel = pausedRoutines.length
      ? `<section class="panel task-smart-panel">
          ${panelHeading(
            appLanguage === "ar" ? "مهام يومية موقوفة" : "PAUSED ROUTINES",
            appLanguage === "ar" ? "التكرار متوقف، والسجل القديم محفوظ" : "Recurrence is paused and past history is kept",
          )}
          <div class="smart-task-list">${pausedRoutines
            .map(
              (routine) =>
                `<div class="smart-task-row">
                  <span class="smart-task-rank">Ⅱ</span>
                  <span class="smart-task-main"><strong dir="auto">${escapeHtml(routine.title)}</strong><small>${appLanguage === "ar" ? "موقوفة" : "Paused"} · ${escapeHtml(subjectName(routine.subject_id))}</small></span>
                  <span class="task-actions">
                    <button class="task-icon" data-action="routine-toggle-pause" data-id="${escapeHtml(routine.id)}" aria-label="${appLanguage === "ar" ? "استئناف" : "Resume"}">▶</button>
                    <button class="task-icon" data-action="routine-edit" data-id="${escapeHtml(routine.id)}" aria-label="${appLanguage === "ar" ? "تعديل" : "Edit"}">✎</button>
                    <button class="task-icon danger" data-action="routine-delete" data-id="${escapeHtml(routine.id)}" aria-label="${appLanguage === "ar" ? "حذف" : "Delete"}">×</button>
                  </span>
                </div>`,
            )
            .join("")}</div>
        </section>`
      : "";
    return `${pageHeading(
      "TASKBOARD",
      "Tasks",
      appLanguage === "ar"
        ? "ركّز على يومك، واترك الباقي في مكانه."
        : "Focus on today. Everything else stays quietly in place.",
      `<div class="dashboard-heading-actions"><button class="button button-secondary" data-action="quick-capture-open">＋ ${appLanguage === "ar" ? "إضافة سريعة" : "Quick capture"}</button><button class="button button-primary" data-action="new-task" data-date="${selectedKey}"><span class="button-icon">＋</span> ${appLanguage === "ar" ? "مهمة جديدة" : "New task"}</button></div>`,
    )}
      <section class="task-day-panel panel">
        <div class="task-day-top">
          <div class="task-day-title">
            <p class="eyebrow">${dayMode ? (selectedKey === todayKey ? "TODAY" : "SELECTED DAY") : "ALL TASKS"}</p>
            <h2>${dayMode ? (selectedKey === todayKey ? (appLanguage === "ar" ? "اليوم" : "Today") : formatTaskDayLabel(taskViewDate)) : appLanguage === "ar" ? `كل المهام (${tasks.length})` : `All tasks (${tasks.length})`}</h2>
            <p class="task-day-sub">${
              dayMode
                ? totalOnDay
                  ? `${new Intl.NumberFormat(appLanguage === "ar" ? "ar-EG" : "en").format(completedOnDay.length)} / ${new Intl.NumberFormat(appLanguage === "ar" ? "ar-EG" : "en").format(totalOnDay)} ${appLanguage === "ar" ? "مكتملة" : "completed"}`
                  : appLanguage === "ar"
                    ? "لا مهام لهذا اليوم"
                    : "Nothing scheduled"
                : appLanguage === "ar"
                  ? "المهام المفتوحة والمكتملة"
                  : "Open and completed tasks"
            }</p>
          </div>
          ${taskProgressRing(completedOnDay.length, totalOnDay)}
        </div>
        <div class="task-day-controls">
          <div class="task-view-switch" role="group" aria-label="Task view">
            <button class="${dayMode ? "selected" : ""}" data-action="task-view-mode" data-mode="day">${appLanguage === "ar" ? "يوم" : "Day"}</button>
            <button class="${!dayMode ? "selected" : ""}" data-action="task-view-mode" data-mode="all">${appLanguage === "ar" ? "الكل" : "All"}</button>
          </div>
          <div class="task-date-nav" ${dayMode ? "" : "hidden"}>
            <button class="icon-button" data-action="task-prev-day" aria-label="Previous day">‹</button>
            <input type="date" id="task-date" value="${selectedKey}" aria-label="Choose a day" />
            <button class="icon-button" data-action="task-next-day" aria-label="Next day">›</button>
            <button class="button button-secondary button-small" data-action="task-today">${appLanguage === "ar" ? "اليوم" : "Today"}</button>
          </div>
          <div class="task-toolbar">${search}${filters}<button class="button button-secondary button-small ${smartSortEnabled ? "is-active" : ""}" data-action="toggle-smart-sort" aria-pressed="${smartSortEnabled}">${appLanguage === "ar" ? "ترتيب ذكي" : "Smart order"}</button><button class="button button-secondary button-small" data-action="toggle-task-completed">${taskShowCompleted ? (appLanguage === "ar" ? "إخفاء المكتملة" : "Hide completed") : appLanguage === "ar" ? "إظهار المكتملة" : "Show completed"}</button></div>
        </div>
        <div class="day-strip" ${dayMode ? "" : "hidden"}>${strip}</div>
      </section>
      <div class="task-groups">${sections}</div>
      ${smartPanel}${mostUsedPanel}${pausedPanel}
      <p class="data-caption">${
        session
          ? "Tasks, routines, and daily completion history are saved to your private account. Overdue tasks stay visible until you complete or reschedule them."
          : "Tasks and routines are saved in this browser in preview mode. Sign in to sync them across devices."
      }</p>`;
  }

  function dateKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function getDeadlineStatus(deadline, now = Date.now()) {
    if (deadline.status === "completed") return "completed";
    return deadline.due_at && new Date(deadline.due_at).getTime() < now
      ? "overdue"
      : "upcoming";
  }

  function getDeadlines() {
    return tasks.filter((task) => Boolean(task.due_at));
  }

  function formatDeadlineDate(value, { includeTime = true } = {}) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const locale = appLanguage === "ar" ? "ar-EG" : "en";
    const options = { weekday: "short", month: "short", day: "numeric" };
    const dateText = new Intl.DateTimeFormat(locale, options).format(date);
    const noTimeSet = date.getHours() === 23 && date.getMinutes() === 59;
    return includeTime && !noTimeSet
      ? `${dateText} · ${new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }).format(date)}`
      : dateText;
  }

  function remainingText(deadline) {
    const t = deadlineText[appLanguage];
    const due = new Date(deadline.due_at);
    const now = new Date();
    const status = getDeadlineStatus(deadline, now.getTime());
    if (status === "completed") return t.statusCompleted;
    if (status === "overdue") {
      const count = Math.max(
        1,
        Math.ceil((now.getTime() - due.getTime()) / 86400000),
      );
      return `${t.overdueBy} ${count} ${count === 1 ? t.day : t.days}`;
    }
    if (due.toDateString() === now.toDateString()) return t.today;
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (due.toDateString() === tomorrow.toDateString()) return t.tomorrow;
    const milliseconds = due.getTime() - now.getTime();
    const days = Math.floor(milliseconds / 86400000);
    if (days > 0)
      return `${days} ${days === 1 ? t.day : t.days} ${t.remaining}`;
    const hours = Math.floor(milliseconds / 3600000);
    if (hours > 0)
      return `${hours} ${hours === 1 ? t.hour : t.hours} ${t.remaining}`;
    const minutes = Math.max(1, Math.floor(milliseconds / 60000));
    return `${minutes} ${minutes === 1 ? t.minute : t.minutes} ${t.remaining}`;
  }

  function formatPriority(priority) {
    return deadlineText[appLanguage][priority] || priority;
  }

  function deadlineStats(deadlines) {
    const counts = {
      all: deadlines.length,
      upcoming: deadlines.filter(
        (deadline) => getDeadlineStatus(deadline) === "upcoming",
      ).length,
      overdue: deadlines.filter(
        (deadline) => getDeadlineStatus(deadline) === "overdue",
      ).length,
      completed: deadlines.filter(
        (deadline) => getDeadlineStatus(deadline) === "completed",
      ).length,
    };
    const t = deadlineText[appLanguage];
    return `<div class="grid deadline-stats">
      <article class="deadline-stat"><div class="deadline-stat-top"><span>${t.total}</span><span class="deadline-stat-symbol">◷</span></div><div class="deadline-stat-value">${new Intl.NumberFormat(appLanguage === "ar" ? "ar-EG" : "en").format(counts.all)}</div></article>
      <article class="deadline-stat"><div class="deadline-stat-top"><span>${t.upcoming}</span><span class="deadline-stat-symbol">↗</span></div><div class="deadline-stat-value">${new Intl.NumberFormat(appLanguage === "ar" ? "ar-EG" : "en").format(counts.upcoming)}</div></article>
      <article class="deadline-stat"><div class="deadline-stat-top"><span>${t.overdue}</span><span class="deadline-stat-symbol">!</span></div><div class="deadline-stat-value">${new Intl.NumberFormat(appLanguage === "ar" ? "ar-EG" : "en").format(counts.overdue)}</div></article>
      <article class="deadline-stat"><div class="deadline-stat-top"><span>${t.completed}</span><span class="deadline-stat-symbol">✓</span></div><div class="deadline-stat-value">${new Intl.NumberFormat(appLanguage === "ar" ? "ar-EG" : "en").format(counts.completed)}</div></article>
    </div>`;
  }

  function deadlineCard(deadline) {
    const t = deadlineText[appLanguage];
    const status = getDeadlineStatus(deadline);
    const subject = deadline.subject || subjectName(deadline.subject_id);
    const dueClass =
      status === "overdue"
        ? "is-overdue"
        : status === "upcoming" &&
            new Date(deadline.due_at).toDateString() ===
              new Date().toDateString()
          ? "is-today"
          : "";
    const description = deadline.description?.trim()
      ? `<p class="deadline-description" dir="auto">${escapeHtml(deadline.description)}</p>`
      : "";
    return `<article class="deadline-card ${dueClass} ${status === "completed" ? "is-completed" : ""}" data-deadline-id="${escapeHtml(deadline.id)}">
      <button class="deadline-check ${status === "completed" ? "checked" : ""}" data-action="deadline-toggle" data-id="${escapeHtml(deadline.id)}" aria-label="${status === "completed" ? escapeHtml(t.reopenSuccess) : escapeHtml(t.completeSuccess)}">${status === "completed" ? "✓" : ""}</button>
      <div class="deadline-main">
        <h3 class="deadline-title" dir="auto">${escapeHtml(deadline.title)}</h3>${description}
        <div class="deadline-meta"><span class="deadline-meta-item" dir="auto">◈ ${escapeHtml(subject)}</span><span class="deadline-meta-item">◷ ${escapeHtml(formatDeadlineDate(deadline.due_at))}</span></div>
      </div>
      <div class="deadline-right"><div class="deadline-badges">
        <span class="priority ${escapeHtml(deadline.priority || "medium")}">${escapeHtml(formatPriority(deadline.priority || "medium"))}</span>
        <span class="deadline-status ${status}">${escapeHtml(status === "completed" ? t.statusCompleted : status === "overdue" ? t.statusOverdue : t.pending)}</span>
      </div><span class="deadline-remaining">${escapeHtml(remainingText(deadline))}</span>
      <div class="deadline-actions"><button class="deadline-action" data-action="deadline-edit" data-id="${escapeHtml(deadline.id)}" aria-label="${escapeHtml(t.edit)}">✎</button><button class="deadline-action delete" data-action="deadline-delete" data-id="${escapeHtml(deadline.id)}" aria-label="${escapeHtml(t.delete)}">×</button></div></div>
    </article>`;
  }

  function getFilteredDeadlines() {
    const now = Date.now();
    const normalized = deadlineSearch.toLocaleLowerCase(
      appLanguage === "ar" ? "ar" : "en",
    );
    const result = getDeadlines().filter((deadline) => {
      const status = getDeadlineStatus(deadline, now);
      const subject = deadline.subject || subjectName(deadline.subject_id);
      const searchMatches =
        `${deadline.title} ${deadline.description || ""} ${subject}`
          .toLocaleLowerCase(appLanguage === "ar" ? "ar" : "en")
          .includes(normalized);
      const filterMatches =
        deadlineFilter === "all" || deadlineFilter === status;
      return searchMatches && filterMatches;
    });
    const priority = { urgent: 0, high: 1, medium: 2, low: 3 };
    result.sort((a, b) => {
      if (deadlineSort === "priority")
        return (
          (priority[a.priority] ?? 2) - (priority[b.priority] ?? 2) ||
          new Date(a.due_at) - new Date(b.due_at)
        );
      if (deadlineSort === "recent")
        return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      return new Date(a.due_at) - new Date(b.due_at);
    });
    return result;
  }

  function deadlineDateRange(deadline) {
    const due = new Date(deadline.due_at);
    const start = deadline.starts_at ? new Date(deadline.starts_at) : due;
    const first = Number.isNaN(start.getTime()) || start > due ? due : start;
    return { start: dateKey(first), end: dateKey(due) };
  }

  function calendarView(deadlines) {
    const t = deadlineText[appLanguage];
    const locale = appLanguage === "ar" ? "ar-EG" : "en";
    const mode = ["month", "week", "day"].includes(deadlineCalendarMode)
      ? deadlineCalendarMode
      : "month";
    const today = dateKey(new Date());
    const weekdayLabels = t.daysShort
      .map((day) => `<span class="calendar-weekday">${day}</span>`)
      .join("");
    const modeSwitch = `<div class="sz-fullcal-mode" role="group" aria-label="${t.calendar}">${[
      ["month", appLanguage === "ar" ? "شهر" : "Month"],
      ["week", appLanguage === "ar" ? "أسبوع" : "Week"],
      ["day", appLanguage === "ar" ? "يوم" : "Day"],
    ]
      .map(
        ([value, label]) =>
          `<button type="button" class="${mode === value ? "is-active" : ""}" data-action="deadline-calendar-mode" data-mode="${value}" aria-pressed="${mode === value}">${label}</button>`,
      )
      .join("")}</div>`;
    const eventTone = (deadline) => {
      const status = getDeadlineStatus(deadline);
      if (status === "completed") return "tone-done";
      if (status === "overdue") return "tone-overdue";
      if (deadline.priority === "high") return "tone-red";
      if (deadline.priority === "low") return "tone-slate";
      return "tone-blue";
    };
    const timeLabel = (deadline) => {
      const due = new Date(deadline.due_at);
      if (Number.isNaN(due.getTime())) return "";
      if (due.getHours() === 23 && due.getMinutes() === 59)
        return appLanguage === "ar" ? "طوال اليوم" : "All day";
      return new Intl.DateTimeFormat(locale, {
        hour: "numeric",
        minute: "2-digit",
      }).format(due);
    };
    const selected = deadlines.filter((deadline) => {
      const range = deadlineDateRange(deadline);
      return (
        selectedDeadlineDate >= range.start && selectedDeadlineDate <= range.end
      );
    });
    const selectedLabel = selectedDeadlineDate
      ? new Intl.DateTimeFormat(locale, { dateStyle: "full" }).format(
          new Date(`${selectedDeadlineDate}T12:00:00`),
        )
      : t.noDate;
    const selection = `<div class="calendar-selection">${panelHeading(escapeHtml(selectedLabel), `${selected.length} ${selected.length === 1 ? t.deadline : t.deadlines}`)}<div class="deadline-list">${selected.map(deadlineCard).join("") || `<div class="empty-state">${t.noDateItems}</div>`}</div></div>`;

    if (mode === "week" || mode === "day") {
      const anchor =
        parseLocalDateKey(selectedDeadlineDate) ||
        new Date(deadlineMonth.getFullYear(), deadlineMonth.getMonth(), 1);
      const dayStart =
        mode === "week" ? new Date(anchor) : new Date(anchor);
      if (mode === "week") dayStart.setDate(anchor.getDate() - anchor.getDay());
      const periodDays =
        mode === "week"
          ? Array.from({ length: 7 }, (_, index) => {
              const date = new Date(dayStart);
              date.setDate(dayStart.getDate() + index);
              return date;
            })
          : [dayStart];
      const periodLabel =
        mode === "week"
          ? `${new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }).format(periodDays[0])} – ${new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", year: "numeric" }).format(periodDays[6])}`
          : new Intl.DateTimeFormat(locale, { dateStyle: "full" }).format(
              periodDays[0],
            );
      const weekGrid = `<div class="sz-week-grid">${periodDays
        .map((date) => {
          const key = dateKey(date);
          const dayEvents = deadlines.filter((deadline) => {
            const range = deadlineDateRange(deadline);
            return key >= range.start && key <= range.end;
          });
          return `<div class="sz-week-col ${key === today ? "is-today" : ""}"><header><button type="button" data-action="calendar-select" data-date="${key}" aria-label="${escapeHtml(new Intl.DateTimeFormat(locale, { dateStyle: "full" }).format(date))}"><strong>${new Intl.DateTimeFormat(locale, { weekday: "short" }).format(date)}</strong><span>${new Intl.NumberFormat(locale).format(date.getDate())}</span></button></header>${dayEvents
            .map(
              (deadline) =>
                `<button type="button" class="sz-week-event ${eventTone(deadline)} ${getDeadlineStatus(deadline) === "completed" ? "is-done" : ""}" data-action="deadline-edit" data-id="${escapeHtml(deadline.id)}"><strong dir="auto">${escapeHtml(deadline.title)}</strong><small>${escapeHtml(timeLabel(deadline))}</small></button>`,
            )
            .join("")}</div>`;
        })
        .join("")}</div>`;
      const dayLabel = new Intl.DateTimeFormat(locale, {
        weekday: "long",
        month: "long",
        day: "numeric",
      }).format(periodDays[0]);
      const dayEvents = deadlines.filter((deadline) => {
        const range = deadlineDateRange(deadline);
        return (
          selectedDeadlineDate >= range.start &&
          selectedDeadlineDate <= range.end
        );
      });
      const dayAgenda = `<div class="sz-day-agenda">${dayEvents
        .map((deadline) => {
          const status = getDeadlineStatus(deadline);
          return `<div class="sz-day-row ${eventTone(deadline)} ${status === "completed" ? "is-done" : ""} ${status === "overdue" ? "is-overdue" : ""}"><time>${escapeHtml(timeLabel(deadline))}</time><div><strong dir="auto">${escapeHtml(deadline.title)}</strong><small dir="auto">${escapeHtml(deadline.subject || subjectName(deadline.subject_id) || "")} · ${escapeHtml(status === "completed" ? t.statusCompleted : status === "overdue" ? t.statusOverdue : t.pending)}</small></div><button type="button" class="icon-button" data-action="deadline-edit" data-id="${escapeHtml(deadline.id)}" aria-label="${escapeHtml(t.edit)}">✎</button></div>`;
        })
        .join("") || `<div class="empty-state"><strong>${t.noDateItems}</strong></div>`}</div>`;
      return `<div class="calendar-header"><div><h2 class="calendar-month" id="calendar-month">${escapeHtml(periodLabel)}</h2><p class="calendar-subtitle">${mode === "week" ? (appLanguage === "ar" ? "خطة الأسبوع" : "Week at a glance") : escapeHtml(dayLabel)}</p></div><div class="calendar-nav">${modeSwitch}<button class="button button-secondary button-small" data-action="calendar-today">${appLanguage === "ar" ? "اليوم" : "Today"}</button><button class="icon-button" data-action="calendar-prev" aria-label="${appLanguage === "ar" ? "السابق" : "Previous"}">‹</button><button class="icon-button" data-action="calendar-next" aria-label="${appLanguage === "ar" ? "التالي" : "Next"}">›</button></div></div>
        ${mode === "week" ? weekGrid : dayAgenda}
        ${mode === "week" ? selection : ""}`;
    }

    const year = deadlineMonth.getFullYear();
    const month = deadlineMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const startOffset = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const weekCount = Math.ceil((startOffset + daysInMonth) / 7);
    const startOfGrid = new Date(year, month, 1 - startOffset);
    const weeks = Array.from({ length: weekCount }, (_, weekIndex) => {
      const weekStart = new Date(startOfGrid);
      weekStart.setDate(startOfGrid.getDate() + weekIndex * 7);
      const dayDates = Array.from({ length: 7 }, (_, dayIndex) => {
        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + dayIndex);
        const key = dateKey(date);
        const hasDeadlines = deadlines.some((deadline) => {
          const range = deadlineDateRange(deadline);
          return key >= range.start && key <= range.end;
        });
        const classes = ["calendar-day"];
        if (date.getMonth() !== month) classes.push("outside-month");
        if (key === today) classes.push("today");
        if (key === selectedDeadlineDate) classes.push("selected");
        if (hasDeadlines) classes.push("has-deadlines");
        return {
          date,
          key,
          button: `<button class="${classes.join(" ")}" data-action="calendar-select" data-date="${key}" aria-label="${escapeHtml(new Intl.DateTimeFormat(locale, { dateStyle: "full" }).format(date))}" aria-pressed="${key === selectedDeadlineDate}">${new Intl.NumberFormat(locale).format(date.getDate())}</button>`,
        };
      });

      const weekStartKey = dayDates[0].key;
      const weekEndKey = dayDates[6].key;
      const laneEnds = [];
      const bars = deadlines
        .map((deadline) => {
          const range = deadlineDateRange(deadline);
          if (range.start > weekEndKey || range.end < weekStartKey) return null;
          const startColumn = Math.max(
            0,
            Math.round(
              (new Date(`${range.start}T00:00:00`) - weekStart) / 86400000,
            ),
          );
          const endColumn = Math.min(
            6,
            Math.round(
              (new Date(`${range.end}T00:00:00`) - weekStart) / 86400000,
            ),
          );
          let lane = laneEnds.findIndex(
            (lastColumn) => lastColumn < startColumn,
          );
          if (lane < 0) lane = laneEnds.length;
          laneEnds[lane] = endColumn;
          const status = getDeadlineStatus(deadline);
          const classNames = ["calendar-span-bar"];
          if (status === "overdue") classNames.push("overdue");
          if (status === "completed") classNames.push("completed");
          if (startColumn === endColumn) classNames.push("single-day");
          const label = range.start >= weekStartKey ? deadline.title : "";
          return `<span class="${classNames.join(" ")}" style="grid-column:${startColumn + 1}/${endColumn + 2};grid-row:${lane + 1}" title="${escapeHtml(deadline.title)}" aria-label="${escapeHtml(deadline.title)}">${escapeHtml(label)}</span>`;
        })
        .filter(Boolean)
        .join("");
      return `<div class="calendar-week"><div class="calendar-week-days">${dayDates.map((item) => item.button).join("")}</div><div class="calendar-week-bars" style="grid-template-rows:repeat(${Math.max(1, laneEnds.length)},18px)">${bars}</div></div>`;
    }).join("");
    const monthLabel = new Intl.DateTimeFormat(locale, {
      month: "long",
      year: "numeric",
    }).format(deadlineMonth);
    return `<div class="calendar-header"><h2 class="calendar-month" id="calendar-month">${escapeHtml(monthLabel)}</h2><div class="calendar-nav">${modeSwitch}<button class="button button-secondary button-small" data-action="calendar-today">${t.currentMonth}</button><button class="icon-button" data-action="calendar-prev" aria-label="${t.previous}">‹</button><button class="icon-button" data-action="calendar-next" aria-label="${t.next}">›</button></div></div>
      <div class="calendar-grid" role="grid" aria-labelledby="calendar-month"><div class="calendar-weekdays">${weekdayLabels}</div>${weeks}</div>
      ${selection}`;
  }

  function deadlinesPage() {
    const t = deadlineText[appLanguage];
    const deadlines = getDeadlines();
    const filtered = getFilteredDeadlines();
    const activeCount = filtered.length;
    const list = activeCount
      ? filtered.map(deadlineCard).join("")
      : `<div class="empty-state"><strong>${deadlines.length ? t.noResults : t.noDeadlines}</strong>${deadlines.length ? t.noResultsHint : t.noDeadlinesHint}</div>`;
    const filterOptions = [
      ["all", t.all],
      ["upcoming", t.filterUpcoming],
      ["overdue", t.filterOverdue],
      ["completed", t.filterCompleted],
    ]
      .map(
        ([value, label]) =>
          `<button class="deadline-filter ${deadlineFilter === value ? "selected" : ""}" data-deadline-filter="${value}" aria-pressed="${deadlineFilter === value}">${label}</button>`,
      )
      .join("");
    const listControls = `<div class="deadline-toolbar"><div class="deadline-filters" role="group" aria-label="${t.title} filters">${filterOptions}</div><div class="deadline-controls"><label class="search-box"><span>⌕</span><input id="deadline-search" type="search" dir="auto" value="${escapeHtml(deadlineSearch)}" placeholder="${t.search}" aria-label="${t.search}"></label><select class="filter-select" id="deadline-sort" aria-label="${t.priorityLabel}"><option value="due" ${deadlineSort === "due" ? "selected" : ""}>${t.dueDate}</option><option value="priority" ${deadlineSort === "priority" ? "selected" : ""}>${t.priority}</option><option value="recent" ${deadlineSort === "recent" ? "selected" : ""}>${t.recentlyAdded}</option></select></div></div>`;
    const viewControls = `<div class="deadline-view-switch" role="group"><button class="deadline-view-button ${deadlineView === "list" ? "selected" : ""}" data-deadline-view="list" aria-pressed="${deadlineView === "list"}">☷ ${t.list}</button><button class="deadline-view-button ${deadlineView === "calendar" ? "selected" : ""}" data-deadline-view="calendar" aria-pressed="${deadlineView === "calendar"}">▦ ${t.calendar}</button></div>`;
    const display =
      deadlineView === "list"
        ? `<div class="deadline-list-heading"><strong>${t.title}</strong><span>${t.showing} ${activeCount} ${activeCount === 1 ? t.deadline : t.deadlines}</span></div><div class="deadline-list">${list}</div>`
        : calendarView(filtered);
    return `${pageHeading(t.eyebrow, t.title, t.subtitle, `<button class="button button-primary" data-action="deadline-add"><span class="button-icon">＋</span> ${t.add}</button>`)}
      ${deadlineStats(deadlines)}
      <section class="panel"><div class="deadline-toolbar-row">${listControls}${viewControls}</div>${deadlinesLoading ? `<div class="deadline-loading"><div class="skeleton-line"></div><div class="skeleton-line"></div><div class="skeleton-line"></div></div>` : display}</section>
      <p class="data-caption">${session ? t.reminderNote : t.sampleNote}</p>`;
  }

  function plannerPage() {
    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
    const todayName = new Intl.DateTimeFormat(
      appLanguage === "ar" ? "ar-EG" : "en-US",
      { weekday: "long" },
    ).format(new Date());
    const dayLabels =
      appLanguage === "ar"
        ? ["الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"]
        : days;
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const dayCards = days
      .map((day) => {
        const blocks = schedule.filter((item) => {
          if (!item.starts_at) return item.day === day;
          const startsAt = new Date(item.starts_at);
          const weekdayMatches =
            new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(
              startsAt,
            ) === day;
          if (item.recurrence === "daily") return true;
          if (item.recurrence === "weekly") return weekdayMatches;
          return startsAt >= weekStart && startsAt < weekEnd && weekdayMatches;
        });
        const label = dayLabels[days.indexOf(day)];
        return `<article class="planner-day ${day === todayName ? "today" : ""}"><div class="planner-day-head">${label}<small>${blocks.length ? `${blocks.length} block` : "Open day"}</small></div>${blocks.length ? blocks.map((block) => `<div class="planner-block"><time>${escapeHtml(block.time || new Intl.DateTimeFormat(appLanguage, { hour: "2-digit", minute: "2-digit" }).format(new Date(block.starts_at)))} · ${escapeHtml(block.length || `${Math.round((new Date(block.ends_at) - new Date(block.starts_at)) / 60000)} min`)}</time><strong>${escapeHtml(block.title)}</strong><span>${escapeHtml(block.subject || subjectName(block.subject_id))}</span>${block.id ? `<div class="card-actions"><button class="text-button" data-action="schedule-edit" data-id="${escapeHtml(block.id)}">${featureText("edit")}</button><button class="text-button" data-action="schedule-delete" data-id="${escapeHtml(block.id)}">${featureText("delete")}</button></div>` : ""}</div>`).join("") : `<p class="empty-day">No study blocks planned.</p>`}</article>`;
      })
      .join("");
    const plannedMinutes = schedule.reduce(
      (sum, block) =>
        sum +
        (block.starts_at && block.ends_at
          ? Math.max(
              0,
              (new Date(block.ends_at) - new Date(block.starts_at)) / 60000,
            )
          : Number.parseInt(block.length, 10) || 0),
      0,
    );
    return `${pageHeading("WEEK AT A GLANCE", "Study planner", "Make a realistic plan, then give yourself room to adapt.", `<button class="button button-primary" data-action="schedule-add">＋ Plan a block</button>`)}<section class="panel">${panelHeading("This week", session ? "Your planned study sessions" : "Planned sessions · preview")}<div class="grid planner-grid">${dayCards}</div></section><div class="grid dashboard-grid section-spacer"><section class="panel">${panelHeading("Planned study time", "Based on the blocks shown above")}<div class="metric-large">${(plannedMinutes / 60).toFixed(1)}h <span class="metric-caption">planned</span></div></section><section class="panel">${panelHeading("Planning tip")}<p class="panel-copy">Leave a little breathing room between study blocks. A flexible plan is easier to keep than a perfect one.</p></section></div><p class="data-caption">${session ? "Study blocks are saved to your private account." : "Sample blocks are shown in preview mode. Sign in to create and sync your own schedule."}</p>`;
  }

  function subjectsPage() {
    return `${pageHeading("YOUR COURSES", "Subjects", "A quick view of your courses, credits, and learning progress.", `<button class="button button-primary" data-action="subject-add">＋ Add subject</button>`)}<div class="grid subject-grid">${subjects.map((subject) => `<article class="subject-card"><div class="subject-card-top"><span class="subject-color" style="background:${escapeHtml(subject.color)}"></span><span class="task-meta">${Number(subject.credit_hours ?? subject.credits ?? 0)} credits</span></div><h3>${escapeHtml(subject.name)}</h3><p>${escapeHtml(subject.description || "Keep your notes, tasks, and study sessions connected to this course.")}</p><div class="progress-track"><div class="progress-fill" style="width:${subject.progress ?? 0}%"></div></div><div class="subject-card-foot"><span>Learning progress</span><span>${subject.progress == null ? "—" : `${subject.progress}%`}</span></div>${subject.id && session ? `<div class="card-actions"><button class="text-button" data-action="subject-edit" data-id="${escapeHtml(subject.id)}">${featureText("edit")}</button><button class="text-button" data-action="subject-delete" data-id="${escapeHtml(subject.id)}">${featureText("delete")}</button></div>` : ""}</article>`).join("") || `<div class="empty-state"><strong>No subjects yet</strong>Add your first course to start organizing your study workspace.</div>`}</div><p class="data-caption">${session ? "Subject details are loaded from your private account." : "Preview content. Sign in to create and sync your own subjects."}</p>`;
  }

  function plannerBlocksPage() {
    return schedule;
  }

  function filesPage() {
    return `${pageHeading("STUDY MATERIALS", "Your files", "A tidy home for resources from every course.", `<button class="button button-primary" data-action="file-add">↑ Upload file</button>`)}<div class="grid resource-grid">${sampleFiles.map((file) => `<article class="item-card"><span class="stat-icon">▤</span><h3 dir="auto">${escapeHtml(file.name)}</h3><p dir="auto">${escapeHtml(file.subject || subjectName(file.subject_id))} · ${escapeHtml(file.type || file.mime_type || "File")}</p>${session && file.id ? `<div class="card-actions"><button class="text-button" data-action="file-download" data-id="${escapeHtml(file.id)}">${featureText("download")}</button><button class="text-button" data-action="file-delete" data-id="${escapeHtml(file.id)}">${featureText("delete")}</button></div>` : ""}</article>`).join("")}${session && !sampleFiles.length ? `<div class="empty-state"><strong>No files uploaded yet</strong>Upload a file to keep your study materials in your private workspace.</div>` : ""}</div><p class="data-caption">${session ? "Files are stored in a private account-owned bucket; downloads use short-lived signed links." : "Sample file cards are shown in preview. Sign in to upload files to private storage."}</p>`;
  }

  const NOTE_TEMPLATES = {
    blank: { label: "Blank note", title: "", content: "" },
    summary: {
      label: "Lesson summary",
      title: "Lesson summary",
      content:
        "<h2>Lesson summary</h2><p><strong>Topic:</strong> </p><h3>Key ideas</h3><ul><li></li></ul><h3>Questions to revisit</h3><ul><li></li></ul><h3>Takeaway</h3><p></p>",
    },
    formulas: {
      label: "Important formulas",
      title: "Important formulas",
      content:
        '<h2>Important formulas</h2><ul class="rt-checklist"><li data-checked="false">Formula · when to use it</li><li data-checked="false">Formula · when to use it</li></ul><p><strong>Watch out for:</strong> </p>',
    },
    questions: {
      label: "Questions & answers",
      title: "Questions & answers",
      content:
        "<h2>Questions & answers</h2><h3>Question 1</h3><p><strong>Answer:</strong> </p><h3>Question 2</h3><p><strong>Answer:</strong> </p>",
    },
    revision: {
      label: "Exam revision",
      title: "Exam revision",
      content:
        '<h2>Exam revision</h2><p><strong>Exam date:</strong> </p><h3>Must know</h3><ul class="rt-checklist"><li data-checked="false"></li></ul><h3>Practice</h3><ul class="rt-checklist"><li data-checked="false"></li></ul><h3>Last-minute reminders</h3><p></p>',
    },
    lecture: {
      label: "Lecture notes",
      title: "Lecture notes",
      content:
        '<h2>Lecture notes</h2><p><strong>Date:</strong> </p><h3>Main points</h3><ul><li></li></ul><h3>Examples</h3><p></p><h3>Follow-up</h3><ul class="rt-checklist"><li data-checked="false"></li></ul>',
    },
    ideas: {
      label: "Quick ideas",
      title: "Quick ideas",
      content: "<h2>Quick ideas</h2><ul><li></li><li></li><li></li></ul>",
    },
  };

  const RICH_DROP_TAGS = new Set([
    "script",
    "style",
    "iframe",
    "object",
    "embed",
    "link",
    "meta",
    "form",
    "input",
    "button",
    "textarea",
    "select",
    "option",
    "svg",
    "math",
    "template",
    "base",
  ]);
  const RICH_ALLOWED_TAGS = new Set([
    "p",
    "br",
    "div",
    "span",
    "strong",
    "b",
    "em",
    "i",
    "u",
    "s",
    "strike",
    "del",
    "h1",
    "h2",
    "h3",
    "h4",
    "ul",
    "ol",
    "li",
    "blockquote",
    "a",
    "img",
    "hr",
    "pre",
    "code",
    "font",
    "sub",
    "sup",
  ]);
  const RICH_SAFE_STYLE =
    /^(color|background-color|font-size|text-align|direction|font-family|font-weight|font-style|text-decoration)$/;
  const RICH_SAFE_STYLE_VALUE = /^[#a-zA-Z0-9.,%()\s_-]+$/;

  function sanitizeRichText(html) {
    if (!html) return "";
    const doc = new DOMParser().parseFromString(
      `<div id="rt-root">${html}</div>`,
      "text/html",
    );
    const root = doc.getElementById("rt-root");
    if (!root) return "";
    const cleanAttributes = (element) => {
      const tag = element.tagName.toLowerCase();
      [...element.attributes].forEach((attribute) => {
        const name = attribute.name.toLowerCase();
        const value = attribute.value;
        if (
          name.startsWith("on") ||
          name === "id" ||
          name === "contenteditable"
        ) {
          element.removeAttribute(attribute.name);
          return;
        }
        if (tag === "a" && name === "href") {
          if (!/^(https?:|mailto:)/i.test(value.trim()))
            element.removeAttribute(attribute.name);
          return;
        }
        if ((tag === "img" && name === "src") || name === "href") {
          if (!/^https:\/\//i.test(value.trim()))
            element.removeAttribute(attribute.name);
          return;
        }
        if (name === "style") {
          const safe = value
            .split(";")
            .map((declaration) => {
              const [property, ...rest] = declaration.split(":");
              const propertyName = (property || "").trim().toLowerCase();
              const propertyValue = rest.join(":").trim();
              if (
                !RICH_SAFE_STYLE.test(propertyName) ||
                !propertyValue ||
                !RICH_SAFE_STYLE_VALUE.test(propertyValue)
              )
                return "";
              if (/url\s*\(|expression/i.test(propertyValue)) return "";
              return `${propertyName}:${propertyValue}`;
            })
            .filter(Boolean)
            .join(";");
          if (safe) element.setAttribute("style", safe);
          else element.removeAttribute("style");
          return;
        }
        if (
          tag === "li" &&
          name === "data-checked" &&
          (value === "true" || value === "false")
        )
          return;
        if (tag === "ul" && name === "class" && value === "rt-checklist")
          return;
        if (tag === "a" && (name === "target" || name === "rel")) return;
        if (tag === "img" && (name === "alt" || name === "loading")) return;
        element.removeAttribute(attribute.name);
      });
      if (tag === "a") {
        element.setAttribute("target", "_blank");
        element.setAttribute("rel", "noopener noreferrer nofollow");
      }
      if (tag === "img") {
        element.setAttribute("loading", "lazy");
        if (!element.getAttribute("alt")) element.setAttribute("alt", "");
      }
    };
    const walk = (node) => {
      [...node.childNodes].forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) return;
        if (child.nodeType !== Node.ELEMENT_NODE) {
          child.remove();
          return;
        }
        const tag = child.tagName.toLowerCase();
        if (RICH_DROP_TAGS.has(tag)) {
          child.remove();
          return;
        }
        if (!RICH_ALLOWED_TAGS.has(tag)) {
          const fragment = doc.createDocumentFragment();
          while (child.firstChild) fragment.appendChild(child.firstChild);
          child.replaceWith(fragment);
          walk(node);
          return;
        }
        cleanAttributes(child);
        walk(child);
      });
    };
    walk(root);
    return root.innerHTML;
  }

  function noteContentHtml(note) {
    if (isMediaNote(note)) {
      const desc = escapeHtml(String(note?.description || "")).replace(/\n/g, "<br>");
      return desc ? `<p>${desc}</p>` : "";
    }
    const raw = String(note?.content || "");
    if (!raw) return "";
    if (/<[a-z][\s\S]*>/i.test(raw)) return sanitizeRichText(raw);
    return raw
      .split(/\n{2,}/)
      .map(
        (paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`,
      )
      .join("");
  }

  function notePlainText(note) {
    if (isMediaNote(note)) {
      const desc = String(note?.description || "").replace(/\s+/g, " ").trim();
      const names = noteAttachments(note).map((a) => a?.name || "").filter(Boolean).join(" ");
      return `${desc} ${names}`.trim();
    }
    const html = noteContentHtml(note);
    if (!html) return "";
    try {
      const doc = new DOMParser().parseFromString(html, "text/html");
      return (doc.body.textContent || "").replace(/\s+/g, " ").trim();
    } catch {
      return "";
    }
  }

  function noteColor(note) {
    if (note.color && /^#[0-9a-f]{6}$/i.test(note.color)) return note.color;
    const palette = [
      getThemeColor("--color-primary", "#6b7280"),
      getThemeColor("--color-secondary", "#d1d5db"),
      getThemeColor("--color-warning", "#fbbf24"),
      getThemeColor("--color-muted", "#9ca3af"),
    ];
    let hash = 0;
    for (const char of String(note.id || note.title || "note"))
      hash = (hash * 31 + char.charCodeAt(0)) % 997;
    return palette[hash % palette.length];
  }

  function notesPage() {
    if (notesView === "media") return mediaNotesPage();

    // Main notes view: keep text notes behavior; media notes live in dedicated section.
    const textNotes = notes.filter((note) => !isMediaNote(note) && noteTypeOf(note) !== "voice");
    const filtered = textNotes
      .filter((note) => {
        const text =
          `${note.title || ""} ${notePlainText(note)} ${note.subject || subjectName(note.subject_id)}`.toLowerCase();
        const searchMatches =
          !noteSearch || text.includes(noteSearch.toLowerCase());
        const subjectMatches =
          !noteSubjectFilter ||
          String(note.subject_id || "") === noteSubjectFilter;
        return searchMatches && subjectMatches;
      })
      .sort((a, b) => {
        if (Boolean(b.is_favorite) !== Boolean(a.is_favorite))
          return (
            Number(Boolean(b.is_favorite)) - Number(Boolean(a.is_favorite))
          );
        if (noteSort === "title")
          return String(a.title || "").localeCompare(
            String(b.title || ""),
            appLanguage === "ar" ? "ar" : "en",
          );
        if (noteSort === "created")
          return new Date(b.created_at || 0) - new Date(a.created_at || 0);
        return new Date(b.updated_at || 0) - new Date(a.updated_at || 0);
      });
    const card = (note) => {
      const preview = notePlainText(note).slice(0, 180);
      const updated = note.updated_at
        ? new Intl.DateTimeFormat(appLanguage === "ar" ? "ar-EG" : "en", {
            dateStyle: "medium",
          }).format(new Date(note.updated_at))
        : note.updated || "";
      const subject = note.subject || subjectName(note.subject_id);
      return `<article class="note-card" style="--note-color:${escapeHtml(noteColor(note))}" data-note-id="${escapeHtml(note.id)}">
        <button class="note-card-main" data-action="note-open" data-id="${escapeHtml(note.id)}" aria-label="${escapeHtml(appLanguage === "ar" ? `فتح ${note.title}` : `Open ${note.title}`)}">
          <span class="note-card-subject">${escapeHtml(subject || (appLanguage === "ar" ? "بلا مادة" : "No subject"))}</span>
          <h3 dir="auto">${escapeHtml(note.title || (appLanguage === "ar" ? "ملاحظة بدون عنوان" : "Untitled note"))}</h3>
          <p class="note-card-preview" dir="auto">${escapeHtml(preview || (appLanguage === "ar" ? "ملاحظة فارغة" : "Empty note"))}</p>
          <span class="note-card-date">${escapeHtml(updated)}</span>
        </button>
        <div class="note-card-actions">
          <button class="task-icon ${note.is_favorite ? "pinned" : ""}" data-action="note-pin" data-id="${escapeHtml(note.id)}" aria-label="${note.is_favorite ? (appLanguage === "ar" ? "إلغاء التثبيت" : "Unpin note") : appLanguage === "ar" ? "تثبيت الملاحظة" : "Pin note"}" aria-pressed="${Boolean(note.is_favorite)}">${note.is_favorite ? "★" : "☆"}</button>
          <button class="task-icon" data-action="note-edit" data-id="${escapeHtml(note.id)}" aria-label="${appLanguage === "ar" ? "تعديل الملاحظة" : "Edit note"}">✎</button>
          <button class="task-icon danger" data-action="note-delete" data-id="${escapeHtml(note.id)}" aria-label="${appLanguage === "ar" ? "حذف الملاحظة" : "Delete note"}">×</button>
        </div>
      </article>`;
    };
    const pinned = filtered.filter((note) => note.is_favorite);
    const rest = filtered.filter((note) => !note.is_favorite);
    const subjectOptions = `<option value="">${appLanguage === "ar" ? "كل المواد" : "All subjects"}</option>${subjects.map((subject) => `<option value="${escapeHtml(subject.id)}" ${String(noteSubjectFilter) === String(subject.id) ? "selected" : ""}>${escapeHtml(subject.name)}</option>`).join("")}`;
    const templateOptions = Object.entries(NOTE_TEMPLATES)
      .map(
        ([key, template]) =>
          `<option value="${key}">${escapeHtml(template.label)}</option>`,
      )
      .join("");
    const body = filtered.length
      ? `${pinned.length ? `<section class="notes-group"><h2 class="notes-group-title">★ ${appLanguage === "ar" ? "مثبتة" : "Pinned"}</h2><div class="grid notes-grid">${pinned.map(card).join("")}</div></section>` : ""}
         ${rest.length ? `<section class="notes-group"><h2 class="notes-group-title">${appLanguage === "ar" ? "كل الملاحظات" : "All notes"}</h2><div class="grid notes-grid">${rest.map(card).join("")}</div></section>` : ""}`
      : `<div class="empty-state notes-empty"><strong>${noteSearch || noteSubjectFilter ? (appLanguage === "ar" ? "لا توجد نتائج" : "No notes match your search") : appLanguage === "ar" ? "ابدأ دفترك الرقمي" : "Start your digital notebook"}</strong>${noteSearch || noteSubjectFilter ? (appLanguage === "ar" ? "جرّب بحثًا أو مادة أخرى." : "Try another search or subject.") : appLanguage === "ar" ? "أنشئ ملاحظة بتنسيق غني أو ابدأ من قالب جاهز." : "Create a rich text note or start from a ready-made template."}<button class="button button-primary button-small" data-action="note-add">＋ ${appLanguage === "ar" ? "ملاحظة جديدة" : "New note"}</button></div>`;
    return `${pageHeading(
      "YOUR KNOWLEDGE VAULT",
      appLanguage === "ar" ? "الملاحظات" : "Notes",
      appLanguage === "ar"
        ? "اكتب ونسّق وثبّت ما يهمك — مع حفظ تلقائي."
        : "Write, format, and pin what matters — with autosave.",
      `<div class="notes-heading-actions"><select class="filter-select" id="note-template" aria-label="${appLanguage === "ar" ? "قالب الملاحظة" : "Note template"}">${templateOptions}</select><button class="button button-primary" data-action="note-add">${appLanguage === "ar" ? "ملاحظة جديدة" : "New note"}</button></div>`,
    )}
      <section class="panel notes-toolbar">
        <label class="search-box"><span aria-hidden="true">🔎</span><input id="note-search" type="search" dir="auto" value="${escapeHtml(noteSearch)}" placeholder="${appLanguage === "ar" ? "ابحث في الملاحظات النصية" : "Search text notes"}" aria-label="${appLanguage === "ar" ? "ابحث في الملاحظات" : "Search notes"}"></label>
        <select class="filter-select" id="note-subject-filter" aria-label="${appLanguage === "ar" ? "تصفية حسب المادة" : "Filter by subject"}">${subjectOptions}</select>
        <select class="filter-select" id="note-sort" aria-label="${appLanguage === "ar" ? "ترتيب الملاحظات" : "Sort notes"}">
          <option value="updated" ${noteSort === "updated" ? "selected" : ""}>${appLanguage === "ar" ? "الأحدث تحديثًا" : "Recently updated"}</option>
          <option value="created" ${noteSort === "created" ? "selected" : ""}>${appLanguage === "ar" ? "الأحدث إنشاءً" : "Recently created"}</option>
          <option value="title" ${noteSort === "title" ? "selected" : ""}>${appLanguage === "ar" ? "الاسم" : "Title A–Z"}</option>
        </select>
        <span class="notes-count">${new Intl.NumberFormat(appLanguage === "ar" ? "ar-EG" : "en").format(filtered.length)} ${appLanguage === "ar" ? "ملاحظة نصية" : (filtered.length === 1 ? "text note" : "text notes")}</span>
      </section>
      ${body}
      <p class="data-caption">${session
        ? (appLanguage === "ar" ? "الملاحظات النصية خاصة بحسابك. ملاحظات الوسائط في قسمها المستقل." : "Text notes are private to your account. Media notes live in their dedicated section.")
        : (appLanguage === "ar" ? "الملاحظات محفوظة محليًا في وضع المعاينة. سجّل الدخول للمزامنة." : "Notes are saved locally in preview mode. Sign in to sync across devices.")}</p>`;
  }

  function mediaTypeLabel(kind) {
    const ar = appLanguage === "ar";
    if (kind === "video") return ar ? "فيديو" : "Video";
    return ar ? "صورة" : "Image";
  }

  function formatBytesShort(bytes) {
    const n = Number(bytes) || 0;
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  }

  async function readFileAsAttachment(file, kind) {
    const id = (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : `media-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    const blob = file.slice(0, file.size, file.type || (kind === "video" ? "video/mp4" : "image/jpeg"));
    await saveMediaBlob(id, blob, { name: file.name || "", type: file.type || blob.type || "", size: file.size || blob.size || 0, kind });
    const att = {
      id,
      kind,
      name: String(file.name || `${kind}-${id}`),
      mime: String(file.type || blob.type || ""),
      size: Number(file.size || blob.size || 0),
      duration: 0,
      width: 0,
      height: 0,
      createdAt: new Date().toISOString(),
      localKey: id,
      storagePath: "",
      bucket: "note-media",
    };
    if (kind === "video") {
      try {
        att.duration = await getVideoDuration(blob);
      } catch {}
    }
    return att;
  }

  function getVideoDuration(blob) {
    return new Promise((resolve) => {
      try {
        const url = URL.createObjectURL(blob);
        const video = document.createElement("video");
        video.preload = "metadata";
        video.onloadedmetadata = () => {
          const d = Number(video.duration) || 0;
          try { URL.revokeObjectURL(url); } catch {}
          resolve(Number.isFinite(d) ? d : 0);
        };
        video.onerror = () => { try { URL.revokeObjectURL(url); } catch {}; resolve(0); };
        video.src = url;
      } catch { resolve(0); }
    });
  }

  function formatDurationShort(sec) {
    const s = Math.max(0, Math.floor(Number(sec) || 0));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
  }

  function mediaAttachmentThumbMarkup(att) {
    const ar = appLanguage === "ar";
    if (att.kind === "video") {
      return `<div class="media-thumb media-thumb-video" data-media-key="${escapeHtml(att.localKey || att.id)}">
        <div class="media-thumb-placeholder">🎬</div>
        <span class="media-thumb-badge">${escapeHtml(formatDurationShort(att.duration))}</span>
      </div>`;
    }
    return `<div class="media-thumb media-thumb-image" data-media-key="${escapeHtml(att.localKey || att.id)}">
      <div class="media-thumb-placeholder">🖼️</div>
    </div>`;
  }

  async function hydrateMediaThumbs(root = document) {
    const els = root.querySelectorAll('.media-thumb[data-media-key]');
    for (const el of els) {
      const key = el.getAttribute('data-media-key');
      if (!key || el.dataset.hydrated === '1') continue;
      try {
        const rec = await getMediaBlob(key);
        if (!rec?.blob) continue;
        const url = await getMediaObjectUrl(key);
        if (!url) continue;
        if (el.classList.contains('media-thumb-image')) {
          el.innerHTML = `<img src="${url}" alt="" loading="lazy" />`;
        } else if (el.classList.contains('media-thumb-video')) {
          // use video element for thumbnail frame
          el.innerHTML = `<video muted playsinline preload="metadata" src="${url}#t=0.1"></video><span class="media-thumb-badge">${escapeHtml(el.querySelector('.media-thumb-badge')?.textContent || '')}</span>`;
        }
        el.dataset.hydrated = '1';
      } catch {
        /* keep placeholder */
      }
    }
  }

  function mediaNotesPage() {
    const ar = appLanguage === "ar";
    const mediaNotes = notes.filter((n) => isMediaNote(n));
    const filtered = mediaNotes.filter((n) => {
      const type = noteTypeOf(n);
      if (mediaFilter === "image" && type !== "image") return false;
      if (mediaFilter === "video" && type !== "video") return false;
      if (noteSearch) {
        const text = `${n.title || ""} ${n.description || ""} ${noteAttachments(n).map(a=>a.name||"").join(" ")}`.toLowerCase();
        if (!text.includes(noteSearch.toLowerCase())) return false;
      }
      return true;
    }).sort((a,b)=> new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0));

    const tabs = `
      <div class="notes-media-tabs" role="tablist" aria-label="${ar ? "تصفية الوسائط" : "Media filters"}">
        <button type="button" class="notes-media-tab ${mediaFilter==='all'?'active':''}" data-action="note-media-filter" data-filter="all">${ar?"الكل":"All"}</button>
        <button type="button" class="notes-media-tab ${mediaFilter==='image'?'active':''}" data-action="note-media-filter" data-filter="image">${ar?"صور":"Images"}</button>
        <button type="button" class="notes-media-tab ${mediaFilter==='video'?'active':''}" data-action="note-media-filter" data-filter="video">${ar?"فيديو":"Videos"}</button>
      </div>`;

    const cards = filtered.map((note) => {
      const atts = noteAttachments(note);
      const first = atts[0];
      const kind = noteTypeOf(note);
      const thumb = first ? mediaAttachmentThumbMarkup(first) : `<div class="media-thumb"><div class="media-thumb-placeholder">${kind==='video'?'🎬':'🖼️'}</div></div>`;
      const count = atts.length;
      const meta = `${count} ${ar ? (count===1?'ملف':'ملفات') : (count===1?'file':'files')}${first?.kind==='video' && first.duration ? ` · ${formatDurationShort(first.duration)}` : ''}`;
      const updated = note.updated_at ? new Intl.DateTimeFormat(ar ? 'ar-EG':'en', {dateStyle:'medium'}).format(new Date(note.updated_at)) : '';
      return `<article class="note-card media-note-card" data-note-id="${escapeHtml(note.id)}">
        <button class="note-card-main" data-action="note-open" data-id="${escapeHtml(note.id)}" aria-label="${escapeHtml(ar?`فتح ${note.title||'ملاحظة وسائط'}`:`Open ${note.title||'media note'}`)}">
          ${thumb}
          <span class="note-card-subject">${escapeHtml(mediaTypeLabel(kind))}</span>
          <h3 dir="auto">${escapeHtml(note.title || (ar ? 'ملاحظة وسائط' : 'Media note'))}</h3>
          <p class="note-card-preview" dir="auto">${escapeHtml(String(note.description||'').slice(0,120) || meta)}</p>
          <span class="note-card-date">${escapeHtml(updated || meta)}</span>
        </button>
        <div class="note-card-actions">
          <button class="task-icon" data-action="note-edit" data-id="${escapeHtml(note.id)}" aria-label="${ar?'تعديل':'Edit'}">✎</button>
          <button class="task-icon danger" data-action="note-delete" data-id="${escapeHtml(note.id)}" aria-label="${ar?'حذف':'Delete'}">✕</button>
        </div>
      </article>`;
    }).join('');

    const body = filtered.length
      ? `<div class="grid notes-grid media-notes-grid" id="media-notes-grid">${cards}</div>`
      : `<div class="empty-state notes-empty"><strong>${ar?'لا توجد ملاحظات وسائط':'No media notes yet'}</strong><span>${ar?'أضف صورًا أو فيديوهات من جهازك واحفظها كملاحظة.':'Add photos or videos from your device and save them as a note.'}</span><button class="button button-primary button-small" data-action="note-media-add">${ar?'إضافة وسائط':'Add media'}</button></div>`;

    const html = `${pageHeading(
      "MEDIA NOTES",
      ar ? "ملاحظات الوسائط" : "Media Notes",
      ar ? "احفظ ونظّم صورك وفيديوهاتك في قسم مستقل." : "Save and organize your photos and videos in a dedicated section.",
      `<div class="notes-heading-actions"><button class="button button-secondary" data-action="note-media-back">${ar?"رجوع":"Back"}</button><button class="button button-primary" data-action="note-media-add">${ar?"إضافة وسائط":"Add media"}</button></div>`
    )}
      <section class="panel notes-toolbar notes-media-toolbar">
        ${tabs}
        <label class="search-box"><span aria-hidden="true">🔎</span><input id="note-search" type="search" dir="auto" value="${escapeHtml(noteSearch)}" placeholder="${ar ? "ابحث في الوسائط" : "Search media"}" aria-label="${ar ? "ابحث في الوسائط" : "Search media"}"></label>
        <span class="notes-count">${new Intl.NumberFormat(ar?'ar-EG':'en').format(filtered.length)} ${ar ? 'عنصر' : (filtered.length===1?'item':'items')}</span>
      </section>
      ${body}
      <div id="media-note-modal-host"></div>`;

    // hydrate thumbnails after paint
    setTimeout(()=>{ void hydrateMediaThumbs(document.getElementById('media-notes-grid') || document); }, 0);
    return html;
  }

﻿  function ensureMediaEditorDraft(kind = "image") {
    if (!mediaEditorDraft) {
      mediaEditorDraft = { id: null, title: "", description: "", attachments: [], mode: kind === "video" ? "video" : "image" };
    }
    return mediaEditorDraft;
  }

  function renderMediaEditorModal() {
    const host = document.getElementById("media-note-modal-host") || (() => {
      const h = document.createElement("div");
      h.id = "media-note-modal-host";
      document.body.appendChild(h);
      return h;
    })();
    const d = ensureMediaEditorDraft("image");
    const ar = appLanguage === "ar";
    const previewItems = (d.attachments || []).map((att, idx) => {
      const isVideo = att.kind === "video";
      const key = att.localKey || att.id || "";
      const url = att.previewUrl || "";
      const thumb = url
        ? (isVideo ? `<video muted playsinline preload="metadata" src="${url}#t=0.1"></video>` : `<img src="${url}" alt="" />`)
        : `<div class="media-thumb-placeholder">${isVideo ? "🎬" : "🖼️"}</div>`;
      const meta = `${escapeHtml(att.name || mediaTypeLabel(att.kind))}${att.size ? ` · ${escapeHtml(formatBytesShort(att.size))}` : ""}${isVideo && att.duration ? ` · ${escapeHtml(formatDurationShort(att.duration))}` : ""}`;
      return `<div class="media-editor-item" data-idx="${idx}">
        <div class="media-editor-thumb ${isVideo ? "is-video":"is-image"}" data-media-key="${escapeHtml(key)}">${thumb}</div>
        <div class="media-editor-item-meta" dir="auto">${meta}</div>
        <div class="media-editor-item-actions">
          <button type="button" class="button button-small" data-action="media-editor-replace" data-idx="${idx}">${ar?"استبدال":"Replace"}</button>
          <button type="button" class="button button-small button-secondary" data-action="media-editor-remove" data-idx="${idx}">${ar?"إزالة":"Remove"}</button>
        </div>
      </div>`;
    }).join("");

    host.innerHTML = `<div class="modal-backdrop media-editor-backdrop" id="media-editor-modal">
      <section class="modal media-editor-modal" role="dialog" aria-modal="true" aria-labelledby="media-editor-title">
        <header class="note-editor-head">
          <div class="note-editor-title-wrap">
            <p class="eyebrow">${ar ? "ملاحظة وسائط" : "MEDIA NOTE"}</p>
            <h2 id="media-editor-title">${ar ? "إضافة وسائط" : "Add media"}</h2>
          </div>
          <button class="modal-close" type="button" data-action="media-editor-close" aria-label="${ar ? "إغلاق" : "Close"}">×</button>
        </header>
        <div class="media-editor-body">
          <div class="media-editor-type-row">
            <button type="button" class="button ${d.mode==='image'?'button-primary':'button-secondary'}" data-action="media-editor-pick-images">${ar ? "إضافة صور من المعرض" : "Add Images from Gallery"}</button>
            <button type="button" class="button ${d.mode==='video'?'button-primary':'button-secondary'}" data-action="media-editor-pick-videos">${ar ? "إضافة فيديو من المعرض" : "Add Videos from Gallery"}</button>
          </div>
          <label class="field"><span>${ar ? "العنوان" : "Title"}</span><input id="media-editor-title-input" type="text" dir="auto" maxlength="180" value="${escapeHtml(d.title || "")}" placeholder="${ar ? "عنوان الملاحظة" : "Note title"}" /></label>
          <label class="field"><span>${ar ? "الوصف (اختياري)" : "Description (optional)"}</span><textarea id="media-editor-desc-input" dir="auto" rows="3" placeholder="${ar ? "أضف وصفًا..." : "Add a description..."}">${escapeHtml(d.description || "")}</textarea></label>
          <div class="media-editor-preview">
            <div class="media-editor-preview-head"><strong>${ar ? "المعاينة قبل الحفظ" : "Preview before saving"}</strong><span class="muted">${(d.attachments||[]).length} ${ar?"ملف":"file(s)"}</span></div>
            <div class="media-editor-grid">${previewItems || `<p class="muted">${ar ? "لم يتم اختيار وسائط بعد. اختر صورًا أو فيديو من المعرض." : "No media selected yet. Choose images or videos from your gallery."}</p>`}</div>
          </div>
          <p id="media-editor-error" class="auth-error" aria-live="polite"></p>
          <p id="media-editor-status" class="muted" aria-live="polite"></p>
        </div>
        <footer class="modal-actions">
          <button type="button" class="button button-secondary" data-action="media-editor-close">${ar ? "إلغاء" : "Cancel"}</button>
          <button type="button" class="button button-primary" data-action="media-editor-save">${ar ? "حفظ الملاحظة" : "Save note"}</button>
        </footer>
      </section>
    </div>`;
  }

  function syncMediaDraftFromInputs() {
    if (!mediaEditorDraft) return;
    mediaEditorDraft.title = document.getElementById("media-editor-title-input")?.value || mediaEditorDraft.title || "";
    mediaEditorDraft.description = document.getElementById("media-editor-desc-input")?.value || mediaEditorDraft.description || "";
  }

  function closeMediaEditor() {
    if (mediaEditorDraft?.attachments) {
      for (const att of mediaEditorDraft.attachments) {
        if (att.previewUrl) { try { URL.revokeObjectURL(att.previewUrl); } catch {} }
      }
    }
    mediaEditorDraft = null;
    const host = document.getElementById("media-note-modal-host");
    if (host) host.innerHTML = "";
  }

  async function openMediaNotePicker() {
    ensureMediaEditorDraft("image");
    renderMediaEditorModal();
  }

  function validateMediaFile(file, kind) {
    const ar = appLanguage === "ar";
    const type = String(file?.type || "");
    if (kind === "image" && !type.startsWith("image/")) return ar ? "يرجى اختيار ملفات صور فقط." : "Please select image files only.";
    if (kind === "video" && !type.startsWith("video/")) return ar ? "يرجى اختيار ملفات فيديو فقط." : "Please select video files only.";
    const max = kind === "video" ? 200 * 1024 * 1024 : 25 * 1024 * 1024;
    if ((file.size || 0) > max) {
      return ar
        ? `الملف كبير جدًا (${formatBytesShort(file.size)}). الحد التقريبي ${kind === "video" ? "200MB" : "25MB"}.`
        : `File is too large (${formatBytesShort(file.size)}). Approximate limit is ${kind === "video" ? "200MB" : "25MB"}.`;
    }
    return "";
  }

  async function addFilesToMediaDraft(files, kind, replaceIdx = null) {
    const d = ensureMediaEditorDraft(kind);
    d.mode = kind;
    syncMediaDraftFromInputs();
    const list = Array.from(files || []);
    if (!list.length) return;
    const errors = [];
    for (const file of list) {
      const err = validateMediaFile(file, kind);
      if (err) { errors.push(`${file.name || "file"}: ${err}`); continue; }
      const att = await readFileAsAttachment(file, kind);
      try { att.previewUrl = URL.createObjectURL(file); } catch { att.previewUrl = ""; }
      if (replaceIdx != null && d.attachments[replaceIdx]) {
        const old = d.attachments[replaceIdx];
        if (old.previewUrl) try { URL.revokeObjectURL(old.previewUrl); } catch {}
        if (old.localKey && old.localKey !== att.localKey) { try { await deleteMediaBlob(old.localKey); } catch {} }
        d.attachments[replaceIdx] = att;
        replaceIdx = null;
      } else {
        d.attachments.push(att);
      }
    }
    renderMediaEditorModal();
    const errEl = document.getElementById("media-editor-error");
    if (errEl) errEl.textContent = errors.join(" ");
  }

  function triggerMediaFilePicker(kind, replaceIdx = null) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = kind === "video" ? "video/*" : "image/*";
    input.multiple = replaceIdx == null;
    input.style.display = "none";
    document.body.appendChild(input);
    input.addEventListener("change", async () => {
      try { await addFilesToMediaDraft(input.files || [], kind, replaceIdx); }
      finally { input.remove(); }
    }, { once: true });
    input.click();
  }

  async function saveMediaNoteRecord({ id = null, title, description = "", attachments = [], type = "image", existingCreatedAt = null }) {
    const now = new Date().toISOString();
    const noteId = id || `local-note-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
    const safeAttachments = (Array.isArray(attachments) ? attachments : []).map((a) => {
      const copy = { ...a };
      delete copy.previewUrl;
      return copy;
    });
    const note = normalizeNoteRecord({
      id: noteId,
      title: String(title || (appLanguage === "ar" ? "ملاحظة وسائط" : "Media note")).trim(),
      description: String(description || ""),
      type: type === "video" ? "video" : "image",
      attachments: safeAttachments,
      subject_id: null,
      subject: "",
      is_favorite: false,
      color: "",
      created_at: existingCreatedAt || now,
      updated_at: now,
    });
    note.content = serializeMediaNoteContent(note);

    if (supabase && session) {
      try {
        const syncedAttachments = [];
        for (let i = 0; i < note.attachments.length; i++) {
          const att = note.attachments[i];
          let storagePath = att.storagePath || "";
          if (!storagePath && att.localKey) {
            const rec = await getMediaBlob(att.localKey);
            if (rec?.blob) {
              const safeName = String(att.name || att.localKey).replace(/[^a-zA-Z0-9._-]+/g, "_");
              storagePath = `${session.user.id}/${note.id}/${att.localKey}-${safeName}`;
              const statusEl = document.getElementById("media-editor-status");
              if (statusEl) statusEl.textContent = appLanguage === "ar" ? `جارٍ رفع الملف ${i + 1} من ${note.attachments.length}...` : `Uploading ${i + 1} of ${note.attachments.length}...`;
              const up = await supabase.storage.from("note-media").upload(storagePath, rec.blob, {
                upsert: true,
                contentType: att.mime || rec.type || undefined,
              });
              if (up.error) throw up.error;
            }
          }
          syncedAttachments.push({ ...att, storagePath, bucket: "note-media" });
        }
        note.attachments = syncedAttachments;
        note.content = serializeMediaNoteContent(note);
        const payload = { title: note.title, content: note.content, subject_id: null, is_favorite: false };
        const isLocal = String(note.id).startsWith("local-");
        let result;
        if (!isLocal) {
          result = await supabase.from("notes").update(payload).eq("id", note.id).select("id,title,content,subject_id,is_favorite,created_at,updated_at").single();
        } else {
          result = await supabase.from("notes").insert(payload).select("id,title,content,subject_id,is_favorite,created_at,updated_at").single();
        }
        if (result.error) throw result.error;
        const saved = normalizeNoteRecord({ ...result.data, subject: "" });
        const idx = notes.findIndex((n) => String(n.id) === String(saved.id) || String(n.id) === String(note.id));
        if (idx >= 0) notes[idx] = saved; else notes.unshift(saved);
        render();
        return;
      } catch (e) {
        console.warn("Media note remote sync failed, saving locally.", e);
      }
    }

    const idx = notes.findIndex((n) => String(n.id) === String(note.id));
    if (idx >= 0) notes[idx] = note; else notes.unshift(note);
    saveLocalNotes();
    render();
  }

  async function openMediaNoteViewer(noteId) {
    const note = notes.find((n) => String(n.id) === String(noteId));
    if (!note) return;
    const ar = appLanguage === 'ar';
    const atts = noteAttachments(note);
    if (!atts.length) { showToast(ar ? 'لا توجد وسائط.' : 'No media.'); return; }
    const att = atts[0];
    try {
      let url = '';
      if (att.localKey) url = await getMediaObjectUrl(att.localKey);
      if (!url && supabase && att.storagePath) {
        const signed = await supabase.storage.from(att.bucket || 'note-media').createSignedUrl(att.storagePath, 3600);
        if (!signed.error) url = signed.data?.signedUrl || '';
      }
      if (!url) { showToast(ar ? 'تعذر فتح الوسائط (غير متاحة محليًا/أونلاين).' : 'Could not open media (not available locally/online).'); return; }
      const modal = document.createElement('div');
      modal.className = 'modal-backdrop media-viewer-backdrop';
      modal.innerHTML = `<div class="modal media-viewer-modal" role="dialog" aria-modal="true">
        <div class="media-viewer-head"><h3 dir="auto">${escapeHtml(note.title || (ar?'ملاحظة وسائط':'Media note'))}</h3><button type="button" class="modal-close" data-action="close-media-viewer" aria-label="${ar?'إغلاق':'Close'}">×</button></div>
        <div class="media-viewer-body">${att.kind === 'video' ? `<video controls playsinline src="${url}" class="media-viewer-video"></video>` : `<img src="${url}" alt="" class="media-viewer-image" />`}</div>
        ${note.description ? `<p class="media-viewer-desc" dir="auto">${escapeHtml(note.description)}</p>` : ''}
      </div>`;
      modal.addEventListener('click', (e) => {
        if (e.target === modal || e.target.closest('[data-action="close-media-viewer"]')) modal.remove();
      });
      document.body.appendChild(modal);
    } catch (e) {
      console.error('Media viewer failed', e);
      showToast(ar ? 'تعذر فتح الوسائط.' : 'Could not open media.');
    }
  }

  function noteBodyForHtml(html) {
    const value = String(html || "").trim();
    if (
      value === "<br>" ||
      value === "<div><br></div>" ||
      value === "<p><br></p>"
    )
      return "";
    return sanitizeRichText(value);
  }

  function noteEditorMarkup(note, templateKey) {
    const isNew = !note?.id;
    const template = NOTE_TEMPLATES[templateKey] || NOTE_TEMPLATES.blank;
    const title = note?.title || template.title || "";
    const content = note
      ? noteContentHtml(note)
      : sanitizeRichText(template.content);
    const colorSwatches = notesColorSupported
      ? `<div class="note-color-row" role="group" aria-label="${appLanguage === "ar" ? "لون الملاحظة" : "Note color"}">${[
          ["", appLanguage === "ar" ? "افتراضي" : "Default"],
          [getThemeColor("--color-primary", "#6b7280"), "Primary"],
          [getThemeColor("--color-secondary", "#d1d5db"), "Secondary"],
          [getThemeColor("--color-warning", "#fbbf24"), "Warning"],
          [getThemeColor("--color-muted", "#9ca3af"), "Muted"],
          [getThemeColor("--color-info", "#7FB3D5"), "Blue"],
        ]
          .map(
            ([value, label]) =>
              `<button type="button" class="note-color ${String(note?.color || "") === value ? "selected" : ""}" data-note-color="${value}" style="--swatch:${value || "var(--accent)"}" aria-label="${label}" title="${label}"></button>`,
          )
          .join("")}</div>`
      : "";
    const subjOptions = `<option value="">${appLanguage === "ar" ? "بلا مادة" : "No subject"}</option>${subjects.map((subject) => `<option value="${escapeHtml(subject.id)}" ${String(note?.subject_id || "") === String(subject.id) ? "selected" : ""}>${escapeHtml(subject.name)}</option>`).join("")}`;
    const toolButton = (command, label, text, extra = "") =>
      `<button type="button" class="rt-button" data-rt="${command}" ${extra} aria-label="${label}" title="${label}">${text}</button>`;
    return `<div class="modal-backdrop note-backdrop" id="note-modal" hidden>
      <section class="modal note-modal" role="dialog" aria-modal="true" aria-labelledby="note-editor-title">
        <header class="note-editor-head">
          <div class="note-editor-title-wrap">
            <p class="eyebrow" id="note-editor-kicker">${isNew ? (appLanguage === "ar" ? "ملاحظة جديدة" : "NEW NOTE") : appLanguage === "ar" ? "تعديل الملاحظة" : "EDIT NOTE"}</p>
            <input id="note-editor-title" class="note-title-input" dir="auto" maxlength="180" value="${escapeHtml(title)}" placeholder="${appLanguage === "ar" ? "عنوان الملاحظة" : "Note title"}" aria-label="${appLanguage === "ar" ? "عنوان الملاحظة" : "Note title"}" />
          </div>
          <button class="modal-close" type="button" data-action="note-close" aria-label="${appLanguage === "ar" ? "إغلاق" : "Close"}">×</button>
        </header>
        <div class="note-editor-meta">
          <select id="note-editor-subject" class="filter-select" aria-label="${appLanguage === "ar" ? "المادة" : "Subject"}">${subjOptions}</select>
          ${colorSwatches}
          <label class="note-pin-toggle"><input type="checkbox" id="note-editor-pin" ${note?.is_favorite ? "checked" : ""} /> <span>${appLanguage === "ar" ? "تثبيت" : "Pin"}</span></label>
          <span class="note-save-status" id="note-save-status">${isNew ? "" : appLanguage === "ar" ? "محفوظة" : "Saved"}</span>
        </div>
        ${
          isNew
            ? `<div class="note-template-row" role="group" aria-label="${appLanguage === "ar" ? "قوالب الملاحظات" : "Note templates"}"><span>${appLanguage === "ar" ? "ابدأ من قالب:" : "Start from a template:"}</span>${Object.entries(
                NOTE_TEMPLATES,
              )
                .map(
                  ([key, item]) =>
                    `<button type="button" class="note-template-chip" data-note-template="${key}">${escapeHtml(item.label)}</button>`,
                )
                .join("")}</div>`
            : ""
        }
        <div class="rt-toolbar" id="note-toolbar" role="toolbar" aria-label="${appLanguage === "ar" ? "أدوات التنسيق" : "Formatting toolbar"}">
          <div class="rt-group">
            ${toolButton("undo", "Undo", "↶")}${toolButton("redo", "Redo", "↷")}
          </div>
          <div class="rt-group">
            <select class="rt-select" id="rt-block" aria-label="${appLanguage === "ar" ? "نمط الفقرة" : "Paragraph style"}"><option value="p">${appLanguage === "ar" ? "فقرة" : "Paragraph"}</option><option value="h1">H1</option><option value="h2">H2</option><option value="h3">H3</option><option value="blockquote">${appLanguage === "ar" ? "اقتباس" : "Quote"}</option><option value="pre">${appLanguage === "ar" ? "كود" : "Code"}</option></select>
            <select class="rt-select" id="rt-size" aria-label="${appLanguage === "ar" ? "حجم الخط" : "Font size"}"><option value="">${appLanguage === "ar" ? "الحجم" : "Size"}</option><option value="14px">14</option><option value="16px">16</option><option value="18px">18</option><option value="24px">24</option><option value="30px">30</option></select>
          </div>
          <div class="rt-group">
            ${toolButton("bold", "Bold (Ctrl+B)", "<strong>B</strong>")}
            ${toolButton("italic", "Italic (Ctrl+I)", "<em>I</em>")}
            ${toolButton("underline", "Underline (Ctrl+U)", "<u>U</u>")}
            ${toolButton("strikeThrough", "Strikethrough", "<s>S</s>")}
            <label class="rt-color" title="${appLanguage === "ar" ? "لون الخط" : "Text color"}"><span style="--swatch:${getThemeColor("--color-text", "#E6FBF6")}"></span><input type="color" id="rt-fore-color" value="${getThemeColor("--color-text", "#E6FBF6")}" aria-label="${appLanguage === "ar" ? "لون الخط" : "Text color"}" /></label>
          </div>
          <div class="rt-group rt-highlights" role="group" aria-label="${appLanguage === "ar" ? "تظليل النص" : "Highlight text"}">
            ${[
              [getThemeColor("--color-warning", "#fbbf24"), "Yellow"],
              [getThemeColor("--color-primary", "#6b7280"), "Primary"],
              [getThemeColor("--color-info", "#6b7280"), "Info"],
              ["#E39AC7", "Pink"],
              ["#E39A5B", "Orange"],
            ]
              .map(
                ([color, label]) =>
                  `<button type="button" class="rt-swatch" data-rt-highlight="${color}" style="--swatch:${color}" aria-label="${label}" title="${label}"></button>`,
              )
              .join("")}
            ${toolButton("hiliteClear", appLanguage === "ar" ? "إزالة التظليل" : "Clear highlight", "⌫")}
          </div>
          <div class="rt-group">
            ${toolButton("insertUnorderedList", "Bulleted list", "•≡")}
            ${toolButton("insertOrderedList", "Numbered list", "1≡")}
            <button type="button" class="rt-button" data-rt="checklist" aria-label="${appLanguage === "ar" ? "قائمة تحقق" : "Checklist"}" title="${appLanguage === "ar" ? "قائمة تحقق" : "Checklist"}">☑</button>
            ${toolButton("insertHorizontalRule", "Divider", "—")}
          </div>
          <div class="rt-group">
            ${toolButton("justifyLeft", "Align right/left", "⇤")}
            ${toolButton("justifyCenter", "Align center", "↔")}
            ${toolButton("justifyRight", "Align left/right", "⇥")}
            ${toolButton("justifyFull", "Justify", "≡")}
            ${toolButton("dirRtl", "RTL", "RTL")}
            ${toolButton("dirLtr", "LTR", "LTR")}
          </div>
          <div class="rt-group">
            <button type="button" class="rt-button" data-rt="link" aria-label="${appLanguage === "ar" ? "إضافة رابط" : "Insert link"}" title="${appLanguage === "ar" ? "إضافة رابط" : "Insert link"}">🔗</button>
            <button type="button" class="rt-button" data-rt="image" aria-label="${appLanguage === "ar" ? "إدراج صورة" : "Insert image"}" title="${appLanguage === "ar" ? "إدراج صورة" : "Insert image"}">▣</button>
            ${toolButton("removeFormat", appLanguage === "ar" ? "مسح التنسيق" : "Clear formatting", "⌫")}
          </div>
        </div>
        <div class="rt-editor" id="note-editor" contenteditable="true" dir="auto" role="textbox" aria-multiline="true" aria-label="${appLanguage === "ar" ? "محتوى الملاحظة" : "Note content"}" spellcheck="true">${content}</div>
        <footer class="note-editor-foot">
          <span id="note-word-count"></span>
          <div class="note-editor-actions">
            ${isNew ? "" : `<button type="button" class="button button-quiet button-small danger-text" data-action="note-delete-editor">${appLanguage === "ar" ? "حذف" : "Delete"}</button>`}
            <button type="button" class="button button-secondary button-small" data-action="note-save-now">${appLanguage === "ar" ? "حفظ الآن" : "Save now"}</button>
            <button type="button" class="button button-primary button-small" data-action="note-close">${appLanguage === "ar" ? "تم" : "Done"}</button>
          </div>
        </footer>
      </section>
    </div>`;
  }

  function updateNoteWordCount() {
    const editor = document.getElementById("note-editor");
    const counter = document.getElementById("note-word-count");
    if (!editor || !counter) return;
    const text = (editor.textContent || "").trim();
    const words = text ? text.split(/\s+/).length : 0;
    counter.textContent = `${new Intl.NumberFormat(appLanguage === "ar" ? "ar-EG" : "en").format(words)} ${appLanguage === "ar" ? "كلمة" : words === 1 ? "word" : "words"}`;
  }

  function setNoteSaveStatus(status) {
    noteSaveStatus = status;
    const element = document.getElementById("note-save-status");
    if (!element) return;
    const labels = {
      idle: appLanguage === "ar" ? "محفوظة" : "Saved",
      dirty: appLanguage === "ar" ? "تغييرات غير محفوظة" : "Unsaved changes",
      saving: appLanguage === "ar" ? "جارٍ الحفظ…" : "Saving…",
      saved:
        appLanguage === "ar"
          ? `تم الحفظ · ${new Intl.DateTimeFormat(appLanguage === "ar" ? "ar-EG" : "en", { hour: "numeric", minute: "2-digit" }).format(new Date())}`
          : `Saved · ${new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(new Date())}`,
      error: appLanguage === "ar" ? "تعذر الحفظ" : "Save failed",
    };
    element.textContent = labels[status] || "";
    element.dataset.state = status;
  }

  function scheduleNoteSave() {
    setNoteSaveStatus("dirty");
    if (noteSaveTimer) window.clearTimeout(noteSaveTimer);
    noteSaveTimer = window.setTimeout(() => {
      void saveNoteNow({ silent: true });
    }, 900);
  }

  async function saveNoteNow({ silent = false } = {}) {
    const state = noteEditorState;
    if (!state) return;
    if (noteSaveTimer) {
      window.clearTimeout(noteSaveTimer);
      noteSaveTimer = null;
    }
    const titleInput = document.getElementById("note-editor-title");
    const editor = document.getElementById("note-editor");
    if (!titleInput || !editor) return;
    const title = titleInput.value.trim();
    const content = noteBodyForHtml(editor.innerHTML);
    if (!title && !content.replace(/<[^>]+>/g, "").trim()) {
      setNoteSaveStatus("idle");
      return;
    }
    const payload = {
      title:
        title || (appLanguage === "ar" ? "ملاحظة بدون عنوان" : "Untitled note"),
      content,
      subject_id: document.getElementById("note-editor-subject")?.value || null,
      is_favorite: Boolean(document.getElementById("note-editor-pin")?.checked),
    };
    if (notesColorSupported) payload.color = state.color || "";
    setNoteSaveStatus("saving");
    try {
      if (supabase && session) {
        let result;
        if (state.id && !String(state.id).startsWith("local-")) {
          result = await supabase
            .from("notes")
            .update(payload)
            .eq("id", state.id)
            .select(
              "id,title,content,subject_id,is_favorite,created_at,updated_at",
            )
            .single();
        } else {
          result = await supabase
            .from("notes")
            .insert(payload)
            .select(
              "id,title,content,subject_id,is_favorite,created_at,updated_at",
            )
            .single();
        }
        if (result.error) throw result.error;
        const saved = result.data;
        if (notesColorSupported) saved.color = payload.color;
        const index = notes.findIndex(
          (note) => String(note.id) === String(saved.id),
        );
        const normalized = { ...saved, subject: subjectName(saved.subject_id) };
        if (index >= 0) notes[index] = normalized;
        else notes.unshift(normalized);
        state.id = saved.id;
      } else {
        const now = new Date().toISOString();
        const id = state.id || `local-note-${Date.now()}`;
        const existing = notes.find((note) => String(note.id) === String(id));
        const saved = {
          ...(existing || {}),
          ...payload,
          id,
          subject: subjectName(payload.subject_id),
          created_at: existing?.created_at || now,
          updated_at: now,
        };
        if (existing)
          notes = notes.map((note) =>
            String(note.id) === String(id) ? saved : note,
          );
        else notes.unshift(saved);
        state.id = id;
        saveLocalNotes();
      }
      state.savedTitle = payload.title;
      setNoteSaveStatus("saved");
      updateNoteWordCount();
    } catch (error) {
      console.error("Could not save the note.", error);
      setNoteSaveStatus("error");
      if (!silent)
        showToast(
          `${appLanguage === "ar" ? "تعذر حفظ الملاحظة:" : "Could not save the note:"} ${error.message}`,
        );
      throw error;
    }
  }

  function closeNoteEditor() {
    if (noteSaveTimer) {
      window.clearTimeout(noteSaveTimer);
      noteSaveTimer = null;
    }
    const modal = document.getElementById("note-modal");
    if (!modal) return;
    const hasContent =
      document.getElementById("note-editor-title")?.value.trim() ||
      (document.getElementById("note-editor")?.textContent || "").trim();
    if (hasContent && noteSaveStatus !== "saved" && noteSaveStatus !== "idle") {
      void saveNoteNow({ silent: true }).catch(() => {});
    }
    closeModal(modal);
    noteEditorState = null;
    noteSaveStatus = "idle";
    if (currentPage === "notes") render();
  }

  function openNoteEditor(id = null, templateKey = "blank") {
    const note = id
      ? notes.find((item) => String(item.id) === String(id))
      : null;
    if (id && !note) {
      showToast(
        appLanguage === "ar"
          ? "تعذر العثور على الملاحظة."
          : "The note could not be found.",
      );
      return;
    }
    const existing = document.getElementById("note-modal");
    if (existing) existing.remove();
    document.body.insertAdjacentHTML(
      "beforeend",
      noteEditorMarkup(note, templateKey),
    );
    noteEditorState = {
      id: note?.id || null,
      color: note?.color || "",
      savedTitle: note?.title || "",
    };
    attachNoteEditorListeners();
    openModal(document.getElementById("note-modal"));
    updateNoteWordCount();
    translateInterface();
    if (!note) document.getElementById("note-editor-title").focus();
    else document.getElementById("note-editor").focus();
  }

  function attachNoteEditorListeners() {
    const modal = document.getElementById("note-modal");
    const editor = document.getElementById("note-editor");
    const title = document.getElementById("note-editor-title");
    modal.addEventListener("click", (event) => {
      if (event.target === modal) closeNoteEditor();
      const templateButton = event.target.closest("[data-note-template]");
      if (templateButton) {
        const template = NOTE_TEMPLATES[templateButton.dataset.noteTemplate];
        if (!template) return;
        if (
          (editor.textContent || "").trim() &&
          !window.confirm(
            appLanguage === "ar"
              ? "استبدال المحتوى الحالي بالقالب؟"
              : "Replace the current content with this template?",
          )
        )
          return;
        editor.innerHTML = sanitizeRichText(template.content);
        if (!title.value.trim()) title.value = template.title;
        updateNoteWordCount();
        scheduleNoteSave();
        editor.focus();
        return;
      }
      const colorButton = event.target.closest("[data-note-color]");
      if (colorButton) {
        noteEditorState.color = colorButton.dataset.noteColor;
        modal
          .querySelectorAll("[data-note-color]")
          .forEach((button) =>
            button.classList.toggle("selected", button === colorButton),
          );
        scheduleNoteSave();
        return;
      }
      const commandButton = event.target.closest("[data-rt]");
      if (commandButton) {
        event.preventDefault();
        runRichTextCommand(commandButton.dataset.rt);
        return;
      }
      const highlightButton = event.target.closest("[data-rt-highlight]");
      if (highlightButton) {
        event.preventDefault();
        editor.focus();
        document.execCommand("styleWithCSS", false, true);
        document.execCommand(
          "hiliteColor",
          false,
          highlightButton.dataset.rtHighlight,
        );
        scheduleNoteSave();
      }
    });
    modal.addEventListener("mousedown", (event) => {
      if (event.target.closest(".rt-button, .rt-swatch"))
        event.preventDefault();
    });
    editor.addEventListener("input", () => {
      updateNoteWordCount();
      scheduleNoteSave();
    });
    title.addEventListener("input", scheduleNoteSave);
    document
      .getElementById("note-editor-subject")
      .addEventListener("change", scheduleNoteSave);
    document
      .getElementById("note-editor-pin")
      .addEventListener("change", scheduleNoteSave);
    document.getElementById("rt-block").addEventListener("change", (event) => {
      editor.focus();
      document.execCommand("formatBlock", false, event.target.value);
      scheduleNoteSave();
    });
    document.getElementById("rt-size").addEventListener("change", (event) => {
      if (!event.target.value) return;
      editor.focus();
      document.execCommand("styleWithCSS", false, true);
      document.execCommand("fontSize", false, "7");
      const fontElements = editor.querySelectorAll('font[size="7"]');
      fontElements.forEach((font) => {
        const span = document.createElement("span");
        span.style.fontSize = event.target.value;
        span.innerHTML = font.innerHTML;
        font.replaceWith(span);
      });
      editor.querySelectorAll('span[style*="xxx-large"]').forEach((span) => {
        span.style.fontSize = event.target.value;
      });
      event.target.value = "";
      scheduleNoteSave();
    });
    document
      .getElementById("rt-fore-color")
      .addEventListener("input", (event) => {
        editor.focus();
        document.execCommand("styleWithCSS", false, true);
        document.execCommand("foreColor", false, event.target.value);
        scheduleNoteSave();
      });
    editor.addEventListener("click", (event) => {
      const item = event.target.closest("li");
      const list = item?.closest("ul.rt-checklist");
      if (!item || !list) return;
      const checked = item.dataset.checked !== "true";
      item.dataset.checked = String(checked);
      item.classList.toggle("checked", checked);
      scheduleNoteSave();
    });
    editor.addEventListener("paste", (event) => {
      const html = event.clipboardData?.getData("text/html");
      if (!html) return;
      event.preventDefault();
      document.execCommand("insertHTML", false, sanitizeRichText(html));
      scheduleNoteSave();
    });
  }

  function runRichTextCommand(command) {
    const editor = document.getElementById("note-editor");
    if (!editor) return;
    editor.focus();
    document.execCommand("styleWithCSS", false, true);
    if (command === "checklist") {
      document.execCommand(
        "insertHTML",
        false,
        '<ul class="rt-checklist"><li data-checked="false"> </li></ul>',
      );
    } else if (command === "hiliteClear" || command === "hiliteColor") {
      document.execCommand(
        "hiliteColor",
        false,
        command === "hiliteClear" ? "transparent" : "#E6BA6C",
      );
    } else if (command === "dirRtl" || command === "dirLtr") {
      document.execCommand("dir", false, command === "dirRtl" ? "rtl" : "ltr");
    } else if (command === "link") {
      const url = window.prompt(
        appLanguage === "ar" ? "رابط (https://...)" : "Link URL (https://...)",
      );
      if (url && /^https?:\/\//i.test(url.trim()))
        document.execCommand("createLink", false, url.trim());
    } else if (command === "image") {
      const url = window.prompt(
        appLanguage === "ar"
          ? "رابط الصورة (https://...)"
          : "Image URL (https://...)",
      );
      if (url && /^https:\/\//i.test(url.trim()))
        document.execCommand("insertImage", false, url.trim());
    } else {
      document.execCommand(command, false, null);
    }
    scheduleNoteSave();
  }

  async function toggleNotePin(id) {
    const note = notes.find((item) => String(item.id) === String(id));
    if (!note) return;
    const nextValue = !note.is_favorite;
    try {
      if (supabase && session && !String(id).startsWith("local-")) {
        const { error } = await supabase
          .from("notes")
          .update({ is_favorite: nextValue })
          .eq("id", id);
        if (error) throw error;
      }
      note.is_favorite = nextValue;
      if (!supabase || !session) saveLocalNotes();
      render();
      showToast(
        nextValue
          ? appLanguage === "ar"
            ? "تم تثبيت الملاحظة."
            : "Note pinned."
          : appLanguage === "ar"
            ? "تم إلغاء تثبيت الملاحظة."
            : "Note unpinned.",
      );
    } catch (error) {
      showToast(
        `${appLanguage === "ar" ? "تعذر تحديث الملاحظة:" : "Could not update the note:"} ${error.message}`,
      );
      console.error("Could not pin the note.", error);
    }
  }

  async function deleteNote(id, { closeEditor = false } = {}) {
    const note = notes.find((item) => String(item.id) === String(id));
    if (!note) return;
    if (
      !window.confirm(
        appLanguage === "ar"
          ? `حذف "${note.title}"؟ لا يمكن التراجع.`
          : `Delete "${note.title}"? This cannot be undone.`,
      )
    )
      return;
    try {
      if (isMediaNote(note)) {
        for (const att of noteAttachments(note)) {
          if (att?.localKey) await deleteMediaBlob(att.localKey);
          if (supabase && session && att?.storagePath) {
            try { await supabase.storage.from(att.bucket || 'note-media').remove([att.storagePath]); } catch {}
          }
        }
      }
      if (supabase && session && !String(id).startsWith("local-")) {
        const { error } = await supabase.from("notes").delete().eq("id", id);
        if (error) throw error;
      }
      notes = notes.filter((item) => String(item.id) !== String(id));
      if (!supabase || !session || String(id).startsWith("local-")) saveLocalNotes();
      if (closeEditor) {
        const modal = document.getElementById("note-modal");
        if (modal) closeModal(modal);
        noteEditorState = null;
        noteSaveStatus = "idle";
      }
      render();
      showToast(appLanguage === "ar" ? "تم حذف الملاحظة." : "Note deleted.");
    } catch (error) {
      showToast(
        `${appLanguage === "ar" ? "تعذر حذف الملاحظة:" : "Could not delete the note:"} ${error.message}`,
      );
      console.error("Could not delete the note.", error);
    }
  }

  const featureFormText = {
    en: {
      save: "Save",
      cancel: "Cancel",
      loading: "Saving…",
      error: "Could not save your changes.",
      signIn: "Sign in to manage your private study data.",
      subject: "Subject",
      noSubject: "No subject",
      editSubject: "Edit subject",
      addSubject: "Add subject",
      editSchedule: "Edit study block",
      addSchedule: "Plan a study block",
      uploadFile: "Upload a study file",
      editNote: "Edit note",
      addNote: "Create a note",
      editGoal: "Edit goal",
      addGoal: "Create a goal",
      goalProgress: "Add goal progress",
      editExam: "Edit exam",
      addExam: "Add exam",
      examResult: "Record exam result",
      editProfile: "Edit profile",
      edit: "Edit",
      delete: "Delete",
      download: "Download",
      recordResult: "Record result",
      editResult: "Edit result",
      addProgress: "Add progress",
      title: "Title",
      description: "Description",
      color: "Color",
      credits: "Credit hours",
      details: "Details",
      startsAt: "Starts",
      endsAt: "Ends",
      recurrence: "Repeat",
      none: "Does not repeat",
      daily: "Daily",
      weekly: "Weekly",
      file: "Choose file",
      content: "Note",
      period: "Goal period",
      target: "Target",
      current: "Current progress",
      unit: "Unit",
      dueAt: "Due date",
      examAt: "Exam date",
      maximumMarks: "Maximum marks",
      result: "Result",
      notes: "Notes",
      displayName: "Display name",
      timezone: "Timezone (IANA)",
      language: "Language",
      avatar: "Avatar URL (optional)",
      progress: "Progress to add",
      fileLimit: "Choose a supported file no larger than 20 MB.",
      resultRange: "Result must be between zero and maximum marks.",
    },
    ar: {
      save: "حفظ",
      cancel: "إلغاء",
      loading: "جارٍ الحفظ…",
      error: "تعذر حفظ التغييرات.",
      signIn: "سجّل الدخول لإدارة بياناتك الدراسية الخاصة.",
      subject: "المادة",
      noSubject: "بلا مادة",
      editSubject: "تعديل المادة",
      addSubject: "إضافة مادة",
      editSchedule: "تعديل الجلسة",
      addSchedule: "تخطيط جلسة دراسية",
      uploadFile: "رفع ملف دراسي",
      editNote: "تعديل الملاحظة",
      addNote: "إنشاء ملاحظة",
      editGoal: "تعديل الهدف",
      addGoal: "إنشاء هدف",
      goalProgress: "إضافة تقدم للهدف",
      editExam: "تعديل الاختبار",
      addExam: "إضافة اختبار",
      examResult: "تسجيل نتيجة الاختبار",
      editProfile: "تعديل الملف الشخصي",
      edit: "تعديل",
      delete: "حذف",
      download: "تنزيل",
      recordResult: "تسجيل النتيجة",
      editResult: "تعديل النتيجة",
      addProgress: "إضافة تقدم",
      title: "العنوان",
      description: "الوصف",
      color: "اللون",
      credits: "الساعات المعتمدة",
      details: "التفاصيل",
      startsAt: "يبدأ",
      endsAt: "ينتهي",
      recurrence: "التكرار",
      none: "بدون تكرار",
      daily: "يوميًا",
      weekly: "أسبوعيًا",
      file: "اختر ملفًا",
      content: "الملاحظة",
      period: "فترة الهدف",
      target: "المستهدف",
      current: "التقدم الحالي",
      unit: "الوحدة",
      dueAt: "تاريخ الاستحقاق",
      examAt: "موعد الاختبار",
      maximumMarks: "الدرجة النهائية",
      result: "النتيجة",
      notes: "ملاحظات",
      displayName: "اسم العرض",
      timezone: "المنطقة الزمنية (IANA)",
      language: "اللغة",
      avatar: "رابط الصورة (اختياري)",
      progress: "مقدار التقدم المضاف",
      fileLimit: "اختر ملفًا مدعومًا لا يتجاوز حجمه 20 ميغابايت.",
      resultRange: "يجب أن تكون النتيجة بين صفر والدرجة النهائية.",
    },
  };

  function featureText(key) {
    return featureFormText[appLanguage][key] || key;
  }

  function localDateTimeValue(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  }

  function featureSubjectOptions(selectedId = "") {
    return `<option value="">${featureText("noSubject")}</option>${subjects.map((item) => `<option value="${escapeHtml(item.id)}" ${String(item.id) === String(selectedId) ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("")}`;
  }

  function featureField(
    name,
    label,
    type = "text",
    value = "",
    attributes = "",
  ) {
    const valueAttr =
      type === "file" ? "" : ` value="${escapeHtml(value ?? "")}"`;
    const field =
      type === "textarea"
        ? `<textarea name="${name}" dir="auto" ${attributes}>${escapeHtml(value ?? "")}</textarea>`
        : `<input name="${name}" type="${type}"${valueAttr} ${attributes}>`;
    return `<label>${featureText(label)}${field}</label>`;
  }

  function openFeatureForm(type, id = null) {
    if (!supabase || !session) {
      showToast(featureText("signIn"));
      openModal(document.getElementById("auth-modal"));
      return;
    }

    const collections = {
      subject: subjects,
      schedule,
      file: sampleFiles,
      note: sampleNotes,
      goal: goals,
      exam: examResults,
      profile: accountProfile ? [accountProfile] : [],
      "exam-result": examResults,
      "goal-progress": goals,
    };
    const record = id
      ? collections[type]?.find((item) => String(item.id) === String(id))
      : null;
    if (id && !record && type !== "profile") {
      showToast(
        "The selected record could not be found. Refresh the page and try again.",
      );
      return;
    }
    const titles = {
      subject: record ? "editSubject" : "addSubject",
      schedule: record ? "editSchedule" : "addSchedule",
      file: "uploadFile",
      note: record ? "editNote" : "addNote",
      goal: record ? "editGoal" : "addGoal",
      "goal-progress": "goalProgress",
      exam: record ? "editExam" : "addExam",
      "exam-result": "examResult",
      profile: "editProfile",
    };
    let fields = "";

    if (type === "subject") {
      fields = `${featureField("name", "title", "text", record?.name, 'required maxlength="100"')}${featureField("description", "description", "textarea", record?.description, 'rows="3" maxlength="2000"')}<div class="form-row">${featureField("color", "color", "color", record?.color || getThemeColor("--color-primary", "#6b7280"), "required")}${featureField("credit_hours", "credits", "number", record?.credit_hours ?? record?.credits ?? 0, 'min="0" max="30" required')}</div>`;
    } else if (type === "schedule") {
      fields = `${featureField("title", "title", "text", record?.title, 'required maxlength="120"')}${featureField("details", "details", "textarea", record?.details, 'rows="2" maxlength="2000"')}<label>${featureText("subject")}<select name="subject_id">${featureSubjectOptions(record?.subject_id)}</select></label><div class="form-row">${featureField("starts_at", "startsAt", "datetime-local", localDateTimeValue(record?.starts_at), "required")}${featureField("ends_at", "endsAt", "datetime-local", localDateTimeValue(record?.ends_at), "required")}</div><label>${featureText("recurrence")}<select name="recurrence"><option value="none">Does not repeat</option><option value="daily" ${record?.recurrence === "daily" ? "selected" : ""}>Daily</option><option value="weekly" ${record?.recurrence === "weekly" ? "selected" : ""}>Weekly</option></select></label>`;
    } else if (type === "file") {
      fields = `${featureField("file", "file", "file", "", 'required accept=".pdf,.jpg,.jpeg,.png,.webp,.txt,.md,.doc,.docx,.ppt,.pptx"')}<label>${featureText("subject")}<select name="subject_id">${featureSubjectOptions()}</select></label>`;
    } else if (type === "note") {
      fields = `${featureField("title", "title", "text", record?.title || "Untitled note", 'required maxlength="180"')}${featureField("content", "content", "textarea", record?.content, 'rows="8" maxlength="30000"')}<label>${featureText("subject")}<select name="subject_id">${featureSubjectOptions(record?.subject_id)}</select></label>`;
    } else if (type === "goal") {
      fields = `${featureField("title", "title", "text", record?.title, 'required maxlength="160"')}${featureField("details", "details", "textarea", record?.details, 'rows="2" maxlength="2000"')}<div class="form-row"><label>${featureText("period")}<select name="period"><option value="daily">Daily</option><option value="weekly" ${!record || record.period === "weekly" ? "selected" : ""}>Weekly</option><option value="monthly" ${record?.period === "monthly" ? "selected" : ""}>Monthly</option><option value="custom" ${record?.period === "custom" ? "selected" : ""}>Custom</option></select></label>${featureField("unit", "unit", "text", record?.unit || "sessions", 'required maxlength="30"')}</div><div class="form-row">${featureField("target_value", "target", "number", record?.target_value || 1, 'min="0.01" step="0.01" required')}${featureField("current_value", "current", "number", record?.current_value || 0, 'min="0" step="0.01" required')}</div>${featureField("due_at", "dueAt", "date", record?.due_at ? dateKey(new Date(record.due_at)) : "")}`;
    } else if (type === "goal-progress") {
      fields = featureField(
        "increment",
        "progress",
        "number",
        "",
        'min="0.01" step="0.01" required',
      );
    } else if (type === "exam") {
      fields = `${featureField("title", "title", "text", record?.title, 'required maxlength="160"')}${featureField("details", "details", "textarea", record?.details, 'rows="2" maxlength="2000"')}<label>${featureText("subject")}<select name="subject_id">${featureSubjectOptions(record?.subject_id)}</select></label><div class="form-row">${featureField("exam_at", "examAt", "datetime-local", localDateTimeValue(record?.exam_at), "required")}${featureField("max_marks", "maximumMarks", "number", record?.max_marks ?? 100, 'min="0.01" step="0.01" required')}</div>`;
    } else if (type === "exam-result") {
      const currentResult = Array.isArray(record.exam_results)
        ? record.exam_results[0]
        : record.exam_results;
      fields = `${featureField("obtained_marks", "result", "number", currentResult?.obtained_marks ?? record.obtained_marks, `min="0" max="${Number(record.max_marks)}" step="0.01" required`)}${featureField("notes", "notes", "textarea", currentResult?.notes, 'rows="3" maxlength="2000"')}`;
    } else if (type === "profile") {
      const profile = record || {};
      const currentAvatarPreview = accountProfile?.avatar_display_url
        ? `<img src="${escapeHtml(accountProfile.avatar_display_url)}" alt="" style="width:72px;height:72px;border-radius:50%;object-fit:cover;display:block;" />`
        : `<span style="width:72px;height:72px;border-radius:50%;display:grid;place-items:center;background:var(--surface-2,#2a3344);font-weight:700;">${escapeHtml(initials(profile.display_name || session.user.user_metadata?.full_name || session.user?.email || "U"))}</span>`;
      fields = `${featureField("display_name", "displayName", "text", profile.display_name || session.user.user_metadata?.full_name || "", 'required maxlength="100"')}${featureField("timezone", "timezone", "text", profile.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone, 'required maxlength="80"')}<label>${featureText("language")}<select name="language"><option value="en" ${profile.language === "en" ? "selected" : ""}>English</option><option value="ar" ${profile.language === "ar" ? "selected" : ""}>العربية</option></select></label><div style="display:flex;align-items:center;gap:12px;margin:8px 0;"><div id="profile-avatar-preview" style="width:72px;height:72px;">${currentAvatarPreview}</div><div style="display:grid;gap:6px;"><label style="margin:0;">${translateUiText("Choose a profile photo from your device")}<input type="file" name="avatar_file" id="profile-avatar-file" accept="image/png,image/jpeg,image/webp"></label><small>${translateUiText("PNG, JPEG, or WebP · up to 2 MB")}</small></div></div>`;
    } else {
      return;
    }

    let modal = document.getElementById("feature-modal");
    if (!modal) {
      document.body.insertAdjacentHTML(
        "beforeend",
        `<div class="modal-backdrop" id="feature-modal" hidden><section class="modal" role="dialog" aria-modal="true" aria-labelledby="feature-modal-title"><button class="modal-close" type="button" data-close-modal aria-label="Close">×</button><p class="eyebrow">STUDY ZONE</p><h2 id="feature-modal-title"></h2><form id="feature-form" class="form-stack"></form></section></div>`,
      );
      modal = document.getElementById("feature-modal");
      document
        .getElementById("feature-form")
        .addEventListener("submit", async (event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const submit = form.querySelector('[type="submit"]');
          const errorEl = form.querySelector("[data-form-error]");
          submit.disabled = true;
          submit.textContent = featureText("loading");
          errorEl.textContent = "";
          try {
            await saveFeatureForm(form);
          } catch (error) {
            errorEl.textContent =
              `${featureText("error")} ${error.message || ""}`.trim();
            console.error("Study workspace save failed.", error);
          } finally {
            submit.disabled = false;
            submit.textContent = featureText("save");
          }
        });
    }
    document.getElementById("feature-modal-title").textContent = featureText(
      titles[type],
    );
    document.getElementById("feature-form").dataset.featureType = type;
    document.getElementById("feature-form").dataset.recordId = id || "";
    document.getElementById("feature-form").innerHTML =
      `${fields}<p class="form-error" data-form-error role="alert"></p><div class="modal-actions"><button class="button button-secondary" type="button" data-close-modal>${featureText("cancel")}</button><button class="button button-primary" type="submit">${featureText("save")}</button></div>`;
    openModal(modal);
    document
      .querySelector(
        "#feature-form input, #feature-form textarea, #feature-form select",
      )
      ?.focus();
  }

  function featureDate(value) {
    const date = new Date(value);
    if (!value || Number.isNaN(date.getTime()))
      throw new Error("Enter a valid date and time.");
    return date.toISOString();
  }

  async function saveFeatureForm(form) {
    if (!supabase || !session) throw new Error(featureText("signIn"));
    const values = new FormData(form);
    const type = form.dataset.featureType;
    const id = form.dataset.recordId;
    let table;
    let row;

    if (type === "subject") {
      table = "subjects";
      row = {
        name: String(values.get("name") || "").trim(),
        description: String(values.get("description") || "").trim(),
        color: String(values.get("color") || getThemeColor("--color-primary", "#6b7280")),
        credit_hours: Number(values.get("credit_hours")),
      };
    } else if (type === "schedule") {
      const startsAt = featureDate(values.get("starts_at"));
      const endsAt = featureDate(values.get("ends_at"));
      if (new Date(endsAt) <= new Date(startsAt))
        throw new Error("The end time must be after the start time.");
      table = "schedules";
      row = {
        title: String(values.get("title") || "").trim(),
        details: String(values.get("details") || "").trim(),
        subject_id: values.get("subject_id") || null,
        starts_at: startsAt,
        ends_at: endsAt,
        recurrence: values.get("recurrence"),
      };
    } else if (type === "file") {
      await uploadStudyFile(values);
      closeModal(document.getElementById("feature-modal"));
      await loadAccountWorkspace();
      render();
      showToast("File uploaded to your private study storage.");
      return;
    } else if (type === "note") {
      table = "notes";
      row = {
        title: String(values.get("title") || "").trim(),
        content: String(values.get("content") || ""),
        subject_id: values.get("subject_id") || null,
      };
    } else if (type === "goal") {
      table = "goals";
      row = {
        title: String(values.get("title") || "").trim(),
        details: String(values.get("details") || "").trim(),
        period: values.get("period"),
        target_value: Number(values.get("target_value")),
        current_value: Number(values.get("current_value")),
        unit: String(values.get("unit") || "").trim(),
        due_at: values.get("due_at")
          ? new Date(`${values.get("due_at")}T23:59:59`).toISOString()
          : null,
      };
    } else if (type === "goal-progress") {
      const increment = Number(values.get("increment"));
      if (!Number.isFinite(increment) || increment <= 0)
        throw new Error("Enter a positive progress amount.");
      const { error } = await supabase.rpc("increment_goal_progress", {
        p_goal_id: id,
        p_increment: increment,
      });
      if (error) throw error;
      closeModal(document.getElementById("feature-modal"));
      await loadAccountWorkspace();
      render();
      showToast("Goal progress updated.");
      return;
    } else if (type === "exam") {
      table = "exams";
      row = {
        title: String(values.get("title") || "").trim(),
        details: String(values.get("details") || "").trim(),
        subject_id: values.get("subject_id") || null,
        exam_at: featureDate(values.get("exam_at")),
        max_marks: Number(values.get("max_marks")),
      };
    } else if (type === "exam-result") {
      const exam = examResults.find((item) => String(item.id) === String(id));
      const obtainedMarks = Number(values.get("obtained_marks"));
      if (
        !exam ||
        !Number.isFinite(obtainedMarks) ||
        obtainedMarks < 0 ||
        obtainedMarks > Number(exam.max_marks)
      ) {
        throw new Error(featureText("resultRange"));
      }
      const { error } = await supabase.from("exam_results").upsert(
        {
          exam_id: exam.id,
          obtained_marks: obtainedMarks,
          notes: String(values.get("notes") || "").trim(),
        },
        { onConflict: "exam_id" },
      );
      if (error) throw error;
      closeModal(document.getElementById("feature-modal"));
      await loadAccountWorkspace();
      render();
      showToast("Exam result saved.");
      return;
    } else if (type === "profile") {
      const avatarFile = values.get("avatar_file");
      row = {
        display_name: String(values.get("display_name") || "").trim(),
        timezone: String(values.get("timezone") || "").trim(),
        language: values.get("language"),
      };
      const oldAvatarPath = accountProfile?.avatar_url;
      let newAvatarPath = null;
      if (avatarFile instanceof File && avatarFile.size) {
        newAvatarPath = await uploadProfilePhoto(avatarFile);
        row.avatar_url = newAvatarPath;
      }
      const { data, error } = await supabase
        .from("profiles")
        .update(row)
        .eq("id", session.user.id)
        .select("id,display_name,avatar_url,timezone,language")
        .maybeSingle();
      if (error) {
        if (newAvatarPath) {
          const { error: cleanupError } = await supabase.storage
            .from("studyflow-files")
            .remove([newAvatarPath]);
          if (cleanupError) {
            console.error(
              "New profile photo could not be removed after the profile update failed.",
              cleanupError,
            );
            throw new Error(
              `${error.message} Photo cleanup also failed: ${cleanupError.message}`,
            );
          }
        }
        throw error;
      }
      if (!data) {
        let cleanupMessage = "";
        if (newAvatarPath) {
          const { error: cleanupError } = await supabase.storage
            .from("studyflow-files")
            .remove([newAvatarPath]);
          if (cleanupError) {
            console.error(
              "New profile photo could not be removed after no profile row was updated.",
              cleanupError,
            );
            cleanupMessage = ` Photo cleanup also failed: ${cleanupError.message}`;
          }
        }
        throw new Error(
          `No profile row was updated for this account. Re-run the profile setup section in supabase/schema.sql, then retry.${cleanupMessage}`,
        );
      }
      accountProfile = data;
      let avatarCleanupMessage = "";
      if (
        newAvatarPath &&
        oldAvatarPath?.startsWith(`${session.user.id}/`) &&
        oldAvatarPath !== newAvatarPath
      ) {
        const { error: cleanupError } = await supabase.storage
          .from("studyflow-files")
          .remove([oldAvatarPath]);
        if (cleanupError) {
          console.error(
            "The previous profile photo could not be removed.",
            cleanupError,
          );
          avatarCleanupMessage = ` Previous photo cleanup failed: ${cleanupError.message}`;
        }
      }
      if (accountProfile) {
        accountProfile.avatar_display_url = await resolveProfileAvatarUrl(
          accountProfile.avatar_url,
          session.user.id,
        );
      }
      await loadAccountWorkspace();
      closeModal(document.getElementById("feature-modal"));
      render();
      updateUserUi();
      if (row.language !== appLanguage) await setLanguage(row.language);
      showToast(
        `${newAvatarPath ? translateUiText("Profile photo uploaded.") : "Profile updated."}${avatarCleanupMessage}`,
      );
      return;
    } else {
      throw new Error("Unsupported study workspace action.");
    }

    const query = supabase.from(table);
    const result = id
      ? await query.update(row).eq("id", id).select().single()
      : await query.insert(row).select().single();
    if (result.error) throw result.error;
    closeModal(document.getElementById("feature-modal"));
    await loadAccountWorkspace();
    render();
    showToast(id ? "Changes saved." : "Added to your study workspace.");
  }

  async function uploadStudyFile(values) {
    const file = values.get("file");
    const allowedTypes = new Set([
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
      "text/plain",
      "text/markdown",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ]);
    if (
      !(file instanceof File) ||
      !file.size ||
      file.size > 20 * 1024 * 1024 ||
      !allowedTypes.has(file.type)
    ) {
      throw new Error(featureText("fileLimit"));
    }
    const safeName =
      file.name.replace(/[^\w.-]+/g, "_").slice(0, 180) || "study-file";
    const storagePath = `${session.user.id}/${focusId()}-${safeName}`;
    const { error: uploadError } = await supabase.storage
      .from("studyflow-files")
      .upload(storagePath, file, {
        cacheControl: "3600",
        contentType: file.type,
        upsert: false,
      });
    if (uploadError) throw uploadError;

    const { error: rowError } = await supabase.from("study_files").insert({
      name: file.name,
      storage_path: storagePath,
      mime_type: file.type,
      size_bytes: file.size,
      subject_id: values.get("subject_id") || null,
    });
    if (rowError) {
      const { error: cleanupError } = await supabase.storage
        .from("studyflow-files")
        .remove([storagePath]);
      if (cleanupError) {
        console.error(
          "Uploaded file could not be removed after its metadata insert failed.",
          cleanupError,
        );
        throw new Error(
          `${rowError.message} File cleanup also failed: ${cleanupError.message}`,
        );
      }
      throw rowError;
    }
  }

  async function uploadProfilePhoto(file) {
    const allowedTypes = new Map([
      ["image/jpeg", "jpg"],
      ["image/png", "png"],
      ["image/webp", "webp"],
    ]);
    const extension = allowedTypes.get(file.type);
    if (!extension || !file.size || file.size > 2 * 1024 * 1024) {
      throw new Error(translateUiText("PNG, JPEG, or WebP · up to 2 MB"));
    }
    const storagePath = `${session.user.id}/avatars/${focusId()}.${extension}`;
    try { await cacheAvatarBlob(session.user.id, storagePath, file); } catch {}
    const { error } = await supabase.storage
      .from("studyflow-files")
      .upload(storagePath, file, {
        cacheControl: "3600",
        contentType: file.type,
        upsert: false,
      });
    if (error) throw error;
    return storagePath;
  }

  async function deleteFeatureRecord(type, id) {
    if (!supabase || !session) return;
    const configByType = {
      subject: {
        table: "subjects",
        items: subjects,
        name: (item) => item.name,
      },
      schedule: {
        table: "schedules",
        items: schedule,
        name: (item) => item.title,
      },
      file: {
        table: "study_files",
        items: sampleFiles,
        name: (item) => item.name,
      },
      note: { table: "notes", items: sampleNotes, name: (item) => item.title },
      goal: { table: "goals", items: goals, name: (item) => item.title },
      exam: { table: "exams", items: examResults, name: (item) => item.title },
    };
    const config = configByType[type];
    const record = config?.items.find((item) => String(item.id) === String(id));
    if (!record) return;
    const warning =
      type === "subject"
        ? `Delete subject "${config.name(record)}"? Linked records will be preserved without a subject.`
        : `Delete "${config.name(record)}"? This cannot be undone.`;
    if (!window.confirm(warning)) return;

    if (type === "file") {
      const { error: storageError } = await supabase.storage
        .from("studyflow-files")
        .remove([record.storage_path]);
      if (storageError) {
        showToast(
          `Could not delete the file from private storage: ${storageError.message}`,
        );
        console.error("Study file storage deletion failed.", storageError);
        return;
      }
    }
    const { error } = await supabase.from(config.table).delete().eq("id", id);
    if (error) {
      showToast(`Could not delete this record: ${error.message}`);
      console.error("Study workspace deletion failed.", error);
      return;
    }
    await loadAccountWorkspace();
    render();
    showToast("Record deleted.");
  }

  async function downloadStudyFile(id) {
    const file = sampleFiles.find((item) => String(item.id) === String(id));
    if (!file || !supabase || !session) return;
    const { data, error } = await supabase.storage
      .from("studyflow-files")
      .createSignedUrl(file.storage_path, 60);
    if (error) {
      showToast(`Could not create a private download link: ${error.message}`);
      console.error("Study file signed URL request failed.", error);
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  function focusLocale() {
    return appLanguage === "ar" ? "ar-EG" : "en";
  }

  function focusDurationFor(type, settings = focusSettings) {
    if (type === "short_break") return settings.shortBreakMinutes;
    if (type === "long_break") return settings.longBreakMinutes;
    return settings.focusMinutes;
  }

  function getFocusDurationMs(type = focusSession.type) {
    if (
      type === "focus" &&
      Number.isInteger(focusSession.durationMinutes) &&
      focusSession.durationMinutes >= 1 &&
      focusSession.durationMinutes <= 180
    ) {
      return focusSession.durationMinutes * 60000;
    }
    return focusDurationFor(type) * 60000;
  }

  function getFocusElapsedMs(now = Date.now()) {
    const activeRun =
      focusSession.status === "running" && focusSession.runStartedAt
        ? Math.max(0, now - focusSession.runStartedAt)
        : 0;
    return Math.max(
      0,
      Number(focusSession.elapsedBeforeRunMs || 0) + activeRun,
    );
  }

  function getFocusRemainingMs(now = Date.now()) {
    if (focusSession.status === "running" && focusSession.endAt) {
      return Math.max(0, focusSession.endAt - now);
    }
    return Math.max(0, Number(focusSession.remainingMs || 0));
  }

  function focusId() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    const bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 15) | 64;
    bytes[8] = (bytes[8] & 63) | 128;
    const hex = [...bytes]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  const FLIP_ANIMATION_MS = 620;
  const flipDigitTimers = new WeakMap();

  function renderFlipDigit(digit, index) {
    return `<span class="flip-digit" data-flip-index="${index}" data-digit="${digit}" aria-hidden="true"><span class="flip-half flip-half-upper">${digit}</span><span class="flip-half flip-half-lower">${digit}</span><span class="flip-flap flip-flap-upper">${digit}</span><span class="flip-flap flip-flap-lower">${digit}</span></span>`;
  }

  function settleFlipDigit(element) {
    if (!element) return;
    const timer = flipDigitTimers.get(element);
    if (timer) {
      window.clearTimeout(timer);
      flipDigitTimers.delete(element);
    }
    const value = element.dataset.digit ?? "0";
    const upper = element.querySelector(".flip-half-upper");
    const lower = element.querySelector(".flip-half-lower");
    if (upper) upper.textContent = value;
    if (lower) lower.textContent = value;
    element.classList.remove("flipping");
  }

  /**
   * Drives one mechanical split-flap digit. The static upper face already holds
   * the incoming value (hidden by the falling flap) while the static lower face
   * holds the outgoing value until the incoming lower flap lands.
   */
  function flipDigitTo(element, next) {
    if (!element) return;
    const nextValue = String(next);
    const previousValue = element.dataset.digit ?? nextValue;
    if (previousValue === nextValue) return;
    const upper = element.querySelector(".flip-half-upper");
    const lower = element.querySelector(".flip-half-lower");
    const flapUpper = element.querySelector(".flip-flap-upper");
    const flapLower = element.querySelector(".flip-flap-lower");
    if (!upper || !lower || !flapUpper || !flapLower) return;

    // If a previous flip is still in flight, land it before starting the next
    // one. This prevents overlapping keyframes and duplicated intermediate digits.
    if (element.classList.contains("flipping")) settleFlipDigit(element);
    const pending = flipDigitTimers.get(element);
    if (pending) {
      window.clearTimeout(pending);
      flipDigitTimers.delete(element);
    }

    element.dataset.digit = nextValue;
    if (!shouldAnimate()) {
      upper.textContent = nextValue;
      lower.textContent = nextValue;
      element.classList.remove("flipping");
      return;
    }

    upper.textContent = nextValue;
    lower.textContent = previousValue;
    flapUpper.textContent = previousValue;
    flapLower.textContent = nextValue;
    element.classList.remove("flipping");
    void element.offsetWidth;
    element.classList.add("flipping");
    const timer = window.setTimeout(() => {
      flipDigitTimers.delete(element);
      if (element.dataset.digit !== nextValue) return;
      settleFlipDigit(element);
    }, FLIP_ANIMATION_MS);
    flipDigitTimers.set(element, timer);
  }

  function renderFlipClock(milliseconds, showSeconds) {
    const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
    const minutesText = String(Math.floor(seconds / 60)).padStart(2, "0");
    const secondText = String(seconds % 60).padStart(2, "0");
    return {
      minutes: [...minutesText].map(renderFlipDigit).join(""),
      seconds: showSeconds
        ? [...secondText]
            .map((digit, index) =>
              renderFlipDigit(digit, index + minutesText.length),
            )
            .join("")
        : "",
    };
  }

  function getNextBreakType() {
    const completed = focusRecords.filter(
      (record) => record.session_type === "focus" && record.completed,
    ).length;
    return (completed + 1) % focusSettings.longBreakInterval === 0
      ? "long_break"
      : "short_break";
  }

  function focusSessionTypeLabel(type, text = focusText[appLanguage]) {
    if (type === "short_break") return text.shortBreak;
    if (type === "long_break") return text.longBreak;
    return text.focus;
  }

  function formatFocusDuration(seconds, text = focusText[appLanguage]) {
    const minutes = Math.floor(Math.max(0, seconds) / 60);
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    const number = (value) =>
      new Intl.NumberFormat(focusLocale()).format(value);
    if (hours)
      return `${number(hours)}${text.hours} ${number(remainder)}${text.mins}`;
    return `${number(minutes)} ${text.mins}`;
  }

  function formatFocusHours(seconds, text = focusText[appLanguage]) {
    const hours = seconds / 3600;
    const value = new Intl.NumberFormat(focusLocale(), {
      maximumFractionDigits: 1,
    }).format(hours);
    return `${value}${text.hours}`;
  }

  function localDateKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function getFocusStats(now = new Date()) {
    const completed = focusRecords.filter(
      (record) => record.session_type === "focus" && record.completed,
    );
    const todayKey = localDateKey(now);
    const weekStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const mondayOffset = (weekStart.getDay() + 6) % 7;
    weekStart.setDate(weekStart.getDate() - mondayOffset);
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const runningSeconds =
      focusSession.type === "focus" && focusSession.startedAt
        ? Math.floor(getFocusElapsedMs(now.getTime()) / 1000)
        : 0;
    const durations = completed
      .map((record) => ({
        started: new Date(record.started_at),
        seconds: Math.max(0, Number(record.duration_seconds || 0)),
      }))
      .filter((record) => !Number.isNaN(record.started.getTime()));
    const todayRecords = durations.filter(
      (record) => localDateKey(record.started) === todayKey,
    );
    const weekSeconds =
      durations
        .filter(
          (record) => record.started >= weekStart && record.started <= now,
        )
        .reduce((sum, record) => sum + record.seconds, 0) +
      (focusSession.type === "focus" &&
      focusSession.startedAt &&
      new Date(focusSession.startedAt) >= weekStart
        ? runningSeconds
        : 0);
    const todaySeconds =
      todayRecords.reduce((sum, record) => sum + record.seconds, 0) +
      (focusSession.type === "focus" &&
      focusSession.startedAt &&
      localDateKey(new Date(focusSession.startedAt)) === todayKey
        ? runningSeconds
        : 0);
    const dayKeys = new Set(
      durations.map((record) => localDateKey(record.started)),
    );
    if (runningSeconds && focusSession.startedAt)
      dayKeys.add(localDateKey(new Date(focusSession.startedAt)));
    const streakAnchor = dayKeys.has(todayKey)
      ? dayStart
      : new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    let streak = 0;
    for (
      let cursor = streakAnchor;
      dayKeys.has(localDateKey(cursor));
      cursor.setDate(cursor.getDate() - 1)
    )
      streak += 1;
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(
        weekStart.getFullYear(),
        weekStart.getMonth(),
        weekStart.getDate() + index,
      );
      const daySeconds =
        durations
          .filter(
            (record) => localDateKey(record.started) === localDateKey(date),
          )
          .reduce((sum, record) => sum + record.seconds, 0) +
        (focusSession.type === "focus" &&
        focusSession.startedAt &&
        localDateKey(new Date(focusSession.startedAt)) === localDateKey(date)
          ? runningSeconds
          : 0);
      return { date, seconds: daySeconds };
    });
    return {
      todaySeconds,
      todaySessions: todayRecords.length,
      weekSeconds,
      streak,
      totalCycles: completed.length,
      days,
    };
  }

  function updateActivityFromFocusRecords() {
    if (!session) {
      activity = previewActivity;
      return;
    }
    const pendingIds = new Set(
      pendingFocusRecords.map((record) => record.idempotency_key),
    );
    const today = new Date();
    const firstDay = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() - 6,
    );
    activity = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(
        firstDay.getFullYear(),
        firstDay.getMonth(),
        firstDay.getDate() + index,
      );
      const key = localDateKey(date);
      const seconds = focusRecords.reduce((sum, record) => {
        if (
          !record.completed ||
          record.session_type !== "focus" ||
          pendingIds.has(record.idempotency_key)
        )
          return sum;
        const endedAt = new Date(record.ended_at || record.started_at);
        return localDateKey(endedAt) === key
          ? sum + Math.max(0, Number(record.duration_seconds) || 0)
          : sum;
      }, 0);
      return {
        day: new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(
          date,
        ),
        hours: seconds / 3600,
      };
    });
  }

  function renderFocusChart(days, text) {
    const displayDays =
      appLanguage === "ar" ? [days[6], ...days.slice(0, 6)] : days;
    const maxSeconds = Math.max(3600, ...days.map((day) => day.seconds));
    const bars = displayDays
      .map((day) => {
        const label = new Intl.DateTimeFormat(focusLocale(), {
          weekday: "short",
        }).format(day.date);
        const height = Math.max(
          day.seconds ? 4 : 0,
          (day.seconds / maxSeconds) * 100,
        );
        return `<div class="focus-chart-day" title="${escapeHtml(label)}: ${escapeHtml(formatFocusHours(day.seconds, text))}"><div class="focus-chart-track"><span style="height:${height}%"></span></div><small>${escapeHtml(label)}</small></div>`;
      })
      .join("");
    return `<div class="focus-chart" role="img" aria-label="${escapeHtml(text.weeklyChart)}">${bars}</div>`;
  }

  function renderFocusHistoryRow(record, text) {
    const subject = subjects.find(
      (item) => String(item.id) === String(record.subject_id),
    )?.name;
    const task = tasks.find(
      (item) => String(item.id) === String(record.task_id),
    )?.title;
    const date = new Date(record.ended_at || record.started_at);
    const label = new Intl.DateTimeFormat(focusLocale(), {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
    const duration = `${new Intl.NumberFormat(focusLocale()).format(Math.floor(Number(record.duration_seconds || 0) / 60))} ${text.mins}`;
    return `<article class="focus-history-row ${record.completed ? "" : "incomplete"}"><span class="focus-history-type ${escapeHtml(record.session_type)}" aria-hidden="true">${record.session_type === "focus" ? "◷" : "☕"}</span><div class="focus-history-details"><strong>${escapeHtml(focusSessionTypeLabel(record.session_type, text))}</strong><small dir="auto">${escapeHtml(task || subject || text.emptySubject)}</small></div><time>${escapeHtml(label)}</time><span class="focus-history-duration" dir="ltr">${escapeHtml(duration)}</span></article>`;
  }

  function renderFocusSettings(text) {
    const numberField = (name, label, value, min, max) =>
      `<label>${label}<input type="number" name="${name}" value="${value}" min="${min}" max="${max}" required></label>`;
    const toggleField = (name, label, checked) =>
      `<label class="focus-setting-toggle"><span>${label}</span><input type="checkbox" name="${name}" ${checked ? "checked" : ""}><i aria-hidden="true"></i></label>`;
    const clockSizeOptions = [
      ["compact", text.clockSizeCompact],
      ["default", text.clockSizeDefault],
      ["large", text.clockSizeLarge],
    ]
      .map(
        ([value, label]) =>
          `<option value="${value}" ${focusSettings.clockSize === value ? "selected" : ""}>${label}</option>`,
      )
      .join("");
    return `<section class="panel focus-settings-panel" id="focus-settings-panel" aria-labelledby="focus-settings-title">
      <div class="panel-heading"><div><h2 id="focus-settings-title">${text.settingsTitle}</h2><p>${text.durations}</p></div><button class="icon-button" data-action="focus-settings-close" aria-label="${deadlineText[appLanguage].close}">×</button></div>
      <form id="focus-settings-form" class="focus-settings-form" novalidate>
        <div class="focus-duration-fields">${numberField("focusMinutes", text.focusDuration, focusSettings.focusMinutes, 1, 180)}${numberField("shortBreakMinutes", text.shortDuration, focusSettings.shortBreakMinutes, 1, 180)}${numberField("longBreakMinutes", text.longDuration, focusSettings.longBreakMinutes, 1, 180)}${numberField("longBreakInterval", `${text.longInterval} (${text.sessions})`, focusSettings.longBreakInterval, 2, 12)}</div>
        <h3>${text.behavior}</h3><div class="focus-setting-options">
          ${toggleField("autoStartFocus", text.autoFocus, focusSettings.autoStartFocus)}
          ${toggleField("autoStartBreaks", text.autoBreaks, focusSettings.autoStartBreaks)}
          ${toggleField("soundEnabled", text.sound, focusSettings.soundEnabled)}
          ${toggleField("browserNotifications", text.browserNotifications, focusSettings.browserNotifications)}
          ${toggleField("showSeconds", text.showSeconds, focusSettings.showSeconds)}
          <label class="focus-clock-size"><span>${text.clockSize}</span><select name="clockSize" aria-label="${text.clockSize}">${clockSizeOptions}</select></label>
        </div>
        <h3>${text.soundVolume}</h3>
        <div class="focus-setting-options">
          <label>${text.focusStartSound}<select name="startSound">${ALERT_SOUNDS.map((sound) => `<option value="${sound.id}" ${focusSettings.startSound === sound.id ? "selected" : ""}>${sound.label[appLanguage] || sound.label.en}</option>`).join("")}</select></label>
          <label>${text.focusEndSound}<select name="endSound">${ALERT_SOUNDS.map((sound) => `<option value="${sound.id}" ${focusSettings.endSound === sound.id ? "selected" : ""}>${sound.label[appLanguage] || sound.label.en}</option>`).join("")}</select></label>
          <label>${text.breakEndSound}<select name="breakEndSound">${ALERT_SOUNDS.map((sound) => `<option value="${sound.id}" ${focusSettings.breakEndSound === sound.id ? "selected" : ""}>${sound.label[appLanguage] || sound.label.en}</option>`).join("")}</select></label>
          <label>${text.soundVolume}<input type="range" name="soundVolume" min="0" max="100" step="5" value="${focusSettings.soundVolume}" /><span dir="ltr">${focusSettings.soundVolume}%</span></label>
          <label>${text.soundDuration}<select name="soundDuration">${[3, 5, 10, 15].map((seconds) => `<option value="${seconds}" ${Number(focusSettings.soundDuration) === seconds ? "selected" : ""}>${seconds}</option>`).join("")}</select></label>
          ${toggleField("soundRepeat", text.soundRepeat, focusSettings.soundRepeat)}
        </div>
        <button class="button button-secondary button-small" type="button" data-action="focus-sound-preview">${text.soundPreview}</button>
        <div class="focus-settings-actions"><button class="button button-secondary" type="button" data-action="focus-settings-defaults">${text.restoreDefaults}</button><button class="button button-primary" type="submit">${text.saveSettings}</button></div>
        <p class="focus-settings-error" id="focus-settings-error" role="alert"></p>
      </form>
    </section>`;
  }

  function focusPage() {
    const t = focusText[appLanguage];
    const durationMs = getFocusDurationMs(focusSession.type);
    const remaining = getFocusRemainingMs();
    const progress = Math.min(
      100,
      Math.max(0, ((durationMs - remaining) / durationMs) * 100),
    );
    const focusedTask =
      tasks.find((task) => String(task.id) === String(focusSession.taskId)) ||
      tasksForDay(dateKey(new Date())).find(
        (task) => String(task.id) === String(focusSession.taskId),
      );
    const focusedSubject = subjects.find(
      (subject) => String(subject.id) === String(focusSession.subjectId),
    );
    const phase =
      focusSession.type === "focus"
        ? t.focus
        : focusSession.type === "short_break"
          ? t.shortBreak
          : t.longBreak;
    const clock = renderFlipClock(remaining, focusSettings.showSeconds);
    const subjectOptions = [
      `<option value="">${t.chooseSubject}</option>`,
      ...subjects.map(
        (subject) =>
          `<option value="${escapeHtml(subject.id)}" ${String(subject.id) === String(focusSession.subjectId) ? "selected" : ""}>${escapeHtml(subject.name)}</option>`,
      ),
    ].join("");
    const taskOptions = [
      `<option value="">${t.noTask}</option>`,
      ...tasksForDay(dateKey(new Date()))
        .filter((task) => task.status !== "completed")
        .map(
          (task) =>
            `<option value="${escapeHtml(task.routine_id || task.id)}" ${String(task.routine_id || task.id) === String(focusSession.taskId) ? "selected" : ""}>${escapeHtml(task.title)}</option>`,
        ),
    ].join("");
    const nextPhase =
      focusSession.type === "focus"
        ? getNextBreakType() === "long_break"
          ? t.longBreak
          : t.shortBreak
        : t.focus;
    const settingsPanel = focusSettingsOpen ? renderFocusSettings(t) : "";
    const stats = getFocusStats();
    const distractionStats = distractionSummary();
    const history = focusRecords
      .slice()
      .sort(
        (a, b) =>
          new Date(b.ended_at || b.started_at) -
          new Date(a.ended_at || a.started_at),
      )
      .slice(0, 6);
    const historyRows = history
      .map((record) => renderFocusHistoryRow(record, t))
      .join("");
    return `<section class="focus-page ${distractionFree ? "distraction-free" : ""}" data-session-type="${focusSession.type}" data-session-status="${focusSession.status}" data-clock-size="${escapeHtml(focusSettings.clockSize)}">
      <header class="page-heading focus-heading"><div><p class="eyebrow">${t.eyebrow}</p><h1>${t.title}</h1><p class="page-subtitle">${t.subtitle}</p></div><div class="focus-heading-actions">
        <button class="button button-secondary button-small" data-action="focus-prep-open">${appLanguage === "ar" ? "تجهيز الجلسة" : "Prepare session"}</button>
        <button class="button button-secondary button-small" data-action="focus-distraction-log">${appLanguage === "ar" ? "تشتّت" : "Distracted"}</button>
        <button class="button button-secondary button-small" data-action="focus-fullscreen">${appLanguage === "ar" ? "ملء الشاشة" : "Full screen"}</button>
        <button class="button button-secondary button-small" data-action="focus-deep-toggle" aria-pressed="${distractionFree}">${distractionFree ? t.exitDistraction : t.distraction}</button>
        <button class="icon-button" data-action="focus-settings" aria-label="${t.settings}" aria-expanded="${focusSettingsOpen}">⚙</button>
      </div></header>
      ${settingsPanel}
      <div class="focus-main-grid">
        <section class="panel focus-clock-panel">
          <div class="focus-mode-pill">${phase}</div>
          <div class="focus-cycle">${t.cycle} ${new Intl.NumberFormat(appLanguage === "ar" ? "ar-EG" : "en").format(focusSession.cycle)} · ${t.longBreak} ${new Intl.NumberFormat(appLanguage === "ar" ? "ar-EG" : "en").format(focusSettings.longBreakInterval)}</div>
          <div class="flip-clock" id="flip-clock" role="timer" aria-live="off" aria-label="${escapeHtml(formatTimer(Math.ceil(remaining / 1000)))}" dir="ltr">
            ${clock.minutes}<span class="flip-clock-colon" ${focusSettings.showSeconds ? "" : "hidden"}>:</span>${focusSettings.showSeconds ? clock.seconds : ""}
          </div>
          <div class="focus-progress" role="progressbar" aria-label="${phase}" aria-valuenow="${Math.round(progress)}" aria-valuemin="0" aria-valuemax="100"><span id="focus-progress-fill" style="--focus-progress:${(progress / 100).toFixed(4)}"></span></div>
          <p class="focus-session-message" id="focus-session-message">${focusSession.type === "focus" ? (focusSession.status === "running" ? t.stayFocused : t.focusHint) : t.breakHint}</p>
          ${focusSession.goal ? `<p class="focus-session-goal" dir="auto"><span>${appLanguage === "ar" ? "هدف الجلسة" : "Session goal"}</span><strong>${escapeHtml(focusSession.goal)}</strong></p>` : ""}
          <p class="focus-session-context" dir="auto">${escapeHtml(focusedTask?.title || focusedSubject?.name || (focusSession.type === "focus" ? t.emptySubject : nextPhase))}</p>
          <div class="focus-selectors">
            <label>${t.subject}<select id="focus-subject" aria-label="${t.subject}">${subjectOptions}</select></label>
            <label>${t.task}<select id="focus-task" aria-label="${t.task}">${taskOptions}</select></label>
          </div>
          <div class="focus-controls">
            <button class="button button-primary" id="timer-toggle">${focusSession.status === "running" ? t.pause : focusSession.status === "paused" ? t.resume : t.start}</button>
            <button class="button button-secondary" id="timer-reset">${t.reset}</button>
            <button class="button button-secondary" id="timer-skip">${t.skip}</button>
          </div>
          <div class="focus-next-session">${t.next}: <strong>${nextPhase}</strong>${focusSession.tools ? ` · ${appLanguage === "ar" ? "أدواتك" : "Tools"}: ${escapeHtml(focusSession.tools)}` : ""}</div>
          <div class="focus-distraction-summary">
            <span><strong>${new Intl.NumberFormat(appLanguage === "ar" ? "ar-EG" : "en").format(distractionStats.today)}</strong> ${appLanguage === "ar" ? "تشتت اليوم" : "distractions today"}</span>
            <span><strong>${new Intl.NumberFormat(appLanguage === "ar" ? "ar-EG" : "en").format(distractionStats.week)}</strong> ${appLanguage === "ar" ? "هذا الأسبوع" : "this week"}</span>
            <span>${appLanguage === "ar" ? "الأكثر" : "Most common"}: <strong dir="auto">${escapeHtml(distractionStats.topReason)}</strong></span>
          </div>
        </section>
        <aside class="focus-side">
          <section class="panel focus-stats-panel">${panelHeading(t.focusTimeToday, t.completedToday)}
            <div class="focus-today-value">${escapeHtml(formatFocusDuration(stats.todaySeconds, t))}</div>
            <p class="metric-caption">${new Intl.NumberFormat(appLanguage === "ar" ? "ar-EG" : "en").format(stats.todaySessions)} ${t.completedToday.toLocaleLowerCase(appLanguage)}</p>
            <div class="focus-mini-stats"><div><strong>${escapeHtml(formatFocusHours(stats.weekSeconds, t))}</strong><span>${t.weeklyHours}</span></div><div><strong>${new Intl.NumberFormat(appLanguage === "ar" ? "ar-EG" : "en").format(stats.streak)}</strong><span>${t.streak}</span></div><div><strong>${new Intl.NumberFormat(appLanguage === "ar" ? "ar-EG" : "en").format(stats.totalCycles)}</strong><span>${t.totalCycles}</span></div></div>
          </section>
          ${focusSoundPanel()}
          <section class="panel focus-chart-panel">${panelHeading(t.weeklyChart, t.hourChart)}${renderFocusChart(stats.days, t)}</section>
        </aside>
      </div>
      <section class="panel focus-history-panel">${panelHeading(t.sessionHistory, `${history.length} ${appLanguage === "ar" ? "جلسات" : "sessions"}`)}
        ${historyRows || `<div class="empty-state"><strong>${t.noHistory}</strong>${t.noHistoryHint}</div>`}
      </section>
      <p class="data-caption">${session ? t.databaseNote : t.notSavedGuest}${focusDataError ? ` ${escapeHtml(t.dataError)}` : ""}${focusSaving ? ` ${t.pending}` : ""}</p>
    </section>`;
  }

  function analyticsPage() {
    const t = deadlineText[appLanguage];
    const now = new Date();
    const startOfToday = startOfLocalDay(now);

    // ---- Compute date range based on analyticsRange ----
    let rangeStart, rangeEnd, rangeLabel;
    const oneDay = 86400000;
    switch (analyticsRange) {
      case "daily":
        rangeStart = startOfToday;
        rangeEnd = startOfToday;
        rangeLabel = appLanguage === "ar" ? "اليوم" : "Today";
        break;
      case "weekly": {
        const startDay = analyticsCustomStart ?? 1; // default Monday
        const currentDay = now.getDay();
        const offset = (currentDay + 7 - startDay) % 7;
        rangeStart = startOfLocalDay(addLocalDays(now, -offset));
        rangeEnd = startOfLocalDay(addLocalDays(rangeStart, 6));
        rangeLabel = appLanguage === "ar" ? "هذا الأسبوع" : "This week";
        break;
      }
      case "monthly": {
        rangeStart = new Date(now.getFullYear(), now.getMonth(), 1);
        rangeEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        rangeLabel = new Intl.DateTimeFormat(appLanguage === "ar" ? "ar-EG" : "en", { month: "long", year: "numeric" }).format(now);
        break;
      }
      case "yearly": {
        rangeStart = new Date(now.getFullYear(), 0, 1);
        rangeEnd = new Date(now.getFullYear(), 11, 31);
        rangeLabel = String(now.getFullYear());
        break;
      }
      case "rolling7":
        rangeStart = startOfLocalDay(addLocalDays(now, -6));
        rangeEnd = startOfToday;
        rangeLabel = appLanguage === "ar" ? "آخر ٧ أيام" : "Last 7 days";
        break;
      case "rolling30":
        rangeStart = startOfLocalDay(addLocalDays(now, -29));
        rangeEnd = startOfToday;
        rangeLabel = appLanguage === "ar" ? "آخر ٣٠ يومًا" : "Last 30 days";
        break;
      case "custom": {
        const s = analyticsCustomRange.start ? new Date(`${analyticsCustomRange.start}T00:00:00`) : startOfToday;
        const e = analyticsCustomRange.end ? new Date(`${analyticsCustomRange.end}T00:00:00`) : startOfToday;
        rangeStart = s;
        rangeEnd = e;
        rangeLabel = `${dateKey(rangeStart)} → ${dateKey(rangeEnd)}`;
        break;
      }
      default:
        rangeStart = startOfLocalDay(addLocalDays(now, -6));
        rangeEnd = startOfToday;
        rangeLabel = appLanguage === "ar" ? "آخر ٧ أيام" : "Last 7 days";
    }

    const rangeStartKey = dateKey(rangeStart);
    const rangeEndKey = dateKey(rangeEnd);

    analyticsMode = analyticsRange === "yearly" || analyticsRange === "monthly" ? "months" : "days";

    // ---- Filter focus records by range ----
    const recordsInRange = focusRecords.filter((record) => {
      if (!record.completed || record.session_type !== "focus") return false;
      const ended = new Date(record.ended_at || record.started_at);
      const key = dateKey(ended);
      return key >= rangeStartKey && key <= rangeEndKey;
    });

    const totalFocusSeconds = recordsInRange.reduce(
      (sum, r) => sum + Number(r.duration_seconds || 0),
      0,
    );
    const focusSessionsCount = recordsInRange.length;
    const avgSessionMinutes = focusSessionsCount
      ? Math.round(totalFocusSeconds / focusSessionsCount / 60)
      : 0;

    // ---- Filter tasks by range ----
    const tasksInRange = tasks.filter((task) => {
      if (!task.due_at) return false;
      const key = taskEndKey(task) || dateKey(new Date(task.due_at));
      return key >= rangeStartKey && key <= rangeEndKey;
    });
    const completedTasks = tasksInRange.filter((t) => t.status === "completed");
    const taskRate = tasksInRange.length
      ? Math.round((completedTasks.length / tasksInRange.length) * 100)
      : 0;
    const overdueTasks = tasksInRange.filter(
      (t) => t.status !== "completed" && taskEndKey(t) && taskEndKey(t) < dateKey(startOfToday),
    );

    analyticsBuckets = buildAnalyticsBuckets(rangeStart, rangeEnd, analyticsMode);
    analyticsValues = analyticsBuckets.map((bucket) =>
      analyticsMetricValue(analyticsMetric, bucket, recordsInRange, tasksInRange, completedTasks),
    );

    // ---- Subject activity ----
    const subjectSeconds = new Map();
    recordsInRange.forEach((r) => {
      if (r.subject_id) {
        subjectSeconds.set(
          r.subject_id,
          (subjectSeconds.get(r.subject_id) || 0) + Number(r.duration_seconds || 0),
        );
      }
    });
    const topSubjectId = [...subjectSeconds.entries()]
      .sort((a, b) => b[1] - a[1])[0]?.[0];
    const topSubject = topSubjectId ? subjectName(topSubjectId) : "—";

    // ---- Study streak (consecutive days with activity) ----
    const activeDays = new Set(
      recordsInRange.map((r) => dateKey(new Date(r.ended_at || r.started_at))),
    );
    let streak = 0;
    let cursor = new Date(rangeEnd);
    while (activeDays.has(dateKey(cursor))) {
      streak += 1;
      cursor = addLocalDays(cursor, -1);
      if (cursor < rangeStart) break;
    }

    // ---- Daily breakdown for chart ----
    const dayCount = Math.ceil((rangeEnd - rangeStart) / oneDay) + 1;
    const dailyData = [];
    for (let i = 0; i < dayCount; i++) {
      const day = addLocalDays(rangeStart, i);
      const key = dateKey(day);
      const seconds = recordsInRange
        .filter((r) => dateKey(new Date(r.ended_at || r.started_at)) === key)
        .reduce((sum, r) => sum + Number(r.duration_seconds || 0), 0);
      const completed = tasksInRange.filter(
        (t) => t.status === "completed" && taskEndKey(t) === key,
      ).length;
      const total = tasksInRange.filter(
        (t) => taskEndKey(t) === key,
      ).length;
      dailyData.push({ date: day, key, seconds, completed, total });
    }

    // Keep long ranges readable: aggregate to weeks/months instead of wrapping
    // hundreds of daily bars into a very tall grid.
    let chartData = dailyData;
    let chartTitle = appLanguage === "ar" ? "ساعات الدراسة اليومية" : "Daily study hours";
    let chartLabelMode = "day";
    if (dayCount > 120) {
      const byMonth = new Map();
      dailyData.forEach((item) => {
        const monthKey = `${item.date.getFullYear()}-${item.date.getMonth()}`;
        const bucket =
          byMonth.get(monthKey) ||
          {
            date: new Date(item.date.getFullYear(), item.date.getMonth(), 1),
            key: monthKey,
            seconds: 0,
            completed: 0,
            total: 0,
          };
        bucket.seconds += item.seconds;
        bucket.completed += item.completed;
        bucket.total += item.total;
        byMonth.set(monthKey, bucket);
      });
      chartData = [...byMonth.values()];
      chartTitle = appLanguage === "ar" ? "ساعات الدراسة الشهرية" : "Monthly study hours";
      chartLabelMode = "month";
    } else if (dayCount > 31) {
      chartData = [];
      for (let index = 0; index < dailyData.length; index += 7) {
        const slice = dailyData.slice(index, index + 7);
        if (!slice.length) continue;
        chartData.push({
          date: slice[0].date,
          key: slice[0].key,
          seconds: slice.reduce((sum, item) => sum + item.seconds, 0),
          completed: slice.reduce((sum, item) => sum + item.completed, 0),
          total: slice.reduce((sum, item) => sum + item.total, 0),
        });
      }
      chartTitle = appLanguage === "ar" ? "ساعات الدراسة الأسبوعية" : "Weekly study hours";
      chartLabelMode = "week";
    }
    const maxSeconds = Math.max(3600, ...chartData.map((d) => d.seconds));
    const bars = chartData
      .map((d) => {
        const label = new Intl.DateTimeFormat(
          appLanguage === "ar" ? "ar-EG" : "en",
          chartLabelMode === "day"
            ? { weekday: "short" }
            : chartLabelMode === "week"
              ? { month: "short", day: "numeric" }
              : { month: "short" },
        ).format(d.date);
        const height = d.seconds ? Math.max(4, (d.seconds / maxSeconds) * 100) : 0;
        return `<div class="focus-chart-day" title="${escapeHtml(label)}: ${escapeHtml(formatFocusHours(d.seconds, focusText[appLanguage]))}"><div class="focus-chart-track"><span style="height:${height}%"></span></div><small>${escapeHtml(label)}</small></div>`;
      })
      .join("");

    const rangeOptions = [
      ["daily", appLanguage === "ar" ? "يومي" : "Daily"],
      ["weekly", appLanguage === "ar" ? "أسبوعي" : "Weekly"],
      ["monthly", appLanguage === "ar" ? "شهري" : "Monthly"],
      ["yearly", appLanguage === "ar" ? "سنوي" : "Yearly"],
      ["rolling7", appLanguage === "ar" ? "آخر ٧ أيام متحركة" : "Rolling 7 days"],
      ["rolling30", appLanguage === "ar" ? "آخر ٣٠ يومًا متحركة" : "Rolling 30 days"],
      ["custom", appLanguage === "ar" ? "نطاق مخصص" : "Custom range"],
    ]
      .map(
        ([value, label]) =>
          `<option value="${value}" ${analyticsRange === value ? "selected" : ""}>${label}</option>`,
      )
      .join("");

    const weekStartOptions = [
      [0, appLanguage === "ar" ? "السبت" : "Saturday"],
      [1, appLanguage === "ar" ? "الإثنين" : "Monday"],
      [2, appLanguage === "ar" ? "الثلاثاء" : "Tuesday"],
      [3, appLanguage === "ar" ? "الأربعاء" : "Wednesday"],
      [4, appLanguage === "ar" ? "الخميس" : "Thursday"],
      [5, appLanguage === "ar" ? "الجمعة" : "Friday"],
      [6, appLanguage === "ar" ? "الأحد" : "Sunday"],
    ]
      .map(
        ([value, label]) =>
          `<option value="${value}" ${analyticsCustomStart === value ? "selected" : ""}>${label}</option>`,
      )
      .join("");

    const customRangeUI =
      analyticsRange === "custom"
        ? `<div class="form-row"><label>${appLanguage === "ar" ? "من تاريخ" : "From date"}<input type="date" id="analytics-range-start" data-sz-range-group="analytics" data-sz-range-role="start" value="${analyticsCustomRange.start || ""}"></label><label>${appLanguage === "ar" ? "إلى تاريخ" : "To date"}<input type="date" id="analytics-range-end" data-sz-range-group="analytics" data-sz-range-role="end" value="${analyticsCustomRange.end || ""}"></label></div>`
        : "";

    const weekStartUI =
      analyticsRange === "weekly"
        ? `<label>${appLanguage === "ar" ? "بداية الأسبوع" : "Week starts on"}<select id="analytics-week-start">${weekStartOptions}</select></label>`
        : "";

    const analyticsMetricOptions = analyticsMetrics
      .map(
        (metric) =>
          `<option value="${metric.id}" ${analyticsMetric === metric.id ? "selected" : ""}>${translateUiText(metric.labelKey)}</option>`,
      )
      .join("");

    const analyticsChartSvg = buildAnalyticsLineChart(analyticsBuckets, analyticsValues, analyticsMetric);
    const analyticsChartMax = analyticsChartGeometry ? analyticsChartGeometry.max : 1;
    const analyticsChartMin = analyticsValues.length ? Math.min(...analyticsValues) : 0;
    const analyticsChartAvg =
      analyticsValues.length > 0
        ? analyticsValues.reduce((sum, value) => sum + value, 0) / analyticsValues.length
        : 0;
    const analyticsPeriodSpan = Math.max(1, rangeEnd.getTime() - rangeStart.getTime());
    const previousBuckets = buildAnalyticsBuckets(
      new Date(rangeStart.getTime() - analyticsPeriodSpan),
      new Date(rangeEnd.getTime() - analyticsPeriodSpan),
      analyticsMode,
    );
    const analyticsPreviousValue = previousBuckets.length
      ? analyticsMetricValue(analyticsMetric, previousBuckets[previousBuckets.length - 1], recordsInRange, tasksInRange, completedTasks)
      : 0;
    const analyticsChangePct = analyticsPreviousValue > 0 ? ((analyticsValues[analyticsValues.length - 1] - analyticsPreviousValue) / analyticsPreviousValue) * 100 : 0;

    // ---- GitHub-style annual activity contributions ----
    const heatmapYear = heatmapActiveYear();
    const heatmap = heatmapGridData(heatmapYear);
    const heatmapTypeOptions = heatmapActivityTypes
      .map(
        (item) =>
          `<option value="${item.id}" ${analyticsHeatmapType === item.id ? "selected" : ""}>${escapeHtml(appLanguage === "ar" ? item.labelAr : item.labelEn)}</option>`,
      )
      .join("");
    const heatmapYearOptions = heatmapAvailableYears()
      .map((year) => {
        const currentYear = new Date().getFullYear();
        const suffix =
          year === currentYear
            ? appLanguage === "ar"
              ? " (الحالي)"
              : " (current)"
            : year === currentYear - 1
              ? appLanguage === "ar"
                ? " (السابق)"
                : " (previous)"
              : "";
        return `<option value="${year}" ${heatmapYear === year ? "selected" : ""}>${year}${suffix}</option>`;
      })
      .join("");
    const heatmapTodayKey = dateKey(new Date());
    const heatmapCells = heatmap.cells
      .map((cell) => {
        if (!cell.inYear)
          return `<span class="sz-hm-cell is-outside" aria-hidden="true"></span>`;
        const level = heatmapLevel(analyticsHeatmapType, cell.day);
        const selected = heatmap.selectedKey === cell.key;
        const future = cell.key > heatmapTodayKey;
        const tip = heatmapTooltipParts(analyticsHeatmapType, cell.day).join("|");
        return `<button type="button" class="sz-hm-cell level-${level} ${selected ? "is-selected" : ""} ${future ? "is-future" : ""}" data-heatmap-cell data-action="heatmap-day" data-date="${cell.key}" data-tip="${escapeHtml(tip)}" aria-label="${escapeHtml(`${heatmapDateLabel(cell.date)}: ${heatmapTypeLabel(analyticsHeatmapType)}, ${heatmapValue(analyticsHeatmapType, cell.day) ? heatmapFormattedValue(analyticsHeatmapType, heatmapValue(analyticsHeatmapType, cell.day)) : appLanguage === "ar" ? "لا يوجد نشاط" : "No activity"}`)}" aria-pressed="${selected}" ${future ? `disabled aria-disabled="true"` : ""}></button>`;
      })
      .join("");
    const heatmapMonthLabels = heatmap.monthLabels
      .map(
        (month) =>
          `<span style="grid-column:${month.weekIndex + 1} / span ${month.span}">${escapeHtml(month.label)}</span>`,
      )
      .join("");
    const heatmapWeekdays = deadlineText[appLanguage].daysShort
      .map((day) => `<span>${escapeHtml(day)}</span>`)
      .join("");
    const heatmapTotalText = heatmapFormattedValue(
      analyticsHeatmapType,
      heatmap.total,
    );
    const heatmapAverageText = heatmapFormattedValue(
      analyticsHeatmapType,
      analyticsHeatmapType === "studyTime"
        ? heatmap.average
        : Math.round(heatmap.average * 10) / 10,
    );
    const heatmapMostActiveText = heatmap.mostActive
      ? `${new Intl.DateTimeFormat(focusLocale(), { month: "short", day: "numeric" }).format(heatmap.mostActive.day.date)} · ${heatmapFormattedValue(analyticsHeatmapType, heatmap.mostActive.value)}`
      : "—";
    const heatmapSelectedDay = heatmap.selectedKey
      ? heatmap.map.get(heatmap.selectedKey)
      : null;
    const heatmapPanel = `<section class="panel section-spacer sz-heatmap-panel" data-heatmap-panel>
      <div class="sz-hm-head">
        <div>
          <p class="eyebrow">${appLanguage === "ar" ? "سجل النشاط" : "ACTIVITY LOG"}</p>
          <h2>${appLanguage === "ar" ? "مساهمات النشاط" : "Activity Contributions"}</h2>
          <p>${appLanguage === "ar" ? "كل يوم من أيام السنة يحكي قصة. مرّر أو اضغط على أي مربع لعرض التفاصيل." : "Every day of the year tells a story. Hover or tap any square for details."}</p>
        </div>
        <span class="sz-hm-year">${heatmapYear}</span>
      </div>
      <div class="sz-hm-summary">
        <div><span>${appLanguage === "ar" ? "إجمالي النشاط" : "Total activity"}</span><strong>${escapeHtml(heatmapTotalText)}</strong></div>
        <div><span>${appLanguage === "ar" ? "المتوسط اليومي" : "Daily average"}</span><strong>${escapeHtml(heatmapAverageText)}</strong></div>
        <div><span>${appLanguage === "ar" ? "أكثر يوم نشاطًا" : "Most active day"}</span><strong>${escapeHtml(heatmapMostActiveText)}</strong></div>
        <div><span>${appLanguage === "ar" ? "أيام نشطة" : "Active days"}</span><strong>${new Intl.NumberFormat(focusLocale()).format(heatmap.activeDays)}</strong></div>
        <div><span>${appLanguage === "ar" ? "أطول سلسلة" : "Longest streak"}</span><strong>${new Intl.NumberFormat(focusLocale()).format(heatmap.longestStreak)} ${appLanguage === "ar" ? "يوم" : "days"}</strong></div>
      </div>
      <div class="sz-hm-scroll">
        <div class="sz-hm-canvas" style="--hm-weeks:${heatmap.weekCount}">
          <span class="sz-hm-corner" aria-hidden="true"></span>
          <div class="sz-hm-months">${heatmapMonthLabels}</div>
          <div class="sz-hm-weekdays">${heatmapWeekdays}</div>
          <div class="sz-hm-grid" data-heatmap-grid>${heatmapCells}</div>
        </div>
      </div>
      <div class="sz-hm-foot">
        <div class="sz-hm-legend"><span>${appLanguage === "ar" ? "أقل" : "Less"}</span>${[0, 1, 2, 3, 4].map((level) => `<i class="level-${level}" aria-hidden="true"></i>`).join("")}<span>${appLanguage === "ar" ? "أكثر" : "More"}</span></div>
        <div class="sz-hm-detail" data-heatmap-detail>${heatmapDetailMarkup(analyticsHeatmapType, heatmapSelectedDay)}</div>
      </div>
      <p class="sz-hm-note">${appLanguage === "ar" ? "وقت الدراسة من جلسات التركيز المكتملة، والمهام من تاريخ إكمالها الفعلي، والعادات من سجلات إنجازها. النشاط الإجمالي يجمع دقائق الدراسة + المهام × ١٠ + العادات × ٥، دون احتساب جلسات التركيز مرتين." : "Study time comes from completed focus sessions, tasks use their real completion date, and habits use their completion records. Overall adds study minutes + tasks × 10 + habits × 5, without counting focus sessions twice."}</p>
      <div class="sz-hm-tooltip" data-heatmap-tooltip hidden></div>
    </section>`;

    return `${pageHeading("YOUR STUDY PATTERNS", "Analytics", "Understand your study habits without losing sight of the bigger picture.", `<div class="analytics-controls"><label>${appLanguage === "ar" ? "النطاق الزمني" : "Time range"}<select id="analytics-range">${rangeOptions}</select></label>${weekStartUI}${customRangeUI}<label>${appLanguage === "ar" ? "المؤشر" : "Metric"}<select id="analytics-metric" data-sz-control>${analyticsMetricOptions}</select></label><label>${appLanguage === "ar" ? "نوع النشاط" : "Activity type"}<select id="analytics-activity-type">${heatmapTypeOptions}</select></label><label>${appLanguage === "ar" ? "السنة" : "Year"}<select id="analytics-heatmap-year">${heatmapYearOptions}</select></label><button class="button button-secondary button-small" data-action="analytics-export">${appLanguage === "ar" ? "تصدير" : "Export"}</button></div>`)}
    <section class="panel section-spacer" data-analytics-chart-panel>
      <div class="analytics-chart-head">
        <div>
          <h2>${translateUiText("Performance Overview")}</h2>
          <p>${analyticsMetricLabel(analyticsMetric)}</p>
        </div>
      </div>
      <div class="analytics-chart" data-analytics-line-chart>
        <div class="analytics-chart-body">${analyticsChartSvg}</div>
        <div class="analytics-chart-tip" hidden></div>
      </div>
      <div class="analytics-chart-summary">
        <span>${appLanguage === "ar" ? "أعلى قيمة" : "Peak value"}: <strong>${escapeHtml(formatAnalyticsMetricValue(analyticsMetric, analyticsValues.length ? Math.max(...analyticsValues) : 0))}</strong></span>
        <span>${appLanguage === "ar" ? "أدنى قيمة" : "Lowest value"}: <strong>${escapeHtml(formatAnalyticsMetricValue(analyticsMetric, analyticsValues.length ? Math.min(...analyticsValues) : 0))}</strong></span>
        <span>${appLanguage === "ar" ? "المتوسط" : "Average"}: <strong>${escapeHtml(formatAnalyticsMetricValue(analyticsMetric, analyticsChartAvg))}</strong></span>
        <span>${appLanguage === "ar" ? "التغيير" : "Change"}: <strong>${escapeHtml(((analyticsValues[analyticsValues.length - 1] - analyticsPreviousValue) / (analyticsPreviousValue || 1) * 100).toFixed(1))}%</strong></span>
      </div>
    </section>

    <div class="grid stats-grid">
      ${statCard("STUDY TIME", `${formatFocusHours(totalFocusSeconds, focusText[appLanguage])}`, ` across ${dayCount} days`, "◷")}
      ${statCard("DAILY AVERAGE", `${(totalFocusSeconds / dayCount / 3600).toFixed(1)}h`, ` per day`, "⌁")}
      ${statCard("TASK COMPLETION", `${taskRate}%`, ` ${completedTasks.length} of ${tasksInRange.length} tasks`, "✓")}
      ${statCard("STUDY STREAK", `${streak} ${appLanguage === "ar" ? "يوم" : "day"}${streak !== 1 ? appLanguage === "ar" ? "أيام" : "s" : ""}`, streak > 0 ? appLanguage === "ar" ? "أيام متتالية" : "consecutive days" : " No activity yet", "↗")}
    </div>
    ${heatmapPanel}
    <div class="grid dashboard-grid">
      <section class="panel">${panelHeading(chartTitle, rangeLabel)}<div class="analytics-bars-scroll"><div class="focus-chart analytics-bars" role="img" aria-label="${escapeHtml(chartTitle)}" style="grid-template-columns:repeat(${Math.max(1, chartData.length)},minmax(16px,1fr))">${bars}</div></div></section>
      <section class="panel">${panelHeading(appLanguage === "ar" ? "أكثر المواد دراسة" : "Top subject", appLanguage === "ar" ? "بناءً على وقت التركيز" : "Based on focus time")}<div class="metric-large">${escapeHtml(topSubject)}</div><p class="metric-caption">${appLanguage === "ar" ? "أكثر مادة قضيتم فيها وقتًا" : "Subject with most focus time in range"}</p></section>
    </div>
    <section class="panel section-spacer">${panelHeading(appLanguage === "ar" ? "إنجاز المهام" : "Task completion", appLanguage === "ar" ? "المهام المكتملة في النطاق" : "Completed tasks in range")}
      ${taskRate > 0 ? `<div class="progress-track"><div class="progress-fill" style="width:${taskRate}%"></div></div><span class="metric-large">${taskRate}%<small> · ${completedTasks.length} / ${tasksInRange.length}</small></span>` : `<div class="empty-state">${appLanguage === "ar" ? "لا توجد مهام في هذا النطاق" : "No tasks in this range"}</div>`}
      ${overdueTasks.length ? `<p class="data-caption">${appLanguage === "ar" ? "مهام متأخرة" : "Overdue tasks"}: ${overdueTasks.length}</p>` : ""}
    </section>
    <section class="panel section-spacer">${panelHeading(appLanguage === "ar" ? "كيفية قراءة الأرقام" : "How to read these numbers")}<p class="panel-copy">${appLanguage === "ar" ? "يُحسب وقت الدراسة من جلسات التركيز المكتملة في النطاق المختار. ونسبة إنجاز المهام هي المهام المكتملة مقسومة على إجمالي المهام التي تنتهي في النطاق. السلسلة هي عدد الأيام المتتالية التي تحتوي على نشاط تركيز." : "Study time is summed from completed focus sessions in the selected range. Task completion is completed tasks divided by all tasks due in the range. Streak is consecutive days with focus activity."}</p></section>`;
  }

  function goalsPage() {
    return `${pageHeading("MILESTONES THAT MATTER", "Goals", "Turn the semester into small, achievable steps.", `<button class="button button-primary" data-action="goal-add">＋ Create a goal</button>`)}<div class="grid goal-grid">${goals.map((goal) => `<article class="goal-card"><span class="eyebrow">${escapeHtml(goal.due || (goal.completed_at ? "COMPLETED" : goal.period || "GOAL"))}</span><h3>${escapeHtml(goal.title)}</h3><p>${escapeHtml(goal.detail || goal.details || `${goal.current_value || 0} / ${goal.target_value || 1} ${goal.unit || "sessions"}`)}</p><div class="metric-large">${Math.round(goal.progress ?? 0)}<small>%</small></div><div class="progress-track"><div class="progress-fill" style="width:${Math.min(100, Math.max(0, goal.progress ?? 0))}%"></div></div>${session && goal.id ? `<div class="card-actions"><button class="text-button" data-action="goal-progress" data-id="${escapeHtml(goal.id)}">Add progress</button><button class="text-button" data-action="goal-edit" data-id="${escapeHtml(goal.id)}">Edit</button><button class="text-button" data-action="goal-delete" data-id="${escapeHtml(goal.id)}">Delete</button></div>` : ""}</article>`).join("") || `<div class="empty-state"><strong>No goals yet</strong>Create a goal to track progress toward a study milestone.</div>`}</div><p class="data-caption">${session ? "Goals and progress are saved to your private account." : "Preview goals are shown. Sign in to create and sync your own goals."}</p>`;
  }

  function examsPage() {
    const cards = session
      ? examResults
          .map((exam) => {
            const score =
              exam.obtained_marks == null
                ? null
                : `${Number(exam.obtained_marks)} / ${Number(exam.max_marks)}`;
            const result = Array.isArray(exam.exam_results)
              ? exam.exam_results[0]
              : exam.exam_results;
            const obtained = result?.obtained_marks ?? exam.obtained_marks;
            const percentage =
              obtained == null
                ? null
                : Math.round(
                    (Number(obtained) / Number(exam.max_marks || 100)) * 100,
                  );
            return `<article class="item-card"><span class="task-meta">${escapeHtml(new Intl.DateTimeFormat(appLanguage, { dateStyle: "medium", timeStyle: "short" }).format(new Date(exam.exam_at || Date.now())))}</span><h3>${escapeHtml(exam.title || exam.subject)}</h3><p>${escapeHtml(exam.subject || subjectName(exam.subject_id))}</p>${percentage == null ? `<div class="exam-score">—<small> / ${escapeHtml(exam.max_marks || "—")}</small></div>` : `<div class="exam-score">${percentage}<small>% · ${escapeHtml(score || `${obtained} / ${exam.max_marks}`)}</small></div>`}${session && exam.id ? `<div class="card-actions"><button class="text-button" data-action="exam-result" data-id="${escapeHtml(exam.id)}">${obtained == null ? "Record result" : "Edit result"}</button><button class="text-button" data-action="exam-edit" data-id="${escapeHtml(exam.id)}">Edit</button><button class="text-button" data-action="exam-delete" data-id="${escapeHtml(exam.id)}">Delete</button></div>` : ""}</article>`;
          })
          .join("")
      : examResults
          .map(
            (exam) =>
              `<article class="item-card"><span class="task-meta">PAST RESULT · SAMPLE</span><h3>${escapeHtml(exam.subject)}</h3><div class="exam-score">${Number(exam.score)}<small> / 100</small></div><p>Recorded exam score preview</p></article>`,
          )
          .join("");
    const upcoming = session
      ? examResults.filter((exam) => new Date(exam.exam_at) >= new Date())
          .length
      : 0;
    return `${pageHeading("EXAM TRACKER", "Exams & results", "Keep upcoming assessments and your progress in one view.", `<button class="button button-primary" data-action="exam-add">＋ Add exam</button>`)}<div class="grid exam-grid">${cards || `<div class="empty-state"><strong>${session ? "No exams yet" : "No exam results to show"}</strong>${session ? "Add an exam to track its date and result." : "Sign in to add and track your own exams."}</div>`}</div><section class="panel section-spacer">${panelHeading("Upcoming assessments", `${upcoming} upcoming`)}${
      upcoming
        ? `<div class="activity-list">${examResults
            .filter((exam) => new Date(exam.exam_at) >= new Date())
            .map(
              (exam) =>
                `<div class="activity-item"><span>${escapeHtml(exam.title)}</span><time>${escapeHtml(new Intl.DateTimeFormat(appLanguage, { dateStyle: "medium" }).format(new Date(exam.exam_at)))}</time></div>`,
            )
            .join("")}</div>`
        : `<div class="empty-state">No upcoming exams.</div>`
    }</section><p class="data-caption">${session ? "Exam dates and results are stored in your private account." : "Sample results are previews, not account records. Sign in to track your own exams."}</p>`;
  }

  function achievementsPage() {
    const earnedCodes = new Set(
      earnedAchievements
        .map((item) => {
          const achievement = Array.isArray(item.achievements)
            ? item.achievements[0]
            : item.achievements;
          return achievement?.code;
        })
        .filter(Boolean),
    );
    const cards = achievementCatalog
      .map((item) => {
        const unlocked = earnedCodes.has(item.code);
        const reward = new Intl.NumberFormat(
          appLanguage === "ar" ? "ar-EG" : "en",
        ).format(item.reward);
        return `<article class="item-card achievement-card ${unlocked ? "unlocked" : "locked"}"><span class="achievement-icon ${unlocked ? "" : "locked"}">${item.symbol}</span><h3>${translateUiText(item.name)}</h3><p>${translateUiText(item.description)}</p><p class="badge-status">${unlocked ? "Unlocked" : "Keep going to unlock"}</p><p class="data-caption">${translateUiText("Reward")} +${reward} XP</p></article>`;
      })
      .join("");
    const xp = Number(rewardSummary?.total_xp) || 0;
    const level = Number(rewardSummary?.level) || 1;
    const progress = xp % 100;
    return `${pageHeading("MILESTONES", "Achievements", "Celebrate consistency and progress, not just perfect days.", "")}<div class="grid achievement-grid">${cards}</div><section class="panel section-spacer">${panelHeading("Your progress level")}<div class="metric-large">${translateUiText("Level")} ${session ? rewardCounterMarkup("achievement-level", level) : "—"} <span class="metric-caption">· ${session ? `${rewardCounterMarkup("achievement-xp", xp)} XP` : translateUiText("Sign in to earn secure rewards.")}</span></div><div class="progress-track" role="progressbar" aria-label="${translateUiText("Progress to next level")}" aria-valuenow="${session ? progress : 0}" aria-valuemin="0" aria-valuemax="100"><div class="progress-fill" style="width:${session ? progress : 0}%"></div></div><p class="data-caption">${session ? translateUiText("Progress to next level") : translateUiText("Sign in to earn secure rewards.")}${rewardSummary ? "" : session ? ` ${translateUiText("Rewards load after applying the latest Supabase migration.")}` : ""}</p></section>`;
  }

  function isMissingRelation(error) {
    const code = String(error?.code || "");
    const message = String(error?.message || "");
    return (
      code === "42P01" ||
      code === "PGRST205" ||
      /does not exist|could not find the table|schema cache/i.test(message)
    );
  }

  function teamMemberCount(teamId) {
    return teamMembers.filter(
      (member) => String(member.team_id) === String(teamId),
    ).length;
  }

  async function loadTeams() {
    if (!supabase || !session || teamsLoading) return;
    teamsLoading = true;
    teamsError = "";
    scheduleRender();
    try {
      const { data, error } = await supabase
        .from("teams")
        .select("id,name,description,join_code,owner_id,created_at")
        .order("created_at", { ascending: true });
      if (error) throw error;
      teams = data || [];
      if (!teams.some((team) => String(team.id) === String(selectedTeamId))) {
        selectedTeamId = teams[0]?.id || null;
      }
      if (teams.length) {
        const ids = teams.map((team) => team.id);
        const [memberResult, taskResult] = await Promise.all([
          supabase
            .from("team_members")
            .select("team_id,user_id,role,joined_at")
            .in("team_id", ids),
          supabase
            .from("team_tasks")
            .select(
              "id,team_id,created_by,assigned_to,title,description,status,priority,due_at,created_at",
            )
            .in("team_id", ids)
            .order("due_at", { ascending: true, nullsFirst: false }),
        ]);
        if (memberResult.error && !isMissingRelation(memberResult.error))
          console.error("Could not load team members.", memberResult.error);
        if (taskResult.error && !isMissingRelation(taskResult.error))
          console.error("Could not load team tasks.", taskResult.error);
        teamMembers = memberResult.error ? [] : memberResult.data || [];
        teamTasks = taskResult.error ? [] : taskResult.data || [];
      } else {
        teamMembers = [];
        teamTasks = [];
      }
      if (selectedTeamId) {
        const [inviteResult, requestResult] = await Promise.all([
          supabase
            .from("team_invites")
            .select("*")
            .eq("team_id", selectedTeamId)
            .eq("status", "pending"),
          supabase
            .from("team_join_requests")
            .select("*")
            .eq("team_id", selectedTeamId)
            .eq("status", "pending"),
        ]);
        if (inviteResult.error && !isMissingRelation(inviteResult.error))
          console.error("Could not load team invites.", inviteResult.error);
        if (requestResult.error && !isMissingRelation(requestResult.error))
          console.error("Could not load team join requests.", requestResult.error);
        teamInvites = inviteResult.error ? [] : inviteResult.data || [];
        teamJoinRequests = requestResult.error ? [] : requestResult.data || [];
      }
      teamsSupported = true;
    } catch (error) {
      console.error("Could not load teams.", error);
      teams = [];
      teamMembers = [];
      teamTasks = [];
      if (isMissingRelation(error)) {
        teamsSupported = false;
      } else {
        teamsError = error.message || "Could not load your teams.";
      }
    } finally {
      teamsLoading = false;
      teamsLoaded = true;
      scheduleRender();
    }
  }

  function teamMemberLabel(member) {
    if (!member) return "Member";
    if (member.user_id === session?.user?.id)
      return appLanguage === "ar" ? "أنت" : "You";
    return `${appLanguage === "ar" ? "عضو" : "Member"} ${String(member.user_id || "").slice(0, 6)}`;
  }

  function teamTaskRow(task, team) {
    const completed = task.status === "completed";
    const mine = task.created_by === session?.user?.id;
    const owner = team.owner_id === session?.user?.id;
    const due = task.due_at
      ? taskDueLabel({ due_at: task.due_at }, { includeDate: true })
      : "";
    return `<div class="team-task-row ${completed ? "completed" : ""}">
      <button class="task-check ${completed ? "checked" : ""}" data-action="team-task-toggle" data-id="${escapeHtml(task.id)}" aria-label="${completed ? "Reopen" : "Complete"} ${escapeHtml(task.title)}">${completed ? "✓" : ""}</button>
      <div class="team-task-main">
        <strong dir="auto">${escapeHtml(task.title)}</strong>
        <small dir="auto">${escapeHtml(due || (appLanguage === "ar" ? "بلا موعد" : "No due date"))}${task.assigned_to === session?.user?.id ? (appLanguage === "ar" ? " · مُسندة إليك" : " · assigned to you") : ""}</small>
      </div>
      <span class="priority ${escapeHtml(task.priority || "medium")}">${escapeHtml(deadlineText[appLanguage][task.priority] || "medium")}</span>
      ${mine || owner ? `<button class="task-icon danger" data-action="team-task-delete" data-id="${escapeHtml(task.id)}" aria-label="${appLanguage === "ar" ? "حذف مهمة الفريق" : "Delete team task"}">×</button>` : ""}
    </div>`;
  }

  function teamsPage() {
    if (!session) {
      return `${pageHeading("STUDY TOGETHER", appLanguage === "ar" ? "الفرق" : "Teams", appLanguage === "ar" ? "شارك المهام مع مجموعتك الدراسية." : "Share tasks and momentum with your study group.", "")}
        <section class="panel teams-empty"><div class="empty-state"><strong>${appLanguage === "ar" ? "سجّل الدخول لإنشاء فريق" : "Sign in to create a team"}</strong><p>${appLanguage === "ar" ? "الفرق الخاصة آمنة ومرتبطة بحسابك." : "Private teams are tied to your account and protected by row-level security."}</p><button class="button button-primary button-small" id="open-auth">${appLanguage === "ar" ? "تسجيل الدخول" : "Sign in"}</button></div></section>`;
    }
    const actions = `<div class="teams-heading-actions"><button class="button button-secondary" data-action="team-join">${appLanguage === "ar" ? "الانضمام إلى فريق" : "Join team"}</button><button class="button button-primary" data-action="team-create">＋ ${appLanguage === "ar" ? "فريق جديد" : "New team"}</button></div>`;
    if (teamsLoading && !teamsLoaded) {
      return `${pageHeading("STUDY TOGETHER", appLanguage === "ar" ? "الفرق" : "Teams", appLanguage === "ar" ? "شارك المهام مع مجموعتك الدراسية." : "Share tasks and momentum with your study group.", actions)}<section class="panel"><div class="empty-state" role="status">${appLanguage === "ar" ? "جارٍ تحميل الفرق…" : "Loading teams…"}</div></section>`;
    }
    if (!teamsSupported) {
      return `${pageHeading("STUDY TOGETHER", appLanguage === "ar" ? "الفرق" : "Teams", appLanguage === "ar" ? "شارك المهام مع مجموعتك الدراسية." : "Share tasks and momentum with your study group.", actions)}<section class="panel"><div class="empty-state"><strong>${appLanguage === "ar" ? "ميزة الفرق غير مهيأة بعد" : "Teams are not enabled yet"}</strong><p>${appLanguage === "ar" ? "طبّق ملف الترحيل 001_studyzone_enhancements.sql في Supabase لتفعيل الفرق." : "Apply supabase/migrations/001_studyzone_enhancements.sql in Supabase to enable private teams."}</p></div></section>`;
    }
    if (teamsError) {
      return `${pageHeading("STUDY TOGETHER", appLanguage === "ar" ? "الفرق" : "Teams", appLanguage === "ar" ? "شارك المهام مع مجموعتك الدراسية." : "Share tasks and momentum with your study group.", actions)}<section class="panel"><div class="empty-state"><strong>${appLanguage === "ar" ? "تعذر تحميل الفرق" : "Could not load teams"}</strong><p>${escapeHtml(teamsError)}</p><button class="button button-secondary button-small" data-action="teams-retry">${appLanguage === "ar" ? "إعادة المحاولة" : "Try again"}</button></div></section>`;
    }
    if (!teams.length) {
      return `${pageHeading("STUDY TOGETHER", appLanguage === "ar" ? "الفرق" : "Teams", appLanguage === "ar" ? "شارك المهام مع مجموعتك الدراسية." : "Share tasks and momentum with your study group.", actions)}
        <section class="panel teams-empty"><div class="empty-state"><strong>${appLanguage === "ar" ? "ابدأ فريقك الأول" : "Start your first team"}</strong><p>${appLanguage === "ar" ? "أنشئ فريقًا أو انضم بكود من زميل." : "Create a team, or join one with a short code from a classmate."}</p><div class="teams-empty-actions"><button class="button button-secondary button-small" data-action="team-join">${appLanguage === "ar" ? "الانضمام إلى فريق" : "Join team"}</button><button class="button button-primary button-small" data-action="team-create">＋ ${appLanguage === "ar" ? "فريق جديد" : "New team"}</button></div></div></section>`;
    }
    const selected =
      teams.find((team) => String(team.id) === String(selectedTeamId)) ||
      teams[0];
    const members = teamMembers.filter(
      (member) => String(member.team_id) === String(selected.id),
    );
    const owner = selected.owner_id === session.user.id;
    const myMembership = members.find(
      (member) => String(member.user_id) === String(session.user.id),
    );
    const canManage = owner || myMembership?.role === "admin";
    const memberRows =
      members
        .map(
          (member) => {
            const memberLabelText = teamMemberLabel(member);
            const memberRole = member.role || "member";
            const memberActions = canManage
              ? `<span class="task-actions">
                  <button class="task-icon" data-action="team-member-role" data-team-id="${escapeHtml(selected.id)}" data-user-id="${escapeHtml(member.user_id)}" data-role="${escapeHtml(memberRole === "owner" ? "member" : "admin")}" aria-label="${appLanguage === "ar" ? "تعديل الصلاحية" : "Change role"}">✎</button>
                  ${memberRole === "owner" ? "" : `<button class="task-icon danger" data-action="team-member-remove" data-team-id="${escapeHtml(selected.id)}" data-user-id="${escapeHtml(member.user_id)}" aria-label="${appLanguage === "ar" ? "إزالة العضو" : "Remove member"}">×</button>`}
                </span>`
              : "";
            return `<div class="team-member">
              <span class="team-member-avatar">${escapeHtml(initials(teamMemberLabel(member)))}</span>
              <div><strong>${escapeHtml(memberLabelText)}</strong><small>${escapeHtml(member.role === "owner" ? (appLanguage === "ar" ? "مالك الفريق" : "Team owner") : member.role === "admin" ? (appLanguage === "ar" ? "مسؤول مساعد" : "Assistant admin") : (appLanguage === "ar" ? "عضو" : "Member"))}</small>${memberActions ? `<div class="task-actions">${memberActions}</div>` : ""}</div>
            </div>`;
          },
        )
        .join("") ||
      `<p class="data-caption">${appLanguage === "ar" ? "لا أعضاء بعد." : "No members yet."}</p>`;
    const pendingRequests = teamJoinRequests.filter(
      (request) => String(request.team_id) === String(selected.id),
    );
    const tasks = teamTasks.filter(
      (task) => String(task.team_id) === String(selected.id),
    );
    const openTasks = tasks.filter((task) => task.status !== "completed");
    const doneTasks = tasks.filter((task) => task.status === "completed");
    const taskList = `${openTasks.length ? openTasks.map((task) => teamTaskRow(task, selected)).join("") : `<div class="empty-state"><strong>${appLanguage === "ar" ? "لا مهام للفريق" : "No team tasks yet"}</strong><p>${appLanguage === "ar" ? "أضف أول مهمة مشتركة." : "Add the first shared task below."}</p></div>`}
      ${doneTasks.length ? `<details class="team-done"><summary>${appLanguage === "ar" ? "المكتملة" : "Completed"} (${doneTasks.length})</summary>${doneTasks.map((task) => teamTaskRow(task, selected)).join("")}</details>` : ""}`;
    const pendingRequestsPanel = canManage && selected.join_mode === "approval"
      ? `<section class="panel">
          ${panelHeading(appLanguage === "ar" ? "طلبات الانضمام" : "Join requests", appLanguage === "ar" ? `${pendingRequests.length} في انتظار المراجعة` : `${pendingRequests.length} awaiting review`)}
          <div class="team-task-list">${pendingRequests.length ? pendingRequests.map((request) => {
            const requester = teamMembers.find(
              (member) => String(member.user_id) === String(request.user_id),
            );
            const requesterLabel = requester
              ? teamMemberLabel(requester)
              : `${appLanguage === "ar" ? "عضو" : "Member"} ${String(request.user_id || "").slice(0, 6)}`;
            return `<div class="team-task-row">
              <div class="team-task-main"><strong dir="auto">${escapeHtml(requesterLabel)}</strong><small dir="auto">${escapeHtml(String(request.note || "").slice(0, 80))}</small></div>
              <span class="priority">${escapeHtml(request.status || "pending")}</span>
              <span class="task-actions">
                <button class="task-icon" data-action="team-join-review" data-id="${escapeHtml(request.id)}" data-approve="true" aria-label="${appLanguage === "ar" ? "قبول" : "Approve"}">✓</button>
                <button class="task-icon danger" data-action="team-join-review" data-id="${escapeHtml(request.id)}" data-approve="false" aria-label="${appLanguage === "ar" ? "رفض" : "Reject"}">×</button>
              </span>
            </div>`;
          }).join("") : `<div class="empty-state"><strong>${appLanguage === "ar" ? "لا طلبات انضمام." : "No pending join requests."}</strong></div>`}</div>
        </section>`
      : "";
    return `${pageHeading("STUDY TOGETHER", appLanguage === "ar" ? "الفرق" : "Teams", appLanguage === "ar" ? "شارك المهام مع مجموعتك الدراسية." : "Share tasks and momentum with your study group.", actions)}
      <div class="team-switcher" role="tablist" aria-label="${appLanguage === "ar" ? "فرقك" : "Your teams"}">${teams.map((team) => `<button class="team-chip ${String(team.id) === String(selected.id) ? "selected" : ""}" data-action="team-select" data-id="${escapeHtml(team.id)}" role="tab" aria-selected="${String(team.id) === String(selected.id)}">${escapeHtml(team.name)}<small>${new Intl.NumberFormat(appLanguage === "ar" ? "ar-EG" : "en").format(teamMemberCount(team.id))}</small></button>`).join("")}</div>
      <div class="grid team-layout">
        <section class="panel">
          <div class="team-heading"><div><p class="eyebrow">${owner ? (appLanguage === "ar" ? "أنت المالك" : "YOU OWN THIS TEAM") : appLanguage === "ar" ? "عضو" : "MEMBER"}</p><h2>${escapeHtml(selected.name)}</h2><p class="panel-copy">${escapeHtml(selected.description || (appLanguage === "ar" ? "لا وصف بعد." : "No description yet."))}</p></div><div class="team-code"><span>${appLanguage === "ar" ? "كود الانضمام" : "Join code"}</span><strong dir="ltr">${escapeHtml(selected.join_code || "—")}</strong></div></div>
          <div class="team-members">${memberRows}</div>
          <div class="team-actions-row">
            <button class="button button-secondary button-small" data-action="team-refresh">${appLanguage === "ar" ? "تحديث" : "Refresh"}</button>
            <button class="button button-secondary button-small" data-action="team-invite" data-team-id="${escapeHtml(selected.id)}">${appLanguage === "ar" ? "دعوة عضو" : "Invite member"}</button>
            <button class="button button-secondary button-small" data-action="team-request-join" data-team-id="${escapeHtml(selected.id)}">${appLanguage === "ar" ? "طلب انضمام" : "Request to join"}</button>
            ${
              owner
                ? `<button class="button button-quiet button-small danger-text" data-action="team-delete">${appLanguage === "ar" ? "حذف الفريق" : "Delete team"}</button>`
                : `<button class="button button-quiet button-small danger-text" data-action="team-leave">${appLanguage === "ar" ? "مغادرة الفريق" : "Leave team"}</button>`
            }
          </div>
        </section>
        <section class="panel">
          ${panelHeading(appLanguage === "ar" ? "مهام الفريق" : "Team tasks", appLanguage === "ar" ? `${openTasks.length} مفتوحة · ${doneTasks.length} مكتملة` : `${openTasks.length} open · ${doneTasks.length} done`)}
          <form id="team-task-form" class="team-task-form">
            <input name="title" dir="auto" required maxlength="180" placeholder="${appLanguage === "ar" ? "أضف مهمة مشتركة" : "Add a shared task"}" aria-label="${appLanguage === "ar" ? "عنوان مهمة الفريق" : "Team task title"}" />
            <input name="due_date" type="date" aria-label="${appLanguage === "ar" ? "تاريخ الاستحقاق" : "Due date"}" />
            <input name="due_time" type="time" aria-label="${appLanguage === "ar" ? "وقت الاستحقاق" : "Due time"}" />
            <select name="priority" aria-label="${appLanguage === "ar" ? "الأولوية" : "Priority"}"><option value="medium">${appLanguage === "ar" ? "متوسطة" : "Medium"}</option><option value="low">${appLanguage === "ar" ? "منخفضة" : "Low"}</option><option value="high">${appLanguage === "ar" ? "عالية" : "High"}</option><option value="urgent">${appLanguage === "ar" ? "عاجلة" : "Urgent"}</option></select>
            <button class="button button-primary button-small" type="submit">＋</button>
          </form>
          <div class="team-task-list">${taskList}</div>
        </section>
      </div>
      ${pendingRequestsPanel}
      <p class="data-caption">${appLanguage === "ar" ? "مهام الفريق مرئية لأعضاء الفريق فقط بفضل سياسات RLS." : "Team tasks are visible only to members of this team through row-level security."}</p>`;
  }

  function openTeamModal() {
    if (!session) {
      document.getElementById("open-auth")?.click();
      return;
    }
    const form = document.getElementById("team-form");
    form.reset();
    form.elements.join_mode.value = "open";
    document.getElementById("team-error").textContent = "";
    openModal(document.getElementById("team-modal"));
    form.elements.name.focus();
  }

  async function createTeam(formData) {
    if (!supabase || !session) throw new Error("Sign in to create a team.");
    const name = String(formData.get("name") || "").trim();
    if (!name) throw new Error("Enter a team name.");
    const joinMode = ["open", "approval"].includes(
      String(formData.get("join_mode") || "open"),
    )
      ? String(formData.get("join_mode"))
      : "open";
    const { data, error } = await supabase
      .from("teams")
      .insert({
        name,
        description: String(formData.get("description") || "").trim() || null,
        owner_id: session.user.id,
        join_mode: joinMode,
        logo_url: String(formData.get("logo_url") || "").trim() || null,
      })
      .select("id,name,description,join_code,owner_id,created_at,join_mode,logo_url")
      .single();
    if (error) throw error;
    selectedTeamId = data.id;
    teamsLoaded = false;
    closeModal(document.getElementById("team-modal"));
    showToast(appLanguage === "ar" ? "تم إنشاء الفريق." : "Team created.");
    await loadTeams();
  }

  async function sendTeamInvite(teamId) {
    const team = teams.find((item) => String(item.id) === String(teamId));
    if (!team) return;
    const code = String(team.join_code || "").toUpperCase();
    if (!code) {
      showToast(
        appLanguage === "ar"
          ? "تعذّر إنشاء كود دعوة لهذا الفريق."
          : "Could not create a join code for this team.",
      );
      return;
    }
    const { error } = await supabase.from("team_invites").upsert(
      {
        team_id: team.id,
        code,
        status: "pending",
        invited_by: session?.user?.id || null,
      },
      { onConflict: "team_id,code" },
    );
    if (error) {
      showToast(`Could not send the invite: ${error.message}`);
      return;
    }
    teamInvites = [
      { team_id: team.id, code, status: "pending" },
      ...teamInvites.filter((item) => String(item.team_id) !== String(team.id)),
    ];
    render();
    showToast(
      appLanguage === "ar"
        ? "تم إنشاء رابط دعوة للفريق."
        : "Team invite created.",
    );
  }

  async function createTeamJoinRequest(teamId) {
    const team = teams.find((item) => String(item.id) === String(teamId));
    if (!team) return;
    const teamIdValue = team.id;
    const { error } = await supabase.from("team_join_requests").insert({
      team_id: teamIdValue,
      user_id: session?.user?.id,
      status: "pending",
      note: String(
        document.getElementById("team-join-request-note")?.value || "",
      ).trim(),
    });
    if (error) {
      showToast(`Could not send the join request: ${error.message}`);
      return;
    }
    render();
    showToast(
      appLanguage === "ar"
        ? "أُرسل طلب الانضمام."
        : "Join request sent.",
    );
  }

  async function reviewTeamJoinRequest(requestId, approve) {
    const request = teamJoinRequests.find(
      (item) => String(item.id) === String(requestId),
    );
    if (!request) return;
    const status = approve ? "approved" : "rejected";
    const { error } = await supabase
      .from("team_join_requests")
      .update({
        status,
        reviewed_at: new Date().toISOString(),
        reviewed_by: session?.user?.id,
      })
      .eq("id", request.id);
    if (error) {
      showToast(`Could not review the request: ${error.message}`);
      return;
    }
    if (approve) {
      const join = await supabase.rpc("join_team", {
        p_code: String(
          teams.find((item) => String(item.id) === String(request.team_id))
            ?.join_code || "",
        ),
      });
      if (join.error) {
        showToast(`Could not accept the request: ${join.error.message}`);
        return;
      }
    }
    teamJoinRequests = teamJoinRequests.filter(
      (item) => String(item.id) !== String(request.id),
    );
    render();
  }

  async function updateTeamMemberRole(teamId, userId, role) {
    const { error } = await supabase
      .from("team_members")
      .update({ role })
      .eq("team_id", teamId)
      .eq("user_id", userId);
    if (error) {
      showToast(`Could not update the member: ${error.message}`);
      return;
    }
    teamMembers = teamMembers.map((member) =>
      String(member.team_id) === String(teamId) &&
      String(member.user_id) === String(userId)
        ? { ...member, role }
        : member,
    );
    render();
  }

  async function removeTeamMember(teamId, userId) {
    const { error } = await supabase
      .from("team_members")
      .delete()
      .eq("team_id", teamId)
      .eq("user_id", userId);
    if (error) {
      showToast(`Could not remove the member: ${error.message}`);
      return;
    }
    teamMembers = teamMembers.filter(
      (member) =>
        !(String(member.team_id) === String(teamId) &&
          String(member.user_id) === String(userId)),
    );
    render();
  }


  function openTeamJoinModal() {
    if (!session) {
      document.getElementById("open-auth")?.click();
      return;
    }
    const form = document.getElementById("team-join-form");
    form.reset();
    document.getElementById("team-join-error").textContent = "";
    openModal(document.getElementById("team-join-modal"));
    form.elements.code.focus();
  }

  async function joinTeam(formData) {
    if (!supabase || !session) throw new Error("Sign in to join a team.");
    const code = String(formData.get("code") || "").trim();
    if (!code) throw new Error("Enter a join code.");
    const team = teams.find(
      (item) =>
        String(item.join_code || "").toUpperCase() === code.toUpperCase(),
    );
    if (team?.join_mode === "approval") {
      await createTeamJoinRequest(team.id);
      closeModal(document.getElementById("team-join-modal"));
      return;
    }
    const { data, error } = await supabase.rpc("join_team", { p_code: code });
    if (error) throw error;
    selectedTeamId = Array.isArray(data) ? data[0] : data;
    teamsLoaded = false;
    closeModal(document.getElementById("team-join-modal"));
    showToast(
      appLanguage === "ar" ? "انضممت إلى الفريق." : "You joined the team.",
    );
    await loadTeams();
  }

  async function deleteTeam(team) {
    if (!team) return;
    const message =
      appLanguage === "ar"
        ? `حذف "${team.name}"؟ ستحذف مهام الفريق نهائيًا.`
        : `Delete "${team.name}"? All team tasks and comments will be permanently removed.`;
    if (!window.confirm(message)) return;
    const { error } = await supabase.from("teams").delete().eq("id", team.id);
    if (error) throw error;
    teams = teams.filter((item) => String(item.id) !== String(team.id));
    selectedTeamId = teams[0]?.id || null;
    teamsLoaded = false;
    showToast(appLanguage === "ar" ? "تم حذف الفريق." : "Team deleted.");
    await loadTeams();
  }

  async function leaveTeam(team) {
    if (!team) return;
    if (
      !window.confirm(
        appLanguage === "ar" ? "مغادرة هذا الفريق؟" : "Leave this team?",
      )
    )
      return;
    const { error } = await supabase
      .from("team_members")
      .delete()
      .eq("team_id", team.id)
      .eq("user_id", session.user.id);
    if (error) throw error;
    teams = teams.filter((item) => String(item.id) !== String(team.id));
    selectedTeamId = teams[0]?.id || null;
    teamsLoaded = false;
    showToast(appLanguage === "ar" ? "غادرت الفريق." : "You left the team.");
    await loadTeams();
  }

  async function addTeamTask(formData) {
    const team = teams.find(
      (item) => String(item.id) === String(selectedTeamId),
    );
    if (!team) throw new Error("Choose a team first.");
    const title = String(formData.get("title") || "").trim();
    if (!title) throw new Error("Enter a task title.");
    const dateValue = String(formData.get("due_date") || "");
    const timeValue = String(formData.get("due_time") || "") || "23:59";
    const dueAt = dateValue ? new Date(`${dateValue}T${timeValue}:00`) : null;
    if (dueAt && Number.isNaN(dueAt.getTime()))
      throw new Error("Choose a valid due date.");
    const { data, error } = await supabase
      .from("team_tasks")
      .insert({
        team_id: team.id,
        created_by: session.user.id,
        title,
        description: null,
        priority: String(formData.get("priority") || "medium"),
        due_at: dueAt ? dueAt.toISOString() : null,
      })
      .select(
        "id,team_id,created_by,assigned_to,title,description,status,priority,due_at,created_at",
      )
      .single();
    if (error) throw error;
    teamTasks.unshift(data);
    render();
    showToast(
      appLanguage === "ar" ? "تمت إضافة مهمة الفريق." : "Team task added.",
    );
  }

  async function toggleTeamTask(id) {
    const task = teamTasks.find((item) => String(item.id) === String(id));
    if (!task) return;
    const next = task.status === "completed" ? "not_started" : "completed";
    const { error } = await supabase
      .from("team_tasks")
      .update({ status: next })
      .eq("id", id);
    if (error) {
      showToast(error.message);
      return;
    }
    task.status = next;
    render();
  }

  async function deleteTeamTask(id) {
    if (
      !window.confirm(
        appLanguage === "ar" ? "حذف مهمة الفريق؟" : "Delete this team task?",
      )
    )
      return;
    const { error } = await supabase.from("team_tasks").delete().eq("id", id);
    if (error) {
      showToast(error.message);
      return;
    }
    teamTasks = teamTasks.filter((task) => String(task.id) !== String(id));
    render();
  }

  function computeTeamXpRows(teamId) {
    const tasks = teamTasks.filter(
      (task) => String(task.team_id) === String(teamId),
    );
    const memberRows = teamMembers
      .filter((member) => String(member.team_id) === String(teamId))
      .map((member) => {
        const linkedTasks = tasks.filter(
          (task) =>
            String(task.created_by) === String(member.user_id) ||
            String(task.assigned_to) === String(member.user_id),
        );
        const completedTasks = linkedTasks.filter(
          (task) => task.status === "completed",
        );
        const focusRows = focusRecords.filter(
          (record) =>
            record.completed &&
            record.session_type === "focus" &&
            tasks.some(
              (task) =>
                String(task.id) === String(record.task_id) &&
                (String(task.created_by) === String(member.user_id) ||
                  String(task.assigned_to) === String(member.user_id)),
            ),
        );
        const focusMinutes = focusRows.reduce(
          (sum, record) => sum + Number(record.duration_seconds || 0) / 60,
          0,
        );
        const taskXp = completedTasks.length * 10;
        const focusXp = focusRows.length * 15;
        const totalXp = taskXp + focusXp + Math.min(20, Math.round(focusMinutes));
        const focusSeconds = focusRows.reduce(
          (sum, record) => sum + Number(record.duration_seconds || 0),
          0,
        );
        return {
          userId: member.user_id,
          label: teamMemberLabel(member),
          isYou: String(member.user_id) === String(session?.user?.id),
          xp: totalXp,
          taskCompletions: completedTasks.length,
          focusSessions: focusRows.length,
          focusMinutes: Math.round(focusMinutes * 10) / 10,
          focusSeconds,
          taskXp,
          focusXp,
        };
      })
      .filter((row) => row.taskCompletions > 0 || row.focusSessions > 0)
      .sort((a, b) => b.xp - a.xp || b.focusMinutes - a.focusMinutes);
    const team = teams.find((item) => String(item.id) === String(teamId));
    const members = teamMembers.filter(
      (member) => String(member.team_id) === String(teamId),
    );
    const myRow = members.find(
      (member) => String(member.user_id) === String(session?.user?.id),
    );
    const myXp = myRow ? memberRows.find((row) => row.userId === myRow.userId)?.xp || 0 : 0;
    const rows = memberRows;
    return { rows, myXp, memberCount: members.length };
  }

  function teamLeaderboardPage() {
    const t = deadlineText[appLanguage];
    if (!session) {
      return `${pageHeading("TEAM LEADERBOARD", appLanguage === "ar" ? "متصدر الفريق" : "Team leaderboard", appLanguage === "ar" ? "قيّم ترتيب فريقك من خلال الأداء الحقيقي." : "Rank your team from real effort and progress.", "")}<section class="panel teams-empty"><div class="empty-state"><strong>${appLanguage === "ar" ? "سجّل الدخول لعرض لوحة الفريق" : "Sign in to view the team leaderboard"}</strong></div></section>`;
    }
    const teamId = selectedTeamId;
    const team = teams.find((item) => String(item.id) === String(teamId));
    if (!team) {
      return `${pageHeading("TEAM LEADERBOARD", appLanguage === "ar" ? "متصدر الفريق" : "Team leaderboard", appLanguage === "ar" ? "قيّم ترتيب فريقك من خلال الأداء الحقيقي." : "Rank your team from real effort and progress.", "")}<section class="panel teams-empty"><div class="empty-state"><strong>${appLanguage === "ar" ? "لا فريق محدد" : "No team selected"}</strong></div></section>`;
    }
    const { rows, myXp } = computeTeamXpRows(teamId);
    const podium = rows.slice(0, 3);
    const podiumMarkup = podium.length
      ? `<div class="team-podium">
          ${podium
            .map(
              (row, index) => `<div class="team-podium-card ${index === 0 ? "first" : ""}">
                <span class="team-podium-rank">${["1", "2", "3"][index]}</span>
                <span class="team-member-avatar">${escapeHtml(initials(row.label))}</span>
                <strong dir="auto">${escapeHtml(row.label)}</strong>
                <small>${appLanguage === "ar" ? "نقاط الفريق" : "Team XP"}</small>
                <strong class="team-podium-xp">${row.xp}</strong>
                <small>${row.taskCompletions} ${appLanguage === "ar" ? "مهمة مكتملة" : "tasks"} · ${new Intl.NumberFormat(appLanguage === "ar" ? "ar-EG" : "en").format(row.focusMinutes)} ${appLanguage === "ar" ? "دقيقة تركيز" : "focus min"}</small>
              </div>`,
            )
            .join("")}
        </div>`
      : "";
    const rowsMarkup = rows
      .map(
        (row, index) => `<div class="team-leaderboard-row ${row.isYou ? "is-you" : ""}">
          <span class="team-leaderboard-rank">${new Intl.NumberFormat(appLanguage === "ar" ? "ar-EG" : "en", { minimumIntegerDigits: 2 }).format(index + 1)}</span>
          <span class="team-member-avatar">${escapeHtml(initials(row.label))}</span>
          <span class="team-leaderboard-main"><strong dir="auto">${escapeHtml(row.label)}</strong><small>${appLanguage === "ar" ? "مهام مكتملة" : "Tasks"} ${row.taskCompletions} · ${appLanguage === "ar" ? "جلسات تركيز" : "Focus sessions"} ${row.focusSessions}</small></span>
          <span class="team-leaderboard-xp"><strong>${row.xp}</strong><small>XP</small></span>
        </div>`,
      )
      .join("");
    const leaderboard =
      rows.length
        ? `<section class="panel">
            ${panelHeading(appLanguage === "ar" ? "متصدر الفريق" : "Team leaderboard", appLanguage === "ar" ? `ترتيب نقاط فريق ${escapeHtml(team.name)}` : `Standings for ${escapeHtml(team.name)}`)}
            ${podiumMarkup}
            <div class="team-task-list">${rowsMarkup}</div>
          </section>`
        : `<section class="panel"><div class="empty-state"><strong>${appLanguage === "ar" ? "لا بيانات نقاط بعد" : "No XP data yet"}</strong><p>${appLanguage === "ar" ? "أكمل مهامًا أو جلسات تركيز مع الفريق لرؤية المتصدرين." : "Complete team tasks or focus sessions to build the standings."}</p></div></section>`;
    return `${pageHeading("TEAM LEADERBOARD", appLanguage === "ar" ? "متصدر الفريق" : "Team leaderboard", appLanguage === "ar" ? "الترتيب مبني على مهام الفريق وجلسات التركيز الحقيقية." : "The ranking uses real team task completions and focus sessions.", "")}${leaderboard}<p class="data-caption">${appLanguage === "ar" ? `مكافأة هدف أسبوعي إضافية لكل عضو عند إكمال ${appLanguage === "ar" ? "180 دقيقة" : "180 minutes"} تركيز — 50 XP لكل فريق.` : "Each member earns bonus XP for weekly goals; the team total feeds the battle standings."}</p>`;
  }

  function formatVoiceDuration(seconds) {
    const total = Math.max(0, Math.round(Number(seconds) || 0));
    return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  }

  function formatVoiceTime(seconds) {
    const total = Math.max(0, Math.floor(Number(seconds) || 0));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  async function loadVoiceNotes() {
    if (!supabase || !session || voiceNotesLoading) return;
    voiceNotesLoading = true;
    voiceNotesError = "";
    scheduleRender();
    try {
      const { data, error } = await supabase
        .from("voice_notes")
        .select(
          "id,note_id,title,storage_path,mime_type,duration_seconds,size_bytes,transcript,transcription_status,created_at",
        )
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      const rows = await Promise.all(
        (data || []).map(async (row) => {
          const { data: signed, error: signError } = await supabase.storage
            .from("voice-notes")
            .createSignedUrl(row.storage_path, 3600);
          return {
            ...row,
            signed_url: signError ? "" : signed?.signedUrl || "",
          };
        }),
      );
      voiceNotes = rows;
      voiceNotesSupported = true;
    } catch (error) {
      console.error("Could not load voice notes.", error);
      voiceNotes = [];
      if (
        isMissingRelation(error) ||
        /bucket|not found/i.test(error.message || "")
      ) {
        voiceNotesSupported = false;
        voiceNotesError = error.message || "";
      } else {
        voiceNotesError = error.message || "Could not load voice notes.";
      }
    } finally {
      voiceNotesLoading = false;
      voiceNotesLoaded = true;
      scheduleRender();
    }
  }

  function voiceNoteCard(note) {
    const linked = note.note_id
      ? notes.find((item) => String(item.id) === String(note.note_id))
      : null;
    const url = note.signed_url || note.local_url || "";
    const ar = appLanguage === "ar";
    const date = new Intl.DateTimeFormat(ar ? "ar-EG" : "en", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(note.created_at || Date.now()));
    const duration = formatVoiceDuration(note.duration_seconds);
    const badge = note.local ? (ar ? " · لهذه الجلسة فقط" : " · this session only") : "";
    const title = note.title || (ar ? "ملاحظة صوتية" : "Voice note");
    return `<article class="voice-note-card voice-note-card-premium" data-voice-id="${escapeHtml(note.id)}">
      <div class="voice-note-head">
        <div class="voice-note-meta">
          <div class="voice-note-icon" aria-hidden="true">◉</div>
          <div class="voice-note-title">
            <strong dir="auto">${escapeHtml(title)}</strong>
            <small>${escapeHtml(date)} · ${escapeHtml(duration)}${escapeHtml(badge)}</small>
          </div>
        </div>
        <div class="voice-note-actions">
          <button class="task-icon" data-action="voice-rename" data-id="${escapeHtml(note.id)}" aria-label="${ar ? "إعادة تسمية" : "Rename"}" title="${ar ? "إعادة تسمية" : "Rename"}">✎</button>
          <button class="task-icon danger" data-action="voice-delete" data-id="${escapeHtml(note.id)}" aria-label="${ar ? "حذف" : "Delete"}" title="${ar ? "حذف" : "Delete"}">×</button>
        </div>
      </div>
      ${
        url
          ? `<div class="sz-audio-player" data-src="${escapeHtml(url)}" data-duration="${Number(note.duration_seconds) || 0}">
              <audio preload="metadata" src="${escapeHtml(url)}"></audio>
              <div class="sz-audio-top">
                <button type="button" class="sz-audio-play" data-audio-action="toggle" aria-label="${ar ? "تشغيل" : "Play"}">▶</button>
                <div class="sz-audio-wave" data-audio-action="seek" role="slider" aria-label="${ar ? "شريط التقدم" : "Progress"}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" tabindex="0">
                  <div class="sz-audio-wave-bars" aria-hidden="true">${Array.from({ length: 40 }, (_, i) => `<span style="--h:${20 + ((i * 37 + 11) % 60)}%"></span>`).join("")}</div>
                  <div class="sz-audio-wave-progress"></div>
                </div>
                <div class="sz-audio-time"><span data-audio-current>00:00</span><span class="sz-audio-sep">/</span><span data-audio-total>${escapeHtml(duration)}</span></div>
              </div>
              <div class="sz-audio-controls">
                <button type="button" class="sz-audio-btn" data-audio-action="skip-back" aria-label="${ar ? "رجوع 10 ثوانٍ" : "Back 10 seconds"}">↺10</button>
                <button type="button" class="sz-audio-btn" data-audio-action="skip-forward" aria-label="${ar ? "تقديم 10 ثوانٍ" : "Forward 10 seconds"}">10↻</button>
                <label class="sz-audio-speed"><span>${ar ? "السرعة" : "Speed"}</span>
                  <select data-audio-speed aria-label="${ar ? "سرعة التشغيل" : "Playback speed"}">
                    <option value="0.5">0.5×</option>
                    <option value="1" selected>1×</option>
                    <option value="1.25">1.25×</option>
                    <option value="1.5">1.5×</option>
                    <option value="2">2×</option>
                  </select>
                </label>
                <label class="sz-audio-volume" data-audio-volume-wrap>
                  <span aria-hidden="true">🔊</span>
                  <input type="range" min="0" max="1" step="0.05" value="1" data-audio-volume aria-label="${ar ? "مستوى الصوت" : "Volume"}" />
                </label>
              </div>
            </div>`
          : `<p class="data-caption">${ar ? "تعذر إنشاء رابط تشغيل خاص." : "Could not create a private playback link."}</p>`
      }
      ${linked ? `<p class="voice-note-link">${ar ? "مرتبطة بـ" : "Linked to"} <button data-action="note-open" data-id="${escapeHtml(linked.id)}">${escapeHtml(linked.title || "Untitled note")}</button></p>` : ""}
    </article>`;
  }

  function voicePage() {
    const ar = appLanguage === "ar";
    const actions = `<button class="button button-primary" data-action="voice-open"><span class="voice-rec-dot" aria-hidden="true"></span> ${ar ? "تسجيل ملاحظة صوتية" : "Record voice note"}</button>`;
    if (!session && !voiceNotes.length) {
      return `${pageHeading("SPEAK IT, KEEP IT", ar ? "الملاحظات الصوتية" : "Voice notes", ar ? "سجّل أفكارك واحفظها بشكل خاص بمشغل احترافي." : "Capture ideas out loud and keep them private with a modern player.", actions)}
        <section class="panel"><div class="empty-state voice-empty-state"><div class="voice-empty-illustration" aria-hidden="true">◉</div><strong>${ar ? "جرّب تسجيلًا لهذه الجلسة" : "Try a session-only recording"}</strong><p>${ar ? "يمكنك التسجيل الآن كمعاينة تبقى في هذا المتصفح فقط. سجّل الدخول لحفظ التسجيلات في التخزين الخاص." : "You can record a preview now; it stays in this browser session only. Sign in to save recordings to your private storage."}</p><div class="teams-empty-actions"><button class="button button-primary button-small" data-action="voice-open">● ${ar ? "تسجيل معاينة" : "Record a preview"}</button><button class="button button-secondary button-small" id="open-auth">${ar ? "تسجيل الدخول للحفظ" : "Sign in to save"}</button></div></div></section>`;
    }
    if (session && voiceNotesLoading && !voiceNotesLoaded) {
      return `${pageHeading("SPEAK IT, KEEP IT", ar ? "الملاحظات الصوتية" : "Voice notes", ar ? "سجّل أفكارك واحفظها بشكل خاص." : "Capture ideas out loud and keep them private.", actions)}<section class="panel"><div class="empty-state" role="status">${ar ? "جارٍ تحميل التسجيلات…" : "Loading recordings…"}</div></section>`;
    }
    const setupHint = !voiceNotesSupported
      ? `<section class="panel"><div class="empty-state"><strong>${ar ? "التسجيلات الصوتية غير مفعّلة" : "Voice note storage is not enabled yet"}</strong><p>${ar ? "طبّق ملف الترحيل 001_studyzone_enhancements.sql لإنشاء الجدول والحاوية الخاصة." : "Apply supabase/migrations/001_studyzone_enhancements.sql to create the private bucket and metadata table."}</p></div></section>`
      : "";
    const errorHint =
      voiceNotesError && voiceNotesSupported
        ? `<section class="panel"><div class="empty-state"><strong>${ar ? "تعذر تحميل التسجيلات" : "Could not load recordings"}</strong><p>${escapeHtml(voiceNotesError)}</p><button class="button button-secondary button-small" data-action="voice-retry">${ar ? "إعادة المحاولة" : "Try again"}</button></div></section>`
        : "";
    const list = voiceNotes.length
      ? `<div class="voice-note-grid voice-note-grid-premium">${voiceNotes.map(voiceNoteCard).join("")}</div>`
      : `<div class="empty-state voice-empty-state"><div class="voice-empty-illustration" aria-hidden="true">◉</div><strong>${ar ? "لا توجد تسجيلات بعد" : "No recordings yet"}</strong><p>${ar ? "اضغط تسجيل وابدأ بفكرة، ملخص محاضرة، أو تذكير." : "Press record and capture a thought, a lecture summary, or a reminder."}</p><button class="button button-primary button-small" data-action="voice-open">● ${ar ? "تسجيل الآن" : "Record now"}</button></div>`;
    return `${pageHeading("SPEAK IT, KEEP IT", ar ? "الملاحظات الصوتية" : "Voice notes", ar ? "سجّل أفكارك واحفظها بشكل خاص بمشغل احترافي." : "Capture ideas out loud and keep them private with a modern player.", actions)}
      ${setupHint}${errorHint}
      <section class="panel voice-notes-panel">${panelHeading(ar ? "تسجيلاتك" : "Your recordings", ar ? `${voiceNotes.length} ملاحظة صوتية` : `${voiceNotes.length} voice note${voiceNotes.length === 1 ? "" : "s"}`)}${list}</section>
      <p class="data-caption">${
        session
          ? ar
            ? "الصوت يُحفظ في حاوية خاصة. ولا يمكن الوصول إليه إلا بروابط مؤقتة موقعة."
            : "Audio is stored in a private bucket. Playback uses short-lived signed URLs; files are never public."
          : ar
            ? "معاينات الضيف تبقى في هذه الجلسة فقط ولا تُرفع. سجّل الدخول للحفظ الدائم."
            : "Guest previews stay in this browser session only and are never uploaded. Sign in to save permanently."
      }</p>`;
  }

  function resetVoiceRecorder({ keepPreview = false } = {}) {
    if (voiceTimerHandle) {
      window.clearInterval(voiceTimerHandle);
      voiceTimerHandle = null;
    }
    if (voiceRecorder && voiceRecorder.state !== "inactive") {
      try {
        voiceRecorder.stop();
      } catch {
        /* already stopped */
      }
    }
    voiceRecorder = null;
    if (voiceStream) {
      voiceStream.getTracks().forEach((track) => track.stop());
      voiceStream = null;
    }
    voiceChunks = [];
    voiceBlob = null;
    voiceDurationSeconds = 0;
    voiceStartedAt = 0;
    voicePausedTotal = 0;
    voicePauseStartedAt = 0;
    voiceState = "idle";
    if (!keepPreview && voicePreviewUrl) {
      URL.revokeObjectURL(voicePreviewUrl);
      voicePreviewUrl = "";
    }
  }

  function voiceElapsedMs() {
    if (!voiceStartedAt) return 0;
    const paused =
      voicePausedTotal +
      (voiceState === "paused" && voicePauseStartedAt
        ? Date.now() - voicePauseStartedAt
        : 0);
    return Math.max(0, Date.now() - voiceStartedAt - paused);
  }

  function updateVoiceUi() {
    const timer = document.getElementById("voice-timer");
    const status = document.getElementById("voice-status");
    const start = document.getElementById("voice-start");
    const pause = document.getElementById("voice-pause");
    const stop = document.getElementById("voice-stop");
    const discard = document.getElementById("voice-discard");
    const save = document.getElementById("voice-save");
    const preview = document.getElementById("voice-preview");
    const previewShell = document.getElementById("voice-preview-shell");
    const visual = document.getElementById("voice-record-visual");
    if (!timer) return;
    const ar = appLanguage === "ar";
    timer.textContent = formatVoiceDuration(voiceElapsedMs() / 1000);
    const labels = {
      idle: ar ? "جاهز عندما تكون مستعدًا." : "Ready when you are.",
      requesting: ar ? "جارٍ طلب إذن الميكروفون…" : "Requesting microphone permission…",
      recording: ar ? "جارٍ التسجيل…" : "Recording…",
      paused: ar ? "التسجيل متوقف مؤقتًا." : "Recording paused.",
      processing: ar ? "جارٍ تجهيز التسجيل…" : "Preparing your recording…",
      ready: ar ? "استمع للمعاينة ثم احفظ." : "Preview your recording, then save it.",
    };
    if (status) status.textContent = labels[voiceState] || "";
    if (visual) visual.dataset.state = voiceState;
    if (start) {
      start.hidden = voiceState !== "idle" && voiceState !== "ready";
      start.textContent =
        voiceState === "ready"
          ? (ar ? "● تسجيل جديد" : "● Record again")
          : (ar ? "● بدء التسجيل" : "● Start recording");
    }
    if (pause) {
      pause.hidden = voiceState !== "recording" && voiceState !== "paused";
      pause.textContent = voiceState === "paused" ? (ar ? "استئناف" : "Resume") : (ar ? "إيقاف مؤقت" : "Pause");
    }
    if (stop) stop.hidden = voiceState !== "recording" && voiceState !== "paused";
    if (discard) discard.hidden = voiceState === "idle" || voiceState === "processing";
    if (save) save.disabled = voiceState !== "ready" || !voiceBlob;
    if (previewShell) previewShell.hidden = !(voiceState === "ready" && voicePreviewUrl);
    if (preview) {
      if (voicePreviewUrl) {
        preview.src = voicePreviewUrl;
        preview.controls = true;
      } else {
        preview.removeAttribute("src");
        preview.controls = false;
      }
    }
  }
  function openVoiceModal() {
    resetVoiceRecorder();
    document.getElementById("voice-title").value =
      appLanguage === "ar" ? "ملاحظة صوتية" : "Voice note";
    document.getElementById("voice-error").textContent = "";
    document.getElementById("voice-note-link").innerHTML =
      `<option value="">${appLanguage === "ar" ? "بلا ملاحظة" : "No note"}</option>${notes.map((note) => `<option value="${escapeHtml(note.id)}">${escapeHtml(note.title || "Untitled note")}</option>`).join("")}`;
    document.getElementById("voice-help").textContent = session
      ? appLanguage === "ar"
        ? "الحد الأقصى 10 دقائق. يُحفظ في مساحة خاصة بحسابك."
        : "Maximum length is 10 minutes. Saved to your private storage."
      : appLanguage === "ar"
        ? "معاينة الضيف تُحفظ لهذه الجلسة فقط. سجّل الدخول للحفظ الدائم."
        : "Guest recordings stay in this browser session only. Sign in to save permanently.";
    const modal = document.getElementById("voice-modal");
    openModal(modal);
    updateVoiceUi();
    translateInterface();
  }

  async function startVoiceRecording() {
    if (voiceState === "recording" || voiceState === "requesting") return;
    const errorEl = document.getElementById("voice-error");
    errorEl.textContent = "";
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      errorEl.textContent =
        appLanguage === "ar"
          ? "متصفحك لا يدعم تسجيل الصوت."
          : "Your browser does not support audio recording.";
      return;
    }
    if (voiceState === "ready") resetVoiceRecorder();
    voiceState = "requesting";
    updateVoiceUi();
    try {
      voiceStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (document.getElementById("voice-modal")?.hidden) {
        voiceStream.getTracks().forEach((track) => track.stop());
        voiceStream = null;
        voiceState = "idle";
        return;
      }
    } catch (error) {
      voiceState = "idle";
      updateVoiceUi();
      const denied =
        error?.name === "NotAllowedError" || error?.name === "SecurityError";
      errorEl.textContent = denied
        ? appLanguage === "ar"
          ? "تم رفض إذن الميكروفون. اسمح به من إعدادات المتصفح."
          : "Microphone permission was denied. Allow it in your browser settings and try again."
        : appLanguage === "ar"
          ? `تعذر بدء التسجيل: ${error.message}`
          : `Could not start recording: ${error.message}`;
      return;
    }
    const candidates = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4",
      "audio/ogg;codecs=opus",
    ];
    voiceMimeType =
      candidates.find((type) => window.MediaRecorder.isTypeSupported?.(type)) ||
      "";
    try {
      voiceRecorder = new window.MediaRecorder(
        voiceStream,
        voiceMimeType ? { mimeType: voiceMimeType } : undefined,
      );
    } catch (error) {
      errorEl.textContent =
        appLanguage === "ar"
          ? "تعذر إنشاء مسجل الصوت."
          : "Could not create the audio recorder.";
      resetVoiceRecorder();
      updateVoiceUi();
      return;
    }
    voiceMimeType = voiceRecorder.mimeType || voiceMimeType || "audio/webm";
    voiceChunks = [];
    voiceBlob = null;
    voiceDurationSeconds = 0;
    voiceStartedAt = Date.now();
    voicePausedTotal = 0;
    voicePauseStartedAt = 0;
    const activeRecorder = voiceRecorder;
    activeRecorder.addEventListener("dataavailable", (event) => {
      if (voiceRecorder === activeRecorder && event.data?.size)
        voiceChunks.push(event.data);
    });
    activeRecorder.addEventListener("stop", () => {
      if (voiceRecorder !== activeRecorder) return;
      voiceBlob = new Blob(voiceChunks, { type: voiceMimeType });
      if (voicePreviewUrl) URL.revokeObjectURL(voicePreviewUrl);
      voicePreviewUrl = URL.createObjectURL(voiceBlob);
      voiceDurationSeconds = Math.max(1, Math.round(voiceElapsedMs() / 1000));
      if (voiceStream) {
        voiceStream.getTracks().forEach((track) => track.stop());
        voiceStream = null;
      }
      voiceState = "ready";
      if (voiceTimerHandle) {
        window.clearInterval(voiceTimerHandle);
        voiceTimerHandle = null;
      }
      document.getElementById("voice-timer").textContent =
        formatVoiceDuration(voiceDurationSeconds);
      updateVoiceUi();
    });
    voiceRecorder.start(250);
    voiceState = "recording";
    updateVoiceUi();
    if (voiceTimerHandle) window.clearInterval(voiceTimerHandle);
    voiceTimerHandle = window.setInterval(() => {
      const timer = document.getElementById("voice-timer");
      if (timer)
        timer.textContent = formatVoiceDuration(voiceElapsedMs() / 1000);
      if (voiceState === "recording" && voiceElapsedMs() >= 600000) {
        stopVoiceRecording();
      }
    }, 250);
  }

  function pauseVoiceRecording() {
    if (!voiceRecorder) return;
    if (voiceState === "recording") {
      voiceRecorder.pause();
      voiceState = "paused";
      voicePauseStartedAt = Date.now();
      updateVoiceUi();
    } else if (voiceState === "paused") {
      voiceRecorder.resume();
      voicePausedTotal += Date.now() - voicePauseStartedAt;
      voicePauseStartedAt = 0;
      voiceState = "recording";
      updateVoiceUi();
    }
  }

  function stopVoiceRecording() {
    if (!voiceRecorder || voiceRecorder.state === "inactive") return;
    voiceDurationSeconds = Math.max(1, Math.round(voiceElapsedMs() / 1000));
    voiceState = "processing";
    updateVoiceUi();
    try {
      voiceRecorder.stop();
    } catch (error) {
      console.error("Could not stop recording.", error);
    }
  }

  function discardVoiceRecording() {
    resetVoiceRecorder();
    updateVoiceUi();
  }

  async function saveVoiceNote() {
    if (!voiceBlob) return;
    const errorEl = document.getElementById("voice-error");
    errorEl.textContent = "";
    const title =
      document.getElementById("voice-title").value.trim() ||
      (appLanguage === "ar" ? "ملاحظة صوتية" : "Voice note");
    const noteId = document.getElementById("voice-note-link").value || null;
    const saveButton = document.getElementById("voice-save");
    saveButton.disabled = true;
    if (!supabase || !session) {
      voiceNotes.unshift({
        id: `local-voice-${Date.now()}`,
        title,
        note_id: noteId,
        duration_seconds: voiceDurationSeconds,
        created_at: new Date().toISOString(),
        local: true,
        local_url: voicePreviewUrl,
      });
      voicePreviewUrl = "";
      resetVoiceRecorder({ keepPreview: true });
      closeModal(document.getElementById("voice-modal"));
      if (currentPage === "voice") render();
      showToast(
        appLanguage === "ar"
          ? "تم حفظ المعاينة لهذه الجلسة فقط. سجّل الدخول للحفظ الدائم."
          : "Preview saved for this browser session only. Sign in to save permanently.",
      );
      return;
    }
    try {
      const extension = /mp4|m4a/.test(voiceMimeType)
        ? "m4a"
        : /ogg/.test(voiceMimeType)
          ? "ogg"
          : "webm";
      const unique =
        window.crypto?.randomUUID?.() ||
        `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const path = `${session.user.id}/${unique}.${extension}`;
      const upload = await supabase.storage
        .from("voice-notes")
        .upload(path, voiceBlob, {
          contentType: voiceMimeType || "audio/webm",
          upsert: false,
        });
      if (upload.error) throw upload.error;
      const insert = await supabase
        .from("voice_notes")
        .insert({
          note_id: noteId,
          title,
          storage_path: path,
          mime_type: voiceMimeType || "audio/webm",
          duration_seconds: voiceDurationSeconds,
          size_bytes: voiceBlob.size,
        })
        .select(
          "id,note_id,title,storage_path,mime_type,duration_seconds,size_bytes,transcript,transcription_status,created_at",
        )
        .single();
      if (insert.error) {
        await supabase.storage.from("voice-notes").remove([path]);
        throw insert.error;
      }
      const signed = await supabase.storage
        .from("voice-notes")
        .createSignedUrl(path, 3600);
      voiceNotes.unshift({
        ...insert.data,
        signed_url: signed.error ? "" : signed.data?.signedUrl || "",
      });
      closeModal(document.getElementById("voice-modal"));
      resetVoiceRecorder();
      if (currentPage === "voice") render();
      showToast(
        appLanguage === "ar" ? "تم حفظ الملاحظة الصوتية." : "Voice note saved.",
      );
    } catch (error) {
      console.error("Could not save the voice note.", error);
      errorEl.textContent = isMissingRelation(error)
        ? appLanguage === "ar"
          ? "جدول الملاحظات الصوتية غير موجود. طبّق ملف الترحيل أولًا."
          : "The voice_notes table is missing. Apply the migration first."
        : appLanguage === "ar"
          ? `تعذر حفظ التسجيل: ${error.message}`
          : `Could not save the recording: ${error.message}`;
      saveButton.disabled = false;
    }
  }

  async function renameVoiceNote(id) {
    const note = voiceNotes.find((item) => String(item.id) === String(id));
    if (!note) return;
    const next = window.prompt(
      appLanguage === "ar" ? "اسم جديد للتسجيل" : "New recording title",
      note.title || "Voice note",
    );
    if (!next || !next.trim()) return;
    note.title = next.trim().slice(0, 180);
    if (!note.local) {
      const { error } = await supabase
        .from("voice_notes")
        .update({ title: note.title })
        .eq("id", note.id);
      if (error) {
        showToast(error.message);
        return;
      }
    }
    render();
  }

  function initVoiceAudioPlayers(root = document) {
    const players = root.querySelectorAll(".sz-audio-player");
    if (!players.length) return;
    players.forEach((player) => {
      if (player.dataset.enhanced === "1") return;
      player.dataset.enhanced = "1";
      const audio = player.querySelector("audio");
      if (!audio) return;
      const playBtn = player.querySelector('[data-audio-action="toggle"]');
      const wave = player.querySelector(".sz-audio-wave");
      const progress = player.querySelector(".sz-audio-wave-progress");
      const currentEl = player.querySelector("[data-audio-current]");
      const totalEl = player.querySelector("[data-audio-total]");
      const speed = player.querySelector("[data-audio-speed]");
      const volume = player.querySelector("[data-audio-volume]");
      const volumeWrap = player.querySelector("[data-audio-volume-wrap]");
      const ar = appLanguage === "ar";

      const setTime = () => {
        const cur = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
        const dur = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : Number(player.dataset.duration || 0);
        if (currentEl) currentEl.textContent = formatVoiceTime(cur);
        if (totalEl && dur) totalEl.textContent = formatVoiceTime(dur);
        const pct = dur ? Math.max(0, Math.min(100, (cur / dur) * 100)) : 0;
        if (progress) progress.style.width = `${pct}%`;
        if (wave) {
          wave.setAttribute("aria-valuenow", String(Math.round(pct)));
          wave.style.setProperty("--progress", `${pct}%`);
        }
      };
      const setPlayState = () => {
        const playing = !audio.paused && !audio.ended;
        player.classList.toggle("is-playing", playing);
        if (playBtn) {
          playBtn.textContent = playing ? "❚❚" : "▶";
          playBtn.setAttribute("aria-label", playing ? (ar ? "إيقاف مؤقت" : "Pause") : (ar ? "تشغيل" : "Play"));
        }
      };

      playBtn?.addEventListener("click", () => {
        if (audio.paused || audio.ended) {
          document.querySelectorAll(".sz-audio-player audio").forEach((other) => {
            if (other !== audio && !other.paused) other.pause();
          });
          void audio.play().catch(() => {});
        } else {
          audio.pause();
        }
      });
      player.querySelector('[data-audio-action="skip-back"]')?.addEventListener("click", () => {
        audio.currentTime = Math.max(0, (audio.currentTime || 0) - 10);
      });
      player.querySelector('[data-audio-action="skip-forward"]')?.addEventListener("click", () => {
        const dur = Number.isFinite(audio.duration) ? audio.duration : Infinity;
        audio.currentTime = Math.min(dur, (audio.currentTime || 0) + 10);
      });
      speed?.addEventListener("change", () => {
        audio.playbackRate = Number(speed.value) || 1;
      });
      if (volume) {
        const canVolume = !/iPad|iPhone|iPod/.test(navigator.userAgent);
        if (!canVolume && volumeWrap) volumeWrap.hidden = true;
        volume.addEventListener("input", () => {
          audio.volume = Number(volume.value);
          audio.muted = audio.volume === 0;
        });
      }

      const seekToClientX = (clientX) => {
        if (!wave) return;
        const rect = wave.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(1, rect.width)));
        const dur = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : Number(player.dataset.duration || 0);
        if (dur) audio.currentTime = ratio * dur;
      };
      let dragging = false;
      wave?.addEventListener("pointerdown", (event) => {
        dragging = true;
        wave.setPointerCapture?.(event.pointerId);
        seekToClientX(event.clientX);
      });
      wave?.addEventListener("pointermove", (event) => {
        if (dragging) seekToClientX(event.clientX);
      });
      const stopDrag = () => { dragging = false; };
      wave?.addEventListener("pointerup", stopDrag);
      wave?.addEventListener("pointercancel", stopDrag);
      wave?.addEventListener("click", (event) => seekToClientX(event.clientX));
      wave?.addEventListener("keydown", (event) => {
        if (event.key === "ArrowLeft") { audio.currentTime = Math.max(0, (audio.currentTime || 0) - 5); event.preventDefault(); }
        if (event.key === "ArrowRight") { const dur = Number.isFinite(audio.duration) ? audio.duration : Infinity; audio.currentTime = Math.min(dur, (audio.currentTime || 0) + 5); event.preventDefault(); }
      });

      audio.addEventListener("play", () => {
        document.querySelectorAll(".sz-audio-player audio").forEach((other) => {
          if (other !== audio && !other.paused) other.pause();
        });
        setPlayState();
      });
      audio.addEventListener("pause", setPlayState);
      audio.addEventListener("ended", setPlayState);
      audio.addEventListener("timeupdate", setTime);
      audio.addEventListener("loadedmetadata", setTime);
      audio.addEventListener("durationchange", setTime);
      setTime();
      setPlayState();
    });
  }

  function enhanceVoiceAudioPlayers() {
    if (currentPage !== "voice") return;
    initVoiceAudioPlayers(document.getElementById("page-content") || document);
  }

  async function deleteVoiceNote(id) {
    const note = voiceNotes.find((item) => String(item.id) === String(id));
    if (!note) return;
    if (
      !window.confirm(
        appLanguage === "ar" ? "حذف هذا التسجيل؟" : "Delete this recording?",
      )
    )
      return;
    try {
      if (!note.local) {
        const { error } = await supabase
          .from("voice_notes")
          .delete()
          .eq("id", note.id);
        if (error) throw error;
        await supabase.storage.from("voice-notes").remove([note.storage_path]);
      }
      if (note.local_url) URL.revokeObjectURL(note.local_url);
      voiceNotes = voiceNotes.filter((item) => String(item.id) !== String(id));
      render();
      showToast(
        appLanguage === "ar" ? "تم حذف التسجيل." : "Recording deleted.",
      );
    } catch (error) {
      showToast(error.message);
    }
  }

  function minutesFromTime(value) {
    const [hours, minutes] = String(value || "")
      .split(":")
      .map(Number);
    if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
    return hours * 60 + minutes;
  }

  function isDoNotDisturbActive(prefs = notificationPrefs) {
    if (!prefs.dnd) return false;
    const start = minutesFromTime(prefs.start);
    const end = minutesFromTime(prefs.end);
    if (start == null || end == null || start === end) return false;
    const now = new Date();
    const current = now.getHours() * 60 + now.getMinutes();
    return start < end
      ? current >= start && current < end
      : current >= start || current < end;
  }

  const ALERT_SOUNDS = [
    {
      id: "focus-start",
      label: { en: "Focus start", ar: "بداية التركيز" },
      description: {
        en: "Two-note signal that a focus session has begun.",
        ar: "نغمة من فتحتين واضحة تعلن بدء جلسة التركيز.",
      },
      pattern: {
        durationMs: 560,
        tones: [
          { frequency: 523.25, endFrequency: 392, start: 0, duration: 0.22 },
          { frequency: 392, endFrequency: 329.63, start: 0.22, duration: 0.34 },
        ],
      },
    },
    {
      id: "focus-end",
      label: { en: "Focus end", ar: "نهاية التركيز" },
      description: {
        en: "Deep tone that marks a focus session or Pomodoro cycle as complete.",
        ar: "نغمة عميقة تميّز اكتمال جلسة التركيز أو دورة البومودورو.",
      },
      pattern: {
        durationMs: 1400,
        tones: [
          { frequency: 329.63, endFrequency: 246.94, start: 0, duration: 1.2 },
        ],
      },
    },
    {
      id: "task-reminder",
      label: { en: "Task reminder", ar: "تذكير المهمة" },
      description: {
        en: "Two-note alert that pulls a task or appointment back into focus.",
        ar: "تنبيه من فتحتين يسترجع المهمة أو الموعد إلى التركيز.",
      },
      pattern: {
        durationMs: 900,
        tones: [
          { frequency: 659.25, endFrequency: 830.61, start: 0, duration: 0.32 },
          {
            frequency: 830.61,
            endFrequency: 987.77,
            start: 0.32,
            duration: 0.42,
          },
        ],
      },
    },
    {
      id: "break-end",
      label: { en: "Break end", ar: "نهاية الاستراحة" },
      description: {
        en: "Soft tone that ends a break and prepares the next focus block.",
        ar: "نغمة هادئة تنهي الاستراحة وتجهز الجلسة القادمة.",
      },
      pattern: {
        durationMs: 1000,
        tones: [
          { frequency: 493.88, endFrequency: 440, start: 0, duration: 0.9 },
        ],
      },
    },
  ];

  let alertAudioContext = null;
  let alertAudioMaster = null;
  let alertAudioSources = [];
  let alertAudioRepeatHandle = null;
  let alertAudioStopHandle = null;
  let alertSnoozeTimer = null;
  let lastAlertSound = { soundId: "task-reminder", volume: 80, duration: 5 };
  let activeAlertKey = null;

  function ensureAlertAudioContext() {
    if (!alertAudioContext) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return null;
      alertAudioContext = new AudioContext();
      alertAudioMaster = alertAudioContext.createGain();
      alertAudioMaster.gain.value = 0.9;
      alertAudioMaster.connect(alertAudioContext.destination);
    }
    return alertAudioContext;
  }

  async function unlockAlertAudio() {
    const context = ensureAlertAudioContext();
    if (!context) return null;
    if (context.state === "suspended") {
      try {
        await context.resume();
      } catch {
        /* keep the current context */
      }
    }
    return context;
  }

  function stopAlertAudio() {
    if (alertAudioRepeatHandle) {
      window.clearTimeout(alertAudioRepeatHandle);
      alertAudioRepeatHandle = null;
    }
    if (alertAudioStopHandle) {
      window.clearTimeout(alertAudioStopHandle);
      alertAudioStopHandle = null;
    }
    for (const source of alertAudioSources) {
      try {
        source.stop(0);
      } catch {
        /* already stopped */
      }
      try {
        source.disconnect();
      } catch {
        /* already disconnected */
      }
    }
    alertAudioSources = [];
  }

  function startAlert({ key, soundId, volume, duration, repeat } = {}) {
    stopAlertAudio();
    activeAlertKey = key || null;
    lastAlertSound = {
      soundId: soundId || "task-reminder",
      volume: volume || 80,
      duration: duration || 5,
    };
    void playAlertSound({ soundId, volume, duration, repeat }).then(() => {
      if (activeAlertKey !== key) stopAlertAudio();
    });
    return key || null;
  }

  function snoozeActiveAlert(minutes = 5) {
    stopAlertAudio();
    if (alertSnoozeTimer) window.clearTimeout(alertSnoozeTimer);
    alertSnoozeTimer = window.setTimeout(
      () => {
        alertSnoozeTimer = null;
        void playAlertSound({ ...lastAlertSound, repeat: false });
      },
      Math.max(1, minutes) * 60000,
    );
  }

  async function playAlertSound({ soundId, volume, duration, repeat } = {}) {
    const context = await unlockAlertAudio();
    if (!context || !alertAudioMaster) return;
    const sound =
      ALERT_SOUNDS.find((item) => item.id === soundId) ||
      ALERT_SOUNDS[ALERT_SOUNDS.length - 1];
    const pattern = sound.pattern;
    const volumeValue = Math.max(0, Math.min(100, Number(volume) || 80)) / 100;
    // Web Audio يعمل بالثواني، لذلك نحوّل كل القيم إلى ثوانٍ قبل الجدولة.
    const iterationSeconds = pattern.durationMs / 1000;
    const playSeconds = Math.max(
      iterationSeconds,
      Number(duration) > 0 ? Number(duration) : iterationSeconds,
    );

    stopAlertAudio();
    alertAudioMaster.gain.cancelScheduledValues(context.currentTime);
    alertAudioMaster.gain.setValueAtTime(
      Math.max(volumeValue * 0.9, 0.0001),
      context.currentTime,
    );
    alertAudioMaster.gain.exponentialRampToValueAtTime(
      Math.max(volumeValue * 0.9, 0.0001),
      context.currentTime + 0.05,
    );

    const startTime = context.currentTime + 0.02;
    const endTime = startTime + playSeconds;
    const iterations =
      repeat === true
        ? Math.max(1, Math.ceil(playSeconds / iterationSeconds))
        : 1;

    // نجدول كل النغمات مقدماً ونضع لكل منها وقت إيقاف صريح داخل المدة.
    for (let index = 0; index < iterations; index += 1) {
      const iterationStart = startTime + index * iterationSeconds;
      if (iterationStart >= endTime) break;
      for (const tone of pattern.tones) {
        const toneStart = iterationStart + tone.start;
        const toneEnd = Math.min(toneStart + tone.duration, endTime);
        if (toneStart >= endTime || toneEnd <= toneStart) continue;
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(tone.frequency, toneStart);
        if (tone.endFrequency)
          oscillator.frequency.exponentialRampToValueAtTime(
            Math.max(tone.endFrequency, 1),
            toneEnd,
          );
        gain.gain.setValueAtTime(0.0001, toneStart);
        gain.gain.exponentialRampToValueAtTime(
          Math.max(volumeValue * 0.9, 0.0001),
          toneStart + 0.015,
        );
        gain.gain.setValueAtTime(
          Math.max(volumeValue * 0.9, 0.0001),
          Math.max(toneEnd - 0.015, toneStart + 0.001),
        );
        gain.gain.exponentialRampToValueAtTime(0.0001, toneEnd);
        oscillator.connect(gain);
        gain.connect(alertAudioMaster);
        oscillator.start(toneStart);
        oscillator.stop(toneEnd);
        alertAudioSources.push(oscillator);
      }
    }

    // تنظيف إضافي احتياطي بعد انتهاء النافذة الزمنية.
    alertAudioStopHandle = window.setTimeout(
      () => {
        alertAudioStopHandle = null;
        stopAlertAudio();
      },
      playSeconds * 1000 + 120,
    );
  }

  async function previewAlertSound(soundId) {
    await playAlertSound({ soundId, volume: 80, duration: 5, repeat: false });
  }

  function playNotificationSound() {
    if (!notificationPrefs.sound || isDoNotDisturbActive()) return;
    startAlert({
      key: `task-alert-${Date.now()}`,
      soundId: notificationPrefs.taskSound || "task-reminder",
      volume: notificationPrefs.taskVolume,
      duration: notificationPrefs.taskDuration,
      repeat: notificationPrefs.taskRepeat,
    });
  }

  function notificationPreferencesPanel() {
    const dndActive = isDoNotDisturbActive();
    return `<section class="panel">${panelHeading(appLanguage === "ar" ? "إشعارات التطبيق" : "Notification sounds")}
      <form id="notification-prefs-form" class="form-stack notification-prefs-form">
        <label class="focus-setting-toggle"><span>${appLanguage === "ar" ? "صوت عند وصول إشعار جديد" : "Play a sound for new notifications"}</span><input type="checkbox" name="sound" ${notificationPrefs.sound ? "checked" : ""}><i aria-hidden="true"></i></label>
        <label class="focus-setting-toggle"><span>${appLanguage === "ar" ? "الاهتزاز" : "Vibration"}</span><input type="checkbox" name="vibration_enabled" ${notificationPrefs.vibration_enabled !== false ? "checked" : ""}><i aria-hidden="true"></i></label>
        <label class="focus-setting-toggle"><span>${appLanguage === "ar" ? "وضع عدم الإزعاج" : "Do not disturb"}</span><input type="checkbox" name="dnd" ${notificationPrefs.dnd ? "checked" : ""}><i aria-hidden="true"></i></label>
        <div class="form-row">
          <label>${appLanguage === "ar" ? "من" : "From"}<input type="time" name="dnd_start" value="${escapeHtml(notificationPrefs.start)}" /></label>
          <label>${appLanguage === "ar" ? "إلى" : "To"}<input type="time" name="dnd_end" value="${escapeHtml(notificationPrefs.end)}" /></label>
        </div>
        <p class="data-caption">${dndActive ? (appLanguage === "ar" ? "وضع عدم الإزعاج نشط الآن، لذلك لن تُشغّل الأصوات." : "Do not disturb is active right now, so sounds are suppressed.") : appLanguage === "ar" ? "تُطبّق هذه الإعدادات في هذا المتصفح وتحفظ في حسابك عند توفر الجدول." : "These preferences apply in this browser and sync to your account when the preferences table is available."}</p>
        <button class="button button-primary button-small" type="submit">${appLanguage === "ar" ? "حفظ إعدادات الإشعارات" : "Save notification settings"}</button>
        <div class="task-sound-settings">
          <div class="form-row">
            <label>${appLanguage === "ar" ? "صوت التذكير" : "Task reminder sound"}<select id="task-sound-select">${ALERT_SOUNDS.map((sound) => `<option value="${sound.id}" ${notificationPrefs.taskSound === sound.id ? "selected" : ""}>${sound.label[appLanguage] || sound.label.en}</option>`).join("")}</select></label>
            <label>${appLanguage === "ar" ? "مدة صوت التذكير" : "Task sound duration"}<select id="task-sound-duration">${[3, 5, 10, 15].map((seconds) => `<option value="${seconds}" ${Number(notificationPrefs.taskDuration) === seconds ? "selected" : ""}>${seconds}</option>`).join("")}</select></label>
          </div>
          <label class="focus-setting-toggle"><span>${appLanguage === "ar" ? "تكرار صوت التذكير" : "Repeat task alert sound"}</span><input type="checkbox" name="taskRepeat" ${notificationPrefs.taskRepeat ? "checked" : ""}><i aria-hidden="true"></i></label>
          <label>${appLanguage === "ar" ? "مستوى صوت التذكير" : "Task sound volume"}<input type="range" id="task-sound-volume" min="0" max="100" step="5" value="${notificationPrefs.taskVolume}" /><span id="task-sound-volume-value" dir="ltr">${notificationPrefs.taskVolume}%</span></label>
          <button class="button button-secondary button-small" type="button" data-action="notification-sound-preview">Preview</button>
        </div>
      </form>
    </section>`;
  }

  async function saveNotificationPreferences(formData) {
    notificationPrefs = {
      sound: formData.get("sound") === "on",
      dnd: formData.get("dnd") === "on",
      start: String(formData.get("dnd_start") || "22:00"),
      end: String(formData.get("dnd_end") || "07:00"),
      vibration_enabled: formData.get("vibration_enabled") === "on",
      taskSound: String(formData.get("taskSound") || "task-reminder"),
      taskVolume: Number(formData.get("taskVolume") || 80),
      taskDuration: Number(formData.get("taskDuration") || 5),
      taskRepeat: formData.get("taskRepeat") === "on",
    };
    localStorage.setItem(
      notificationPrefsKey,
      JSON.stringify(notificationPrefs),
    );
    if (supabase && session) {
      const { error } = await supabase
        .from("user_notification_preferences")
        .upsert(
          {
            user_id: session.user.id,
            sound_enabled: notificationPrefs.sound,
            dnd_enabled: notificationPrefs.dnd,
            vibration_enabled: notificationPrefs.vibration_enabled,
            dnd_start: notificationPrefs.start,
            dnd_end: notificationPrefs.end,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" },
        );
      if (error && !isMissingRelation(error)) throw error;
    }
    render();
    showToast(
      appLanguage === "ar"
        ? "تم حفظ إعدادات الإشعارات."
        : "Notification settings saved.",
    );
  }

  async function enableTaskNotifications() {
    if (!supabase || !session)
      throw new Error("Sign in to enable task notifications.");
    const vapidPublicKey = window.studyFlowSupabaseConfig?.vapidPublicKey;
    if (!vapidPublicKey)
      throw new Error(
        "Daily push is not configured yet. Ask your administrator to finish the VAPID setup.",
      );
    if (
      !window.isSecureContext ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window)
    ) {
      throw new Error(
        "Push notifications require a supported browser and HTTPS (localhost is supported for development).",
      );
    }
    const permission =
      Notification.permission === "granted"
        ? Notification.permission
        : await Notification.requestPermission();
    if (permission !== "granted")
      throw new Error(
        "Notification permission is required to enable task notifications.",
      );
    const registration = await navigator.serviceWorker.ready;
    const subscription =
      (await registration.pushManager.getSubscription()) ||
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidApplicationServerKey(vapidPublicKey),
      }));
    const serialized = subscription.toJSON();
    const p256dh = serialized.keys?.p256dh;
    const authSecret = serialized.keys?.auth;
    if (!subscription.endpoint || !p256dh || !authSecret) {
      await subscription.unsubscribe();
      throw new Error("The browser returned an incomplete push subscription.");
    }
    if (!isSupportedPushEndpoint(subscription.endpoint)) {
      await subscription.unsubscribe();
      throw new Error(
        "This browser's push service is not currently supported.",
      );
    }
    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        user_id: session.user.id,
        endpoint: subscription.endpoint,
        p256dh,
        auth_secret: authSecret,
      },
      { onConflict: "user_id,endpoint" },
    );
    if (error) {
      await subscription.unsubscribe();
      throw error;
    }
    const localTime = String(dailyReminderPreference.local_time || "09:00");
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    const { error: reminderError } = await supabase
      .from("daily_reminder_preferences")
      .upsert(
        {
          user_id: session.user.id,
          enabled: true,
          local_time: localTime,
          timezone,
        },
        { onConflict: "user_id" },
      );
    if (reminderError) throw reminderError;
    dailyReminderPreference = {
      enabled: true,
      local_time: localTime,
      timezone,
    };
    render();
    showToast(
      appLanguage === "ar"
        ? "تم تفعيل إشعارات المهام."
        : "Task notifications enabled.",
    );
  }

  function notificationsPage() {
    const items = session ? userNotifications : [];
    const rows = items
      .map(
        (item) =>
          `<article class="notification-card ${item.read_at ? "" : "unread"}"><i class="notification-indicator"></i><div><strong dir="auto">${escapeHtml(item.title)}</strong><p dir="auto">${escapeHtml(item.message)}</p></div><time dir="auto">${escapeHtml(new Intl.DateTimeFormat(appLanguage === "ar" ? "ar-EG" : "en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.created_at)))}</time></article>`,
      )
      .join("");
    const empty = `<div class="empty-state"><strong>${session ? "All caught up" : "Sign in to sync notifications"}</strong>${session ? "Deadline reminders will appear here when generated." : "Your private deadline notifications are attached to your account."}</div>`;
    const dndActive = isDoNotDisturbActive();
    const soundLabel = notificationPrefs.sound
      ? dndActive
        ? appLanguage === "ar"
          ? "الصوت مكتوم الآن (عدم الإزعاج)"
          : "Sound is muted right now (do not disturb)"
        : appLanguage === "ar"
          ? "صوت الإشعارات مفعّل"
          : "Notification sound is on"
      : appLanguage === "ar"
        ? "صوت الإشعارات متوقف"
        : "Notification sound is off";
    return `${pageHeading("UPDATES", appLanguage === "ar" ? "الإشعارات" : "Notifications", appLanguage === "ar" ? "مكان هادئ للتذكيرات والإنجازات والتحديثات المهمة." : "A quiet place for reminders, milestones, and important updates.", `<button class="button button-secondary button-small" data-navigate="settings">${appLanguage === "ar" ? "إعدادات الصوت" : "Sound settings"}</button><button class="button button-secondary button-small" data-action="mark-notifications-read" ${items.every((item) => item.read_at) ? "disabled" : ""}>${appLanguage === "ar" ? "تعليم الكل كمقروء" : "Mark all read"}</button>`)}<p class="data-caption notification-sound-state">${escapeHtml(soundLabel)}</p><section class="panel"><div class="notification-list">${rows || empty}</div>${session ? `<div class="notifications-actions"><button class="button button-primary button-small" data-action="notifications-enable-task-reminders">${appLanguage === "ar" ? "تفعيل إشعارات المهام" : "Enable task notifications"}</button></div>` : ""}</section>`;
  }

  function profilePage() {
    const displayName =
      accountProfile?.display_name ||
      session?.user?.user_metadata?.full_name ||
      "Alex Morgan";
    const email = session?.user?.email || "Student account";
    const timezone =
      accountProfile?.timezone ||
      Intl.DateTimeFormat().resolvedOptions().timeZone;
    const avatar = accountProfile?.avatar_display_url
      ? `<img src="${escapeHtml(accountProfile.avatar_display_url)}" alt="" referrerpolicy="no-referrer">`
      : initials(displayName);
    return `${pageHeading("YOUR ACCOUNT", "Profile", "Your academic workspace, at a glance.", "")}<div class="profile-layout"><section class="panel profile-card"><div class="profile-avatar" dir="ltr">${avatar}</div><h2 dir="auto">${escapeHtml(displayName)}</h2><p dir="ltr">${escapeHtml(email)}</p><div class="profile-stats"><div><strong>${session && rewardSummary ? rewardCounterMarkup("profile-level", rewardSummary.level) : "—"}</strong><small>Level</small></div><div><strong>${session && rewardSummary ? rewardCounterMarkup("profile-streak", rewardSummary.current_streak) : "—"}</strong><small>Day streak</small></div></div><p class="profile-xp">${session && rewardSummary ? `${rewardCounterMarkup("profile-xp", rewardSummary.total_xp)} XP` : translateUiText("Sign in to earn secure rewards.")}</p></section><section class="panel">${panelHeading("Academic profile", "Personal details stay private to your account")}<div class="setting-row"><div><strong>Email</strong><small dir="ltr">${escapeHtml(email)}</small></div></div><div class="setting-row"><div><strong>Timezone</strong><small dir="ltr">${escapeHtml(timezone)}</small></div></div><div class="setting-row"><div><strong>Language</strong><small>${escapeHtml(accountProfile?.language || appLanguage)}</small></div></div><button class="button button-secondary button-small section-spacer" data-action="profile-edit" ${session ? "" : "disabled"}>Edit profile</button>${session ? "" : `<p class="data-caption">Sign in to edit your account profile.</p>`}</section></div>`;
  }

  const THEME_PRESETS = [
    {
      id: "original",
      label: "Original",
      description: "Original Study Zone identity",
      colors: ["#0C4137", "#06D6A0"],
      meta: "#0C4137",
    },
    {
      id: "ocean",
      label: "Ocean Blue",
      description: "Calm blue surfaces with a bright sky accent",
      colors: ["#0B3245", "#38BDF8"],
      meta: "#0B3245",
    },
    {
      id: "emerald",
      label: "Emerald",
      description: "Deep green surfaces with a fresh emerald accent",
      colors: ["#0A3529", "#10B981"],
      meta: "#0A3529",
    },
    {
      id: "purple",
      label: "Purple",
      description: "Soft violet surfaces with a lavender accent",
      colors: ["#241A44", "#A78BFA"],
      meta: "#241A44",
    },
    {
      id: "crimson",
      label: "Crimson",
      description: "Warm crimson surfaces with a rose accent",
      colors: ["#4A1220", "#FB7185"],
      meta: "#4A1220",
    },
    {
      id: "midnight",
      label: "Midnight",
      description: "Deep navy surfaces with a clear blue accent",
      colors: ["#101C33", "#60A5FA"],
      meta: "#101C33",
    },
    {
      id: "orange",
      label: "Orange",
      description: "Warm orange surfaces with a bright amber accent",
      colors: ["#3A1F0E", "#F97316"],
      meta: "#3A1F0E",
    },
    {
      id: "sky",
      label: "Sky Blue",
      description: "Calm dark blue surfaces with a bright sky accent",
      colors: ["#0F172A", "#0EA5E9"],
      meta: "#0F172A",
    },
    {
      id: "cyan",
      label: "Cyan",
      description: "Deep teal surfaces with a bright cyan accent",
      colors: ["#134E4A", "#22D3EE"],
      meta: "#134E4A",
    },
    {
      id: "turquoise",
      label: "Turquoise",
      description: "Dark turquoise surfaces with a fresh aqua accent",
      colors: ["#0F4C44", "#14B8A6"],
      meta: "#0F4C44",
    },
    {
      id: "teal",
      label: "Teal",
      description: "Dark teal surfaces with a clear teal accent",
      colors: ["#0B3D37", "#0D9488"],
      meta: "#0B3D37",
    },
    {
      id: "mint",
      label: "Mint",
      description: "Dark green surfaces with a fresh mint accent",
      colors: ["#064E3B", "#4ADE80"],
      meta: "#064E3B",
    },
    {
      id: "lime",
      label: "Lime",
      description: "Dark olive surfaces with a bright lime accent",
      colors: ["#365314", "#84CC16"],
      meta: "#365314",
    },
    {
      id: "violet",
      label: "Violet",
      description: "Deep purple surfaces with a vivid violet accent",
      colors: ["#3B0764", "#8B5CF6"],
      meta: "#3B0764",
    },
    {
      id: "lavender",
      label: "Lavender",
      description: "Soft purple surfaces with a light lavender accent",
      colors: ["#431A6E", "#A78BFA"],
      meta: "#431A6E",
    },
    {
      id: "indigo",
      label: "Indigo",
      description: "Deep indigo surfaces with a clear blue-violet accent",
      colors: ["#312E81", "#6366F1"],
      meta: "#312E81",
    },
    {
      id: "rose",
      label: "Rose",
      description: "Deep rose surfaces with a warm pink-red accent",
      colors: ["#4A044E", "#F43F5E"],
      meta: "#4A044E",
    },
    {
      id: "pink",
      label: "Pink",
      description: "Dark magenta surfaces with a bright pink accent",
      colors: ["#5C0B4E", "#EC4899"],
      meta: "#5C0B4E",
    },
    {
      id: "magenta",
      label: "Magenta",
      description: "Dark purple surfaces with a vivid magenta accent",
      colors: ["#581C87", "#D946EF"],
      meta: "#581C87",
    },
    {
      id: "coral",
      label: "Coral",
      description: "Dark coral surfaces with a warm salmon accent",
      colors: ["#4E1A20", "#FB7185"],
      meta: "#4E1A20",
    },
    {
      id: "amber",
      label: "Amber",
      description: "Dark amber surfaces with a warm golden accent",
      colors: ["#5B3A0E", "#F59E0B"],
      meta: "#5B3A0E",
    },
    {
      id: "yellow",
      label: "Yellow",
      description: "Dark yellow surfaces with a bright golden accent",
      colors: ["#5C4E0E", "#EAB308"],
      meta: "#5C4E0E",
    },
    {
      id: "graphite",
      label: "Graphite",
      description: "Neutral dark gray surfaces with a slate accent",
      colors: ["#1F2224", "#6B7280"],
      meta: "#1F2224",
    },
  ];
  const themePresetIds = new Set(THEME_PRESETS.map((preset) => preset.id));

  function normalizeThemePreset(value) {
    return themePresetIds.has(value) ? value : "original";
  }

  function currentThemePreset() {
    return normalizeThemePreset(
      document.documentElement.dataset.themePreset ||
        localStorage.getItem("studyflow.theme.preset") ||
        "original",
    );
  }

  function applyThemePreset(themeId, { persist = true, announce = false } = {}) {
    const id = normalizeThemePreset(themeId);
    try {
      // Always keep an explicit attribute, including "original", so the
      // generated preset rules can fully reset every token. If a stored value
      // was corrupt, normalizeThemePreset already fell back to "original".
      document.documentElement.dataset.themePreset = id;
      if (persist) localStorage.setItem("studyflow.theme.preset", id);
      const preset = THEME_PRESETS.find((item) => item.id === id);
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta && preset?.meta) meta.content = preset.meta;
      document.querySelectorAll("[data-theme-preset-option]").forEach((option) => {
        const selected = option.dataset.themePresetOption === id;
        option.classList.toggle("selected", selected);
        option.setAttribute("aria-pressed", String(selected));
      });
      window.dispatchEvent(
        new CustomEvent("studyzone:theme-changed", { detail: { theme: id } }),
      );
      syncWidgetData();
      if (announce) showToast("Theme applied.");
    } catch (error) {
      // A theme must never be able to crash the app. Fall back to the safe
      // default palette and keep the UI usable.
      console.error("Theme switch failed; restoring the default theme.", error);
      try {
        document.documentElement.dataset.themePreset = "original";
        localStorage.setItem("studyflow.theme.preset", "original");
      } catch (_) {
        /* storage unavailable — ignore */
      }
      showToast(
        appLanguage === "ar"
          ? "تعذر تطبيق الثيم. تمت الاستعادة إلى الثيم الافتراضي."
          : "Could not apply that theme. Restored the default theme.",
      );
    }
  }

  // ---- Visual style (Modern / Pixel) --------------------------------------

  const VISUAL_STYLE_KEY = "studyflow.visual-style";
  const VISUAL_STYLE_IDS = new Set(["modern", "pixel"]);

  function normalizeVisualStyle(value) {
    return VISUAL_STYLE_IDS.has(value) ? value : "modern";
  }

  function currentVisualStyle() {
    return normalizeVisualStyle(
      document.documentElement.dataset.visualStyle ||
        localStorage.getItem(VISUAL_STYLE_KEY) ||
        "modern",
    );
  }

  function applyVisualStyle(styleId, { persist = true } = {}) {
    const id = normalizeVisualStyle(styleId);
    if (id === "modern") {
      delete document.documentElement.dataset.visualStyle;
    } else {
      document.documentElement.dataset.visualStyle = id;
    }
    if (persist) localStorage.setItem(VISUAL_STYLE_KEY, id);
    document.querySelectorAll("[data-visual-style-option]").forEach((option) => {
      const selected = option.dataset.visualStyleOption === id;
      option.classList.toggle("selected", selected);
      option.setAttribute("aria-pressed", String(selected));
    });
    window.dispatchEvent(
      new CustomEvent("studyzone:visual-style-changed", {
        detail: { style: id },
      }),
    );
    syncWidgetData();
  }

  async function saveVisualStyle(styleId) {
    applyVisualStyle(styleId);
    if (!supabase || !session) return;
    const { error } = await supabase
      .from("profiles")
      .update({ visual_style: styleId })
      .eq("id", session.user.id);
    if (error) {
      console.warn("Could not save visual style to the profile.", error);
    }
  }

  async function saveThemePreset(themeId) {
    const id = normalizeThemePreset(themeId);
    applyThemePreset(id, { announce: true });
    // Keep the native layer informed without letting a bridge failure abort
    // the in-app theme change.
    try {
      window.StudyZoneNotifications?.setLauncherIcon?.(id);
    } catch (error) {
      console.warn("Native theme hook unavailable.", error);
    }
    if (!supabase || !session) return;
    const { error } = await supabase
      .from("profiles")
      .update({ theme: id })
      .eq("id", session.user.id);
    if (error) {
      // Theme is already saved locally; Supabase sync failure is non-critical.
      console.warn("Theme saved locally. Supabase profile sync skipped.", error);
    }
  }

  function themeSettingsPanel() {
    const selected = currentThemePreset();
    const options = THEME_PRESETS.map(
      (preset) =>
        `<button class="theme-option ${selected === preset.id ? "selected" : ""}" type="button" data-theme-preset-option="${preset.id}" aria-pressed="${selected === preset.id}"><span class="theme-preview" style="--theme-preview-a:${preset.colors[0]};--theme-preview-b:${preset.colors[1]}"><i></i><i></i><i></i></span><strong>${translateUiText(preset.label)}</strong><small>${translateUiText(preset.description)}</small><span class="theme-check" aria-hidden="true">✓</span></button>`,
    ).join("");

    const styleSelected = currentVisualStyle();
    const styleOptions = [
      { id: "modern", label: "Modern", description: "Smooth rounded cards, elegant shadows, and clean typography" },
      { id: "pixel", label: "Pixel", description: "8-bit / 16-bit pixel-art UI with stepped borders and crisp edges" },
    ].map(
      (style) =>
        `<button class="theme-option ${styleSelected === style.id ? "selected" : ""}" type="button" data-visual-style-option="${style.id}" aria-pressed="${styleSelected === style.id}"><span class="theme-preview" style="--theme-preview-a:var(--color-surface);--theme-preview-b:var(--color-primary)"><i></i><i></i><i></i></span><strong>${translateUiText(style.label)}</strong><small>${translateUiText(style.description)}</small><span class="theme-check" aria-hidden="true">✓</span></button>`,
    ).join("");

    const intensityOptions = [
      { id: "low", label: "Low", description: "Subtle, minimal animations" },
      { id: "medium", label: "Medium", description: "Balanced, pleasant motion" },
      { id: "high", label: "High", description: "Expressive, lively transitions" },
    ].map(
      (intensity) =>
        `<button class="theme-option ${animationIntensity === intensity.id ? "selected" : ""}" type="button" data-animation-intensity="${intensity.id}" aria-pressed="${animationIntensity === intensity.id}"><span class="theme-preview" style="--theme-preview-a:var(--color-surface);--theme-preview-b:var(--color-primary)"><i></i><i></i><i></i></span><strong>${translateUiText(intensity.label)}</strong><small>${translateUiText(intensity.description)}</small><span class="theme-check" aria-hidden="true">✓</span></button>`,
    ).join("");

    const speedOptions = [
      { id: "slow", label: "Slow", description: "Gentle, calm movement" },
      { id: "normal", label: "Normal", description: "Standard pace" },
      { id: "fast", label: "Fast", description: "Quick, snappy responses" },
    ].map(
      (speed) =>
        `<button class="theme-option ${animationSpeed === speed.id ? "selected" : ""}" type="button" data-animation-speed="${speed.id}" aria-pressed="${animationSpeed === speed.id}"><span class="theme-preview" style="--theme-preview-a:var(--color-surface);--theme-preview-b:var(--color-primary)"><i></i><i></i><i></i></span><strong>${translateUiText(speed.label)}</strong><small>${translateUiText(speed.description)}</small><span class="theme-check" aria-hidden="true">✓</span></button>`,
    ).join("");

    const animationEffectOptions = [
      { id: "pageTransitions", label: "Page Transitions", description: "Smooth transitions between pages" },
      { id: "cardAnimations", label: "Card Animations", description: "Entrance and exit effects for cards" },
      { id: "buttonInteractions", label: "Button Interactions", description: "Press and hover effects on buttons" },
      { id: "hoverPressEffects", label: "Hover / Press Effects", description: "Visual feedback on interactive elements" },
      { id: "taskCompletion", label: "Task Completion", description: "Celebration when completing tasks" },
      { id: "progressAnimations", label: "Progress Animations", description: "Animated progress bars and fill effects" },
      { id: "xpGain", label: "XP Gain", description: "Experience point gain animations" },
      { id: "achievementUnlock", label: "Achievement Unlock", description: "Badge unlock celebrations" },
      { id: "levelUp", label: "Level Up", description: "Level up celebrations and effects" },
      { id: "notifications", label: "Notifications", description: "Toast and notification animations" },
      { id: "focusTimer", label: "Focus Timer", description: "Timer pulse and completion effects" },
      { id: "pixelEffects", label: "Pixel Effects", description: "Pixel-specific visual effects (Pixel style only)" },
    ];

    const renderEffectSwitch = (effect) => {
      const isEnabled = animationEffects[effect.id] !== false;
      const isPixelOnly = effect.id === "pixelEffects";
      const visible = isPixelOnly ? (currentVisualStyle() === "pixel" ? "" : "hidden") : "";
      return `<div class="setting-row ${visible}" data-effect="${effect.id}">
        <div class="setting-label">
          <strong>${translateUiText(effect.label)}</strong><small>${translateUiText(effect.description)}</small>
        </div>
        <label class="focus-setting-toggle"><span>${translateUiText("Enabled")}</span><input type="checkbox" name="animation-effect" data-effect="${effect.id}" ${isEnabled ? "checked" : ""}><i aria-hidden="true"></i></label>
      </div>`;
    };

    const effectSwitches = animationEffectOptions.map(renderEffectSwitch).join("");

    const toggleChecked = animationEnabled ? "checked" : "";
    const reducedChecked = reducedMotion ? "checked" : "";

    return `<section class="panel">${panelHeading(translateUiText("Themes"), translateUiText("Themes keep the same layout and only change the color palette."))}<div class="theme-grid" role="group" aria-label="${translateUiText("Choose a color theme")}">${options}</div></section><section class="panel">${panelHeading(translateUiText("Visual Style"), translateUiText("Choose how Study Zone looks. Modern is smooth and clean; Pixel is inspired by retro video games."))}<div class="theme-grid" role="group" aria-label="${translateUiText("Choose a visual style")}">${styleOptions}</div></section><section class="panel">${panelHeading(translateUiText("Animation Settings"), translateUiText("Control how Study Zone moves. Respects your system's reduced motion preference."))}<div class="animation-section"><div class="setting-row"><div><strong>${translateUiText("Enable Animations")}</strong><small>${translateUiText("Turn all motion effects on or off")}</small></div><label class="focus-setting-toggle"><span>${translateUiText("Animations On")}</span><input type="checkbox" name="animation-enabled" ${toggleChecked}><i aria-hidden="true"></i></label></div><div class="setting-row"><div><strong>${translateUiText("Animation Intensity")}</strong><small>${translateUiText("How strong the motion effects are")}</small></div><div role="group" aria-label="${translateUiText("Animation intensity")}">${intensityOptions}</div></div><div class="setting-row"><div><strong>${translateUiText("Animation Speed")}</strong><small>${translateUiText("How quickly animations play")}</small></div><div role="group" aria-label="${translateUiText("Animation speed")}">${speedOptions}</div></div><div class="setting-row"><div><strong>${translateUiText("Reduced Motion")}</strong><small>${translateUiText("Minimize motion for accessibility")}</small></div><label class="focus-setting-toggle"><span>${translateUiText("Reduce Motion")}</span><input type="checkbox" name="reduced-motion" ${reducedChecked}><i aria-hidden="true"></i></label></div><div class="setting-row"><div><strong>${translateUiText("Individual Effects")}</strong><small>${translateUiText("Enable or disable specific animation categories")}</small></div><div class="effect-switches">${effectSwitches}</div></div></div></section>`;
  }

  const notificationTypesKey = "studyzone.notification.types";
  const defaultNotificationTypes = {
    tasks: true,
    deadlines: true,
    exams: true,
    sessions: true,
    pomodoro: true,
    goals: true,
    team: true,
    challenges: true,
    achievements: true,
    focus_notifications: true,
    break_notifications: true,
    daily_study_reminders: true,
  };

  const defaultAllDayReminderTime = "09:00";
  let allDayReminderTime = defaultAllDayReminderTime;
  try {
    const stored = localStorage.getItem("studyzone.allday-reminder-time");
    if (stored && /^\d{2}:\d{2}$/.test(stored)) allDayReminderTime = stored;
  } catch {
    /* use default */
  }

  function notificationTypes() {
    try {
      const saved = JSON.parse(
        localStorage.getItem(notificationTypesKey) || "null",
      );
      return { ...defaultNotificationTypes, ...(saved || {}) };
    } catch {
      return { ...defaultNotificationTypes };
    }
  }

  function saveNotificationTypes(next) {
    const value = { ...notificationTypes(), ...next };
    localStorage.setItem(notificationTypesKey, JSON.stringify(value));
    window.dispatchEvent(
      new CustomEvent("studyzone:notification-types", { detail: value }),
    );
    if (supabase && session) {
      void supabase
        .from("profiles")
        .update({ notification_settings: value })
        .eq("id", session.user.id)
        .then(({ error }) => {
          if (error && !isMissingColumnError(error))
            console.warn("Could not sync notification settings.", error);
        });
    }
    return value;
  }

  function notificationSettingsPanel() {
    const types = notificationTypes();
    const rows = [
      ["tasks", "Task reminders"],
      ["deadlines", "Deadline reminders"],
      ["exams", "Exam reminders"],
      ["sessions", "Study session reminders"],
      ["pomodoro", "Pomodoro start and end"],
      ["focus_notifications", "Focus notifications"],
      ["break_notifications", "Break notifications"],
      ["goals", "Daily goals"],
      ["team", "Team activity"],
      ["challenges", "Challenge updates"],
      ["achievements", "Achievement alerts"],
      ["daily_study_reminders", "Daily study reminders"],
    ]
      .map(
        ([key, label]) =>
          `<label class="notification-type"><span>${translateUiText(label)}</span><input type="checkbox" data-notification-type="${key}" ${types[key] ? "checked" : ""}></label>`,
      )
      .join("");
    const native = Boolean(window.StudyZoneNotifications?.isNative);
    const dndActive = isDoNotDisturbActive();
    return `<section class="panel">${panelHeading(translateUiText("Notification settings"), translateUiText("Control which notifications you receive and how they are delivered."))}<div class="notification-type-grid">${rows}</div><div class="setting-row"><div><strong>${translateUiText("Notification sound")}</strong><small>${translateUiText(dndActive ? "Sound muted (do not disturb active)" : "Sound enabled for notifications")}</small></div><button class="button button-secondary button-small" type="button" data-action="notification-sound-preview">${translateUiText("Preview sound")}</button><button class="button button-primary button-small" type="button" data-action="test-notification">${translateUiText("Test Notification Sound")}</button></div><div class="setting-row"><div><strong>${translateUiText("Vibration")}</strong><small>${translateUiText("Vibrate on notifications")}</small></div><label class="focus-setting-toggle"><span>${translateUiText("Enable vibration")}</span><input type="checkbox" name="vibration_enabled" ${notificationPrefs.vibration_enabled !== false ? "checked" : ""}><i aria-hidden="true"></i></label></div><div class="setting-row"><div><strong>${translateUiText("Default task reminder")}</strong><small>${translateUiText("Default reminder for new tasks")}</small></div><select name="default_task_reminder" class="filter-select"><option value="0">${translateUiText("No reminder")}</option><option value="-1">${translateUiText("At task start")}</option><option value="15">${translateUiText("15 minutes before")}</option><option value="30">${translateUiText("30 minutes before")}</option><option value="60">${translateUiText("1 hour before")}</option></select></div><div class="setting-row"><div><strong>${translateUiText("Default all-day reminder time")}</strong><small>${translateUiText("Time to remind for all-day tasks")}</small></div><input type="time" name="allday_reminder_time" value="${escapeHtml(allDayReminderTime)}" /></div><div class="setting-row"><div><strong>${translateUiText("Quiet hours")}</strong><small>${translateUiText("Suppress notifications during these hours")}</small></div><div class="form-row"><label>${translateUiText("From")}<input type="time" name="dnd_start" value="${escapeHtml(notificationPrefs.start)}" /></label><label>${translateUiText("To")}<input type="time" name="dnd_end" value="${escapeHtml(notificationPrefs.end)}" /></label></div></div><div class="setting-row"><div><strong>${translateUiText("Enable notifications")}</strong><small>${translateUiText(native ? "Native notifications" : "Notifications are not available on this device.")}</small></div><button class="button button-secondary button-small" type="button" data-action="native-notification-permission">${translateUiText("Enable notifications")}</button></div><p class="data-caption" data-notification-status role="status"></p></section>`;
  }

  function syncSettingsPanel() {
    const offline = window.StudyZoneOffline;
    const snapshot = offline?.state || {
      status: navigator.onLine ? "synced" : "offline",
      pending: 0,
      failed: 0,
      conflicts: 0,
      lastSyncAt: 0,
    };
    const lastSync = snapshot.lastSyncAt
      ? new Intl.DateTimeFormat(appLanguage === "ar" ? "ar-EG" : "en", {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(new Date(snapshot.lastSyncAt))
      : translateUiText("Never");
    return `<section class="panel" data-sync-settings>${panelHeading(translateUiText("Offline & sync"), translateUiText("Changes are saved on this device and sent automatically when you reconnect."))}<div class="sync-summary"><div class="sync-summary-row"><span>${translateUiText("Status")}</span><strong data-sync-status>${translateUiText(snapshot.status === "synced" ? "Synced" : snapshot.status === "offline" ? "Offline" : snapshot.status === "syncing" ? "Syncing" : snapshot.status === "failed" ? "Sync failed" : "Pending sync")}</strong></div><div class="sync-summary-row"><span>${translateUiText("Queued changes")}</span><strong data-sync-pending>${snapshot.pending}</strong></div><div class="sync-summary-row"><span>${translateUiText("Failed changes")}</span><strong data-sync-failed>${snapshot.failed}</strong></div><div class="sync-summary-row"><span>${translateUiText("Conflicts")}</span><strong data-sync-conflicts>${snapshot.conflicts}</strong></div><div class="sync-summary-row"><span>${translateUiText("Last sync")}</span><strong data-sync-last>${escapeHtml(lastSync)}</strong></div></div><div class="sync-conflicts" data-sync-conflict-list></div><button class="button button-primary button-small" type="button" data-action="sync-now">${translateUiText("Sync now")}</button><p class="data-caption">${translateUiText("Your account data stays private.")} ${translateUiText("All data is protected by Supabase row-level security.")}</p></section>`;
  }

  function settingsPage() {
    const motionOptions = [
      ["full", "Full Motion", "Layered transitions and celebrations"],
      ["reduced", "Reduced Motion", "Short, gentle transitions"],
      ["off", "Motion Off", "Disable nonessential animation"],
    ]
      .map(
        ([level, title, description]) =>
          `<button class="motion-option ${motionLevel === level ? "selected" : ""}" type="button" data-motion-level="${level}" aria-pressed="${motionLevel === level}"><strong>${title}</strong><small>${description}</small></button>`,
      )
      .join("");
    const reminderForm = session
      ? `<form id="daily-reminder-form" class="form-stack daily-reminder-form"><label class="focus-setting-toggle"><span>${translateUiText("Enable push reminders")}</span><input type="checkbox" name="enabled" ${dailyReminderPreference.enabled ? "checked" : ""}><i aria-hidden="true"></i></label><p class="data-caption">${translateUiText("Get a daily task check-in plus deadline and achievement notifications, even when Study Zone is closed.")}</p><label>${translateUiText("Reminder time")}<input type="time" name="local_time" value="${escapeHtml(String(dailyReminderPreference.local_time || "09:00").slice(0, 5))}" required></label><small>${translateUiText("Uses this device’s timezone.")}</small><button class="button button-primary button-small" type="submit">${translateUiText("Save reminder")}</button><p class="data-caption">${translateUiText("Push reminders need notification permission and the server setup described in README.md.")}</p><p class="form-error" data-reminder-error role="alert"></p></form>`
      : `<p class="data-caption">${translateUiText("Sign in to configure daily reminders.")}</p>`;
    return `${pageHeading("MAKE IT YOURS", "Settings", "Tune Study Zone to the way you like to work.", "")}<div class="grid settings-grid"><section class="panel">${panelHeading("Appearance")}<div class="setting-row"><div><strong>Dark theme</strong><small>Designed for focus, day or night</small></div><button class="toggle on" data-action="theme-toggle" aria-label="Toggle light theme" aria-pressed="false"></button></div><div class="setting-row"><div><strong>Emerald accents</strong><small>Official Study Zone color palette</small></div><span class="subject-color"></span></div><div class="setting-row"><div><strong>Motion & celebrations</strong><small>Choose how much motion Study Zone uses.</small></div></div><div class="motion-options" role="group" aria-label="Animation level">${motionOptions}</div></section>${themeSettingsPanel()}<section class="panel">${panelHeading("Language")}<div class="setting-row"><div><strong>Display language</strong><small>Deadlines appear in the selected language.</small></div></div><div class="language-switcher" role="group" aria-label="Choose language"><span class="language-indicator ${appLanguage === "ar" ? "arabic" : ""}"></span><button class="language-option ${appLanguage === "ar" ? "selected" : ""}" data-language="ar" aria-pressed="${appLanguage === "ar"}">عربي <span>العربية</span></button><button class="language-option ${appLanguage === "en" ? "selected" : ""}" data-language="en" aria-pressed="${appLanguage === "en"}">EN <span>English</span></button></div></section><section class="panel">${panelHeading("Reminders")}<div class="setting-row"><div><strong>Daily study check-in</strong><small>Review your open tasks once a day, even when Study Zone is closed.</small></div></div>${reminderForm}</section>${notificationSettingsPanel()}${notificationPreferencesPanel()}${syncSettingsPanel()}<section class="panel">${panelHeading("Data & privacy")}<div class="setting-row"><div><strong>Account data</strong><small>Stored in your private Supabase account when configured</small></div></div><div class="setting-row"><div><strong>Service keys</strong><small>Only the public anon key belongs in this browser config.</small></div></div></section><section class="panel">${panelHeading("Backup & restore", "Your data, portable")}<p class="panel-copy">Download a private JSON copy of your tasks, routines, notes, journal, focus history, and preferences. Restoring merges new items and skips duplicates.</p><div class="setting-row"><div><strong>Export a backup</strong><small>Nothing leaves this device except the file you download.</small></div><button class="button button-secondary button-small" data-action="backup-export">Download</button></div><div class="setting-row"><div><strong>Restore from a backup</strong><small>Validated first, then merged without overwriting existing records.</small></div><button class="button button-secondary button-small" data-action="backup-import">Choose file</button></div><input id="backup-import-input" type="file" accept="application/json,.json" hidden /><p class="data-caption">Only restore files you exported from Study Zone. Never share a backup publicly.</p></section></div>`;
  }

  function formatAdminDate(value) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return new Intl.DateTimeFormat(appLanguage === "ar" ? "ar-EG" : "en", {
      dateStyle: "medium",
    }).format(date);
  }

  async function loadAdminUsers() {
    const userId = session?.user?.id;
    if (
      !supabase ||
      !userId ||
      adminAuthorization.status !== "authorized" ||
      adminAuthorization.userId !== userId
    )
      return;
    const requestId = ++adminUsersRequest;
    adminUsersLoading = true;
    adminUsersError = "";
    render();
    const { data, error } = await supabase.rpc("admin_list_users", {
      p_search: adminUsersSearch,
      p_limit: adminUsersPageSize,
      p_offset: adminUsersPage * adminUsersPageSize,
    });
    if (requestId !== adminUsersRequest || session?.user?.id !== userId) return;
    adminUsersLoading = false;
    if (error) {
      console.error("Could not load the protected admin user list.", error);
      adminUsersError = error.message;
      adminUsers = [];
      render();
      return;
    }
    adminUsers = data || [];
    adminUsersTotal = Number(adminUsers[0]?.total_count || 0);
    render();
  }

  function adminPage() {
    if (
      !session ||
      adminAuthorization.status !== "authorized" ||
      adminAuthorization.userId !== session.user.id
    ) {
      return adminAccessPage();
    }
    const users = adminUsers
      .map(
        (user) =>
          `<tr><td><strong>${escapeHtml(user.display_name || "Student")}</strong><small>${escapeHtml(user.email || "—")}</small></td><td>${escapeHtml(translateUiText(user.role || "student"))}</td><td>${escapeHtml(formatAdminDate(user.created_at))}</td><td>${escapeHtml(formatAdminDate(user.last_sign_in_at))}</td><td><span class="admin-user-status ${user.email_confirmed_at ? "confirmed" : "unconfirmed"}">${user.email_confirmed_at ? translateUiText("Confirmed") : translateUiText("Pending confirmation")}</span></td></tr>`,
      )
      .join("");
    const from = adminUsersTotal ? adminUsersPage * adminUsersPageSize + 1 : 0;
    const to = Math.min(
      (adminUsersPage + 1) * adminUsersPageSize,
      adminUsersTotal,
    );
    const content = adminUsersLoading
      ? `<div class="empty-state" role="status">${translateUiText("Loading users…")}</div>`
      : adminUsersError
        ? `<div class="admin-error" role="alert">${translateUiText("Could not load users.")} ${escapeHtml(adminUsersError)}</div>`
        : users
          ? `<div class="admin-users-scroll"><table class="admin-users-table"><thead><tr><th>${translateUiText("User")}</th><th>${translateUiText("Role")}</th><th>${translateUiText("Joined")}</th><th>${translateUiText("Last sign-in")}</th><th>${translateUiText("Email status")}</th></tr></thead><tbody>${users}</tbody></table></div>`
          : `<div class="empty-state">${translateUiText("No users found.")}</div>`;
    return `${pageHeading("ADMINISTRATION", "Admin dashboard", "Review registered accounts and their sign-in status.", "")}<div class="admin-warning">${translateUiText("Administrator access verified.")} ${translateUiText("This private list is visible only to authorized administrators.")}</div><section class="panel">${panelHeading("Registered users", `${new Intl.NumberFormat(appLanguage === "ar" ? "ar-EG" : "en").format(adminUsersTotal)} total`)}<form class="admin-user-search" id="admin-users-search"><label class="search-box"><span>⌕</span><input name="search" type="search" value="${escapeHtml(adminUsersSearch)}" placeholder="${translateUiText("Search by name or email")}" aria-label="${translateUiText("Search by name or email")}"></label><button class="button button-secondary button-small" type="submit">${translateUiText("Search")}</button><button class="button button-secondary button-small" type="button" data-action="admin-users-refresh">${translateUiText("Refresh")}</button></form>${content}<div class="admin-pagination"><span>${from}–${to} ${translateUiText("of")} ${adminUsersTotal}</span><div><button class="button button-secondary button-small" type="button" data-action="admin-users-prev" ${adminUsersPage === 0 || adminUsersLoading ? "disabled" : ""}>${translateUiText("Previous")}</button><button class="button button-secondary button-small" type="button" data-action="admin-users-next" ${to >= adminUsersTotal || adminUsersLoading ? "disabled" : ""}>${translateUiText("Next")}</button></div></div></section>`;
  }

  function adminAccessPage() {
    const message =
      adminAuthorization.status === "checking" ||
      adminAuthorization.status === "unknown"
        ? "Checking administrator access…"
        : adminAuthorization.status === "error"
          ? "Could not verify administrator access."
          : "Administrator access denied.";
    return `${pageHeading("ADMINISTRATION", "Admin dashboard", "Protected operational metrics and account administration.", "")}<section class="panel" role="status" aria-live="polite"><p class="panel-copy">${translateUiText(message)}</p></section>`;
  }

  // ---- Quick capture -------------------------------------------------------

  function openQuickCapture(type = "task") {
    const form = document.getElementById("quick-capture-form");
    form.reset();
    quickCaptureType = type;
    form.elements.capture_type.value = type;
    form.elements.capture_date.value = dateKey(new Date());
    document.getElementById("quick-capture-error").textContent = "";
    openModal(document.getElementById("quick-capture-modal"));
    form.elements.title.focus();
  }

  async function saveQuickCapture(formData) {
    const type = String(formData.get("capture_type") || "task");
    const title = String(formData.get("title") || "").trim();
    if (!title) throw new Error("Add a short title first.");
    const details = String(formData.get("details") || "").trim();
    const dateValue = String(formData.get("capture_date") || "");
    if (type === "note" || type === "idea") {
      const noteTitle = type === "idea" ? `Idea · ${title}` : title;
      const content = sanitizeRichText(
        `<p>${escapeHtml(details || title)}</p>`,
      );
      if (supabase && session) {
        const { data, error } = await supabase
          .from("notes")
          .insert({ title: noteTitle, content, subject_id: null, is_favorite: false })
          .select("id,title,content,subject_id,is_favorite,created_at,updated_at")
          .single();
        if (error) throw error;
        notes.unshift({ ...data, subject: "", updated: new Date().toISOString() });
      } else {
        const now = new Date().toISOString();
        notes.unshift({
          id: `local-note-${Date.now()}`,
          title: noteTitle,
          content,
          subject_id: null,
          subject: "",
          is_favorite: false,
          created_at: now,
          updated_at: now,
        });
        saveLocalNotes();
      }
    } else {
      const due = dateValue ? `${dateValue}T23:59` : null;
      const payload = {
        title,
        description: details,
        subject_id: null,
        priority: type === "reminder" ? "high" : "medium",
        status: "not_started",
        estimated_minutes: 30,
        reminder_before_minutes: type === "reminder" ? 15 : 0,
        is_all_day: true,
        starts_at: null,
        due_at: due ? new Date(due).toISOString() : null,
        completed_at: null,
      };
      if (supabase && session) {
        let result = await supabase
          .from("tasks")
          .insert(payload)
          .select("*")
          .single();
        if (result.error && isMissingColumnError(result.error)) {
          const { is_all_day: _ignored, ...rest } = payload;
          result = await supabase.from("tasks").insert(rest).select("*").single();
        }
        if (result.error) throw result.error;
        tasks.unshift({
          ...result.data,
          subject: subjectName(result.data.subject_id),
          recurrence_group_id: null,
          recurrence_type: "none",
          recurrence_days: [],
          recurrence_until: null,
        });
      } else {
        tasks.unshift({
          ...payload,
          id: `local-${Date.now()}`,
          subject: "",
          created_at: new Date().toISOString(),
          recurrence_group_id: null,
          recurrence_type: "none",
          recurrence_days: [],
          recurrence_until: null,
        });
        saveLocalTasks();
      }
    }
    closeModal(document.getElementById("quick-capture-modal"));
    render();
    showToast(
      type === "note" || type === "idea"
        ? appLanguage === "ar"
          ? "تم حفظ الملاحظة."
          : "Note saved."
        : appLanguage === "ar"
          ? "تم حفظ المهمة."
          : "Task saved.",
    );
  }

  // ---- Global search -------------------------------------------------------

  function openGlobalSearch() {
    globalSearchQuery = "";
    const input = document.getElementById("global-search-input");
    input.value = "";
    document.getElementById("global-search-results").innerHTML =
      `<p class="data-caption">Type to search tasks, routines, notes, subjects, files, and deadlines.</p>`;
    openModal(document.getElementById("global-search-modal"));
    input.focus();
  }

  function globalSearchMarkup(rawQuery) {
    const query = String(rawQuery || "").trim().toLowerCase();
    if (!query)
      return `<p class="data-caption">Type to search tasks, routines, notes, subjects, files, and deadlines.</p>`;
    const match = (...values) =>
      values.some((value) => String(value || "").toLowerCase().includes(query));
    const taskHits = tasks
      .filter((task) =>
        match(task.title, task.description, task.subject, subjectName(task.subject_id)),
      )
      .slice(0, 5);
    const routineHits = routines
      .filter((routine) =>
        match(routine.title, routine.description, subjectName(routine.subject_id)),
      )
      .slice(0, 5);
    const noteHits = notes
      .filter((note) => match(note.title, notePlainText(note)))
      .slice(0, 5);
    const subjectHits = subjects
      .filter((subject) => match(subject.name))
      .slice(0, 4);
    const fileHits = sampleFiles
      .filter((file) => match(file.name, file.original_name, file.subject))
      .slice(0, 4);
    const deadlineHits = tasks
      .filter((task) => task.due_at && match(task.title, task.subject))
      .slice(0, 4);
    const row = (action, id, title, meta, icon) =>
      `<button class="search-result" data-action="${action}" data-id="${escapeHtml(id)}"><span class="search-result-icon">${icon}</span><span><strong dir="auto">${escapeHtml(title)}</strong><small dir="auto">${escapeHtml(meta)}</small></span></button>`;
    const group = (label, rows) =>
      rows
        ? `<div class="search-group"><p class="eyebrow">${escapeHtml(label)}</p>${rows}</div>`
        : "";
    const html = [
      group(
        "Tasks",
        taskHits
          .map((task) =>
            row(
              "search-open-task",
              task.id,
              task.title,
              `${task.subject || subjectName(task.subject_id)} · ${taskDueLabel(task, { includeDate: true })}`,
              "✓",
            ),
          )
          .join(""),
      ),
      group(
        "Routines",
        routineHits
          .map((routine) =>
            row(
              "search-open-routine",
              routine.id,
              routine.title,
              `${routine.routine_type === "daily" ? "Every day" : routine.routine_type === "weekdays" ? "Selected weekdays" : `Every ${routine.interval_days} days`} · ${routine.paused ? "Paused" : "Active"}`,
              "↻",
            ),
          )
          .join(""),
      ),
      group(
        "Notes",
        noteHits
          .map((note) =>
            row("search-open-note", note.id, note.title || "Untitled note", notePlainText(note).slice(0, 80), "✎"),
          )
          .join(""),
      ),
      group(
        "Subjects",
        subjectHits
          .map((subject) => row("navigate-search", "subjects", subject.name, "Open subjects", "◈"))
          .join(""),
      ),
      group(
        "Files",
        fileHits
          .map((file) => row("navigate-search", "files", file.name || file.original_name || "Study file", "Open study files", "▤"))
          .join(""),
      ),
      group(
        "Deadlines",
        deadlineHits
          .map((task) => row("search-open-task", task.id, task.title, taskDueLabel(task, { includeDate: true }), "◷"))
          .join(""),
      ),
    ].join("");
    return html || `<div class="empty-state"><strong>No matches</strong>Try a shorter word or another subject.</div>`;
  }

  // ---- Focus preparation, distractions, and soundscape ---------------------

  function openFocusPrep() {
    const subjectSelect = document.getElementById("focus-prep-subject");
    const taskSelect = document.getElementById("focus-prep-task");
    subjectSelect.innerHTML = `<option value="">${focusText[appLanguage].chooseSubject}</option>${subjects
      .map((subject) => `<option value="${escapeHtml(subject.id)}" ${String(subject.id) === String(focusSession.subjectId) ? "selected" : ""}>${escapeHtml(subject.name)}</option>`)
      .join("")}`;
    taskSelect.innerHTML = `<option value="">${focusText[appLanguage].noTask}</option>${tasksForDay(dateKey(new Date()))
      .filter((task) => task.status !== "completed")
      .map((task) => `<option value="${escapeHtml(task.routine_id || task.id)}" ${String(task.routine_id || task.id) === String(focusSession.taskId) ? "selected" : ""}>${escapeHtml(task.title)}</option>`)
      .join("")}`;
    const form = document.getElementById("focus-prep-form");
    form.elements.goal.value = focusSession.goal || "";
    form.elements.tools.value = focusSession.tools || "";
    form.elements.minutes.value = String(
      focusSession.durationMinutes || focusSettings.focusMinutes || 25,
    );
    openModal(document.getElementById("focus-prep-modal"));
    form.elements.goal.focus();
  }

  function prepareFocusSession(formData) {
    if (focusSession.status !== "idle" || focusSession.startedAt) {
      focusSession.id = focusId();
      focusSession.startedAt = null;
      focusSession.remoteStarted = false;
    }
    focusSession.id = focusSession.id || focusId();
    focusSession.subjectId = String(formData.get("subject_id") || "");
    focusSession.taskId = String(formData.get("task_id") || "");
    focusSession.goal = String(formData.get("goal") || "").trim();
    focusSession.tools = String(formData.get("tools") || "").trim();
    const minutes = Number(formData.get("minutes"));
    if (Number.isInteger(minutes) && minutes >= 1 && minutes <= 180) {
      focusSession.durationMinutes = minutes;
      focusSession.remainingMs = minutes * 60000;
      focusSession.elapsedBeforeRunMs = 0;
      focusSession.endAt = null;
      focusSession.runStartedAt = null;
      focusSession.status = "idle";
    }
    closeModal(document.getElementById("focus-prep-modal"));
    persistFocusState();
    void startFocusTimer();
  }

  function openDistractionModal() {
    if (focusSession.type !== "focus" || focusSession.status !== "running") {
      showToast(
        appLanguage === "ar"
          ? "سجّل التشتت أثناء جلسة تركيز نشطة."
          : "Log distractions while a focus session is running.",
      );
      return;
    }
    const form = document.getElementById("distraction-form");
    form.reset();
    document.getElementById("distraction-error").textContent = "";
    openModal(document.getElementById("distraction-modal"));
    form.elements.reason.focus();
  }

  async function logDistraction(formData) {
    const custom = String(formData.get("custom_reason") || "").trim();
    const reason = (custom || String(formData.get("reason") || "other")).slice(0, 120);
    const routineId = String(focusSession.taskId || "").startsWith("routine:")
      ? String(focusSession.taskId).split(":")[1] || null
      : null;
    const record = {
      session_id: focusSession.id,
      task_id: routineId ? null : focusSession.taskId || null,
      routine_id: routineId,
      reason,
      created_at: new Date().toISOString(),
    };
    if (supabase && session && distractionsSupported) {
      const { data, error } = await supabase
        .from("focus_distractions")
        .insert({ ...record, user_id: session.user.id })
        .select("id,session_id,task_id,routine_id,reason,created_at")
        .single();
      if (error) {
        if (isMissingRelation(error)) {
          distractionsSupported = false;
          focusDistractions.unshift({ ...record, id: focusId() });
          saveLocalDistractions();
        } else {
          throw error;
        }
      } else {
        focusDistractions.unshift(data);
      }
    } else {
      focusDistractions.unshift({ ...record, id: focusId() });
      saveLocalDistractions();
    }
    closeModal(document.getElementById("distraction-modal"));
    render();
    showToast(
      appLanguage === "ar"
        ? "تم تسجيل التشتت. خذ نفسًا وارجع للتركيز."
        : "Distraction logged. Take a breath and return to focus.",
    );
  }

  function distractionSummary() {
    const todayKey = dateKey(new Date());
    const weekStart = startOfWeekKey(new Date());
    const today = focusDistractions.filter(
      (item) => dateKey(new Date(item.created_at)) === todayKey,
    );
    const week = focusDistractions.filter(
      (item) => dateKey(new Date(item.created_at)) >= weekStart,
    );
    const counts = new Map();
    week.forEach((item) => {
      const reason = String(item.reason || "Other");
      counts.set(reason, (counts.get(reason) || 0) + 1);
    });
    const topReason =
      [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "—";
    return { today: today.length, week: week.length, topReason };
  }

  function updateFocusSoundVolume(value) {
    focusSoundVolume = Math.max(0, Math.min(100, Number(value) || 0));
    writeLocalJson(focusSoundPrefsKey, {
      id: focusSoundId,
      volume: focusSoundVolume,
    });
    if (focusSoundEngine?.gain) {
      focusSoundEngine.gain.gain.setTargetAtTime(
        (focusSoundVolume / 100) * 0.35,
        focusSoundEngine.ctx.currentTime,
        0.08,
      );
    }
    const label = document.getElementById("focus-sound-volume-value");
    if (label) label.textContent = `${focusSoundVolume}%`;
  }

  function stopFocusSound() {
    if (!focusSoundEngine) return;
    try {
      focusSoundEngine.source?.stop();
      void focusSoundEngine.ctx?.close();
    } catch (error) {
      console.warn("Could not stop the focus soundscape.", error);
    }
    focusSoundEngine = null;
    document.querySelectorAll("[data-sound]").forEach((button) => {
      button.classList.toggle("selected", button.dataset.sound === "off");
    });
  }

  function buildNoiseBuffer(ctx, kind) {
    const length = Math.max(ctx.sampleRate * 2, 4096);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    if (kind === "brown" || kind === "fireplace" || kind === "forest") {
      let last = 0;
      for (let index = 0; index < length; index += 1) {
        const white = Math.random() * 2 - 1;
        last = (last + 0.02 * white) / 1.02;
        data[index] = last * 3.4;
      }
    } else {
      for (let index = 0; index < length; index += 1) {
        data[index] = Math.random() * 2 - 1;
      }
    }
    return buffer;
  }

  function startFocusSound(id) {
    stopFocusSound();
    focusSoundId = id === "off" ? "off" : id;
    writeLocalJson(focusSoundPrefsKey, {
      id: focusSoundId,
      volume: focusSoundVolume,
    });
    if (id === "off") {
      render();
      return;
    }
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      showToast("This browser cannot play focus sounds.");
      return;
    }
    const ctx = new AudioContextClass();
    const source = ctx.createBufferSource();
    source.buffer = buildNoiseBuffer(ctx, id);
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    if (id === "rain") {
      filter.type = "highpass";
      filter.frequency.value = 900;
    } else if (id === "brown") {
      filter.type = "lowpass";
      filter.frequency.value = 420;
    } else if (id === "forest") {
      filter.type = "bandpass";
      filter.frequency.value = 620;
      filter.Q.value = 0.7;
    } else if (id === "fireplace") {
      filter.type = "lowpass";
      filter.frequency.value = 760;
    } else {
      filter.type = "allpass";
    }
    const gain = ctx.createGain();
    gain.gain.value = (focusSoundVolume / 100) * 0.35;
    source.connect(filter).connect(gain).connect(ctx.destination);
    source.start();
    focusSoundEngine = { ctx, source, gain, filter };
    void ctx.resume();
    render();
  }

  function focusSoundPanel() {
    const sounds = [
      ["off", "Off"],
      ["rain", "Rain"],
      ["white", "White noise"],
      ["brown", "Brown noise"],
      ["forest", "Forest"],
      ["fireplace", "Fireplace"],
    ];
    return `<section class="panel focus-sound-panel">
      ${panelHeading(
        appLanguage === "ar" ? "أصوات التركيز" : "Focus sounds",
        appLanguage === "ar" ? "ضوضاء هادئة تساعدك على البقاء" : "Calm noise to stay with the task",
      )}
      <div class="focus-sound-options">${sounds
        .map(
          ([id, label]) =>
            `<button class="focus-sound-chip ${focusSoundId === id ? "selected" : ""}" data-action="focus-sound" data-sound="${id}" aria-pressed="${focusSoundId === id}">${escapeHtml(label)}</button>`,
        )
        .join("")}</div>
      <label class="focus-sound-volume">${appLanguage === "ar" ? "مستوى الصوت" : "Volume"} <strong id="focus-sound-volume-value">${focusSoundVolume}%</strong>
        <input id="focus-sound-volume" type="range" min="0" max="100" step="5" value="${focusSoundVolume}" />
      </label>
      <p class="data-caption">${appLanguage === "ar" ? "أصوات مُولّدة داخل المتصفح — بدون ملفات خارجية." : "Synthesized in your browser — no external audio files."}</p>
    </section>`;
  }

  // ---- Study journal & weekly review --------------------------------------

  function startOfWeekKey(date) {
    const day = startOfLocalDay(date);
    const offset = (day.getDay() + 6) % 7;
    return dateKey(addLocalDays(day, -offset));
  }

  function journalEntryFor(key) {
    return journalEntries.find(
      (entry) => String(entry.entry_date).slice(0, 10) === key,
    );
  }

  function summarizeWeek(startKey) {
    const start = parseLocalDateKey(startKey);
    let completed = 0;
    let total = 0;
    let focusSeconds = 0;
    let sessions = 0;
    const subjectSeconds = new Map();
    const distractionCounts = new Map();
    for (let offset = 0; offset < 7; offset += 1) {
      const day = addLocalDays(start, offset);
      const key = dateKey(day);
      const dayTasks = tasksForDay(key);
      total += dayTasks.length;
      completed += dayTasks.filter((task) => task.status === "completed").length;
      focusRecords
        .filter(
          (record) =>
            record.completed &&
            record.session_type === "focus" &&
            dateKey(new Date(record.started_at)) === key,
        )
        .forEach((record) => {
          focusSeconds += Number(record.duration_seconds || 0);
          sessions += 1;
          if (record.subject_id) {
            subjectSeconds.set(
              record.subject_id,
              (subjectSeconds.get(record.subject_id) || 0) +
                Number(record.duration_seconds || 0),
            );
          }
        });
      focusDistractions
        .filter((item) => dateKey(new Date(item.created_at)) === key)
        .forEach((item) => {
          const reason = String(item.reason || "Other");
          distractionCounts.set(reason, (distractionCounts.get(reason) || 0) + 1);
        });
    }
    const topSubjectId = [...subjectSeconds.entries()].sort(
      (a, b) => b[1] - a[1],
    )[0]?.[0];
    const topDistraction =
      [...distractionCounts.entries()].sort((a, b) => b[1] - a[1])[0] || null;
    return {
      completed,
      total,
      rate: total ? Math.round((completed / total) * 100) : 0,
      focusSeconds,
      sessions,
      topSubject: topSubjectId ? subjectName(topSubjectId) : "—",
      distractions: [...distractionCounts.values()].reduce((sum, value) => sum + value, 0),
      topDistraction: topDistraction ? topDistraction[0] : "—",
    };
  }

  function weeklyReviewData() {
    const currentStart = startOfWeekKey(new Date());
    const previousStart = dateKey(
      addLocalDays(parseLocalDateKey(currentStart), -7),
    );
    const current = summarizeWeek(currentStart);
    const previous = summarizeWeek(previousStart);
    const difference = (value, oldValue) => {
      if (!oldValue) return value ? "+100%" : "0%";
      const change = Math.round(((value - oldValue) / oldValue) * 100);
      return `${change > 0 ? "+" : ""}${change}%`;
    };
    const suggestions = [];
    if (current.rate < 70)
      suggestions.push(
        appLanguage === "ar"
          ? "اختر مهمتين فقط لليوم التالي وابدأ بهما قبل أي شيء آخر."
          : "Choose just two tasks for tomorrow and start with them first.",
      );
    if (current.distractions >= 5)
      suggestions.push(
        appLanguage === "ar"
          ? "جرّب وضع الهاتف بعيدًا في أول 25 دقيقة من كل جلسة."
          : "Try leaving your phone out of reach for the first 25 minutes of each session.",
      );
    if (current.focusSeconds < previous.focusSeconds)
      suggestions.push(
        appLanguage === "ar"
          ? "جدول جلسة تركيز واحدة إضافية في أفضل وقت لديك."
          : "Schedule one extra focus session at your best time of day.",
      );
    if (!suggestions.length)
      suggestions.push(
        appLanguage === "ar"
          ? "حافظ على الإيقاع الحالي، وامنح نفسك يوم راحة بدون شعور بالذنب."
          : "Keep this rhythm and give yourself a rest day without guilt.",
      );
    return { current, previous, difference, suggestions };
  }

  function weeklyReviewPanel() {
    const { current, previous, difference, suggestions } = weeklyReviewData();
    return `<section class="panel weekly-review-panel">
      ${panelHeading(
        appLanguage === "ar" ? "المراجعة الأسبوعية" : "WEEKLY REVIEW",
        appLanguage === "ar" ? "هذا الأسبوع مقابل الأسبوع السابق" : "This week compared with last week",
      )}
      <div class="weekly-review-grid">
        <div><span>${appLanguage === "ar" ? "ساعات التركيز" : "Focus hours"}</span><strong>${(current.focusSeconds / 3600).toFixed(1)}h</strong><small>${difference(current.focusSeconds, previous.focusSeconds)}</small></div>
        <div><span>${appLanguage === "ar" ? "إنجاز المهام" : "Task completion"}</span><strong>${current.rate}%</strong><small>${current.completed}/${current.total}</small></div>
        <div><span>${appLanguage === "ar" ? "جلسات التركيز" : "Focus sessions"}</span><strong>${current.sessions}</strong><small>${difference(current.sessions, previous.sessions)}</small></div>
        <div><span>${appLanguage === "ar" ? "أكثر مادة" : "Top subject"}</span><strong dir="auto">${escapeHtml(current.topSubject)}</strong><small>${current.distractions} ${appLanguage === "ar" ? "تشتت" : "distractions"}</small></div>
      </div>
      <p class="weekly-review-distraction">${appLanguage === "ar" ? "أكثر سبب للتشتت" : "Most common distraction"}: <strong dir="auto">${escapeHtml(current.topDistraction)}</strong></p>
      <ul class="weekly-suggestions">${suggestions.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    </section>`;
  }

  function journalPage() {
    const selectedKey = journalDate;
    const entry = journalEntryFor(selectedKey) || {};
    const dayTasks = tasksForDay(selectedKey);
    const completed = dayTasks.filter((task) => task.status === "completed").length;
    const focusSeconds = focusRecords
      .filter(
        (record) =>
          record.completed &&
          record.session_type === "focus" &&
          dateKey(new Date(record.started_at)) === selectedKey,
      )
      .reduce((sum, record) => sum + Number(record.duration_seconds || 0), 0);
    const distractions = focusDistractions.filter(
      (item) => dateKey(new Date(item.created_at)) === selectedKey,
    ).length;
    const recent = journalEntries.slice(0, 8);
    return `${pageHeading(
      "REFLECT & ADJUST",
      appLanguage === "ar" ? "يوميات الدراسة" : "Study journal",
      appLanguage === "ar"
        ? "سجل قصير في نهاية اليوم. لا يجب أن يكون مثاليًا."
        : "A short note at the end of the day. It does not have to be perfect.",
      `<label class="journal-date-picker">${appLanguage === "ar" ? "اليوم" : "Day"}<input id="journal-date" type="date" value="${selectedKey}" /></label>`,
    )}
    <div class="grid dashboard-grid journal-grid">
      <section class="panel">
        ${panelHeading(
          appLanguage === "ar" ? "مراجعة اليوم" : "Daily reflection",
          `${completed}/${dayTasks.length} ${appLanguage === "ar" ? "مهام مكتملة" : "tasks completed"} · ${(focusSeconds / 60).toFixed(0)} min ${appLanguage === "ar" ? "تركيز" : "focus"} · ${distractions} ${appLanguage === "ar" ? "تشتت" : "distractions"}`,
        )}
        ${journalSupported ? "" : `<p class="data-caption">${appLanguage === "ar" ? "طبّق ترحيل 002 لحفظ المراجعة في حسابك. يمكنك الحفظ محليًا الآن." : "Apply migration 002 to sync journal entries to your account. Local saving still works now."}</p>`}
        <form id="journal-form" class="form-stack">
          <input type="hidden" name="entry_date" value="${selectedKey}" />
          <label>${appLanguage === "ar" ? "أهم الإنجازات" : "What went well"}<textarea name="achievements" dir="auto" rows="2" maxlength="2000">${escapeHtml(entry.achievements || "")}</textarea></label>
          <label>${appLanguage === "ar" ? "ما لم يكتمل" : "What stayed unfinished"}<textarea name="unfinished" dir="auto" rows="2" maxlength="2000">${escapeHtml(entry.unfinished || "")}</textarea></label>
          <label>${appLanguage === "ar" ? "لماذا؟" : "What got in the way"}<textarea name="reasons" dir="auto" rows="2" maxlength="2000">${escapeHtml(entry.reasons || "")}</textarea></label>
          <div class="form-row">
            <label>${appLanguage === "ar" ? "مستوى التركيز" : "Focus rating"}<select name="focus_rating"><option value="">—</option>${[1, 2, 3, 4, 5].map((value) => `<option value="${value}" ${Number(entry.focus_rating) === value ? "selected" : ""}>${value} / 5</option>`).join("")}</select></label>
            <label>${appLanguage === "ar" ? "أهم شيء لغد" : "Most important tomorrow"}<input name="tomorrow" dir="auto" maxlength="300" value="${escapeHtml(entry.tomorrow || "")}" /></label>
          </div>
          <div class="modal-actions"><button class="button button-primary" type="submit">${appLanguage === "ar" ? "حفظ المراجعة" : "Save reflection"}</button></div>
          <div class="form-error" id="journal-error" role="alert"></div>
        </form>
      </section>
      <aside class="grid">
        ${weeklyReviewPanel()}
        <section class="panel">
          ${panelHeading(appLanguage === "ar" ? "مراجعات سابقة" : "Past reflections", appLanguage === "ar" ? "ارجع إلى أي يوم" : "Return to any day")}
          <div class="journal-history">${recent.length ? recent.map((item) => `<button class="journal-history-row" data-action="journal-select" data-date="${escapeHtml(String(item.entry_date).slice(0, 10))}"><strong>${escapeHtml(new Intl.DateTimeFormat(appLanguage === "ar" ? "ar-EG" : "en", { dateStyle: "medium" }).format(new Date(`${String(item.entry_date).slice(0, 10)}T12:00:00`)))}</strong><small dir="auto">${escapeHtml((item.achievements || item.tomorrow || "Saved reflection").slice(0, 90))}</small></button>`).join("") : `<div class="empty-state">${appLanguage === "ar" ? "لا مراجعات بعد" : "No reflections yet"}</div>`}</div>
        </section>
      </aside>
    </div>
    <p class="data-caption">${session ? "Reflections are private to your account." : "Guest reflections are stored in this browser only."}</p>`;
  }

  async function saveJournalEntry(formData) {
    const entryDate = String(formData.get("entry_date") || journalDate);
    const payload = {
      entry_date: entryDate,
      achievements: String(formData.get("achievements") || "").trim(),
      unfinished: String(formData.get("unfinished") || "").trim(),
      reasons: String(formData.get("reasons") || "").trim(),
      focus_rating: Number(formData.get("focus_rating")) || null,
      tomorrow: String(formData.get("tomorrow") || "").trim(),
    };
    if (!payload.achievements && !payload.unfinished && !payload.reasons && !payload.focus_rating && !payload.tomorrow) {
      throw new Error("Add at least one reflection before saving.");
    }
    if (supabase && session && journalSupported) {
      const { data, error } = await supabase
        .from("study_journal_entries")
        .upsert({ ...payload, user_id: session.user.id }, { onConflict: "user_id,entry_date" })
        .select("*")
        .single();
      if (error) {
        if (isMissingRelation(error)) {
          journalSupported = false;
          const existingLocal = journalEntryFor(entryDate);
          const savedLocal = {
            ...(existingLocal || {}),
            ...payload,
            id: existingLocal?.id || `local-journal-${Date.now()}`,
            created_at: existingLocal?.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          journalEntries = journalEntries.filter(
            (entry) => String(entry.entry_date).slice(0, 10) !== entryDate,
          );
          journalEntries.unshift(savedLocal);
          saveLocalJournal();
        } else {
          throw error;
        }
      } else {
        journalEntries = journalEntries.filter(
          (entry) => String(entry.entry_date).slice(0, 10) !== entryDate,
        );
        journalEntries.unshift(data);
      }
    } else {
      const existing = journalEntryFor(entryDate);
      const saved = {
        ...(existing || {}),
        ...payload,
        id: existing?.id || `local-journal-${Date.now()}`,
        created_at: existing?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      journalEntries = journalEntries.filter(
        (entry) => String(entry.entry_date).slice(0, 10) !== entryDate,
      );
      journalEntries.unshift(saved);
      saveLocalJournal();
    }
    render();
    showToast(appLanguage === "ar" ? "تم حفظ المراجعة." : "Reflection saved.");
  }

  // ---- Backup & restore ----------------------------------------------------

  async function buildBackupPayload() {
    return {
      app: "study-zone",
      version: 2,
      exported_at: new Date().toISOString(),
      account: session?.user?.email || null,
      tasks,
      routines,
      routine_days: routineDays,
      notes,
      journal: journalEntries,
      focus_records: focusRecords,
      distractions: focusDistractions,
      settings: {
        focus: focusSettings,
        notifications: notificationPrefs,
        focus_sound: { id: focusSoundId, volume: focusSoundVolume },
      },
    };
  }

  async function exportBackup() {
    const payload = await buildBackupPayload();
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `study-zone-backup-${dateKey(new Date())}.json`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    showToast(appLanguage === "ar" ? "تم تنزيل النسخة الاحتياطية." : "Backup downloaded.");
  }

  function validateBackup(payload) {
    if (!payload || payload.app !== "study-zone" || !Array.isArray(payload.tasks))
      throw new Error("This file is not a Study Zone backup.");
    if (Number(payload.version) < 1)
      throw new Error("This backup version is not supported.");
    for (const key of ["tasks", "routines", "routine_days", "notes", "journal", "focus_records", "distractions"]) {
      if (payload[key] != null && !Array.isArray(payload[key]))
        throw new Error(`The backup has an invalid ${key} section.`);
      if (Array.isArray(payload[key]) && payload[key].length > 10000)
        throw new Error("The backup is too large to restore safely.");
    }
    return true;
  }

  async function importBackupFile(file) {
    if (!file) throw new Error("Choose a backup file first.");
    if (file.size > 15 * 1024 * 1024) throw new Error("Backup files must be 15 MB or smaller.");
    const payload = JSON.parse(await file.text());
    validateBackup(payload);
    let imported = 0;
    const existingTaskKeys = new Set(
      tasks.map((task) => `${String(task.title).toLowerCase()}|${task.due_at || ""}`),
    );
    const importTasks = (payload.tasks || []).filter((task) => {
      if (!task || !task.title) return false;
      const key = `${String(task.title).toLowerCase()}|${task.due_at || ""}`;
      if (existingTaskKeys.has(key)) return false;
      existingTaskKeys.add(key);
      return true;
    });
    if (supabase && session) {
      const rows = importTasks.slice(0, 500).map((task) => ({
        user_id: session.user.id,
        title: String(task.title).slice(0, 160),
        description: String(task.description || "").slice(0, 4000),
        subject_id: null,
        priority: ["low", "medium", "high", "urgent"].includes(task.priority) ? task.priority : "medium",
        status: ["not_started", "in_progress", "completed"].includes(task.status) ? task.status : "not_started",
        estimated_minutes: Math.max(5, Math.min(1440, Number(task.estimated_minutes) || 45)),
        reminder_before_minutes: 0,
        starts_at: task.starts_at || null,
        due_at: task.due_at || null,
        is_all_day: task.is_all_day === true,
      }));
      if (rows.length) {
        const { error } = await supabase.from("tasks").insert(rows);
        if (error) throw error;
        imported += rows.length;
      }
      const existingNotes = new Set(notes.map((note) => `${String(note.title).toLowerCase()}|${String(note.created_at || "").slice(0, 16)}`));
      const noteRows = (payload.notes || [])
        .filter((note) => note && note.title)
        .filter((note) => {
          const key = `${String(note.title).toLowerCase()}|${String(note.created_at || "").slice(0, 16)}`;
          if (existingNotes.has(key)) return false;
          existingNotes.add(key);
          return true;
        })
        .slice(0, 500)
        .map((note) => ({
          user_id: session.user.id,
          title: String(note.title).slice(0, 200),
          content: sanitizeRichText(String(note.content || "")),
          subject_id: null,
          is_favorite: note.is_favorite === true,
        }));
      if (noteRows.length) {
        const { error } = await supabase.from("notes").insert(noteRows);
        if (error) throw error;
        imported += noteRows.length;
      }
    } else {
      const ids = new Set(tasks.map((task) => String(task.id)));
      importTasks.forEach((task) => {
        const id = `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        if (ids.has(String(task.id))) return;
        tasks.unshift({
          ...task,
          id,
          subject: subjectName(task.subject_id),
          created_at: task.created_at || new Date().toISOString(),
          recurrence_group_id: null,
          recurrence_type: "none",
          recurrence_days: [],
          recurrence_until: null,
        });
        imported += 1;
      });
      saveLocalTasks();
      const existingNotes = new Set(notes.map((note) => String(note.id)));
      (payload.notes || []).forEach((note) => {
        if (!note?.title || existingNotes.has(String(note.id))) return;
        const existing = notes.find(
          (item) => String(item.title).toLowerCase() === String(note.title).toLowerCase() && String(item.created_at || "") === String(note.created_at || ""),
        );
        if (existing) return;
        notes.unshift({
          ...note,
          id: `local-note-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          content: sanitizeRichText(String(note.content || "")),
          subject: subjectName(note.subject_id),
        });
        imported += 1;
      });
      saveLocalNotes();
    }
    render();
    showToast(
      appLanguage === "ar"
        ? `تمت الاستعادة: ${imported} عنصرًا جديدًا. تم تجاهل المكرر.`
        : `Restore complete: ${imported} new items. Duplicates were skipped.`,
    );
    return imported;
  }

  function openShortcuts() {
    openModal(document.getElementById("shortcuts-modal"));
  }

  async function toggleFocusFullscreen() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch (error) {
      console.warn("Full screen is unavailable in this browser.", error);
      showToast(
        appLanguage === "ar"
          ? "ملء الشاشة غير متاح في هذا المتصفح."
          : "Full screen is not available in this browser.",
      );
    }
  }

  const pageRenderers = {
    dashboard: dashboardPage,
    planner: plannerPage,
    tasks: taskPage,
    deadlines: deadlinesPage,
    subjects: subjectsPage,
    files: filesPage,
    notes: notesPage,
    voice: voicePage,
    teams: teamsPage,
    teamLeaderboard: teamLeaderboardPage,
    focus: focusPage,
    analytics: analyticsPage,
    goals: goalsPage,
    exams: examsPage,
    achievements: achievementsPage,
    journal: journalPage,
    notifications: notificationsPage,
    profile: profilePage,
    settings: settingsPage,
    admin: adminPage,
  };
  const pageTitles = {
    dashboard: "Dashboard",
    planner: "Study planner",
    tasks: "Tasks",
    deadlines: "Deadlines",
    subjects: "Subjects",
    files: "Study files",
    notes: "Notes",
    voice: "Voice notes",
    teams: "Teams",
    teamLeaderboard: "Team leaderboard",
    focus: "Focus timer",
    analytics: "Analytics",
    goals: "Goals",
    exams: "Exams & results",
    achievements: "Achievements",
    journal: "Study journal",
    notifications: "Notifications",
    profile: "Profile",
    settings: "Settings",
    admin: "Admin",
  };

  function updateScrollProgress() {
    const root = document.documentElement;
    const range = root.scrollHeight - window.innerHeight;
    const progress =
      range > 0 ? Math.min(1, Math.max(0, window.scrollY / range)) : 0;
    document.documentElement.style.setProperty(
      "--scroll-progress",
      String(progress),
    );
    const indicator = document.getElementById("scroll-progress");
    if (indicator) indicator.style.transform = `scaleX(${progress})`;
  }

  // Coalesce data-loading renders into one frame so opening the app does not
  // rebuild the whole page several times while Supabase requests resolve.
  let scheduledRenderHandle = 0;
  let renderBatchDepth = 0;
  let renderPendingInBatch = false;
  function beginRenderBatch() {
    renderBatchDepth += 1;
  }
  function endRenderBatch() {
    renderBatchDepth = Math.max(0, renderBatchDepth - 1);
    if (renderBatchDepth === 0 && renderPendingInBatch) {
      renderPendingInBatch = false;
      scheduleRender();
    }
  }
  function scheduleRender() {
    if (renderBatchDepth > 0) {
      renderPendingInBatch = true;
      return;
    }
    if (scheduledRenderHandle) return;
    scheduledRenderHandle = window.requestAnimationFrame(() => {
      scheduledRenderHandle = 0;
      render();
    });
  }

  function syncBusyDates() {
    const api = window.StudyZoneUiControls;
    if (!api || typeof api.setBusyDates !== "function") return;
    const keys = new Set();
    (Array.isArray(tasks) ? tasks : []).forEach((task) => {
      const range = taskDateRange(task);
      if (!range) return;
      const cursor = new Date(range.start);
      let guard = 0;
      while (cursor <= range.end && guard < 400) {
        keys.add(dateKey(cursor));
        cursor.setDate(cursor.getDate() + 1);
        guard += 1;
      }
    });
    (getDeadlines() || []).forEach((deadline) => {
      if (!deadline || !deadline.due_at) return;
      const date = new Date(deadline.due_at);
      if (!Number.isNaN(date.getTime())) keys.add(dateKey(date));
    });
    api.setBusyDates(Array.from(keys));
  }

  function render() {
    if (scheduledRenderHandle) {
      window.cancelAnimationFrame(scheduledRenderHandle);
      scheduledRenderHandle = 0;
    }
    if (!pageRenderers[currentPage]) currentPage = "dashboard";
    document.body.classList.toggle(
      "focus-distraction",
      currentPage === "focus" && distractionFree,
    );
    document.documentElement.lang = appLanguage;
    document.documentElement.dir = appLanguage === "ar" ? "rtl" : "ltr";
    document.documentElement.dataset.motion = motionLevel;
    const content = document.getElementById("page-content");
    const pageChanged = currentPage !== lastRenderedPage;
    lastRenderedPage = currentPage;
    content.classList.remove("page-enter");
    content.innerHTML = pageRenderers[currentPage]();
    const analyticsChartHost = content.querySelector("[data-analytics-line-chart]");
    if (analyticsChartHost) attachAnalyticsLineChartHandlers(analyticsChartHost);
    const analyticsHeatmapHost = content.querySelector("[data-heatmap-panel]");
    if (analyticsHeatmapHost) attachHeatmapHandlers(analyticsHeatmapHost);
    if (shouldAnimate() && pageChanged) {
      void content.offsetWidth;
      content.classList.add("page-enter");
      animateDashboardProgress(content);
    }

    function animateDashboardProgress(content) {
      if (currentPage !== "dashboard" || !shouldAnimate()) return;
      content.querySelectorAll(".progress-fill").forEach((fill) => {
        const targetWidth = fill.style.width;
        if (!targetWidth || targetWidth === "0%") return;
        fill.style.width = "0%";
        requestAnimationFrame(() => {
          if (fill.isConnected && document.visibilityState === "visible")
            fill.style.width = targetWidth;
        });
      });
    }
    document.getElementById("page-crumb").textContent =
      currentPage === "deadlines"
        ? deadlineText[appLanguage].title
        : pageTitles[currentPage];
    document.querySelectorAll(".nav-link[data-page]").forEach((link) => {
      link.classList.toggle("active", link.dataset.page === currentPage);
    });
    document.getElementById("task-count").textContent = String(
      tasks.filter((task) => task.status !== "completed").length,
    );
    document.getElementById("deadline-count").textContent = String(
      getDeadlines().filter(
        (deadline) => getDeadlineStatus(deadline) !== "completed",
      ).length,
    );
    document.getElementById("today-date").textContent = new Intl.DateTimeFormat(
      appLanguage === "ar" ? "ar-EG" : "en",
      { weekday: "short", month: "short", day: "numeric" },
    ).format(new Date());
    updateStreakSidebar();
    updateAdminNavigation();
    window.StudyZoneNotifications?.syncTaskReminders?.(tasks, examResults);
    syncWidgetData();
    syncBusyDates();
    window.StudyZoneSyncUI?.refresh?.();
    if (currentPage === "tasks") {
      document
        .getElementById("task-search")
        ?.addEventListener("input", (event) => {
          searchTerm = event.target.value;
          const cursor = event.target.selectionStart;
          render();
          const input = document.getElementById("task-search");
          input.focus();
          input.setSelectionRange(cursor, cursor);
        });
      document
        .getElementById("task-filter")
        ?.addEventListener("change", (event) => {
          statusFilter = event.target.value;
          render();
        });
      document
        .getElementById("task-date")
        ?.addEventListener("change", (event) => {
          const nextDate = parseLocalDateKey(event.target.value);
          if (nextDate) {
            taskViewDate = nextDate;
            taskViewMode = "day";
            render();
          }
        });
    }
    if (currentPage === "admin" && adminAuthorization.status === "authorized") {
      document
        .getElementById("admin-users-search")
        ?.addEventListener("submit", (event) => {
          event.preventDefault();
          adminUsersSearch = String(
            new FormData(event.currentTarget).get("search") || "",
          ).trim();
          adminUsersPage = 0;
          void loadAdminUsers();
        });
    }
    if (currentPage === "focus") {
      attachFocusListeners();
      updateTimerUi();
    }
    if (currentPage === "deadlines") {
      document
        .getElementById("deadline-search")
        ?.addEventListener("input", (event) => {
          deadlineSearch = event.target.value;
          const cursor = event.target.selectionStart;
          render();
          const input = document.getElementById("deadline-search");
          input.focus();
          input.setSelectionRange(cursor, cursor);
        });
      document
        .getElementById("deadline-sort")
        ?.addEventListener("change", (event) => {
          deadlineSort = event.target.value;
          render();
        });
    }
    if (currentPage === "teams" && session && !teamsLoaded && !teamsLoading) {
      void loadTeams();
    }
    if (
      currentPage === "voice" &&
      session &&
      !voiceNotesLoaded &&
      !voiceNotesLoading
    ) {
      void loadVoiceNotes();
    }
    if (currentPage === "notes") {
      document
        .getElementById("note-search")
        ?.addEventListener("input", (event) => {
          noteSearch = event.target.value;
          const cursor = event.target.selectionStart;
          render();
          const input = document.getElementById("note-search");
          input.focus();
          input.setSelectionRange(cursor, cursor);
        });
      document
        .getElementById("note-subject-filter")
        ?.addEventListener("change", (event) => {
          noteSubjectFilter = event.target.value;
          render();
        });
      document
        .getElementById("note-sort")
        ?.addEventListener("change", (event) => {
          noteSort = event.target.value;
          render();
        });
    }
    translateInterface();
    animateRewardCounters();
    updateScrollProgress();
    syncFocusTicker();
    enhanceVoiceAudioPlayers();
  }

  function navigate(page) {
    if (!pageRenderers[page]) return;
    if (page === currentPage) {
      document.getElementById("sidebar").classList.remove("open");
      return;
    }
    currentPage = page;
    window.location.hash = page;
    document.getElementById("sidebar").classList.remove("open");
    if (page === "admin") {
      adminAuthorization = {
        status: "checking",
        userId: session?.user?.id || null,
      };
      updateAdminNavigation();
    }
    const updatePage = () => render();
    if (
      shouldUseFullMotion() &&
      typeof document.startViewTransition === "function"
    ) {
      document.startViewTransition(updatePage);
    } else {
      updatePage();
    }
    if (page === "admin") void verifyAdminAccess();
    if (page === "focus") void loadFocusData();
  }

  function updateAdminNavigation() {
    const link = document.getElementById("admin-navigation");
    if (link) {
      link.hidden =
        !session ||
        adminAuthorization.status !== "authorized" ||
        adminAuthorization.userId !== session.user.id;
    }
  }

  async function verifyAdminAccess() {
    const userId = session?.user?.id || null;
    const requestId = ++adminVerificationRequest;
    adminAuthorization = {
      status: userId && supabase ? "checking" : "denied",
      userId,
    };
    updateAdminNavigation();
    if (currentPage === "admin") render();

    if (!userId || !supabase) {
      if (currentPage === "admin") denyAdminRoute(false);
      return false;
    }

    let data;
    let error;
    try {
      ({ data, error } = await supabase.rpc("is_current_user_admin"));
    } catch (reason) {
      console.error("Could not verify administrator access.", reason);
      error = reason;
    }
    if (requestId !== adminVerificationRequest || session?.user?.id !== userId)
      return false;

    if (error) {
      console.error("Could not verify administrator access.", error);
      adminAuthorization = { status: "error", userId };
    } else {
      adminAuthorization = {
        status: data === true ? "authorized" : "denied",
        userId,
      };
    }
    updateAdminNavigation();

    if (currentPage === "admin") {
      if (adminAuthorization.status === "authorized") {
        render();
        void loadAdminUsers();
      } else {
        denyAdminRoute(Boolean(error));
      }
    }
    return adminAuthorization.status === "authorized";
  }

  function denyAdminRoute(verificationFailed) {
    currentPage = "dashboard";
    window.location.hash = "dashboard";
    render();
    showToast(
      translateUiText(
        verificationFailed
          ? "Could not verify administrator access."
          : "Administrator access denied.",
      ),
    );
  }

  function updateUserUi() {
    const user = session?.user;
    const name =
      accountProfile?.display_name ||
      user?.user_metadata?.full_name ||
      (user?.email ? user.email.split("@")[0] : "Alex Morgan");
    const initialsText = initials(name);
    document.getElementById("user-name").textContent = name;
    document.getElementById("user-email").textContent =
      user?.email || "Student account";
    document.querySelectorAll(".avatar").forEach((avatar) => {
      if (accountProfile?.avatar_display_url) {
        const image = document.createElement("img");
        image.src = accountProfile.avatar_display_url;
        image.alt = "";
        image.decoding = "async";
        image.referrerPolicy = "no-referrer";
        image.addEventListener(
          "error",
          () => {
            avatar.textContent = initialsText;
          },
          { once: true },
        );
        avatar.replaceChildren(image);
      } else {
        avatar.textContent = initialsText;
      }
    });
    document.getElementById("sign-out").hidden = !user;
    updateAdminNavigation();
    document.getElementById("auth-help").textContent = configured
      ? user
        ? `Signed in as ${user.email}`
        : "Sign in to sync your private study workspace."
      : "This is a local preview. Add your Supabase project details to enable authentication.";
    document.getElementById("auth-submit").disabled = !supabase;
    document.getElementById("auth-submit").title = supabase
      ? ""
      : "Add your Supabase URL and public anon key in supabase-config.js and allow the SDK to load";
    setConnectionState(
      user
        ? "Supabase connected"
        : supabase
          ? "Supabase ready"
          : "Demo workspace",
      Boolean(user),
    );
    translateInterface();
  }

  async function loadRemoteTasks() {
    if (!supabase || !session) return;
    deadlinesLoading = true;
    scheduleRender();
    const { data: subjectData, error: subjectError } = await supabase
      .from("subjects")
      .select("id,name,color,credit_hours")
      .order("name");
    if (subjectError) {
      showToast(`Could not load subjects: ${subjectError.message}`);
      console.error("Supabase subject read failed.", subjectError);
    } else {
      subjects = (subjectData || []).map((subject) => ({
        ...subject,
        credits: subject.credit_hours,
        progress: null,
      }));
    }
    const baseTaskColumns =
      "id,title,description,subject_id,starts_at,due_at,priority,status,estimated_minutes,reminder_before_minutes,created_at,completed_at,subjects(name)";
    const usageColumns =
      "is_all_day,open_count,completed_count,postpone_count,last_opened_at";
    const recurrenceColumns =
      "recurrence_group_id,recurrence_type,recurrence_days,recurrence_until";
    let taskResult = await supabase
      .from("tasks")
      .select(`${baseTaskColumns},${usageColumns},${recurrenceColumns}`)
      .order("due_at", { ascending: true, nullsFirst: false });
    // The first query asks for every optional column. A success proves both
    // migration 001 (recurrence) and migration 002 (all-day/usage) are applied.
    const fullTaskQuerySucceeded = !taskResult.error;
    if (fullTaskQuerySucceeded) {
      recurrenceSupported = true;
      taskAllDaySupported = true;
      taskUsageSupported = true;
    } else if (!/recurrence_/i.test(`${taskResult.error.message || ""}`)) {
      // Migration 002 columns are missing, but recurrence may still exist.
      taskAllDaySupported = false;
      taskUsageSupported = false;
      taskResult = await supabase
        .from("tasks")
        .select(`${baseTaskColumns},${recurrenceColumns}`)
        .order("due_at", { ascending: true, nullsFirst: false });
    }
    if (
      taskResult.error &&
      /(recurrence_|column .* does not exist|42703|PGRST204)/i.test(
        `${taskResult.error.code || ""} ${taskResult.error.message || ""}`,
      )
    ) {
      recurrenceSupported = false;
      taskResult = await supabase
        .from("tasks")
        .select(baseTaskColumns)
        .order("due_at", { ascending: true, nullsFirst: false });
    } else if (!fullTaskQuerySucceeded && !taskResult.error) {
      recurrenceSupported = true;
    }
    const { data, error } = taskResult;
    if (error) {
      deadlinesLoading = false;
      scheduleRender();
      showToast(`Could not load tasks: ${error.message}`);
      console.error("Supabase task read failed.", error);
      return;
    }
    tasks = (data || []).map((task) => ({
      recurrence_group_id: null,
      recurrence_type: "none",
      recurrence_days: [],
      recurrence_until: null,
      open_count: 0,
      completed_count: 0,
      postpone_count: 0,
      is_all_day: false,
      ...task,
      subject: task.subjects?.name || "Independent study",
    }));
    await loadTaskRoutines();
    deadlinesLoading = false;
    scheduleRender();
  }

  async function loadTaskRoutines() {
    if (!supabase || !session) {
      routinesLoaded = true;
      return;
    }
    routinesLoading = true;
    routinesError = "";
    const startKey = dateKey(addLocalDays(new Date(), -180));
    const endKey = dateKey(addLocalDays(new Date(), 60));
    const [routineResult, dayResult] = await Promise.all([
      supabase.from("task_routines").select("*").order("created_at", { ascending: true }),
      supabase
        .from("task_routine_days")
        .select("routine_id,occurrence_date,status,completed_at")
        .gte("occurrence_date", startKey)
        .lte("occurrence_date", endKey),
    ]);
    if (routineResult.error) {
      if (isMissingRelation(routineResult.error)) {
        routinesSupported = false;
        routines = [];
        routineDays = [];
      } else {
        routinesError = routineResult.error.message;
        console.error("Could not load routines.", routineResult.error);
      }
    } else {
      routinesSupported = true;
      routines = (routineResult.data || []).map(normalizeRoutine);
    }
    if (!dayResult.error) routineDays = dayResult.data || [];
    routinesLoading = false;
    routinesLoaded = true;
    scheduleRender();
  }

  async function loadJournalEntries() {
    if (!supabase || !session) {
      journalLoaded = true;
      return;
    }
    const { data, error } = await supabase
      .from("study_journal_entries")
      .select("*")
      .order("entry_date", { ascending: false })
      .limit(180);
    if (error) {
      if (isMissingRelation(error)) {
        journalSupported = false;
        journalEntries = [];
      } else {
        console.error("Could not load study journal entries.", error);
      }
    } else {
      journalSupported = true;
      journalEntries = data || [];
    }
    journalLoaded = true;
    scheduleRender();
  }

  async function loadFocusDistractions() {
    if (!supabase || !session) return;
    const since = new Date(Date.now() - 120 * 86400000).toISOString();
    const { data, error } = await supabase
      .from("focus_distractions")
      .select("id,session_id,task_id,routine_id,reason,created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false });
    if (error) {
      if (isMissingRelation(error)) {
        distractionsSupported = false;
        focusDistractions = readLocalJson(distractionStorageKey, []);
      } else {
        console.error("Could not load distraction history.", error);
      }
    } else {
      distractionsSupported = true;
      focusDistractions = data || [];
    }
  }

  async function loadAccountWorkspace() {
    if (!supabase || !session) return;
    const userId = session.user.id;
    const loadNoteRows = async () => {
      const withColor = await supabase
        .from("notes")
        .select(
          "id,title,content,subject_id,is_favorite,color,created_at,updated_at",
        )
        .order("updated_at", { ascending: false });
      if (withColor.error && /color/i.test(withColor.error.message || "")) {
        notesColorSupported = false;
        return supabase
          .from("notes")
          .select(
            "id,title,content,subject_id,is_favorite,created_at,updated_at",
          )
          .order("updated_at", { ascending: false });
      }
      notesColorSupported = !withColor.error;
      return withColor;
    };
    const [
      scheduleResult,
      fileResult,
      noteResult,
      goalResult,
      examResult,
      profileResult,
      reminderResult,
    ] = await Promise.all([
      supabase
        .from("schedules")
        .select("id,title,details,subject_id,starts_at,ends_at,recurrence")
        .order("starts_at"),
      supabase
        .from("study_files")
        .select(
          "id,name,storage_path,mime_type,size_bytes,subject_id,is_favorite,created_at",
        )
        .order("created_at", { ascending: false }),
      loadNoteRows(),
      supabase
        .from("goals")
        .select(
          "id,title,details,period,target_value,current_value,unit,starts_at,due_at,completed_at",
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("exams")
        .select(
          "id,title,details,subject_id,exam_at,max_marks,exam_results(obtained_marks,notes)",
        )
        .order("exam_at"),
      supabase
        .from("profiles")
        .select("id,display_name,avatar_url,timezone,language")
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("daily_reminder_preferences")
        .select("enabled,local_time,timezone")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);
    notesSchemaChecked = true;

    if (session?.user?.id !== userId) return;
    const reportError = (label, result) => {
      if (!result.error) return false;
      console.error(`Could not load ${label}.`, result.error);
      showToast(`Could not load ${label}: ${result.error.message}`);
      return true;
    };

    if (!reportError("study schedule", scheduleResult)) {
      schedule = (scheduleResult.data || []).map((block) => ({
        ...block,
        day: new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(
          new Date(block.starts_at),
        ),
        time: new Intl.DateTimeFormat(appLanguage, {
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date(block.starts_at)),
        length: `${Math.max(1, Math.round((new Date(block.ends_at) - new Date(block.starts_at)) / 60000))} min`,
        subject: subjectName(block.subject_id),
      }));
    }

    if (!reportError("study files", fileResult)) {
      sampleFiles = (fileResult.data || []).map((file) => ({
        ...file,
        type: file.mime_type,
        subject: subjectName(file.subject_id),
      }));
    }

    if (!reportError("notes", noteResult)) {
      notes = (noteResult.data || []).map((note) => normalizeNoteRecord({
        ...note,
        subject: subjectName(note.subject_id),
        updated: new Intl.DateTimeFormat(appLanguage, {
          dateStyle: "medium",
        }).format(new Date(note.updated_at)),
      }));
    }

    if (!reportError("goals", goalResult)) {
      goals = (goalResult.data || []).map((goal) => ({
        ...goal,
        progress: Math.min(
          100,
          Math.round(
            (Number(goal.current_value) / Number(goal.target_value)) * 100,
          ),
        ),
        due: goal.completed_at
          ? "Completed"
          : goal.due_at
            ? Math.max(
                0,
                Math.ceil((new Date(goal.due_at) - Date.now()) / 86400000),
              ) + " days"
            : goal.period,
        detail:
          goal.details ||
          `${goal.current_value} / ${goal.target_value} ${goal.unit}`,
      }));
    }

    if (!reportError("exams", examResult)) {
      examResults = (examResult.data || []).map((exam) => ({
        ...exam,
        subject: subjectName(exam.subject_id),
      }));
    }

    if (!reportError("profile", profileResult)) {
      accountProfile = profileResult.data || accountProfile;
      if (accountProfile) {
        accountProfile.avatar_display_url = await resolveProfileAvatarUrl(
          accountProfile.avatar_url,
          userId,
        );
      }
    } else if (profileResult?.data) {
      accountProfile = profileResult.data;
      accountProfile.avatar_display_url = await resolveProfileAvatarUrl(
        accountProfile.avatar_url,
        userId,
      );
    }

    if (reportError("daily reminder preferences", reminderResult)) {
      dailyReminderPreference = {
        enabled: false,
        local_time: "09:00",
        timezone: "UTC",
      };
    } else {
      dailyReminderPreference = {
        enabled: Boolean(reminderResult.data?.enabled),
        local_time: reminderResult.data?.local_time || "09:00",
        timezone: reminderResult.data?.timezone || "UTC",
      };
    }

    const notificationResult = await supabase
      .from("user_notification_preferences")
      .select("sound_enabled,dnd_enabled,dnd_start,dnd_end")
      .eq("user_id", userId)
      .maybeSingle();
    if (!notificationResult.error && notificationResult.data) {
      notificationPrefs = {
        sound: notificationResult.data.sound_enabled !== false,
        dnd: notificationResult.data.dnd_enabled === true,
        start: String(notificationResult.data.dnd_start || "22:00").slice(0, 5),
        end: String(notificationResult.data.dnd_end || "07:00").slice(0, 5),
        taskSound: ALERT_SOUNDS.some(
          (sound) => sound.id === notificationPrefs.taskSound,
        )
          ? notificationPrefs.taskSound
          : "task-reminder",
        taskVolume: [0, 10, 25, 50, 75, 100].includes(
          Number(notificationPrefs.taskVolume),
        )
          ? Number(notificationPrefs.taskVolume)
          : 80,
        taskDuration: [3, 5, 10, 15].includes(
          Number(notificationPrefs.taskDuration),
        )
          ? Number(notificationPrefs.taskDuration)
          : 5,
        taskRepeat: notificationPrefs.taskRepeat === true,
      };
      localStorage.setItem(
        notificationPrefsKey,
        JSON.stringify(notificationPrefs),
      );
    } else if (
      notificationResult.error &&
      !isMissingRelation(notificationResult.error)
    ) {
      console.error(
        "Could not load notification preferences.",
        notificationResult.error,
      );
    }
    updateUserUi();
    if (!journalLoaded) await loadJournalEntries();
    await loadFocusDistractions();
    scheduleRender();
  }

  const avatarBlobCacheKey = (userId, path) => `avatar:${userId}:${path}`;

  async function cacheAvatarBlob(userId, avatarPath, blob) {
    if (!userId || !avatarPath || !blob) return;
    try {
      await saveMediaBlob(avatarBlobCacheKey(userId, avatarPath), blob, {
        name: avatarPath.split("/").pop() || "avatar",
        type: blob.type || "image/jpeg",
        size: blob.size || 0,
        kind: "image",
      });
    } catch (e) {
      console.warn("Could not cache avatar locally.", e);
    }
  }

  async function getCachedAvatarObjectUrl(userId, avatarPath) {
    if (!userId || !avatarPath) return "";
    try {
      const rec = await getMediaBlob(avatarBlobCacheKey(userId, avatarPath));
      if (!rec?.blob) return "";
      return URL.createObjectURL(rec.blob);
    } catch {
      return "";
    }
  }

  async function resolveProfileAvatarUrl(avatarPath, userId) {
    if (!avatarPath) return "";
    const cached = await getCachedAvatarObjectUrl(userId, avatarPath);
    if (avatarPath.startsWith(`${userId}/`)) {
      if (!supabase || !navigator.onLine) return cached;
      try {
        const { data, error } = await supabase.storage
          .from("studyflow-files")
          .createSignedUrl(avatarPath, 86400);
        if (error) throw error;
        const signedUrl = data?.signedUrl || "";
        if (signedUrl) {
          // refresh local cache in background for offline use
          void fetch(signedUrl)
            .then((r) => (r.ok ? r.blob() : null))
            .then((blob) => blob && cacheAvatarBlob(userId, avatarPath, blob))
            .catch(() => {});
          return signedUrl;
        }
      } catch (error) {
        console.error("Could not create a private profile photo URL.", error);
        if (cached) return cached;
        showToast(`Could not load profile photo: ${error.message}`);
        return "";
      }
      return cached;
    }
    try {
      const url = new URL(avatarPath);
      if (url.protocol === "https:") return url.href;
    } catch (error) {
      console.error("The profile photo reference is invalid.", error);
    }
    return cached;
  }

  function resetAccountWorkspacePreview() {
    accountProfile = null;
    activity = previewActivity;
    schedule = previewSchedule;
    goals = previewGoals;
    examResults = previewExamResults;
    sampleFiles = previewFiles;
    notes = readLocalNotes();
    routines = readLocalJson(routinesStorageKey, []);
    routineDays = readLocalJson(routineDaysStorageKey, []);
    routinesLoaded = true;
    routinesSupported = true;
    routinesError = "";
    journalEntries = readLocalJson(journalStorageKey, []);
    journalLoaded = false;
    journalSupported = true;
    focusDistractions = readLocalJson(distractionStorageKey, []);
    distractionsSupported = true;
    teams = [];
    teamMembers = [];
    teamTasks = [];
    selectedTeamId = null;
    teamsLoaded = false;
    teamsSupported = true;
    teamsError = "";
    voiceNotes = [];
    voiceNotesLoaded = false;
    voiceNotesSupported = true;
    voiceNotesError = "";
    notificationsPrimed = false;
  }

  function clearAccountWorkspace() {
    accountProfile = null;
    activity = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => ({
      day,
      hours: 0,
    }));
    schedule = [];
    goals = [];
    examResults = [];
    sampleFiles = [];
    notes = [];
    routines = [];
    routineDays = [];
    routinesLoaded = false;
    routinesSupported = true;
    routinesError = "";
    journalEntries = [];
    journalLoaded = false;
    journalSupported = true;
    focusDistractions = [];
    distractionsSupported = true;
    teams = [];
    teamMembers = [];
    teamTasks = [];
    selectedTeamId = null;
    teamsLoaded = false;
    teamsSupported = true;
    teamsError = "";
    voiceNotes = [];
    voiceNotesLoaded = false;
    voiceNotesSupported = true;
    voiceNotesError = "";
    notificationsPrimed = false;
  }

  async function loadLanguagePreference() {
    if (!supabase || !session) return;
    const { data, error } = await supabase
      .from("profiles")
      .select("language")
      .eq("id", session.user.id)
      .maybeSingle();
    if (error) {
      console.error("Could not load language preference.", error);
      return;
    }
    if (data?.language === "ar" || data?.language === "en") {
      appLanguage = data.language;
      localStorage.setItem("studyflow.language", appLanguage);
      document.documentElement.lang = appLanguage;
      document.documentElement.dir = appLanguage === "ar" ? "rtl" : "ltr";
    }
    try {
      const { data: appearance, error: appearanceError } = await supabase
        .from("profiles")
        .select("theme,notification_settings")
        .eq("id", session.user.id)
        .maybeSingle();
      if (!appearanceError && appearance) {
        // Only sync a real theme choice from Supabase. Never let the default
        // "original" value (or a missing theme) overwrite a locally saved
        // preference. If the user chose Ocean/Emerald/etc. on this device,
        // that local choice wins until the user explicitly picks another theme.
        if (
          appearance.theme &&
          appearance.theme !== "original" &&
          themePresetIds.has(appearance.theme)
        ) {
          applyThemePreset(appearance.theme, { persist: true });
        }
        // Restore visual style from Supabase (Modern / Pixel)
        if (
          appearance.visual_style &&
          ["modern", "pixel"].includes(appearance.visual_style)
        ) {
          applyVisualStyle(appearance.visual_style, { persist: true });
        }
        // Restore animation settings from Supabase
        if (appearance.animation_enabled !== undefined) {
          animationEnabled = appearance.animation_enabled === true;
          animationsEnabled = animationEnabled && motionLevel !== "off";
          localStorage.setItem(
            "studyflow.animation-enabled",
            String(animationEnabled),
          );
        }
        if (appearance.animation_intensity) {
          animationIntensity = appearance.animation_intensity;
          localStorage.setItem("studyflow.animation-intensity", animationIntensity);
        }
        if (appearance.animation_speed) {
          animationSpeed = appearance.animation_speed;
          localStorage.setItem("studyflow.animation-speed", animationSpeed);
        }
        if (appearance.reduced_motion !== undefined) {
          reducedMotion = appearance.reduced_motion === true;
          localStorage.setItem("studyflow.reduced-motion", String(reducedMotion));
        }
        if (
          appearance.notification_settings &&
          typeof appearance.notification_settings === "object"
        ) {
          localStorage.setItem(
            notificationTypesKey,
            JSON.stringify({
              ...defaultNotificationTypes,
              ...appearance.notification_settings,
            }),
          );
        }
      }
    } catch (appearanceError) {
      if (!isMissingColumnError(appearanceError))
        console.warn("Could not load appearance preferences.", appearanceError);
    }
  }

  function vapidApplicationServerKey(encodedKey) {
    const padding = "=".repeat((4 - (encodedKey.length % 4)) % 4);
    const base64 = `${encodedKey}${padding}`
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    const raw = window.atob(base64);
    return Uint8Array.from(raw, (character) => character.charCodeAt(0));
  }

  function isSupportedPushEndpoint(endpoint) {
    try {
      const url = new URL(endpoint);
      const host = url.hostname.toLowerCase();
      const allowedHosts = [
        "fcm.googleapis.com",
        "push.services.mozilla.com",
        "web.push.apple.com",
      ];
      return (
        url.protocol === "https:" &&
        !url.username &&
        !url.password &&
        (!url.port || url.port === "443") &&
        allowedHosts.some(
          (allowedHost) =>
            host === allowedHost || host.endsWith(`.${allowedHost}`),
        )
      );
    } catch {
      return false;
    }
  }

  async function saveDailyReminder(form) {
    if (!supabase || !session)
      throw new Error(translateUiText("Sign in to configure daily reminders."));
    const enabled = form.elements.namedItem("enabled").checked;
    const localTime = String(form.elements.namedItem("local_time").value || "");
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(localTime))
      throw new Error("Choose a valid reminder time.");
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    let subscription;

    if (enabled) {
      const vapidPublicKey = window.studyFlowSupabaseConfig?.vapidPublicKey;
      if (!vapidPublicKey)
        throw new Error(
          translateUiText(
            "Daily push is not configured yet. Ask your administrator to finish the VAPID setup.",
          ),
        );
      if (
        !window.isSecureContext ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      ) {
        throw new Error(
          "Push notifications require a supported browser and HTTPS (localhost is supported for development).",
        );
      }
      const permission =
        Notification.permission === "granted"
          ? "granted"
          : await Notification.requestPermission();
      if (permission !== "granted")
        throw new Error(
          translateUiText(
            "Notification permission is required to enable daily push reminders.",
          ),
        );
      const registration = await navigator.serviceWorker.ready;
      subscription =
        (await registration.pushManager.getSubscription()) ||
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: vapidApplicationServerKey(vapidPublicKey),
        }));
      const serialized = subscription.toJSON();
      const p256dh = serialized.keys?.p256dh;
      const authSecret = serialized.keys?.auth;
      if (!subscription.endpoint || !p256dh || !authSecret) {
        await subscription.unsubscribe();
        throw new Error(
          "The browser returned an incomplete push subscription.",
        );
      }
      if (!isSupportedPushEndpoint(subscription.endpoint)) {
        await subscription.unsubscribe();
        throw new Error(
          "This browser's push service is not currently supported.",
        );
      }
      const { error: subscriptionError } = await supabase
        .from("push_subscriptions")
        .upsert(
          {
            user_id: session.user.id,
            endpoint: subscription.endpoint,
            p256dh,
            auth_secret: authSecret,
          },
          { onConflict: "user_id,endpoint" },
        );
      if (subscriptionError) {
        await subscription.unsubscribe();
        throw subscriptionError;
      }
    }

    const { error } = await supabase.from("daily_reminder_preferences").upsert(
      {
        user_id: session.user.id,
        enabled,
        local_time: localTime,
        timezone,
      },
      { onConflict: "user_id" },
    );
    if (error) {
      if (subscription) {
        const { error: cleanupError } = await supabase
          .from("push_subscriptions")
          .delete()
          .eq("user_id", session.user.id)
          .eq("endpoint", subscription.endpoint);
        await subscription.unsubscribe();
        if (cleanupError) {
          console.error(
            "Could not remove push subscription after saving reminder preferences failed.",
            cleanupError,
          );
          throw new Error(
            `${error.message} Subscription cleanup also failed: ${cleanupError.message}`,
          );
        }
      }
      throw error;
    }

    dailyReminderPreference = { enabled, local_time: localTime, timezone };
    if (!enabled) {
      await removeCurrentPushSubscription(session.user.id);
      const { error: deleteError } = await supabase
        .from("push_subscriptions")
        .delete()
        .eq("user_id", session.user.id);
      if (deleteError) throw deleteError;
    }
    render();
    showToast(translateUiText("Reminder saved."));
  }

  async function removeCurrentPushSubscription(userId) {
    if (!supabase || !userId || !("serviceWorker" in navigator)) return;
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return;
    const endpoint = subscription.endpoint;
    const unsubscribed = await subscription.unsubscribe();
    if (!unsubscribed)
      throw new Error("The browser could not disable this push subscription.");
    const { error } = await supabase
      .from("push_subscriptions")
      .delete()
      .eq("user_id", userId)
      .eq("endpoint", endpoint);
    if (error) throw error;
  }

  async function loadRemoteNotifications({ silent = false } = {}) {
    if (!supabase || !session) {
      userNotifications = [];
      notificationsPrimed = false;
      return;
    }
    const previousIds = new Set(
      userNotifications.map((item) => String(item.id)),
    );
    const { data, error } = await supabase
      .from("notifications")
      .select("id,type,title,message,read_at,created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      console.error("Could not load notifications.", error);
      if (!silent) showToast(`Could not load notifications: ${error.message}`);
      return;
    }
    const nextItems = data || [];
    const freshUnread = nextItems.filter(
      (item) => !item.read_at && !previousIds.has(String(item.id)),
    );
    userNotifications = nextItems;
    if (notificationsPrimed && freshUnread.length) {
      playNotificationSound();
      if (!silent && currentPage !== "notifications") {
        showToast(
          freshUnread.length === 1
            ? freshUnread[0].title
            : `${freshUnread.length} new notifications`,
        );
      }
    }
    notificationsPrimed = true;
    if (currentPage === "notifications") scheduleRender();
  }

  window.setInterval(() => {
    if (session && document.visibilityState === "visible") {
      void loadRemoteNotifications({ silent: true });
    }
  }, 120000);

  async function markNotificationsRead() {
    if (!supabase || !session) {
      showToast("Sign in to manage your notifications.");
      return;
    }
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .is("read_at", null);
    if (error) {
      showToast(`Could not update notifications: ${error.message}`);
      console.error("Could not mark notifications as read.", error);
      return;
    }
    const readAt = new Date().toISOString();
    userNotifications = userNotifications.map((item) =>
      item.read_at ? item : { ...item, read_at: readAt },
    );
    render();
    showToast("Notifications marked as read.");
  }

  async function setLanguage(language) {
    if (language !== "ar" && language !== "en") return;
    appLanguage = language;
    localStorage.setItem("studyflow.language", language);
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
    render();
    if (supabase && session) {
      const { error } = await supabase
        .from("profiles")
        .update({ language })
        .eq("id", session.user.id);
      if (error) {
        // Language is already saved locally; Supabase sync failure is non-critical.
        console.warn(
          "Language saved locally. Supabase profile sync skipped.",
          error,
        );
      }
    }
    showToast("Language changed.");
  }

  async function createTask(formData) {
    const title = String(formData.get("title") || "").trim();
    if (!title) throw new Error("Enter a task name.");
    const repeatType = String(formData.get("repeat_type") || "none");
    if (isRoutineRepeatType(repeatType)) {
      return createRoutineFromForm(formData);
    }
    const allDay =
      formData.get("all_day") === "on" || formData.get("all_day") === "true";
    let dueValue = String(formData.get("due_at") || "");
    let startsValue = String(formData.get("starts_at") || "");
    if (allDay) {
      const dayValue = dueValue.slice(0, 10) || dateKey(new Date());
      dueValue = `${dayValue}T23:59`;
      startsValue = "";
    }
    if (dueValue && startsValue && new Date(startsValue) > new Date(dueValue)) {
      throw new Error("The start time must be on or before the due time.");
    }
    if (repeatType !== "none" && !recurrenceSupported && supabase && session) {
      throw new Error(
        "Repeating tasks need the latest Supabase migration. Apply supabase/migrations/001_studyzone_enhancements.sql first.",
      );
    }
    const recurrence = buildRecurrencePlan(
      formData,
      dueValue.slice(0, 10),
      repeatType,
    );
    const groupId = repeatType === "none" ? null : focusId();
    const startTime = startsValue.slice(11, 16);
    const dueTime = dueValue.slice(11, 16) || "23:59";
    const baseTask = {
      title,
      description: String(formData.get("description") || "").trim(),
      subject_id: formData.get("subject_id") || null,
      priority: formData.get("priority") || "medium",
      estimated_minutes: Number(formData.get("estimated_minutes")) || 45,
      reminder_before_minutes:
        Number(formData.get("reminder_before_minutes")) || 0,
      status: String(formData.get("status") || "not_started"),
      completed_at:
        String(formData.get("status") || "") === "completed"
          ? new Date().toISOString()
          : null,
    };
    if (allDay && taskAllDaySupported) baseTask.is_all_day = true;
    if (startsValue) baseTask.starts_at = new Date(startsValue).toISOString();
    if (dueValue) baseTask.due_at = new Date(dueValue).toISOString();
    const recurrenceFields = recurrenceSupported
      ? {
          recurrence_group_id: groupId,
          recurrence_type: repeatType,
          recurrence_days: recurrence.days,
          recurrence_until: recurrence.until,
        }
      : {};
    const baseDueKey = dueValue.slice(0, 10);
    const instances = recurrence.dateKeys.map((occurrenceKey) => {
      const occurrence = { ...baseTask, ...recurrenceFields };
      if (dueValue && occurrenceKey) {
        occurrence.due_at = new Date(
          `${occurrenceKey}T${dueTime}`,
        ).toISOString();
        if (startsValue) {
          const dayShift = Math.round(
            (parseLocalDateKey(occurrenceKey) - parseLocalDateKey(baseDueKey)) /
              86400000,
          );
          const shiftedStart = addLocalDays(
            new Date(`${baseDueKey}T${startTime}`),
            dayShift,
          );
          occurrence.starts_at = shiftedStart.toISOString();
        }
      }
      return occurrence;
    });
    if (supabase && session) {
      const selectColumns = `id,title,description,subject_id,starts_at,due_at,priority,status,estimated_minutes,reminder_before_minutes,created_at,subjects(name)${taskAllDaySupported ? ",is_all_day" : ""}${recurrenceSupported ? ",recurrence_group_id,recurrence_type,recurrence_days,recurrence_until" : ""}`;
      let insertResult = await supabase
        .from("tasks")
        .insert(instances)
        .select(selectColumns);
      if (
        insertResult.error &&
        isMissingColumnError(insertResult.error) &&
        instances.some((instance) => "is_all_day" in instance)
      ) {
        taskAllDaySupported = false;
        const cleaned = instances.map((instance) => {
          const { is_all_day: _ignored, ...rest } = instance;
          return rest;
        });
        insertResult = await supabase
          .from("tasks")
          .insert(cleaned)
          .select(selectColumns.replace(",is_all_day", ""));
      }
      const { data, error } = insertResult;
      if (error) throw error;
      tasks.unshift(
        ...(data || []).map((item) => ({
          recurrence_group_id: null,
          recurrence_type: "none",
          recurrence_days: [],
          recurrence_until: null,
          open_count: 0,
          completed_count: 0,
          postpone_count: 0,
          ...item,
          is_all_day: item.is_all_day === true || isAllDayTask(item),
          subject: item.subjects?.name || "Independent study",
        })),
      );
    } else {
      tasks.unshift(
        ...instances.map((instance, index) => ({
          ...instance,
          id: `local-${Date.now()}-${index}`,
          subject: subjectName(instance.subject_id),
          created_at: new Date().toISOString(),
        })),
      );
      saveLocalTasks();
    }
    closeModal(document.getElementById("task-modal"));
    render();
    syncWidgetData();
    showToast(
      supabase && session
        ? `${instances.length} task${instances.length === 1 ? "" : "s"} saved to your account.`
        : `${instances.length} task${instances.length === 1 ? "" : "s"} saved in this browser.`,
    );
  }

  function buildRecurrencePlan(formData, startDateValue, repeatType) {
    if (repeatType === "none")
      return { dateKeys: [startDateValue || null], days: [], until: null };
    if (!startDateValue)
      throw new Error("Choose a due date before setting a repeat schedule.");
    const start = new Date(`${startDateValue}T00:00:00`);
    const untilValue = String(formData.get("repeat_until") || "");
    const until = untilValue ? new Date(`${untilValue}T00:00:00`) : null;
    if (!until || Number.isNaN(until.getTime()) || until < start) {
      throw new Error(
        "Choose a repeat end date on or after the first occurrence.",
      );
    }
    const maxUntil = new Date(start);
    maxUntil.setDate(maxUntil.getDate() + 365);
    if (until > maxUntil)
      throw new Error(
        "Repeat schedules can be created for up to one year at a time.",
      );
    if (!["daily", "weekly", "monthly", "custom"].includes(repeatType)) {
      throw new Error("Choose a valid repeat schedule.");
    }
    const days =
      repeatType === "custom"
        ? [...new Set(formData.getAll("repeat_days").map(Number))]
            .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
            .sort()
        : [];
    if (repeatType === "custom" && !days.length)
      throw new Error("Choose at least one weekday.");

    const dateKeys = [];
    for (
      const cursor = new Date(start);
      cursor <= until;
      cursor.setDate(cursor.getDate() + 1)
    ) {
      let matches =
        repeatType === "daily" ||
        (repeatType === "weekly" && cursor.getDay() === start.getDay()) ||
        (repeatType === "custom" && days.includes(cursor.getDay()));
      if (repeatType === "monthly") {
        const lastDay = new Date(
          cursor.getFullYear(),
          cursor.getMonth() + 1,
          0,
        ).getDate();
        matches = cursor.getDate() === Math.min(start.getDate(), lastDay);
      }
      if (matches) {
        dateKeys.push(dateKey(cursor));
        if (dateKeys.length > 366)
          throw new Error(
            "A repeat schedule cannot contain more than 366 occurrences.",
          );
      }
    }
    return { dateKeys, days, until: untilValue };
  }

  function updateRepeatControls(form) {
    const repeatType = form.elements.namedItem("repeat_type")?.value || "none";
    const recurring = repeatType !== "none";
    const routine = isRoutineRepeatType(repeatType);
    const dayField = form.querySelector("[data-repeat-days]");
    const untilField = form.querySelector("[data-repeat-until]");
    const intervalField = form.querySelector("[data-repeat-interval]");
    const help = form.querySelector("[data-repeat-help]");
    if (dayField)
      dayField.hidden = !(
        repeatType === "custom" || repeatType === "weekdays_permanent"
      );
    if (intervalField) intervalField.hidden = repeatType !== "interval_permanent";
    if (untilField) {
      untilField.hidden = !recurring;
      const input = untilField.querySelector("input");
      if (input) input.required = recurring && !routine;
    }
    if (help) {
      help.hidden = !recurring;
      help.textContent = routine
        ? "Permanent routines appear automatically every matching day, with an independent completion record for each date."
        : "Choose an end date within the next year. Each occurrence is saved as its own task.";
    }
  }

  async function applyTaskEdit(task, payload) {
    if (supabase && session) {
      let result = await supabase
        .from("tasks")
        .update(payload)
        .eq("id", task.id);
      if (result.error && isMissingColumnError(result.error) && "is_all_day" in payload) {
        taskAllDaySupported = false;
        const { is_all_day: _ignored, ...rest } = payload;
        result = await supabase.from("tasks").update(rest).eq("id", task.id);
        delete payload.is_all_day;
      }
      if (result.error) throw result.error;
    }
    Object.assign(task, payload);
    if (!supabase || !session) saveLocalTasks();
    closeModal(document.getElementById("task-modal"));
    taskEditingId = null;
    render();
    syncWidgetData();
    showToast(appLanguage === "ar" ? "تم تحديث المهمة." : "Task updated.");
  }

  function localInputValue(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  }

  function openTaskModal(id = null, presetDate = null, options = {}) {
    const routine = options?.routine || null;
    const select = document.getElementById("task-subject");
    select.innerHTML = `<option value="">${deadlineText[appLanguage].independent}</option>${subjects.map((subject) => `<option value="${escapeHtml(subject.id)}">${escapeHtml(subject.name)}</option>`).join("")}`;
    const form = document.getElementById("task-form");
    const task = !routine && id
      ? tasks.find((item) => String(item.id) === String(id))
      : null;
    taskEditingId = task ? task.id : null;
    if (task) void trackTaskUsage(task, "open_count");
    form.reset();
    form.elements.routine_id.value = routine?.id || "";
    const seriesNote = form.querySelector("[data-series-note]");
    const repeatConfig = form.querySelector("[data-repeat-config]");
    const stopButton = form.querySelector('[data-action="task-stop-series"]');
    if (stopButton) {
      stopButton.dataset.action = "task-stop-series";
      delete stopButton.dataset.id;
      stopButton.textContent =
        appLanguage === "ar" ? "إيقاف التكرار" : "Stop repeating";
    }
    document.getElementById("task-error").textContent = "";
    document.getElementById("task-modal-title").textContent = routine
      ? appLanguage === "ar"
        ? "تعديل المهمة اليومية"
        : "Edit routine"
      : task
        ? appLanguage === "ar"
          ? "تعديل المهمة"
          : "Edit task"
        : appLanguage === "ar"
          ? "إضافة مهمة"
          : "Add a task";
    document.getElementById("task-modal-help").textContent = routine
      ? appLanguage === "ar"
        ? "عدّل التعريف فقط. سجل إنجاز كل يوم يبقى محفوظًا."
        : "Edit the definition only. Each day's completion history stays intact."
      : task
        ? appLanguage === "ar"
          ? "حدّث التفاصيل، أو انقل المهمة إلى يوم آخر."
          : "Update the details, or move it to another day."
        : appLanguage === "ar"
          ? "أضف ما تحتاج تذكّره، وحدد موعده."
          : "Add what you need to remember and set when it is due.";
    document.getElementById("task-submit").innerHTML = routine || task
      ? appLanguage === "ar"
        ? "حفظ التغييرات →"
        : "Save changes →"
      : appLanguage === "ar"
        ? "حفظ المهمة →"
        : "Save task →";
    if (task) {
      form.elements.task_id.value = task.id;
      form.elements.title.value = task.title || "";
      form.elements.description.value = task.description || "";
      form.elements.subject_id.value = task.subject_id || "";
      form.elements.priority.value = task.priority || "medium";
      form.elements.status.value = task.status || "not_started";
      form.elements.estimated_minutes.value = String(
        task.estimated_minutes || 45,
      );
      form.elements.starts_at.value = localInputValue(task.starts_at);
      form.elements.due_at.value = localInputValue(task.due_at);
      form.elements.all_day.checked = isAllDayTask(task);
      form.elements.reminder_before_minutes.value = String(
        task.reminder_before_minutes || 0,
      );
      const reminderCustomRow = document.getElementById("reminder-custom-row");
      const alldayReminderRow = document.getElementById("allday-reminder-row");
      if (reminderCustomRow) {
        reminderCustomRow.hidden = task.reminder_before_minutes !== "custom";
        if (task.reminder_custom_date) {
          const el = form.elements.namedItem("reminder_custom_date");
          if (el) el.value = task.reminder_custom_date;
        }
        if (task.reminder_custom_time) {
          const el = form.elements.namedItem("reminder_custom_time");
          if (el) el.value = task.reminder_custom_time;
        }
      }
      if (alldayReminderRow) {
        alldayReminderRow.hidden = !isAllDayTask(task);
        if (task.allday_reminder_time) {
          const el = form.elements.namedItem("allday_reminder_time");
          if (el) el.value = task.allday_reminder_time;
        }
      }
      const isSeries = Boolean(task.recurrence_group_id);
      repeatConfig.hidden = true;
      seriesNote.hidden = !isSeries;
      stopButton.hidden = !isSeries;
      if (isSeries) {
        const group = taskSeries(task);
        seriesNote.textContent =
          appLanguage === "ar"
            ? `هذه المهمة جزء من سلسلة متكررة (${group.length} نسخة). سيُطلب منك اختيار نطاق التعديل عند الحفظ.`
            : `This task is part of a repeating series (${group.length} occurrence${group.length === 1 ? "" : "s"}). You will choose which occurrences to update when you save.`;
      }
    } else if (routine) {
      form.elements.title.value = routine.title || "";
      form.elements.description.value = routine.description || "";
      form.elements.subject_id.value = routine.subject_id || "";
      form.elements.priority.value = routine.priority || "medium";
      form.elements.status.value = "not_started";
      form.elements.estimated_minutes.value = String(
        routine.estimated_minutes || 30,
      );
      form.elements.due_at.value = `${routine.start_date}T23:59`;
      form.elements.all_day.checked = true;
      form.elements.reminder_before_minutes.value = String(
        routine.reminder_before_minutes || 0,
      );
      const reminderCustomRow = document.getElementById("reminder-custom-row");
      const alldayReminderRow = document.getElementById("allday-reminder-row");
      if (reminderCustomRow) reminderCustomRow.hidden = true;
      if (alldayReminderRow) {
        alldayReminderRow.hidden = false;
        if (routine.allday_reminder_time) {
          const el = form.elements.namedItem("allday_reminder_time");
          if (el) el.value = routine.allday_reminder_time;
        }
      }
      form.elements.repeat_type.value = routineTypeFormValue(routine);
      form.querySelectorAll('input[name="repeat_days"]').forEach((input) => {
        input.checked = (routine.weekdays || [])
          .map(Number)
          .includes(Number(input.value));
      });
      if (form.elements.repeat_interval)
        form.elements.repeat_interval.value = String(
          routine.interval_days || 2,
        );
      if (form.elements.repeat_until)
        form.elements.repeat_until.value = routine.end_date || "";
      repeatConfig.hidden = false;
      seriesNote.hidden = true;
      stopButton.hidden = false;
      stopButton.textContent =
        appLanguage === "ar" ? "حذف المهمة اليومية" : "Delete routine";
      stopButton.dataset.action = "routine-delete";
      stopButton.dataset.id = routine.id;
    } else {
      form.elements.task_id.value = "";
      repeatConfig.hidden = false;
      seriesNote.hidden = true;
      stopButton.hidden = true;
      form.elements.status.value = "not_started";
      form.elements.estimated_minutes.value = "45";
      if (presetDate) {
        const date = parseLocalDateKey(presetDate);
        if (date) {
          const fallback = new Date(
            date.getFullYear(),
            date.getMonth(),
            date.getDate(),
            17,
            0,
          );
          form.elements.due_at.value = localInputValue(fallback.toISOString());
        }
      }
    }
    updateRepeatControls(form);
    const reminderSelect = form.elements.namedItem("reminder_before_minutes");
    const allDayCheckbox = form.elements.namedItem("all_day");
    const reminderCustomRow = document.getElementById("reminder-custom-row");
    const alldayReminderRow = document.getElementById("allday-reminder-row");
    function toggleReminderRows() {
      if (reminderCustomRow)
        reminderCustomRow.hidden = reminderSelect.value !== "custom";
      if (alldayReminderRow)
        alldayReminderRow.hidden = !allDayCheckbox.checked;
    }
    reminderSelect?.addEventListener("change", toggleReminderRows, { once: true });
    allDayCheckbox?.addEventListener("change", toggleReminderRows, { once: true });
    toggleReminderRows();
    openModal(document.getElementById("task-modal"));
    translateInterface();
    form.elements.title.focus();
  }

  function taskPayloadFromForm(formData) {
    const title = String(formData.get("title") || "").trim();
    if (!title) throw new Error("Enter a task name.");
    const allDay =
      formData.get("all_day") === "on" || formData.get("all_day") === "true";
    let startsValue = String(formData.get("starts_at") || "");
    let dueValue = String(formData.get("due_at") || "");
    if (allDay) {
      dueValue = `${dueValue.slice(0, 10) || dateKey(new Date())}T23:59`;
      startsValue = "";
    }
    if (startsValue && dueValue && new Date(startsValue) > new Date(dueValue)) {
      throw new Error("The start time must be on or before the due time.");
    }
    return {
      title,
      description: String(formData.get("description") || "").trim(),
      subject_id: String(formData.get("subject_id") || "") || null,
      priority: String(formData.get("priority") || "medium"),
      status: String(formData.get("status") || "not_started"),
      estimated_minutes: Number(formData.get("estimated_minutes")) || 45,
      reminder_before_minutes:
        formData.get("reminder_before_minutes") === "custom"
          ? "custom"
          : Number(formData.get("reminder_before_minutes")) || 0,
      reminder_custom_date: String(formData.get("reminder_custom_date") || "") || null,
      reminder_custom_time: String(formData.get("reminder_custom_time") || "") || null,
      allday_reminder_time: String(formData.get("allday_reminder_time") || "") || null,
      is_all_day: allDay,
      starts_at: startsValue ? new Date(startsValue).toISOString() : null,
      due_at: dueValue ? new Date(dueValue).toISOString() : null,
      completed_at:
        String(formData.get("status") || "") === "completed"
          ? new Date().toISOString()
          : null,
    };
  }

  async function persistTaskPatch(ids, patchForTask) {
    if (!ids.length) return;
    if (supabase && session) {
      const results = await Promise.all(
        ids.map((id) => {
          const task = tasks.find((item) => item.id === id);
          return supabase.from("tasks").update(patchForTask(task)).eq("id", id);
        }),
      );
      const failed = results.find((result) => result.error);
      if (failed) throw failed.error;
    }
    tasks = tasks.map((task) =>
      ids.includes(task.id) ? { ...task, ...patchForTask(task) } : task,
    );
    if (!supabase || !session) saveLocalTasks();
    render();
  }

  function openSeriesScopeDialog(kind, task, payload = null) {
    if (!task) return;
    const group = taskSeries(task);
    const futureCount = seriesScopeIds(task, "future").length;
    const allCount = group.length;
    const singleLabel =
      kind === "delete"
        ? appLanguage === "ar"
          ? "حذف هذه المهمة فقط"
          : "Delete this task only"
        : appLanguage === "ar"
          ? "تعديل هذه المهمة فقط"
          : "Edit this task only";
    const futureLabel =
      kind === "delete"
        ? appLanguage === "ar"
          ? "حذف هذه المهمة والتكرارات القادمة"
          : "Delete this and all future occurrences"
        : appLanguage === "ar"
          ? "تعديل هذه المهمة والتكرارات القادمة"
          : "Edit this and all future occurrences";
    const allLabel =
      kind === "delete"
        ? appLanguage === "ar"
          ? "حذف السلسلة بالكامل"
          : "Delete the entire series"
        : appLanguage === "ar"
          ? "تعديل السلسلة بالكامل"
          : "Edit the entire series";
    const option = (scope, title, detail, tone = "") =>
      `<button class="scope-option ${tone}" data-action="series-scope" data-scope="${scope}"><strong>${escapeHtml(title)}</strong><small>${escapeHtml(detail)}</small></button>`;
    pendingSeriesAction = { kind, taskId: task.id, payload };
    document.getElementById("scope-kicker").textContent =
      kind === "delete" ? "REPEATING TASK" : "REPEATING TASK · EDIT";
    document.getElementById("scope-title").textContent =
      kind === "delete"
        ? appLanguage === "ar"
          ? "ماذا تريد أن تحذف؟"
          : "What should be deleted?"
        : appLanguage === "ar"
          ? "أي النسخ تريد تعديلها؟"
          : "Which occurrences should change?";
    document.getElementById("scope-description").textContent =
      appLanguage === "ar"
        ? `سلسلة "${task.title}" تحتوي على ${allCount} مهمة. لن تتأثر أي مهمة خارج هذه السلسلة.`
        : `"${task.title}" has ${allCount} occurrence${allCount === 1 ? "" : "s"} in this series. Nothing outside the series is affected.`;
    document.getElementById("scope-options").innerHTML = [
      option(
        "single",
        singleLabel,
        appLanguage === "ar" ? "تتأثر مهمة واحدة فقط" : "Affects 1 occurrence",
      ),
      option(
        "future",
        futureLabel,
        appLanguage === "ar"
          ? `تتأثر ${futureCount} مهمة`
          : `Affects ${futureCount} occurrence${futureCount === 1 ? "" : "s"}`,
      ),
      option(
        "all",
        allLabel,
        appLanguage === "ar"
          ? `تتأثر ${allCount} مهمة`
          : `Affects all ${allCount} occurrence${allCount === 1 ? "" : "s"}`,
        "danger",
      ),
    ].join("");
    openModal(document.getElementById("scope-modal"));
    translateInterface();
  }

  async function applySeriesAction(scope) {
    const pending = pendingSeriesAction;
    if (!pending) return;
    const task = tasks.find((item) => item.id === pending.taskId);
    if (!task) {
      pendingSeriesAction = null;
      return;
    }
    const ids = scope === "single" ? [task.id] : seriesScopeIds(task, scope);
    const modal = document.getElementById("scope-modal");
    modal.querySelectorAll("button").forEach((button) => {
      button.disabled = true;
    });
    try {
      if (pending.kind === "delete") {
        if (supabase && session) {
          const { error } = await supabase.from("tasks").delete().in("id", ids);
          if (error) throw error;
        }
        tasks = tasks.filter((item) => !ids.includes(item.id));
        if (!supabase || !session) saveLocalTasks();
        render();
        showToast(
          appLanguage === "ar"
            ? `تم حذف ${ids.length} مهمة.`
            : `${ids.length} task${ids.length === 1 ? "" : "s"} deleted.`,
        );
      } else {
        const baseDueMs = task.due_at ? new Date(task.due_at).getTime() : null;
        const newDueMs = pending.payload.due_at
          ? new Date(pending.payload.due_at).getTime()
          : null;
        const baseStartMs = task.starts_at
          ? new Date(task.starts_at).getTime()
          : null;
        const newStartMs = pending.payload.starts_at
          ? new Date(pending.payload.starts_at).getTime()
          : null;
        const dueShift =
          baseDueMs != null && newDueMs != null ? newDueMs - baseDueMs : 0;
        const startShift =
          baseStartMs != null && newStartMs != null
            ? newStartMs - baseStartMs
            : 0;
        const startOffset =
          newStartMs != null && newDueMs != null ? newStartMs - newDueMs : null;
        await persistTaskPatch(ids, (item) => {
          if (scope === "single") return pending.payload;
          // Series details (title, subject, priority, status…) apply to every selected
          // occurrence, but each occurrence keeps its own date unless the edit changes it.
          const {
            starts_at: _startsAt,
            due_at: _dueAt,
            ...rest
          } = pending.payload;
          const patch = { ...rest };
          if (pending.payload.due_at === null) patch.due_at = null;
          else if (dueShift && item.due_at && newDueMs != null) {
            patch.due_at = new Date(
              new Date(item.due_at).getTime() + dueShift,
            ).toISOString();
          }
          if (pending.payload.starts_at === null) patch.starts_at = null;
          else if (newStartMs != null) {
            if (item.starts_at && baseStartMs != null) {
              patch.starts_at = new Date(
                new Date(item.starts_at).getTime() + startShift,
              ).toISOString();
            } else if (item.due_at && startOffset != null) {
              patch.starts_at = new Date(
                new Date(item.due_at).getTime() + startOffset,
              ).toISOString();
            }
          }
          return patch;
        });
        showToast(appLanguage === "ar" ? "تم تحديث المهام." : "Tasks updated.");
      }
      closeModal(modal);
      pendingSeriesAction = null;
      taskEditingId = null;
      editingDeadlineId = null;
      closeModal(document.getElementById("task-modal"));
      closeModal(document.getElementById("deadline-modal"));
      document.getElementById("deadline-form").reset();
      render();
    } catch (error) {
      console.error("Could not apply the repeating task change.", error);
      showToast(
        `${appLanguage === "ar" ? "تعذر تحديث المهام:" : "Could not update tasks:"} ${error.message}`,
      );
      modal.querySelectorAll("button").forEach((button) => {
        button.disabled = false;
      });
    }
  }

  async function stopTaskSeries(task) {
    if (!task?.recurrence_group_id) return;
    const ids = taskSeries(task).map((item) => item.id);
    const confirmed = window.confirm(
      appLanguage === "ar"
        ? `إيقاف التكرار مع الاحتفاظ بـ ${ids.length} مهمة؟ ستبقى المهام كما هي دون تكرار مستقبلي.`
        : `Stop repeating and keep ${ids.length} task${ids.length === 1 ? "" : "s"}? The tasks stay, but the series ends here.`,
    );
    if (!confirmed) return;
    try {
      await persistTaskPatch(ids, () => ({
        recurrence_group_id: null,
        recurrence_type: "none",
        recurrence_days: [],
        recurrence_until: null,
      }));
      closeModal(document.getElementById("task-modal"));
      taskEditingId = null;
      showToast(
        appLanguage === "ar" ? "تم إيقاف التكرار." : "Repeating stopped.",
      );
    } catch (error) {
      showToast(
        `${appLanguage === "ar" ? "تعذر إيقاف التكرار:" : "Could not stop repeating:"} ${error.message}`,
      );
      console.error("Could not stop the repeating series.", error);
    }
  }

  function routinePayloadFromForm(formData) {
    const title = String(formData.get("title") || "").trim();
    if (!title) throw new Error("Enter a routine name.");
    const repeatValue = String(formData.get("repeat_type") || "daily_permanent");
    const routine_type = routineTypeFromFormValue(repeatValue);
    const dueValue = String(formData.get("due_at") || "");
    const start_date = dueValue.slice(0, 10) || dateKey(new Date());
    const endValue = String(formData.get("repeat_until") || "");
    const weekdays = [...new Set(formData.getAll("repeat_days").map(Number))]
      .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
      .sort();
    if (routine_type === "weekdays" && !weekdays.length)
      throw new Error("Choose at least one weekday for this routine.");
    if (endValue && endValue < start_date)
      throw new Error("The routine end date must be on or after its start date.");
    return {
      title,
      description: String(formData.get("description") || "").trim(),
      subject_id: String(formData.get("subject_id") || "") || null,
      priority: String(formData.get("priority") || "medium"),
      routine_type,
      weekdays: routine_type === "weekdays" ? weekdays : [],
      interval_days:
        routine_type === "interval"
          ? Math.min(
              365,
              Math.max(1, Number(formData.get("repeat_interval")) || 2),
            )
          : 1,
      start_date,
      end_date: endValue || null,
      paused: false,
      paused_at: null,
      estimated_minutes: Number(formData.get("estimated_minutes")) || 30,
      reminder_before_minutes:
        Number(formData.get("reminder_before_minutes")) || 0,
    };
  }

  async function createRoutineFromForm(formData) {
    const payload = routinePayloadFromForm(formData);
    let routine;
    if (supabase && session) {
      const { data, error } = await supabase
        .from("task_routines")
        .insert({ ...payload, user_id: session.user.id })
        .select("*")
        .single();
      if (error) {
        if (isMissingRelation(error)) {
          routinesSupported = false;
          throw new Error(
            "Daily routines need the latest Supabase migration. Apply supabase/migrations/002_focus_intelligence.sql first.",
          );
        }
        throw error;
      }
      routine = normalizeRoutine(data);
    } else {
      routine = normalizeRoutine({
        ...payload,
        id: `local-routine-${Date.now()}`,
        created_at: new Date().toISOString(),
      });
    }
    routines.unshift(routine);
    if (!supabase || !session) saveLocalRoutines();
    closeModal(document.getElementById("task-modal"));
    render();
    showToast(
      appLanguage === "ar"
        ? "تم إنشاء المهمة اليومية. ستظهر تلقائيًا كل يوم."
        : "Routine created. It will appear automatically each day.",
    );
    return routine;
  }

  async function updateRoutineFromForm(routine, formData) {
    const payload = routinePayloadFromForm(formData);
    // Editing the definition must not silently resume a paused routine.
    payload.paused = routine.paused === true;
    payload.paused_at = routine.paused_at || null;
    if (supabase && session && !String(routine.id).startsWith("local-")) {
      const { data, error } = await supabase
        .from("task_routines")
        .update(payload)
        .eq("id", routine.id)
        .select("*")
        .single();
      if (error) throw error;
      Object.assign(routine, normalizeRoutine(data));
    } else {
      Object.assign(routine, payload, { updated_at: new Date().toISOString() });
      saveLocalRoutines();
    }
    closeModal(document.getElementById("task-modal"));
    render();
    showToast(
      appLanguage === "ar"
        ? "تم تحديث المهمة اليومية. سجل الأيام السابقة محفوظ."
        : "Routine updated. Your past daily history is preserved.",
    );
  }

  async function toggleRoutineOccurrence(task) {
    if (!task?.routine_id || !task.occurrence_date) return;
    if (statusChangesInFlight.has(task.id)) return;
    statusChangesInFlight.add(task.id);
    const row = [...document.querySelectorAll(".task-row")].find(
      (item) => item.dataset.taskId === task.id,
    );
    const button = row?.querySelector('[data-action="toggle-task"]');
    if (button) button.disabled = true;
    try {
      const existing = routineDayFor(task.routine_id, task.occurrence_date);
      const reopening = existing?.status === "completed";
      if (reopening) {
        if (supabase && session && !String(task.routine_id).startsWith("local-")) {
          const { error } = await supabase
            .from("task_routine_days")
            .delete()
            .eq("routine_id", task.routine_id)
            .eq("occurrence_date", task.occurrence_date);
          if (error) throw error;
        }
        routineDays = routineDays.filter(
          (day) =>
            !(
              String(day.routine_id) === String(task.routine_id) &&
              day.occurrence_date === task.occurrence_date
            ),
        );
      } else {
        const record = {
          routine_id: task.routine_id,
          occurrence_date: task.occurrence_date,
          status: "completed",
          completed_at: new Date().toISOString(),
        };
        if (supabase && session && !String(task.routine_id).startsWith("local-")) {
          const { error } = await supabase
            .from("task_routine_days")
            .upsert(
              { ...record, user_id: session.user.id },
              { onConflict: "routine_id,occurrence_date" },
            );
          if (error) throw error;
        }
        routineDays = routineDays.filter(
          (day) =>
            !(
              String(day.routine_id) === String(task.routine_id) &&
              day.occurrence_date === task.occurrence_date
            ),
        );
        routineDays.push(record);
      }
      if (!supabase || !session) saveLocalRoutineDays();
      if (!reopening) await animateCompletionCard(row);
      render();
      showToast(
        reopening
          ? appLanguage === "ar"
            ? "أُعيد فتح مهمة اليوم. الأيام الأخرى لم تتأثر."
            : "Today reopened. Other days are unaffected."
          : appLanguage === "ar"
            ? "تم إنجاز مهمة اليوم. ستظهر مجددًا غدًا."
            : "Completed for today. It will appear again tomorrow.",
      );
    } catch (error) {
      showToast(`Could not update the routine: ${error.message}`);
      console.error("Routine completion failed.", error);
    } finally {
      statusChangesInFlight.delete(task.id);
    }
  }

  async function skipRoutineOccurrence(routineId, occurrenceDate) {
    const routine = routines.find(
      (item) => String(item.id) === String(routineId),
    );
    if (!routine || !occurrenceDate) return;
    const record = {
      routine_id: routine.id,
      occurrence_date: occurrenceDate,
      status: "skipped",
      completed_at: null,
    };
    if (supabase && session && !String(routine.id).startsWith("local-")) {
      const { error } = await supabase
        .from("task_routine_days")
        .upsert(
          { ...record, user_id: session.user.id },
          { onConflict: "routine_id,occurrence_date" },
        );
      if (error) {
        showToast(`Could not skip this day: ${error.message}`);
        return;
      }
    }
    routineDays = routineDays.filter(
      (day) =>
        !(
          String(day.routine_id) === String(routine.id) &&
          day.occurrence_date === occurrenceDate
        ),
    );
    routineDays.push(record);
    if (!supabase || !session) saveLocalRoutineDays();
    render();
    showToast(
      appLanguage === "ar"
        ? "تم تخطي اليوم فقط. المهمة ستعود في الأيام القادمة."
        : "Skipped today only. The routine returns on future days.",
    );
  }

  async function toggleRoutinePause(routineId) {
    const routine = routines.find(
      (item) => String(item.id) === String(routineId),
    );
    if (!routine) return;
    const paused = !routine.paused;
    const patch = {
      paused,
      paused_at: paused ? dateKey(new Date()) : null,
    };
    if (supabase && session && !String(routine.id).startsWith("local-")) {
      const { error } = await supabase
        .from("task_routines")
        .update(patch)
        .eq("id", routine.id);
      if (error) {
        showToast(`Could not update the routine: ${error.message}`);
        return;
      }
    }
    Object.assign(routine, patch);
    if (!supabase || !session) saveLocalRoutines();
    render();
    showToast(
      paused
        ? appLanguage === "ar"
          ? "تم إيقاف التكرار مؤقتًا. السجل السابق محفوظ."
          : "Routine paused. Past history is preserved."
        : appLanguage === "ar"
          ? "تم استئناف التكرار."
          : "Routine resumed.",
    );
  }

  async function deleteRoutineById(routineId) {
    const routine = routines.find(
      (item) => String(item.id) === String(routineId),
    );
    if (!routine) return;
    if (
      !window.confirm(
        translateUiText(
          `Delete the routine "${routine.title}" permanently? Past daily history will also be removed.`,
        ),
      )
    )
      return;
    if (supabase && session && !String(routine.id).startsWith("local-")) {
      const { error } = await supabase
        .from("task_routines")
        .delete()
        .eq("id", routine.id);
      if (error) {
        showToast(`Could not delete the routine: ${error.message}`);
        return;
      }
    }
    routines = routines.filter(
      (item) => String(item.id) !== String(routine.id),
    );
    routineDays = routineDays.filter(
      (day) => String(day.routine_id) !== String(routine.id),
    );
    if (!supabase || !session) {
      saveLocalRoutines();
      saveLocalRoutineDays();
    }
    closeModal(document.getElementById("task-modal"));
    render();
    showToast(appLanguage === "ar" ? "تم حذف المهمة اليومية." : "Routine deleted.");
  }

  async function updateTaskStatus(id) {
    if (String(id).startsWith("routine:")) {
      const task = tasksForDay(dateKey(taskViewDate)).find(
        (item) => item.id === id,
      ) || routineTasksForDay(dateKey(new Date())).find((item) => item.id === id);
      if (task) await toggleRoutineOccurrence(task);
      return;
    }
    const task = tasks.find((item) => item.id === id);
    if (!task || statusChangesInFlight.has(id)) return;
    const nextStatus =
      task.status === "completed" ? "not_started" : "completed";
    const completing = nextStatus === "completed";
    const previousRewards = rewardSummary ? { ...rewardSummary } : null;
    const row = [...document.querySelectorAll(".task-row")].find(
      (item) => item.dataset.taskId === id,
    );
    const button = row?.querySelector('[data-action="toggle-task"]');
    statusChangesInFlight.add(id);
    if (button) button.disabled = true;
    try {
      if (supabase && session) {
        const { error } = await supabase
          .from("tasks")
          .update({
            status: nextStatus,
            completed_at: completing ? new Date().toISOString() : null,
          })
          .eq("id", id);
        if (error) throw error;
      }
      if (completing) await animateCompletionCard(row);
      task.status = nextStatus;
      task.completed_at = completing ? new Date().toISOString() : null;
      if (completing) void trackTaskUsage(task, "completed_count");
      if (!supabase || !session) saveLocalTasks();
      render();
      syncWidgetData();
      showToast(
        completing
          ? task.due_at
            ? "Deadline completed."
            : "Task completed."
          : "Task reopened.",
      );
      if (completing && !task.due_at && shouldUseFullMotion()) launchConfetti();
      if (completing && supabase && session)
        await refreshRewardSummary({
          celebrate: true,
          previous: previousRewards,
        });
      if (completing && task.due_at) {
        const gained =
          previousRewards && rewardSummary
            ? Math.max(
                0,
                Number(rewardSummary.total_xp) -
                  Number(previousRewards.total_xp),
              )
            : 0;
        openCelebration("Deadline completed", task.title, gained, true);
      }
    } catch (error) {
      showToast(`Could not update task: ${error.message}`);
      console.error("Task status update failed.", error);
    } finally {
      statusChangesInFlight.delete(id);
    }
  }

  async function deleteTask(id) {
    const task = tasks.find((item) => item.id === id);
    if (!task) return;
    if (task.recurrence_group_id) {
      openSeriesScopeDialog("delete", task);
      return;
    }
    if (!window.confirm(translateUiText(`Delete "${task.title}"?`))) return;
    if (supabase && session) {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) {
        showToast(`Could not delete task: ${error.message}`);
        console.error("Supabase task deletion failed.", error);
        return;
      }
    }
    tasks = tasks.filter((item) => item.id !== id);
    if (!supabase || !session) saveLocalTasks();
    render();
    syncWidgetData();
    showToast("Task deleted.");
  }

  function openMoveTaskModal(id) {
    const task = tasks.find((item) => String(item.id) === String(id));
    if (!task) return;
    const form = document.getElementById("move-task-form");
    form.reset();
    form.elements.task_id.value = task.id;
    const due = task.due_at ? new Date(task.due_at) : new Date();
    form.elements.move_date.value = dateKey(due);
    const noTime =
      !task.due_at || (due.getHours() === 23 && due.getMinutes() === 59);
    form.elements.move_time.value = noTime
      ? ""
      : `${String(due.getHours()).padStart(2, "0")}:${String(due.getMinutes()).padStart(2, "0")}`;
    document.getElementById("move-task-help").textContent = task.title;
    document.getElementById("move-task-error").textContent = "";
    openModal(document.getElementById("move-task-modal"));
    form.elements.move_date.focus();
  }

  async function moveTask(formData) {
    const task = tasks.find(
      (item) => String(item.id) === String(formData.get("task_id")),
    );
    if (!task) throw new Error("The task could not be found.");
    const dateValue = String(formData.get("move_date") || "");
    if (!dateValue) throw new Error("Choose a new date.");
    const timeValue = String(formData.get("move_time") || "") || "23:59";
    const newDue = new Date(`${dateValue}T${timeValue}:00`);
    if (Number.isNaN(newDue.getTime())) throw new Error("Choose a valid date.");
    const patch = {
      due_at: newDue.toISOString(),
      postpone_count: Number(task.postpone_count || 0) + 1,
    };
    if (task.starts_at) {
      const oldDue = task.due_at
        ? new Date(task.due_at).getTime()
        : newDue.getTime();
      const shift = newDue.getTime() - oldDue;
      patch.starts_at = new Date(
        new Date(task.starts_at).getTime() + shift,
      ).toISOString();
    }
    if (supabase && session) {
      let result = await supabase
        .from("tasks")
        .update(patch)
        .eq("id", task.id);
      if (result.error && isMissingColumnError(result.error) && "postpone_count" in patch) {
        taskUsageSupported = false;
        const { postpone_count: _ignored, ...rest } = patch;
        result = await supabase.from("tasks").update(rest).eq("id", task.id);
        delete patch.postpone_count;
      }
      if (result.error) throw result.error;
    }
    Object.assign(task, patch);
    if (!supabase || !session) saveLocalTasks();
    closeModal(document.getElementById("move-task-modal"));
    render();
    syncWidgetData();
    showToast(appLanguage === "ar" ? "تم نقل المهمة." : "Task moved.");
  }

  function localDateTimeToIso(dateValue, timeValue) {
    if (!dateValue) return null;
    const time = timeValue || "23:59";
    const localDate = new Date(`${dateValue}T${time}:00`);
    if (Number.isNaN(localDate.getTime())) return null;
    return localDate.toISOString();
  }

  function openDeadlineModal(id = null) {
    const t = deadlineText[appLanguage];
    const form = document.getElementById("deadline-form");
    const deadline = id ? tasks.find((item) => item.id === id) : null;
    if (id && !deadline) {
      showToast(t.saveError);
      return;
    }
    editingDeadlineId = id;
    form.reset();
    const subjectSelect = document.getElementById("deadline-subject");
    subjectSelect.innerHTML = `<option value="">${t.independent}</option>${subjects.map((subject) => `<option value="${escapeHtml(subject.id)}">${escapeHtml(subject.name)}</option>`).join("")}`;
    document.getElementById("deadline-modal-title").textContent = deadline
      ? t.modalEdit
      : t.modalAdd;
    document.getElementById("deadline-modal-help").textContent = t.modalHelp;
    document.getElementById("deadline-submit").innerHTML =
      `${deadline ? t.save : t.save} <span>→</span>`;
    document.getElementById("deadline-error").textContent = "";
    if (deadline) {
      const due = new Date(deadline.due_at);
      const start = deadline.starts_at ? new Date(deadline.starts_at) : due;
      form.elements.title.value = deadline.title || "";
      form.elements.description.value = deadline.description || "";
      form.elements.subject_id.value = deadline.subject_id || "";
      form.elements.priority.value = deadline.priority || "medium";
      form.elements.starts_on.value = dateKey(start);
      form.elements.due_date.value = dateKey(due);
      const noTimeSet = due.getHours() === 23 && due.getMinutes() === 59;
      form.elements.due_time.value = noTimeSet
        ? ""
        : `${String(due.getHours()).padStart(2, "0")}:${String(due.getMinutes()).padStart(2, "0")}`;
      form.elements.reminder_before_minutes.value = String(
        deadline.reminder_before_minutes || 0,
      );
      const deadlineReminderCustomRow = document.getElementById("deadline-reminder-custom-row");
      if (deadlineReminderCustomRow) {
        deadlineReminderCustomRow.hidden = deadline.reminder_before_minutes !== "custom";
        if (deadline.reminder_custom_date) {
          const el = form.elements.namedItem("deadline_reminder_custom_date");
          if (el) el.value = deadline.reminder_custom_date;
        }
        if (deadline.reminder_custom_time) {
          const el = form.elements.namedItem("deadline_reminder_custom_time");
          if (el) el.value = deadline.reminder_custom_time;
        }
      }
      form.querySelector("[data-repeat-config]").hidden = true;
    } else {
      form.querySelector("[data-repeat-config]").hidden = false;
    }
    updateRepeatControls(form);
    const deadlineReminderSelect = form.elements.namedItem("reminder_before_minutes");
    const deadlineReminderCustomRow = document.getElementById("deadline-reminder-custom-row");
    function toggleDeadlineReminderRow() {
      if (deadlineReminderCustomRow)
        deadlineReminderCustomRow.hidden = deadlineReminderSelect.value !== "custom";
    }
    deadlineReminderSelect?.addEventListener("change", toggleDeadlineReminderRow, { once: true });
    toggleDeadlineReminderRow();
    openModal(document.getElementById("deadline-modal"));
    form.elements.title.focus();
  }

  async function saveDeadline(formData) {
    const t = deadlineText[appLanguage];
    const title = String(formData.get("title") || "").trim();
    const date = String(formData.get("due_date") || "");
    if (!title) throw new Error(t.validationTitle);
    if (!date) throw new Error(t.validationDate);
    const startsOn = String(formData.get("starts_on") || date);
    const startDate = new Date(`${startsOn}T00:00:00`);
    const endDate = new Date(`${date}T00:00:00`);
    if (
      Number.isNaN(startDate.getTime()) ||
      Number.isNaN(endDate.getTime()) ||
      startDate > endDate
    ) {
      throw new Error("The start date must be on or before the deadline.");
    }
    const dueAt = localDateTimeToIso(
      date,
      String(formData.get("due_time") || ""),
    );
    if (!dueAt) throw new Error(t.validationDate);
    const startsAt =
      localDateTimeToIso(startsOn, String(formData.get("due_time") || "")) ||
      startDate.toISOString();
    const subjectId = String(formData.get("subject_id") || "") || null;
    const payload = {
      title,
      description: String(formData.get("description") || "").trim(),
      subject_id: subjectId,
      starts_at: startsAt,
      due_at: dueAt,
      priority: String(formData.get("priority") || "medium"),
      reminder_before_minutes:
        formData.get("reminder_before_minutes") === "custom"
          ? "custom"
          : Number(formData.get("reminder_before_minutes") || 0),
      reminder_custom_date: String(formData.get("deadline_reminder_custom_date") || "") || null,
      reminder_custom_time: String(formData.get("deadline_reminder_custom_time") || "") || null,
    };

    if (editingDeadlineId) {
      const editing = tasks.find(
        (item) => String(item.id) === String(editingDeadlineId),
      );
      if (editing?.recurrence_group_id) {
        openSeriesScopeDialog("edit", editing, payload);
        return "scoped";
      }
    }

    if (supabase && session) {
      const baseSelectColumns =
        "id,title,description,subject_id,starts_at,due_at,priority,status,estimated_minutes,reminder_before_minutes,created_at,completed_at,subjects(name)";
      const selectColumns = `${baseSelectColumns}${recurrenceSupported ? ",recurrence_group_id,recurrence_type,recurrence_days,recurrence_until" : ""}`;
      if (editingDeadlineId) {
        const { data, error } = await supabase
          .from("tasks")
          .update(payload)
          .eq("id", editingDeadlineId)
          .select(selectColumns)
          .single();
        if (error) throw error;
        tasks = tasks.map((item) =>
          item.id === editingDeadlineId
            ? {
                recurrence_group_id: null,
                recurrence_type: "none",
                recurrence_days: [],
                recurrence_until: null,
                ...data,
                subject: data.subjects?.name || "Independent study",
              }
            : item,
        );
      } else {
        const repeatType = String(formData.get("repeat_type") || "none");
        if (repeatType !== "none" && !recurrenceSupported) {
          throw new Error(
            "Repeating deadlines need the latest Supabase migration. Apply supabase/migrations/001_studyzone_enhancements.sql first.",
          );
        }
        const recurrence = buildRecurrencePlan(formData, date, repeatType);
        const dateDuration = Math.round(
          (Date.UTC(
            endDate.getFullYear(),
            endDate.getMonth(),
            endDate.getDate(),
          ) -
            Date.UTC(
              startDate.getFullYear(),
              startDate.getMonth(),
              startDate.getDate(),
            )) /
            86400000,
        );
        const groupId = repeatType === "none" ? null : focusId();
        const instances = recurrence.dateKeys.map((occurrenceDate) => {
          const occurrenceEnd = new Date(`${occurrenceDate}T00:00:00`);
          const occurrenceStart = new Date(occurrenceEnd);
          occurrenceStart.setDate(occurrenceStart.getDate() - dateDuration);
          const startKey = dateKey(occurrenceStart);
          return {
            ...payload,
            starts_at:
              localDateTimeToIso(
                startKey,
                String(formData.get("due_time") || ""),
              ) || occurrenceStart.toISOString(),
            due_at: localDateTimeToIso(
              occurrenceDate,
              String(formData.get("due_time") || ""),
            ),
            ...(recurrenceSupported
              ? {
                  recurrence_group_id: groupId,
                  recurrence_type: repeatType,
                  recurrence_days: recurrence.days,
                  recurrence_until: recurrence.until,
                }
              : {}),
            status: "not_started",
            estimated_minutes: 30,
          };
        });
        const { data, error } = await supabase
          .from("tasks")
          .insert(instances)
          .select(selectColumns);
        if (error) throw error;
        tasks.unshift(
          ...(data || []).map((item) => ({
            recurrence_group_id: null,
            recurrence_type: "none",
            recurrence_days: [],
            recurrence_until: null,
            ...item,
            subject: item.subjects?.name || "Independent study",
          })),
        );
      }
    } else {
      if (editingDeadlineId) {
        tasks = tasks.map((item) =>
          item.id === editingDeadlineId
            ? {
                ...item,
                ...payload,
                subject: subjectName(subjectId),
                updated_at: new Date().toISOString(),
              }
            : item,
        );
      } else {
        const repeatType = String(formData.get("repeat_type") || "none");
        const recurrence = buildRecurrencePlan(formData, date, repeatType);
        const dateDuration = Math.round(
          (Date.UTC(
            endDate.getFullYear(),
            endDate.getMonth(),
            endDate.getDate(),
          ) -
            Date.UTC(
              startDate.getFullYear(),
              startDate.getMonth(),
              startDate.getDate(),
            )) /
            86400000,
        );
        const groupId =
          repeatType === "none" ? null : `local-series-${Date.now()}`;
        const instances = recurrence.dateKeys.map((occurrenceDate, index) => {
          const occurrenceEnd = new Date(`${occurrenceDate}T00:00:00`);
          const occurrenceStart = new Date(occurrenceEnd);
          occurrenceStart.setDate(occurrenceStart.getDate() - dateDuration);
          const startKey = dateKey(occurrenceStart);
          return {
            ...payload,
            starts_at:
              localDateTimeToIso(
                startKey,
                String(formData.get("due_time") || ""),
              ) || occurrenceStart.toISOString(),
            due_at: localDateTimeToIso(
              occurrenceDate,
              String(formData.get("due_time") || ""),
            ),
            recurrence_group_id: groupId,
            recurrence_type: repeatType,
            recurrence_days: recurrence.days,
            recurrence_until: recurrence.until,
            id: `local-${Date.now()}-${index}`,
            status: "not_started",
            estimated_minutes: 30,
            created_at: new Date().toISOString(),
            subject: subjectName(subjectId),
          };
        });
        tasks.unshift(...instances);
      }
      saveLocalTasks();
    }

    closeModal(document.getElementById("deadline-modal"));
    document.getElementById("deadline-form").reset();
    render();
    showToast(editingDeadlineId ? t.updateSuccess : t.saveSuccess);
    editingDeadlineId = null;
    return "saved";
  }

  async function toggleDeadline(id) {
    const t = deadlineText[appLanguage];
    const deadline = tasks.find((item) => item.id === id);
    if (!deadline || statusChangesInFlight.has(id)) return;
    const nextStatus =
      deadline.status === "completed" ? "not_started" : "completed";
    const completing = nextStatus === "completed";
    const previousRewards = rewardSummary ? { ...rewardSummary } : null;
    const card = [...document.querySelectorAll(".deadline-card")].find(
      (item) => item.dataset.deadlineId === id,
    );
    const button = card?.querySelector('[data-action="deadline-toggle"]');
    statusChangesInFlight.add(id);
    if (button) button.disabled = true;
    try {
      if (supabase && session) {
        const { error } = await supabase
          .from("tasks")
          .update({ status: nextStatus })
          .eq("id", id);
        if (error) throw error;
      }
      if (completing) await animateCompletionCard(card);
      deadline.status = nextStatus;
      deadline.completed_at = completing ? new Date().toISOString() : null;
      if (!supabase || !session) saveLocalTasks();
      render();
      showToast(completing ? t.completeSuccess : t.reopenSuccess);
      if (completing && supabase && session)
        await refreshRewardSummary({
          celebrate: true,
          previous: previousRewards,
        });
      if (completing) {
        const gained =
          previousRewards && rewardSummary
            ? Math.max(
                0,
                Number(rewardSummary.total_xp) -
                  Number(previousRewards.total_xp),
              )
            : 0;
        openCelebration("Deadline completed", deadline.title, gained, true);
      }
    } catch (error) {
      showToast(`${t.saveError} ${error.message}`);
      console.error("Could not change deadline status.", error);
    } finally {
      statusChangesInFlight.delete(id);
    }
  }

  async function deleteDeadline(id) {
    const t = deadlineText[appLanguage];
    const item = tasks.find((deadline) => deadline.id === id);
    if (!item) return;
    if (item.recurrence_group_id) {
      openSeriesScopeDialog("delete", item);
      return;
    }
    if (!window.confirm(t.deleteConfirm)) return;
    if (supabase && session) {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) {
        showToast(`${t.deleteError} ${error.message}`);
        console.error("Could not delete deadline.", error);
        return;
      }
    }
    tasks = tasks.filter((deadline) => deadline.id !== id);
    if (!supabase || !session) saveLocalTasks();
    render();
    showToast(t.deleteSuccess);
  }

  function showInfo(message) {
    showToast(message);
  }

  async function handleAuthSubmit(event) {
    event.preventDefault();
    if (!supabase) {
      showToast(
        "Set SUPABASE_URL and SUPABASE_ANON_KEY in supabase-config.js to enable sign-in.",
      );
      return;
    }
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "");
    const name = String(formData.get("name") || "").trim();
    const button = document.getElementById("auth-submit");
    const errorEl = document.getElementById("auth-error");
    button.disabled = true;
    errorEl.textContent = "";
    const result =
      authMode === "signup"
        ? await supabase.auth.signUp({
            email,
            password,
            options: { data: { full_name: name } },
          })
        : await supabase.auth.signInWithPassword({ email, password });
    button.disabled = false;
    if (result.error) {
      errorEl.textContent = result.error.message;
      translateInterface();
      return;
    }
    if (authMode === "signup" && !result.data.session) {
      errorEl.textContent = "Check your email to confirm your new account.";
      translateInterface();
      return;
    }
    session = result.data.session;
    window.StudyZoneOffline?.setUser?.(session?.user?.id || null);
    localStorage.setItem(authPromptStorageKey, "seen");
    closeModal(document.getElementById("auth-modal"));
    updateUserUi();
    beginRenderBatch();
    try {
      await verifyAdminAccess();
      await loadLanguagePreference();
      await loadRemoteTasks();
      await loadAccountWorkspace();
      await loadRemoteNotifications();
      await loadFocusData(true);
      await refreshRewardSummary();
    } finally {
      endRenderBatch();
    }
    syncWidgetData();
    showToast(
      authMode === "signup" ? "Your account is ready." : "Welcome back.",
    );
  }

  async function restoreSession() {
    if (!supabase) {
      session = null;
      updateUserUi();
      if (!localStorage.getItem(authPromptStorageKey)) {
        openModal(document.getElementById("auth-modal"));
        localStorage.setItem(authPromptStorageKey, "seen");
      }
      if (currentPage === "admin") await verifyAdminAccess();
      return;
    }
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.error("Could not restore the Supabase session.", error);
      showToast(`Could not restore session: ${error.message}`);
      if (!localStorage.getItem(authPromptStorageKey)) {
        openModal(document.getElementById("auth-modal"));
        localStorage.setItem(authPromptStorageKey, "seen");
      }
      if (currentPage === "admin") await verifyAdminAccess();
      return;
    }
    session = data.session;
    window.StudyZoneOffline?.setUser?.(session?.user?.id || null);
    if (session) localStorage.setItem(authPromptStorageKey, "seen");
    else if (!localStorage.getItem(authPromptStorageKey)) {
      openModal(document.getElementById("auth-modal"));
      localStorage.setItem(authPromptStorageKey, "seen");
    }
    updateUserUi();
    await verifyAdminAccess();
    if (session) {
      beginRenderBatch();
      try {
        await loadLanguagePreference();
        tasks = [];
        subjects = [];
        clearAccountWorkspace();
        // Offline-first: render cached local data instantly, then refresh from network
        const offline = window.StudyZoneOffline;
        const userId = session.user.id;
        if (offline) {
          const cachedSubjects = await offline.getCachedTableData(userId, "subjects");
          if (cachedSubjects) {
            subjects = cachedSubjects.map((s) => ({
              ...s,
              credits: s.credit_hours,
              progress: null,
            }));
          }
          const cachedTasks = await offline.getCachedTableData(userId, "tasks");
          if (cachedTasks) {
            tasks = cachedTasks.map((t) => ({
              recurrence_group_id: null,
              recurrence_type: "none",
              recurrence_days: [],
              recurrence_until: null,
              open_count: 0,
              completed_count: 0,
              postpone_count: 0,
              is_all_day: false,
              ...t,
              subject: t.subjects?.name || "Independent study",
            }));
          }
          scheduleRender();
        }
        await loadRemoteTasks();
        await loadAccountWorkspace();
        await loadRemoteNotifications();
        await loadFocusData(true);
        await refreshRewardSummary();
      } finally {
        endRenderBatch();
      }
    }
    supabase.auth.onAuthStateChange((_event, nextSession) => {
      session = nextSession;
      window.StudyZoneOffline?.setUser?.(session?.user?.id || null);
      adminAuthorization = {
        status: "unknown",
        userId: session?.user?.id || null,
      };
      updateUserUi();
      if (currentPage === "admin") render();
      if (session) {
        tasks = [];
        subjects = [];
        clearAccountWorkspace();
        window.setTimeout(async () => {
          beginRenderBatch();
          try {
            await verifyAdminAccess();
            await loadLanguagePreference();
            const offline = window.StudyZoneOffline;
            const userId = session.user.id;
            if (offline) {
              const cachedSubjects = await offline.getCachedTableData(userId, "subjects");
              if (cachedSubjects) {
                subjects = cachedSubjects.map((s) => ({
                  ...s,
                  credits: s.credit_hours,
                  progress: null,
                }));
              }
              const cachedTasks = await offline.getCachedTableData(userId, "tasks");
              if (cachedTasks) {
                tasks = cachedTasks.map((t) => ({
                  recurrence_group_id: null,
                  recurrence_type: "none",
                  recurrence_days: [],
                  recurrence_until: null,
                  open_count: 0,
                  completed_count: 0,
                  postpone_count: 0,
                  is_all_day: false,
                  ...t,
                  subject: t.subjects?.name || "Independent study",
                }));
              }
              scheduleRender();
            }
            await loadRemoteTasks();
            await loadAccountWorkspace();
            await loadRemoteNotifications();
            await loadFocusData(true);
            await refreshRewardSummary();
          } finally {
            endRenderBatch();
          }
          syncWidgetData();
        }, 0);
      } else {
        adminAuthorization = { status: "denied", userId: null };
        if (currentPage === "admin") denyAdminRoute(false);
        tasks = readLocalTasks();
        subjects = [
          {
            id: "subject-calculus",
            name: "Calculus II",
            color: "#6b7280",
            credits: 4,
            progress: 72,
          },
          {
            id: "subject-algorithms",
            name: "Algorithms",
            color: "#75CDB1",
            credits: 3,
            progress: 81,
          },
          {
            id: "subject-biology",
            name: "Biology",
            color: "#9ECDAF",
            credits: 3,
            progress: 64,
          },
          {
            id: "subject-history",
            name: "History",
            color: "#C1D79D",
            credits: 2,
            progress: 55,
          },
        ];
        resetAccountWorkspacePreview();
        document.getElementById("feature-modal")?.setAttribute("hidden", "");
        userNotifications = [];
        dailyReminderPreference = {
          enabled: false,
          local_time: "09:00",
          timezone: "UTC",
        };
        rewardSummary = null;
        earnedAchievements = [];
        focusLoadedIdentity = "";
        render();
        void loadFocusData(true);
      }
    });
  }

  function setAuthMode(mode) {
    authMode = mode;
    document
      .querySelectorAll(".auth-tab")
      .forEach((button) =>
        button.classList.toggle("selected", button.dataset.authMode === mode),
      );
    document.querySelector(".signup-only").hidden = mode !== "signup";
    document.getElementById("auth-submit").innerHTML =
      `${mode === "signup" ? "Create account" : "Sign in"} <span>→</span>`;
    document.getElementById("auth-error").textContent = "";
    translateInterface();
  }

  function formatTimer(seconds) {
    const clamped = Math.max(0, seconds);
    return `${String(Math.floor(clamped / 60)).padStart(2, "0")}:${String(clamped % 60).padStart(2, "0")}`;
  }

  function focusIdentity() {
    return session?.user?.id ? `user-${session.user.id}` : "guest";
  }

  function focusStorageKey(identity = focusIdentity()) {
    return `studyflow.focus.v1.${identity}`;
  }

  function normalizeFocusSettings(value) {
    const source = value && typeof value === "object" ? value : {};
    const normalized = { ...defaultFocusSettings };
    for (const key of [
      "focusMinutes",
      "shortBreakMinutes",
      "longBreakMinutes",
    ]) {
      const number = Number(source[key]);
      if (Number.isInteger(number) && number >= 1 && number <= 180)
        normalized[key] = number;
    }
    const interval = Number(source.longBreakInterval);
    if (Number.isInteger(interval) && interval >= 2 && interval <= 12)
      normalized.longBreakInterval = interval;
    for (const key of [
      "autoStartFocus",
      "autoStartBreaks",
      "soundEnabled",
      "browserNotifications",
      "showSeconds",
    ]) {
      if (typeof source[key] === "boolean") normalized[key] = source[key];
    }
    if (["compact", "default", "large"].includes(source.clockSize))
      normalized.clockSize = source.clockSize;
    if (typeof source.startSound === "string")
      normalized.startSound = ALERT_SOUNDS.some(
        (sound) => sound.id === source.startSound,
      )
        ? source.startSound
        : "focus-start";
    if (typeof source.endSound === "string")
      normalized.endSound = ALERT_SOUNDS.some(
        (sound) => sound.id === source.endSound,
      )
        ? source.endSound
        : "focus-end";
    if (typeof source.breakEndSound === "string")
      normalized.breakEndSound = ALERT_SOUNDS.some(
        (sound) => sound.id === source.breakEndSound,
      )
        ? source.breakEndSound
        : "break-end";
    if (Number(source.soundVolume) > 0)
      normalized.soundVolume = Math.max(
        0,
        Math.min(100, Number(source.soundVolume)),
      );
    if (Number(source.soundDuration) > 0)
      normalized.soundDuration = Math.max(
        3,
        Math.min(15, Number(source.soundDuration)),
      );
    if (typeof source.soundRepeat === "boolean")
      normalized.soundRepeat = source.soundRepeat;
    return normalized;
  }

  function loadFocusData(force = false) {
    const identity = focusIdentity();
    if (!force && focusLoadedIdentity === identity) {
      syncFocusTicker();
      return Promise.resolve();
    }
    focusLoadedIdentity = identity;
    focusDataError = "";
    let saved = null;
    try {
      const serialized = localStorage.getItem(focusStorageKey(identity));
      saved = serialized ? JSON.parse(serialized) : null;
      if (saved && typeof saved !== "object")
        throw new Error("Stored focus data is invalid.");
    } catch (error) {
      console.error("Could not read saved focus data.", error);
      focusDataError = error.message;
      showToast(focusText[appLanguage].dataError);
      saved = null;
    }
    focusSettings = normalizeFocusSettings(saved?.settings);
    const savedSession = saved?.timer;
    if (
      savedSession &&
      ["focus", "short_break", "long_break"].includes(savedSession.type)
    ) {
      focusSession = {
        ...focusSession,
        ...savedSession,
        cycle:
          Number.isInteger(savedSession.cycle) && savedSession.cycle > 0
            ? savedSession.cycle
            : 1,
        remainingMs: Number.isFinite(Number(savedSession.remainingMs))
          ? Math.max(0, Number(savedSession.remainingMs))
          : getFocusDurationMs(savedSession.type),
      };
    } else {
      focusSession = createFocusSession("focus", 1);
    }
    focusRecords =
      identity === "guest" && Array.isArray(saved?.records)
        ? saved.records
        : [];
    pendingFocusRecords = Array.isArray(saved?.pendingRecords)
      ? saved.pendingRecords
      : [];
    if (!session) {
      reconcileFocusTimer();
      if (currentPage === "focus") scheduleRender();
      syncFocusTicker();
      return Promise.resolve();
    }

    return (async () => {
      const { data: settingsRow, error: settingsError } = await supabase
        .from("user_settings")
        .select("focus_settings")
        .maybeSingle();
      if (settingsError) {
        focusDataError = settingsError.message;
        console.error("Could not load focus settings.", settingsError);
        showToast(
          `${focusText[appLanguage].settingsError} ${settingsError.message}`,
        );
      } else if (settingsRow?.focus_settings) {
        focusSettings = normalizeFocusSettings(settingsRow.focus_settings);
      }
      const { data, error } = await supabase
        .from("study_sessions")
        .select(
          "id,idempotency_key,session_type,started_at,ended_at,duration_seconds,completed,subject_id,task_id",
        )
        .order("started_at", { ascending: false })
        .limit(500);
      if (error) {
        focusDataError = error.message;
        console.error("Could not load focus history.", error);
        showToast(`${focusText[appLanguage].dataError} ${error.message}`);
        focusRecords = [];
      } else {
        focusRecords = data || [];
      }
      updateActivityFromFocusRecords();
      reconcileFocusTimer();
      if (!error && pendingFocusRecords.length) {
        for (const record of [...pendingFocusRecords])
          await persistFocusRecord(record);
      }
      updateActivityFromFocusRecords();
      if (
        currentPage === "focus" ||
        currentPage === "dashboard" ||
        currentPage === "analytics"
      )
        scheduleRender();
      syncFocusTicker();
    })();
  }

  function createFocusSession(type, cycle, context = focusSession) {
    return {
      id: focusId(),
      type,
      cycle,
      status: "idle",
      remainingMs:
        type === "focus" && Number(context?.durationMinutes) >= 1
          ? Math.min(180, Number(context.durationMinutes)) * 60000
          : focusDurationFor(type) * 60000,
      endAt: null,
      runStartedAt: null,
      elapsedBeforeRunMs: 0,
      startedAt: null,
      remoteStarted: false,
      subjectId: context?.subjectId || "",
      taskId: context?.taskId || "",
      goal: context?.goal || "",
      tools: context?.tools || "",
      durationMinutes: Number(context?.durationMinutes) || null,
      pendingRecord: null,
    };
  }

  // Snapshot the timer with both the internal field names and the documented
  // persistence contract. The internal names drive restore; the alias names
  // (session_id, remaining_seconds, ...) make the stored payload auditable and
  // forward-compatible without changing the restore path.
  function focusSessionSnapshot(now = Date.now()) {
    const status = focusSession.status || "idle";
    const remainingSeconds = Math.round(getFocusRemainingMs(now) / 1000);
    const elapsedSeconds = Math.round(getFocusElapsedMs(now) / 1000);
    const selectedDuration =
      Number(focusSession.durationMinutes) >= 1
        ? Math.round(Number(focusSession.durationMinutes) * 60)
        : Math.round(getFocusDurationMs(focusSession.type) / 1000);
    return {
      ...focusSession,
      session_id: focusSession.id,
      user_id: session?.user?.id || null,
      selected_duration: selectedDuration,
      session_type: focusSession.type,
      paused_at:
        status === "paused"
          ? focusSession.pausedAt || new Date(now).toISOString()
          : null,
      accumulated_elapsed_seconds: elapsedSeconds,
      remaining_seconds: remainingSeconds,
      status,
      completed_at:
        status === "completed"
          ? focusSession.completedAt || new Date(now).toISOString()
          : null,
    };
  }

  function persistFocusState() {
    try {
      const value = {
        settings: focusSettings,
        timer: focusSessionSnapshot(),
        ...(session
          ? { pendingRecords: pendingFocusRecords }
          : { records: focusRecords }),
      };
      localStorage.setItem(focusStorageKey(), JSON.stringify(value));
      // Keep the native completion alarm in sync immediately after start,
      // pause, resume, finish and restore. Without this the alarm was only
      // refreshed on the next 5s tick or lifecycle event.
      try {
        const focus = window.StudyZoneApp?.focus;
        if (focus) {
          window.StudyZoneNotifications?.syncFocusReminder?.(focus);
        }
      } catch (error) {
        console.warn("Could not sync the native focus reminder.", error);
      }
    } catch (error) {
      console.error("Could not persist focus state.", error);
      showToast(`${focusText[appLanguage].settingsError} ${error.message}`);
    }
  }

  function reconcileFocusTimer() {
    if (
      focusSession.status === "running" &&
      focusSession.endAt &&
      Date.now() >= focusSession.endAt
    ) {
      void finishFocusTimer();
    } else {
      persistFocusState();
    }
  }

  function clearFocusTicker() {
    if (focusTicker) window.clearTimeout(focusTicker);
    focusTicker = null;
  }

  /**
   * Aligns the next tick with the next whole second derived from `endAt`.
   * Every tick recomputes the remaining time from the timestamp, so throttled
   * or suspended timers can never accumulate drift.
   */
  function scheduleFocusTick() {
    clearFocusTicker();
    if (currentPage !== "focus" || focusSession.status !== "running") return;
    const remaining = getFocusRemainingMs();
    if (remaining <= 0) {
      void finishFocusTimer();
      return;
    }
    const remainder = remaining % 1000;
    const delay = Math.min(
      1100,
      Math.max(32, (remainder === 0 ? 1000 : remainder) + 18),
    );
    focusTicker = window.setTimeout(() => {
      focusTicker = null;
      if (currentPage !== "focus" || focusSession.status !== "running") return;
      if (getFocusRemainingMs() <= 0) {
        void finishFocusTimer();
        return;
      }
      updateTimerUi();
      scheduleFocusTick();
    }, delay);
  }

  function syncFocusTicker() {
    const shouldTick =
      currentPage === "focus" && focusSession.status === "running";
    if (!shouldTick) {
      clearFocusTicker();
      return;
    }
    if (!focusTicker) scheduleFocusTick();
  }

  function updateTimerUi() {
    const clock = document.getElementById("flip-clock");
    if (!clock) return;
    const focusPage = document.querySelector(".focus-page");
    if (focusPage) focusPage.dataset.sessionStatus = focusSession.status;
    const remaining = getFocusRemainingMs();
    const seconds = Math.max(0, Math.ceil(remaining / 1000));
    const minutes = String(Math.floor(seconds / 60)).padStart(2, "0");
    const secondText = String(seconds % 60).padStart(2, "0");
    const digits = [
      ...minutes,
      ...(focusSettings.showSeconds ? [...secondText] : []),
    ];
    clock.setAttribute("aria-label", formatTimer(seconds));
    clock.querySelectorAll(".flip-digit").forEach((element, index) => {
      const next = digits[index];
      if (next !== undefined) flipDigitTo(element, next);
    });
    const duration = getFocusDurationMs();
    const progress = Math.min(
      100,
      Math.max(0, ((duration - remaining) / duration) * 100),
    );
    const fill = document.getElementById("focus-progress-fill");
    if (fill)
      fill.style.setProperty("--focus-progress", (progress / 100).toFixed(4));
    const bar = document.querySelector(".focus-progress");
    if (bar) bar.setAttribute("aria-valuenow", String(Math.round(progress)));
    const button = document.getElementById("timer-toggle");
    if (button)
      button.textContent =
        focusSession.status === "running"
          ? focusText[appLanguage].pause
          : focusSession.status === "paused"
            ? focusText[appLanguage].resume
            : focusText[appLanguage].start;
    const message = document.getElementById("focus-session-message");
    if (message)
      message.textContent =
        focusSession.type === "focus"
          ? focusSession.status === "running"
            ? focusText[appLanguage].stayFocused
            : focusSession.status === "paused"
              ? focusText[appLanguage].paused
              : focusText[appLanguage].focusHint
          : focusText[appLanguage].breakHint;
  }

  async function startFocusTimer() {
    if (focusSession.status === "running") return;
    const now = Date.now();
    const linkedTaskId =
      focusSession.taskId && !String(focusSession.taskId).startsWith("routine:")
        ? focusSession.taskId
        : null;
    if (supabase && session) {
      try {
        const { error: startError, data: startData } = await supabase
          .from("study_sessions")
          .upsert(
            {
              idempotency_key: focusSession.id,
              session_type: focusSession.type,
              started_at: focusSession.startedAt || new Date(now).toISOString(),
              ended_at: null,
              duration_seconds: Math.round(
                getFocusDurationMs(focusSession.type) / 1000,
              ),
              completed: false,
              subject_id: focusSession.subjectId || null,
              task_id: linkedTaskId,
              updated_at: new Date(now).toISOString(),
            },
            { onConflict: "idempotency_key" },
          )
          .select(
            "id,idempotency_key,session_type,started_at,ended_at,duration_seconds,completed,subject_id,task_id",
          )
          .single();
        if (startError) {
          focusDataError = startError.message;
          console.error(
            "Could not start the verified focus session.",
            startError,
          );
          showToast(
            `${focusText[appLanguage].sessionError} ${startError.message}`,
          );
          return;
        }
        if (!focusSession.startedAt)
          focusSession.startedAt =
            startData?.started_at || new Date(now).toISOString();
        focusSession.remoteStarted = true;
        focusSession.remainingMs = Math.max(
          0,
          getFocusDurationMs(focusSession.type),
        );
      } catch (error) {
        focusDataError = error.message;
        console.error(
          "Could not start the verified focus session.",
          error,
        );
        showToast(`${focusText[appLanguage].sessionError} ${error.message}`);
        return;
      }
    } else if (!focusSession.startedAt) {
      focusSession.startedAt = new Date(now).toISOString();
    }
    focusSession.status = "running";
    focusSession.runStartedAt = now;
    focusSession.endAt = now + focusSession.remainingMs;
    if (focusSettings.soundEnabled && focusSession.type === "focus") {
      void startAlert({
        key: `focus-start-${focusSession.id}`,
        soundId: focusSettings.startSound || "focus-start",
        volume: focusSettings.soundVolume,
        duration: focusSettings.soundDuration,
        repeat: false,
      });
    }
    persistFocusState();
    updateTimerUi();
    syncFocusTicker();
  }

  async function pauseFocusTimer() {
    if (focusSession.status !== "running") return;
    const now = Date.now();
    const elapsedMs = Math.max(0, now - focusSession.runStartedAt);
    const totalElapsedMs =
      focusSession.elapsedBeforeRunMs + elapsedMs;
    if (supabase && session && focusSession.remoteStarted) {
      try {
        const { error: pauseError } = await supabase
          .from("study_sessions")
          .update({
            ended_at: new Date(now).toISOString(),
            duration_seconds: Math.floor(totalElapsedMs / 1000),
            updated_at: new Date(now).toISOString(),
          })
          .eq("idempotency_key", focusSession.id);
        if (pauseError) {
          console.error(
            "Could not pause the verified focus session.",
            pauseError,
          );
          showToast(
            `${focusText[appLanguage].sessionError} ${pauseError.message}`,
          );
          return;
        }
      } catch (error) {
        console.error(
          "Could not pause the verified focus session.",
          error,
        );
        showToast(
          `${focusText[appLanguage].sessionError} ${error.message}`,
        );
        return;
      }
    }
    focusSession.remainingMs = Math.max(
      0,
      getFocusDurationMs(focusSession.type) - totalElapsedMs,
    );
    focusSession.elapsedBeforeRunMs = totalElapsedMs;
    focusSession.runStartedAt = null;
    focusSession.endAt = null;
    focusSession.status = "paused";
    persistFocusState();
    updateTimerUi();
    syncFocusTicker();
  }

  function makeFocusRecord(completed) {
    if (!focusSession.startedAt || getFocusElapsedMs() < 1000) return null;
    const elapsed = Math.min(getFocusDurationMs(), getFocusElapsedMs());
    return {
      idempotency_key: focusSession.id,
      session_type: focusSession.type,
      started_at: focusSession.startedAt,
      ended_at: new Date().toISOString(),
      duration_seconds: Math.max(1, Math.floor(elapsed / 1000)),
      completed,
      subject_id: focusSession.subjectId || null,
      task_id:
        focusSession.taskId && !String(focusSession.taskId).startsWith("routine:")
          ? focusSession.taskId
          : null,
    };
  }

  async function persistFocusRecord(record) {
    if (!record) return;
    if (focusRecordSavesInFlight.has(record.idempotency_key)) return false;
    focusRecordSavesInFlight.add(record.idempotency_key);
    if (!session) {
      if (
        !focusRecords.some(
          (item) => item.idempotency_key === record.idempotency_key,
        )
      )
        focusRecords.unshift(record);
      persistFocusState();
      updateActivityFromFocusRecords();
      focusRecordSavesInFlight.delete(record.idempotency_key);
      return true;
    }
    if (
      !pendingFocusRecords.some(
        (item) => item.idempotency_key === record.idempotency_key,
      )
    )
      pendingFocusRecords.push(record);
    focusSaving = true;
    persistFocusState();
    if (
      navigator.onLine === false ||
      window.StudyZoneOffline?.isOnline?.() === false
    ) {
      void window.StudyZoneOffline?.queueFocusRecord?.(record);
      focusSaving = false;
      focusDataError = "";
      updateActivityFromFocusRecords();
      persistFocusState();
      focusRecordSavesInFlight.delete(record.idempotency_key);
      if (currentPage === "focus") render();
      showToast("This change is saved on this device.");
      return true;
    }
    let rpcError;
    try {
      const { error: insertError, data: insertedData } = await supabase
        .from("study_sessions")
        .upsert(
          {
            idempotency_key: record.idempotency_key,
            session_type: record.session_type,
            started_at: record.started_at,
            ended_at: record.ended_at,
            duration_seconds: record.duration_seconds,
            completed: record.completed,
            subject_id: record.subject_id,
            task_id: record.task_id,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "idempotency_key" },
        )
        .select(
          "id,idempotency_key,session_type,started_at,ended_at,duration_seconds,completed,subject_id,task_id",
        )
        .single();
      if (insertError) {
        rpcError = insertError;
      } else {
        data = insertedData;
      }
    } catch (error) {
      rpcError = error;
    }
    if (rpcError) {
      focusDataError = rpcError.message || String(rpcError);
      focusSaving = false;
      updateActivityFromFocusRecords();
      focusRecordSavesInFlight.delete(record.idempotency_key);
      console.error("Could not save focus session.", rpcError);
      showToast(`${focusText[appLanguage].sessionError} ${focusDataError}`);
      render();
      return false;
    }
    if (!data) {
      if (
        navigator.onLine === false ||
        window.StudyZoneOffline?.isOnline?.() === false
      ) {
        focusSaving = false;
        focusDataError = "";
        focusRecordSavesInFlight.delete(record.idempotency_key);
        persistFocusState();
        if (currentPage === "focus") render();
        return true;
      }
      focusDataError = "The verified focus record could not be saved.";
      focusSaving = false;
      focusRecordSavesInFlight.delete(record.idempotency_key);
      console.error("Could not save focus session: no data returned.");
      showToast(`${focusText[appLanguage].dataError} ${focusDataError}`);
      return false;
    }
    pendingFocusRecords = pendingFocusRecords.filter(
      (item) => item.idempotency_key !== record.idempotency_key,
    );
    focusRecords = focusRecords.filter(
      (item) => item.idempotency_key !== record.idempotency_key,
    );
    focusRecords.unshift(data);
    focusSaving = false;
    focusDataError = "";
    focusRecordSavesInFlight.delete(record.idempotency_key);
    updateActivityFromFocusRecords();
    persistFocusState();
    if (currentPage === "focus") render();
    if (record.completed && record.session_type === "focus")
      await refreshRewardSummary({ celebrate: true });
    void window.StudyZoneApp?.syncWidgets?.();
    return true;
  }

  function playFocusCompletion() {
    if (focusSettings.soundEnabled) {
      void startAlert({
        key: `focus-end-${focusSession.type}-${focusSession.cycle}`,
        soundId:
          focusSession.type === "short_break" ||
          focusSession.type === "long_break"
            ? focusSettings.breakEndSound
            : focusSettings.endSound,
        volume: focusSettings.soundVolume,
        duration: focusSettings.soundDuration,
        repeat: focusSettings.soundRepeat,
      });
    }
    if (
      focusSettings.browserNotifications &&
      "Notification" in window &&
      Notification.permission === "granted"
    ) {
      try {
        const notificationOptions = {
          body:
            focusSession.type === "focus"
              ? focusText[appLanguage].focusCompleted
              : focusText[appLanguage].breakCompleted,
          icon: "./icon.svg",
          badge: "./icons/icon-192.png",
          tag: "studyflow-focus-completion",
          renotify: true,
          data: {
            url: `${window.location.origin}${window.location.pathname}#/focus`,
          },
        };
        if ("serviceWorker" in navigator) {
          const registration = navigator.serviceWorker.ready;
          if (registration?.showNotification)
            registration.showNotification(
              focusText[appLanguage].title,
              notificationOptions,
            );
          else
            new Notification(focusText[appLanguage].title, notificationOptions);
        } else {
          new Notification(focusText[appLanguage].title, notificationOptions);
        }
      } catch (error) {
        console.error(
          "Could not show the focus completion notification.",
          error,
        );
      }
    }
  }

  async function finishFocusTimer() {
    if (focusSession.status !== "running") return;
    const finishedType = focusSession.type;
    const record = makeFocusRecord(true);
    const previousRewards = rewardSummary ? { ...rewardSummary } : null;
    focusSession.status = "completed";
    focusSession.remainingMs = 0;
    focusSession.endAt = null;
    focusSession.runStartedAt = null;
    persistFocusState();
    syncFocusTicker();
    playFocusCompletion();
    const text = focusText[appLanguage];
    if (record) await persistFocusRecord(record);
    const completedFocus = focusRecords.filter(
      (item) => item.session_type === "focus" && item.completed,
    ).length;
    let nextType;
    let nextCycle;
    let autoStart;
    if (finishedType === "focus") {
      nextType =
        completedFocus % focusSettings.longBreakInterval === 0
          ? "long_break"
          : "short_break";
      nextCycle = (completedFocus % focusSettings.longBreakInterval) + 1;
      autoStart = focusSettings.autoStartBreaks;
      showToast(text.focusCompleted);
      if (shouldUseFullMotion()) launchConfetti();
      const currentXp = Number(rewardSummary?.total_xp) || 0;
      const earnedXp = previousRewards
        ? Math.max(0, currentXp - Number(previousRewards.total_xp))
        : 0;
      const duration = formatFocusDuration(
        record?.duration_seconds ||
          Math.floor(getFocusDurationMs("focus") / 1000),
        text,
      );
      const count = new Intl.NumberFormat(focusLocale()).format(completedFocus);
      const detail = text.focusRewardDetail
        .replace("{duration}", duration)
        .replace("{count}", count);
      const fullCycle =
        completedFocus > 0 &&
        completedFocus % focusSettings.longBreakInterval === 0;
      openCelebration(
        fullCycle ? text.cycleCompletedTitle : text.focusCompletedTitle,
        detail,
        earnedXp,
      );
    } else {
      nextType = "focus";
      nextCycle = (completedFocus % focusSettings.longBreakInterval) + 1;
      autoStart = focusSettings.autoStartFocus;
      showToast(text.breakCompleted);
    }
    focusSession = createFocusSession(nextType, nextCycle, focusSession);
    persistFocusState();
    if (currentPage === "focus") render();
    if (autoStart) startFocusTimer();
  }

  async function skipFocusSession() {
    const record =
      focusSession.type === "focus" ? makeFocusRecord(false) : null;
    const currentType = focusSession.type;
    if (focusSession.status === "running") {
      await pauseFocusTimer();
      if (focusSession.status === "running") return;
    }
    if (record) await persistFocusRecord(record);
    const count = focusRecords.filter(
      (item) => item.session_type === "focus" && item.completed,
    ).length;
    const nextType = currentType === "focus" ? "short_break" : "focus";
    focusSession = createFocusSession(
      nextType,
      (count % focusSettings.longBreakInterval) + 1,
      focusSession,
    );
    persistFocusState();
    render();
    syncFocusTicker();
  }

  async function resetFocusSession() {
    const record = makeFocusRecord(false);
    if (record) await persistFocusRecord(record);
    focusSession = createFocusSession(
      focusSession.type,
      focusSession.cycle,
      focusSession,
    );
    persistFocusState();
    render();
    syncFocusTicker();
  }

  async function saveFocusSettings(form) {
    const data = new FormData(form);
    const settings = normalizeFocusSettings({
      focusMinutes: Number(data.get("focusMinutes")),
      shortBreakMinutes: Number(data.get("shortBreakMinutes")),
      longBreakMinutes: Number(data.get("longBreakMinutes")),
      longBreakInterval: Number(data.get("longBreakInterval")),
      autoStartFocus: data.has("autoStartFocus"),
      autoStartBreaks: data.has("autoStartBreaks"),
      soundEnabled: data.has("soundEnabled"),
      browserNotifications: data.has("browserNotifications"),
      showSeconds: data.has("showSeconds"),
      clockSize: String(data.get("clockSize") || "default"),
      startSound: String(data.get("startSound") || "focus-start"),
      endSound: String(data.get("endSound") || "focus-end"),
      breakEndSound: String(data.get("breakEndSound") || "break-end"),
      soundVolume: Number(data.get("soundVolume") || 80),
      soundDuration: Number(data.get("soundDuration") || 5),
      soundRepeat: data.has("soundRepeat"),
    });
    const integerFields = [
      "focusMinutes",
      "shortBreakMinutes",
      "longBreakMinutes",
      "longBreakInterval",
    ];
    if (
      integerFields.some((key) => !Number.isInteger(Number(data.get(key)))) ||
      settings.focusMinutes !== Number(data.get("focusMinutes")) ||
      settings.shortBreakMinutes !== Number(data.get("shortBreakMinutes")) ||
      settings.longBreakMinutes !== Number(data.get("longBreakMinutes")) ||
      settings.longBreakInterval !== Number(data.get("longBreakInterval"))
    ) {
      throw new Error(focusText[appLanguage].invalidSettings);
    }
    if (settings.browserNotifications) {
      if (!("Notification" in window))
        throw new Error(focusText[appLanguage].notificationsUnsupported);
      const permission =
        Notification.permission === "default"
          ? await Notification.requestPermission()
          : Notification.permission;
      if (permission !== "granted") {
        settings.browserNotifications = false;
        throw new Error(
          permission === "denied"
            ? focusText[appLanguage].notificationsDenied
            : focusText[appLanguage].notificationsUnsupported,
        );
      }
    }
    if (session) {
      const { data: existing, error: readError } = await supabase
        .from("user_settings")
        .select("user_id")
        .maybeSingle();
      if (readError) throw readError;
      const query = existing
        ? supabase
            .from("user_settings")
            .update({ focus_settings: settings })
            .eq("user_id", session.user.id)
        : supabase.from("user_settings").insert({ focus_settings: settings });
      const { error } = await query;
      if (error) throw error;
    }
    focusSettings = settings;
    if (focusSession.status === "idle") {
      focusSession.remainingMs = getFocusDurationMs();
      focusSession.endAt = null;
      focusSession.runStartedAt = null;
    }
    persistFocusState();
    focusSettingsOpen = false;
    render();
    showToast(focusText[appLanguage].settingsSaved);
  }

  function updateFocusContext() {
    const task = tasks.find(
      (item) => String(item.id) === String(focusSession.taskId),
    );
    if (task?.subject_id) focusSession.subjectId = task.subject_id;
    persistFocusState();
    render();
  }

  function attachFocusListeners() {
    document
      .getElementById("focus-settings-form")
      ?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const error = document.getElementById("focus-settings-error");
        const button = form.querySelector('button[type="submit"]');
        error.textContent = "";
        button.disabled = true;
        try {
          await saveFocusSettings(form);
        } catch (reason) {
          error.textContent =
            reason?.message || focusText[appLanguage].settingsError;
          console.error("Focus settings save failed.", reason);
        } finally {
          const currentButton = document.querySelector(
            '#focus-settings-form button[type="submit"]',
          );
          if (currentButton) currentButton.disabled = false;
        }
      });
    document
      .getElementById("focus-subject")
      ?.addEventListener("change", (event) => {
        focusSession.subjectId = event.target.value;
        focusSession.taskId = "";
        persistFocusState();
        render();
      });
    document
      .getElementById("focus-task")
      ?.addEventListener("change", (event) => {
        focusSession.taskId = event.target.value;
        updateFocusContext();
      });
  }

  document.addEventListener("dragover", (event) => {
    if (event.target.closest && event.target.closest("#media-editor-modal .media-editor-preview, #media-editor-modal .media-editor-grid")) {
      event.preventDefault();
    }
  });
  document.addEventListener("drop", async (event) => {
    const zone = event.target.closest && event.target.closest("#media-editor-modal .media-editor-preview, #media-editor-modal .media-editor-grid");
    if (!zone || !mediaEditorDraft) return;
    event.preventDefault();
    syncMediaDraftFromInputs();
    const files = Array.from(event.dataTransfer?.files || []);
    if (!files.length) return;
    // infer kind from first supported file, fallback to current mode
    const first = files[0];
    const kind = (first?.type || "").startsWith("video/") ? "video" : (first?.type || "").startsWith("image/") ? "image" : (mediaEditorDraft.mode || "image");
    await addFilesToMediaDraft(files, kind, null);
  });

  document.addEventListener("change", (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.id !== "profile-avatar-file") return;
    const file = input.files && input.files[0];
    const preview = document.getElementById("profile-avatar-preview");
    if (!preview || !file) return;
    const url = URL.createObjectURL(file);
    preview.innerHTML = `<img id="profile-avatar-preview-img" src="${url}" alt="" style="width:72px;height:72px;border-radius:50%;object-fit:cover;display:block;" />`;
    // revoke on next change/save by storing on element
    if (preview._avatarPreviewUrl) { try { URL.revokeObjectURL(preview._avatarPreviewUrl); } catch {} }
    preview._avatarPreviewUrl = url;
  });

  document.addEventListener("submit", async (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || form.id !== "daily-reminder-form")
      return;
    event.preventDefault();
    const submit = form.querySelector('[type="submit"]');
    const errorEl = form.querySelector("[data-reminder-error]");
    submit.disabled = true;
    errorEl.textContent = "";
    try {
      await saveDailyReminder(form);
    } catch (error) {
      console.error("Could not save daily reminder settings.", error);
      errorEl.textContent =
        `${translateUiText("Could not save your reminder.")} ${error.message || ""}`.trim();
    } finally {
      submit.disabled = false;
    }
  });

  document.addEventListener("click", async (event) => {
    const target = event.target.closest(
      "[data-page], [data-navigate], [data-action], [data-motion-level], [data-close-modal], [data-deadline-filter], [data-deadline-view], [data-language], #open-auth, #top-profile, #mobile-menu, #timer-toggle, #timer-reset, #timer-skip, [data-auth-mode], #sign-out, [data-theme-preset-option], [data-visual-style-option], [data-animation-intensity], [data-animation-speed]",
    );
    if (!target) return;
    if (target.matches("[data-page], [data-navigate]")) {
      event.preventDefault();
      navigate(target.dataset.page || target.dataset.navigate);
    } else if (target.matches("[data-language]")) {
      await setLanguage(target.dataset.language);
    } else if (target.matches("[data-deadline-filter]")) {
      deadlineFilter = target.dataset.deadlineFilter;
      render();
    } else if (target.matches("[data-deadline-view]")) {
      deadlineView = target.dataset.deadlineView;
      render();
    } else if (target.matches('[data-action="new-task"]')) {
      openTaskModal(null, target.dataset.date || dateKey(taskViewDate));
    } else if (target.matches('[data-action="task-edit"]')) {
      openTaskModal(target.dataset.id);
    } else if (target.matches('[data-action="routine-edit"]')) {
      const routine = routines.find(
        (item) => String(item.id) === String(target.dataset.id),
      );
      if (routine) openTaskModal(null, null, { routine });
    } else if (target.matches('[data-action="routine-skip"]')) {
      await skipRoutineOccurrence(target.dataset.id, target.dataset.date);
    } else if (target.matches('[data-action="routine-toggle-pause"]')) {
      await toggleRoutinePause(target.dataset.id);
    } else if (target.matches('[data-action="routine-delete"]')) {
      await deleteRoutineById(target.dataset.id);
    } else if (target.matches('[data-action="move-task"]')) {
      openMoveTaskModal(target.dataset.id);
    } else if (target.matches('[data-action="task-select-day"]')) {
      const nextDate = parseLocalDateKey(target.dataset.date);
      if (nextDate) {
        taskViewDate = nextDate;
        taskViewMode = "day";
        render();
      }
    } else if (target.matches('[data-action="task-view-mode"]')) {
      taskViewMode = target.dataset.mode === "all" ? "all" : "day";
      localStorage.setItem(
        taskDayStorageKey,
        JSON.stringify({ mode: taskViewMode }),
      );
      render();
    } else if (target.matches('[data-action="task-prev-day"]')) {
      taskViewDate = addLocalDays(taskViewDate, -1);
      render();
    } else if (target.matches('[data-action="task-next-day"]')) {
      taskViewDate = addLocalDays(taskViewDate, 1);
      render();
    } else if (target.matches('[data-action="task-today"]')) {
      taskViewDate = startOfLocalDay(new Date());
      taskViewMode = "day";
      localStorage.setItem(
        taskDayStorageKey,
        JSON.stringify({ mode: taskViewMode }),
      );
      render();
    } else if (target.matches('[data-action="toggle-task-completed"]')) {
      taskShowCompleted = !taskShowCompleted;
      localStorage.setItem(
        "studyzone.show-completed",
        String(taskShowCompleted),
      );
      render();
    } else if (target.matches('[data-action="toggle-smart-sort"]')) {
      smartSortEnabled = !smartSortEnabled;
      render();
      showToast(
        smartSortEnabled
          ? appLanguage === "ar"
            ? "تم تفعيل الترتيب الذكي. يمكنك العودة للترتيب اليدوي في أي وقت."
            : "Smart order enabled. You can switch back to manual order anytime."
          : appLanguage === "ar"
            ? "تمت العودة إلى الترتيب اليدوي."
            : "Manual order restored.",
      );
    } else if (target.matches('[data-action="toggle-task-section"]')) {
      const key = target.dataset.section;
      taskSectionState[key] = taskSectionState[key] === false;
      render();
    } else if (target.matches('[data-action="series-scope"]')) {
      await applySeriesAction(target.dataset.scope);
    } else if (target.matches('[data-action="task-stop-series"]')) {
      const form = document.getElementById("task-form");
      const task = tasks.find(
        (item) => String(item.id) === String(form.elements.task_id.value),
      );
      if (task) await stopTaskSeries(task);
    } else if (target.matches('[data-action="deadline-add"]')) {
      openDeadlineModal();
    } else if (target.matches('[data-action="deadline-edit"]')) {
      openDeadlineModal(target.dataset.id);
    } else if (target.matches('[data-action="deadline-toggle"]')) {
      await toggleDeadline(target.dataset.id);
    } else if (target.matches('[data-action="deadline-delete"]')) {
      await deleteDeadline(target.dataset.id);
    } else if (target.matches('[data-action="subject-add"]')) {
      openFeatureForm("subject");
    } else if (target.matches('[data-action="subject-edit"]')) {
      openFeatureForm("subject", target.dataset.id);
    } else if (target.matches('[data-action="subject-delete"]')) {
      await deleteFeatureRecord("subject", target.dataset.id);
    } else if (target.matches('[data-action="schedule-add"]')) {
      openFeatureForm("schedule");
    } else if (target.matches('[data-action="schedule-edit"]')) {
      openFeatureForm("schedule", target.dataset.id);
    } else if (target.matches('[data-action="schedule-delete"]')) {
      await deleteFeatureRecord("schedule", target.dataset.id);
    } else if (target.matches('[data-action="file-add"]')) {
      openFeatureForm("file");
    } else if (target.matches('[data-action="file-download"]')) {
      await downloadStudyFile(target.dataset.id);
    } else if (target.matches('[data-action="file-delete"]')) {
      await deleteFeatureRecord("file", target.dataset.id);
    } else if (target.matches('[data-action="team-create"]')) {
      openTeamModal();
    } else if (target.matches('[data-action="team-join"]')) {
      openTeamJoinModal();
    } else if (target.matches('[data-action="team-select"]')) {
      selectedTeamId = target.dataset.id;
      render();
    } else if (
      target.matches(
        '[data-action="team-refresh"], [data-action="teams-retry"]',
      )
    ) {
      teamsError = "";
      teamsLoaded = false;
      void loadTeams();
    } else if (target.matches('[data-action="team-delete"]')) {
      const team = teams.find(
        (item) => String(item.id) === String(selectedTeamId),
      );
      if (team) await deleteTeam(team);
    } else if (target.matches('[data-action="team-leave"]')) {
      const team = teams.find(
        (item) => String(item.id) === String(selectedTeamId),
      );
      if (team) await leaveTeam(team);
    } else if (target.matches('[data-action="team-task-toggle"]')) {
      await toggleTeamTask(target.dataset.id);
    } else if (target.matches('[data-action="team-task-delete"]')) {
      await deleteTeamTask(target.dataset.id);
    } else if (target.matches('[data-action="team-member-role"]')) {
      const teamId = target.dataset.teamId;
      const userId = target.dataset.userId;
      const role = ["owner", "admin", "member"].includes(
        String(target.dataset.role || "member"),
      )
        ? String(target.dataset.role)
        : "member";
      const member = teamMembers.find(
        (item) =>
          String(item.team_id) === String(teamId) &&
          String(item.user_id) === String(userId),
      );
      if (!member) return;
      if (
        member.role === "owner" &&
        role !== "owner" &&
        !window.confirm(
          appLanguage === "ar"
            ? "ستزيل المالك الحالي؟ سيتولى أحد المسؤولين هذا الدور."
            : "Remove the current owner? An admin will take over this role.",
        )
      )
        return;
      await updateTeamMemberRole(teamId, userId, role);
    } else if (target.matches('[data-action="team-member-remove"]')) {
      const teamId = target.dataset.teamId;
      const userId = target.dataset.userId;
      const member = teamMembers.find(
        (item) =>
          String(item.team_id) === String(teamId) &&
          String(item.user_id) === String(userId),
      );
      if (!member) return;
      const confirmed =
        appLanguage === "ar"
          ? "إزالة هذا العضو من الفريق؟"
          : "Remove this member from the team?";
      if (!window.confirm(confirmed)) return;
      await removeTeamMember(teamId, userId);
    } else if (target.matches('[data-action="team-join-review"]')) {
      const approve = String(target.dataset.approve) === "true";
      const request = teamJoinRequests.find(
        (item) => String(item.id) === String(target.dataset.id),
      );
      if (request) await reviewTeamJoinRequest(request.id, approve);
    } else if (target.matches('[data-action="team-invite"]')) {
      await sendTeamInvite(target.dataset.teamId);
    } else if (target.matches('[data-action="team-request-join"]')) {
      await createTeamJoinRequest(target.dataset.teamId);
    } else if (target.matches('[data-action="voice-open"]')) {
      openVoiceModal();
    } else if (target.matches('[data-action="voice-start"]')) {
      await startVoiceRecording();
    } else if (target.matches('[data-action="voice-pause"]')) {
      pauseVoiceRecording();
    } else if (target.matches('[data-action="voice-stop"]')) {
      stopVoiceRecording();
    } else if (target.matches('[data-action="voice-discard"]')) {
      discardVoiceRecording();
    } else if (target.matches('[data-action="voice-save"]')) {
      await saveVoiceNote();
    } else if (target.matches('[data-action="voice-rename"]')) {
      await renameVoiceNote(target.dataset.id);
    } else if (target.matches('[data-action="voice-delete"]')) {
      await deleteVoiceNote(target.dataset.id);
    } else if (target.matches('[data-action="voice-retry"]')) {
      voiceNotesLoaded = false;
      void loadVoiceNotes();
    } else if (target.matches('[data-action="note-open-media"]')) {
      notesView = "media";
      render();
    } else if (target.matches('[data-action="note-media-back"]')) {
      notesView = "main";
      render();
    } else if (target.matches('[data-action="note-media-filter"]')) {
      mediaFilter = target.dataset.filter || "all";
      render();
    } else if (target.matches('[data-action="note-media-add"]')) {
      void openMediaNotePicker();
    } else if (target.matches('[data-action="media-editor-close"]')) {
      closeMediaEditor();
    } else if (target.matches('[data-action="media-editor-pick-images"]')) {
      syncMediaDraftFromInputs();
      triggerMediaFilePicker("image");
    } else if (target.matches('[data-action="media-editor-pick-videos"]')) {
      syncMediaDraftFromInputs();
      triggerMediaFilePicker("video");
    } else if (target.matches('[data-action="media-editor-replace"]')) {
      syncMediaDraftFromInputs();
      const idx = Number(target.dataset.idx);
      const att = mediaEditorDraft?.attachments?.[idx];
      triggerMediaFilePicker(att?.kind || mediaEditorDraft?.mode || "image", idx);
    } else if (target.matches('[data-action="media-editor-remove"]')) {
      syncMediaDraftFromInputs();
      const idx = Number(target.dataset.idx);
      const d = mediaEditorDraft;
      if (d && d.attachments[idx]) {
        const [removed] = d.attachments.splice(idx, 1);
        if (removed?.previewUrl) { try { URL.revokeObjectURL(removed.previewUrl); } catch {} }
        if (removed?.localKey) { void deleteMediaBlob(removed.localKey); }
        renderMediaEditorModal();
      }
    } else if (target.matches('[data-action="media-editor-save"]')) {
      syncMediaDraftFromInputs();
      const d = mediaEditorDraft;
      const ar = appLanguage === "ar";
      const errEl = document.getElementById("media-editor-error");
      if (!d || !(d.attachments || []).length) {
        if (errEl) errEl.textContent = ar ? "اختر صورة أو فيديو واحدًا على الأقل قبل الحفظ." : "Select at least one image or video before saving.";
      } else {
        if (errEl) errEl.textContent = "";
        const title = (d.title || "").trim() || (d.mode === "video" ? (ar ? "ملاحظة فيديو" : "Video note") : (ar ? "ملاحظة صور" : "Image note"));
        const description = (d.description || "").trim();
        const attachments = d.attachments.map(({ previewUrl, ...rest }) => rest);
        const type = d.mode === "video" ? "video" : "image";
        try {
          await saveMediaNoteRecord({ id: d.id, title, description, attachments, type, existingCreatedAt: null });
          closeMediaEditor();
          showToast(ar ? "تم حفظ ملاحظة الوسائط." : "Media note saved.");
        } catch (e) {
          if (errEl) errEl.textContent = e?.message || (ar ? "تعذر حفظ الملاحظة." : "Could not save note.");
        }
      }
    } else if (target.matches('[data-action="note-add"]')) {
      const templateKey =
        document.getElementById("note-template")?.value || "blank";
      openNoteEditor(null, templateKey);
    } else if (
      target.matches('[data-action="note-open"], [data-action="note-edit"]')
    ) {
      const n = notes.find((x) => String(x.id) === String(target.dataset.id));
      if (n && isMediaNote(n)) {
        void openMediaNoteViewer(target.dataset.id);
      } else {
        openNoteEditor(target.dataset.id);
      }
    } else if (target.matches('[data-action="note-pin"]')) {
      await toggleNotePin(target.dataset.id);
    } else if (target.matches('[data-action="note-delete"]')) {
      await deleteNote(target.dataset.id);
    } else if (target.matches('[data-action="note-close"]')) {
      closeNoteEditor();
    } else if (target.matches('[data-action="note-save-now"]')) {
      try {
        await saveNoteNow();
        showToast(appLanguage === "ar" ? "تم حفظ الملاحظة." : "Note saved.");
      } catch (error) {
        console.error("Manual note save failed.", error);
      }
    } else if (target.matches('[data-action="note-delete-editor"]')) {
      if (noteEditorState?.id)
        await deleteNote(noteEditorState.id, { closeEditor: true });
    } else if (target.matches('[data-action="goal-add"]')) {
      openFeatureForm("goal");
    } else if (target.matches('[data-action="goal-edit"]')) {
      openFeatureForm("goal", target.dataset.id);
    } else if (target.matches('[data-action="goal-progress"]')) {
      openFeatureForm("goal-progress", target.dataset.id);
    } else if (target.matches('[data-action="goal-delete"]')) {
      await deleteFeatureRecord("goal", target.dataset.id);
    } else if (target.matches('[data-action="exam-add"]')) {
      openFeatureForm("exam");
    } else if (target.matches('[data-action="exam-edit"]')) {
      openFeatureForm("exam", target.dataset.id);
    } else if (target.matches('[data-action="exam-result"]')) {
      openFeatureForm("exam-result", target.dataset.id);
    } else if (target.matches('[data-action="exam-delete"]')) {
      await deleteFeatureRecord("exam", target.dataset.id);
    } else if (target.matches('[data-action="profile-edit"]')) {
      openFeatureForm("profile", session?.user?.id);
    } else if (target.matches('[data-action="mark-notifications-read"]')) {
      await markNotificationsRead();
    } else if (
      target.matches('[data-action="notifications-enable-task-reminders"]')
    ) {
      try {
        await enableTaskNotifications();
      } catch (error) {
        showToast(`Could not enable task notifications: ${error.message}`);
      }
    } else if (target.matches('[data-action="notification-sound-preview"]')) {
      const soundSelect = document.getElementById("task-sound-select");
      void previewAlertSound(soundSelect?.value || "task-reminder");
      return;
    } else if (target.matches('[data-action="test-notification"]')) {
      // Send a real notification through the same channel/sound the app uses
      // in production, so the user can verify sound + vibration on the device.
      try {
        if (
          window.StudyZoneNotifications?.isNative &&
          typeof window.StudyZoneNotifications.testNotification === "function"
        ) {
          const sent = await window.StudyZoneNotifications.testNotification();
          showToast(
            sent
              ? appLanguage === "ar"
                ? "تم إرسال إشعار تجريبي. تحقق من الصوت والاهتزاز."
                : "Test notification sent. Check sound and vibration."
              : appLanguage === "ar"
                ? "تعذر إرسال الإشعار. افتح إعدادات أندرويد للسماح بالإشعارات."
                : "Could not send it. Allow notifications in Android settings.",
          );
        } else if (typeof Notification !== "undefined") {
          let permission = Notification.permission;
          if (permission === "default") {
            permission = await Notification.requestPermission();
          }
          if (permission === "granted") {
            new Notification("🔔 Study Zone test", {
              body:
                appLanguage === "ar"
                  ? "إذا رأيت هذا الإشعار فالإشعارات تعمل."
                  : "If you can see this notification, notifications work.",
              tag: "studyzone-test",
            });
            showToast(
              appLanguage === "ar"
                ? "تم إرسال إشعار تجريبي من المتصفح."
                : "Browser test notification sent.",
            );
          } else {
            showToast(
              appLanguage === "ar"
                ? "الإشعارات محظورة. اسمح بها من إعدادات المتصفح."
                : "Notifications are blocked. Allow them in browser settings.",
            );
          }
        } else {
          showToast(
            appLanguage === "ar"
              ? "اختبر صوت الإشعار من تطبيق أندرويد."
              : "Test the notification sound in the Android app.",
          );
        }
      } catch (error) {
        showToast(
          appLanguage === "ar"
            ? `تعذر اختبار الإشعار: ${error.message}`
            : `Could not test notifications: ${error.message}`,
        );
      }
      return;
    } else if (target.matches('[data-action="focus-sound-preview"]')) {
      void previewAlertSound(focusSettings.startSound || "focus-start");
      return;
    } else if (target.matches('[data-action="celebration-snooze"]')) {
      snoozeActiveAlert();
      return;
    } else if (target.matches('[data-action="focus-settings"]')) {
      focusSettingsOpen = !focusSettingsOpen;
      render();
      if (focusSettingsOpen)
        document.getElementById("focus-settings-title")?.focus();
    } else if (target.matches('[data-action="focus-settings-close"]')) {
      focusSettingsOpen = false;
      render();
    } else if (target.matches('[data-action="focus-settings-defaults"]')) {
      const form = document.getElementById("focus-settings-form");
      if (form) {
        Object.entries(defaultFocusSettings).forEach(([key, value]) => {
          const field = form.elements.namedItem(key);
          if (field?.type === "checkbox") field.checked = value;
          else if (field) field.value = String(value);
        });
        const error = document.getElementById("focus-settings-error");
        if (error) error.textContent = "";
        try {
          await saveFocusSettings(form);
        } catch (reason) {
          if (error)
            error.textContent =
              reason?.message || focusText[appLanguage].settingsError;
          console.error("Could not restore focus defaults.", reason);
        }
      }
    } else if (target.matches('[data-action="focus-distraction"]')) {
      distractionFree = !distractionFree;
      document.body.classList.toggle("focus-distraction", distractionFree);
      render();
    } else if (target.matches('[data-action="quick-capture-open"]')) {
      openQuickCapture(target.dataset.type || "task");
    } else if (target.matches('[data-action="global-search-open"]')) {
      openGlobalSearch();
    } else if (target.matches('[data-action="search-open-task"]')) {
      closeModal(document.getElementById("global-search-modal"));
      openTaskModal(target.dataset.id);
    } else if (target.matches('[data-action="search-open-routine"]')) {
      const routine = routines.find(
        (item) => String(item.id) === String(target.dataset.id),
      );
      closeModal(document.getElementById("global-search-modal"));
      if (routine) openTaskModal(null, null, { routine });
    } else if (target.matches('[data-action="navigate-search"]')) {
      const page = target.dataset.id || "dashboard";
      closeModal(document.getElementById("global-search-modal"));
      navigate(page);
    } else if (target.matches('[data-action="focus-prep-open"]')) {
      openFocusPrep();
    } else if (target.matches('[data-action="focus-distraction-log"]')) {
      openDistractionModal();
    } else if (target.matches('[data-action="focus-sound"]')) {
      startFocusSound(target.dataset.sound || "off");
    } else if (target.matches('[data-action="focus-deep-toggle"]')) {
      distractionFree = !distractionFree;
      document.body.classList.toggle("focus-distraction", distractionFree);
      render();
    } else if (target.matches('[data-action="focus-fullscreen"]')) {
      await toggleFocusFullscreen();
    } else if (target.matches('[data-action="shortcuts-open"]')) {
      openShortcuts();
    } else if (target.matches('[data-action="journal-select"]')) {
      journalDate = target.dataset.date || dateKey(new Date());
      render();
    } else if (target.matches('[data-action="backup-export"]')) {
      await exportBackup();
    } else if (target.matches('[data-action="backup-import"]')) {
      document.getElementById("backup-import-input")?.click();
    } else if (target.id === "timer-toggle") {
      if (focusSession.status === "running") pauseFocusTimer();
      else void startFocusTimer();
    } else if (target.id === "timer-reset") {
      void resetFocusSession();
    } else if (target.id === "timer-skip") {
      await skipFocusSession();
    } else if (target.matches('[data-action="dash-cal-select"]')) {
      dashboardSelectedDate = target.dataset.date || dateKey(new Date());
      render();
    } else if (target.matches('[data-action="heatmap-day"]')) {
      analyticsHeatmapSelected = target.dataset.date || null;
      render();
    } else if (target.matches('[data-action="dash-cal-prev"]')) {
      dashboardMonth = new Date(
        dashboardMonth.getFullYear(),
        dashboardMonth.getMonth() - 1,
        1,
      );
      render();
    } else if (target.matches('[data-action="dash-cal-next"]')) {
      dashboardMonth = new Date(
        dashboardMonth.getFullYear(),
        dashboardMonth.getMonth() + 1,
        1,
      );
      render();
    } else if (target.matches('[data-action="dash-cal-today"]')) {
      dashboardMonth = new Date(
        new Date().getFullYear(),
        new Date().getMonth(),
        1,
      );
      dashboardSelectedDate = dateKey(new Date());
      render();
    } else if (target.matches('[data-action="habit-toggle"]')) {
      const routine = routines.find(
        (item) => String(item.id) === String(target.dataset.id),
      );
      if (routine && target.dataset.date) {
        await toggleRoutineOccurrence(
          routineVirtualTask(routine, target.dataset.date),
        );
        void window.StudyZoneApp?.syncWidgets?.();
      }
    } else if (target.matches('[data-action="deadline-calendar-mode"]')) {
      deadlineCalendarMode = ["month", "week", "day"].includes(
        target.dataset.mode,
      )
        ? target.dataset.mode
        : "month";
      const anchor = parseLocalDateKey(selectedDeadlineDate) || new Date();
      deadlineMonth = new Date(
        anchor.getFullYear(),
        anchor.getMonth(),
        1,
      );
      render();
    } else if (target.matches('[data-action="calendar-select"]')) {
      selectedDeadlineDate = target.dataset.date;
      const selected = parseLocalDateKey(selectedDeadlineDate);
      if (selected)
        deadlineMonth = new Date(
          selected.getFullYear(),
          selected.getMonth(),
          1,
        );
      render();
    } else if (target.matches('[data-action="calendar-prev"]')) {
      if (deadlineCalendarMode === "month") {
        deadlineMonth = new Date(
          deadlineMonth.getFullYear(),
          deadlineMonth.getMonth() - 1,
          1,
        );
      } else {
        const anchor = parseLocalDateKey(selectedDeadlineDate) || new Date();
        const next = addLocalDays(
          anchor,
          deadlineCalendarMode === "week" ? -7 : -1,
        );
        selectedDeadlineDate = dateKey(next);
        deadlineMonth = new Date(next.getFullYear(), next.getMonth(), 1);
      }
      render();
    } else if (target.matches('[data-action="calendar-next"]')) {
      if (deadlineCalendarMode === "month") {
        deadlineMonth = new Date(
          deadlineMonth.getFullYear(),
          deadlineMonth.getMonth() + 1,
          1,
        );
      } else {
        const anchor = parseLocalDateKey(selectedDeadlineDate) || new Date();
        const next = addLocalDays(
          anchor,
          deadlineCalendarMode === "week" ? 7 : 1,
        );
        selectedDeadlineDate = dateKey(next);
        deadlineMonth = new Date(next.getFullYear(), next.getMonth(), 1);
      }
      render();
    } else if (target.matches('[data-action="calendar-today"]')) {
      deadlineMonth = new Date(
        new Date().getFullYear(),
        new Date().getMonth(),
        1,
      );
      selectedDeadlineDate = dateKey(new Date());
      render();
    } else if (target.matches('[data-action="toggle-task"]')) {
      await updateTaskStatus(target.dataset.id);
      void window.StudyZoneApp?.syncWidgets?.();
    } else if (target.matches('[data-action="delete-task"]')) {
      await deleteTask(target.dataset.id);
    } else if (target.matches('[data-action="theme-toggle"]')) {
      const light = document.documentElement.dataset.theme !== "light";
      document.documentElement.dataset.theme = light ? "light" : "dark";
      target.classList.toggle("on", !light);
      target.setAttribute("aria-pressed", String(light));
      localStorage.setItem("studyflow.theme", light ? "light" : "dark");
      if (shouldAnimate())
        target.animate?.(
          [{ transform: "scale(.92)" }, { transform: "scale(1)" }],
          { duration: 180, easing: "ease-out" },
        );
      showToast("Settings saved.");
    } else if (target.matches("[data-theme-preset-option]")) {
      await saveThemePreset(target.dataset.themePresetOption);
      if (shouldAnimate())
        target.animate?.(
          [{ transform: "scale(.97)" }, { transform: "scale(1)" }],
          { duration: 180, easing: "ease-out" },
        );
    } else if (target.matches("[data-visual-style-option]")) {
      await saveVisualStyle(target.dataset.visualStyleOption);
      if (shouldAnimate())
        target.animate?.(
          [{ transform: "scale(.97)" }, { transform: "scale(1)" }],
          { duration: 180, easing: "ease-out" },
        );
    } else if (target.matches("[data-animation-intensity]")) {
      animationIntensity = target.dataset.animationIntensity;
      localStorage.setItem("studyflow.animation-intensity", animationIntensity);
      if (supabase && session) {
        void supabase
          .from("profiles")
          .update({ animation_intensity: animationIntensity })
          .eq("id", session.user.id);
      }
      render();
    } else if (target.matches("[data-animation-speed]")) {
      animationSpeed = target.dataset.animationSpeed;
      localStorage.setItem("studyflow.animation-speed", animationSpeed);
      if (supabase && session) {
        void supabase
          .from("profiles")
          .update({ animation_speed: animationSpeed })
          .eq("id", session.user.id);
      }
      render();
    } else if (target.matches('input[name="animation-enabled"]')) {
      animationEnabled = target.checked;
      localStorage.setItem("studyflow.animation-enabled", String(animationEnabled));
      animationsEnabled = animationEnabled && motionLevel !== "off";
      if (supabase && session) {
        void supabase
          .from("profiles")
          .update({ animation_enabled: animationEnabled })
          .eq("id", session.user.id);
      }
      render();
    } else if (target.matches('input[name="animation-effect"]')) {
      const effectId = target.dataset.effect;
      animationEffects[effectId] = target.checked;
      localStorage.setItem("studyflow.animation-effects", JSON.stringify(animationEffects));
      if (supabase && session) {
        void supabase
          .from("profiles")
          .update({ animation_effects: JSON.stringify(animationEffects) })
          .eq("id", session.user.id);
      }
      render();
    } else if (target.matches('input[name="reduced-motion"]')) {
      reducedMotion = target.checked;
      localStorage.setItem("studyflow.reduced-motion", String(reducedMotion));
      if (supabase && session) {
        void supabase
          .from("profiles")
          .update({ reduced_motion: reducedMotion })
          .eq("id", session.user.id);
      }
      render();
    } else if (target.matches('[data-action="sync-now"]')) {
      target.disabled = true;
      try {
        const result = await window.StudyZoneOffline?.syncNow();
        showToast(
          result?.ok
            ? "Sync complete."
            : result?.reason === "offline"
              ? "Working offline"
              : "Could not sync. Will retry automatically.",
        );
      } finally {
        target.disabled = false;
      }
    } else if (target.matches('[data-action="native-notification-permission"]')) {
      const status = document.querySelector("[data-notification-status]");
      try {
        const permission =
          await window.StudyZoneNotifications?.requestPermission?.();
        if (status)
          status.textContent =
            permission === "granted"
              ? appLanguage === "ar"
                ? "تم تفعيل الإشعارات."
                : "Notifications are enabled."
              : appLanguage === "ar"
                ? "إذن الإشعارات مطلوب."
                : "Notification permission is required.";
      } catch (error) {
        if (status) status.textContent = error?.message || String(error);
      }
    } else if (target.matches("[data-motion-level]")) {
      motionLevel = target.dataset.motionLevel;
      animationsEnabled = motionLevel !== "off";
      localStorage.setItem("studyflow.motion", motionLevel);
      localStorage.setItem(
        "studyflow.animations",
        animationsEnabled ? "on" : "off",
      );
      document.documentElement.dataset.motion = motionLevel;
      if (!animationsEnabled)
        document.getAnimations().forEach((animation) => animation.cancel());
      document.querySelectorAll("[data-motion-level]").forEach((option) => {
        const selected = option.dataset.motionLevel === motionLevel;
        option.classList.toggle("selected", selected);
        option.setAttribute("aria-pressed", String(selected));
      });
      showToast("Settings saved.");
    } else if (target.matches('[data-action="admin-users-refresh"]')) {
      void loadAdminUsers();
    } else if (target.matches('[data-action="admin-users-prev"]')) {
      adminUsersPage = Math.max(0, adminUsersPage - 1);
      void loadAdminUsers();
    } else if (target.matches('[data-action="admin-users-next"]')) {
      if ((adminUsersPage + 1) * adminUsersPageSize < adminUsersTotal) {
        adminUsersPage += 1;
        void loadAdminUsers();
      }
    } else if (target.matches('[data-action="setting-toggle"]')) {
      target.classList.toggle("on");
      target.setAttribute(
        "aria-pressed",
        String(target.classList.contains("on")),
      );
    } else if (target.matches("[data-action]")) {
      const messages = {
        "read-hint":
          "Notification read state will sync after connecting your account.",
      };
      if (messages[target.dataset.action])
        showInfo(messages[target.dataset.action]);
    } else if (target.matches("[data-close-modal]")) {
      const backdrop = target.closest(".modal-backdrop");
      closeModal(backdrop);
      if (backdrop.id === "voice-modal") resetVoiceRecorder();
      if (backdrop.id === "auth-modal")
        localStorage.setItem(authPromptStorageKey, "seen");
    } else if (target.id === "open-auth" || target.id === "top-profile") {
      openModal(document.getElementById("auth-modal"));
    } else if (target.id === "mobile-menu") {
      document.getElementById("sidebar").classList.toggle("open");
    } else if (target.matches("[data-auth-mode]")) {
      setAuthMode(target.dataset.authMode);
    } else if (target.id === "sign-out" && supabase) {
      try {
        await removeCurrentPushSubscription(session?.user?.id);
      } catch (error) {
        console.error(
          "Could not fully remove the current push subscription while signing out.",
          error,
        );
        showToast(`Push subscription cleanup failed: ${error.message}`);
      }
      const offlineStore = window.StudyZoneOffline;
      const offlineUserId = session?.user?.id;
      if (offlineStore && offlineUserId) {
        const snapshot = offlineStore.state;
        if ((snapshot.pending || snapshot.failed) && snapshot.online) {
          await offlineStore.syncNow({ silent: true }).catch(() => {});
        } else if (
          (snapshot.pending || snapshot.failed) &&
          !snapshot.online &&
          !window.confirm(
            appLanguage === "ar"
              ? "لديك تغييرات محفوظة على هذا الجهاز ولم تُزامن بعد. ستُحذف عند تسجيل الخروج. هل تريد المتابعة؟"
              : "You have changes saved on this device that have not synced yet. They will be removed when you sign out. Continue?",
          )
        ) {
          return;
        }
      }
      const { error } = await supabase.auth.signOut();
      if (error) {
        showToast(`Could not sign out: ${error.message}`);
        console.error("Supabase sign out failed.", error);
        return;
      }
      await offlineStore?.clearUser?.(offlineUserId);
      window.StudyZoneNotifications?.cancelAll?.();
      session = null;
      adminAuthorization = { status: "denied", userId: null };
      adminUsersRequest += 1;
      adminUsers = [];
      adminUsersTotal = 0;
      resetAccountWorkspacePreview();
      syncWidgetData();
      subjects = [
        {
          id: "subject-calculus",
          name: "Calculus II",
          color: "#06D6A0",
          credits: 4,
          progress: 72,
        },
        {
          id: "subject-algorithms",
          name: "Algorithms",
          color: "#75CDB1",
          credits: 3,
          progress: 81,
        },
        {
          id: "subject-biology",
          name: "Biology",
          color: "#9ECDAF",
          credits: 3,
          progress: 64,
        },
        {
          id: "subject-history",
          name: "History",
          color: "#C1D79D",
          credits: 2,
          progress: 55,
        },
      ];
      userNotifications = [];
      dailyReminderPreference = {
        enabled: false,
        local_time: "09:00",
        timezone: "UTC",
      };
      closeModal(document.getElementById("auth-modal"));
      updateUserUi();
      if (currentPage === "admin") {
        currentPage = "dashboard";
        window.location.hash = "dashboard";
        render();
      }
      showToast("Signed out.");
    }
  });

  document
    .getElementById("task-form")
    .addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const button = form.querySelector('button[type="submit"]');
      const error = document.getElementById("task-error");
      button.disabled = true;
      error.textContent = "";
      try {
        const formData = new FormData(form);
        const routineId = String(formData.get("routine_id") || "");
        const editingRoutine = routineId
          ? routines.find((item) => String(item.id) === routineId)
          : null;
        const editingTask = tasks.find(
          (item) => String(item.id) === String(formData.get("task_id")),
        );
        if (editingRoutine) {
          await updateRoutineFromForm(editingRoutine, formData);
        } else if (editingTask) {
          const payload = taskPayloadFromForm(formData);
          if (editingTask.recurrence_group_id) {
            openSeriesScopeDialog("edit", editingTask, payload);
            return;
          }
          await applyTaskEdit(editingTask, payload);
        } else {
          await createTask(formData);
        }
        form.reset();
      } catch (reason) {
        error.textContent = reason?.message || "Could not save this task.";
        translateInterface();
        console.error("Task save failed.", reason);
      } finally {
        button.disabled = false;
      }
    });

  document
    .getElementById("move-task-form")
    .addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const button = form.querySelector('button[type="submit"]');
      const error = document.getElementById("move-task-error");
      button.disabled = true;
      error.textContent = "";
      try {
        await moveTask(new FormData(form));
      } catch (reason) {
        error.textContent = reason?.message || "Could not move this task.";
        console.error("Could not move the task.", reason);
      } finally {
        button.disabled = false;
      }
    });

  document.addEventListener("submit", async (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    if (form.id === "quick-capture-form") {
      event.preventDefault();
      const button = form.querySelector('button[type="submit"]');
      const error = document.getElementById("quick-capture-error");
      button.disabled = true;
      error.textContent = "";
      try {
        await saveQuickCapture(new FormData(form));
      } catch (reason) {
        error.textContent = reason?.message || "Could not save this item.";
        console.error("Quick capture failed.", reason);
      } finally {
        button.disabled = false;
      }
    } else if (form.id === "focus-prep-form") {
      event.preventDefault();
      try {
        prepareFocusSession(new FormData(form));
      } catch (reason) {
        showToast(reason?.message || "Could not start the focus session.");
      }
    } else if (form.id === "distraction-form") {
      event.preventDefault();
      const button = form.querySelector('button[type="submit"]');
      const error = document.getElementById("distraction-error");
      button.disabled = true;
      error.textContent = "";
      try {
        await logDistraction(new FormData(form));
      } catch (reason) {
        error.textContent = reason?.message || "Could not log the distraction.";
        console.error("Could not log the distraction.", reason);
      } finally {
        button.disabled = false;
      }
    } else if (form.id === "journal-form") {
      event.preventDefault();
      const button = form.querySelector('button[type="submit"]');
      const error = document.getElementById("journal-error");
      button.disabled = true;
      error.textContent = "";
      try {
        await saveJournalEntry(new FormData(form));
      } catch (reason) {
        error.textContent = reason?.message || "Could not save the reflection.";
        console.error("Could not save the journal entry.", reason);
      } finally {
        button.disabled = false;
      }
    }
  });

  document.addEventListener("change", async (event) => {
    const target = event.target;
    if (target?.id === "backup-import-input") {
      const file = target.files?.[0];
      target.value = "";
      if (!file) return;
      try {
        await importBackupFile(file);
      } catch (reason) {
        showToast(reason?.message || "Could not restore this backup.");
        console.error("Backup restore failed.", reason);
      }
    } else if (target?.id === "journal-date") {
      journalDate = target.value || dateKey(new Date());
      render();
    } else if (target?.id === "focus-sound-volume") {
      updateFocusSoundVolume(target.value);
    } else if (target?.id === "quick-capture-type") {
      quickCaptureType = target.value;
    } else if (target?.id === "analytics-range") {
      analyticsRange = target.value;
      analyticsCustomRange = { start: null, end: null };
      saveAnalyticsSettings();
      render();
    } else if (target?.id === "analytics-week-start") {
      analyticsCustomStart = Number(target.value);
      saveAnalyticsSettings();
      render();
    } else if (target?.id === "analytics-range-start") {
      analyticsCustomRange.start = target.value || null;
      saveAnalyticsSettings();
      render();
    } else if (target?.id === "analytics-range-end") {
      analyticsCustomRange.end = target.value || null;
      saveAnalyticsSettings();
      render();
    } else if (target?.id === "analytics-metric") {
      analyticsMetric = target.value;
      saveAnalyticsSettings();
      render();
    } else if (target?.id === "analytics-activity-type") {
      analyticsHeatmapType = heatmapActivityTypes.some(
        (item) => item.id === target.value,
      )
        ? target.value
        : "overall";
      analyticsHeatmapSelected = null;
      render();
    } else if (target?.id === "analytics-heatmap-year") {
      const year = Number(target.value);
      analyticsHeatmapYear = Number.isInteger(year) ? year : null;
      analyticsHeatmapSelected = null;
      render();
    } else if (target?.matches?.("[data-notification-type]")) {
      saveNotificationTypes({
        [target.dataset.notificationType]: target.checked,
      });
      if (window.StudyZoneNotifications?.syncTaskReminders)
        window.StudyZoneNotifications.syncTaskReminders(tasks, examResults);
    } else if (target?.name === "vibration_enabled") {
      notificationPrefs.vibration_enabled = target.checked;
      localStorage.setItem(notificationPrefsKey, JSON.stringify(notificationPrefs));
      if (supabase && session) {
        void supabase
          .from("user_notification_preferences")
          .upsert(
            {
              user_id: session.user.id,
              vibration_enabled: notificationPrefs.vibration_enabled,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id" },
          )
          .then(({ error }) => {
            if (error && !isMissingColumnError(error))
              console.warn("Could not sync vibration preference.", error);
          });
      }
      render();
    } else if (target?.name === "default_task_reminder") {
      localStorage.setItem("studyzone.default-task-reminder", target.value);
      if (supabase && session) {
        void supabase
          .from("profiles")
          .update({ notification_settings: { ...notificationTypes(), default_task_reminder: target.value } })
          .eq("id", session.user.id)
          .then(({ error }) => {
            if (error && !isMissingColumnError(error))
              console.warn("Could not sync default task reminder.", error);
          });
      }
      render();
    } else if (target?.name === "allday_reminder_time") {
      allDayReminderTime = target.value || defaultAllDayReminderTime;
      localStorage.setItem("studyzone.allday-reminder-time", allDayReminderTime);
      if (supabase && session) {
        void supabase
          .from("profiles")
          .update({ notification_settings: { ...notificationTypes(), allday_reminder_time: allDayReminderTime } })
          .eq("id", session.user.id)
          .then(({ error }) => {
            if (error && !isMissingColumnError(error))
              console.warn("Could not sync all-day reminder time.", error);
          });
      }
      render();
    }
  });

  document.addEventListener("input", (event) => {
    if (event.target?.id === "focus-sound-volume") {
      updateFocusSoundVolume(event.target.value);
    }
  });

  document
    .querySelectorAll(
      "#task-form [name='repeat_type'], #deadline-form [name='repeat_type']",
    )
    .forEach((select) => {
      select.addEventListener("change", () =>
        updateRepeatControls(select.form),
      );
    });

  document
    .getElementById("team-form")
    .addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const button = form.querySelector('button[type="submit"]');
      const error = document.getElementById("team-error");
      button.disabled = true;
      error.textContent = "";
      try {
        await createTeam(new FormData(form));
        form.reset();
      } catch (reason) {
        error.textContent = reason?.message || "Could not create the team.";
        console.error("Team creation failed.", reason);
      } finally {
        button.disabled = false;
      }
    });

  document
    .getElementById("team-join-form")
    .addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const button = form.querySelector('button[type="submit"]');
      const error = document.getElementById("team-join-error");
      button.disabled = true;
      error.textContent = "";
      try {
        await joinTeam(new FormData(form));
        form.reset();
      } catch (reason) {
        error.textContent = reason?.message || "Could not join the team.";
        console.error("Team join failed.", reason);
      } finally {
        button.disabled = false;
      }
    });

  document.addEventListener("submit", async (event) => {
    if (event.target.id === "notification-prefs-form") {
      event.preventDefault();
      const form = event.target;
      const button = form.querySelector('button[type="submit"]');
      button.disabled = true;
      try {
        await saveNotificationPreferences(new FormData(form));
      } catch (reason) {
        showToast(reason?.message || "Could not save notification settings.");
        console.error("Notification preference save failed.", reason);
      } finally {
        button.disabled = false;
      }
      return;
    }
    if (event.target.id !== "team-task-form") return;
    event.preventDefault();
    const form = event.target;
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      await addTeamTask(new FormData(form));
      form.reset();
    } catch (reason) {
      showToast(reason?.message || "Could not add the team task.");
      console.error("Team task creation failed.", reason);
    } finally {
      button.disabled = false;
    }
  });

  document
    .getElementById("deadline-form")
    .addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = document.getElementById("deadline-submit");
      const error = document.getElementById("deadline-error");
      const t = deadlineText[appLanguage];
      button.disabled = true;
      button.textContent = t.saving;
      error.textContent = "";
      try {
        const result = await saveDeadline(new FormData(event.currentTarget));
        if (result !== "scoped") event.currentTarget.reset();
      } catch (reason) {
        error.textContent = `${t.saveError} ${reason?.message || ""}`.trim();
        translateInterface();
        console.error("Deadline save failed.", reason);
      } finally {
        button.disabled = false;
        button.innerHTML = `${deadlineText[appLanguage].save} <span>→</span>`;
      }
    });

  document
    .getElementById("auth-form")
    .addEventListener("submit", handleAuthSubmit);
  window.addEventListener("hashchange", () => {
    const page = window.location.hash.slice(1) || "dashboard";
    const nextPage = pageRenderers[page] ? page : "dashboard";
    if (nextPage === currentPage) return;
    currentPage = nextPage;
    if (currentPage === "admin")
      adminAuthorization = {
        status: "checking",
        userId: session?.user?.id || null,
      };
    render();
    if (currentPage === "admin") void verifyAdminAccess();
    if (currentPage === "focus") void loadFocusData();
  });
  window.addEventListener("studyzone:shortcut-open", (event) => {
    const detail = event.detail || {};
    const page = detail.page;
    if (page && pageRenderers[page]) {
      currentPage = page;
      window.location.hash = page;
      render();
      if (page === "focus") void loadFocusData();
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    clearFocusTicker();
    if (focusSession.status === "running" && getFocusRemainingMs() <= 0)
      void finishFocusTimer();
    else updateTimerUi();
    syncFocusTicker();
  });
  window.addEventListener("pageshow", () => {
    reconcileFocusTimer();
    clearFocusTicker();
    syncFocusTicker();
  });
  window.addEventListener("pagehide", () => {
    persistFocusState();
    clearFocusTicker();
  });
  window.addEventListener("scroll", updateScrollProgress, { passive: true });
  window.addEventListener("resize", updateScrollProgress, { passive: true });
  window.addEventListener("online", updateOfflineStatus);
  window.addEventListener("offline", updateOfflineStatus);
  document.addEventListener("visibilitychange", () => {
    document.documentElement.dataset.motionPaused = String(document.hidden);
    document.getAnimations().forEach((animation) => {
      if (document.hidden) animation.pause();
      else animation.play();
    });
  });

  // Keyboard shortcuts. Never trigger while the user is typing in a field.
  document.addEventListener("keydown", (event) => {
    const element = event.target;
    const typing =
      element instanceof HTMLElement &&
      (element.matches("input, textarea, select") ||
        element.isContentEditable ||
        element.closest("[contenteditable='true']"));
    if (typing) return;
    const modalOpen = Boolean(
      document.querySelector(".modal-backdrop:not([hidden])"),
    );
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      openGlobalSearch();
      return;
    }
    if (modalOpen || event.ctrlKey || event.metaKey || event.altKey) return;
    const key = event.key.toLowerCase();
    if (key === "n") {
      event.preventDefault();
      openTaskModal(null, dateKey(taskViewDate));
    } else if (key === "q") {
      event.preventDefault();
      openQuickCapture("task");
    } else if (key === "f") {
      event.preventDefault();
      navigate("focus");
    } else if (key === "h") {
      event.preventDefault();
      navigate("dashboard");
    } else if (event.key === "?") {
      event.preventDefault();
      openShortcuts();
    } else if (event.code === "Space" && currentPage === "focus") {
      if (element instanceof HTMLElement && element.closest("button, a")) return;
      event.preventDefault();
      if (focusSession.status === "running") pauseFocusTimer();
      else void startFocusTimer();
    }
  });

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", async () => {
      try {
        const registration = await navigator.serviceWorker.register(
          "./service-worker.js",
          { scope: "./" },
        );

        console.log("Study Zone PWA registered:", registration.scope);

        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;

          worker?.addEventListener("statechange", () => {
            if (
              worker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              console.log("A new Study Zone version is available.");
            }
          });
        });
      } catch (error) {
        console.error("Study Zone PWA registration failed:", error);
      }
    });
  }

  const storedTheme = localStorage.getItem("studyflow.theme");
  if (storedTheme === "light") document.documentElement.dataset.theme = "light";
  applyThemePreset(currentThemePreset(), { persist: false });
  window.StudyZoneApp = {
    get tasks() {
      return tasks;
    },
    get exams() {
      return examResults;
    },
    get language() {
      return appLanguage;
    },
    get page() {
      return currentPage;
    },
    get focus() {
      return {
        id: focusSession.id,
        type: focusSession.type,
        status: focusSession.status,
        cycle: focusSession.cycle,
        endAt: focusSession.endAt,
        remainingMs: getFocusRemainingMs(),
        taskId: focusSession.taskId,
        subjectId: focusSession.subjectId,
        goal: focusSession.goal,
      };
    },
    reconcileFocus: () => reconcileFocusTimer(),
    render,
    setLanguage,
    setTheme: saveThemePreset,
    applyTheme: applyThemePreset,
    navigate,
    syncWidgets: () => syncWidgetData(),
    syncReminders: () =>
      window.StudyZoneNotifications?.syncTaskReminders?.(tasks, examResults),
    reloadWorkspace: async () => {
      if (!supabase || !session) return;
      await loadRemoteTasks();
      await loadAccountWorkspace();
      await loadRemoteNotifications({ silent: true });
    },
    isOffline: () => navigator.onLine === false,
    translate: translateUiText,
  };

  // ---- Widget data sync ------------------------------------------------------
  function syncWidgetData() {
    const bridge = window.StudyZoneNotifications;
    if (!bridge || typeof bridge.setWidgetData !== "function") return;
    const themeId = currentThemePreset();
    const ar = appLanguage === "ar";
    const locale = ar ? "ar-EG" : "en";
    const todayKey = dateKey(new Date());
    const todayTasks = tasksForDay(todayKey);
    const completed = todayTasks.filter((t) => t.status === "completed").length;
    const total = todayTasks.length;
    const progress = total ? Math.round((completed / total) * 100) : 0;
    const dayName = new Intl.DateTimeFormat(locale, { weekday: "short" }).format(new Date());
    const dateStr = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }).format(new Date());

    const taskLine = (task) => {
      const done = task.status === "completed" ? "✓ " : "• ";
      const title = String(task.title || "").trim();
      if (!task.due_at || isAllDayTask(task)) return `${done}${title}`;
      const time = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(new Date(task.due_at));
      return `${done}${title} · ${time}`;
    };
    const lines = todayTasks.slice(0, 4).map(taskLine);
    const emptyLabel = ar ? "لا توجد مهام اليوم" : "No tasks today";

    let focusSessionsToday = 0;
    try {
      focusSessionsToday = getFocusStats().todaySessions || 0;
    } catch {
      focusSessionsToday = 0;
    }

    const activeFocus = focusSession.status === "running" || focusSession.status === "paused";
    const remaining = Math.max(0, getFocusRemainingMs());
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    const clock = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    const focusStatus = !activeFocus
      ? ar ? "خامل" : "Idle"
      : focusSession.status === "paused"
        ? ar ? "متوقف مؤقتًا" : "Paused"
        : ar ? "قيد التركيز" : "Focusing";
    const focusTask = focusSession.taskId
      ? tasks.find((task) => task.id === focusSession.taskId)
      : null;
    const focusSessionLabel = activeFocus
      ? focusTask?.title ||
        (focusSession.type === "break" ? (ar ? "استراحة" : "Break") : ar ? "جلسة تركيز" : "Focus session")
      : ar ? "لا توجد جلسة نشطة" : "No active session";

    const upcoming = (getDeadlines() || [])
      .filter((deadline) => getDeadlineStatus(deadline) !== "completed" && deadline.due_at)
      .slice()
      .sort((a, b) => new Date(a.due_at) - new Date(b.due_at))
      .slice(0, 3)
      .map((deadline) => {
        const due = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }).format(new Date(deadline.due_at));
        return `${deadline.title || (ar ? "موعد نهائي" : "Deadline")} · ${due}`;
      });

    const contributionYear = heatmapActiveYear();
    const contributionData = heatmapGridData(contributionYear);
    const payloads = {
      today_tasks: {
        date: dateStr,
        day: dayName,
        taskCount: `${total} ${ar ? "مهام" : total === 1 ? "task" : "tasks"} · ${completed} ${ar ? "مكتملة" : "done"}`,
        progress,
        empty: total ? "" : emptyLabel,
      },
      large_tasks: {
        date: dateStr,
        taskCount: `${total} ${ar ? "مهام" : total === 1 ? "task" : "tasks"}`,
        task1: lines[0] || "",
        task2: lines[1] || "",
        task3: lines[2] || "",
        task4: lines[3] || "",
        empty: total ? "" : emptyLabel,
      },
      daily_progress: {
        title: ar ? "التقدم اليومي" : "Daily Progress",
        date: dateStr,
        completed: `${completed} / ${total} ${ar ? "مهام" : "tasks"}`,
        focus: `${focusSessionsToday} ${ar ? "جلسات تركيز" : "focus sessions"}`,
        progress,
      },
      focus: {
        title: ar ? "مؤقت التركيز" : "Focus Timer",
        status: focusStatus,
        time: clock,
        session: focusSessionLabel,
      },
      upcoming_deadlines: {
        title: ar ? "المواعيد القادمة" : "Upcoming Deadlines",
        deadline1: upcoming[0] || (ar ? "لا توجد مواعيد قادمة" : "No upcoming deadlines"),
        deadline2: upcoming[1] || "",
        deadline3: upcoming[2] || "",
      },
      contributions: {
        title: ar ? "خريطة النشاط" : "Activity Map",
        year: String(contributionYear),
        type: analyticsHeatmapType,
        typeLabel: heatmapTypeLabel(analyticsHeatmapType),
        total: contributionData.total,
        activeDays: contributionData.activeDays,
        weeks: contributionData.weeks || [],
        weekLabels: contributionData.weekLabels || [],
        summary: heatmapFormattedValue(analyticsHeatmapType, contributionData.total),
      },
    };

    Object.entries(payloads).forEach(([type, payload]) => {
      bridge.setWidgetData(themeId, type, 0, JSON.stringify(payload));
    });
  }
  document.getElementById("footer-year").textContent = new Date().getFullYear();
  updateOfflineStatus();
  document.documentElement.dataset.motion = motionLevel;
  currentPage = pageRenderers[window.location.hash.slice(1)]
    ? window.location.hash.slice(1)
    : "dashboard";
  render();
  updateUserUi();
  void loadFocusData();
  restoreSession();
  document
    .getElementById("pwa-install")
    .addEventListener("click", () => void handlePwaInstall());
  document
    .getElementById("pwa-install-confirm")
    ?.addEventListener("click", () => void handlePwaInstall());
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    updatePwaInstallButton();
  });
  window.addEventListener("appinstalled", () => {
    pwaInstalled = true;
    deferredInstallPrompt = null;
    updatePwaInstallButton();
    refreshPwaInstructions();
    showToast("App installed.");
  });
  window
    .matchMedia?.("(display-mode: standalone)")
    .addEventListener?.("change", () => {
      updatePwaInstallButton();
      refreshPwaInstructions();
    });
  updatePwaInstallButton();
  refreshPwaInstructions();
  const taskSoundVolumeInput = document.getElementById("task-sound-volume");
  taskSoundVolumeInput?.addEventListener("input", () => {
    const value = Number(taskSoundVolumeInput.value || 80);
    const volumeLabel = document.getElementById("task-sound-volume-value");
    if (volumeLabel) volumeLabel.textContent = `${value}%`;
  });
  const celebrationDoneButton = document.getElementById("celebration-done");
  celebrationDoneButton?.addEventListener("click", () => {
    if (alertSnoozeTimer) {
      window.clearTimeout(alertSnoozeTimer);
      alertSnoozeTimer = null;
    }
    stopAlertAudio();
  });
  if (
    "serviceWorker" in navigator &&
    window.location.protocol.startsWith("http")
  ) {
    navigator.serviceWorker
      .register("./service-worker.js")
      .then((registration) => {
        void registration.update();
        if (registration.waiting) showPwaUpdateNotice(registration.waiting);
        registration.addEventListener("updatefound", () => {
          const installingWorker = registration.installing;
          installingWorker?.addEventListener("statechange", () => {
            if (
              installingWorker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              showPwaUpdateNotice(registration.waiting || installingWorker);
            }
          });
        });
      })
      .catch((error) => {
        console.error(
          "Could not register the Study Zone service worker.",
          error,
        );
      });
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (pwaUpdateReload) window.location.reload();
    });
  }
})();
