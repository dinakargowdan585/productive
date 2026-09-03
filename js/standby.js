/* Apple StandBy Bedside Mode & Pomodoro Timer Engine */

let activeClockStyle = localStorage.getItem("learningClockStyle") || "apple";
let previewClockStyle = null;
let isNightMode = false;
let pomodoroMinutes = 25;
let pomodoroSeconds = 0;
let pomodoroTimerId = null;
let isPomodoroRunning = false;

const AppleStandbyClock = {
  render: function(now) {
    const hours12 = now.getHours() % 12 || 12;
    const h = String(hours12).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const ampm = now.getHours() >= 12 ? 'PM' : 'AM';
    const dateStr = `${now.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' }).toUpperCase()} • ${ampm}`;
    return `
      <div class="apple-standby-clock-wrap">
        <div class="apple-standby-digits">
          <span>${h}</span>
          <span class="apple-standby-colon">:</span>
          <span>${m}</span>
        </div>
        <div class="apple-standby-date">${dateStr}</div>
      </div>
    `;
  }
};

function updateClockVisibility() {
  const style = previewClockStyle || activeClockStyle;
  const flipClockWrap = document.getElementById("flipClockWrap");
  const clockDisplayContainer = document.getElementById("clockDisplayContainer");
  const standbyDate = document.getElementById("standbyDate");

  if (flipClockWrap) {
    flipClockWrap.style.setProperty("display", style === "flip" ? "flex" : "none", "important");
  }
  if (clockDisplayContainer) {
    clockDisplayContainer.style.setProperty("display", style === "flip" ? "none" : "flex", "important");
  }
  if (standbyDate) {
    standbyDate.style.setProperty("display", style === "apple" ? "none" : "block", "important");
  }
}

function renderActiveClockFace() {
  const style = previewClockStyle || activeClockStyle;
  const container = document.getElementById("clockDisplayContainer");
  if (!container || style === "flip") return;

  const now = new Date();
  const hours12 = now.getHours() % 12 || 12;
  const h = String(hours12).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  const ampm = now.getHours() >= 12 ? 'PM' : 'AM';
  const timeStr = `${h}:${m}:${s} ${ampm}`;
  const timeStrNoSec = `${h}:${m} ${ampm}`;

  if (style === "apple") {
    container.innerHTML = AppleStandbyClock.render(now);
  } else if (style === "analog") {
    const secDeg = now.getSeconds() * 6;
    const minDeg = now.getMinutes() * 6 + now.getSeconds() * 0.1;
    const hourDeg = (now.getHours() % 12) * 30 + now.getMinutes() * 0.5;
    container.innerHTML = `
      <div class="analog-clock-wrap">
        <div class="analog-center-dot"></div>
        <div class="analog-hand hour" style="transform:rotate(${hourDeg}deg)"></div>
        <div class="analog-hand minute" style="transform:rotate(${minDeg}deg)"></div>
        <div class="analog-hand second" style="transform:rotate(${secDeg}deg)"></div>
      </div>
    `;
  } else if (style === "led") {
    container.innerHTML = `<div style="font-family:var(--font-code); font-size:var(--clock-custom-font, 5rem); font-weight:900; color:var(--accent); text-shadow:0 0 25px var(--accent); letter-spacing:2px;">${timeStr}</div>`;
  } else if (style === "minimal") {
    container.innerHTML = `<div style="font-size:calc(var(--clock-custom-font, 5rem) * 1.1); font-weight:200; letter-spacing:-2px; color:#fff;">${timeStrNoSec}</div>`;
  } else {
    container.innerHTML = `<div style="font-family:var(--font-code); font-size:var(--clock-custom-font, 5rem); font-weight:800; color:var(--text);">${timeStr}</div>`;
  }
}

function updateStandbyClock() {
  updateClockVisibility();

  const now = new Date();
  const hours12 = now.getHours() % 12 || 12;
  const h = String(hours12).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');

  const effectiveStyle = previewClockStyle || activeClockStyle;
  if (effectiveStyle === "flip") {
    updateFlipUnit("flipH1", h[0]);
    updateFlipUnit("flipH2", h[1]);
    updateFlipUnit("flipM1", m[0]);
    updateFlipUnit("flipM2", m[1]);
    updateFlipUnit("flipS1", s[0]);
    updateFlipUnit("flipS2", s[1]);
  } else {
    renderActiveClockFace();
  }

  const dateEl = document.getElementById("standbyDate");
  if (dateEl) {
    dateEl.textContent = now.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' }).toUpperCase();
  }
}

function updateFlipUnit(unitId, val) {
  const unit = document.getElementById(unitId);
  if (!unit) return;
  const currentVal = unit.querySelector(".flip-top-static span")?.textContent;
  if (currentVal === val) return;

  unit.querySelectorAll("span").forEach(s => s.textContent = val);
  unit.classList.remove("flipping");
  void unit.offsetWidth;
  unit.classList.add("flipping");
  if (typeof FX !== "undefined" && (unitId.includes("M") || unitId.includes("H"))) {
    FX.playClick();
  }
}

function selectClockStyle(styleName, e) {
  if (e && typeof e.stopPropagation === "function") e.stopPropagation();
  activeClockStyle = styleName;
  localStorage.setItem("learningClockStyle", styleName);
  updateClockVisibility();
  updateStandbyClock();
  renderClockStyleGrid();
  if (typeof showToast === "function") showToast(`Clock face set to ${styleName.toUpperCase()}`, "info");
  setTimeout(() => {
    closeClockStylePanel();
  }, 150);
}

function toggleClockStylePanel(e) {
  if (e) {
    if (typeof e.stopPropagation === "function") e.stopPropagation();
    if (typeof e.preventDefault === "function") e.preventDefault();
  }
  const popover = document.getElementById("clockStylePopover");
  if (!popover) return;
  
  const isOpen = popover.classList.contains("is-open") || popover.classList.contains("open") || (popover.style.display && popover.style.display !== "none");
  if (isOpen) {
    closeClockStylePanel();
  } else {
    if (typeof closeTimerPanel === "function") closeTimerPanel();
    popover.style.display = "flex";
    popover.classList.add("is-open", "open");
    popover.setAttribute("aria-hidden", "false");
    const pill = document.getElementById("clockStyleTogglePill");
    if (pill) pill.setAttribute("aria-expanded", "true");
    renderClockStyleGrid();
  }
}

function closeClockStylePanel() {
  const popover = document.getElementById("clockStylePopover");
  if (popover) {
    popover.style.display = "none";
    popover.classList.remove("is-open", "open");
    popover.setAttribute("aria-hidden", "true");
    const pill = document.getElementById("clockStyleTogglePill");
    if (pill) pill.setAttribute("aria-expanded", "false");
  }
}

function renderClockStyleGrid() {
  const grid = document.getElementById("clockStyleGrid");
  if (!grid) return;

  const styles = [
    { id: "apple", title: " Apple StandBy", desc: "VisionOS 12h clock with date" },
    { id: "flip", title: "📟 3D Flip Clock", desc: "Retro mechanical split-flap" },
    { id: "led", title: "🔴 LED Neon", desc: "Glowing cyan digital" },
    { id: "analog", title: "⏱️ Swiss Analog", desc: "Moving watch hands" },
    { id: "minimal", title: "🔲 Minimalist Mono", desc: "Lightweight font" }
  ];

  grid.innerHTML = styles.map(s => `
    <div class="theme-card ${activeClockStyle === s.id ? 'selected active' : ''}" 
         onclick="selectClockStyle('${s.id}', event)" role="button" tabindex="0">
      <div class="theme-title" style="font-weight:700; font-size:0.85rem; color:var(--text);">${s.title}</div>
      <div class="theme-desc" style="font-size:0.75rem; color:var(--muted); margin-top:2px;">${s.desc}</div>
    </div>
  `).join('');
}

document.addEventListener("click", (e) => {
  const popover = document.getElementById("clockStylePopover");
  const btn = document.getElementById("clockStyleTogglePill");
  if (popover && (popover.style.display === "flex" || popover.classList.contains("is-open") || popover.classList.contains("open"))) {
    if (!popover.contains(e.target) && btn && !btn.contains(e.target)) {
      closeClockStylePanel();
    }
  }
});

function toggleNightMode() {
  isNightMode = !isNightMode;
  const screen = document.getElementById("standbyScreen");
  if (screen) screen.classList.toggle("night-mode", isNightMode);
}

function toggleFullscreenStandby() {
  const elem = document.getElementById("standbyScreen") || document.documentElement;
  const isFS = document.fullscreenElement || document.webkitFullscreenElement;
  
  if (!isFS) {
    elem.classList.add("is-fullscreen");
    if (elem.requestFullscreen) elem.requestFullscreen();
    else if (elem.webkitRequestFullscreen) elem.webkitRequestFullscreen();
    if (typeof showToast === "function") showToast("Entered StandBy Fullscreen Mode.", "info");
  } else {
    elem.classList.remove("is-fullscreen");
    if (document.exitFullscreen) document.exitFullscreen();
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    if (typeof showToast === "function") showToast("Exited Fullscreen Mode.", "info");
  }
}

document.addEventListener("fullscreenchange", () => {
  const elem = document.getElementById("standbyScreen");
  if (elem && !document.fullscreenElement) {
    elem.classList.remove("is-fullscreen");
  }
});

function toggleTimerPanel() {
  const panel = document.getElementById("pomodoroPanel") || document.getElementById("pomodoroDrawer");
  if (!panel) return;
  panel.classList.toggle("is-open");
  panel.classList.toggle("open");
  const isOpen = panel.classList.contains("is-open") || panel.classList.contains("open");
  panel.setAttribute("aria-hidden", (!isOpen).toString());
  updatePomodoroDisplay();
}

function closeTimerPanel() {
  const panel = document.getElementById("pomodoroPanel") || document.getElementById("pomodoroDrawer");
  if (!panel) return;
  panel.classList.remove("is-open");
  panel.classList.remove("open");
  panel.setAttribute("aria-hidden", "true");
}

function toggleTimer() {
  if (isPomodoroRunning) {
    pausePomodoro();
    if (typeof showToast === "function") showToast("Timer paused.", "info");
  } else {
    startPomodoro();
    if (typeof showToast === "function") showToast("Focus timer started! ⏱️", "success");
  }
}

function resetTimer() {
  resetPomodoro();
  if (typeof showToast === "function") showToast("Timer reset.", "info");
}

function setTimerPreset(mins) {
  pausePomodoro();
  pomodoroMinutes = Math.max(1, mins);
  pomodoroSeconds = 0;
  updatePomodoroDisplay();
  if (typeof showToast === "function") showToast(`Timer set to ${mins} minutes.`, "info");
}

function adjustTimer(deltaMins) {
  pomodoroMinutes = Math.max(1, pomodoroMinutes + deltaMins);
  updatePomodoroDisplay();
  if (typeof showToast === "function") showToast(`Timer adjusted to ${pomodoroMinutes}m`, "info");
}

function editCustomTimer() {
  const mins = prompt("Enter custom focus timer (minutes):", pomodoroMinutes);
  if (mins && !isNaN(parseInt(mins, 10))) {
    setTimerPreset(parseInt(mins, 10));
  }
}

function setCustomMinutesFromInput() {
  const input = document.getElementById("customMinutes") || document.getElementById("customTimerInput");
  if (input && input.value) {
    const mins = parseInt(input.value, 10);
    if (!isNaN(mins) && mins > 0) {
      setTimerPreset(mins);
    }
  }
}

function startPomodoro() {
  if (isPomodoroRunning) return;
  isPomodoroRunning = true;
  if (pomodoroTimerId) clearInterval(pomodoroTimerId);
  pomodoroTimerId = setInterval(tickPomodoro, 1000);
  updatePomodoroDisplay();
}

function pausePomodoro() {
  isPomodoroRunning = false;
  if (pomodoroTimerId) clearInterval(pomodoroTimerId);
  pomodoroTimerId = null;
  updatePomodoroDisplay();
}

function resetPomodoro() {
  pausePomodoro();
  pomodoroMinutes = 25;
  pomodoroSeconds = 0;
  updatePomodoroDisplay();
}

function tickPomodoro() {
  if (pomodoroSeconds > 0) {
    pomodoroSeconds--;
  } else if (pomodoroMinutes > 0) {
    pomodoroMinutes--;
    pomodoroSeconds = 59;
  } else {
    pausePomodoro();
    if (typeof showToast === "function") showToast("🎉 Focus session completed!", "success");
    try {
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        new Notification("Productive OS", { body: "🎉 Focus session completed!" });
      }
    } catch (e) {}
  }
  updatePomodoroDisplay();
}

function togglePomodoroTimer() {
  if (isPomodoroRunning) {
    pausePomodoro();
    if (typeof showToast === "function") showToast("Focus timer paused ⏸️", "info");
  } else {
    startPomodoro();
    if (typeof showToast === "function") showToast("Focus timer running ▶️", "info");
  }
}

function stopPomodoroTimer() {
  resetPomodoro();
  const pipWidget = document.getElementById("floatingFocusWidget");
  if (pipWidget) pipWidget.style.display = "none";
  if (typeof showToast === "function") showToast("Focus session stopped ⏹️", "info");
}

function updatePomodoroDisplay() {
  const formatted = `${String(pomodoroMinutes).padStart(2, '0')}:${String(pomodoroSeconds).padStart(2, '0')}`;
  
  const timerDisplay = document.getElementById("timerDisplay");
  if (timerDisplay) timerDisplay.textContent = formatted;

  const digitsEl = document.getElementById("pomodoroDigits");
  if (digitsEl) digitsEl.textContent = formatted;

  const startBtn = document.getElementById("startTimerBtn");
  if (startBtn) {
    startBtn.textContent = isPomodoroRunning ? "Pause Focus" : "Start Focus";
    startBtn.style.background = isPomodoroRunning ? "var(--amber)" : "var(--accent)";
  }

  const pipWidget = document.getElementById("floatingFocusWidget");
  const pipTimerText = document.getElementById("floatingFocusTimerText");
  const pipPlayBtn = document.getElementById("floatingFocusPlayBtn");
  if (pipWidget) {
    if (isPomodoroRunning || (pomodoroMinutes < 25 && pomodoroMinutes > 0)) {
      pipWidget.style.display = "flex";
      if (pipTimerText) pipTimerText.textContent = formatted;
      if (pipPlayBtn) pipPlayBtn.textContent = isPomodoroRunning ? "⏸️" : "▶️";
    } else if (!isPomodoroRunning && pomodoroMinutes === 25 && pomodoroSeconds === 0) {
      pipWidget.style.display = "none";
    }
  }
}

function startFocusSessionForBlock(blockId) {
  if (typeof switchView === "function") switchView("standby");
  const panel = document.getElementById("pomodoroPanel") || document.getElementById("pomodoroDrawer");
  if (panel && !panel.classList.contains("is-open") && !panel.classList.contains("open")) {
    toggleTimerPanel();
  }
  resetPomodoro();
  startPomodoro();
  if (typeof showToast === "function") showToast("Focus session started! ⏱️", "success");
}

/* ===================================================================
   Live MIT / Task Focus Widget on StandBy Screen
   =================================================================== */

let activeStandbyTaskIndex = 0;

function renderStandbyFocusWidget() {
  const container = document.getElementById("standbyFocusWidget");
  if (!container) return;

  const tasks = typeof loadTasks === "function" ? loadTasks() : [];
  const pending = tasks.filter(t => !t.completed);

  if (!pending.length) {
    container.innerHTML = `
      <div class="standby-focus-card" style="text-align:center; align-items:center;">
        <div style="display:inline-flex; align-items:center; justify-content:center; width:40px; height:40px; border-radius:50%; background:rgba(48,209,88,0.15); color:var(--green); margin-bottom:4px;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <h4 style="margin:0; font-size:1.05rem; font-weight:800; color:var(--text);">All Today's MITs Completed!</h4>
        <p style="margin:0; font-size:0.8rem; color:var(--muted); max-width:380px;">Enjoy your flow state, or capture a new focus task below.</p>
        <div style="width:100%; margin-top:6px;">
          <input type="text" class="standby-quick-input" placeholder="+ Add a new focus task (Press Enter)..." onkeydown="handleStandbyQuickAddKeydown(event)">
        </div>
      </div>
    `;
    return;
  }

  if (activeStandbyTaskIndex >= pending.length) {
    activeStandbyTaskIndex = 0;
  } else if (activeStandbyTaskIndex < 0) {
    activeStandbyTaskIndex = pending.length - 1;
  }

  const t = pending[activeStandbyTaskIndex];
  const cal = (typeof getCalendarById === "function") ? getCalendarById(t.calendarId || t.category || "work") : { name: "Work", color: "var(--accent)" };
  const projects = typeof loadProjects === "function" ? loadProjects() : [];
  const proj = t.projectId ? projects.find(p => p.id === t.projectId) : null;
  const subtasks = Array.isArray(t.subtasks) ? t.subtasks : [];
  const subDone = subtasks.filter(st => st.completed).length;

  container.innerHTML = `
    <div class="standby-focus-card">
      <div class="standby-focus-header">
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="letter-spacing:1px; font-weight:700; color:var(--accent);">FOCUS MIT ${activeStandbyTaskIndex + 1} OF ${pending.length}</span>
          ${t.isDaily ? `<span class="badge" style="background:rgba(255,149,0,0.15); color:var(--amber); font-size:0.68rem;">Daily Habit</span>` : ''}
        </div>
        <div style="display:flex; align-items:center; gap:6px;">
          <button type="button" class="standby-focus-nav-btn" onclick="cycleStandbyTask(-1)" ${pending.length <= 1 ? 'disabled' : ''} title="Previous Task">‹</button>
          <button type="button" class="standby-focus-nav-btn" onclick="cycleStandbyTask(1)" ${pending.length <= 1 ? 'disabled' : ''} title="Next Task">›</button>
        </div>
      </div>

      <div class="standby-focus-body">
        <div class="standby-checkbox-wrap">
          <input type="checkbox" class="standby-checkbox" id="standbyCheck-${t.id}" onchange="completeStandbyTask('${t.id}')" title="Mark Task Complete">
        </div>
        <div style="flex:1; min-width:0;">
          <h3 class="standby-task-title">${escapeHTML(t.title)}</h3>
          <div class="standby-meta-row">
            <span class="badge" style="background:${cal.color}22; color:${cal.color}; font-size:0.7rem; font-weight:700;">${escapeHTML(cal.name)}</span>
            ${proj ? `<span class="badge" style="background:rgba(255,255,255,0.06); color:var(--text); font-size:0.68rem; display:inline-flex; align-items:center; gap:4px;"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>${escapeHTML(proj.name || proj.title)}</span>` : ''}
            <span class="priority-pill priority-${(t.priority || 'HIGH').toLowerCase()}" style="font-size:0.68rem; padding:2px 6px;">${(t.priority || 'MED').toUpperCase()}</span>
            ${t.estimateMins ? `<span style="font-size:0.72rem; color:var(--muted); font-family:var(--font-code);">⏱️ ${t.estimateMins}m</span>` : ''}
            ${t.dueDate ? `<span style="font-size:0.72rem; color:var(--muted); font-family:var(--font-code);">📅 ${t.dueDate}</span>` : ''}
          </div>
        </div>
        <button type="button" onclick="startStandbyTaskFocus('${t.id}')" class="standby-focus-nav-btn" style="background:var(--accent); color:#05070A; border:none; padding:6px 12px; font-weight:800; display:inline-flex; align-items:center; gap:4px;" title="Launch Pomodoro Timer for this task">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> Focus
        </button>
      </div>

      ${subtasks.length > 0 ? `
        <div style="margin-top:4px; padding-top:8px; border-top:1px solid rgba(255,255,255,0.06); display:flex; flex-direction:column; gap:6px;">
          <div style="display:flex; justify-content:space-between; font-size:0.72rem; color:var(--muted); font-family:var(--font-code);">
            <span>Sub-steps Progress</span>
            <span style="font-weight:700; color:var(--accent);">${subDone}/${subtasks.length} Completed</span>
          </div>
          <div style="width:100%; height:4px; background:rgba(255,255,255,0.08); border-radius:2px; overflow:hidden;">
            <div style="width:${Math.round((subDone / subtasks.length) * 100)}%; height:100%; background:var(--accent); transition:width 200ms ease;"></div>
          </div>
          <div style="display:flex; flex-direction:column; gap:4px; margin-top:2px;">
            ${subtasks.slice(0, 3).map(st => `
              <label class="standby-subtask-item" style="cursor:pointer;">
                <input type="checkbox" ${st.completed ? 'checked' : ''} onchange="toggleStandbySubtask('${t.id}', '${st.id}')" style="accent-color:var(--accent); cursor:pointer;">
                <span style="${st.completed ? 'text-decoration:line-through; opacity:0.6;' : ''}">${escapeHTML(st.title)}</span>
              </label>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <div style="margin-top:4px; padding-top:8px; border-top:1px solid rgba(255,255,255,0.06);">
        <input type="text" class="standby-quick-input" placeholder="+ Quick add another task (Press Enter)..." onkeydown="handleStandbyQuickAddKeydown(event)">
      </div>
    </div>
  `;
}

function completeStandbyTask(taskId) {
  if (typeof toggleTask === "function") {
    toggleTask(taskId);
  }
  renderStandbyFocusWidget();
}

function cycleStandbyTask(delta) {
  activeStandbyTaskIndex += delta;
  renderStandbyFocusWidget();
  if (typeof FX !== "undefined" && typeof FX.playClick === "function") FX.playClick();
}

function toggleStandbySubtask(taskId, subtaskId) {
  const tasks = typeof loadTasks === "function" ? loadTasks() : [];
  const t = tasks.find(x => x.id === taskId);
  if (!t || !Array.isArray(t.subtasks)) return;

  const st = t.subtasks.find(x => x.id === subtaskId);
  if (st) {
    st.completed = !st.completed;
    t.updatedAt = new Date().toISOString();
    if (typeof saveTasks === "function") saveTasks(tasks);
    if (typeof renderPlanner === "function") renderPlanner();
    if (typeof renderCalendar === "function") renderCalendar();
    if (typeof triggerBackgroundSync === "function") triggerBackgroundSync();
    if (typeof FX !== "undefined" && typeof FX.playClick === "function") FX.playClick();
    renderStandbyFocusWidget();
  }
}

function startStandbyTaskFocus(taskId) {
  const tasks = typeof loadTasks === "function" ? loadTasks() : [];
  const t = tasks.find(x => x.id === taskId);
  if (t) {
    pomodoroMinutes = t.estimateMins || 25;
    pomodoroSeconds = 0;
    const pipTaskTitle = document.getElementById("floatingFocusTaskTitle");
    if (pipTaskTitle) pipTaskTitle.textContent = t.title;
  }
  const panel = document.getElementById("pomodoroPanel") || document.getElementById("pomodoroDrawer");
  if (panel && !panel.classList.contains("is-open") && !panel.classList.contains("open")) {
    toggleTimerPanel();
  }
  resetPomodoro();
  startPomodoro();
  if (typeof showToast === "function") showToast(`Focus started for: ${t ? t.title : 'Task'}! ⏱️`, "success");
}

function handleStandbyQuickAddKeydown(event) {
  if (event.key === "Enter") {
    event.preventDefault();
    const title = (event.target.value || "").trim();
    if (!title) return;

    const newTask = {
      id: typeof uuid === "function" ? uuid() : "task-" + Date.now(),
      title: title,
      category: "work",
      calendarId: "work",
      priority: "MED",
      dueDate: getIsoDateStr(),
      estimateMins: 25,
      completed: false,
      streak: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const tasks = typeof loadTasks === "function" ? loadTasks() : [];
    tasks.unshift(newTask);
    if (typeof saveTasks === "function") saveTasks(tasks);
    activeStandbyTaskIndex = 0;
    event.target.value = "";

    if (typeof renderPlanner === "function") renderPlanner();
    if (typeof renderCalendar === "function") renderCalendar();
    if (typeof renderDashboard === "function") renderDashboard();
    if (typeof triggerBackgroundSync === "function") triggerBackgroundSync();
    if (typeof FX !== "undefined" && typeof FX.playClick === "function") FX.playClick();
    if (typeof showToast === "function") showToast(`Added focus task: ${title}!`, "success");

    renderStandbyFocusWidget();
  }
}

// Global Window Exports
if (typeof window !== "undefined") {
  window.togglePomodoroTimer = togglePomodoroTimer;
  window.stopPomodoroTimer = stopPomodoroTimer;
  window.toggleClockStylePanel = toggleClockStylePanel;
  window.closeClockStylePanel = closeClockStylePanel;
  window.selectClockStyle = selectClockStyle;
  window.renderClockStyleGrid = renderClockStyleGrid;
  window.toggleTimerPanel = toggleTimerPanel;
  window.closeTimerPanel = closeTimerPanel;
  window.toggleNightMode = toggleNightMode;
  window.toggleFullscreenStandby = toggleFullscreenStandby;
  window.updateStandbyClock = updateStandbyClock;
  window.startPomodoro = startPomodoro;
  window.pausePomodoro = pausePomodoro;
  window.resetPomodoro = resetPomodoro;
  window.toggleTimer = toggleTimer;
  window.setTimerPreset = setTimerPreset;
  window.adjustTimer = adjustTimer;
  window.startFocusSessionForBlock = startFocusSessionForBlock;
  window.renderStandbyFocusWidget = renderStandbyFocusWidget;
  window.completeStandbyTask = completeStandbyTask;
  window.cycleStandbyTask = cycleStandbyTask;
  window.toggleStandbySubtask = toggleStandbySubtask;
  window.startStandbyTaskFocus = startStandbyTaskFocus;
  window.handleStandbyQuickAddKeydown = handleStandbyQuickAddKeydown;
}

// Initial clock visibility & tick timer
if (typeof window !== "undefined") {
  window.addEventListener("DOMContentLoaded", () => {
    updateClockVisibility();
    updateStandbyClock();
    renderStandbyFocusWidget();
  });
}

setInterval(updateStandbyClock, 1000);

