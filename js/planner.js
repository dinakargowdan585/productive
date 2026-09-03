/* Task Planner Engine (Things 3 & Linear Inspired Cards) */

function createTask(e) {
  if (e) e.preventDefault();
  const titleInput = document.getElementById("taskTitle");
  const title = titleInput ? titleInput.value.trim() : "";
  if (!title) return;

  const calSelect = document.getElementById("taskCalendarSelect");
  const calendarId = calSelect ? calSelect.value : "work";
  const prioSelect = document.getElementById("taskPriority");
  const priority = prioSelect ? prioSelect.value : "HIGH";
  const dateInput = document.getElementById("taskDueDate");
  const dueDate = dateInput ? dateInput.value : getIsoDateStr();
  const isDailyInput = document.getElementById("taskIsDaily");
  const isDaily = isDailyInput ? isDailyInput.checked : false;

  const projSelect = document.getElementById("taskLinkProject");
  const projectId = projSelect ? projSelect.value : "";
  const goalSelect = document.getElementById("taskLinkGoal");
  const goalId = goalSelect ? goalSelect.value : "";

  const tasks = loadTasks();
  const newTask = {
    id: uuid(),
    title,
    category: calendarId,
    calendarId,
    priority,
    dueDate: isDaily ? "" : dueDate,
    isDaily,
    completed: false,
    streak: 0,
    estimateMins: 60,
    projectId,
    goalId,
    createdAt: new Date().toISOString()
  };

  tasks.unshift(newTask);
  saveTasks(tasks);

  if (titleInput) titleInput.value = "";
  renderPlanner();
  if (typeof renderDashboard === "function") renderDashboard();
  if (typeof showToast === "function") showToast("Task created successfully", "success");
}

function handleNaturalLanguageAdd(e) {
  if (e) e.preventDefault();
  const input = document.getElementById("quickTaskInput");
  if (!input || !input.value.trim()) return;

  const text = input.value.trim();
  const isHigh = text.toLowerCase().includes("!high");
  const isMed = text.toLowerCase().includes("!med");
  const prio = isHigh ? "HIGH" : (isMed ? "MED" : "LOW");
  const cleanTitle = text.replace(/!high|!med|!low/gi, "").trim();

  const tasks = loadTasks();
  tasks.unshift({
    id: uuid(),
    title: cleanTitle,
    category: "work",
    calendarId: "work",
    priority: prio,
    dueDate: getIsoDateStr(),
    isDaily: false,
    completed: false,
    createdAt: new Date().toISOString()
  });

  saveTasks(tasks);
  input.value = "";
  renderPlanner();
  if (typeof triggerBackgroundSync === "function") triggerBackgroundSync();
  if (typeof showToast === "function") showToast(`Added task: "${cleanTitle}"`, "success");
}

function addCustomDailyHabit() {
  const titleInput = document.getElementById("taskTitle");
  const title = titleInput ? titleInput.value.trim() : "";

  if (!title) {
    if (typeof showToast === "function") showToast("Please type a habit title first (e.g., Morning Workout, Read 15m)", "error");
    if (titleInput) titleInput.focus();
    return;
  }

  const calSelect = document.getElementById("taskCalendarSelect");
  const calendarId = calSelect ? calSelect.value : "personal";
  const prioSelect = document.getElementById("taskPriority");
  const priority = (prioSelect ? prioSelect.value : "MED").toUpperCase();
  const projSelect = document.getElementById("taskLinkProject");
  const projectId = projSelect ? projSelect.value : "";
  const goalSelect = document.getElementById("taskLinkGoal");
  const goalId = goalSelect ? goalSelect.value : "";

  const tasks = loadTasks();
  const newHabit = {
    id: uuid(),
    title: title,
    category: calendarId,
    calendarId: calendarId,
    priority: priority,
    dueDate: "",
    isDaily: true,
    completed: false,
    streak: 0,
    estimateMins: 30,
    projectId: projectId,
    goalId: goalId,
    createdAt: new Date().toISOString()
  };

  tasks.unshift(newHabit);
  saveTasks(tasks);

  if (titleInput) titleInput.value = "";
  renderPlanner();
  if (typeof renderDashboard === "function") renderDashboard();
  if (typeof triggerBackgroundSync === "function") triggerBackgroundSync();
  if (typeof showToast === "function") showToast(`Added daily habit: "${title}"! 🔁`, "success");
}

function addDefaultDailyTasks() {
  addCustomDailyHabit();
}

function getYesterdayIsoDateStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return getIsoDateStr(d);
}

function toggleTask(id) {
  const tasks = loadTasks();
  const t = tasks.find(x => x.id === id);
  if (t) {
    t.completed = !t.completed;
    t.updatedAt = new Date().toISOString();
    const todayIso = getIsoDateStr();
    const yesterdayIso = getYesterdayIsoDateStr();

    if (t.isDaily) {
      if (t.completed) {
        if (t.lastCompletedDate === yesterdayIso) {
          t.streak = (parseInt(t.streak, 10) || 0) + 1;
        } else if (t.lastCompletedDate === todayIso) {
          t.streak = Math.max(1, parseInt(t.streak, 10) || 1);
        } else {
          t.streak = (parseInt(t.streak, 10) > 0 && t.lastCompletedDate === todayIso) ? t.streak : 1;
        }
        t.lastCompletedDate = todayIso;
      } else {
        if (t.lastCompletedDate === todayIso) {
          t.streak = Math.max(0, (parseInt(t.streak, 10) || 1) - 1);
          t.lastCompletedDate = null;
        }
      }
    }

    saveTasks(tasks);

    if (t.completed) {
      if (typeof FX !== "undefined") {
        FX.playChime();
        FX.haptic("success");
      }
    }

    renderPlanner();
    if (typeof renderDashboard === "function") renderDashboard();
    if (typeof triggerBackgroundSync === "function") triggerBackgroundSync();
    if (typeof showToast === "function") showToast(t.completed ? "Task completed! 🎉" : "Task marked incomplete", "info");

    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(task => task.completed).length;
    if (t.completed && totalTasks > 0 && completedTasks === totalTasks) {
      if (typeof FX !== "undefined") FX.burstConfetti();
    }
  }
}

function cycleTaskPriority(id) {
  const tasks = loadTasks();
  const t = tasks.find(x => x.id === id);
  if (t) {
    const priorities = ["HIGH", "MED", "LOW"];
    const curIdx = priorities.indexOf(t.priority || "HIGH");
    t.priority = priorities[(curIdx + 1) % priorities.length];
    saveTasks(tasks);
    renderPlanner();
    if (typeof FX !== "undefined") FX.playClick();
  }
}

async function deleteTask(id) {
  let tasks = loadTasks();
  tasks = tasks.filter(t => t.id !== id);
  saveTasks(tasks);

  if (typeof FX !== "undefined") {
    FX.playDelete();
    FX.haptic("delete");
  }

  if (typeof TasksRepository !== "undefined") {
    await TasksRepository.delete(id).catch(() => {});
  }
  if (typeof recordLocalDeletion === "function") {
    recordLocalDeletion("tasks", id);
  }

  const client = typeof getSupabase === "function" ? getSupabase() : null;
  const user = typeof getSupabaseUser === "function" ? await getSupabaseUser() : null;
  if (client && user && user.id) {
    try {
      await client.from("tasks").delete().eq("id", id).eq("user_id", user.id);
    } catch (e) {}
  }

  renderPlanner();
  if (typeof renderDashboard === "function") renderDashboard();
  if (typeof showToast === "function") showToast("Task deleted 🗑️", "info");
}

function promptCreateTimeBlock(taskId) {
  const dateStr = prompt("Enter scheduled date (YYYY-MM-DD):", getIsoDateStr());
  if (!dateStr) return;
  const startTime = prompt("Enter start time (HH:MM e.g. 09:00, 14:30):", "09:00");
  if (!startTime) return;
  const durationStr = prompt("Enter duration in minutes (e.g. 30, 60, 90, 120):", "60");
  if (!durationStr) return;
  const durationMins = parseInt(durationStr) || 60;
  createTimeBlock(taskId, dateStr, startTime, durationMins);
}

function createTimeBlock(taskId, dateStr, startTime, durationMins) {
  const tasks = loadTasks();
  const task = tasks.find(t => t.id === taskId) || { title: "Focus Block" };
  const blocks = loadTimeBlocks();
  
  const startMins = parseTimeToMinutes(startTime);
  const endMins = startMins + durationMins;
  const endHours = Math.floor(endMins / 60);
  const endMinutes = endMins % 60;
  const endTime = `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;

  const cal = getCalendarById(task.calendarId || task.category || "work");

  const newBlock = {
    id: uuid(),
    taskId,
    taskTitle: task.title,
    date: dateStr,
    startTime,
    endTime,
    durationMinutes: durationMins,
    color: cal.color,
    completed: false
  };

  blocks.push(newBlock);
  saveTimeBlocks(blocks);
  renderPlanner();
  if (typeof renderDashboard === "function") renderDashboard();
  if (typeof showToast === "function") showToast("Focus block scheduled!", "success");
}

const TASK_SVGS = {
  work: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>`,
  personal: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  study: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`,
  goals: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`,
  habits: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>`,
  calendar: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
  flame: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>`,
  edit: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
  trash: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
  subtasks: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`,
  focus: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  project: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`,
  goal: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`
};

function parseTimeToMinutes(timeStr) {
  if (!timeStr || !timeStr.includes(":")) return 0;
  const parts = timeStr.split(":");
  return (parseInt(parts[0]) || 0) * 60 + (parseInt(parts[1]) || 0);
}

function getTaskTimeStats(taskId) {
  const blocks = loadTimeBlocks().filter(b => b.taskId === taskId);
  const tasks = loadTasks();
  const task = tasks.find(t => t.id === taskId);
  const estimated = task ? (task.estimateMins || 60) : 60;
  const actual = blocks.filter(b => b.completed).reduce((acc, b) => acc + (b.durationMinutes || 0), 0);
  const remaining = Math.max(0, estimated - actual);
  const efficiency = estimated > 0 ? Math.round((actual / estimated) * 100) : 0;
  return { estimated, actual, remaining, efficiency, blockCount: blocks.length };
}

function getTimeBlocksByTask(taskId) {
  return loadTimeBlocks().filter(b => b.taskId === taskId);
}

function toggleTaskDetails(taskId) {
  const el = document.getElementById(`taskDetails-${taskId}`);
  const btn = document.getElementById(`taskDetailsBtn-${taskId}`);
  if (!el) return;
  const isOpen = el.classList.contains("open");
  if (isOpen) {
    el.classList.remove("open");
    if (btn) btn.innerHTML = `<span>Details</span>`;
  } else {
    el.classList.add("open");
    if (btn) btn.innerHTML = `<span>Hide</span>`;
  }
}

function toggleTaskMenu(taskId, e) {
  if (e) e.stopPropagation();
  const menu = document.getElementById(`taskMenu-${taskId}`);
  if (!menu) return;
  const isOpen = menu.style.display === "flex";
  document.querySelectorAll(".task-card-menu-dropdown").forEach(m => m.style.display = "none");
  if (!isOpen) menu.style.display = "flex";
}

function renderRelationshipChips(t) {
  let html = "";
  if (t.projectId) {
    const projects = loadProjects();
    const p = projects.find(x => x.id === t.projectId);
    if (p) html += `<span class="chip-pill project">${TASK_SVGS.project} ${escapeHTML(p.title)}</span> `;
  }
  if (t.goalId) {
    const goals = loadGoals();
    const g = goals.find(x => x.id === t.goalId);
    if (g) html += `<span class="chip-pill goal">${TASK_SVGS.goal} ${escapeHTML(g.objective)}</span> `;
  }
  return html;
}

function populateProjectAndGoalSelects() {
  const projSelect = document.getElementById("taskLinkProject");
  if (projSelect) {
    const projects = loadProjects();
    projSelect.innerHTML = `<option value="">No Project Linked</option>` + projects.map(p => `<option value="${p.id}">${escapeHTML(p.title)}</option>`).join('');
  }
  const goalSelect = document.getElementById("taskLinkGoal");
  if (goalSelect) {
    const goals = loadGoals();
    goalSelect.innerHTML = `<option value="">No Goal Linked</option>` + goals.map(g => `<option value="${g.id}">${escapeHTML(g.objective)}</option>`).join('');
  }
}

function toggleDueDateField(chk) {
  const field = document.getElementById("taskDueDate");
  const submitBtn = document.getElementById("btnSubmitTask");
  if (field) field.style.display = chk.checked ? "none" : "block";
  if (submitBtn) submitBtn.textContent = chk.checked ? "Add Daily Habit" : "Add Task";
}

/* In-Place Task Title Editing */
function startEditTaskTitle(taskId, e) {
  if (e) e.stopPropagation();
  const wrap = document.getElementById(`taskTitleWrap-${taskId}`);
  if (!wrap) return;
  const currentTitle = wrap.getAttribute("data-title") || "";
  wrap.innerHTML = `<input type="text" class="task-title-inline-input" id="inlineEdit-${taskId}" value="${escapeHTML(currentTitle)}" onkeydown="handleInlineEditKey(event, '${taskId}')" onblur="commitTaskTitleEdit('${taskId}')">`;
  const input = document.getElementById(`inlineEdit-${taskId}`);
  if (input) {
    input.focus();
    input.select();
  }
}

function handleInlineEditKey(e, taskId) {
  if (e.key === "Enter") {
    e.preventDefault();
    commitTaskTitleEdit(taskId);
  } else if (e.key === "Escape") {
    e.preventDefault();
    renderPlanner();
  }
}

function commitTaskTitleEdit(taskId) {
  const input = document.getElementById(`inlineEdit-${taskId}`);
  if (!input) return;
  const newTitle = input.value.trim();
  if (!newTitle) {
    renderPlanner();
    return;
  }
  const tasks = loadTasks();
  const t = tasks.find(x => x.id === taskId);
  if (t && t.title !== newTitle) {
    t.title = newTitle;
    t.updatedAt = new Date().toISOString();
    saveTasks(tasks);
    if (typeof triggerBackgroundSync === "function") triggerBackgroundSync();
    if (typeof renderDashboard === "function") renderDashboard();
    if (typeof showToast === "function") showToast("Task title updated!", "success");
  }
  renderPlanner();
}

/* Subtasks & Micro-Checklist Management */
function addSubtask(taskId, title) {
  const cleanTitle = (title || "").trim();
  if (!cleanTitle) return;
  const tasks = loadTasks();
  const t = tasks.find(x => x.id === taskId);
  if (!t) return;
  if (!Array.isArray(t.subtasks)) t.subtasks = [];
  t.subtasks.push({
    id: uuid(),
    title: cleanTitle,
    completed: false
  });
  t.updatedAt = new Date().toISOString();
  saveTasks(tasks);
  if (typeof FX !== "undefined") FX.playClick();
  renderPlanner();
  if (typeof triggerBackgroundSync === "function") triggerBackgroundSync();
}

function toggleSubtask(taskId, subtaskId) {
  const tasks = loadTasks();
  const t = tasks.find(x => x.id === taskId);
  if (!t || !Array.isArray(t.subtasks)) return;
  const st = t.subtasks.find(s => s.id === subtaskId);
  if (st) {
    st.completed = !st.completed;
    t.updatedAt = new Date().toISOString();
    saveTasks(tasks);
    if (typeof FX !== "undefined") {
      if (st.completed) {
        FX.playChime();
        FX.haptic("light");
      } else {
        FX.playClick();
      }
    }
    renderPlanner();
    if (typeof triggerBackgroundSync === "function") triggerBackgroundSync();
  }
}

function deleteSubtask(taskId, subtaskId) {
  const tasks = loadTasks();
  const t = tasks.find(x => x.id === taskId);
  if (!t || !Array.isArray(t.subtasks)) return;
  t.subtasks = t.subtasks.filter(s => s.id !== subtaskId);
  t.updatedAt = new Date().toISOString();
  saveTasks(tasks);
  renderPlanner();
  if (typeof triggerBackgroundSync === "function") triggerBackgroundSync();
}

function handleAddSubtaskInput(e, taskId, input) {
  if (e.key === "Enter") {
    e.preventDefault();
    addSubtask(taskId, input.value);
    input.value = "";
  }
}

function renderPlanner() {
  populateProjectAndGoalSelects();

  const tasks = loadTasks();
  const filterEl = document.getElementById("filterTaskStatus");
  const filter = filterEl ? filterEl.value : "ALL";
  const total = tasks.length;
  const completed = tasks.filter(t => t.completed).length;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  const ringPercentEl = document.getElementById("ringPercentText");
  const ringSvgEl = document.getElementById("ringSvgPath");
  if (ringPercentEl) ringPercentEl.textContent = `${percent}%`;
  if (ringSvgEl) {
    ringSvgEl.setAttribute("stroke-dasharray", `${percent}, 100`);
    ringSvgEl.style.stroke = percent >= 80 ? "var(--green)" : (percent >= 40 ? "var(--accent)" : "var(--amber)");
  }

  const legacyPercentEl = document.getElementById("taskProgressPercent");
  if (legacyPercentEl) legacyPercentEl.textContent = `${percent}%`;

  let filtered = tasks;
  if (filter === "DAILY") filtered = tasks.filter(t => t.isDaily);
  else if (filter === "PENDING") filtered = tasks.filter(t => !t.completed);
  else if (filter === "COMPLETED") filtered = tasks.filter(t => t.completed);

  const container = document.getElementById("tasksList");
  if (!container) return;
  container.innerHTML = "";

  if (!filtered.length) {
    container.innerHTML = `<div class="empty-state"><h3>No tasks found</h3><p>Add your first task in the planner form.</p></div>`;
    return;
  }

  filtered.forEach(t => {
    const cal = getCalendarById(t.calendarId || t.category || "work");
    const item = document.createElement("div");
    const todayIso = getIsoDateStr();
    const isOverdue = Boolean(t.dueDate && t.dueDate < todayIso && !t.completed);

    item.className = `task-card-redesign ${t.completed ? 'completed' : ''}`;
    item.style.borderLeftColor = cal.color;
    if (isOverdue) item.style.borderColor = "rgba(255, 59, 48, 0.4)";

    let dateLabel = 'No due date';
    if (t.isDaily) {
      dateLabel = 'Daily Reset';
    } else if (t.dueDate) {
      if (isOverdue) {
        dateLabel = `<span style="color:var(--danger); font-weight:700;">Overdue (${t.dueDate})</span>`;
      } else {
        dateLabel = `${t.dueDate}`;
      }
    }

    const priorityDot = `<span class="priority-beacon"></span> ${(t.priority || 'HIGH').toUpperCase()}`;
    const relationshipChipsHTML = renderRelationshipChips(t);
    const timeStats = getTaskTimeStats(t.id);
    const blocks = getTimeBlocksByTask(t.id);
    const nextBlock = blocks.find(b => !b.completed) || blocks[0];

    const subtasksList = Array.isArray(t.subtasks) ? t.subtasks : [];
    const subtasksDone = subtasksList.filter(s => s.completed).length;
    const subtasksTotal = subtasksList.length;

    let progressPct = 0;
    if (subtasksTotal > 0) {
      progressPct = Math.round((subtasksDone / subtasksTotal) * 100);
    } else if (timeStats.estimated > 0) {
      progressPct = Math.min(100, Math.round((timeStats.actual / timeStats.estimated) * 100));
    } else {
      progressPct = t.completed ? 100 : 0;
    }

    const catSvg = TASK_SVGS[cal.id] || TASK_SVGS.work;

    let subtasksHTML = `
      <div class="subtasks-container">
        <div class="subtasks-header">
          <span>${TASK_SVGS.subtasks} Sub-steps ${subtasksTotal > 0 ? `(${subtasksDone}/${subtasksTotal})` : ''}</span>
          <span style="color:var(--accent); font-weight:800;">${progressPct}%</span>
        </div>
        ${subtasksList.map(st => `
          <div class="subtask-item ${st.completed ? 'completed' : ''}">
            <input type="checkbox" ${st.completed ? 'checked' : ''} onchange="toggleSubtask('${t.id}', '${st.id}')">
            <span>${escapeHTML(st.title)}</span>
            <button type="button" class="subtask-delete-btn" onclick="deleteSubtask('${t.id}', '${st.id}')" title="Delete subtask">&times;</button>
          </div>
        `).join('')}
        <input type="text" class="subtask-quick-input" placeholder="+ Add a step (Press Enter)" onkeydown="handleAddSubtaskInput(event, '${t.id}', this)">
      </div>
    `;

    item.innerHTML = `
      <div class="task-card-primary-row">
        <div class="task-checkbox-wrap">
          <input type="checkbox" ${t.completed ? 'checked' : ''} onchange="toggleTask('${t.id}')">
        </div>
        <div class="task-card-content">
          <div id="taskTitleWrap-${t.id}" data-title="${escapeHTML(t.title)}" ondblclick="startEditTaskTitle('${t.id}', event)">
            <div class="task-title-text" style="${t.completed ? 'text-decoration:line-through; opacity:0.6;' : ''}">
              ${escapeHTML(t.title)}
            </div>
          </div>
          <div class="task-card-meta">
            <span class="badge" style="background:${cal.color}15; color:${cal.color}; border:1px solid ${cal.color}35; display:inline-flex; align-items:center; gap:4px;">
              ${catSvg} ${escapeHTML(cal.name)}
            </span>
            <span style="display:inline-flex; align-items:center; gap:4px;">${TASK_SVGS.calendar} ${dateLabel}</span>
            ${t.isDaily ? `<span class="badge" style="background:rgba(255, 149, 0, 0.15); color:var(--amber); display:inline-flex; align-items:center; gap:4px;">${TASK_SVGS.flame} ${t.streak || 0}d</span>` : ''}
          </div>
        </div>
        <div class="task-card-actions">
          <span class="priority-pill priority-${(t.priority || 'HIGH').toLowerCase()}" onclick="cycleTaskPriority('${t.id}')" style="cursor:pointer;" title="Click to change priority">
            ${priorityDot}
          </span>
          <button type="button" class="secondary" onclick="startEditTaskTitle('${t.id}', event)" style="padding:4px 8px; font-size:0.75rem; display:inline-flex; align-items:center; gap:4px;" title="Edit Title">
            ${TASK_SVGS.edit}
          </button>
          <button type="button" class="secondary" id="taskDetailsBtn-${t.id}" onclick="toggleTaskDetails('${t.id}')" style="padding:4px 8px; font-size:0.75rem;">Details</button>
          <button type="button" class="task-delete-front-btn" onclick="deleteTask('${t.id}')" title="Delete Task" style="display:inline-flex; align-items:center; gap:4px;">
            ${TASK_SVGS.trash} Delete
          </button>
        </div>
      </div>

      <div style="margin-top:2px;">
        <div class="bar-track"><div class="bar-fill" style="width:${progressPct}%; background:${cal.color};"></div></div>
      </div>

      ${subtasksHTML}

      ${nextBlock ? `
        <div style="display:flex; align-items:center; justify-content:space-between; background:rgba(56, 189, 248, 0.06); border:1px solid rgba(56, 189, 248, 0.2); border-radius:var(--radius-sm); padding:8px 12px; font-size:0.78rem; margin-top:4px;">
          <span style="color:var(--accent); font-weight:600; display:inline-flex; align-items:center; gap:6px;">${TASK_SVGS.focus} Next: ${nextBlock.date} ${formatTime12Hour(nextBlock.startTime)}–${formatTime12Hour(nextBlock.endTime)}</span>
          <button type="button" class="secondary" onclick="startFocusSessionForBlock('${nextBlock.id}')" style="padding:3px 10px; font-size:0.72rem; background:var(--accent); color:#05070a; font-weight:700; border:none; display:inline-flex; align-items:center; gap:4px;">Focus</button>
        </div>
      ` : `
        <div style="display:flex; align-items:center; justify-content:space-between; margin-top:4px;">
          <button type="button" class="secondary" onclick="promptCreateTimeBlock('${t.id}')" style="padding:4px 12px; font-size:0.78rem; background:rgba(255,255,255,0.04); font-weight:600; display:inline-flex; align-items:center; gap:4px;">+ Focus Block</button>
        </div>
      `}

      <div id="taskDetails-${t.id}" class="task-details-collapsible">
        <div style="font-size:0.78rem; color:var(--muted); margin-bottom:6px;">
          <strong>Time Stats:</strong> ${timeStats.blockCount} Session(s) Scheduled • ${timeStats.efficiency}% Efficiency Rating
        </div>
        ${relationshipChipsHTML}
      </div>
    `;
    bindTaskSwipe(item, t.id);
    container.appendChild(item);
  });
}

function bindTaskSwipe(item, taskId) {
  let startX = 0;
  let startY = 0;
  let currentX = 0;
  let isSwiping = false;

  item.addEventListener("touchstart", (e) => {
    if (e.touches.length !== 1) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    isSwiping = false;
    item.style.transition = "none";
  }, { passive: true });

  item.addEventListener("touchmove", (e) => {
    if (e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;

    if (!isSwiping && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
      isSwiping = true;
    }

    if (isSwiping) {
      currentX = dx;
      const limitedX = Math.max(-100, Math.min(100, dx));
      item.style.transform = `translateX(${limitedX}px)`;
      if (limitedX > 25) {
        item.style.boxShadow = `inset 4px 0 0 var(--green), 0 4px 16px rgba(52, 199, 89, 0.25)`;
      } else if (limitedX < -25) {
        item.style.boxShadow = `inset -4px 0 0 var(--danger), 0 4px 16px rgba(255, 59, 48, 0.25)`;
      } else {
        item.style.boxShadow = "";
      }
    }
  }, { passive: true });

  item.addEventListener("touchend", () => {
    item.style.transition = "transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.3s";
    item.style.transform = "translateX(0px)";
    item.style.boxShadow = "";

    if (isSwiping) {
      if (currentX > 65) {
        toggleTask(taskId);
      } else if (currentX < -65) {
        deleteTask(taskId);
      }
    }
    isSwiping = false;
    currentX = 0;
  });
}
