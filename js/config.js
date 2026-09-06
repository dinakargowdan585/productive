/* Application Global Configuration & Supabase Environment Fallbacks */

window.SUPABASE_URL = (typeof localStorage !== "undefined" && localStorage.getItem("SUPABASE_URL")) || window.SUPABASE_URL || "https://tezokbquswkbuudyrsuq.supabase.co";
window.SUPABASE_ANON_KEY = (typeof localStorage !== "undefined" && localStorage.getItem("SUPABASE_ANON_KEY")) || window.SUPABASE_ANON_KEY || "sb_publishable__L7MiJgwGWZC8EOdUc8C7g_bTWfCJ9B";
