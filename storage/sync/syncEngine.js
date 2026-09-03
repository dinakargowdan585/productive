/* Productive OS - Robust Bi-Directional Cloud Sync Engine */

function isValidUuid(id) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id || ""));
}

function ensureValidUuid(id) {
  if (isValidUuid(id)) return id;
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === "x" ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

const DELETED_IDS_STORAGE_KEY = "productive_deleted_ids_v1";

function getDeletedRecordIds(storeName) {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(DELETED_IDS_STORAGE_KEY) : null;
    const map = raw ? JSON.parse(raw) : {};
    return map[storeName] || [];
  } catch (e) {
    return [];
  }
}

function recordLocalDeletion(storeName, id) {
  if (!id) return;
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(DELETED_IDS_STORAGE_KEY) : null;
    const map = raw ? JSON.parse(raw) : {};
    if (!map[storeName]) map[storeName] = [];
    if (!map[storeName].includes(id)) {
      map[storeName].push(id);
    }
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(DELETED_IDS_STORAGE_KEY, JSON.stringify(map));
    }
  } catch (e) {
    console.warn("Error recording local deletion:", e);
  }
}

function clearDeletedRecordIds(storeName, idsToClear = []) {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(DELETED_IDS_STORAGE_KEY) : null;
    const map = raw ? JSON.parse(raw) : {};
    if (map[storeName]) {
      if (idsToClear && idsToClear.length) {
        map[storeName] = map[storeName].filter(id => !idsToClear.includes(id));
      } else {
        delete map[storeName];
      }
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(DELETED_IDS_STORAGE_KEY, JSON.stringify(map));
      }
    }
  } catch (e) {}
}

const ConflictResolver = {
  resolve(localRecord, remoteRecord) {
    if (!remoteRecord) return localRecord;
    if (!localRecord) return remoteRecord;
    const localDeleted = localRecord.deletedAt ? new Date(localRecord.deletedAt).getTime() : 0;
    const remoteDeleted = (remoteRecord.deleted_at || remoteRecord.deletedAt) ? new Date(remoteRecord.deleted_at || remoteRecord.deletedAt).getTime() : 0;
    const localUpdated = new Date(localRecord.updatedAt || localRecord.created_at || 0).getTime();
    const remoteUpdated = new Date(remoteRecord.updated_at || remoteRecord.updatedAt || remoteRecord.created_at || 0).getTime();
    const localMax = Math.max(localDeleted, localUpdated);
    const remoteMax = Math.max(remoteDeleted, remoteUpdated);
    if (localMax > remoteMax) return localRecord;
    if (remoteMax > localMax) return remoteRecord;
    return String(localRecord.id || "").localeCompare(String(remoteRecord.id || "")) >= 0 ? localRecord : remoteRecord;
  }
};

let syncBroadcastChannel = null;
if (typeof BroadcastChannel !== "undefined") {
  syncBroadcastChannel = new BroadcastChannel("productive_sync_channel");
  syncBroadcastChannel.onmessage = (event) => {
    if (event.data && event.data.type === "DATA_UPDATED") {
      console.log("📡 Cross-tab sync update received from tab:", event.data.sender);
      if (typeof loadAllFromRepositoriesIntoMemory === "function") {
        loadAllFromRepositoriesIntoMemory().then(() => {
          const activeView = (typeof getCurrentActiveView === "function") 
            ? getCurrentActiveView() 
            : (document.querySelector(".dock-item.active")?.dataset?.view || (document.querySelector(".dock-item.active")?.id ? document.querySelector(".dock-item.active").id.replace("dock", "").toLowerCase() : "dashboard"));
          if (typeof switchView === "function") {
            switchView(activeView);
          }
        }).catch(() => {});
      }
    }
  };
}

const SyncEngine = {
  state: "synced", // "synced" | "syncing" | "offline" | "error"
  lastSyncedAt: typeof localStorage !== "undefined" ? localStorage.getItem("productive_last_sync") || null : null,
  isSyncingActive: false, // Mutex lock
  listeners: [],

  broadcastDataUpdate() {
    if (syncBroadcastChannel) {
      syncBroadcastChannel.postMessage({ type: "DATA_UPDATED", sender: Date.now() });
    }
  },

  onStateChange(fn) {
    if (typeof fn === "function") this.listeners.push(fn);
  },

  updateState(newState, meta = {}) {
    this.state = newState;
    this.listeners.forEach(fn => fn(this.state, { lastSyncedAt: this.lastSyncedAt, ...meta }));
    this.updateStatusUI();
  },

  updateStatusUI() {
    const dot = document.getElementById("syncStatusDot");
    const label = document.getElementById("syncStatusLabel");
    const popoverLastSync = document.getElementById("syncPopoverLastSync");
    const popoverQueue = document.getElementById("syncPopoverQueueCount");
    const popoverConn = document.getElementById("syncPopoverConnection");

    if (popoverConn) popoverConn.textContent = navigator.onLine ? "Online" : "Offline";
    if (popoverQueue) popoverQueue.textContent = this.state === "syncing" ? "Syncing..." : "Up to date";

    if (popoverLastSync) {
      popoverLastSync.textContent = this.lastSyncedAt ? new Date(this.lastSyncedAt).toLocaleTimeString() : "Never";
    }

    if (!dot || !label) return;

    if (!navigator.onLine) {
      dot.style.background = "var(--muted)";
      label.textContent = "Offline";
      return;
    }

    if (this.state === "syncing") {
      dot.style.background = "var(--amber)";
      label.textContent = "Syncing…";
    } else if (this.state === "error") {
      dot.style.background = "var(--danger)";
      label.textContent = "Sync Error";
    } else {
      dot.style.background = "var(--green)";
      label.textContent = "Synced";
    }
  },

  formatTaskForCloud(task, userId) {
    const todayIso = getIsoDateStr();
    const isDaily = Boolean(task.isDaily || task.is_daily);
    let isCompletedToday = false;
    if (isDaily) {
      isCompletedToday = Array.isArray(task.completedDates) ? task.completedDates.includes(todayIso) : (task.lastCompletedDate === todayIso);
    } else {
      isCompletedToday = Boolean(task.completed);
    }

    let combinedNotes = task.notes || task.description || "";
    try {
      let existingObj = {};
      if (typeof combinedNotes === "string" && combinedNotes.startsWith("{") && combinedNotes.includes('"__streak"')) {
        existingObj = JSON.parse(combinedNotes);
      }
      existingObj.__streak = parseInt(task.streak, 10) || 0;
      existingObj.__lastCompletedDate = task.lastCompletedDate || null;
      if (Array.isArray(task.completedDates)) existingObj.completedDates = task.completedDates;
      if (Array.isArray(task.subtasks)) existingObj.subtasks = task.subtasks;
      if (task.description) existingObj.description = task.description;
      combinedNotes = JSON.stringify(existingObj);
    } catch (e) {}

    return {
      id: ensureValidUuid(task.id),
      user_id: userId,
      title: task.title || "Untitled Task",
      notes: combinedNotes || null,
      category: task.category || "work",
      priority: (task.priority || "MED").toUpperCase(),
      due_date: task.dueDate || task.due_date || null,
      is_daily: isDaily,
      completed: isCompletedToday,
      estimate_mins: parseInt(task.estimateMins || task.estimate_mins, 10) || 30,
      created_at: task.createdAt || task.created_at || new Date().toISOString(),
      updated_at: task.updatedAt || task.updated_at || new Date().toISOString(),
      deleted_at: task.deletedAt || task.deleted_at || null
    };
  },

  formatNoteForCloud(note, userId) {
    return {
      id: ensureValidUuid(note.id),
      user_id: userId,
      title: note.title || note.topic || "Untitled Note",
      content: note.content || note.takeaway || "",
      category: note.category || "General",
      tags: Array.isArray(note.tags) ? note.tags : [],
      is_pinned: Boolean(note.isPinned || note.is_pinned),
      is_vault: Boolean(note.isVault || note.is_vault),
      created_at: note.createdAt || note.created_at || new Date().toISOString(),
      updated_at: note.updatedAt || note.updated_at || new Date().toISOString(),
      deleted_at: note.deletedAt || note.deleted_at || null
    };
  },

  formatProjectForCloud(proj, userId) {
    return {
      id: ensureValidUuid(proj.id),
      user_id: userId,
      name: proj.name || proj.title || "Untitled Project",
      description: proj.description || null,
      color: proj.color || "#38BDF8",
      status: (proj.status || "ACTIVE").toUpperCase(),
      created_at: proj.createdAt || proj.created_at || new Date().toISOString(),
      updated_at: proj.updatedAt || proj.updated_at || new Date().toISOString(),
      deleted_at: proj.deletedAt || proj.deleted_at || null
    };
  },

  formatTimeBlockForCloud(tb, userId) {
    let startTime = String(tb.startTime || tb.start_time || "09:00:00").trim();
    if (startTime.length === 5 && startTime.includes(":")) startTime += ":00";
    if (!startTime.includes(":")) startTime = "09:00:00";

    const d = new Date();
    const defaultDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

    return {
      id: ensureValidUuid(tb.id),
      user_id: userId,
      title: tb.title || "Focus Session",
      date: tb.date || defaultDate,
      start_time: startTime,
      duration_minutes: parseInt(tb.durationMinutes || tb.duration_minutes || tb.durationMins || 60, 10) || 60,
      category: tb.category || "Deep Work",
      completed: Boolean(tb.completed),
      created_at: tb.createdAt || tb.created_at || new Date().toISOString(),
      updated_at: tb.updatedAt || tb.updated_at || new Date().toISOString(),
      deleted_at: tb.deletedAt || tb.deleted_at || null
    };
  },

  async triggerSync() {
    if (this.isSyncingActive) {
      console.log("🔒 Sync Engine already running.");
      return false;
    }
    if (!navigator.onLine) {
      this.updateState("offline");
      return false;
    }
    if (typeof getSupabaseUser !== "function") return false;

    const user = await getSupabaseUser();
    if (!user || !user.id) {
      this.updateState("offline");
      return false;
    }

    const client = typeof getSupabase === "function" ? getSupabase() : null;
    if (!client) return false;

    this.isSyncingActive = true;
    this.updateState("syncing");

    try {
      console.log("⚡ Executing Full 2-Way Cloud Sync for User:", user.email || user.id);

      // 1. Sync Tasks (Push & Pull with Multi-Device Deletion Sync)
      if (typeof TasksRepository !== "undefined") {
        try {
          const deletedTaskIds = getDeletedRecordIds("tasks");
          if (deletedTaskIds && deletedTaskIds.length) {
            for (const delId of deletedTaskIds) {
              await client.from("tasks").delete().eq("id", delId).eq("user_id", user.id);
            }
            clearDeletedRecordIds("tasks", deletedTaskIds);
          }

          const localTasks = await TasksRepository.getAll();
          const activeLocal = (localTasks || []).filter(t => !deletedTaskIds.includes(t.id));

          // Step A: Push active local modifications to Cloud FIRST
          if (activeLocal.length > 0) {
            const formatted = activeLocal.map(t => this.formatTaskForCloud(t, user.id));
            await client.from("tasks").upsert(formatted, { onConflict: "id" });
          }

          // Step B: Pull latest state from Cloud AFTER push
          const { data: remoteTasks } = await client.from("tasks").select("*").eq("user_id", user.id);
          const activeRemote = (remoteTasks || []).filter(t => !t.deleted_at && !deletedTaskIds.includes(t.id));

          if (activeRemote.length === 0) {
            await TasksRepository.clear();
          } else {
            const localFormatted = activeRemote.map(t => {
              let streak = 0;
              let lastCompletedDate = null;
              let notesText = t.notes || null;
              let subtasks = [];
              let completedDates = [];
              if (notesText && typeof notesText === "string" && notesText.startsWith("{") && notesText.includes('"__streak"')) {
                try {
                  const parsed = JSON.parse(notesText);
                  streak = parseInt(parsed.__streak, 10) || 0;
                  lastCompletedDate = parsed.__lastCompletedDate || null;
                  if (Array.isArray(parsed.completedDates)) completedDates = parsed.completedDates;
                  if (Array.isArray(parsed.subtasks)) subtasks = parsed.subtasks;
                  notesText = parsed.description || null;
                } catch (e) {}
              }
              const todayIso = getIsoDateStr();
              const isDaily = Boolean(t.is_daily);
              let isCompletedToday = false;
              if (isDaily) {
                isCompletedToday = completedDates.includes(todayIso) || (lastCompletedDate === todayIso);
              } else {
                isCompletedToday = Boolean(t.completed);
              }
              return {
                id: t.id,
                title: t.title,
                notes: notesText,
                category: t.category || "work",
                priority: t.priority || "MED",
                dueDate: t.due_date || null,
                isDaily: isDaily,
                completed: isCompletedToday,
                streak: streak,
                lastCompletedDate: lastCompletedDate,
                completedDates: completedDates,
                subtasks: subtasks,
                estimateMins: t.estimate_mins || 30,
                createdAt: t.created_at,
                updatedAt: t.updated_at
              };
            });
            await TasksRepository.clearAndPut(localFormatted);
          }
        } catch (taskErr) {
          console.warn("Task sync notice:", taskErr);
        }
      }

      // 2. Sync Notes (Push & Pull with Multi-Device Deletion Sync)
      if (typeof NotesRepository !== "undefined") {
        try {
          const deletedNoteIds = getDeletedRecordIds("notes");
          if (deletedNoteIds && deletedNoteIds.length) {
            for (const delId of deletedNoteIds) {
              await client.from("notes").delete().eq("id", delId).eq("user_id", user.id);
            }
            clearDeletedRecordIds("notes", deletedNoteIds);
          }

          const localNotes = await NotesRepository.getAll();
          const activeLocal = (localNotes || []).filter(n => !deletedNoteIds.includes(n.id));

          if (activeLocal.length > 0) {
            const formatted = activeLocal.map(n => this.formatNoteForCloud(n, user.id));
            await client.from("notes").upsert(formatted, { onConflict: "id" });
          }

          const { data: remoteNotes } = await client.from("notes").select("*").eq("user_id", user.id);
          const activeRemote = (remoteNotes || []).filter(n => !n.deleted_at && !deletedNoteIds.includes(n.id));

          if (activeRemote.length === 0) {
            await NotesRepository.clear();
          } else {
            const localFormatted = activeRemote.map(n => ({
              id: n.id,
              title: n.title || "Untitled Note",
              topic: n.title || "Untitled Note",
              content: n.content || "",
              takeaway: n.content || "",
              category: n.category || "General",
              tags: Array.isArray(n.tags) ? n.tags : [],
              isPinned: Boolean(n.is_pinned),
              isVault: Boolean(n.is_vault),
              createdAt: n.created_at,
              updatedAt: n.updated_at
            }));
            await NotesRepository.clearAndPut(localFormatted);
          }
        } catch (noteErr) {
          console.warn("Note sync notice:", noteErr);
        }
      }

      // 3. Sync Projects (Push & Pull with Multi-Device Deletion Sync)
      if (typeof ProjectsRepository !== "undefined") {
        try {
          const deletedProjIds = getDeletedRecordIds("projects");
          if (deletedProjIds && deletedProjIds.length) {
            for (const delId of deletedProjIds) {
              await client.from("projects").delete().eq("id", delId).eq("user_id", user.id);
            }
            clearDeletedRecordIds("projects", deletedProjIds);
          }

          const localProjects = await ProjectsRepository.getAll();
          const activeLocal = (localProjects || []).filter(p => !deletedProjIds.includes(p.id));

          if (activeLocal.length > 0) {
            const formatted = activeLocal.map(p => this.formatProjectForCloud(p, user.id));
            await client.from("projects").upsert(formatted, { onConflict: "id" });
          }

          const { data: remoteProjects } = await client.from("projects").select("*").eq("user_id", user.id);
          const activeRemote = (remoteProjects || []).filter(p => !p.deleted_at && !deletedProjIds.includes(p.id));

          if (activeRemote.length === 0) {
            await ProjectsRepository.clear();
          } else {
            const localFormatted = activeRemote.map(p => ({
              id: p.id,
              title: p.name || p.title,
              cat: "Work",
              description: p.description || null,
              color: p.color || "#38BDF8",
              status: p.status || "ACTIVE",
              createdAt: p.created_at,
              updatedAt: p.updated_at
            }));
            await ProjectsRepository.clearAndPut(localFormatted);
          }
        } catch (projErr) {
          console.warn("Project sync notice:", projErr);
        }
      }

      // 4. Sync Time Blocks (Push & Pull with Multi-Device Deletion Sync)
      if (typeof TimeBlocksRepository !== "undefined") {
        try {
          const deletedTbIds = getDeletedRecordIds("time_blocks");
          if (deletedTbIds && deletedTbIds.length) {
            for (const delId of deletedTbIds) {
              await client.from("time_blocks").delete().eq("id", delId).eq("user_id", user.id);
            }
            clearDeletedRecordIds("time_blocks", deletedTbIds);
          }

          const localBlocks = await TimeBlocksRepository.getAll();
          const activeLocal = (localBlocks || []).filter(tb => !deletedTbIds.includes(tb.id));

          if (activeLocal.length > 0) {
            const formatted = activeLocal.map(tb => this.formatTimeBlockForCloud(tb, user.id));
            await client.from("time_blocks").upsert(formatted, { onConflict: "id" });
          }

          const { data: remoteBlocks } = await client.from("time_blocks").select("*").eq("user_id", user.id);
          const activeRemote = (remoteBlocks || []).filter(tb => !tb.deleted_at && !deletedTbIds.includes(tb.id));

          if (activeRemote.length === 0) {
            await TimeBlocksRepository.clear();
          } else {
            const localFormatted = activeRemote.map(tb => ({
              id: tb.id,
              title: tb.title,
              date: tb.date,
              startTime: tb.start_time ? tb.start_time.slice(0, 5) : "09:00",
              durationMinutes: tb.duration_minutes || 60,
              category: tb.category || "Deep Work",
              completed: Boolean(tb.completed),
              createdAt: tb.created_at,
              updatedAt: tb.updated_at
            }));
            await TimeBlocksRepository.clearAndPut(localFormatted);
          }
        } catch (tbErr) {
          console.warn("TimeBlock sync notice:", tbErr);
        }
      }

      // 5. Reload memory cache and refresh UI
      if (typeof loadAllFromRepositoriesIntoMemory === "function") {
        await loadAllFromRepositoriesIntoMemory();
      }

      this.lastSyncedAt = new Date().toISOString();
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("productive_last_sync", this.lastSyncedAt);
      }

      this.updateState("synced");
      this.broadcastDataUpdate();

      // Refresh active view without jumping back to dashboard
      const activeView = (typeof getCurrentActiveView === "function") 
        ? getCurrentActiveView() 
        : (document.querySelector(".dock-item.active")?.dataset?.view || (document.querySelector(".dock-item.active")?.id ? document.querySelector(".dock-item.active").id.replace("dock", "").toLowerCase() : "dashboard"));

      if (typeof switchView === "function") {
        switchView(activeView);
      }

      return true;
    } catch (err) {
      console.error("Cloud Sync Execution Error:", err);
      this.updateState("error", { error: err });
      return false;
    } finally {
      this.isSyncingActive = false;
    }
  }
};

// Network status listeners
if (typeof window !== "undefined") {
  window.SyncEngine = SyncEngine;
  window.addEventListener("online", () => {
    console.log("🌐 Network online detected. Triggering Sync Engine...");
    SyncEngine.triggerSync();
  });

  window.addEventListener("offline", () => {
    console.log("📡 Network offline detected.");
    SyncEngine.updateState("offline");
  });
}
