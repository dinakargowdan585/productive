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
        <div class="task-card-menu-item" onclick="addDashboardCard('${c.id}'); toggleAddCardMenu();">
          ➕ ${c.name}
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
      icon: "⚠️",
      text: `"${overdue[0].title}" is behind schedule (due ${overdue[0].dueDate}).`,
      type: "warning"
    });
  }

  const completedBlocks = blocks.filter(b => b.completed);
  const totalFocusMins = completedBlocks.reduce((acc, b) => acc + (b.durationMinutes || 0), 0);
  if (totalFocusMins > 0) {
    insights.push({
      icon: "📈",
      text: `You completed ${formatDurationHuman(totalFocusMins)} of deep focus sessions.`,
      type: "success"
    });
  } else {
    insights.push({
      icon: "💡",
      text: "Schedule a 60m focus block today to maintain your deep work momentum.",
      type: "info"
    });
  }

  if (completed.length >= 3) {
    insights.push({
      icon: "⚡",
      text: `Great velocity! You completed ${completed.length} tasks this week.`,
      type: "success"
    });
  }

  insights.push({
    icon: "🌙",
    text: "Productivity Pattern: You achieve highest focus consistency between 6:00 PM – 9:00 PM.",
    type: "info"
  });

  return insights.slice(0, 4);
}

function renderProductivityHeatmap() {
  const grid = document.getElementById("productivityHeatmapGrid");
  const monthsContainer = document.getElementById("heatmapMonthsLabels");
  const totalCountEl = document.getElementById("heatmapTotalCount");
  if (!grid) return;

  const tasks = loadTasks();
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
    let level = 0;
    if (count === 1) level = 1;
    else if (count === 2) level = 2;
    else if (count >= 3 && count <= 4) level = 3;
    else if (count >= 5) level = 4;

    const formattedDate = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    const tip = `${formattedDate}: ${count} task${count === 1 ? '' : 's'} completed`;

    return `<div class="heatmap-cell" data-level="${level}" title="${tip}" onclick="if(typeof showToast === 'function') showToast('${tip}', 'info');"></div>`;
  }).join('');
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
    subtitle = "☀️ Morning Focus & Clarity";
  } else if (hour >= 12 && hour < 17) {
    timeSalute = "Good Afternoon";
    auraColor = "rgba(56, 189, 248, 0.25)";
    subtitle = "⚡ Peak Execution Window";
  } else if (hour >= 17 && hour < 21) {
    timeSalute = "Good Evening";
    auraColor = "rgba(168, 85, 247, 0.25)";
    subtitle = "🌆 Milestone Review & Wrap-up";
  } else {
    timeSalute = "Good Night";
    auraColor = "rgba(99, 102, 241, 0.22)";
    subtitle = "🌙 Night StandBy & Recovery";
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
            <button type="button" class="secondary" onclick="startFocusSessionForBlock('')" style="padding:4px 12px; font-size:0.78rem; background:var(--accent); color:#05070a; font-weight:700; border:none;">▶ Focus</button>
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
    const p = projects[0] || { title: "🏢 Executive Strategy 2026", cat: "Work" };
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
