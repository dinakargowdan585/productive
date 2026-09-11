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
 * Calculates habit streak with a 2-day streak freeze buffer.
 * If 1 or 2 consecutive days are missed, the streak is frozen and preserved.
 * If 3 or more consecutive days are missed, the streak resets.
 */
function calculateStreakWithFreeze(completedDates = [], maxFreezeDays = 2, referenceDate = new Date()) {
  if (!Array.isArray(completedDates) || !completedDates.length) {
    return { streak: 0, isFrozen: false, freezeDaysUsed: 0, freezeDaysRemaining: maxFreezeDays };
  }

  const dateSet = new Set(completedDates);
  const todayIso = typeof getIsoDateStr === "function" ? getIsoDateStr(referenceDate) : new Date(referenceDate).toISOString().split("T")[0];

  let cursor = new Date(referenceDate);
  let streak = 0;
  let isTodayCompleted = dateSet.has(todayIso);

  // Check how many days back since last completion
  let initialGap = 0;
  if (!isTodayCompleted) {
    let testDate = new Date(cursor);
    testDate.setDate(testDate.getDate() - 1);
    while (initialGap <= maxFreezeDays && !dateSet.has(typeof getIsoDateStr === "function" ? getIsoDateStr(testDate) : testDate.toISOString().split("T")[0])) {
      initialGap++;
      testDate.setDate(testDate.getDate() - 1);
    }
    if (initialGap > maxFreezeDays) {
      // Streak lapsed beyond freeze allowance
      return { streak: 0, isFrozen: false, freezeDaysUsed: 0, freezeDaysRemaining: maxFreezeDays };
    }
  }

  let consecutiveMisses = 0;
  let checkDate = new Date(cursor);
  if (!isTodayCompleted) {
    checkDate.setDate(checkDate.getDate() - 1);
  }

  let reachedStart = false;
  let maxLookbackDays = 3650;
  let daysWalked = 0;

  while (daysWalked < maxLookbackDays) {
    const iso = typeof getIsoDateStr === "function" ? getIsoDateStr(checkDate) : checkDate.toISOString().split("T")[0];
    if (dateSet.has(iso)) {
      streak++;
      consecutiveMisses = 0;
      reachedStart = true;
    } else {
      if (!reachedStart && !isTodayCompleted) {
        consecutiveMisses++;
      } else if (reachedStart) {
        consecutiveMisses++;
        if (consecutiveMisses > maxFreezeDays) {
          break; // Gap too wide
        }
      } else {
        break;
      }
    }
    checkDate.setDate(checkDate.getDate() - 1);
    daysWalked++;
  }

  const isFrozen = !isTodayCompleted && streak > 0 && initialGap > 0;
  const freezeDaysRemaining = Math.max(0, maxFreezeDays - initialGap);

  return {
    streak,
    isFrozen,
    freezeDaysUsed: initialGap,
    freezeDaysRemaining
  };
}

  /**
   * Performs the habit reset:
   * Daily habits reset completed=false for the new day,
   * completedDates array preserves all historical timestamps,
   * and streaks are mathematically computed with a 2-day streak freeze buffer.
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

      // Recalculate streak with 2-day streak freeze buffer
      const streakInfo = calculateStreakWithFreeze(t.completedDates, 2);
      t.streak = streakInfo.streak;
      t.isFrozen = streakInfo.isFrozen;
      t.freezeDaysRemaining = streakInfo.freezeDaysRemaining;

      return t;
    });

    if (modifiedCount > 0 || prevDayIso !== todayIso) {
      saveTasks(sanitized);
      console.log(`[DayRollover] Automated Day Rollover: Reset ${modifiedCount} daily habit(s) for Today (${todayIso}). 2-Day Streak Freeze active.`);

      if (typeof renderPlanner === "function") renderPlanner();
      if (typeof renderCalendar === "function") renderCalendar();
      if (typeof renderDashboard === "function") renderDashboard();

      if (prevDayIso && prevDayIso < todayIso && typeof showToast === "function") {
        showToast(`New Day (${todayIso})! Habits reset with 2-Day Streak Freeze protection.`, "info");
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
  window.calculateStreakWithFreeze = calculateStreakWithFreeze;
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
