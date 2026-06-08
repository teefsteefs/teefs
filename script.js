// === Preloader ===
window.addEventListener('load', () => {
    setTimeout(() => {
        document.getElementById('preloader').classList.add('hidden');
    }, 1600);
});

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
const navLinksEl = document.querySelectorAll('.nav-link');
const navIndicator = document.getElementById('nav-indicator');
const sections = document.querySelectorAll('section[id]');

// Scroll effect on nav
let lastScrollY = 0;
window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 50);
    lastScrollY = window.scrollY;
});

// Active section tracking with indicator
function updateActiveNav() {
    let current = '';
    sections.forEach(section => {
        const top = section.offsetTop - 120;
        if (window.scrollY >= top) {
            current = section.getAttribute('id');
        }
    });

    navLinksEl.forEach(link => {
        link.classList.remove('active');
        if (link.dataset.section === current) {
            link.classList.add('active');
            // Move indicator
            const rect = link.getBoundingClientRect();
            const navRect = link.parentElement.getBoundingClientRect();
            navIndicator.style.left = (rect.left - navRect.left) + 'px';
            navIndicator.style.width = rect.width + 'px';
            navIndicator.classList.add('active');
        }
    });

    if (!current) {
        navIndicator.classList.remove('active');
    }
}

window.addEventListener('scroll', updateActiveNav);
updateActiveNav();

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
const tiltCards = document.querySelectorAll('.service-card, .pricing-card, .feature-card, .testimonial-card, .process-step');

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
