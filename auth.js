// =====================================================================
// NESCAFÉ ROAST - AUTHENTICATION & DATABASE CONTROLLER
// =====================================================================
// This script manages authentication state, database operations, and
// dynamically renders the beautiful glassmorphic Auth Modal and Account Drawer.

function initializeAuthSystem() {
    // Check if we are on the dedicated login page to avoid rendering duplicate elements
    const isLoginPage = (function() {
        const path = window.location.pathname.toLowerCase();
        const segments = path.split('/').filter(Boolean);
        const lastSegment = segments[segments.length - 1] || '';
        return lastSegment === 'login' || lastSegment === 'login.html';
    })();


    // 1. DYNAMICALLY INJECT CSS STYLES FOR AUTH & DRAWER
    injectAuthStyles();

    // 2. INITIALIZE ELEMENT CONTAINER HOOKS AND STATE
    let currentUser = null;
    let userProfile = null;

    // 3. RENDER THE INTERACTIVE MODALS AND DRAWERS ONTO THE PAGE (Skip on dedicated login page)
    if (!isLoginPage) {
        renderAuthModal();
        renderAccountDrawer();
    }
    renderHeaderControls();


    // 4. BIND EVENT LISTENERS FOR MODALS
    bindAuthEvents();

    // 5. ATTACH TO SUPABASE AUTH STATE CHANGES (IF INITIALIZED)
    const supabase = window.supabaseClient;
    if (supabase) {
        supabase.auth.onAuthStateChange(async (event, session) => {
            console.log(`☕ Auth State Change: ${event}`);
            if (session) {
                currentUser = session.user;
                // If on login page, redirect home instantly
                if (isLoginPage) {
                    window.location.href = 'index.html';
                    return;
                }
                // Fetch profile metadata
                await fetchProfileAndReservations();
            } else {
                currentUser = null;
                userProfile = null;
                updateHeaderAndDrawerState(false);
            }
        });

        // Initial session check
        supabase.auth.getSession().then(async ({ data: { session } }) => {
            if (session) {
                currentUser = session.user;
                if (isLoginPage) {
                    window.location.href = 'index.html';
                    return;
                }
                await fetchProfileAndReservations();
            } else {
                updateHeaderAndDrawerState(false);
            }
        });
    } else {
        // If not configured, update UI to reflect unconfigured state
        updateHeaderAndDrawerState(false);
    }

    // 6. DB OPERATION: FETCH PROFILE AND USER RESERVATIONS
    async function fetchProfileAndReservations() {
        if (!supabase || !currentUser) return;

        try {
            // Fetch profile
            const { data: profile, error: profileErr } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', currentUser.id)
                .single();

            if (profile) {
                userProfile = profile;
            } else if (profileErr && profileErr.code !== 'PGRST116') {
                console.error("Error loading user profile:", profileErr);
            }

            // Update UI with authenticated state
            updateHeaderAndDrawerState(true);
            
            // Fetch reservations list
            await refreshReservationsList();

        } catch (err) {
            console.error("Database fetch exception:", err);
        }
    }

    // Refresh the list of user reservations from Supabase
    async function refreshReservationsList() {
        const reservationsListContainer = document.getElementById('drawer-reservations-list');
        if (!reservationsListContainer || !supabase || !currentUser) return;

        // Show loading state inside the history panel
        reservationsListContainer.innerHTML = `
            <div class="flex flex-col items-center justify-center py-10 text-on-surface-variant/60">
                <div class="animate-spin rounded-full h-8 w-8 border-2 border-tertiary border-t-transparent mb-3"></div>
                <span class="font-body-md text-sm">Retrieving your cellar records...</span>
            </div>
        `;

        const { data: reservations, error } = await supabase
            .from('reservations')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false });

        if (error) {
            console.error("Failed to load reservations:", error);
            reservationsListContainer.innerHTML = `
                <div class="text-center p-4 border border-error/20 rounded bg-error-container/20 text-on-error-container text-sm">
                    Unable to load reservations. Please ensure the SQL schema is created in Supabase.
                </div>
            `;
            return;
        }

        if (!reservations || reservations.length === 0) {
            reservationsListContainer.innerHTML = `
                <div class="text-center py-12 px-6 border border-outline-variant/20 rounded-xl bg-surface-container-low/50">
                    <span class="material-symbols-outlined text-4xl text-on-surface-variant/30 mb-3">explore</span>
                    <p class="font-headline-sm text-base text-on-background mb-2">Cellar is Empty</p>
                    <p class="font-body-md text-xs text-on-surface-variant/80 max-w-[240px] mx-auto mb-4">
                        Secure your allocation of our high-altitude single origin beans today.
                    </p>
                    <button onclick="window.closeAccountDrawer(); setTimeout(() => { window.lenis?.scrollTo('#collection'); }, 200);" class="border border-tertiary/40 hover:border-tertiary text-tertiary text-xs font-label-caps px-4 py-2 rounded transition-colors uppercase">
                        Browse Beans
                    </button>
                </div>
            `;
            return;
        }

        // Render reservations list
        let htmlContent = '<div class="space-y-4 max-h-[40vh] overflow-y-auto pr-1">';
        reservations.forEach(res => {
            const formattedDate = new Date(res.created_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            });
            const blendLabel = res.blend.toUpperCase();
            
            // Badges
            let statusBadge = '';
            if (res.status === 'confirmed') {
                statusBadge = '<span class="bg-emerald-950/80 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">Confirmed</span>';
            } else if (res.status === 'pending') {
                statusBadge = '<span class="bg-amber-950/80 text-amber-400 border border-amber-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">Pending</span>';
            } else {
                statusBadge = `<span class="bg-surface-container-highest text-on-surface-variant border border-outline-variant/30 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">${res.status}</span>`;
            }

            htmlContent += `
                <div class="glass-panel gold-border p-4 rounded-xl flex flex-col gap-2 hover:bg-surface-container/50 transition-colors">
                    <div class="flex justify-between items-start">
                        <div>
                            <div class="font-headline-sm text-sm text-on-background font-semibold">${blendLabel}</div>
                            <div class="text-[11px] text-on-surface-variant/60 font-body-md mt-0.5">${formattedDate}</div>
                        </div>
                        ${statusBadge}
                    </div>
                    <div class="flex justify-between items-center border-t border-outline-variant/10 pt-2 mt-1 text-xs font-body-md">
                        <span class="text-on-surface-variant">Qty: <strong class="text-on-background font-semibold">${res.quantity} ${res.quantity === 1 ? 'Bag' : 'Bags'}</strong></span>
                        <span class="text-tertiary font-bold">$${Number(res.total_price).toFixed(2)}</span>
                    </div>
                </div>
            `;
        });
        htmlContent += '</div>';
        reservationsListContainer.innerHTML = htmlContent;
    }

    // 7. PUBLIC INTERFACES EXPOSED TO CLIENT CODE
    window.openAuthModal = function(defaultTab = 'login', customAlertText = '') {
        const modal = document.getElementById('auth-modal');
        const alertBox = document.getElementById('auth-modal-alert');
        
        if (alertBox) {
            if (customAlertText) {
                alertBox.textContent = customAlertText;
                alertBox.classList.remove('hidden');
            } else {
                alertBox.classList.add('hidden');
            }
        }

        switchTab(defaultTab);

        if (modal) {
            modal.classList.remove('opacity-0', 'scale-95', 'pointer-events-none');
            modal.classList.add('opacity-100', 'scale-100');
            window.lenis?.stop(); // lock scroll
        } else if (isLoginPage) {
            // We are on the dedicated login page - scroll smoothly to the login card
            const mainCard = document.querySelector('main .glass-panel') || document.querySelector('main');
            if (mainCard) {
                mainCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    };

    window.closeAuthModal = function() {
        const modal = document.getElementById('auth-modal');
        if (modal) {
            modal.classList.remove('opacity-100', 'scale-100');
            modal.classList.add('opacity-0', 'scale-95', 'pointer-events-none');
            window.lenis?.start(); // unlock scroll
        }
    };

    window.openAccountDrawer = function() {
        const drawer = document.getElementById('account-drawer');
        const overlay = document.getElementById('drawer-overlay');
        
        if (drawer && overlay) {
            overlay.classList.remove('opacity-0', 'pointer-events-none');
            overlay.classList.add('opacity-100');
            drawer.classList.remove('translate-x-full');
            
            // If logged in, reload reservations list
            if (currentUser) {
                refreshReservationsList();
            }
            window.lenis?.stop(); // lock scroll
        }
    };

    window.closeAccountDrawer = function() {
        const drawer = document.getElementById('account-drawer');
        const overlay = document.getElementById('drawer-overlay');
        
        if (drawer && overlay) {
            overlay.classList.remove('opacity-100');
            overlay.classList.add('opacity-0', 'pointer-events-none');
            drawer.classList.add('translate-x-full');
            window.lenis?.start(); // unlock scroll
        }
    };

    // Save a reservation to Supabase database
    window.submitAuthenticatedReservation = async function(blendName, quantity, totalPrice) {
        if (!supabase) {
            console.error("Supabase client is not initialized.");
            return { success: false, error: "Database not connected." };
        }

        if (!currentUser) {
            // Close reservation modal and open auth modal with customized alert
            window.closeReservationModal();
            setTimeout(() => {
                window.openAuthModal('register', 'Secure Your Allocation: Please create an account or sign in to reserve your batch.');
            }, 350);
            return { success: false, pending: true };
        }

        try {
            const { data, error } = await supabase
                .from('reservations')
                .insert([
                    {
                        user_id: currentUser.id,
                        blend: blendName,
                        quantity: parseInt(quantity),
                        total_price: parseFloat(totalPrice),
                        status: 'pending'
                    }
                ])
                .select()
                .single();

            if (error) {
                console.error("Error inserting reservation:", error);
                return { success: false, error: error.message };
            }

            // Success: refresh list in background
            refreshReservationsList();
            return { success: true, id: data.id };
        } catch (err) {
            console.error("Reservation execution error:", err);
            return { success: false, error: err.message };
        }
    };

    // Helper to check current session from outer files
    window.checkUserAuth = function() {
        return {
            isAuthenticated: !!currentUser,
            user: currentUser,
            profile: userProfile
        };
    };

    // 8. HEADER & DRAWER UI CONTROLLER
    function updateHeaderAndDrawerState(isAuth) {
        const desktopContainers = document.querySelectorAll('.auth-header-container');
        const mobileDrawerContainers = document.querySelectorAll('.auth-mobile-container');
        
        const drawerProfileSection = document.getElementById('drawer-profile-section');
        const drawerReservationsSection = document.getElementById('drawer-reservations-section');
        const drawerAuthPrompt = document.getElementById('drawer-auth-prompt');

        const userName = userProfile?.full_name || currentUser?.user_metadata?.full_name || 'Connoisseur';
        const userEmail = currentUser?.email || '';

        // Inject standard header triggers
        desktopContainers.forEach(container => {
            if (isAuth) {
                container.innerHTML = `
                    <div class="flex items-center gap-3">
                        <button onclick="window.openAccountDrawer()" class="flex items-center gap-2 border border-outline-variant/40 hover:border-tertiary text-on-surface-variant hover:text-tertiary px-4 py-2 rounded font-label-caps text-label-caps transition-all duration-300">
                            <span class="material-symbols-outlined text-[18px]">account_circle</span>
                            ${userName.split(' ')[0]}
                        </button>
                        <button id="header-logout-btn" class="border border-outline-variant/30 hover:border-error text-on-surface-variant hover:text-error px-4 py-2 rounded font-label-caps text-label-caps transition-all duration-300 bg-transparent">
                            Logout
                        </button>
                    </div>
                `;
                // Add event listener for direct logout
                container.querySelector('#header-logout-btn')?.addEventListener('click', async () => {
                    if (window.supabaseClient) {
                        await window.supabaseClient.auth.signOut();
                    }
                });
            } else {
                container.innerHTML = `
                    <a href="login.html" onclick="if(window.openAuthModal){window.openAuthModal('login'); return false;}" class="border border-tertiary text-tertiary px-5 py-2 rounded font-label-caps text-label-caps hover:bg-tertiary hover:text-on-tertiary transition-all duration-300 text-center inline-block cursor-pointer">
                        Sign In
                    </a>
                `;
            }

        });

        // Inject standard mobile drawer triggers
        mobileDrawerContainers.forEach(container => {
            if (isAuth) {
                container.innerHTML = `
                    <div class="flex flex-col gap-3 w-full max-w-[200px] items-center">
                        <button onclick="toggleMobileMenu(false); setTimeout(window.openAccountDrawer, 350)" class="flex items-center justify-center gap-2 border border-tertiary text-tertiary px-6 py-2.5 rounded font-label-caps text-label-caps w-full">
                            <span class="material-symbols-outlined text-[18px]">account_circle</span>
                            My Account
                        </button>
                        <button id="mobile-logout-btn" class="border border-outline-variant/30 hover:border-error text-on-surface-variant hover:text-error px-6 py-2.5 rounded font-label-caps text-label-caps w-full bg-transparent">
                            Logout
                        </button>
                    </div>
                `;
                container.querySelector('#mobile-logout-btn')?.addEventListener('click', async () => {
                    if (window.supabaseClient) {
                        toggleMobileMenu(false);
                        await window.supabaseClient.auth.signOut();
                    }
                });
            } else {
                container.innerHTML = `
                    <a href="login.html" onclick="if(window.toggleMobileMenu){toggleMobileMenu(false);} if(window.openAuthModal){setTimeout(() => { window.openAuthModal('login'); }, 350); return false;}" class="border border-tertiary text-tertiary px-8 py-2.5 rounded font-label-caps text-label-caps hover:bg-tertiary hover:text-on-tertiary transition-all duration-300 w-full max-w-[200px] text-center inline-block cursor-pointer">
                        Sign In
                    </a>
                `;
            }
        });

        // Update Account Drawer details
        if (isAuth) {
            if (drawerProfileSection) {
                drawerProfileSection.innerHTML = `
                    <div class="flex items-center gap-4 bg-surface-container-low/50 gold-border p-4 rounded-xl mb-6">
                        <div class="w-12 h-12 rounded-full bg-tertiary/20 text-tertiary border border-tertiary flex items-center justify-center font-headline-sm text-xl font-bold uppercase select-none">
                            ${userName.charAt(0)}
                        </div>
                        <div class="flex-1 min-w-0">
                            <h4 class="font-headline-sm text-lg text-on-background font-semibold truncate">${userName}</h4>
                            <p class="font-body-md text-xs text-on-surface-variant/60 truncate">${userEmail}</p>
                        </div>
                    </div>
                `;
                drawerProfileSection.classList.remove('hidden');
            }
            if (drawerReservationsSection) drawerReservationsSection.classList.remove('hidden');
            if (drawerAuthPrompt) drawerAuthPrompt.classList.add('hidden');
        } else {
            if (drawerProfileSection) drawerProfileSection.classList.add('hidden');
            if (drawerReservationsSection) drawerReservationsSection.classList.add('hidden');
            if (drawerAuthPrompt) drawerAuthPrompt.classList.remove('hidden');
        }
    }

    // Tab Switcher inside Auth Modal
    function switchTab(tabName) {
        const tabLoginBtn = document.getElementById('tab-login-btn');
        const tabRegisterBtn = document.getElementById('tab-register-btn');
        const formLogin = document.getElementById('auth-form-login');
        const formRegister = document.getElementById('auth-form-register');
        const modalTitle = document.getElementById('auth-modal-title');

        if (tabName === 'login') {
            tabLoginBtn?.classList.add('border-tertiary', 'text-tertiary');
            tabLoginBtn?.classList.remove('border-outline-variant/30', 'text-on-surface-variant');
            tabRegisterBtn?.classList.add('border-outline-variant/30', 'text-on-surface-variant');
            tabRegisterBtn?.classList.remove('border-tertiary', 'text-tertiary');
            
            formLogin?.classList.remove('hidden');
            formRegister?.classList.add('hidden');
            if (modalTitle) modalTitle.textContent = "Sign In to Your Cellar";
        } else {
            tabRegisterBtn?.classList.add('border-tertiary', 'text-tertiary');
            tabRegisterBtn?.classList.remove('border-outline-variant/30', 'text-on-surface-variant');
            tabLoginBtn?.classList.add('border-outline-variant/30', 'text-on-surface-variant');
            tabLoginBtn?.classList.remove('border-tertiary', 'text-tertiary');
            
            formRegister?.classList.remove('hidden');
            formLogin?.classList.add('hidden');
            if (modalTitle) modalTitle.textContent = "Join the Nescafe Guild";
        }
    }

    // 9. EVENT LISTENERS BINDING
    function bindAuthEvents() {
        // Tab click events
        document.getElementById('tab-login-btn')?.addEventListener('click', () => switchTab('login'));
        document.getElementById('tab-register-btn')?.addEventListener('click', () => switchTab('register'));

        // Sign Up submission
        document.getElementById('auth-form-register')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const fullName = document.getElementById('reg-name').value;
            const email = document.getElementById('reg-email').value;
            const password = document.getElementById('reg-password').value;
            const submitBtn = e.target.querySelector('button[type="submit"]');
            const origText = submitBtn.textContent;
            
            const errEl = document.getElementById('reg-error');
            if (errEl) {
                errEl.classList.add('hidden');
                errEl.className = "text-center p-3 border border-error/20 rounded bg-error-container/20 text-on-error-container text-xs";
            }

            if (!supabase) {
                if (errEl) {
                    errEl.textContent = "Error: Database integration is waiting for configuration.";
                    errEl.classList.remove('hidden');
                }
                return;
            }

            submitBtn.disabled = true;
            submitBtn.textContent = "Registering...";

            // Dynamically show success screen inside the modal or card
            function showSuccessScreen(title, message, autoRedirect = false) {
                const container = e.target.closest('.glass-panel') || document.body;
                
                // Hide forms, titles, tab headers, alerts
                container.querySelectorAll('form, .grid, h3, #auth-modal-alert').forEach(el => {
                    el.classList.add('hidden');
                });
                
                let successStage = container.querySelector('#auth-stage-success');
                if (!successStage) {
                    successStage = document.createElement('div');
                    successStage.id = "auth-stage-success";
                    successStage.className = "flex flex-col items-center text-center py-6 fade-in-up w-full";
                    container.appendChild(successStage);
                } else {
                    successStage.classList.remove('hidden');
                }
                
                successStage.innerHTML = `
                    <div class="w-20 h-20 rounded-full bg-primary-container/40 border border-tertiary flex items-center justify-center text-tertiary mb-6 float-anim">
                        <span class="material-symbols-outlined text-5xl">verified</span>
                    </div>
                    <h3 class="font-headline-sm text-2xl text-on-background mb-3">${title}</h3>
                    <p class="font-body-md text-sm text-on-surface-variant max-w-sm mb-6 leading-relaxed">
                        ${message}
                    </p>
                    <button type="button" onclick="window.location.href='index.html'" class="border border-outline-variant/50 text-on-background hover:border-tertiary hover:text-tertiary px-8 py-3 rounded font-label-caps transition-colors uppercase text-xs tracking-wider focus:outline-none">
                        Return Home
                    </button>
                `;
                
                // Trigger transition
                setTimeout(() => {
                    successStage.classList.add('visible');
                    successStage.classList.remove('opacity-0', 'translate-y-8');
                }, 50);

                if (autoRedirect) {
                    setTimeout(() => {
                        window.location.href = 'index.html';
                    }, 2500);
                }
            }

            try {
                const { data, error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            full_name: fullName
                        }
                    }
                });

                if (error) throw error;

                // Check if email confirmation is required
                if (data.user && data.session === null) {
                    showSuccessScreen(
                        "Guild Enrollment Secured",
                        "Your connoisseur account has been successfully created! A verification link has been sent to your email inbox. Please click the link to confirm your account and access your cellar."
                    );
                } else {
                    showSuccessScreen(
                        "Welcome to the Guild!",
                        "Your account has been successfully created and you are now logged in! Redirecting to home...",
                        true
                    );
                }
            } catch (err) {
                console.error("Sign up error:", err);
                alert(`Sign Up failed: ${err.message}`);
                if (errEl) {
                    let errMsg = err.message || "An unexpected error occurred.";
                    if (errMsg.toLowerCase().includes("failed to fetch")) {
                        errMsg = "<strong>Network Connection Blocked:</strong><br/>Failed to connect to Supabase. If you have an ad-blocker active, please disable it.";
                        errEl.className = "p-4 border border-error/20 rounded bg-error-container/20 text-on-error-container text-xs leading-relaxed text-left";
                    }
                    errEl.innerHTML = errMsg;
                    errEl.classList.remove('hidden');
                }
                submitBtn.disabled = false;
                submitBtn.textContent = origText;
            }
        });

        // Sign In submission
        document.getElementById('auth-form-login')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('log-email').value;
            const password = document.getElementById('log-password').value;
            const submitBtn = e.target.querySelector('button[type="submit"]');
            const origText = submitBtn.textContent;
            
            const errEl = document.getElementById('log-error');
            if (errEl) {
                errEl.classList.add('hidden');
                errEl.className = "text-center p-3 border border-error/20 rounded bg-error-container/20 text-on-error-container text-xs";
            }

            if (!supabase) {
                if (errEl) {
                    errEl.textContent = "Error: Database integration is waiting for configuration.";
                    errEl.classList.remove('hidden');
                }
                return;
            }

            submitBtn.disabled = true;
            submitBtn.textContent = "Verifying Credentials...";

            try {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password
                });

                if (error) throw error;
                
                if (isLoginPage) {
                    window.location.href = 'index.html';
                } else {
                    window.closeAuthModal();
                }
            } catch (err) {
                console.error("Sign in error:", err);
                if (errEl) {
                    let errMsg = err.message || "Invalid credentials.";
                    if (errMsg.toLowerCase().includes("email not confirmed")) {
                        errMsg = `
                            <strong>Email verification pending!</strong><br/>
                            You must confirm your email before signing in. Please check your inbox.<br/>
                            <div class="mt-2 pt-2 border-t border-error/10 text-[10px] opacity-90">
                                💡 <em>To bypass this, toggle off <strong>Confirm Email</strong> in your <strong>Supabase Dashboard > Authentication > Providers > Email</strong> settings.</em>
                            </div>
                        `;
                        errEl.className = "p-4 border border-error/20 rounded bg-error-container/20 text-on-error-container text-xs leading-relaxed text-left";
                    } else if (errMsg.toLowerCase().includes("failed to fetch")) {
                        errMsg = "<strong>Connection Error:</strong><br/>Failed to connect to Supabase. If you have an ad-blocker active (e.g. uBlock Origin or Brave Shield), please disable it for this local site as it blocks API endpoints.";
                        errEl.className = "p-4 border border-error/20 rounded bg-error-container/20 text-on-error-container text-xs leading-relaxed text-left";
                    }
                    errEl.innerHTML = errMsg;
                    errEl.classList.remove('hidden');
                }
                submitBtn.disabled = false;
                submitBtn.textContent = origText;
            }
        });

        // Log out submission
        document.getElementById('drawer-logout-btn')?.addEventListener('click', async () => {
            if (supabase) {
                await supabase.auth.signOut();
            }
            window.closeAccountDrawer();
        });

        // Dynamic Supabase Setup Console submission
        document.getElementById('setup-console-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            const url = document.getElementById('setup-url').value;
            const key = document.getElementById('setup-key').value;
            
            const success = window.supabaseConfig.saveConfig(url, key);
            if (success) {
                console.log("Supabase overlay configured.");
            }
        });
        
        document.getElementById('setup-clear-btn')?.addEventListener('click', () => {
            window.supabaseConfig.clearConfig();
        });
    }

    // 10. TEMPLATES RENDERING FUNCTIONS
    function renderAuthModal() {
        if (document.getElementById('auth-modal')) return;

        const authModal = document.createElement('div');
        authModal.id = "auth-modal";
        authModal.className = "fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xl opacity-0 scale-95 pointer-events-none transition-all duration-500 p-margin-mobile";
        
        authModal.innerHTML = `
            <div class="glass-panel gold-border w-full max-w-md rounded-xl p-8 relative shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto">
                <!-- Close Button -->
                <button class="absolute top-4 right-4 text-on-surface-variant hover:text-tertiary transition-colors" onclick="window.closeAuthModal()">
                    <span class="material-symbols-outlined text-2xl">close</span>
                </button>

                <!-- Status alert box -->
                <div id="auth-modal-alert" class="hidden text-center p-3 mb-6 border border-tertiary/20 rounded bg-primary-container/20 text-tertiary text-xs leading-relaxed">
                </div>

                <div class="font-label-caps text-label-caps text-tertiary mb-2 tracking-[0.2em]">NESCAFÉ GUILD</div>
                <h3 id="auth-modal-title" class="font-headline-sm text-2xl text-on-background mb-6">Sign In to Your Cellar</h3>
                
                <!-- Tab Headers -->
                <div class="grid grid-cols-2 gap-3 mb-6">
                    <button type="button" id="tab-login-btn" class="border border-tertiary text-tertiary py-2.5 rounded text-center text-xs font-bold uppercase transition-all focus:outline-none">
                        Sign In
                    </button>
                    <button type="button" id="tab-register-btn" class="border border-outline-variant/30 text-on-surface-variant py-2.5 rounded text-center text-xs font-bold uppercase transition-all focus:outline-none">
                        Register
                    </button>
                </div>

                <!-- Sign In Form -->
                <form id="auth-form-login" class="space-y-5">
                    <div>
                        <label for="log-email" class="block font-label-caps text-xs text-on-surface-variant mb-2 tracking-wider">EMAIL ADDRESS</label>
                        <input type="email" id="log-email" required class="w-full bg-surface-container-lowest border border-outline-variant/40 rounded p-3 text-on-background placeholder:text-on-surface-variant/40 focus:border-tertiary focus:ring-1 focus:ring-tertiary focus:outline-none transition-colors" placeholder="e.g. sid@example.com">
                    </div>
                    <div>
                        <div class="flex justify-between items-center mb-2">
                            <label for="log-password" class="block font-label-caps text-xs text-on-surface-variant tracking-wider">PASSWORD</label>
                        </div>
                        <input type="password" id="log-password" required class="w-full bg-surface-container-lowest border border-outline-variant/40 rounded p-3 text-on-background placeholder:text-on-surface-variant/40 focus:border-tertiary focus:ring-1 focus:ring-tertiary focus:outline-none transition-colors" placeholder="••••••••">
                    </div>
                    
                    <div id="log-error" class="hidden text-center p-3 border border-error/20 rounded bg-error-container/20 text-on-error-container text-xs">
                    </div>

                    <button type="submit" class="w-full bg-tertiary text-on-tertiary py-3.5 rounded font-label-caps tracking-widest hover:bg-[#D4AF37] transition-colors font-bold uppercase focus:outline-none">
                        Access Cellar
                    </button>
                </form>

                <!-- Register Form -->
                <form id="auth-form-register" class="space-y-5 hidden">
                    <div>
                        <label for="reg-name" class="block font-label-caps text-xs text-on-surface-variant mb-2 tracking-wider">FULL NAME</label>
                        <input type="text" id="reg-name" required class="w-full bg-surface-container-lowest border border-outline-variant/40 rounded p-3 text-on-background placeholder:text-on-surface-variant/40 focus:border-tertiary focus:ring-1 focus:ring-tertiary focus:outline-none transition-colors" placeholder="e.g. Siddhant Sharma">
                    </div>
                    <div>
                        <label for="reg-email" class="block font-label-caps text-xs text-on-surface-variant mb-2 tracking-wider">EMAIL ADDRESS</label>
                        <input type="email" id="reg-email" required class="w-full bg-surface-container-lowest border border-outline-variant/40 rounded p-3 text-on-background placeholder:text-on-surface-variant/40 focus:border-tertiary focus:ring-1 focus:ring-tertiary focus:outline-none transition-colors" placeholder="e.g. sid@example.com">
                    </div>
                    <div>
                        <label for="reg-password" class="block font-label-caps text-xs text-on-surface-variant mb-2 tracking-wider">SECURE PASSWORD</label>
                        <input type="password" id="reg-password" required minlength="6" class="w-full bg-surface-container-lowest border border-outline-variant/40 rounded p-3 text-on-background placeholder:text-on-surface-variant/40 focus:border-tertiary focus:ring-1 focus:ring-tertiary focus:outline-none transition-colors" placeholder="Min. 6 characters">
                    </div>
                    
                    <div id="reg-error" class="hidden text-center p-3 border border-error/20 rounded bg-error-container/20 text-on-error-container text-xs">
                    </div>

                    <button type="submit" class="w-full bg-tertiary text-on-tertiary py-3.5 rounded font-label-caps tracking-widest hover:bg-[#D4AF37] transition-colors font-bold uppercase focus:outline-none">
                        Enroll in Guild
                    </button>
                </form>
            </div>
        `;
        document.body.appendChild(authModal);
    }

    function renderAccountDrawer() {
        if (document.getElementById('account-drawer')) return;

        // Overlay element
        const overlay = document.createElement('div');
        overlay.id = "drawer-overlay";
        overlay.className = "fixed inset-0 z-40 bg-black/60 backdrop-blur-sm opacity-0 pointer-events-none transition-opacity duration-500";
        overlay.onclick = window.closeAccountDrawer;
        document.body.appendChild(overlay);

        // Slide-out Drawer
        const drawer = document.createElement('div');
        drawer.id = "account-drawer";
        drawer.className = "fixed right-0 top-0 h-full w-full sm:w-[450px] z-50 bg-[#120d0b]/98 backdrop-blur-2xl border-l border-outline-variant/20 transform translate-x-full transition-transform duration-500 flex flex-col shadow-2xl p-6 overflow-y-auto";
        
        const isDbConnected = !!supabase;
        
        drawer.innerHTML = `
            <!-- Drawer Header -->
            <div class="flex justify-between items-center pb-6 border-b border-outline-variant/10 mb-6">
                <div>
                    <h3 class="font-headline-sm text-xl text-on-background">Vault Status</h3>
                    <p class="text-[10px] font-mono tracking-widest uppercase mt-0.5 ${isDbConnected ? 'text-emerald-400' : 'text-amber-500'}">
                        ${isDbConnected ? '● Backend Live' : '▲ Pending Connection'}
                    </p>
                </div>
                <button class="text-on-surface-variant hover:text-tertiary transition-colors" onclick="window.closeAccountDrawer()">
                    <span class="material-symbols-outlined text-3xl">close</span>
                </button>
            </div>

            <!-- Profile Overview (Populated dynamically) -->
            <div id="drawer-profile-section" class="hidden"></div>

            <!-- Dynamic Section 1: DB Config Console (For developers setting up Supabase URL/Key) -->
            ${!isDbConnected ? `
            <div class="glass-panel gold-border p-6 rounded-xl mb-6 bg-surface-container-low/40">
                <div class="flex items-center gap-2 text-amber-500 mb-3">
                    <span class="material-symbols-outlined text-2xl animate-pulse">database_off</span>
                    <h4 class="font-headline-sm text-base">Backend Connection</h4>
                </div>
                <p class="font-body-md text-xs text-on-surface-variant/80 leading-relaxed mb-4">
                    Nescafe Roast connects with your Supabase Postgres Database! Please enter your database access parameters below.
                </p>
                <form id="setup-console-form" class="space-y-4">
                    <div>
                        <label for="setup-url" class="block font-label-caps text-[10px] text-on-surface-variant mb-1 tracking-wider">SUPABASE PROJECT URL</label>
                        <input type="url" id="setup-url" required class="w-full bg-surface-container-lowest border border-outline-variant/40 rounded px-3 py-2 text-xs text-on-background focus:border-tertiary focus:outline-none" placeholder="https://xxxx.supabase.co" value="${window.supabaseConfig.url.includes("YOUR_SUPABASE_URL") ? '' : window.supabaseConfig.url}">
                    </div>
                    <div>
                        <label for="setup-key" class="block font-label-caps text-[10px] text-on-surface-variant mb-1 tracking-wider">SUPABASE ANON KEY</label>
                        <input type="text" id="setup-key" required class="w-full bg-surface-container-lowest border border-outline-variant/40 rounded px-3 py-2 text-xs text-on-background focus:border-tertiary focus:outline-none" placeholder="eyJhbGciOi..." value="${window.supabaseConfig.key.includes("YOUR_SUPABASE_ANON_KEY") ? '' : window.supabaseConfig.key}">
                    </div>
                    <button type="submit" class="w-full bg-tertiary text-on-tertiary py-2.5 rounded font-label-caps text-[11px] hover:bg-[#D4AF37] transition-colors font-bold uppercase">
                        Initialize Connection
                    </button>
                </form>
                <div class="mt-4 border-t border-outline-variant/10 pt-3">
                    <h5 class="text-[10px] font-bold text-on-background uppercase mb-1">Quick Database Setup (3 steps)</h5>
                    <ol class="text-[10px] text-on-surface-variant/70 list-decimal pl-4 space-y-1">
                        <li>Register an app in <a href="https://supabase.com" target="_blank" class="text-tertiary hover:underline">Supabase</a></li>
                        <li>Initialize the database via the SQL inside <a href="schema.sql" target="_blank" class="text-tertiary hover:underline">schema.sql</a></li>
                        <li>Paste your API Keys above or in <code>supabase-config.js</code>!</li>
                    </ol>
                </div>
            </div>
            ` : `
            <!-- If connected but loaded from override, allow clear -->
            ${window.supabaseConfig.hasOverride ? `
                <div class="mb-4 text-right">
                    <button id="setup-clear-btn" class="text-[10px] font-label-caps text-on-surface-variant/60 hover:text-error transition-colors uppercase">
                        ❌ Reset custom API configuration
                    </button>
                </div>
            ` : ''}
            `}

            <!-- Dynamic Section 2: Reservations Cellar (Authenticated view) -->
            <div id="drawer-reservations-section" class="flex-1 flex flex-col min-h-0 hidden">
                <div class="font-label-caps text-xs text-on-surface-variant mb-4 tracking-wider uppercase">Your Premium Cellar Allocations</div>
                <div id="drawer-reservations-list" class="flex-1 overflow-y-auto space-y-4">
                    <!-- Reservations will load here -->
                </div>
                <div class="pt-6 border-t border-outline-variant/10 mt-6">
                    <button id="drawer-logout-btn" class="w-full border border-outline-variant/50 hover:border-error hover:text-error text-on-surface-variant py-3 rounded font-label-caps text-xs transition-colors uppercase">
                        Disconnect Vault
                    </button>
                </div>
            </div>

            <!-- Dynamic Section 3: Call-To-Action to Sign In (Unauthenticated view) -->
            <div id="drawer-auth-prompt" class="flex-1 flex flex-col justify-center items-center text-center py-12">
                <span class="material-symbols-outlined text-5xl text-tertiary mb-4 float-anim">lock</span>
                <h4 class="font-headline-sm text-xl text-on-background mb-3">Secure Vault Access</h4>
                <p class="font-body-md text-xs text-on-surface-variant/80 max-w-[280px] leading-relaxed mb-6">
                    Sign in to secure premium coffee batches directly, view order histories, and manage allocations.
                </p>
                <button onclick="window.closeAccountDrawer(); setTimeout(() => window.openAuthModal('login'), 350)" class="bg-tertiary text-on-tertiary px-8 py-3 rounded font-label-caps text-xs hover:bg-[#D4AF37] transition-all duration-300 font-bold uppercase tracking-wider">
                    Sign In
                </button>
            </div>
        `;
        document.body.appendChild(drawer);
    }

    function renderHeaderControls() {
        // Inject auth placeholder containers inside existing structures
        // Look for the main header (either ID main-header or any header element)
        const header = document.getElementById('main-header') || document.querySelector('header');
        if (header) {
            // Check if container already exists
            if (!header.querySelector('.auth-header-container')) {
                const headerContainer = document.createElement('div');
                headerContainer.className = "auth-header-container flex items-center h-full mr-2";
                
                // Find a logical sibling: either button.bg-tertiary, or the back-to-home link
                const actionBtn = header.querySelector('button.bg-tertiary') || header.querySelector('a[href="index.html"]:last-child');
                
                if (actionBtn) {
                    // To prevent justify-between from spreading the navigation and action buttons apart,
                    // we dynamically wrap both buttons into a flex group on the right.
                    let actionGroup = header.querySelector('.header-action-group');
                    if (!actionGroup) {
                        actionGroup = document.createElement('div');
                        actionGroup.className = "header-action-group flex items-center gap-4 h-full ml-auto";
                        
                        // Insert actionGroup right before actionBtn's original place, then append both
                        actionBtn.parentNode.insertBefore(actionGroup, actionBtn);
                        actionGroup.appendChild(headerContainer);
                        actionGroup.appendChild(actionBtn);
                    } else {
                        actionGroup.insertBefore(headerContainer, actionBtn);
                    }
                } else {
                    // Fallback to direct insertion if no primary action button
                    header.appendChild(headerContainer);
                }
            }
        }

        const mobileMenuDrawer = document.getElementById('mobile-menu');
        if (mobileMenuDrawer) {
            const reserveBtnMobile = mobileMenuDrawer.querySelector('button.bg-tertiary');
            if (reserveBtnMobile && !mobileMenuDrawer.querySelector('.auth-mobile-container')) {
                const mobileContainer = document.createElement('div');
                mobileContainer.className = "auth-mobile-container mt-2 w-full flex justify-center";
                reserveBtnMobile.parentNode.insertBefore(mobileContainer, reserveBtnMobile);
            }
        }
    }

    // 11. CSS INJECTION HELPER FOR BEAUTIFUL AUTH INTERFACE
    function injectAuthStyles() {
        if (document.getElementById('auth-custom-styles')) return;

        const styleElement = document.createElement('style');
        styleElement.id = "auth-custom-styles";
        styleElement.textContent = `
            /* Interactive Floating Animation */
            .float-anim {
                animation: authFloat 4s ease-in-out infinite;
            }
            @keyframes authFloat {
                0%, 100% { transform: translateY(0px); }
                50% { transform: translateY(-8px); }
            }

            /* Custom scrollbar styling inside drawer list */
            #drawer-reservations-list::-webkit-scrollbar {
                width: 4px;
            }
            #drawer-reservations-list::-webkit-scrollbar-track {
                background: transparent;
            }
            #drawer-reservations-list::-webkit-scrollbar-thumb {
                background: rgba(233, 195, 73, 0.2);
                border-radius: 4px;
            }
            #drawer-reservations-list::-webkit-scrollbar-thumb:hover {
                background: rgba(233, 195, 73, 0.4);
            }

            /* Back blur drawer overlay */
            #drawer-overlay {
                backdrop-filter: blur(4px);
                -webkit-backdrop-filter: blur(4px);
            }
        `;
        document.head.appendChild(styleElement);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeAuthSystem);
} else {
    initializeAuthSystem();
}
