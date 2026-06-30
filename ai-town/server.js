const express = require('express');
const http = require('http');
const https = require('https');
const { Server } = require('socket.io');
const OpenAI = require('openai');
const path = require('path');

function webSearch(query) {
  return new Promise((resolve) => {
    const searchUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    const req = https.get(searchUrl, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 8000 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const results = [];
          if (json.Abstract) {
            results.push({ title: json.Heading || 'Summary', snippet: json.Abstract });
          }
          if (json.RelatedTopics) {
            for (const topic of json.RelatedTopics) {
              if (topic.Text && results.length < 5) {
                results.push({ title: topic.FirstURL?.split('/').pop()?.replace(/_/g, ' ') || 'Related', snippet: topic.Text });
              }
              if (topic.Topics) {
                for (const sub of topic.Topics) {
                  if (sub.Text && results.length < 5) {
                    results.push({ title: sub.FirstURL?.split('/').pop()?.replace(/_/g, ' ') || 'Related', snippet: sub.Text });
                  }
                }
              }
            }
          }
          resolve(results);
        } catch {
          resolve([]);
        }
      });
    });
    req.on('error', () => resolve([]));
    req.on('timeout', () => { req.destroy(); resolve([]); });
  });
}

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

const API_KEY = process.env.OPENAI_API_KEY || '';
const HAS_AI = API_KEY && API_KEY !== 'sk-placeholder';

const openai = new OpenAI({
  apiKey: API_KEY || 'sk-placeholder',
  baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
});

const MODEL = process.env.MODEL || 'gpt-4o-mini';

const fallbackReplies = {
  ceo: [
    "Strategically speaking, we need to focus on our Q3 targets. Let's align on this during the all-hands.",
    "I've been reviewing the numbers — our growth trajectory looks promising. Let's double down on what's working.",
    "Great question. Let me loop in the relevant teams and we'll have a strategy session this week.",
    "From a high-level perspective, I think we should prioritize market expansion. Let's set up a deep dive.",
  ],
  engineering: [
    "We're currently refactoring the auth module to improve scalability. Should be done by end of sprint.",
    "I'd recommend we go with a microservices approach here — it'll give us better separation of concerns.",
    "The tech debt is manageable right now, but we should allocate 20% of next sprint for cleanup.",
    "Good point. Let me check the CI pipeline and get back to you with benchmarks.",
  ],
  marketing: [
    "Our latest campaign hit a 3.2% conversion rate — that's above industry average! 🎯",
    "I'm thinking we should pivot our content strategy toward more video-first approaches this quarter.",
    "The brand awareness metrics are trending up. Let me put together a funnel analysis for the team.",
    "Social engagement is up 40% this month! We should capitalize on this momentum.",
  ],
  design: [
    "I've been exploring a more minimal design language — cleaner typography, more whitespace.",
    "The user testing results show our new onboarding flow reduced drop-off by 25%. Really happy with that!",
    "Color-wise, I think we should shift toward warmer tones. It aligns better with our brand personality.",
    "Let me mock up a few options and we can do a design review tomorrow.",
  ],
  data: [
    "The retention data shows a 15% improvement after we launched the new features last month.",
    "I've built a predictive model that estimates churn with 87% accuracy. Want to see the dashboard?",
    "Based on our A/B test results, variant B outperforms by 2.3 standard deviations. Statistically significant.",
    "Let me pull the latest metrics. The data pipeline just finished processing the overnight batch.",
  ],
  hr: [
    "We've got 12 strong candidates in the pipeline for the senior roles. Interviews start next week!",
    "The team engagement survey results are in — overall satisfaction is at 8.2/10. Room for improvement on work-life balance.",
    "I'm planning a team building event for next month. Thinking escape room or cooking class?",
    "The new onboarding program has really improved our 90-day retention. New hires feel much more supported.",
  ],
};

const departments = {
  ceo: {
    name: 'CEO Office',
    emoji: '👔',
    color: '#e74c3c',
    position: { x: 0, y: 0, z: -8 },
    system: `You are the CEO of AI Town Corp. You make strategic decisions and oversee all operations.
Personality: decisive, visionary, uses words like "strategy", "growth", "market position".
Keep replies under 3 sentences.`,
    memory: [],
    status: 'Reviewing quarterly report',
  },
  engineering: {
    name: 'Engineering',
    emoji: '💻',
    color: '#2ecc71',
    position: { x: -8, y: 0, z: 0 },
    system: `You are the Engineering Lead at AI Town Corp. You handle architecture, code reviews, and technical decisions.
Personality: logical, precise, talks about tech stack, scalability, clean code, and system design.
Keep replies under 3 sentences.`,
    memory: [],
    status: 'Refactoring auth module',
  },
  marketing: {
    name: 'Marketing',
    emoji: '📢',
    color: '#e67e22',
    position: { x: 8, y: 0, z: 0 },
    system: `You are the Marketing Lead at AI Town Corp. You handle campaigns, branding, social media, and growth.
Personality: creative, energetic, uses marketing buzzwords, talks about funnels and engagement.
Keep replies under 3 sentences.`,
    memory: [],
    status: 'Planning Q3 campaign',
  },
  design: {
    name: 'Design',
    emoji: '🎨',
    color: '#9b59b6',
    position: { x: -8, y: 0, z: -8 },
    system: `You are the Design Lead at AI Town Corp. You handle UI/UX, branding, and visual design.
Personality: aesthetic, detail-oriented, talks about user experience, typography, and color theory.
Keep replies under 3 sentences.`,
    memory: [],
    status: 'Designing new landing page',
  },
  data: {
    name: 'Data Science',
    emoji: '📊',
    color: '#3498db',
    position: { x: 8, y: 0, z: -8 },
    system: `You are the Data Science Lead at AI Town Corp. You handle analytics, ML models, and data pipelines.
Personality: precise, data-driven, quotes statistics and metrics, talks about models and accuracy.
Keep replies under 3 sentences.`,
    memory: [],
    status: 'Analyzing user retention',
  },
  hr: {
    name: 'Human Resources',
    emoji: '🤝',
    color: '#1abc9c',
    position: { x: 0, y: 0, z: 4 },
    system: `You are the HR Lead at AI Town Corp. You handle hiring, culture, team building, and employee wellbeing.
Personality: friendly, empathetic, talks about culture fit, team dynamics, and personal growth.
Keep replies under 3 sentences.`,
    memory: [],
    status: 'Interviewing candidates',
  },
};

const tasks = {};

const fallbackTaskWork = {
  ceo: {
    accept: "Got it. I'll review this and align it with our strategic priorities.",
    progress: [
      "Reviewing strategic alignment with company goals...",
      "Drafting executive summary and key action items...",
      "Consulting with leadership team on resource allocation...",
    ],
  },
  engineering: {
    accept: "Understood. I'll break this down into tickets and start working on it.",
    progress: [
      "Breaking down requirements into technical specs...",
      "Setting up the project structure and dependencies...",
      "Writing core logic and unit tests...",
      "Running CI pipeline and code review...",
    ],
  },
  marketing: {
    accept: "On it! I'll draft a plan and loop in the content team.",
    progress: [
      "Researching target audience and competitive landscape...",
      "Creating content brief and campaign assets...",
      "Setting up A/B test variants and tracking pixels...",
    ],
  },
  design: {
    accept: "Thanks for the brief! I'll start sketching out concepts.",
    progress: [
      "Creating wireframes and user flow diagrams...",
      "Exploring visual directions and color palettes...",
      "Building high-fidelity mockups in Figma...",
    ],
  },
  data: {
    accept: "I'll pull the relevant data and start the analysis.",
    progress: [
      "Querying data warehouse and cleaning datasets...",
      "Running statistical analysis and building models...",
      "Creating visualization dashboard with key metrics...",
    ],
  },
  hr: {
    accept: "Noted! I'll coordinate with the team right away.",
    progress: [
      "Reviewing team capacity and availability...",
      "Drafting communication plan and scheduling...",
      "Coordinating with stakeholders and getting approvals...",
    ],
  },
};

function generateDeliverable(deptId, description) {
  const desc = description.toLowerCase();
  if (desc.includes('email') || desc.includes('template')) {
    return `✅ Done! Here's the deliverable:\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n📧 EMAIL TEMPLATE\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nSubject: Introducing Our AI Agent — Your New Digital Teammate 🤖\n\nHi [Name],\n\nWe're excited to introduce our latest AI Agent — designed to automate workflows, answer questions, and boost your team's productivity.\n\n🔹 Smart Automation — Handles repetitive tasks so you can focus on what matters\n🔹 24/7 Availability — Always ready to help, no coffee breaks needed\n🔹 Easy Integration — Works with your existing tools in minutes\n\nReady to see it in action?\n👉 [Book a Demo] | [Try It Free]\n\nBest regards,\nThe AI Town Team\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━`;
  }
  if (desc.includes('landing') || desc.includes('page') || desc.includes('website')) {
    return `✅ Done! Here's the deliverable:\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n🌐 LANDING PAGE SPEC\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nHero Section:\n  Headline: "Meet Your AI-Powered Team"\n  Subhead: "Intelligent agents that work alongside your employees"\n  CTA: "Get Started Free" (primary) | "Watch Demo" (secondary)\n\nFeatures Section (3 columns):\n  1. 🧠 Smart Conversations — Natural language understanding\n  2. ⚡ Lightning Fast — Sub-second response times\n  3. 🔒 Enterprise Secure — SOC2 compliant, encrypted\n\nSocial Proof: 3 testimonial cards + logo bar\nPricing: Free / Pro $29/mo / Enterprise (custom)\nFooter: Links + newsletter signup\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━`;
  }
  if (desc.includes('report') || desc.includes('analysis') || desc.includes('data')) {
    return `✅ Done! Here's the deliverable:\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n📊 ANALYSIS REPORT\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nKey Metrics:\n  • Monthly Active Users: 12,450 (+18% MoM)\n  • Avg. Session Duration: 4m 32s\n  • Conversion Rate: 3.8% (vs 2.1% industry avg)\n  • NPS Score: 72 (Excellent)\n\nTop Findings:\n  1. Mobile traffic up 45% — needs responsive optimization\n  2. Onboarding drop-off at step 3 (payment) — 34% abandon\n  3. Power users (top 10%) drive 60% of engagement\n\nRecommendations:\n  → Simplify payment flow (estimated +12% conversion)\n  → Launch mobile app MVP by Q4\n  → Create loyalty program for power users\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━`;
  }
  if (desc.includes('hire') || desc.includes('recruit') || desc.includes('job') || desc.includes('interview')) {
    return `✅ Done! Here's the deliverable:\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n📋 RECRUITMENT PLAN\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nPosition: As requested\nTimeline: 4-6 weeks\n\nPhase 1 (Week 1-2): Source & Screen\n  • Post on LinkedIn, Indeed, internal referrals\n  • Screen 30+ candidates → shortlist 10\n\nPhase 2 (Week 3-4): Interview\n  • Round 1: Technical/skills assessment\n  • Round 2: Culture fit + team meet\n  • Round 3: Final with hiring manager\n\nPhase 3 (Week 5-6): Offer & Onboard\n  • Comp benchmarking + offer letter\n  • 30/60/90 day onboarding plan\n\nBudget: Covered by existing hiring allocation\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━`;
  }
  if (desc.includes('design') || desc.includes('logo') || desc.includes('brand') || desc.includes('ui') || desc.includes('mockup')) {
    return `✅ Done! Here's the deliverable:\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n🎨 DESIGN SPEC\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nColor Palette:\n  Primary: #3B82F6 (Blue)  Accent: #8B5CF6 (Purple)\n  Background: #0F172A       Text: #F8FAFC\n\nTypography:\n  Headings: Inter Bold 24-48px\n  Body: Inter Regular 14-16px\n  Code: JetBrains Mono 13px\n\nComponents:\n  • Cards with 12px radius, subtle shadow\n  • Buttons: filled primary, outlined secondary\n  • Input fields with floating labels\n  • Toast notifications (top-right)\n\nLayout: 12-column grid, 1200px max-width\nScreens delivered: 5 pages in Figma\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━`;
  }
  // Generic deliverable
  const deptDeliverables = {
    ceo: `✅ Done! Here's the deliverable:\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n📋 EXECUTIVE BRIEF\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nObjective: ${description}\n\nStrategic Assessment:\n  • Aligns with Q3-Q4 company roadmap\n  • Resource impact: Low-Medium\n  • Expected ROI: 2-3x within 6 months\n\nAction Items:\n  1. Kick off cross-team alignment meeting\n  2. Allocate budget from innovation fund\n  3. Set milestone checkpoints (monthly)\n\nApproved for execution. Next review: 2 weeks.\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    engineering: `✅ Done! Here's the deliverable:\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n💻 IMPLEMENTATION COMPLETE\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nTask: ${description}\n\nTechnical Summary:\n  • Architecture: Modular, event-driven\n  • Stack: Node.js + Express + Socket.IO\n  • Tests: 24 unit tests, all passing ✓\n  • Coverage: 89%\n\nPerformance:\n  • Avg response: 145ms\n  • Memory: 48MB baseline\n  • Handles 1000 concurrent connections\n\nDeployed to staging. PR #47 ready for review.\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    marketing: `✅ Done! Here's the deliverable:\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n📢 CAMPAIGN PACKAGE\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nCampaign: ${description}\n\nAssets Created:\n  • 3 email sequences (welcome, nurture, convert)\n  • 5 social media posts (LinkedIn + Twitter)\n  • 1 blog post draft (1,200 words)\n  • Ad copy for 2 variants (A/B test ready)\n\nTargeting:\n  • Audience: Tech decision-makers, 25-45\n  • Channels: LinkedIn Ads + Google Search\n  • Budget: $2,500/month recommended\n\nEstimated Reach: 50K impressions, 3.5% CTR\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    design: `✅ Done! Here's the deliverable:\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n🎨 DESIGN DELIVERABLE\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nProject: ${description}\n\nDelivered:\n  • 4 high-fidelity mockups (desktop + mobile)\n  • Interactive prototype in Figma\n  • Component library (12 reusable components)\n  • Style guide with design tokens\n\nKey Decisions:\n  • Minimal, clean aesthetic\n  • Accessibility: WCAG AA compliant\n  • Motion: subtle micro-interactions\n\nFigma link shared with team. Ready for dev handoff.\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    data: `✅ Done! Here's the deliverable:\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n📊 DATA ANALYSIS\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nAnalysis: ${description}\n\nKey Findings:\n  • Primary metric improved 23% (p < 0.01)\n  • Identified 3 user segments with distinct behavior\n  • Predictive model accuracy: 91.2%\n\nDashboard: Live at /analytics/report-47\nDataset: 2.3M records processed\nMethodology: Regression + clustering analysis\n\nRecommendation: Focus on Segment A (highest LTV)\nNext steps: Weekly automated reports enabled\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    hr: `✅ Done! Here's the deliverable:\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n🤝 HR ACTION PLAN\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nProject: ${description}\n\nCompleted:\n  • Stakeholder alignment (all confirmed)\n  • Schedule finalized and calendar invites sent\n  • Documentation updated in team wiki\n  • Communication plan distributed\n\nTimeline:\n  • Week 1: Kickoff + initial setup\n  • Week 2-3: Execution phase\n  • Week 4: Review + feedback collection\n\nAll teams notified. Feedback survey scheduled.\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━`,
  };
  return deptDeliverables[deptId] || deptDeliverables.engineering;
}

const activities = [
  'In a meeting',
  'Coffee break',
  'Brainstorming',
  'Reviewing docs',
  'Answering emails',
  'Lunch break',
  'On a call',
  'Deep work session',
];

setInterval(() => {
  for (const [id, dept] of Object.entries(departments)) {
    if (Math.random() < 0.15) {
      dept.status = activities[Math.floor(Math.random() * activities.length)];
      io.emit('agent-status', { id, status: dept.status });
    }
  }
}, 10000);

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.emit('init', {
    departments: Object.fromEntries(
      Object.entries(departments).map(([id, d]) => [
        id,
        { name: d.name, emoji: d.emoji, color: d.color, position: d.position, status: d.status },
      ])
    ),
  });

  socket.on('chat', async ({ departmentId, message }) => {
    const dept = departments[departmentId];
    if (!dept) return;

    dept.memory.push({ role: 'user', content: message });
    if (dept.memory.length > 20) dept.memory = dept.memory.slice(-20);

    const lowerMsg = message.toLowerCase();
    const isSearchQuery = lowerMsg.startsWith('search ') || lowerMsg.startsWith('tìm ') ||
      lowerMsg.startsWith('look up ') || lowerMsg.startsWith('find ') ||
      lowerMsg.includes('search for') || lowerMsg.includes('look up') ||
      lowerMsg.includes('tìm kiếm') || lowerMsg.includes('tra cứu');

    if (isSearchQuery) {
      const searchTerm = message.replace(/^(search|tìm|look up|find|tìm kiếm|tra cứu)\s*/i, '').replace(/(search for|look up|tìm kiếm|tra cứu)\s*/i, '').trim() || message;
      socket.emit('chat-reply', { departmentId, message: `🔍 Searching the web for: "${searchTerm}"...`, isSearching: true });

      const results = await webSearch(searchTerm);
      if (results.length === 0) {
        if (HAS_AI) {
          try {
            const aiSearch = await openai.chat.completions.create({
              model: MODEL,
              messages: [
                { role: 'system', content: dept.system + '\nThe user asked you to search for something. Web search is unavailable, so answer from your knowledge. Be helpful and specific.' },
                { role: 'user', content: `Search/find: ${searchTerm}` },
              ],
              max_tokens: 400,
            });
            const reply = `🔍 Web search unavailable — here's what I know:\n\n${aiSearch.choices[0].message.content}`;
            dept.memory.push({ role: 'assistant', content: reply });
            socket.emit('chat-reply', { departmentId, message: reply });
          } catch (e) {
            socket.emit('chat-reply', { departmentId, message: `🔍 Search for "${searchTerm}" failed. Check your internet connection and try again.` });
          }
        } else {
          const reply = `🔍 Search for "${searchTerm}" — web search is not available in demo mode.\n\n💡 To enable search, set your API key:\n  set OPENAI_API_KEY=sk-xxx\n  npm start\n\nWith an API key, agents can search the web and analyze results for you.`;
          dept.memory.push({ role: 'assistant', content: reply });
          socket.emit('chat-reply', { departmentId, message: reply });
        }
        return;
      }

      let searchReply = `🔍 Search results for "${searchTerm}":\n\n`;
      results.forEach((r, i) => {
        searchReply += `${i + 1}. ${r.title}\n   ${r.snippet}\n\n`;
      });

      if (HAS_AI) {
        try {
          const analysis = await openai.chat.completions.create({
            model: MODEL,
            messages: [
              { role: 'system', content: dept.system + '\nThe user asked you to search for something. Here are the web search results. Summarize the key findings in 2-3 sentences from your department perspective.' },
              { role: 'user', content: `Search query: ${searchTerm}\n\nResults:\n${results.map(r => `- ${r.title}: ${r.snippet}`).join('\n')}` },
            ],
            max_tokens: 200,
          });
          searchReply += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n💡 ${dept.name} Analysis:\n${analysis.choices[0].message.content}`;
        } catch (e) { /* skip AI analysis on error */ }
      }

      dept.memory.push({ role: 'assistant', content: searchReply });
      socket.emit('chat-reply', { departmentId, message: searchReply });
      return;
    }

    if (!HAS_AI) {
      const replies = fallbackReplies[departmentId] || fallbackReplies.ceo;
      const reply = replies[Math.floor(Math.random() * replies.length)];
      dept.memory.push({ role: 'assistant', content: reply });
      setTimeout(() => {
        socket.emit('chat-reply', { departmentId, message: reply });
      }, 500 + Math.random() * 1000);
      return;
    }

    try {
      const response = await openai.chat.completions.create({
        model: MODEL,
        messages: [
          { role: 'system', content: dept.system },
          ...dept.memory,
        ],
        max_tokens: 300,
      });

      const reply = response.choices[0].message.content;
      dept.memory.push({ role: 'assistant', content: reply });

      socket.emit('chat-reply', { departmentId, message: reply });
    } catch (err) {
      console.error('AI Error:', err.message);
      const replies = fallbackReplies[departmentId] || fallbackReplies.ceo;
      const reply = replies[Math.floor(Math.random() * replies.length)];
      socket.emit('chat-reply', { departmentId, message: reply + '\n\n⚠️ (AI offline — using demo replies. Set OPENAI_API_KEY for real AI)' });
    }
  });

  socket.on('agent-meeting', async ({ from, to, topic }) => {
    const fromDept = departments[from];
    const toDept = departments[to];
    if (!fromDept || !toDept) return;

    if (!HAS_AI) {
      const conversation = `${fromDept.emoji} ${fromDept.name}: Thanks for meeting. Let's discuss ${topic}.\n\n${toDept.emoji} ${toDept.name}: Absolutely. I think we need to approach this strategically.\n\n${fromDept.emoji} ${fromDept.name}: From my side, the key priority is alignment across our teams.\n\n${toDept.emoji} ${toDept.name}: Agreed. I'll prepare a proposal and share it by end of week.\n\n${fromDept.emoji} ${fromDept.name}: Perfect. Let's sync again next Tuesday.\n\n${toDept.emoji} ${toDept.name}: Sounds good. I'll send a calendar invite.`;
      setTimeout(() => {
        socket.emit('meeting-result', { from, to, topic, conversation });
      }, 800 + Math.random() * 1200);
      return;
    }

    try {
      const response = await openai.chat.completions.create({
        model: MODEL,
        messages: [
          {
            role: 'system',
            content: `Simulate a short meeting between ${fromDept.name} and ${toDept.name}.
Each person speaks 1-2 sentences, 4-6 turns total. Use their department emoji to distinguish speakers.
${fromDept.name} (${fromDept.emoji}): ${fromDept.system}
${toDept.name} (${toDept.emoji}): ${toDept.system}`,
          },
          { role: 'user', content: `Meeting topic: ${topic}` },
        ],
        max_tokens: 500,
      });

      socket.emit('meeting-result', {
        from,
        to,
        topic,
        conversation: response.choices[0].message.content,
      });
    } catch (err) {
      socket.emit('meeting-result', {
        from,
        to,
        topic,
        conversation: `[Error: ${err.message}]`,
      });
    }
  });

  socket.on('assign-task', async ({ from, to, description, priority }) => {
    const fromDept = departments[from];
    const toDept = departments[to];
    if (!fromDept || !toDept) return;

    const taskId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const task = { id: taskId, from, to, description, priority, status: 'pending', time: Date.now(), progress: 0 };
    if (!tasks[to]) tasks[to] = [];
    tasks[to].push(task);

    const speedMs = priority === 'urgent' ? 3000 : priority === 'high' ? 5000 : 8000;

    const emitUpdate = (data) => {
      socket.emit('task-update', { ...data, taskId, from, to });
    };

    if (!HAS_AI) {
      const work = fallbackTaskWork[to] || fallbackTaskWork.ceo;

      setTimeout(() => {
        task.status = 'accepted';
        emitUpdate({ status: 'accepted', message: work.accept });
        toDept.status = `Working on: ${description.slice(0, 30)}...`;
        io.emit('agent-status', { id: to, status: toDept.status });
      }, 800 + Math.random() * 500);

      work.progress.forEach((msg, i) => {
        setTimeout(() => {
          task.status = 'in-progress';
          task.progress = Math.round(((i + 1) / work.progress.length) * 80);
          emitUpdate({ status: 'in-progress', message: msg, progress: task.progress });
        }, speedMs * (i + 1) + Math.random() * 1000);
      });

      setTimeout(() => {
        task.status = 'done';
        task.progress = 100;
        const deliverable = generateDeliverable(to, description);
        task.result = deliverable;
        emitUpdate({ status: 'done', message: deliverable, progress: 100 });
        toDept.status = activities[Math.floor(Math.random() * activities.length)];
        io.emit('agent-status', { id: to, status: toDept.status });
      }, speedMs * (work.progress.length + 1) + 1000);

      return;
    }

    try {
      const acceptRes = await openai.chat.completions.create({
        model: MODEL,
        messages: [
          { role: 'system', content: toDept.system + '\nYou just received a task. Acknowledge it briefly (1 sentence) and say you are starting.' },
          { role: 'user', content: `Task from ${fromDept.name} (${priority} priority): ${description}` },
        ],
        max_tokens: 100,
      });
      task.status = 'accepted';
      emitUpdate({ status: 'accepted', message: acceptRes.choices[0].message.content });
      toDept.status = `Working on: ${description.slice(0, 30)}...`;
      io.emit('agent-status', { id: to, status: toDept.status });

      const progressSteps = ['analyzing requirements', 'working on implementation', 'reviewing and finalizing'];
      for (let i = 0; i < progressSteps.length; i++) {
        await new Promise(r => setTimeout(r, speedMs));
        const progRes = await openai.chat.completions.create({
          model: MODEL,
          messages: [
            { role: 'system', content: toDept.system + `\nYou are ${progressSteps[i]} for this task. Give a 1-sentence progress update.` },
            { role: 'user', content: `Task: ${description}` },
          ],
          max_tokens: 80,
        });
        task.status = 'in-progress';
        task.progress = Math.round(((i + 1) / progressSteps.length) * 80);
        emitUpdate({ status: 'in-progress', message: progRes.choices[0].message.content, progress: task.progress });
      }

      await new Promise(r => setTimeout(r, speedMs));
      const doneRes = await openai.chat.completions.create({
        model: MODEL,
        messages: [
          { role: 'system', content: toDept.system + `\nYou just finished this task: "${description}"\nProvide the actual deliverable output. If it's an email template, write the actual email. If it's a report, write the actual report. If it's code, write the actual code. Make it concrete and ready to use. Start with ✅ Done!` },
          { role: 'user', content: `Deliver the completed task: ${description}` },
        ],
        max_tokens: 500,
      });
      task.status = 'done';
      task.progress = 100;
      task.result = doneRes.choices[0].message.content;
      emitUpdate({ status: 'done', message: task.result, progress: 100 });
      toDept.status = activities[Math.floor(Math.random() * activities.length)];
      io.emit('agent-status', { id: to, status: toDept.status });
    } catch (err) {
      console.error('Task AI Error:', err.message);
      task.status = 'done';
      task.progress = 100;
      const deliverable = generateDeliverable(to, description);
      task.result = deliverable;
      emitUpdate({ status: 'done', message: deliverable, progress: 100 });
    }
  });

  socket.on('get-tasks', ({ departmentId }) => {
    const deptTasks = tasks[departmentId] || [];
    socket.emit('tasks-list', { departmentId, tasks: deptTasks.slice(-10) });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🏢 AI Town running at http://localhost:${PORT}`);
  console.log(`\nConfig:`);
  console.log(`  AI Mode: ${HAS_AI ? '🟢 Connected (' + MODEL + ')' : '🟡 Demo mode (fallback replies)'}`);
  if (HAS_AI) console.log(`  API Base: ${openai.baseURL}`);
  console.log(`\nTo enable AI chat:`);
  console.log(`  OPENAI_API_KEY=sk-xxx npm start`);
  console.log(`  OPENAI_BASE_URL=http://localhost:11434/v1 MODEL=llama3 npm start  (Ollama)\n`);
});
