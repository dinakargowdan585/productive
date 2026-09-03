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

let currentActiveView = "dashboard";
window.currentActiveView = "dashboard";

function getCurrentActiveView() {
  return window.currentActiveView || currentActiveView || "dashboard";
}

function switchView(viewName) {
  if (!viewName) viewName = "dashboard";
  viewName = viewName.toLowerCase();
  window.currentActiveView = viewName;
  currentActiveView = viewName;

  const views = ["Dashboard", "Notes", "Planner", "Vault", "Calendar", "Standby"];
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
  if (viewName === "standby") {
    if (typeof updateStandbyClock === "function") updateStandbyClock();
    if (typeof FX !== "undefined" && typeof FX.initStandbyCosmicCanvas === "function") FX.initStandbyCosmicCanvas();
  }
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
    else if (e.key === "6") { e.preventDefault(); switchView("standby"); }
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

function updateAuthUI(user) {
  const emailEl = document.getElementById("syncUserEmail");
  const authBtn = document.getElementById("btnOpenAuthModal");
  const loggedInEmailEl = document.getElementById("loggedInUserEmail");
  const loggedInAvatarEl = document.getElementById("loggedInUserAvatar");
  const dot = document.getElementById("syncStatusDot");
  const label = document.getElementById("syncStatusLabel");
  const dockTooltip = document.getElementById("dockAuthTooltip");
  const headerBadge = document.getElementById("headerAccountBadge");
  const greetingText = document.getElementById("execGreetingText");

  if (user && user.email) {
    const email = user.email;
    const username = email.split('@')[0];
    const initial = email.charAt(0).toUpperCase();

    if (emailEl) {
      emailEl.innerHTML = `<span style="color:var(--accent); font-weight:700;">🟢 ${escapeHTML(email)}</span>`;
    }
    if (loggedInEmailEl) loggedInEmailEl.textContent = email;
    if (loggedInAvatarEl) loggedInAvatarEl.textContent = initial;

    if (authBtn) {
      authBtn.innerHTML = `👤 Account (${escapeHTML(username)})`;
      authBtn.style.borderColor = "var(--accent)";
      authBtn.style.color = "var(--accent)";
    }
    if (dot) dot.style.background = "var(--green)";
    if (label) label.textContent = "Synced";
    if (dockTooltip) dockTooltip.textContent = `👤 Logged in: ${email}`;

    if (headerBadge) {
      headerBadge.innerHTML = `<span style="width:8px; height:8px; border-radius:50%; background:var(--green); display:inline-block;"></span> <span style="color:var(--accent);">${escapeHTML(email)}</span>`;
      headerBadge.style.display = "inline-flex";
      headerBadge.title = "Connected to Supabase Cloud. Click to view account.";
    }
    if (greetingText && username) {
      greetingText.textContent = `Welcome back, ${username.charAt(0).toUpperCase() + username.slice(1)}`;
    }
  } else {
    if (emailEl) emailEl.textContent = "Guest (Local)";
    if (authBtn) {
      authBtn.innerHTML = `🔑 Account / Cloud Login`;
      authBtn.style.borderColor = "";
      authBtn.style.color = "";
    }
    if (dot) dot.style.background = "var(--muted)";
    if (label) label.textContent = "Local Mode";
    if (dockTooltip) dockTooltip.textContent = `☁️ Cloud Account & Sync`;

    if (headerBadge) {
      headerBadge.innerHTML = `<span style="width:8px; height:8px; border-radius:50%; background:var(--muted); display:inline-block;"></span> <span>Local Mode</span>`;
      headerBadge.style.display = "inline-flex";
      headerBadge.title = "Operating in local storage mode. Click to connect cloud.";
    }
  }
}

let currentAuthMode = "login";

function showAuthError(msg) {
  const banner = document.getElementById("authErrorBanner");
  const msgEl = document.getElementById("authErrorMessage");
  if (banner && msgEl) {
    msgEl.textContent = msg;
    banner.style.display = "flex";
  }
}

function clearAuthError() {
  const banner = document.getElementById("authErrorBanner");
  if (banner) banner.style.display = "none";
}

function switchAuthMode(mode) {
  currentAuthMode = mode;
  clearAuthError();

  const btnLogin = document.getElementById("btnModeLogin");
  const btnSignup = document.getElementById("btnModeSignup");
  const btnOtp = document.getElementById("btnModeOtp");
  const title = document.getElementById("authModalTitle");
  const subtitle = document.getElementById("authModalSubtitle");
  const passwordGroup = document.getElementById("authPasswordGroup");
  const passwordInput = document.getElementById("authPasswordInput");
  const submitBtnText = document.getElementById("authSubmitBtnText");
  const form = document.getElementById("authPasswordForm");
  const stepOtp = document.getElementById("authStepOtp");
  const stepLoggedIn = document.getElementById("authStepLoggedIn");
  const modeToggle = document.getElementById("authModeToggle");
  const divider = document.getElementById("authDivider");
  const googleBtn = document.getElementById("authGoogleBtn");
  const socialSection = document.getElementById("authSocialSection");

  if (stepLoggedIn) stepLoggedIn.style.display = "none";
  if (stepOtp) stepOtp.style.display = "none";
  if (form) form.style.display = "grid";
  if (modeToggle) modeToggle.style.display = "grid";
  if (socialSection) socialSection.style.display = mode === "otp" ? "none" : "flex";

  if (btnLogin) btnLogin.classList.toggle("active", mode === "login");
  if (btnSignup) btnSignup.classList.toggle("active", mode === "signup");
  if (btnOtp) btnOtp.classList.toggle("active", mode === "otp");

  if (mode === "login") {
    if (title) title.textContent = "Welcome Back";
    if (subtitle) subtitle.textContent = "Sign in to sync your notes, tasks, time blocks & projects across all your devices.";
    if (passwordGroup) passwordGroup.style.display = "grid";
    if (passwordInput) passwordInput.required = true;
    if (submitBtnText) submitBtnText.textContent = "Sign In";
    if (divider) divider.style.display = "flex";
    if (googleBtn) googleBtn.style.display = "flex";
  } else if (mode === "signup") {
    if (title) title.textContent = "Begin Your Journey";
    if (subtitle) subtitle.textContent = "Create an account to backup and sync your personal executive workspace.";
    if (passwordGroup) passwordGroup.style.display = "grid";
    if (passwordInput) passwordInput.required = true;
    if (submitBtnText) submitBtnText.textContent = "Create Account";
    if (divider) divider.style.display = "flex";
    if (googleBtn) googleBtn.style.display = "flex";
  } else if (mode === "otp") {
    if (title) title.textContent = "Passwordless Login";
    if (subtitle) subtitle.textContent = "Enter your email address to receive an instant 6-digit verification code.";
    if (passwordGroup) passwordGroup.style.display = "none";
    if (passwordInput) passwordInput.required = false;
    if (submitBtnText) submitBtnText.textContent = "✉️ Send Verification Code";
    if (divider) divider.style.display = "none";
    if (googleBtn) googleBtn.style.display = "none";
  }
}

function togglePasswordVisibility(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const isPass = input.type === "password";
  input.type = isPass ? "text" : "password";
  const toggleText = btn.querySelector(".toggle-text");
  if (toggleText) toggleText.textContent = isPass ? "Hide" : "Show";
}

async function openSupabaseAuthModal() {
  closeSyncPopover();
  clearAuthError();
  const cfg = typeof getSupabaseConfig === "function" ? getSupabaseConfig() : { url: "", key: "" };
  const urlInput = document.getElementById("cfgSupabaseUrl");
  const keyInput = document.getElementById("cfgSupabaseKey");
  if (urlInput) urlInput.value = cfg.url || "";
  if (keyInput) keyInput.value = cfg.key || "";

  const user = typeof getSupabaseUser === "function" ? await getSupabaseUser() : null;
  const stepLoggedIn = document.getElementById("authStepLoggedIn");
  const form = document.getElementById("authPasswordForm");
  const stepOtp = document.getElementById("authStepOtp");
  const modeToggle = document.getElementById("authModeToggle");
  const socialSection = document.getElementById("authSocialSection");
  const title = document.getElementById("authModalTitle");
  const subtitle = document.getElementById("authModalSubtitle");

  if (user && user.email) {
    if (stepLoggedIn) stepLoggedIn.style.display = "flex";
    if (form) form.style.display = "none";
    if (socialSection) socialSection.style.display = "none";
    if (stepOtp) stepOtp.style.display = "none";
    if (modeToggle) modeToggle.style.display = "none";
    if (title) title.textContent = "Supabase Cloud Account";
    if (subtitle) subtitle.textContent = "Your workspace is securely connected and actively synced to PostgreSQL Cloud.";
    updateAuthUI(user);
  } else {
    if (stepLoggedIn) stepLoggedIn.style.display = "none";
    if (modeToggle) modeToggle.style.display = "grid";
    if (socialSection) socialSection.style.display = "flex";
    switchAuthMode(currentAuthMode || "login");
  }

  const dlg = document.getElementById("supabaseAuthModal");
  if (dlg && dlg.showModal) dlg.showModal();
}

function closeSupabaseAuthModal() {
  const dlg = document.getElementById("supabaseAuthModal");
  if (dlg && dlg.close) dlg.close();
  clearAuthError();
}

async function handleSignOut() {
  try {
    if (typeof signOutUser === "function") await signOutUser();
    if (typeof showToast === "function") showToast("Signed out of Supabase Cloud.", "info");
    closeSupabaseAuthModal();
    updateAuthUI(null);
  } catch (err) {
    if (typeof showToast === "function") showToast(`Sign out error: ${err.message || String(err)}`, "error");
  }
}

async function handleAuthFormSubmit(e) {
  if (e) e.preventDefault();
  clearAuthError();

  const email = document.getElementById("authEmailInput")?.value.trim();
  const password = document.getElementById("authPasswordInput")?.value.trim();
  const submitBtn = document.getElementById("authSubmitBtn");
  const submitBtnText = document.getElementById("authSubmitBtnText");

  if (!email || !email.includes("@")) {
    showAuthError("Please enter a valid email address.");
    return;
  }

  if (currentAuthMode !== "otp" && !password) {
    showAuthError("Please enter your password.");
    return;
  }

  const originalText = submitBtnText ? submitBtnText.textContent : "Submit";
  if (submitBtn) {
    submitBtn.disabled = true;
    if (submitBtnText) submitBtnText.textContent = "Processing...";
  }

  try {
    if (currentAuthMode === "login") {
      const data = await signInWithEmail(email, password);
      if (!data) return;
      closeSupabaseAuthModal();
      if (typeof showToast === "function") showToast("Welcome back! Signed in to Cloud. ☁️", "success");
      const userObj = data?.user || data?.session?.user;
      if (userObj?.email) updateAuthUI(userObj);
      if (typeof triggerBackgroundSync === "function") triggerBackgroundSync();
    } else if (currentAuthMode === "signup") {
      const data = await signUpWithEmail(email, password);
      if (!data) return;
      closeSupabaseAuthModal();
      if (typeof showToast === "function") showToast("Account created successfully! Check email to confirm. 🎉", "success");
      const userObj = data?.user || data?.session?.user;
      if (userObj?.email) updateAuthUI(userObj);
      if (typeof triggerBackgroundSync === "function") triggerBackgroundSync();
    } else if (currentAuthMode === "otp") {
      await requestEmailOtp(email);
      showAuthOtpStep(email);
      if (typeof showToast === "function") showToast(`Verification code sent to ${email}`, "success");
    }
  } catch (err) {
    console.error("Auth error:", err);
    const msg = err.message || String(err);
    if (msg.includes("Invalid login credentials") || msg.includes("invalid")) {
      showAuthError("Invalid email or password. Please check your credentials or try Quick OTP.");
    } else if (msg.includes("User already registered")) {
      showAuthError("An account with this email already exists. Please switch to Sign In.");
    } else if (msg.includes("rate limit") || msg.includes("Too many")) {
      showAuthError("Too many requests. Please wait a minute and try again.");
    } else {
      showAuthError(`Authentication error: ${msg}`);
    }
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      if (submitBtnText) submitBtnText.textContent = originalText;
    }
  }
}

function showAuthOtpStep(email) {
  clearAuthError();
  const form = document.getElementById("authPasswordForm");
  const stepOtp = document.getElementById("authStepOtp");
  const stepLoggedIn = document.getElementById("authStepLoggedIn");
  const modeToggle = document.getElementById("authModeToggle");
  const title = document.getElementById("authModalTitle");
  const subtitle = document.getElementById("authModalSubtitle");
  const targetEmailEl = document.getElementById("otpTargetEmail");
  const otpInput = document.getElementById("authOtpInput");

  if (form) form.style.display = "none";
  if (stepLoggedIn) stepLoggedIn.style.display = "none";
  if (modeToggle) modeToggle.style.display = "none";
  if (stepOtp) stepOtp.style.display = "flex";

  if (title) title.textContent = "Verify 6-Digit Code";
  if (subtitle) subtitle.textContent = "Check your email inbox for the single-use verification code.";
  if (targetEmailEl) targetEmailEl.textContent = email;
  if (otpInput) {
    otpInput.value = "";
    otpInput.focus();
  }
}

async function handleVerifyOtp(e) {
  if (e) e.preventDefault();
  clearAuthError();

  const emailInput = document.getElementById("authEmailInput");
  const otpInput = document.getElementById("authOtpInput");
  const email = emailInput ? emailInput.value.trim() : "";
  const token = otpInput ? otpInput.value.trim() : "";
  const verifyBtn = document.getElementById("btnVerifyOtp");

  if (!email || !token || token.length < 6) {
    showAuthError("Please enter the full 6-digit verification code.");
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
      if (typeof updateAuthUI === "function") updateAuthUI(userObj);
    }
    if (typeof triggerBackgroundSync === "function") triggerBackgroundSync();
  } catch (err) {
    const msg = err.message || String(err);
    if (msg.includes("invalid") || msg.includes("expired") || msg.includes("Token")) {
      showAuthError("Invalid or expired OTP code. Click Resend to get a new code.");
    } else {
      showAuthError(`Verification error: ${msg}`);
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
  clearAuthError();
  const emailInput = document.getElementById("authEmailInput");
  const email = emailInput ? emailInput.value.trim() : "";
  if (!email) return;

  try {
    await requestEmailOtp(email);
    if (typeof showToast === "function") showToast(`Resent new 6-digit code to ${email}`, "info");
  } catch (err) {
    showAuthError(`Resend error: ${err.message || String(err)}`);
  }
}

async function executeGoogleAuth(e) {
  if (e) {
    if (typeof e.preventDefault === "function") e.preventDefault();
    if (typeof e.stopPropagation === "function") e.stopPropagation();
  }
  clearAuthError();
  const googleBtn = document.getElementById("authGoogleBtn");
  if (googleBtn) {
    googleBtn.disabled = true;
    googleBtn.style.opacity = "0.7";
  }
  try {
    if (typeof showToast === "function") showToast("Connecting to Google...", "info");
    const data = await (typeof signInWithGoogle === "function" ? signInWithGoogle() : window.signInWithGoogle?.());
    if (data && data.url) {
      window.location.href = data.url;
    }
  } catch (err) {
    console.error("Google login error:", err);
    showAuthError(`Google Auth Error: ${err.message || String(err)}`);
    if (typeof showToast === "function") showToast(`Google Auth Error: ${err.message || String(err)}`, "error");
  } finally {
    if (googleBtn) {
      googleBtn.disabled = false;
      googleBtn.style.opacity = "1";
    }
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

async function handleManualSync() {
  const user = typeof getSupabaseUser === "function" ? await getSupabaseUser() : null;
  if (!user || !user.email) {
    if (typeof showToast === "function") {
      showToast("🔑 Please sign in with your email & password first to sync cloud data.", "info");
    }
    openSupabaseAuthModal();
    return;
  }

  if (typeof showToast === "function") showToast("🔄 Syncing with Supabase Cloud...", "info");

  try {
    const success = (typeof SyncEngine !== "undefined" && typeof SyncEngine.triggerSync === "function")
      ? await SyncEngine.triggerSync()
      : false;
    closeSupabaseAuthModal();
    if (success) {
      if (typeof showToast === "function") showToast("⚡ Cloud sync completed successfully!", "success");
    } else {
      if (typeof showToast === "function") showToast("⚠️ Cloud sync did not complete. Please retry.", "error");
    }
  } catch (err) {
    console.error("Sync error:", err);
    closeSupabaseAuthModal();
    if (typeof showToast === "function") showToast(`⚠️ Sync Error: ${err.message || String(err)}`, "error");
  }
}

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
      if (typeof updateAuthUI === "function") updateAuthUI(userObj);
      if (userObj?.email) {
        if (typeof triggerBackgroundSync === "function") triggerBackgroundSync();
      }
    }).catch(() => {});
  }

  if (typeof subscribeToAuthChanges === "function") {
    subscribeToAuthChanges((event, session) => {
      const userObj = session?.user;
      if (typeof updateAuthUI === "function") updateAuthUI(userObj);

      if (userObj) {
        if (typeof showToast === "function" && event === "SIGNED_IN") {
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

if (typeof window !== "undefined") {
  window.handleSignOut = handleSignOut;
  window.openSupabaseAuthModal = openSupabaseAuthModal;
  window.closeSupabaseAuthModal = closeSupabaseAuthModal;
  window.updateAuthUI = updateAuthUI;
  window.switchAuthMode = switchAuthMode;
  window.togglePasswordVisibility = togglePasswordVisibility;
  window.handleAuthFormSubmit = handleAuthFormSubmit;
  window.handleVerifyOtp = handleVerifyOtp;
  window.handleResendOtp = handleResendOtp;
  window.showAuthError = showAuthError;
  window.clearAuthError = clearAuthError;
  window.handleManualSync = handleManualSync;
}

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

