/* WebCrypto AES-256-GCM Encrypted Vault Engine */

let isVaultUnlocked = false;
let vaultMasterKey = null;
let currentVaultSubTab = "secrets";

function switchVaultSubTab(tabName) {
  currentVaultSubTab = tabName;
  const sec = document.getElementById("vaultTabSecrets");
  const ws = document.getElementById("vaultTabWorkspaces");
  const gl = document.getElementById("vaultTabGoals");

  if (sec) sec.style.display = tabName === "secrets" ? "block" : "none";
  if (ws) ws.style.display = tabName === "workspaces" ? "block" : "none";
  if (gl) gl.style.display = tabName === "goals" ? "block" : "none";

  document.querySelectorAll(".vault-sub-tab, #vaultSubTabSecrets, #vaultSubTabWorkspaces, #vaultSubTabGoals").forEach(btn => btn.classList.remove("active"));
  const activeBtn = document.getElementById(`vaultSubTab${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`);
  if (activeBtn) activeBtn.classList.add("active");

  if (tabName === "secrets") renderVaultContent();
  if (tabName === "workspaces" && typeof renderWorkspaces === "function") renderWorkspaces();
  if (tabName === "goals" && typeof renderGoals === "function") renderGoals();
}

function createPresetProject() {
  const title = prompt("Enter Project Title:", "🏢 Q3 Architecture Platform");
  if (!title) return;
  const projects = loadProjects();
  projects.unshift({
    id: uuid(),
    title,
    cat: "Work",
    taskList: [
      { id: uuid(), title: "Requirements & Scope", completed: true },
      { id: uuid(), title: "Implementation Phase", completed: false }
    ]
  });
  saveProjects(projects);
  switchVaultSubTab("workspaces");
  if (typeof showToast === "function") showToast("Created project workspace!", "success");
}

function createPresetOKR() {
  const title = prompt("Enter OKR Goal Title:", "🎯 Scale Platform Velocity");
  if (!title) return;
  const goals = loadGoals();
  goals.unshift({
    id: uuid(),
    objective: title,
    progress: 30,
    quarter: "Q3 2026",
    status: "In Progress"
  });
  saveGoals(goals);
  switchVaultSubTab("goals");
  if (typeof showToast === "function") showToast("Created OKR Goal!", "success");
}

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

function handleAddModalProjectTask(e) {
  if (e) e.preventDefault();
  const input = document.getElementById("projectModalNewTaskInput");
  if (!input || !input.value.trim()) return;
  if (typeof addProjectSubTask === "function") addProjectSubTask(e);
}

function closeProjectTasksModal() {
  const dlg = document.getElementById("projectTasksModal");
  if (dlg) dlg.close();
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
  const mainPane = document.getElementById("vaultContentPane") || document.getElementById("vaultMainContent");
  const changePinBtn = document.getElementById("vaultChangePinBtn");
  const lockBtn = document.getElementById("vaultLockBtn");

  if (!authPane || !mainPane) return;

  if (isVaultUnlocked) {
    authPane.style.display = "none";
    mainPane.style.display = "block";
    if (changePinBtn) changePinBtn.style.display = "inline-flex";
    if (lockBtn) lockBtn.style.display = "inline-flex";
    switchVaultSubTab(currentVaultSubTab || "secrets");
  } else {
    authPane.style.display = "block";
    mainPane.style.display = "none";
    if (changePinBtn) changePinBtn.style.display = "none";
    if (lockBtn) lockBtn.style.display = "none";
  }
}

async function unlockVault(e) {
  if (e) {
    if (typeof e.preventDefault === "function") e.preventDefault();
    if (typeof e.stopPropagation === "function") e.stopPropagation();
  }
  const pwdInput = document.getElementById("vaultPinInput") || document.getElementById("vaultPassInput") || document.getElementById("vaultPasscode");
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

  const titleInput = document.getElementById("vaultNoteTitle") || document.getElementById("vaultTitle");
  const secretInput = document.getElementById("vaultNoteSecret") || document.getElementById("vaultSecret");
  const title = titleInput ? titleInput.value.trim() : "";
  const secret = secretInput ? secretInput.value.trim() : "";

  if (!title || !secret) return;

  const encryptedObj = await encryptVaultPayload(secret, vaultMasterKey);
  const notes = loadVaultNotes();

  notes.unshift({
    id: uuid(),
    title,
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
  const container = document.getElementById("vaultNotesGrid");
  if (!container) return;
  const notes = loadVaultNotes();
  container.innerHTML = "";

  if (!notes.length) {
    container.innerHTML = `<div class="empty-state"><h3>Vault Empty</h3><p>Store encrypted passwords, API keys & secrets safely.</p></div>`;
    return;
  }

  for (const n of notes) {
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
