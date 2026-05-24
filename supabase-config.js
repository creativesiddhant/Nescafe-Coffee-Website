// =====================================================================
// NESCAFÉ ROAST - SUPABASE CONFIGURATION
// =====================================================================
// You can hardcode your Supabase URL and Anon Key here, or use the 
// built-in interactive setup dashboard on the webpage to paste them safely.

const DEFAULT_SUPABASE_URL = "https://pjpsfxqblrazjschnisu.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqcHNmeHFibHJhempzY2huaXN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0NzI4NTYsImV4cCI6MjA5NTA0ODg1Nn0.h4v2hmdcRqUln1bjlqYPc-exksaJGeL9dxNy4WzTAjU";

// Safe Storage Helpers to prevent SecurityErrors on file:// protocol
function safeGetItem(key) {
    try {
        return localStorage.getItem(key);
    } catch (error) {
        console.warn("☕ Nescafe Config: Local storage read restricted. Falling back.", error);
        return null;
    }
}

function safeSetItem(key, value) {
    try {
        localStorage.setItem(key, value);
        return true;
    } catch (error) {
        console.warn("☕ Nescafe Config: Local storage write restricted.", error);
        return false;
    }
}

function safeRemoveItem(key) {
    try {
        localStorage.removeItem(key);
        return true;
    } catch (error) {
        console.warn("☕ Nescafe Config: Local storage deletion restricted.", error);
        return false;
    }
}

// Helper to check if credentials are still placeholder strings
function checkIsPlaceholder(url, key) {
    return !url || 
           url.includes("YOUR_SUPABASE_URL") || 
           url.trim() === "" || 
           !key || 
           key.includes("YOUR_SUPABASE_ANON_KEY") || 
           key.trim() === "";
}

const defaultIsPlaceholder = checkIsPlaceholder(DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_ANON_KEY);

// 1. Resolve credentials (hardcoded config or localStorage override)
const storedUrl = safeGetItem("supabase_url");
const storedKey = safeGetItem("supabase_anon_key");

const storedIsPlaceholder = checkIsPlaceholder(storedUrl, storedKey);

// Self-healing: if defaults are valid, always ignore stored values if they are placeholders
let activeUrl = DEFAULT_SUPABASE_URL;
let activeKey = DEFAULT_SUPABASE_ANON_KEY;

if (defaultIsPlaceholder && storedUrl && storedKey && !storedIsPlaceholder) {
    activeUrl = storedUrl.trim();
    activeKey = storedKey.trim();
} else if (!defaultIsPlaceholder && storedUrl && storedKey && !storedIsPlaceholder) {
    // If both default and stored are valid non-placeholders, let stored take precedence as developer override
    activeUrl = storedUrl.trim();
    activeKey = storedKey.trim();
}

const isConfigured = !checkIsPlaceholder(activeUrl, activeKey);
let supabaseClient = null;

// Resolve the global supabase object (checking window and standard global namespace)
const globalSupabase = typeof window.supabase !== 'undefined' ? window.supabase : (typeof supabase !== 'undefined' ? supabase : null);

// 2. Initialize the Supabase Client if configured and CDN is loaded
if (isConfigured && globalSupabase) {
    try {
        // Safe check for custom session storage engine (supports window.name persistence for file:// sandbox)
        let storageEngine = null;
        try {
            localStorage.setItem("sb_persistence_test", "1");
            localStorage.removeItem("sb_persistence_test");
            storageEngine = localStorage;
        } catch (storageError) {
            console.log("ℹ️ Nescafe Roast: Local storage is sandboxed. Loading window.name session vault for cross-page persistence.");
            
            const getVault = () => {
                try {
                    // Try to parse the window.name as JSON
                    return JSON.parse(window.name || '{}');
                } catch {
                    // If parsing fails, reset name and return empty
                    return {};
                }
            };
            
            const setVault = (val) => {
                try {
                    window.name = JSON.stringify(val);
                } catch (e) {
                    console.error("Failed to write to window.name vault", e);
                }
            };

            storageEngine = {
                getItem: (k) => {
                    const vault = getVault();
                    return vault[k] || null;
                },
                setItem: (k, v) => {
                    const vault = getVault();
                    vault[k] = v;
                    setVault(vault);
                },
                removeItem: (k) => {
                    const vault = getVault();
                    delete vault[k];
                    setVault(vault);
                }
            };
        }

        supabaseClient = globalSupabase.createClient(activeUrl, activeKey, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                storage: storageEngine
            }
        });
        console.log("☕ Nescafe Roast Backend: Supabase initialized successfully.");
    } catch (error) {
        console.error("❌ Nescafe Roast Backend: Failed to initialize Supabase client.", error);
    }
} else {
    if (!isConfigured) {
        console.log("ℹ️ Nescafe Roast Backend: Supabase is waiting for connection parameters. Open the Account Panel to configure.");
    } else if (!globalSupabase) {
        console.warn("⚠️ Nescafe Roast Backend: Supabase SDK script has not finished loading.");
    }
}

// 3. Export configuration helpers globally
window.supabaseConfig = {
    url: activeUrl,
    key: activeKey,
    isConfigured: isConfigured,
    hasOverride: !!(storedUrl && storedKey && !storedIsPlaceholder),
    saveConfig: (url, key) => {
        if (!url || !key) return false;
        safeSetItem("supabase_url", url.trim());
        safeSetItem("supabase_anon_key", key.trim());
        location.reload();
        return true;
    },
    clearConfig: () => {
        safeRemoveItem("supabase_url");
        safeRemoveItem("supabase_anon_key");
        location.reload();
    }
};

window.supabaseClient = supabaseClient;
