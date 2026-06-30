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

const tasks = {};

const fallbackTaskWork = {
  ceo: {
    accept: "Got it. I'll review this and align it with our strategic priorities.",
    progress: [
      "Reviewing strategic alignment with company goals...",
      "Drafting executive summary and key action items...",
      "Consulting with leadership team on resource allocation...",
    ],
    done: "✅ Done! I've prepared an executive brief with strategic recommendations and resource plan. Key takeaway: this aligns well with our Q3 objectives. I've scheduled a follow-up review for next week.",
  },
  engineering: {
    accept: "Understood. I'll break this down into tickets and start working on it.",
    progress: [
      "Breaking down requirements into technical specs...",
      "Setting up the project structure and dependencies...",
      "Writing core logic and unit tests...",
      "Running CI pipeline and code review...",
    ],
    done: "✅ Done! Implementation is complete — all tests passing, code reviewed, and deployed to staging. PR #42 is ready for review. Performance benchmarks look good: 200ms avg response time.",
  },
  marketing: {
    accept: "On it! I'll draft a plan and loop in the content team.",
    progress: [
      "Researching target audience and competitive landscape...",
      "Creating content brief and campaign assets...",
      "Setting up A/B test variants and tracking pixels...",
    ],
    done: "✅ Done! Campaign is live with 3 variants. Landing page copy is finalized, social assets are scheduled for the next 2 weeks. Estimated reach: 50K impressions. Tracking dashboard is set up.",
  },
  design: {
    accept: "Thanks for the brief! I'll start sketching out concepts.",
    progress: [
      "Creating wireframes and user flow diagrams...",
      "Exploring visual directions and color palettes...",
      "Building high-fidelity mockups in Figma...",
    ],
    done: "✅ Done! Final designs are in Figma — 3 screens with responsive variants. Used our updated design system tokens. User flow reduces clicks by 40% compared to current. Ready for dev handoff!",
  },
  data: {
    accept: "I'll pull the relevant data and start the analysis.",
    progress: [
      "Querying data warehouse and cleaning datasets...",
      "Running statistical analysis and building models...",
      "Creating visualization dashboard with key metrics...",
    ],
    done: "✅ Done! Analysis complete — dashboard is live with real-time metrics. Key finding: 23% improvement opportunity identified. Confidence interval: 95%. Full report with methodology attached.",
  },
  hr: {
    accept: "Noted! I'll coordinate with the team right away.",
    progress: [
      "Reviewing team capacity and availability...",
      "Drafting communication plan and scheduling...",
      "Coordinating with stakeholders and getting approvals...",
    ],
    done: "✅ Done! Everything is coordinated — team is aligned, schedule is set, and all stakeholders have confirmed. Sent calendar invites and updated the team wiki. Feedback survey will go out next week.",
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

  socket.on('assign-task', async ({ from, to, description, priority }) => {
    const fromDept = departments[from];
    const toDept = departments[to];
    if (!fromDept || !toDept) return;

    const taskId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const task = { id: taskId, from, to, description, priority, status: 'pending', time: Date.now(), progress: 0 };
    if (!tasks[to]) tasks[to] = [];
    tasks[to].push(task);

    const speedMs = priority === 'urgent' ? 3000 : priority === 'high' ? 5000 : 8000;

    if (!HAS_AI) {
      const work = fallbackTaskWork[to] || fallbackTaskWork.ceo;

      // Step 1: Accept
      setTimeout(() => {
        task.status = 'accepted';
        socket.emit('task-update', { taskId, departmentId: to, status: 'accepted', message: work.accept });
        toDept.status = `Working on: ${description.slice(0, 30)}...`;
        io.emit('agent-status', { id: to, status: toDept.status });
      }, 800 + Math.random() * 500);

      // Step 2: Progress updates
      work.progress.forEach((msg, i) => {
        setTimeout(() => {
          task.status = 'in-progress';
          task.progress = Math.round(((i + 1) / work.progress.length) * 80);
          socket.emit('task-update', { taskId, departmentId: to, status: 'in-progress', message: msg, progress: task.progress });
        }, speedMs * (i + 1) + Math.random() * 1000);
      });

      // Step 3: Complete
      setTimeout(() => {
        task.status = 'done';
        task.progress = 100;
        task.result = work.done;
        socket.emit('task-update', { taskId, departmentId: to, status: 'done', message: work.done, progress: 100 });
        toDept.status = activities[Math.floor(Math.random() * activities.length)];
        io.emit('agent-status', { id: to, status: toDept.status });
      }, speedMs * (work.progress.length + 1) + 1000);

      return;
    }

    try {
      // AI mode: accept
      const acceptRes = await openai.chat.completions.create({
        model: MODEL,
        messages: [
          { role: 'system', content: toDept.system + '\nYou just received a task. Acknowledge it briefly (1 sentence) and say you are starting.' },
          { role: 'user', content: `Task from ${fromDept.name} (${priority} priority): ${description}` },
        ],
        max_tokens: 100,
      });
      task.status = 'accepted';
      socket.emit('task-update', { taskId, departmentId: to, status: 'accepted', message: acceptRes.choices[0].message.content });
      toDept.status = `Working on: ${description.slice(0, 30)}...`;
      io.emit('agent-status', { id: to, status: toDept.status });

      // AI mode: progress updates
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
        socket.emit('task-update', { taskId, departmentId: to, status: 'in-progress', message: progRes.choices[0].message.content, progress: task.progress });
      }

      // AI mode: complete
      await new Promise(r => setTimeout(r, speedMs));
      const doneRes = await openai.chat.completions.create({
        model: MODEL,
        messages: [
          { role: 'system', content: toDept.system + '\nYou just finished a task. Summarize what you delivered in 2-3 sentences. Start with ✅.' },
          { role: 'user', content: `Completed task: ${description}` },
        ],
        max_tokens: 150,
      });
      task.status = 'done';
      task.progress = 100;
      task.result = doneRes.choices[0].message.content;
      socket.emit('task-update', { taskId, departmentId: to, status: 'done', message: task.result, progress: 100 });
      toDept.status = activities[Math.floor(Math.random() * activities.length)];
      io.emit('agent-status', { id: to, status: toDept.status });
    } catch (err) {
      console.error('Task AI Error:', err.message);
      const work = fallbackTaskWork[to] || fallbackTaskWork.ceo;
      task.status = 'done';
      task.result = work.done;
      socket.emit('task-update', { taskId, departmentId: to, status: 'done', message: work.done, progress: 100 });
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
