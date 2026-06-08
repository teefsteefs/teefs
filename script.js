// === Navigation scroll effect ===
const nav = document.getElementById('nav');
window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 50);
});

// === Mobile menu toggle ===
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

// === Floating particles ===
const particlesContainer = document.getElementById('particles');
if (particlesContainer) {
    for (let i = 0; i < 30; i++) {
        const particle = document.createElement('div');
        particle.classList.add('particle');
        particle.style.left = Math.random() * 100 + '%';
        particle.style.animationDelay = Math.random() * 8 + 's';
        particle.style.animationDuration = (6 + Math.random() * 6) + 's';
        particlesContainer.appendChild(particle);
    }
}

// === 3D Tilt Effect on Cards ===
const tiltCards = document.querySelectorAll('.service-card, .pricing-card, .feature-card, .testimonial-card');

tiltCards.forEach(card => {
    card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const rotateX = (y - centerY) / centerY * -8;
        const rotateY = (x - centerX) / centerX * 8;

        card.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
        card.style.setProperty('--mouse-x', x + 'px');
        card.style.setProperty('--mouse-y', y + 'px');
    });

    card.addEventListener('mouseleave', () => {
        card.style.transform = '';
    });
});

// === Scroll animations ===
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
        }
    });
}, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

document.querySelectorAll(
    '.service-card, .process-step, .feature-card, .pricing-card, .testimonial-card, .section-header, .cta-content'
).forEach((el, i) => {
    el.classList.add('fade-in');
    el.style.transitionDelay = (i % 6) * 0.1 + 's';
    observer.observe(el);
});

// === Counter animation for hero stats ===
const statNumbers = document.querySelectorAll('.hero-stat-number');
const statsObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const el = entry.target;
            const text = el.textContent;
            const num = parseInt(text);
            if (!isNaN(num)) {
                let current = 0;
                const suffix = text.replace(/[0-9]/g, '');
                const step = Math.ceil(num / 40);
                const timer = setInterval(() => {
                    current += step;
                    if (current >= num) {
                        current = num;
                        clearInterval(timer);
                    }
                    el.textContent = current + suffix;
                }, 30);
            }
            statsObserver.unobserve(el);
        }
    });
}, { threshold: 0.5 });

statNumbers.forEach(stat => statsObserver.observe(stat));

// === Smooth scroll for anchor links ===
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
        e.preventDefault();
        const target = document.querySelector(anchor.getAttribute('href'));
        if (target) {
            const offset = 80;
            const top = target.getBoundingClientRect().top + window.pageYOffset - offset;
            window.scrollTo({ top, behavior: 'smooth' });
        }
    });
});

// === Parallax on hero section ===
const heroContent = document.querySelector('.hero-content');
window.addEventListener('scroll', () => {
    if (heroContent) {
        const scrolled = window.pageYOffset;
        heroContent.style.transform = `translateY(${scrolled * 0.15}px)`;
        heroContent.style.opacity = 1 - scrolled / 800;
    }
});
