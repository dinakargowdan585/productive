/* Application Global Configuration & Supabase Environment Fallbacks */

window.SUPABASE_URL = localStorage.getItem("SUPABASE_URL") || window.SUPABASE_URL || "https://tezokbquswkbuudyrsuq.supabase.co";
window.SUPABASE_ANON_KEY = localStorage.getItem("SUPABASE_ANON_KEY") || window.SUPABASE_ANON_KEY || "";
