/* ===================================================================
   Automated Day Rollover & Consumable Streak Freeze Engine
   =================================================================== */

const DayRolloverEngine = {
  lastActiveDate: null,
  pollerTimer: null,
  midnightTimer: null,
  isEvaluating: false,

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
   * Evaluates if a new day has arrived and executes the daily habit reset & consumable streak freeze check
   */
  runAutomatedResetCheck(triggerSource = "poller") {
    if (this.isEvaluating) return;
    if (typeof getIsoDateStr !== "function") return;
    if (typeof memoryCache !== "undefined" && memoryCache.tasks === null) return;
    const currentToday = getIsoDateStr();

    this.isEvaluating = true;
    try {
      if (this.lastActiveDate && this.lastActiveDate < currentToday) {
        this.executeMidnightHabitReset(this.lastActiveDate, currentToday);
        this.setStoredLastDate(currentToday);
      } else if (!this.lastActiveDate) {
        this.setStoredLastDate(currentToday);
      }
    } finally {
      this.isEvaluating = false;
    }
  },

  /**
   * Unified lifecycle event listeners: triggers on window focus, visibility change, and network reconnection
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

    window.addEventListener("online", () => {
      this.runAutomatedResetCheck("network_online");
    });
  },

  /**
   * Performs the habit reset & consumable streak freeze evaluation:
   * 1. Daily habits reset completed=false for the new day
   * 2. CompletedDates array preserves all historical timestamps
   * 3. Consumable streak freezes protect missed calendar days (1 freeze = 1 missed day)
   * 4. 7 consecutive productive days earns +1 freeze (capped at max 2)
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

      // Recalculate streak with freeze
      const streakInfo = calculateStreakWithFreeze(t.completedDates, 2, todayIso);
      t.streak = streakInfo.streak;
      t.isFrozen = streakInfo.isFrozen;
      t.freezeDaysRemaining = streakInfo.freezeDaysRemaining;

      return t;
    });

    // Load Global Streak State
    let streakState = (typeof getGlobalStreakState === "function")
      ? getGlobalStreakState()
      : { id: "productive_global_streak_v1", currentStreak: 0, bestStreak: 0, availableFreezes: 2, maxFreezes: 2, protectedDates: [], consecutiveProductiveDays: 0 };

    let freezeConsumedCount = 0;
    let streakBroken = false;
    let freezesEarnedCount = 0;

    if (prevDayIso && todayIso && prevDayIso < todayIso) {
      let startEval = prevDayIso;
      if (streakState.lastRolloverEvaluatedDate && typeof addDaysIso === "function") {
        const nextDayAfterLast = addDaysIso(streakState.lastRolloverEvaluatedDate, 1);
        if (nextDayAfterLast < startEval) {
          startEval = nextDayAfterLast;
        }
      }

      let cur = startEval;
      while (cur < todayIso) {
        const alreadyProtected = Array.isArray(streakState.protectedDates) && streakState.protectedDates.includes(cur);
        const productive = (typeof isDateProductive === "function") ? isDateProductive(cur, sanitized) : false;

        if (productive) {
          streakState.consecutiveProductiveDays = (streakState.consecutiveProductiveDays || 0) + 1;
          if (streakState.consecutiveProductiveDays >= 7) {
            if ((streakState.availableFreezes || 0) < (streakState.maxFreezes || 2)) {
              streakState.availableFreezes = Math.min(streakState.maxFreezes || 2, (streakState.availableFreezes || 0) + 1);
              freezesEarnedCount++;
            }
            streakState.consecutiveProductiveDays = 0;
          }
        } else {
          if (!alreadyProtected) {
            if ((streakState.availableFreezes || 0) > 0) {
              streakState.availableFreezes -= 1;
              if (!Array.isArray(streakState.protectedDates)) streakState.protectedDates = [];
              streakState.protectedDates.push(cur);
              streakState.consecutiveProductiveDays = 0; // Freeze does not count toward 7-day bonus
              freezeConsumedCount++;
            } else {
              streakState.currentStreak = 0;
              streakState.consecutiveProductiveDays = 0;
              streakBroken = true;
            }
          }
        }

        streakState.lastRolloverEvaluatedDate = cur;
        const nextCur = (typeof addDaysIso === "function") ? addDaysIso(cur, 1) : cur;
        if (nextCur === cur) break;
        cur = nextCur;
      }
    }

    // Live global streak recalculation
    if (typeof calculateActiveStreak === "function") {
      streakState.currentStreak = calculateActiveStreak(sanitized, streakState, todayIso);
    }
    streakState.bestStreak = Math.max(streakState.bestStreak || 0, streakState.currentStreak || 0);

    if (typeof saveGlobalStreakState === "function") {
      saveGlobalStreakState(streakState);
    }

    saveTasks(sanitized);
    console.log(`[DayRollover] Automated Day Rollover: Today (${todayIso}). Global streak: ${streakState.currentStreak}, Available Freezes: ${streakState.availableFreezes}/${streakState.maxFreezes}`);

    if (typeof renderPlanner === "function") renderPlanner();
    if (typeof renderCalendar === "function") renderCalendar();
    if (typeof renderDashboard === "function") renderDashboard();

    // Toasts for rollover actions
    if (typeof showToast === "function") {
      if (freezesEarnedCount > 0) {
        showToast(`🛡️ Streak Milestone! Earned +${freezesEarnedCount} Streak Freeze for 7 productive days! (${streakState.availableFreezes}/${streakState.maxFreezes})`, "success");
      }
      if (freezeConsumedCount > 0) {
        showToast(`🛡️ STREAK PROTECTED: Streak freeze consumed (${streakState.availableFreezes} remaining).`, "info");
      } else if (streakBroken) {
        showToast("Streak ended. Complete a task today to start a new streak!", "warning");
      } else if (prevDayIso && prevDayIso < todayIso) {
        showToast(`New Day (${todayIso})! Habits reset with Streak Freeze protection.`, "info");
      }
    }

    // Dispatch global events
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("productive:dayRollover", { detail: { today: todayIso, streakState } }));
      window.dispatchEvent(new CustomEvent("productive:streakUpdated", { detail: { streakState } }));
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
  }
};

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
  const todayIso = typeof referenceDate === "string"
    ? (referenceDate.includes("T") ? referenceDate.split("T")[0] : referenceDate)
    : (typeof getIsoDateStr === "function" ? getIsoDateStr(referenceDate) : new Date(referenceDate).toISOString().split("T")[0]);

  let cursor = typeof referenceDate === "string" ? new Date(referenceDate + "T00:00:00") : new Date(referenceDate);
  let streak = 0;
  const isTodayCompleted = dateSet.has(todayIso);

  const globalStreak = (typeof getGlobalStreakState === "function") ? getGlobalStreakState() : null;
  const protectedSet = new Set((globalStreak && globalStreak.protectedDates) || []);

  // Check how many days back since last completion
  let initialGap = 0;
  if (!isTodayCompleted) {
    let testDate = new Date(cursor);
    testDate.setDate(testDate.getDate() - 1);
    while (initialGap <= maxFreezeDays) {
      const testIso = typeof getIsoDateStr === "function" ? getIsoDateStr(testDate) : testDate.toISOString().split("T")[0];
      if (dateSet.has(testIso)) break;
      if (protectedSet.has(testIso)) {
        // Protected date bridges gap
      }
      initialGap++;
      testDate.setDate(testDate.getDate() - 1);
    }
    if (initialGap > maxFreezeDays) {
      return { streak: 0, isFrozen: false, freezeDaysUsed: 0, freezeDaysRemaining: maxFreezeDays };
    }
  }

  let consecutiveMisses = 0;
  let checkDate = new Date(cursor);
  if (!isTodayCompleted) {
    checkDate.setDate(checkDate.getDate() - 1);
  }

  let reachedStart = false;
  const maxLookbackDays = 3650;
  let daysWalked = 0;

  while (daysWalked < maxLookbackDays) {
    const iso = typeof getIsoDateStr === "function" ? getIsoDateStr(checkDate) : checkDate.toISOString().split("T")[0];
    if (dateSet.has(iso)) {
      streak++;
      consecutiveMisses = 0;
      reachedStart = true;
    } else if (protectedSet.has(iso)) {
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
    freezeDaysUsed: Math.min(maxFreezeDays, initialGap),
    freezeDaysRemaining
  };
}

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
