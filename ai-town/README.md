# 🏢 AI Town - Công ty AI ảo

Multi-agent simulation - mỗi phòng ban là 1 AI agent có tính cách và chức năng riêng.

## Phòng ban

| Phòng | Emoji | Chức năng |
|-------|-------|-----------|
| Giám đốc | 👔 | Ra quyết định chiến lược |
| Marketing | 📢 | Content, quảng cáo, social media |
| Phát triển | 💻 | Code, kiến trúc, tech |
| Thiết kế | 🎨 | UI/UX, branding |
| Dữ liệu | 📊 | Phân tích data, ML, báo cáo |
| Nhân sự | 🤝 | Tuyển dụng, đào tạo |

## Cài đặt

```bash
cd ai-town
npm install
```

## Chạy

### Với OpenAI API
```bash
OPENAI_API_KEY=sk-xxx npm start
```

### Với Ollama (miễn phí, chạy local)
```bash
# Cài Ollama trước: curl -fsSL https://ollama.ai/install.sh | sh
# Pull model: ollama pull llama3
OPENAI_BASE_URL=http://localhost:11434/v1 MODEL=llama3 npm start
```

### Với bất kỳ OpenAI-compatible API nào
```bash
OPENAI_BASE_URL=http://your-api:8000/v1 OPENAI_API_KEY=xxx MODEL=model-name npm start
```

Mở trình duyệt tại `http://localhost:3000`

## Tính năng

- 🗺️ Map 2D với các phòng ban
- 🧑 Nhân vật di chuyển giữa các phòng
- 💬 Chat với từng phòng ban (mỗi agent có tính cách riêng)
- 🤝 Tổ chức cuộc họp giữa 2 phòng ban
- 🔄 Agent tự động thay đổi trạng thái hoạt động
