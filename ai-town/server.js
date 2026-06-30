const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const OpenAI = require('openai');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'sk-placeholder',
  baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
});

const MODEL = process.env.MODEL || 'gpt-4o-mini';

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
      socket.emit('chat-reply', {
        departmentId,
        message: `[AI connection error — check OPENAI_API_KEY or OPENAI_BASE_URL]\n${err.message}`,
      });
    }
  });

  socket.on('agent-meeting', async ({ from, to, topic }) => {
    const fromDept = departments[from];
    const toDept = departments[to];
    if (!fromDept || !toDept) return;

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
  console.log(`  Model: ${MODEL}`);
  console.log(`  API Base: ${openai.baseURL}`);
  console.log(`  For Ollama: OPENAI_BASE_URL=http://localhost:11434/v1 MODEL=llama3 npm start\n`);
});
