/* Supabase Cloud Client Integration, Auth State & Email OTP Controller */

let supabaseClient = null;

function getSupabaseConfig() {
  const url = (localStorage.getItem("SUPABASE_URL") || window.SUPABASE_URL || "").trim();
  const key = (localStorage.getItem("SUPABASE_ANON_KEY") || window.SUPABASE_ANON_KEY || "").trim();
  return { url, key };
}

function saveSupabaseCredentials(url, key) {
  if (url) {
    const cleanUrl = url.trim();
    localStorage.setItem("SUPABASE_URL", cleanUrl);
    window.SUPABASE_URL = cleanUrl;
  }
  if (key) {
    const cleanKey = key.trim();
    localStorage.setItem("SUPABASE_ANON_KEY", cleanKey);
    window.SUPABASE_ANON_KEY = cleanKey;
  }
  initSupabaseClient();
}

function initSupabaseClient() {
  const { url, key } = getSupabaseConfig();
  console.log("[Supabase] library:", !!(window.supabase && typeof window.supabase.createClient === "function"));

  if (url && key && window.supabase && typeof window.supabase.createClient === "function") {
    try {
      supabaseClient = window.supabase.createClient(url, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      });
      console.log("[Supabase] client:", !!supabaseClient);
      console.log("⚡ Supabase Client initialized successfully.");
      return supabaseClient;
    } catch (err) {
      console.error("Failed to initialize Supabase client:", err);
    }
  }
  supabaseClient = null;
  console.log("[Supabase] client:", false);
  return null;
}

function getSupabase() {
  if (!supabaseClient) {
    initSupabaseClient();
  }
  return supabaseClient;
}

function ensureSupabaseConfigured() {
  const client = getSupabase();
  if (!client) {
    if (typeof openSupabaseAuthModal === "function") openSupabaseAuthModal();
    if (typeof showToast === "function") {
      showToast("🔑 Please enter your Supabase Anon Key below to connect.", "info");
    }
    return false;
  }
  return true;
}

async function getSupabaseUser() {
  const client = getSupabase();
  if (!client) return null;
  try {
    const { data: { user } } = await client.auth.getUser();
    return user;
  } catch (e) {
    return null;
  }
}

async function getSupabaseSession() {
  const client = getSupabase();
  if (!client) return null;
  try {
    const { data: { session } } = await client.auth.getSession();
    return session;
  } catch (e) {
    return null;
  }
}

async function requestEmailOtp(email) {
  if (!ensureSupabaseConfigured()) return null;
  const client = getSupabase();
  const cleanEmail = (email || "").trim();
  if (!cleanEmail || !cleanEmail.includes("@")) {
    throw new Error("Please enter a valid email address.");
  }

  console.log("[Auth] Send OTP clicked");
  console.log("[Auth] Email validated");
  console.log("[Auth] Requesting OTP");

  const { data, error } = await client.auth.signInWithOtp({
    email: cleanEmail
  });

  if (error) {
    console.error("[Auth] OTP request failed:", error.message || error);
    throw error;
  }

  console.log("[Auth] OTP request completed", { success: true });
  return data;
}

async function verifyEmailOtp(email, token) {
  if (!ensureSupabaseConfigured()) return null;
  const client = getSupabase();
  const cleanEmail = (email || "").trim();
  const cleanToken = (token || "").trim();

  if (!cleanEmail || !cleanToken) {
    throw new Error("Please enter both email and 6-digit OTP code.");
  }

  console.log("[Auth] Verifying OTP code");

  const { data, error } = await client.auth.verifyOtp({
    email: cleanEmail,
    token: cleanToken,
    type: 'email'
  });

  if (error) {
    console.error("[Auth] OTP verification failed:", error.message || error);
    throw error;
  }

  console.log("[Auth] OTP verification completed", { success: true });
  return data;
}

async function signUpWithEmail(email, password, displayName = "") {
  if (!ensureSupabaseConfigured()) return null;
  const client = getSupabase();
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName }
    }
  });
  if (error) throw error;
  return data;
}

async function signInWithEmail(email, password) {
  if (!ensureSupabaseConfigured()) return null;
  const client = getSupabase();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

async function signInWithGoogle() {
  if (!ensureSupabaseConfigured()) return null;
  const client = getSupabase();
  const { data, error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin + window.location.pathname
    }
  });
  if (error) throw error;
  return data;
}

async function signOutUser() {
  const client = getSupabase();
  if (!client) return;
  const user = await getSupabaseUser();
  if (user && typeof SyncQueue !== "undefined" && typeof SyncQueue.clearUserQueue === "function") {
    await SyncQueue.clearUserQueue(user.id);
  }
  const { error } = await client.auth.signOut();
  if (error) throw error;
}

function subscribeToAuthChanges(callback) {
  const client = getSupabase();
  if (!client) return null;
  return client.auth.onAuthStateChange((event, session) => {
    if (typeof callback === "function") {
      callback(event, session);
    }
  });
}

let realtimeChannel = null;

async function checkSupabaseConnectionHealth() {
  const client = getSupabase();
  if (!client) {
    return {
      connected: false,
      message: "Supabase client not initialized. Check URL and Anon Key."
    };
  }

  try {
    const { data, error } = await client.from("notes").select("id").limit(1);
    if (error && error.code !== "PGRST116" && error.code !== "42P01") {
      console.warn("[Supabase Health] Query warning:", error);
    }

    return {
      connected: true,
      message: "🟢 Connected to Supabase Cloud API!"
    };
  } catch (err) {
    return {
      connected: false,
      message: "🔴 Connection error: " + (err.message || err)
    };
  }
}

function setupRealtimeSync() {
  const client = getSupabase();
  if (!client || realtimeChannel) return;

  try {
    realtimeChannel = client
      .channel('public-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public' }, async (payload) => {
        console.log("⚡ Realtime DB change received:", payload);
        if (typeof loadAllFromRepositoriesIntoMemory === "function") {
          await loadAllFromRepositoriesIntoMemory();
        }
        if (typeof render === "function") render();
        if (typeof renderAnalytics === "function") renderAnalytics();
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log("🟢 Supabase Realtime WebSocket Subscribed.");
        }
      });
  } catch (e) {
    console.warn("Realtime setup notice:", e);
  }
}

// Auto-initialize client on load
if (typeof window !== "undefined") {
  window.addEventListener("DOMContentLoaded", () => {
    const client = initSupabaseClient();
    if (client) {
      setupRealtimeSync();
    }
  });
}

