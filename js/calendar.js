/* Desktop Calendar & Week View Timeline Engine */

let calYear = new Date().getFullYear();
let calMonth = new Date().getMonth();
let selectedCalDateStr = getIsoDateStr();
let currentCalViewMode = "month";
let calActiveFilter = "ALL";

function changeCalMonth(delta) {
  calMonth += delta;
  if (calMonth < 0) { calMonth = 11; calYear--; }
  else if (calMonth > 11) { calMonth = 0; calYear++; }
  renderCalendar();
}

function prevMonth() { changeCalMonth(-1); }
function nextMonth() { changeCalMonth(1); }
function todayMonth() { setCalToday(); }
function prevMiniMonth() { changeCalMonth(-1); }
function nextMiniMonth() { changeCalMonth(1); }
function setCalendarView(mode) { setCalViewMode(mode); }
function toggleCalCategory(catId) { filterCalCategory(catId); }

function setCalToday() {
  const now = new Date();
  calYear = now.getFullYear();
  calMonth = now.getMonth();
  selectedCalDateStr = getIsoDateStr();
  renderCalendar();
}

function setCalViewMode(mode) {
  currentCalViewMode = mode;
  document.querySelectorAll(".cal-view-btn").forEach(btn => btn.classList.remove("active"));
  const activeBtn = document.getElementById("calView" + mode.charAt(0).toUpperCase() + mode.slice(1));
  if (activeBtn) activeBtn.classList.add("active");
  renderCalendar();
}

function filterCalCategory(catId) {
  calActiveFilter = catId;
  document.querySelectorAll(".cal-chip").forEach(chip => chip.classList.remove("active"));
  const activeChip = document.getElementById("calChip-" + catId);
  if (activeChip) activeChip.classList.add("active");
  renderCalendar();
}

function openNewEventModal(dateStr) {
  const dlg = document.getElementById("eventModal");
  if (!dlg) return;
  const dateInput = document.getElementById("eventModalDate");
  if (dateInput) dateInput.value = dateStr || selectedCalDateStr || getIsoDateStr();
  dlg.showModal();
}

function closeEventModal() {
  const dlg = document.getElementById("eventModal");
  if (dlg) dlg.close();
}

function saveEventFromModal(e) {
  if (e) e.preventDefault();
  const title = document.getElementById("eventModalTitle")?.value.trim();
  const date = document.getElementById("eventModalDate")?.value || getIsoDateStr();
  const cat = document.getElementById("eventModalCategory")?.value || "work";
  if (!title) return;

  const tasks = loadTasks();
  const cal = getCalendarById(cat);
  tasks.unshift({
    id: uuid(),
    title,
    dueDate: date,
    priority: "Medium",
    calendarId: cal.id,
    calendarName: cal.name,
    calendarColor: cal.color,
    completed: false,
    createdAt: Date.now()
  });

  saveTasks(tasks);
  closeEventModal();
  renderCalendar();
  if (typeof showToast === "function") showToast("Event saved to calendar!", "success");
}

function deleteEventFromModal() {
  closeEventModal();
  if (typeof showToast === "function") showToast("Event canceled.", "info");
}

function renderCalendar() {
  const monthTitle = document.getElementById("calMonthTitle");
  if (monthTitle) {
    const d = new Date(calYear, calMonth, 1);
    monthTitle.textContent = d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }

  renderMiniCalendar();
  renderCalendarCategoryLegend();

  const grid = document.getElementById("calGrid");
  const canvasHeader = document.getElementById("calCanvasHeader");
  if (!grid || !canvasHeader) return;

  const tasks = loadTasks();
  let filteredTasks = tasks;
  if (calActiveFilter !== "ALL") {
    filteredTasks = tasks.filter(t => (t.calendarId || t.category || "work") === calActiveFilter);
  }

  if (currentCalViewMode === "month") {
    renderMonthView(grid, canvasHeader, filteredTasks);
  } else if (currentCalViewMode === "week") {
    renderWeekView(grid, canvasHeader, new Date(selectedCalDateStr), filteredTasks);
  } else if (currentCalViewMode === "day") {
    renderDayView(grid, canvasHeader, new Date(selectedCalDateStr), filteredTasks);
  }
}

function renderMiniCalendar() {
  const container = document.getElementById("miniCalGrid");
  if (!container) return;
  container.innerHTML = "";

  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const startingOffset = (firstDay + 6) % 7;

  const dayHeaders = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  dayHeaders.forEach(h => {
    container.innerHTML += `<div style="font-weight:700; color:var(--muted); font-size:0.7rem;">${h}</div>`;
  });

  for (let i = 0; i < startingOffset; i++) {
    container.innerHTML += `<div class="mini-cal-day other-month"></div>`;
  }

  const todayIso = getIsoDateStr();
  for (let day = 1; day <= daysInMonth; day++) {
    const curDateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const isToday = curDateStr === todayIso;
    const isSelected = curDateStr === selectedCalDateStr;

    container.innerHTML += `
      <div class="mini-cal-day ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}" onclick="selectCalDate('${curDateStr}')">
        ${day}
      </div>
    `;
  }
}

function selectCalDate(dateStr) {
  selectedCalDateStr = dateStr;
  const parts = dateStr.split("-");
  calYear = parseInt(parts[0]);
  calMonth = parseInt(parts[1]) - 1;
  renderCalendar();
}

function renderCalendarCategoryLegend() {
  const container = document.getElementById("calCategoryLegend");
  if (!container) return;
  const cals = loadCalendars();
  container.innerHTML = cals.map(c => `
    <div class="cal-category-item" onclick="filterCalCategory('${c.id}')">
      <span style="display:flex; align-items:center;">
        <span class="cal-color-dot" style="background:${c.color};"></span>
        <span style="color:var(--text);">${escapeHTML(c.name)}</span>
      </span>
    </div>
  `).join('');
}

function renderMonthView(grid, canvasHeader, tasks) {
  canvasHeader.style.display = "grid";
  grid.style.display = "grid";
  grid.style.gridTemplateColumns = "repeat(7, 1fr)";
  grid.style.gap = "6px";
  grid.innerHTML = "";

  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const startingOffset = (firstDay + 6) % 7;
  const todayIso = getIsoDateStr();

  for (let i = 0; i < startingOffset; i++) {
    grid.innerHTML += `<div class="cal-day-cell" style="opacity:0.3; background:transparent;"></div>`;
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const curDateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const isToday = curDateStr === todayIso;
    const dayTasks = tasks.filter(t => t.dueDate === curDateStr);

    grid.innerHTML += `
      <div class="cal-day-cell ${isToday ? 'is-today' : ''}" onclick="selectCalDate('${curDateStr}')">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span class="cal-day-number">${day}</span>
          ${dayTasks.length > 0 ? `<span style="font-size:0.7rem; color:var(--accent); font-weight:700;">${dayTasks.length} task(s)</span>` : ''}
        </div>
        <div style="display:flex; flex-direction:column; gap:4px; margin-top:4px;">
          ${dayTasks.slice(0, 3).map(t => {
            const cal = getCalendarById(t.calendarId || t.category || "work");
            return `
              <div class="cal-event-card" style="background:${cal.color}20; border-left-color:${cal.color}; color:var(--text);">
                <span style="${t.completed ? 'text-decoration:line-through; opacity:0.6;' : ''}">${escapeHTML(t.title)}</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }
}

function getWeekDates(year, month, dateStr) {
  const refDate = dateStr ? new Date(dateStr) : new Date(year, month, 1);
  const dayOfWeek = (refDate.getDay() + 6) % 7;
  const monday = new Date(refDate);
  monday.setDate(refDate.getDate() - dayOfWeek);

  const weekDates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    weekDates.push(d);
  }
  return weekDates;
}

function renderWeekView(grid, canvasHeader, firstDayDate, tasks) {
  canvasHeader.style.display = "none";
  grid.style.display = "grid";
  grid.style.gridTemplateColumns = "65px repeat(7, 1fr)";
  grid.style.gap = "6px";
  grid.innerHTML = "";

  const weekDates = getWeekDates(calYear, calMonth, selectedCalDateStr);
  const allTimeBlocks = loadTimeBlocks();

  grid.innerHTML += `<div style="font-weight:700; font-size:0.75rem; color:var(--muted); padding:8px 0; text-align:center; font-family:var(--font-code);">Time</div>`;
  const daysHeader = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  weekDates.forEach((d, idx) => {
    const dateStr = getIsoDateStr(d);
    const dayNum = d.getDate();
    const isToday = dateStr === getIsoDateStr();
    grid.innerHTML += `
      <div style="text-align:center; font-weight:700; font-size:0.78rem; color:${isToday ? 'var(--accent)' : 'var(--text)'}; padding:6px 0; font-family:var(--font-code); border-bottom:1px solid var(--border);">
        ${daysHeader[idx]} <span style="font-size:0.7rem; opacity:0.8;">${d.getMonth() + 1}/${dayNum}</span>
      </div>
    `;
  });

  const hours = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];

  hours.forEach(hr => {
    const hr12 = hr % 12 || 12;
    const ampm = hr >= 12 ? 'PM' : 'AM';
    const timeLabel = `${hr12}:00 ${ampm}`;
    grid.innerHTML += `<div style="font-size:0.72rem; color:var(--muted); font-family:var(--font-code); text-align:right; padding-right:8px; padding-top:6px;">${timeLabel}</div>`;

    weekDates.forEach(d => {
      const curDateStr = getIsoDateStr(d);
      const hrBlocks = allTimeBlocks.filter(b => {
        if (b.date !== curDateStr) return false;
        const bStartHr = Math.floor(parseTimeToMinutes(b.startTime) / 60);
        return bStartHr === hr;
      });

      grid.innerHTML += `
        <div class="cal-day-cell" style="min-height:44px; padding:4px;">
          ${hrBlocks.map(b => `
            <div class="cal-event-card" style="background:${b.color || 'var(--accent)'}25; border-left-color:${b.color || 'var(--accent)'}; color:var(--text);">
              <span>${escapeHTML(b.taskTitle)}</span>
            </div>
          `).join('')}
        </div>
      `;
    });
  });
}

function renderDayView(grid, canvasHeader, dateObj, tasks) {
  canvasHeader.style.display = "none";
  grid.style.display = "flex";
  grid.style.flexDirection = "column";
  grid.style.gap = "12px";
  grid.innerHTML = "";

  const curDateStr = getIsoDateStr(dateObj);
  const dayTasks = tasks.filter(t => t.dueDate === curDateStr);
  const dayBlocks = loadTimeBlocks().filter(b => b.date === curDateStr);

  grid.innerHTML += `
    <div style="font-size:1.1rem; font-weight:800; color:var(--accent);">
      📅 Schedule for ${dateObj.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
    </div>
  `;

  if (!dayTasks.length && !dayBlocks.length) {
    grid.innerHTML += `<div class="empty-state"><h3>No tasks scheduled today</h3><p>Enjoy your free focus time!</p></div>`;
    return;
  }

  dayBlocks.forEach(b => {
    grid.innerHTML += `
      <div class="panel" style="display:flex; justify-content:space-between; align-items:center; padding:12px 18px; border-left:4px solid ${b.color || 'var(--accent)'};">
        <div>
          <strong style="color:var(--text); font-size:1rem;">${escapeHTML(b.taskTitle)}</strong>
          <div style="font-size:0.8rem; color:var(--muted); margin-top:2px;">⏱️ ${formatTime12Hour(b.startTime)} – ${formatTime12Hour(b.endTime)} (${b.durationMinutes}m)</div>
        </div>
        <button type="button" class="secondary" onclick="startFocusSessionForBlock('${b.id}')" style="padding:4px 12px; font-weight:700; background:var(--accent); color:#05070a; border:none;">▶ Focus</button>
      </div>
    `;
  });
}
