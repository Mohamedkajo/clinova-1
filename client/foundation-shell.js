const clinicNavigation = [
  { page: "dashboard", labelKey: "nav.dashboard", permission: "canViewDashboard", icon: "home" },
  { page: "calendar", labelKey: "nav.calendar", permission: "canViewAppointments", icon: "calendar" },
  { page: "appointments", labelKey: "nav.appointments", permission: "canViewAppointments", icon: "clock" },
  { page: "clients", labelKey: "nav.patients", permission: "canViewPatients", icon: "users" },
  { page: "services", labelKey: "nav.treatments", permission: "canViewTreatments", icon: "treatment" },
  { page: "billing", labelKey: "nav.billing", permission: "canViewBilling", icon: "wallet" },
  { page: "reports", labelKey: "nav.reports", permission: "canViewReports", icon: "report" },
  { page: "settings", labelKey: "nav.settings", permission: "canViewSettings", icon: "settings" },
];

const clinicTools = [
  { page: "crm", labelKey: "nav.crm", permission: "canViewPatients", icon: "contact" },
  { page: "whatsapp", labelKey: "nav.messages", permission: "canViewMessages", icon: "message" },
  { page: "consents", labelKey: "nav.consents", permission: "canViewConsents", icon: "document" },
  { page: "feedback", labelKey: "nav.feedback", permission: "canViewFeedback", icon: "feedback" },
  { page: "gifts", labelKey: "nav.gifts", permission: "canViewGifts", icon: "gift" },
  { page: "categories", labelKey: "nav.categories", permission: "canManageCatalog", icon: "category" },
  { page: "users", labelKey: "nav.team", permission: "canManageUsers", icon: "team" },
  { page: "audit", labelKey: "nav.audit", permission: "canViewAudit", icon: "audit" },
];

const platformNavigation = [
  { page: "platform", labelKey: "nav.platform", icon: "home" },
  { page: "platformBilling", labelKey: "nav.platformBilling", icon: "wallet" },
  { page: "platformReports", labelKey: "nav.platformReports", icon: "report" },
  { page: "platformHealth", labelKey: "nav.platformHealth", icon: "health" },
];

const rolePermissions = {
  admin: [
    "canViewDashboard",
    "canViewAppointments",
    "canViewPatients",
    "canViewTreatments",
    "canViewBilling",
    "canViewReports",
    "canViewSettings",
    "canManageSettings",
    "canViewMessages",
    "canViewConsents",
    "canViewFeedback",
    "canViewGifts",
    "canManageCatalog",
    "canManageUsers",
    "canViewAudit",
  ],
  reception: [
    "canViewAppointments",
    "canViewPatients",
    "canViewBilling",
    "canViewSettings",
    "canViewMessages",
    "canViewConsents",
    "canViewFeedback",
    "canViewGifts",
  ],
  therapist: [
    "canViewAppointments",
    "canViewPatients",
    "canViewSettings",
    "canViewConsents",
  ],
};

const dictionaries = {
  he: {
    "app.name": "Clinova",
    "app.subtitle": "ניהול קליניקה",
    "auth.title": "ברוכים הבאים",
    "auth.subtitle": "כניסה מאובטחת למערכת Clinova",
    "auth.identifier": "שם משתמש או אימייל",
    "auth.clinic": "מזהה קליניקה",
    "auth.clinicHint": "נדרש למשתמשי קליניקה",
    "auth.password": "סיסמה",
    "auth.submit": "כניסה למערכת",
    "auth.submitting": "מתחבר…",
    "auth.required": "יש למלא שם משתמש וסיסמה.",
    "auth.invalid": "פרטי הכניסה שגויים. בדקו את שם המשתמש והסיסמה.",
    "auth.clinicRequired": "יש להזין מזהה קליניקה.",
    "auth.clinicMissing": "מזהה הקליניקה לא נמצא.",
    "auth.rateLimited": "בוצעו יותר מדי ניסיונות. נסו שוב מאוחר יותר.",
    "shell.primaryNavigation": "ניווט ראשי",
    "shell.moreTools": "כלים נוספים",
    "shell.openMenu": "פתיחת תפריט",
    "shell.closeMenu": "סגירת תפריט",
    "shell.userMenu": "תפריט משתמש",
    "shell.logout": "יציאה",
    "shell.language": "שפה",
    "shell.currentClinic": "קליניקה פעילה",
    "shell.breadcrumbHome": "ראשי",
    "shell.loading": "טוען את סביבת העבודה…",
    "shell.loadError": "לא הצלחנו לטעון את סביבת העבודה.",
    "shell.retry": "ניסיון חוזר",
    "nav.dashboard": "לוח בקרה",
    "nav.calendar": "יומן",
    "nav.appointments": "תורים",
    "nav.patients": "מטופלים",
    "nav.treatments": "טיפולים",
    "nav.billing": "כספים",
    "nav.reports": "דוחות",
    "nav.settings": "הגדרות",
    "nav.crm": "קשרי מטופלים",
    "nav.messages": "הודעות",
    "nav.consents": "טפסים משפטיים",
    "nav.feedback": "משוב",
    "nav.gifts": "מתנות",
    "nav.categories": "קטגוריות",
    "nav.team": "צוות",
    "nav.audit": "יומן פעילות",
    "nav.platform": "ניהול קליניקות",
    "nav.platformBilling": "חיוב פלטפורמה",
    "nav.platformReports": "דוחות פלטפורמה",
    "nav.platformHealth": "תקינות מערכת",
    "page.dashboard.subtitle": "תמונת מצב נקייה של יום העבודה",
    "page.calendar.subtitle": "ניהול היומן וזמינות הצוות",
    "page.appointments.subtitle": "ניהול תורים ומעקב אחר ביקורים",
    "page.clients.subtitle": "מטופלים, פרטי קשר והיסטוריית טיפול",
    "page.services.subtitle": "טיפולים, משכי זמן ומחירים",
    "page.billing.subtitle": "תשלומים ומצב כספי",
    "page.reports.subtitle": "דוחות מורשים של הקליניקה",
    "page.settings.subtitle": "העדפות אישיות והגדרות קליניקה",
    "dashboard.welcome": "שלום, {name}",
    "dashboard.welcomeBody": "זהו מרכז העבודה של {clinic}.",
    "dashboard.quickNavigation": "גישה מהירה",
    "dashboard.todayAppointments": "תורי היום",
    "dashboard.waitingQueue": "תור המתנה",
    "dashboard.recentPatients": "מטופלים אחרונים",
    "dashboard.pendingActions": "פעולות ממתינות",
    "dashboard.noAppointments": "אין תורים מתוכננים להיום.",
    "dashboard.noQueue": "אין מטופלים בתור ההמתנה.",
    "dashboard.noPatients": "אין מטופלים להצגה.",
    "dashboard.noActions": "אין פעולות פתוחות שממתינות לטיפול.",
    "dashboard.viewAll": "הצגת הכל",
    "dashboard.realData": "מידע עדכני מהקליניקה",
    "dashboard.emptyState": "המצב נקי כרגע",
    "dashboard.signedInAs": "מחובר כ־{name}",
    "roles.admin": "מנהל/ת קליניקה",
    "roles.reception": "קבלה",
    "roles.therapist": "מטפל/ת",
  },
  ar: {
    "app.name": "Clinova",
    "app.subtitle": "إدارة العيادة",
    "auth.title": "مرحبًا بعودتك",
    "auth.subtitle": "دخول آمن إلى نظام Clinova",
    "auth.identifier": "اسم المستخدم أو البريد الإلكتروني",
    "auth.clinic": "معرّف العيادة",
    "auth.clinicHint": "مطلوب لمستخدمي العيادة",
    "auth.password": "كلمة المرور",
    "auth.submit": "الدخول إلى النظام",
    "auth.submitting": "جارٍ الدخول…",
    "auth.required": "يرجى إدخال اسم المستخدم وكلمة المرور.",
    "auth.invalid": "بيانات الدخول غير صحيحة.",
    "auth.clinicRequired": "يرجى إدخال معرّف العيادة.",
    "auth.clinicMissing": "لم يتم العثور على معرّف العيادة.",
    "auth.rateLimited": "محاولات كثيرة. يرجى المحاولة لاحقًا.",
    "shell.primaryNavigation": "التنقل الرئيسي",
    "shell.moreTools": "أدوات إضافية",
    "shell.openMenu": "فتح القائمة",
    "shell.closeMenu": "إغلاق القائمة",
    "shell.userMenu": "قائمة المستخدم",
    "shell.logout": "خروج",
    "shell.language": "اللغة",
    "shell.currentClinic": "العيادة الحالية",
    "shell.breadcrumbHome": "الرئيسية",
    "shell.loading": "جارٍ تحميل مساحة العمل…",
    "shell.loadError": "تعذّر تحميل مساحة العمل.",
    "shell.retry": "إعادة المحاولة",
    "nav.dashboard": "لوحة التحكم",
    "nav.calendar": "اليوميات",
    "nav.appointments": "المواعيد",
    "nav.patients": "المرضى",
    "nav.treatments": "العلاجات",
    "nav.billing": "المالية",
    "nav.reports": "التقارير",
    "nav.settings": "الإعدادات",
    "nav.crm": "علاقات المرضى",
    "nav.messages": "الرسائل",
    "nav.consents": "النماذج القانونية",
    "nav.feedback": "التقييمات",
    "nav.gifts": "الهدايا",
    "nav.categories": "الفئات",
    "nav.team": "الفريق",
    "nav.audit": "سجل النشاط",
    "nav.platform": "إدارة العيادات",
    "nav.platformBilling": "فوترة المنصة",
    "nav.platformReports": "تقارير المنصة",
    "nav.platformHealth": "حالة النظام",
    "page.dashboard.subtitle": "حالة يوم العمل بوضوح",
    "page.calendar.subtitle": "إدارة الجدول وتوفر الفريق",
    "page.appointments.subtitle": "إدارة المواعيد ومتابعة الزيارات",
    "page.clients.subtitle": "المرضى وبيانات التواصل وسجل العلاج",
    "page.services.subtitle": "العلاجات والمدد والأسعار",
    "page.billing.subtitle": "المدفوعات والحالة المالية",
    "page.reports.subtitle": "تقارير العيادة المصرح بها",
    "page.settings.subtitle": "التفضيلات وإعدادات العيادة",
    "dashboard.welcome": "مرحبًا، {name}",
    "dashboard.welcomeBody": "هذه مساحة العمل اليومية لـ {clinic}.",
    "dashboard.quickNavigation": "وصول سريع",
    "dashboard.todayAppointments": "مواعيد اليوم",
    "dashboard.waitingQueue": "قائمة الانتظار",
    "dashboard.recentPatients": "المرضى الأخيرون",
    "dashboard.pendingActions": "إجراءات معلّقة",
    "dashboard.noAppointments": "لا توجد مواعيد مقررة اليوم.",
    "dashboard.noQueue": "لا يوجد مرضى في قائمة الانتظار.",
    "dashboard.noPatients": "لا يوجد مرضى للعرض.",
    "dashboard.noActions": "لا توجد إجراءات مفتوحة حاليًا.",
    "dashboard.viewAll": "عرض الكل",
    "dashboard.realData": "معلومات محدثة من العيادة",
    "dashboard.emptyState": "لا شيء يحتاج الانتباه الآن",
    "dashboard.signedInAs": "مسجل باسم {name}",
    "roles.admin": "مدير/ة العيادة",
    "roles.reception": "الاستقبال",
    "roles.therapist": "معالج/ة",
  },
  en: {
    "app.name": "Clinova",
    "app.subtitle": "Clinic management",
    "auth.title": "Welcome back",
    "auth.subtitle": "Secure sign-in to Clinova",
    "auth.identifier": "Username or email",
    "auth.clinic": "Clinic identifier",
    "auth.clinicHint": "Required for clinic users",
    "auth.password": "Password",
    "auth.submit": "Sign in",
    "auth.submitting": "Signing in…",
    "auth.required": "Enter your username and password.",
    "auth.invalid": "The sign-in details are incorrect.",
    "auth.clinicRequired": "Enter a clinic identifier.",
    "auth.clinicMissing": "The clinic identifier was not found.",
    "auth.rateLimited": "Too many attempts. Try again later.",
    "shell.primaryNavigation": "Primary navigation",
    "shell.moreTools": "More tools",
    "shell.openMenu": "Open menu",
    "shell.closeMenu": "Close menu",
    "shell.userMenu": "User menu",
    "shell.logout": "Sign out",
    "shell.language": "Language",
    "shell.currentClinic": "Active clinic",
    "shell.breadcrumbHome": "Home",
    "shell.loading": "Loading your workspace…",
    "shell.loadError": "We could not load the workspace.",
    "shell.retry": "Try again",
    "nav.dashboard": "Dashboard",
    "nav.calendar": "Calendar",
    "nav.appointments": "Appointments",
    "nav.patients": "Patients",
    "nav.treatments": "Treatments",
    "nav.billing": "Finances",
    "nav.reports": "Reports",
    "nav.settings": "Settings",
    "nav.crm": "Patient relations",
    "nav.messages": "Messages",
    "nav.consents": "Legal forms",
    "nav.feedback": "Feedback",
    "nav.gifts": "Gifts",
    "nav.categories": "Categories",
    "nav.team": "Team",
    "nav.audit": "Activity log",
    "nav.platform": "Clinic management",
    "nav.platformBilling": "Platform billing",
    "nav.platformReports": "Platform reports",
    "nav.platformHealth": "System health",
    "page.dashboard.subtitle": "A clean view of the working day",
    "page.calendar.subtitle": "Schedule and staff availability",
    "page.appointments.subtitle": "Appointments and visit follow-up",
    "page.clients.subtitle": "Patients, contact details and history",
    "page.services.subtitle": "Treatments, duration and pricing",
    "page.billing.subtitle": "Payments and financial status",
    "page.reports.subtitle": "Authorized clinic reports",
    "page.settings.subtitle": "Personal preferences and clinic settings",
    "dashboard.welcome": "Hello, {name}",
    "dashboard.welcomeBody": "This is the daily workspace for {clinic}.",
    "dashboard.quickNavigation": "Quick navigation",
    "dashboard.todayAppointments": "Today's appointments",
    "dashboard.waitingQueue": "Waiting queue",
    "dashboard.recentPatients": "Recent patients",
    "dashboard.pendingActions": "Pending actions",
    "dashboard.noAppointments": "There are no appointments scheduled today.",
    "dashboard.noQueue": "There are no patients in the waiting queue.",
    "dashboard.noPatients": "There are no patients to show.",
    "dashboard.noActions": "There are no open actions right now.",
    "dashboard.viewAll": "View all",
    "dashboard.realData": "Current clinic information",
    "dashboard.emptyState": "Nothing needs attention right now",
    "dashboard.signedInAs": "Signed in as {name}",
    "roles.admin": "Clinic administrator",
    "roles.reception": "Reception",
    "roles.therapist": "Therapist",
  },
};

const pageLabelKeys = new Map(
  [...clinicNavigation, ...clinicTools, ...platformNavigation].map((item) => [item.page, item.labelKey]),
);

export function directionForLanguage(language) {
  return language === "en" ? "ltr" : "rtl";
}

export function translate(language, key, replacements = {}) {
  const dictionary = dictionaries[language] || dictionaries.he;
  let value = dictionary[key] ?? dictionaries.he[key] ?? key;
  for (const [name, replacement] of Object.entries(replacements)) {
    value = value.replaceAll(`{${name}}`, String(replacement ?? ""));
  }
  return value;
}

export function permissionsFor(user) {
  if (!user) return new Set();
  if (user.platformOwner) return new Set(["platformOwner"]);
  return new Set(rolePermissions[user.role] || []);
}

export function can(user, permission) {
  return permissionsFor(user).has(permission);
}

function visible(items, user) {
  return items.filter((item) => !item.permission || can(user, item.permission));
}

export function navigationFor(user) {
  if (!user) return { primary: [], tools: [], all: [] };
  if (user.platformOwner) {
    return { primary: platformNavigation, tools: [], all: platformNavigation };
  }
  const primary = visible(clinicNavigation, user);
  const tools = visible(clinicTools, user);
  return { primary, tools, all: [...primary, ...tools] };
}

export function pageLabel(language, page) {
  return translate(language, pageLabelKeys.get(page) || `nav.${page}`);
}

export function pageSubtitle(language, page) {
  return translate(language, `page.${page}.subtitle`) === `page.${page}.subtitle`
    ? ""
    : translate(language, `page.${page}.subtitle`);
}

export function routeFromHash(hash = "") {
  const value = String(hash).replace(/^#\/?/, "").split(/[?&]/)[0];
  return value || "";
}

export function hashForRoute(page) {
  return `#/${page}`;
}

export function resolveProtectedRoute(hash, user) {
  const requested = routeFromHash(hash);
  if (!user) return { page: "login", redirect: requested === "login" ? null : hashForRoute("login") };

  const navigation = navigationFor(user).all;
  const fallback = navigation[0]?.page || (user.platformOwner ? "platform" : "dashboard");
  const requestedAllowed = navigation.some((item) => item.page === requested);
  const page = requested && requested !== "login" && requestedAllowed ? requested : fallback;
  return { page, redirect: requested === page ? null : hashForRoute(page) };
}

export function localizedAuthError(language, error) {
  const status = Number(error?.status || 0);
  const code = String(error?.code || error?.message || "").toLowerCase();
  if (status === 429 || code.includes("too many")) return translate(language, "auth.rateLimited");
  if (code.includes("clinic identifier is required")) return translate(language, "auth.clinicRequired");
  if (code.includes("clinic identifier not found")) return translate(language, "auth.clinicMissing");
  if (status === 401 || code.includes("invalid username")) return translate(language, "auth.invalid");
  return String(error?.message || translate(language, "shell.loadError"));
}

export const navigationIcons = {
  home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5"/><path d="M9.5 20v-6h5v6"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  users: '<circle cx="9" cy="8" r="3"/><path d="M3.5 20c.5-4 2.5-6 5.5-6s5 2 5.5 6"/><path d="M15 5.5a3 3 0 0 1 0 5.5M16 14c2.5.4 4 2.3 4.5 5"/>',
  treatment: '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/>',
  wallet: '<path d="M4 6.5h14a2 2 0 0 1 2 2V18H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h12"/><path d="M15 11h5v4h-5a2 2 0 0 1 0-4z"/>',
  report: '<path d="M5 20V10M12 20V4M19 20v-7"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1z"/>',
  contact: '<path d="M4 4h16v16H4zM8 9h8M8 13h5"/>',
  message: '<path d="M4 5h16v11H9l-5 4z"/>',
  document: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
  feedback: '<path d="M4 4h16v13H9l-5 4z"/><path d="m8 11 2.5 2.5L16 8"/>',
  gift: '<path d="M4 10h16v11H4zM3 7h18v3H3zM12 7v14"/><path d="M12 7c-4 0-5-5-2-5 2 0 2 3 2 5zm0 0c4 0 5-5 2-5-2 0-2 3-2 5z"/>',
  category: '<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"/>',
  team: '<circle cx="8" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M2.5 20c.5-4 2.5-6 5.5-6s5 2 5.5 6M14 15c3.5-.5 5.5 1.2 6 4"/>',
  audit: '<path d="M5 3h14v18H5zM8 8h8M8 12h8M8 16h5"/>',
  health: '<path d="M3 12h4l2-5 4 10 2-5h6"/>',
  logout: '<path d="M10 4H5v16h5M14 8l4 4-4 4M18 12H9"/>',
};
