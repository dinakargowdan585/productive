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
          if (typeof switchView === "function") {
            const activeView = document.querySelector(".dock-item.active")?.dataset?.view || "dashboard";
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

    if (typeof SyncQueue !== "undefined") {
      SyncQueue.getQueue().then(queue => {
        if (popoverQueue) popoverQueue.textContent = `${queue.length} pending`;
      }).catch(() => {});
    }

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
    return {
      id: ensureValidUuid(task.id),
      user_id: userId,
      title: task.title || "Untitled Task",
      notes: task.notes || task.description || null,
      category: task.category || "work",
      priority: (task.priority || "MED").toUpperCase(),
      due_date: task.dueDate || task.due_date || null,
      is_daily: Boolean(task.isDaily || task.is_daily),
      completed: Boolean(task.completed),
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
      title: note.title || "Untitled Note",
      content: note.content || "",
      category: note.category || "general",
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

      // 1. Sync Tasks (Push & Pull)
      if (typeof TasksRepository !== "undefined") {
        try {
          const localTasks = await TasksRepository.getAll();
          if (localTasks && localTasks.length) {
            const formatted = localTasks.map(t => this.formatTaskForCloud(t, user.id));
            await client.from("tasks").upsert(formatted, { onConflict: "id" });
          }
          const { data: remoteTasks } = await client.from("tasks").select("*").eq("user_id", user.id).is("deleted_at", null);
          if (remoteTasks && remoteTasks.length) {
            const localFormatted = remoteTasks.map(t => ({
              id: t.id,
              title: t.title,
              notes: t.notes || null,
              category: t.category || "work",
              priority: t.priority || "MED",
              dueDate: t.due_date || null,
              isDaily: Boolean(t.is_daily),
              completed: Boolean(t.completed),
              estimateMins: t.estimate_mins || 30,
              createdAt: t.created_at,
              updatedAt: t.updated_at
            }));
            await TasksRepository.bulkPut(localFormatted);
          }
        } catch (taskErr) {
          console.warn("Task sync notice:", taskErr);
        }
      }

      // 2. Sync Notes (Push & Pull)
      if (typeof NotesRepository !== "undefined") {
        try {
          const localNotes = await NotesRepository.getAll();
          if (localNotes && localNotes.length) {
            const formatted = localNotes.map(n => this.formatNoteForCloud(n, user.id));
            await client.from("notes").upsert(formatted, { onConflict: "id" });
          }
          const { data: remoteNotes } = await client.from("notes").select("*").eq("user_id", user.id).is("deleted_at", null);
          if (remoteNotes && remoteNotes.length) {
            const localFormatted = remoteNotes.map(n => ({
              id: n.id,
              title: n.title,
              content: n.content || "",
              category: n.category || "general",
              tags: Array.isArray(n.tags) ? n.tags : [],
              isPinned: Boolean(n.is_pinned),
              isVault: Boolean(n.is_vault),
              createdAt: n.created_at,
              updatedAt: n.updated_at
            }));
            await NotesRepository.bulkPut(localFormatted);
          }
        } catch (noteErr) {
          console.warn("Note sync notice:", noteErr);
        }
      }

      // 3. Sync Projects (Push & Pull)
      if (typeof ProjectsRepository !== "undefined") {
        try {
          const localProjects = await ProjectsRepository.getAll();
          if (localProjects && localProjects.length) {
            const formatted = localProjects.map(p => this.formatProjectForCloud(p, user.id));
            await client.from("projects").upsert(formatted, { onConflict: "id" });
          }
          const { data: remoteProjects } = await client.from("projects").select("*").eq("user_id", user.id).is("deleted_at", null);
          if (remoteProjects && remoteProjects.length) {
            const localFormatted = remoteProjects.map(p => ({
              id: p.id,
              title: p.name || p.title,
              cat: "Work",
              description: p.description || null,
              color: p.color || "#38BDF8",
              status: p.status || "ACTIVE",
              createdAt: p.created_at,
              updatedAt: p.updated_at
            }));
            await ProjectsRepository.bulkPut(localFormatted);
          }
        } catch (projErr) {
          console.warn("Project sync notice:", projErr);
        }
      }

      // 4. Sync Time Blocks (Push & Pull)
      if (typeof TimeBlocksRepository !== "undefined") {
        try {
          const localBlocks = await TimeBlocksRepository.getAll();
          if (localBlocks && localBlocks.length) {
            const formatted = localBlocks.map(tb => this.formatTimeBlockForCloud(tb, user.id));
            await client.from("time_blocks").upsert(formatted, { onConflict: "id" });
          }
          const { data: remoteBlocks } = await client.from("time_blocks").select("*").eq("user_id", user.id).is("deleted_at", null);
          if (remoteBlocks && remoteBlocks.length) {
            const localFormatted = remoteBlocks.map(tb => ({
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
            await TimeBlocksRepository.bulkPut(localFormatted);
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

      // Refresh active view
      if (typeof switchView === "function") {
        const activeView = document.querySelector(".dock-item.active")?.dataset?.view || "dashboard";
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
