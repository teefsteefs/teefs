# J.A.R.V.I.S — Trợ lý AI giọng nói kiểu Iron Man

Trợ lý ảo điều khiển bằng giọng nói, lấy cảm hứng từ JARVIS: bạn ra lệnh bằng lời, nó **tự quyết định** có cần lên web tìm kiếm ngầm hay không tùy độ khó của câu hỏi, **ghi nhớ** hội thoại lẫn thông tin về bạn, rồi trả lời bằng giọng nói.

Thiết kế theo nguyên tắc **không có điểm chết**: thiếu API key nào hệ thống cũng tự hạ cấp xuống tầng thấp hơn và vẫn hoạt động — kể cả khi **không có bất kỳ key nào**, trợ lý vẫn tự lên web tìm kiếm được. Chế độ agent chạy được với **Claude (Anthropic) hoặc OpenAI** — có key nào dùng key đó, có cả hai thì Claude ưu tiên và OpenAI làm dự phòng tự động.

```
Trình duyệt (Chrome/Edge)                    Máy chủ Node.js
┌─────────────────────────┐   SSE stream   ┌──────────────────────────────────────┐
│ 🎤 Wake word "Jarvis"    │◄──────────────►│ Orchestrator                         │
│    Push-to-talk (Space)  │                │  1️⃣ Kỹ năng cục bộ (giờ/ngày/toán)   │
│ 🔊 Đọc câu trả lời (TTS)  │                │  2️⃣ Lệnh ghi nhớ ("nhớ rằng …")      │
│    Lò phản ứng hồ quang   │                │  3️⃣ Agent LLM (Claude ▸ OpenAI)      │
│    Hiển thị nguồn         │                │     ├─ web_search  ├─ read_page      │
└─────────────────────────┘                │     ├─ get_weather └─ remember       │
                                            │  4️⃣ Chế độ trực tiếp (không cần LLM) │
                                            │     router heuristic → search web    │
                                            └──────────────┬───────────────────────┘
                                                           ▼
                                   Chuỗi tìm kiếm fallback (thử lần lượt tới khi được):
                                   Brave* → Tavily* → DuckDuckGo → DDG Lite → Wikipedia
                                   (* chỉ khi có key — 3 tầng cuối hoàn toàn miễn phí)
```

## Tính năng

- **Ra lệnh giọng nói**: gọi *"Jarvis"* để đánh thức, hoặc giữ phím `Space`, hoặc bấm nút mic. Hỗ trợ tiếng Việt và tiếng Anh.
- **Tự tìm web theo độ khó câu hỏi**: câu dễ (kiến thức chung, chào hỏi, tính toán) trả lời ngay; câu cần thông tin mới (giá cả, tin tức, thời tiết, sự kiện) tự động tìm kiếm ngầm rồi mới trả lời, kèm nguồn hiển thị trên màn hình.
- **Trả lời bằng giọng nói** (đọc từng câu ngay khi đang stream), ngắt lời được bằng `Esc` hoặc nói đè.
- **Không phụ thuộc key**:
  - Có `ANTHROPIC_API_KEY` **hoặc** `OPENAI_API_KEY` → chế độ **agent**: AI tự quyết định dùng tool nào. Có cả hai → Claude ưu tiên, backend kia tự thay khi lỗi.
  - Không có key LLM → chế độ **direct**: router heuristic tự phân loại câu hỏi và tự tìm web, trả lời trích xuất từ kết quả.
  - Không có key tìm kiếm → dùng DuckDuckGo + Wikipedia (miễn phí, không cần đăng ký).
  - LLM đang chạy mà lỗi giữa chừng → tự động chuyển sang chế độ direct cho request đó, tự thử lại sau 5 phút.
- **Trí nhớ hai tầng, lưu trên đĩa** (sống qua restart, trong `jarvis/data/`):
  - *Bộ nhớ hội thoại* theo phiên để hỏi nối tiếp ("giá bitcoin?" → "còn ethereum thì sao?").
  - *Trí nhớ dài hạn* về bạn: nói **"nhớ rằng tôi thích trả lời ngắn gọn"** ở bất kỳ chế độ nào; ở chế độ agent AI còn **tự nhận ra** thông tin đáng nhớ (tên, sở thích, dự án) qua tool `remember`. Hỏi lại bằng "bạn đang nhớ những gì?", xóa bằng "quên hết đi".
- **Kỹ năng cục bộ tức thì** (không cần mạng): xem giờ, ngày tháng, tính toán ("125 nhân 8", "5% của 200", "căn bậc hai của 144").
- **Thời tiết không cần key** qua Open-Meteo.

## Chạy nhanh

Yêu cầu: Node.js ≥ 20, trình duyệt Chrome hoặc Edge (Web Speech API).

```bash
cd jarvis
npm install
npm start
# mở http://localhost:3000
```

Chạy được ngay không cần cấu hình gì — đó là chế độ direct. Để bật chế độ agent (thông minh hơn nhiều), điền **một trong hai** key:

```bash
cp .env.example .env        # Windows: copy .env.example .env
# mở .env, điền MỘT trong hai dòng:
#   ANTHROPIC_API_KEY=sk-ant-...   (Claude — platform.claude.com)
#   OPENAI_API_KEY=sk-...          (OpenAI — platform.openai.com/api-keys)
npm start
```

Log khởi động sẽ in `AGENT mode: openai (gpt-4o) ...` (hoặc `claude (...)`) và pill góc phải giao diện chuyển thành `agent · ...` — đó là dấu hiệu key hoạt động.

> 🎤 **Micro chỉ hoạt động trên `localhost` hoặc HTTPS** — đây là quy định của trình duyệt. Truy cập qua IP LAN (http://192.168.x.x) sẽ gõ được nhưng không nói được.

## Cấu hình (.env)

Tất cả biến đều **tùy chọn** — xem `.env.example` để có mô tả đầy đủ.

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `ANTHROPIC_API_KEY` | *(trống)* | Bật chế độ agent với Claude. |
| `OPENAI_API_KEY` | *(trống)* | Bật chế độ agent với OpenAI (dùng khi không có key Claude, hoặc làm dự phòng). |
| `LLM_PROVIDER` | `auto` | `auto` \| `claude` \| `openai` \| `none` — ép chọn backend thay vì tự động. |
| `CLAUDE_MODEL` | `claude-opus-4-8` | Model Claude sử dụng. |
| `CLAUDE_EFFORT` | `medium` | `low`→`max`. Thấp = phản hồi nhanh hơn (phù hợp giọng nói), cao = suy luận sâu hơn. |
| `OPENAI_MODEL` | `gpt-4o` | Model OpenAI — đổi thành `gpt-5-mini`, `gpt-4o-mini`… tùy tài khoản. |
| `OPENAI_BASE_URL` | *(trống)* | Endpoint tương thích OpenAI (gateway nội bộ, LM Studio, v.v.). |
| `BRAVE_SEARCH_API_KEY` | *(trống)* | Thêm Brave vào đầu chuỗi tìm kiếm. |
| `TAVILY_API_KEY` | *(trống)* | Thêm Tavily vào chuỗi tìm kiếm. |
| `DEFAULT_TIMEZONE` | `Asia/Ho_Chi_Minh` | Múi giờ khi client không gửi. |
| `DEFAULT_CITY` | `Hà Nội` | Nơi xem thời tiết khi không nói địa điểm (chế độ direct). |
| `DATA_DIR` | `jarvis/data` | Nơi lưu hội thoại + trí nhớ dài hạn. |
| `PORT` / `HOST` | `3000` / `0.0.0.0` | Cổng / địa chỉ lắng nghe. |
| `LOG_LEVEL` | `info` | `debug` để xem chi tiết từng bước. |

## Hai chế độ hoạt động

### 🧠 Chế độ agent (có key Claude hoặc OpenAI)

AI nhận câu lệnh kèm ngữ cảnh (giờ hiện tại, múi giờ, **những điều đã ghi nhớ về bạn**) và **tự quyết định**:

- Câu dễ, kiến thức ổn định → trả lời thẳng, không tốn thời gian tìm kiếm.
- Câu cần thông tin mới/địa phương/chuyên sâu ("giá bitcoin bao nhiêu?") → gọi tool `web_search` (chạy qua chuỗi fallback ở trên), cần thì `read_page` đọc hẳn nội dung trang, thời tiết thì `get_weather`.
- Bạn nói điều gì đáng nhớ ("tôi tên Nam", "nhớ giúp deadline thứ Sáu") → tự gọi tool `remember` lưu vào trí nhớ dài hạn.
- Câu trả lời được stream từng chữ về trình duyệt và đọc lên từng câu.

Đây chính là hành vi "tự search web ngầm tương ứng hoặc không, tùy độ khó". Hai backend cùng một bộ não (`server/llm/agentCore.js` — persona + tool + memory): Claude chạy qua `@anthropic-ai/sdk`, OpenAI chạy qua SDK `openai` chính thức; backend nào lỗi thì backend còn lại (nếu có key) tự tiếp quản.

### 🔎 Chế độ direct (không có key — vẫn tự lên web)

Router heuristic phân loại: chào hỏi → trả lời có sẵn; thời tiết → Open-Meteo; lệnh ghi nhớ → lưu/đọc trí nhớ; còn lại → **tự tìm web** qua chuỗi DuckDuckGo/Wikipedia rồi tổng hợp trích xuất từ kết quả (kèm nguồn). Câu trả lời ở chế độ này là trích dẫn trung thực từ web, không phải văn bản do LLM viết lại — vì vậy nó "kém thông minh" hơn hẳn chế độ agent; đây là lưới an toàn, không phải trải nghiệm chính.

## Trí nhớ

| Loại | Sống ở đâu | Cách hoạt động |
|---|---|---|
| Hội thoại phiên | `data/sessions.json` | 12 lượt gần nhất mỗi phiên trình duyệt, tự hết hạn sau 2 giờ không dùng; agent dùng để hiểu câu hỏi nối tiếp. |
| Trí nhớ dài hạn | `data/memory.json` | Các sự kiện ngắn về bạn, tiêm vào ngữ cảnh của agent ở mọi câu hỏi. Ghi bằng lệnh "nhớ rằng …" (mọi chế độ) hoặc tự động qua tool `remember` (chế độ agent). |

Lệnh giọng nói / gõ tay: **"nhớ rằng …"**, **"ghi nhớ: …"**, **"remember that …"** — lưu; **"bạn đang nhớ những gì?"** — đọc lại; **"quên hết đi"** / **"xóa trí nhớ"** — xóa sạch. Muốn xóa thủ công thì tắt server và xóa thư mục `data/`.

## Giọng nói

| Thao tác | Cách dùng |
|---|---|
| Wake word | Bật "Luôn lắng nghe" trong Cài đặt ⚙ rồi gọi **"Jarvis"** (chấp nhận cả các biến âm như "Javis"; đổi được từ khóa). |
| Push-to-talk | Giữ phím `Space` (khi không focus ô nhập), thả ra để gửi. |
| Nút mic / lò phản ứng | Bấm để nói, bấm lần nữa để dừng. |
| Ngắt lời | `Esc`, hoặc bấm vào lò phản ứng khi đang đọc. |
| Đổi ngôn ngữ nhận giọng | Cài đặt ⚙ → vi-VN / en-US. |

**Hỗ trợ trình duyệt**: Chrome/Edge đầy đủ; Safari đọc được nhưng nhận giọng hạn chế; Firefox không có SpeechRecognition (vẫn gõ và nghe đọc bình thường). Khi micro bị chặn, giao diện sẽ hướng dẫn cấp quyền.

## API

| Endpoint | Mô tả |
|---|---|
| `POST /api/chat` | Body `{sessionId, message, context:{timezone, locale}}`. Trả về SSE: `status` (đang tìm gì), `delta` (từng đoạn chữ), `sources`, `done`, `error`. |
| `GET /api/health` | Chế độ đang chạy, backend + model, số điều đang nhớ, chuỗi search khả dụng. |

## Kiểm thử

```bash
npm test   # 51 unit test: parser toán, router, parser DuckDuckGo, chống SSRF, weather, sessions, memory, chọn LLM
```

## Docker

```bash
docker build -t jarvis ./jarvis
docker run -p 3000:3000 --env-file jarvis/.env jarvis
```

## Ghi chú kỹ thuật & bảo mật

- **Zero framework, chỉ 2 dependency** (`@anthropic-ai/sdk`, `openai` — hai SDK chính thức): server viết bằng `node:http`, test bằng `node:test` — ít lớp trung gian, ít thứ để hỏng.
- Trí nhớ ghi đĩa **atomic** (ghi file tạm rồi rename) và debounce — không hỏng file khi tắt đột ngột.
- Tool `read_page` có **chống SSRF**: chặn localhost, dải IP nội bộ, cloud metadata, kể cả tên miền phân giải về IP nội bộ.
- Mọi request ra ngoài đều có **timeout cứng** và bị chặn kích thước tải về.
- Prompt hệ thống cố định (thân thiện với prompt cache); ngữ cảnh động (giờ, múi giờ) nằm trong tin nhắn người dùng.
- Sau mạng công ty/proxy: chạy với `NODE_USE_ENV_PROXY=1` (Node ≥ 22.18) để fetch đi qua `HTTPS_PROXY`.

## Khắc phục sự cố

| Hiện tượng | Nguyên nhân / cách xử lý |
|---|---|
| Pill hiển thị "chế độ tìm kiếm trực tiếp" dù đã có key | Xem log server — key sai hoặc không có mạng tới `api.anthropic.com`/`api.openai.com`; lý do in ngay lúc khởi động, hệ thống tự thử lại mỗi 5 phút. |
| Key OpenAI báo lỗi model | Tài khoản không có model mặc định `gpt-4o` → đặt `OPENAI_MODEL=` model bạn có (ví dụ `gpt-4o-mini`, `gpt-5-mini`). |
| "Tôi không truy cập được nguồn tìm kiếm nào" | Máy chủ không ra được internet (firewall/proxy). Thử `curl https://html.duckduckgo.com/html/?q=test` từ máy chủ. |
| Không nghe được giọng Việt | Máy thiếu voice vi-VN: Windows → Settings > Time & Language > Speech thêm tiếng Việt; macOS → System Settings > Accessibility > Spoken Content. Rồi chọn giọng trong Cài đặt ⚙. |
| Wake word không nhạy | Nói to rõ "Jarvis"; hoặc đổi từ đánh thức thành từ tiếng Việt dễ nhận ("đại bàng"…) trong Cài đặt. |
| Mic không hoạt động qua mạng LAN | Trình duyệt yêu cầu HTTPS — dùng localhost, hoặc đặt sau reverse proxy có TLS. |
