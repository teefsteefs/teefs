// === Preloader ===
const preloader = document.getElementById('preloader');
if (preloader) {
    window.addEventListener('load', () => {
        setTimeout(() => preloader.classList.add('hidden'), 1600);
    });
}

// === Auto-scroll to booking form on demo page ===
window.addEventListener('load', () => {
    const demoBooking = document.getElementById('demo-booking');
    if (demoBooking) {
        setTimeout(() => {
            demoBooking.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 1800);
    }
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

if (navToggle && navLinks) {
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
}

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

// === Form Submissions → n8n Webhook ===
const WEBHOOK_URL = 'https://n8n.kaiizen.ai/webhook/cc13b194-8606-4514-9f3f-ebe8d5c1ebc4';

document.querySelectorAll('.kz-form').forEach(form => {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formId = form.id;
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>Sending...</span>';

        const formData = new FormData(form);
        const data = { form_type: formId.replace('-form', '') };
        formData.forEach((value, key) => { data[key] = value; });

        try {
            await fetch(WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
        } catch (err) {
            // Still show success — webhook may have CORS restrictions but data was sent
        }

        const successId = formId.replace('-form', '-success');
        const successEl = document.getElementById(successId);
        if (successEl) {
            const scrollTarget = form.parentElement;
            form.style.display = 'none';
            successEl.style.display = 'block';
            scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
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

// === Scroll-triggered section headers ===
document.querySelectorAll('.split-section, .section-showcase-img, .audit-cta, .scaling-highlight').forEach((el) => {
    el.classList.add('fade-in');
    observer.observe(el);
});

// === Smooth parallax for split images on scroll ===
const splitImages = document.querySelectorAll('.split-image img');
if (splitImages.length) {
    let splitRAF = null;
    window.addEventListener('scroll', () => {
        if (!splitRAF) {
            splitRAF = requestAnimationFrame(() => {
                splitImages.forEach(img => {
                    const rect = img.getBoundingClientRect();
                    if (rect.top < window.innerHeight && rect.bottom > 0) {
                        const progress = (window.innerHeight - rect.top) / (window.innerHeight + rect.height);
                        const translateY = (progress - 0.5) * -20;
                        img.style.transform = `translateY(${translateY}px) scale(1.02)`;
                    }
                });
                splitRAF = null;
            });
        }
    });
}

// === Image Accordion ===
const imgAccordion = document.getElementById('img-accordion');
if (imgAccordion) {
    const items = imgAccordion.querySelectorAll('.img-accordion-item');
    items.forEach(item => {
        item.addEventListener('mouseenter', () => {
            items.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
        });
    });
}

// === 3D tilt for process timeline cards ===
document.querySelectorAll('.process-timeline-card').forEach(card => {
    card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        card.style.setProperty('--mouse-x', (e.clientX - rect.left) + 'px');
        card.style.setProperty('--mouse-y', (e.clientY - rect.top) + 'px');
    });
});

// === Chat & Booking Widget ===
(function () {
    const CHAT_URL = 'https://n8n.kaiizen.ai/webhook/kaiizenknowledge';
    const SLOTS_URL = 'https://n8n.kaiizen.ai/webhook/calendar_slots';
    const BOOK_URL = 'https://n8n.kaiizen.ai/webhook/calendar_set_appointment';

    const fab = document.createElement('button');
    fab.className = 'kz-widget-fab';
    fab.setAttribute('aria-label', 'Open chat');
    fab.innerHTML = '<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z"/><path d="M7 9h2v2H7zm4 0h2v2h-2zm4 0h2v2h-2z"/></svg>';

    const panel = document.createElement('div');
    panel.className = 'kz-widget-panel';
    panel.innerHTML = `
        <div class="kz-widget-tabs">
            <button class="kz-widget-tab active" data-tab="chat">Chat with AI</button>
            <button class="kz-widget-tab" data-tab="book">Book a Call</button>
        </div>
        <div class="kz-chat-view active" id="kz-chat-view">
            <div class="kz-chat-messages" id="kz-chat-messages">
                <div class="kz-chat-msg bot">Hi! I'm Kaiizen AI assistant. How can I help you today?</div>
            </div>
            <div class="kz-chat-input-row">
                <input type="text" class="kz-chat-input" id="kz-chat-input" placeholder="Type a message..." autocomplete="off">
                <button class="kz-chat-send" id="kz-chat-send" aria-label="Send">
                    <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
                </button>
            </div>
        </div>
        <div class="kz-book-view" id="kz-book-view">
            <div class="kz-book-scroll" id="kz-book-scroll">
                <div class="kz-book-loading">Loading available slots<span class="kz-typing-dots"><span></span><span></span><span></span></span></div>
            </div>
        </div>
    `;

    document.body.appendChild(panel);
    document.body.appendChild(fab);

    const chatView = panel.querySelector('#kz-chat-view');
    const bookView = panel.querySelector('#kz-book-view');
    const msgContainer = panel.querySelector('#kz-chat-messages');
    const chatInput = panel.querySelector('#kz-chat-input');
    const chatSend = panel.querySelector('#kz-chat-send');
    const bookScroll = panel.querySelector('#kz-book-scroll');
    const tabs = panel.querySelectorAll('.kz-widget-tab');

    let isOpen = false;
    let chatBusy = false;
    let selectedSlot = null;
    let slotsLoaded = false;

    fab.addEventListener('click', () => {
        isOpen = !isOpen;
        panel.classList.toggle('open', isOpen);
        fab.classList.toggle('open', isOpen);
        if (isOpen) {
            fab.innerHTML = '<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>';
            chatInput.focus();
        } else {
            fab.innerHTML = '<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z"/><path d="M7 9h2v2H7zm4 0h2v2h-2zm4 0h2v2h-2z"/></svg>';
        }
    });

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const target = tab.dataset.tab;
            chatView.classList.toggle('active', target === 'chat');
            bookView.classList.toggle('active', target === 'book');
            if (target === 'book' && !slotsLoaded) loadSlots();
            if (target === 'chat') chatInput.focus();
        });
    });

    function addMsg(text, cls) {
        const div = document.createElement('div');
        div.className = 'kz-chat-msg ' + cls;
        div.textContent = text;
        msgContainer.appendChild(div);
        msgContainer.scrollTop = msgContainer.scrollHeight;
        return div;
    }

    function addTyping() {
        const div = document.createElement('div');
        div.className = 'kz-chat-msg typing';
        div.innerHTML = '<span class="kz-typing-dots"><span></span><span></span><span></span></span>';
        msgContainer.appendChild(div);
        msgContainer.scrollTop = msgContainer.scrollHeight;
        return div;
    }

    async function sendChat() {
        const text = chatInput.value.trim();
        if (!text || chatBusy) return;

        addMsg(text, 'user');
        chatInput.value = '';
        chatBusy = true;
        chatSend.disabled = true;

        const typing = addTyping();

        try {
            const res = await fetch(CHAT_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text })
            });
            const data = await res.json();
            typing.remove();
            const reply = data.output || data.response || data.message || data.text || data.answer || (typeof data === 'string' ? data : JSON.stringify(data));
            addMsg(reply, 'bot');
        } catch (err) {
            typing.remove();
            addMsg('Sorry, I couldn\'t connect. Please try again.', 'bot');
        }

        chatBusy = false;
        chatSend.disabled = false;
        chatInput.focus();
    }

    chatSend.addEventListener('click', sendChat);
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); }
    });

    async function loadSlots() {
        slotsLoaded = true;
        bookScroll.innerHTML = '<div class="kz-book-loading">Loading available slots<span class="kz-typing-dots"><span></span><span></span><span></span></span></div>';

        try {
            const res = await fetch(SLOTS_URL, {
                method: 'GET',
                headers: { 'Accept': 'application/json' }
            });
            const data = await res.json();
            renderSlots(data);
        } catch (err) {
            bookScroll.innerHTML = '<div class="kz-slots-empty">Could not load slots. Please try again later.</div>';
            slotsLoaded = false;
        }
    }

    function renderSlots(data) {
        // Handle format: { "2026-06-09": { "available": ["09:00", ...], "busy": [...] }, ... }
        const grouped = {};
        let hasSlots = false;

        if (Array.isArray(data)) {
            data.forEach(s => {
                const date = s.date || (s.start && s.start.split('T')[0]) || 'Available';
                const time = s.time || (s.start && s.start.split('T')[1]?.substring(0, 5)) || s.slot || '';
                if (!grouped[date]) grouped[date] = [];
                grouped[date].push(time);
                hasSlots = true;
            });
        } else if (data && typeof data === 'object') {
            for (const [key, val] of Object.entries(data)) {
                if (val && Array.isArray(val.available) && val.available.length) {
                    grouped[key] = val.available;
                    hasSlots = true;
                } else if (Array.isArray(val) && val.length) {
                    grouped[key] = val;
                    hasSlots = true;
                }
            }
        }

        if (!hasSlots) {
            bookScroll.innerHTML = '<div class="kz-slots-empty">No available slots at the moment. Please check back later.</div>';
            return;
        }

        let html = '<div class="kz-slots-label">Select a time slot</div>';
        for (const [date, times] of Object.entries(grouped)) {
            html += `<div class="kz-slots-date-group"><div class="kz-slots-date-title">${formatDate(date)}</div><div class="kz-slots-grid">`;
            times.forEach(time => {
                html += `<button class="kz-slot-btn" data-date="${date}" data-time="${time}">${time}</button>`;
            });
            html += '</div></div>';
        }

        html += `
            <div class="kz-book-form" id="kz-book-form" style="display:none;">
                <div class="kz-book-selected" id="kz-book-selected-label"></div>
                <input type="text" id="kz-book-name" placeholder="Full Name" required>
                <input type="email" id="kz-book-email" placeholder="Email" required>
                <input type="tel" id="kz-book-phone" placeholder="Phone" required>
                <textarea id="kz-book-notes" placeholder="Notes (optional)"></textarea>
                <button class="kz-book-submit" id="kz-book-submit">Confirm Booking</button>
                <div class="kz-book-error" id="kz-book-error" style="display:none;"></div>
            </div>
        `;

        bookScroll.innerHTML = html;

        bookScroll.querySelectorAll('.kz-slot-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                bookScroll.querySelectorAll('.kz-slot-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                selectedSlot = { date: btn.dataset.date, time: btn.dataset.time };
                const form = bookScroll.querySelector('#kz-book-form');
                const label = bookScroll.querySelector('#kz-book-selected-label');
                label.textContent = formatDate(selectedSlot.date) + ' at ' + selectedSlot.time;
                form.style.display = 'flex';
                form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            });
        });

        const submitBtn = bookScroll.querySelector('#kz-book-submit');
        if (submitBtn) submitBtn.addEventListener('click', submitBooking);
    }

    function formatDate(dateStr) {
        try {
            const d = new Date(dateStr + 'T00:00:00');
            return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        } catch { return dateStr; }
    }

    async function submitBooking() {
        if (!selectedSlot) return;

        const name = bookScroll.querySelector('#kz-book-name').value.trim();
        const email = bookScroll.querySelector('#kz-book-email').value.trim();
        const phone = bookScroll.querySelector('#kz-book-phone').value.trim();
        const notes = bookScroll.querySelector('#kz-book-notes').value.trim();
        const errEl = bookScroll.querySelector('#kz-book-error');
        const submitBtn = bookScroll.querySelector('#kz-book-submit');

        if (!name || !email || !phone) {
            errEl.textContent = 'Please fill in name, email, and phone.';
            errEl.style.display = 'block';
            return;
        }

        errEl.style.display = 'none';
        submitBtn.disabled = true;
        submitBtn.textContent = 'Booking...';

        try {
            await fetch(BOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, phone, notes, date: selectedSlot.date, time: selectedSlot.time })
            });

            bookScroll.innerHTML = `
                <div class="kz-book-success">
                    <div class="kz-success-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                    </div>
                    <h4>Booking Confirmed!</h4>
                    <p>${formatDate(selectedSlot.date)} at ${selectedSlot.time}<br>We'll send a confirmation to ${email}</p>
                </div>
            `;
        } catch (err) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Confirm Booking';
            errEl.textContent = 'Could not complete booking. Please try again.';
            errEl.style.display = 'block';
        }
    }
})();

// === Voice Command + Music Player ===
(function () {
    // --- Music Player DOM ---
    const musicPlayer = document.createElement('div');
    musicPlayer.className = 'kz-music-player';
    musicPlayer.innerHTML = `
        <div class="kz-music-header" id="kz-music-drag">
            <div class="kz-music-header-title">
                <svg viewBox="0 0 24 24"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                Music Player
            </div>
            <div class="kz-music-controls">
                <button class="kz-music-ctrl-btn close-btn" id="kz-music-close" aria-label="Close">
                    <svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
            </div>
        </div>
        <div class="kz-music-search">
            <input type="text" id="kz-music-input" placeholder="Search a song..." autocomplete="off">
            <button id="kz-music-search-btn" aria-label="Search">
                <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" stroke="#0a0a0a" stroke-width="2" fill="none"/><line x1="21" y1="21" x2="16.65" y2="16.65" stroke="#0a0a0a" stroke-width="2"/></svg>
            </button>
        </div>
        <div class="kz-music-frame" id="kz-music-frame"></div>
        <div class="kz-music-now" id="kz-music-now">
            <div class="kz-eq-bars"><span></span><span></span><span></span><span></span></div>
            <span id="kz-music-now-text">Now playing...</span>
        </div>
    `;
    document.body.appendChild(musicPlayer);

    // --- AI Agent Panel ---
    const agentPanel = document.createElement('div');
    agentPanel.className = 'kz-agent-panel';
    agentPanel.innerHTML = `
        <div class="kz-agent-header" id="kz-agent-drag">
            <div class="kz-agent-header-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                <span>AI Agent</span>
                <span class="kz-agent-status" id="kz-agent-status">Ready</span>
            </div>
            <div class="kz-agent-controls">
                <button class="kz-agent-ctrl-btn" id="kz-agent-close" aria-label="Close">
                    <svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
            </div>
        </div>
        <div class="kz-agent-query" id="kz-agent-query"></div>
        <div class="kz-agent-log" id="kz-agent-log"></div>
        <div class="kz-agent-results" id="kz-agent-results"></div>
    `;
    document.body.appendChild(agentPanel);

    const agentLog = agentPanel.querySelector('#kz-agent-log');
    const agentResults = agentPanel.querySelector('#kz-agent-results');
    const agentQuery = agentPanel.querySelector('#kz-agent-query');
    const agentStatus = agentPanel.querySelector('#kz-agent-status');
    const agentClose = agentPanel.querySelector('#kz-agent-close');
    let agentOpen = false;

    function openAgentPanel(query) {
        agentOpen = true;
        agentPanel.classList.add('open');
        agentLog.innerHTML = '';
        agentResults.innerHTML = '';
        agentQuery.textContent = query;
        agentStatus.textContent = 'Working';
        agentStatus.className = 'kz-agent-status working';
    }

    function closeAgentPanel() {
        agentOpen = false;
        agentPanel.classList.remove('open');
    }

    function agentAddStep(text, type) {
        const step = document.createElement('div');
        step.className = 'kz-agent-step ' + (type || '');
        const icon = type === 'done' ? '<svg viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>'
            : type === 'error' ? '<svg viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>'
            : '<svg viewBox="0 0 24 24" fill="none" stroke="var(--gold)" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>';
        step.innerHTML = '<span class="kz-step-icon">' + icon + '</span><span class="kz-step-text">' + text + '</span>';
        agentLog.appendChild(step);
        agentLog.scrollTop = agentLog.scrollHeight;
    }

    function escHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

    function detectSearchType(q) {
        const t = q.toLowerCase();
        if (t.match(/github|repo|repository|open\s*source/)) return 'github';
        if (t.match(/youtube|video|watch/)) return 'youtube';
        return 'web';
    }

    async function searchGitHub(query) {
        agentAddStep('Detected: GitHub search');
        await new Promise(r => setTimeout(r, 300));

        const isTrending = query.toLowerCase().match(/trending|popular|hot|top|best/);
        let apiUrl;
        if (isTrending) {
            const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
            apiUrl = 'https://api.github.com/search/repositories?q=stars:>100+created:>' + weekAgo + '&sort=stars&order=desc&per_page=8';
            agentAddStep('Searching trending repos this week...');
        } else {
            const terms = query.replace(/(?:github|repo|repository|find|search|on)\s*/gi, '').trim() || query;
            apiUrl = 'https://api.github.com/search/repositories?q=' + encodeURIComponent(terms) + '&sort=stars&order=desc&per_page=8';
            agentAddStep('Searching GitHub for "' + escHtml(terms) + '"...');
        }

        await new Promise(r => setTimeout(r, 400));
        const res = await fetch(apiUrl);
        const data = await res.json();

        if (data.items && data.items.length > 0) {
            agentAddStep('Found ' + data.items.length + ' repositories', 'done');
            let html = '';
            for (const repo of data.items) {
                const stars = repo.stargazers_count >= 1000 ? (repo.stargazers_count / 1000).toFixed(1) + 'k' : repo.stargazers_count;
                html += '<a class="kz-agent-result-item" href="' + escHtml(repo.html_url) + '" target="_blank" rel="noopener">';
                html += '<div class="kz-agent-result-title">' + escHtml(repo.full_name) + ' <span style="color:var(--text-secondary);font-weight:400;font-size:0.72rem">&#9733; ' + stars + '</span></div>';
                html += '<div class="kz-agent-result-desc">' + escHtml(repo.description || 'No description') + '</div>';
                if (repo.language) html += '<div style="font-size:0.7rem;color:var(--gold);margin-top:3px">' + escHtml(repo.language) + '</div>';
                html += '</a>';
            }
            agentResults.innerHTML = html;
        } else {
            agentAddStep('No repositories found', 'error');
            agentResults.innerHTML = '<div class="kz-agent-answer">No matching repositories found. Try different keywords.</div>';
        }
    }

    async function searchYouTube(query) {
        agentAddStep('Detected: YouTube search');
        await new Promise(r => setTimeout(r, 300));
        const terms = query.replace(/(?:youtube|video|watch|find|search)\s*/gi, '').trim() || query;
        agentAddStep('Searching YouTube for "' + escHtml(terms) + '"...');

        const res = await fetch('/api/youtube/?q=' + encodeURIComponent(terms));
        const data = await res.json();

        if (Array.isArray(data) && data.length > 0) {
            agentAddStep('Found ' + data.length + ' videos', 'done');
            let html = '';
            for (const v of data) {
                html += '<a class="kz-agent-result-item" href="https://www.youtube.com/watch?v=' + escHtml(v.videoId) + '" target="_blank" rel="noopener">';
                html += '<div class="kz-agent-result-title">' + escHtml(v.title) + '</div>';
                html += '<div class="kz-agent-result-desc" style="color:var(--gold)">Click to watch on YouTube</div>';
                html += '</a>';
            }
            agentResults.innerHTML = html;
        } else {
            agentAddStep('No videos found', 'error');
        }
    }

    async function searchWeb(query) {
        agentAddStep('Detected: Web search');
        await new Promise(r => setTimeout(r, 300));
        agentAddStep('Searching the web for "' + escHtml(query) + '"...');

        const res = await fetch('/api/websearch/?q=' + encodeURIComponent(query));
        const data = await res.json();

        if (Array.isArray(data) && data.length > 0) {
            agentAddStep('Found ' + data.length + ' results', 'done');
            await new Promise(r => setTimeout(r, 300));
            agentAddStep('AI is reading and summarizing...');

            const context = data.slice(0, 5).map(r => r.title + ': ' + (r.description || '')).join('\n');
            const aiPrompt = 'Based on these web search results, give a direct concise answer to: "' + query + '"\n\nSearch results:\n' + context + '\n\nAnswer directly in 2-3 sentences. Do not mention Kaiizen AI or suggest services.';

            try {
                const aiRes = await fetch('https://n8n.kaiizen.ai/webhook/kaiizenknowledge', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: aiPrompt })
                });
                const aiData = await aiRes.json();
                const answer = aiData.output || aiData.answer || aiData.message || '';

                agentAddStep('Answer ready', 'done');

                let html = '<div class="kz-agent-answer">' + escHtml(answer) + '</div>';
                html += '<div class="kz-agent-sources-label">Sources</div>';
                for (const item of data.slice(0, 4)) {
                    html += '<a class="kz-agent-source" href="' + escHtml(item.url || '#') + '" target="_blank" rel="noopener">';
                    html += escHtml(item.title || 'Source');
                    html += '</a>';
                }
                agentResults.innerHTML = html;
            } catch {
                let html = '';
                for (const item of data) {
                    html += '<a class="kz-agent-result-item" href="' + escHtml(item.url || '#') + '" target="_blank" rel="noopener">';
                    html += '<div class="kz-agent-result-title">' + escHtml(item.title || 'Result') + '</div>';
                    if (item.description) html += '<div class="kz-agent-result-desc">' + escHtml(item.description) + '</div>';
                    html += '</a>';
                }
                agentResults.innerHTML = html;
            }
        } else {
            agentAddStep('No results found', 'error');
            agentResults.innerHTML = '<div class="kz-agent-answer">No results found for this query.</div>';
        }
    }

    async function agentSearch(query) {
        openAgentPanel(query);
        agentAddStep('Received: "' + escHtml(query) + '"');
        await new Promise(r => setTimeout(r, 400));

        const type = detectSearchType(query);
        agentAddStep('Analyzing query...');
        await new Promise(r => setTimeout(r, 300));

        try {
            if (type === 'github') {
                await searchGitHub(query);
            } else if (type === 'youtube') {
                await searchYouTube(query);
            } else {
                await searchWeb(query);
            }

            agentAddStep('Task complete', 'done');
            agentStatus.textContent = 'Done';
            agentStatus.className = 'kz-agent-status done';

        } catch (err) {
            agentAddStep('Error: ' + err.message, 'error');
            agentStatus.textContent = 'Error';
            agentStatus.className = 'kz-agent-status error';
            agentResults.innerHTML = '<div class="kz-agent-answer" style="color:#f87171">Something went wrong. Please try again.</div>';
        }
    }

    agentClose.addEventListener('click', closeAgentPanel);

    // Draggable agent panel
    const agentDragHandle = agentPanel.querySelector('#kz-agent-drag');
    let agentDragging = false, agentDragX = 0, agentDragY = 0;

    agentDragHandle.addEventListener('mousedown', (e) => {
        agentDragging = true;
        const rect = agentPanel.getBoundingClientRect();
        agentDragX = e.clientX - rect.left;
        agentDragY = e.clientY - rect.top;
        agentPanel.style.transition = 'none';
    });
    document.addEventListener('mousemove', (e) => {
        if (!agentDragging) return;
        agentPanel.style.left = Math.max(0, Math.min(e.clientX - agentDragX, window.innerWidth - agentPanel.offsetWidth)) + 'px';
        agentPanel.style.top = Math.max(0, Math.min(e.clientY - agentDragY, window.innerHeight - agentPanel.offsetHeight)) + 'px';
        agentPanel.style.bottom = 'auto';
        agentPanel.style.right = 'auto';
    });
    document.addEventListener('mouseup', () => { if (agentDragging) { agentDragging = false; agentPanel.style.transition = ''; } });

    agentDragHandle.addEventListener('touchstart', (e) => {
        agentDragging = true;
        const t = e.touches[0], rect = agentPanel.getBoundingClientRect();
        agentDragX = t.clientX - rect.left;
        agentDragY = t.clientY - rect.top;
        agentPanel.style.transition = 'none';
    }, { passive: true });
    document.addEventListener('touchmove', (e) => {
        if (!agentDragging) return;
        const t = e.touches[0];
        agentPanel.style.left = Math.max(0, Math.min(t.clientX - agentDragX, window.innerWidth - agentPanel.offsetWidth)) + 'px';
        agentPanel.style.top = Math.max(0, Math.min(t.clientY - agentDragY, window.innerHeight - agentPanel.offsetHeight)) + 'px';
        agentPanel.style.bottom = 'auto';
        agentPanel.style.right = 'auto';
    }, { passive: true });
    document.addEventListener('touchend', () => { agentDragging = false; agentPanel.style.transition = ''; });

    // --- Voice Button ---
    const voiceFab = document.createElement('button');
    voiceFab.className = 'kz-voice-fab';
    voiceFab.setAttribute('aria-label', 'Voice command');
    voiceFab.innerHTML = '<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>';
    document.body.appendChild(voiceFab);

    // --- Language Toggle ---
    let voiceLang = 'en-US';
    const langBtn = document.createElement('button');
    langBtn.className = 'kz-lang-toggle';
    langBtn.textContent = 'EN';
    langBtn.setAttribute('aria-label', 'Toggle voice language');
    langBtn.addEventListener('click', () => {
        if (voiceLang === 'en-US') {
            voiceLang = 'vi-VN';
            langBtn.textContent = 'VI';
        } else {
            voiceLang = 'en-US';
            langBtn.textContent = 'EN';
        }
        if (recognition) recognition.lang = voiceLang;
    });
    document.body.appendChild(langBtn);

    // --- Voice Toast ---
    const voiceToast = document.createElement('div');
    voiceToast.className = 'kz-voice-toast';
    voiceToast.innerHTML = '<div class="kz-voice-heard"><span id="kz-voice-text">...</span></div><div class="kz-voice-action" id="kz-voice-action"></div>';
    document.body.appendChild(voiceToast);

    // --- Music Player Logic ---
    const musicInput = musicPlayer.querySelector('#kz-music-input');
    const musicSearchBtn = musicPlayer.querySelector('#kz-music-search-btn');
    const musicFrame = musicPlayer.querySelector('#kz-music-frame');
    const musicNow = musicPlayer.querySelector('#kz-music-now');
    const musicNowText = musicPlayer.querySelector('#kz-music-now-text');
    const musicClose = musicPlayer.querySelector('#kz-music-close');
    let musicOpen = false;

    function openMusicPlayer() {
        musicOpen = true;
        musicPlayer.classList.add('open');
    }

    function closeMusicPlayer() {
        musicOpen = false;
        musicPlayer.classList.remove('open');
        musicFrame.innerHTML = '';
        musicFrame.classList.remove('has-video');
        musicNow.classList.remove('active');
    }

    async function searchMusic(query) {
        if (!query.trim()) return;
        openMusicPlayer();
        const encoded = encodeURIComponent(query.trim());
        musicFrame.innerHTML = '<div style="padding:40px;text-align:center;color:#888;font-size:0.85rem;">Searching...</div>';
        musicFrame.classList.add('has-video');
        musicNowText.textContent = query.trim();
        musicNow.classList.add('active');
        musicInput.value = '';

        try {
            const res = await fetch('/api/youtube/?q=' + encoded);
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0 && data[0].videoId) {
                const videoId = data[0].videoId;
                const title = data[0].title || query.trim();
                const iframe = document.createElement('iframe');
                iframe.src = 'https://www.youtube.com/embed/' + videoId + '?autoplay=1&rel=0';
                iframe.allow = 'autoplay; encrypted-media';
                iframe.allowFullscreen = true;
                musicFrame.innerHTML = '';
                musicFrame.appendChild(iframe);
                musicNowText.textContent = title;
            } else {
                musicFrame.innerHTML = '<div style="padding:30px;text-align:center;color:#888;font-size:0.85rem;">No results found. Try a different search.</div>';
            }
        } catch (err) {
            musicFrame.innerHTML = '<div style="padding:30px;text-align:center;color:#888;font-size:0.85rem;">Search error. Please try again.</div>';
        }
    }

    musicSearchBtn.addEventListener('click', () => searchMusic(musicInput.value));
    musicInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') searchMusic(musicInput.value);
    });
    musicClose.addEventListener('click', closeMusicPlayer);

    // --- Draggable Music Player ---
    const dragHandle = musicPlayer.querySelector('#kz-music-drag');
    let isDragging = false, dragOffX = 0, dragOffY = 0;

    dragHandle.addEventListener('mousedown', (e) => {
        isDragging = true;
        const rect = musicPlayer.getBoundingClientRect();
        dragOffX = e.clientX - rect.left;
        dragOffY = e.clientY - rect.top;
        musicPlayer.style.transition = 'none';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const x = Math.max(0, Math.min(e.clientX - dragOffX, window.innerWidth - musicPlayer.offsetWidth));
        const y = Math.max(0, Math.min(e.clientY - dragOffY, window.innerHeight - musicPlayer.offsetHeight));
        musicPlayer.style.left = x + 'px';
        musicPlayer.style.top = y + 'px';
        musicPlayer.style.bottom = 'auto';
        musicPlayer.style.right = 'auto';
    });

    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            musicPlayer.style.transition = '';
        }
    });

    // Touch drag support
    dragHandle.addEventListener('touchstart', (e) => {
        isDragging = true;
        const touch = e.touches[0];
        const rect = musicPlayer.getBoundingClientRect();
        dragOffX = touch.clientX - rect.left;
        dragOffY = touch.clientY - rect.top;
        musicPlayer.style.transition = 'none';
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        const touch = e.touches[0];
        const x = Math.max(0, Math.min(touch.clientX - dragOffX, window.innerWidth - musicPlayer.offsetWidth));
        const y = Math.max(0, Math.min(touch.clientY - dragOffY, window.innerHeight - musicPlayer.offsetHeight));
        musicPlayer.style.left = x + 'px';
        musicPlayer.style.top = y + 'px';
        musicPlayer.style.bottom = 'auto';
        musicPlayer.style.right = 'auto';
    }, { passive: true });

    document.addEventListener('touchend', () => { isDragging = false; musicPlayer.style.transition = ''; });

    // --- Voice Recognition ---
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition = null;
    let isListening = false;
    let toastTimer = null;

    function showToast(heard, action) {
        document.getElementById('kz-voice-text').textContent = heard;
        document.getElementById('kz-voice-action').textContent = action;
        voiceToast.classList.add('visible');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => voiceToast.classList.remove('visible'), 4000);
    }

    const NAV_COMMANDS = {
        'home': '/', 'trang chủ': '/',
        'services': '/services', 'dịch vụ': '/services',
        'solutions': '/solutions', 'giải pháp': '/solutions',
        'process': '/process', 'quy trình': '/process',
        'clients': '/clients', 'khách hàng': '/clients',
        'audit': '/audit', 'kiểm tra': '/audit',
        'demo': '/demo', 'book': '/demo', 'đặt lịch': '/demo',
        'contact': '/contact', 'liên hệ': '/contact',
    };

    function handleVoiceCommand(transcript) {
        const text = transcript.toLowerCase().trim()
            .replace(/[-]/g, '')
            .replace(/\s+/g, ' ');

        // Play music — match flexibly: "play X", "can you play X", "I want to listen to X"
        const playMatch = text.match(/(?:play|mở|phát|nghe|bật|listen\s*(?:to)?|put\s*on)\s+(.+)/);
        if (playMatch) {
            let song = playMatch[1].replace(/(?:music|nhạc|song|bài|for me|please)$/i, '').trim();
            if (song) {
                showToast(transcript, 'Playing: ' + song);
                searchMusic(song);
                return;
            }
        }

        // Stop/pause music
        if (text.match(/(?:stop|pause|close|tắt|dừng|ngừng|shut)\s*(?:the\s*)?(?:music|nhạc|player|song|video)?/)) {
            if (musicOpen) {
                showToast(transcript, 'Music stopped');
                closeMusicPlayer();
                return;
            }
        }

        // Open/close chat
        if (text.match(/(?:open|mở|show|start)\s*(?:the\s*)?chat/)) {
            showToast(transcript, 'Opening chat...');
            const chatFab = document.querySelector('.kz-widget-fab');
            if (chatFab) chatFab.click();
            return;
        }

        // Demo commands — match service keywords flexibly, no prefix required
        const DEMO_MAP = [
            { words: ['voice'], search: 'voice', name: 'Voice AI Agent' },
            { words: ['facebook', 'instagram', 'fb', 'ig'], search: 'facebook', name: 'Facebook & Instagram Agent' },
            { words: ['email', 'mail'], search: 'email', name: 'Email AI Agent' },
            { words: ['xero', 'accounting', 'accountant'], search: 'xero', name: 'Xero AI' },
            { words: ['media agent', 'media ai', 'media demo'], search: 'media', name: 'Media AI Agent' },
            { words: ['android', 'app dev', 'mobile app'], search: 'android', name: 'Android App' },
            { words: ['multi agent', 'librechat', 'libre chat', 'multiagent'], search: 'multi-agent', name: 'Multi-Agent Chat' },
        ];

        const isDemoRequest = text.match(/(?:demo|show|watch|xem|mở|phát|open|play)\b/);
        if (isDemoRequest) {
            for (const demo of DEMO_MAP) {
                const matched = demo.words.some(w => text.includes(w));
                if (matched) {
                    const cards = document.querySelectorAll('.service-card');
                    for (const card of cards) {
                        const h3 = card.querySelector('h3');
                        if (h3 && h3.textContent.toLowerCase().includes(demo.search)) {
                            const demoBtn = card.querySelector('[data-demo]');
                            if (demoBtn) {
                                showToast(transcript, 'Opening ' + demo.name + ' demo...');
                                demoBtn.click();
                                return;
                            }
                        }
                    }
                    showToast(transcript, 'Go to Services page first to watch demos');
                    return;
                }
            }
        }

        // Navigate — AFTER demo commands so "demo" doesn't always trigger nav
        const NAV_KEYWORDS = [
            { words: ['home', 'trang chủ', 'main', 'homepage'], path: '/', label: 'Home' },
            { words: ['service', 'dịch vụ'], path: '/services', label: 'Services' },
            { words: ['solution', 'giải pháp'], path: '/solutions', label: 'Solutions' },
            { words: ['process', 'quy trình', 'how it work'], path: '/process', label: 'Process' },
            { words: ['client', 'khách hàng', 'testimonial'], path: '/clients', label: 'Clients' },
            { words: ['audit', 'kiểm tra'], path: '/audit', label: 'Audit' },
            { words: ['book a demo', 'book demo', 'đặt lịch', 'booking'], path: '/demo', label: 'Book a Demo' },
            { words: ['contact', 'liên hệ'], path: '/contact', label: 'Contact' },
        ];

        for (const nav of NAV_KEYWORDS) {
            for (const word of nav.words) {
                if (text.includes(word)) {
                    showToast(transcript, 'Going to ' + nav.label);
                    setTimeout(() => window.location.href = nav.path, 600);
                    return;
                }
            }
        }

        // Scroll to top/bottom
        if (text.match(/(?:scroll|go|cuộn|move)\s*(?:to\s*)?(?:the\s*)?(?:up|lên|top|đầu|beginning)/)) {
            showToast(transcript, 'Scrolling to top');
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }
        if (text.match(/(?:scroll|go|cuộn|move)\s*(?:to\s*)?(?:the\s*)?(?:down|xuống|bottom|cuối|end)/)) {
            showToast(transcript, 'Scrolling to bottom');
            window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
            return;
        }

        // Scroll to section — "scroll to FAQ", "go to pricing", "cuộn tới contact"
        const SECTION_MAP = [
            { words: ['hero', 'banner', 'header', 'heading', 'đầu trang'], selector: '.hero, .page-hero' },
            { words: ['capability', 'capabilities', 'accordion'], selector: '.img-accordion-section' },
            { words: ['scaling', 'scale', 'firm'], selector: '#scaling' },
            { words: ['audit', 'kiểm tra'], selector: '#audit, .audit-cta' },
            { words: ['support', 'hỗ trợ', 'benefit'], selector: '#firm-support' },
            { words: ['why', 'tại sao', 'why kaiizen', 'choose'], selector: '#why' },
            { words: ['faq', 'question', 'câu hỏi'], selector: '#faq' },
            { words: ['contact', 'liên hệ', 'cta'], selector: '#contact, .cta-section' },
            { words: ['footer', 'chân trang'], selector: '.footer' },
            { words: ['pricing', 'giá', 'price'], selector: '.pricing-grid' },
            { words: ['testimonial', 'review', 'đánh giá'], selector: '.testimonials-grid' },
            { words: ['timeline', 'step', 'bước'], selector: '.process-timeline' },
        ];

        for (const sec of SECTION_MAP) {
            if (sec.words.some(w => text.includes(w))) {
                const el = document.querySelector(sec.selector);
                if (el) {
                    showToast(transcript, 'Scrolling to ' + sec.words[0]);
                    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    return;
                }
            }
        }

        // Fallback: try to find any section/heading matching what user said
        const allSections = document.querySelectorAll('section, .section-header, h2, h3');
        for (const el of allSections) {
            const elText = el.textContent.toLowerCase();
            const userWords = text.replace(/(?:scroll|go|cuộn|move|to|the|tới|đến|phần)\s*/g, '').trim();
            if (userWords.length > 2 && elText.includes(userWords)) {
                showToast(transcript, 'Found: ' + userWords);
                el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                return;
            }
        }

        // Fallback: anything unrecognized → auto web search
        showToast(transcript, 'Searching: ' + transcript);
        agentSearch(transcript);
    }

    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.maxAlternatives = 3;
        recognition.lang = voiceLang;

        let interimTimer = null;
        recognition.onresult = (e) => {
            let interim = '';
            let finalTranscript = '';
            for (let i = e.resultIndex; i < e.results.length; i++) {
                const t = e.results[i][0].transcript;
                if (e.results[i].isFinal) {
                    finalTranscript = t;
                } else {
                    interim = t;
                }
            }
            if (interim && !finalTranscript) {
                const textEl = document.getElementById('kz-voice-text');
                if (textEl) textEl.textContent = interim;
                voiceToast.classList.add('visible');
                clearTimeout(interimTimer);
                interimTimer = setTimeout(() => voiceToast.classList.remove('visible'), 4000);
            }
            if (finalTranscript) {
                clearTimeout(interimTimer);
                handleVoiceCommand(finalTranscript);
            }
        };

        recognition.onend = () => {
            isListening = false;
            voiceFab.classList.remove('listening');
        };

        recognition.onerror = (e) => {
            isListening = false;
            voiceFab.classList.remove('listening');
            if (e.error !== 'aborted') {
                showToast('...', 'Could not hear you. Try again.');
            }
        };

        voiceFab.addEventListener('click', () => {
            if (isListening) {
                recognition.stop();
                isListening = false;
                voiceFab.classList.remove('listening');
            } else {
                recognition.lang = voiceLang;
                recognition.start();
                isListening = true;
                voiceFab.classList.add('listening');
                showToast('Listening...', 'Say a command (' + (voiceLang === 'en-US' ? 'English' : 'Tiếng Việt') + ')');
            }
        });
    } else {
        voiceFab.addEventListener('click', () => {
            showToast('Not supported', 'Voice commands require Chrome or Edge browser.');
        });
    }
})();
