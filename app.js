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
  const activity = [
    { day: "Mon", hours: 2.8 }, { day: "Tue", hours: 3.4 }, { day: "Wed", hours: 2.5 },
    { day: "Thu", hours: 4.1 }, { day: "Fri", hours: 3.7 }, { day: "Sat", hours: 5.2 }, { day: "Sun", hours: 2.1 },
  ];
  const goals = [
    { title: "Finish revision pack", progress: 78, due: "5 days", detail: "Review key topics before the assessment" },
    { title: "Keep weekly study rhythm", progress: 86, due: "2 days", detail: "Reach 12 focused hours this week" },
    { title: "Submit essay draft", progress: 64, due: "1 week", detail: "Complete the outline and first draft" },
  ];
  const schedule = [
    { day: "Monday", time: "08:00", title: "Limits and derivatives", subject: "Calculus II", length: "90 min" },
    { day: "Tuesday", time: "17:00", title: "Graphs + shortest path", subject: "Algorithms", length: "105 min" },
    { day: "Wednesday", time: "19:00", title: "Cell structure review", subject: "Biology", length: "75 min" },
    { day: "Thursday", time: "15:30", title: "Essay drafting sprint", subject: "History", length: "90 min" },
  ];
  const achievementCatalog = [
    { code: "first-task", name: "First Task", description: "Complete your first task.", symbol: "✓" },
    { code: "focus-starter", name: "Focus Starter", description: "Complete your first verified focus session.", symbol: "◷" },
    { code: "focus-master", name: "Focus Master", description: "Complete 10 verified focus sessions.", symbol: "✦" },
    { code: "deadline-hero", name: "Deadline Hero", description: "Complete 10 tasks with deadlines.", symbol: "◇" },
    { code: "study-streak", name: "Study Streak", description: "Build a 7-day activity streak.", symbol: "↗" },
    { code: "consistency-champion", name: "Consistency Champion", description: "Build a 30-day activity streak.", symbol: "✧" },
  ];
  const examResults = [
    { subject: "Algorithms", score: 88 }, { subject: "Calculus II", score: 92 },
    { subject: "Biology", score: 84 }, { subject: "History", score: 78 },
  ];
  const sampleFiles = [
    { name: "calculus-derivatives.pdf", type: "PDF", subject: "Calculus II" },
    { name: "algo-graphs-notes.md", type: "Notes", subject: "Algorithms" },
    { name: "biology-diagrams.png", type: "Image", subject: "Biology" },
  ];
  const sampleNotes = [
    { title: "Core theorem summary", subject: "Algorithms", updated: "2 hours ago" },
    { title: "Cell structure recall", subject: "Biology", updated: "Today" },
    { title: "Essay thesis points", subject: "History", updated: "Yesterday" },
  ];
  const storageKey = "studyflow.tasks.v1";
  let tasks = readLocalTasks();
  let currentPage = "dashboard";
  let authMode = "signin";
  let deferredInstallPrompt = null;
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
      notificationReady: "Browser notifications enabled while StudyFlow is open.",
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
      notificationReady: "إشعارات المتصفح مفعلة أثناء فتح StudyFlow.",
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
  let adminAuthorization = { status: "unknown", userId: null };
  let adminVerificationRequest = 0;
  let userNotifications = [];
  let rewardSummary = null;
  let earnedAchievements = [];
  const rewardCounterValues = new Map();
  let animationsEnabled = localStorage.getItem("studyflow.animations") !== "off";
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
    "STUDY STREAK": "أيام الدراسة المتتالية",
    "12 days": "١٢ يومًا",
    "Student account": "حساب طالب",
    "Demo workspace": "مساحة تجريبية",
    "Supabase ready": "Supabase جاهز",
    "Supabase connected": "تم الاتصال بـSupabase",
    "Open navigation": "فتح قائمة التنقل",
    "Open profile": "فتح الملف الشخصي",
    "StudyFlow dashboard": "لوحة تحكم StudyFlow",
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
    "Estimated minutes": "المدة المقدرة بالدقائق",
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
    "Welcome to StudyFlow": "مرحبًا بك في StudyFlow",
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
    "Use subtle animations and completion celebrations": "استخدم حركات واحتفالات بسيطة عند الإنجاز",
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
    "Tune StudyFlow to the way you like to work.": "اضبط StudyFlow بما يناسب أسلوب عملك.",
    Appearance: "المظهر",
    "Dark theme": "السمة الداكنة",
    "Designed for focus, day or night": "مصممة للتركيز ليلًا ونهارًا",
    "Emerald accents": "لمسات الزمرد",
    "Official StudyFlow color palette": "لوحة ألوان StudyFlow الرسمية",
    Language: "اللغة",
    "Display language": "لغة العرض",
    "Deadlines appear in the selected language.": "تُعرض المواعيد باللغة المحددة.",
    Reminders: "التذكيرات",
    "Task reminders": "تذكيرات المهام",
    "Upcoming deadlines": "المواعيد القادمة",
    "Study nudges": "تذكيرات الدراسة",
    "Gentle focus reminders": "تذكيرات لطيفة للتركيز",
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
    "Study-block editing is ready to connect to the schedules table.": "تعديل جلسات الدراسة جاهز للربط بجدول المواعيد.",
    "Subject creation will be connected to the subjects table.": "ستُربط إضافة المواد بجدول المواد الدراسية.",
    "Upload files after configuring the private StudyFlow storage bucket.": "ارفع الملفات بعد إعداد مساحة التخزين الخاصة في StudyFlow.",
    "Note editor will be connected to the private notes table.": "سيُربط محرر الملاحظات بجدول الملاحظات الخاص.",
    "Goal creation will be connected to the goals table.": "سيُربط إنشاء الأهداف بجدول الأهداف.",
    "Exam tracking will be connected to your exams table.": "ستُربط متابعة الاختبارات بجدول اختباراتك.",
    "Notification read state will sync after connecting your account.": "ستُزامن حالة قراءة الإشعارات بعد ربط حسابك.",
    "Profile editing is ready to connect to your Supabase profile.": "تعديل الملف الشخصي جاهز للربط بملفك في Supabase.",
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
    document.title = appLanguage === "ar" ? "StudyFlow — حياتك الدراسية، منظمة" : "StudyFlow — Your Study Life, Organized";
    const description = document.querySelector('meta[name="description"]');
    if (description) description.content = appLanguage === "ar" ? "StudyFlow — حياتك الدراسية، منظمة." : "StudyFlow — Your Study Life, Organized.";
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
    if (button) button.hidden = isPwaInstalled();
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
    if (animationsEnabled) toast.animate(
      [{ opacity: 0, transform: "translateY(8px) scale(.98)" }, { opacity: 1, transform: "translateY(0) scale(1)" }],
      { duration: 260, easing: "cubic-bezier(.2,.7,.2,1)" },
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
    if (animationsEnabled) {
      modal.querySelector(".celebration-modal").animate(
        [{ opacity: 0, transform: "translateY(14px) scale(.96)" }, { opacity: 1, transform: "translateY(0) scale(1)" }],
        { duration: 320, easing: "cubic-bezier(.2,.7,.2,1)" },
      );
      launchConfetti();
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
      if (!Number.isFinite(target) || previous === undefined || previous === target || !animationsEnabled || reduceMotion) return;
      const start = performance.now();
      const duration = 420;
      const update = (now) => {
        const progress = Math.min(1, (now - start) / duration);
        const eased = 1 - (1 - progress) ** 3;
        const value = Math.round(previous + (target - previous) * eased);
        counter.textContent = new Intl.NumberFormat(appLanguage === "ar" ? "ar-EG" : "en").format(value);
        if (progress < 1) requestAnimationFrame(update);
      };
      requestAnimationFrame(update);
    });
  }

  function launchConfetti() {
    if (!animationsEnabled || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
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
    if (!card || !animationsEnabled || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
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
    if (animate && animationsEnabled && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
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

  function lineChart() {
    const width = 620;
    const height = 190;
    const left = 25;
    const right = 12;
    const top = 14;
    const bottom = 25;
    const max = 6;
    const plotWidth = width - left - right;
    const plotHeight = height - top - bottom;
    const localizedActivity = appLanguage === "ar"
      ? ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => activity.find((item) => item.day === day))
      : activity;
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
    const ariaLabel = appLanguage === "ar" ? "ساعات الدراسة خلال الأيام السبعة الماضية" : "Sample study hours over the last seven days";
    return `<div class="chart-area"><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${ariaLabel}"><defs><linearGradient id="chart-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#06D6A0" stop-opacity=".21"/><stop offset="100%" stop-color="#06D6A0" stop-opacity="0"/></linearGradient></defs>${yLines}<path class="chart-area-fill" d="${areaPath}"/><path class="chart-line" d="${line}"/>${dots}${labels}</svg></div>`;
  }

  function dashboardPage() {
    const openTasks = tasks.filter((task) => task.status !== "completed").length;
    const completeTasks = tasks.length - openTasks;
    const weekHours = activity.reduce((sum, item) => sum + item.hours, 0).toFixed(1);
    const firstName = (session?.user?.user_metadata?.full_name || "Alex").trim().split(/\s+/)[0];
    const dayLabelText = new Intl.DateTimeFormat(appLanguage === "ar" ? "ar-EG" : "en", { weekday: "long", month: "long", day: "numeric" }).format(new Date());
    const dayLabel = appLanguage === "ar" ? dayLabelText : dayLabelText.toUpperCase();
    const formattedNumber = (value) => new Intl.NumberFormat(appLanguage === "ar" ? "ar-EG" : "en").format(value);
    const statGrid = `<div class="grid stats-grid">${statCard("STUDY THIS WEEK", `${weekHours}<small>h</small>`, " across the last 7 days", "◷", "+ 8% ")}${statCard("TASKS COMPLETED", session ? `${formattedNumber(completeTasks)}/${formattedNumber(tasks.length)}` : "—", " tasks finished", "✓", session ? `${formattedNumber(openTasks)} left · ` : "")}${statCard("CURRENT LEVEL", rewardSummary ? rewardCounterMarkup("level", rewardSummary.level) : "—", rewardSummary ? ` · ${rewardCounterMarkup("xp", rewardSummary.total_xp)} XP` : " Connect your account for real rewards", "✧")}${statCard("STUDY STREAK", rewardSummary ? `${rewardCounterMarkup("streak", rewardSummary.current_streak)} days` : "—", rewardSummary ? ` · best ${formattedNumber(Number(rewardSummary.best_streak))} days` : " Based on verified activity", "↗")}</div>`;
    const subjectRows = subjects.map((subject) => `<div class="subject-row"><span class="subject-row-name">${escapeHtml(subject.name)}</span><div class="progress-track"><div class="progress-fill" style="width:${subject.progress ?? 0}%"></div></div><span class="subject-row-value">${subject.progress === null ? "—" : `${subject.progress}%`}</span></div>`).join("") || `<div class="empty-state">Add a subject to start tracking course progress.</div>`;
    const scheduleRows = schedule.slice(0, 3).map((block) => `<div class="schedule-item"><time class="schedule-time">${block.day.slice(0, 3)}<br>${block.time}</time><span class="schedule-bar"></span><div><div class="schedule-name">${block.title}</div><div class="schedule-subject">${block.subject}</div></div><span class="schedule-duration">${block.length}</span></div>`).join("");
    const badges = earnedAchievements.slice(0, 3).map((item) => {
      const achievement = Array.isArray(item.achievements) ? item.achievements[0] : item.achievements;
      const catalog = achievementCatalog.find((entry) => entry.code === achievement?.code);
      if (!achievement) return "";
      return `<div class="achievement-row"><span class="achievement-icon">${catalog?.symbol || "✦"}</span><div><strong>${translateUiText(achievement.name || catalog?.name || "Achievement unlocked!")}</strong><small>${translateUiText(achievement.description || catalog?.description || "")}</small></div></div>`;
    }).join("") || `<div class="empty-state">${session ? "No achievements unlocked yet." : "Sign in to earn secure rewards."}</div>`;
    const goalRows = goals.map((goal) => `<div><div class="goal-topline"><strong>${goal.title}</strong><span>${goal.due}</span></div><div class="progress-track"><div class="progress-fill" style="width:${goal.progress}%"></div></div><div class="goal-bottomline"><span>${goal.detail}</span><span>${goal.progress}%</span></div></div>`).join("");
    return `${pageHeading(dayLabel, `Good evening, ${escapeHtml(firstName)}.`, "A clear plan makes room for your best work.", `<button class="button button-primary" data-action="new-task"><span class="button-icon">＋</span> Add a task</button>`)}
      ${statGrid}
      <div class="grid dashboard-grid">
        <section class="panel">${panelHeading("Study rhythm", "Sample hours from the past week", `<button class="panel-link" data-navigate="analytics">View analytics →</button>`)}${lineChart()}</section>
        <section class="panel">${panelHeading("Subject progress", "Current mastery estimates")}<div class="subject-rows">${subjectRows}</div></section>
      </div>
      <div class="grid dashboard-grid bottom-grid">
        <section class="panel">${panelHeading("Up next", "Your planned study blocks", `<button class="panel-link" data-navigate="planner">Open planner →</button>`)}<div class="schedule-list">${scheduleRows}</div></section>
        <section class="panel">${panelHeading("Recent achievements", "Keep building your rhythm")}<div class="achievement-list">${badges}</div></section>
      </div>
      <div class="grid dashboard-grid bottom-grid">
        <section class="panel">${panelHeading("Goal progress", "Small steps add up")}<div class="goal-list">${goalRows}</div></section>
        <section class="panel">${panelHeading("Quick start")}<div class="activity-list"><div class="activity-item"><span class="activity-event"><i class="activity-bullet"></i>Pick up where you left off</span><button class="panel-link" data-navigate="focus">Focus →</button></div><div class="activity-item"><span class="activity-event"><i class="activity-bullet"></i>Review your upcoming tasks</span><button class="panel-link" data-navigate="tasks">Tasks →</button></div><div class="activity-item"><span class="activity-event"><i class="activity-bullet"></i>Explore your study materials</span><button class="panel-link" data-navigate="files">Files →</button></div></div></section>
      </div><p class="data-caption">${session ? "Rewards and task totals are from your account. Other dashboard previews are sample data." : "Connect an account to see real XP, levels, streaks, and achievements. Other dashboard previews are sample data."}</p>`;
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

  function calendarView(deadlines) {
    const t = deadlineText[appLanguage];
    const year = deadlineMonth.getFullYear();
    const month = deadlineMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const startOffset = firstDay.getDay();
    const daysCount = new Date(year, month + 1, 0).getDate();
    const previousCount = new Date(year, month, 0).getDate();
    const today = dateKey(new Date());
    const deadlineDates = new Set(deadlines.map((deadline) => dateKey(new Date(deadline.due_at))));
    const cells = Array.from({ length: 42 }, (_, index) => {
      const dayNumber = index - startOffset + 1;
      const date = dayNumber < 1
        ? new Date(year, month - 1, previousCount + dayNumber)
        : dayNumber > daysCount
          ? new Date(year, month + 1, dayNumber - daysCount)
          : new Date(year, month, dayNumber);
      const key = dateKey(date);
      const classes = ["calendar-day"];
      if (date.getMonth() !== month) classes.push("outside-month");
      if (key === today) classes.push("today");
      if (key === selectedDeadlineDate) classes.push("selected");
      if (deadlineDates.has(key)) classes.push("has-deadlines");
      return `<button class="${classes.join(" ")}" data-action="calendar-select" data-date="${key}" aria-label="${escapeHtml(new Intl.DateTimeFormat(appLanguage === "ar" ? "ar-EG" : "en", { dateStyle: "full" }).format(date))}" aria-pressed="${key === selectedDeadlineDate}">${new Intl.NumberFormat(appLanguage === "ar" ? "ar-EG" : "en").format(date.getDate())}</button>`;
    }).join("");
    const weekdayLabels = t.daysShort.map((day) => `<span class="calendar-weekday">${day}</span>`).join("");
    const monthLabel = new Intl.DateTimeFormat(appLanguage === "ar" ? "ar-EG" : "en", { month: "long", year: "numeric" }).format(deadlineMonth);
    const selected = deadlines.filter((deadline) => dateKey(new Date(deadline.due_at)) === selectedDeadlineDate);
    const selectedLabel = selectedDeadlineDate
      ? new Intl.DateTimeFormat(appLanguage === "ar" ? "ar-EG" : "en", { dateStyle: "full" }).format(new Date(`${selectedDeadlineDate}T12:00:00`))
      : t.noDate;
    return `<div class="calendar-header"><h2 class="calendar-month" id="calendar-month">${escapeHtml(monthLabel)}</h2><div class="calendar-nav"><button class="button button-secondary button-small" data-action="calendar-today">${t.currentMonth}</button><button class="icon-button" data-action="calendar-prev" aria-label="${t.previous}">‹</button><button class="icon-button" data-action="calendar-next" aria-label="${t.next}">›</button></div></div>
      <div class="calendar-grid" role="grid" aria-labelledby="calendar-month">${weekdayLabels}${cells}</div>
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
    const dayCards = days.map((day) => {
      const blocks = schedule.filter((item) => item.day === day);
      const label = dayLabels[days.indexOf(day)];
      return `<article class="planner-day ${day === todayName ? "today" : ""}"><div class="planner-day-head">${label}<small>${blocks.length ? `${blocks.length} block` : "Open day"}</small></div>${blocks.length ? blocks.map((block) => `<div class="planner-block"><time>${block.time} · ${block.length}</time><strong>${block.title}</strong><span>${block.subject}</span></div>`).join("") : `<p class="empty-day">No study blocks planned.</p>`}</article>`;
    }).join("");
    return `${pageHeading("WEEK AT A GLANCE", "Study planner", "Make a realistic plan, then give yourself room to adapt.", `<button class="button button-primary" data-action="planner-hint">＋ Plan a block</button>`)}<section class="panel">${panelHeading("This week", "Planned sessions · preview")}<div class="grid planner-grid">${dayCards}</div></section><div class="grid dashboard-grid section-spacer"><section class="panel">${panelHeading("Planned vs. actual", "Compare time blocks with completed focus sessions")}<div class="metric-large">7.5h <span class="metric-caption">planned this week</span></div><div class="progress-track"><div class="progress-fill" style="width:68%"></div></div><p class="page-subtitle">5.1 hours logged in this sample week</p></section><section class="panel">${panelHeading("Planning tip")}<p class="panel-copy">Leave a little breathing room between study blocks. A flexible plan is easier to keep than a perfect one.</p></section></div>`;
  }

  function subjectsPage() {
    return `${pageHeading("YOUR COURSES", "Subjects", "A quick view of your courses, credits, and learning progress.", `<button class="button button-primary" data-action="subject-hint">＋ Add subject</button>`)}<div class="grid subject-grid">${subjects.map((subject) => `<article class="subject-card"><div class="subject-card-top"><span class="subject-color" style="background:${subject.color}"></span><span class="task-meta">${subject.credits} credits</span></div><h3>${escapeHtml(subject.name)}</h3><p>Keep your notes, tasks, and study sessions connected to this course.</p><div class="progress-track"><div class="progress-fill" style="width:${subject.progress ?? 0}%"></div></div><div class="subject-card-foot"><span>Learning progress</span><span>${subject.progress === null ? "—" : `${subject.progress}%`}</span></div></article>`).join("") || `<div class="empty-state"><strong>No subjects yet</strong>Add your first course to start organizing your study workspace.</div>`}</div><p class="data-caption">${session ? "Subject details loaded from your account. Course progress appears as you log study sessions." : "Preview content. Subject management will be backed by your Supabase database."}</p>`;
  }

  function plannerBlocksPage() { return schedule; }

  function filesPage() {
    return `${pageHeading("STUDY MATERIALS", "Your files", "A tidy home for resources from every course.", `<button class="button button-primary" data-action="files-hint">↑ Upload file</button>`)}<div class="grid resource-grid">${sampleFiles.map((file) => `<article class="item-card"><span class="stat-icon">▤</span><h3 dir="auto">${file.name}</h3><p dir="auto">${file.subject} · ${file.type}</p></article>`).join("")}<article class="item-card"><span class="stat-icon">▧</span><h3>Course resources</h3><p>Organize future uploads by subject and folder.</p></article></div><p class="data-caption">Sample file cards are for layout preview. Storage uploads require a private Supabase bucket.</p>`;
  }

  function notesPage() {
    return `${pageHeading("YOUR KNOWLEDGE VAULT", "Notes", "Capture what matters and find it when you need it.", `<button class="button button-primary" data-action="notes-hint">＋ New note</button>`)}<div class="grid resource-grid">${sampleNotes.map((note) => `<article class="item-card"><span class="task-meta">${note.subject}</span><h3>${note.title}</h3><p>Updated ${note.updated}</p><div class="note-preview">A place for your key ideas, examples, and questions to revisit later.</div></article>`).join("")}</div><p class="data-caption">Sample content only. Notes can be stored in your private Supabase workspace.</p>`;
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
    const bars = examResults.map((item) => `<div class="score-row"><span>${item.subject}</span><div class="progress-track"><div class="progress-fill" style="width:${item.score}%"></div></div><span class="score-value">${item.score}%</span></div>`).join("");
    return `${pageHeading("YOUR STUDY PATTERNS", "Analytics", "Understand your study habits without losing sight of the bigger picture.", `<select class="filter-select" aria-label="Analytics date range"><option>Last 7 days</option><option>Last 30 days</option><option>This semester</option></select>`)}<div class="grid stats-grid">${statCard("STUDY TIME", "23.8h", " across 7 days", "◷", "+ 8% ")}${statCard("DAILY AVERAGE", "3.4h", " each day", "⌁", "On track · ")}${statCard("TASK COMPLETION", "76%", " tasks finished", "✓", "+ 6% ")}${statCard("SUBJECTS ACTIVE", "4", " courses this week", "◈", "Balanced · ")}</div><div class="grid dashboard-grid"><section class="panel">${panelHeading("Daily study hours", "Sample focus time · hours per day")}${lineChart()}</section><section class="panel">${panelHeading("Recent exam results", "Score by subject")}<div class="score-bars">${bars}</div><p class="data-caption">Scores shown are sample content only.</p></section></div><section class="panel section-spacer">${panelHeading("How to read these numbers")}<p class="panel-copy">Study time is summed from completed focus sessions. Task completion is completed tasks divided by all tasks in the selected range. Connect your database to replace the preview with your records.</p></section>`;
  }

  function goalsPage() {
    return `${pageHeading("MILESTONES THAT MATTER", "Goals", "Turn the semester into small, achievable steps.", `<button class="button button-primary" data-action="goal-hint">＋ Create a goal</button>`)}<div class="grid goal-grid">${goals.map((goal) => `<article class="goal-card"><span class="eyebrow">${goal.due.toUpperCase()} LEFT</span><h3>${goal.title}</h3><p>${goal.detail}</p><div class="metric-large">${goal.progress}<small>%</small></div><div class="progress-track"><div class="progress-fill" style="width:${goal.progress}%"></div></div></article>`).join("")}</div><p class="data-caption">Preview goals. Your own goals will be stored per-user after connecting Supabase.</p>`;
  }

  function examsPage() {
    return `${pageHeading("EXAM TRACKER", "Exams & results", "Keep upcoming assessments and your progress in one view.", `<button class="button button-primary" data-action="exam-hint">＋ Add exam</button>`)}<div class="grid exam-grid">${examResults.map((exam) => `<article class="item-card"><span class="task-meta">PAST RESULT · SAMPLE</span><h3>${exam.subject}</h3><div class="exam-score">${exam.score}<small> / 100</small></div><p>Recorded exam score preview</p></article>`).join("")}</div><section class="panel section-spacer">${panelHeading("Upcoming assessments")}<div class="empty-state"><strong>No upcoming exams connected</strong>Add your real exam dates after connecting the database.</div></section>`;
  }

  function achievementsPage() {
    const earnedCodes = new Set(earnedAchievements.map((item) => {
      const achievement = Array.isArray(item.achievements) ? item.achievements[0] : item.achievements;
      return achievement?.code;
    }).filter(Boolean));
    const cards = achievementCatalog.map((item) => {
      const unlocked = earnedCodes.has(item.code);
      return `<article class="item-card achievement-card ${unlocked ? "unlocked" : "locked"}"><span class="achievement-icon ${unlocked ? "" : "locked"}">${item.symbol}</span><h3>${translateUiText(item.name)}</h3><p>${translateUiText(item.description)}</p><p class="badge-status">${unlocked ? "Unlocked" : "Keep going to unlock"}</p></article>`;
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
    const displayName = session?.user?.user_metadata?.full_name || "Alex Morgan";
    const email = session?.user?.email || "Student account";
    return `${pageHeading("YOUR ACCOUNT", "Profile", "Your academic workspace, at a glance.", "")}<div class="profile-layout"><section class="panel profile-card"><div class="profile-avatar" dir="ltr">${initials(displayName)}</div><h2 dir="auto">${escapeHtml(displayName)}</h2><p dir="ltr">${escapeHtml(email)}</p><div class="profile-stats"><div><strong>${session && rewardSummary ? rewardCounterMarkup("profile-level", rewardSummary.level) : "—"}</strong><small>Level</small></div><div><strong>${session && rewardSummary ? rewardCounterMarkup("profile-streak", rewardSummary.current_streak) : "—"}</strong><small>Day streak</small></div></div><p class="profile-xp">${session && rewardSummary ? `${rewardCounterMarkup("profile-xp", rewardSummary.total_xp)} XP` : translateUiText("Sign in to earn secure rewards.")}</p></section><section class="panel">${panelHeading("Academic profile", "Personal details stay private to your account")}<div class="setting-row"><div><strong>Program</strong><small>Computer Science · sample profile</small></div></div><div class="setting-row"><div><strong>Current term</strong><small>Fall term · update in your profile</small></div></div><div class="setting-row"><div><strong>Timezone</strong><small dir="ltr">${escapeHtml(Intl.DateTimeFormat().resolvedOptions().timeZone)}</small></div></div><button class="button button-secondary button-small section-spacer" data-action="profile-hint">Edit profile</button></section></div>`;
  }

  function settingsPage() {
    return `${pageHeading("MAKE IT YOURS", "Settings", "Tune StudyFlow to the way you like to work.", "")}<div class="grid settings-grid"><section class="panel">${panelHeading("Appearance")}<div class="setting-row"><div><strong>Dark theme</strong><small>Designed for focus, day or night</small></div><button class="toggle on" data-action="theme-toggle" aria-label="Toggle light theme" aria-pressed="false"></button></div><div class="setting-row"><div><strong>Emerald accents</strong><small>Official StudyFlow color palette</small></div><span class="subject-color"></span></div><div class="setting-row"><div><strong>Motion & celebrations</strong><small>Use subtle animations and completion celebrations</small></div><button class="toggle ${animationsEnabled ? "on" : ""}" data-action="motion-toggle" aria-label="Motion & celebrations" aria-pressed="${animationsEnabled}"></button></div></section><section class="panel">${panelHeading("Language")}<div class="setting-row"><div><strong>Display language</strong><small>Deadlines appear in the selected language.</small></div></div><div class="language-switcher" role="group" aria-label="Choose language"><span class="language-indicator ${appLanguage === "ar" ? "arabic" : ""}"></span><button class="language-option ${appLanguage === "ar" ? "selected" : ""}" data-language="ar" aria-pressed="${appLanguage === "ar"}">عربي <span>العربية</span></button><button class="language-option ${appLanguage === "en" ? "selected" : ""}" data-language="en" aria-pressed="${appLanguage === "en"}">EN <span>English</span></button></div></section><section class="panel">${panelHeading("Reminders")}<div class="setting-row"><div><strong>Task reminders</strong><small>Upcoming deadlines</small></div><button class="toggle on" data-action="setting-toggle" aria-pressed="true"></button></div><div class="setting-row"><div><strong>Study nudges</strong><small>Gentle focus reminders</small></div><button class="toggle" data-action="setting-toggle" aria-pressed="false"></button></div></section><section class="panel">${panelHeading("Data & privacy")}<div class="setting-row"><div><strong>Account data</strong><small>Stored in your private Supabase account when configured</small></div></div><div class="setting-row"><div><strong>Service keys</strong><small>Only the public anon key belongs in this browser config.</small></div></div></section></div>`;
  }

  function adminPage() {
    if (!session || adminAuthorization.status !== "authorized" || adminAuthorization.userId !== session.user.id) {
      return adminAccessPage();
    }
    return `${pageHeading("ADMINISTRATION", "Admin dashboard", "Protected operational metrics and account administration.", "")}<div class="admin-warning">${translateUiText("Administrator access verified.")}</div><div class="grid admin-grid">${statCard("REGISTERED USERS", "—", " Configure a protected server query", "◉")}${statCard("ACTIVE SESSIONS", "—", " Admin-only metric unavailable", "⌁")}${statCard("SYSTEM STATUS", "Protected", " No admin endpoint configured", "⬡")}</div><section class="panel">${panelHeading("Access control")}<p class="panel-copy">${translateUiText("The admin role is verified by Supabase for your signed-in account.")} ${translateUiText("No administrative services are connected yet.")}</p></section>`;
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
    document.documentElement.dataset.motion = animationsEnabled ? "on" : "off";
    const content = document.getElementById("page-content");
    content.classList.remove("page-enter");
    content.innerHTML = pageRenderers[currentPage]();
    if (animationsEnabled && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      void content.offsetWidth;
      content.classList.add("page-enter");
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
    currentPage = page;
    window.location.hash = page;
    document.getElementById("sidebar").classList.remove("open");
    if (page === "admin") {
      adminAuthorization = { status: "checking", userId: session?.user?.id || null };
      updateAdminNavigation();
    }
    render();
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
    const name = user?.user_metadata?.full_name || (user?.email ? user.email.split("@")[0] : "Alex Morgan");
    const initialsText = initials(name);
    document.getElementById("user-name").textContent = name;
    document.getElementById("user-email").textContent = user?.email || "Student account";
    document.querySelectorAll(".avatar").forEach((avatar) => { avatar.textContent = initialsText; });
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
      .select("id,title,description,subject_id,due_at,priority,status,estimated_minutes,reminder_before_minutes,created_at,completed_at,subjects(name)")
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
    const newTask = {
      title,
      subject_id: formData.get("subject_id") || null,
      priority: formData.get("priority"),
      due_at: formData.get("due_at") ? new Date(formData.get("due_at")).toISOString() : null,
      estimated_minutes: Number(formData.get("estimated_minutes")) || 45,
      status: "not_started",
    };
    if (supabase && session) {
      const { data, error } = await supabase.from("tasks").insert(newTask)
        .select("id,title,description,subject_id,due_at,priority,status,estimated_minutes,reminder_before_minutes,created_at,subjects(name)").single();
      if (error) throw error;
      tasks.unshift({ ...data, subject: data.subjects?.name || "Independent study" });
    } else {
      tasks.unshift({ ...newTask, id: `local-${Date.now()}`, subject: subjectName(newTask.subject_id) });
      saveLocalTasks();
    }
    document.getElementById("task-modal").hidden = true;
    render();
    showToast(supabase && session ? "Task saved to your account." : "Task saved in this browser.");
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
      if (completing && !task.due_at && animationsEnabled) launchConfetti();
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
      form.elements.title.value = deadline.title || "";
      form.elements.description.value = deadline.description || "";
      form.elements.subject_id.value = deadline.subject_id || "";
      form.elements.priority.value = deadline.priority || "medium";
      form.elements.due_date.value = dateKey(due);
      const noTimeSet = due.getHours() === 23 && due.getMinutes() === 59;
      form.elements.due_time.value = noTimeSet ? "" : `${String(due.getHours()).padStart(2, "0")}:${String(due.getMinutes()).padStart(2, "0")}`;
      form.elements.reminder_before_minutes.value = String(deadline.reminder_before_minutes || 0);
    }
    document.getElementById("deadline-modal").hidden = false;
    form.elements.title.focus();
  }

  async function saveDeadline(formData) {
    const t = deadlineText[appLanguage];
    const title = String(formData.get("title") || "").trim();
    const date = String(formData.get("due_date") || "");
    if (!title) throw new Error(t.validationTitle);
    if (!date) throw new Error(t.validationDate);
    const dueAt = localDateTimeToIso(date, String(formData.get("due_time") || ""));
    if (!dueAt) throw new Error(t.validationDate);
    const subjectId = String(formData.get("subject_id") || "") || null;
    const payload = {
      title,
      description: String(formData.get("description") || "").trim(),
      subject_id: subjectId,
      due_at: dueAt,
      priority: String(formData.get("priority") || "medium"),
      reminder_before_minutes: Number(formData.get("reminder_before_minutes") || 0),
    };

    if (supabase && session) {
      if (editingDeadlineId) {
        const { data, error } = await supabase.from("tasks").update(payload).eq("id", editingDeadlineId)
          .select("id,title,description,subject_id,due_at,priority,status,estimated_minutes,reminder_before_minutes,created_at,completed_at,subjects(name)").single();
        if (error) throw error;
        tasks = tasks.map((item) => item.id === editingDeadlineId ? { ...data, subject: data.subjects?.name || "Independent study" } : item);
      } else {
        const { data, error } = await supabase.from("tasks").insert({ ...payload, status: "not_started", estimated_minutes: 30 })
          .select("id,title,description,subject_id,due_at,priority,status,estimated_minutes,reminder_before_minutes,created_at,completed_at,subjects(name)").single();
        if (error) throw error;
        tasks.unshift({ ...data, subject: data.subjects?.name || "Independent study" });
      }
    } else {
      if (editingDeadlineId) {
        tasks = tasks.map((item) => item.id === editingDeadlineId
          ? { ...item, ...payload, subject: subjectName(subjectId), updated_at: new Date().toISOString() }
          : item);
      } else {
        tasks.unshift({
          ...payload,
          id: `local-${Date.now()}`,
          status: "not_started",
          estimated_minutes: 30,
          created_at: new Date().toISOString(),
          subject: subjectName(subjectId),
        });
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
    document.getElementById("auth-modal").hidden = true;
    updateUserUi();
    await verifyAdminAccess();
    await loadLanguagePreference();
    await loadRemoteTasks();
    await loadRemoteNotifications();
    await loadFocusData(true);
    await refreshRewardSummary();
    showToast(authMode === "signup" ? "Your account is ready." : "Welcome back.");
  }

  async function restoreSession() {
    if (!supabase) {
      session = null;
      updateUserUi();
      if (currentPage === "admin") await verifyAdminAccess();
      return;
    }
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.error("Could not restore the Supabase session.", error);
      showToast(`Could not restore session: ${error.message}`);
      if (currentPage === "admin") await verifyAdminAccess();
      return;
    }
    session = data.session;
    updateUserUi();
    await verifyAdminAccess();
    if (session) {
      await loadLanguagePreference();
      tasks = [];
      subjects = [];
      render();
      await loadRemoteTasks();
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
        window.setTimeout(async () => {
          await verifyAdminAccess();
          await loadLanguagePreference();
          render();
          await loadRemoteTasks();
          await loadRemoteNotifications();
          await loadFocusData(true);
          await refreshRewardSummary();
        }, 0);
      }
      else {
        adminAuthorization = { status: "denied", userId: null };
        if (currentPage === "admin") denyAdminRoute(false);
        tasks = readLocalTasks();
        userNotifications = [];
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
      for (const record of pendingFocusRecords) {
        if (!focusRecords.some((item) => item.idempotency_key === record.idempotency_key)) focusRecords.unshift(record);
      }
      reconcileFocusTimer();
      if (!error && pendingFocusRecords.length) {
        for (const record of [...pendingFocusRecords]) await persistFocusRecord(record);
      }
      if (currentPage === "focus") render();
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
    if (!focusRecords.some((item) => item.idempotency_key === record.idempotency_key)) focusRecords.unshift(record);
    if (!session) {
      persistFocusState();
      return true;
    }
    if (!pendingFocusRecords.some((item) => item.idempotency_key === record.idempotency_key)) pendingFocusRecords.push(record);
    persistFocusState();
    const rpc = record.completed ? "finish_focus_session" : "cancel_focus_session";
    const { error } = await supabase.rpc(rpc, { p_session_key: record.idempotency_key });
    if (error) {
      focusDataError = error.message;
      console.error("Could not save focus session.", error);
      showToast(`${focusText[appLanguage].sessionError} ${error.message}`);
      render();
      return false;
    }
    pendingFocusRecords = pendingFocusRecords.filter((item) => item.idempotency_key !== record.idempotency_key);
    const { data, error: historyError } = await supabase.from("study_sessions")
      .select("id,idempotency_key,session_type,started_at,ended_at,duration_seconds,completed,subject_id,task_id")
      .eq("idempotency_key", record.idempotency_key).maybeSingle();
    if (historyError) {
      focusDataError = historyError.message;
      console.error("Could not refresh the verified focus record.", historyError);
      showToast(`${focusText[appLanguage].dataError} ${historyError.message}`);
      return false;
    }
    if (data) {
      focusRecords = focusRecords.filter((item) => item.idempotency_key !== record.idempotency_key);
      focusRecords.unshift(data);
    }
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
      if (animationsEnabled) launchConfetti();
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

  document.addEventListener("click", async (event) => {
    const target = event.target.closest("[data-page], [data-navigate], [data-action], [data-close-modal], [data-deadline-filter], [data-deadline-view], [data-language], #open-auth, #top-profile, #mobile-menu, #timer-toggle, #timer-reset, #timer-skip, [data-auth-mode], #sign-out");
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
      target.animate?.([{ transform: "scale(.92)" }, { transform: "scale(1)" }], { duration: 180, easing: "ease-out" });
      showToast("Settings saved.");
    } else if (target.matches('[data-action="motion-toggle"]')) {
      animationsEnabled = !animationsEnabled;
      localStorage.setItem("studyflow.animations", animationsEnabled ? "on" : "off");
      document.documentElement.dataset.motion = animationsEnabled ? "on" : "off";
      target.classList.toggle("on", animationsEnabled);
      target.setAttribute("aria-pressed", String(animationsEnabled));
      showToast("Settings saved.");
    } else if (target.matches('[data-action="setting-toggle"]')) {
      target.classList.toggle("on");
      target.setAttribute("aria-pressed", String(target.classList.contains("on")));
    } else if (target.matches("[data-action]")) {
      const messages = {
        "planner-hint": "Study-block editing is ready to connect to the schedules table.",
        "subject-hint": "Subject creation will be connected to the subjects table.",
        "files-hint": "Upload files after configuring the private StudyFlow storage bucket.",
        "notes-hint": "Note editor will be connected to the private notes table.",
        "goal-hint": "Goal creation will be connected to the goals table.",
        "exam-hint": "Exam tracking will be connected to your exams table.",
        "read-hint": "Notification read state will sync after connecting your account.",
        "profile-hint": "Profile editing is ready to connect to your Supabase profile.",
      };
      if (messages[target.dataset.action]) showInfo(messages[target.dataset.action]);
    } else if (target.matches("[data-close-modal]")) {
      target.closest(".modal-backdrop").hidden = true;
    } else if (target.id === "open-auth" || target.id === "top-profile") {
      document.getElementById("auth-modal").hidden = false;
    } else if (target.id === "mobile-menu") {
      document.getElementById("sidebar").classList.toggle("open");
    } else if (target.matches("[data-auth-mode]")) {
      setAuthMode(target.dataset.authMode);
    } else if (target.id === "sign-out" && supabase) {
      const { error } = await supabase.auth.signOut();
      if (error) {
        showToast(`Could not sign out: ${error.message}`);
        console.error("Supabase sign out failed.", error);
        return;
      }
      session = null;
      adminAuthorization = { status: "denied", userId: null };
      userNotifications = [];
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
    currentPage = pageRenderers[page] ? page : "dashboard";
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

  const storedTheme = localStorage.getItem("studyflow.theme");
  if (storedTheme === "light") document.documentElement.dataset.theme = "light";
  document.getElementById("footer-year").textContent = new Date().getFullYear();
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
    deferredInstallPrompt = null;
    updatePwaInstallButton();
    showToast("App installed.");
  });
  window.matchMedia?.("(display-mode: standalone)").addEventListener?.("change", updatePwaInstallButton);
  if ("serviceWorker" in navigator && window.location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("./service-worker.js").then((registration) => {
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
