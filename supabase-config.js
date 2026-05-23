// =====================================================================
// ARTISAN ROAST - SUPABASE CONFIGURATION
// =====================================================================
// You can hardcode your Supabase URL and Anon Key here, or use the 
// built-in interactive setup dashboard on the webpage to paste them safely.

const DEFAULT_SUPABASE_URL = "https://pjpsfxqblrazjschnisu.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqcHNmeHFibHJhempzY2huaXN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0NzI4NTYsImV4cCI6MjA5NTA0ODg1Nn0.h4v2hmdcRqUln1bjlqYPc-exksaJGeL9dxNy4WzTAjU";

// 1. Resolve credentials (hardcoded config or localStorage override)
const storedUrl = localStorage.getItem("supabase_url");
const storedKey = localStorage.getItem("supabase_anon_key");

const activeUrl = (storedUrl && storedUrl.trim() !== "") ? storedUrl.trim() : DEFAULT_SUPABASE_URL;
const activeKey = (storedKey && storedKey.trim() !== "") ? storedKey.trim() : DEFAULT_SUPABASE_ANON_KEY;

// Helper to check if credentials are still placeholder strings
function checkIsPlaceholder(url, key) {
    return !url || 
           url === "YOUR_SUPABASE_URL" || 
           url.trim() === "" || 
           !key || 
           key === "YOUR_SUPABASE_ANON_KEY" || 
           key.trim() === "";
}

const isConfigured = !checkIsPlaceholder(activeUrl, activeKey);
let supabaseClient = null;

// 2. Initialize the Supabase Client if configured and CDN is loaded
if (isConfigured && typeof window.supabase !== 'undefined') {
    try {
        supabaseClient = window.supabase.createClient(activeUrl, activeKey, {
            auth: {
                persistSession: true,
                autoRefreshToken: true
            }
        });
        console.log("☕ Artisan Roast Backend: Supabase initialized successfully.");
    } catch (error) {
        console.error("❌ Artisan Roast Backend: Failed to initialize Supabase client.", error);
    }
} else if (!isConfigured) {
    console.log("ℹ️ Artisan Roast Backend: Supabase is waiting for connection parameters. Open the Account Panel to configure.");
}

// 3. Export configuration helpers globally
window.supabaseConfig = {
    url: activeUrl,
    key: activeKey,
    isConfigured: isConfigured,
    hasOverride: !!(storedUrl && storedKey),
    saveConfig: (url, key) => {
        if (!url || !key) return false;
        localStorage.setItem("supabase_url", url.trim());
        localStorage.setItem("supabase_anon_key", key.trim());
        location.reload();
        return true;
    },
    clearConfig: () => {
        localStorage.removeItem("supabase_url");
        localStorage.removeItem("supabase_anon_key");
        location.reload();
    }
};

window.supabaseClient = supabaseClient;
