/* NOTE: HTML pages load js/main.min.js. After editing this file, re-minify:
   npx esbuild js/main.js --minify --outfile=js/main.min.js */
// Mobile Nav Toggle
const navToggle = document.querySelector('.nav-toggle');
const navLinks = document.querySelector('.nav-links');

if (navToggle && navLinks) {
  navToggle.addEventListener('click', () => {
    navToggle.classList.toggle('active');
    navLinks.classList.toggle('open');
  });

  navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      navToggle.classList.remove('active');
      navLinks.classList.remove('open');
    });
  });
}

// FAQ Accordion
document.querySelectorAll('.faq-question').forEach(button => {
  button.addEventListener('click', () => {
    const item = button.closest('.faq-item');
    const answer = item.querySelector('.faq-answer');
    const isActive = item.classList.contains('active');

    document.querySelectorAll('.faq-item.active').forEach(openItem => {
      if (openItem !== item) {
        openItem.classList.remove('active');
        openItem.querySelector('.faq-answer').style.maxHeight = null;
      }
    });

    item.classList.toggle('active');
    if (!isActive) {
      answer.style.maxHeight = answer.scrollHeight + 'px';
    } else {
      answer.style.maxHeight = null;
    }
  });
});

// Scroll Progress Bar + Nav Shadow
const scrollProgress = document.getElementById('scrollProgress');
const nav = document.querySelector('.nav');

window.addEventListener('scroll', () => {
  const scrollTop = window.scrollY;

  // Progress bar
  if (scrollProgress) {
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    scrollProgress.style.width = progress + '%';
  }

  // Nav shadow on scroll
  if (nav) {
    nav.classList.toggle('scrolled', scrollTop > 10);
  }
}, { passive: true });

// Scroll-based Fade-In & Stagger-In Animations
const animEls = document.querySelectorAll('.fade-in, .stagger-in');

if (animEls.length > 0) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -40px 0px'
  });

  animEls.forEach(el => observer.observe(el));
}

// Feature Showcase Carousel
const showcaseCards = document.querySelectorAll('.showcase-card');
const showcaseDots = document.querySelectorAll('.showcase-dot');
const showcaseScreen = document.querySelector('.showcase-screen');
let currentFeature = 0;
let autoplayTimer = null;

const featureLabels = [
  'Pet Weather Scene',
  'Forecast View',
  'Morning Report',
  'Home Screen Widget'
];

function setActiveFeature(index) {
  showcaseCards.forEach(c => c.classList.remove('active'));
  showcaseDots.forEach(d => d.classList.remove('active'));

  if (showcaseCards[index]) showcaseCards[index].classList.add('active');
  if (showcaseDots[index]) showcaseDots[index].classList.add('active');

  // Update phone screen placeholder
  if (showcaseScreen) {
    const label = showcaseScreen.querySelector('.placeholder-label');
    if (label) {
      label.style.opacity = '0';
      setTimeout(() => {
        label.textContent = featureLabels[index] || 'App Screenshot';
        label.style.opacity = '1';
      }, 150);
    }
  }

  currentFeature = index;
}

function startAutoplay() {
  stopAutoplay();
  autoplayTimer = setInterval(() => {
    const next = (currentFeature + 1) % showcaseCards.length;
    setActiveFeature(next);
  }, 4000);
}

function stopAutoplay() {
  if (autoplayTimer) {
    clearInterval(autoplayTimer);
    autoplayTimer = null;
  }
}

if (showcaseCards.length > 0) {
  showcaseCards.forEach((card, i) => {
    card.addEventListener('click', () => {
      stopAutoplay();
      setActiveFeature(i);
      // Restart autoplay after user interaction
      setTimeout(startAutoplay, 8000);
    });
  });

  showcaseDots.forEach((dot, i) => {
    dot.addEventListener('click', () => {
      stopAutoplay();
      setActiveFeature(i);
      setTimeout(startAutoplay, 8000);
    });
  });

  setActiveFeature(0);
  startAutoplay();
}

// CTA Physics Engine
const ctaPhysics = document.getElementById('ctaPhysics');

if (ctaPhysics) {
  const GRAVITY = 0.17;
  const BOUNCE = 0.45;
  const FRICTION = 0.98;
  const items = [];
  let started = false;
  let rafId = null;
  let lastTime = 0;

  const templates = [
    { type: 'widget-small', html: '<img src="images/widget-sm-1.png" alt="Widget">' },
    { type: 'widget-small', html: '<img src="images/widget-sm-2.png" alt="Widget">' },
    { type: 'widget-small', html: '<img src="images/widget-sm-3.png" alt="Widget">' },
    { type: 'widget-medium', html: '<img src="images/widget-md-1.png" alt="Widget">' },
    { type: 'widget-medium', html: '<img src="images/widget-md-2.png" alt="Widget">' },
    { type: 'widget-medium', html: '<img src="images/widget-md-3.png" alt="Widget">' },
    { type: 'widget-medium', html: '<img src="images/widget-md-4.png" alt="Widget">' },
    { type: 'notification', html: '<img src="images/logo.png" alt="" class="notif-app-icon"><span class="notif-text"><span class="notif-header"><span class="notif-app-name">WEATHERPETS</span><span class="notif-time">now</span></span><span class="notif-title">Good morning!</span><span class="notif-body">It\'s 72° and sunny — perfect day for a walk</span></span>' },
    { type: 'notification', html: '<img src="images/logo.png" alt="" class="notif-app-icon"><span class="notif-text"><span class="notif-header"><span class="notif-app-name">WEATHERPETS</span><span class="notif-time">2m ago</span></span><span class="notif-title">Severe Weather Alert</span><span class="notif-body">Thunderstorm warning until 6pm in your area</span></span>' },
    { type: 'notification', html: '<img src="images/logo.png" alt="" class="notif-app-icon"><span class="notif-text"><span class="notif-header"><span class="notif-app-name">WEATHERPETS</span><span class="notif-time">15m ago</span></span><span class="notif-title">Rain incoming</span><span class="notif-body">Rain starting in 15 minutes — grab an umbrella!</span></span>' },
    { type: 'notification', html: '<img src="images/logo.png" alt="" class="notif-app-icon"><span class="notif-text"><span class="notif-header"><span class="notif-app-name">WEATHERPETS</span><span class="notif-time">7:00 AM</span></span><span class="notif-title">Morning Report</span><span class="notif-body">Chilly start at 34°, warming up to 65° by noon</span></span>' },
    { type: 'widget-small', html: '<img src="images/widget-sm-1.png" alt="Widget">' },
  ];

  function spawnItem(template, delay) {
    setTimeout(() => {
      const rect = ctaPhysics.getBoundingClientRect();
      const el = document.createElement('div');
      el.className = 'physics-item ' + template.type;
      el.innerHTML = template.html;
      ctaPhysics.appendChild(el);

      const w = template.type === 'widget-small' ? 90 : template.type === 'widget-medium' ? 170 : 280;
      const h = template.type === 'widget-small' ? 90 : template.type === 'widget-medium' ? 174 : 76;

      const item = {
        el,
        x: Math.random() * (rect.width - w),
        y: -h - Math.random() * 100,
        vx: (Math.random() - 0.5) * 3,
        vy: Math.random() * 2,
        w,
        h,
        rotation: (Math.random() - 0.5) * 20,
        vr: (Math.random() - 0.5) * 2,
        settled: 0,
      };

      items.push(item);
    }, delay);
  }

  function tick(now) {
    // Frame-rate independent step: normalize to a 60fps baseline so the
    // animation runs at the same speed on 60Hz and 120Hz (ProMotion) displays.
    // Without this, a 120Hz refresh applies gravity twice as often and the
    // assets fall ~2x faster and flicker. Clamp dt so a tab-switch hitch
    // cannot teleport everything in one giant step.
    if (!lastTime) lastTime = now;
    let dt = (now - lastTime) / (1000 / 60);
    lastTime = now;
    if (dt > 3) dt = 3;

    const rect = ctaPhysics.getBoundingClientRect();
    const killY = rect.height * 1.3;
    const wallR = rect.width;
    const friction = Math.pow(FRICTION, dt);

    for (const item of items) {
      item.vy += GRAVITY * dt;
      item.vx *= friction;
      item.vr *= friction;

      item.x += item.vx * dt;
      item.y += item.vy * dt;
      item.rotation += item.vr * dt;

      // Walls — gentle nudge back
      if (item.x < 0) {
        item.x = 0;
        item.vx *= -BOUNCE;
      }
      if (item.x + item.w > wallR) {
        item.x = wallR - item.w;
        item.vx *= -BOUNCE;
      }

      // Reset when fallen past bottom
      if (item.y > killY) {
        item.y = -item.h - Math.random() * 150;
        item.x = Math.random() * (wallR - item.w);
        item.vy = Math.random() * 2;
        item.vx = (Math.random() - 0.5) * 3;
        item.rotation = (Math.random() - 0.5) * 20;
        item.vr = (Math.random() - 0.5) * 2;
      }

      item.el.style.transform = `translate(${item.x}px, ${item.y}px) rotate(${item.rotation}deg)`;
    }

    rafId = requestAnimationFrame(tick);
  }

  // Start the loop only once; guard against a second rAF chain ever spawning
  // (double loops were the other source of the "everything speeds up" glitch).
  function start() {
    if (rafId !== null) return;
    lastTime = 0;
    rafId = requestAnimationFrame(tick);
  }

  // Trigger when CTA section enters viewport
  const ctaObserver = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && !started) {
      started = true;
      templates.forEach((t, i) => spawnItem(t, i * 220));
      start();
      ctaObserver.disconnect();
    }
  }, { threshold: 0.2 });

  ctaObserver.observe(ctaPhysics.parentElement);
}

/* ===== Blog index: search + tag filter + sort ===== */
(function () {
  var grid = document.querySelector('.blog-grid');
  var search = document.getElementById('blogSearch');
  if (!grid || !search) return;
  var sort = document.getElementById('blogSort');
  var count = document.getElementById('blogFilterCount');
  var chips = Array.prototype.slice.call(document.querySelectorAll('#blogFilter .cw-filter-tag'));
  var cards = Array.prototype.slice.call(grid.querySelectorAll('.blog-card'));
  var activeTag = '';

  function apply() {
    var q = search.value.trim().toLowerCase();
    var shown = 0;
    cards.forEach(function (card) {
      var tags = (card.getAttribute('data-tags') || '').split(' ');
      var text = card.textContent.toLowerCase();
      var okTag = !activeTag || tags.indexOf(activeTag) !== -1;
      var okQ = !q || text.indexOf(q) !== -1 || tags.join(' ').indexOf(q) !== -1;
      var show = okTag && okQ;
      card.style.display = show ? '' : 'none';
      if (show) shown++;
    });
    if (count) count.textContent = shown === cards.length ? '' : 'Showing ' + shown + ' of ' + cards.length + ' articles';
  }

  function resort() {
    var mode = sort ? sort.value : 'new';
    var sorted = cards.slice().sort(function (a, b) {
      if (mode === 'az') return a.querySelector('h2').textContent.localeCompare(b.querySelector('h2').textContent);
      var da = a.getAttribute('data-date') || '', db = b.getAttribute('data-date') || '';
      return mode === 'old' ? da.localeCompare(db) : db.localeCompare(da);
    });
    sorted.forEach(function (c) { grid.appendChild(c); });
  }

  chips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      activeTag = chip.getAttribute('data-tag') || '';
      chips.forEach(function (c) { c.classList.toggle('active', c === chip); });
      if (history.replaceState) {
        history.replaceState(null, '', activeTag ? '?tag=' + activeTag : location.pathname);
      }
      apply();
    });
  });
  search.addEventListener('input', apply);
  if (sort) sort.addEventListener('change', resort);

  // deep link: ?tag=heat
  var m = location.search.match(/[?&]tag=([a-z-]+)/);
  if (m) {
    var target = chips.filter(function (c) { return c.getAttribute('data-tag') === m[1]; })[0];
    if (target) target.click();
  }
})();

/* ===== Weather hub: city search ===== */
(function () {
  var search = document.getElementById('citySearch');
  if (!search) return;
  var count = document.getElementById('cityFilterCount');
  var cards = Array.prototype.slice.call(document.querySelectorAll('.cw-city-card'));
  var groups = Array.prototype.slice.call(document.querySelectorAll('.cw-hub-group'));
  search.addEventListener('input', function () {
    var q = search.value.trim().toLowerCase();
    var shown = 0;
    cards.forEach(function (card) {
      var hay = card.getAttribute('data-search') || card.textContent.toLowerCase();
      var show = !q || hay.indexOf(q) !== -1;
      card.style.display = show ? '' : 'none';
      if (show) shown++;
    });
    groups.forEach(function (g) {
      var any = Array.prototype.some.call(g.querySelectorAll('.cw-city-card'), function (c) { return c.style.display !== 'none'; });
      g.style.display = any ? '' : 'none';
    });
    if (count) count.textContent = !q ? '' : 'Showing ' + shown + ' of ' + cards.length + ' cities';
  });
})();
