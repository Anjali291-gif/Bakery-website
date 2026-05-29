/* ==========================================================================
   MAIN JS IMPLEMENTATION - MAISON DE SUCRE
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
    // Select elements
    const canvas = document.getElementById("hero-canvas");
    const ctx = canvas.getContext("2d");
    const loader = document.getElementById("loader");
    const loaderBar = document.getElementById("loader-bar");
    const loaderPercentage = document.getElementById("loader-percentage");
    const header = document.querySelector(".header");

    // Sizing setup
    let canvasWidth = window.innerWidth;
    let canvasHeight = window.innerHeight;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // Configuration
    const frameCount = 40;
    const images = [];
    let loadedCount = 0;

    // 3D Cake State Object (GSAP will animate these properties)
    const cake = {
        frame: 0,        // Lerped frame index used for drawing
        scrollFrame: 0,  // Target frame index updated by scroll timeline
        scale: 1.0,      // Cinematic zoom factor
        rotation: 0,     // In degrees
        xOffset: 0,      // Horizontal parallax translation
        yOffset: 0       // Vertical parallax translation
    };

    // Particle System Variables
    const particles = [];
    const particleCount = window.innerWidth < 768 ? 40 : 80;

    // Scroll & Idle tracking
    let lastScrollTime = Date.now();
    let isScrollIdle = true;
    let idleFrameSpeed = 0.08; // Velocity of automatic rotation when idle

    // Mouse movement state
    let mouseX = 0;
    let mouseY = 0;
    let targetXOffset = 0;
    let targetYOffset = 0;

    // ==========================================================================
    // 1. PRELOAD IMAGES
    // ==========================================================================
    function preloadImages() {
        return new Promise((resolve) => {
            for (let i = 1; i <= frameCount; i++) {
                const img = new Image();
                // Format: ezgif-frame-001.jpg, ezgif-frame-002.jpg...
                const frameNum = String(i).padStart(3, '0');
                img.src = `extracted_assets/ezgif-frame-${frameNum}.jpg`;
                
                img.onload = () => {
                    loadedCount++;
                    updateProgress();
                    if (loadedCount === frameCount) resolve();
                };

                img.onerror = () => {
                    // Fail-safe to ensure loader completes even if files fail
                    loadedCount++;
                    updateProgress();
                    if (loadedCount === frameCount) resolve();
                };

                images.push(img);
            }
        });
    }

    function updateProgress() {
        const percent = Math.round((loadedCount / frameCount) * 100);
        loaderBar.style.width = `${percent}%`;
        loaderPercentage.textContent = `${percent}%`;
    }

    // Initialize application after loading assets
    preloadImages().then(() => {
        // Fade out loader
        gsap.to(loader, {
            opacity: 0,
            y: "-100%",
            duration: 1.2,
            ease: "power4.inOut",
            onComplete: () => {
                loader.style.display = "none";
                initializeAnimations();
            }
        });
    });

    // ==========================================================================
    // 2. PARTICLE SYSTEM
    // ==========================================================================
    class Particle {
        constructor() {
            this.reset(true);
        }

        reset(initial = false) {
            this.x = Math.random() * canvasWidth;
            // Spread vertically on startup, otherwise spawn at bottom
            this.y = initial ? Math.random() * canvasHeight : canvasHeight + Math.random() * 50;
            this.size = Math.random() * 2 + 0.8; // Floating gold dust sizes
            this.speedY = Math.random() * 0.4 + 0.15; // Slow upward drift
            this.speedX = (Math.random() - 0.5) * 0.25; // Gentle sway
            this.opacity = Math.random() * 0.4 + 0.15;
            this.angle = Math.random() * Math.PI * 2;
            this.wobbleSpeed = Math.random() * 0.01 + 0.005;
        }

        update(scrollSpeed) {
            // Upward drift, speed increases slightly with scroll speed
            this.y -= (this.speedY + Math.abs(scrollSpeed) * 0.15);
            
            // Sway wobble
            this.angle += this.wobbleSpeed;
            this.x += this.speedX + Math.cos(this.angle) * 0.15;

            // Interactive mouse push
            if (mouseX !== 0 && mouseY !== 0) {
                const dx = this.x - mouseX;
                const dy = this.y - mouseY;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 180) {
                    const force = (180 - dist) / 180;
                    this.x += (dx / dist) * force * 1.5;
                    this.y += (dy / dist) * force * 1.5;
                }
            }

            // Recycle off-screen particles
            if (this.y < -20 || this.x < -20 || this.x > canvasWidth + 20) {
                this.reset(false);
            }
        }

        draw() {
            ctx.beginPath();
            const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size * 2);
            grad.addColorStop(0, `rgba(255, 230, 180, ${this.opacity})`);
            grad.addColorStop(0.5, `rgba(197, 168, 128, ${this.opacity * 0.4})`);
            grad.addColorStop(1, 'rgba(197, 168, 128, 0)');
            ctx.fillStyle = grad;
            ctx.arc(this.x, this.y, this.size * 2, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // Initialize particles
    for (let i = 0; i < particleCount; i++) {
        particles.push(new Particle());
    }

    // ==========================================================================
    // 3. CANVAS RENDER LOOP (BUTTERY SMOOTH PLAYHEAD INTERPOLATION)
    // ==========================================================================
    
    // Shortest-path circular interpolation helper for frame wrapping (0 <-> 39)
    function lerpFrame(current, target, speed, total) {
        let diff = target - current;
        
        // Circular wrap-around math
        if (diff > total / 2) {
            diff -= total;
        } else if (diff < -total / 2) {
            diff += total;
        }
        
        const val = current + diff * speed;
        return (val + total) % total;
    }

    function renderCanvas(scrollSpeed = 0) {
        const frameIndex = Math.floor(cake.frame);
        const img = images[frameIndex];
        
        if (!img || !img.complete) return;

        // Clear canvas
        ctx.clearRect(0, 0, canvasWidth, canvasHeight);

        // Aspect ratio cover calculations
        const imgWidth = img.width;
        const imgHeight = img.height;
        const scaleX = canvasWidth / imgWidth;
        const scaleY = canvasHeight / imgHeight;
        const coverScale = Math.max(scaleX, scaleY);

        // Custom animate scale combined with cover factor
        const finalScale = coverScale * cake.scale;

        const w = imgWidth * finalScale;
        const h = imgHeight * finalScale;

        // Center offsets (combines canvas centering and mouse parallax)
        const x = (canvasWidth - w) / 2 + cake.xOffset;
        const y = (canvasHeight - h) / 2 + cake.yOffset;

        ctx.save();
        
        // Apply rotation from center of the screen
        if (cake.rotation !== 0) {
            ctx.translate(canvasWidth / 2, canvasHeight / 2);
            ctx.rotate(cake.rotation * Math.PI / 180);
            ctx.translate(-canvasWidth / 2, -canvasHeight / 2);
        }

        // Draw current 3D cake frame
        ctx.drawImage(img, x, y, w, h);
        ctx.restore();

        // Update and draw golden particles on top
        particles.forEach(p => {
            p.update(scrollSpeed);
            p.draw();
        });
    }

    // ==========================================================================
    // 4. ANIMATION SYNCRONIZER
    // ==========================================================================
    let lastScrollY = window.scrollY;
    
    function tick() {
        const currentScrollY = window.scrollY;
        const scrollSpeed = currentScrollY - lastScrollY;
        lastScrollY = currentScrollY;

        // Track scroll idle state
        const timeSinceLastScroll = Date.now() - lastScrollTime;
        if (timeSinceLastScroll > 800) {
            isScrollIdle = true;
        }

        // Smoothly interpolate mouse parallax offsets
        cake.xOffset += (targetXOffset - cake.xOffset) * 0.08;
        cake.yOffset += (targetYOffset - cake.yOffset) * 0.08;

        // Core Frame Playback Decision:
        if (isScrollIdle) {
            // Idle loop: increment scrollFrame continuously so cake rotates
            cake.scrollFrame = (cake.scrollFrame + idleFrameSpeed) % frameCount;
            // Lerp frame quickly for fluid motion
            cake.frame = lerpFrame(cake.frame, cake.scrollFrame, 0.06, frameCount);
        } else {
            // Scroll controlled: Lerp frame index to target scrollFrame driven by GSAP
            cake.frame = lerpFrame(cake.frame, cake.scrollFrame, 0.12, frameCount);
        }

        // Draw
        renderCanvas(scrollSpeed);

        requestAnimationFrame(tick);
    }

    // Start requestAnimationFrame loop
    requestAnimationFrame(tick);

    // ==========================================================================
    // 5. GSAP TIMELINES & SCROLLTRIGGER
    // ==========================================================================
    function initializeAnimations() {
        // Register ScrollTrigger
        gsap.registerPlugin(ScrollTrigger);

        // Initialize Lenis Smooth Scroll
        const lenis = new Lenis({
            duration: 1.4,
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // smooth exponential deceleration
            orientation: 'vertical',
            gestureOrientation: 'vertical',
            smoothWheel: true,
            wheelMultiplier: 1.0,
            smoothTouch: false, // Maintain native touch scroll on mobile
            touchMultiplier: 1.5
        });

        // Bind Lenis scroll to update ScrollTrigger
        lenis.on('scroll', (e) => {
            isScrollIdle = false;
            lastScrollTime = Date.now();
            ScrollTrigger.update();
            
            // Header shadow/blur trigger on scroll
            if (e.scroll > 50) {
                header.classList.add("scrolled");
            } else {
                header.classList.remove("scrolled");
            }
        });

        // Use GSAP's ticker to run Lenis
        gsap.ticker.add((time) => {
            lenis.raf(time * 1000);
        });

        // Disable lag smoothing to keep scrolling and rendering synced perfectly
        gsap.ticker.lagSmoothing(0);

        // PINNED HERO SCROLL TIMELINE
        const tl = gsap.timeline({
            scrollTrigger: {
                trigger: "#hero-section",
                start: "top top",
                end: "+=2000", // Scroll length to pin the hero (approx 3 screen heights)
                scrub: 1.0,    // Synchronized scrub with Lenis
                pin: true,     // Pin the hero-sticky-wrapper in place
                anticipatePin: 1,
                id: "hero-trigger",
                onUpdate: (self) => {
                    isScrollIdle = false;
                    lastScrollTime = Date.now();
                }
            }
        });

        // Setup Slide Welcome selections
        const slideWelcome = document.getElementById("slide-welcome");
        const slideFeatures = document.getElementById("slide-features");
        const slideOutro = document.getElementById("slide-outro");

        // Set initial state
        gsap.set([slideFeatures, slideOutro], { display: "none", opacity: 0 });
        
        // Define timeline animation segments
        
        // --- SECTION 1: Welcome Slide Out ---
        tl.to("#heading-1, #tagline-1", {
            opacity: 0,
            y: -40,
            duration: 0.8,
            ease: "power2.inOut"
        }, 0)
        .to("#subheading-1, #ctas-1", {
            opacity: 0,
            y: -30,
            duration: 0.8,
            ease: "power2.inOut"
        }, 0.1)
        
        // Zoom and slightly rotate the cake (close-up feature view)
        .to(cake, {
            scrollFrame: 18,       // Advance cake rotation to frame 18
            scale: 1.35,           // Zoom in for high detail
            rotation: 5,           // Slight elegant tilt
            duration: 1.2,
            ease: "power1.inOut"
        }, 0)
        .to(slideWelcome, {
            opacity: 0,
            duration: 0.8,
            onComplete: () => { slideWelcome.style.display = "none"; }
        }, 0.6)

        // --- SECTION 2: Feature Slide In ---
        .to(slideFeatures, {
            display: "flex",
            opacity: 1,
            duration: 0.5,
            onStart: () => { slideFeatures.style.display = "flex"; }
        }, 0.8)
        // Reveal feature items sequentially
        .to("#feature-1", {
            opacity: 1,
            y: 0,
            duration: 0.7,
            ease: "power3.out"
        }, 0.9)
        .to("#feature-2", {
            opacity: 1,
            y: 0,
            duration: 0.7,
            ease: "power3.out"
        }, 1.1)
        .to("#feature-3", {
            opacity: 1,
            y: 0,
            duration: 0.7,
            ease: "power3.out"
        }, 1.3)
        
        // Mid-slide camera panning / rotation update
        .to(cake, {
            scrollFrame: 28,      // Continue rotating to frame 28
            rotation: -5,         // Tilt camera in opposite direction
            scale: 1.30,          // Keep high zoom
            duration: 1.5,
            ease: "none"
        }, 0.9)

        // --- SECTION 3: Features Out, Outro Slide In ---
        .to("#feature-1, #feature-2, #feature-3", {
            opacity: 0,
            y: -30,
            stagger: 0.15,
            duration: 0.8,
            ease: "power2.in"
        }, 2.0)
        .to(slideFeatures, {
            opacity: 0,
            duration: 0.6,
            onComplete: () => { slideFeatures.style.display = "none"; }
        }, 2.4)
        
        // Zoom out cake to show the complete design, rotate to end frame (39)
        .to(cake, {
            scrollFrame: 39,      // Final frame to complete loop
            scale: 0.95,          // Scale down to showcase complete silhouette
            rotation: 0,          // Return rotation tilt to neutral
            duration: 1.4,
            ease: "power2.out"
        }, 2.0)
        
        .to(slideOutro, {
            display: "flex",
            opacity: 1,
            duration: 0.8,
            onStart: () => { slideOutro.style.display = "flex"; }
        }, 2.5)
        .from("#tagline-3, #heading-3", {
            opacity: 0,
            y: 40,
            duration: 0.8,
            ease: "power3.out"
        }, 2.7)
        .from("#subheading-3, #ctas-3", {
            opacity: 0,
            y: 30,
            duration: 0.8,
            ease: "power3.out"
        }, 2.8)
        
        // Leave scroll headroom at the end of pinned state
        .to(cake, {
            duration: 0.5 // Cushion
        });

        // ANIME SECONDARY SECTION REVEALS
        gsap.from(".details-text-col > *", {
            scrollTrigger: {
                trigger: "#details-section",
                start: "top 80%",
                toggleActions: "play none none reverse"
            },
            opacity: 0,
            y: 40,
            stagger: 0.15,
            duration: 1.0,
            ease: "power3.out"
        });

        gsap.from(".image-glass-card", {
            scrollTrigger: {
                trigger: "#details-section",
                start: "top 70%",
                toggleActions: "play none none reverse"
            },
            opacity: 0,
            scale: 0.9,
            y: 50,
            duration: 1.2,
            ease: "power3.out"
        });
    }

    // ==========================================================================
    // 6. EVENT LISTENERS
    // ==========================================================================
    
    // Mouse Parallax movement
    window.addEventListener("mousemove", (e) => {
        // Calculate normalized coordinates (-1 to 1)
        mouseX = (e.clientX / window.innerWidth) * 2 - 1;
        mouseY = (e.clientY / window.innerHeight) * 2 - 1;

        // Apply a multiplier for movement intensity
        targetXOffset = mouseX * 25;
        targetYOffset = mouseY * 20;
    });

    // Handle Window Resize
    window.addEventListener("resize", () => {
        canvasWidth = window.innerWidth;
        canvasHeight = window.innerHeight;
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        
        // Re-run cover scaling drawing immediately
        renderCanvas();
    });
});
