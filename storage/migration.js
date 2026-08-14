/* Productive OS - Storage Migration Manager (localStorage -> IndexedDB) */

const STORAGE_MIGRATION_KEY = "storageMigrationVersion";

async function checkAndRunStorageMigration() {
  try {
    const migrationMarker = typeof SettingsRepository !== "undefined" ? await SettingsRepository.getById(STORAGE_MIGRATION_KEY) : null;

    if (migrationMarker && migrationMarker.version >= 1) {
      console.log("✅ IndexedDB storage migration already completed on", migrationMarker.completedAt);
      return true;
    }

    console.log("📦 Executing idempotent localStorage -> IndexedDB migration...");

    // 1. Migrate Tasks
    const rawTasks = localStorage.getItem("learningTasks");
    if (rawTasks) {
      const tasks = JSON.parse(rawTasks);
      if (Array.isArray(tasks) && tasks.length) {
        await TasksRepository.bulkPut(tasks);
        console.log(`  ✓ Migrated ${tasks.length} tasks to IndexedDB`);
      }
    }

    // 2. Migrate Notes
    const rawNotes = localStorage.getItem("learningLogs");
    if (rawNotes) {
      const notes = JSON.parse(rawNotes);
      if (Array.isArray(notes) && notes.length) {
        await NotesRepository.bulkPut(notes);
        console.log(`  ✓ Migrated ${notes.length} notes to IndexedDB`);
      }
    }

    // 3. Migrate Calendars
    const rawCalendars = localStorage.getItem("learningCalendarCategories");
    if (rawCalendars) {
      const cals = JSON.parse(rawCalendars);
      if (Array.isArray(cals) && cals.length) {
        await CalendarsRepository.bulkPut(cals);
        console.log(`  ✓ Migrated ${cals.length} calendars to IndexedDB`);
      }
    }

    // 4. Migrate TimeBlocks
    const rawBlocks = localStorage.getItem("learningTimeBlocks");
    if (rawBlocks) {
      const blocks = JSON.parse(rawBlocks);
      if (Array.isArray(blocks) && blocks.length) {
        await TimeBlocksRepository.bulkPut(blocks);
        console.log(`  ✓ Migrated ${blocks.length} time blocks to IndexedDB`);
      }
    }

    // 5. Migrate Projects
    const rawProjects = localStorage.getItem("learningProjects");
    if (rawProjects) {
      const projects = JSON.parse(rawProjects);
      if (Array.isArray(projects) && projects.length) {
        await ProjectsRepository.bulkPut(projects);
        console.log(`  ✓ Migrated ${projects.length} projects to IndexedDB`);
      }
    }

    // 6. Migrate Goals
    const rawGoals = localStorage.getItem("learningGoals");
    if (rawGoals) {
      const goals = JSON.parse(rawGoals);
      if (Array.isArray(goals) && goals.length) {
        await GoalsRepository.bulkPut(goals);
        console.log(`  ✓ Migrated ${goals.length} goals to IndexedDB`);
      }
    }

    // 7. Migrate Activities
    const rawActivities = localStorage.getItem("learningActivityFeed");
    if (rawActivities) {
      const activities = JSON.parse(rawActivities);
      if (Array.isArray(activities) && activities.length) {
        await ActivitiesRepository.bulkPut(activities);
        console.log(`  ✓ Migrated ${activities.length} activities to IndexedDB`);
      }
    }

    // 8. Migrate Encrypted Vault Notes
    const rawVault = localStorage.getItem("learningVaultNotes");
    if (rawVault) {
      const vaultNotes = JSON.parse(rawVault);
      if (Array.isArray(vaultNotes) && vaultNotes.length) {
        const db = await openDB();
        const tx = db.transaction("vaultNotes", "readwrite");
        const store = tx.objectStore("vaultNotes");
        vaultNotes.forEach(vn => store.put(vn));
        console.log(`  ✓ Migrated ${vaultNotes.length} encrypted vault items to IndexedDB`);
      }
    }

    // Save Migration Completion Marker
    const writeSettings = await getStore("settings", "readwrite");
    await new Promise((resolve, reject) => {
      const req = writeSettings.put({
        id: STORAGE_MIGRATION_KEY,
        version: 1,
        completedAt: new Date().toISOString()
      });
      req.onsuccess = () => resolve(true);
      req.onerror = (e) => reject(e.target.error);
    });

    console.log("🎉 Storage migration to IndexedDB completed successfully!");
    return true;
  } catch (err) {
    console.error("🚨 Storage migration failed:", err);
    return false;
  }
}
