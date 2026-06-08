// === Preloader ===
const preloader = document.getElementById('preloader');
if (preloader) {
    window.addEventListener('load', () => {
        setTimeout(() => preloader.classList.add('hidden'), 1600);
    });
}

// === Custom Cursor Glow ===
const cursorGlow = document.getElementById('cursor-glow');
let cursorX = 0, cursorY = 0, glowX = 0, glowY = 0;

document.addEventListener('mousemove', (e) => {
    cursorX = e.clientX;
    cursorY = e.clientY;
});

function animateCursor() {
    glowX += (cursorX - glowX) * 0.08;
    glowY += (cursorY - glowY) * 0.08;
    if (cursorGlow) {
        cursorGlow.style.left = glowX + 'px';
        cursorGlow.style.top = glowY + 'px';
    }
    requestAnimationFrame(animateCursor);
}
animateCursor();

// === Smooth Scroll Engine (Lenis-style) ===
let scrollTarget = null;
let isScrolling = false;

function smoothScrollTo(targetY, duration) {
    const startY = window.pageYOffset;
    const diff = targetY - startY;
    let startTime = null;
    isScrolling = true;

    function easeOutExpo(t) {
        return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
    }

    function step(currentTime) {
        if (!startTime) startTime = currentTime;
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = easeOutExpo(progress);

        window.scrollTo(0, startY + diff * eased);

        if (progress < 1) {
            requestAnimationFrame(step);
        } else {
            isScrolling = false;
        }
    }

    requestAnimationFrame(step);
}

// === Navigation ===
const nav = document.getElementById('nav');

window.addEventListener('scroll', () => {
    if (nav) nav.classList.toggle('scrolled', window.scrollY > 50);
});

// Smooth anchor click
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
        e.preventDefault();
        const href = anchor.getAttribute('href');
        if (href === '#') return;
        const target = document.querySelector(href);
        if (target) {
            const offset = 80;
            const targetY = target.getBoundingClientRect().top + window.pageYOffset - offset;
            smoothScrollTo(targetY, 1200);
        }
    });
});

// === Mobile menu ===
const navToggle = document.getElementById('nav-toggle');
const navLinks = document.getElementById('nav-links');

navToggle.addEventListener('click', () => {
    navToggle.classList.toggle('active');
    navLinks.classList.toggle('active');
});

navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
        navToggle.classList.remove('active');
        navLinks.classList.remove('active');
    });
});

// === Floating Particles ===
const particlesContainer = document.getElementById('particles');
if (particlesContainer) {
    for (let i = 0; i < 35; i++) {
        const particle = document.createElement('div');
        particle.classList.add('particle');
        particle.style.left = Math.random() * 100 + '%';
        particle.style.animationDelay = Math.random() * 8 + 's';
        particle.style.animationDuration = (5 + Math.random() * 7) + 's';
        particle.style.width = (1 + Math.random() * 2) + 'px';
        particle.style.height = particle.style.width;
        particlesContainer.appendChild(particle);
    }
}

// === 3D Tilt Effect ===
const tiltCards = document.querySelectorAll('.service-card, .pricing-card, .feature-card, .testimonial-card, .process-step, .demo-feature-card, .firm-benefit-card, .capability-card');

tiltCards.forEach(card => {
    let tiltRAF = null;
    let targetRotateX = 0, targetRotateY = 0;
    let currentRotateX = 0, currentRotateY = 0;

    card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        targetRotateX = (y - centerY) / centerY * -6;
        targetRotateY = (x - centerX) / centerX * 6;

        card.style.setProperty('--mouse-x', x + 'px');
        card.style.setProperty('--mouse-y', y + 'px');

        if (!tiltRAF) {
            tiltRAF = requestAnimationFrame(function animate() {
                currentRotateX += (targetRotateX - currentRotateX) * 0.1;
                currentRotateY += (targetRotateY - currentRotateY) * 0.1;

                card.style.transform = `perspective(800px) rotateX(${currentRotateX}deg) rotateY(${currentRotateY}deg) scale3d(1.01, 1.01, 1.01)`;

                if (Math.abs(targetRotateX - currentRotateX) > 0.01 ||
                    Math.abs(targetRotateY - currentRotateY) > 0.01) {
                    tiltRAF = requestAnimationFrame(animate);
                } else {
                    tiltRAF = null;
                }
            });
        }
    });

    card.addEventListener('mouseleave', () => {
        targetRotateX = 0;
        targetRotateY = 0;

        if (tiltRAF) {
            cancelAnimationFrame(tiltRAF);
            tiltRAF = null;
        }

        // Smooth return
        let returnRAF;
        function returnToNormal() {
            currentRotateX += (0 - currentRotateX) * 0.08;
            currentRotateY += (0 - currentRotateY) * 0.08;

            card.style.transform = `perspective(800px) rotateX(${currentRotateX}deg) rotateY(${currentRotateY}deg) scale3d(1, 1, 1)`;

            if (Math.abs(currentRotateX) > 0.01 || Math.abs(currentRotateY) > 0.01) {
                returnRAF = requestAnimationFrame(returnToNormal);
            } else {
                card.style.transform = '';
            }
        }
        returnRAF = requestAnimationFrame(returnToNormal);
    });
});

// === Scroll Reveal Animations ===
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
        }
    });
}, { threshold: 0.08, rootMargin: '0px 0px -60px 0px' });

document.querySelectorAll(
    '.service-card, .process-step, .feature-card, .pricing-card, .testimonial-card, .section-header, .cta-content'
).forEach((el, i) => {
    el.classList.add('fade-in');
    // Staggered delay within each group
    const parent = el.parentElement;
    const siblings = Array.from(parent.children).filter(c => c.classList.contains(el.classList[0]));
    const index = siblings.indexOf(el);
    el.style.transitionDelay = (index * 0.1) + 's';
    observer.observe(el);
});

// === Counter Animation ===
const statNumbers = document.querySelectorAll('.hero-stat-number');
const statsObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const el = entry.target;
            const text = el.textContent.trim();
            const num = parseInt(text);
            if (!isNaN(num)) {
                const suffix = text.replace(/[0-9]/g, '');
                let current = 0;
                const duration = 1500;
                const startTime = performance.now();

                function countUp(now) {
                    const elapsed = now - startTime;
                    const progress = Math.min(elapsed / duration, 1);
                    // Ease out expo
                    const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
                    current = Math.round(num * eased);
                    el.textContent = current + suffix;
                    if (progress < 1) requestAnimationFrame(countUp);
                }
                requestAnimationFrame(countUp);
            }
            statsObserver.unobserve(el);
        }
    });
}, { threshold: 0.5 });

statNumbers.forEach(stat => statsObserver.observe(stat));

// === Parallax Hero ===
const heroContent = document.querySelector('.hero-content');
let parallaxRAF = null;

function updateParallax() {
    if (heroContent && window.pageYOffset < window.innerHeight) {
        const scrolled = window.pageYOffset;
        heroContent.style.transform = `translateY(${scrolled * 0.2}px)`;
        heroContent.style.opacity = Math.max(0, 1 - scrolled / 600);
    }
}

window.addEventListener('scroll', () => {
    if (!parallaxRAF) {
        parallaxRAF = requestAnimationFrame(() => {
            updateParallax();
            parallaxRAF = null;
        });
    }
});

// === Magnetic Buttons ===
document.querySelectorAll('.btn-gold, .nav-cta').forEach(btn => {
    btn.addEventListener('mousemove', (e) => {
        const rect = btn.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        btn.style.transform = `translate(${x * 0.15}px, ${y * 0.15}px) scale(1.03)`;
    });

    btn.addEventListener('mouseleave', () => {
        btn.style.transform = '';
    });
});

// === FAQ Accordion ===
document.querySelectorAll('.faq-question').forEach(btn => {
    btn.addEventListener('click', () => {
        const item = btn.parentElement;
        const isOpen = item.classList.contains('open');

        // Close all
        document.querySelectorAll('.faq-item.open').forEach(openItem => {
            openItem.classList.remove('open');
            openItem.querySelector('.faq-question').setAttribute('aria-expanded', 'false');
        });

        // Open clicked (if it wasn't already open)
        if (!isOpen) {
            item.classList.add('open');
            btn.setAttribute('aria-expanded', 'true');
        }
    });
});

// === Demo Modal ===
const demoModal = document.getElementById('demo-modal');
const demoModalBody = document.getElementById('demo-modal-body');
const demoModalClose = document.getElementById('demo-modal-close');
const demoModalBackdrop = document.getElementById('demo-modal-backdrop');

function openDemoModal(url, type) {
    if (!demoModal || !demoModalBody) return;
    demoModalBody.innerHTML = '<div class="demo-loading">Loading demo...</div>';
    demoModal.classList.add('active');
    document.body.style.overflow = 'hidden';

    if (type === 'image') {
        const img = new Image();
        img.onload = () => { demoModalBody.innerHTML = ''; demoModalBody.appendChild(img); };
        img.onerror = () => { demoModalBody.innerHTML = '<div class="demo-loading">Failed to load image</div>'; };
        img.src = url;
        img.alt = 'Demo preview';
    } else {
        const iframe = document.createElement('iframe');
        iframe.src = url;
        iframe.allow = 'autoplay; encrypted-media';
        iframe.allowFullscreen = true;
        iframe.onload = () => { demoModalBody.querySelector('.demo-loading')?.remove(); };
        demoModalBody.innerHTML = '';
        demoModalBody.appendChild(iframe);
    }
}

function closeDemoModal() {
    if (!demoModal) return;
    demoModal.classList.remove('active');
    document.body.style.overflow = '';
    setTimeout(() => { if (demoModalBody) demoModalBody.innerHTML = ''; }, 400);
}

document.querySelectorAll('[data-demo]').forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openDemoModal(btn.dataset.demo, btn.dataset.type || 'video');
    });
});

if (demoModalClose) demoModalClose.addEventListener('click', closeDemoModal);
if (demoModalBackdrop) demoModalBackdrop.addEventListener('click', closeDemoModal);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDemoModal(); });

// === Form Submissions ===
document.querySelectorAll('.kz-form').forEach(form => {
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const formId = form.id;
        const successId = formId.replace('-form', '-success');
        const successEl = document.getElementById(successId);
        if (successEl) {
            form.style.display = 'none';
            successEl.style.display = 'block';
            window.scrollTo({ top: successEl.offsetTop - 120, behavior: 'smooth' });
        }
    });
});

// === Scroll reveal for new card types ===
document.querySelectorAll(
    '.demo-feature-card, .firm-benefit-card, .form-info-card, .form-card, .capability-card, .benefit-card, .solution-feature'
).forEach((el, i) => {
    el.classList.add('fade-in');
    const parent = el.parentElement;
    const className = el.classList[0];
    const siblings = Array.from(parent.children).filter(c => c.classList.contains(className));
    const index = siblings.indexOf(el);
    el.style.transitionDelay = (index * 0.1) + 's';
    observer.observe(el);
});

// === 3D tilt for process timeline cards ===
document.querySelectorAll('.process-timeline-card').forEach(card => {
    card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        card.style.setProperty('--mouse-x', (e.clientX - rect.left) + 'px');
        card.style.setProperty('--mouse-y', (e.clientY - rect.top) + 'px');
    });
});
