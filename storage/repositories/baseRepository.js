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
        req.onsuccess = () => resolve(item);
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
        req.onsuccess = () => resolve(updated);
        req.onerror = (e) => reject(e.target.error);
      });
    },

    async delete(id) {
      const store = await getStore(storeName, "readwrite");
      return new Promise((resolve, reject) => {
        const req = store.delete(id);
        req.onsuccess = () => resolve(true);
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

    async clear() {
      const store = await getStore(storeName, "readwrite");
      return new Promise((resolve, reject) => {
        const req = store.clear();
        req.onsuccess = () => resolve(true);
        req.onerror = (e) => reject(e.target.error);
      });
    },

    async clearAndPut(items) {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);
        store.clear();
        (items || []).forEach(item => {
          item.updatedAt = item.updatedAt || new Date().toISOString();
          store.put(item);
        });
        tx.oncomplete = () => resolve(true);
        tx.onerror = (e) => reject(e.target.error);
      });
    },

    async saveAll(items) {
      return this.bulkPut(items);
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
const TimeBlocksRepository = createRepository("timeBlocks");
const ProjectsRepository = createRepository("projects");
const GoalsRepository = createRepository("goals");
const VaultNotesRepository = createRepository("vaultNotes");
const SettingsRepository = createRepository("settings");


