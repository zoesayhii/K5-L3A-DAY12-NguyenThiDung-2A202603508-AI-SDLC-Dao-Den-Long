# Spec Phase 3 (Ticket-03 "Đèn cạn dầu", contract v1.2)

ADR: [docs/ADR-0003-den-nhien-lieu-va-luat-thang.md](docs/ADR-0003-den-nhien-lieu-va-luat-thang.md). Thay đổi phá vỡ: [CHANGELOG.md](CHANGELOG.md). Kiểm chứng: `scripts/verify.sh` (log `evidence/phase-3/`).

| Mục Ticket | Tiêu chí (làm A thì thấy B) | Trạng thái |
|---|---|---|
| 1 Nhiên liệu | Đèn vừa thắp fuel 100; hao 1/s; châm dầu `used = min(mang, ceil((100-fuel)/10))`, +10/đom đóm; hết dầu → `lantern_out`, `deposited` 0, `ever_lit` true; thắp lại cần 5 | Headless đạt |
| 1 Hiển thị | Thanh dầu trên đèn sáng; `fuel < 30` nhấp nháy 1 Hz | UI: chưa thấy trực tiếp lúc chơi |
| 2 Hút dầu | `fuel < 30` mất vùng an toàn (đúng 30 còn); `wander` chọn đèn yếu gần nhất; ≤ 2 m → `drain` hút 5/s cộng dồn; chuyển trạng thái theo Ticket; châm lên ≥ 30 thì đẩy Bóng Mực ra, không sát thương | Headless đạt |
| 3 Thắng | 240/270/300 s; thắng = sống tới bình minh và ≥ 3/5, 4/6, 5/7 đèn sáng; không thắng sớm; hết lửa luôn `no_flames` | Headless đạt |
| 4 Sức chứa | `10 + 2 × successful_lights`, tối đa 20; HUD mang/sức chứa | Headless đạt; HUD đã làm |
| 5 Điểm | +5/đom đóm, +100 lần đầu, +40 thắp lại, Tỏa Sáng +5 (+15 nếu drain), bình minh `50+floor(fuel)`/đèn và +50/Ngọn Lửa | Headless đạt |
| 6 Mù màu | Cài đặt "Bảng màu dễ phân biệt" (lưu): viền/mắt `#00B3FF`, cảnh báo `#FFFFFF` + ⚠; đèn tắt xẹp 20% có vết rách | UI: đã làm, chưa thao tác thử |
| 7 Contract v1.2 | tuning, snapshot, scenario, event mới | Headless đạt |

Giả định: xem mục "Giả định cần xác nhận" của ADR-0003.
