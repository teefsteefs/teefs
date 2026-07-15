# J.A.R.V.I.S. — Control Interface

Giao diện HUD kiểu Iron Man, chạy hoàn toàn trong trình duyệt. Một file duy nhất
`index.html`, không cần build, không phụ thuộc CDN.

## Chạy local (1 lệnh)

Cần Python 3 (Windows: cài từ Microsoft Store, gõ `python` sẽ được gợi ý cài).
Đặt `index.html` và `jarvis-server.py` cùng thư mục, rồi:

```bash
python jarvis-server.py        # Windows
python3 jarvis-server.py       # macOS/Linux
# mở http://localhost:5050
```

Server này vừa phục vụ trang, vừa cung cấp API `/api/gold` (giá vàng SJC)
và `/api/weather` (thời tiết theo IP). Vì là `localhost` nên micro hoạt
động không cần HTTPS.

> Mở nhanh không cần Python: nhấp đúp `index.html` — giao diện và gõ lệnh
> vẫn chạy, nhưng không có micro, giá vàng và thời tiết theo IP.

## Deploy lên VPS

Xem `server-setup.sh` (nginx + HTTPS tự ký, chạy 1 lần trên server),
`api-setup.sh` (cài API thành systemd service + proxy `/api/`), và
`deploy.sh` (đẩy `index.html` lên server).

## Tính năng

- **Lõi arc reactor** xoay, telemetry sống (CPU/nguồn/nhiệt/mạng), đồng hồ thời gian thực.
- **Điều khiển bằng giọng nói** (Web Speech API) + **trả lời bằng giọng nói** (SpeechSynthesis). Nút `VI/EN` đổi ngôn ngữ.
- **Console gõ lệnh** làm phương án dự phòng khi trình duyệt không hỗ trợ mic.
- **Bảng thiết bị**: đèn, điều hòa, nhạc, cửa, TV — bấm hoặc ra lệnh để bật/tắt (đang là mô phỏng).
- **Engine lệnh**: giờ/ngày, thời tiết (open-meteo), tính toán, mở website, tìm kiếm, báo cáo hệ thống, trò chuyện.

Thử nói/gõ: `bật đèn phòng khách`, `tắt tất cả`, `mấy giờ rồi`, `thời tiết`,
`tính 15% của 240`, `mở youtube`, `tìm iron man`, `báo cáo hệ thống`, `help`.

## "Điều khiển mọi thứ" — sự thật về giới hạn

Một trang web chạy trong trình duyệt bị **sandbox** vì lý do bảo mật: nó không thể
tự bật đèn nhà bạn, mở app trên máy, hay điều khiển phần cứng. Nó chỉ điều khiển
được những gì **có API**. Hiện tại các thiết bị trong bảng là *mô phỏng* để bạn thấy
luồng hoạt động. Để điều khiển thật, nối engine lệnh vào một API thật.

## Cách mở rộng (nối vào hệ thống thật)

Toàn bộ engine được expose qua `window.JARVIS`. Ví dụ nối một thiết bị vào backend
Directus của repo này, hoặc một hub smart-home:

```js
// Ghi đè hành vi bật/tắt để gọi API thật
const _toggle = window.JARVIS.toggleDevice;
window.JARVIS.toggleDevice = (dev, el, force) => {
  const on = _toggle(dev, el, force);
  fetch("/items/devices/" + dev.id, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: "Bearer <TOKEN>" },
    body: JSON.stringify({ state: on })
  });
  return on;
};

// Thêm kỹ năng mới
// (trong index.html, thêm một nhánh regex trong hàm handle())
```

Các hướng nối thật phổ biến:

- **Smart home**: Home Assistant REST API, Philips Hue, Tuya, SmartThings.
- **Nội dung/dữ liệu**: Directus REST/GraphQL (chính repo này).
- **AI hội thoại thật**: gọi Claude API ở backend để hiểu ngôn ngữ tự nhiên thay cho regex.
- **Máy tính/OS**: cần một agent chạy nền (không làm được thuần trình duyệt).
