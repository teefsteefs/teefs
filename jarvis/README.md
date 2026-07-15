# J.A.R.V.I.S — Trợ lý AI giọng nói kiểu Iron Man

Trợ lý ảo điều khiển bằng giọng nói, lấy cảm hứng từ JARVIS: bạn ra lệnh bằng lời, nó **tự quyết định** có cần lên web tìm kiếm ngầm hay không tùy độ khó của câu hỏi, rồi trả lời bằng giọng nói.

Thiết kế theo nguyên tắc **không có điểm chết**: thiếu API key nào hệ thống cũng tự hạ cấp xuống tầng thấp hơn và vẫn hoạt động — kể cả khi **không có bất kỳ key nào**, trợ lý vẫn tự lên web tìm kiếm được.

```
Trình duyệt (Chrome/Edge)                    Máy chủ Node.js
┌─────────────────────────┐   SSE stream   ┌──────────────────────────────────────┐
│ 🎤 Wake word "Jarvis"    │◄──────────────►│ Orchestrator                         │
│    Push-to-talk (Space)  │                │  1️⃣ Kỹ năng cục bộ (giờ/ngày/toán)   │
│ 🔊 Đọc câu trả lời (TTS)  │                │  2️⃣ Agent Claude + tool use          │
│    Lò phản ứng hồ quang   │                │     ├─ web_search  ├─ read_page      │
│    Hiển thị nguồn         │                │     └─ get_weather (tự chọn tool)    │
└─────────────────────────┘                │  3️⃣ Chế độ trực tiếp (không cần LLM) │
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
  - Có `ANTHROPIC_API_KEY` → chế độ **agent**: Claude tự quyết định dùng tool nào.
  - Không có key LLM → chế độ **direct**: router heuristic tự phân loại câu hỏi và tự tìm web, trả lời trích xuất từ kết quả.
  - Không có key tìm kiếm → dùng DuckDuckGo + Wikipedia (miễn phí, không cần đăng ký).
  - LLM đang chạy mà lỗi giữa chừng → tự động chuyển sang chế độ direct cho request đó, tự thử lại sau 5 phút.
- **Kỹ năng cục bộ tức thì** (không cần mạng): xem giờ, ngày tháng, tính toán ("125 nhân 8", "5% của 200", "căn bậc hai của 144").
- **Thời tiết không cần key** qua Open-Meteo.
- **Bộ nhớ hội thoại** theo phiên để hỏi nối tiếp.

## Chạy nhanh

Yêu cầu: Node.js ≥ 20, trình duyệt Chrome hoặc Edge (Web Speech API).

```bash
cd jarvis
npm install
npm start
# mở http://localhost:3000
```

Chạy được ngay không cần cấu hình gì — đó là chế độ direct. Để bật chế độ agent (thông minh hơn nhiều):

```bash
cp .env.example .env
# mở .env, điền ANTHROPIC_API_KEY=sk-ant-...
npm start
```

> 🎤 **Micro chỉ hoạt động trên `localhost` hoặc HTTPS** — đây là quy định của trình duyệt. Truy cập qua IP LAN (http://192.168.x.x) sẽ gõ được nhưng không nói được.

## Cấu hình (.env)

Tất cả biến đều **tùy chọn** — xem `.env.example` để có mô tả đầy đủ.

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `ANTHROPIC_API_KEY` | *(trống)* | Bật chế độ agent. Không có → chế độ direct. |
| `CLAUDE_MODEL` | `claude-opus-4-8` | Model Claude sử dụng. |
| `CLAUDE_EFFORT` | `medium` | `low`→`max`. Thấp = phản hồi nhanh hơn (phù hợp giọng nói), cao = suy luận sâu hơn. |
| `BRAVE_SEARCH_API_KEY` | *(trống)* | Thêm Brave vào đầu chuỗi tìm kiếm. |
| `TAVILY_API_KEY` | *(trống)* | Thêm Tavily vào chuỗi tìm kiếm. |
| `DEFAULT_TIMEZONE` | `Asia/Ho_Chi_Minh` | Múi giờ khi client không gửi. |
| `DEFAULT_CITY` | `Hà Nội` | Nơi xem thời tiết khi không nói địa điểm (chế độ direct). |
| `PORT` / `HOST` | `3000` / `0.0.0.0` | Cổng / địa chỉ lắng nghe. |
| `LOG_LEVEL` | `info` | `debug` để xem chi tiết từng bước. |

## Hai chế độ hoạt động

### 🧠 Chế độ agent (có `ANTHROPIC_API_KEY`)

Claude nhận câu lệnh kèm ngữ cảnh (giờ hiện tại, múi giờ) và **tự quyết định**:

- Câu dễ, kiến thức ổn định → trả lời thẳng, không tốn thời gian tìm kiếm.
- Câu cần thông tin mới/địa phương/chuyên sâu → gọi tool `web_search` (chạy qua chuỗi fallback ở trên), cần thì `read_page` đọc hẳn nội dung trang, thời tiết thì `get_weather`.
- Câu trả lời được stream từng chữ về trình duyệt và đọc lên từng câu.

Đây chính là hành vi "tự search web ngầm tương ứng hoặc không, tùy độ khó".

### 🔎 Chế độ direct (không có key — vẫn tự lên web)

Router heuristic phân loại: chào hỏi → trả lời có sẵn; thời tiết → Open-Meteo; còn lại → **tự tìm web** qua chuỗi DuckDuckGo/Wikipedia rồi tổng hợp trích xuất từ kết quả (kèm nguồn). Câu trả lời ở chế độ này là trích dẫn trung thực từ web, không phải văn bản do LLM viết lại.

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
| `GET /api/health` | Chế độ đang chạy, model, chuỗi search khả dụng. |

## Kiểm thử

```bash
npm test   # 39 unit test: parser toán, router, parser DuckDuckGo, chống SSRF, weather, sessions
```

## Docker

```bash
docker build -t jarvis ./jarvis
docker run -p 3000:3000 --env-file jarvis/.env jarvis
```

## Ghi chú kỹ thuật & bảo mật

- **Zero framework, 1 dependency duy nhất** (`@anthropic-ai/sdk`): server viết bằng `node:http`, test bằng `node:test` — ít lớp trung gian, ít thứ để hỏng.
- Tool `read_page` có **chống SSRF**: chặn localhost, dải IP nội bộ, cloud metadata, kể cả tên miền phân giải về IP nội bộ.
- Mọi request ra ngoài đều có **timeout cứng** và bị chặn kích thước tải về.
- Prompt hệ thống cố định (thân thiện với prompt cache); ngữ cảnh động (giờ, múi giờ) nằm trong tin nhắn người dùng.
- Sau mạng công ty/proxy: chạy với `NODE_USE_ENV_PROXY=1` (Node ≥ 22.18) để fetch đi qua `HTTPS_PROXY`.

## Khắc phục sự cố

| Hiện tượng | Nguyên nhân / cách xử lý |
|---|---|
| Pill hiển thị "chế độ tìm kiếm trực tiếp" dù đã có key | Xem log server — key sai hoặc không có mạng tới `api.anthropic.com`; hệ thống tự thử lại mỗi 5 phút. |
| "Tôi không truy cập được nguồn tìm kiếm nào" | Máy chủ không ra được internet (firewall/proxy). Thử `curl https://html.duckduckgo.com/html/?q=test` từ máy chủ. |
| Không nghe được giọng Việt | Máy thiếu voice vi-VN: Windows → Settings > Time & Language > Speech thêm tiếng Việt; macOS → System Settings > Accessibility > Spoken Content. Rồi chọn giọng trong Cài đặt ⚙. |
| Wake word không nhạy | Nói to rõ "Jarvis"; hoặc đổi từ đánh thức thành từ tiếng Việt dễ nhận ("đại bàng"…) trong Cài đặt. |
| Mic không hoạt động qua mạng LAN | Trình duyệt yêu cầu HTTPS — dùng localhost, hoặc đặt sau reverse proxy có TLS. |
