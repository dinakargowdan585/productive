/* Main SPA Application Router & Global Event Controller */

let toastTimer = null;
let confirmResolver = null;

function showToast(msg, type = "info") {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = msg;
  toast.className = `toast ${type} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.className = "toast";
  }, 3500);
}

function render() {
  if (typeof renderNotes === "function") renderNotes();
}

function renderVault() {
  if (typeof renderVaultAuthPane === "function") renderVaultAuthPane();
}

function renderAnalytics() {
  const container = document.getElementById("analyticsContent");
  if (!container) return;

  const tasks = typeof loadTasks === "function" ? loadTasks() : [];
  const notes = typeof loadNotes === "function" ? loadNotes() : [];
  const timeBlocks = typeof loadTimeBlocks === "function" ? loadTimeBlocks() : [];

  const completed = tasks.filter(t => t.completed).length;
  const total = tasks.length;
  const taskRate = total > 0 ? Math.round((completed / total) * 100) : 0;
  const totalFocusMins = timeBlocks.reduce((acc, b) => acc + (b.durationMinutes || 0), 0);

  container.innerHTML = `
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:16px; margin-bottom:24px;">
      <div class="panel" style="text-align:center;">
        <span style="font-size:0.75rem; color:var(--muted); font-weight:700;">TASK COMPLETION RATE</span>
        <h2 style="font-size:2.2rem; margin:8px 0; color:var(--accent);">${taskRate}%</h2>
        <span style="font-size:0.8rem; color:var(--muted);">${completed}/${total} Tasks Done</span>
      </div>
      <div class="panel" style="text-align:center;">
        <span style="font-size:0.75rem; color:var(--muted); font-weight:700;">TOTAL FOCUS TIME</span>
        <h2 style="font-size:2.2rem; margin:8px 0; color:var(--green);">${Math.floor(totalFocusMins / 60)}h ${totalFocusMins % 60}m</h2>
        <span style="font-size:0.8rem; color:var(--muted);">${timeBlocks.length} Focus Session(s)</span>
      </div>
      <div class="panel" style="text-align:center;">
        <span style="font-size:0.75rem; color:var(--muted); font-weight:700;">TOTAL KNOWLEDGE NOTES</span>
        <h2 style="font-size:2.2rem; margin:8px 0; color:var(--amber);">${notes.length}</h2>
        <span style="font-size:0.8rem; color:var(--muted);">Knowledge Library Entries</span>
      </div>
    </div>
  `;
}

function toggleCustomAnalyticsDates() {
  const customPane = document.getElementById("analyticsCustomDateRange");
  if (customPane) {
    customPane.style.display = customPane.style.display === "none" ? "flex" : "none";
  }
}

function filterCommandPalette(q) {
  renderCommandPaletteResults(q);
}

function resolveConfirm(res) {
  const dlg = document.getElementById("confirmModal");
  if (dlg) dlg.close();
  if (confirmResolver) {
    confirmResolver(res);
    confirmResolver = null;
  }
}

function switchView(viewName) {
  const views = ["Dashboard", "Notes", "Planner", "Vault", "Calendar", "Analytics", "Standby"];
  views.forEach(v => {
    const el = document.getElementById("view" + v);
    if (el) el.style.display = (v.toLowerCase() === viewName) ? (v === "Notes" || v === "Planner" ? "grid" : "block") : "none";
  });

  const statsRow = document.getElementById("statsRow");
  const cardNotes = document.getElementById("cardTotalNotes");
  const cardTasks = document.getElementById("cardTasksDone");

  if (statsRow && cardNotes && cardTasks) {
    if (viewName === "notes") {
      statsRow.style.display = "flex";
      cardNotes.style.display = "flex";
      cardTasks.style.display = "none";
    } else if (viewName === "planner") {
      statsRow.style.display = "flex";
      cardNotes.style.display = "none";
      cardTasks.style.display = "flex";
    } else {
      statsRow.style.display = "none";
    }
  }

  document.querySelectorAll(".dock-item").forEach(item => item.classList.remove("active"));
  const dockEl = document.getElementById("dock" + viewName.charAt(0).toUpperCase() + viewName.slice(1));
  if (dockEl) dockEl.classList.add("active");

  if (viewName === "dashboard" && typeof renderDashboard === "function") renderDashboard();
  if (viewName === "planner" && typeof renderPlanner === "function") renderPlanner();
  if (viewName === "notes" && typeof renderNotes === "function") renderNotes();
  if (viewName === "calendar" && typeof renderCalendar === "function") renderCalendar();
  if (viewName === "vault" && typeof renderVaultAuthPane === "function") renderVaultAuthPane();
  if (viewName === "analytics") renderAnalytics();
  if (viewName === "standby" && typeof updateStandbyClock === "function") updateStandbyClock();
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") || "dark";
  const next = current === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  showToast(`Switched to ${next} mode`, "info");
}

function openCommandPalette() {
  const modal = document.getElementById("commandPaletteModal");
  if (modal && modal.showModal) {
    modal.showModal();
    const input = document.getElementById("cmdPaletteInput");
    if (input) {
      input.value = "";
      input.focus();
      renderCommandPaletteResults("");
    }
  }
}

function closeCommandPalette() {
  const modal = document.getElementById("commandPaletteModal");
  if (modal && modal.close) modal.close();
}

function renderCommandPaletteResults(query) {
  const container = document.getElementById("cmdPaletteResults");
  if (!container) return;
  const q = (query || "").trim().toLowerCase();

  const tasks = typeof loadTasks === "function" ? loadTasks() : [];
  const notes = typeof loadNotes === "function" ? loadNotes() : [];
  const projects = typeof loadProjects === "function" ? loadProjects() : [];
  const goals = typeof loadGoals === "function" ? loadGoals() : [];

  let items = [
    { type: 'Auth', title: '☁️ Cloud Account & Google Login', meta: 'Supabase Authentication & Sync Settings', action: () => { openSupabaseAuthModal(); closeCommandPalette(); } }
  ];

  tasks.forEach(t => {
    if (!q || t.title.toLowerCase().includes(q)) {
      items.push({ type: 'Task', title: t.title, meta: `Due: ${t.dueDate || 'No date'}`, action: () => { switchView('planner'); closeCommandPalette(); } });
    }
  });

  notes.forEach(n => {
    if (!q || (n.topic && n.topic.toLowerCase().includes(q)) || (n.takeaway && n.takeaway.toLowerCase().includes(q))) {
      items.push({ type: 'Note', title: n.topic, meta: `Category: ${n.category}`, action: () => { switchView('notes'); closeCommandPalette(); } });
    }
  });

  projects.forEach(p => {
    if (!q || p.title.toLowerCase().includes(q)) {
      items.push({ type: 'Project', title: p.title, meta: `Category: ${p.cat || 'Work'}`, action: () => { switchView('vault'); switchVaultSubTab('workspaces'); closeCommandPalette(); } });
    }
  });

  goals.forEach(g => {
    if (!q || (g.objective && g.objective.toLowerCase().includes(q))) {
      items.push({ type: 'Goal', title: g.objective, meta: `Quarter: ${g.quarter || 'Q3 2026'}`, action: () => { switchView('vault'); switchVaultSubTab('goals'); closeCommandPalette(); } });
    }
  });

  items = items.slice(0, 8);

  if (!items.length) {
    container.innerHTML = `<div style="padding:12px; font-size:0.85rem; color:var(--muted); text-align:center;">No matching results found</div>`;
    return;
  }

  container.innerHTML = items.map((item, idx) => `
    <div onclick="executePaletteAction(${idx})" style="padding:8px 12px; border-radius:var(--radius-sm); background:rgba(255,255,255,0.03); border:1px solid var(--border); display:flex; justify-content:space-between; align-items:center; cursor:pointer; margin-bottom:4px;">
      <div>
        <strong style="color:var(--text); font-size:0.9rem;">${escapeHTML(item.title)}</strong>
        <div style="font-size:0.75rem; color:var(--muted);">${escapeHTML(item.meta)}</div>
      </div>
      <span class="badge">${item.type}</span>
    </div>
  `).join('');

  window._paletteActions = items.map(i => i.action);
}

function executePaletteAction(idx) {
  if (window._paletteActions && window._paletteActions[idx]) {
    window._paletteActions[idx]();
  }
}

window.addEventListener("keydown", (e) => {
  if (e.metaKey || e.ctrlKey) {
    if (e.key === "1") { e.preventDefault(); switchView("dashboard"); }
    else if (e.key === "2") { e.preventDefault(); switchView("planner"); }
    else if (e.key === "3") { e.preventDefault(); switchView("calendar"); }
    else if (e.key === "4") { e.preventDefault(); switchView("notes"); }
    else if (e.key === "5") { e.preventDefault(); switchView("vault"); }
    else if (e.key === "6") { e.preventDefault(); switchView("analytics"); }
    else if (e.key === "7") { e.preventDefault(); switchView("standby"); }
    else if (e.key.toLowerCase() === "k") { e.preventDefault(); openCommandPalette(); }
  } else if (e.key === "Escape") {
    closeCommandPalette();
  }
});

function toggleSyncPopover(e) {
  if (e && typeof e.stopPropagation === "function") e.stopPropagation();
  const popover = document.getElementById("syncPopover");
  if (!popover) return;
  const isHidden = popover.style.display === "none";
  popover.style.display = isHidden ? "flex" : "none";
  if (isHidden && typeof updateSyncStatusPillUI === "function") {
    updateSyncStatusPillUI();
  }
}

function closeSyncPopover() {
  const popover = document.getElementById("syncPopover");
  if (popover) popover.style.display = "none";
}

function openSupabaseAuthModal() {
  closeSyncPopover();
  const cfg = typeof getSupabaseConfig === "function" ? getSupabaseConfig() : { url: "", key: "" };
  const urlInput = document.getElementById("cfgSupabaseUrl");
  const keyInput = document.getElementById("cfgSupabaseKey");
  if (urlInput) urlInput.value = cfg.url || "";
  if (keyInput) keyInput.value = cfg.key || "";

  const dlg = document.getElementById("supabaseAuthModal");
  if (dlg && dlg.showModal) dlg.showModal();
}

function closeSupabaseAuthModal() {
  const dlg = document.getElementById("supabaseAuthModal");
  if (dlg && dlg.close) dlg.close();
  showAuthEmailStep();
}

function showAuthEmailStep(e) {
  if (e) e.preventDefault();
  const stepEmail = document.getElementById("authStepEmail");
  const stepOtp = document.getElementById("authStepOtp");
  const title = document.getElementById("authModalTitle");
  if (stepEmail) stepEmail.style.display = "flex";
  if (stepOtp) stepOtp.style.display = "none";
  if (title) title.textContent = "☁️ Productive Cloud Sign In";
}

function showAuthOtpStep(email) {
  const stepEmail = document.getElementById("authStepEmail");
  const stepOtp = document.getElementById("authStepOtp");
  const title = document.getElementById("authModalTitle");
  const targetEmailEl = document.getElementById("otpTargetEmail");
  const otpInput = document.getElementById("authOtpInput");

  if (stepEmail) stepEmail.style.display = "none";
  if (stepOtp) stepOtp.style.display = "flex";
  if (title) title.textContent = "✉️ Verify Email Code";
  if (targetEmailEl) targetEmailEl.textContent = email;
  if (otpInput) {
    otpInput.value = "";
    otpInput.focus();
  }
}

async function handleSendOtp(e) {
  if (e) e.preventDefault();
  const emailInput = document.getElementById("authEmailInput");
  const email = emailInput ? emailInput.value.trim() : "";
  const sendBtn = document.getElementById("btnSendOtp");

  if (!email || !email.includes("@")) {
    if (typeof showToast === "function") showToast("Please enter a valid email address.", "error");
    return;
  }

  if (sendBtn) {
    sendBtn.disabled = true;
    sendBtn.textContent = "Sending code...";
  }

  try {
    const data = await requestEmailOtp(email);
    if (!data && typeof ensureSupabaseConfigured === "function" && !getSupabase()) {
      return;
    }
    showAuthOtpStep(email);
    if (typeof showToast === "function") showToast(`Verification code sent to ${email}`, "success");
  } catch (err) {
    const msg = err.message || String(err);
    if (msg.includes("rate limit") || msg.includes("Too many")) {
      if (typeof showToast === "function") showToast("Too many OTP requests. Please wait a minute.", "error");
    } else {
      if (typeof showToast === "function") showToast(`OTP Error: ${msg}`, "error");
    }
  } finally {
    if (sendBtn) {
      sendBtn.disabled = false;
      sendBtn.textContent = "✉️ Send verification code";
    }
  }
}

async function handleVerifyOtp(e) {
  if (e) e.preventDefault();
  const emailInput = document.getElementById("authEmailInput");
  const otpInput = document.getElementById("authOtpInput");
  const email = emailInput ? emailInput.value.trim() : "";
  const token = otpInput ? otpInput.value.trim() : "";
  const verifyBtn = document.getElementById("btnVerifyOtp");

  if (!email || !token || token.length < 6) {
    if (typeof showToast === "function") showToast("Please enter the full 6-digit verification code.", "error");
    return;
  }

  if (verifyBtn) {
    verifyBtn.disabled = true;
    verifyBtn.textContent = "Verifying...";
  }

  try {
    const data = await verifyEmailOtp(email, token);
    if (!data) return;

    closeSupabaseAuthModal();
    if (typeof showToast === "function") showToast("OTP verified! Welcome back. 🎉", "success");
    
    const userObj = data?.user || data?.session?.user;
    if (userObj?.email) {
      const emailEl = document.getElementById("syncUserEmail");
      if (emailEl) emailEl.textContent = userObj.email;
    }
    if (typeof triggerBackgroundSync === "function") triggerBackgroundSync();
  } catch (err) {
    const msg = err.message || String(err);
    if (msg.includes("invalid") || msg.includes("expired") || msg.includes("Token")) {
      if (typeof showToast === "function") showToast("Invalid or expired OTP code. Try resending.", "error");
    } else {
      if (typeof showToast === "function") showToast(`Verification Error: ${msg}`, "error");
    }
  } finally {
    if (verifyBtn) {
      verifyBtn.disabled = false;
      verifyBtn.textContent = "Verify Code";
    }
  }
}

async function handleResendOtp(e) {
  if (e) e.preventDefault();
  const emailInput = document.getElementById("authEmailInput");
  const email = emailInput ? emailInput.value.trim() : "";
  if (!email) return;

  try {
    await requestEmailOtp(email);
    if (typeof showToast === "function") showToast(`Resent new 6-digit code to ${email}`, "info");
  } catch (err) {
    if (typeof showToast === "function") showToast(`Resend Error: ${err.message || String(err)}`, "error");
  }
}

async function handleAuthSubmit(e) {
  if (e) e.preventDefault();
  const email = document.getElementById("authEmailInput")?.value.trim();
  const password = document.getElementById("authPasswordInput")?.value.trim();
  if (!email || !password) return;

  try {
    const data = await signInWithEmail(email, password);
    if (!data) return;
    closeSupabaseAuthModal();
    if (typeof showToast === "function") showToast("Signed in to Supabase Cloud! ☁️", "success");
    
    const userObj = data?.user || data?.session?.user;
    if (userObj?.email) {
      const emailEl = document.getElementById("syncUserEmail");
      if (emailEl) emailEl.textContent = userObj.email;
    }
    if (typeof triggerBackgroundSync === "function") triggerBackgroundSync();
  } catch (err) {
    if (typeof showToast === "function") showToast(`Auth Error: ${err.message || String(err)}`, "error");
  }
}

async function executeSignUp() {
  const email = document.getElementById("authEmailInput")?.value.trim();
  const password = document.getElementById("authPasswordInput")?.value.trim();
  if (!email || !password) {
    if (typeof showToast === "function") showToast("Enter email and password to sign up", "error");
    return;
  }

  try {
    const data = await signUpWithEmail(email, password);
    if (!data) return;
    closeSupabaseAuthModal();
    if (typeof showToast === "function") showToast("Sign-up email sent! Check inbox to confirm.", "info");
  } catch (err) {
    if (typeof showToast === "function") showToast(`Sign-Up Error: ${err.message || String(err)}`, "error");
  }
}

async function executeGoogleAuth() {
  try {
    if (typeof showToast === "function") showToast("Connecting to Google...", "info");
    const data = await (typeof signInWithGoogle === "function" ? signInWithGoogle() : window.signInWithGoogle?.());
    if (!data) return;
  } catch (err) {
    console.error("Google login error:", err);
    if (typeof showToast === "function") showToast(`Google Auth Error: ${err.message || String(err)}`, "error");
  }
}

if (typeof window !== "undefined") {
  window.executeGoogleAuth = executeGoogleAuth;
  window.googleOAuthLogin = executeGoogleAuth;
  window.handleGoogleLogin = executeGoogleAuth;
  window.googleLogin = executeGoogleAuth;
}

async function saveCustomCredentialsFromModal() {
  const url = document.getElementById("cfgSupabaseUrl")?.value.trim();
  const key = document.getElementById("cfgSupabaseKey")?.value.trim();
  if (url && key) {
    saveSupabaseCredentials(url, key);
    if (typeof setupRealtimeSync === "function") setupRealtimeSync();

    if (typeof checkSupabaseConnectionHealth === "function") {
      const health = await checkSupabaseConnectionHealth();
      if (health.connected) {
        if (typeof showToast === "function") showToast("⚡ Credentials verified & Supabase connected!", "success");
        const statusLabel = document.getElementById("syncStatusLabel");
        if (statusLabel) statusLabel.textContent = "Cloud Synced";
      } else {
        if (typeof showToast === "function") showToast(health.message, "danger");
      }
    } else {
      if (typeof showToast === "function") showToast("Supabase credentials saved!", "success");
    }
    closeSupabaseAuthModal();
  } else {
    if (typeof showToast === "function") showToast("Please enter both URL and Anon Key.", "info");
  }
}

document.addEventListener("click", (e) => {
  const popover = document.getElementById("syncPopover");
  const btn = document.getElementById("syncStatusPill");
  if (popover && popover.style.display === "flex") {
    if (!popover.contains(e.target) && btn && !btn.contains(e.target)) {
      closeSyncPopover();
    }
  }
});

function triggerBackgroundSync() {
  if (typeof SyncEngine !== "undefined" && typeof SyncEngine.triggerSync === "function") {
    SyncEngine.triggerSync();
  }
}

// App Bootstrap
document.addEventListener("DOMContentLoaded", async () => {
  if (typeof initApplicationStorage === "function") {
    await initApplicationStorage();
  }
  switchView("dashboard");
  if (typeof updateStandbyClock === "function") updateStandbyClock();

  if (typeof getSupabaseSession === "function") {
    getSupabaseSession().then(session => {
      const userObj = session?.user;
      if (userObj?.email) {
        const emailEl = document.getElementById("syncUserEmail");
        if (emailEl) emailEl.textContent = userObj.email;
        if (typeof triggerBackgroundSync === "function") triggerBackgroundSync();
      }
    }).catch(() => {});
  }

  if (typeof subscribeToAuthChanges === "function") {
    subscribeToAuthChanges((event, session) => {
      const emailEl = document.getElementById("syncUserEmail");
      const userObj = session?.user;
      if (emailEl) {
        emailEl.textContent = userObj?.email || "Guest (Local)";
      }
      if (userObj) {
        if (typeof showToast === "function" && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
          showToast(`👋 Welcome, ${userObj.email}!`, "success");
          if (typeof closeSupabaseAuthModal === "function") closeSupabaseAuthModal();
        }
        if (typeof triggerBackgroundSync === "function") {
          triggerBackgroundSync();
        }
      }
      
      // Clean up OAuth tokens from URL if present
      if (typeof window !== "undefined") {
        if (window.location.hash && window.location.hash.includes("access_token")) {
          window.history.replaceState(null, "", window.location.pathname + window.location.search);
        }
        if (window.location.search && window.location.search.includes("code=")) {
          window.history.replaceState(null, "", window.location.pathname);
        }
      }
    });
  }
});

/* PWA Installation Controller */
let deferredPwaPrompt = null;

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPwaPrompt = e;
  const pwaBtns = document.querySelectorAll(".pwa-install-btn");
  pwaBtns.forEach(btn => {
    btn.style.display = "flex";
  });
  console.log("📲 Productive OS PWA install prompt ready.");
});

window.addEventListener("appinstalled", () => {
  deferredPwaPrompt = null;
  const pwaBtns = document.querySelectorAll(".pwa-install-btn");
  pwaBtns.forEach(btn => {
    btn.style.display = "none";
  });
  if (typeof showToast === "function") {
    showToast("🎉 Productive OS is now installed on your desktop/mobile!", "success");
  }
});

async function promptPwaInstall() {
  if (!deferredPwaPrompt) {
    if (typeof showToast === "function") {
      showToast("📱 App is already installed or open in standalone window.", "info");
    }
    return;
  }
  deferredPwaPrompt.prompt();
  const { outcome } = await deferredPwaPrompt.userChoice;
  if (outcome === "accepted") {
    if (typeof showToast === "function") {
      showToast("🚀 Productive OS installation initiated!", "success");
    }
  }
  deferredPwaPrompt = null;
}

/* Local Data Backup & Restore Controller */
async function exportFullDataBackup() {
  try {
    const backupData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      tasks: typeof loadTasks === "function" ? loadTasks() : [],
      notes: typeof loadNotes === "function" ? loadNotes() : [],
      timeBlocks: typeof loadTimeBlocks === "function" ? loadTimeBlocks() : [],
      projects: typeof loadProjects === "function" ? loadProjects() : [],
      vaultNotes: typeof loadVaultNotes === "function" ? loadVaultNotes() : []
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    const dateStr = typeof getIsoDateStr === "function" ? getIsoDateStr() : new Date().toISOString().split("T")[0];
    downloadAnchor.setAttribute("download", `productive-os-backup-${dateStr}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    if (typeof showToast === "function") {
      showToast("📦 Full backup downloaded successfully!", "success");
    }
  } catch (err) {
    console.error("Backup export error:", err);
    if (typeof showToast === "function") {
      showToast("Failed to export backup: " + err.message, "danger");
    }
  }
}

function importFullDataBackupPrompt() {
  const fileInput = document.getElementById("backupFileInput");
  if (fileInput) {
    fileInput.click();
  }
}

async function handleBackupFileSelect(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);

    if (!parsed || (typeof parsed !== "object")) {
      throw new Error("Invalid JSON file format.");
    }

    if (parsed.tasks && Array.isArray(parsed.tasks) && typeof TasksRepository !== "undefined") {
      for (const t of parsed.tasks) {
        await TasksRepository.save(t);
      }
    }
    if (parsed.notes && Array.isArray(parsed.notes) && typeof NotesRepository !== "undefined") {
      for (const n of parsed.notes) {
        await NotesRepository.save(n);
      }
    }
    if (parsed.timeBlocks && Array.isArray(parsed.timeBlocks) && typeof TimeBlocksRepository !== "undefined") {
      for (const b of parsed.timeBlocks) {
        await TimeBlocksRepository.save(b);
      }
    }
    if (parsed.projects && Array.isArray(parsed.projects) && typeof ProjectsRepository !== "undefined") {
      for (const p of parsed.projects) {
        await ProjectsRepository.save(p);
      }
    }

    if (typeof loadAllFromRepositoriesIntoMemory === "function") {
      await loadAllFromRepositoriesIntoMemory();
    }
    if (typeof render === "function") render();
    if (typeof renderAnalytics === "function") renderAnalytics();

    if (typeof showToast === "function") {
      showToast("✅ Workspace data restored successfully!", "success");
    }
  } catch (err) {
    console.error("Backup import error:", err);
    if (typeof showToast === "function") {
      showToast("Error importing backup: " + err.message, "danger");
    }
  } finally {
    event.target.value = "";
  }
}

