// Pure Scroll-Driven Canvas Animation Engine

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const canvas = document.getElementById('animation-canvas');
    const ctx = canvas.getContext('2d');
    const preloader = document.getElementById('preloader');
    const loaderPercentage = document.getElementById('loader-percentage');
    const loaderBarFill = document.getElementById('loader-bar-fill');
    const statusOverlay = document.getElementById('scroll-status-overlay');
    const scrollSpacer = document.querySelector('.scroll-spacer');
    const stickyCta = document.getElementById('sticky-cta');
    const heroHeading = document.getElementById('scroll-hero-heading');
    
    const mainHeader = document.getElementById('main-header');
    const mobileMenu = document.getElementById('mobile-menu');
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileMenuClose = document.getElementById('mobile-menu-close');
    
    // Config
    const totalFrames = 240;
    const images = [];
    let loadedCount = 0;
    
    // Inertial Smooth Scrolling (Lerp) variables
    let targetFrame = 0;
    let currentFrame = 0;
    let lastDrawnIndex = -1;
    const lerpFactor = 0.085; // Controls frame sliding smoothness (lower is slower/smoother)
    
    // 1. PRELOAD ALL FRAMES TO CACHE IN MEMORY
    function preloadImages() {
        for (let i = 1; i <= totalFrames; i++) {
            const img = new Image();
            const paddedNum = String(i).padStart(3, '0');
            
            // Reference the copied frames inside the local directory
            img.src = `frames/ezgif-frame-${paddedNum}.jpg`;
            
            img.onload = () => {
                loadedCount++;
                const percent = Math.floor((loadedCount / totalFrames) * 100);
                
                // Update Loader GUI
                loaderPercentage.textContent = `${percent}%`;
                loaderBarFill.style.width = `${percent}%`;
                
                if (loadedCount === totalFrames) {
                    setTimeout(startApp, 400); // Tiny aesthetic delay once 100% loaded
                }
            };
            
            img.onerror = () => {
                // If single frame fails, still advance to prevent app lockup
                console.warn(`Frame ${paddedNum} could not be preloaded.`);
                loadedCount++;
                if (loadedCount === totalFrames) {
                    setTimeout(startApp, 400);
                }
            };
            
            images.push(img);
        }
    }
    
    // 2. INITIALIZE ANIMATION CANVAS AND REGISTER EVENTS
    function startApp() {
        preloader.classList.add('fade-out');

        // Initialize Lenis Smooth Scroll with ultra-premium physics
        const lenis = new Lenis({
            duration: 1.2,
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // Organic Out-Expo easing curve
            direction: 'vertical',
            gestureDirection: 'vertical',
            smooth: !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
            syncTouch: true,         // Synchronize mobile drag inputs
            touchMultiplier: 1.8,    // Elegant, responsive speed multiplier
            syncTouchLerp: 0.08,     // Fluid touch scrolling momentum
        });
        window.lenis = lenis;
        
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        
        // Route Lenis scroll events to standard scroll calculations
        lenis.on('scroll', onScroll);
        
        // Initial drawing of frame index 0
        drawFrame(0);
        
        // Start smooth render calculation loop
        requestAnimationFrame(renderLoop);
        
        // Initialize IntersectionObserver for fade-in animations on bottom sections
        const fadeInUpObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                }
            });
        }, { threshold: 0.08 });
        
        document.querySelectorAll('.fade-in-up').forEach((el) => {
            fadeInUpObserver.observe(el);
        });

        // Mobile menu toggle functionality with Lenis integration (stops scroll leakage)
        function toggleMobileMenu(isOpen) {
            if (isOpen) {
                mobileMenu.classList.remove('translate-x-full');
                mobileMenu.classList.remove('pointer-events-none');
                window.lenis?.stop(); // Prevent background scrolling
            } else {
                mobileMenu.classList.add('translate-x-full');
                mobileMenu.classList.add('pointer-events-none');
                window.lenis?.start(); // Resume background scrolling
            }
        }
        window.toggleMobileMenu = toggleMobileMenu;
        
        if (mobileMenuBtn) {
            mobileMenuBtn.addEventListener('click', () => toggleMobileMenu(true));
        }
        if (mobileMenuClose) {
            mobileMenuClose.addEventListener('click', () => toggleMobileMenu(false));
        }

        // Reservation Modal Logic
        const reservationModal = document.getElementById('reservation-modal');
        const modalStageForm = document.getElementById('modal-stage-form');
        const modalStageSuccess = document.getElementById('modal-stage-success');
        const reservationForm = document.getElementById('reservation-form');
        const qtyEl = document.getElementById('coffee-qty');
        const totalEl = document.getElementById('coffee-total');
        const nameInput = document.getElementById('res-name');
        const emailInput = document.getElementById('res-email');
        
        const btnClassic = document.getElementById('coffee-btn-classic');
        const btnMidnight = document.getElementById('coffee-btn-midnight');
        const btnGold = document.getElementById('coffee-btn-gold');
        
        const prices = {
            classic: 24.00,
            midnight: 28.00,
            gold: 32.00
        };
        
        const blendNames = {
            classic: "Classic Reserve",
            midnight: "Dark Midnight Roast",
            gold: "The Gold Standard"
        };
        
        let selectedBlend = 'classic';
        let quantity = 1;
        
        function selectCoffee(blendName) {
            selectedBlend = blendName;
            
            // Reset all buttons to inactive styling
            [btnClassic, btnMidnight, btnGold].forEach(btn => {
                if (btn) {
                    btn.classList.remove('border-tertiary', 'text-tertiary');
                    btn.classList.add('border-outline-variant/40', 'text-on-surface-variant');
                }
            });
            
            // Apply active styling to selected button
            const activeBtn = document.getElementById(`coffee-btn-${blendName}`);
            if (activeBtn) {
                activeBtn.classList.remove('border-outline-variant/40', 'text-on-surface-variant');
                activeBtn.classList.add('border-tertiary', 'text-tertiary');
            }
            
            updatePrice();
        }
        
        function adjustQty(amount) {
            quantity = Math.max(1, quantity + amount);
            if (qtyEl) qtyEl.textContent = quantity;
            updatePrice();
        }
        
        function updatePrice() {
            const pricePerBag = prices[selectedBlend] || 24.00;
            const totalPrice = pricePerBag * quantity;
            if (totalEl) {
                totalEl.textContent = `$${totalPrice.toFixed(2)}`;
            }
        }
        
        function openReservationModal(defaultBlend) {
            // Reset input values
            if (nameInput) nameInput.value = '';
            if (emailInput) emailInput.value = '';
            
            // Set default quantity
            quantity = 1;
            if (qtyEl) qtyEl.textContent = '1';
            
            // Select default blend
            selectCoffee(defaultBlend || 'classic');
            
            // Show form, hide success screen
            if (modalStageForm) modalStageForm.classList.remove('hidden');
            if (modalStageSuccess) modalStageSuccess.classList.add('hidden');
            
            // Open modal modal transitions
            if (reservationModal) {
                reservationModal.classList.remove('opacity-0', 'scale-95', 'pointer-events-none');
                reservationModal.classList.add('opacity-100', 'scale-100');
            }
            
            // Lock body scroll
            window.lenis?.stop();
        }
        
        function closeReservationModal() {
            if (reservationModal) {
                reservationModal.classList.remove('opacity-100', 'scale-100');
                reservationModal.classList.add('opacity-0', 'scale-95', 'pointer-events-none');
            }
            // Unlock body scroll
            window.lenis?.start();
        }
        
        function submitReservationForm() {
            const confirmId = document.getElementById('confirm-id');
            const confirmBlend = document.getElementById('confirm-blend');
            const confirmQty = document.getElementById('confirm-qty');
            const confirmTotal = document.getElementById('confirm-total');
            
            const randomId = `#AR-${Math.floor(10000 + Math.random() * 90000)}`;
            const pricePerBag = prices[selectedBlend] || 24.00;
            const totalPrice = pricePerBag * quantity;
            
            if (confirmId) confirmId.textContent = randomId;
            if (confirmBlend) confirmBlend.textContent = blendNames[selectedBlend];
            if (confirmQty) confirmQty.textContent = `${quantity} ${quantity === 1 ? 'Bag' : 'Bags'}`;
            if (confirmTotal) confirmTotal.textContent = `$${totalPrice.toFixed(2)}`;
            
            if (modalStageForm) modalStageForm.classList.add('hidden');
            if (modalStageSuccess) modalStageSuccess.classList.remove('hidden');
        }
        
        // Export to window scope so inline HTML onclick and onsubmit handlers can reach them
        window.selectCoffee = selectCoffee;
        window.adjustQty = adjustQty;
        window.openReservationModal = openReservationModal;
        window.closeReservationModal = closeReservationModal;
        window.submitReservationForm = submitReservationForm;
    }
    
    // 3. RETINA-READY ASPECT-FIT COVER SCALING (OPTIMIZED)
    function resizeCanvas() {
        // Clamp DPR to max 2.0 to avoid mobile battery drain / rendering bottleneck
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = window.innerWidth * dpr;
        canvas.height = window.innerHeight * dpr;
        
        canvas.style.width = `${window.innerWidth}px`;
        canvas.style.height = `${window.innerHeight}px`;
        
        // Reset lastDrawnIndex to force redraw on resized dimension space
        lastDrawnIndex = -1;
        
        // Redraw immediately on window resize
        drawFrame(Math.round(currentFrame));
    }
    
    // Optimized: skips duplicate draws, saving substantial GPU workload
    function drawFrame(index) {
        if (index === lastDrawnIndex) return;
        
        const img = images[index];
        if (!img || !img.complete) return;
        
        const canvasRatio = canvas.width / canvas.height;
        const imgRatio = img.width / img.height;
        
        let drawWidth, drawHeight, x, y;
        
        // Compute "object-fit: cover" coordinates centered on canvas
        if (canvasRatio > imgRatio) {
            drawWidth = canvas.width;
            drawHeight = canvas.width / imgRatio;
            x = 0;
            y = (canvas.height - drawHeight) / 2;
        } else {
            drawWidth = canvas.height * imgRatio;
            drawHeight = canvas.height;
            x = (canvas.width - drawWidth) / 2;
            y = 0;
        }
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Enable high scaling quality
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        ctx.drawImage(img, x, y, drawWidth, drawHeight);
        lastDrawnIndex = index;
    }
    
    // 4. SCROLL INTERCEPTOR (CALCULATES FRAME TARGET STRICTLY WITHIN THE SPACER REGION)
    function onScroll() {
        const scrollTop = window.scrollY || document.documentElement.scrollTop;
        const spacerHeight = scrollSpacer.offsetHeight - window.innerHeight;
        
        let scrollPercent = 0;
        if (spacerHeight > 0) {
            scrollPercent = Math.min(1, Math.max(0, scrollTop / spacerHeight));
        }
        
        // Map scroll percentage linearly to total animation frames range (0 to 239)
        targetFrame = Math.min(totalFrames - 1, Math.max(0, Math.floor(scrollPercent * totalFrames)));
        
        // Handle Nescafe Classic hero heading fade/parallax (fade away at 30% scroll)
        if (heroHeading) {
            const threshold = 0.3;
            if (scrollPercent <= threshold) {
                const opacity = 1 - (scrollPercent / threshold);
                const translateY = scrollPercent * -100; // Subtle elegant parallax scroll-up
                heroHeading.style.opacity = opacity;
                heroHeading.style.transform = `translateY(${translateY}px)`;
                heroHeading.style.visibility = 'visible';
            } else {
                heroHeading.style.opacity = 0;
                heroHeading.style.visibility = 'hidden';
            }
        }
        
        // Toggle overlays visibility when scrolling past the spacer
        if (scrollTop >= spacerHeight - 50) {
            if (statusOverlay) statusOverlay.classList.add('hidden');
        } else {
            if (statusOverlay) statusOverlay.classList.remove('hidden');
        }

        // Transition main-header background based on scroll position
        if (mainHeader) {
            if (scrollTop > 80) {
                mainHeader.classList.remove('bg-transparent');
                mainHeader.classList.remove('border-transparent');
                mainHeader.classList.add('bg-background/80');
                mainHeader.classList.add('backdrop-blur-xl');
                mainHeader.classList.add('border-outline-variant/20');
                mainHeader.classList.add('shadow-lg');
            } else {
                mainHeader.classList.add('bg-transparent');
                mainHeader.classList.add('border-transparent');
                mainHeader.classList.remove('bg-background/80');
                mainHeader.classList.remove('backdrop-blur-xl');
                mainHeader.classList.remove('border-outline-variant/20');
                mainHeader.classList.remove('shadow-lg');
            }
        }

        // Toggle Sticky CTA visibility
        if (stickyCta) {
            if (scrollTop > 500) {
                stickyCta.classList.add('visible');
            } else {
                stickyCta.classList.remove('visible');
            }
        }
    }
    
    // 5. SMOOTH INTERPOLATION (LERPING) RENDER LOOP WITH UNIFIED RAF TICK
    function renderLoop(time) {
        // Sync Lenis scroll tick to exactly same browser frame
        if (window.lenis) {
            window.lenis.raf(time);
        }

        const frameDiff = targetFrame - currentFrame;
        
        // If there's scroll movement lag, lerp currentFrame towards targetFrame
        if (Math.abs(frameDiff) > 0.05) {
            currentFrame += frameDiff * lerpFactor;
            const drawIndex = Math.round(currentFrame);
            drawFrame(drawIndex);
        } else if (currentFrame !== targetFrame) {
            currentFrame = targetFrame;
            drawFrame(currentFrame);
        }
        
        requestAnimationFrame(renderLoop);
    }
    
    // Initialize
    preloadImages();
});
