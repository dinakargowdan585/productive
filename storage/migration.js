/* Productive OS - Storage Migration Manager (localStorage -> IndexedDB) */

const STORAGE_MIGRATION_KEY = "storageMigrationVersion";

async function checkAndRunStorageMigration() {
  try {
    const marker = typeof SettingsRepository !== "undefined" ? await SettingsRepository.getById(STORAGE_MIGRATION_KEY) : null;
    if (marker && marker.version >= 1) return true;

    console.log("📦 Executing idempotent localStorage -> IndexedDB migration...");

    const MIGRATION_MAP = [
      { key: "learningTasks", repo: typeof TasksRepository !== "undefined" ? TasksRepository : null, store: "tasks" },
      { key: "learningLogs", repo: typeof NotesRepository !== "undefined" ? NotesRepository : null, store: "notes" },
      { key: "learningCalendarCategories", repo: typeof CalendarsRepository !== "undefined" ? CalendarsRepository : null, store: "calendars" },
      { key: "learningTimeBlocks", repo: typeof TimeBlocksRepository !== "undefined" ? TimeBlocksRepository : null, store: "time_blocks" },
      { key: "learningProjects", repo: typeof ProjectsRepository !== "undefined" ? ProjectsRepository : null, store: "projects" },
      { key: "learningGoals", repo: typeof GoalsRepository !== "undefined" ? GoalsRepository : null, store: "goals" }
    ];

    for (const item of MIGRATION_MAP) {
      const raw = localStorage.getItem(item.key);
      if (raw && item.repo) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length) {
            await item.repo.bulkPut(parsed);
            console.log(`  ✓ Migrated ${parsed.length} items to ${item.store}`);
          }
        } catch (e) {}
      }
    }

    // Encrypted Vault Notes
    const rawVault = localStorage.getItem("learningVaultNotes");
    if (rawVault) {
      try {
        const vaultNotes = JSON.parse(rawVault);
        if (Array.isArray(vaultNotes) && vaultNotes.length) {
          const db = await openDB();
          const tx = db.transaction("vaultNotes", "readwrite");
          const store = tx.objectStore("vaultNotes");
          vaultNotes.forEach(vn => store.put(vn));
        }
      } catch (e) {}
    }

    if (typeof SettingsRepository !== "undefined") {
      await SettingsRepository.create({ id: STORAGE_MIGRATION_KEY, version: 1, completedAt: new Date().toISOString() });
    }
    return true;
  } catch (err) {
    console.error("Storage migration failed:", err);
    return false;
  }
}
