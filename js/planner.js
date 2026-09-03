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
    if (btn) btn.textContent = "▼ Details";
  } else {
    el.classList.add("open");
    if (btn) btn.textContent = "▲ Details";
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
    if (p) html += `<span class="chip-pill project">🏢 ${escapeHTML(p.title)}</span> `;
  }
  if (t.goalId) {
    const goals = loadGoals();
    const g = goals.find(x => x.id === t.goalId);
    if (g) html += `<span class="chip-pill goal">🎯 ${escapeHTML(g.objective)}</span> `;
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
  if (submitBtn) submitBtn.textContent = chk.checked ? "🔁 Add Daily Habit" : "➕ Add Task";
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
      dateLabel = 'Resets every day';
    } else if (t.dueDate) {
      if (isOverdue) {
        dateLabel = `<span style="color:var(--danger); font-weight:700;">Overdue (Due: ${t.dueDate})</span>`;
      } else {
        dateLabel = `Due: ${t.dueDate}`;
      }
    }

    const priorityDot = t.priority === 'HIGH' ? '🔴 HIGH' : (t.priority === 'MED' ? '🟡 MED' : '🟢 LOW');
    const relationshipChipsHTML = renderRelationshipChips(t);
    const timeStats = getTaskTimeStats(t.id);
    const blocks = getTimeBlocksByTask(t.id);
    const nextBlock = blocks.find(b => !b.completed) || blocks[0];
    const progressPct = timeStats.estimated > 0 ? Math.min(100, Math.round((timeStats.actual / timeStats.estimated) * 100)) : (t.completed ? 100 : 0);

    item.innerHTML = `
      <div class="task-card-primary-row">
        <div class="task-checkbox-wrap">
          <input type="checkbox" ${t.completed ? 'checked' : ''} onchange="toggleTask('${t.id}')">
        </div>
        <div class="task-card-content">
          <div class="task-title-text" style="${t.completed ? 'text-decoration:line-through; opacity:0.6;' : ''}">
            ${escapeHTML(t.title)}
          </div>
          <div class="task-card-meta">
            <span class="badge" style="background:${cal.color}15; color:${cal.color}; border:1px solid ${cal.color}35;">● ${escapeHTML(cal.name)}</span>
            <span>📅 ${dateLabel}</span>
            ${t.isDaily ? `<span class="badge" style="background:rgba(255, 149, 0, 0.15); color:var(--amber);">🔁 ${t.streak || 0}d</span>` : ''}
          </div>
        </div>
        <div class="task-card-actions">
          <span class="priority-pill priority-${(t.priority || 'HIGH').toLowerCase()}" onclick="cycleTaskPriority('${t.id}')" style="cursor:pointer;" title="Click to change priority">
            ${priorityDot}
          </span>
          <button type="button" class="secondary" id="taskDetailsBtn-${t.id}" onclick="toggleTaskDetails('${t.id}')" style="padding:4px 10px; font-size:0.78rem;">▼ Details</button>
          <button type="button" class="task-delete-front-btn" onclick="deleteTask('${t.id}')" title="Delete Task">🗑️ Delete</button>
        </div>
      </div>

      <div style="margin-top:4px;">
        <div class="bar-track"><div class="bar-fill" style="width:${progressPct}%; background:${cal.color};"></div></div>
        <div style="display:flex; justify-content:space-between; font-size:0.75rem; color:var(--muted); margin-top:4px; font-family:var(--font-code);">
          <span>Est ${formatDurationHuman(timeStats.estimated)} • Done ${formatDurationHuman(timeStats.actual)} • Left ${formatDurationHuman(timeStats.remaining)}</span>
          <strong style="color:var(--text);">${progressPct}%</strong>
        </div>
      </div>

      ${nextBlock ? `
        <div style="display:flex; align-items:center; justify-content:space-between; background:rgba(56, 189, 248, 0.06); border:1px solid rgba(56, 189, 248, 0.2); border-radius:var(--radius-sm); padding:8px 12px; font-size:0.78rem; margin-top:4px;">
          <span style="color:var(--accent); font-weight:600;">⏱️ Next Focus: ${nextBlock.date} ${formatTime12Hour(nextBlock.startTime)}–${formatTime12Hour(nextBlock.endTime)}</span>
          <button type="button" class="secondary" onclick="startFocusSessionForBlock('${nextBlock.id}')" style="padding:3px 10px; font-size:0.72rem; background:var(--accent); color:#05070a; font-weight:700; border:none;">▶ Focus</button>
        </div>
      ` : `
        <div style="display:flex; align-items:center; justify-content:space-between; margin-top:4px;">
          <button type="button" class="secondary" onclick="promptCreateTimeBlock('${t.id}')" style="padding:4px 12px; font-size:0.78rem; background:rgba(255,255,255,0.04); font-weight:600;">+ Schedule Focus Block</button>
        </div>
      `}

      <div id="taskDetails-${t.id}" class="task-details-collapsible">
        <div style="font-size:0.78rem; color:var(--muted);">
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
