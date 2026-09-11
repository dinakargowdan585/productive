/* Application Service Layer & Storage Cache Controller */

const STORAGE_DASHBOARD_CARDS = "learningDashboardVisibleCards";
const DATA_SCHEMA_VERSION_KEY = "PRODUCTIVE_SCHEMA_VERSION";
const CURRENT_SCHEMA_VERSION = 4;
const GLOBAL_STREAK_STORAGE_KEY = "productive_global_streak_v1";

// Cache in memory for instantaneous sync reads across feature modules
let memoryCache = {
  tasks: null,
  notes: null,
  projects: null,
  goals: null,
  vaultNotes: null,
  timeBlocks: null,
  calendars: null,
  globalStreak: null
};

function uuid() {
  return (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now() + Math.random());
}

function escapeHTML(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getIsoDateStr(d = new Date()) {
  if (typeof d === "string") {
    return d.includes("T") ? d.split("T")[0] : d.trim();
  }
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getYesterdayIsoDateStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return getIsoDateStr(d);
}

function addDaysIso(isoStr, numDays) {
  const d = new Date(isoStr + "T00:00:00");
  d.setDate(d.getDate() + numDays);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDefaultGlobalStreakState() {
  return {
    id: GLOBAL_STREAK_STORAGE_KEY,
    currentStreak: 0,
    bestStreak: 0,
    availableFreezes: 2,
    maxFreezes: 2,
    protectedDates: [],
    consecutiveProductiveDays: 0,
    lastEarnedAtStreak: 0,
    lastRolloverEvaluatedDate: null,
    updatedAt: new Date().toISOString()
  };
}

function getGlobalStreakState() {
  if (memoryCache.globalStreak) {
    return memoryCache.globalStreak;
  }
  try {
    const raw = localStorage.getItem(GLOBAL_STREAK_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        memoryCache.globalStreak = {
          ...getDefaultGlobalStreakState(),
          ...parsed
        };
        return memoryCache.globalStreak;
      }
    }
  } catch {}
  const def = getDefaultGlobalStreakState();
  memoryCache.globalStreak = def;
  return def;
}

function saveGlobalStreakState(state, persistToRepo = true) {
  if (!state || typeof state !== "object") return;
  state.updatedAt = new Date().toISOString();
  memoryCache.globalStreak = state;
  try {
    localStorage.setItem(GLOBAL_STREAK_STORAGE_KEY, JSON.stringify(state));
  } catch {}
  if (persistToRepo && typeof SettingsRepository !== "undefined") {
    SettingsRepository.create(state).catch(err => console.error("Global Streak Settings persist error:", err));
  }
  if (typeof SyncEngine !== "undefined" && typeof SyncEngine.scheduleBackgroundSync === "function") {
    SyncEngine.scheduleBackgroundSync(400);
  }
}

function isDateProductive(dateStr, tasks = null) {
  const taskList = tasks || (typeof loadTasks === "function" ? loadTasks() : (memoryCache.tasks || []));
  if (!Array.isArray(taskList) || !taskList.length) return false;
  return taskList.some(t => {
    const isDaily = Boolean(t.isDaily || t.is_daily);
    if (isDaily) {
      if (Array.isArray(t.completedDates) && t.completedDates.includes(dateStr)) return true;
      if (t.lastCompletedDate === dateStr && t.completed) return true;
      return false;
    }
    if (t.completed) {
      if (t.lastCompletedDate === dateStr) return true;
      if (t.updatedAt && t.updatedAt.slice(0, 10) === dateStr) return true;
      if (t.dueDate === dateStr) return true;
      if (t.createdAt && t.createdAt.slice(0, 10) === dateStr) return true;
    }
    return false;
  });
}

function calculateActiveStreak(tasks, streakState, referenceDateIso) {
  const protectedSet = new Set((streakState && streakState.protectedDates) || []);
  const todayIso = referenceDateIso || getIsoDateStr();
  const isTodayProductive = isDateProductive(todayIso, tasks);

  let streak = 0;
  let checkDate = todayIso;

  if (isTodayProductive) {
    streak++;
    checkDate = addDaysIso(checkDate, -1);
  } else {
    // Today is in progress; verify backwards starting from yesterday
    checkDate = addDaysIso(checkDate, -1);
  }

  const lookbackLimit = 3650;
  let daysWalked = 0;

  while (daysWalked < lookbackLimit) {
    const productive = isDateProductive(checkDate, tasks);
    const isProtected = protectedSet.has(checkDate);

    if (productive) {
      streak++;
    } else if (isProtected) {
      // Protected freeze day preserves streak continuity
    } else {
      // Unprotected missed day breaks streak
      break;
    }

    checkDate = addDaysIso(checkDate, -1);
    daysWalked++;
  }

  return streak;
}

function syncLiveGlobalStreak(tasks = null, todayIso = getIsoDateStr()) {
  const currentTasks = tasks || (typeof loadTasks === "function" ? loadTasks() : (memoryCache.tasks || []));
  const state = getGlobalStreakState();
  const calculatedStreak = calculateActiveStreak(currentTasks, state, todayIso);
  state.currentStreak = calculatedStreak;
  if (calculatedStreak > (state.bestStreak || 0)) {
    state.bestStreak = calculatedStreak;
  }
  saveGlobalStreakState(state);
  return state;
}

function isTaskCompletedOnDate(t, dateStr) {
  if (!t) return false;
  const targetDate = dateStr || getIsoDateStr();
  const isDaily = Boolean(t.isDaily || t.is_daily);
  if (isDaily) {
    const inDates = Array.isArray(t.completedDates) && t.completedDates.includes(targetDate);
    const isLast = Boolean(t.lastCompletedDate && t.lastCompletedDate === targetDate);
    return inDates || isLast;
  }
  return Boolean(t.completed);
}

function formatDurationHuman(mins) {
  if (!mins || mins <= 0) return "0m";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function formatTime12Hour(time24OrDateStr) {
  if (!time24OrDateStr) return "";
  let hours = 0;
  let minutes = 0;
  
  if (typeof time24OrDateStr === "string" && time24OrDateStr.includes(":")) {
    const parts = time24OrDateStr.trim().split(":");
    hours = parseInt(parts[0], 10) || 0;
    minutes = parseInt(parts[1], 10) || 0;
  } else if (time24OrDateStr instanceof Date) {
    hours = time24OrDateStr.getHours();
    minutes = time24OrDateStr.getMinutes();
  } else {
    return String(time24OrDateStr);
  }

  const ampm = hours >= 12 ? "PM" : "AM";
  const hours12 = hours % 12 || 12;
  const minutesStr = String(minutes).padStart(2, "0");
  return `${hours12}:${minutesStr} ${ampm}`;
}

// Populate Memory Cache from Repositories
async function loadAllFromRepositoriesIntoMemory() {
  try {
    if (typeof TasksRepository !== "undefined") {
      const tasks = await TasksRepository.getAll();
      memoryCache.tasks = Array.isArray(tasks) ? tasks : [];
    }

    if (typeof NotesRepository !== "undefined") {
      const notes = await NotesRepository.getAll();
      memoryCache.notes = Array.isArray(notes) ? notes : [];
    }

    if (typeof CalendarsRepository !== "undefined") {
      const cals = await CalendarsRepository.getAll();
      memoryCache.calendars = (cals && cals.length) ? cals : DEFAULT_CALENDARS;
    }

    if (typeof TimeBlocksRepository !== "undefined") {
      const blocks = await TimeBlocksRepository.getAll();
      memoryCache.timeBlocks = Array.isArray(blocks) ? blocks : [];
    }

    if (typeof ProjectsRepository !== "undefined") {
      const projs = await ProjectsRepository.getAll();
      memoryCache.projects = Array.isArray(projs) ? projs : [];
    }

    if (typeof GoalsRepository !== "undefined") {
      const goals = await GoalsRepository.getAll();
      memoryCache.goals = Array.isArray(goals) ? goals : [];
    }

    // Vault Notes Store (Encrypted payloads)
    try {
      const store = await getStore("vaultNotes", "readonly");
      memoryCache.vaultNotes = await new Promise((res) => {
        const req = store.getAll();
        req.onsuccess = () => res(req.result || []);
        req.onerror = () => res([]);
      });
    } catch {}

    // Global Streak State
    try {
      if (typeof SettingsRepository !== "undefined") {
        const storedStreak = await SettingsRepository.getById(GLOBAL_STREAK_STORAGE_KEY);
        if (storedStreak && typeof storedStreak === "object") {
          memoryCache.globalStreak = {
            ...getDefaultGlobalStreakState(),
            ...storedStreak
          };
          try {
            localStorage.setItem(GLOBAL_STREAK_STORAGE_KEY, JSON.stringify(memoryCache.globalStreak));
          } catch {}
        } else {
          // Initialize streak from tasks history and seed 2 freezes
          const state = getGlobalStreakState();
          state.currentStreak = calculateActiveStreak(memoryCache.tasks || [], state, getIsoDateStr());
          state.bestStreak = Math.max(state.bestStreak || 0, state.currentStreak);
          memoryCache.globalStreak = state;
          await SettingsRepository.create(state).catch(() => {});
        }
      }
    } catch (streakErr) {
      console.warn("Global streak repository load warning:", streakErr);
    }

    console.log("[Store] Memory cache initialized from IndexedDB repositories.");
    if (typeof DayRolloverEngine !== "undefined" && typeof DayRolloverEngine.runAutomatedResetCheck === "function") {
      DayRolloverEngine.runAutomatedResetCheck("post_repo_load");
    }
  } catch (err) {
    console.error("Failed to load memory cache from repositories:", err);
  }
}

function loadTasks() {
  const rawTasks = memoryCache.tasks || [];
  const todayIso = getIsoDateStr();
  let changed = false;

  const sanitized = rawTasks.map(t => {
    const isDaily = Boolean(t.isDaily || t.is_daily);
    if (isDaily) {
      // If task was completed on a previous day, clean up today's completion so it resets
      if (t.lastCompletedDate && t.lastCompletedDate < todayIso) {
        if (Array.isArray(t.completedDates)) {
          t.completedDates = t.completedDates.filter(d => d <= t.lastCompletedDate && d < todayIso);
        }
        t.completed = false;
        changed = true;
      } else {
        t.completed = isTaskCompletedOnDate(t, todayIso);
      }
    }
    return t;
  });

  if (changed && typeof TasksRepository !== "undefined") {
    TasksRepository.bulkPut(sanitized).catch(() => {});
  }

  return sanitized;
}

function saveTasks(tasks) {
  memoryCache.tasks = tasks;
  if (typeof TasksRepository !== "undefined") {
    TasksRepository.bulkPut(tasks).catch(err => console.error("Tasks Repository save error:", err));
  }
  if (typeof SyncEngine !== "undefined" && typeof SyncEngine.scheduleBackgroundSync === "function") {
    SyncEngine.scheduleBackgroundSync(400);
  }
}

async function saveTaskSingle(task) {
  if (!task || !task.id) return;
  task.updatedAt = new Date().toISOString();
  let tasks = memoryCache.tasks || [];
  const idx = tasks.findIndex(t => t.id === task.id);
  if (idx >= 0) {
    tasks[idx] = { ...tasks[idx], ...task };
  } else {
    tasks.push(task);
  }
  memoryCache.tasks = tasks;
  if (typeof TasksRepository !== "undefined") {
    await TasksRepository.create(task);
  }
  if (typeof SyncEngine !== "undefined" && typeof SyncEngine.scheduleBackgroundSync === "function") {
    SyncEngine.scheduleBackgroundSync(400);
  }
}

async function deleteTaskSingle(id) {
  if (!id) return;
  let tasks = memoryCache.tasks || [];
  memoryCache.tasks = tasks.filter(t => t.id !== id);
  if (typeof TasksRepository !== "undefined") {
    await TasksRepository.delete(id).catch(() => {});
  }
  if (typeof recordLocalDeletion === "function") {
    recordLocalDeletion("tasks", id);
  }
  const client = typeof getSupabase === "function" ? getSupabase() : null;
  const user = typeof getSupabaseUser === "function" ? await getSupabaseUser() : null;
  if (client && user && user.id) {
    client.from("tasks").delete().eq("id", id).eq("user_id", user.id).catch(() => {});
  }
  if (typeof SyncEngine !== "undefined" && typeof SyncEngine.scheduleBackgroundSync === "function") {
    SyncEngine.scheduleBackgroundSync(300);
  }
}

function loadNotes() {
  return memoryCache.notes || [];
}

function saveNotes(notes) {
  memoryCache.notes = notes;
  if (typeof NotesRepository !== "undefined") {
    NotesRepository.bulkPut(notes).catch(err => console.error("Notes Repository save error:", err));
  }
  if (typeof SyncEngine !== "undefined" && typeof SyncEngine.scheduleBackgroundSync === "function") {
    SyncEngine.scheduleBackgroundSync(400);
  }
}

async function saveNoteSingle(note) {
  if (!note || !note.id) return;
  note.updatedAt = new Date().toISOString();
  let notes = memoryCache.notes || [];
  const idx = notes.findIndex(n => n.id === note.id);
  if (idx >= 0) {
    notes[idx] = { ...notes[idx], ...note };
  } else {
    notes.push(note);
  }
  memoryCache.notes = notes;
  if (typeof NotesRepository !== "undefined") {
    await NotesRepository.create(note);
  }
  if (typeof SyncEngine !== "undefined" && typeof SyncEngine.scheduleBackgroundSync === "function") {
    SyncEngine.scheduleBackgroundSync(400);
  }
}

async function deleteNoteSingle(id) {
  if (!id) return;
  let notes = memoryCache.notes || [];
  memoryCache.notes = notes.filter(n => n.id !== id);
  if (typeof NotesRepository !== "undefined") {
    await NotesRepository.delete(id).catch(() => {});
  }
  if (typeof recordLocalDeletion === "function") {
    recordLocalDeletion("notes", id);
  }
  const client = typeof getSupabase === "function" ? getSupabase() : null;
  const user = typeof getSupabaseUser === "function" ? await getSupabaseUser() : null;
  if (client && user && user.id) {
    client.from("notes").delete().eq("id", id).eq("user_id", user.id).catch(() => {});
  }
  if (typeof SyncEngine !== "undefined" && typeof SyncEngine.scheduleBackgroundSync === "function") {
    SyncEngine.scheduleBackgroundSync(300);
  }
}

function loadTimeBlocks() {
  return memoryCache.timeBlocks || [];
}

function saveTimeBlocks(blocks) {
  memoryCache.timeBlocks = blocks;
  if (typeof TimeBlocksRepository !== "undefined") {
    TimeBlocksRepository.saveAll(blocks).catch(err => console.error("TimeBlocks persist error:", err));
  }
  if (typeof SyncEngine !== "undefined" && typeof SyncEngine.scheduleBackgroundSync === "function") {
    SyncEngine.scheduleBackgroundSync(400);
  }
}

function loadGoals() {
  return memoryCache.goals || [];
}

function saveGoals(goals) {
  memoryCache.goals = goals;
  if (typeof GoalsRepository !== "undefined") {
    GoalsRepository.saveAll(goals).catch(err => console.error("Goals persist error:", err));
  }
  if (typeof SyncEngine !== "undefined" && typeof SyncEngine.scheduleBackgroundSync === "function") {
    SyncEngine.scheduleBackgroundSync(400);
  }
}

function loadProjects() {
  return memoryCache.projects || [];
}

function saveProjects(projects) {
  memoryCache.projects = projects;
  if (typeof ProjectsRepository !== "undefined") {
    ProjectsRepository.saveAll(projects).catch(err => console.error("Projects persist error:", err));
  }
  if (typeof SyncEngine !== "undefined" && typeof SyncEngine.scheduleBackgroundSync === "function") {
    SyncEngine.scheduleBackgroundSync(400);
  }
}

function loadVaultNotes() {
  return memoryCache.vaultNotes || [];
}

function persistVaultNotes(notes) {
  memoryCache.vaultNotes = notes;
  if (typeof VaultNotesRepository !== "undefined") {
    VaultNotesRepository.saveAll(notes).catch(err => console.error("VaultNotes persist error:", err));
  }
  if (typeof SyncEngine !== "undefined" && typeof SyncEngine.scheduleBackgroundSync === "function") {
    SyncEngine.scheduleBackgroundSync(400);
  }
}

function loadCalendars() {
  return [
    { id: "work", name: "Work", color: "var(--accent)" },
    { id: "personal", name: "Personal", color: "var(--green)" },
    { id: "study", name: "Study", color: "var(--purple)" },
    { id: "goals", name: "Goals", color: "var(--amber)" },
    { id: "habits", name: "Habits", color: "var(--danger)" }
  ];
}

function saveCalendars(calendars) {
  memoryCache.calendars = calendars;
  if (typeof CalendarsRepository !== "undefined") {
    CalendarsRepository.bulkPut(calendars).catch(err => console.error("Calendars Repository save error:", err));
  }
}

function exportFullDataBackup() {
  const data = {
    tasks: loadTasks(),
    notes: loadNotes(),
    goals: loadGoals(),
    projects: loadProjects(),
    vaultNotes: loadVaultNotes(),
    timeBlocks: loadTimeBlocks(),
    globalStreak: getGlobalStreakState(),
    exportedAt: new Date().toISOString(),
    version: "2.6.0"
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `dharin-backup-${getIsoDateStr()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  if (typeof showToast === "function") showToast("Full JSON Backup Exported!", "success");
}

function importAppDataJSON(file) {
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const imported = JSON.parse(e.target.result);
      if (imported.tasks) saveTasks(imported.tasks);
      if (imported.notes) saveNotes(imported.notes);
      if (imported.goals) saveGoals(imported.goals);
      if (imported.projects) saveProjects(imported.projects);
      if (imported.vaultNotes) persistVaultNotes(imported.vaultNotes);
      if (imported.timeBlocks) saveTimeBlocks(imported.timeBlocks);
      if (imported.globalStreak) saveGlobalStreakState(imported.globalStreak);

      if (typeof showToast === "function") showToast("Data Restored Successfully!", "success");
      setTimeout(() => location.reload(), 1000);
    } catch (err) {
      if (typeof showToast === "function") showToast("Invalid Backup File Format", "error");
    }
  };
  reader.readAsText(file);
}

function getCalendarById(id) {
  const list = loadCalendars();
  return list.find(c => c.id === id || c.name.toLowerCase() === id.toLowerCase()) || { id, name: id, color: "#38BDF8" };
}

const ALL_DASHBOARD_CARDS = [
  { id: "mits", name: "Today's Focus (Top 3 MITs)" },
  { id: "timeline", name: "Today's Schedule & Timeline" },
  { id: "goal", name: "Active OKR Goal" },
  { id: "project", name: "Active Project Workspace" },
  { id: "deadlines", name: "Upcoming Deadlines" },
  { id: "insights", name: "Intelligent Workspace Insights" }
];

function getVisibleDashboardCards() {
  try {
    const raw = localStorage.getItem(STORAGE_DASHBOARD_CARDS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return ALL_DASHBOARD_CARDS.map(c => c.id);
}

function saveVisibleDashboardCards(cardsArray) {
  localStorage.setItem(STORAGE_DASHBOARD_CARDS, JSON.stringify(cardsArray));
}

// Initialize Storage, Run Idempotent Migration, and Load Memory Cache
async function initApplicationStorage() {
  try {
    await openDB();
    if (typeof checkAndRunStorageMigration === "function") {
      await checkAndRunStorageMigration();
    }
    await loadAllFromRepositoriesIntoMemory();
  } catch (err) {
    console.error("Failed to initialize application storage:", err);
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("DOMContentLoaded", async () => {
    await initApplicationStorage();
  });
}
