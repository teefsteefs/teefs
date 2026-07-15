# J.A.R.V.I.S. — Control Interface

Giao diện HUD kiểu Iron Man, chạy hoàn toàn trong trình duyệt. Một file duy nhất
`index.html`, không cần build, không phụ thuộc CDN.

## Chạy

- Mở nhanh: nhấp đúp `index.html`, hoặc
- Serve tĩnh (khuyên dùng để voice + geolocation hoạt động qua HTTPS/localhost):

```bash
cd jarvis
python3 -m http.server 8080
# mở http://localhost:8080
```

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
