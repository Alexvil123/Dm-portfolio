/**
 * ============================================================================
 * DIGITAL MARKETING SPECIALIST - EXECUTIVE CREATIVE & INTERACTION ENGINE
 * Lenis Momentum Scroll • Split Comparison Studio • 3D Tilt Glare • Magnetic CTA
 * ============================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  initLenisSmoothScroll();
  initScrollProgressBar();
  initScrollRevealObserver();
  initSplitComparisonSlider();
  initStickyFit();
  initDotAssembleReviews();
  initServicesDeckFlipAnimation();
  initMagneticCursorAndPulls();
  init3DTiltAndGlare();
  initAnimatedCounters();
  initRainbowPortfolioCarousel();
  initInteractiveScopeEstimator();
  initEstimatorStandUp();
  initCaseStudyModal();
  initAuditContactForm();
  initMobileNavigation();
  initFloatingDock();
});

/* ==========================================================================
   0. Pinned (sticky) sections: scale content to the viewport height
   Services deck + portfolio carousel are taller than short screens, so their
   heading / bottom cards were clipped while pinned. Scale them down to fit.
   ========================================================================== */
function initStickyFit() {
  const containerOf = (sel) => document.querySelector(sel);

  const targets = [
    {
      container: containerOf('.services-deck-container'),
      stage: containerOf('.services-deck-stage'),
      desktopOnly: true,
      // Bottom of the dealt card grid, relative to the container top
      bottom: (container, stage, top) => top + stage.offsetHeight,
    },
    {
      container: containerOf('.portfolio-rainbow-container'),
      stage: containerOf('.portfolio-rainbow-stage'),
      desktopOnly: false,
      // Active card is absolutely positioned (top: 15px) and pops up to 1.14x
      bottom: (container, stage, top) => {
        const cards = stage.querySelectorAll('.work-card-clean');
        const tallest = Array.from(cards).reduce((m, c) => Math.max(m, c.offsetHeight), 0);
        return Math.max(top + stage.offsetHeight, top + 15 + tallest * 1.07);
      },
    },
  ].filter((t) => t.container && t.stage);

  if (!targets.length) return;

  function fit() {
    targets.forEach((t) => {
      const { container, stage } = t;
      if (t.desktopOnly && window.innerWidth <= 768) {
        container.style.transform = '';
        return;
      }

      container.style.transform = 'none';
      const top = stage.getBoundingClientRect().top - container.getBoundingClientRect().top;
      const natural = t.bottom(container, stage, top) + 16;
      const available = container.clientHeight - 8; // keep a small gap under the navbar
      if (!natural || available <= 0) return;

      const scale = Math.max(0.55, Math.min(1, available / natural));
      const offsetY = 8 + Math.max(0, (available - natural * scale) / 2);
      container.style.transform = `translateY(${offsetY.toFixed(1)}px) scale(${scale.toFixed(3)})`;
    });
  }

  fit();
  window.addEventListener('resize', fit);
  window.addEventListener('load', fit);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
}

/* ==========================================================================
   0b. Testimonial cards: scattered dots converge and assemble into each card
   Every card is sampled into a grid of dots that start spread across the
   section, glide home, then the real card fades in as the dots dissolve.
   ========================================================================== */
function initDotAssembleReviews() {
  const cards = Array.from(document.querySelectorAll('.dot-assemble'));
  if (!cards.length) return;
  const section = cards[0].closest('section');
  if (!section) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const COLORS = ['#2563eb', '#059669', '#4f46e5', '#d97706', '#94a3b8'];
  const CARD_RADIUS = 20;
  const REVEAL_AT = 1.7;   // seconds (+ stagger) when the real card starts fading in
  const FADE_DOTS = 0.55;  // seconds the dots take to dissolve
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  const clamp01 = (v) => Math.max(0, Math.min(1, v));

  if (!document.createElement('canvas').getContext) return;

  const hideCards = () => cards.forEach((c) => c.classList.add('da-pending'));
  const showCards = () => cards.forEach((c) => c.classList.remove('da-pending'));
  hideCards();

  let runId = 0;       // bumped on every start/cancel so stale frames stop themselves
  let running = false;
  let canvas = null;
  let failsafe = null;

  function finish() {
    running = false;
    clearTimeout(failsafe);
    if (canvas) {
      canvas.remove();
      canvas = null;
    }
    showCards();
  }

  function cancel() {
    runId++;
    running = false;
    clearTimeout(failsafe);
    if (canvas) {
      canvas.remove();
      canvas = null;
    }
  }

  function run() {
    const myId = ++runId;
    running = true;

    canvas = document.createElement('canvas');
    canvas.className = 'da-canvas';
    section.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const sr = section.getBoundingClientRect();
    const W = sr.width;
    const H = sr.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const gap = W < 600 ? 9 : 7;
    const dots = [];

    cards.forEach((card, ci) => {
      const r = card.getBoundingClientRect();
      const x0 = r.left - sr.left;
      const y0 = r.top - sr.top;
      for (let y = gap / 2; y < r.height; y += gap) {
        for (let x = gap / 2; x < r.width; x += gap) {
          const dx = Math.max(CARD_RADIUS - x, 0, x - (r.width - CARD_RADIUS));
          const dy = Math.max(CARD_RADIUS - y, 0, y - (r.height - CARD_RADIUS));
          if (dx * dx + dy * dy > CARD_RADIUS * CARD_RADIUS) continue;
          dots.push({
            hx: x0 + x,
            hy: y0 + y,
            sx: Math.random() * W,
            sy: Math.random() * H,
            delay: ci * 0.18 + Math.random() * 0.55,
            dur: 0.9 + Math.random() * 0.5,
            ph: Math.random() * Math.PI * 2,
            color: Math.floor(Math.random() * COLORS.length),
            card: ci,
          });
        }
      }
    });

    const revealed = cards.map(() => false);
    const endTime = REVEAL_AT + (cards.length - 1) * 0.18 + FADE_DOTS + 0.1;
    const t0 = performance.now();

    function frame(now) {
      if (myId !== runId) return; // cancelled or replaced by a newer run
      const t = (now - t0) / 1000;
      ctx.clearRect(0, 0, W, H);

      cards.forEach((card, ci) => {
        const tr = REVEAL_AT + ci * 0.18;
        if (!revealed[ci] && t >= tr) {
          revealed[ci] = true;
          card.classList.remove('da-pending');
        }
      });

      // One path per (card, colour) so alpha can fade per card
      const buckets = new Map();
      for (let i = 0; i < dots.length; i++) {
        const d = dots[i];
        const e = easeOutCubic(clamp01((t - d.delay) / d.dur));
        const wobble = Math.sin(d.ph + t * 6) * (1 - e) * 14;
        const x = d.sx + (d.hx - d.sx) * e + wobble;
        const y = d.sy + (d.hy - d.sy) * e - wobble;
        const key = d.card * 8 + d.color;
        let b = buckets.get(key);
        if (!b) {
          b = { card: d.card, color: d.color, path: new Path2D() };
          buckets.set(key, b);
        }
        const rad = 1.7 + (1 - e) * 1.1;
        b.path.moveTo(x + rad, y);
        b.path.arc(x, y, rad, 0, Math.PI * 2);
      }

      buckets.forEach((b) => {
        const tr = REVEAL_AT + b.card * 0.18;
        ctx.globalAlpha = 0.9 * (1 - clamp01((t - tr) / FADE_DOTS));
        ctx.fillStyle = COLORS[b.color];
        ctx.fill(b.path);
      });
      ctx.globalAlpha = 1;

      if (t < endTime) {
        requestAnimationFrame(frame);
      } else {
        finish();
      }
    }

    requestAnimationFrame(frame);
  }

  // Replays every time the cards scroll into view: leaving the viewport re-arms it
  let armed = true;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) {
        armed = true;
        cancel();
        hideCards();
        return;
      }
      if (en.intersectionRatio >= 0.1 && armed && !running) {
        armed = false;
        try {
          run();
        } catch (err) {
          finish();
          return;
        }
        // Failsafe: the cards must never stay hidden (throttled rAF, errors, odd viewports)
        failsafe = setTimeout(finish, 4500);
      }
    });
  }, { threshold: [0, 0.1] });
  observer.observe(cards[0].parentElement);
}

/* ==========================================================================
   1. Lenis Awwwards-Grade Momentum Smooth Scrolling
   ========================================================================== */
let lenisInstance = null;

function initLenisSmoothScroll() {
  if (typeof window.Lenis === 'undefined') {
    console.warn('Lenis CDN not loaded, falling back to native smooth scrolling.');
    return;
  }

  lenisInstance = new window.Lenis({
    duration: 1.2,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    orientation: 'vertical',
    gestureOrientation: 'vertical',
    smoothWheel: true,
    wheelMultiplier: 1.0,
    touchMultiplier: 1.8,
    infinite: false,
  });

  window.lenisInstance = lenisInstance;

  function raf(time) {
    lenisInstance.raf(time);
    requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);

  // Smooth scroll for internal anchor links with sticky navbar offset
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', function (e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#' || targetId === '') return;
      const targetEl = document.querySelector(targetId);
      if (targetEl) {
        e.preventDefault();
        lenisInstance.scrollTo(targetEl, {
          offset: -85,
          duration: 1.3,
        });

        // Close mobile menu if open
        const navLinks = document.getElementById('navLinks');
        if (navLinks && navLinks.classList.contains('active')) {
          navLinks.classList.remove('active');
        }
      }
    });
  });
}

/* ==========================================================================
   2. Real-Time Scroll Progress Indicator
   ========================================================================== */
function initScrollProgressBar() {
  const progressBar = document.getElementById('scrollProgress');
  if (!progressBar) return;

  function updateProgress() {
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    progressBar.style.width = `${progress}%`;
  }

  window.addEventListener('scroll', updateProgress, { passive: true });
  if (lenisInstance) {
    lenisInstance.on('scroll', updateProgress);
  }
  updateProgress();
}

/* ==========================================================================
   3. Scroll Reveal Observer with Stagger & Crystal Clarity Transitions
   ========================================================================== */
function initScrollRevealObserver() {
  const revealElements = document.querySelectorAll('.reveal-on-scroll');
  if (!revealElements.length) return;

  // Immediate reveal for elements already in viewport (e.g. Hero on initial load)
  const observerOptions = {
    root: null,
    rootMargin: '0px 0px -40px 0px',
    threshold: 0.1,
  };

  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  revealElements.forEach((el, index) => {
    // Add staggered delay for child items inside grids
    if (el.closest('.services-card-grid') || el.closest('.portfolio-cards-grid') || el.closest('.reviews-grid-clean')) {
      const childIndex = Array.from(el.parentNode.children).indexOf(el);
      el.style.transitionDelay = `${(childIndex % 3) * 0.12}s`;
    }
    revealObserver.observe(el);
  });

  // Ensure hero elements reveal quickly on load
  setTimeout(() => {
    document.querySelectorAll('#hero .reveal-on-scroll').forEach((el, idx) => {
      el.style.transitionDelay = `${idx * 0.1}s`;
      el.classList.add('revealed');
    });
  }, 100);
}

/* ==========================================================================
   4. Interactive Draggable Before vs After Split Comparison Studio
   ========================================================================== */
function initSplitComparisonSlider() {
  const sliderWrapper = document.getElementById('sliderWrapper');
  const slideAfter = document.getElementById('slideAfter');
  const sliderHandle = document.getElementById('sliderHandle');

  if (!sliderWrapper || !slideAfter || !sliderHandle) return;

  let isDragging = false;
  let hasUserInteracted = false;

  function setSliderPosition(clientX) {
    const rect = sliderWrapper.getBoundingClientRect();
    const offsetX = clientX - rect.left;
    let percentage = (offsetX / rect.width) * 100;

    // Constrain within 4% and 96%
    percentage = Math.max(4, Math.min(96, percentage));

    sliderWrapper.style.setProperty('--split-pos', `${percentage}%`);
  }

  // Pointer & Mouse event listeners
  sliderWrapper.addEventListener('pointerdown', (e) => {
    isDragging = true;
    hasUserInteracted = true;
    sliderWrapper.setPointerCapture(e.pointerId);
    setSliderPosition(e.clientX);
    sliderWrapper.classList.add('dragging');
  });

  window.addEventListener('pointermove', (e) => {
    if (!isDragging) return;
    setSliderPosition(e.clientX);
  });

  window.addEventListener('pointerup', () => {
    if (isDragging) {
      isDragging = false;
      sliderWrapper.classList.remove('dragging');
    }
  });

  sliderWrapper.addEventListener('pointercancel', () => {
    isDragging = false;
    sliderWrapper.classList.remove('dragging');
  });

  // Touch fallback
  sliderWrapper.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      isDragging = true;
      hasUserInteracted = true;
      setSliderPosition(e.touches[0].clientX);
    }
  }, { passive: true });

  window.addEventListener('touchmove', (e) => {
    if (!isDragging || !e.touches.length) return;
    setSliderPosition(e.touches[0].clientX);
  }, { passive: true });

  window.addEventListener('touchend', () => {
    isDragging = false;
  });

  // Initial position: 50%
  sliderWrapper.style.setProperty('--split-pos', '50%');

  // Interactive subtle oscillation hint when scrolled into view
  const autoHintObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting && !hasUserInteracted) {
        autoHintObserver.disconnect();
        let frame = 0;
        const totalFrames = 80;
        
        function oscillate() {
          if (hasUserInteracted || frame >= totalFrames) {
            sliderWrapper.style.setProperty('--split-pos', '50%');
            return;
          }
          frame++;
          // Smooth sine sweep: 50% -> 68% -> 32% -> 50%
          const wave = Math.sin((frame / totalFrames) * Math.PI * 2) * 16;
          sliderWrapper.style.setProperty('--split-pos', `${50 + wave}%`);
          requestAnimationFrame(oscillate);
        }
        setTimeout(() => requestAnimationFrame(oscillate), 400);
      }
    });
  }, { threshold: 0.4 });

  autoHintObserver.observe(sliderWrapper);
}

/* ==========================================================================
   5. Magnetic Cursor Follower & Physical Magnetic Pull on Buttons
   ========================================================================== */
function initMagneticCursorAndPulls() {
  const cursor = document.getElementById('magneticCursor');
  if (!cursor) return;

  let mouseX = -100;
  let mouseY = -100;
  let currentX = -100;
  let currentY = -100;
  let hasMoved = false;

  window.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    if (!hasMoved) {
      hasMoved = true;
      currentX = mouseX;
      currentY = mouseY;
      cursor.style.opacity = '1';
    }
  }, { passive: true });

  document.addEventListener('mouseleave', () => {
    cursor.style.opacity = '0';
  });

  document.addEventListener('mouseenter', () => {
    if (hasMoved) cursor.style.opacity = '1';
  });

  function renderCursor() {
    currentX += (mouseX - currentX) * 0.22;
    currentY += (mouseY - currentY) * 0.22;
    cursor.style.transform = `translate(${currentX}px, ${currentY}px)`;
    requestAnimationFrame(renderCursor);
  }
  renderCursor();

  // Hover target expansiveness
  const interactiveTargets = document.querySelectorAll(
    'a, button, input, select, textarea, .service-card-clean, .work-card-clean, .tool-pill-clean, .check-box-clean, .filter-chip-clean'
  );

  interactiveTargets.forEach((el) => {
    el.addEventListener('mouseenter', () => document.body.classList.add('cursor-hover'));
    el.addEventListener('mouseleave', () => document.body.classList.remove('cursor-hover'));
  });

  // Physical Magnetic Pull for elements marked with .magnetic-item
  const magneticItems = document.querySelectorAll('.magnetic-item');
  magneticItems.forEach((btn) => {
    btn.addEventListener('mousemove', (e) => {
      const rect = btn.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const deltaX = (e.clientX - centerX) * 0.28;
      const deltaY = (e.clientY - centerY) * 0.28;

      btn.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
    });

    btn.addEventListener('mouseleave', () => {
      btn.style.transform = 'translate(0px, 0px)';
      btn.style.transition = 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)';
    });

    btn.addEventListener('mouseenter', () => {
      btn.style.transition = 'transform 0.08s ease-out';
    });
  });
}

/* ==========================================================================
   6. 3D Tilt Physics & Real-Time Specular Glare Reflection
   ========================================================================== */
function init3DTiltAndGlare() {
  const tiltCards = document.querySelectorAll('[data-tilt], #heroCard3d');

  tiltCards.forEach((card) => {
    card.addEventListener('mousemove', (e) => {
      if (card.closest('#servicesGrid') && !card.classList.contains('settled')) return;

      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      const rotateX = ((y - centerY) / centerY) * -6;
      const rotateY = ((x - centerX) / centerX) * 6;

      // Update glare gradient position coordinates
      const glareX = (x / rect.width) * 100;
      const glareY = (y / rect.height) * 100;

      card.style.setProperty('--glare-x', `${glareX}%`);
      card.style.setProperty('--glare-y', `${glareY}%`);

      if (card.closest('#servicesGrid')) {
        card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
      } else {
        card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.015, 1.015, 1.015)`;
      }
    });

    card.addEventListener('mouseleave', () => {
      if (card.closest('#servicesGrid') && !card.classList.contains('settled')) return;
      if (card.closest('#servicesGrid')) {
        card.style.transform = 'translate3d(0, 0, 0) scale(1)';
      } else {
        card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
      }
      card.style.transition = 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)';
    });

    card.addEventListener('mouseenter', () => {
      card.style.transition = 'transform 0.1s ease-out';
    });
  });
}

/* ==========================================================================
   7. Smooth Animated Numerical Counters
   ========================================================================== */
function initAnimatedCounters() {
  const counters = document.querySelectorAll('.counter');
  let hasTriggered = false;

  const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting && !hasTriggered) {
        hasTriggered = true;
        counters.forEach((counter) => {
          const target = parseFloat(counter.getAttribute('data-target'));
          const isDecimal = target % 1 !== 0;
          const duration = 1600;
          const startTime = performance.now();

          function updateCounter(now) {
            const elapsed = Math.min((now - startTime) / duration, 1);
            // EaseOutCubic
            const ease = 1 - Math.pow(1 - elapsed, 3);
            const currentVal = ease * target;

            if (isDecimal) {
              counter.textContent = currentVal.toFixed(1);
            } else {
              counter.textContent = Math.floor(currentVal);
            }

            if (elapsed < 1) {
              requestAnimationFrame(updateCounter);
            } else {
              counter.textContent = target;
            }
          }
          requestAnimationFrame(updateCounter);
        });
      }
    });
  }, { threshold: 0.3 });

  const statStrip = document.querySelector('.hero-stat-strip');
  if (statStrip) counterObserver.observe(statStrip);
}

/* ==========================================================================
   8. 3D Rainbow Arc Curved Portfolio Carousel
   • Parabolic Rainbow Curve: Center card is at peak, side cards curve downwards
   • Center Card Pop-Up: scale 1.14x, razor sharp 0px blur, prominent 3D halo
   • Side Cards: Depth-of-field blurred (matha ellam blur), scaled down, lower opacity
   • Scroll Progression: Glides smoothly through cards as user scrolls down
   • Prev / Next navigation + Dot Indicators + Direct Card Selection
   • Filter Category Direct Jump + Mobile Touch Swipe Support
   ========================================================================== */
function initRainbowPortfolioCarousel() {
  const track = document.getElementById('portfolioTrack');
  const stage = document.getElementById('portfolioRainbowStage');
  const rainbowTrack = document.getElementById('portfolioRainbowTrack');
  const cards = Array.from(document.querySelectorAll('#portfolioRainbowTrack .work-card-clean'));
  const prevBtn = document.getElementById('rainbowPrevBtn');
  const nextBtn = document.getElementById('rainbowNextBtn');
  const dotsContainer = document.getElementById('rainbowDots');
  const filterChips = document.querySelectorAll('.portfolio-filter-row .filter-chip-clean');

  if (!track || !cards.length) return;

  const totalCards = cards.length;
  let activeIndex = 0;
  let currentFloatIndex = 0;

  // Build Pagination Indicator Dots
  if (dotsContainer) {
    dotsContainer.innerHTML = '';
    cards.forEach((_, idx) => {
      const dot = document.createElement('button');
      dot.className = `rainbow-dot ${idx === 0 ? 'active' : ''}`;
      dot.setAttribute('aria-label', `Navigate to project ${idx + 1}`);
      dot.addEventListener('click', (e) => {
        e.stopPropagation();
        scrollToIndex(idx);
      });
      dotsContainer.appendChild(dot);
    });
  }

  const dots = dotsContainer ? Array.from(dotsContainer.querySelectorAll('.rainbow-dot')) : [];

  function getSpacingX() {
    const w = window.innerWidth;
    if (w < 480) return 290;
    if (w < 768) return 330;
    if (w < 1024) return 370;
    return 410; // Generous desktop horizontal spread
  }

  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  // Smooth scroll to target card index
  function scrollToIndex(index) {
    const clampedIndex = clamp(index, 0, totalCards - 1);
    const rect = track.getBoundingClientRect();
    const trackTop = window.scrollY + rect.top;
    const scrollDistance = track.offsetHeight - window.innerHeight;

    if (scrollDistance <= 0) return;

    // Fractional progress needed to center this card:
    const targetProgress = clampedIndex / (totalCards - 1);
    const destY = trackTop + targetProgress * scrollDistance;

    if (window.lenisInstance) {
      window.lenisInstance.scrollTo(destY, { duration: 1.15 });
    } else {
      window.scrollTo({ top: destY, behavior: 'smooth' });
    }
  }

  // Update dots indicator & arrow states
  function updateDots(roundedIdx) {
    dots.forEach((dot, idx) => {
      if (idx === roundedIdx) {
        dot.classList.add('active');
      } else {
        dot.classList.remove('active');
      }
    });

    if (prevBtn) {
      prevBtn.style.opacity = roundedIdx === 0 ? '0.45' : '1';
      prevBtn.style.pointerEvents = roundedIdx === 0 ? 'none' : 'auto';
    }
    if (nextBtn) {
      nextBtn.style.opacity = roundedIdx === totalCards - 1 ? '0.45' : '1';
      nextBtn.style.pointerEvents = roundedIdx === totalCards - 1 ? 'none' : 'auto';
    }
  }

  // Main Render Frame for Rainbow Arc
  function updateRainbowFrame() {
    const rect = track.getBoundingClientRect();
    const scrollDistance = track.offsetHeight - window.innerHeight;

    let progress = 0;
    if (scrollDistance > 0) {
      const rawProgress = -rect.top / scrollDistance;
      progress = clamp(rawProgress, 0, 1);
    }

    currentFloatIndex = progress * (totalCards - 1);
    const roundedIdx = clamp(Math.round(currentFloatIndex), 0, totalCards - 1);
    if (roundedIdx !== activeIndex) {
      activeIndex = roundedIdx;
      updateDots(roundedIdx);
    }

    const spacingX = getSpacingX();

    cards.forEach((card, i) => {
      const d = i - currentFloatIndex; // Relative offset from center
      const absD = Math.abs(d);

      // 1. Horizontal Position along the rainbow span:
      const curX = d * spacingX;

      // 2. Parabolic Rainbow Downward Arc (Center at peak Y=0, sides drop down):
      // Center card has curY = 0 (top peak); d = ±1 drops ~56px; d = ±2 drops ~170px
      const curY = Math.pow(absD, 1.65) * 56;

      // 3. Tangent Rotation along the Rainbow Arch:
      // Left cards tilt counter-clockwise down; right cards tilt clockwise down.
      const rotZ = d * 6.5;

      // 4. 3D Cylindrical Perspective Depth & Yaw Angle:
      const curZ = -Math.pow(absD, 1.25) * 65;
      const rotY = -d * 9.5;

      // 5. POP-UP Scale for Center Card:
      // Center card pops up at 1.14x! Side cards scale down smoothly to ~0.74x.
      const scale = Math.max(0.74, 1.14 - Math.pow(absD, 0.95) * 0.22);

      // 6. Depth of Field Blur:
      // Center card (d=0) is 0px razor sharp. Side cards blur out heavily!
      const blurPx = Math.min(10, Math.pow(absD, 1.3) * 6.2);

      // 7. Opacity Falloff:
      const opacity = Math.max(0.25, 1 - Math.pow(absD, 1.25) * 0.34);

      // 8. Stacking Z-Index:
      const zIndex = Math.round(50 - absD * 10);

      // Apply 3D Transform
      card.style.transform = `translate3d(${curX.toFixed(2)}px, ${curY.toFixed(2)}px, ${curZ.toFixed(2)}px) rotateY(${rotY.toFixed(2)}deg) rotateZ(${rotZ.toFixed(2)}deg) scale(${scale.toFixed(3)})`;
      card.style.filter = blurPx < 0.25 ? 'none' : `blur(${blurPx.toFixed(1)}px)`;
      card.style.opacity = opacity.toFixed(3);
      card.style.zIndex = zIndex;

      // Active card halo styling
      if (absD < 0.45) {
        card.classList.add('rainbow-card-active');
      } else {
        card.classList.remove('rainbow-card-active');
      }
    });
  }

  // Prev / Next Button Controls
  if (prevBtn) {
    prevBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const target = Math.max(0, Math.round(currentFloatIndex) - 1);
      scrollToIndex(target);
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const target = Math.min(totalCards - 1, Math.round(currentFloatIndex) + 1);
      scrollToIndex(target);
    });
  }

  // Direct Card Click: clicking any side card smoothly glides it to center
  cards.forEach((card, idx) => {
    card.addEventListener('click', (e) => {
      // Allow button inside the active card to open modal without intercepting
      if (e.target.closest('.btn-clean-action')) return;

      const diff = Math.abs(idx - currentFloatIndex);
      if (diff >= 0.35) {
        e.preventDefault();
        scrollToIndex(idx);
      }
    });
  });

  // Filter Chips Navigation
  filterChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      filterChips.forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');

      const filterVal = chip.getAttribute('data-filter');
      if (filterVal === 'all') {
        scrollToIndex(0);
      } else {
        const matchIdx = cards.findIndex((c) => c.getAttribute('data-cat') === filterVal);
        if (matchIdx !== -1) {
          scrollToIndex(matchIdx);
        }
      }
    });
  });

  // Touch Swipe Gesture Support on the Stage
  let touchStartX = 0;
  let touchStartY = 0;
  let isSwiping = false;

  if (stage) {
    stage.addEventListener('touchstart', (e) => {
      if (!e.touches || !e.touches[0]) return;
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      isSwiping = true;
    }, { passive: true });

    stage.addEventListener('touchend', (e) => {
      if (!isSwiping || !e.changedTouches || !e.changedTouches[0]) return;
      isSwiping = false;
      const deltaX = e.changedTouches[0].clientX - touchStartX;
      const deltaY = e.changedTouches[0].clientY - touchStartY;

      // Check if horizontal swipe was dominant
      if (Math.abs(deltaX) > 40 && Math.abs(deltaX) > Math.abs(deltaY)) {
        if (deltaX < 0) {
          // Swipe Left -> Next card
          scrollToIndex(Math.min(totalCards - 1, Math.round(currentFloatIndex) + 1));
        } else {
          // Swipe Right -> Prev card
          scrollToIndex(Math.max(0, Math.round(currentFloatIndex) - 1));
        }
      }
    }, { passive: true });
  }

  // Window resize handler
  window.addEventListener('resize', updateRainbowFrame);

  // Scroll listeners (Lenis + Native)
  window.addEventListener('scroll', updateRainbowFrame, { passive: true });
  if (window.lenisInstance) {
    window.lenisInstance.on('scroll', updateRainbowFrame);
  }

  // Initial render
  setTimeout(() => {
    updateRainbowFrame();
    updateDots(0);
  }, 100);
}

/* ==========================================================================
   9. Interactive Scope & Package Estimator
   ========================================================================== */
function initInteractiveScopeEstimator() {
  const checkboxes = document.querySelectorAll('#calcServices input[type="checkbox"]');
  const pkgTierName = document.getElementById('pkgTierName');
  const pkgPriceDisplay = document.getElementById('pkgPriceDisplay');
  const pkgServicesCount = document.getElementById('pkgServicesCount');
  const pkgTimelineDisplay = document.getElementById('pkgTimelineDisplay');

  if (!checkboxes.length) return;

  function recalculateScope() {
    let selectedCount = 0;
    let minBudget = 0;
    let estimatedMaxDays = 4;

    checkboxes.forEach((cb) => {
      const parentLabel = cb.closest('.check-box-clean');
      if (cb.checked) {
        if (parentLabel) parentLabel.classList.add('checked');
        selectedCount++;
        const price = parseInt(cb.getAttribute('data-price'), 10) || 350;
        const days = parseInt(cb.getAttribute('data-days'), 10) || 5;
        minBudget += price;
        if (days > estimatedMaxDays) estimatedMaxDays = days;
      } else {
        if (parentLabel) parentLabel.classList.remove('checked');
      }
    });

    if (selectedCount === 0) {
      if (pkgTierName) pkgTierName.textContent = 'Starter Plan';
      if (pkgPriceDisplay) pkgPriceDisplay.innerHTML = '$350 <small>/ mo</small>';
      if (pkgServicesCount) pkgServicesCount.textContent = 'No services selected';
      if (pkgTimelineDisplay) pkgTimelineDisplay.textContent = '3 - 5 Days';
      return;
    }

    let tierLabel = 'Growth Retainer';
    if (selectedCount === 1) tierLabel = 'Focused Channel Sprint';
    else if (selectedCount >= 4) tierLabel = 'Full-Service Growth Program';

    const maxBudget = Math.round(minBudget * 1.38);

    if (pkgTierName) pkgTierName.textContent = tierLabel;
    if (pkgPriceDisplay) pkgPriceDisplay.innerHTML = `$${minBudget.toLocaleString()} - $${maxBudget.toLocaleString()} <small>/ mo</small>`;
    if (pkgServicesCount) pkgServicesCount.textContent = `${selectedCount} ${selectedCount === 1 ? 'Service' : 'Services'}`;
    if (pkgTimelineDisplay) pkgTimelineDisplay.textContent = `${Math.max(3, estimatedMaxDays - 2)} - ${estimatedMaxDays} Days`;
  }

  checkboxes.forEach((cb) => cb.addEventListener('change', recalculateScope));
  recalculateScope();
}

/* ==========================================================================
   10. Case Study Deep-Dive Modal
   ========================================================================== */
const caseStudyBlueprints = {
  social_viral: {
    title: 'Multi-Platform Organic Growth Campaign',
    badge: '1.2M+ ORGANIC REACH',
    image: 'assets/images/social_viral_doodle.jpg',
    metrics: [
      { num: '1.2M', lbl: 'Organic Impressions' },
      { num: '120k', lbl: 'Engagements' },
      { num: '+380%', lbl: 'Profile Visits' },
      { num: '14.8%', lbl: 'Avg Engagement Rate' },
    ],
    problem: 'The client had strong products but almost no organic traction. Standard product posts averaged under 250 views with minimal engagement.',
    strategy: 'Ran a 30-day content campaign built on trend research, with educational Reels, curiosity-led hooks, illustrated infographics and prompts that start conversation.',
    execution: [
      'Researched trending audio and formats and matched them to the most common audience questions.',
      'Designed high-contrast carousels with hand-drawn elements, increasing saves by 400%.',
      'Wrote opinion-led questions into captions, generating over 1,200 organic comments.',
    ],
  },
  ugc_reel: {
    title: '"Why 90% of Ads Fail in 3 Seconds" UGC Video Ad',
    badge: '4.8x META ADS ROAS',
    image: 'assets/images/ad_ugc_reel.jpg',
    metrics: [
      { num: '48.2%', lbl: '3-Sec Hook Rate' },
      { num: '4.8x', lbl: 'Blended ROAS' },
      { num: '$18.20', lbl: 'CPA Reduction (-64%)' },
      { num: '3.8%', lbl: 'Outbound CTR' },
    ],
    problem: 'The brand was spending $4,500 per month on generic studio ads, resulting in an unsustainable $72 CPA and an 84% viewer drop-off within the first 2 seconds.',
    strategy: 'Produced a UGC-style video opening with the hook "Why 90% of ads fail in 3 seconds", using a cut every 1.4 seconds to hold viewer attention.',
    execution: [
      '0:00 - 0:03: A curiosity-led opening hook that stops the scroll.',
      '0:03 - 0:08: Fast B-roll showing the product and real-world results.',
      '0:08 - 0:15: Customer proof followed by a clear "Shop Now" call to action and offer.',
    ],
  },
  meta_feed: {
    title: 'Apex Pro: Social-Proof Meta Feed Ad',
    badge: 'SCALED TO $80K/MO',
    image: 'assets/images/ad_meta_feed.jpg',
    metrics: [
      { num: '5.2x', lbl: 'Blended ROAS' },
      { num: '$80,000', lbl: 'Monthly Ad Spend' },
      { num: '4.2%', lbl: 'Outbound CTR' },
      { num: '$24.50', lbl: 'Acquisition Cost' },
    ],
    problem: 'This consumer tech product struggled with banner blindness and customer skepticism among cold audiences on Facebook and Instagram.',
    strategy: 'Created a direct-response feed ad that leads with verified 5-star reviews and a clear 30-day money-back guarantee.',
    execution: [
      'Bold typographic hierarchy designed for easy reading in the mobile feed.',
      'A verified-reviews badge (10,000+ reviews) placed prominently above the product image.',
      'A clear call-to-action button sending qualified traffic straight to express checkout.',
    ],
  },
  tiktok_unboxing: {
    title: 'Premium Unboxing Video & Spark Ads Campaign',
    badge: '142K ENGAGEMENTS',
    image: 'assets/images/ad_tiktok_hook.jpg',
    metrics: [
      { num: '142k', lbl: 'Likes & Comments' },
      { num: '5.8x', lbl: 'TikTok Spark ROAS' },
      { num: '1.2M', lbl: 'Direct Video Reach' },
      { num: '-52%', lbl: 'Cost Per Follower' },
    ],
    problem: 'Entering a crowded lifestyle market required fast brand credibility and awareness without the cost of celebrity endorsements.',
    strategy: 'Produced a tactile unboxing video with high-contrast animated subtitles and promoted it through TikTok Spark Ads.',
    execution: [
      'A first-person point of view helps viewers picture owning the product.',
      'Clean unboxing audio makes the video satisfying to watch.',
      'A pinned discount code in the comments drove purchases directly from TikTok.',
    ],
  },
  lander_cro: {
    title: 'Aeterna Luna: Premium Watch Landing Page',
    badge: '+38.4% CONVERSION LIFT',
    image: 'assets/images/ad_lander_cro.jpg',
    metrics: [
      { num: '+38.4%', lbl: 'Conversion Uplift' },
      { num: '$1,430', lbl: 'Average Order Value' },
      { num: '4.6%', lbl: 'Checkout Rate' },
      { num: '1.4s', lbl: 'Page Load Speed' },
    ],
    problem: 'Paid traffic was landing on an unoptimized Shopify product page with a 78% cart abandonment rate.',
    strategy: 'Rebuilt the page mobile-first with trust badges, a clear warranty message and one-tap Apple Pay and Google Pay checkout.',
    execution: [
      'Sticky add-to-cart bar linked directly to the payment gateway.',
      'Craftsmanship credentials above the fold and a verified customer photo gallery.',
      'A/B tested against the original page, with a statistically significant 38.4% conversion increase.',
    ],
  },
};

function initCaseStudyModal() {
  window.openWorkModal = function (key) {
    const data = caseStudyBlueprints[key];
    if (!data) return;

    const modal = document.getElementById('workModal');
    const body = document.getElementById('workModalBody');
    if (!modal || !body) return;

    body.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 14px;">
        <span class="badge-tag" style="margin-bottom: 0;">${data.badge}</span>
      </div>
      <h3 style="font-family: var(--font-heading); font-size: 1.65rem; color: #0f172a; margin-bottom: 20px; line-height: 1.3;">
        ${data.title}
      </h3>

      <div style="height: 320px; border-radius: 18px; overflow: hidden; margin-bottom: 24px; border: 1px solid #e2e8f0; box-shadow: 0 4px 16px rgba(15, 23, 42, 0.06);">
        <img src="${data.image}" alt="${data.title}" style="width: 100%; height: 100%; object-fit: cover;">
      </div>

      <!-- Verified Metrics Strip -->
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; padding: 18px; margin-bottom: 24px; text-align: center;">
        ${data.metrics
          .map(
            (m) => `
          <div>
            <strong style="font-family: var(--font-heading); font-size: 1.35rem; color: #2563eb; display: block; line-height: 1.1;">${m.num}</strong>
            <span style="font-size: 0.72rem; color: #64748b; font-family: var(--font-mono); text-transform: uppercase;">${m.lbl}</span>
          </div>
        `
          )
          .join('')}
      </div>

      <!-- Problem vs Strategy Breakdown -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 22px;">
        <div style="background: #fef2f2; border: 1px solid #fee2e2; border-radius: 14px; padding: 18px;">
          <h4 style="font-family: var(--font-heading); font-size: 0.95rem; color: #dc2626; margin-bottom: 8px;">
            <i class="fa-solid fa-triangle-exclamation"></i> The Challenge
          </h4>
          <p style="font-size: 0.88rem; color: #4b5563; line-height: 1.6;">${data.problem}</p>
        </div>
        <div style="background: #ecfdf5; border: 1px solid #d1fae5; border-radius: 14px; padding: 18px;">
          <h4 style="font-family: var(--font-heading); font-size: 0.95rem; color: #059669; margin-bottom: 8px;">
            <i class="fa-solid fa-bullseye"></i> Our Approach
          </h4>
          <p style="font-size: 0.88rem; color: #4b5563; line-height: 1.6;">${data.strategy}</p>
        </div>
      </div>

      <!-- Execution Points -->
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 20px; margin-bottom: 24px;">
        <h4 style="font-family: var(--font-heading); font-size: 0.95rem; color: #0f172a; margin-bottom: 10px;">
          Key Execution Steps
        </h4>
        <ul style="list-style: disc; padding-left: 20px; font-size: 0.88rem; color: #475569; line-height: 1.7;">
          ${data.execution.map((item) => `<li>${item}</li>`).join('')}
        </ul>
      </div>

      <div style="display: flex; justify-content: flex-end;">
        <a href="#contact" onclick="closeWorkModal()" class="btn-primary-blue btn-sm">
          <span>Discuss a Similar Strategy</span>
          <i class="fa-solid fa-arrow-right"></i>
        </a>
      </div>
    `;

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    if (lenisInstance) lenisInstance.stop();
  };

  window.closeWorkModal = function () {
    const modal = document.getElementById('workModal');
    if (modal) {
      modal.classList.remove('active');
      document.body.style.overflow = 'auto';
      if (lenisInstance) lenisInstance.start();
    }
  };

  const modalBackdrop = document.getElementById('workModal');
  if (modalBackdrop) {
    modalBackdrop.addEventListener('click', (e) => {
      if (e.target === modalBackdrop) closeWorkModal();
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeWorkModal();
    });
  }
}

/* ==========================================================================
   11. Contact Form with Confetti Celebration
   ========================================================================== */
function initAuditContactForm() {
  const form = document.getElementById('contactForm');
  const celebrateBox = document.getElementById('celebrateBox');

  if (!form || !celebrateBox) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    // Trigger Canvas Confetti with Royal Blue & Growth Emerald palette
    if (typeof window.confetti === 'function') {
      window.confetti({
        particleCount: 110,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#2563eb', '#3b82f6', '#059669', '#10b981', '#4f46e5'],
      });
    }

    form.style.display = 'none';
    celebrateBox.classList.add('show');
  });

  window.resetContactForm = function () {
    form.reset();
    form.style.display = 'block';
    celebrateBox.classList.remove('show');
  };
}

/* ==========================================================================
   12. Mobile Navigation Toggle
   ========================================================================== */
function initMobileNavigation() {
  const toggleBtn = document.getElementById('menuToggle');
  const navLinks = document.getElementById('navLinks');

  if (!toggleBtn || !navLinks) return;

  toggleBtn.addEventListener('click', () => {
    navLinks.classList.toggle('active');
  });

  // Close when clicking outside
  document.addEventListener('click', (e) => {
    if (!toggleBtn.contains(e.target) && !navLinks.contains(e.target)) {
      navLinks.classList.remove('active');
    }
  });
}

/* ==========================================================================
   13. Floating Speed Dial & Back to Top
   ========================================================================== */
function initFloatingDock() {
  const scrollTopBtn = document.getElementById('scrollTopBtn');
  if (!scrollTopBtn) return;

  function checkScrollPos() {
    const scrollY = window.scrollY || document.documentElement.scrollTop;
    if (scrollY > 380) {
      scrollTopBtn.classList.add('visible');
    } else {
      scrollTopBtn.classList.remove('visible');
    }
  }

  window.addEventListener('scroll', checkScrollPos, { passive: true });
  if (lenisInstance) lenisInstance.on('scroll', checkScrollPos);

  scrollTopBtn.addEventListener('click', () => {
    if (lenisInstance) {
      lenisInstance.scrollTo(0, { duration: 1.2 });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });
}

/* ==========================================================================
   14. Interactive 3D Card Deck Deal & Flip Architecture
   Master Pop-up Card → Emerge from Behind → Flip in Place → Contents Reveal
   ========================================================================== */
function initServicesDeckFlipAnimation() {
  const track = document.getElementById('servicesTrack');
  const grid = document.getElementById('servicesGrid');
  const cards = document.querySelectorAll('#servicesGrid .service-card-clean');
  const indicator = document.getElementById('deckIndicator');
  const indicatorText = document.getElementById('deckIndicatorText');
  const indicatorBadge = document.getElementById('deckIndicatorBadge');

  if (!track || !grid || !cards.length) return;

  let deltas = [];

  function calculateDeltas() {
    if (window.innerWidth <= 768) {
      cards.forEach((card) => {
        card.style.transform = '';
        card.style.opacity = '1';
        card.style.zIndex = '';
        card.style.boxShadow = '';
        const flipper = card.querySelector('.card-3d-flipper');
        if (flipper) flipper.style.transform = 'rotateY(0deg)';
        const content = card.querySelector('.sc-content-inner');
        if (content) {
          content.style.setProperty('--content-opacity', '1');
          content.style.setProperty('--content-translate', '0px');
        }
        card.classList.add('settled');
      });
      return;
    }

    // Temporarily clear inline transforms to read true resting CSS grid offsets
    cards.forEach((card) => {
      card.style.transform = 'none';
      card.style.transition = 'none';
    });

    const gridW = grid.offsetWidth;
    const gridH = grid.offsetHeight;
    const centerX = gridW / 2;
    const centerY = gridH / 2;

    deltas = Array.from(cards).map((card) => {
      const cardLeft = card.offsetLeft;
      const cardTop = card.offsetTop;
      const cardW = card.offsetWidth;
      const cardH = card.offsetHeight;
      const cardCenterX = cardLeft + cardW / 2;
      const cardCenterY = cardTop + cardH / 2;

      return {
        dx: centerX - cardCenterX,
        dy: centerY - cardCenterY,
      };
    });

    updateFrame();
  }

  function easeInOutQuad(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  function updateFrame() {
    if (window.innerWidth <= 768) return;
    if (!deltas.length) return;

    const rect = track.getBoundingClientRect();
    const scrollDistance = track.offsetHeight - window.innerHeight;
    if (scrollDistance <= 0) return;

    // Normalized progress: 0.0 (top of section) to 1.0 (cards fully settled in grid)
    const rawProgress = -rect.top / scrollDistance;
    const progress = clamp(rawProgress, 0, 1);

    // =========================================================================
    // Stage Division:
    // Stage 1 (0.00 -> 0.16): Single master card pops up in front and center
    // Stage 2 (0.16 -> 0.68): Cards emerge from behind and travel to grid spots
    // Stage 3 (0.68 -> 0.95): Cards flip over in place; contents reveal ONLY after flip!
    // Stage 4 (0.95 -> 1.00): Fully settled grid
    // =========================================================================

    // Update Interactive Progress Indicator Pill
    if (indicatorText && indicatorBadge) {
      if (progress < 0.16) {
        indicatorText.textContent = 'Scroll to explore all 6 services';
        indicatorBadge.textContent = 'Start';
        indicatorBadge.style.background = 'var(--color-blue-subtle)';
        indicatorBadge.style.color = 'var(--color-blue)';
      } else if (progress < 0.68) {
        const dealPct = Math.round(((progress - 0.16) / (0.68 - 0.16)) * 100);
        indicatorText.textContent = 'Loading services...';
        indicatorBadge.textContent = `${dealPct}% Dealt`;
        indicatorBadge.style.background = 'rgba(79, 70, 229, 0.12)';
        indicatorBadge.style.color = 'var(--color-indigo)';
      } else if (progress < 0.95) {
        indicatorText.textContent = 'Revealing details...';
        indicatorBadge.textContent = 'Revealing';
        indicatorBadge.style.background = 'rgba(217, 119, 6, 0.12)';
        indicatorBadge.style.color = 'var(--color-amber)';
      } else {
        indicatorText.textContent = 'All 6 services';
        indicatorBadge.textContent = 'Complete';
        indicatorBadge.style.background = 'var(--color-emerald-subtle)';
        indicatorBadge.style.color = 'var(--color-emerald)';
      }
    }

    cards.forEach((card, index) => {
      const delta = deltas[index] || { dx: 0, dy: 0 };
      const flipper = card.querySelector('.card-3d-flipper');
      const content = card.querySelector('.sc-content-inner');

      let curX = 0;
      let curY = 0;
      let curZ = 0;
      let scale = 1.0;
      let opacity = 1.0;
      let shadowBlur = 24;
      let shadowY = 10;
      let shadowAlpha = 0.08;
      let flipAngle = 180; // 180deg = Back face (Logo + Glare); 0deg = Front face (Content)
      let contentOpacity = 0;
      let contentTranslate = 16;

      if (progress < 0.16) {
        // -------------------------------------------------------------------
        // STAGE 1: Single Master Card Popped Up in Front and Center
        // -------------------------------------------------------------------
        if (index === 0) {
          // Card 0: Popped up in front and center with automatic glare
          curX = delta.dx;
          curY = delta.dy;
          curZ = 85;
          scale = 1.08;
          opacity = 1.0;
          card.style.zIndex = 20;
          shadowY = 25;
          shadowBlur = 60;
          shadowAlpha = 0.22;
        } else {
          // Cards 1-5: Tucked directly behind Card 0 in center
          curX = delta.dx;
          curY = delta.dy;
          curZ = -12 * index;
          scale = 0.95;
          opacity = 0; // Hidden directly behind Card 0
          card.style.zIndex = 10 - index;
          shadowY = 10;
          shadowBlur = 20;
          shadowAlpha = 0.04;
        }

        flipAngle = 180; // Facing back: showing logo + auto glare
        contentOpacity = 0;
        card.classList.remove('settled');

      } else if (progress < 0.68) {
        // -------------------------------------------------------------------
        // STAGE 2: Emerge from Behind Master Card and Travel to Grid Slots
        // (All cards showing their Back Logo Faces while traveling)
        // -------------------------------------------------------------------
        const dealProgress = (progress - 0.16) / (0.68 - 0.16);

        if (index === 0) {
          // Card 0 un-pops from 85px to 0px, scale 1.08 to 1.0, and glides to slot 1
          const ease = easeInOutQuad(dealProgress);
          curX = delta.dx * (1 - ease);
          curY = delta.dy * (1 - ease);
          curZ = 85 * (1 - ease);
          scale = 1.08 - 0.08 * ease;
          opacity = 1.0;
          card.style.zIndex = 15;
          shadowY = Math.round(25 - 15 * ease);
          shadowBlur = Math.round(60 - 36 * ease);
          shadowAlpha = 0.22 - 0.14 * ease;
        } else {
          // Cards 1-5 emerge from behind Card 0 and fly to their grid slots
          const cStart = (index - 1) * 0.10;
          const cEnd = Math.min(1.0, cStart + 0.60);
          const localT = clamp((dealProgress - cStart) / (cEnd - cStart), 0, 1);
          const ease = easeInOutQuad(localT);

          curX = delta.dx * (1 - ease);
          curY = delta.dy * (1 - ease);
          const flightArc = Math.sin(localT * Math.PI) * 35;
          curZ = -12 * (1 - ease) + flightArc;
          scale = 0.95 + 0.05 * ease;
          opacity = clamp(localT * 2.5, 0, 1);
          card.style.zIndex = 12 - index;
          shadowY = Math.round(10 + flightArc * 0.3);
          shadowBlur = Math.round(20 + flightArc * 0.5);
          shadowAlpha = 0.06 + flightArc * 0.002;
        }

        // STILL facing back: showing logo + auto glare while traveling!
        flipAngle = 180;
        contentOpacity = 0;
        card.classList.remove('settled');

      } else if (progress < 0.95) {
        // -------------------------------------------------------------------
        // STAGE 3: Cards are in Place! Now Flip 180° and Reveal Contents!
        // -------------------------------------------------------------------
        const flipProgress = (progress - 0.68) / (0.95 - 0.68);

        // Cards are positioned on the grid: no translation popup!
        curX = 0;
        curY = 0;
        curZ = 0;
        scale = 1.0;
        opacity = 1.0;
        card.style.zIndex = 10;
        shadowY = 12;
        shadowBlur = 28;
        shadowAlpha = 0.07;

        // Wave stagger for 3D card flip
        const fStart = index * 0.07;
        const fEnd = Math.min(1.0, fStart + 0.58);
        const localFlip = clamp((flipProgress - fStart) / (fEnd - fStart), 0, 1);
        const flipEase = easeInOutCubic(localFlip);

        // 3D Flip from 180deg (Back Face) to 0deg (Front Face)
        flipAngle = 180 - flipEase * 180;

        // ONLY AFTER THE FLIP TURNS FACE-UP (flipEase >= 0.5), REVEAL CONTENTS!
        if (flipEase >= 0.5) {
          const contentT = (flipEase - 0.5) / 0.5;
          contentOpacity = contentT;
          contentTranslate = (1 - contentT) * 16;
        } else {
          contentOpacity = 0;
          contentTranslate = 16;
        }

        if (localFlip >= 0.98) {
          card.classList.add('settled');
        } else {
          card.classList.remove('settled');
        }

      } else {
        // -------------------------------------------------------------------
        // STAGE 4: Fully Settled Grid! All Front Faces Active and Readable!
        // -------------------------------------------------------------------
        curX = 0;
        curY = 0;
        curZ = 0;
        scale = 1.0;
        opacity = 1.0;
        card.style.zIndex = 5;
        flipAngle = 0;
        contentOpacity = 1;
        contentTranslate = 0;
        shadowY = 10;
        shadowBlur = 24;
        shadowAlpha = 0.06;
        card.classList.add('settled');
      }

      // Apply transforms
      card.style.transform = `translate3d(${curX.toFixed(2)}px, ${curY.toFixed(2)}px, ${curZ.toFixed(2)}px) scale(${scale.toFixed(3)})`;
      card.style.opacity = opacity.toFixed(3);
      card.style.boxShadow = `0 ${shadowY}px ${shadowBlur}px rgba(15, 23, 42, ${shadowAlpha})`;

      if (flipper) {
        flipper.style.transform = `rotateY(${flipAngle.toFixed(1)}deg)`;
      }

      if (content) {
        content.style.setProperty('--content-opacity', contentOpacity.toFixed(3));
        content.style.setProperty('--content-translate', `${contentTranslate.toFixed(1)}px`);
      }
    });
  }

  // Initial calculation with slight timeout for layout render
  setTimeout(calculateDeltas, 160);
  window.addEventListener('resize', calculateDeltas);

  // Sync with scroll & Lenis
  window.addEventListener('scroll', updateFrame, { passive: true });
  if (window.lenisInstance) {
    window.lenisInstance.on('scroll', updateFrame);
  }

  // Interactive Click to Auto-Unfold / Refold
  if (indicator) {
    indicator.addEventListener('click', () => {
      const rect = track.getBoundingClientRect();
      const scrollDistance = track.offsetHeight - window.innerHeight;
      const rawProgress = -rect.top / scrollDistance;

      if (rawProgress < 0.85) {
        // Scroll to settled position
        const targetScroll = track.offsetTop + scrollDistance * 0.97;
        if (window.lenisInstance) {
          window.lenisInstance.scrollTo(targetScroll, { duration: 1.6 });
        } else {
          window.scrollTo({ top: targetScroll, behavior: 'smooth' });
        }
      } else {
        // Scroll back to popup deck top
        const targetScroll = track.offsetTop;
        if (window.lenisInstance) {
          window.lenisInstance.scrollTo(targetScroll, { duration: 1.6 });
        } else {
          window.scrollTo({ top: targetScroll, behavior: 'smooth' });
        }
      }
    });
  }
}


/* ==========================================================================
   Estimator card: starts tilted back (lying down) and stands upright as you scroll
   ========================================================================== */
function initEstimatorStandUp() {
  const section = document.getElementById('calculator');
  const target = section && section.querySelector('.container');
  if (!target) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const NAV_GAP = 105;          // card parks just under the floating menu
  target.style.transformOrigin = '50% 100%';
  target.style.willChange = 'transform, opacity';

  let current = 0;
  let goal = 0;
  let running = false;
  let pinned = false;
  let pinDist = 0;
  // sticky can only travel inside its parent's content box, so the extra scroll room is a spacer, not padding
  const spacer = document.createElement('div');
  spacer.setAttribute('aria-hidden', 'true');
  target.insertAdjacentElement('afterend', spacer);

  function setupPin() {
    const vh = window.innerHeight;
    pinned = window.innerWidth > 768 && target.offsetHeight <= vh - NAV_GAP - 24;
    if (pinned) {
      pinDist = vh * 0.6;
      target.style.position = 'sticky';
      target.style.top = NAV_GAP + 'px';
      spacer.style.height = pinDist + 'px';
    } else {
      pinDist = 0;
      target.style.position = '';
      target.style.top = '';
      spacer.style.height = '0px';
    }
  }

  function readGoal() {
    const vh = window.innerHeight;
    if (pinned) {
      // natural (un-stuck) top of the card; keeps decreasing while the card is parked under the menu
      const padTop = parseFloat(getComputedStyle(section).paddingTop) || 100;
      const natural = section.getBoundingClientRect().top + padTop;
      goal = Math.max(0, Math.min(1, (vh - natural) / (vh - NAV_GAP + pinDist * 0.7)));
    } else {
      const top = target.getBoundingClientRect().top;
      goal = Math.max(0, Math.min(1, (vh - top) / (vh * 0.85)));
    }
  }

  function draw() {
    const e = current * current * (3 - 2 * current);
    if (current >= 0.999) {
      target.style.transform = 'none';
      target.style.opacity = '1';
      return;
    }
    const maxAngle = window.innerWidth <= 768 ? 45 : 70;
    target.style.transform = 'perspective(1600px) rotateX(' + ((1 - e) * maxAngle).toFixed(2) + 'deg) translateY(' + ((1 - e) * 70).toFixed(1) + 'px) scale(' + (0.9 + 0.1 * e).toFixed(4) + ')';
    target.style.opacity = (0.25 + 0.75 * Math.min(1, e * 1.4)).toFixed(3);
  }

  function frame() {
    current += (goal - current) * 0.075;
    if (Math.abs(goal - current) < 0.0005) current = goal;
    draw();
    if (current !== goal) requestAnimationFrame(frame);
    else running = false;
  }

  function kick() {
    readGoal();
    if (!running) { running = true; requestAnimationFrame(frame); }
  }

  function onResize() { setupPin(); kick(); }

  window.addEventListener('scroll', kick, { passive: true });
  window.addEventListener('resize', onResize);
  setupPin();
  readGoal();
  current = goal;
  draw();
}
