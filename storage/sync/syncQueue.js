/* Productive OS - User-Scoped Sync Queue Manager with Idempotent Operation IDs */

function generateOpId() {
  return "op-" + Math.random().toString(36).substr(2, 9) + "-" + Date.now().toString(36);
}

const SyncQueue = {
  async enqueue(operation, tableName, recordId, payload, userId = null) {
    const store = await getStore("sync_queue", "readwrite");
    const activeUser = userId || (typeof getSupabaseUser === "function" ? (await getSupabaseUser())?.id : null) || "guest";
    
    return new Promise((resolve, reject) => {
      const item = {
        operationId: generateOpId(),
        operation, // "CREATE" | "UPDATE" | "DELETE"
        tableName, // "tasks" | "notes" | "projects" etc.
        recordId,
        payload,
        userId: activeUser,
        createdAt: new Date().toISOString(),
        attempts: 0,
        lastError: null
      };
      const request = store.add(item);
      request.onsuccess = () => resolve(request.result);
      request.onerror = (e) => reject(e.target.error);
    });
  },

  async getQueue(userId = null) {
    const store = await getStore("sync_queue", "readonly");
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const records = request.result || [];
        if (!userId) resolve(records);
        else resolve(records.filter(r => r.userId === userId || r.userId === "guest"));
      };
      request.onerror = (e) => reject(e.target.error);
    });
  },

  async removeQueueItem(id) {
    const store = await getStore("sync_queue", "readwrite");
    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve(true);
      request.onerror = (e) => reject(e.target.error);
    });
  },

  async clearUserQueue(userId) {
    if (!userId) return;
    const db = await openDB();
    const tx = db.transaction("sync_queue", "readwrite");
    const store = tx.objectStore("sync_queue");
    const req = store.getAll();
    req.onsuccess = () => {
      const items = req.result || [];
      items.forEach(item => {
        if (item.userId === userId) {
          store.delete(item.id);
        }
      });
    };
  },

  async updateItemAttempts(id, attempts, errorMsg) {
    const store = await getStore("sync_queue", "readwrite");
    return new Promise((resolve, reject) => {
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const item = getReq.result;
        if (!item) return resolve(false);
        item.attempts = attempts;
        item.lastError = errorMsg;
        const putReq = store.put(item);
        putReq.onsuccess = () => resolve(true);
        putReq.onerror = (e) => reject(e.target.error);
      };
      getReq.onerror = (e) => reject(e.target.error);
    });
  }
};
