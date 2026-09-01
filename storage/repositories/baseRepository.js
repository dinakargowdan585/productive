/* Generic IDB Base Repository Factory */

function createRepository(storeName) {
  return {
    async getAll() {
      const store = await getStore(storeName, "readonly");
      return new Promise((resolve, reject) => {
        const req = store.getAll();
        req.onsuccess = () => {
          const records = req.result || [];
          resolve(records.filter(r => !r.deletedAt));
        };
        req.onerror = (e) => reject(e.target.error);
      });
    },

    async getById(id) {
      const store = await getStore(storeName, "readonly");
      return new Promise((resolve, reject) => {
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = (e) => reject(e.target.error);
      });
    },

    async create(item) {
      item.updatedAt = item.updatedAt || new Date().toISOString();
      const store = await getStore(storeName, "readwrite");
      return new Promise((resolve, reject) => {
        const req = store.put(item);
        req.onsuccess = () => {
          if (typeof SyncQueue !== "undefined") {
            SyncQueue.enqueue("CREATE", storeName, item.id, item).catch(() => {});
          }
          resolve(item);
        };
        req.onerror = (e) => reject(e.target.error);
      });
    },

    async update(id, changes) {
      const existing = await this.getById(id);
      if (!existing) throw new Error(`${storeName} ${id} not found`);
      const updated = { ...existing, ...changes, updatedAt: new Date().toISOString() };
      const store = await getStore(storeName, "readwrite");
      return new Promise((resolve, reject) => {
        const req = store.put(updated);
        req.onsuccess = () => {
          if (typeof SyncQueue !== "undefined") {
            SyncQueue.enqueue("UPDATE", storeName, id, updated).catch(() => {});
          }
          resolve(updated);
        };
        req.onerror = (e) => reject(e.target.error);
      });
    },

    async delete(id) {
      const store = await getStore(storeName, "readwrite");
      return new Promise((resolve, reject) => {
        const req = store.delete(id);
        req.onsuccess = () => {
          if (typeof SyncQueue !== "undefined") {
            SyncQueue.enqueue("DELETE", storeName, id, { id, deletedAt: new Date().toISOString() }).catch(() => {});
          }
          resolve(true);
        };
        req.onerror = (e) => reject(e.target.error);
      });
    },

    async bulkPut(items) {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);
        tx.oncomplete = () => resolve(true);
        tx.onerror = (e) => reject(e.target.error);
        (items || []).forEach(item => {
          item.updatedAt = item.updatedAt || new Date().toISOString();
          store.put(item);
        });
      });
    },

    async count() {
      const store = await getStore(storeName, "readonly");
      return new Promise((resolve, reject) => {
        const req = store.count();
        req.onsuccess = () => resolve(req.result);
        req.onerror = (e) => reject(e.target.error);
      });
    }
  };
}

/* Pre-instantiated Global Repositories */
const NotesRepository = createRepository("notes");
const TasksRepository = createRepository("tasks");
const CalendarsRepository = createRepository("calendars");
const TimeBlocksRepository = createRepository("time_blocks");
const ProjectsRepository = createRepository("projects");
const GoalsRepository = createRepository("goals");
const SettingsRepository = createRepository("settings");

