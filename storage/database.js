/* Productive OS - Database Initialization & Connection Manager */

const DB_NAME = "DinakarProductivityDB";
const DB_VERSION = 1;

let dbInstance = null;

function openDB() {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      return resolve(dbInstance);
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      console.log(`📦 Upgrading IndexedDB [${DB_NAME}] to version ${DB_VERSION}...`);

      // Notes Store
      if (!db.objectStoreNames.contains("notes")) {
        const store = db.createObjectStore("notes", { keyPath: "id" });
        store.createIndex("createdAt", "createdAt", { unique: false });
        store.createIndex("updatedAt", "updatedAt", { unique: false });
        store.createIndex("category", "category", { unique: false });
        store.createIndex("isPinned", "isPinned", { unique: false });
      }

      // Tasks Store
      if (!db.objectStoreNames.contains("tasks")) {
        const store = db.createObjectStore("tasks", { keyPath: "id" });
        store.createIndex("dueDate", "dueDate", { unique: false });
        store.createIndex("completed", "completed", { unique: false });
        store.createIndex("projectId", "projectId", { unique: false });
        store.createIndex("goalId", "goalId", { unique: false });
        store.createIndex("calendarId", "calendarId", { unique: false });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }

      // Calendars Store
      if (!db.objectStoreNames.contains("calendars")) {
        db.createObjectStore("calendars", { keyPath: "id" });
      }

      // TimeBlocks Store
      if (!db.objectStoreNames.contains("timeBlocks")) {
        const store = db.createObjectStore("timeBlocks", { keyPath: "id" });
        store.createIndex("taskId", "taskId", { unique: false });
        store.createIndex("projectId", "projectId", { unique: false });
        store.createIndex("goalId", "goalId", { unique: false });
        store.createIndex("date", "date", { unique: false });
        store.createIndex("completed", "completed", { unique: false });
      }

      // Projects Store
      if (!db.objectStoreNames.contains("projects")) {
        const store = db.createObjectStore("projects", { keyPath: "id" });
        store.createIndex("cat", "cat", { unique: false });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }

      // Goals Store
      if (!db.objectStoreNames.contains("goals")) {
        const store = db.createObjectStore("goals", { keyPath: "id" });
        store.createIndex("quarter", "quarter", { unique: false });
        store.createIndex("status", "status", { unique: false });
      }

      // Activities Store
      if (!db.objectStoreNames.contains("activities")) {
        const store = db.createObjectStore("activities", { keyPath: "id" });
        store.createIndex("entityId", "entityId", { unique: false });
        store.createIndex("timestamp", "timestamp", { unique: false });
      }

      // Vault Notes Store (Encrypted payloads only)
      if (!db.objectStoreNames.contains("vaultNotes")) {
        const store = db.createObjectStore("vaultNotes", { keyPath: "id" });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }

      // Settings Store
      if (!db.objectStoreNames.contains("settings")) {
        db.createObjectStore("settings", { keyPath: "id" });
      }

      // Sync Queue Store (Auto-increment ID)
      if (!db.objectStoreNames.contains("sync_queue")) {
        const queueStore = db.createObjectStore("sync_queue", { keyPath: "id", autoIncrement: true });
        queueStore.createIndex("createdAt", "createdAt", { unique: false });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      console.log(`⚡ IndexedDB [${DB_NAME}] connected successfully.`);
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      console.error("IndexedDB error:", event.target.error);
      reject(event.target.error);
    };
  });
}

function getStore(storeName, mode = "readonly") {
  return openDB().then((db) => {
    const tx = db.transaction(storeName, mode);
    return tx.objectStore(storeName);
  });
}
