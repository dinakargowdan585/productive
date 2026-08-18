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
}

function selectClockStyle(styleName) {
  activeClockStyle = styleName;
  localStorage.setItem("learningClockStyle", styleName);
  updateClockVisibility();
  updateStandbyClock();
  renderClockStyleGrid();
  if (typeof showToast === "function") showToast(`Clock face set to ${styleName.toUpperCase()}`, "info");
}

function toggleClockStylePanel(e) {
  if (e && typeof e.stopPropagation === "function") e.stopPropagation();
  const popover = document.getElementById("clockStylePopover");
  if (!popover) return;
  
  const isHidden = popover.style.display === "none" || !popover.classList.contains("is-open");
  if (isHidden) {
    popover.style.display = "flex";
    popover.classList.add("is-open");
    renderClockStyleGrid();
  } else {
    popover.style.display = "none";
    popover.classList.remove("is-open");
  }
}

function closeClockStylePanel() {
  const popover = document.getElementById("clockStylePopover");
  if (popover) {
    popover.style.display = "none";
    popover.classList.remove("is-open");
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
    <div class="theme-card ${activeClockStyle === s.id ? 'selected' : ''}" 
         onclick="selectClockStyle('${s.id}')">
      <div class="theme-title">${s.title}</div>
      <div class="theme-desc">${s.desc}</div>
    </div>
  `).join('');
}

document.addEventListener("click", (e) => {
  const popover = document.getElementById("clockStylePopover");
  const btn = document.getElementById("clockStyleTogglePill");
  if (popover && (popover.style.display === "flex" || popover.classList.contains("is-open"))) {
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

// Initial clock visibility & tick timer
if (typeof window !== "undefined") {
  window.addEventListener("DOMContentLoaded", () => {
    updateClockVisibility();
    updateStandbyClock();
  });
}

setInterval(updateStandbyClock, 1000);
