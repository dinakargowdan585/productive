/* Executive Dashboard Logic & Intelligent Insights Engine */

function hideDashboardCard(cardId) {
  let cards = getVisibleDashboardCards();
  cards = cards.filter(c => c !== cardId);
  saveVisibleDashboardCards(cards);
  renderDashboard();
  if (typeof showToast === "function") showToast("Card removed from Dashboard", "info");
}

function addDashboardCard(cardId) {
  let cards = getVisibleDashboardCards();
  if (!cards.includes(cardId)) {
    cards.push(cardId);
    saveVisibleDashboardCards(cards);
    renderDashboard();
    if (typeof showToast === "function") showToast("Card added to Dashboard", "success");
  }
}

function toggleAddCardMenu() {
  const menu = document.getElementById("addCardMenuDropdown");
  if (!menu) return;
  const isOpen = menu.style.display === "flex";
  menu.style.display = isOpen ? "none" : "flex";

  if (!isOpen) {
    const visible = getVisibleDashboardCards();
    const hidden = ALL_DASHBOARD_CARDS.filter(c => !visible.includes(c.id));
    if (!hidden.length) {
      menu.innerHTML = `<div style="padding:8px 12px; font-size:0.8rem; color:var(--muted);">All cards are active on your Dashboard!</div>`;
    } else {
      menu.innerHTML = hidden.map(c => `
        <div class="task-card-menu-item" onclick="addDashboardCard('${c.id}'); toggleAddCardMenu();" style="display:flex; align-items:center; gap:6px;">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          ${c.name}
        </div>
      `).join('');
    }
  }
}

function generateExecutiveInsights() {
  const tasks = loadTasks();
  const goals = loadGoals();
  const projects = loadProjects();
  const blocks = loadTimeBlocks();
  const insights = [];

  const completed = tasks.filter(t => t.completed);
  const pending = tasks.filter(t => !t.completed);
  const todayIso = getIsoDateStr();
  const overdue = pending.filter(t => t.dueDate && t.dueDate < todayIso);

  if (overdue.length > 0) {
    insights.push({
      icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--amber)" stroke-width="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
      text: `"${overdue[0].title}" is behind schedule (due ${overdue[0].dueDate}).`,
      type: "warning"
    });
  }

  const completedBlocks = blocks.filter(b => b.completed);
  const totalFocusMins = completedBlocks.reduce((acc, b) => acc + (b.durationMinutes || 0), 0);
  if (totalFocusMins > 0) {
    insights.push({
      icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="2"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>`,
      text: `You completed ${formatDurationHuman(totalFocusMins)} of deep focus sessions.`,
      type: "success"
    });
  } else {
    insights.push({
      icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
      text: "Schedule a 60m focus block today to maintain your deep work momentum.",
      type: "info"
    });
  }

  if (completed.length >= 3) {
    insights.push({
      icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
      text: `Great velocity! You completed ${completed.length} tasks this week.`,
      type: "success"
    });
  }

  insights.push({
    icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a855f7" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`,
    text: "Productivity Pattern: You achieve highest focus consistency between 6:00 PM – 9:00 PM.",
    type: "info"
  });

  return insights.slice(0, 4);
}

function renderStreakFreezeWidget() {
  const streakCountEl = document.getElementById("dashboardStreakCount");
  const streakBestEl = document.getElementById("dashboardStreakBest");
  const streakProgressEl = document.getElementById("dashboardStreakBonusProgress");
  const shieldsGridEl = document.getElementById("dashboardStreakShieldsGrid");
  const shieldCountEl = document.getElementById("dashboardStreakShieldCount");
  const flameWrap = document.getElementById("streakFlameWrapper");

  if (!streakCountEl && !shieldsGridEl) return;

  const state = (typeof getGlobalStreakState === "function")
    ? getGlobalStreakState()
    : { currentStreak: 0, bestStreak: 0, availableFreezes: 2, maxFreezes: 2, consecutiveProductiveDays: 0 };

  const current = state.currentStreak || 0;
  const best = Math.max(state.bestStreak || 0, current);
  const available = typeof state.availableFreezes === "number" ? state.availableFreezes : 2;
  const max = state.maxFreezes || 2;
  const consec = state.consecutiveProductiveDays || 0;

  if (streakCountEl) streakCountEl.textContent = `${current}`;
  if (streakBestEl) streakBestEl.textContent = `Best: ${best}`;
  if (streakProgressEl) {
    if (available >= max) {
      streakProgressEl.textContent = `Freezes full (${max}/${max})`;
    } else {
      streakProgressEl.textContent = `${consec}/7 productive days to next freeze`;
    }
  }
  if (shieldCountEl) {
    shieldCountEl.textContent = `${available} / ${max}`;
  }

  if (flameWrap) {
    if (current > 0) {
      flameWrap.classList.add("flame-active");
    } else {
      flameWrap.classList.remove("flame-active");
    }
  }

  if (shieldsGridEl) {
    let shieldsHTML = "";
    for (let i = 1; i <= max; i++) {
      const isReady = i <= available;
      shieldsHTML += `
        <div class="streak-shield-item ${isReady ? 'shield-ready' : 'shield-spent'}" title="${isReady ? 'Streak Freeze Available: Automatically protects missed days' : 'Streak Freeze Used: Earn back with 7 consecutive productive days'}">
          <div class="shield-icon-wrap">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="${isReady ? 'var(--os-teal)' : 'none'}" stroke="${isReady ? 'var(--os-teal)' : 'var(--os-text-tertiary)'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
        </div>
      `;
    }
    shieldsGridEl.innerHTML = shieldsHTML;
  }
}

function openStreakFreezeModal() {
  const modal = document.getElementById("streakFreezeModal");
  if (!modal) return;
  renderStreakFreezeModalContent();
  if (typeof modal.showModal === "function") {
    modal.showModal();
  }
}

function closeStreakFreezeModal() {
  const modal = document.getElementById("streakFreezeModal");
  if (modal && typeof modal.close === "function") {
    modal.close();
  }
}

function renderStreakFreezeModalContent() {
  const body = document.getElementById("streakFreezeModalBody");
  if (!body) return;

  const state = (typeof getGlobalStreakState === "function")
    ? getGlobalStreakState()
    : { currentStreak: 0, bestStreak: 0, availableFreezes: 2, maxFreezes: 2, protectedDates: [], consecutiveProductiveDays: 0 };

  const current = state.currentStreak || 0;
  const best = Math.max(state.bestStreak || 0, current);
  const available = typeof state.availableFreezes === "number" ? state.availableFreezes : 2;
  const max = state.maxFreezes || 2;
  const consec = state.consecutiveProductiveDays || 0;
  const protectedList = Array.isArray(state.protectedDates) ? state.protectedDates : [];

  body.innerHTML = `
    <!-- Top Highlights Grid -->
    <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:10px;">
      <div style="background:var(--os-surface); border:1px solid var(--os-border); border-radius:var(--os-radius-md); padding:12px; text-align:center;">
        <div style="font-size:1.45rem; font-weight:800; color:var(--os-warning);">${current}</div>
        <div style="font-size:0.7rem; font-weight:700; color:var(--os-text-secondary); text-transform:uppercase; margin-top:2px; letter-spacing:0.5px;">Current Streak</div>
      </div>
      <div style="background:var(--os-surface); border:1px solid var(--os-border); border-radius:var(--os-radius-md); padding:12px; text-align:center;">
        <div style="font-size:1.45rem; font-weight:800; color:var(--os-text);">${best}</div>
        <div style="font-size:0.7rem; font-weight:700; color:var(--os-text-secondary); text-transform:uppercase; margin-top:2px; letter-spacing:0.5px;">Best Streak</div>
      </div>
      <div style="background:var(--os-surface); border:1px solid var(--os-border); border-radius:var(--os-radius-md); padding:12px; text-align:center;">
        <div style="font-size:1.45rem; font-weight:800; color:var(--os-teal);">${available} / ${max}</div>
        <div style="font-size:0.7rem; font-weight:700; color:var(--os-text-secondary); text-transform:uppercase; margin-top:2px; letter-spacing:0.5px;">Available Shields</div>
      </div>
    </div>

    <!-- Inventory & Progress Card -->
    <div style="background:var(--os-surface); border:1px solid var(--os-border); border-radius:var(--os-radius-md); padding:14px 16px; display:flex; flex-direction:column; gap:12px;">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <span style="font-size:0.82rem; font-weight:700; color:var(--os-text);">Shield Inventory</span>
        <span style="font-size:0.75rem; font-family:var(--os-font-code); color:var(--os-teal); font-weight:700;">${available} of ${max} available</span>
      </div>
      <div style="display:flex; gap:10px;">
        ${Array.from({ length: max }).map((_, i) => {
          const isReady = i < available;
          return `
            <div style="flex:1; display:flex; align-items:center; justify-content:center; gap:8px; padding:10px 14px; border-radius:var(--os-radius-sm); background:${isReady ? 'rgba(100, 210, 255, 0.08)' : 'rgba(255, 255, 255, 0.03)'}; border:1px ${isReady ? 'solid rgba(100, 210, 255, 0.25)' : 'dashed var(--os-border-subtle)'};">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="${isReady ? 'var(--os-teal)' : 'none'}" stroke="${isReady ? 'var(--os-teal)' : 'var(--os-text-tertiary)'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
              <span style="font-size:0.75rem; font-weight:700; color:${isReady ? 'var(--os-teal)' : 'var(--os-text-tertiary)'};">Shield Slot ${i + 1}</span>
            </div>
          `;
        }).join('')}
      </div>
      <div>
        <div style="display:flex; justify-content:space-between; font-size:0.74rem; color:var(--os-text-secondary); margin-bottom:5px;">
          <span>7-Day Bonus Progression</span>
          <span style="font-family:var(--os-font-code); font-weight:600;">${available >= max ? 'Inventory Full (2/2)' : `${consec} / 7 Productive Days`}</span>
        </div>
        <div style="width:100%; height:6px; border-radius:var(--os-radius-pill); background:rgba(255,255,255,0.06); overflow:hidden;">
          <div style="height:100%; width:${available >= max ? 100 : Math.round((consec / 7) * 100)}%; background:${available >= max ? 'var(--os-teal)' : 'var(--os-accent)'}; border-radius:var(--os-radius-pill); transition:width 200ms ease;"></div>
        </div>
      </div>
    </div>

    <!-- How it works bullet points -->
    <div style="display:flex; flex-direction:column; gap:10px; font-size:0.8rem; color:var(--os-text-secondary); line-height:1.45; padding:0 2px;">
      <div style="display:flex; gap:10px; align-items:flex-start;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--os-teal)" stroke="var(--os-teal)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0; margin-top:2px;">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
        <div><strong style="color:var(--os-text);">Automatic Protection:</strong> When you miss a day, 1 Streak Freeze is automatically consumed at midnight rollover to keep your streak intact.</div>
      </div>
      <div style="display:flex; gap:10px; align-items:flex-start;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--os-warning)" stroke="var(--os-warning)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0; margin-top:2px;">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
        <div><strong style="color:var(--os-text);">Earn Freezes:</strong> Complete 7 consecutive productive days to earn +1 Streak Freeze (stored up to 2).</div>
      </div>
      <div style="display:flex; gap:10px; align-items:flex-start;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--os-accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0; margin-top:2px;">
          <line x1="12" y1="2" x2="12" y2="22"/>
          <line x1="2" y1="12" x2="22" y2="12"/>
          <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
          <line x1="4.93" y1="19.07" x2="19.07" y2="4.93"/>
        </svg>
        <div><strong style="color:var(--os-text);">Protected Dates:</strong> ${protectedList.length > 0 ? `Saved ${protectedList.length} missed day${protectedList.length === 1 ? '' : 's'} (${protectedList.join(', ')})` : 'All past days productive! No freezes used.'}</div>
      </div>
    </div>
  `;
}

function renderProductivityHeatmap() {
  const grid = document.getElementById("productivityHeatmapGrid");
  const monthsContainer = document.getElementById("heatmapMonthsLabels");
  const totalCountEl = document.getElementById("heatmapTotalCount");
  if (!grid) return;

  const tasks = loadTasks();
  const globalStreak = (typeof getGlobalStreakState === "function") ? getGlobalStreakState() : null;
  const protectedDates = new Set((globalStreak && globalStreak.protectedDates) || []);

  const countByDate = {};
  let totalYearCompleted = 0;

  tasks.forEach(t => {
    if (t.completed) {
      let dateKey = null;
      if (t.updatedAt) dateKey = t.updatedAt.slice(0, 10);
      else if (t.lastCompletedDate) dateKey = t.lastCompletedDate;
      else if (t.dueDate) dateKey = t.dueDate;
      else if (t.createdAt) dateKey = t.createdAt.slice(0, 10);

      if (dateKey) {
        countByDate[dateKey] = (countByDate[dateKey] || 0) + 1;
        totalYearCompleted++;
      }
    }
    if (Array.isArray(t.completedDates)) {
      t.completedDates.forEach(cd => {
        if (cd && cd !== (t.lastCompletedDate || '')) {
          countByDate[cd] = (countByDate[cd] || 0) + 1;
        }
      });
    }
  });

  if (totalCountEl) {
    totalCountEl.textContent = `${totalYearCompleted} task${totalYearCompleted === 1 ? '' : 's'} completed this year`;
  }

  const today = new Date();
  const days = [];
  for (let i = 364; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push(d);
  }

  if (monthsContainer) {
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    let labelsHTML = "";
    for (let m = 0; m < 12; m++) {
      const monthDate = new Date();
      monthDate.setMonth(monthDate.getMonth() - (11 - m));
      labelsHTML += `<span>${monthNames[monthDate.getMonth()]}</span>`;
    }
    monthsContainer.innerHTML = labelsHTML;
  }

  grid.innerHTML = days.map(d => {
    const dateStr = getIsoDateStr(d);
    const count = countByDate[dateStr] || 0;
    const isFrozen = count === 0 && protectedDates.has(dateStr);
    let level = 0;
    if (count === 1) level = 1;
    else if (count === 2) level = 2;
    else if (count >= 3 && count <= 4) level = 3;
    else if (count >= 5) level = 4;

    const formattedDate = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    let tip = `${formattedDate}: ${count} task${count === 1 ? '' : 's'} completed`;
    if (isFrozen) {
      tip = `${formattedDate}: Frozen Day (Streak Freeze Applied)`;
    }

    return `<div class="heatmap-cell ${isFrozen ? 'is-frozen' : ''}" data-level="${level}" ${isFrozen ? 'data-frozen="true"' : ''} title="${tip}" onclick="if(typeof showToast === 'function') showToast('${tip}', 'info');"></div>`;
  }).join('');
}

function renderProductivitySummary() {
  const summaryEl = document.getElementById("dashboardProductivitySummary");
  if (!summaryEl) return;

  const todayIso = getIsoDateStr();
  const tasks = loadTasks();

  const todayTasks = tasks.filter(t => {
    if (t.isDaily) return true;
    if (t.dueDate === todayIso) return true;
    if (t.lastCompletedDate === todayIso) return true;
    return false;
  });

  const targetList = todayTasks.length > 0 ? todayTasks : tasks;
  const total = targetList.length;
  const completed = targetList.filter(t => isTaskCompletedOnDate(t, todayIso)).length;
  const remaining = Math.max(0, total - completed);
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  const blocks = loadTimeBlocks().filter(b => b.date === todayIso);
  const completedFocusMins = blocks.filter(b => b.completed).reduce((acc, b) => acc + (b.durationMinutes || 0), 0);
  const scheduledFocusMins = blocks.reduce((acc, b) => acc + (b.durationMinutes || 0), 0);
  const displayFocusMins = completedFocusMins > 0 ? completedFocusMins : scheduledFocusMins;

  let statusText = "Ready to Execute";
  if (total === 0) {
    statusText = "All Clear";
  } else if (percent === 100) {
    statusText = "Completed for Today";
  } else if (percent >= 60) {
    statusText = "On Track";
  } else if (percent > 0) {
    statusText = "In Progress";
  } else {
    statusText = `${remaining} task${remaining === 1 ? '' : 's'} remaining`;
  }

  const percentEl = document.getElementById("prodSummaryPercent");
  if (percentEl) percentEl.textContent = `${percent}%`;

  const tasksEl = document.getElementById("prodSummaryTasks");
  if (tasksEl) tasksEl.textContent = `${completed} / ${total}`;

  const remainingEl = document.getElementById("prodSummaryRemaining");
  if (remainingEl) remainingEl.textContent = `${remaining}`;

  const statusEl = document.getElementById("prodSummaryStatusText");
  if (statusEl) statusEl.textContent = statusText;

  const focusEl = document.getElementById("prodSummaryFocusTime");
  if (focusEl) {
    const timeStr = displayFocusMins > 0 ? formatDurationHuman(displayFocusMins) : "0m";
    focusEl.textContent = `${timeStr} Deep Work`;
  }

  const fillEl = document.getElementById("prodSummaryProgressFill");
  if (fillEl) fillEl.style.width = `${percent}%`;
}

function renderDashboard() {
  const visibleCards = getVisibleDashboardCards();
  ALL_DASHBOARD_CARDS.forEach(c => {
    const box = document.getElementById(`cardBox-${c.id}`);
    if (box) {
      box.style.display = visibleCards.includes(c.id) ? "flex" : "none";
    }
  });

  const hour = new Date().getHours();
  let timeSalute = "Good Morning";
  let auraColor = "rgba(245, 158, 11, 0.2)";
  let subtitle = "☀️ Morning Focus & Clarity";

  if (hour >= 5 && hour < 12) {
    timeSalute = "Good Morning";
    auraColor = "rgba(245, 158, 11, 0.22)";
    subtitle = "Morning Focus & Clarity";
  } else if (hour >= 12 && hour < 17) {
    timeSalute = "Good Afternoon";
    auraColor = "rgba(56, 189, 248, 0.25)";
    subtitle = "Peak Execution Window";
  } else if (hour >= 17 && hour < 21) {
    timeSalute = "Good Evening";
    auraColor = "rgba(168, 85, 247, 0.25)";
    subtitle = "Milestone Review & Wrap-up";
  } else {
    timeSalute = "Good Night";
    auraColor = "rgba(99, 102, 241, 0.22)";
    subtitle = "Night StandBy & Recovery";
  }

  const banner = document.getElementById("execGreetingBanner");
  if (banner) {
    banner.style.setProperty("--aura-color", auraColor);
  }

  const greetingEl = document.getElementById("execGreetingText");
  if (greetingEl) greetingEl.textContent = `${timeSalute}, Dinakar`;

  const dateEl = document.getElementById("execDateText");
  if (dateEl) {
    const now = new Date();
    dateEl.textContent = `${now.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })} • ${subtitle}`;
  }

  renderProductivitySummary();
  renderStreakFreezeWidget();
  renderProductivityHeatmap();

  const tasks = loadTasks();
  const mits = tasks.filter(t => !t.completed).slice(0, 3);
  const mitsContainer = document.getElementById("execTopMITsContainer");
  if (mitsContainer) {
    if (!mits.length) {
      mitsContainer.innerHTML = `<div class="empty-state"><h3>All Tasks Completed</h3><p>Perfect day for deep work!</p></div>`;
    } else {
      mitsContainer.innerHTML = mits.map((t, idx) => {
        const cal = getCalendarById(t.calendarId || t.category || "work");
        return `
          <div style="background:var(--elevated); border:1px solid var(--border); border-left:4px solid ${cal.color}; padding:12px 16px; border-radius:var(--radius-sm); display:flex; justify-content:space-between; align-items:center;">
            <div>
              <div style="font-size:0.95rem; font-weight:700; color:var(--text);">${idx + 1}. ${escapeHTML(t.title)}</div>
              <div style="font-size:0.78rem; color:var(--muted); margin-top:2px;">${t.dueDate ? 'Due: ' + t.dueDate : 'No due date'}</div>
            </div>
            <button type="button" class="secondary" onclick="startFocusSessionForBlock('')" style="padding:4px 12px; font-size:0.78rem; background:var(--accent); color:#05070a; font-weight:700; border:none; display:inline-flex; align-items:center; gap:4px;"><svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> Focus</button>
          </div>
        `;
      }).join('');
    }
  }

  const todayIso = getIsoDateStr();
  const blocks = loadTimeBlocks().filter(b => b.date === todayIso);
  const timelineContainer = document.getElementById("execTimelineContainer");
  if (timelineContainer) {
    if (!blocks.length) {
      timelineContainer.innerHTML = `<div style="font-size:0.85rem; color:var(--muted)">No focus time blocks scheduled today. Click "+ New Task" to schedule.</div>`;
    } else {
      timelineContainer.innerHTML = blocks.map(b => `
        <div style="display:flex; align-items:center; justify-content:space-between; background:rgba(255,255,255,0.03); border:1px solid var(--border); border-left:3px solid ${b.color || 'var(--accent)'}; padding:8px 12px; border-radius:var(--radius-sm); font-size:0.82rem;">
          <span style="font-weight:700; color:var(--text);">${formatTime12Hour(b.startTime)} - ${formatTime12Hour(b.endTime)}</span>
          <span style="color:var(--muted);">${escapeHTML(b.taskTitle)} (${b.durationMinutes}m)</span>
        </div>
      `).join('');
    }
  }

  const goals = loadGoals();
  const goalCard = document.getElementById("execCurrentGoalCard");
  if (goalCard) {
    const g = goals[0] || { objective: "Master Engineering Architecture", progress: 65, quarter: "Q3 2026" };
    goalCard.innerHTML = `
      <div style="font-size:0.78rem; color:var(--accent); font-weight:700; letter-spacing:1px; text-transform:uppercase;">${g.quarter || 'Q3 2026'} • ${g.status || 'Active'}</div>
      <div style="font-size:1.1rem; font-weight:800; color:var(--text); margin-top:2px;">${escapeHTML(g.objective)}</div>
      <div style="margin-top:8px;">
        <div style="display:flex; justify-content:space-between; font-size:0.78rem; color:var(--muted); margin-bottom:4px;">
          <span>Progress</span>
          <span style="font-weight:700; color:var(--accent);">${g.progress}%</span>
        </div>
        <div class="bar-track"><div class="bar-fill" style="width:${g.progress}%;"></div></div>
      </div>
    `;
  }

  const projects = loadProjects();
  const projCard = document.getElementById("execCurrentProjectCard");
  if (projCard) {
    const p = projects[0] || { title: "Executive Strategy 2026", cat: "Work" };
    const projectTasks = tasks.filter(t => t.projectId === p.id);
    const doneTasks = projectTasks.length ? projectTasks.filter(t => t.completed).length : tasks.filter(t => t.completed).length;
    const totalTasks = projectTasks.length ? projectTasks.length : tasks.length;
    const pct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
    projCard.innerHTML = `
      <div style="font-size:0.78rem; color:var(--muted); font-weight:600;">Category: ${p.cat || 'Work'}</div>
      <div style="font-size:1.1rem; font-weight:800; color:var(--text); margin-top:2px;">${escapeHTML(p.title)}</div>
      <div style="margin-top:8px;">
        <div style="display:flex; justify-content:space-between; font-size:0.78rem; color:var(--muted); margin-bottom:4px;">
          <span>Completion Velocity</span>
          <span style="font-weight:700; color:var(--green);">${pct}%</span>
        </div>
        <div class="bar-track"><div class="bar-fill" style="width:${pct}%; background:var(--green);"></div></div>
      </div>
    `;
  }

  const deadlinesContainer = document.getElementById("execDeadlinesContainer");
  if (deadlinesContainer) {
    const upcoming = tasks.filter(t => !t.completed && t.dueDate).sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 3);
    if (!upcoming.length) {
      deadlinesContainer.innerHTML = `<div style="font-size:0.85rem; color:var(--muted)">No upcoming task deadlines scheduled.</div>`;
    } else {
      deadlinesContainer.innerHTML = upcoming.map(t => `
        <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.03); border:1px solid var(--border); padding:8px 12px; border-radius:var(--radius-sm); font-size:0.85rem;">
          <span style="font-weight:600; color:var(--text);">${escapeHTML(t.title)}</span>
          <span style="font-family:var(--font-code); font-size:0.75rem; color:var(--amber); background:rgba(245,158,11,0.12); padding:2px 6px; border-radius:4px;">${t.dueDate}</span>
        </div>
      `).join('');
    }
  }

  const insightsContainer = document.getElementById("execInsightsContainer");
  if (insightsContainer) {
    const insights = generateExecutiveInsights();
    insightsContainer.innerHTML = insights.map(i => `
      <div style="display:flex; align-items:center; gap:10px; background:rgba(255,255,255,0.03); border:1px solid var(--border); padding:8px 12px; border-radius:var(--radius-sm); font-size:0.85rem;">
        <span style="font-size:1.1rem;">${i.icon}</span>
        <span style="color:var(--text); line-height:1.4;">${i.text}</span>
      </div>
    `).join('');
  }
}

if (typeof window !== "undefined") {
  window.openStreakFreezeModal = openStreakFreezeModal;
  window.closeStreakFreezeModal = closeStreakFreezeModal;
}
