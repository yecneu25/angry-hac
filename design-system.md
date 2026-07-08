# Design System — Bộ tài sản "Cực Quang & Hạc Pha Lê"

> Tài liệu được xây dựng từ việc phân tích trực tiếp 7 file ảnh gốc (bao gồm bản dựng tổng `COVER_2` và 6 lớp tài sản rời), trích xuất màu sắc thực tế bằng công cụ đo màu pixel để đảm bảo bảng màu chính xác với nguồn.

---

## 1. Concept & Mood

Một khung cảnh thiên nhiên huyền ảo về đêm ở vùng núi cao: cực quang (aurora borealis) trải dài trên bầu trời sao, mưa sao băng, thung lũng núi đá granite, đồng rêu phủ hoa dại, và một dòng thác/suối nơi các **mảnh pha lê phát sáng** trồi lên từ mặt nước như phép màu. Nhân vật/biểu tượng trung tâm là một **con hạc được tạc hoàn toàn từ pha lê đa giác (faceted crystal)** — vừa là hero-art, vừa đóng vai trò logo/mascot.

**Từ khóa cảm xúc:** huyền bí – tĩnh lặng – lấp lánh – lạnh giá – linh thiêng – hùng vĩ – phép màu về đêm.

**Thể loại thị giác:** matte painting phong cảnh (điện ảnh/game) kết hợp render vật liệu pha lê low-poly cho vật thể biểu tượng.

---

## 2. Bảng màu (đo trực tiếp từ ảnh gốc)

### 2.1 Nền — Midnight Indigo (chiếm ưu thế toàn cảnh, ~70% diện tích)
| Swatch | Hex | Vai trò |
|---|---|---|
| 🟦 | `#001050` | Base tối nhất — vùng trời trên cao, bóng đổ |
| 🟦 | `#002070` | Base bầu trời chính |
| 🟦 | `#0030A0` | Bầu trời trung, vùng chuyển sáng |
| 🟦 | `#0040B0` | Vùng sáng nhất của nền trời/nước |

### 2.2 Cực quang & điểm sáng — Aurora Cyan
| Swatch | Hex | Vai trò |
|---|---|---|
| 🟩🟦 | `#48D0F8` | Dải cực quang chính |
| 🟩🟦 | `#58D8F8` | Lõi sáng của cực quang |
| ⬜🟦 | `#A8F8F8` | Điểm sáng nhất, gần trắng-ngọc |

### 2.3 Pha lê / hạc (hero material) — Sapphire Crystal
| Swatch | Hex | Vai trò |
|---|---|---|
| 🟦 | `#0030D8 – #0078D8` | Dải mặt cắt (facet) chính của pha lê, đậm nhạt xen kẽ tạo khối |
| ⬜ | `#F8F8F8` | Highlight/khúc xạ ánh sáng trên các mặt cắt (rất nhiều, đặc trưng của chất liệu kim cương) |

### 2.4 Địa hình / đá / rêu — Obsidian & Night-Moss (được "nhuộm" xanh đêm, gần như khử màu lục thật)
| Swatch | Hex | Vai trò |
|---|---|---|
| ⬛ | `#000010 – #000020` | Đá tối nhất, vùng khuất sáng |
| 🟦⬛ | `#001030 – #002050` | Khối đá chính (ROCK_PHẢI, PHIẾN_ĐÁ) |
| 🟦⬛ | `#103050 – #205060` | Rêu/cỏ (CỎ, ĐẤT_TRÁI) — xanh lục bị "grade" lạnh thành xanh dương-đen |

### 2.5 Điểm nhấn hiếm — Magic Accents (dùng rất tiết chế, <2% diện tích)
| Swatch | Hex (ước lượng) | Vai trò |
|---|---|---|
| 🌸 | `~#FF8FA0` | Tam giác pha lê hồng san hô, lơ lửng trong hiệu ứng |
| 🌤️ | `~#F8D0D8` | Ánh hồng nhạt trong mây/sương |
| 🌕 | `~#FFD87A` | Tam giác pha lê vàng/cam, đốm sáng ấm trong nước |
| 🟢 | `~#5EE8C5` | Tam giác pha lê ngọc lục bảo/mint |

> **Nguyên tắc dùng màu:** 95% khung hình là **đơn sắc lạnh (monochromatic blue)** — kể cả các yếu tố vốn "ấm" như cỏ, rêu, đất đều bị nhuộm xanh để giữ mood đêm thống nhất. Màu ấm (hồng/vàng/cam) **chỉ** xuất hiện ở các hạt pha lê/sparkle rất nhỏ, đóng vai trò "gia vị thị giác" — không bao giờ dùng làm màu nền hay khối lớn.

---

## 3. Chất liệu (Material Language)

Hệ thống dùng **2 ngôn ngữ chất liệu song song**, cố ý tương phản:

1. **Painterly / Photobash tự nhiên** — áp dụng cho: bầu trời, núi, đá, rêu, nước, cực quang.
   - Texture chi tiết, ánh sáng khuếch tán mềm, có sương mù/độ mờ theo chiều sâu (atmospheric perspective).
   - Bề mặt đá: gồ ghề, ướt, phản chiếu ánh sáng lạnh.
   - Nước: trong, có tia sáng lấp lánh (bokeh) và bọt tung tóe.

2. **Faceted Crystal / Low-poly Gem** — áp dụng riêng cho: hạc (LOGO/hero) và các mảnh pha lê rải rác (FX).
   - Hình khối đa giác sắc cạnh, mỗi mặt là một tam giác/tứ giác phẳng với độ sáng khác nhau → tạo cảm giác kim cương/thủy tinh cắt mài.
   - Độ trong suốt cao, khúc xạ ánh sáng trắng gắt trên các cạnh, bóng đổ xanh sapphire ở mặt khuất.
   - Không có texture bề mặt (khác hẳn với đá/rêu) — đây là dấu hiệu nhận diện để phân biệt "vật thể phép màu" với "thế giới tự nhiên".

**Ý nghĩa biểu tượng gợi ý:** hạc pha lê = linh vật/thông điệp tinh khiết, quý giá, "kết tinh" giữa thiên nhiên hoang sơ — phù hợp làm logo/mascot có thể tách lớp dùng độc lập.

---

## 4. Ánh sáng & Hiệu ứng (Lighting & FX)

- **Nguồn sáng chủ đạo:** lạnh, từ cực quang phía trên + phản chiếu trên mặt nước phía dưới → tạo trục sáng dọc trung tâm khung hình.
- **Glow/Bloom:** cực quang và các mặt pha lê đều có quầng sáng mềm (bloom), không có viền cứng.
- **Hạt lấp lánh (sparkle particles):** rải ngẫu nhiên, kích thước đa dạng, phần lớn dạng tam giác pha lê nhỏ (trong suốt/trắng-xanh), số ít có màu accent ấm.
- **Mưa sao băng:** các vệt sáng dọc mảnh, mờ dần về phía dưới, mật độ cao ở nửa trên khung hình.
- **Nước bắn tóe (PHIẾN_ĐÁ):** giọt nước+bọt kết hợp đốm sáng vàng/xanh nhỏ, rìa ảnh có gradient mờ dần ra trong suốt (feathered edge) để dễ chồng lớp.

---

## 5. Cấu trúc lớp / Hệ thống asset (Layer Architecture)

Dựa theo 5 nhóm thư mục gốc, ánh xạ với các file đã cung cấp:

| Nhóm | Vai trò | File tương ứng |
|---|---|---|
| **BACKGROUND** | Lớp nền xa nhất — bầu trời đêm, cực quang, núi xa, sao. Ít chi tiết, không cutout (full-bleed). | *(tích hợp sẵn trong nửa trên của `COVER_2`)* |
| **ELEMENTS-structure** | Khối địa hình/đá tĩnh dùng dựng khung — không chuyển động, định hình bố cục. | `CỎ`, `ĐẤT_TRÁI`, `ROCK_PHẢI`, `ROCK_PHẢI_2` |
| **ELEMENTS-fx** | Hiệu ứng động/ánh sáng — nước, hạt sáng, mảnh pha lê bay. | `PHIẾN_ĐÁ` (nước bắn tóe), các hạt pha lê rải trong `COVER_2` |
| **LOGO** | Vật thể biểu tượng trung tâm, chất liệu pha lê, dùng độc lập được. | `HẠC` |
| **MAIN** | Bản dựng hoàn chỉnh — tài liệu tham chiếu quan trọng nhất, thể hiện cách mọi lớp phối hợp. | `COVER_2` |
| **TEXT** | Typography đi kèm — *chưa có mẫu, cần bổ sung.* | — |

Tất cả asset thuộc `ELEMENTS-*` đều là **PNG nền trong suốt (cutout)**, cạnh có độ mờ dần (feather) để chồng lớp mượt — cho thấy hệ thống được thiết kế để **dựng theo parallax/nhiều lớp**, không phải một ảnh phẳng.

---

## 6. Nguyên tắc bố cục (Composition)

1. **3 lớp chiều sâu rõ rệt:**
   - *Hậu cảnh:* trời đêm + cực quang + núi xa — mờ, ít tương phản, tông lạnh nhất.
   - *Trung cảnh:* dãy núi đá gần, thung lũng — tương phản trung bình.
   - *Tiền cảnh:* đá/rêu/nước cutout ở rìa dưới và hai bên khung — chi tiết rõ nhất, đậm nhất, đóng khung (frame) cho cảnh.
2. **Đường chân trời đặt thấp** (~khoảng 1/3 dưới khung hình) để nhường không gian cho bầu trời/cực quang — yếu tố cảm xúc chính.
3. **Đối xứng bất đối xứng:** núi đá cao dồn về bên phải, tiền cảnh cỏ/đá dồn về bên trái — tạo đường chéo dẫn mắt vào trung tâm/dòng suối.
4. **Vật thể hero (hạc pha lê)** dùng để tạo điểm nhấn tương phản chất liệu — có thể đặt nổi giữa cảnh hoặc dùng tách rời làm logo, luôn giữ nền trong suốt.
5. **Z-index khi ghép lớp:** Background → Structure xa → Structure gần/FX → Logo/hero (trên cùng).

---

## 7. Quy ước đặt tên file

`[timestamp]_[TÊN_LỚP_VIẾT_HOA_CÓ_DẤU].png`

- Tên mô tả bằng tiếng Việt có dấu, viết hoa toàn bộ.
- Nhiều từ nối bằng dấu gạch dưới `_`.
- Có hậu tố phương vị khi asset có bản đối xứng: `_TRÁI` / `_PHẢI`.
- Biến thể cùng nhóm đánh số: `_2`, `_3`...
- Ví dụ: `ROCK_PHẢI`, `ROCK_PHẢI_-_2`, `ĐẤT_TRÁI`.

---

## 8. Hướng dẫn ứng dụng

- **Phù hợp cho:** splash/loading screen, trang chủ web, banner sự kiện mùa đông/huyền ảo, bộ nhận diện có yếu tố "thiên nhiên + phép màu", intro game/app.
- **Dùng LOGO (hạc) độc lập:** giữ nền trong suốt; khi đặt trên nền sáng nên thêm glow/bóng đổ xanh nhẹ để không bị "chìm"; tránh đặt trên nền có hoa văn phức tạp vì chất liệu pha lê đã rất chi tiết.
- **Khi tạo thêm asset mới:** giữ nguyên tông đơn sắc xanh cho mọi yếu tố tự nhiên (kể cả các yếu tố vốn có màu ấm ngoài đời thật); chỉ dùng màu ấm cho các hạt sáng/phép màu kích thước nhỏ.
- **Animation gợi ý:** cực quang chuyển động chậm dạng sóng; hạt pha lê trôi nổi/lấp lánh ngẫu nhiên; nước chảy liên tục ở FX layer; các lớp structure giữ tĩnh để làm khung tham chiếu.

---

## 9. Việc còn thiếu / cần bổ sung

- [ ] Chưa có mẫu **TEXT** — cần asset hoặc mô tả font chữ, màu, cách canh chỉnh khi đặt lên nền này.
- [ ] Chưa có bản BACKGROUND tách lớp riêng (hiện đang tích hợp trong `MAIN`) — nên tách riêng nếu cần dựng parallax thực sự.
- [ ] Chưa rõ các trạng thái/biến thể khác của LOGO hạc (bay, icon thu nhỏ, phiên bản đơn sắc/mono cho favicon...).
