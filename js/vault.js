/* WebCrypto AES-256-GCM Encrypted Vault, Workspaces & OKRs Engine */

let isVaultUnlocked = false;
let vaultMasterKey = null;
let currentVaultSubTab = "secrets";

function switchVaultSubTab(tabName) {
  currentVaultSubTab = tabName;
  const sec = document.getElementById("vaultSubPaneSecrets") || document.getElementById("vaultTabSecrets");
  const ws = document.getElementById("vaultSubPaneWorkspaces") || document.getElementById("vaultTabWorkspaces");
  const gl = document.getElementById("vaultSubPaneGoals") || document.getElementById("vaultTabGoals");

  if (sec) sec.style.display = tabName === "secrets" ? "block" : "none";
  if (ws) ws.style.display = tabName === "workspaces" ? "block" : "none";
  if (gl) gl.style.display = tabName === "goals" ? "block" : "none";

  document.querySelectorAll(".vault-sub-tab, #vaultSubTabSecrets, #vaultSubTabWorkspaces, #vaultSubTabGoals").forEach(btn => btn.classList.remove("active"));
  const activeBtn = document.getElementById(`vaultSubTab${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`);
  if (activeBtn) activeBtn.classList.add("active");

  if (tabName === "secrets") renderVaultContent();
  if (tabName === "workspaces") renderWorkspaces();
  if (tabName === "goals") renderGoals();
}

/* ===================================================================
   Encrypted Workspaces & Projects Management
   =================================================================== */

function openNewProjectModal() {
  const dlg = document.getElementById("newProjectModal");
  if (dlg) {
    const titleInput = document.getElementById("newProjectTitleInput");
    if (titleInput) titleInput.value = "";
    const taskInput = document.getElementById("newProjectTaskInitial");
    if (taskInput) taskInput.value = "";
    dlg.showModal();
    if (titleInput) titleInput.focus();
  } else {
    createPresetProject();
  }
}

function closeNewProjectModal() {
  const dlg = document.getElementById("newProjectModal");
  if (dlg) dlg.close();
}

function handleCreateCustomProject(e) {
  if (e) e.preventDefault();
  const titleInput = document.getElementById("newProjectTitleInput");
  const catSelect = document.getElementById("newProjectCatSelect");
  const colorInput = document.getElementById("newProjectColorInput");
  const taskInput = document.getElementById("newProjectTaskInitial");

  const title = titleInput ? titleInput.value.trim() : "";
  if (!title) return;

  const cat = catSelect ? catSelect.value : "Work";
  const color = colorInput ? colorInput.value : "#38BDF8";
  const initialTask = taskInput ? taskInput.value.trim() : "";

  const taskList = [];
  if (initialTask) {
    taskList.push({ id: typeof uuid === "function" ? uuid() : "pt-" + Date.now(), title: initialTask, completed: false });
  } else {
    taskList.push({ id: typeof uuid === "function" ? uuid() : "pt-1", title: "Project Scope & Milestones", completed: false });
  }

  const projects = loadProjects();
  const newProj = {
    id: typeof uuid === "function" ? uuid() : "proj-" + Date.now(),
    title: title,
    name: title,
    cat: cat,
    category: cat,
    color: color,
    taskList: taskList,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  projects.unshift(newProj);
  saveProjects(projects);
  closeNewProjectModal();
  switchVaultSubTab("workspaces");
  renderWorkspaces();

  if (typeof populateProjectAndGoalSelects === "function") populateProjectAndGoalSelects();
  if (typeof renderDashboard === "function") renderDashboard();
  if (typeof triggerBackgroundSync === "function") triggerBackgroundSync();
  if (typeof showToast === "function") showToast(`Created Project Workspace: ${title}! 📁`, "success");
}

function createPresetProject(customTitle) {
  let title = customTitle;
  if (!title) {
    openNewProjectModal();
    return;
  }
  title = title.trim();

  const projects = loadProjects();
  const newProj = {
    id: typeof uuid === "function" ? uuid() : "proj-" + Date.now(),
    title: title,
    name: title,
    cat: "Work",
    category: "Work",
    color: "#38BDF8",
    taskList: [
      { id: typeof uuid === "function" ? uuid() : "pt-1", title: "Project Requirements & Scope", completed: true },
      { id: typeof uuid === "function" ? uuid() : "pt-2", title: "Core Implementation Phase", completed: false },
      { id: typeof uuid === "function" ? uuid() : "pt-3", title: "Security & Testing Verification", completed: false }
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  projects.unshift(newProj);
  saveProjects(projects);
  switchVaultSubTab("workspaces");
  renderWorkspaces();

  if (typeof populateProjectAndGoalSelects === "function") populateProjectAndGoalSelects();
  if (typeof renderDashboard === "function") renderDashboard();
  if (typeof triggerBackgroundSync === "function") triggerBackgroundSync();
  if (typeof showToast === "function") showToast(`Created Project Workspace: ${title}! 📁`, "success");
}

function renderWorkspaces() {
  const container = document.getElementById("workspacesGrid");
  if (!container) return;
  const projects = loadProjects();
  const allTasks = loadTasks();
  container.innerHTML = "";

  if (!projects.length) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column:1 / -1; padding:40px 20px;">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="1.5" style="margin-bottom:12px; opacity:0.8;"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
        <h3>No Project Workspaces Yet</h3>
        <p>Create your first project workspace to organize tasks, track milestones, and group secret notes.</p>
        <button type="button" onclick="openNewProjectModal()" style="margin-top:14px; display:inline-flex; align-items:center; gap:6px;">+ Create Project Workspace</button>
      </div>
    `;
    return;
  }

  projects.forEach(p => {
    const card = document.createElement("div");
    card.className = "panel";
    card.style.display = "flex";
    card.style.flexDirection = "column";
    card.style.gap = "12px";
    card.style.borderLeft = `4px solid ${p.color || 'var(--accent)'}`;

    // Get linked tasks (from project.taskList or global tasks matching projectId)
    const pTasks = Array.isArray(p.taskList) ? p.taskList : allTasks.filter(t => t.projectId === p.id);
    const totalTasks = pTasks.length;
    const completedTasks = pTasks.filter(t => t.completed).length;
    const progressPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px;">
        <div>
          <h3 style="margin:0; font-size:1.05rem; font-weight:800; color:var(--text);">${escapeHTML(p.title || p.name || 'Untitled Project')}</h3>
          <span class="badge" style="background:rgba(255,255,255,0.06); font-size:0.7rem; margin-top:4px; display:inline-block;">📁 ${escapeHTML(p.cat || p.category || 'Workspace')}</span>
        </div>
        <div style="display:flex; gap:6px;">
          <button type="button" class="secondary" onclick="openProjectTasksModal('${p.id}')" style="padding:4px 8px; font-size:0.75rem;" title="Manage Subtasks">Tasks (${completedTasks}/${totalTasks})</button>
          <button type="button" class="secondary" onclick="deleteProject('${p.id}')" style="padding:4px 8px; font-size:0.75rem; color:var(--danger);" title="Delete Project">✕</button>
        </div>
      </div>

      <div>
        <div style="display:flex; justify-content:space-between; font-size:0.78rem; color:var(--muted); font-family:var(--font-code); margin-bottom:4px;">
          <span>Progress</span>
          <span style="font-weight:700; color:var(--accent);">${progressPct}% (${completedTasks}/${totalTasks})</span>
        </div>
        <div class="bar-track"><div class="bar-fill" style="width:${progressPct}%; background:${p.color || 'var(--accent)'};"></div></div>
      </div>

      <div style="display:flex; flex-direction:column; gap:6px; max-height:160px; overflow-y:auto;">
        ${pTasks.slice(0, 4).map((t) => `
          <div style="display:flex; align-items:center; justify-content:space-between; font-size:0.82rem; padding:4px 8px; background:rgba(255,255,255,0.02); border-radius:4px;">
            <label style="display:flex; align-items:center; gap:8px; cursor:pointer; min-width:0; flex:1;">
              <input type="checkbox" ${t.completed ? 'checked' : ''} onchange="toggleProjectTask('${p.id}', '${t.id}')">
              <span style="${t.completed ? 'text-decoration:line-through; opacity:0.6;' : ''}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHTML(t.title)}</span>
            </label>
            <button type="button" onclick="deleteProjectTask('${p.id}', '${t.id}')" style="background:none; border:none; color:var(--muted); cursor:pointer; font-size:0.85rem;" title="Delete Task">&times;</button>
          </div>
        `).join('')}
      </div>

      <input type="text" placeholder="+ Add a task to this project (Press Enter)..." style="font-size:0.8rem; padding:6px 10px; background:rgba(0,0,0,0.25);" onkeydown="handleProjectQuickTask(event, '${p.id}')">
    `;

    container.appendChild(card);
  });
}

function handleProjectQuickTask(e, projectId) {
  if (e.key === "Enter") {
    e.preventDefault();
    const title = e.target.value.trim();
    if (!title) return;
    addProjectSubTask(projectId, title);
    e.target.value = "";
  }
}

function addProjectSubTask(projectId, taskTitle) {
  const projects = loadProjects();
  const p = projects.find(x => x.id === projectId);
  if (!p) return;

  if (!Array.isArray(p.taskList)) p.taskList = [];
  p.taskList.push({
    id: typeof uuid === "function" ? uuid() : "pt-" + Date.now(),
    title: taskTitle,
    completed: false
  });
  p.updatedAt = new Date().toISOString();

  saveProjects(projects);
  renderWorkspaces();
  if (typeof showToast === "function") showToast(`Added task to ${p.title}!`, "info");
}

function toggleProjectTask(projectId, taskId) {
  if (typeof FX !== "undefined") FX.playClick();
  const projects = loadProjects();
  const p = projects.find(x => x.id === projectId);
  if (!p || !Array.isArray(p.taskList)) return;

  const t = p.taskList.find(x => x.id === taskId);
  if (t) {
    t.completed = !t.completed;
    p.updatedAt = new Date().toISOString();
    saveProjects(projects);
    renderWorkspaces();
  }
}

function deleteProjectTask(projectId, taskId) {
  const projects = loadProjects();
  const p = projects.find(x => x.id === projectId);
  if (!p || !Array.isArray(p.taskList)) return;

  p.taskList = p.taskList.filter(x => x.id !== taskId);
  p.updatedAt = new Date().toISOString();
  saveProjects(projects);
  renderWorkspaces();
}

function deleteProject(id) {
  let projects = loadProjects();
  projects = projects.filter(p => p.id !== id);
  saveProjects(projects);
  renderWorkspaces();

  if (typeof populateProjectAndGoalSelects === "function") populateProjectAndGoalSelects();
  if (typeof renderDashboard === "function") renderDashboard();
  if (typeof showToast === "function") showToast("Project workspace deleted.", "info");
}

/* ===================================================================
   Encrypted OKRs & Goals Management
   =================================================================== */

function openNewOKRModal() {
  const dlg = document.getElementById("newOKRModal");
  if (dlg) {
    const objInput = document.getElementById("newOKRObjectiveInput");
    if (objInput) objInput.value = "";
    const progInput = document.getElementById("newOKRInitialProgress");
    if (progInput) progInput.value = "0";
    dlg.showModal();
    if (objInput) objInput.focus();
  } else {
    createPresetOKR();
  }
}

function closeNewOKRModal() {
  const dlg = document.getElementById("newOKRModal");
  if (dlg) dlg.close();
}

function handleCreateCustomOKR(e) {
  if (e) e.preventDefault();
  const objInput = document.getElementById("newOKRObjectiveInput");
  const qSelect = document.getElementById("newOKRQuarterSelect");
  const dateInput = document.getElementById("newOKRTargetDate");
  const progInput = document.getElementById("newOKRInitialProgress");

  const objective = objInput ? objInput.value.trim() : "";
  if (!objective) return;

  const quarter = qSelect ? qSelect.value : "Q3 2026";
  const targetDate = dateInput ? dateInput.value : "";
  const progress = progInput ? parseInt(progInput.value, 10) || 0 : 0;

  const goals = loadGoals();
  const newGoal = {
    id: typeof uuid === "function" ? uuid() : "goal-" + Date.now(),
    objective: objective,
    title: objective,
    progress: Math.min(100, Math.max(0, progress)),
    quarter: quarter,
    targetDate: targetDate,
    status: progress >= 100 ? "Achieved" : (progress >= 50 ? "On Track" : "In Progress"),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  goals.unshift(newGoal);
  saveGoals(goals);
  closeNewOKRModal();
  switchVaultSubTab("goals");
  renderGoals();

  if (typeof populateProjectAndGoalSelects === "function") populateProjectAndGoalSelects();
  if (typeof renderDashboard === "function") renderDashboard();
  if (typeof triggerBackgroundSync === "function") triggerBackgroundSync();
  if (typeof showToast === "function") showToast(`Created OKR Goal: ${objective}! 🎯`, "success");
}

function createPresetOKR(customTitle) {
  let title = customTitle;
  if (!title) {
    openNewOKRModal();
    return;
  }
  title = title.trim();

  const goals = loadGoals();
  const newGoal = {
    id: typeof uuid === "function" ? uuid() : "goal-" + Date.now(),
    objective: title,
    title: title,
    progress: 25,
    quarter: "Q3 2026",
    targetDate: "2026-09-30",
    status: "In Progress",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  goals.unshift(newGoal);
  saveGoals(goals);
  switchVaultSubTab("goals");
  renderGoals();

  if (typeof populateProjectAndGoalSelects === "function") populateProjectAndGoalSelects();
  if (typeof renderDashboard === "function") renderDashboard();
  if (typeof triggerBackgroundSync === "function") triggerBackgroundSync();
  if (typeof showToast === "function") showToast(`Created OKR Goal: ${title}! 🎯`, "success");
}

function renderGoals() {
  const container = document.getElementById("goalsGrid");
  if (!container) return;
  const goals = loadGoals();
  container.innerHTML = "";

  if (!goals.length) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column:1 / -1; padding:40px 20px;">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="1.5" style="margin-bottom:12px; opacity:0.8;"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
        <h3>No OKR Goals Yet</h3>
        <p>Set strategic quarterly objectives and track milestones in your private vault.</p>
        <button type="button" onclick="openNewOKRModal()" style="margin-top:14px; display:inline-flex; align-items:center; gap:6px;">+ Add First OKR Goal</button>
      </div>
    `;
    return;
  }

  goals.forEach(g => {
    const card = document.createElement("div");
    card.className = "panel";
    card.style.display = "flex";
    card.style.flexDirection = "column";
    card.style.gap = "14px";
    
    const progress = Math.min(100, Math.max(0, parseInt(g.progress, 10) || 0));
    card.style.borderLeft = `4px solid ${progress >= 100 ? 'var(--green)' : (progress >= 50 ? 'var(--accent)' : 'var(--amber)')}`;

    let statusBadge = `<span class="badge" style="background:rgba(255,149,0,0.15); color:var(--amber); font-weight:700;">In Progress</span>`;
    if (progress >= 100) statusBadge = `<span class="badge" style="background:rgba(48,209,88,0.18); color:var(--green); font-weight:700;">🏆 Achieved</span>`;
    else if (progress >= 50) statusBadge = `<span class="badge" style="background:rgba(56,189,248,0.18); color:var(--accent); font-weight:700;">⚡ On Track</span>`;

    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px;">
        <div>
          <h3 style="margin:0; font-size:1.05rem; font-weight:800; color:var(--text);">${escapeHTML(g.objective || g.title || 'Untitled Goal')}</h3>
          <div style="display:flex; gap:6px; margin-top:4px; align-items:center;">
            <span class="badge" style="background:rgba(255,255,255,0.06); font-size:0.7rem;">🎯 ${escapeHTML(g.quarter || 'Q3 2026')}</span>
            ${statusBadge}
          </div>
        </div>
        <button type="button" class="secondary" onclick="deleteGoal('${g.id}')" style="padding:4px 8px; font-size:0.75rem; color:var(--danger);" title="Delete Goal">✕</button>
      </div>

      <div>
        <div style="display:flex; justify-content:space-between; font-size:0.78rem; color:var(--muted); font-family:var(--font-code); margin-bottom:4px;">
          <span>Target Progress</span>
          <span style="font-weight:700; color:var(--accent);">${progress}%</span>
        </div>
        <div class="bar-track"><div class="bar-fill" style="width:${progress}%; background:${progress >= 100 ? 'var(--green)' : 'var(--accent)'};"></div></div>
      </div>

      <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;">
        <div style="display:flex; gap:6px;">
          <button type="button" class="secondary" onclick="updateGoalProgress('${g.id}', -10)" style="padding:4px 10px; font-size:0.75rem; font-weight:700;">-10%</button>
          <button type="button" class="secondary" onclick="updateGoalProgress('${g.id}', 10)" style="padding:4px 10px; font-size:0.75rem; font-weight:700;">+10%</button>
          <button type="button" class="secondary" onclick="updateGoalProgress('${g.id}', 100)" style="padding:4px 10px; font-size:0.75rem; font-weight:700; background:rgba(48,209,88,0.15); color:var(--green); border-color:rgba(48,209,88,0.3);">Mark 100%</button>
        </div>
        <span style="font-size:0.72rem; color:var(--muted); font-family:var(--font-code);">${g.targetDate ? 'Target: ' + g.targetDate : ''}</span>
      </div>
    `;

    container.appendChild(card);
  });
}

function updateGoalProgress(id, delta) {
  if (typeof FX !== "undefined") FX.playClick();
  const goals = loadGoals();
  const g = goals.find(x => x.id === id);
  if (!g) return;

  let currentProg = parseInt(g.progress, 10) || 0;
  if (delta === 100) {
    g.progress = 100;
  } else {
    g.progress = Math.min(100, Math.max(0, currentProg + delta));
  }
  g.updatedAt = new Date().toISOString();

  saveGoals(goals);
  renderGoals();
  if (g.progress === 100 && typeof FX !== "undefined") FX.burstConfetti();
  if (typeof showToast === "function") showToast(`Goal progress updated to ${g.progress}%`, "info");
}

function deleteGoal(id) {
  let goals = loadGoals();
  goals = goals.filter(g => g.id !== id);
  saveGoals(goals);
  renderGoals();

  if (typeof populateProjectAndGoalSelects === "function") populateProjectAndGoalSelects();
  if (typeof renderDashboard === "function") renderDashboard();
  if (typeof showToast === "function") showToast("Goal deleted.", "info");
}

/* ===================================================================
   Project Tasks Modal Dialog
   =================================================================== */

function openProjectTasksModal(projectId) {
  const dlg = document.getElementById("projectTasksModal");
  if (!dlg) return;

  const projects = loadProjects();
  const p = projects.find(x => x.id === projectId);
  if (!p) return;

  const modalTitle = document.getElementById("projectModalTitle");
  const modalId = document.getElementById("projectModalId");
  if (modalTitle) modalTitle.textContent = `📁 ${p.title || p.name}`;
  if (modalId) modalId.value = projectId;

  renderProjectModalTasks(projectId);
  dlg.showModal();
}

function renderProjectModalTasks(projectId) {
  const projects = loadProjects();
  const p = projects.find(x => x.id === projectId);
  const list = document.getElementById("projectModalTaskList");
  const progText = document.getElementById("projectModalProgressText");
  const pctText = document.getElementById("projectModalPercentText");
  const bar = document.getElementById("projectModalProgressBar");

  if (!p || !list) return;

  const pTasks = Array.isArray(p.taskList) ? p.taskList : [];
  const total = pTasks.length;
  const done = pTasks.filter(t => t.completed).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  if (progText) progText.textContent = `${done}/${total} Completed`;
  if (pctText) pctText.textContent = `${pct}%`;
  if (bar) bar.style.width = `${pct}%`;

  if (!pTasks.length) {
    list.innerHTML = `<div style="font-size:0.85rem; color:var(--muted); font-style:italic; padding:12px 0;">No sub-tasks added yet.</div>`;
    return;
  }

  list.innerHTML = pTasks.map(t => `
    <div style="display:flex; align-items:center; justify-content:space-between; padding:8px 12px; background:rgba(255,255,255,0.03); border:1px solid var(--border); border-radius:6px;">
      <label style="display:flex; align-items:center; gap:10px; cursor:pointer; flex:1; min-width:0;">
        <input type="checkbox" ${t.completed ? 'checked' : ''} onchange="toggleProjectTask('${p.id}', '${t.id}'); renderProjectModalTasks('${p.id}');">
        <span style="${t.completed ? 'text-decoration:line-through; opacity:0.6;' : ''}; font-size:0.9rem;">${escapeHTML(t.title)}</span>
      </label>
      <button type="button" onclick="deleteProjectTask('${p.id}', '${t.id}'); renderProjectModalTasks('${p.id}');" style="background:none; border:none; color:var(--muted); cursor:pointer; font-size:1.1rem;">&times;</button>
    </div>
  `).join('');
}

function handleAddModalProjectTask() {
  const input = document.getElementById("projectModalNewTaskInput");
  const modalId = document.getElementById("projectModalId");
  if (!input || !modalId || !input.value.trim()) return;

  const projectId = modalId.value;
  addProjectSubTask(projectId, input.value.trim());
  input.value = "";
  renderProjectModalTasks(projectId);
}

function closeProjectTasksModal() {
  const dlg = document.getElementById("projectTasksModal");
  if (dlg) dlg.close();
}

/* ===================================================================
   Vault Backup & Secret Encryption Core
   =================================================================== */

function exportVaultBackup() {
  const notes = loadVaultNotes();
  const jsonStr = JSON.stringify(notes, null, 2);
  const blob = new Blob([jsonStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `vault_encrypted_backup_${getIsoDateStr()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  if (typeof showToast === "function") showToast("Encrypted Vault Backup Exported!", "success");
}

function importVaultBackup(file) {
  if (file && file.target && file.target.files) {
    file = file.target.files[0];
  }
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const imported = JSON.parse(e.target.result);
      if (Array.isArray(imported)) {
        persistVaultNotes(imported);
        renderVaultContent();
        if (typeof showToast === "function") showToast("Encrypted Vault Backup Restored!", "success");
      }
    } catch {
      if (typeof showToast === "function") showToast("Invalid Vault Backup File", "error");
    }
  };
  reader.readAsText(file);
}

function changeVaultPin() {
  const oldPass = prompt("Enter current Vault Passcode:");
  if (oldPass !== vaultMasterKey) {
    if (typeof showToast === "function") showToast("Incorrect current passcode!", "error");
    return;
  }
  const newPass = prompt("Enter NEW Vault Passcode:");
  if (newPass) {
    vaultMasterKey = newPass;
    if (typeof showToast === "function") showToast("Vault passcode updated successfully!", "success");
  }
}

async function deriveVaultKey(password, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: enc.encode(salt), iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encryptVaultPayload(plainText, password) {
  const enc = new TextEncoder();
  const salt = "dinakar-vault-salt";
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveVaultKey(password, salt);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(plainText));
  
  return {
    iv: Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join(''),
    cipherText: Array.from(new Uint8Array(encrypted)).map(b => b.toString(16).padStart(2, '0')).join('')
  };
}

async function decryptVaultPayload(encryptedObj, password) {
  try {
    const salt = "dinakar-vault-salt";
    const iv = new Uint8Array(encryptedObj.iv.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
    const cipherText = new Uint8Array(encryptedObj.cipherText.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
    const key = await deriveVaultKey(password, salt);
    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipherText);
    return new TextDecoder().decode(decrypted);
  } catch (e) {
    return null;
  }
}

function renderVaultAuthPane() {
  const authPane = document.getElementById("vaultAuthPane");
  const mainPane = document.getElementById("vaultContentPane") || 
                   document.getElementById("vaultMainContent") || 
                   document.getElementById("vaultUnlockedPane");
  const changePinBtn = document.getElementById("vaultChangePinBtn");
  const lockBtn = document.getElementById("vaultLockBtn");

  if (isVaultUnlocked) {
    if (authPane) authPane.style.setProperty("display", "none", "important");
    if (mainPane) mainPane.style.setProperty("display", "block", "important");
    if (changePinBtn) changePinBtn.style.display = "inline-flex";
    if (lockBtn) lockBtn.style.display = "inline-flex";
    switchVaultSubTab(currentVaultSubTab || "secrets");
  } else {
    if (authPane) authPane.style.setProperty("display", "block", "important");
    if (mainPane) mainPane.style.setProperty("display", "none", "important");
    if (changePinBtn) changePinBtn.style.display = "none";
    if (lockBtn) lockBtn.style.display = "none";
  }
}

async function unlockVault(e) {
  if (e) {
    if (typeof e.preventDefault === "function") e.preventDefault();
    if (typeof e.stopPropagation === "function") e.stopPropagation();
  }
  const pwdInput = document.getElementById("vaultPinInput") || 
                   document.getElementById("vaultPassInput") || 
                   document.getElementById("vaultPasscode") || 
                   document.querySelector("#vaultAuthPane input") ||
                   document.querySelector("input[type='password']");

  const pwd = pwdInput ? pwdInput.value.trim() : "";
  if (!pwd) {
    if (typeof showToast === "function") showToast("Please enter a passcode to unlock vault.", "error");
    if (pwdInput) pwdInput.focus();
    return;
  }

  vaultMasterKey = pwd;
  isVaultUnlocked = true;
  if (pwdInput) pwdInput.value = "";
  renderVaultAuthPane();
  if (typeof showToast === "function") showToast("Vault unlocked! 🔐", "success");
}

function lockVault() {
  isVaultUnlocked = false;
  vaultMasterKey = null;
  renderVaultAuthPane();
  if (typeof showToast === "function") showToast("Vault locked.", "info");
}

async function createVaultNote(e) {
  if (e) e.preventDefault();
  if (!isVaultUnlocked || !vaultMasterKey) return;

  const titleInput = document.getElementById("vaultTopic") || document.getElementById("vaultNoteTitle") || document.getElementById("vaultTitle");
  const secretInput = document.getElementById("vaultContent") || document.getElementById("vaultNoteSecret") || document.getElementById("vaultSecret");
  const title = titleInput ? titleInput.value.trim() : "";
  const secret = secretInput ? secretInput.value.trim() : "";

  if (!title || !secret) return;

  const encryptedObj = await encryptVaultPayload(secret, vaultMasterKey);
  const notes = loadVaultNotes();
  const categoryInput = document.getElementById("vaultCategory");

  notes.unshift({
    id: typeof uuid === "function" ? uuid() : "vn-" + Date.now(),
    title,
    category: categoryInput ? categoryInput.value : "JOURNAL",
    encrypted: encryptedObj,
    createdAt: new Date().toISOString()
  });

  persistVaultNotes(notes);
  if (titleInput) titleInput.value = "";
  if (secretInput) secretInput.value = "";
  renderVaultContent();
  if (typeof showToast === "function") showToast("Secret saved & encrypted with AES-256!", "success");
}

async function renderVaultContent() {
  const container = document.getElementById("vaultGrid") || document.getElementById("vaultNotesGrid");
  if (!container) return;
  const notes = loadVaultNotes();
  const search = (document.getElementById("vaultSearchInput")?.value || "").trim().toLowerCase();
  const category = document.getElementById("filterVaultCategory")?.value || "ALL";
  container.innerHTML = "";

  const filteredNotes = notes.filter(n => {
    const title = (n.title || "").toLowerCase();
    const plain = (n.plainText || "").toLowerCase();
    const matchesSearch = !search || title.includes(search) || plain.includes(search);
    const matchesCategory = category === "ALL" || (n.category || "JOURNAL") === category;
    return matchesSearch && matchesCategory;
  });

  if (!filteredNotes.length) {
    container.innerHTML = `<div class="empty-state"><h3>${search || category !== "ALL" ? "No Matching Secrets" : "Vault Empty"}</h3><p>Store encrypted passwords, API keys & secrets safely.</p></div>`;
    return;
  }

  for (const n of filteredNotes) {
    const card = document.createElement("div");
    card.className = "vault-workspace-card panel";
    const plainText = await decryptVaultPayload(n.encrypted, vaultMasterKey);

    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <h4 style="margin:0; font-size:1.05rem; font-weight:800; color:var(--accent);">🔑 ${escapeHTML(n.title)}</h4>
        <button type="button" class="secondary" onclick="deleteVaultNote('${n.id}')" style="padding:2px 8px; font-size:0.75rem; color:var(--danger);">Delete</button>
      </div>
      <div style="font-family:var(--font-code); font-size:0.85rem; background:rgba(0,0,0,0.3); border:1px solid var(--border); padding:10px; border-radius:var(--radius-sm); color:var(--text); word-break:break-all; margin-top:8px;">
        ${plainText ? escapeHTML(plainText) : '<span style="color:var(--danger);">Decryption Failed</span>'}
      </div>
    `;
    container.appendChild(card);
  }
}

function deleteVaultNote(id) {
  let notes = loadVaultNotes();
  notes = notes.filter(n => n.id !== id);
  persistVaultNotes(notes);
  renderVaultContent();
  if (typeof showToast === "function") showToast("Secret deleted.", "info");
}
