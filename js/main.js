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
  const GRAVITY = 0.25;
  const BOUNCE = 0.45;
  const FRICTION = 0.98;
  const items = [];
  let started = false;

  const templates = [
    { type: 'widget-small', html: '<span class="widget-temp">72°</span><span class="widget-cond">Sunny</span>' },
    { type: 'widget-small', html: '<span class="widget-temp">58°</span><span class="widget-cond">Cloudy</span>' },
    { type: 'widget-small', html: '<span class="widget-temp">34°</span><span class="widget-cond">Snow</span>' },
    { type: 'widget-medium', html: '<span class="widget-temp">72° Sunny</span><span class="widget-cond">High 78° · Low 61°</span>' },
    { type: 'widget-medium', html: '<span class="widget-temp">45° Rainy</span><span class="widget-cond">Grab an umbrella</span>' },
    { type: 'notification', html: '<span class="notif-icon">&#128054;</span><span class="notif-text"><span class="notif-title">WeatherPets</span><span class="notif-body">Good morning! It\'s 72° and sunny today</span></span>' },
    { type: 'notification', html: '<span class="notif-icon">&#127786;</span><span class="notif-text"><span class="notif-title">Severe Weather</span><span class="notif-body">Thunderstorm warning until 6pm</span></span>' },
    { type: 'notification', html: '<span class="notif-icon">&#128054;</span><span class="notif-text"><span class="notif-title">WeatherPets</span><span class="notif-body">Rain starting in 15 minutes!</span></span>' },
    { type: 'widget-small', html: '<span class="widget-temp">88°</span><span class="widget-cond">Hot</span>' },
    { type: 'notification', html: '<span class="notif-icon">&#9749;</span><span class="notif-text"><span class="notif-title">Morning Report</span><span class="notif-body">Chilly start, warming up to 65°</span></span>' },
    { type: 'widget-medium', html: '<span class="widget-temp">28° Snowy</span><span class="widget-cond">Bundle up today!</span>' },
    { type: 'widget-small', html: '<span class="widget-temp">63°</span><span class="widget-cond">Windy</span>' },
  ];

  function spawnItem(template, delay) {
    setTimeout(() => {
      const rect = ctaPhysics.getBoundingClientRect();
      const el = document.createElement('div');
      el.className = 'physics-item ' + template.type;
      el.innerHTML = template.html;
      ctaPhysics.appendChild(el);

      const w = template.type === 'widget-small' ? 72 : template.type === 'widget-medium' ? 156 : 220;
      const h = template.type === 'notification' ? 48 : 72;

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

  function tick() {
    const rect = ctaPhysics.getBoundingClientRect();
    const killY = rect.height * 1.3;
    const wallR = rect.width;

    for (const item of items) {
      item.vy += GRAVITY;
      item.vx *= FRICTION;
      item.vr *= FRICTION;

      item.x += item.vx;
      item.y += item.vy;
      item.rotation += item.vr;

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

    requestAnimationFrame(tick);
  }

  // Trigger when CTA section enters viewport
  const ctaObserver = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && !started) {
      started = true;
      templates.forEach((t, i) => spawnItem(t, i * 180));
      requestAnimationFrame(tick);
      ctaObserver.disconnect();
    }
  }, { threshold: 0.2 });

  ctaObserver.observe(ctaPhysics.parentElement);
}
