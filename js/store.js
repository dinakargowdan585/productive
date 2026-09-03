/* Application Service Layer & Storage Cache Controller */

const STORAGE_DASHBOARD_CARDS = "learningDashboardVisibleCards";
const DATA_SCHEMA_VERSION_KEY = "PRODUCTIVE_SCHEMA_VERSION";
const CURRENT_SCHEMA_VERSION = 4;

// Cache in memory for instantaneous sync reads across feature modules
let memoryCache = {
  tasks: null,
  notes: null,
  projects: null,
  goals: null,
  vaultNotes: null,
  timeBlocks: null,
  calendars: null
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

function isTaskCompletedOnDate(t, dateStr) {
  if (!t) return false;
  const targetDate = dateStr || getIsoDateStr();
  const todayIso = getIsoDateStr();
  const isDaily = Boolean(t.isDaily || t.is_daily);
  if (isDaily) {
    if (Array.isArray(t.completedDates) && t.completedDates.length > 0) {
      return t.completedDates.includes(targetDate);
    }
    if (Boolean(t.completed) && (targetDate === todayIso || targetDate === t.lastCompletedDate)) {
      return true;
    }
    return false;
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

    console.log("⚡ Memory cache initialized from IndexedDB repositories.");
  } catch (err) {
    console.error("Failed to load memory cache from repositories:", err);
  }
}

// Synchronous and Asynchronous Loaders / Savers
function loadTasks() {
  return memoryCache.tasks || [];
}

function saveTasks(tasks) {
  memoryCache.tasks = tasks;
  if (typeof TasksRepository !== "undefined") {
    TasksRepository.bulkPut(tasks).catch(err => console.error("Tasks Repository save error:", err));
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
}

function loadNotes() {
  return memoryCache.notes || [];
}

function saveNotes(notes) {
  memoryCache.notes = notes;
  if (typeof NotesRepository !== "undefined") {
    NotesRepository.bulkPut(notes).catch(err => console.error("Notes Repository save error:", err));
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
}

function loadTimeBlocks() {
  return memoryCache.timeBlocks || [];
}

function saveTimeBlocks(blocks) {
  memoryCache.timeBlocks = blocks;
  if (typeof TimeBlocksRepository !== "undefined") {
    TimeBlocksRepository.bulkPut(blocks).catch(err => console.error("TimeBlocks Repository save error:", err));
  }
}

function loadGoals() {
  return memoryCache.goals || [];
}

function saveGoals(goals) {
  memoryCache.goals = goals;
  if (typeof GoalsRepository !== "undefined") {
    GoalsRepository.bulkPut(goals).catch(err => console.error("Goals Repository save error:", err));
  }
}

function loadProjects() {
  return memoryCache.projects || [];
}

function saveProjects(projects) {
  memoryCache.projects = projects;
  if (typeof ProjectsRepository !== "undefined") {
    ProjectsRepository.bulkPut(projects).catch(err => console.error("Projects Repository save error:", err));
  }
}

function loadVaultNotes() {
  return memoryCache.vaultNotes || [];
}

function persistVaultNotes(notes) {
  memoryCache.vaultNotes = notes;
  getStore("vaultNotes", "readwrite").then(store => {
    (notes || []).forEach(v => store.put(v));
  }).catch(err => console.error("Vault Notes save error:", err));
}

const DEFAULT_CALENDARS = [
  { id: "work", name: "Work & Engineering", color: "#38BDF8" },
  { id: "study", name: "Deep Study & Reading", color: "#A855F7" },
  { id: "personal", name: "Personal & Health", color: "#34C759" },
  { id: "vault", name: "Secrets & Credentials", color: "#FF3B30" }
];

function loadCalendars() {
  return memoryCache.calendars || DEFAULT_CALENDARS;
}

function saveCalendars(calendars) {
  memoryCache.calendars = calendars;
  if (typeof CalendarsRepository !== "undefined") {
    CalendarsRepository.bulkPut(calendars).catch(err => console.error("Calendars Repository save error:", err));
  }
}

function exportAppDataJSON() {
  const exportData = {
    app: "ProductiveOS",
    version: "2.0.0",
    exportedAt: new Date().toISOString(),
    tasks: loadTasks(),
    notes: loadNotes(),
    goals: loadGoals(),
    projects: loadProjects(),
    vaultNotes: loadVaultNotes(),
    timeBlocks: loadTimeBlocks(),
    calendars: loadCalendars()
  };

  const jsonStr = JSON.stringify(exportData, null, 2);
  const blob = new Blob([jsonStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `productive_os_backup_${getIsoDateStr()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  if (typeof showToast === "function") showToast("💾 Full JSON Backup Exported!", "success");
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

      if (typeof showToast === "function") showToast("✅ Data Restored Successfully!", "success");
      setTimeout(() => location.reload(), 1000);
    } catch (err) {
      if (typeof showToast === "function") showToast("❌ Invalid Backup File Format", "error");
    }
  };
  reader.readAsText(file);
}

function getCalendarById(id) {
  const list = loadCalendars();
  return list.find(c => c.id === id || c.name.toLowerCase() === id.toLowerCase()) || { id, name: id, color: "#38BDF8" };
}

const ALL_DASHBOARD_CARDS = [
  { id: "mits", name: "🎯 Today's Focus (Top 3 MITs)" },
  { id: "timeline", name: "⏱️ Today's Schedule & Timeline" },
  { id: "goal", name: "🎯 Active OKR Goal" },
  { id: "project", name: "🏢 Active Project Workspace" },
  { id: "deadlines", name: "⏳ Upcoming Deadlines" },
  { id: "insights", name: "🧠 Intelligent Workspace Insights" }
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
