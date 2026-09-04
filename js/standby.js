/* Apple StandBy Bedside Mode & Pomodoro Timer Engine (Fliqlo Minimalist Zen) */

let activeClockStyle = localStorage.getItem("learningClockStyle") || "flip";
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
    return `
      <div class="apple-standby-clock-wrap">
        <div class="apple-standby-digits">
          <span>${h}</span>
          <span class="apple-standby-colon">:</span>
          <span>${m}</span>
        </div>
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
    standbyDate.style.setProperty("display", "block", "important");
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
  const ampm = now.getHours() >= 12 ? 'PM' : 'AM';

  const effectiveStyle = previewClockStyle || activeClockStyle;
  if (effectiveStyle === "flip") {
    updateFlipUnit("flipH1", h[0]);
    updateFlipUnit("flipH2", h[1]);
    updateFlipUnit("flipM1", m[0]);
    updateFlipUnit("flipM2", m[1]);
    updateFlipUnit("flipS1", s[0]);
    updateFlipUnit("flipS2", s[1]);

    const ampmBadge = document.getElementById("flipAmpmBadge");
    if (ampmBadge && ampmBadge.textContent !== ampm) {
      ampmBadge.textContent = ampm;
    }
  } else {
    renderActiveClockFace();
  }

  const dateEl = document.getElementById("standbyDate");
  if (dateEl) {
    dateEl.textContent = now.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' }).toUpperCase();
  }
}

function updateFlipUnit(unitId, nextVal) {
  const unit = document.getElementById(unitId);
  if (!unit) return;

  const topStatic = unit.querySelector(".flip-top-static span");
  const bottomStatic = unit.querySelector(".flip-bottom-static span");
  const topFold = unit.querySelector(".flip-top-fold span");
  const bottomFold = unit.querySelector(".flip-bottom-fold span");

  if (!topStatic || !bottomStatic || !topFold || !bottomFold) return;

  const currentVal = topStatic.textContent;
  if (currentVal === nextVal) return;

  // 1. Set old value on folding top leaf and static bottom
  topFold.textContent = currentVal;
  bottomStatic.textContent = currentVal;

  // 2. Set new value on revealed static top and unfolding bottom leaf
  topStatic.textContent = nextVal;
  bottomFold.textContent = nextVal;

  // 3. Trigger 3D mechanical animation
  unit.classList.remove("flipping");
  void unit.offsetWidth;
  unit.classList.add("flipping");

  // 4. Acoustic & haptic mechanical response
  if (typeof FX !== "undefined") {
    if (unitId.includes("M") || unitId.includes("H")) {
      if (typeof FX.playFlap === "function") FX.playFlap();
      else if (typeof FX.playClick === "function") FX.playClick();
      if (typeof FX.haptic === "function") FX.haptic("light");
    }
  }

  // 5. Clean up after animation cycle
  setTimeout(() => {
    bottomStatic.textContent = nextVal;
    topFold.textContent = nextVal;
    unit.classList.remove("flipping");
  }, 480);
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
    { id: "flip", title: "Fliqlo Flip Clock", desc: "Mechanical split-flap cards" },
    { id: "apple", title: "Apple StandBy", desc: "VisionOS minimal typography" },
    { id: "analog", title: "Swiss Analog", desc: "Fine moving watch hands" },
    { id: "led", title: "LED Digital", desc: "Glowing digital clock" },
    { id: "minimal", title: "Minimal Mono", desc: "Ultra-thin lightweight font" }
  ];

  grid.innerHTML = styles.map(s => `
    <div class="theme-card ${activeClockStyle === s.id ? 'selected active' : ''}" 
         onclick="selectClockStyle('${s.id}', event)" role="button" tabindex="0">
      <div class="theme-title" style="font-weight:600; font-size:0.84rem; color:var(--text);">${s.title}</div>
      <div class="theme-desc" style="font-size:0.72rem; color:var(--muted); margin-top:2px;">${s.desc}</div>
    </div>
  `).join('');
}

/* ===================================================================
   StandBy Idle State Controller (Fliqlo Minimalist Zen Experience)
   =================================================================== */

let standbyIdleTimeout = null;

function resetStandbyIdleTimer() {
  const screen = document.getElementById("standbyScreen");
  const viewStandby = document.getElementById("viewStandby");
  if (!viewStandby || viewStandby.style.display === "none") return;

  if (screen) {
    screen.classList.remove("standby-idle");
  }
  const dock = document.querySelector(".macos-dock-container");
  if (dock) {
    dock.classList.remove("standby-dock-hidden");
  }

  if (standbyIdleTimeout) {
    clearTimeout(standbyIdleTimeout);
  }

  // Check if popovers are open
  const clockPopover = document.getElementById("clockStylePopover");
  const timerPanel = document.getElementById("pomodoroPanel");
  const isPopoverOpen = (clockPopover && (clockPopover.style.display === "flex" || clockPopover.classList.contains("is-open") || clockPopover.classList.contains("open"))) ||
                        (timerPanel && (timerPanel.style.display === "flex" || timerPanel.classList.contains("is-open") || timerPanel.classList.contains("open")));

  if (!isPopoverOpen) {
    standbyIdleTimeout = setTimeout(() => {
      const currentView = typeof getCurrentActiveView === "function" ? getCurrentActiveView() : (window.currentActiveView || "dashboard");
      const currentStandby = document.getElementById("viewStandby");
      if (currentView === "standby" && currentStandby && currentStandby.style.display !== "none") {
        if (screen) screen.classList.add("standby-idle");
        if (dock) dock.classList.add("standby-dock-hidden");
      }
    }, 3500);
  }
}

if (typeof window !== "undefined") {
  ["mousemove", "mousedown", "touchstart", "touchmove", "pointermove", "keydown", "wheel"].forEach(evtName => {
    window.addEventListener(evtName, () => {
      const viewStandby = document.getElementById("viewStandby");
      if (viewStandby && viewStandby.style.display !== "none") {
        resetStandbyIdleTimer();
      }
    }, { passive: true });
  });
}

document.addEventListener("click", (e) => {
  const clockPopover = document.getElementById("clockStylePopover");
  const clockBtn = document.getElementById("clockStyleTogglePill");
  if (clockPopover && (clockPopover.style.display === "flex" || clockPopover.classList.contains("is-open") || clockPopover.classList.contains("open"))) {
    if (!clockPopover.contains(e.target) && clockBtn && !clockBtn.contains(e.target)) {
      closeClockStylePanel();
    }
  }

  const timerPanel = document.getElementById("pomodoroPanel");
  const timerBtn = document.getElementById("timerTogglePill");
  if (timerPanel && (timerPanel.style.display === "flex" || timerPanel.classList.contains("is-open") || timerPanel.classList.contains("open"))) {
    if (!timerPanel.contains(e.target) && timerBtn && !timerBtn.contains(e.target)) {
      closeTimerPanel();
    }
  }
});

function toggleNightMode() {
  isNightMode = !isNightMode;
  try {
    localStorage.setItem("learningStandbyNightMode", isNightMode ? "true" : "false");
  } catch (e) {}
  
  const screen = document.getElementById("standbyScreen");
  if (screen) {
    screen.classList.toggle("night-mode", isNightMode);
  }
  
  const btn = document.getElementById("toggleNightModeBtn");
  if (btn) {
    btn.classList.toggle("active", isNightMode);
  }

  if (typeof FX !== "undefined" && typeof FX.playClick === "function") {
    FX.playClick();
  }
  
  if (typeof showToast === "function") {
    showToast(isNightMode ? "Red Night Mode activated" : "Standard mode restored", "info");
  }
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

function toggleTimerPanel(e) {
  if (e) {
    if (typeof e.stopPropagation === "function") e.stopPropagation();
    if (typeof e.preventDefault === "function") e.preventDefault();
  }
  const panel = document.getElementById("pomodoroPanel") || document.getElementById("pomodoroDrawer");
  if (!panel) return;
  
  const isOpen = panel.classList.contains("is-open") || panel.classList.contains("open") || (panel.style.display && panel.style.display !== "none");
  if (isOpen) {
    closeTimerPanel();
  } else {
    if (typeof closeClockStylePanel === "function") closeClockStylePanel();
    panel.style.display = "flex";
    panel.classList.add("is-open", "open");
    panel.setAttribute("aria-hidden", "false");
    const pill = document.getElementById("timerTogglePill");
    if (pill) pill.setAttribute("aria-expanded", "true");
    updatePomodoroDisplay();
  }
}

function closeTimerPanel() {
  const panel = document.getElementById("pomodoroPanel") || document.getElementById("pomodoroDrawer");
  if (!panel) return;
  panel.style.display = "none";
  panel.classList.remove("is-open", "open");
  panel.setAttribute("aria-hidden", "true");
  const pill = document.getElementById("timerTogglePill");
  if (pill) pill.setAttribute("aria-expanded", "false");
}

function toggleTimer() {
  if (isPomodoroRunning) {
    pausePomodoro();
    if (typeof showToast === "function") showToast("Timer paused.", "info");
  } else {
    startPomodoro();
    if (typeof showToast === "function") showToast("Focus timer started!", "success");
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
    if (typeof showToast === "function") showToast("Focus session completed!", "success");
    try {
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        new Notification("Productive OS", { body: "Focus session completed!" });
      }
    } catch (e) {}
  }
  updatePomodoroDisplay();
}

function togglePomodoroTimer() {
  if (isPomodoroRunning) {
    pausePomodoro();
    if (typeof showToast === "function") showToast("Focus timer paused", "info");
  } else {
    startPomodoro();
    if (typeof showToast === "function") showToast("Focus timer running", "info");
  }
}

function stopPomodoroTimer() {
  resetPomodoro();
  const pipWidget = document.getElementById("floatingFocusWidget");
  if (pipWidget) pipWidget.style.display = "none";
  if (typeof showToast === "function") showToast("Focus session stopped", "info");
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

  const isSessionActive = isPomodoroRunning || pomodoroTimerId !== null || (pomodoroSeconds > 0) || (pomodoroMinutes !== 25);

  // 1. Live Countdown Badge on StandBy Screen
  const standbyLiveBadge = document.getElementById("standbyLiveTimerBadge");
  const standbyLiveText = document.getElementById("standbyLiveTimerText");
  if (standbyLiveBadge) {
    if (isSessionActive) {
      standbyLiveBadge.style.display = "inline-flex";
      if (standbyLiveText) {
        standbyLiveText.textContent = isPomodoroRunning ? `${formatted} Focus` : `${formatted} (Paused)`;
      }
    } else {
      standbyLiveBadge.style.display = "none";
    }
  }

  // 2. Global Floating Mini Focus Widget
  const pipWidget = document.getElementById("floatingFocusWidget");
  const pipTimerText = document.getElementById("floatingFocusTimerText");
  const pipPlayBtn = document.getElementById("floatingFocusPlayBtn");
  if (pipWidget) {
    if (isSessionActive) {
      pipWidget.style.display = "inline-flex";
      if (pipTimerText) pipTimerText.textContent = formatted;
      if (pipPlayBtn) {
        pipPlayBtn.innerHTML = isPomodoroRunning
          ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>'
          : '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
      }
    } else {
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
  if (typeof showToast === "function") showToast("Focus session started!", "success");
}

/* ===================================================================
   Live MIT / Task Focus Widget on StandBy Screen
   =================================================================== */

let activeStandbyTaskIndex = 0;

function renderStandbyFocusWidget() {
  const container = document.getElementById("standbyFocusWidget");
  if (!container) return;
  container.innerHTML = "";
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
  window.resetStandbyIdleTimer = resetStandbyIdleTimer;
}

// Initial clock visibility & tick timer
if (typeof window !== "undefined") {
  window.addEventListener("DOMContentLoaded", () => {
    try {
      if (localStorage.getItem("learningStandbyNightMode") === "true") {
        isNightMode = true;
        const screen = document.getElementById("standbyScreen");
        if (screen) screen.classList.add("night-mode");
        const btn = document.getElementById("toggleNightModeBtn");
        if (btn) btn.classList.add("active");
      }
    } catch (e) {}
    updateClockVisibility();
    updateStandbyClock();
    renderStandbyFocusWidget();
  });
}

setInterval(updateStandbyClock, 1000);

