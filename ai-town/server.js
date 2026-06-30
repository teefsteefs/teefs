const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const OpenAI = require('openai');
const path = require('path');

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
