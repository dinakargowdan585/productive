/* ===================================================================
   Automated Day Rollover & Immutable History Lock Engine
   =================================================================== */

const DayRolloverEngine = {
  lastActiveDate: null,
  pollerTimer: null,
  midnightTimer: null,

  init() {
    this.lastActiveDate = this.getStoredLastDate() || (typeof getIsoDateStr === "function" ? getIsoDateStr() : "");
    this.runAutomatedResetCheck("init");
    this.bindLifecycleListeners();
    this.scheduleNextMidnightTimer();
    this.startIntervalPoller();
    console.log("[DayRollover] Automated Day Rollover Engine initialized. Active date:", this.lastActiveDate);
  },

  getStoredLastDate() {
    try {
      return localStorage.getItem("productive_last_active_date");
    } catch {
      return null;
    }
  },

  setStoredLastDate(dateStr) {
    try {
      localStorage.setItem("productive_last_active_date", dateStr);
    } catch {}
    this.lastActiveDate = dateStr;
  },

  /**
   * Evaluates if a new day has arrived and executes the daily habit reset
   */
  runAutomatedResetCheck(triggerSource = "poller") {
    if (typeof getIsoDateStr !== "function") return;
    if (typeof memoryCache !== "undefined" && memoryCache.tasks === null) return;
    const currentToday = getIsoDateStr();

    if (this.lastActiveDate && this.lastActiveDate < currentToday) {
      this.executeMidnightHabitReset(this.lastActiveDate, currentToday);
      this.setStoredLastDate(currentToday);
    } else if (!this.lastActiveDate) {
      this.setStoredLastDate(currentToday);
    }
  },

  /**
   * Lifecycle event listeners: triggers on window focus, visibility change, and tab resume
   */
  bindLifecycleListeners() {
    if (typeof document === "undefined" || typeof window === "undefined") return;

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        this.runAutomatedResetCheck("visibilitychange");
      }
    });

    window.addEventListener("focus", () => {
      this.runAutomatedResetCheck("window_focus");
    });

    window.addEventListener("pageshow", () => {
      this.runAutomatedResetCheck("pageshow");
    });
  },

  /**
   * Performs the habit reset:
   * Daily habits reset completed=false for the new day,
   * completedDates array preserves all historical timestamps,
   * and streaks are mathematically computed from consecutive days.
   */
  executeMidnightHabitReset(prevDayIso, todayIso) {
    if (typeof loadTasks !== "function" || typeof saveTasks !== "function") return;

    const tasks = loadTasks();
    let modifiedCount = 0;

    const sanitized = tasks.map(t => {
      const isDaily = Boolean(t.isDaily || t.is_daily);
      if (!isDaily) return t;

      if (!Array.isArray(t.completedDates)) {
        t.completedDates = [];
        if (t.lastCompletedDate && t.completed) {
          t.completedDates.push(t.lastCompletedDate);
        }
      }

      // Check if habit is completed specifically FOR TODAY
      const isCompletedToday = t.completedDates.includes(todayIso);

      if (t.completed !== isCompletedToday) {
        t.completed = isCompletedToday;
        t.updatedAt = new Date().toISOString();
        modifiedCount++;
      }

      // Recalculate streak
      let streak = 0;
      let checkDate = new Date();
      if (!t.completedDates.includes(getIsoDateStr(checkDate))) {
        checkDate.setDate(checkDate.getDate() - 1);
      }
      while (t.completedDates.includes(getIsoDateStr(checkDate))) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      }
      t.streak = streak;

      return t;
    });

    if (modifiedCount > 0 || prevDayIso !== todayIso) {
      saveTasks(sanitized);
      console.log(`[DayRollover] Automated Day Rollover: Reset ${modifiedCount} daily habit(s) for Today (${todayIso}).`);

      if (typeof renderPlanner === "function") renderPlanner();
      if (typeof renderCalendar === "function") renderCalendar();
      if (typeof renderDashboard === "function") renderDashboard();

      if (prevDayIso && prevDayIso < todayIso && typeof showToast === "function") {
        showToast(`New Day (${todayIso})! Daily habits reset & past days locked.`, "info");
      }

      // Dispatch global rollover event
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("productive:dayRollover", { detail: { today: todayIso } }));
      }
    }
  },

  /**
   * Precision setTimeout for the exact moment of next midnight (00:00:01)
   */
  scheduleNextMidnightTimer() {
    if (this.midnightTimer) clearTimeout(this.midnightTimer);

    const now = new Date();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
    const msUntilMidnight = Math.max(1000, tomorrow.getTime() - now.getTime());

    this.midnightTimer = setTimeout(() => {
      console.log("[DayRollover] Midnight Rollover Trigger Fired!");
      this.runAutomatedResetCheck("midnight_timer");
      this.scheduleNextMidnightTimer();
    }, msUntilMidnight);
  },

  /**
   * Heartbeat poller every 15 seconds to guard against device sleep, suspension, and timezone shifts
   */
  startIntervalPoller() {
    if (this.pollerTimer) clearInterval(this.pollerTimer);
    this.pollerTimer = setInterval(() => {
      this.runAutomatedResetCheck("interval_heartbeat");
    }, 15000);
  },

  /**
   * Listen to browser lifecycle events (tab focus, screen wake, visibility change)
   */
  bindLifecycleListeners() {
    if (typeof document === "undefined") return;

    document.addEventListener("DOMContentLoaded", () => {
      this.runAutomatedResetCheck("dom_ready");
    });

    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        this.runAutomatedResetCheck("visibility_change");
      }
    });

    if (typeof window !== "undefined") {
      window.addEventListener("focus", () => {
        this.runAutomatedResetCheck("window_focus");
      });
      window.addEventListener("online", () => {
        this.runAutomatedResetCheck("network_online");
      });
    }
  }
};

// Global exports
if (typeof window !== "undefined") {
  window.DayRolloverEngine = DayRolloverEngine;
  window.forceDayReset = function() {
    DayRolloverEngine.runAutomatedResetCheck("force");
  };

  if (document.readyState === "complete" || document.readyState === "interactive") {
    setTimeout(() => DayRolloverEngine.init(), 100);
  } else {
    document.addEventListener("DOMContentLoaded", () => {
      setTimeout(() => DayRolloverEngine.init(), 100);
    });
  }
}
