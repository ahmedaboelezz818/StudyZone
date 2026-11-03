(() => {
  "use strict";

  const config = window.studyFlowSupabaseConfig || {};
  const configured = Boolean(config.url && config.anonKey);
  const supabase = configured && window.supabase?.createClient
    ? window.supabase.createClient(config.url, config.anonKey)
    : null;
  let subjects = [
    { id: "subject-calculus", name: "Calculus II", color: "#06D6A0", credits: 4, progress: 72 },
    { id: "subject-algorithms", name: "Algorithms", color: "#75CDB1", credits: 3, progress: 81 },
    { id: "subject-biology", name: "Biology", color: "#9ECDAF", credits: 3, progress: 64 },
    { id: "subject-history", name: "History", color: "#C1D79D", credits: 2, progress: 55 },
  ];
  const seededTasks = [
    { id: "demo-task-1", title: "Discrete math problem set", subject_id: "subject-algorithms", subject: "Algorithms", due_at: todayAt(17, 30), priority: "high", status: "in_progress", estimated_minutes: 130 },
    { id: "demo-task-2", title: "Biology flashcards review", subject_id: "subject-biology", subject: "Biology", due_at: tomorrowAt(9), priority: "medium", status: "not_started", estimated_minutes: 75 },
    { id: "demo-task-3", title: "History essay outline", subject_id: "subject-history", subject: "History", due_at: dayAtOffset(2, 16), priority: "urgent", status: "in_progress", estimated_minutes: 105 },
    { id: "demo-task-4", title: "Calculus revision quiz", subject_id: "subject-calculus", subject: "Calculus II", due_at: dayAtOffset(3, 20), priority: "low", status: "completed", estimated_minutes: 45 },
  ];
  let activity = [
    { day: "Mon", hours: 2.8 }, { day: "Tue", hours: 3.4 }, { day: "Wed", hours: 2.5 },
    { day: "Thu", hours: 4.1 }, { day: "Fri", hours: 3.7 }, { day: "Sat", hours: 5.2 }, { day: "Sun", hours: 2.1 },
  ];
  let goals = [
    { title: "Finish revision pack", progress: 78, due: "5 days", detail: "Review key topics before the assessment" },
    { title: "Keep weekly study rhythm", progress: 86, due: "2 days", detail: "Reach 12 focused hours this week" },
    { title: "Submit essay draft", progress: 64, due: "1 week", detail: "Complete the outline and first draft" },
  ];
  let schedule = [
    { day: "Monday", time: "08:00", title: "Limits and derivatives", subject: "Calculus II", length: "90 min" },
    { day: "Tuesday", time: "17:00", title: "Graphs + shortest path", subject: "Algorithms", length: "105 min" },
    { day: "Wednesday", time: "19:00", title: "Cell structure review", subject: "Biology", length: "75 min" },
    { day: "Thursday", time: "15:30", title: "Essay drafting sprint", subject: "History", length: "90 min" },
  ];
  const achievementCatalog = [
    { code: "first-task", name: "First Task", description: "Complete your first task.", symbol: "✓", reward: 10 },
    { code: "focus-starter", name: "Focus Starter", description: "Complete your first verified focus session.", symbol: "◷", reward: 15 },
    { code: "focus-master", name: "Focus Master", description: "Complete 10 verified focus sessions.", symbol: "✦", reward: 50 },
    { code: "deadline-hero", name: "Deadline Hero", description: "Complete 10 tasks with deadlines.", symbol: "◇", reward: 50 },
    { code: "study-streak", name: "Study Streak", description: "Build a 7-day activity streak.", symbol: "↗", reward: 40 },
    { code: "consistency-champion", name: "Consistency Champion", description: "Build a 30-day activity streak.", symbol: "✧", reward: 150 },
    { code: "level-5", name: "Rising Scholar", description: "Reach level 5.", symbol: "★", reward: 50 },
    { code: "level-10", name: "Study Champion", description: "Reach level 10.", symbol: "♛", reward: 100 },
    { code: "level-20", name: "Master Strategist", description: "Reach level 20.", symbol: "✪", reward: 200 },
    { code: "level-50", name: "Study Legend", description: "Reach level 50.", symbol: "♜", reward: 500 },
  ];
  let examResults = [
    { subject: "Algorithms", score: 88 }, { subject: "Calculus II", score: 92 },
    { subject: "Biology", score: 84 }, { subject: "History", score: 78 },
  ];
  let sampleFiles = [
    { name: "calculus-derivatives.pdf", type: "PDF", subject: "Calculus II" },
    { name: "algo-graphs-notes.md", type: "Notes", subject: "Algorithms" },
    { name: "biology-diagrams.png", type: "Image", subject: "Biology" },
  ];
  let sampleNotes = [
    { title: "Core theorem summary", subject: "Algorithms", updated: "2 hours ago" },
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
  });
  let focusSettings = { ...defaultFocusSettings };
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
      eyebrow: "MAKE TIME FOR WHAT MATTERS", title: "Focus", subtitle: "A quieter space for your next study session.",
      settings: "Timer settings", focus: "Focus", shortBreak: "Short break", longBreak: "Long break",
      cycle: "Pomodoro cycle", stayFocused: "Stay focused", takeBreak: "Take a mindful break",
      focusHint: "One thing at a time. You’re making progress.", breakHint: "Step away, stretch, and let your mind reset.",
      next: "Next", subject: "Study subject", chooseSubject: "Choose a subject", task: "Link a task", noTask: "No task linked",
      distraction: "Distraction-free", exitDistraction: "Exit focus mode", start: "Start", pause: "Pause",
      resume: "Resume", reset: "Reset", skip: "Skip session", ready: "Ready when you are",
      paused: "Session paused", complete: "Session complete", focusTimeToday: "Focus today",
      completedToday: "Sessions today", weeklyHours: "Focus this week", streak: "Daily streak",
      totalCycles: "Focus cycles", weeklyChart: "Focus this week", sessionHistory: "Recent sessions",
      noHistory: "No completed focus sessions yet", noHistoryHint: "Your completed focus blocks will appear here.",
      settingsTitle: "Timer settings", durations: "Session lengths", focusDuration: "Focus duration",
      shortDuration: "Short break", longDuration: "Long break", longInterval: "Long break after",
      sessions: "focus sessions", behavior: "Session behavior", autoFocus: "Auto-start focus sessions",
      autoBreaks: "Auto-start breaks", sound: "Completion sound", browserNotifications: "Browser notifications",
      showSeconds: "Show seconds on the flip clock", saveSettings: "Save settings", restoreDefaults: "Restore defaults",
      settingsSaved: "Focus settings saved.", settingsError: "Could not save your focus settings.",
      invalidSettings: "Enter valid session lengths between 1 and 180 minutes and an interval between 2 and 12.",
      notificationsUnsupported: "Browser notifications are not supported here.",
      notificationsDenied: "Notification permission was denied. You can enable it in your browser settings.",
      notificationReady: "Browser notifications enabled while Study Zone is open.",
      focusCompleted: "Focus session complete. Take a short break.",
      focusCompletedTitle: "Focus session complete!",
      cycleCompletedTitle: "Pomodoro cycle complete!",
      focusRewardDetail: "Focused for {duration} · {count} completed sessions",
      breakCompleted: "Break complete. You’re ready for another focus session.",
      sessionSaved: "Focus session saved.", sessionError: "Could not save focus session.",
      dataError: "Focus history could not be loaded.", today: "Today", yesterday: "Yesterday",
      mins: "min", hours: "h", minutes: "minutes", thisCycle: "Cycle",
      notSavedGuest: "Guest focus history is saved in this browser. Sign in to sync it across devices.",
      databaseNote: "Signed-in session history and timer settings are saved to your private Supabase account.",
      pending: "Saving session…", hourChart: "hours", emptySubject: "Independent study",
    },
    ar: {
      eyebrow: "خصص وقتًا لما يهمك", title: "التركيز", subtitle: "مساحة هادئة لجلسة الدراسة القادمة.",
      settings: "إعدادات المؤقت", focus: "تركيز", shortBreak: "استراحة قصيرة", longBreak: "استراحة طويلة",
      cycle: "دورة بومودورو", stayFocused: "حافظ على تركيزك", takeBreak: "استمتع باستراحة هادئة",
      focusHint: "مهمة واحدة في كل مرة. أنت تحرز تقدمًا.", breakHint: "ابتعد قليلًا وتمدد ودع ذهنك يستعيد نشاطه.",
      next: "التالي", subject: "المادة الدراسية", chooseSubject: "اختر مادة", task: "اربط بمهمة", noTask: "لا توجد مهمة مرتبطة",
      distraction: "وضع التركيز", exitDistraction: "إنهاء وضع التركيز", start: "ابدأ", pause: "إيقاف مؤقت",
      resume: "استئناف", reset: "إعادة ضبط", skip: "تخطَّ الجلسة", ready: "ابدأ عندما تكون مستعدًا",
      paused: "الجلسة متوقفة مؤقتًا", complete: "اكتملت الجلسة", focusTimeToday: "وقت التركيز اليوم",
      completedToday: "جلسات اليوم", weeklyHours: "تركيز هذا الأسبوع", streak: "أيام التركيز المتتالية",
      totalCycles: "دورات التركيز", weeklyChart: "تركيز هذا الأسبوع", sessionHistory: "الجلسات الأخيرة",
      noHistory: "لا توجد جلسات تركيز مكتملة بعد", noHistoryHint: "ستظهر هنا جلسات التركيز التي أكملتها.",
      settingsTitle: "إعدادات المؤقت", durations: "مدة الجلسات", focusDuration: "مدة التركيز",
      shortDuration: "الاستراحة القصيرة", longDuration: "الاستراحة الطويلة", longInterval: "الاستراحة الطويلة بعد",
      sessions: "جلسات تركيز", behavior: "سلوك الجلسات", autoFocus: "بدء جلسات التركيز تلقائيًا",
      autoBreaks: "بدء الاستراحات تلقائيًا", sound: "صوت عند اكتمال الجلسة", browserNotifications: "إشعارات المتصفح",
      showSeconds: "عرض الثواني في الساعة القلّابة", saveSettings: "حفظ الإعدادات", restoreDefaults: "استعادة الافتراضية",
      settingsSaved: "تم حفظ إعدادات التركيز.", settingsError: "تعذر حفظ إعدادات التركيز.",
      invalidSettings: "أدخل مددًا صحيحة بين دقيقة و١٨٠ دقيقة، وفاصلًا بين جلستين و١٢ جلسة.",
      notificationsUnsupported: "إشعارات المتصفح غير مدعومة هنا.",
      notificationsDenied: "تم رفض إذن الإشعارات. يمكنك تفعيله من إعدادات المتصفح.",
      notificationReady: "إشعارات المتصفح مفعلة أثناء فتح Study Zone.",
      focusCompleted: "اكتملت جلسة التركيز. حان وقت استراحة قصيرة.",
      focusCompletedTitle: "اكتملت جلسة التركيز!",
      cycleCompletedTitle: "اكتملت دورة بومودورو!",
      focusRewardDetail: "تركيز لمدة {duration} · {count} جلسات مكتملة",
      breakCompleted: "انتهت الاستراحة. أنت مستعد لجلسة تركيز جديدة.",
      sessionSaved: "تم حفظ جلسة التركيز.", sessionError: "تعذر حفظ جلسة التركيز.",
      dataError: "تعذر تحميل سجل التركيز.", today: "اليوم", yesterday: "أمس",
      mins: "د", hours: "س", minutes: "دقيقة", thisCycle: "الدورة",
      notSavedGuest: "يُحفظ سجل التركيز للضيف على هذا الجهاز. سجّل الدخول لمزامنته بين أجهزتك.",
      databaseNote: "يُحفظ سجل الجلسات وإعدادات المؤقت في حسابك الخاص على Supabase.",
      pending: "جارٍ حفظ الجلسة…", hourChart: "ساعات", emptySubject: "دراسة مستقلة",
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
  let dailyReminderPreference = { enabled: false, local_time: "09:00", timezone: "UTC" };
  let rewardSummary = null;
  let earnedAchievements = [];
  const rewardCounterValues = new Map();
  const savedMotionLevel = localStorage.getItem("studyflow.motion");
  let motionLevel = ["full", "reduced", "off"].includes(savedMotionLevel)
    ? savedMotionLevel
    : localStorage.getItem("studyflow.animations") === "off" ? "off" : "full";
  let animationsEnabled = motionLevel !== "off";
  let searchTerm = "";
  let statusFilter = "all";
  let deadlineSearch = "";
  let deadlineFilter = "all";
  let deadlineSort = "due";
  let deadlineView = "list";
  let deadlineMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  let selectedDeadlineDate = dateKey(new Date());
  let editingDeadlineId = null;
  let deadlinesLoading = false;
  const statusChangesInFlight = new Set();

  const deadlineText = {
    en: {
      eyebrow: "STAY A STEP AHEAD", title: "Deadlines", subtitle: "Keep track of everything you need to finish.",
      add: "Add deadline", total: "Total deadlines", upcoming: "Upcoming", overdue: "Overdue", completed: "Completed",
      search: "Search deadlines", all: "All", filterUpcoming: "Upcoming", filterOverdue: "Overdue", filterCompleted: "Completed",
      dueDate: "Due date", priority: "Priority", recentlyAdded: "Recently added", list: "List view", calendar: "Calendar view",
      due: "Due", remaining: "left", tomorrow: "Due tomorrow", today: "Due today", overdueBy: "Overdue by", day: "day", days: "days",
      hour: "hour", hours: "hours", minute: "minute", minutes: "minutes", pending: "Pending", statusCompleted: "Completed", statusOverdue: "Overdue",
      noDeadlines: "No deadlines yet", noDeadlinesHint: "Add the dates you need to remember. They’ll stay in your account.",
      noResults: "No matching deadlines", noResultsHint: "Try a different search or filter.", showing: "Showing", deadline: "deadline", deadlines: "deadlines",
      noDate: "No date selected", noDateHint: "Choose a calendar day to see its deadlines.", noDateItems: "Nothing due on this day.",
      monthLabel: "Calendar month", previous: "Previous month", next: "Next month", currentMonth: "This month",
      modalAdd: "Add deadline", modalEdit: "Edit deadline", modalHelp: "Keep the important details and due time together.",
      titleLabel: "Deadline title", titlePlaceholder: "e.g. Submit research summary", description: "Description", optional: "Optional",
      descriptionPlaceholder: "Add helpful details", subject: "Subject", independent: "Independent study", low: "Low", medium: "Medium", high: "High", urgent: "Urgent",
      date: "Due date", time: "Due time", reminder: "Reminder", noReminder: "No reminder", minBefore: "minutes before", hourBefore: "1 hour before", dayBefore: "1 day before",
      cancel: "Cancel", save: "Save deadline", saving: "Saving…", close: "Close", deleteConfirm: "Delete this deadline? This cannot be undone.",
      validationTitle: "Enter a deadline title.", validationDate: "Choose a due date.", validationPast: "The due date must be in the future.",
      saveSuccess: "Deadline saved.", updateSuccess: "Deadline updated.", deleteSuccess: "Deadline deleted.",
      completeSuccess: "Deadline completed.", reopenSuccess: "Deadline reopened.", loadError: "Could not load deadlines.",
      saveError: "Could not save this deadline.", deleteError: "Could not delete the deadline.", edit: "Edit", delete: "Delete",
      priorityLabel: "Priority", reminderUnavailable: "Run the deadline migration to enable saved reminders.",
      reminderNote: "Reminders are saved with your deadline. Delivery requires the scheduled Supabase function.",
      sampleNote: "Guest preview data is stored in this browser. Sign in to sync deadlines across devices.",
      emptySubject: "No subjects yet",
      daysShort: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
      months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
    },
    ar: {
      eyebrow: "رتّب أولوياتك", title: "المواعيد النهائية", subtitle: "تابع كل ما تحتاج إلى إنجازه في الوقت المناسب.",
      add: "أضف موعدًا", total: "كل المواعيد", upcoming: "القادمة", overdue: "المتأخرة", completed: "المكتملة",
      search: "ابحث في المواعيد", all: "الكل", filterUpcoming: "القادمة", filterOverdue: "متأخرة", filterCompleted: "مكتملة",
      dueDate: "تاريخ الاستحقاق", priority: "الأولوية", recentlyAdded: "الأحدث إضافة", list: "عرض القائمة", calendar: "عرض التقويم",
      due: "الموعد", remaining: "متبقية", tomorrow: "موعدها غدًا", today: "موعدها اليوم", overdueBy: "متأخر منذ", day: "يوم", days: "أيام",
      hour: "ساعة", hours: "ساعات", minute: "دقيقة", minutes: "دقائق", pending: "قيد الانتظار", statusCompleted: "مكتمل", statusOverdue: "متأخر",
      noDeadlines: "لا توجد مواعيد بعد", noDeadlinesHint: "أضف المواعيد التي تريد تذكّرها، وستبقى محفوظة في حسابك.",
      noResults: "لا توجد مواعيد مطابقة", noResultsHint: "جرّب تغيير البحث أو عوامل التصفية.", showing: "عرض", deadline: "موعد", deadlines: "مواعيد",
      noDate: "لم يُحدَّد يوم", noDateHint: "اختر يومًا من التقويم لعرض مواعيده.", noDateItems: "لا توجد مواعيد لهذا اليوم.",
      monthLabel: "شهر التقويم", previous: "الشهر السابق", next: "الشهر التالي", currentMonth: "هذا الشهر",
      modalAdd: "إضافة موعد", modalEdit: "تعديل الموعد", modalHelp: "أضف تفاصيل الموعد وتاريخه لتبقى كلها في مكان واحد.",
      titleLabel: "عنوان الموعد", titlePlaceholder: "مثال: تسليم ملخص البحث", description: "الوصف", optional: "اختياري",
      descriptionPlaceholder: "أضف تفاصيل تساعدك", subject: "المادة", independent: "دراسة مستقلة", low: "منخفضة", medium: "متوسطة", high: "عالية", urgent: "عاجلة",
      date: "تاريخ الاستحقاق", time: "وقت الاستحقاق", reminder: "التذكير", noReminder: "بلا تذكير", minBefore: "دقيقة قبل الموعد", hourBefore: "قبل ساعة", dayBefore: "قبل يوم",
      cancel: "إلغاء", save: "حفظ الموعد", saving: "جارٍ الحفظ…", close: "إغلاق", deleteConfirm: "هل تريد حذف هذا الموعد؟ لا يمكن التراجع عن ذلك.",
      validationTitle: "أدخل عنوان الموعد.", validationDate: "اختر تاريخ الاستحقاق.", validationPast: "يجب أن يكون الموعد في المستقبل.",
      saveSuccess: "تم حفظ الموعد.", updateSuccess: "تم تحديث الموعد.", deleteSuccess: "تم حذف الموعد.",
      completeSuccess: "تم إنجاز الموعد.", reopenSuccess: "تمت إعادة فتح الموعد.", loadError: "تعذّر تحميل المواعيد.",
      saveError: "تعذّر حفظ الموعد.", deleteError: "تعذّر حذف الموعد.", edit: "تعديل", delete: "حذف",
      priorityLabel: "الأولوية", reminderUnavailable: "شغّل ترحيل المواعيد لتفعيل حفظ التذكيرات.",
      reminderNote: "يُحفظ التذكير مع الموعد. يتطلب إرسال التنبيه تفعيل وظيفة Supabase مجدولة.",
      sampleNote: "تُحفظ بيانات المعاينة على هذا الجهاز. سجّل الدخول لمزامنة مواعيدك بين الأجهزة.",
      emptySubject: "لا توجد مواد بعد",
      daysShort: ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"],
      months: ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"],
    },
  };
  const savedLanguage = localStorage.getItem("studyflow.language");
  let appLanguage = savedLanguage === "ar" || savedLanguage === "en"
    ? savedLanguage
    : navigator.language?.toLowerCase().startsWith("ar") ? "ar" : "en";

  function shouldAnimate() {
    return animationsEnabled
      && document.visibilityState === "visible"
      && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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
    "Review registered accounts and their sign-in status.": "راجع الحسابات المسجلة وحالة تسجيل الدخول.",
    "This private list is visible only to authorized administrators.": "هذه القائمة خاصة بالمديرين المصرح لهم فقط.",
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
    "Choose an end date within the next year. Each occurrence is saved as its own task.": "اختر تاريخ انتهاء خلال السنة القادمة. يُحفظ كل موعد كمهمة مستقلة.",
    "Mon": "الإثنين",
    "Tue": "الثلاثاء",
    "Wed": "الأربعاء",
    "Thu": "الخميس",
    "Fri": "الجمعة",
    "Sat": "السبت",
    "Sun": "الأحد",
    "Save task": "حفظ المهمة",
    "KEEP IT MOVING": "واصل التقدم",
    "Add deadline": "إضافة موعد نهائي",
    "Keep the important details and due time together.": "اجمع تفاصيل الموعد وتاريخه في مكان واحد.",
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
    "Connect Supabase to create an account or sign in.": "اربط Supabase لإنشاء حساب أو تسجيل الدخول.",
    "Sign in": "تسجيل الدخول",
    "Create account": "إنشاء حساب",
    "Your name": "اسمك",
    "Email address": "البريد الإلكتروني",
    Password: "كلمة المرور",
    "At least 6 characters": "٦ أحرف على الأقل",
    "Sign out": "تسجيل الخروج",
    "Your password is handled securely by Supabase Auth.": "تُدار كلمة مرورك بأمان عبر خدمة Supabase Auth.",
    "Choose language": "اختر اللغة",
    "Toggle light theme": "تبديل السمة الفاتحة",
    "Motion & celebrations": "الحركة والاحتفالات",
    "Choose how much motion Study Zone uses.": "اختر مستوى الحركة في Study Zone.",
    "Full Motion": "حركة كاملة",
    "Layered transitions and celebrations": "انتقالات واحتفالات متكاملة",
    "Reduced Motion": "حركة مخففة",
    "Short, gentle transitions": "انتقالات قصيرة وهادئة",
    "Motion Off": "إيقاف الحركة",
    "Disable nonessential animation": "إيقاف الحركات غير الضرورية",
    "Animation level": "مستوى الحركة",
    "You’re offline. Network-backed data and sync are unavailable; changes may not be saved.": "أنت غير متصل بالإنترنت. البيانات والمزامنة عبر الشبكة غير متاحة؛ قد لا تُحفظ التغييرات.",
    "Settings saved.": "تم حفظ الإعدادات.",
    "Language changed.": "تم تغيير اللغة.",
    "Unlocked": "تم الفتح",
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
    "Build a 7-day activity streak.": "حافظ على نشاط دراسي لمدة ٧ أيام متتالية.",
    "Consistency Champion": "بطل الاستمرارية",
    "Build a 30-day activity streak.": "حافظ على نشاط دراسي لمدة ٣٠ يومًا متتاليًا.",
    "Sign in to earn secure rewards.": "سجّل الدخول لكسب المكافآت بأمان.",
    "Rewards load after applying the latest Supabase migration.": "ستظهر المكافآت بعد تطبيق آخر تحديث لقاعدة Supabase.",
    "Earned achievements": "الإنجازات المكتسبة",
    "No achievements unlocked yet.": "لم تُفتح إنجازات بعد.",
    "Level": "المستوى",
    "XP": "نقطة خبرة",
    "Progress to next level": "التقدم نحو المستوى التالي",
    "Completed tasks": "المهام المكتملة",
    "Focus sessions": "جلسات التركيز",
    "Goals achieved": "الأهداف المحققة",
    "Study streak": "سلسلة الدراسة",
    "Your level increased!": "ارتقى مستواك!",
    "You've reached a new study milestone.": "لقد وصلت إلى محطة دراسية جديدة.",
    "Install app": "تثبيت التطبيق",
    "Install Study Zone": "تثبيت Study Zone",
    "Done": "تم",
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
    "Add a subject to start tracking course progress.": "أضف مادة لمتابعة تقدمك الدراسي.",
    "A clear plan makes room for your best work.": "الخطة الواضحة تهيئ لك أفضل إنجاز.",
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
    "Preview figures are sample data until you connect your Supabase project.": "الأرقام المعروضة تجريبية حتى تربط مشروع Supabase.",
    TASKBOARD: "لوحة المهام",
    "Tasks & deadlines": "المهام والمواعيد النهائية",
    "Keep assignments, priorities, and due dates in one calm place.": "نظّم واجباتك وأولوياتك ومواعيدها في مكان واحد.",
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
    "Try another search or add your next task.": "جرّب بحثًا آخر أو أضف مهمتك التالية.",
    "Your tasks": "مهامك",
    " tasks remaining": " مهام متبقية",
    "Tasks are stored in this browser in preview mode. Signed-in accounts use Supabase.": "تُحفظ المهام في هذا المتصفح في وضع المعاينة، وتُزامن مع Supabase بعد تسجيل الدخول.",
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
    "Make a realistic plan, then give yourself room to adapt.": "ضع خطة واقعية واترك مساحة للتغيير.",
    "Plan a block": "إضافة جلسة",
    "This week": "هذا الأسبوع",
    "Planned sessions · preview": "الجلسات المخططة · معاينة",
    "Open day": "يوم متاح",
    "No study blocks planned.": "لا توجد جلسات دراسية مخططة.",
    "Planned vs. actual": "المخطط مقابل الفعلي",
    "Compare time blocks with completed focus sessions": "قارن الجلسات المخططة بجلسات التركيز المكتملة",
    "planned this week": "مخطط هذا الأسبوع",
    "5.1 hours logged in this sample week": "سُجلت ٥٫١ ساعات في هذا الأسبوع التجريبي",
    "Planning tip": "نصيحة للتخطيط",
    "Leave a little breathing room between study blocks. A flexible plan is easier to keep than a perfect one.": "اترك وقتًا للراحة بين الجلسات. فالخطة المرنة أسهل التزامًا من الخطة المثالية.",
    "YOUR COURSES": "موادك الدراسية",
    "A quick view of your courses, credits, and learning progress.": "نظرة سريعة على موادك وساعاتها وتقدمك الدراسي.",
    "Add subject": "إضافة مادة",
    credits: "ساعات معتمدة",
    "Keep your notes, tasks, and study sessions connected to this course.": "اربط ملاحظاتك ومهامك وجلساتك الدراسية بهذه المادة.",
    "Learning progress": "التقدم الدراسي",
    "No subjects yet": "لا توجد مواد بعد",
    "Add your first course to start organizing your study workspace.": "أضف مادتك الأولى لتنظيم مساحة دراستك.",
    "Subject details loaded from your account. Course progress appears as you log study sessions.": "تم تحميل المواد من حسابك. سيظهر تقدمك عند تسجيل جلسات الدراسة.",
    "Preview content. Subject management will be backed by your Supabase database.": "محتوى تجريبي. ستُدار المواد عبر قاعدة بيانات Supabase.",
    "STUDY MATERIALS": "المواد الدراسية",
    "Your files": "ملفاتك",
    "A tidy home for resources from every course.": "مكان منظم لمراجع كل مادة.",
    "Upload file": "رفع ملف",
    "Course resources": "مراجع المقرر",
    "Organize future uploads by subject and folder.": "نظّم ملفاتك حسب المادة والمجلد.",
    "Sample file cards are for layout preview. Storage uploads require a private Supabase bucket.": "الملفات المعروضة تجريبية. يتطلب رفع الملفات إعداد مساحة تخزين خاصة في Supabase.",
    "YOUR KNOWLEDGE VAULT": "مستودع معرفتك",
    "Capture what matters and find it when you need it.": "دوّن ما يهمك واعثر عليه وقت الحاجة.",
    "New note": "ملاحظة جديدة",
    Updated: "تم التحديث",
    "A place for your key ideas, examples, and questions to revisit later.": "مساحة لأفكارك وأمثلتك وأسئلتك المهمة للعودة إليها لاحقًا.",
    "Sample content only. Notes can be stored in your private Supabase workspace.": "محتوى تجريبي. يمكن حفظ ملاحظاتك في مساحة Supabase الخاصة بك.",
    "YOUR STUDY PATTERNS": "أنماط دراستك",
    "Understand your study habits without losing sight of the bigger picture.": "افهم عادات دراستك مع الحفاظ على نظرتك الشاملة.",
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
    "Study time is summed from completed focus sessions. Task completion is completed tasks divided by all tasks in the selected range. Connect your database to replace the preview with your records.": "يُحسب وقت الدراسة من جلسات التركيز المكتملة. ونسبة إنجاز المهام هي المهام المكتملة مقسومة على إجمالي المهام في الفترة المحددة. اربط قاعدة بياناتك لعرض سجلاتك الفعلية.",
    "MILESTONES THAT MATTER": "إنجازات تستحق الاحتفاء",
    "Turn the semester into small, achievable steps.": "حوّل الفصل الدراسي إلى خطوات صغيرة قابلة للإنجاز.",
    "Create a goal": "إنشاء هدف",
    "LEFT": "متبقية",
    "Preview goals. Your own goals will be stored per-user after connecting Supabase.": "أهداف تجريبية. ستُحفظ أهدافك في حسابك بعد ربط Supabase.",
    "EXAM TRACKER": "متابعة الاختبارات",
    "Keep upcoming assessments and your progress in one view.": "تابع اختباراتك القادمة وتقدمك في مكان واحد.",
    "Add exam": "إضافة اختبار",
    "PAST RESULT · SAMPLE": "نتيجة سابقة · تجريبية",
    "Recorded exam score preview": "معاينة نتيجة اختبار مسجلة",
    "Upcoming assessments": "الاختبارات القادمة",
    "No upcoming exams connected": "لا توجد اختبارات قادمة مرتبطة",
    "Add your real exam dates after connecting the database.": "أضف مواعيد اختباراتك بعد ربط قاعدة البيانات.",
    MILESTONES: "محطات الإنجاز",
    "Celebrate consistency and progress, not just perfect days.": "احتفِ بالاستمرار والتقدم، لا بالأيام المثالية فقط.",
    "Unlocked in sample data": "مفتوح في البيانات التجريبية",
    "Keep going to unlock": "واصل التقدم لفتحه",
    "Your progress level": "مستوى تقدمك",
    "sample XP": "نقاط خبرة تجريبية",
    "XP and rewards must be granted by trusted database operations, never directly from the browser.": "يجب منح نقاط الخبرة والمكافآت عبر عمليات قاعدة بيانات موثوقة، وليس مباشرة من المتصفح.",
    UPDATES: "التحديثات",
    "A quiet place for reminders, milestones, and important updates.": "مساحة هادئة للتذكيرات والإنجازات والتحديثات المهمة.",
    "Mark all read": "تحديد الكل كمقروء",
    "All caught up": "أنت على اطلاع بكل جديد",
    "Sign in to sync notifications": "سجّل الدخول لمزامنة الإشعارات",
    "Deadline reminders will appear here when generated.": "ستظهر تذكيرات المواعيد هنا عند إنشائها.",
    "Your private deadline notifications are attached to your account.": "إشعارات مواعيدك الخاصة مرتبطة بحسابك.",
    "YOUR ACCOUNT": "حسابك",
    "Your academic workspace, at a glance.": "نظرة سريعة على مساحة دراستك.",
    Level: "المستوى",
    "Day streak": "أيام متتالية",
    "Academic profile": "الملف الدراسي",
    "Personal details stay private to your account": "بياناتك الشخصية خاصة بحسابك",
    Program: "البرنامج الدراسي",
    "Computer Science · sample profile": "علوم الحاسب · ملف تجريبي",
    "Current term": "الفصل الحالي",
    "Fall term · update in your profile": "فصل الخريف · عدّل بياناتك في الملف الشخصي",
    Timezone: "المنطقة الزمنية",
    "Edit profile": "تعديل الملف الشخصي",
    "MAKE IT YOURS": "خصص تجربتك",
    "Tune Study Zone to the way you like to work.": "اضبط Study Zone بما يناسب أسلوب عملك.",
    Appearance: "المظهر",
    "Dark theme": "السمة الداكنة",
    "Designed for focus, day or night": "مصممة للتركيز ليلًا ونهارًا",
    "Emerald accents": "لمسات الزمرد",
    "Official Study Zone color palette": "لوحة ألوان Study Zone الرسمية",
    Language: "اللغة",
    "Display language": "لغة العرض",
    "Deadlines appear in the selected language.": "تُعرض المواعيد باللغة المحددة.",
    Reminders: "التذكيرات",
    "Task reminders": "تذكيرات المهام",
    "Upcoming deadlines": "المواعيد القادمة",
    "Study nudges": "تذكيرات الدراسة",
    "Gentle focus reminders": "تذكيرات لطيفة للتركيز",
    "Daily study check-in": "تذكير يومي بالدراسة",
    "Review your open tasks once a day, even when Study Zone is closed.": "راجع مهامك المفتوحة مرة يوميًا، حتى عند إغلاق Study Zone.",
    "Enable push reminders": "تفعيل الإشعارات الفورية",
    "Reminder time": "وقت التذكير",
    "Uses this device’s timezone.": "يستخدم المنطقة الزمنية لهذا الجهاز.",
    "Save reminder": "حفظ التذكير",
    "Get a daily task check-in plus deadline and achievement notifications, even when Study Zone is closed.": "احصل على تذكير يومي بالمهام وإشعارات المواعيد والإنجازات حتى عند إغلاق Study Zone.",
    "Push reminders need notification permission and the server setup described in README.md.": "تتطلب الإشعارات الفورية إذن الإشعارات وإعداد الخادم الموضح في README.md.",
    "Sign in to configure daily reminders.": "سجّل الدخول لإعداد التذكيرات اليومية.",
    "Choose a profile photo from your device": "اختر صورة الملف الشخصي من جهازك",
    "PNG, JPEG, or WebP · up to 2 MB": "PNG أو JPEG أو WebP · حتى ٢ ميجابايت",
    "Could not save your reminder.": "تعذّر حفظ التذكير.",
    "Notification permission is required to enable daily push reminders.": "يلزم السماح بالإشعارات لتفعيل التذكير اليومي.",
    "Daily push is not configured yet. Ask your administrator to finish the VAPID setup.": "لم يتم إعداد الإشعارات اليومية بعد. اطلب من المسؤول إكمال إعداد VAPID.",
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
    "Reward": "المكافأة",
    "Data & privacy": "البيانات والخصوصية",
    "Account data": "بيانات الحساب",
    "Stored in your private Supabase account when configured": "تُحفظ في حساب Supabase الخاص بك بعد الإعداد",
    "Service keys": "مفاتيح الخدمة",
    "Only the public anon key belongs in this browser config.": "يُسمح بوضع المفتاح العام anon فقط في إعدادات المتصفح.",
    ADMINISTRATION: "إدارة النظام",
    "Protected operational metrics and account administration.": "مؤشرات التشغيل المحمية وإدارة الحسابات.",
    "Checking administrator access…": "جارٍ التحقق من صلاحية المدير…",
    "Administrator access denied.": "تم رفض صلاحية الوصول إلى لوحة الإدارة.",
    "Could not verify administrator access.": "تعذّر التحقق من صلاحية المدير.",
    "Administrator access verified.": "تم التحقق من صلاحية المدير.",
    "No administrative services are connected yet.": "لم يتم ربط أدوات الإدارة بعد.",
    "The admin role is verified by Supabase for your signed-in account.": "تحقّق Supabase من صلاحية المدير لحسابك المسجّل.",
    "REGISTERED USERS": "المستخدمون المسجلون",
    " Configure a protected server query": " أعد إعداد استعلام خادم محمي",
    "ACTIVE SESSIONS": "الجلسات النشطة",
    " Admin-only metric unavailable": " المؤشر متاح للمدير فقط",
    "SYSTEM STATUS": "حالة النظام",
    Protected: "محمي",
    " No admin endpoint configured": " لم يتم إعداد واجهة الإدارة",
    "Access control": "التحكم في الوصول",
    "The database uses a non-user-editable profile role field and row-level policies. Add an Edge Function or trusted server for any cross-user administration or suspension feature.": "تستخدم قاعدة البيانات دورًا للملف الشخصي لا يستطيع المستخدم تعديله وسياسات على مستوى الصفوف. أضف وظيفة Edge أو خادمًا موثوقًا لأي إدارة بين المستخدمين أو لتعليق الحسابات.",
    "Sample study hours over the last seven days": "ساعات دراسة تجريبية خلال الأيام السبعة الماضية",
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
    "Check your email to confirm your new account.": "تحقق من بريدك الإلكتروني لتأكيد حسابك الجديد.",
    "Small steps. Meaningful progress.": "خطوات صغيرة، وتقدم ملموس.",
    "Plan a block": "إضافة جلسة",
    "New task": "مهمة جديدة",
    "Add subject": "إضافة مادة",
    "Upload file": "رفع ملف",
    "New note": "ملاحظة جديدة",
    "Create a goal": "إنشاء هدف",
    "Add exam": "إضافة اختبار",
    "Set SUPABASE_URL and SUPABASE_ANON_KEY in supabase-config.js to enable sign-in.": "أضف SUPABASE_URL وSUPABASE_ANON_KEY إلى supabase-config.js لتفعيل تسجيل الدخول.",
    "Language saved on this device, but account sync failed:": "تم حفظ اللغة على هذا الجهاز، لكن تعذرت مزامنتها مع الحساب:",
    "Could not load subjects:": "تعذّر تحميل المواد:",
    "Could not load tasks:": "تعذّر تحميل المهام:",
    "Could not load notifications:": "تعذّر تحميل الإشعارات:",
    "Could not update notifications:": "تعذّر تحديث الإشعارات:",
    "Could not restore session:": "تعذّرت استعادة الجلسة:",
    "Could not sign out:": "تعذّر تسجيل الخروج:",
    "Invalid login credentials": "بيانات تسجيل الدخول غير صحيحة.",
    "User already registered": "هذا البريد الإلكتروني مسجل بالفعل.",
    "Email not confirmed": "لم يتم تأكيد البريد الإلكتروني بعد.",
    "Password should be at least 6 characters": "يجب ألا تقل كلمة المرور عن ٦ أحرف.",
    "Failed to fetch": "تعذر الاتصال بالخادم. تحقق من اتصالك بالإنترنت.",
    "Authentication failed": "تعذّر تسجيل الدخول. تحقق من بياناتك وحاول مجددًا.",
    "Delete this deadline? This cannot be undone.": "هل تريد حذف هذا الموعد؟ لا يمكن التراجع عن ذلك.",
    "This is a local preview. Add your Supabase project details to enable authentication.": "هذه معاينة محلية. أضف بيانات مشروع Supabase لتفعيل تسجيل الدخول.",
    "Sign in to sync your private study workspace.": "سجّل الدخول لمزامنة مساحة دراستك الخاصة.",
    "Your password is handled securely by Supabase Auth.": "تُدار كلمة مرورك بأمان عبر خدمة Supabase Auth.",
    "Add your Supabase URL and public anon key in supabase-config.js and allow the SDK to load": "أضف رابط Supabase ومفتاح anon العام إلى supabase-config.js وتأكد من تحميل مكتبة SDK.",
    "Study planning is a preview; scheduling is not implemented, so nothing was saved.": "مخطط الدراسة للمعاينة؛ إنشاء الجلسات غير منفذ، ولم يُحفظ أي شيء.",
    "Subject management is not implemented yet; no subject was created.": "إدارة المواد غير منفذة حاليًا؛ لم تُضف أي مادة.",
    "File uploads are unavailable; storage upload is not implemented, so no file was uploaded.": "رفع الملفات غير متاح؛ آلية الرفع غير منفذة، ولم يُرفع أي ملف.",
    "Notes are a preview; note editing is not implemented, so nothing was saved.": "الملاحظات للمعاينة؛ تحرير الملاحظات غير منفذ، ولم يُحفظ أي شيء.",
    "Goals are a preview; goal creation is not implemented, so no goal was saved.": "الأهداف للمعاينة؛ إنشاء الأهداف غير منفذ، ولم يُحفظ أي هدف.",
    "Exam tracking is not implemented yet; no exam or result was saved.": "متابعة الاختبارات غير منفذة حاليًا؛ لم يُحفظ أي اختبار أو نتيجة.",
    "Notification read state will sync after connecting your account.": "ستُزامن حالة قراءة الإشعارات بعد ربط حسابك.",
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
    "Review key topics before the assessment": "مراجعة الموضوعات الأساسية قبل الاختبار",
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
  };
  const originalTextNodes = new WeakMap();
  const originalAttributes = new WeakMap();

  function translateUiText(value, { preserveNumeric = false } = {}) {
    const text = String(value ?? "");
    const trimmed = text.trim();
    if (!trimmed) return text;
    if (appLanguage === "ar") {
      const arabicQuantity = (value, forms) => {
        const number = Number(value);
        const form = number === 1 ? forms.one : number === 2 ? forms.two : number >= 3 && number <= 10 ? forms.few : forms.many;
        return `${new Intl.NumberFormat("ar-EG").format(number)} ${form}`;
      };
      if (interfaceText[text]) return interfaceText[text];
      if (interfaceText[trimmed]) return text.replace(trimmed, interfaceText[trimmed]);
      const iconButton = trimmed.match(/^([＋↑])\s*(.+)$/);
      if (iconButton && interfaceText[iconButton[2]]) {
        return text.replace(trimmed, `${iconButton[1]} ${interfaceText[iconButton[2]]}`);
      }
      const greeting = trimmed.match(/^Good (morning|afternoon|evening), (.+)\.$/);
      if (greeting) return text.replace(trimmed, `${interfaceText[`Good ${greeting[1]}`]}، ${greeting[2]}.`);
      const chartTooltip = trimmed.match(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun): ([\d.]+) hours?$/);
      if (chartTooltip) {
        const day = interfaceText[chartTooltip[1]];
        const hours = new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 1 }).format(Number(chartTooltip[2]));
        return text.replace(trimmed, `${day}: ${hours} ساعة`);
      }
      const hours = trimmed.match(/^([\d,.]+)h$/);
      if (hours) return text.replace(trimmed, `${new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 1 }).format(Number(hours[1].replace(",", "")))} س`);
      const duration = trimmed.match(/^([\d,.]+) min$/);
      if (duration) {
        const number = Number(duration[1].replace(",", ""));
        return text.replace(trimmed, `${new Intl.NumberFormat("ar-EG").format(number)} ${number === 1 ? "دقيقة" : "دقيقة"}`);
      }
      const timeDuration = trimmed.match(/^(\d{1,2}:\d{2}) · (\d+) min$/);
      if (timeDuration) {
        const time = timeDuration[1].replace(/\d/g, (digit) => new Intl.NumberFormat("ar-EG").format(Number(digit)));
        return text.replace(trimmed, `${time} · ${new Intl.NumberFormat("ar-EG").format(Number(timeDuration[2]))} دقيقة`);
      }
      const xp = trimmed.match(/^(.*?)((?:[\d,.]+)) (sample )?XP$/);
      if (xp) {
        const points = new Intl.NumberFormat("ar-EG").format(Number(xp[2].replace(",", "")));
        return text.replace(trimmed, `${xp[1]}${points} ${xp[3] ? "نقطة خبرة تجريبية" : "نقطة خبرة"}`);
      }
      const daysLeft = trimmed.match(/^(\d+) DAYS LEFT$/);
      if (daysLeft) return text.replace(trimmed, `متبقي ${arabicQuantity(daysLeft[1], { one: "يوم واحد", two: "يومان", few: "أيام", many: "يوم" })}`);
      const weeksLeft = trimmed.match(/^(\d+) WEEK LEFT$/);
      if (weeksLeft) return text.replace(trimmed, `متبقي ${arabicQuantity(weeksLeft[1], { one: "أسبوع واحد", two: "أسبوعان", few: "أسابيع", many: "أسبوع" })}`);
      const shortWeeks = trimmed.match(/^(\d+) weeks?$/);
      if (shortWeeks) return text.replace(trimmed, `${new Intl.NumberFormat("ar-EG").format(Number(shortWeeks[1]))} ${Number(shortWeeks[1]) === 1 ? "أسبوع" : "أسابيع"}`);
      const sampleXp = trimmed.match(/^([\d,.]+) sample XP$/);
      if (sampleXp) return text.replace(trimmed, `${new Intl.NumberFormat("ar-EG").format(Number(sampleXp[1].replace(",", "")))} نقطة خبرة تجريبية`);
      const fileType = trimmed.match(/^(.+) · (PDF|Notes|Image)$/);
      if (fileType) {
        const type = { PDF: "PDF", Notes: "ملاحظات", Image: "صورة" }[fileType[2]];
        return text.replace(trimmed, `${fileType[1]} · ${type}`);
      }
      const numeric = preserveNumeric ? null : trimmed.match(/^([+-]?\d[\d,.]*(?:\/\d[\d,.]*)?)(%)?$/);
      if (numeric) {
        const localized = numeric[1].replace(/\d/g, (digit) => new Intl.NumberFormat("ar-EG").format(Number(digit)));
        return text.replace(trimmed, `${localized}${numeric[2] ? "٪" : ""}`);
      }
      const relativeTime = trimmed.match(/^Updated (Today|Yesterday|\d+ hours? ago)$/);
      if (relativeTime) {
        const value = relativeTime[1] === "Today" ? "اليوم"
          : relativeTime[1] === "Yesterday" ? "أمس"
            : relativeTime[1].replace(/^(\d+) hours? ago$/, (_, count) => {
              const number = Number(count);
              if (number === 1) return "قبل ساعة";
              if (number === 2) return "قبل ساعتين";
              return `قبل ${new Intl.NumberFormat("ar-EG").format(number)} ساعات`;
            });
        return text.replace(trimmed, `تم التحديث ${value}`);
      }
      const remainingShort = trimmed.match(/^(\d+) left ·$/);
      if (remainingShort) return text.replace(trimmed, `متبقي ${new Intl.NumberFormat("ar-EG").format(Number(remainingShort[1]))} ·`);
      const shortDays = trimmed.match(/^(\d+) days?$/);
      if (shortDays) return text.replace(trimmed, arabicQuantity(shortDays[1], { one: "يوم واحد", two: "يومان", few: "أيام", many: "يوم" }));
      const blockCount = trimmed.match(/^(\d+) blocks?$/);
      if (blockCount) return text.replace(trimmed, arabicQuantity(blockCount[1], { one: "جلسة واحدة", two: "جلستان", few: "جلسات", many: "جلسة" }));
      const remainingTasks = trimmed.match(/^(\d+) tasks remaining$/);
      if (remainingTasks) return text.replace(trimmed, `${arabicQuantity(remainingTasks[1], { one: "مهمة", two: "مهمتان", few: "مهام", many: "مهمة" })} متبقية`);
      const creditCount = trimmed.match(/^(\d+) credits$/);
      if (creditCount) return text.replace(trimmed, arabicQuantity(creditCount[1], { one: "ساعة معتمدة", two: "ساعتان معتمدتان", few: "ساعات معتمدة", many: "ساعة معتمدة" }));
      const taskDays = trimmed.match(/^(\d+) days? left$/);
      if (taskDays) return text.replace(trimmed, `متبقي ${arabicQuantity(taskDays[1], { one: "يوم واحد", two: "يومان", few: "أيام", many: "يوم" })}`);
      const level = trimmed.match(/^Level (\d+)$/);
      if (level) return text.replace(trimmed, `المستوى ${new Intl.NumberFormat("ar-EG").format(Number(level[1]))}`);
      const signedIn = trimmed.match(/^Signed in as (.+)$/);
      if (signedIn) return text.replace(trimmed, `تم تسجيل الدخول باسم ${signedIn[1]}`);
      const languageSync = trimmed.match(/^Language saved on this device, but account sync failed:?\s*(.*)$/);
      if (languageSync) return text.replace(trimmed, `تم حفظ اللغة على هذا الجهاز، لكن تعذرت مزامنتها مع الحساب.${languageSync[1] ? ` ${languageSync[1]}` : ""}`);
      const signOutError = trimmed.match(/^Could not sign out:?\s*(.*)$/);
      if (signOutError) return text.replace(trimmed, `تعذّر تسجيل الخروج.${signOutError[1] ? ` ${signOutError[1]}` : ""}`);
      const sessionError = trimmed.match(/^Could not restore session:?\s*(.*)$/);
      if (sessionError) return text.replace(trimmed, `تعذّرت استعادة الجلسة.${sessionError[1] ? ` ${sessionError[1]}` : ""}`);
      const updated = trimmed.match(/^Updated (.+)$/);
      if (updated) return text.replace(trimmed, `تم التحديث ${updated[1]}`);
      const after = trimmed.match(/^Could not (load|save|update|delete|restore) (.+?)(?::)?(.*)$/);
      if (after) {
        const action = { load: "تحميل", save: "حفظ", update: "تحديث", delete: "حذف", restore: "استعادة" }[after[1]];
        const subject = { subjects: "المواد", tasks: "المهام", task: "المهمة", notifications: "الإشعارات", session: "الجلسة", "focus session": "جلسة التركيز", "focus settings": "إعدادات التركيز", "this task": "هذه المهمة", "the deadline": "الموعد" }[after[2].trim()] || after[2].trim();
        const detail = after[3] ? translateUiText(after[3]) : "";
        return text.replace(trimmed, `تعذّر ${action} ${subject}${detail}`);
      }
      const deleteTask = trimmed.match(/^Delete "(.+)"\?$/);
      if (deleteTask) return text.replace(trimmed, `هل تريد حذف "${deleteTask[1]}"؟`);
      const actionForTask = trimmed.match(/^(Complete|Reopen|Delete) (.+)$/);
      if (actionForTask) {
        const action = { Complete: "إنجاز", Reopen: "إعادة فتح", Delete: "حذف" }[actionForTask[1]];
        return text.replace(trimmed, `${action} ${actionForTask[2]}`);
      }
      return text;
    }
    return text;
  }

  function translateInterface() {
    document.documentElement.lang = appLanguage;
    document.documentElement.dir = appLanguage === "ar" ? "rtl" : "ltr";
    document.title = appLanguage === "ar" ? "Study Zone — حياتك الدراسية، منظمة" : "Study Zone — Your Study Life, Organized";
    const description = document.querySelector('meta[name="description"]');
    if (description) description.content = appLanguage === "ar" ? "Study Zone — حياتك الدراسية، منظمة." : "Study Zone — Your Study Life, Organized.";
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (node.parentElement?.closest("script,style,textarea")) continue;
      if (!originalTextNodes.has(node)) originalTextNodes.set(node, node.nodeValue);
      const source = originalTextNodes.get(node);
      const preserveNumeric = Boolean(node.parentElement?.closest('[dir="auto"],[data-ltr]'));
      node.nodeValue = appLanguage === "ar" && !node.parentElement?.closest("#flip-clock")
        ? translateUiText(source, { preserveNumeric })
        : source;
    }
    document.querySelectorAll("input[placeholder],textarea[placeholder],[aria-label],[title]").forEach((element) => {
      if (!originalAttributes.has(element)) originalAttributes.set(element, new Map());
      const originals = originalAttributes.get(element);
      for (const attribute of ["placeholder", "aria-label", "title"]) {
        if (!element.hasAttribute(attribute)) continue;
        if (!originals.has(attribute)) originals.set(attribute, element.getAttribute(attribute));
        const source = originals.get(attribute);
        element.setAttribute(attribute, appLanguage === "ar" ? translateUiText(source) : source);
      }
    });
    updatePwaInstallButton();
    refreshPwaInstructions();
  }

  function isPwaInstalled() {
    return window.matchMedia?.("(display-mode: standalone)").matches || navigator.standalone === true;
  }

  function getPwaInstallInstructions() {
    const userAgent = navigator.userAgent || "";
    const isIos = /iphone|ipad|ipod/i.test(userAgent)
      || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isSafari = /safari/i.test(userAgent)
      && !/(chrome|crios|android|edg|opr|firefox|fxios)/i.test(userAgent);
    const isMacSafari = navigator.platform?.includes("Mac") && isSafari;
    if (appLanguage === "ar") {
      if (isIos) return "على iPhone أو iPad: افتح الصفحة في Safari، واضغط «مشاركة»، ثم اختر «إضافة إلى الشاشة الرئيسية». تختلف الخطوات حسب إصدار النظام.";
      if (isMacSafari) return "على Safari في Mac: من قائمة ملف اختر «إضافة إلى Dock». يعتمد ذلك على إصدار Safari وmacOS.";
      if (/android/i.test(userAgent)) return "على Android: استخدم قائمة المتصفح واختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية» إذا ظهر الخيار. يختلف الدعم حسب المتصفح ومتطلباته.";
      return "استخدم قائمة المتصفح واختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية» إذا ظهر الخيار. تختلف إمكانية التثبيت حسب المتصفح والجهاز.";
    }
    if (isIos) return "On iPhone or iPad: open this page in Safari, tap Share, then choose Add to Home Screen. The exact steps vary by iOS version.";
    if (isMacSafari) return "In Safari on Mac, choose File > Add to Dock. Availability depends on your Safari and macOS versions.";
    if (/android/i.test(userAgent)) return "On Android, open the browser menu and choose Install app or Add to Home screen if offered. Support varies by browser and its requirements.";
    return "Use your browser menu and choose Install app or Add to Home screen if offered. Installation options vary by browser and device.";
  }

  function updatePwaInstallButton() {
    const button = document.getElementById("pwa-install");
    if (button) button.hidden = pwaInstalled || isPwaInstalled();
  }

  function updateOfflineStatus() {
    const status = document.getElementById("offline-status");
    if (status) status.hidden = navigator.onLine;
  }

  function refreshPwaInstructions() {
    const instructions = document.getElementById("pwa-install-instructions");
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
      document.getElementById("pwa-install-modal").hidden = false;
      return;
    }
    const prompt = deferredInstallPrompt;
    deferredInstallPrompt = null;
    updatePwaInstallButton();
    try {
      await prompt.prompt();
      await prompt.userChoice;
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
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[char]);
  }

  function readLocalTasks() {
    try {
      const saved = localStorage.getItem(storageKey);
      if (!saved) return seededTasks.map((task) => ({ ...task }));
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) throw new Error("Stored task data is invalid.");
      return parsed;
    } catch (error) {
      console.error("Could not read saved tasks.", error);
      return seededTasks.map((task) => ({ ...task }));
    }
  }

  function saveLocalTasks() {
    localStorage.setItem(storageKey, JSON.stringify(tasks));
  }

  function initials(name) {
    return String(name || "Student").trim().split(/\s+/).slice(0, 2).map((part) => part[0] || "").join("").toUpperCase();
  }

  function subjectName(id) {
    return subjects.find((subject) => subject.id === id)?.name || "Independent study";
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
    const prefix = isToday ? (appLanguage === "ar" ? "اليوم" : "Today")
      : date.toDateString() === tomorrow.toDateString() ? (appLanguage === "ar" ? "غدًا" : "Tomorrow")
        : date.toLocaleDateString(locale, { weekday: "short", month: "short", day: "numeric" });
    return `${prefix} · ${date.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" })}`;
  }

  function setConnectionState(text, connected) {
    const status = document.getElementById("connection-state");
    status.replaceChildren(document.createElement("i"), document.createTextNode(text));
    status.classList.toggle("connected", Boolean(connected));
    translateInterface();
  }

  function showToast(message) {
    const region = document.getElementById("toast-region");
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    region.append(toast);
    translateInterface();
    window.setTimeout(() => toast.remove(), 3500);
  }

  function showRewardToast(amount) {
    if (amount <= 0) return;
    const region = document.getElementById("toast-region");
    const toast = document.createElement("div");
    toast.className = "toast reward-toast";
    const label = document.createElement("span");
    label.textContent = appLanguage === "ar" ? "مكافأة التقدم" : "Progress reward";
    const points = document.createElement("strong");
    points.dir = "ltr";
    points.textContent = `+${new Intl.NumberFormat(appLanguage === "ar" ? "ar-EG" : "en").format(amount)} XP`;
    toast.append(label, points);
    region.append(toast);
    window.setTimeout(() => toast.remove(), 4200);
    if (shouldAnimate()) toast.animate(
      [{ opacity: 0, transform: "translateY(8px) scale(.98)" }, { opacity: 1, transform: "translateY(0) scale(1)" }],
      { duration: motionLevel === "reduced" ? 150 : 260, easing: "cubic-bezier(.2,.7,.2,1)" },
    );
  }

  function openCelebration(title, description, amount = 0, isUserContent = false) {
    const modal = document.getElementById("celebration-modal");
    document.getElementById("celebration-title").textContent = translateUiText(title);
    document.getElementById("celebration-description").textContent = isUserContent ? description : translateUiText(description);
    const xp = document.getElementById("celebration-xp");
    xp.dir = "ltr";
    xp.hidden = amount <= 0;
    xp.textContent = amount > 0
      ? `+${new Intl.NumberFormat(appLanguage === "ar" ? "ar-EG" : "en").format(amount)} XP`
      : "";
    modal.hidden = false;
    if (shouldAnimate()) {
      const offset = motionLevel === "reduced" ? 4 : 14;
      const scale = motionLevel === "reduced" ? .99 : .96;
      modal.querySelector(".celebration-modal").animate(
        [{ opacity: 0, transform: `translateY(${offset}px) scale(${scale})` }, { opacity: 1, transform: "translateY(0) scale(1)" }],
        { duration: motionLevel === "reduced" ? 160 : 320, easing: "cubic-bezier(.2,.7,.2,1)" },
      );
      if (shouldUseFullMotion()) launchConfetti();
    }
  }

  function rewardCounterMarkup(key, value) {
    const number = Math.max(0, Math.floor(Number(value) || 0));
    return `<span data-reward-counter="${key}" data-counter-value="${number}">${new Intl.NumberFormat(appLanguage === "ar" ? "ar-EG" : "en").format(number)}</span>`;
  }

  function animateRewardCounters() {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.querySelectorAll("[data-reward-counter]").forEach((counter) => {
      const key = counter.dataset.rewardCounter;
      const target = Number(counter.dataset.counterValue);
      const previous = rewardCounterValues.get(key);
      rewardCounterValues.set(key, target);
      if (!Number.isFinite(target) || previous === target || !shouldAnimate() || reduceMotion) return;
      const startValue = previous ?? 0;
      const start = performance.now();
      const duration = motionLevel === "reduced" ? 180 : 420;
      const update = (now) => {
        const progress = Math.min(1, (now - start) / duration);
        const eased = 1 - (1 - progress) ** 3;
        const value = Math.round(startValue + (target - startValue) * eased);
        counter.textContent = new Intl.NumberFormat(appLanguage === "ar" ? "ar-EG" : "en").format(value);
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
    const colors = ["#06D6A0", "#E6FBF6", "#75CDB1"];
    for (let index = 0; index < 24; index += 1) {
      const particle = document.createElement("i");
      particle.style.setProperty("--particle-x", `${Math.round(Math.random() * 100)}vw`);
      particle.style.setProperty("--particle-y", `${Math.round(20 + Math.random() * 60)}vh`);
      particle.style.setProperty("--particle-delay", `${Math.random() * 180}ms`);
      particle.style.setProperty("--particle-color", colors[index % colors.length]);
      layer.append(particle);
    }
    document.body.append(layer);
    window.setTimeout(() => layer.remove(), 1500);
  }

  async function refreshRewardSummary({ celebrate = false, previous = rewardSummary } = {}) {
    if (!supabase || !session) {
      rewardSummary = null;
      earnedAchievements = [];
      return null;
    }
    const [summaryResult, achievementsResult] = await Promise.all([
      supabase.from("user_xp").select("total_xp,level,current_streak,best_streak").eq("user_id", session.user.id).maybeSingle(),
      supabase.from("user_achievements").select("earned_at,achievements(code,name,description,xp_reward)")
        .eq("user_id", session.user.id).order("earned_at", { ascending: false }),
    ]);
    if (summaryResult.error || achievementsResult.error) {
      const error = summaryResult.error || achievementsResult.error;
      console.error("Could not load Study Zone rewards. Apply the secure study rewards migration if it has not been applied.", error);
      rewardSummary = null;
      earnedAchievements = [];
      updateStreakSidebar();
      if (session) showToast("Rewards load after applying the latest Supabase migration.");
      return null;
    }
    const oldSummary = previous;
    const oldCodes = new Set(earnedAchievements.map((item) => item.achievements?.code).filter(Boolean));
    rewardSummary = summaryResult.data || { total_xp: 0, level: 1, current_streak: 0, best_streak: 0 };
    earnedAchievements = achievementsResult.data || [];
    updateStreakSidebar(Boolean(oldSummary && Number(rewardSummary.current_streak) > Number(oldSummary.current_streak)));

    if (celebrate && oldSummary) {
      const xpGained = Math.max(0, Number(rewardSummary.total_xp) - Number(oldSummary.total_xp));
      showRewardToast(xpGained);
      if (Number(rewardSummary.level) > Number(oldSummary.level)) {
        openCelebration("Level up!", "You've reached a new study milestone.", xpGained);
      } else {
        const newAchievement = earnedAchievements.find((item) => !oldCodes.has(item.achievements?.code));
        if (newAchievement?.achievements) {
          openCelebration(newAchievement.achievements.name || "Achievement unlocked!", newAchievement.achievements.description || "Your progress is adding up.", Number(newAchievement.achievements.xp_reward) || 0);
        } else if (xpGained > 0) {
          const newStreak = Number(rewardSummary.current_streak);
          const oldStreak = Number(oldSummary.current_streak);
          if ([7, 14, 30, 100].some((milestone) => oldStreak < milestone && newStreak >= milestone)) {
            openCelebration("Study Streak", "You're building a great study streak!");
          }
        }
      }
    }
    if (["dashboard", "profile", "achievements"].includes(currentPage)) render();
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
    const dayLabel = appLanguage === "ar"
      ? count === 1 ? "يوم" : count === 2 ? "يومان" : "أيام"
      : count === 1 ? "day" : "days";
    element.textContent = `${new Intl.NumberFormat(appLanguage === "ar" ? "ar-EG" : "en").format(count)} ${dayLabel}`;
    if (animate && shouldAnimate()) {
      element.animate(
        [{ transform: "scale(.86)", color: "var(--secondary)" }, { transform: "scale(1.12)", color: "var(--accent)" }, { transform: "scale(1)", color: "var(--polar)" }],
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
    const max = Math.max(6, Math.ceil(Math.max(0, ...chartActivity.map((item) => item.hours)) / 2) * 2);
    const plotWidth = width - left - right;
    const plotHeight = height - top - bottom;
    const localizedActivity = appLanguage === "ar"
      ? ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => chartActivity.find((item) => item.day === day))
      : chartActivity;
    const points = localizedActivity.filter(Boolean).map((item, index) => ({
      x: appLanguage === "ar"
        ? width - right - (plotWidth * index) / (localizedActivity.length - 1)
        : left + (plotWidth * index) / (localizedActivity.length - 1),
      y: top + plotHeight * (1 - item.hours / max),
      ...item,
    }));
    const line = points.map((point, index) => `${index ? "L" : "M"}${point.x},${point.y}`).join(" ");
    const areaPath = `${line} L${points.at(-1).x},${top + plotHeight} L${points[0].x},${top + plotHeight} Z`;
    const yLines = [0, 2, 4, 6].map((value) => {
      const y = top + plotHeight * (1 - value / max);
      const localizedValue = new Intl.NumberFormat(appLanguage === "ar" ? "ar-EG" : "en").format(value);
      return `<line class="chart-gridline" x1="${left}" x2="${width - right}" y1="${y}" y2="${y}"/><text class="chart-label" x="${appLanguage === "ar" ? width - 18 : 0}" text-anchor="${appLanguage === "ar" ? "end" : "start"}" y="${y + 3}">${localizedValue}${appLanguage === "ar" ? "س" : "h"}</text>`;
    }).join("");
    const dots = points.map((point) => {
      const day = appLanguage === "ar" ? interfaceText[point.day] : point.day;
      const hours = new Intl.NumberFormat(appLanguage === "ar" ? "ar-EG" : "en", { maximumFractionDigits: 1 }).format(point.hours);
      return `<circle class="chart-dot" cx="${point.x}" cy="${point.y}" r="3.5"><title>${day}: ${hours} ${appLanguage === "ar" ? "ساعة" : "hours"}</title></circle>`;
    }).join("");
    const labels = points.map((point) => `<text class="chart-label" text-anchor="middle" x="${point.x}" y="${height - 4}">${appLanguage === "ar" ? interfaceText[point.day] : point.day}</text>`).join("");
    const ariaLabel = appLanguage === "ar" ? "ساعات الدراسة خلال الأيام السبعة الماضية" : session ? "Verified focus time over the last seven days" : "Sample study hours over the last seven days";
    return `<div class="chart-area"><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${ariaLabel}"><defs><linearGradient id="chart-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#06D6A0" stop-opacity=".21"/><stop offset="100%" stop-color="#06D6A0" stop-opacity="0"/></linearGradient></defs>${yLines}<path class="chart-area-fill" d="${areaPath}"/><path class="chart-line" pathLength="1" d="${line}"/>${dots}${labels}</svg></div>`;
  }

  function dashboardPage() {
    const openTasks = tasks.filter((task) => task.status !== "completed").length;
    const completeTasks = tasks.length - openTasks;
    const weekHours = activity.reduce((sum, item) => sum + item.hours, 0).toFixed(1);
    const firstName = (accountProfile?.display_name || session?.user?.user_metadata?.full_name || "Alex").trim().split(/\s+/)[0];
    const dayLabelText = new Intl.DateTimeFormat(appLanguage === "ar" ? "ar-EG" : "en", { weekday: "long", month: "long", day: "numeric" }).format(new Date());
    const dayLabel = appLanguage === "ar" ? dayLabelText : dayLabelText.toUpperCase();
    const formattedNumber = (value) => new Intl.NumberFormat(appLanguage === "ar" ? "ar-EG" : "en").format(value);
    const statGrid = `<div class="grid stats-grid">${statCard("STUDY THIS WEEK", session ? `${weekHours}<small>h</small>` : "—", session ? " across the last 7 days" : " Based on verified focus sessions", "◷")}${statCard("TASKS COMPLETED", session ? `${formattedNumber(completeTasks)}/${formattedNumber(tasks.length)}` : "—", " tasks finished", "✓", session ? `${formattedNumber(openTasks)} left · ` : "")}${statCard("CURRENT LEVEL", rewardSummary ? rewardCounterMarkup("level", rewardSummary.level) : "—", rewardSummary ? ` · ${rewardCounterMarkup("xp", rewardSummary.total_xp)} XP` : " Connect your account for real rewards", "✧")}${statCard("STUDY STREAK", rewardSummary ? `${rewardCounterMarkup("streak", rewardSummary.current_streak)} days` : "—", rewardSummary ? ` · best ${formattedNumber(Number(rewardSummary.best_streak))} days` : " Based on verified activity", "↗")}</div>`;
    const subjectRows = subjects.map((subject) => `<div class="subject-row"><span class="subject-row-name">${escapeHtml(subject.name)}</span><div class="progress-track"><div class="progress-fill" style="width:${subject.progress ?? 0}%"></div></div><span class="subject-row-value">${subject.progress === null ? "—" : `${subject.progress}%`}</span></div>`).join("") || `<div class="empty-state">Add a subject to start tracking course progress.</div>`;
    const now = Date.now();
    const upcomingSchedule = schedule.filter((block) => !block.starts_at
      || new Date(block.ends_at) > now
      || block.recurrence !== "none").slice(0, 3);
    const scheduleRows = upcomingSchedule.map((block) => `<div class="schedule-item"><time class="schedule-time">${escapeHtml((block.day || new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(new Date(block.starts_at))).slice(0, 3))}<br>${escapeHtml(block.time || new Intl.DateTimeFormat(appLanguage, { hour: "2-digit", minute: "2-digit" }).format(new Date(block.starts_at)))}</time><span class="schedule-bar"></span><div><div class="schedule-name">${escapeHtml(block.title)}</div><div class="schedule-subject">${escapeHtml(block.subject || subjectName(block.subject_id))}</div></div><span class="schedule-duration">${escapeHtml(block.length || `${Math.round((new Date(block.ends_at) - new Date(block.starts_at)) / 60000)} min`)}</span></div>`).join("") || `<div class="empty-state">No study blocks planned yet.</div>`;
    const badges = earnedAchievements.slice(0, 3).map((item) => {
      const achievement = Array.isArray(item.achievements) ? item.achievements[0] : item.achievements;
      const catalog = achievementCatalog.find((entry) => entry.code === achievement?.code);
      if (!achievement) return "";
      return `<div class="achievement-row"><span class="achievement-icon">${catalog?.symbol || "✦"}</span><div><strong>${translateUiText(achievement.name || catalog?.name || "Achievement unlocked!")}</strong><small>${translateUiText(achievement.description || catalog?.description || "")}</small></div></div>`;
    }).join("") || `<div class="empty-state">${session ? "No achievements unlocked yet." : "Sign in to earn secure rewards."}</div>`;
    const goalRows = goals.map((goal) => `<div><div class="goal-topline"><strong>${escapeHtml(goal.title)}</strong><span>${escapeHtml(goal.due || "")}</span></div><div class="progress-track"><div class="progress-fill" style="width:${Math.min(100, Math.max(0, goal.progress || 0))}%"></div></div><div class="goal-bottomline"><span>${escapeHtml(goal.detail || goal.details || "")}</span><span>${Math.round(goal.progress || 0)}%</span></div></div>`).join("");
    return `${pageHeading(dayLabel, `Good evening, ${escapeHtml(firstName)}.`, "A clear plan makes room for your best work.", `<button class="button button-primary" data-action="new-task"><span class="button-icon">＋</span> Add a task</button>`)}
      ${statGrid}
      <div class="grid dashboard-grid">
        <section class="panel">${panelHeading("Study rhythm", session ? "Verified focus time from the past week" : "Sample hours from the past week", `<button class="panel-link" data-navigate="analytics">View analytics →</button>`)}${lineChart()}</section>
        <section class="panel">${panelHeading("Subject progress", "Current mastery estimates")}<div class="subject-rows">${subjectRows}</div></section>
      </div>
      <div class="grid dashboard-grid bottom-grid">
        <section class="panel">${panelHeading("Up next", "Your planned study blocks", `<button class="panel-link" data-navigate="planner">Open planner →</button>`)}<div class="schedule-list">${scheduleRows}</div></section>
        <section class="panel">${panelHeading("Recent achievements", "Keep building your rhythm")}<div class="achievement-list">${badges}</div></section>
      </div>
      <div class="grid dashboard-grid bottom-grid">
        <section class="panel">${panelHeading("Goal progress", "Small steps add up")}<div class="goal-list">${goalRows}</div></section>
        <section class="panel">${panelHeading("Quick start")}<div class="activity-list"><div class="activity-item"><span class="activity-event"><i class="activity-bullet"></i>Pick up where you left off</span><button class="panel-link" data-navigate="focus">Focus →</button></div><div class="activity-item"><span class="activity-event"><i class="activity-bullet"></i>Review your upcoming tasks</span><button class="panel-link" data-navigate="tasks">Tasks →</button></div><div class="activity-item"><span class="activity-event"><i class="activity-bullet"></i>Explore your study materials</span><button class="panel-link" data-navigate="files">Files →</button></div></div></section>
      </div><p class="data-caption">${session ? "Study time, tasks, subjects, schedules, goals, and rewards reflect your account data." : "Sample content is shown in preview mode. Sign in to load your private study data."}</p>`;
  }

  function taskPage() {
    const action = `<div class="task-toolbar"><label class="search-box"><span>⌕</span><input id="task-search" type="search" dir="auto" value="${escapeHtml(searchTerm)}" placeholder="Search tasks" aria-label="Search tasks"></label><select class="filter-select" id="task-filter" aria-label="Filter task status"><option value="all" ${statusFilter === "all" ? "selected" : ""}>All tasks</option><option value="not_started" ${statusFilter === "not_started" ? "selected" : ""}>Not started</option><option value="in_progress" ${statusFilter === "in_progress" ? "selected" : ""}>In progress</option><option value="completed" ${statusFilter === "completed" ? "selected" : ""}>Completed</option></select><button class="button button-primary button-small" data-action="new-task">＋ New task</button></div>`;
    const filtered = tasks.filter((task) => {
      const textMatches = `${task.title} ${task.subject || subjectName(task.subject_id)}`.toLowerCase().includes(searchTerm.toLowerCase());
      const statusMatches = statusFilter === "all" || task.status === statusFilter;
      return textMatches && statusMatches;
    });
    const list = filtered.length ? filtered.map((task) => `<div class="task-row ${task.status === "completed" ? "completed" : ""}" data-task-id="${escapeHtml(task.id)}">
      <button class="task-check ${task.status === "completed" ? "checked" : ""}" data-action="toggle-task" data-id="${escapeHtml(task.id)}" aria-label="${task.status === "completed" ? "Reopen" : "Complete"} ${escapeHtml(task.title)}">${task.status === "completed" ? "✓" : ""}</button>
      <strong class="task-title" dir="auto">${escapeHtml(task.title)}</strong><span class="task-meta" dir="auto">${escapeHtml(task.subject || subjectName(task.subject_id))}</span><span class="task-due">${escapeHtml(formatDue(task.due_at))}</span><span class="priority ${escapeHtml(task.priority)}">${escapeHtml(task.priority)}</span>
      <button class="task-delete" data-action="delete-task" data-id="${escapeHtml(task.id)}" aria-label="Delete ${escapeHtml(task.title)}">×</button></div>`).join("") : `<div class="empty-state"><strong>No tasks found</strong>Try another search or add your next task.</div>`;
    return `${pageHeading("TASKBOARD", "Tasks & deadlines", "Keep assignments, priorities, and due dates in one calm place.", action)}<section class="panel">${panelHeading("Your tasks", `${tasks.filter((task) => task.status !== "completed").length} tasks remaining`)}<div class="task-list">${list}</div></section><p class="data-caption">Tasks are stored in this browser in preview mode. Signed-in accounts use Supabase.</p>`;
  }

  function dateKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function getDeadlineStatus(deadline, now = Date.now()) {
    if (deadline.status === "completed") return "completed";
    return deadline.due_at && new Date(deadline.due_at).getTime() < now ? "overdue" : "upcoming";
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
      const count = Math.max(1, Math.ceil((now.getTime() - due.getTime()) / 86400000));
      return `${t.overdueBy} ${count} ${count === 1 ? t.day : t.days}`;
    }
    if (due.toDateString() === now.toDateString()) return t.today;
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (due.toDateString() === tomorrow.toDateString()) return t.tomorrow;
    const milliseconds = due.getTime() - now.getTime();
    const days = Math.floor(milliseconds / 86400000);
    if (days > 0) return `${days} ${days === 1 ? t.day : t.days} ${t.remaining}`;
    const hours = Math.floor(milliseconds / 3600000);
    if (hours > 0) return `${hours} ${hours === 1 ? t.hour : t.hours} ${t.remaining}`;
    const minutes = Math.max(1, Math.floor(milliseconds / 60000));
    return `${minutes} ${minutes === 1 ? t.minute : t.minutes} ${t.remaining}`;
  }

  function formatPriority(priority) {
    return deadlineText[appLanguage][priority] || priority;
  }

  function deadlineStats(deadlines) {
    const counts = {
      all: deadlines.length,
      upcoming: deadlines.filter((deadline) => getDeadlineStatus(deadline) === "upcoming").length,
      overdue: deadlines.filter((deadline) => getDeadlineStatus(deadline) === "overdue").length,
      completed: deadlines.filter((deadline) => getDeadlineStatus(deadline) === "completed").length,
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
    const dueClass = status === "overdue" ? "is-overdue" : status === "upcoming" && new Date(deadline.due_at).toDateString() === new Date().toDateString() ? "is-today" : "";
    const description = deadline.description?.trim() ? `<p class="deadline-description" dir="auto">${escapeHtml(deadline.description)}</p>` : "";
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
    const normalized = deadlineSearch.toLocaleLowerCase(appLanguage === "ar" ? "ar" : "en");
    const result = getDeadlines().filter((deadline) => {
      const status = getDeadlineStatus(deadline, now);
      const subject = deadline.subject || subjectName(deadline.subject_id);
      const searchMatches = `${deadline.title} ${deadline.description || ""} ${subject}`.toLocaleLowerCase(appLanguage === "ar" ? "ar" : "en").includes(normalized);
      const filterMatches = deadlineFilter === "all" || deadlineFilter === status;
      return searchMatches && filterMatches;
    });
    const priority = { urgent: 0, high: 1, medium: 2, low: 3 };
    result.sort((a, b) => {
      if (deadlineSort === "priority") return (priority[a.priority] ?? 2) - (priority[b.priority] ?? 2) || new Date(a.due_at) - new Date(b.due_at);
      if (deadlineSort === "recent") return new Date(b.created_at || 0) - new Date(a.created_at || 0);
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
    const year = deadlineMonth.getFullYear();
    const month = deadlineMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const startOffset = firstDay.getDay();
    const today = dateKey(new Date());
    const weekdayLabels = t.daysShort.map((day) => `<span class="calendar-weekday">${day}</span>`).join("");
    const startOfGrid = new Date(year, month, 1 - startOffset);
    const weeks = Array.from({ length: 6 }, (_, weekIndex) => {
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
        return { date, key, button: `<button class="${classes.join(" ")}" data-action="calendar-select" data-date="${key}" aria-label="${escapeHtml(new Intl.DateTimeFormat(appLanguage === "ar" ? "ar-EG" : "en", { dateStyle: "full" }).format(date))}" aria-pressed="${key === selectedDeadlineDate}">${new Intl.NumberFormat(appLanguage === "ar" ? "ar-EG" : "en").format(date.getDate())}</button>` };
      });

      const weekStartKey = dayDates[0].key;
      const weekEndKey = dayDates[6].key;
      const laneEnds = [];
      const bars = deadlines.map((deadline) => {
        const range = deadlineDateRange(deadline);
        if (range.start > weekEndKey || range.end < weekStartKey) return null;
        const startColumn = Math.max(0, Math.round((new Date(`${range.start}T00:00:00`) - weekStart) / 86400000));
        const endColumn = Math.min(6, Math.round((new Date(`${range.end}T00:00:00`) - weekStart) / 86400000));
        let lane = laneEnds.findIndex((lastColumn) => lastColumn < startColumn);
        if (lane < 0) lane = laneEnds.length;
        laneEnds[lane] = endColumn;
        const status = getDeadlineStatus(deadline);
        const classNames = ["calendar-span-bar"];
        if (status === "overdue") classNames.push("overdue");
        if (status === "completed") classNames.push("completed");
        if (startColumn === endColumn) classNames.push("single-day");
        const label = range.start >= weekStartKey ? deadline.title : "";
        return `<span class="${classNames.join(" ")}" style="grid-column:${startColumn + 1}/${endColumn + 2};grid-row:${lane + 1}" title="${escapeHtml(deadline.title)}" aria-label="${escapeHtml(deadline.title)}">${escapeHtml(label)}</span>`;
      }).filter(Boolean).join("");
      return `<div class="calendar-week"><div class="calendar-week-days">${dayDates.map((item) => item.button).join("")}</div><div class="calendar-week-bars" style="grid-template-rows:repeat(${Math.max(1, laneEnds.length)},18px)">${bars}</div></div>`;
    }).join("");
    const monthLabel = new Intl.DateTimeFormat(appLanguage === "ar" ? "ar-EG" : "en", { month: "long", year: "numeric" }).format(deadlineMonth);
    const selected = deadlines.filter((deadline) => {
      const range = deadlineDateRange(deadline);
      return selectedDeadlineDate >= range.start && selectedDeadlineDate <= range.end;
    });
    const selectedLabel = selectedDeadlineDate
      ? new Intl.DateTimeFormat(appLanguage === "ar" ? "ar-EG" : "en", { dateStyle: "full" }).format(new Date(`${selectedDeadlineDate}T12:00:00`))
      : t.noDate;
    return `<div class="calendar-header"><h2 class="calendar-month" id="calendar-month">${escapeHtml(monthLabel)}</h2><div class="calendar-nav"><button class="button button-secondary button-small" data-action="calendar-today">${t.currentMonth}</button><button class="icon-button" data-action="calendar-prev" aria-label="${t.previous}">‹</button><button class="icon-button" data-action="calendar-next" aria-label="${t.next}">›</button></div></div>
      <div class="calendar-grid" role="grid" aria-labelledby="calendar-month"><div class="calendar-weekdays">${weekdayLabels}</div>${weeks}</div>
      <div class="calendar-selection">${panelHeading(escapeHtml(selectedLabel), `${selected.length} ${selected.length === 1 ? t.deadline : t.deadlines}`)}<div class="deadline-list">${selected.map(deadlineCard).join("") || `<div class="empty-state">${t.noDateItems}</div>`}</div></div>`;
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
      ["all", t.all], ["upcoming", t.filterUpcoming], ["overdue", t.filterOverdue], ["completed", t.filterCompleted],
    ].map(([value, label]) => `<button class="deadline-filter ${deadlineFilter === value ? "selected" : ""}" data-deadline-filter="${value}" aria-pressed="${deadlineFilter === value}">${label}</button>`).join("");
    const listControls = `<div class="deadline-toolbar"><div class="deadline-filters" role="group" aria-label="${t.title} filters">${filterOptions}</div><div class="deadline-controls"><label class="search-box"><span>⌕</span><input id="deadline-search" type="search" dir="auto" value="${escapeHtml(deadlineSearch)}" placeholder="${t.search}" aria-label="${t.search}"></label><select class="filter-select" id="deadline-sort" aria-label="${t.priorityLabel}"><option value="due" ${deadlineSort === "due" ? "selected" : ""}>${t.dueDate}</option><option value="priority" ${deadlineSort === "priority" ? "selected" : ""}>${t.priority}</option><option value="recent" ${deadlineSort === "recent" ? "selected" : ""}>${t.recentlyAdded}</option></select></div></div>`;
    const viewControls = `<div class="deadline-view-switch" role="group"><button class="deadline-view-button ${deadlineView === "list" ? "selected" : ""}" data-deadline-view="list" aria-pressed="${deadlineView === "list"}">☷ ${t.list}</button><button class="deadline-view-button ${deadlineView === "calendar" ? "selected" : ""}" data-deadline-view="calendar" aria-pressed="${deadlineView === "calendar"}">▦ ${t.calendar}</button></div>`;
    const display = deadlineView === "list"
      ? `<div class="deadline-list-heading"><strong>${t.title}</strong><span>${t.showing} ${activeCount} ${activeCount === 1 ? t.deadline : t.deadlines}</span></div><div class="deadline-list">${list}</div>`
      : calendarView(filtered);
    return `${pageHeading(t.eyebrow, t.title, t.subtitle, `<button class="button button-primary" data-action="deadline-add"><span class="button-icon">＋</span> ${t.add}</button>`)}
      ${deadlineStats(deadlines)}
      <section class="panel"><div class="deadline-toolbar-row">${listControls}${viewControls}</div>${deadlinesLoading ? `<div class="deadline-loading"><div class="skeleton-line"></div><div class="skeleton-line"></div><div class="skeleton-line"></div></div>` : display}</section>
      <p class="data-caption">${session ? t.reminderNote : t.sampleNote}</p>`;
  }

  function plannerPage() {
    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
    const todayName = new Intl.DateTimeFormat(appLanguage === "ar" ? "ar-EG" : "en-US", { weekday: "long" }).format(new Date());
    const dayLabels = appLanguage === "ar"
      ? ["الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"]
      : days;
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const dayCards = days.map((day) => {
      const blocks = schedule.filter((item) => {
        if (!item.starts_at) return item.day === day;
        const startsAt = new Date(item.starts_at);
        const weekdayMatches = new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(startsAt) === day;
        if (item.recurrence === "daily") return true;
        if (item.recurrence === "weekly") return weekdayMatches;
        return startsAt >= weekStart && startsAt < weekEnd && weekdayMatches;
      });
      const label = dayLabels[days.indexOf(day)];
      return `<article class="planner-day ${day === todayName ? "today" : ""}"><div class="planner-day-head">${label}<small>${blocks.length ? `${blocks.length} block` : "Open day"}</small></div>${blocks.length ? blocks.map((block) => `<div class="planner-block"><time>${escapeHtml(block.time || new Intl.DateTimeFormat(appLanguage, { hour: "2-digit", minute: "2-digit" }).format(new Date(block.starts_at)))} · ${escapeHtml(block.length || `${Math.round((new Date(block.ends_at) - new Date(block.starts_at)) / 60000)} min`)}</time><strong>${escapeHtml(block.title)}</strong><span>${escapeHtml(block.subject || subjectName(block.subject_id))}</span>${block.id ? `<div class="card-actions"><button class="text-button" data-action="schedule-edit" data-id="${escapeHtml(block.id)}">${featureText("edit")}</button><button class="text-button" data-action="schedule-delete" data-id="${escapeHtml(block.id)}">${featureText("delete")}</button></div>` : ""}</div>`).join("") : `<p class="empty-day">No study blocks planned.</p>`}</article>`;
    }).join("");
    const plannedMinutes = schedule.reduce((sum, block) => sum + (block.starts_at && block.ends_at
      ? Math.max(0, (new Date(block.ends_at) - new Date(block.starts_at)) / 60000)
      : Number.parseInt(block.length, 10) || 0), 0);
    return `${pageHeading("WEEK AT A GLANCE", "Study planner", "Make a realistic plan, then give yourself room to adapt.", `<button class="button button-primary" data-action="schedule-add">＋ Plan a block</button>`)}<section class="panel">${panelHeading("This week", session ? "Your planned study sessions" : "Planned sessions · preview")}<div class="grid planner-grid">${dayCards}</div></section><div class="grid dashboard-grid section-spacer"><section class="panel">${panelHeading("Planned study time", "Based on the blocks shown above")}<div class="metric-large">${(plannedMinutes / 60).toFixed(1)}h <span class="metric-caption">planned</span></div></section><section class="panel">${panelHeading("Planning tip")}<p class="panel-copy">Leave a little breathing room between study blocks. A flexible plan is easier to keep than a perfect one.</p></section></div><p class="data-caption">${session ? "Study blocks are saved to your private account." : "Sample blocks are shown in preview mode. Sign in to create and sync your own schedule."}</p>`;
  }

  function subjectsPage() {
    return `${pageHeading("YOUR COURSES", "Subjects", "A quick view of your courses, credits, and learning progress.", `<button class="button button-primary" data-action="subject-add">＋ Add subject</button>`)}<div class="grid subject-grid">${subjects.map((subject) => `<article class="subject-card"><div class="subject-card-top"><span class="subject-color" style="background:${escapeHtml(subject.color)}"></span><span class="task-meta">${Number(subject.credit_hours ?? subject.credits ?? 0)} credits</span></div><h3>${escapeHtml(subject.name)}</h3><p>${escapeHtml(subject.description || "Keep your notes, tasks, and study sessions connected to this course.")}</p><div class="progress-track"><div class="progress-fill" style="width:${subject.progress ?? 0}%"></div></div><div class="subject-card-foot"><span>Learning progress</span><span>${subject.progress == null ? "—" : `${subject.progress}%`}</span></div>${subject.id && session ? `<div class="card-actions"><button class="text-button" data-action="subject-edit" data-id="${escapeHtml(subject.id)}">${featureText("edit")}</button><button class="text-button" data-action="subject-delete" data-id="${escapeHtml(subject.id)}">${featureText("delete")}</button></div>` : ""}</article>`).join("") || `<div class="empty-state"><strong>No subjects yet</strong>Add your first course to start organizing your study workspace.</div>`}</div><p class="data-caption">${session ? "Subject details are loaded from your private account." : "Preview content. Sign in to create and sync your own subjects."}</p>`;
  }

  function plannerBlocksPage() { return schedule; }

  function filesPage() {
    return `${pageHeading("STUDY MATERIALS", "Your files", "A tidy home for resources from every course.", `<button class="button button-primary" data-action="file-add">↑ Upload file</button>`)}<div class="grid resource-grid">${sampleFiles.map((file) => `<article class="item-card"><span class="stat-icon">▤</span><h3 dir="auto">${escapeHtml(file.name)}</h3><p dir="auto">${escapeHtml(file.subject || subjectName(file.subject_id))} · ${escapeHtml(file.type || file.mime_type || "File")}</p>${session && file.id ? `<div class="card-actions"><button class="text-button" data-action="file-download" data-id="${escapeHtml(file.id)}">${featureText("download")}</button><button class="text-button" data-action="file-delete" data-id="${escapeHtml(file.id)}">${featureText("delete")}</button></div>` : ""}</article>`).join("")}${session && !sampleFiles.length ? `<div class="empty-state"><strong>No files uploaded yet</strong>Upload a file to keep your study materials in your private workspace.</div>` : ""}</div><p class="data-caption">${session ? "Files are stored in a private account-owned bucket; downloads use short-lived signed links." : "Sample file cards are shown in preview. Sign in to upload files to private storage."}</p>`;
  }

  function notesPage() {
    return `${pageHeading("YOUR KNOWLEDGE VAULT", "Notes", "Capture what matters and find it when you need it.", `<button class="button button-primary" data-action="note-add">＋ New note</button>`)}<div class="grid resource-grid">${sampleNotes.map((note) => `<article class="item-card"><span class="task-meta">${escapeHtml(note.subject || subjectName(note.subject_id))}</span><h3>${escapeHtml(note.title)}</h3><p>Updated ${escapeHtml(note.updated || new Intl.DateTimeFormat(appLanguage, { dateStyle: "medium" }).format(new Date(note.updated_at || Date.now())))}</p><div class="note-preview">${escapeHtml(note.content || "A place for your key ideas, examples, and questions to revisit later.")}</div>${session && note.id ? `<div class="card-actions"><button class="text-button" data-action="note-edit" data-id="${escapeHtml(note.id)}">Edit</button><button class="text-button" data-action="note-delete" data-id="${escapeHtml(note.id)}">Delete</button></div>` : ""}</article>`).join("")}${session && !sampleNotes.length ? `<div class="empty-state"><strong>No notes yet</strong>Create a private note to capture your study ideas.</div>` : ""}</div><p class="data-caption">${session ? "Your notes are private and synchronized to your account." : "Sample content is shown in preview. Sign in to create and sync notes."}</p>`;
  }

  const featureFormText = {
    en: {
      save: "Save", cancel: "Cancel", loading: "Saving…", error: "Could not save your changes.",
      signIn: "Sign in to manage your private study data.", subject: "Subject", noSubject: "No subject",
      editSubject: "Edit subject", addSubject: "Add subject", editSchedule: "Edit study block", addSchedule: "Plan a study block",
      uploadFile: "Upload a study file", editNote: "Edit note", addNote: "Create a note", editGoal: "Edit goal",
      addGoal: "Create a goal", goalProgress: "Add goal progress", editExam: "Edit exam", addExam: "Add exam",
      examResult: "Record exam result", editProfile: "Edit profile", edit: "Edit", delete: "Delete",
      download: "Download", recordResult: "Record result", editResult: "Edit result", addProgress: "Add progress",
      title: "Title", description: "Description", color: "Color", credits: "Credit hours", details: "Details",
      startsAt: "Starts", endsAt: "Ends", recurrence: "Repeat", none: "Does not repeat", daily: "Daily", weekly: "Weekly",
      file: "Choose file", content: "Note", period: "Goal period", target: "Target", current: "Current progress",
      unit: "Unit", dueAt: "Due date", examAt: "Exam date", maximumMarks: "Maximum marks", result: "Result",
      notes: "Notes", displayName: "Display name", timezone: "Timezone (IANA)", language: "Language",
      avatar: "Avatar URL (optional)", progress: "Progress to add", fileLimit: "Choose a supported file no larger than 20 MB.",
      resultRange: "Result must be between zero and maximum marks.",
    },
    ar: {
      save: "حفظ", cancel: "إلغاء", loading: "جارٍ الحفظ…", error: "تعذر حفظ التغييرات.",
      signIn: "سجّل الدخول لإدارة بياناتك الدراسية الخاصة.", subject: "المادة", noSubject: "بلا مادة",
      editSubject: "تعديل المادة", addSubject: "إضافة مادة", editSchedule: "تعديل الجلسة", addSchedule: "تخطيط جلسة دراسية",
      uploadFile: "رفع ملف دراسي", editNote: "تعديل الملاحظة", addNote: "إنشاء ملاحظة", editGoal: "تعديل الهدف",
      addGoal: "إنشاء هدف", goalProgress: "إضافة تقدم للهدف", editExam: "تعديل الاختبار", addExam: "إضافة اختبار",
      examResult: "تسجيل نتيجة الاختبار", editProfile: "تعديل الملف الشخصي", edit: "تعديل", delete: "حذف",
      download: "تنزيل", recordResult: "تسجيل النتيجة", editResult: "تعديل النتيجة", addProgress: "إضافة تقدم",
      title: "العنوان", description: "الوصف", color: "اللون", credits: "الساعات المعتمدة", details: "التفاصيل",
      startsAt: "يبدأ", endsAt: "ينتهي", recurrence: "التكرار", none: "بدون تكرار", daily: "يوميًا", weekly: "أسبوعيًا",
      file: "اختر ملفًا", content: "الملاحظة", period: "فترة الهدف", target: "المستهدف", current: "التقدم الحالي",
      unit: "الوحدة", dueAt: "تاريخ الاستحقاق", examAt: "موعد الاختبار", maximumMarks: "الدرجة النهائية", result: "النتيجة",
      notes: "ملاحظات", displayName: "اسم العرض", timezone: "المنطقة الزمنية (IANA)", language: "اللغة",
      avatar: "رابط الصورة (اختياري)", progress: "مقدار التقدم المضاف", fileLimit: "اختر ملفًا مدعومًا لا يتجاوز حجمه 20 ميغابايت.",
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
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }

  function featureSubjectOptions(selectedId = "") {
    return `<option value="">${featureText("noSubject")}</option>${subjects.map((item) => `<option value="${escapeHtml(item.id)}" ${String(item.id) === String(selectedId) ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("")}`;
  }

  function featureField(name, label, type = "text", value = "", attributes = "") {
    const valueAttr = type === "file" ? "" : ` value="${escapeHtml(value ?? "")}"`;
    const field = type === "textarea"
      ? `<textarea name="${name}" dir="auto" ${attributes}>${escapeHtml(value ?? "")}</textarea>`
      : `<input name="${name}" type="${type}"${valueAttr} ${attributes}>`;
    return `<label>${featureText(label)}${field}</label>`;
  }

  function openFeatureForm(type, id = null) {
    if (!supabase || !session) {
      showToast(featureText("signIn"));
      document.getElementById("auth-modal").hidden = false;
      return;
    }

    const collections = {
      subject: subjects, schedule, file: sampleFiles, note: sampleNotes, goal: goals,
      exam: examResults, profile: accountProfile ? [accountProfile] : [],
      "exam-result": examResults, "goal-progress": goals,
    };
    const record = id ? collections[type]?.find((item) => String(item.id) === String(id)) : null;
    if (id && !record && type !== "profile") {
      showToast("The selected record could not be found. Refresh the page and try again.");
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
      fields = `${featureField("name", "title", "text", record?.name, "required maxlength=\"100\"")}${featureField("description", "description", "textarea", record?.description, "rows=\"3\" maxlength=\"2000\"")}<div class="form-row">${featureField("color", "color", "color", record?.color || "#06D6A0", "required")}${featureField("credit_hours", "credits", "number", record?.credit_hours ?? record?.credits ?? 0, "min=\"0\" max=\"30\" required")}</div>`;
    } else if (type === "schedule") {
      fields = `${featureField("title", "title", "text", record?.title, "required maxlength=\"120\"")}${featureField("details", "details", "textarea", record?.details, "rows=\"2\" maxlength=\"2000\"")}<label>${featureText("subject")}<select name="subject_id">${featureSubjectOptions(record?.subject_id)}</select></label><div class="form-row">${featureField("starts_at", "startsAt", "datetime-local", localDateTimeValue(record?.starts_at), "required")}${featureField("ends_at", "endsAt", "datetime-local", localDateTimeValue(record?.ends_at), "required")}</div><label>${featureText("recurrence")}<select name="recurrence"><option value="none">Does not repeat</option><option value="daily" ${record?.recurrence === "daily" ? "selected" : ""}>Daily</option><option value="weekly" ${record?.recurrence === "weekly" ? "selected" : ""}>Weekly</option></select></label>`;
    } else if (type === "file") {
      fields = `${featureField("file", "file", "file", "", "required accept=\".pdf,.jpg,.jpeg,.png,.webp,.txt,.md,.doc,.docx,.ppt,.pptx\"")}<label>${featureText("subject")}<select name="subject_id">${featureSubjectOptions()}</select></label>`;
    } else if (type === "note") {
      fields = `${featureField("title", "title", "text", record?.title || "Untitled note", "required maxlength=\"180\"")}${featureField("content", "content", "textarea", record?.content, "rows=\"8\" maxlength=\"30000\"")}<label>${featureText("subject")}<select name="subject_id">${featureSubjectOptions(record?.subject_id)}</select></label>`;
    } else if (type === "goal") {
      fields = `${featureField("title", "title", "text", record?.title, "required maxlength=\"160\"")}${featureField("details", "details", "textarea", record?.details, "rows=\"2\" maxlength=\"2000\"")}<div class="form-row"><label>${featureText("period")}<select name="period"><option value="daily">Daily</option><option value="weekly" ${!record || record.period === "weekly" ? "selected" : ""}>Weekly</option><option value="monthly" ${record?.period === "monthly" ? "selected" : ""}>Monthly</option><option value="custom" ${record?.period === "custom" ? "selected" : ""}>Custom</option></select></label>${featureField("unit", "unit", "text", record?.unit || "sessions", "required maxlength=\"30\"")}</div><div class="form-row">${featureField("target_value", "target", "number", record?.target_value || 1, "min=\"0.01\" step=\"0.01\" required")}${featureField("current_value", "current", "number", record?.current_value || 0, "min=\"0\" step=\"0.01\" required")}</div>${featureField("due_at", "dueAt", "date", record?.due_at ? dateKey(new Date(record.due_at)) : "")}`;
    } else if (type === "goal-progress") {
      fields = featureField("increment", "progress", "number", "", "min=\"0.01\" step=\"0.01\" required");
    } else if (type === "exam") {
      fields = `${featureField("title", "title", "text", record?.title, "required maxlength=\"160\"")}${featureField("details", "details", "textarea", record?.details, "rows=\"2\" maxlength=\"2000\"")}<label>${featureText("subject")}<select name="subject_id">${featureSubjectOptions(record?.subject_id)}</select></label><div class="form-row">${featureField("exam_at", "examAt", "datetime-local", localDateTimeValue(record?.exam_at), "required")}${featureField("max_marks", "maximumMarks", "number", record?.max_marks ?? 100, "min=\"0.01\" step=\"0.01\" required")}</div>`;
    } else if (type === "exam-result") {
      const currentResult = Array.isArray(record.exam_results) ? record.exam_results[0] : record.exam_results;
      fields = `${featureField("obtained_marks", "result", "number", currentResult?.obtained_marks ?? record.obtained_marks, `min="0" max="${Number(record.max_marks)}" step="0.01" required`)}${featureField("notes", "notes", "textarea", currentResult?.notes, "rows=\"3\" maxlength=\"2000\"")}`;
    } else if (type === "profile") {
      const profile = record || {};
      fields = `${featureField("display_name", "displayName", "text", profile.display_name || session.user.user_metadata?.full_name || "", "required maxlength=\"100\"")}${featureField("timezone", "timezone", "text", profile.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone, "required maxlength=\"80\"")}<label>${featureText("language")}<select name="language"><option value="en" ${profile.language === "en" ? "selected" : ""}>English</option><option value="ar" ${profile.language === "ar" ? "selected" : ""}>العربية</option></select></label><label>${translateUiText("Choose a profile photo from your device")}<input type="file" name="avatar_file" accept="image/png,image/jpeg,image/webp"></label><small>${translateUiText("PNG, JPEG, or WebP · up to 2 MB")}</small>`;
    } else {
      return;
    }

    let modal = document.getElementById("feature-modal");
    if (!modal) {
      document.body.insertAdjacentHTML("beforeend", `<div class="modal-backdrop" id="feature-modal" hidden><section class="modal" role="dialog" aria-modal="true" aria-labelledby="feature-modal-title"><button class="modal-close" type="button" data-close-modal aria-label="Close">×</button><p class="eyebrow">STUDY ZONE</p><h2 id="feature-modal-title"></h2><form id="feature-form" class="form-stack"></form></section></div>`);
      modal = document.getElementById("feature-modal");
      document.getElementById("feature-form").addEventListener("submit", async (event) => {
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
          errorEl.textContent = `${featureText("error")} ${error.message || ""}`.trim();
          console.error("Study workspace save failed.", error);
        } finally {
          submit.disabled = false;
          submit.textContent = featureText("save");
        }
      });
    }
    document.getElementById("feature-modal-title").textContent = featureText(titles[type]);
    document.getElementById("feature-form").dataset.featureType = type;
    document.getElementById("feature-form").dataset.recordId = id || "";
    document.getElementById("feature-form").innerHTML = `${fields}<p class="form-error" data-form-error role="alert"></p><div class="modal-actions"><button class="button button-secondary" type="button" data-close-modal>${featureText("cancel")}</button><button class="button button-primary" type="submit">${featureText("save")}</button></div>`;
    modal.hidden = false;
    document.querySelector("#feature-form input, #feature-form textarea, #feature-form select")?.focus();
  }

  function featureDate(value) {
    const date = new Date(value);
    if (!value || Number.isNaN(date.getTime())) throw new Error("Enter a valid date and time.");
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
        color: String(values.get("color") || "#06D6A0"),
        credit_hours: Number(values.get("credit_hours")),
      };
    } else if (type === "schedule") {
      const startsAt = featureDate(values.get("starts_at"));
      const endsAt = featureDate(values.get("ends_at"));
      if (new Date(endsAt) <= new Date(startsAt)) throw new Error("The end time must be after the start time.");
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
      document.getElementById("feature-modal").hidden = true;
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
        due_at: values.get("due_at") ? new Date(`${values.get("due_at")}T23:59:59`).toISOString() : null,
      };
    } else if (type === "goal-progress") {
      const increment = Number(values.get("increment"));
      if (!Number.isFinite(increment) || increment <= 0) throw new Error("Enter a positive progress amount.");
      const { error } = await supabase.rpc("increment_goal_progress", { p_goal_id: id, p_increment: increment });
      if (error) throw error;
      document.getElementById("feature-modal").hidden = true;
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
      if (!exam || !Number.isFinite(obtainedMarks) || obtainedMarks < 0 || obtainedMarks > Number(exam.max_marks)) {
        throw new Error(featureText("resultRange"));
      }
      const { error } = await supabase.from("exam_results").upsert({
        exam_id: exam.id,
        obtained_marks: obtainedMarks,
        notes: String(values.get("notes") || "").trim(),
      }, { onConflict: "exam_id" });
      if (error) throw error;
      document.getElementById("feature-modal").hidden = true;
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
      const { data, error } = await supabase.from("profiles").update(row)
        .eq("id", session.user.id)
        .select("id,display_name,avatar_url,timezone,language")
        .maybeSingle();
      if (error) {
        if (newAvatarPath) {
          const { error: cleanupError } = await supabase.storage.from("studyflow-files").remove([newAvatarPath]);
          if (cleanupError) {
            console.error("New profile photo could not be removed after the profile update failed.", cleanupError);
            throw new Error(`${error.message} Photo cleanup also failed: ${cleanupError.message}`);
          }
        }
        throw error;
      }
      if (!data) {
        let cleanupMessage = "";
        if (newAvatarPath) {
          const { error: cleanupError } = await supabase.storage.from("studyflow-files").remove([newAvatarPath]);
          if (cleanupError) {
            console.error("New profile photo could not be removed after no profile row was updated.", cleanupError);
            cleanupMessage = ` Photo cleanup also failed: ${cleanupError.message}`;
          }
        }
        throw new Error(`No profile row was updated for this account. Re-run the profile setup section in supabase/schema.sql, then retry.${cleanupMessage}`);
      }
      accountProfile = data;
      let avatarCleanupMessage = "";
      if (newAvatarPath && oldAvatarPath?.startsWith(`${session.user.id}/`) && oldAvatarPath !== newAvatarPath) {
        const { error: cleanupError } = await supabase.storage.from("studyflow-files").remove([oldAvatarPath]);
        if (cleanupError) {
          console.error("The previous profile photo could not be removed.", cleanupError);
          avatarCleanupMessage = ` Previous photo cleanup failed: ${cleanupError.message}`;
        }
      }
      await loadAccountWorkspace();
      document.getElementById("feature-modal").hidden = true;
      render();
      updateUserUi();
      if (row.language !== appLanguage) await setLanguage(row.language);
      showToast(`${newAvatarPath ? translateUiText("Profile photo uploaded.") : "Profile updated."}${avatarCleanupMessage}`);
      return;
    } else {
      throw new Error("Unsupported study workspace action.");
    }

    const query = supabase.from(table);
    const result = id
      ? await query.update(row).eq("id", id).select().single()
      : await query.insert(row).select().single();
    if (result.error) throw result.error;
    document.getElementById("feature-modal").hidden = true;
    await loadAccountWorkspace();
    render();
    showToast(id ? "Changes saved." : "Added to your study workspace.");
  }

  async function uploadStudyFile(values) {
    const file = values.get("file");
    const allowedTypes = new Set([
      "application/pdf", "image/jpeg", "image/png", "image/webp", "text/plain", "text/markdown",
      "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ]);
    if (!(file instanceof File) || !file.size || file.size > 20 * 1024 * 1024 || !allowedTypes.has(file.type)) {
      throw new Error(featureText("fileLimit"));
    }
    const safeName = file.name.replace(/[^\w.-]+/g, "_").slice(0, 180) || "study-file";
    const storagePath = `${session.user.id}/${focusId()}-${safeName}`;
    const { error: uploadError } = await supabase.storage.from("studyflow-files").upload(storagePath, file, {
      cacheControl: "3600", contentType: file.type, upsert: false,
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
      const { error: cleanupError } = await supabase.storage.from("studyflow-files").remove([storagePath]);
      if (cleanupError) {
        console.error("Uploaded file could not be removed after its metadata insert failed.", cleanupError);
        throw new Error(`${rowError.message} File cleanup also failed: ${cleanupError.message}`);
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
    const { error } = await supabase.storage.from("studyflow-files").upload(storagePath, file, {
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
      subject: { table: "subjects", items: subjects, name: (item) => item.name },
      schedule: { table: "schedules", items: schedule, name: (item) => item.title },
      file: { table: "study_files", items: sampleFiles, name: (item) => item.name },
      note: { table: "notes", items: sampleNotes, name: (item) => item.title },
      goal: { table: "goals", items: goals, name: (item) => item.title },
      exam: { table: "exams", items: examResults, name: (item) => item.title },
    };
    const config = configByType[type];
    const record = config?.items.find((item) => String(item.id) === String(id));
    if (!record) return;
    const warning = type === "subject"
      ? `Delete subject "${config.name(record)}"? Linked records will be preserved without a subject.`
      : `Delete "${config.name(record)}"? This cannot be undone.`;
    if (!window.confirm(warning)) return;

    if (type === "file") {
      const { error: storageError } = await supabase.storage.from("studyflow-files").remove([record.storage_path]);
      if (storageError) {
        showToast(`Could not delete the file from private storage: ${storageError.message}`);
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
    const { data, error } = await supabase.storage.from("studyflow-files").createSignedUrl(file.storage_path, 60);
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
    return focusDurationFor(type) * 60000;
  }

  function getFocusElapsedMs(now = Date.now()) {
    const activeRun = focusSession.status === "running" && focusSession.runStartedAt
      ? Math.max(0, now - focusSession.runStartedAt)
      : 0;
    return Math.max(0, Number(focusSession.elapsedBeforeRunMs || 0) + activeRun);
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
    const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  function renderFlipDigit(digit, index) {
    return `<span class="flip-digit" data-flip-index="${index}" data-digit="${digit}" aria-hidden="true"><span class="flip-upper">${digit}</span><span class="flip-lower">${digit}</span></span>`;
  }

  function renderFlipClock(milliseconds, showSeconds) {
    const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
    const minutesText = String(Math.floor(seconds / 60)).padStart(2, "0");
    const secondText = String(seconds % 60).padStart(2, "0");
    return {
      minutes: [...minutesText].map(renderFlipDigit).join(""),
      seconds: showSeconds ? [...secondText].map((digit, index) => renderFlipDigit(digit, index + minutesText.length)).join("") : "",
    };
  }

  function getNextBreakType() {
    const completed = focusRecords.filter((record) => record.session_type === "focus" && record.completed).length;
    return (completed + 1) % focusSettings.longBreakInterval === 0 ? "long_break" : "short_break";
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
    const number = (value) => new Intl.NumberFormat(focusLocale()).format(value);
    if (hours) return `${number(hours)}${text.hours} ${number(remainder)}${text.mins}`;
    return `${number(minutes)} ${text.mins}`;
  }

  function formatFocusHours(seconds, text = focusText[appLanguage]) {
    const hours = seconds / 3600;
    const value = new Intl.NumberFormat(focusLocale(), { maximumFractionDigits: 1 }).format(hours);
    return `${value}${text.hours}`;
  }

  function localDateKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function getFocusStats(now = new Date()) {
    const completed = focusRecords.filter((record) => record.session_type === "focus" && record.completed);
    const todayKey = localDateKey(now);
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const mondayOffset = (weekStart.getDay() + 6) % 7;
    weekStart.setDate(weekStart.getDate() - mondayOffset);
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const runningSeconds = focusSession.type === "focus" && focusSession.startedAt
      ? Math.floor(getFocusElapsedMs(now.getTime()) / 1000)
      : 0;
    const durations = completed.map((record) => ({
      started: new Date(record.started_at),
      seconds: Math.max(0, Number(record.duration_seconds || 0)),
    })).filter((record) => !Number.isNaN(record.started.getTime()));
    const todayRecords = durations.filter((record) => localDateKey(record.started) === todayKey);
    const weekSeconds = durations
      .filter((record) => record.started >= weekStart && record.started <= now)
      .reduce((sum, record) => sum + record.seconds, 0)
      + (focusSession.type === "focus" && focusSession.startedAt && new Date(focusSession.startedAt) >= weekStart ? runningSeconds : 0);
    const todaySeconds = todayRecords.reduce((sum, record) => sum + record.seconds, 0)
      + (focusSession.type === "focus" && focusSession.startedAt && localDateKey(new Date(focusSession.startedAt)) === todayKey ? runningSeconds : 0);
    const dayKeys = new Set(durations.map((record) => localDateKey(record.started)));
    if (runningSeconds && focusSession.startedAt) dayKeys.add(localDateKey(new Date(focusSession.startedAt)));
    const streakAnchor = dayKeys.has(todayKey)
      ? dayStart
      : new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    let streak = 0;
    for (let cursor = streakAnchor; dayKeys.has(localDateKey(cursor)); cursor.setDate(cursor.getDate() - 1)) streak += 1;
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + index);
      const daySeconds = durations.filter((record) => localDateKey(record.started) === localDateKey(date))
        .reduce((sum, record) => sum + record.seconds, 0)
        + (focusSession.type === "focus" && focusSession.startedAt && localDateKey(new Date(focusSession.startedAt)) === localDateKey(date) ? runningSeconds : 0);
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
    const pendingIds = new Set(pendingFocusRecords.map((record) => record.idempotency_key));
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6);
    activity = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(firstDay.getFullYear(), firstDay.getMonth(), firstDay.getDate() + index);
      const key = localDateKey(date);
      const seconds = focusRecords.reduce((sum, record) => {
        if (!record.completed || record.session_type !== "focus" || pendingIds.has(record.idempotency_key)) return sum;
        const endedAt = new Date(record.ended_at || record.started_at);
        return localDateKey(endedAt) === key ? sum + Math.max(0, Number(record.duration_seconds) || 0) : sum;
      }, 0);
      return {
        day: new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(date),
        hours: seconds / 3600,
      };
    });
  }

  function renderFocusChart(days, text) {
    const displayDays = appLanguage === "ar" ? [days[6], ...days.slice(0, 6)] : days;
    const maxSeconds = Math.max(3600, ...days.map((day) => day.seconds));
    const bars = displayDays.map((day) => {
      const label = new Intl.DateTimeFormat(focusLocale(), { weekday: "short" }).format(day.date);
      const height = Math.max(day.seconds ? 4 : 0, (day.seconds / maxSeconds) * 100);
      return `<div class="focus-chart-day" title="${escapeHtml(label)}: ${escapeHtml(formatFocusHours(day.seconds, text))}"><div class="focus-chart-track"><span style="height:${height}%"></span></div><small>${escapeHtml(label)}</small></div>`;
    }).join("");
    return `<div class="focus-chart" role="img" aria-label="${escapeHtml(text.weeklyChart)}">${bars}</div>`;
  }

  function renderFocusHistoryRow(record, text) {
    const subject = subjects.find((item) => String(item.id) === String(record.subject_id))?.name;
    const task = tasks.find((item) => String(item.id) === String(record.task_id))?.title;
    const date = new Date(record.ended_at || record.started_at);
    const label = new Intl.DateTimeFormat(focusLocale(), { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
    const duration = `${new Intl.NumberFormat(focusLocale()).format(Math.floor(Number(record.duration_seconds || 0) / 60))} ${text.mins}`;
    return `<article class="focus-history-row ${record.completed ? "" : "incomplete"}"><span class="focus-history-type ${escapeHtml(record.session_type)}" aria-hidden="true">${record.session_type === "focus" ? "◷" : "☕"}</span><div class="focus-history-details"><strong>${escapeHtml(focusSessionTypeLabel(record.session_type, text))}</strong><small dir="auto">${escapeHtml(task || subject || text.emptySubject)}</small></div><time>${escapeHtml(label)}</time><span class="focus-history-duration" dir="ltr">${escapeHtml(duration)}</span></article>`;
  }

  function renderFocusSettings(text) {
    const numberField = (name, label, value, min, max) => `<label>${label}<input type="number" name="${name}" value="${value}" min="${min}" max="${max}" required></label>`;
    const toggleField = (name, label, checked) => `<label class="focus-setting-toggle"><span>${label}</span><input type="checkbox" name="${name}" ${checked ? "checked" : ""}><i aria-hidden="true"></i></label>`;
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
        </div>
        <div class="focus-settings-actions"><button class="button button-secondary" type="button" data-action="focus-settings-defaults">${text.restoreDefaults}</button><button class="button button-primary" type="submit">${text.saveSettings}</button></div>
        <p class="focus-settings-error" id="focus-settings-error" role="alert"></p>
      </form>
    </section>`;
  }

  function focusPage() {
    const t = focusText[appLanguage];
    const durationMs = getFocusDurationMs(focusSession.type);
    const remaining = getFocusRemainingMs();
    const progress = Math.min(100, Math.max(0, ((durationMs - remaining) / durationMs) * 100));
    const focusedTask = tasks.find((task) => String(task.id) === String(focusSession.taskId));
    const focusedSubject = subjects.find((subject) => String(subject.id) === String(focusSession.subjectId));
    const phase = focusSession.type === "focus" ? t.focus : focusSession.type === "short_break" ? t.shortBreak : t.longBreak;
    const clock = renderFlipClock(remaining, focusSettings.showSeconds);
    const subjectOptions = [`<option value="">${t.chooseSubject}</option>`, ...subjects.map((subject) =>
      `<option value="${escapeHtml(subject.id)}" ${String(subject.id) === String(focusSession.subjectId) ? "selected" : ""}>${escapeHtml(subject.name)}</option>`,
    )].join("");
    const taskOptions = [`<option value="">${t.noTask}</option>`, ...tasks.filter((task) => task.status !== "completed").map((task) =>
      `<option value="${escapeHtml(task.id)}" ${String(task.id) === String(focusSession.taskId) ? "selected" : ""}>${escapeHtml(task.title)}</option>`,
    )].join("");
    const nextPhase = focusSession.type === "focus"
      ? getNextBreakType() === "long_break" ? t.longBreak : t.shortBreak
      : t.focus;
    const settingsPanel = focusSettingsOpen ? renderFocusSettings(t) : "";
    const stats = getFocusStats();
    const history = focusRecords.slice().sort((a, b) => new Date(b.ended_at || b.started_at) - new Date(a.ended_at || a.started_at)).slice(0, 6);
    const historyRows = history.map((record) => renderFocusHistoryRow(record, t)).join("");
    return `<section class="focus-page ${distractionFree ? "distraction-free" : ""}" data-session-type="${focusSession.type}">
      <header class="page-heading focus-heading"><div><p class="eyebrow">${t.eyebrow}</p><h1>${t.title}</h1><p class="page-subtitle">${t.subtitle}</p></div><div class="focus-heading-actions"><button class="button button-secondary button-small" data-action="focus-distraction">${distractionFree ? t.exitDistraction : t.distraction}</button><button class="icon-button" data-action="focus-settings" aria-label="${t.settings}" aria-expanded="${focusSettingsOpen}">⚙</button></div></header>
      ${settingsPanel}
      <div class="focus-main-grid">
        <section class="panel focus-clock-panel">
          <div class="focus-mode-pill">${phase}</div>
          <div class="focus-cycle">${t.cycle} ${new Intl.NumberFormat(appLanguage === "ar" ? "ar-EG" : "en").format(focusSession.cycle)} · ${t.longBreak} ${new Intl.NumberFormat(appLanguage === "ar" ? "ar-EG" : "en").format(focusSettings.longBreakInterval)}</div>
          <div class="flip-clock" id="flip-clock" aria-label="${escapeHtml(formatTimer(Math.ceil(remaining / 1000)))}" dir="ltr">
            ${clock.minutes}<span class="flip-clock-colon" ${focusSettings.showSeconds ? "" : "hidden"}>:</span>${focusSettings.showSeconds ? clock.seconds : ""}
          </div>
          <div class="focus-progress" role="progressbar" aria-label="${phase}" aria-valuenow="${Math.round(progress)}" aria-valuemin="0" aria-valuemax="100"><span id="focus-progress-fill" style="width:${progress}%"></span></div>
          <p class="focus-session-message" id="focus-session-message">${focusSession.type === "focus" ? focusSession.status === "running" ? t.stayFocused : t.focusHint : t.breakHint}</p>
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
          <div class="focus-next-session">${t.next}: <strong>${nextPhase}</strong></div>
        </section>
        <aside class="focus-side">
          <section class="panel focus-stats-panel">${panelHeading(t.focusTimeToday, t.completedToday)}
            <div class="focus-today-value">${escapeHtml(formatFocusDuration(stats.todaySeconds, t))}</div>
            <p class="metric-caption">${new Intl.NumberFormat(appLanguage === "ar" ? "ar-EG" : "en").format(stats.todaySessions)} ${t.completedToday.toLocaleLowerCase(appLanguage)}</p>
            <div class="focus-mini-stats"><div><strong>${escapeHtml(formatFocusHours(stats.weekSeconds, t))}</strong><span>${t.weeklyHours}</span></div><div><strong>${new Intl.NumberFormat(appLanguage === "ar" ? "ar-EG" : "en").format(stats.streak)}</strong><span>${t.streak}</span></div><div><strong>${new Intl.NumberFormat(appLanguage === "ar" ? "ar-EG" : "en").format(stats.totalCycles)}</strong><span>${t.totalCycles}</span></div></div>
          </section>
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
    const weekHours = activity.reduce((sum, item) => sum + item.hours, 0);
    const completedTasks = tasks.filter((task) => task.status === "completed");
    const taskRate = tasks.length ? Math.round((completedTasks.length / tasks.length) * 100) : 0;
    const activeSubjectIds = new Set(focusRecords
      .filter((record) => record.completed && record.session_type === "focus" && record.subject_id)
      .filter((record) => Date.now() - new Date(record.started_at).getTime() <= 7 * 86400000)
      .map((record) => record.subject_id));
    const scoreRows = session ? examResults.flatMap((exam) => {
      const result = Array.isArray(exam.exam_results) ? exam.exam_results[0] : exam.exam_results;
      if (result?.obtained_marks == null) return [];
      const score = Math.round((Number(result.obtained_marks) / Number(exam.max_marks)) * 100);
      return [{ subject: exam.subject || subjectName(exam.subject_id), score }];
    }) : examResults;
    const bars = scoreRows.map((item) => `<div class="score-row"><span>${escapeHtml(item.subject)}</span><div class="progress-track"><div class="progress-fill" style="width:${item.score}%"></div></div><span class="score-value">${item.score}%</span></div>`).join("");
    const stats = session
      ? `${statCard("STUDY TIME", `${weekHours.toFixed(1)}h`, " across 7 days", "◷")}${statCard("DAILY AVERAGE", `${(weekHours / 7).toFixed(1)}h`, " each day", "⌁")}${statCard("TASK COMPLETION", `${taskRate}%`, ` ${completedTasks.length} of ${tasks.length} tasks`, "✓")}${statCard("SUBJECTS ACTIVE", String(activeSubjectIds.size), " courses this week", "◈")}`
      : `${statCard("STUDY TIME", "—", " Sign in to view verified focus time", "◷")}${statCard("DAILY AVERAGE", "—", " Based on completed sessions", "⌁")}${statCard("TASK COMPLETION", "—", " Based on your saved tasks", "✓")}${statCard("SUBJECTS ACTIVE", "—", " Based on recent sessions", "◈")}`;
    return `${pageHeading("YOUR STUDY PATTERNS", "Analytics", "Understand your study habits without losing sight of the bigger picture.", "")}<div class="grid stats-grid">${stats}</div><div class="grid dashboard-grid"><section class="panel">${panelHeading("Daily study hours", session ? "Verified focus time · last 7 days" : "Sample focus time · hours per day")}${lineChart()}</section><section class="panel">${panelHeading("Recent exam results", "Score by subject")}<div class="score-bars">${bars || `<div class="empty-state">${session ? "No recorded exam results yet." : "Sign in to view your exam results."}</div>`}</div></section></div><section class="panel section-spacer">${panelHeading("How to read these numbers")}<p class="panel-copy">${session ? "Study time is summed from completed, verified focus sessions. Task completion is based on your saved tasks; active subjects come from recent sessions." : "Sign in to view account-based analytics. Sample content is not included in your personal metrics."}</p></section>`;
  }

  function goalsPage() {
    return `${pageHeading("MILESTONES THAT MATTER", "Goals", "Turn the semester into small, achievable steps.", `<button class="button button-primary" data-action="goal-add">＋ Create a goal</button>`)}<div class="grid goal-grid">${goals.map((goal) => `<article class="goal-card"><span class="eyebrow">${escapeHtml(goal.due || (goal.completed_at ? "COMPLETED" : goal.period || "GOAL"))}</span><h3>${escapeHtml(goal.title)}</h3><p>${escapeHtml(goal.detail || goal.details || `${goal.current_value || 0} / ${goal.target_value || 1} ${goal.unit || "sessions"}`)}</p><div class="metric-large">${Math.round(goal.progress ?? 0)}<small>%</small></div><div class="progress-track"><div class="progress-fill" style="width:${Math.min(100, Math.max(0, goal.progress ?? 0))}%"></div></div>${session && goal.id ? `<div class="card-actions"><button class="text-button" data-action="goal-progress" data-id="${escapeHtml(goal.id)}">Add progress</button><button class="text-button" data-action="goal-edit" data-id="${escapeHtml(goal.id)}">Edit</button><button class="text-button" data-action="goal-delete" data-id="${escapeHtml(goal.id)}">Delete</button></div>` : ""}</article>`).join("") || `<div class="empty-state"><strong>No goals yet</strong>Create a goal to track progress toward a study milestone.</div>`}</div><p class="data-caption">${session ? "Goals and progress are saved to your private account." : "Preview goals are shown. Sign in to create and sync your own goals."}</p>`;
  }

  function examsPage() {
    const cards = session ? examResults.map((exam) => {
      const score = exam.obtained_marks == null ? null : `${Number(exam.obtained_marks)} / ${Number(exam.max_marks)}`;
      const result = Array.isArray(exam.exam_results) ? exam.exam_results[0] : exam.exam_results;
      const obtained = result?.obtained_marks ?? exam.obtained_marks;
      const percentage = obtained == null ? null : Math.round((Number(obtained) / Number(exam.max_marks || 100)) * 100);
      return `<article class="item-card"><span class="task-meta">${escapeHtml(new Intl.DateTimeFormat(appLanguage, { dateStyle: "medium", timeStyle: "short" }).format(new Date(exam.exam_at || Date.now())))}</span><h3>${escapeHtml(exam.title || exam.subject)}</h3><p>${escapeHtml(exam.subject || subjectName(exam.subject_id))}</p>${percentage == null ? `<div class="exam-score">—<small> / ${escapeHtml(exam.max_marks || "—")}</small></div>` : `<div class="exam-score">${percentage}<small>% · ${escapeHtml(score || `${obtained} / ${exam.max_marks}`)}</small></div>`}${session && exam.id ? `<div class="card-actions"><button class="text-button" data-action="exam-result" data-id="${escapeHtml(exam.id)}">${obtained == null ? "Record result" : "Edit result"}</button><button class="text-button" data-action="exam-edit" data-id="${escapeHtml(exam.id)}">Edit</button><button class="text-button" data-action="exam-delete" data-id="${escapeHtml(exam.id)}">Delete</button></div>` : ""}</article>`;
    }).join("") : examResults.map((exam) => `<article class="item-card"><span class="task-meta">PAST RESULT · SAMPLE</span><h3>${escapeHtml(exam.subject)}</h3><div class="exam-score">${Number(exam.score)}<small> / 100</small></div><p>Recorded exam score preview</p></article>`).join("");
    const upcoming = session ? examResults.filter((exam) => new Date(exam.exam_at) >= new Date()).length : 0;
    return `${pageHeading("EXAM TRACKER", "Exams & results", "Keep upcoming assessments and your progress in one view.", `<button class="button button-primary" data-action="exam-add">＋ Add exam</button>`)}<div class="grid exam-grid">${cards || `<div class="empty-state"><strong>${session ? "No exams yet" : "No exam results to show"}</strong>${session ? "Add an exam to track its date and result." : "Sign in to add and track your own exams."}</div>`}</div><section class="panel section-spacer">${panelHeading("Upcoming assessments", `${upcoming} upcoming`)}${upcoming ? `<div class="activity-list">${examResults.filter((exam) => new Date(exam.exam_at) >= new Date()).map((exam) => `<div class="activity-item"><span>${escapeHtml(exam.title)}</span><time>${escapeHtml(new Intl.DateTimeFormat(appLanguage, { dateStyle: "medium" }).format(new Date(exam.exam_at)))}</time></div>`).join("")}</div>` : `<div class="empty-state">No upcoming exams.</div>`}</section><p class="data-caption">${session ? "Exam dates and results are stored in your private account." : "Sample results are previews, not account records. Sign in to track your own exams."}</p>`;
  }

  function achievementsPage() {
    const earnedCodes = new Set(earnedAchievements.map((item) => {
      const achievement = Array.isArray(item.achievements) ? item.achievements[0] : item.achievements;
      return achievement?.code;
    }).filter(Boolean));
    const cards = achievementCatalog.map((item) => {
      const unlocked = earnedCodes.has(item.code);
      const reward = new Intl.NumberFormat(appLanguage === "ar" ? "ar-EG" : "en").format(item.reward);
      return `<article class="item-card achievement-card ${unlocked ? "unlocked" : "locked"}"><span class="achievement-icon ${unlocked ? "" : "locked"}">${item.symbol}</span><h3>${translateUiText(item.name)}</h3><p>${translateUiText(item.description)}</p><p class="badge-status">${unlocked ? "Unlocked" : "Keep going to unlock"}</p><p class="data-caption">${translateUiText("Reward")} +${reward} XP</p></article>`;
    }).join("");
    const xp = Number(rewardSummary?.total_xp) || 0;
    const level = Number(rewardSummary?.level) || 1;
    const progress = xp % 100;
    return `${pageHeading("MILESTONES", "Achievements", "Celebrate consistency and progress, not just perfect days.", "")}<div class="grid achievement-grid">${cards}</div><section class="panel section-spacer">${panelHeading("Your progress level")}<div class="metric-large">${translateUiText("Level")} ${session ? rewardCounterMarkup("achievement-level", level) : "—"} <span class="metric-caption">· ${session ? `${rewardCounterMarkup("achievement-xp", xp)} XP` : translateUiText("Sign in to earn secure rewards.")}</span></div><div class="progress-track" role="progressbar" aria-label="${translateUiText("Progress to next level")}" aria-valuenow="${session ? progress : 0}" aria-valuemin="0" aria-valuemax="100"><div class="progress-fill" style="width:${session ? progress : 0}%"></div></div><p class="data-caption">${session ? translateUiText("Progress to next level") : translateUiText("Sign in to earn secure rewards.")}${rewardSummary ? "" : session ? ` ${translateUiText("Rewards load after applying the latest Supabase migration.")}` : ""}</p></section>`;
  }

  function notificationsPage() {
    const items = session ? userNotifications : [];
    const rows = items.map((item) => `<article class="notification-card ${item.read_at ? "" : "unread"}"><i class="notification-indicator"></i><div><strong dir="auto">${escapeHtml(item.title)}</strong><p dir="auto">${escapeHtml(item.message)}</p></div><time dir="auto">${escapeHtml(new Intl.DateTimeFormat(appLanguage === "ar" ? "ar-EG" : "en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.created_at)))}</time></article>`).join("");
    const empty = `<div class="empty-state"><strong>${session ? "All caught up" : "Sign in to sync notifications"}</strong>${session ? "Deadline reminders will appear here when generated." : "Your private deadline notifications are attached to your account."}</div>`;
    return `${pageHeading("UPDATES", "Notifications", "A quiet place for reminders, milestones, and important updates.", `<button class="button button-secondary button-small" data-action="mark-notifications-read" ${items.every((item) => item.read_at) ? "disabled" : ""}>Mark all read</button>`)}<section class="panel"><div class="notification-list">${rows || empty}</div></section>`;
  }

  function profilePage() {
    const displayName = accountProfile?.display_name || session?.user?.user_metadata?.full_name || "Alex Morgan";
    const email = session?.user?.email || "Student account";
    const timezone = accountProfile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    const avatar = accountProfile?.avatar_display_url
      ? `<img src="${escapeHtml(accountProfile.avatar_display_url)}" alt="" referrerpolicy="no-referrer">`
      : initials(displayName);
    return `${pageHeading("YOUR ACCOUNT", "Profile", "Your academic workspace, at a glance.", "")}<div class="profile-layout"><section class="panel profile-card"><div class="profile-avatar" dir="ltr">${avatar}</div><h2 dir="auto">${escapeHtml(displayName)}</h2><p dir="ltr">${escapeHtml(email)}</p><div class="profile-stats"><div><strong>${session && rewardSummary ? rewardCounterMarkup("profile-level", rewardSummary.level) : "—"}</strong><small>Level</small></div><div><strong>${session && rewardSummary ? rewardCounterMarkup("profile-streak", rewardSummary.current_streak) : "—"}</strong><small>Day streak</small></div></div><p class="profile-xp">${session && rewardSummary ? `${rewardCounterMarkup("profile-xp", rewardSummary.total_xp)} XP` : translateUiText("Sign in to earn secure rewards.")}</p></section><section class="panel">${panelHeading("Academic profile", "Personal details stay private to your account")}<div class="setting-row"><div><strong>Email</strong><small dir="ltr">${escapeHtml(email)}</small></div></div><div class="setting-row"><div><strong>Timezone</strong><small dir="ltr">${escapeHtml(timezone)}</small></div></div><div class="setting-row"><div><strong>Language</strong><small>${escapeHtml(accountProfile?.language || appLanguage)}</small></div></div><button class="button button-secondary button-small section-spacer" data-action="profile-edit" ${session ? "" : "disabled"}>Edit profile</button>${session ? "" : `<p class="data-caption">Sign in to edit your account profile.</p>`}</section></div>`;
  }

  function settingsPage() {
    const motionOptions = [
      ["full", "Full Motion", "Layered transitions and celebrations"],
      ["reduced", "Reduced Motion", "Short, gentle transitions"],
      ["off", "Motion Off", "Disable nonessential animation"],
    ].map(([level, title, description]) => `<button class="motion-option ${motionLevel === level ? "selected" : ""}" type="button" data-motion-level="${level}" aria-pressed="${motionLevel === level}"><strong>${title}</strong><small>${description}</small></button>`).join("");
    const reminderForm = session
      ? `<form id="daily-reminder-form" class="form-stack daily-reminder-form"><label class="focus-setting-toggle"><span>${translateUiText("Enable push reminders")}</span><input type="checkbox" name="enabled" ${dailyReminderPreference.enabled ? "checked" : ""}><i aria-hidden="true"></i></label><p class="data-caption">${translateUiText("Get a daily task check-in plus deadline and achievement notifications, even when Study Zone is closed.")}</p><label>${translateUiText("Reminder time")}<input type="time" name="local_time" value="${escapeHtml(String(dailyReminderPreference.local_time || "09:00").slice(0, 5))}" required></label><small>${translateUiText("Uses this device’s timezone.")}</small><button class="button button-primary button-small" type="submit">${translateUiText("Save reminder")}</button><p class="data-caption">${translateUiText("Push reminders need notification permission and the server setup described in README.md.")}</p><p class="form-error" data-reminder-error role="alert"></p></form>`
      : `<p class="data-caption">${translateUiText("Sign in to configure daily reminders.")}</p>`;
    return `${pageHeading("MAKE IT YOURS", "Settings", "Tune Study Zone to the way you like to work.", "")}<div class="grid settings-grid"><section class="panel">${panelHeading("Appearance")}<div class="setting-row"><div><strong>Dark theme</strong><small>Designed for focus, day or night</small></div><button class="toggle on" data-action="theme-toggle" aria-label="Toggle light theme" aria-pressed="false"></button></div><div class="setting-row"><div><strong>Emerald accents</strong><small>Official Study Zone color palette</small></div><span class="subject-color"></span></div><div class="setting-row"><div><strong>Motion & celebrations</strong><small>Choose how much motion Study Zone uses.</small></div></div><div class="motion-options" role="group" aria-label="Animation level">${motionOptions}</div></section><section class="panel">${panelHeading("Language")}<div class="setting-row"><div><strong>Display language</strong><small>Deadlines appear in the selected language.</small></div></div><div class="language-switcher" role="group" aria-label="Choose language"><span class="language-indicator ${appLanguage === "ar" ? "arabic" : ""}"></span><button class="language-option ${appLanguage === "ar" ? "selected" : ""}" data-language="ar" aria-pressed="${appLanguage === "ar"}">عربي <span>العربية</span></button><button class="language-option ${appLanguage === "en" ? "selected" : ""}" data-language="en" aria-pressed="${appLanguage === "en"}">EN <span>English</span></button></div></section><section class="panel">${panelHeading("Reminders")}<div class="setting-row"><div><strong>Daily study check-in</strong><small>Review your open tasks once a day, even when Study Zone is closed.</small></div></div>${reminderForm}</section><section class="panel">${panelHeading("Data & privacy")}<div class="setting-row"><div><strong>Account data</strong><small>Stored in your private Supabase account when configured</small></div></div><div class="setting-row"><div><strong>Service keys</strong><small>Only the public anon key belongs in this browser config.</small></div></div></section></div>`;
  }

  function formatAdminDate(value) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return new Intl.DateTimeFormat(appLanguage === "ar" ? "ar-EG" : "en", { dateStyle: "medium" }).format(date);
  }

  async function loadAdminUsers() {
    const userId = session?.user?.id;
    if (!supabase || !userId || adminAuthorization.status !== "authorized" || adminAuthorization.userId !== userId) return;
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
    if (!session || adminAuthorization.status !== "authorized" || adminAuthorization.userId !== session.user.id) {
      return adminAccessPage();
    }
    const users = adminUsers.map((user) => `<tr><td><strong>${escapeHtml(user.display_name || "Student")}</strong><small>${escapeHtml(user.email || "—")}</small></td><td>${escapeHtml(translateUiText(user.role || "student"))}</td><td>${escapeHtml(formatAdminDate(user.created_at))}</td><td>${escapeHtml(formatAdminDate(user.last_sign_in_at))}</td><td><span class="admin-user-status ${user.email_confirmed_at ? "confirmed" : "unconfirmed"}">${user.email_confirmed_at ? translateUiText("Confirmed") : translateUiText("Pending confirmation")}</span></td></tr>`).join("");
    const from = adminUsersTotal ? adminUsersPage * adminUsersPageSize + 1 : 0;
    const to = Math.min((adminUsersPage + 1) * adminUsersPageSize, adminUsersTotal);
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
    const message = adminAuthorization.status === "checking" || adminAuthorization.status === "unknown"
      ? "Checking administrator access…"
      : adminAuthorization.status === "error"
        ? "Could not verify administrator access."
        : "Administrator access denied.";
    return `${pageHeading("ADMINISTRATION", "Admin dashboard", "Protected operational metrics and account administration.", "")}<section class="panel" role="status" aria-live="polite"><p class="panel-copy">${translateUiText(message)}</p></section>`;
  }

  const pageRenderers = {
    dashboard: dashboardPage, planner: plannerPage, tasks: taskPage, deadlines: deadlinesPage, subjects: subjectsPage,
    files: filesPage, notes: notesPage, focus: focusPage, analytics: analyticsPage,
    goals: goalsPage, exams: examsPage, achievements: achievementsPage,
    notifications: notificationsPage, profile: profilePage, settings: settingsPage, admin: adminPage,
  };
  const pageTitles = {
    dashboard: "Dashboard", planner: "Study planner", tasks: "Tasks", deadlines: "Deadlines", subjects: "Subjects",
    files: "Study files", notes: "Notes", focus: "Focus timer", analytics: "Analytics",
    goals: "Goals", exams: "Exams & results", achievements: "Achievements",
    notifications: "Notifications", profile: "Profile", settings: "Settings", admin: "Admin",
  };

  function updateScrollProgress() {
    const root = document.documentElement;
    const range = root.scrollHeight - window.innerHeight;
    const progress = range > 0 ? Math.min(1, Math.max(0, window.scrollY / range)) : 0;
    document.documentElement.style.setProperty("--scroll-progress", String(progress));
    const indicator = document.getElementById("scroll-progress");
    if (indicator) indicator.style.transform = `scaleX(${progress})`;
  }

  function render() {
    if (!pageRenderers[currentPage]) currentPage = "dashboard";
    document.body.classList.toggle("focus-distraction", currentPage === "focus" && distractionFree);
    document.documentElement.lang = appLanguage;
    document.documentElement.dir = appLanguage === "ar" ? "rtl" : "ltr";
    document.documentElement.dataset.motion = motionLevel;
    const content = document.getElementById("page-content");
    content.classList.remove("page-enter");
    content.innerHTML = pageRenderers[currentPage]();
    if (shouldAnimate()) {
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
          if (fill.isConnected && document.visibilityState === "visible") fill.style.width = targetWidth;
        });
      });
    }
    document.getElementById("page-crumb").textContent = currentPage === "deadlines" ? deadlineText[appLanguage].title : pageTitles[currentPage];
    document.querySelectorAll(".nav-link[data-page]").forEach((link) => {
      link.classList.toggle("active", link.dataset.page === currentPage);
    });
    document.getElementById("task-count").textContent = String(tasks.filter((task) => task.status !== "completed").length);
    document.getElementById("deadline-count").textContent = String(getDeadlines().filter((deadline) => getDeadlineStatus(deadline) !== "completed").length);
    document.getElementById("today-date").textContent = new Intl.DateTimeFormat(appLanguage === "ar" ? "ar-EG" : "en", { weekday: "short", month: "short", day: "numeric" }).format(new Date());
    updateStreakSidebar();
    updateAdminNavigation();
    if (currentPage === "tasks") {
      document.getElementById("task-search")?.addEventListener("input", (event) => {
        searchTerm = event.target.value;
        const cursor = event.target.selectionStart;
        render();
        const input = document.getElementById("task-search");
        input.focus();
        input.setSelectionRange(cursor, cursor);
      });
      document.getElementById("task-filter")?.addEventListener("change", (event) => {
        statusFilter = event.target.value;
        render();
      });
    }
    if (currentPage === "admin" && adminAuthorization.status === "authorized") {
      document.getElementById("admin-users-search")?.addEventListener("submit", (event) => {
        event.preventDefault();
        adminUsersSearch = String(new FormData(event.currentTarget).get("search") || "").trim();
        adminUsersPage = 0;
        void loadAdminUsers();
      });
    }
    if (currentPage === "focus") {
      attachFocusListeners();
      updateTimerUi();
    }
    if (currentPage === "deadlines") {
      document.getElementById("deadline-search")?.addEventListener("input", (event) => {
        deadlineSearch = event.target.value;
        const cursor = event.target.selectionStart;
        render();
        const input = document.getElementById("deadline-search");
        input.focus();
        input.setSelectionRange(cursor, cursor);
      });
      document.getElementById("deadline-sort")?.addEventListener("change", (event) => {
        deadlineSort = event.target.value;
        render();
      });
    }
    translateInterface();
    animateRewardCounters();
    updateScrollProgress();
    syncFocusTicker();
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
      adminAuthorization = { status: "checking", userId: session?.user?.id || null };
      updateAdminNavigation();
    }
    const updatePage = () => render();
    if (shouldUseFullMotion() && typeof document.startViewTransition === "function") {
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
      link.hidden = !session || adminAuthorization.status !== "authorized"
        || adminAuthorization.userId !== session.user.id;
    }
  }

  async function verifyAdminAccess() {
    const userId = session?.user?.id || null;
    const requestId = ++adminVerificationRequest;
    adminAuthorization = { status: userId && supabase ? "checking" : "denied", userId };
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
    if (requestId !== adminVerificationRequest || session?.user?.id !== userId) return false;

    if (error) {
      console.error("Could not verify administrator access.", error);
      adminAuthorization = { status: "error", userId };
    } else {
      adminAuthorization = { status: data === true ? "authorized" : "denied", userId };
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
    showToast(translateUiText(verificationFailed
      ? "Could not verify administrator access."
      : "Administrator access denied."));
  }

  function updateUserUi() {
    const user = session?.user;
    const name = accountProfile?.display_name || user?.user_metadata?.full_name || (user?.email ? user.email.split("@")[0] : "Alex Morgan");
    const initialsText = initials(name);
    document.getElementById("user-name").textContent = name;
    document.getElementById("user-email").textContent = user?.email || "Student account";
    document.querySelectorAll(".avatar").forEach((avatar) => {
      if (accountProfile?.avatar_display_url) {
        const image = document.createElement("img");
        image.src = accountProfile.avatar_display_url;
        image.alt = "";
        image.referrerPolicy = "no-referrer";
        avatar.replaceChildren(image);
      } else {
        avatar.textContent = initialsText;
      }
    });
    document.getElementById("sign-out").hidden = !user;
    updateAdminNavigation();
    document.getElementById("auth-help").textContent = configured
      ? user ? `Signed in as ${user.email}` : "Sign in to sync your private study workspace."
      : "This is a local preview. Add your Supabase project details to enable authentication.";
    document.getElementById("auth-submit").disabled = !supabase;
    document.getElementById("auth-submit").title = supabase ? "" : "Add your Supabase URL and public anon key in supabase-config.js and allow the SDK to load";
    setConnectionState(user ? "Supabase connected" : supabase ? "Supabase ready" : "Demo workspace", Boolean(user));
    translateInterface();
  }

  async function loadRemoteTasks() {
    if (!supabase || !session) return;
    deadlinesLoading = true;
    render();
    const { data: subjectData, error: subjectError } = await supabase.from("subjects")
      .select("id,name,color,credit_hours")
      .order("name");
    if (subjectError) {
      subjects = [];
      showToast(`Could not load subjects: ${subjectError.message}`);
      console.error("Supabase subject read failed.", subjectError);
    } else {
      subjects = (subjectData || []).map((subject) => ({
        ...subject,
        credits: subject.credit_hours,
        progress: null,
      }));
    }
    const { data, error } = await supabase.from("tasks")
      .select("id,title,description,subject_id,starts_at,due_at,priority,status,estimated_minutes,reminder_before_minutes,created_at,completed_at,subjects(name)")
      .order("due_at", { ascending: true, nullsFirst: false });
    if (error) {
      tasks = [];
      deadlinesLoading = false;
      render();
      showToast(`Could not load tasks: ${error.message}`);
      console.error("Supabase task read failed.", error);
      return;
    }
    tasks = (data || []).map((task) => ({ ...task, subject: task.subjects?.name || "Independent study" }));
    deadlinesLoading = false;
    render();
  }

  async function loadAccountWorkspace() {
    if (!supabase || !session) return;
    const userId = session.user.id;
    const [scheduleResult, fileResult, noteResult, goalResult, examResult, profileResult, reminderResult] = await Promise.all([
      supabase.from("schedules").select("id,title,details,subject_id,starts_at,ends_at,recurrence").order("starts_at"),
      supabase.from("study_files").select("id,name,storage_path,mime_type,size_bytes,subject_id,is_favorite,created_at").order("created_at", { ascending: false }),
      supabase.from("notes").select("id,title,content,subject_id,is_favorite,created_at,updated_at").order("updated_at", { ascending: false }),
      supabase.from("goals").select("id,title,details,period,target_value,current_value,unit,starts_at,due_at,completed_at").order("created_at", { ascending: false }),
      supabase.from("exams").select("id,title,details,subject_id,exam_at,max_marks,exam_results(obtained_marks,notes)").order("exam_at"),
      supabase.from("profiles").select("id,display_name,avatar_url,timezone,language").eq("id", userId).maybeSingle(),
      supabase.from("daily_reminder_preferences").select("enabled,local_time,timezone").eq("user_id", userId).maybeSingle(),
    ]);

    if (session?.user?.id !== userId) return;
    const reportError = (label, result) => {
      if (!result.error) return false;
      console.error(`Could not load ${label}.`, result.error);
      showToast(`Could not load ${label}: ${result.error.message}`);
      return true;
    };

    if (reportError("study schedule", scheduleResult)) schedule = [];
    else schedule = (scheduleResult.data || []).map((block) => ({
      ...block,
      day: new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(new Date(block.starts_at)),
      time: new Intl.DateTimeFormat(appLanguage, { hour: "2-digit", minute: "2-digit" }).format(new Date(block.starts_at)),
      length: `${Math.max(1, Math.round((new Date(block.ends_at) - new Date(block.starts_at)) / 60000))} min`,
      subject: subjectName(block.subject_id),
    }));

    if (reportError("study files", fileResult)) sampleFiles = [];
    else sampleFiles = (fileResult.data || []).map((file) => ({
      ...file,
      type: file.mime_type,
      subject: subjectName(file.subject_id),
    }));

    if (reportError("notes", noteResult)) sampleNotes = [];
    else sampleNotes = (noteResult.data || []).map((note) => ({
      ...note,
      subject: subjectName(note.subject_id),
      updated: new Intl.DateTimeFormat(appLanguage, { dateStyle: "medium" }).format(new Date(note.updated_at)),
    }));

    if (reportError("goals", goalResult)) goals = [];
    else goals = (goalResult.data || []).map((goal) => ({
      ...goal,
      progress: Math.min(100, Math.round((Number(goal.current_value) / Number(goal.target_value)) * 100)),
      due: goal.completed_at ? "Completed" : goal.due_at
        ? Math.max(0, Math.ceil((new Date(goal.due_at) - Date.now()) / 86400000)) + " days"
        : goal.period,
      detail: goal.details || `${goal.current_value} / ${goal.target_value} ${goal.unit}`,
    }));

    if (reportError("exams", examResult)) examResults = [];
    else examResults = (examResult.data || []).map((exam) => ({
      ...exam,
      subject: subjectName(exam.subject_id),
    }));

    if (reportError("profile", profileResult)) accountProfile = null;
    else {
      accountProfile = profileResult.data;
      if (accountProfile) accountProfile.avatar_display_url = await resolveProfileAvatarUrl(accountProfile.avatar_url, userId);
    }

    if (reportError("daily reminder preferences", reminderResult)) {
      dailyReminderPreference = { enabled: false, local_time: "09:00", timezone: "UTC" };
    } else {
      dailyReminderPreference = {
        enabled: Boolean(reminderResult.data?.enabled),
        local_time: reminderResult.data?.local_time || "09:00",
        timezone: reminderResult.data?.timezone || "UTC",
      };
    }
    updateUserUi();
    render();
  }

  async function resolveProfileAvatarUrl(avatarPath, userId) {
    if (!avatarPath) return "";
    if (avatarPath.startsWith(`${userId}/`)) {
      const { data, error } = await supabase.storage.from("studyflow-files").createSignedUrl(avatarPath, 86400);
      if (error) {
        console.error("Could not create a private profile photo URL.", error);
        showToast(`Could not load profile photo: ${error.message}`);
        return "";
      }
      return data.signedUrl;
    }
    try {
      const url = new URL(avatarPath);
      return url.protocol === "https:" ? url.href : "";
    } catch (error) {
      console.error("The profile photo reference is invalid.", error);
      return "";
    }
  }

  function resetAccountWorkspacePreview() {
    accountProfile = null;
    activity = previewActivity;
    schedule = previewSchedule;
    goals = previewGoals;
    examResults = previewExamResults;
    sampleFiles = previewFiles;
    sampleNotes = previewNotes;
  }

  function clearAccountWorkspace() {
    accountProfile = null;
    activity = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => ({ day, hours: 0 }));
    schedule = [];
    goals = [];
    examResults = [];
    sampleFiles = [];
    sampleNotes = [];
  }

  async function loadLanguagePreference() {
    if (!supabase || !session) return;
    const { data, error } = await supabase.from("profiles").select("language").eq("id", session.user.id).maybeSingle();
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
  }

  function vapidApplicationServerKey(encodedKey) {
    const padding = "=".repeat((4 - encodedKey.length % 4) % 4);
    const base64 = `${encodedKey}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
    const raw = window.atob(base64);
    return Uint8Array.from(raw, (character) => character.charCodeAt(0));
  }

  function isSupportedPushEndpoint(endpoint) {
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

  async function saveDailyReminder(form) {
    if (!supabase || !session) throw new Error(translateUiText("Sign in to configure daily reminders."));
    const enabled = form.elements.namedItem("enabled").checked;
    const localTime = String(form.elements.namedItem("local_time").value || "");
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(localTime)) throw new Error("Choose a valid reminder time.");
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    let subscription;

    if (enabled) {
      const vapidPublicKey = window.studyFlowSupabaseConfig?.vapidPublicKey;
      if (!vapidPublicKey) throw new Error(translateUiText("Daily push is not configured yet. Ask your administrator to finish the VAPID setup."));
      if (!window.isSecureContext || !("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        throw new Error("Push notifications require a supported browser and HTTPS (localhost is supported for development).");
      }
      const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
      if (permission !== "granted") throw new Error(translateUiText("Notification permission is required to enable daily push reminders."));
      const registration = await navigator.serviceWorker.ready;
      subscription = await registration.pushManager.getSubscription()
        || await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: vapidApplicationServerKey(vapidPublicKey),
        });
      const serialized = subscription.toJSON();
      const p256dh = serialized.keys?.p256dh;
      const authSecret = serialized.keys?.auth;
      if (!subscription.endpoint || !p256dh || !authSecret) {
        await subscription.unsubscribe();
        throw new Error("The browser returned an incomplete push subscription.");
      }
      if (!isSupportedPushEndpoint(subscription.endpoint)) {
        await subscription.unsubscribe();
        throw new Error("This browser's push service is not currently supported.");
      }
      const { error: subscriptionError } = await supabase.from("push_subscriptions").upsert({
        user_id: session.user.id,
        endpoint: subscription.endpoint,
        p256dh,
        auth_secret: authSecret,
      }, { onConflict: "user_id,endpoint" });
      if (subscriptionError) {
        await subscription.unsubscribe();
        throw subscriptionError;
      }
    }

    const { error } = await supabase.from("daily_reminder_preferences").upsert({
      user_id: session.user.id,
      enabled,
      local_time: localTime,
      timezone,
    }, { onConflict: "user_id" });
    if (error) {
      if (subscription) {
        const { error: cleanupError } = await supabase.from("push_subscriptions").delete()
          .eq("user_id", session.user.id).eq("endpoint", subscription.endpoint);
        await subscription.unsubscribe();
        if (cleanupError) {
          console.error("Could not remove push subscription after saving reminder preferences failed.", cleanupError);
          throw new Error(`${error.message} Subscription cleanup also failed: ${cleanupError.message}`);
        }
      }
      throw error;
    }

    dailyReminderPreference = { enabled, local_time: localTime, timezone };
    if (!enabled) {
      await removeCurrentPushSubscription(session.user.id);
      const { error: deleteError } = await supabase.from("push_subscriptions").delete()
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
    if (!unsubscribed) throw new Error("The browser could not disable this push subscription.");
    const { error } = await supabase.from("push_subscriptions").delete()
      .eq("user_id", userId).eq("endpoint", endpoint);
    if (error) throw error;
  }

  async function loadRemoteNotifications() {
    if (!supabase || !session) {
      userNotifications = [];
      return;
    }
    const { data, error } = await supabase.from("notifications")
      .select("id,type,title,message,read_at,created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      console.error("Could not load notifications.", error);
      showToast(`Could not load notifications: ${error.message}`);
      return;
    }
    userNotifications = data || [];
    if (currentPage === "notifications") render();
  }

  async function markNotificationsRead() {
    if (!supabase || !session) {
      showToast("Sign in to manage your notifications.");
      return;
    }
    const { error } = await supabase.from("notifications")
      .update({ read_at: new Date().toISOString() })
      .is("read_at", null);
    if (error) {
      showToast(`Could not update notifications: ${error.message}`);
      console.error("Could not mark notifications as read.", error);
      return;
    }
    const readAt = new Date().toISOString();
    userNotifications = userNotifications.map((item) => item.read_at ? item : { ...item, read_at: readAt });
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
      const { error } = await supabase.from("profiles").update({ language }).eq("id", session.user.id);
      if (error) {
        console.error("Could not save language preference to the profile.", error);
        showToast(`Language saved on this device, but account sync failed: ${error.message}`);
        return;
      }
    }
    showToast("Language changed.");
  }

  async function createTask(formData) {
    const title = String(formData.get("title") || "").trim();
    if (!title) throw new Error("Enter a task name.");
    const dueValue = String(formData.get("due_at") || "");
    const repeatType = String(formData.get("repeat_type") || "none");
    const recurrence = buildRecurrencePlan(formData, dueValue.slice(0, 10), repeatType);
    const groupId = repeatType === "none" ? null : focusId();
    const baseTask = {
      title,
      subject_id: formData.get("subject_id") || null,
      priority: formData.get("priority"),
      estimated_minutes: Number(formData.get("estimated_minutes")) || 45,
      status: "not_started",
    };
    if (dueValue) baseTask.due_at = new Date(dueValue).toISOString();
    const recurrenceFields = {
      recurrence_group_id: groupId,
      recurrence_type: repeatType,
      recurrence_days: recurrence.days,
      recurrence_until: recurrence.until,
    };
    const instances = recurrence.dateKeys.map((dateKey) => {
      const occurrence = { ...baseTask, ...recurrenceFields };
      if (dueValue && dateKey) occurrence.due_at = new Date(`${dateKey}T${dueValue.slice(11, 16) || "23:59"}`).toISOString();
      return occurrence;
    });
    if (supabase && session) {
      const { data, error } = await supabase.from("tasks").insert(instances)
        .select("id,title,description,subject_id,due_at,priority,status,estimated_minutes,reminder_before_minutes,created_at,subjects(name)");
      if (error) throw error;
      tasks.unshift(...(data || []).map((item) => ({ ...item, subject: item.subjects?.name || "Independent study" })));
    } else {
      tasks.unshift(...instances.map((instance, index) => ({
        ...instance,
        id: `local-${Date.now()}-${index}`,
        subject: subjectName(instance.subject_id),
      })));
      saveLocalTasks();
    }
    document.getElementById("task-modal").hidden = true;
    render();
    showToast(supabase && session
      ? `${instances.length} task${instances.length === 1 ? "" : "s"} saved to your account.`
      : `${instances.length} task${instances.length === 1 ? "" : "s"} saved in this browser.`);
  }

  function buildRecurrencePlan(formData, startDateValue, repeatType) {
    if (repeatType === "none") return { dateKeys: [startDateValue || null], days: [], until: null };
    if (!startDateValue) throw new Error("Choose a due date before setting a repeat schedule.");
    const start = new Date(`${startDateValue}T00:00:00`);
    const untilValue = String(formData.get("repeat_until") || "");
    const until = untilValue ? new Date(`${untilValue}T00:00:00`) : null;
    if (!until || Number.isNaN(until.getTime()) || until < start) {
      throw new Error("Choose a repeat end date on or after the first occurrence.");
    }
    const maxUntil = new Date(start);
    maxUntil.setDate(maxUntil.getDate() + 365);
    if (until > maxUntil) throw new Error("Repeat schedules can be created for up to one year at a time.");
    if (!["daily", "weekly", "monthly", "custom"].includes(repeatType)) {
      throw new Error("Choose a valid repeat schedule.");
    }
    const days = repeatType === "custom"
      ? [...new Set(formData.getAll("repeat_days").map(Number))].filter((day) => Number.isInteger(day) && day >= 0 && day <= 6).sort()
      : [];
    if (repeatType === "custom" && !days.length) throw new Error("Choose at least one weekday.");

    const dateKeys = [];
    for (const cursor = new Date(start); cursor <= until; cursor.setDate(cursor.getDate() + 1)) {
      let matches = repeatType === "daily"
        || repeatType === "weekly" && cursor.getDay() === start.getDay()
        || repeatType === "custom" && days.includes(cursor.getDay());
      if (repeatType === "monthly") {
        const lastDay = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
        matches = cursor.getDate() === Math.min(start.getDate(), lastDay);
      }
      if (matches) {
        dateKeys.push(dateKey(cursor));
        if (dateKeys.length > 366) throw new Error("A repeat schedule cannot contain more than 366 occurrences.");
      }
    }
    return { dateKeys, days, until: untilValue };
  }

  function updateRepeatControls(form) {
    const repeatType = form.elements.namedItem("repeat_type")?.value || "none";
    const recurring = repeatType !== "none";
    const dayField = form.querySelector("[data-repeat-days]");
    const untilField = form.querySelector("[data-repeat-until]");
    const help = form.querySelector("[data-repeat-help]");
    if (dayField) dayField.hidden = repeatType !== "custom";
    if (untilField) {
      untilField.hidden = !recurring;
      untilField.querySelector("input").required = recurring;
    }
    if (help) help.hidden = !recurring;
  }

  async function updateTaskStatus(id) {
    const task = tasks.find((item) => item.id === id);
    if (!task || statusChangesInFlight.has(id)) return;
    const nextStatus = task.status === "completed" ? "not_started" : "completed";
    const completing = nextStatus === "completed";
    const previousRewards = rewardSummary ? { ...rewardSummary } : null;
    const row = [...document.querySelectorAll(".task-row")].find((item) => item.dataset.taskId === id);
    const button = row?.querySelector('[data-action="toggle-task"]');
    statusChangesInFlight.add(id);
    if (button) button.disabled = true;
    try {
      if (supabase && session) {
        const { error } = await supabase.from("tasks").update({ status: nextStatus }).eq("id", id);
        if (error) throw error;
      }
      if (completing) await animateCompletionCard(row);
      task.status = nextStatus;
      if (!supabase || !session) saveLocalTasks();
      render();
      showToast(completing ? task.due_at ? "Deadline completed." : "Task completed." : "Task reopened.");
      if (completing && !task.due_at && shouldUseFullMotion()) launchConfetti();
      if (completing && supabase && session) await refreshRewardSummary({ celebrate: true, previous: previousRewards });
      if (completing && task.due_at) {
        const gained = previousRewards && rewardSummary
          ? Math.max(0, Number(rewardSummary.total_xp) - Number(previousRewards.total_xp))
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
    if (!task || !window.confirm(translateUiText(`Delete "${task.title}"?`))) return;
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
    showToast("Task deleted.");
  }

  function openTaskModal() {
    const select = document.getElementById("task-subject");
    select.innerHTML = `<option value="">Independent study</option>${subjects.map((subject) => `<option value="${subject.id}">${escapeHtml(subject.name)}</option>`).join("")}`;
    const form = document.getElementById("task-form");
    form.reset();
    updateRepeatControls(form);
    document.getElementById("task-error").textContent = "";
    document.getElementById("task-modal").hidden = false;
    translateInterface();
    document.querySelector('#task-form [name="title"]').focus();
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
    document.getElementById("deadline-modal-title").textContent = deadline ? t.modalEdit : t.modalAdd;
    document.getElementById("deadline-modal-help").textContent = t.modalHelp;
    document.getElementById("deadline-submit").innerHTML = `${deadline ? t.save : t.save} <span>→</span>`;
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
      form.elements.due_time.value = noTimeSet ? "" : `${String(due.getHours()).padStart(2, "0")}:${String(due.getMinutes()).padStart(2, "0")}`;
      form.elements.reminder_before_minutes.value = String(deadline.reminder_before_minutes || 0);
      form.querySelector("[data-repeat-config]").hidden = true;
    } else {
      form.querySelector("[data-repeat-config]").hidden = false;
    }
    updateRepeatControls(form);
    document.getElementById("deadline-modal").hidden = false;
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
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || startDate > endDate) {
      throw new Error("The start date must be on or before the deadline.");
    }
    const dueAt = localDateTimeToIso(date, String(formData.get("due_time") || ""));
    if (!dueAt) throw new Error(t.validationDate);
    const startsAt = localDateTimeToIso(startsOn, String(formData.get("due_time") || "")) || startDate.toISOString();
    const subjectId = String(formData.get("subject_id") || "") || null;
    const payload = {
      title,
      description: String(formData.get("description") || "").trim(),
      subject_id: subjectId,
      starts_at: startsAt,
      due_at: dueAt,
      priority: String(formData.get("priority") || "medium"),
      reminder_before_minutes: Number(formData.get("reminder_before_minutes") || 0),
    };

    if (supabase && session) {
      if (editingDeadlineId) {
        const { data, error } = await supabase.from("tasks").update(payload).eq("id", editingDeadlineId)
          .select("id,title,description,subject_id,starts_at,due_at,priority,status,estimated_minutes,reminder_before_minutes,created_at,completed_at,subjects(name)").single();
        if (error) throw error;
        tasks = tasks.map((item) => item.id === editingDeadlineId ? { ...data, subject: data.subjects?.name || "Independent study" } : item);
      } else {
        const repeatType = String(formData.get("repeat_type") || "none");
        const recurrence = buildRecurrencePlan(formData, date, repeatType);
        const dateDuration = Math.round((Date.UTC(endDate.getFullYear(), endDate.getMonth(), endDate.getDate())
          - Date.UTC(startDate.getFullYear(), startDate.getMonth(), startDate.getDate())) / 86400000);
        const groupId = repeatType === "none" ? null : focusId();
        const instances = recurrence.dateKeys.map((occurrenceDate) => {
          const occurrenceEnd = new Date(`${occurrenceDate}T00:00:00`);
          const occurrenceStart = new Date(occurrenceEnd);
          occurrenceStart.setDate(occurrenceStart.getDate() - dateDuration);
          const startKey = dateKey(occurrenceStart);
          return {
            ...payload,
            starts_at: localDateTimeToIso(startKey, String(formData.get("due_time") || "")) || occurrenceStart.toISOString(),
            due_at: localDateTimeToIso(occurrenceDate, String(formData.get("due_time") || "")),
            recurrence_group_id: groupId,
            recurrence_type: repeatType,
            recurrence_days: recurrence.days,
            recurrence_until: recurrence.until,
            status: "not_started",
            estimated_minutes: 30,
          };
        });
        const { data, error } = await supabase.from("tasks").insert(instances)
          .select("id,title,description,subject_id,starts_at,due_at,priority,status,estimated_minutes,reminder_before_minutes,created_at,completed_at,subjects(name)");
        if (error) throw error;
        tasks.unshift(...(data || []).map((item) => ({ ...item, subject: item.subjects?.name || "Independent study" })));
      }
    } else {
      if (editingDeadlineId) {
        tasks = tasks.map((item) => item.id === editingDeadlineId
          ? { ...item, ...payload, subject: subjectName(subjectId), updated_at: new Date().toISOString() }
          : item);
      } else {
        const repeatType = String(formData.get("repeat_type") || "none");
        const recurrence = buildRecurrencePlan(formData, date, repeatType);
        const dateDuration = Math.round((Date.UTC(endDate.getFullYear(), endDate.getMonth(), endDate.getDate())
          - Date.UTC(startDate.getFullYear(), startDate.getMonth(), startDate.getDate())) / 86400000);
        const groupId = repeatType === "none" ? null : `local-series-${Date.now()}`;
        const instances = recurrence.dateKeys.map((occurrenceDate, index) => {
          const occurrenceEnd = new Date(`${occurrenceDate}T00:00:00`);
          const occurrenceStart = new Date(occurrenceEnd);
          occurrenceStart.setDate(occurrenceStart.getDate() - dateDuration);
          const startKey = dateKey(occurrenceStart);
          return {
            ...payload,
            starts_at: localDateTimeToIso(startKey, String(formData.get("due_time") || "")) || occurrenceStart.toISOString(),
            due_at: localDateTimeToIso(occurrenceDate, String(formData.get("due_time") || "")),
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

    document.getElementById("deadline-modal").hidden = true;
    document.getElementById("deadline-form").reset();
    render();
    showToast(editingDeadlineId ? t.updateSuccess : t.saveSuccess);
    editingDeadlineId = null;
  }

  async function toggleDeadline(id) {
    const t = deadlineText[appLanguage];
    const deadline = tasks.find((item) => item.id === id);
    if (!deadline || statusChangesInFlight.has(id)) return;
    const nextStatus = deadline.status === "completed" ? "not_started" : "completed";
    const completing = nextStatus === "completed";
    const previousRewards = rewardSummary ? { ...rewardSummary } : null;
    const card = [...document.querySelectorAll(".deadline-card")].find((item) => item.dataset.deadlineId === id);
    const button = card?.querySelector('[data-action="deadline-toggle"]');
    statusChangesInFlight.add(id);
    if (button) button.disabled = true;
    try {
      if (supabase && session) {
        const { error } = await supabase.from("tasks").update({ status: nextStatus }).eq("id", id);
        if (error) throw error;
      }
      if (completing) await animateCompletionCard(card);
      deadline.status = nextStatus;
      deadline.completed_at = completing ? new Date().toISOString() : null;
      if (!supabase || !session) saveLocalTasks();
      render();
      showToast(completing ? t.completeSuccess : t.reopenSuccess);
      if (completing && supabase && session) await refreshRewardSummary({ celebrate: true, previous: previousRewards });
      if (completing) {
        const gained = previousRewards && rewardSummary
          ? Math.max(0, Number(rewardSummary.total_xp) - Number(previousRewards.total_xp))
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
    if (!item || !window.confirm(t.deleteConfirm)) return;
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

  function showInfo(message) { showToast(message); }

  async function handleAuthSubmit(event) {
    event.preventDefault();
    if (!supabase) {
      showToast("Set SUPABASE_URL and SUPABASE_ANON_KEY in supabase-config.js to enable sign-in.");
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
    const result = authMode === "signup"
      ? await supabase.auth.signUp({ email, password, options: { data: { full_name: name } } })
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
    localStorage.setItem(authPromptStorageKey, "seen");
    document.getElementById("auth-modal").hidden = true;
    updateUserUi();
    await verifyAdminAccess();
    await loadLanguagePreference();
    await loadRemoteTasks();
    await loadAccountWorkspace();
    await loadRemoteNotifications();
    await loadFocusData(true);
    await refreshRewardSummary();
    showToast(authMode === "signup" ? "Your account is ready." : "Welcome back.");
  }

  async function restoreSession() {
    if (!supabase) {
      session = null;
      updateUserUi();
      if (!localStorage.getItem(authPromptStorageKey)) {
        document.getElementById("auth-modal").hidden = false;
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
        document.getElementById("auth-modal").hidden = false;
        localStorage.setItem(authPromptStorageKey, "seen");
      }
      if (currentPage === "admin") await verifyAdminAccess();
      return;
    }
    session = data.session;
    if (session) localStorage.setItem(authPromptStorageKey, "seen");
    else if (!localStorage.getItem(authPromptStorageKey)) {
      document.getElementById("auth-modal").hidden = false;
      localStorage.setItem(authPromptStorageKey, "seen");
    }
    updateUserUi();
    await verifyAdminAccess();
    if (session) {
      await loadLanguagePreference();
      tasks = [];
      subjects = [];
      clearAccountWorkspace();
      render();
      await loadRemoteTasks();
      await loadAccountWorkspace();
      await loadRemoteNotifications();
      await loadFocusData(true);
      await refreshRewardSummary();
    }
    supabase.auth.onAuthStateChange((_event, nextSession) => {
      session = nextSession;
      adminAuthorization = { status: "unknown", userId: session?.user?.id || null };
      updateUserUi();
      if (currentPage === "admin") render();
      if (session) {
        tasks = [];
        subjects = [];
        clearAccountWorkspace();
        window.setTimeout(async () => {
          await verifyAdminAccess();
          await loadLanguagePreference();
          render();
          await loadRemoteTasks();
          await loadAccountWorkspace();
          await loadRemoteNotifications();
          await loadFocusData(true);
          await refreshRewardSummary();
        }, 0);
      }
      else {
        adminAuthorization = { status: "denied", userId: null };
        if (currentPage === "admin") denyAdminRoute(false);
        tasks = readLocalTasks();
        subjects = [
          { id: "subject-calculus", name: "Calculus II", color: "#06D6A0", credits: 4, progress: 72 },
          { id: "subject-algorithms", name: "Algorithms", color: "#75CDB1", credits: 3, progress: 81 },
          { id: "subject-biology", name: "Biology", color: "#9ECDAF", credits: 3, progress: 64 },
          { id: "subject-history", name: "History", color: "#C1D79D", credits: 2, progress: 55 },
        ];
        resetAccountWorkspacePreview();
        document.getElementById("feature-modal")?.setAttribute("hidden", "");
        userNotifications = [];
        dailyReminderPreference = { enabled: false, local_time: "09:00", timezone: "UTC" };
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
    document.querySelectorAll(".auth-tab").forEach((button) => button.classList.toggle("selected", button.dataset.authMode === mode));
    document.querySelector(".signup-only").hidden = mode !== "signup";
    document.getElementById("auth-submit").innerHTML = `${mode === "signup" ? "Create account" : "Sign in"} <span>→</span>`;
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
    for (const key of ["focusMinutes", "shortBreakMinutes", "longBreakMinutes"]) {
      const number = Number(source[key]);
      if (Number.isInteger(number) && number >= 1 && number <= 180) normalized[key] = number;
    }
    const interval = Number(source.longBreakInterval);
    if (Number.isInteger(interval) && interval >= 2 && interval <= 12) normalized.longBreakInterval = interval;
    for (const key of ["autoStartFocus", "autoStartBreaks", "soundEnabled", "browserNotifications", "showSeconds"]) {
      if (typeof source[key] === "boolean") normalized[key] = source[key];
    }
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
      if (saved && typeof saved !== "object") throw new Error("Stored focus data is invalid.");
    } catch (error) {
      console.error("Could not read saved focus data.", error);
      focusDataError = error.message;
      showToast(focusText[appLanguage].dataError);
      saved = null;
    }
    focusSettings = normalizeFocusSettings(saved?.settings);
    const savedSession = saved?.timer;
    if (savedSession && ["focus", "short_break", "long_break"].includes(savedSession.type)) {
      focusSession = {
        ...focusSession,
        ...savedSession,
        cycle: Number.isInteger(savedSession.cycle) && savedSession.cycle > 0 ? savedSession.cycle : 1,
        remainingMs: Number.isFinite(Number(savedSession.remainingMs)) ? Math.max(0, Number(savedSession.remainingMs)) : getFocusDurationMs(savedSession.type),
      };
    } else {
      focusSession = createFocusSession("focus", 1);
    }
    focusRecords = identity === "guest" && Array.isArray(saved?.records) ? saved.records : [];
    pendingFocusRecords = Array.isArray(saved?.pendingRecords) ? saved.pendingRecords : [];
    if (!session) {
      reconcileFocusTimer();
      if (currentPage === "focus") render();
      syncFocusTicker();
      return Promise.resolve();
    }

    return (async () => {
      const { data: settingsRow, error: settingsError } = await supabase.from("user_settings")
        .select("focus_settings").maybeSingle();
      if (settingsError) {
        focusDataError = settingsError.message;
        console.error("Could not load focus settings.", settingsError);
        showToast(`${focusText[appLanguage].settingsError} ${settingsError.message}`);
      } else if (settingsRow?.focus_settings) {
        focusSettings = normalizeFocusSettings(settingsRow.focus_settings);
      }
      const { data, error } = await supabase.from("study_sessions")
        .select("id,idempotency_key,session_type,started_at,ended_at,duration_seconds,completed,subject_id,task_id")
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
        for (const record of [...pendingFocusRecords]) await persistFocusRecord(record);
      }
      updateActivityFromFocusRecords();
      if (currentPage === "focus") render();
      else if (currentPage === "dashboard" || currentPage === "analytics") render();
      syncFocusTicker();
    })();
  }

  function createFocusSession(type, cycle, context = focusSession) {
    return {
      id: focusId(),
      type,
      cycle,
      status: "idle",
      remainingMs: focusDurationFor(type) * 60000,
      endAt: null,
      runStartedAt: null,
      elapsedBeforeRunMs: 0,
      startedAt: null,
      remoteStarted: false,
      subjectId: context?.subjectId || "",
      taskId: context?.taskId || "",
      pendingRecord: null,
    };
  }

  function persistFocusState() {
    try {
      const value = {
        settings: focusSettings,
        timer: focusSession,
        ...(session ? { pendingRecords: pendingFocusRecords } : { records: focusRecords }),
      };
      localStorage.setItem(focusStorageKey(), JSON.stringify(value));
    } catch (error) {
      console.error("Could not persist focus state.", error);
      showToast(`${focusText[appLanguage].settingsError} ${error.message}`);
    }
  }

  function reconcileFocusTimer() {
    if (focusSession.status === "running" && focusSession.endAt && Date.now() >= focusSession.endAt) {
      void finishFocusTimer();
    } else {
      persistFocusState();
    }
  }

  function syncFocusTicker() {
    const shouldTick = currentPage === "focus" && focusSession.status === "running";
    if (!shouldTick) {
      if (focusTicker) window.clearInterval(focusTicker);
      focusTicker = null;
      return;
    }
    if (focusTicker) return;
    focusTicker = window.setInterval(() => {
      if (focusSession.status !== "running") {
        syncFocusTicker();
        return;
      }
      if (getFocusRemainingMs() <= 0) {
        void finishFocusTimer();
        return;
      }
      updateTimerUi();
    }, 200);
  }

  function updateTimerUi() {
    const clock = document.getElementById("flip-clock");
    if (!clock) return;
    const remaining = getFocusRemainingMs();
    const seconds = Math.max(0, Math.ceil(remaining / 1000));
    const minutes = String(Math.floor(seconds / 60)).padStart(2, "0");
    const secondText = String(seconds % 60).padStart(2, "0");
    const digits = [...minutes, ...(focusSettings.showSeconds ? [...secondText] : [])];
    clock.setAttribute("aria-label", formatTimer(seconds));
    clock.querySelectorAll(".flip-digit").forEach((element, index) => {
      const next = digits[index];
      if (next === undefined || element.dataset.digit === next) return;
      element.dataset.digit = next;
      element.querySelector(".flip-upper").textContent = next;
      element.querySelector(".flip-lower").textContent = next;
      element.classList.remove("flipping");
      void element.offsetWidth;
      element.classList.add("flipping");
      window.setTimeout(() => element.classList.remove("flipping"), 320);
    });
    const duration = getFocusDurationMs();
    const progress = Math.min(100, Math.max(0, ((duration - remaining) / duration) * 100));
    const fill = document.getElementById("focus-progress-fill");
    if (fill) fill.style.width = `${progress}%`;
    const bar = document.querySelector(".focus-progress");
    if (bar) bar.setAttribute("aria-valuenow", String(Math.round(progress)));
    const button = document.getElementById("timer-toggle");
    if (button) button.textContent = focusSession.status === "running"
      ? focusText[appLanguage].pause
      : focusSession.status === "paused" ? focusText[appLanguage].resume : focusText[appLanguage].start;
    const message = document.getElementById("focus-session-message");
    if (message) message.textContent = focusSession.type === "focus"
      ? focusSession.status === "running" ? focusText[appLanguage].stayFocused : focusSession.status === "paused" ? focusText[appLanguage].paused : focusText[appLanguage].focusHint
      : focusText[appLanguage].breakHint;
  }

  async function startFocusTimer() {
    if (focusSession.status === "running") return;
    const now = Date.now();
    if (supabase && session) {
      const method = focusSession.remoteStarted ? "resume_focus_session" : "start_focus_session";
      const args = focusSession.remoteStarted
        ? { p_session_key: focusSession.id }
        : {
          p_session_key: focusSession.id,
          p_target_seconds: Math.round(getFocusDurationMs(focusSession.type) / 1000),
          p_session_type: focusSession.type,
          p_subject_id: focusSession.subjectId || null,
          p_task_id: focusSession.taskId || null,
        };
      const { data, error } = await supabase.rpc(method, args);
      if (error) {
        focusDataError = error.message;
        console.error("Could not start the verified focus session.", error);
        showToast(`${focusText[appLanguage].sessionError} ${error.message}`);
        return;
      }
      if (!focusSession.startedAt) focusSession.startedAt = data.started_at;
      focusSession.remoteStarted = true;
      focusSession.elapsedBeforeRunMs = Number(data.elapsed_seconds || 0) * 1000;
      focusSession.remainingMs = Math.max(0, getFocusDurationMs(focusSession.type) - focusSession.elapsedBeforeRunMs);
    } else if (!focusSession.startedAt) {
      focusSession.startedAt = new Date(now).toISOString();
    }
    focusSession.status = "running";
    focusSession.runStartedAt = now;
    focusSession.endAt = now + focusSession.remainingMs;
    persistFocusState();
    updateTimerUi();
    syncFocusTicker();
  }

  async function pauseFocusTimer() {
    if (focusSession.status !== "running") return;
    const now = Date.now();
    let remoteElapsedMs = null;
    if (focusSession.remoteStarted && supabase && session) {
      const { data, error } = await supabase.rpc("pause_focus_session", { p_session_key: focusSession.id });
      if (error) {
        console.error("Could not pause the verified focus session.", error);
        showToast(`${focusText[appLanguage].sessionError} ${error.message}`);
        return;
      }
      remoteElapsedMs = Number(data || 0) * 1000;
    }
    focusSession.remainingMs = Math.max(0, focusSession.endAt - now);
    focusSession.elapsedBeforeRunMs = remoteElapsedMs ?? (
      focusSession.elapsedBeforeRunMs + Math.max(0, now - focusSession.runStartedAt)
    );
    if (remoteElapsedMs !== null) {
      focusSession.remainingMs = Math.max(0, getFocusDurationMs(focusSession.type) - remoteElapsedMs);
    }
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
      task_id: focusSession.taskId || null,
    };
  }

  async function persistFocusRecord(record) {
    if (!record) return;
    if (focusRecordSavesInFlight.has(record.idempotency_key)) return false;
    focusRecordSavesInFlight.add(record.idempotency_key);
    if (!session) {
      if (!focusRecords.some((item) => item.idempotency_key === record.idempotency_key)) focusRecords.unshift(record);
      persistFocusState();
      updateActivityFromFocusRecords();
      focusRecordSavesInFlight.delete(record.idempotency_key);
      return true;
    }
    if (!pendingFocusRecords.some((item) => item.idempotency_key === record.idempotency_key)) pendingFocusRecords.push(record);
    focusSaving = true;
    persistFocusState();
    const rpc = record.completed ? "finish_focus_session" : "cancel_focus_session";
    let rpcError;
    try {
      ({ error: rpcError } = await supabase.rpc(rpc, { p_session_key: record.idempotency_key }));
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
    let data;
    let historyError;
    try {
      ({ data, error: historyError } = await supabase.from("study_sessions")
        .select("id,idempotency_key,session_type,started_at,ended_at,duration_seconds,completed,subject_id,task_id")
        .eq("idempotency_key", record.idempotency_key).maybeSingle());
    } catch (error) {
      historyError = error;
    }
    if (historyError || !data) {
      focusDataError = historyError?.message || "The verified focus record could not be read back.";
      focusSaving = false;
      focusRecordSavesInFlight.delete(record.idempotency_key);
      console.error("Could not refresh the verified focus record.", historyError);
      showToast(`${focusText[appLanguage].dataError} ${focusDataError}`);
      return false;
    }
    pendingFocusRecords = pendingFocusRecords.filter((item) => item.idempotency_key !== record.idempotency_key);
    focusRecords = focusRecords.filter((item) => item.idempotency_key !== record.idempotency_key);
    focusRecords.unshift(data);
    focusSaving = false;
    focusDataError = "";
    focusRecordSavesInFlight.delete(record.idempotency_key);
    updateActivityFromFocusRecords();
    persistFocusState();
    if (currentPage === "focus") render();
    if (record.completed && record.session_type === "focus") await refreshRewardSummary({ celebrate: true });
    return true;
  }

  function playFocusCompletion() {
    if (focusSettings.soundEnabled) {
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          const context = new AudioContext();
          const oscillator = context.createOscillator();
          const gain = context.createGain();
          oscillator.type = "sine";
          oscillator.frequency.value = 660;
          gain.gain.setValueAtTime(0.0001, context.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.35);
          oscillator.connect(gain);
          gain.connect(context.destination);
          oscillator.start();
          oscillator.stop(context.currentTime + 0.36);
          oscillator.addEventListener("ended", () => void context.close(), { once: true });
        }
      } catch (error) {
        console.error("Could not play the focus completion sound.", error);
      }
    }
    if (focusSettings.browserNotifications && "Notification" in window && Notification.permission === "granted") {
      try {
        new Notification(focusText[appLanguage].title, {
          body: focusSession.type === "focus" ? focusText[appLanguage].focusCompleted : focusText[appLanguage].breakCompleted,
          icon: "./icon.svg",
          tag: "studyflow-focus-completion",
        });
      } catch (error) {
        console.error("Could not show the focus completion notification.", error);
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
    const completedFocus = focusRecords.filter((item) => item.session_type === "focus" && item.completed).length;
    let nextType;
    let nextCycle;
    let autoStart;
    if (finishedType === "focus") {
      nextType = completedFocus % focusSettings.longBreakInterval === 0 ? "long_break" : "short_break";
      nextCycle = completedFocus % focusSettings.longBreakInterval + 1;
      autoStart = focusSettings.autoStartBreaks;
      showToast(text.focusCompleted);
      if (shouldUseFullMotion()) launchConfetti();
      const currentXp = Number(rewardSummary?.total_xp) || 0;
      const earnedXp = previousRewards ? Math.max(0, currentXp - Number(previousRewards.total_xp)) : 0;
      const duration = formatFocusDuration(record?.duration_seconds || Math.floor(getFocusDurationMs("focus") / 1000), text);
      const count = new Intl.NumberFormat(focusLocale()).format(completedFocus);
      const detail = text.focusRewardDetail.replace("{duration}", duration).replace("{count}", count);
      const fullCycle = completedFocus > 0 && completedFocus % focusSettings.longBreakInterval === 0;
      openCelebration(fullCycle ? text.cycleCompletedTitle : text.focusCompletedTitle, detail, earnedXp);
    } else {
      nextType = "focus";
      nextCycle = completedFocus % focusSettings.longBreakInterval + 1;
      autoStart = focusSettings.autoStartFocus;
      showToast(text.breakCompleted);
    }
    focusSession = createFocusSession(nextType, nextCycle, focusSession);
    persistFocusState();
    if (currentPage === "focus") render();
    if (autoStart) startFocusTimer();
  }

  async function skipFocusSession() {
    const record = focusSession.type === "focus" ? makeFocusRecord(false) : null;
    const currentType = focusSession.type;
    if (focusSession.status === "running") {
      await pauseFocusTimer();
      if (focusSession.status === "running") return;
    }
    if (record) await persistFocusRecord(record);
    const count = focusRecords.filter((item) => item.session_type === "focus" && item.completed).length;
    const nextType = currentType === "focus" ? "short_break" : "focus";
    focusSession = createFocusSession(nextType, count % focusSettings.longBreakInterval + 1, focusSession);
    persistFocusState();
    render();
    syncFocusTicker();
  }

  async function resetFocusSession() {
    const record = makeFocusRecord(false);
    if (record) await persistFocusRecord(record);
    focusSession = createFocusSession(focusSession.type, focusSession.cycle, focusSession);
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
    });
    const integerFields = ["focusMinutes", "shortBreakMinutes", "longBreakMinutes", "longBreakInterval"];
    if (integerFields.some((key) => !Number.isInteger(Number(data.get(key))))
      || settings.focusMinutes !== Number(data.get("focusMinutes"))
      || settings.shortBreakMinutes !== Number(data.get("shortBreakMinutes"))
      || settings.longBreakMinutes !== Number(data.get("longBreakMinutes"))
      || settings.longBreakInterval !== Number(data.get("longBreakInterval"))) {
      throw new Error(focusText[appLanguage].invalidSettings);
    }
    if (settings.browserNotifications) {
      if (!("Notification" in window)) throw new Error(focusText[appLanguage].notificationsUnsupported);
      const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
      if (permission !== "granted") {
        settings.browserNotifications = false;
        throw new Error(permission === "denied" ? focusText[appLanguage].notificationsDenied : focusText[appLanguage].notificationsUnsupported);
      }
    }
    if (session) {
      const { data: existing, error: readError } = await supabase.from("user_settings").select("user_id").maybeSingle();
      if (readError) throw readError;
      const query = existing
        ? supabase.from("user_settings").update({ focus_settings: settings }).eq("user_id", session.user.id)
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
    const task = tasks.find((item) => String(item.id) === String(focusSession.taskId));
    if (task?.subject_id) focusSession.subjectId = task.subject_id;
    persistFocusState();
    render();
  }

  function attachFocusListeners() {
    document.getElementById("focus-settings-form")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const error = document.getElementById("focus-settings-error");
      const button = form.querySelector('button[type="submit"]');
      error.textContent = "";
      button.disabled = true;
      try {
        await saveFocusSettings(form);
      } catch (reason) {
        error.textContent = reason?.message || focusText[appLanguage].settingsError;
        console.error("Focus settings save failed.", reason);
      } finally {
        const currentButton = document.querySelector('#focus-settings-form button[type="submit"]');
        if (currentButton) currentButton.disabled = false;
      }
    });
    document.getElementById("focus-subject")?.addEventListener("change", (event) => {
      focusSession.subjectId = event.target.value;
      focusSession.taskId = "";
      persistFocusState();
      render();
    });
    document.getElementById("focus-task")?.addEventListener("change", (event) => {
      focusSession.taskId = event.target.value;
      updateFocusContext();
    });
  }

  document.addEventListener("submit", async (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || form.id !== "daily-reminder-form") return;
    event.preventDefault();
    const submit = form.querySelector('[type="submit"]');
    const errorEl = form.querySelector("[data-reminder-error]");
    submit.disabled = true;
    errorEl.textContent = "";
    try {
      await saveDailyReminder(form);
    } catch (error) {
      console.error("Could not save daily reminder settings.", error);
      errorEl.textContent = `${translateUiText("Could not save your reminder.")} ${error.message || ""}`.trim();
    } finally {
      submit.disabled = false;
    }
  });

  document.addEventListener("click", async (event) => {
    const target = event.target.closest("[data-page], [data-navigate], [data-action], [data-motion-level], [data-close-modal], [data-deadline-filter], [data-deadline-view], [data-language], #open-auth, #top-profile, #mobile-menu, #timer-toggle, #timer-reset, #timer-skip, [data-auth-mode], #sign-out");
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
      openTaskModal();
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
    } else if (target.matches('[data-action="note-add"]')) {
      openFeatureForm("note");
    } else if (target.matches('[data-action="note-edit"]')) {
      openFeatureForm("note", target.dataset.id);
    } else if (target.matches('[data-action="note-delete"]')) {
      await deleteFeatureRecord("note", target.dataset.id);
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
    } else if (target.matches('[data-action="focus-settings"]')) {
      focusSettingsOpen = !focusSettingsOpen;
      render();
      if (focusSettingsOpen) document.getElementById("focus-settings-title")?.focus();
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
          if (error) error.textContent = reason?.message || focusText[appLanguage].settingsError;
          console.error("Could not restore focus defaults.", reason);
        }
      }
    } else if (target.matches('[data-action="focus-distraction"]')) {
      distractionFree = !distractionFree;
      render();
    } else if (target.id === "timer-toggle") {
      if (focusSession.status === "running") pauseFocusTimer();
      else void startFocusTimer();
    } else if (target.id === "timer-reset") {
      void resetFocusSession();
    } else if (target.id === "timer-skip") {
      await skipFocusSession();
    } else if (target.matches('[data-action="calendar-select"]')) {
      selectedDeadlineDate = target.dataset.date;
      render();
    } else if (target.matches('[data-action="calendar-prev"]')) {
      deadlineMonth = new Date(deadlineMonth.getFullYear(), deadlineMonth.getMonth() - 1, 1);
      render();
    } else if (target.matches('[data-action="calendar-next"]')) {
      deadlineMonth = new Date(deadlineMonth.getFullYear(), deadlineMonth.getMonth() + 1, 1);
      render();
    } else if (target.matches('[data-action="calendar-today"]')) {
      deadlineMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      selectedDeadlineDate = dateKey(new Date());
      render();
    } else if (target.matches('[data-action="toggle-task"]')) {
      await updateTaskStatus(target.dataset.id);
    } else if (target.matches('[data-action="delete-task"]')) {
      await deleteTask(target.dataset.id);
    } else if (target.matches('[data-action="theme-toggle"]')) {
      const light = document.documentElement.dataset.theme !== "light";
      document.documentElement.dataset.theme = light ? "light" : "dark";
      target.classList.toggle("on", !light);
      target.setAttribute("aria-pressed", String(light));
      localStorage.setItem("studyflow.theme", light ? "light" : "dark");
      if (shouldAnimate()) target.animate?.([{ transform: "scale(.92)" }, { transform: "scale(1)" }], { duration: 180, easing: "ease-out" });
      showToast("Settings saved.");
    } else if (target.matches("[data-motion-level]")) {
      motionLevel = target.dataset.motionLevel;
      animationsEnabled = motionLevel !== "off";
      localStorage.setItem("studyflow.motion", motionLevel);
      localStorage.setItem("studyflow.animations", animationsEnabled ? "on" : "off");
      document.documentElement.dataset.motion = motionLevel;
      if (!animationsEnabled) document.getAnimations().forEach((animation) => animation.cancel());
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
      target.setAttribute("aria-pressed", String(target.classList.contains("on")));
    } else if (target.matches("[data-action]")) {
      const messages = {
        "read-hint": "Notification read state will sync after connecting your account.",
      };
      if (messages[target.dataset.action]) showInfo(messages[target.dataset.action]);
    } else if (target.matches("[data-close-modal]")) {
      const backdrop = target.closest(".modal-backdrop");
      backdrop.hidden = true;
      if (backdrop.id === "auth-modal") localStorage.setItem(authPromptStorageKey, "seen");
    } else if (target.id === "open-auth" || target.id === "top-profile") {
      document.getElementById("auth-modal").hidden = false;
    } else if (target.id === "mobile-menu") {
      document.getElementById("sidebar").classList.toggle("open");
    } else if (target.matches("[data-auth-mode]")) {
      setAuthMode(target.dataset.authMode);
    } else if (target.id === "sign-out" && supabase) {
      try {
        await removeCurrentPushSubscription(session?.user?.id);
      } catch (error) {
        console.error("Could not fully remove the current push subscription while signing out.", error);
        showToast(`Push subscription cleanup failed: ${error.message}`);
      }
      const { error } = await supabase.auth.signOut();
      if (error) {
        showToast(`Could not sign out: ${error.message}`);
        console.error("Supabase sign out failed.", error);
        return;
      }
      session = null;
      adminAuthorization = { status: "denied", userId: null };
      adminUsersRequest += 1;
      adminUsers = [];
      adminUsersTotal = 0;
      resetAccountWorkspacePreview();
      subjects = [
        { id: "subject-calculus", name: "Calculus II", color: "#06D6A0", credits: 4, progress: 72 },
        { id: "subject-algorithms", name: "Algorithms", color: "#75CDB1", credits: 3, progress: 81 },
        { id: "subject-biology", name: "Biology", color: "#9ECDAF", credits: 3, progress: 64 },
        { id: "subject-history", name: "History", color: "#C1D79D", credits: 2, progress: 55 },
      ];
      userNotifications = [];
      dailyReminderPreference = { enabled: false, local_time: "09:00", timezone: "UTC" };
      document.getElementById("auth-modal").hidden = true;
      updateUserUi();
      if (currentPage === "admin") {
        currentPage = "dashboard";
        window.location.hash = "dashboard";
        render();
      }
      showToast("Signed out.");
    }
  });

  document.getElementById("task-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('button[type="submit"]');
    const error = document.getElementById("task-error");
    button.disabled = true;
    error.textContent = "";
    try {
      await createTask(new FormData(event.currentTarget));
      event.currentTarget.reset();
    } catch (reason) {
      error.textContent = reason?.message || "Could not save this task.";
      translateInterface();
      console.error("Task save failed.", reason);
    } finally {
      button.disabled = false;
    }
  });

  document.querySelectorAll("#task-form [name='repeat_type'], #deadline-form [name='repeat_type']").forEach((select) => {
    select.addEventListener("change", () => updateRepeatControls(select.form));
  });

  document.getElementById("deadline-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = document.getElementById("deadline-submit");
    const error = document.getElementById("deadline-error");
    const t = deadlineText[appLanguage];
    button.disabled = true;
    button.textContent = t.saving;
    error.textContent = "";
    try {
      await saveDeadline(new FormData(event.currentTarget));
      event.currentTarget.reset();
    } catch (reason) {
      error.textContent = `${t.saveError} ${reason?.message || ""}`.trim();
      translateInterface();
      console.error("Deadline save failed.", reason);
    } finally {
      button.disabled = false;
      button.innerHTML = `${deadlineText[appLanguage].save} <span>→</span>`;
    }
  });

  document.getElementById("auth-form").addEventListener("submit", handleAuthSubmit);
  window.addEventListener("hashchange", () => {
    const page = window.location.hash.slice(1) || "dashboard";
    const nextPage = pageRenderers[page] ? page : "dashboard";
    if (nextPage === currentPage) return;
    currentPage = nextPage;
    if (currentPage === "admin") adminAuthorization = { status: "checking", userId: session?.user?.id || null };
    render();
    if (currentPage === "admin") void verifyAdminAccess();
    if (currentPage === "focus") void loadFocusData();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    if (focusSession.status === "running" && getFocusRemainingMs() <= 0) void finishFocusTimer();
    else updateTimerUi();
    syncFocusTicker();
  });
  window.addEventListener("pageshow", () => {
    reconcileFocusTimer();
    syncFocusTicker();
  });
  window.addEventListener("pagehide", () => {
    persistFocusState();
    if (focusTicker) window.clearInterval(focusTicker);
    focusTicker = null;
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

  const storedTheme = localStorage.getItem("studyflow.theme");
  if (storedTheme === "light") document.documentElement.dataset.theme = "light";
  document.getElementById("footer-year").textContent = new Date().getFullYear();
  updateOfflineStatus();
  document.documentElement.dataset.motion = motionLevel;
  currentPage = pageRenderers[window.location.hash.slice(1)] ? window.location.hash.slice(1) : "dashboard";
  render();
  updateUserUi();
  void loadFocusData();
  restoreSession();
  document.getElementById("pwa-install").addEventListener("click", () => void handlePwaInstall());
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    updatePwaInstallButton();
  });
  window.addEventListener("appinstalled", () => {
    pwaInstalled = true;
    deferredInstallPrompt = null;
    updatePwaInstallButton();
    showToast("App installed.");
  });
  window.matchMedia?.("(display-mode: standalone)").addEventListener?.("change", updatePwaInstallButton);
  if ("serviceWorker" in navigator && window.location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("./service-worker.js").then((registration) => {
      void registration.update();
      if (registration.waiting) showPwaUpdateNotice(registration.waiting);
      registration.addEventListener("updatefound", () => {
        const installingWorker = registration.installing;
        installingWorker?.addEventListener("statechange", () => {
          if (installingWorker.state === "installed" && navigator.serviceWorker.controller) {
            showPwaUpdateNotice(registration.waiting || installingWorker);
          }
        });
      });
    }).catch((error) => {
      console.error("Could not register the Study Zone service worker.", error);
    });
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (pwaUpdateReload) window.location.reload();
    });
  }
})();
