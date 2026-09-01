/* Productive OS - Sync Engine with Mutex Lock, Coalescing & BroadcastChannel Sync */

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

const STORE_TO_TABLE_MAP = {
  tasks: "tasks",
  notes: "notes",
  projects: "projects",
  goals: "goals",
  vaultNotes: "notes",
  timeBlocks: "time_blocks",
  settings: "user_settings"
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

  async triggerSync() {
    // Atomic Mutex Lock Check
    if (this.isSyncingActive) {
      console.log("🔒 Sync Engine execution already locked by active run.");
      return false;
    }
    if (!navigator.onLine) {
      this.updateState("offline");
      return false;
    }
    if (typeof getSupabaseUser !== "function") return false;

    const user = await getSupabaseUser();
    if (!user) {
      this.updateState("offline");
      return false;
    }

    this.isSyncingActive = true; // Mutex Lock Acquired
    this.updateState("syncing");

    try {
      // 1. Process local pending queue with coalescing
      await this.processPendingQueue(user.id);

      // 2. Incremental remote pull
      await this.pullRemoteChanges(user.id);

      this.lastSyncedAt = new Date().toISOString();
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("productive_last_sync", this.lastSyncedAt);
      }
      this.updateState("synced");
      this.broadcastDataUpdate();
      return true;
    } catch (err) {
      console.error("Sync Engine Execution Error:", err);
      this.updateState("error", { error: err });
      return false;
    } finally {
      this.isSyncingActive = false; // Mutex Lock Released
    }
  },

  async processPendingQueue(userId) {
    if (typeof SyncQueue === "undefined") return;
    const queue = await SyncQueue.getQueue(userId);
    if (!queue.length) return;

    const client = typeof getSupabase === "function" ? getSupabase() : null;
    if (!client) return;

    // Coalesce rapid consecutive updates for the same (tableName, recordId)
    const coalescedMap = new Map();
    queue.forEach(item => {
      const key = `${item.tableName}:${item.recordId}`;
      coalescedMap.set(key, item); // Keeps latest payload
    });

    const itemsToUpload = Array.from(coalescedMap.values());

    for (const item of itemsToUpload) {
      const table = STORE_TO_TABLE_MAP[item.tableName] || item.tableName;
      try {
        if (item.operation === "DELETE") {
          await client.from(table).update({ deleted_at: new Date().toISOString() }).eq("id", item.recordId);
        } else {
          const rowData = {
            ...item.payload,
            user_id: userId,
            updated_at: item.payload.updatedAt || new Date().toISOString()
          };
          delete rowData.createdAt;
          delete rowData.updatedAt;
          await client.from(table).upsert(rowData);
        }

        await SyncQueue.removeQueueItem(item.id);
      } catch (err) {
        console.warn(`Failed queue upload for ${item.tableName}:${item.recordId}`, err);
        await SyncQueue.updateItemAttempts(item.id, (item.attempts || 0) + 1, err.message || String(err));
      }
    }
  },

  async pullRemoteChanges(userId) {
    const client = typeof getSupabase === "function" ? getSupabase() : null;
    if (!client) return;

    for (const [storeName, tableName] of Object.entries(STORE_TO_TABLE_MAP)) {
      try {
        let query = client.from(tableName).select("*").eq("user_id", userId);
        if (this.lastSyncedAt) {
          query = query.gt("updated_at", this.lastSyncedAt);
        }

        const { data, error } = await query;
        if (error || !data || !data.length) continue;

        for (const remoteRow of data) {
          const localRecord = await getStore(storeName, "readonly").then(s => new Promise(res => {
            const req = s.get(remoteRow.id);
            req.onsuccess = () => res(req.result || null);
            req.onerror = () => res(null);
          }));

          const winner = typeof ConflictResolver !== "undefined" 
            ? ConflictResolver.resolve(localRecord, remoteRow) 
            : remoteRow;

          if (winner === remoteRow) {
            const writeStore = await getStore(storeName, "readwrite");
            writeStore.put(winner);
          }
        }
      } catch (err) {
        console.warn(`Remote pull warning for ${storeName}:`, err);
      }
    }
  }
};

// Network status listeners
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    console.log("🌐 Network online detected. Triggering Sync Engine...");
    SyncEngine.triggerSync();
  });

  window.addEventListener("offline", () => {
    console.log("📡 Network offline detected.");
    SyncEngine.updateState("offline");
  });
}
