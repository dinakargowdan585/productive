/* Desktop Calendar & Week View Timeline Engine (VisionOS / Cron Redesign) */

let calYear = new Date().getFullYear();
let calMonth = new Date().getMonth();
let selectedCalDateStr = getIsoDateStr();
let currentCalViewMode = "month";
let calActiveFilter = "ALL";
let calNowInterval = null;

function getTaskDate(t) {
  const d = t.dueDate || t.due_date || "";
  if (!d) return "";
  return d.includes("T") ? d.split("T")[0] : d.trim();
}

function isTaskForDate(t, dateStr) {
  const todayIso = getIsoDateStr();
  const taskDate = getTaskDate(t);

  // 1. Daily habits repeat every day
  if (t.isDaily || t.is_daily) return true;

  // 2. Direct date match
  if (taskDate && taskDate === dateStr) return true;

  // 3. If task has no due date and is not completed, show on today's calendar
  if (!taskDate && dateStr === todayIso) return true;

  return false;
}

function isBlockForDate(b, dateStr) {
  const bDate = b.date ? (b.date.includes("T") ? b.date.split("T")[0] : b.date.trim()) : "";
  return bDate === dateStr;
}

function changeCalMonth(delta) {
  calMonth += delta;
  if (calMonth < 0) { calMonth = 11; calYear--; }
  else if (calMonth > 11) { calMonth = 0; calYear++; }
  renderCalendar();
}

function prevMonth() { 
  if (currentCalViewMode === "week") {
    changeCalWeek(-1);
  } else {
    changeCalMonth(-1); 
  }
}

function nextMonth() { 
  if (currentCalViewMode === "week") {
    changeCalWeek(1);
  } else {
    changeCalMonth(1); 
  }
}

function changeCalWeek(deltaWeeks) {
  const d = new Date((selectedCalDateStr || getIsoDateStr()) + "T00:00:00");
  d.setDate(d.getDate() + (deltaWeeks * 7));
  selectedCalDateStr = getIsoDateStr(d);
  calYear = d.getFullYear();
  calMonth = d.getMonth();
  renderCalendar();
}

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
  const filterSelect = document.getElementById("calCategoryFilter");
  if (filterSelect) filterSelect.value = catId;
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
  const title = document.getElementById("eventModalTitleInput")?.value.trim() || document.getElementById("eventModalTitle")?.value.trim();
  const date = document.getElementById("eventModalDate")?.value || getIsoDateStr();
  const cat = document.getElementById("eventModalCategory")?.value || "work";
  const prio = document.getElementById("eventModalPriority")?.value || "Medium";
  if (!title) return;

  const tasks = loadTasks();
  const cal = getCalendarById(cat);
  tasks.unshift({
    id: uuid(),
    title,
    dueDate: date,
    priority: prio,
    category: cal.id,
    calendarId: cal.id,
    calendarName: cal.name,
    calendarColor: cal.color,
    completed: false,
    createdAt: new Date().toISOString()
  });

  saveTasks(tasks);
  closeEventModal();
  renderCalendar();
  if (typeof triggerBackgroundSync === "function") triggerBackgroundSync();
  if (typeof showToast === "function") showToast("Event saved to calendar!", "success");
}

function deleteEventFromModal() {
  closeEventModal();
  if (typeof showToast === "function") showToast("Event canceled.", "info");
}

function handleQuickDayTaskAdd(e, dateStr) {
  if (e.key === "Enter") {
    e.preventDefault();
    const title = e.target.value.trim();
    if (!title) return;
    const tasks = loadTasks();
    const targetDate = dateStr || selectedCalDateStr || getIsoDateStr();
    tasks.unshift({
      id: uuid(),
      title,
      dueDate: targetDate,
      priority: "MED",
      category: "work",
      calendarId: "work",
      completed: false,
      createdAt: new Date().toISOString()
    });
    saveTasks(tasks);
    renderCalendar();
    if (typeof triggerBackgroundSync === "function") triggerBackgroundSync();
    if (typeof showToast === "function") showToast(`Added task for ${targetDate}!`, "success");
    setTimeout(() => {
      const input = document.getElementById("calQuickAddInput");
      if (input) input.focus();
    }, 50);
  }
}

function renderSidebarUpcoming(tasks, allBlocks) {
  const container = document.getElementById("sidebarUpcomingEvents");
  if (!container) return;
  const todayIso = getIsoDateStr();
  const todayTasks = tasks.filter(t => isTaskForDate(t, todayIso));
  const todayBlocks = allBlocks.filter(b => isBlockForDate(b, todayIso));

  if (!todayTasks.length && !todayBlocks.length) {
    container.innerHTML = `<div style="font-size:0.75rem; color:var(--muted); font-style:italic;">No events for today.</div>`;
    return;
  }

  container.innerHTML = `
    ${todayBlocks.slice(0, 3).map(b => `
      <div style="background:rgba(255,255,255,0.03); border:1px solid var(--border); border-left:3px solid ${b.color || 'var(--accent)'}; padding:6px 8px; border-radius:4px; font-size:0.75rem;">
        <div style="font-weight:700; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">⏱️ ${escapeHTML(b.taskTitle)}</div>
        <div style="font-size:0.68rem; color:var(--muted);">${formatTime12Hour(b.startTime)}</div>
      </div>
    `).join('')}
    ${todayTasks.slice(0, 4).map(t => {
      const cal = getCalendarById(t.calendarId || t.category || "work");
      return `
        <div style="background:rgba(255,255,255,0.03); border:1px solid var(--border); border-left:3px solid ${cal.color}; padding:6px 8px; border-radius:4px; font-size:0.75rem; display:flex; align-items:center; gap:6px;">
          <input type="checkbox" ${t.completed ? 'checked' : ''} onchange="toggleTask('${t.id}')" style="width:14px !important; height:14px !important; min-width:14px; min-height:14px;">
          <span style="color:var(--text); ${t.completed ? 'text-decoration:line-through; opacity:0.6;' : ''}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHTML(t.title)}</span>
        </div>
      `;
    }).join('')}
  `;
}

function renderCalendar() {
  const monthTitle = document.getElementById("calMonthTitle") || document.getElementById("calendarMonthTitle");
  if (monthTitle) {
    const d = new Date(calYear, calMonth, 1);
    monthTitle.textContent = d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }

  const miniTitle = document.getElementById("miniCalTitle");
  if (miniTitle) {
    const d = new Date(calYear, calMonth, 1);
    miniTitle.textContent = d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' }).toUpperCase();
  }

  renderMiniCalendar();
  renderCalendarCategoryLegend();

  const grid = document.getElementById("calGrid") || document.getElementById("calendarGrid");
  const canvasHeader = document.getElementById("calCanvasHeader");
  if (!grid) return;

  const tasks = loadTasks();
  const allBlocks = loadTimeBlocks();
  const searchInput = document.getElementById("calSearchInput")?.value.trim().toLowerCase() || "";
  const selectFilter = document.getElementById("calCategoryFilter")?.value || "ALL";
  const activeFilter = (selectFilter !== "ALL" ? selectFilter : calActiveFilter).toLowerCase();

  let filteredTasks = tasks;
  if (activeFilter !== "all") {
    filteredTasks = filteredTasks.filter(t => (t.calendarId || t.category || "work").toLowerCase() === activeFilter);
  }
  if (searchInput) {
    filteredTasks = filteredTasks.filter(t => (t.title || "").toLowerCase().includes(searchInput) || (t.category || "").toLowerCase().includes(searchInput));
  }

  renderSidebarUpcoming(tasks, allBlocks);

  if (currentCalViewMode === "month") {
    renderMonthView(grid, canvasHeader, filteredTasks);
  } else if (currentCalViewMode === "week") {
    renderWeekView(grid, canvasHeader, new Date((selectedCalDateStr || getIsoDateStr()) + "T00:00:00"), filteredTasks);
  } else if (currentCalViewMode === "day") {
    renderDayView(grid, canvasHeader, new Date((selectedCalDateStr || getIsoDateStr()) + "T00:00:00"), filteredTasks);
  } else if (currentCalViewMode === "agenda") {
    renderAgendaView(grid, canvasHeader, filteredTasks);
  }

  bindCalendarSwipe(grid);
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
  setTimeout(() => {
    const input = document.getElementById("calQuickAddInput");
    if (input) {
      input.focus();
      input.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, 60);
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
  if (canvasHeader) {
    canvasHeader.style.display = "grid";
    canvasHeader.innerHTML = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(h => `
      <div style="font-weight:700; font-size:0.75rem; color:var(--muted); text-align:center; font-family:var(--font-code); padding-bottom:4px;">${h}</div>
    `).join('');
  }

  grid.style.display = "grid";
  grid.style.gridTemplateColumns = "repeat(7, 1fr)";
  grid.style.gap = "6px";
  grid.innerHTML = "";

  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const startingOffset = (firstDay + 6) % 7;
  const todayIso = getIsoDateStr();
  const selectedDate = selectedCalDateStr || todayIso;

  const [selY, selM, selD] = selectedDate.split("-").map(Number);
  const isSelectedInMonth = (selY === calYear && selM === (calMonth + 1));
  const selectedDayNum = isSelectedInMonth ? selD : null;
  const selectedCol = selectedDayNum ? ((startingOffset + selectedDayNum - 1) % 7) : 0;
  const selectedRow = selectedDayNum ? Math.floor((startingOffset + selectedDayNum - 1) / 7) : null;

  let inspectorRendered = false;

  for (let i = 0; i < startingOffset; i++) {
    grid.innerHTML += `<div class="cal-day-cell" style="opacity:0.3; background:transparent;"></div>`;
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const curDateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const isToday = curDateStr === todayIso;
    const isSelected = curDateStr === selectedCalDateStr;
    const dayTasks = tasks.filter(t => isTaskForDate(t, curDateStr));
    const cellIndex = startingOffset + day - 1;
    const isEndOfRow = (cellIndex % 7 === 6) || (day === daysInMonth);
    const currentRow = Math.floor(cellIndex / 7);

    grid.innerHTML += `
      <div class="cal-day-cell ${isToday ? 'is-today' : ''} ${isSelected ? 'selected' : ''}" onclick="selectCalDate('${curDateStr}')">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span class="cal-day-number">${day}</span>
          ${dayTasks.length > 0 ? `<span style="font-size:0.7rem; color:var(--accent); font-weight:700;">${dayTasks.length} task${dayTasks.length === 1 ? '' : 's'}</span>` : ''}
        </div>
        <div style="display:flex; flex-direction:column; gap:4px; margin-top:4px;">
          ${dayTasks.slice(0, 3).map(t => {
            const cal = getCalendarById(t.calendarId || t.category || "work");
            const isDone = isTaskCompletedOnDate(t, curDateStr);
            return `
              <div class="cal-event-card" style="background:${cal.color}20; border-left-color:${cal.color}; color:var(--text);">
                <span style="${isDone ? 'text-decoration:line-through; opacity:0.6;' : ''}">${escapeHTML(t.title)}</span>
              </div>
            `;
          }).join('')}
          ${dayTasks.length > 3 ? `<span class="cal-more-btn">+${dayTasks.length - 3} more</span>` : ''}
        </div>
      </div>
    `;

    if (isSelectedInMonth && currentRow === selectedRow && isEndOfRow && !inspectorRendered) {
      renderDayInspector(grid, selectedDate, tasks, selectedCol);
      inspectorRendered = true;
    }
  }

  if (!inspectorRendered) {
    renderDayInspector(grid, selectedDate, tasks, 0);
  }
}

function renderDayInspector(container, dateStr, tasks, colIndex = 0) {
  const dayTasks = tasks.filter(t => isTaskForDate(t, dateStr));
  const allBlocks = loadTimeBlocks();
  const dayBlocks = allBlocks.filter(b => isBlockForDate(b, dateStr));
  const dateObj = new Date(dateStr + "T00:00:00");
  const formattedDate = dateObj.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });

  const inspector = document.createElement("div");
  inspector.className = "cal-day-inspector";
  inspector.style.gridColumn = "1 / -1";

  const caretPercent = (typeof colIndex === "number") ? ((colIndex * (100 / 7)) + (100 / 14)) : 50;

  let itemsHTML = "";
  if (!dayTasks.length && !dayBlocks.length) {
    itemsHTML = `<div style="font-size:0.85rem; color:var(--muted); font-style:italic;">No tasks or focus blocks scheduled for this day.</div>`;
  } else {
    itemsHTML = `
      <div style="display:flex; flex-direction:column; gap:8px;">
        ${dayBlocks.map(b => `
          <div class="cal-inspector-item" style="border-left:3px solid ${b.color || 'var(--accent)'};">
            <div>
              <strong style="font-size:0.9rem; color:var(--text);">⏱️ ${escapeHTML(b.taskTitle)}</strong>
              <div style="font-size:0.75rem; color:var(--muted);">${formatTime12Hour(b.startTime)} – ${formatTime12Hour(b.endTime)} (${b.durationMinutes}m)</div>
            </div>
            <button type="button" class="secondary" onclick="startFocusSessionForBlock('${b.id}')" style="padding:4px 10px; font-size:0.75rem; background:var(--accent); color:#05070a; font-weight:700; border:none;">Focus</button>
          </div>
        `).join('')}
        ${dayTasks.map(t => {
          const cal = getCalendarById(t.calendarId || t.category || "work");
          const isDone = isTaskCompletedOnDate(t, dateStr);
          return `
            <div class="cal-inspector-item" style="border-left:3px solid ${cal.color};">
              <div style="display:flex; align-items:center; gap:8px;">
                <input type="checkbox" ${isDone ? 'checked' : ''} onchange="toggleTask('${t.id}', '${dateStr}')">
                <span style="font-size:0.9rem; color:var(--text); ${isDone ? 'text-decoration:line-through; opacity:0.6;' : ''}">${escapeHTML(t.title)}</span>
                ${t.isDaily ? `<span class="badge" style="background:rgba(255,149,0,0.15); color:var(--amber); font-size:0.68rem;">Daily</span>` : ''}
              </div>
              <button type="button" class="subtask-delete-btn" onclick="deleteTask('${t.id}')" title="Delete Task">&times;</button>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  inspector.innerHTML = `
    <div class="cal-inspector-pointer" style="left:${caretPercent}%;"></div>
    <div class="cal-inspector-header">
      <h3 class="cal-inspector-title">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        ${formattedDate}
      </h3>
      <div style="display:flex; gap:8px;">
        <button type="button" class="secondary" onclick="promptCreateTimeBlock('')" style="padding:4px 10px; font-size:0.75rem; display:inline-flex; align-items:center; gap:4px;">+ Focus Block</button>
        <button type="button" class="secondary" onclick="openNewEventModal('${dateStr}')" style="padding:4px 10px; font-size:0.75rem; display:inline-flex; align-items:center; gap:4px;">+ Full Event</button>
      </div>
    </div>
    ${itemsHTML}
    <input type="text" id="calQuickAddInput" class="cal-inspector-quick-input" placeholder="+ Add a task for ${dateStr} (Press Enter)..." onkeydown="handleQuickDayTaskAdd(event, '${dateStr}')">
  `;

  container.appendChild(inspector);
}

function getWeekDates(year, month, dateStr) {
  const refDate = dateStr ? new Date(dateStr + "T00:00:00") : new Date(year, month, 1);
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
  if (canvasHeader) canvasHeader.style.display = "none";
  grid.style.display = "grid";
  grid.style.gridTemplateColumns = "65px repeat(7, 1fr)";
  grid.style.gap = "6px";
  grid.innerHTML = "";

  const weekDates = getWeekDates(calYear, calMonth, selectedCalDateStr);
  const allTimeBlocks = loadTimeBlocks();
  const todayIso = getIsoDateStr();

  const now = new Date();
  const curHr = now.getHours();
  const curMin = now.getMinutes();
  const nowTimeString = `${curHr % 12 || 12}:${String(curMin).padStart(2, '0')} ${curHr >= 12 ? 'PM' : 'AM'}`;

  grid.innerHTML += `<div style="font-weight:700; font-size:0.75rem; color:var(--muted); padding:8px 0; text-align:center; font-family:var(--font-code);">Time</div>`;
  const daysHeader = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  weekDates.forEach((d, idx) => {
    const dateStr = getIsoDateStr(d);
    const dayNum = d.getDate();
    const isToday = dateStr === todayIso;
    const isSelected = dateStr === selectedCalDateStr;
    grid.innerHTML += `
      <div onclick="selectCalDate('${dateStr}')" style="text-align:center; font-weight:700; font-size:0.78rem; color:${isToday ? 'var(--accent)' : 'var(--text)'}; padding:6px 0; font-family:var(--font-code); border-bottom:1px solid var(--border); cursor:pointer; ${isSelected ? 'background:rgba(56,189,248,0.1); border-radius:4px;' : ''}">
        ${daysHeader[idx]} <span style="font-size:0.7rem; opacity:0.8;">${d.getMonth() + 1}/${dayNum}</span>
      </div>
    `;
  });

  const hours = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];

  hours.forEach(hr => {
    const hr12 = hr % 12 || 12;
    const ampm = hr >= 12 ? 'PM' : 'AM';
    const timeLabel = `${hr12}:00 ${ampm}`;
    const isCurrentHour = curHr === hr;

    grid.innerHTML += `<div style="font-size:0.72rem; color:var(--muted); font-family:var(--font-code); text-align:right; padding-right:8px; padding-top:6px; position:relative;">
      ${timeLabel}
      ${isCurrentHour ? `<div class="cal-now-time-badge">${nowTimeString}</div>` : ''}
    </div>`;

    weekDates.forEach(d => {
      const curDateStr = getIsoDateStr(d);
      const isTodayCol = curDateStr === todayIso;
      const hrBlocks = allTimeBlocks.filter(b => {
        if (!isBlockForDate(b, curDateStr)) return false;
        const bStartHr = Math.floor(parseTimeToMinutes(b.startTime) / 60);
        return bStartHr === hr;
      });

      grid.innerHTML += `
        <div class="cal-day-cell" style="min-height:46px; padding:4px; position:relative;" onclick="selectCalDate('${curDateStr}')">
          ${isTodayCol && isCurrentHour ? `
            <div class="cal-now-indicator-row" style="top:${Math.round((curMin / 60) * 100)}%;"></div>
          ` : ''}
          ${hrBlocks.map(b => `
            <div class="cal-event-card" style="background:${b.color || 'var(--accent)'}25; border-left-color:${b.color || 'var(--accent)'}; color:var(--text);">
              <span>${escapeHTML(b.taskTitle)}</span>
            </div>
          `).join('')}
        </div>
      `;
    });
  });

  const selWeekIdx = weekDates.findIndex(d => getIsoDateStr(d) === (selectedCalDateStr || todayIso));
  renderDayInspector(grid, selectedCalDateStr || todayIso, tasks, selWeekIdx >= 0 ? selWeekIdx : 0);
}

function renderDayView(grid, canvasHeader, dateObj, tasks) {
  if (canvasHeader) canvasHeader.style.display = "none";
  grid.style.display = "flex";
  grid.style.flexDirection = "column";
  grid.style.gap = "12px";
  grid.innerHTML = "";

  const curDateStr = getIsoDateStr(dateObj);
  const dayTasks = tasks.filter(t => isTaskForDate(t, curDateStr));
  const allBlocks = loadTimeBlocks();
  const dayBlocks = allBlocks.filter(b => isBlockForDate(b, curDateStr));

  grid.innerHTML += `
    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
      <div style="font-size:1.15rem; font-weight:800; color:var(--accent);">
        📅 ${dateObj.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
      </div>
      <div style="display:flex; gap:8px;">
        <button type="button" class="secondary" onclick="openNewEventModal('${curDateStr}')" style="padding:5px 12px; font-size:0.8rem;">+ Add Task / Event</button>
      </div>
    </div>
  `;

  if (!dayTasks.length && !dayBlocks.length) {
    grid.innerHTML += `<div class="empty-state"><h3>No tasks or focus blocks scheduled</h3><p>Enjoy your free focus time, or schedule an event above!</p></div>`;
  } else {
    dayBlocks.forEach(b => {
      grid.innerHTML += `
        <div class="panel" style="display:flex; justify-content:space-between; align-items:center; padding:14px 18px; border-left:4px solid ${b.color || 'var(--accent)'};">
          <div>
            <strong style="color:var(--text); font-size:1rem;">⏱️ ${escapeHTML(b.taskTitle)}</strong>
            <div style="font-size:0.8rem; color:var(--muted); margin-top:3px;">${formatTime12Hour(b.startTime)} – ${formatTime12Hour(b.endTime)} (${b.durationMinutes}m)</div>
          </div>
          <button type="button" class="secondary" onclick="startFocusSessionForBlock('${b.id}')" style="padding:5px 14px; font-weight:700; background:var(--accent); color:#05070a; border:none;">Focus</button>
        </div>
      `;
    });

    dayTasks.forEach(t => {
      const cal = getCalendarById(t.calendarId || t.category || "work");
      const isDone = isTaskCompletedOnDate(t, curDateStr);
      grid.innerHTML += `
        <div class="panel" style="display:flex; justify-content:space-between; align-items:center; padding:12px 18px; border-left:4px solid ${cal.color};">
          <div style="display:flex; align-items:center; gap:12px;">
            <input type="checkbox" ${isDone ? 'checked' : ''} onchange="toggleTask('${t.id}', '${curDateStr}')">
            <div>
              <span style="font-size:0.95rem; font-weight:600; color:var(--text); ${isDone ? 'text-decoration:line-through; opacity:0.6;' : ''}">${escapeHTML(t.title)}</span>
              <div style="font-size:0.75rem; color:var(--muted); margin-top:2px;">● ${escapeHTML(cal.name)} • Priority: ${t.priority || 'MED'}${t.isDaily ? ' • Daily Habit' : ''}</div>
            </div>
          </div>
          <button type="button" class="subtask-delete-btn" onclick="deleteTask('${t.id}')" title="Delete Task">&times;</button>
        </div>
      `;
    });
  }

  grid.innerHTML += `
    <input type="text" class="cal-inspector-quick-input" placeholder="+ Add a task for this day (Press Enter)..." onkeydown="handleQuickDayTaskAdd(event, '${curDateStr}')">
  `;
}

function renderAgendaView(grid, canvasHeader, tasks) {
  if (canvasHeader) canvasHeader.style.display = "none";
  grid.style.display = "flex";
  grid.style.flexDirection = "column";
  grid.style.gap = "16px";
  grid.innerHTML = "";

  const allBlocks = loadTimeBlocks();
  const todayIso = getIsoDateStr();

  // Collect unique dates from today onwards
  const dateMap = {};
  
  tasks.forEach(t => {
    const d = getTaskDate(t) || todayIso;
    if (!dateMap[d]) dateMap[d] = { tasks: [], blocks: [] };
    dateMap[d].tasks.push(t);
  });

  allBlocks.forEach(b => {
    const d = (b.date ? (b.date.includes("T") ? b.date.split("T")[0] : b.date.trim()) : todayIso);
    if (!dateMap[d]) dateMap[d] = { tasks: [], blocks: [] };
    dateMap[d].blocks.push(b);
  });

  const sortedDates = Object.keys(dateMap).sort();

  if (!sortedDates.length) {
    grid.innerHTML = `<div class="empty-state"><h3>No upcoming events in Agenda</h3><p>Schedule your upcoming goals and milestones in the planner.</p></div>`;
    return;
  }

  sortedDates.forEach(dateStr => {
    const isToday = dateStr === todayIso;
    const dateObj = new Date(dateStr + "T00:00:00");
    const formatted = dateObj.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    const { tasks: dayTasks, blocks: dayBlocks } = dateMap[dateStr];

    let groupHTML = `
      <div class="cal-agenda-group">
        <div class="cal-agenda-date-header">
          <span>📅 ${formatted}</span>
          ${isToday ? `<span class="badge" style="background:rgba(56,189,248,0.2); color:var(--accent); font-size:0.7rem;">TODAY</span>` : ''}
        </div>
        ${dayBlocks.map(b => `
          <div class="cal-agenda-card" style="border-left:4px solid ${b.color || 'var(--accent)'};">
            <div>
              <strong style="color:var(--text); font-size:0.92rem;">⏱️ ${escapeHTML(b.taskTitle)}</strong>
              <div style="font-size:0.75rem; color:var(--muted);">${formatTime12Hour(b.startTime)} – ${formatTime12Hour(b.endTime)} (${b.durationMinutes}m)</div>
            </div>
            <button type="button" class="secondary" onclick="startFocusSessionForBlock('${b.id}')" style="padding:3px 10px; font-size:0.72rem; background:var(--accent); color:#05070a; font-weight:700; border:none;">Focus</button>
          </div>
        `).join('')}
        ${dayTasks.map(t => {
          const cal = getCalendarById(t.calendarId || t.category || "work");
          const isDone = isTaskCompletedOnDate(t, dateStr);
          return `
            <div class="cal-agenda-card" style="border-left:4px solid ${cal.color};">
              <div style="display:flex; align-items:center; gap:10px;">
                <input type="checkbox" ${isDone ? 'checked' : ''} onchange="toggleTask('${t.id}', '${dateStr}')">
                <span style="font-size:0.9rem; color:var(--text); ${isDone ? 'text-decoration:line-through; opacity:0.6;' : ''}">${escapeHTML(t.title)}</span>
              </div>
              <span class="badge" style="background:${cal.color}15; color:${cal.color}; font-size:0.72rem;">${escapeHTML(cal.name)}</span>
            </div>
          `;
        }).join('')}
      </div>
    `;

    grid.innerHTML += groupHTML;
  });
}

/* Mobile Touch Gesture Support for Calendar */
function bindCalendarSwipe(container) {
  if (!container) return;
  let startX = 0;
  let startY = 0;
  let currentX = 0;
  let isSwiping = false;

  container.addEventListener("touchstart", (e) => {
    if (e.touches.length !== 1) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    isSwiping = false;
  }, { passive: true });

  container.addEventListener("touchmove", (e) => {
    if (e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;

    if (!isSwiping && Math.abs(dx) > 15 && Math.abs(dx) > Math.abs(dy)) {
      isSwiping = true;
    }
    if (isSwiping) {
      currentX = dx;
    }
  }, { passive: true });

  container.addEventListener("touchend", () => {
    if (isSwiping) {
      if (currentX < -60) {
        nextMonth();
        if (typeof FX !== "undefined") FX.playClick();
      } else if (currentX > 60) {
        prevMonth();
        if (typeof FX !== "undefined") FX.playClick();
      }
    }
    isSwiping = false;
    currentX = 0;
  });
}

// Keep live now time indicator moving in real time
if (!calNowInterval) {
  calNowInterval = setInterval(() => {
    if (currentCalViewMode === "week" || currentCalViewMode === "day") {
      renderCalendar();
    }
  }, 60000);
}

