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
    name: 'Giám đốc',
    emoji: '👔',
    color: '#e74c3c',
    position: { x: 400, y: 80 },
    system: `Bạn là CEO của công ty AI Town. Bạn ra quyết định chiến lược, quản lý tổng thể.
Tính cách: quyết đoán, nhìn xa trông rộng, hay dùng từ "chiến lược", "tầm nhìn".
Trả lời ngắn gọn, dưới 3 câu.`,
    memory: [],
    status: 'Đang review báo cáo quý',
  },
  marketing: {
    name: 'Marketing',
    emoji: '📢',
    color: '#e67e22',
    position: { x: 150, y: 250 },
    system: `Bạn là trưởng phòng Marketing. Bạn chuyên về content, social media, chiến dịch quảng cáo.
Tính cách: sáng tạo, năng động, hay dùng buzzword marketing.
Trả lời ngắn gọn, dưới 3 câu.`,
    memory: [],
    status: 'Đang lên kế hoạch campaign Q3',
  },
  dev: {
    name: 'Phát triển',
    emoji: '💻',
    color: '#2ecc71',
    position: { x: 650, y: 250 },
    system: `Bạn là trưởng phòng Phát triển (Dev Lead). Bạn chuyên code, kiến trúc hệ thống, review code.
Tính cách: logic, thích tối ưu, hay nói về tech stack, clean code, scalability.
Trả lời ngắn gọn, dưới 3 câu.`,
    memory: [],
    status: 'Đang refactor authentication module',
  },
  design: {
    name: 'Thiết kế',
    emoji: '🎨',
    color: '#9b59b6',
    position: { x: 150, y: 450 },
    system: `Bạn là trưởng phòng Thiết kế (Design Lead). Bạn chuyên UI/UX, branding, visual design.
Tính cách: thẩm mỹ cao, hay nói về user experience, color theory, typography.
Trả lời ngắn gọn, dưới 3 câu.`,
    memory: [],
    status: 'Đang thiết kế landing page mới',
  },
  data: {
    name: 'Dữ liệu',
    emoji: '📊',
    color: '#3498db',
    position: { x: 650, y: 450 },
    system: `Bạn là trưởng phòng Dữ liệu (Data Lead). Bạn chuyên phân tích data, ML, báo cáo.
Tính cách: chính xác, dựa trên số liệu, hay quote thống kê và metrics.
Trả lời ngắn gọn, dưới 3 câu.`,
    memory: [],
    status: 'Đang phân tích user retention',
  },
  hr: {
    name: 'Nhân sự',
    emoji: '🤝',
    color: '#1abc9c',
    position: { x: 400, y: 600 },
    system: `Bạn là trưởng phòng Nhân sự (HR Lead). Bạn chuyên tuyển dụng, đào tạo, văn hóa công ty.
Tính cách: thân thiện, quan tâm mọi người, hay nói về team building, culture fit.
Trả lời ngắn gọn, dưới 3 câu.`,
    memory: [],
    status: 'Đang phỏng vấn ứng viên mới',
  },
};

const agentActivities = [
  'đang họp với team',
  'đang uống cà phê',
  'đang brainstorm',
  'đang review tài liệu',
  'đang trả lời email',
  'đang nghỉ trưa',
  'đang pair programming',
  'đang gọi điện khách hàng',
];

setInterval(() => {
  for (const [id, dept] of Object.entries(departments)) {
    if (Math.random() < 0.15) {
      dept.status = agentActivities[Math.floor(Math.random() * agentActivities.length)];
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
        message: `[Lỗi kết nối AI - kiểm tra OPENAI_API_KEY hoặc OPENAI_BASE_URL]\n${err.message}`,
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
            content: `Bạn là ${fromDept.name} (${fromDept.emoji}) đang họp với ${toDept.name} (${toDept.emoji}).
Mô phỏng cuộc họp ngắn giữa 2 phòng ban về chủ đề được đưa ra.
Format: mỗi người nói 1-2 câu, tổng 4-6 lượt. Dùng emoji để phân biệt ai nói.
Viết bằng tiếng Việt.`,
          },
          { role: 'user', content: `Chủ đề họp: ${topic}` },
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
        conversation: `[Lỗi: ${err.message}]`,
      });
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🏢 AI Town đang chạy tại http://localhost:${PORT}`);
  console.log(`\nCấu hình:`);
  console.log(`  Model: ${MODEL}`);
  console.log(`  API Base: ${openai.baseURL}`);
  console.log(`  Để dùng Ollama: OPENAI_BASE_URL=http://localhost:11434/v1 MODEL=llama3 npm start\n`);
});
